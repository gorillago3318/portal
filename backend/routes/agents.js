const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Agent } = require('../models'); // Adjusted import for models
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware'); // Adjust the path as needed

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
    text: {
      body: message
    }
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

// Helper function to send a response
const sendResponse = (res, status, message, data = null, error = null) => {
  const response = { message, data };
  if (error) response.error = error;
  res.status(status).json(response);
};

// ------------------------------------------------------
// 1) PUBLIC ROUTES (No authMiddleware) for password reset
// ------------------------------------------------------

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { phone } = req.body; // Get the phone number from the request
    if (!phone) {
      return sendResponse(res, 400, 'Phone number is required');
    }

    // Find the agent using the phone number
    const agent = await Agent.findOne({ where: { phone }, paranoid: false });
    if (!agent) {
      // Do not reveal if the phone number doesn't exist
      return sendResponse(res, 200, 'If this account exists, a reset link has been sent to your phone.');
    }

    // Generate a reset token and expiration time
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000; // Token expires in 1 hour

    // Save the token and expiration in the agent's record
    agent.reset_password_token = resetToken;
    agent.reset_password_expires = new Date(expires);
    await agent.save();

    // Send the reset token via WhatsApp Cloud API
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
    const { phone, token, new_password } = req.body; // Include phone in the request
    if (!phone || !token || !new_password) {
      return sendResponse(res, 400, 'Phone number, token, and new_password are required');
    }

    // Find the agent using the phone number and token
    const agent = await Agent.findOne({
      where: { phone, reset_password_token: token },
      paranoid: false,
    });

    if (!agent) {
      return sendResponse(res, 400, 'Invalid or expired token');
    }

    // Check if the token is expired
    if (Date.now() > agent.reset_password_expires.getTime()) {
      return sendResponse(res, 400, 'Reset token has expired. Please request a new one.');
    }

    // Validate password length
    if (new_password.length < 8) {
      return sendResponse(res, 400, 'Password must be at least 8 characters long');
    }

    // Hash the new password and update the record
    const hashedPassword = await bcrypt.hash(new_password, 10);
    agent.password = hashedPassword;
    agent.reset_password_token = null; // Clear the token
    agent.reset_password_expires = null; // Clear the expiration time
    await agent.save();

    // Send confirmation message via WhatsApp Cloud API
    const message = `Hi ${agent.name}, your password has been successfully reset. You can now log in with your new password.`;
    await sendWhatsAppMessage(phone, message);

    return sendResponse(res, 200, 'Password reset successful. You can now log in with your new password.');
  } catch (error) {
    console.error('[ERROR][reset-password]:', error.message);
    return sendResponse(res, 500, 'Error resetting password', null, error.message);
  }
});

// Admin creation route (restricted to existing Admins)
router.post('/create-admin', authMiddleware, checkRole(['Admin']), async (req, res) => {
  const { name, phone, email, location, status } = req.body;

  try {
    // Check if the email or phone number already exists
    const existingAdmin = await Agent.findOne({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with this email already exists.' });
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create the new admin
    const newAdmin = await Agent.create({
      name,
      phone,
      email,
      location,
      role: 'Admin', // Set the role explicitly
      status: status || 'Active', // Default status is Active
      password: hashedPassword, // Save the hashed password in the password column
    });

    res.status(201).json({
      message: 'Admin created successfully',
      temp_password: tempPassword, // Provide the plain temp password for the admin
    });
  } catch (error) {
    console.error('[ERROR] Error creating admin:', error.message);
    res.status(500).json({ error: 'Error creating admin', details: error.message });
  }
});

// ------------------- 1) ADMIN CREATES A NEW AGENT -------------------
router.post('/create-agent', authMiddleware, checkRole(['Admin']), async (req, res) => {
  const { name, phone, email, location, bank_name, account_number, status } = req.body;

  try {
    // Check if phone number or email already exists
    const existingAgent = await Agent.findOne({ where: { phone } });
    if (existingAgent) {
      return res.status(400).json({ error: 'An agent with this phone number already exists.' });
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create the agent (store hashedPassword in 'password')
    const newAgent = await Agent.create({
      name,
      phone,
      email,
      location,
      bank_name,
      account_number,
      role: 'Agent', // Default role is Agent
      status: status || 'Pending', // Default status is Pending
      password: hashedPassword, // Save hashed password in the 'password' field
    });

    // Return same style response
    res.status(201).json({
      message: 'Agent created successfully',
      agent: {
        id: newAgent.id,
        name: newAgent.name,
        phone: newAgent.phone,
        email: newAgent.email,
        status: newAgent.status,
        referral_code: newAgent.referral_code, // Include the referral code
      },
      temp_password: tempPassword,
    });
  } catch (error) {
    console.error('[ERROR] Error creating agent:', error.message);
    res.status(500).json({ error: 'Error creating agent', details: error.message });
  }
});

// ------------------- 2) SELF-REGISTRATION (Pending Status) -------------------
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

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create the new Agent (store hashedPassword in 'password')
    const newAgent = await Agent.create({
      name,
      phone,
      email,
      location,
      bank_name,
      account_number,
      status: 'Pending', // Default to Pending
      parent_referrer_id,
      password: hashedPassword, // <-- store in password, not temp_password
    });

    // Return similar style response
    sendResponse(res, 201, 'Registration successful. Awaiting approval.', {
      id: newAgent.id,
      name: newAgent.name,
      phone: newAgent.phone,
      email: newAgent.email,
      status: newAgent.status,
      referral_code: newAgent.referral_code,
      temp_password: tempPassword, // Provide plain temp password in response
    });
  } catch (error) {
    console.error('[ERROR] Error registering agent:', error.message);
    sendResponse(res, 500, 'Error registering agent', null, error.message);
  }
});

// ------------------- 3) REGISTER A REFERRER (Same style) -------------------
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

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create the Referrer (store hashedPassword in 'password')
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
      password: hashedPassword, // <-- store in password
    });

    // Return same style response as create-agent
    sendResponse(res, 201, 'Referrer registered successfully', {
      id: newReferrer.id,
      name: newReferrer.name,
      phone: newReferrer.phone,
      email: newReferrer.email,
      status: newReferrer.status,
      referral_code: newReferrer.referral_code,
      temp_password: tempPassword, // Provide plain temp password
    });
  } catch (error) {
    console.error('[ERROR] Error registering referrer:', error.message);
    sendResponse(res, 500, 'Error registering referrer', null, error.message);
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
