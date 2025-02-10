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
 * 
 * Requirements:
 * 1) Admin can do ANY transition from any status to any status, no restrictions.
 * 2) Agent can only:
 *    - Move up to 'Submitted' from the initial statuses.
 *    - If 'Approved', agent can do -> 'Accepted' or 'Rejected'.
 *    - If 'KIV', agent can do -> 'Preparing Documents' or 'Submitted'.
 *    - 'Declined', 'Accepted', 'Rejected' -> agent can do nothing.
 *    - Also, agent can only update leads assigned to them.
 */
const isValidTransition = (currentStatus, newStatus, role, assignedAgentId, userId) => {
  // 1) Admin can do absolutely anything
  if (role === 'Admin') {
    return true;
  }

  // 2) If not Admin, must be the assigned agent to do anything
  if (assignedAgentId !== userId) {
    return false;
  }

  // 3) Must be a valid transition according to 'agentAllowedTransitions'
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
 */
router.post('/', async (req, res) => {
  console.log('[DEBUG] /api/leads POST route hit');
  const { name, phone, referrer_code, loan_amount, estimated_savings, monthly_savings, yearly_savings, new_monthly_repayment, bankname } = req.body;

  try {
      let parentAgentId = null;
      let referrerId = null;

      // Check if the phone number belongs to an agent
      const agent = await Agent.findOne({ where: { phone } });
      if (!agent) {
          return res.status(403).json({ error: 'Forbidden: Only registered agents can submit leads.' });
      }

      // Handle referral logic
      if (referrer_code) {
          const referrer = await Agent.findOne({ where: { referral_code: referrer_code } });
          if (!referrer) {
              return res.status(404).json({ error: 'Referrer not found' });
          }
          parentAgentId = referrer.parent_referrer_id || referrer.id;
          referrerId = referrer.id;
      } else {
          parentAgentId = agent.id; // Assign the lead to the agent
      }

      // Create the new Lead with extra fields
      const newLead = await Lead.create({
          name,
          phone,
          referrer_code,
          loan_amount,
          estimated_savings,
          monthly_savings,        // new field (if your model has been updated)
          yearly_savings,         // new field
          new_monthly_repayment,  // new field
          bankname,               // new field
          assigned_agent_id: parentAgentId,
          referrer_id: referrerId,
          source: 'whatsapp',
          status: 'New'
      });

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
    // Validate pagination
    if (isNaN(pageNumber) || pageNumber < 1 || isNaN(pageSize) || pageSize < 1) {
      return sendError(res, 400, 'Invalid pagination parameters');
    }

    // Check if the logged-in agent is requesting only their own leads
    // (Assuming req.user is set by authentication middleware)
    const { id } = req.user;
    if (agent_id && agent_id !== id) {
      return res.status(403).json({ error: 'Forbidden: You can only access your own leads.' });
    }

    // Apply filters
    if (status) filter.status = status;
    if (agent_id) filter.assigned_agent_id = agent_id;
    if (start_date && end_date) {
      filter.createdAt = {
        [Op.between]: [new Date(start_date), new Date(end_date)],
      };
    }

    const offset = (pageNumber - 1) * pageSize;

    // Fetch leads with pagination + include associated Agent
    const leads = await Lead.findAndCountAll({
      where: filter,
      limit: pageSize,
      offset,
      include: [
        {
          model: Agent,
          as: 'agent', // Must match the 'as' in Lead model
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

    // Fetch the lead by ID
    const lead = await Lead.findByPk(id);
    if (!lead) {
      return sendError(res, 404, 'Lead not found');
    }

    // Get logged-in agent's ID from the token
    const { id: loggedInAgentId } = req.user;

    // If a new assigned_agent_id is provided, only Admin can do that
    if (assigned_agent_id && role === 'Admin') {
      const agent = await Agent.findByPk(assigned_agent_id);
      if (!agent) {
        return sendError(res, 400, 'Invalid agent ID');
      }
      lead.assigned_agent_id = assigned_agent_id;
    }

    // If we are updating the status
    if (status) {
      // Check if the transition is allowed
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

      // If status is 'Accepted', compute commission
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
          status: 'Pending', // Commission status can be 'Pending'
        });
      }
    }

    // Save the updated lead
    await lead.save();

    // Return the updated lead, including agent information
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
