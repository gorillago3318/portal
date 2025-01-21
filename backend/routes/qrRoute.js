const express = require('express');
const router = express.Router();
const { getQRCode } = require('../services/whatsappService'); // Import the function to retrieve the QR code

// Serve the QR code as HTML
router.get('/qr', (req, res) => {
    const qrCodeData = getQRCode(); // Get the latest QR code data
    if (!qrCodeData) {
        return res.status(404).send(`
            <html>
                <body>
                    <h1>QR Code Not Available</h1>
                    <p>The WhatsApp client might already be authenticated, or the QR code has expired.</p>
                </body>
            </html>
        `);
    }

    // Render the QR code as an image using a public QR code generator
    const qrCodeImageURL = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCodeData)}&size=300x300`;

    res.send(`
        <html>
            <body>
                <h1>Scan this QR Code with WhatsApp</h1>
                <img src="${qrCodeImageURL}" alt="QR Code" />
                <p>If the QR code expires, please refresh this page.</p>
            </body>
        </html>
    `);
});

module.exports = router;
