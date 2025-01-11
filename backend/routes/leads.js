const express = require('express');
const { Op } = require('sequelize');
const { validate: isUuid } = require('uuid'); // UUID validation
const router = express.Router();
const Lead = require('../models/lead');
const Agent = require('../models/agent');

// Maximum limit for pagination
const MAX_LIMIT = 100;

// Allowed status transitions
const allowedTransitions = {
    New: ['Assigned', 'Contacted'], // Allow 'Contacted' directly from 'New'
    Assigned: ['Contacted'],
    Contacted: ['Preparing Documents'],
    PreparingDocuments: ['Submitted'],
    Submitted: ['Approved', 'Declined', 'KIV'],
    Approved: ['Accepted', 'Rejected'],
};


// Send a notification placeholder
const sendNotification = async (agentId, leadId) => {
    try {
        const agent = await Agent.findByPk(agentId);
        const lead = await Lead.findByPk(leadId);

        if (agent && lead) {
            console.log(`[DEBUG] Notification sent: { lead: ${lead.id}, agent: ${agent.id} }`);
        } else {
            console.warn('[WARN] Notification skipped: Agent or Lead not found');
        }
    } catch (error) {
        console.error(`[ERROR] Failed to send notification: ${error.message}`);
    }
};

// Create a new lead
router.post('/', async (req, res) => {
    console.log('[DEBUG] POST /api/leads called');
    console.log('Request Body:', req.body);

    try {
        const { name, phone, loan_amount, estimated_savings, status, assigned_agent_id } = req.body;

        // Validate assigned_agent_id if provided
        if (assigned_agent_id) {
            console.log('[DEBUG] Validating assigned_agent_id:', assigned_agent_id);
            if (!isUuid(assigned_agent_id)) {
                console.error('[ERROR] Invalid assigned_agent_id format:', assigned_agent_id);
                return res.status(400).json({ error: 'Invalid assigned_agent_id format' });
            }

            const agent = await Agent.findByPk(assigned_agent_id);
            if (!agent) {
                console.error('[ERROR] Assigned agent not found:', assigned_agent_id);
                return res.status(400).json({ error: 'Assigned agent not found' });
            }
        }

        const newLead = await Lead.create({
            name,
            phone,
            loan_amount,
            estimated_savings,
            status: status || 'New',
            assigned_agent_id,
        });

        console.log('[DEBUG] New Lead Created:', newLead);
        res.status(201).json(newLead);
    } catch (error) {
        console.error('[ERROR] Error creating lead:', error.message);
        res.status(500).json({ error: 'Error creating lead', details: error.message });
    }
});

// Get all leads with advanced filtering and pagination
router.get('/', async (req, res) => {
    console.log('[DEBUG] GET /api/leads called');
    console.log('[DEBUG] Query Parameters:', req.query);

    try {
        const { status, agent_id, start_date, end_date, page = 1, limit = 10 } = req.query;

        // Validate query parameters
        const pageNumber = parseInt(page, 10);
        const pageSize = Math.min(parseInt(limit, 10), MAX_LIMIT);

        if (isNaN(pageNumber) || isNaN(pageSize) || pageNumber < 1 || pageSize < 1) {
            return res.status(400).json({ error: 'Invalid pagination parameters' });
        }

        const filter = {};
        if (status) filter.status = status;
        if (agent_id) filter.assigned_agent_id = agent_id;
        if (start_date && end_date) {
            filter.createdAt = {
                [Op.between]: [new Date(start_date), new Date(end_date)],
            };
        }

        console.log('[DEBUG] Filter Criteria:', filter);

        const offset = (pageNumber - 1) * pageSize;

        const leads = await Lead.findAndCountAll({
            where: filter,
            limit: pageSize,
            offset,
            include: [
                {
                    model: Agent,
                    as: 'agent', // Match alias in model association
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
        res.status(500).json({ error: 'Error fetching leads', details: error.message });
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

        if (agent_id) {
            console.log('[DEBUG] Validating Agent ID:', agent_id);
            if (!isUuid(agent_id)) {
                console.error('[ERROR] Invalid agent ID format:', agent_id);
                return res.status(400).json({ error: 'Invalid agent ID format' });
            }

            const agent = await Agent.findByPk(agent_id);
            if (!agent) {
                console.error('[ERROR] Agent not found:', agent_id);
                return res.status(400).json({ error: 'Invalid agent ID' });
            }

            lead.assigned_agent_id = agent_id;
            console.log(`[DEBUG] Agent ${agent_id} assigned to Lead ${id}`);
            await sendNotification(agent_id, id);
        }

        if (status) {
            console.log(`[DEBUG] Validating Status Transition: ${lead.status} -> ${status}`);
            const allowedStatuses = allowedTransitions[lead.status];
            if (!allowedStatuses || !allowedStatuses.includes(status)) {
                console.error(`[ERROR] Invalid status transition: ${lead.status} -> ${status}`);
                return res.status(400).json({
                    error: 'Invalid status transition',
                    details: `Cannot transition from '${lead.status}' to '${status}'`,
                });
            }

            if (['Approved', 'Declined', 'KIV', 'Accepted', 'Rejected'].includes(status) && role !== 'admin') {
                console.error('[ERROR] Unauthorized status update attempt by non-admin user');
                return res.status(403).json({ error: 'Only admins can update to this status' });
            }

            lead.status = status;
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
