const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Agent } = require('../models'); // Adjusted import for models
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware'); // Adjust path as needed

/**
 * sendWhatsAppMessage sends a text message via WhatsApp Cloud API.
 *
 * @param {string} phone - Recipient's phone number in international format.
 * @param {string} message - The message text to send.
 */
const sendWhatsAppMessage = async (phone, message) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    console.error('Missing WhatsApp Cloud API configuration.');
    return;
  }
  
  const url = `https://graph.facebook.com/v13.0/${phoneNumberId}/messages`;
  const data = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: message }
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('[DEBUG] WhatsApp Cloud API response:', response.data);
  } catch (error) {
    console.error('[ERROR] WhatsApp Cloud API error:', error.response ? error.response.data : error.message);
  }
};

// Helper function to send a standardized response
const sendResponse = (res, status, message, data = null, error = null) => {
  const response = { message, data };
  if (error) response.error = error;
  res.status(status).json(response);
};

// ------------------------------------------------------
// 1) PUBLIC ROUTES for Password Reset
// ------------------------------------------------------

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return sendResponse(res, 400, 'Phone number is required');
    }
    const agent = await Agent.findOne({ where: { phone }, paranoid: false });
    if (!agent) {
      // Do not reveal whether the phone exists
      return sendResponse(res, 200, 'If this account exists, a reset link has been sent to your phone.');
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000; // Token expires in 1 hour

    agent.reset_password_token = resetToken;
    agent.reset_password_expires = new Date(expires);
    await agent.save();

    const message = `Hi ${agent.name}, use the following token to reset your password: ${resetToken}. It will expire in 1 hour.`;
    await sendWhatsAppMessage(phone, message);
    return sendResponse(res, 200, 'If this account exists, a reset link has been sent to your phone.');
  } catch (error) {
    console.error('[ERROR][forgot-password]:', error.message);
    return sendResponse(res, 500, 'Error initiating password reset', null, error.message);
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { phone, token, new_password } = req.body;
    if (!phone || !token || !new_password) {
      return sendResponse(res, 400, 'Phone number, token, and new_password are required');
    }
    const agent = await Agent.findOne({
      where: { phone, reset_password_token: token },
      paranoid: false,
    });
    if (!agent) {
      return sendResponse(res, 400, 'Invalid or expired token');
    }
    if (Date.now() > agent.reset_password_expires.getTime()) {
      return sendResponse(res, 400, 'Reset token has expired. Please request a new one.');
    }
    if (new_password.length < 8) {
      return sendResponse(res, 400, 'Password must be at least 8 characters long');
    }
    const hashedPassword = await bcrypt.hash(new_password, 10);
    agent.password = hashedPassword;
    agent.reset_password_token = null;
    agent.reset_password_expires = null;
    await agent.save();

    const message = `Hi ${agent.name}, your password has been successfully reset. You can now log in with your new password.`;
    await sendWhatsAppMessage(phone, message);
    return sendResponse(res, 200, 'Password reset successful. You can now log in with your new password.');
  } catch (error) {
    console.error('[ERROR][reset-password]:', error.message);
    return sendResponse(res, 500, 'Error resetting password', null, error.message);
  }
});

// ------------------------------------------------------
// 2) PROTECTED ROUTES (Require authMiddleware & Admin Role)
// ------------------------------------------------------

// Admin creation route
router.post('/create-admin', authMiddleware, checkRole(['Admin']), async (req, res) => {
  const { name, phone, email, location, status } = req.body;
  try {
    const existingAdmin = await Agent.findOne({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with this email already exists.' });
    }
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const newAdmin = await Agent.create({
      name,
      phone,
      email,
      location,
      role: 'Admin',
      status: status || 'Active',  // For admin-created agents, default to Active.
      password: hashedPassword,
    });
    res.status(201).json({
      message: 'Admin created successfully',
      temp_password: tempPassword,
    });
  } catch (error) {
    console.error('[ERROR] Error creating admin:', error.message);
    res.status(500).json({ error: 'Error creating admin', details: error.message });
  }
});

// Admin creates a new agent
router.post('/create-agent', authMiddleware, checkRole(['Admin']), async (req, res) => {
  const { name, phone, email, location, bank_name, account_number, status } = req.body;
  try {
    const existingAgent = await Agent.findOne({ where: { phone } });
    if (existingAgent) {
      return res.status(400).json({ error: 'An agent with this phone number already exists.' });
    }
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const newAgent = await Agent.create({
      name,
      phone,
      email,
      location,
      bank_name,
      account_number,
      role: 'Agent',
      // For agents created by Admin, default status is Active
      status: status || 'Active',
      password: hashedPassword,
    });
    res.status(201).json({
      message: 'Agent created successfully',
      agent: {
        id: newAgent.id,
        name: newAgent.name,
        phone: newAgent.phone,
        email: newAgent.email,
        status: newAgent.status,
        referral_code: newAgent.referral_code,
      },
      temp_password: tempPassword,
    });
  } catch (error) {
    console.error('[ERROR] Error creating agent:', error.message);
    res.status(500).json({ error: 'Error creating agent', details: error.message });
  }
});

// ------------------------------------------------------
// 3) PUBLIC ROUTES for Registration
// ------------------------------------------------------

// Self-registration (agent)
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
      const referrer = await Agent.findOne({ where: { referral_code: referrer_code } });
      if (!referrer) {
        return sendResponse(res, 404, 'Referrer not found');
      }
      parent_referrer_id = referrer.id;
    }
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const newAgent = await Agent.create({
      name,
      phone,
      email,
      location,
      bank_name,
      account_number,
      status: 'Pending', // Self-registration creates agent with Pending status.
      parent_referrer_id,
      password: hashedPassword,
    });
    sendResponse(res, 201, 'Registration successful. Awaiting approval.', {
      id: newAgent.id,
      name: newAgent.name,
      phone: newAgent.phone,
      email: newAgent.email,
      status: newAgent.status,
      referral_code: newAgent.referral_code,
      temp_password: tempPassword,
    });
  } catch (error) {
    console.error('[ERROR] Error registering agent:', error.message);
    sendResponse(res, 500, 'Error registering agent', null, error.message);
  }
});

// Register a referrer
router.post('/register-referrer', async (req, res) => {
  const { name, phone, email, location, bank_name, account_number, referrer_code } = req.body;
  try {
    const referrer = await Agent.findOne({ where: { referral_code: referrer_code } });
    if (!referrer) {
      return sendResponse(res, 404, 'Referrer not found');
    }
    const existingAgent = await Agent.findOne({ where: { phone }, paranoid: false });
    if (existingAgent) {
      return sendResponse(res, 400, 'Phone number already in use');
    }
    if (!bank_name || !account_number) {
      return sendResponse(res, 400, 'Bank name and account number are required');
    }
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const newReferrer = await Agent.create({
      name,
      phone,
      email,
      location,
      bank_name,
      account_number,
      role: 'Referrer',
      parent_referrer_id: referrer.id,
      status: 'Active',
      password: hashedPassword,
    });
    sendResponse(res, 201, 'Referrer registered successfully', {
      id: newReferrer.id,
      name: newReferrer.name,
      phone: newReferrer.phone,
      email: newReferrer.email,
      status: newReferrer.status,
      referral_code: newReferrer.referral_code,
      temp_password: tempPassword,
    });
  } catch (error) {
    console.error('[ERROR] Error registering referrer:', error.message);
    sendResponse(res, 500, 'Error registering referrer', null, error.message);
  }
});

// Generate Referral Link for a specific agent
router.get('/:id/referral-link', async (req, res) => {
  const { id } = req.params;
  try {
    const agent = await Agent.findByPk(id);
    if (!agent) return sendResponse(res, 404, 'Agent not found');
    const referralLink = `${process.env.BASE_URL || 'http://localhost:4000'}/api/leads?referral_code=${agent.referral_code}`;
    sendResponse(res, 200, 'Referral link generated successfully', { referralLink });
  } catch (error) {
    sendResponse(res, 500, 'Error generating referral link', null, error.message);
  }
});

// ------------------------------------------------------
// 4) FETCHING & UPDATING AGENTS
// ------------------------------------------------------

// Fetch all agents
router.get('/', async (req, res) => {
  try {
    const agents = await Agent.findAll();
    sendResponse(res, 200, 'Agents retrieved successfully', agents);
  } catch (error) {
    sendResponse(res, 500, 'Error fetching agents', null, error.message);
  }
});

// Get pending agents
router.get('/pending', async (req, res) => {
  try {
    const pendingAgents = await Agent.findAll({ where: { status: 'Pending' } });
    sendResponse(res, 200, 'Pending agents retrieved successfully', pendingAgents);
  } catch (error) {
    sendResponse(res, 500, 'Error fetching pending agents', null, error.message);
  }
});

// Approve/Reject Agent (only for pending agents)
router.patch('/:id/approval', authMiddleware, checkRole(['Admin']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  // Only allow changing from "Pending" to "Active" or "Rejected"
  if (!['Active', 'Rejected'].includes(status)) {
    return sendResponse(res, 400, 'Invalid status. Allowed values are "Active" or "Rejected".');
  }
  try {
    const agent = await Agent.findByPk(id);
    if (!agent) return sendResponse(res, 404, 'Agent not found');
    if (agent.status.toLowerCase() !== 'pending') {
      return sendResponse(res, 400, 'Only "Pending" agents can be approved or rejected.');
    }
    agent.status = status;
    await agent.save();
    sendResponse(res, 200, `Agent status updated to: ${status}`, agent);
  } catch (error) {
    sendResponse(res, 500, 'Error updating agent approval status', null, error.message);
  }
});

// Combined Update Agent Status (Active <-> Inactive) for both agents and referrers
router.patch('/:id/status', authMiddleware, checkRole(['Admin']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Active', 'Inactive'].includes(status)) {
    return sendResponse(res, 400, 'Invalid status. Allowed values are "Active" or "Inactive".');
  }
  try {
    const agent = await Agent.findByPk(id);
    if (!agent) return sendResponse(res, 404, 'Agent not found');
    if (agent.status === status) {
      return sendResponse(res, 400, `Agent is already ${status}.`);
    }
    agent.status = status;
    await agent.save();
    sendResponse(res, 200, `Agent status updated to: ${status}`, agent);
  } catch (error) {
    sendResponse(res, 500, 'Error updating agent status', null, error.message);
  }
});

// Update Agent Details (accessible to Admin and Agent)
router.patch('/:id', authMiddleware, checkRole(['Admin', 'Agent']), async (req, res) => {
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
router.delete('/:id', authMiddleware, checkRole(['Admin']), async (req, res) => {
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
