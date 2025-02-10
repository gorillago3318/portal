// routes/leads.js

const express = require('express');
const { Op } = require('sequelize');
const { validate: isUuid } = require('uuid'); // UUID validation
const router = express.Router();

const { Lead, Agent, Commission } = require('../models'); // Import from index.js
const { calculateCommission } = require('../utils/commissionUtils'); // Adjust path if needed

// Constants
const MAX_LIMIT = 100;

/**
 * Agent transitions up to "Submitted":
 *  - New -> Assigned/Contacted/Preparing Documents/Submitted
 *  - Assigned -> Contacted/Preparing Documents/Submitted
 *  - Contacted -> Preparing Documents/Submitted
 *  - Preparing Documents -> Submitted
 *
 * If Approved, agent can do -> Accepted/Rejected
 * If KIV, agent can do -> Preparing Documents/Submitted
 * If Declined/Accepted/Rejected, agent can't do anything more.
 */
const agentAllowedTransitions = {
  New: ['Assigned', 'Contacted', 'Preparing Documents', 'Submitted'],
  Assigned: ['Contacted', 'Preparing Documents', 'Submitted'],
  Contacted: ['Preparing Documents', 'Submitted'],
  'Preparing Documents': ['Submitted'],
  Submitted: [],
  Approved: ['Accepted', 'Rejected'],
  Declined: [],
  KIV: ['Preparing Documents', 'Submitted'],
  Accepted: [],
  Rejected: [],
};

/**
 * Helper Function: Validate Status Transition
 * (Used only when updating a lead via PATCH)
 */
const isValidTransition = (currentStatus, newStatus, role, assignedAgentId, userId) => {
  if (role === 'Admin') return true;
  if (assignedAgentId !== userId) return false;
  const allowedNextStates = agentAllowedTransitions[currentStatus] || [];
  return allowedNextStates.includes(newStatus);
};

// Helper Function: Send Error Response
const sendError = (res, status, message, details = null) => {
  const errorResponse = { error: message };
  if (details) errorResponse.details = details;
  res.status(status).json(errorResponse);
};

/**
 * Route: Create a New Lead
 * POST /api/leads
 *
 * This endpoint no longer checks if the phone belongs to a registered agent.
 * Instead, it is secured by an API key, and the payload's phone field represents the user's phone number.
 */
router.post('/', async (req, res) => {
  console.log('[DEBUG] /api/leads POST route hit');

  // Validate the API key
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.LEADS_API_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid API key.' });
  }

  // Destructure all fields from the request body
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

  try {
    // (Optional) Add any referral logic here if needed.
    // We now assume the phone provided is the user's phone number.

    // Create the new Lead
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
      assigned_agent_id: null, // No agent check, so leave as null (or assign default)
      referrer_id: null,
      source: 'whatsapp',
      status: 'New'
    });

    console.log('[DEBUG] New lead created:', newLead.toJSON());
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
 * Route: Get Leads with Pagination and Filters
 * GET /api/leads
 */
router.get('/', async (req, res) => {
  const { status, agent_id, start_date, end_date, page = 1, limit = 10 } = req.query;
  const filter = {};
  const pageNumber = parseInt(page, 10);
  const pageSize = Math.min(parseInt(limit, 10), MAX_LIMIT);

  try {
    if (isNaN(pageNumber) || pageNumber < 1 || isNaN(pageSize) || pageSize < 1) {
      return sendError(res, 400, 'Invalid pagination parameters');
    }

    // (Optional) If authentication middleware sets req.user, you can check if the requesting agent
    // is accessing only their leads. Otherwise, this can be adjusted or removed.
    const { id } = req.user || {};
    if (agent_id && id && agent_id !== id) {
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
    sendError(res, 500, 'Error fetching leads', error.message);
  }
});

/**
 * Route: Update Lead Status or Assign Agent
 * PATCH /api/leads/:id
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role, assigned_agent_id, loan_amount } = req.body;

    const lead = await Lead.findByPk(id);
    if (!lead) {
      return sendError(res, 404, 'Lead not found');
    }

    const { id: loggedInAgentId } = req.user || {};

    if (assigned_agent_id && role === 'Admin') {
      const agent = await Agent.findByPk(assigned_agent_id);
      if (!agent) {
        return sendError(res, 400, 'Invalid agent ID');
      }
      lead.assigned_agent_id = assigned_agent_id;
    }

    if (status) {
      const canTransition = isValidTransition(
        lead.status,
        status,
        role,
        lead.assigned_agent_id,
        loggedInAgentId
      );
      if (!canTransition) {
        return sendError(
          res,
          400,
          `Invalid status transition from '${lead.status}' to '${status}'`
        );
      }
      lead.status = status;

      if (status === 'Accepted') {
        if (!loan_amount) {
          return sendError(res, 400, 'Loan amount is required for commissions.');
        }
        const { maxCommission, referrerCommission, agentCommission } =
          calculateCommission(loan_amount, lead.referrer_id);
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

    await lead.save();

    const updatedLead = await Lead.findByPk(id, {
      include: [
        {
          model: Agent,
          as: 'agent',
          attributes: ['id', 'name', 'phone', 'email'],
        },
      ],
    });

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error('[ERROR] Error updating lead:', error.message);
    sendError(res, 500, 'Error updating lead', error.message);
  }
});

module.exports = router;
