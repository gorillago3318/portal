const express = require('express');
const router = express.Router();
const { getQRCode } = require('../services/whatsappService');

// Serve the QR code as HTML
router.get('/qr', (req, res) => {
    const qr = getQRCode();
    if (!qr) {
        return res.status(404).send(`
            <html>
                <body>
                    <h1>QR code not available yet</h1>
                    <p>Please ensure the WhatsApp bot is running and refresh this page.</p>
                </body>
            </html>
        `);
    }

    const html = `
        <html>
            <head>
                <title>WhatsApp QR Code</title>
            </head>
            <body>
                <h1>Scan this QR Code with WhatsApp</h1>
                <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300" />
                <p>Refresh this page if the QR code has expired.</p>
            </body>
        </html>
    `;
    res.send(html);
});

module.exports = router;
