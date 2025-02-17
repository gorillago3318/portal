// routes/commissions.js
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();

const { Commission } = require('../models');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

/**
 * GET /api/commissions
 * This endpoint returns commission records.
 * - For Admin: returns all commissions (or can filter by agent_id).
 * - For Agent: returns only commissions for the logged-in agent.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { id: loggedInAgentId, role: loggedInRole } = req.user || {};

    // Build filter object
    const filter = {};

    // If agent, restrict to their commissions
    if (loggedInRole.toLowerCase() === 'agent') {
      filter.agent_id = loggedInAgentId;
    } else {
      // Optionally, admin can filter by agent_id via a query param
      if (req.query.agent_id) {
        filter.agent_id = req.query.agent_id;
      }
    }

    const commissions = await Commission.findAll({
      where: filter,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({ message: 'Commissions retrieved successfully', data: commissions });
  } catch (error) {
    console.error('[ERROR] Error fetching commissions:', error.message);
    res.status(500).json({ error: 'Error fetching commissions', details: error.message });
  }
});

module.exports = router;
