const express = require('express');
const { v4: uuidv4 } = require('uuid');
const TempReferral = require('../models/tempReferral'); // Adjust the path
const router = express.Router();

// Generate Temporary Referral
router.post('/generate', async (req, res) => {
  const { referral_code } = req.body;

  if (!referral_code) {
    return res.status(400).json({ error: 'Referral code is required.' });
  }

  try {
    const token = uuidv4(); // Generate a unique token
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute expiration

    await TempReferral.create({ token, referral_code, expiresAt });
    res.status(201).json({ message: 'Temporary referral created.', token });
  } catch (error) {
    console.error('[ERROR] Failed to create temporary referral:', error.message);
    res.status(500).json({ error: 'Failed to create temporary referral.' });
  }
});

// Validate Temporary Referral
router.get('/validate/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const tempReferral = await TempReferral.findOne({ where: { token } });

    if (!tempReferral) {
      return res.status(404).json({ error: 'Invalid or expired token.' });
    }

    if (new Date() > tempReferral.expiresAt) {
      return res.status(400).json({ error: 'Token has expired.' });
    }

    res.status(200).json({ message: 'Token is valid.', referral_code: tempReferral.referral_code });
  } catch (error) {
    console.error('[ERROR] Failed to validate token:', error.message);
    res.status(500).json({ error: 'Failed to validate token.' });
  }
});

module.exports = router;
