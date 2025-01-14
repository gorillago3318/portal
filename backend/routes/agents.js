const express = require('express');
const { checkRole } = require('../middleware/authMiddleware'); // Middleware for role checking
const router = express.Router();
const { Agent } = require('../models'); // Adjusted import for models

// Helper function to send a response
const sendResponse = (res, status, message, data = null, error = null) => {
    const response = { message, data };
    if (error) response.error = error;
    res.status(status).json(response);
};

// Create a new agent (Admin)
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

        // Create the new agent with the default referral code generation handled by beforeCreate
        const newAgent = await Agent.create({
            name,
            phone,
            email,
            location,
            status: status || 'Active',  // Default to 'Active' if no status is provided
        });

        sendResponse(res, 201, 'Agent created successfully', newAgent);
    } catch (error) {
        sendResponse(res, 500, 'Error creating agent', null, error.message);
    }
});

// Self-Registration (Default Pending Status)
router.post('/register', async (req, res) => {
    const { name, phone, email, location, bank_name, account_number, referrer_code } = req.body;

    try {
        const existingAgent = await Agent.findOne({ where: { phone }, paranoid: false });
        if (existingAgent) {
            return sendResponse(res, 400, 'Phone number already in use');
        }

        if (!bank_name || !account_number) {
            return sendResponse(res, 400, 'Bank name and account number are required for registration');
        }

        let parent_referrer_id = null;
        if (referrer_code) {
            // Find the agent using the referral code
            const referrer = await Agent.findOne({ where: { referral_code: referrer_code } });
            if (!referrer) {
                return sendResponse(res, 404, 'Referrer not found');
            }
            parent_referrer_id = referrer.id;  // Set the referrer ID (parent_referrer_id)
        }

        const newAgent = await Agent.create({
            name,
            phone,
            email,
            location,
            bank_name,
            account_number,
            status: 'Pending',  // Default status
            parent_referrer_id,  // Link the agent to the referrer
        });

        sendResponse(res, 201, 'Registration successful. Awaiting approval.', newAgent);
    } catch (error) {
        sendResponse(res, 500, 'Error registering agent', null, error.message);
    }
});

// Register a Referrer (Agents Only)
router.post('/register-referrer', async (req, res) => {
    const { name, phone, email, location, bank_name, account_number, referrer_code } = req.body;

    try {
        // Find the agent using the referrer code
        const referrer = await Agent.findOne({ where: { referral_code: referrer_code } });
        if (!referrer) {
            return sendResponse(res, 404, 'Referrer not found');
        }

        // Check if the phone number is already in use (soft-deleted agents included)
        const existingAgent = await Agent.findOne({ where: { phone }, paranoid: false });
        if (existingAgent) {
            return sendResponse(res, 400, 'Phone number already in use');
        }

        if (!bank_name || !account_number) {
            return sendResponse(res, 400, 'Bank name and account number are required');
        }

        // Create the referrer agent
        const newReferrer = await Agent.create({
            name,
            phone,
            email,
            location,
            bank_name,
            account_number,
            role: 'Referrer',
            parent_referrer_id: referrer.id,  // Link the referrer to the parent agent
            status: 'Active',  // Default status for referrers is Active
        });

        sendResponse(res, 201, 'Referrer registered successfully', newReferrer);
    } catch (error) {
        sendResponse(res, 500, 'Error registering referrer', null, error.message);
    }
});

// Create a new lead and assign to the parent agent of the referrer
router.post('/leads', async (req, res) => {
    const { name, contact, referrer_code } = req.body;

    try {
        let parentAgentId = null;

        if (referrer_code) {
            // Find the referrer using the referral code
            const referrer = await Agent.findOne({ where: { referral_code: referrer_code } });
            if (!referrer) {
                return sendResponse(res, 404, 'Referrer not found');
            }
            parentAgentId = referrer.parent_referrer_id;  // Get the parent agent of the referrer
            if (!parentAgentId) {
                return sendResponse(res, 404, 'Parent agent not found');
            }
        }

        // Create the lead and assign to the parent agent of the referrer
        const newLead = await Lead.create({
            name,
            contact,
            referrer_code,  // Store the referrer_code
            parent_agent_id: parentAgentId,  // Assign to the parent agent
        });

        sendResponse(res, 201, 'Lead created successfully', newLead);
    } catch (error) {
        sendResponse(res, 500, 'Error creating lead', null, error.message);
    }
});

// Generate Referral Link
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

// Fetch Agents
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

// Approve/Reject Agent
router.patch('/:id/approval', checkRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate allowed status changes: only 'Active' or 'Rejected' are allowed
    if (!['Active', 'Rejected'].includes(status)) {
        return sendResponse(res, 400, 'Invalid status. Allowed values are "Active" or "Rejected".');
    }

    try {
        const agent = await Agent.findByPk(id);
        if (!agent) return sendResponse(res, 404, 'Agent not found');

        // Only 'Pending' agents can be approved or rejected
        if (agent.status !== 'Pending') {
            return sendResponse(res, 400, 'Only "Pending" agents can be approved or rejected.');
        }

        // Set the new status
        agent.status = status;
        await agent.save();

        sendResponse(res, 200, `Agent status updated to: ${status}`, agent);
    } catch (error) {
        sendResponse(res, 500, 'Error updating agent approval status', null, error.message);
    }
});


// Update Agent Status (Active <-> Inactive)
router.patch('/:id/status', checkRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate allowed status changes
    if (!['Active', 'Inactive'].includes(status)) {
        return sendResponse(res, 400, 'Invalid status. Allowed values are "Active" or "Inactive".');
    }

    try {
        const agent = await Agent.findByPk(id);
        if (!agent) return sendResponse(res, 404, 'Agent not found');

        // If the status is already the same, return an error
        if (agent.status === status) {
            return sendResponse(res, 400, `Agent is already ${status}.`);
        }

        // Only allow switching between Active/Inactive
        if (['Active', 'Inactive'].includes(agent.status)) {
            agent.status = status;  // Change to Active or Inactive
        } else {
            return sendResponse(res, 400, 'Status can only be updated between "Active" and "Inactive".');
        }

        await agent.save();

        sendResponse(res, 200, `Agent status updated to: ${status}`, agent);
    } catch (error) {
        sendResponse(res, 500, 'Error updating agent status', null, error.message);
    }
});


// Deactivate Referrer (Admin only)
router.patch('/:id/status', checkRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Only allow 'Inactive' or 'Active' as valid status for referrers
    if (!['Active', 'Inactive'].includes(status)) {
        return sendResponse(res, 400, 'Invalid status. Allowed values are "Active" or "Inactive".');
    }

    try {
        const referrer = await Agent.findByPk(id);
        if (!referrer) {
            return sendResponse(res, 404, 'Referrer not found');
        }

        // Ensure the agent is a referrer
        if (referrer.role !== 'Referrer') {
            return sendResponse(res, 400, 'Only referrers can have their status updated');
        }

        referrer.status = status;
        await referrer.save();

        sendResponse(res, 200, `Referrer status updated to: ${status}`, referrer);
    } catch (error) {
        sendResponse(res, 500, 'Error updating referrer status', null, error.message);
    }
});


// Update Agent Details
router.patch('/:id', checkRole(['Admin', 'Agent']), async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, location, bank_name, account_number } = req.body;

    try {
        const agent = await Agent.findByPk(id);
        if (!agent) return sendResponse(res, 404, 'Agent not found');

        if (phone && phone !== agent.phone) {
            const existingAgent = await Agent.findOne({ where: { phone }, paranoid: false });
            if (existingAgent) {
                return sendResponse(res, 400, 'Phone number already in use');
            }
        }

        agent.name = name ?? agent.name;
        agent.phone = phone ?? agent.phone;
        agent.email = email ?? agent.email;
        agent.location = location ?? agent.location;
        agent.bank_name = bank_name ?? agent.bank_name;
        agent.account_number = account_number ?? agent.account_number;

        await agent.save();
        sendResponse(res, 200, 'Agent details updated successfully', agent);
    } catch (error) {
        sendResponse(res, 500, 'Error updating agent details', null, error.message);
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
