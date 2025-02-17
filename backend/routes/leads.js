const express = require('express');
const { Op } = require('sequelize');
const { validate: isUuid } = require('uuid'); // UUID validation
const axios = require('axios');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');


const { Lead, Agent, Commission } = require('../models');
const { calculateCommission } = require('../utils/commissionUtils');

const MAX_LIMIT = 100;

// Allowed lead statuses
const ALLOWED_LEAD_STATUSES = [
  "New",
  "Contacted",
  "Preparing Documents",
  "Submitted",
  "Approved",
  "KIV",
  "Rejected",
  "Accepted/Decline/Appeal",
  "Accepted" // Added "Accepted" if you want to allow that value
];

/**
 * Helper: Format a number as MYR currency.
 */
function formatCurrency(value) {
  const safeValue = isNaN(value) || value === null ? 0 : value;
  return safeValue.toLocaleString('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  });
}

/**
 * Helper: Send a WhatsApp message via the official WhatsApp Cloud API.
 * @param {string} recipientPhone - Recipient phone number in E.164 format (e.g. "60126181683")
 * @param {string} message - The message body to send.
 */
async function sendWhatsappMessageToAgent(recipientPhone, message) {
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
    console.error('Missing WhatsApp Cloud API configuration.');
    return;
  }
  const url = `https://graph.facebook.com/v15.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages?access_token=${process.env.WHATSAPP_ACCESS_TOKEN}`;
  const payload = {
    messaging_product: "whatsapp",
    to: recipientPhone,
    type: "text",
    text: { body: message }
  };
  console.log('[DEBUG] Sending WhatsApp message with payload:', JSON.stringify(payload, null, 2));
  try {
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" }
    });
    console.log('[DEBUG] WhatsApp message response:', response.data);
  } catch (error) {
    console.error('[ERROR] Failed to send WhatsApp message to agent:', error.response ? error.response.data : error.message);
  }
}

/**
 * Helper: Validate if a lead status transition is allowed.
 * For Admins, any allowed status is permitted.
 * For Agents, they can update only their assigned leads and cannot update if the lead is already accepted.
 *
 * @param {string} currentStatus - The current status of the lead.
 * @param {string} newStatus - The new status requested.
 * @param {string} loggedInRole - The role of the logged-in user (e.g., 'Admin' or 'Agent').
 * @param {number|string} assignedAgentId - The ID of the agent assigned to the lead.
 * @param {number|string} loggedInAgentId - The ID of the logged-in agent (from JWT).
 * @returns {boolean} True if the transition is allowed, false otherwise.
 */
function isValidTransition(currentStatus, newStatus, loggedInRole, assignedAgentId, loggedInAgentId) {
  // Check that the newStatus is allowed.
  if (!ALLOWED_LEAD_STATUSES.includes(newStatus)) {
    return false;
  }
  // Normalize role to lowercase.
  const role = loggedInRole ? loggedInRole.toLowerCase() : '';
  // Admins can change status arbitrarily.
  if (role === 'admin') {
    return true;
  }
  // For Agents, ensure the lead is assigned to them.
  if (role === 'agent' && String(assignedAgentId) === String(loggedInAgentId)) {
    // Agents should not update a lead that is already accepted.
    if (currentStatus === "Accepted" || currentStatus === "Accepted/Decline/Appeal") {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * POST /api/leads - Create a new lead and notify assigned agent via WhatsApp.
 */
router.post('/', async (req, res) => {
  console.log('[DEBUG] /api/leads POST route hit');

  // Validate the API key.
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.LEADS_API_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid API key.' });
  }

  // Destructure fields from request body.
  const {
    name,
    phone,
    referrer_code,
    loan_amount,
    estimated_savings,
    monthly_savings,
    yearly_savings,
    new_monthly_repayment,
    bankname
  } = req.body;

  let assigned_agent_id = null;
  let referrer_id = null;

  // Referral logic: if a referral code is provided, attempt to look up the corresponding agent.
  if (referrer_code) {
    try {
      const refAgent = await Agent.findOne({ where: { referral_code: referrer_code } });
      if (refAgent) {
        console.log('[DEBUG] Found agent for referral code:', refAgent.toJSON());
        if (refAgent.referral_code === process.env.DEFAULT_REFERRAL_CODE) {
          const superAdmin = await Agent.findOne({ where: { referral_code: process.env.DEFAULT_REFERRAL_CODE } });
          if (superAdmin) {
            assigned_agent_id = superAdmin.id;
            referrer_id = superAdmin.id;
            console.log('[DEBUG] Referral code is default. Using superadmin as assigned agent:', superAdmin.id);
          }
        } else if (refAgent.role && refAgent.role.toLowerCase() === 'referrer') {
          assigned_agent_id = refAgent.parent_referrer_id || refAgent.id;
          referrer_id = refAgent.id;
          console.log('[DEBUG] Agent is a referrer. Assigned agent ID set to:', assigned_agent_id);
        } else {
          assigned_agent_id = refAgent.id;
          referrer_id = refAgent.id;
          console.log('[DEBUG] Agent role is not referrer. Assigned agent ID set to:', assigned_agent_id);
        }
      } else {
        console.warn('[WARN] No agent found for referral code:', referrer_code);
      }
    } catch (error) {
      console.error('[ERROR] Error during referral lookup:', error.message);
    }
  } else {
    // No referral code provided: default to superadmin.
    try {
      const superAdmin = await Agent.findOne({ where: { referral_code: process.env.DEFAULT_REFERRAL_CODE } });
      if (superAdmin) {
        assigned_agent_id = superAdmin.id;
        referrer_id = superAdmin.id;
        console.log('[DEBUG] No referral code provided. Defaulting to superadmin:', superAdmin.id);
      }
    } catch (error) {
      console.error('[ERROR] Error looking up superadmin:', error.message);
    }
  }

  try {
    // Create the new lead with traced IDs.
    const newLead = await Lead.create({
      name,
      phone,
      referrer_code,
      loan_amount,
      estimated_savings,
      monthly_savings,
      yearly_savings,
      new_monthly_repayment,
      bankname,
      assigned_agent_id,
      referrer_id,
      source: 'whatsapp',
      status: 'New'
    });

    console.log('[DEBUG] New lead created:', newLead.toJSON());

    // Notify the assigned agent via WhatsApp, if available.
    if (assigned_agent_id) {
      try {
        const agent = await Agent.findByPk(assigned_agent_id);
        if (agent && agent.phone) {
          const agentPhone = agent.phone;
          let referrerName = referrer_code;
          if (referrer_id) {
            const refAgent = await Agent.findByPk(referrer_id);
            if (refAgent && refAgent.name) {
              referrerName = refAgent.name;
            }
          }
          const summaryMessage = `
🚨 New Lead Assigned 🚨

📋 Customer Details:
- Name: ${name}
- Contact: ${phone}

💰 Loan Information:
- Loan Amount: ${formatCurrency(loan_amount)}
- New Monthly Repayment: ${formatCurrency(new_monthly_repayment)}
- Bank: ${bankname}

📈 Savings Analysis:
- Estimated Savings: ${formatCurrency(estimated_savings)}
- Monthly Savings: ${formatCurrency(monthly_savings)}
- Yearly Savings: ${formatCurrency(yearly_savings)}

Referrer: ${referrer_code} (${referrerName})
          `.trim();
          await sendWhatsappMessageToAgent(agentPhone, summaryMessage);
        } else {
          console.warn('[WARN] Assigned agent not found or missing phone for agent id:', assigned_agent_id);
        }
      } catch (messagingError) {
        console.error('[ERROR] Error sending WhatsApp message to agent:', messagingError.message);
        // Do not block lead creation due to messaging error.
      }
    }

    res.status(201).json({
      message: 'Lead created successfully',
      lead: newLead,
    });
  } catch (error) {
    console.error('[ERROR] Error creating lead:', error.message);
    res.status(500).json({ error: 'Error creating lead', details: error.message });
  }
});

/**
 * GET /api/leads - Retrieve leads with pagination and filters.
 */
router.get('/', async (req, res) => {
  const { status, agent_id, start_date, end_date, page = 1, limit = 10 } = req.query;
  const filter = {};
  const pageNumber = parseInt(page, 10);
  const pageSize = Math.min(parseInt(limit, 10), MAX_LIMIT);

  try {
    if (isNaN(pageNumber) || pageNumber < 1 || isNaN(pageSize) || pageSize < 1) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }

    // For role-based filtering: if an agent is logged in, ensure they access only their own leads.
    const { id: loggedInAgentId } = req.user || {};
    if (agent_id && loggedInAgentId && agent_id !== loggedInAgentId) {
      return res.status(403).json({ error: 'Forbidden: You can only access your own leads.' });
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
    res.status(500).json({ error: 'Error fetching leads', details: error.message });
  }
});

/**
 * PATCH /api/leads/:id - Update lead status or assign agent.
 * This endpoint allows both Admins and Agents to update the status of a lead.
 * Admins can update any lead; Agents can update only leads assigned to them.
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_agent_id, loan_amount } = req.body;

    const lead = await Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Extract role and agent ID from JWT (req.user)
    const { id: loggedInAgentId, role: loggedInRole } = req.user || {};

    // If logged in as Agent, they can only update their own leads.
    if (loggedInRole === 'Agent' && String(lead.assigned_agent_id) !== String(loggedInAgentId)) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own leads.' });
    }

    // If assigned_agent_id is provided and the loggedInRole is Admin, update the assignment.
    if (assigned_agent_id && loggedInRole === 'Admin') {
      const agent = await Agent.findByPk(assigned_agent_id);
      if (!agent) {
        return res.status(400).json({ error: 'Invalid agent ID' });
      }
      lead.assigned_agent_id = assigned_agent_id;
    }

    if (status) {
      // Validate the status transition using our helper.
      const canTransition = isValidTransition(
        lead.status,
        status,
        loggedInRole,
        lead.assigned_agent_id,
        loggedInAgentId
      );
      if (!canTransition) {
        return res.status(400).json({ error: `Invalid status transition from '${lead.status}' to '${status}'` });
      }
      lead.status = status;

      // When a lead is accepted, calculate commissions.
      if (status === 'Accepted') {
        if (!loan_amount) {
          return res.status(400).json({ error: 'Loan amount is required for commissions.' });
        }
        const { maxCommission, referrerCommission, agentCommission } = calculateCommission(loan_amount, lead.referrer_id);
        await Commission.create({
          lead_id: lead.id,
          agent_id: lead.assigned_agent_id,
          referrer_id: lead.referrer_id,
          loan_amount,
          max_commission: maxCommission,
          referrer_commission: referrerCommission,
          agent_commission: agentCommission,
          status: 'Pending'
        });
      }
    }

    await lead.save();

    const updatedLead = await Lead.findByPk(id, {
      include: [
        {
          model: Agent,
          as: 'agent',
          attributes: ['id', 'name', 'phone', 'email']
        }
      ],
    });

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error('[ERROR] Error updating lead:', error.message);
    res.status(500).json({ error: 'Error updating lead', details: error.message });
  }
});

/**
 * Helper function: Validate allowed lead status transitions.
 * For Admins, any allowed status is fine.
 * For Agents, ensure the lead is assigned to them and disallow update if lead is already accepted.
 */
function isValidTransition(currentStatus, newStatus, loggedInRole, assignedAgentId, loggedInAgentId) {
  // Check that the newStatus is allowed.
  if (!ALLOWED_LEAD_STATUSES.includes(newStatus)) {
    return false;
  }
  // Normalize the role to lowercase.
  const role = loggedInRole ? loggedInRole.toLowerCase() : '';
  // Admins can update status arbitrarily.
  if (role === 'admin') {
    return true;
  }
  // For Agents, ensure the lead is assigned to them.
  if (role === 'agent' && String(assignedAgentId) === String(loggedInAgentId)) {
    // Agents cannot update a lead if it is already accepted.
    if (currentStatus === "Accepted" || currentStatus === "Accepted/Decline/Appeal") {
      return false;
    }
    return true;
  }
  return false;
}

module.exports = router;
