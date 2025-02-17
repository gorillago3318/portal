const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Commission } = require('../models');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { id: loggedInAgentId, role: loggedInRole } = req.user || {};
    const filter = {};

    // If agent, restrict to their commissions.
    if (loggedInRole.toLowerCase() === 'agent') {
      filter.agent_id = loggedInAgentId;
    } else if (req.query.agent_id) {
      filter.agent_id = req.query.agent_id;
    }

    const commissions = await Commission.findAll({
      where: filter,
      include: [
        { model: require('../models').Agent, as: 'agent', attributes: ['id', 'name'] },
        { model: require('../models').Agent, as: 'referrer', attributes: ['id', 'name'] },
        { model: require('../models').Lead, as: 'lead', attributes: ['id', 'name'] }
      ],
      order: [['updatedAt', 'DESC']]
    });

    res.status(200).json({ message: 'Commissions retrieved successfully', data: commissions });
  } catch (error) {
    console.error('[ERROR] Error fetching commissions:', error.message);
    res.status(500).json({ error: 'Error fetching commissions', details: error.message });
  }
});

/**
 * PATCH /api/commissions/:id - Update commission status.
 * Only Admins can update commission status.
 */
router.patch('/:id', authMiddleware, checkRole(['Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['Pending', 'Paid'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid commission status. Allowed: ${allowedStatuses.join(', ')}` });
    }

    const commission = await Commission.findByPk(id);
    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    commission.status = status;
    await commission.save();

    res.status(200).json({ message: 'Commission updated successfully', data: commission });
  } catch (error) {
    console.error('[ERROR] Error updating commission:', error.message);
    res.status(500).json({ error: 'Error updating commission', details: error.message });
  }
});

module.exports = router;
