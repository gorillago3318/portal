const express = require('express');
const { checkRole } = require('../middleware/authMiddleware'); // Updated to match the middleware structure
const router = express.Router();
const Agent = require('../models/agent');

// Helper function to send a response
const sendResponse = (res, status, message, data = null, error = null) => {
    const response = { message, data };
    if (error) response.error = error;
    res.status(status).json(response);
};

// Approve or Reject an Agent (Admin only)
router.patch('/:id/approval', checkRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Active', 'Inactive'].includes(status)) {
        return sendResponse(res, 400, 'Invalid status. Only "Active" or "Inactive" are allowed.');
    }

    try {
        const agent = await Agent.findByPk(id);

        if (!agent) return sendResponse(res, 404, 'Agent not found');
        if (agent.status !== 'Pending') {
            return sendResponse(res, 400, `Agent status must be "Pending" to approve or reject.`);
        }

        agent.status = status;
        await agent.save();
        sendResponse(res, 200, `Agent status updated to ${status}`, agent);
    } catch (error) {
        sendResponse(res, 500, 'Error updating agent status', null, error.message);
    }
});

// Create a new agent (Admin or System Use)
router.post('/', async (req, res) => {
    const { name, phone, email, location, status } = req.body;

    try {
        const existingAgent = await Agent.findOne({
            where: { phone },
            paranoid: false,
        });

        if (existingAgent) {
            const msg = existingAgent.deletedAt
                ? 'This phone number belongs to a soft-deleted agent. Restore the agent or use a different phone number.'
                : 'Phone number already in use';
            return sendResponse(res, 400, msg);
        }

        const newAgent = await Agent.create({ name, phone, email, location, status: status || 'Active' });
        sendResponse(res, 201, 'Agent created successfully', newAgent);
    } catch (error) {
        sendResponse(res, 500, 'Error creating agent', null, error.message);
    }
});

// Self-Registration (Default Pending Status)
router.post('/register', async (req, res) => {
    const { name, phone, email, location, bank_name, account_number } = req.body;

    try {
        // Check if phone number is already in use
        const existingAgent = await Agent.findOne({ where: { phone }, paranoid: false });
        if (existingAgent) {
            return res.status(400).json({ error: 'Phone number already in use' });
        }

        // Validate required fields
        if (!bank_name || !account_number) {
            return res.status(400).json({ error: 'Bank name and account number are required for registration' });
        }

        // Create a new agent with default 'Pending' status
        const newAgent = await Agent.create({
            name,
            phone,
            email,
            location,
            bank_name,
            account_number,
            status: 'Pending',
        });

        res.status(201).json({
            message: 'Registration successful. Awaiting approval.',
            agent: newAgent,
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error registering agent',
            details: error.message,
        });
    }
});


router.post('/register-referrer', checkRole(['Admin']), async (req, res) => {
    const { name, phone, email, linked_agent_id, bank_name, account_number } = req.body;

    try {
        // Validate linked agent existence
        const linkedAgent = await Agent.findByPk(linked_agent_id);
        if (!linkedAgent) {
            return res.status(404).json({ error: 'Linked agent not found' });
        }

        // Validate phone number uniqueness
        const existingReferrer = await Agent.findOne({ where: { phone }, paranoid: false });
        if (existingReferrer) {
            return res.status(400).json({ error: 'Phone number already in use' });
        }

        // Validate required fields
        if (!bank_name || !account_number) {
            return res.status(400).json({ error: 'Bank name and account number are required' });
        }

        // Create a new referrer
        const referrer = await Agent.create({
            name,
            phone,
            email,
            role: 'Referrer',
            parent_referrer_id: linked_agent_id,
            bank_name,
            account_number,
            status: 'Active',
        });

        res.status(201).json({ message: 'Referrer registered successfully', referrer });
    } catch (error) {
        res.status(500).json({ error: 'Error registering referrer', details: error.message });
    }
});

// Generate Referral Link for an Agent
router.get('/:id/referral-link', async (req, res) => {
    const { id } = req.params;

    try {
        const agent = await Agent.findByPk(id);
        if (!agent) return sendResponse(res, 404, 'Agent not found');

        const referralLink = `${process.env.BASE_URL || 'http://localhost:5000'}/api/leads?referral_code=${agent.referral_code}`;
        sendResponse(res, 200, 'Referral link generated successfully', { referralLink });
    } catch (error) {
        sendResponse(res, 500, 'Error generating referral link', null, error.message);
    }
});

// Get all agents
router.get('/', async (req, res) => {
    try {
        const agents = await Agent.findAll();
        sendResponse(res, 200, 'Agents retrieved successfully', agents);
    } catch (error) {
        sendResponse(res, 500, 'Error fetching agents', null, error.message);
    }
});

// Get Pending Agents
router.get('/pending', async (req, res) => {
    try {
        const pendingAgents = await Agent.findAll({ where: { status: 'Pending' } });
        sendResponse(res, 200, 'Pending agents retrieved successfully', pendingAgents);
    } catch (error) {
        sendResponse(res, 500, 'Error fetching pending agents', null, error.message);
    }
});

// Approve or Reject an Agent (Admin only)
router.patch('/:id/approval', checkRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Expect "Active" or "Rejected"

    try {
        if (!['Active', 'Rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Allowed values are "Active" or "Rejected".' });
        }

        const agent = await Agent.findByPk(id);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        if (agent.status !== 'Pending') {
            return res.status(400).json({ error: 'Agent must be in "Pending" status for approval or rejection.' });
        }

        agent.status = status;
        await agent.save();

        res.status(200).json({ message: `Agent status updated to: ${status}`, agent });
    } catch (error) {
        res.status(500).json({ error: 'Error updating agent approval status', details: error.message });
    }
});

// Update Agent Operational Status (Admin Only)
router.patch('/:id/status', checkRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Expect "Active" or "Inactive"

    try {
        // Validate the provided status
        if (!['Active', 'Inactive'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status. Allowed values are "Active" or "Inactive".',
            });
        }

        const agent = await Agent.findByPk(id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (!['Active', 'Inactive'].includes(agent.status)) {
            return res.status(400).json({ error: 'Only agents with "Active" or "Inactive" status can change operational status.' });
        }

        // Update the status
        agent.status = status;
        await agent.save();

        // Respond with success
        res.status(200).json({
            message: `Agent status updated to: ${status}`,
            agent,
        });
    } catch (error) {
        console.error('[ERROR] Error updating agent status:', error.message);
        res.status(500).json({
            error: 'Error updating agent status',
            details: error.message,
        });
    }
});

// Update Agent Details (Admin and Agent Roles Allowed)
router.patch('/:id', checkRole(['Admin', 'Agent']), async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, location, bank_name, account_number } = req.body;

    try {
        // Find the agent by ID
        const agent = await Agent.findByPk(id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Check for unique phone number if it's being updated
        if (phone && phone !== agent.phone) {
            const existingAgent = await Agent.findOne({ where: { phone }, paranoid: false });
            if (existingAgent) {
                return res.status(400).json({ error: 'Phone number already in use' });
            }
        }

        // Update only the fields provided in the request
        agent.name = name ?? agent.name; // Preserve existing value if `name` is not provided
        agent.phone = phone ?? agent.phone;
        agent.email = email ?? agent.email;
        agent.location = location ?? agent.location;
        agent.bank_name = bank_name ?? agent.bank_name;
        agent.account_number = account_number ?? agent.account_number;

        await agent.save();

        res.status(200).json({ message: 'Agent details updated successfully', agent });
    } catch (error) {
        res.status(500).json({ error: 'Error updating agent details', details: error.message });
    }
});




// Delete an Agent
router.delete('/:id', checkRole(['Admin']), async (req, res) => {
    const { id } = req.params;

    try {
        const agent = await Agent.findByPk(id);
        if (!agent) return sendResponse(res, 404, 'Agent not found');

        await agent.destroy();
        sendResponse(res, 200, 'Agent deleted successfully');
    } catch (error) {
        sendResponse(res, 500, 'Error deleting agent', null, error.message);
    }
});

module.exports = router;
