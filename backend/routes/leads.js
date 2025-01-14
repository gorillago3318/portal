const express = require('express');
const { Op } = require('sequelize');
const { validate: isUuid } = require('uuid'); // UUID validation
const router = express.Router();
const { Lead, Agent, Commission } = require('../models'); // Import models
const { calculateCommission } = require('../utils/commissionUtils'); // Import commission calculation utility

// Constants
const MAX_LIMIT = 100;
const allowedTransitions = {
    New: ['Assigned', 'Contacted'],
    Assigned: ['Contacted'],
    Contacted: ['Preparing Documents'],
    'Preparing Documents': ['Submitted'],
    Submitted: ['Approved', 'Declined', 'KIV'],
    Approved: ['Accepted', 'Declined', 'KIV'],
    Declined: [],
    KIV: ['Submitted'],
    Accepted: [],
};

// Helper Function: Send Error Response
const sendError = (res, status, message, details = null) => {
    const errorResponse = { error: message };
    if (details) errorResponse.details = details;
    res.status(status).json(errorResponse);
};

// Helper Function: Validate Status Transition
const isValidTransition = (currentStatus, newStatus, role) => {
    const allowedStatuses = allowedTransitions[currentStatus];
    if (!allowedStatuses || !allowedStatuses.includes(newStatus)) {
        return false;
    }

    if (
        ['Approved', 'Declined', 'KIV'].includes(newStatus) &&
        role !== 'Admin'
    ) {
        return false;
    }

    return true;
};

// Create a new lead (assign to the parent agent of the referrer)
router.post('/', async (req, res) => {
    const { name, phone, loan_amount, referrer_code } = req.body;

    try {
        // Validate required fields
        if (!name || !phone || !loan_amount) {
            return res.status(400).json({ error: 'Name, phone, and loan amount are required.' });
        }

        // Validate phone number (10-15 digits)
        const phonePattern = /^[0-9]{10,15}$/;
        if (!phonePattern.test(phone)) {
            return res.status(400).json({ error: 'Phone number must be between 10 and 15 digits and contain only numbers.' });
        }

        let parentAgentId = null;
        let referrerId = null;

        // If a referrer code is provided, find the referrer agent
        if (referrer_code) {
            const referrer = await Agent.findOne({ where: { referral_code: referrer_code } });
            if (!referrer) {
                return res.status(404).json({ error: 'Referrer not found' });
            }

            // Validate that the parent_referrer_id is a valid UUID
            if (referrer.parent_referrer_id && !isUuid(referrer.parent_referrer_id)) {
                return res.status(400).json({ error: 'Invalid parent referrer ID.' });
            }

            // Get the parent agent of the referrer (the agent who will handle the lead)
            parentAgentId = referrer.parent_referrer_id;
            referrerId = referrer.id;  // Referrer ID should be assigned here
            
            if (!parentAgentId) {
                return res.status(404).json({ error: 'Parent agent not found' });
            }
        }

        // Create the lead and assign to the parent agent of the referrer
        const newLead = await Lead.create({
            name,
            phone,  // Use phone instead of contact
            loan_amount,
            referrer_code,
            assigned_agent_id: parentAgentId,  // Set assigned_agent_id to parentAgentId
            referrer_id: referrerId,  // Set referrer_id to the referrer's ID
        });

        res.status(201).json({
            message: 'Lead created successfully',
            data: newLead,
        });
    } catch (error) {
        console.error('[ERROR] Error creating lead:', error);  // Log error details
        res.status(500).json({ error: 'Error creating lead', details: error.message });
    }
});



// Route: Get Leads with Pagination and Filters
router.get('/', async (req, res) => {
    try {
        const { status, agent_id, start_date, end_date, page = 1, limit = 10 } = req.query;
        const filter = {};
        const pageNumber = parseInt(page, 10);
        const pageSize = Math.min(parseInt(limit, 10), MAX_LIMIT);

        if (isNaN(pageNumber) || pageNumber < 1 || isNaN(pageSize) || pageSize < 1) {
            return sendError(res, 400, 'Invalid pagination parameters');
        }

        if (status) filter.status = status;
        if (agent_id) filter.assigned_agent_id = agent_id;
        if (start_date && end_date) {
            filter.createdAt = {
                [Op.between]: [new Date(start_date), new Date(end_date)],
            };
        }

        const offset = (pageNumber - 1) * pageSize;

        const leads = await Lead.findAndCountAll({
            where: filter,
            limit: pageSize,
            offset,
            include: [
                {
                    model: Agent,
                    as: 'agent',
                    attributes: ['id', 'name', 'phone', 'email'],
                },
            ],
        });

        res.status(200).json({
            total: leads.count,
            totalPages: Math.ceil(leads.count / pageSize),
            currentPage: pageNumber,
            leads: leads.rows,
        });
    } catch (error) {
        console.error('[ERROR] Error fetching leads:', error.message);
        sendError(res, 500, 'Error fetching leads', error.message);
    }
});

// Route: Get a Single Lead by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const lead = await Lead.findByPk(id, {
            include: [
                {
                    model: Agent,
                    as: 'agent',
                    attributes: ['id', 'name', 'phone', 'email'],
                },
            ],
        });

        if (!lead) return sendError(res, 404, 'Lead not found');

        res.status(200).json(lead);
    } catch (error) {
        console.error('[ERROR] Error fetching lead:', error.message);
        sendError(res, 500, 'Error fetching lead', error.message);
    }
});

// Route: Update Lead Status or Assign Agent
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, role, assigned_agent_id, loan_amount } = req.body;

        // Fetch the lead by ID
        const lead = await Lead.findByPk(id);
        if (!lead) {
            return sendError(res, 404, 'Lead not found');
        }

        // Assign agent if provided
        if (assigned_agent_id) {
            const agent = await Agent.findByPk(assigned_agent_id);
            if (!agent) return sendError(res, 400, 'Invalid agent ID');
            lead.assigned_agent_id = assigned_agent_id;
        }

        // Status transition validation
        if (status) {
            if (!isValidTransition(lead.status, status, role)) {
                return sendError(res, 400, `Invalid status transition from '${lead.status}' to '${status}'`);
            }

            lead.status = status;

            // If status is 'Accepted', validate and calculate commission
            if (status === 'Accepted') {
                if (!loan_amount) return sendError(res, 400, 'Loan amount is required for commissions.');

                const { maxCommission, referrerCommission, agentCommission } = calculateCommission(loan_amount, lead.referrer_id);

                await Commission.create({
                    lead_id: lead.id,
                    agent_id: lead.assigned_agent_id,
                    referrer_id: lead.referrer_id,
                    loan_amount,
                    max_commission: maxCommission,
                    referrer_commission: referrerCommission,
                    agent_commission: agentCommission,
                    status: 'Pending',
                });
            }
        }

        // Save the updated lead
        await lead.save();
        const updatedLead = await Lead.findByPk(id); // Fetch updated data
        res.status(200).json(updatedLead);
    } catch (error) {
        console.error('[ERROR] Error updating lead:', error.message);
        sendError(res, 500, 'Error updating lead', error.message);
    }
});


// Export Router
module.exports = router;
