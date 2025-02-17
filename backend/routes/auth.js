// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Agent } = require('../models');

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    console.log(`[DEBUG] Login attempt for phone: ${phone}`);

    // Find the agent by phone number
    const agent = await Agent.findOne({ where: { phone } });
    if (!agent) {
      console.log(`[DEBUG] No agent found for phone: ${phone}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log(`[DEBUG] Found agent with ID: ${agent.id} and status: ${agent.status}`);

    // Check if the agent's status allows login (only Active users may login)
    if (agent.status !== 'Active') {
      console.log(`[DEBUG] Agent status not active: ${agent.status}`);
      return res.status(403).json({ error: 'User is not active. Please contact an administrator.' });
    }

    // Compare the provided password with the hashed password
    const passwordMatch = await bcrypt.compare(password, agent.password);
    console.log(`[DEBUG] Password match result: ${passwordMatch}`);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Build the JWT payload
    const tokenPayload = {
      id: agent.id,
      role: agent.role,
      phone: agent.phone,
    };

    // Sign the JWT token
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'default_secret', { expiresIn: '1h' });
    console.log(`[DEBUG] Generated JWT token: ${token}`);

    res.json({ token, role: agent.role, agentId: agent.id });
  } catch (error) {
    console.error('[DEBUG] Error during login:', error.message, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
