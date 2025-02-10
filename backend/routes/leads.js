const express = require('express');
const { Op } = require('sequelize');
const { validate: isUuid } = require('uuid'); // UUID validation
const router = express.Router();

const { Lead, Agent, Commission } = require('../models');
const { calculateCommission } = require('../utils/commissionUtils');

const MAX_LIMIT = 100;

// POST /api/leads - Create a New Lead
router.post('/', async (req, res) => {
  console.log('[DEBUG] /api/leads POST route hit');

  // Validate the API key
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.LEADS_API_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid API key.' });
  }

  // Destructure fields from request body
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

  // Referral logic: If a referral code is provided, try to trace the referrer/agent.
  if (referrer_code) {
    try {
      const refAgent = await Agent.findOne({ where: { referral_code: referrer_code } });
      if (refAgent) {
        console.log('[DEBUG] Found agent for referral code:', refAgent.toJSON());

        // If the referral code is the default one (set in DEFAULT_REFERRAL_CODE), assign to superadmin.
        if (refAgent.referral_code === process.env.DEFAULT_REFERRAL_CODE) {
          const superAdmin = await Agent.findOne({ where: { referral_code: process.env.DEFAULT_REFERRAL_CODE } });
          if (superAdmin) {
            assigned_agent_id = superAdmin.id;
            referrer_id = superAdmin.id;
            console.log('[DEBUG] Referral code is default. Using superadmin as assigned agent:', superAdmin.id);
          }
        }
        // If the agent's role is "referrer", assign to the parent's ID if available.
        else if (refAgent.role && refAgent.role.toLowerCase() === 'referrer') {
          assigned_agent_id = refAgent.parent_referrer_id || refAgent.id;
          referrer_id = refAgent.id;
          console.log('[DEBUG] Agent is a referrer. Assigned agent ID set to:', assigned_agent_id);
        }
        // Otherwise, assume the referral code belongs to an agent.
        else {
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
    // No referral code provided: default to superadmin
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
    // Create the new lead with traced IDs
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
      assigned_agent_id, // Traced from the referral logic
      referrer_id,       // Traced from the referral logic
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

    // If using authentication, ensure that the logged-in agent accesses only their own leads.
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
        return sendError(res, 400, `Invalid status transition from '${lead.status}' to '${status}'`);
      }
      lead.status = status;

      if (status === 'Accepted') {
        if (!loan_amount) {
          return sendError(res, 400, 'Loan amount is required for commissions.');
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
      ]
    });

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error('[ERROR] Error updating lead:', error.message);
    sendError(res, 500, 'Error updating lead', error.message);
  }
});

module.exports = router;
