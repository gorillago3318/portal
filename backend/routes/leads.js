const express = require('express');
const { Op } = require('sequelize');
const { validate: isUuid } = require('uuid'); // UUID validation
const router = express.Router();
const Lead = require('../models/lead');
const Agent = require('../models/agent');

// Constants
const MAX_LIMIT = 100;
const allowedTransitions = {
    'New': ['Assigned', 'Contacted'],
    'Assigned': ['Contacted'],
    'Contacted': ['Preparing Documents'],
    'Preparing Documents': ['Submitted'],
    'Submitted': ['Approved', 'Declined', 'KIV'],
    'Approved': ['Accepted', 'Rejected', 'Declined', 'KIV'], // Admin can adjust as needed
    'Declined': ['Approved', 'KIV'], // Admin can adjust as needed
    'KIV': ['Submitted', 'Approved', 'Declined'], // Admin can adjust as needed
};



// Helper Function: Fetch a Lead or Agent by ID
async function fetchEntityById(model, id, entityName, res) {
    const entity = await model.findByPk(id);
    if (!entity) {
        res.status(404).json({ error: `${entityName} not found` });
        return null;
    }
    return entity;
}

// Helper Function: Return Error Responses
function sendError(res, status, message, details = null) {
    const errorResponse = { error: message };
    if (details) errorResponse.details = details;
    res.status(status).json(errorResponse);
}

// Helper Function: Validate Status Transition
function validateStatusTransition(currentStatus, newStatus, role, res) {
    const allowedStatuses = allowedTransitions[currentStatus];
    if (!allowedStatuses || !allowedStatuses.includes(newStatus)) {
        sendError(
            res,
            400,
            `Invalid status transition from '${currentStatus}' to '${newStatus}'`
        );
        return false;
    }

    if (
        ['Approved', 'Declined', 'KIV', 'Accepted', 'Rejected'].includes(newStatus) &&
        role !== 'admin'
    ) {
        sendError(res, 403, 'Only admins can update to this status');
        return false;
    }

    return true;
}

// Route: Create a New Lead
router.post('/', async (req, res) => {
    console.log('[DEBUG] POST /api/leads called', req.body);

    try {
        const { name, phone, loan_amount, estimated_savings, status, assigned_agent_id, referral_code } = req.body;
        let agentId = assigned_agent_id;

        // Resolve agent via referral code
        if (referral_code) {
            const agent = await Agent.findOne({ where: { referral_code } });
            if (!agent) return sendError(res, 400, 'Invalid referral code');
            agentId = agent.id;
        }

        // Validate assigned agent
        if (agentId) {
            if (!isUuid(agentId)) return sendError(res, 400, 'Invalid assigned_agent_id format');
            const agent = await fetchEntityById(Agent, agentId, 'Agent', res);
            if (!agent) return;
        }

        // Validate and Create Lead
        const newLead = await Lead.create({
            name,
            phone,
            loan_amount,
            estimated_savings,
            status: status || 'New',
            assigned_agent_id: agentId,
        });

        console.log('[DEBUG] New Lead Created:', newLead);
        res.status(201).json(newLead);
    } catch (error) {
        console.error('[ERROR] Error creating lead:', error.message);
        sendError(res, 500, 'Error creating lead', error.message);
    }
});

// Route: Get Leads with Pagination and Filters
router.get('/', async (req, res) => {
    console.log('[DEBUG] GET /api/leads called', req.query);

    try {
        const { status, agent_id, start_date, end_date, page = 1, limit = 10 } = req.query;
        const filter = {};
        const pageNumber = parseInt(page, 10);
        const pageSize = Math.min(parseInt(limit, 10), MAX_LIMIT);

        // Validate pagination
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

        console.log('[DEBUG] Leads Retrieved:', leads.rows.length);
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

// Get a single lead by ID
router.get('/:id', async (req, res) => {
    console.log(`[DEBUG] GET /api/leads/${req.params.id} called`);
    const { id } = req.params;

    try {
        const lead = await Lead.findByPk(id, {
            include: [
                {
                    model: Agent,
                    as: 'agent', // Ensure this matches your model association
                    attributes: ['id', 'name', 'phone', 'email'],
                },
            ],
        });

        if (!lead) {
            console.error('[ERROR] Lead not found:', id);
            return res.status(404).json({ error: 'Lead not found' });
        }

        console.log('[DEBUG] Lead Retrieved:', lead);
        res.status(200).json(lead);
    } catch (error) {
        console.error('[ERROR] Error fetching lead:', error.message);
        res.status(500).json({ error: 'Error fetching lead', details: error.message });
    }
});

// Update lead status or assign agent
router.patch('/:id', async (req, res) => {
    console.log(`[DEBUG] PATCH /api/leads/${req.params.id} called`);
    console.log('Request Body:', req.body);

    try {
        const { id } = req.params;
        const { status, role, agent_id } = req.body;

        const lead = await Lead.findByPk(id);
        if (!lead) {
            console.error('[ERROR] Lead not found:', id);
            return res.status(404).json({ error: 'Lead not found' });
        }

        console.log('[DEBUG] Lead Found:', lead);

        // Assign an agent if agent_id is provided
        if (agent_id) {
            console.log('[DEBUG] Validating Agent ID:', agent_id);
            const agent = await Agent.findByPk(agent_id);
            if (!agent) {
                console.error('[ERROR] Agent not found:', agent_id);
                return res.status(400).json({ error: 'Invalid agent ID' });
            }
            lead.assigned_agent_id = agent_id;
            console.log(`[DEBUG] Agent ${agent_id} assigned to Lead ${id}`);
        }

        // Validate and handle status transition
        if (status) {
            console.log(`[DEBUG] Validating Status Transition: ${lead.status} -> ${status}`);
            const currentStatus = lead.status;
            const newStatus = status;

            // Check if the transition is valid
            let isValidTransition = allowedTransitions[currentStatus]?.includes(newStatus);

            // Admin-specific bypass rule
            if (
                ['Approved', 'Declined', 'KIV'].includes(currentStatus) &&
                ['Approved', 'Declined', 'KIV'].includes(newStatus) &&
                role === 'Admin'
            ) {
                console.log('[DEBUG] Admin bypass applied for status transition.');
                isValidTransition = true;
            }

            if (!isValidTransition) {
                console.error(`[ERROR] Invalid status transition from '${currentStatus}' to '${newStatus}'`);
                return res.status(400).json({
                    error: `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
                });
            }

            lead.status = newStatus;
        }

        await lead.save();
        console.log(`[DEBUG] Lead ${id} updated successfully.`);
        res.status(200).json(lead);
    } catch (error) {
        console.error('[ERROR] Error updating lead:', error.message);
        res.status(500).json({ error: 'Error updating lead', details: error.message });
    }
});


module.exports = router;
