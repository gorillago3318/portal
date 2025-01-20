const express = require('express');
const router = express.Router();
const { getQRCode } = require('../services/whatsappService'); // Import the QR code service

// Route to display the QR code in an HTML page
router.get('/qr', (req, res) => {
    const qr = getQRCode(); // Retrieve the latest QR code data
    if (!qr) {
        return res.status(404).send('QR code not available yet. Try again later.');
    }

    // Generate an HTML page with the QR code
    const html = `
        <html>
            <head>
                <title>WhatsApp QR Code</title>
            </head>
            <body>
                <h1>Scan this QR Code with WhatsApp</h1>
                <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300" />
                <p>If the QR code is not working, ensure your bot is running and try refreshing this page.</p>
            </body>
        </html>
    `;
    res.send(html);
});

module.exports = router;
