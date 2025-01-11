const express = require('express');
const router = express.Router();
const Agent = require('../models/agent');

// Create a new agent
router.post('/', async (req, res) => {
    console.log('[DEBUG] POST /api/agents called');
    console.log('Request Body:', req.body);

    try {
        const { name, phone, email, location, status } = req.body;

        // Check for duplicate phone number (including soft-deleted records)
        const existingAgent = await Agent.findOne({
            where: { phone },
            paranoid: false // Include soft-deleted records
        });

        if (existingAgent) {
            console.error('[ERROR] Duplicate phone number:', phone);

            // If the agent is soft-deleted, provide a specific message
            if (existingAgent.deletedAt) {
                return res.status(400).json({
                    error: 'Phone number already in use',
                    details: 'This phone number belongs to a soft-deleted agent. Restore the agent or use a different phone number.'
                });
            }

            return res.status(400).json({ error: 'Phone number already in use' });
        }

        // Create the new agent
        const newAgent = await Agent.create({
            name,
            phone,
            email,
            location,
            status: status || 'Active',
        });

        console.log('[DEBUG] New Agent Created:', newAgent);
        res.status(201).json(newAgent);
    } catch (error) {
        if (error.name === 'SequelizeValidationError') {
            console.error('[ERROR] Validation details:', error.errors);
            return res.status(400).json({
                error: 'Validation error',
                details: error.errors.map(e => e.message),
            });
        }

        console.error('[ERROR] Error creating agent:', error.message);
        res.status(500).json({ error: 'Error creating agent', details: error.message });
    }
});

// Get all agents
router.get('/', async (req, res) => {
    console.log('[DEBUG] GET /api/agents called');

    try {
        const agents = await Agent.findAll();
        console.log('[DEBUG] Agents Retrieved:', agents.length);
        res.status(200).json(agents);
    } catch (error) {
        console.error('[ERROR] Error fetching agents:', error.message);
        res.status(500).json({ error: 'Error fetching agents', details: error.message });
    }
});

// Update an agent
router.patch('/:id', async (req, res) => {
    console.log(`[DEBUG] PATCH /api/agents/${req.params.id} called`);
    console.log('Request Body:', req.body);

    try {
        const { id } = req.params;
        const { name, phone, email, location, status } = req.body;

        const agent = await Agent.findByPk(id);
        if (!agent) {
            console.error('[ERROR] Agent not found:', id);
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Check for duplicate phone number when updating
        if (phone && phone !== agent.phone) {
            const existingAgent = await Agent.findOne({
                where: { phone },
                paranoid: false // Include soft-deleted records
            });

            if (existingAgent) {
                console.error('[ERROR] Duplicate phone number during update:', phone);
                return res.status(400).json({ error: 'Phone number already in use' });
            }
        }

        agent.name = name || agent.name;
        agent.phone = phone || agent.phone;
        agent.email = email || agent.email;
        agent.location = location || agent.location;
        agent.status = status || agent.status;

        await agent.save();
        console.log(`[DEBUG] Agent ${id} updated successfully.`);
        res.status(200).json(agent);
    } catch (error) {
        console.error('[ERROR] Error updating agent:', error.message);
        res.status(500).json({ error: 'Error updating agent', details: error.message });
    }
});

// Delete an agent
router.delete('/:id', async (req, res) => {
    console.log(`[DEBUG] DELETE /api/agents/${req.params.id} called`);

    try {
        const { id } = req.params;

        const agent = await Agent.findByPk(id);
        if (!agent) {
            console.error('[ERROR] Agent not found:', id);
            return res.status(404).json({ error: 'Agent not found' });
        }

        await agent.destroy();
        console.log(`[DEBUG] Agent ${id} deleted successfully.`);
        res.status(200).json({ message: 'Agent deleted successfully' });
    } catch (error) {
        console.error('[ERROR] Error deleting agent:', error.message);
        res.status(500).json({ error: 'Error deleting agent', details: error.message });
    }
});

module.exports = router;
