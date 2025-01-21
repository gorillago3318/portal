const express = require('express');
const router = express.Router();
const { client } = require('../services/whatsappService'); // Import the initialized WhatsApp client

// State variables (should be updated by your WhatsApp service)
let qrCodeUrl = ''; // Store the latest QR code URL
let isAuthenticated = false; // Track authentication status

// Listen to WhatsApp client events to update the state
client.on('qr', (qr) => {
    console.log('[DEBUG] New QR code generated');
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
    qrCodeUrl = qrImageUrl; // Update the QR code URL
    isAuthenticated = false; // Reset authentication status
});

client.on('ready', () => {
    console.log('[INFO] WhatsApp client is ready');
    qrCodeUrl = ''; // Clear the QR code URL
    isAuthenticated = true; // Mark as authenticated
});

// Define the QR Code display route
router.get('/', (req, res) => {
    console.log('[DEBUG] Serving QR code page...');

    if (isAuthenticated) {
        // Show success message if authenticated
        res.send(`
            <div style="text-align: center;">
                <h1>WhatsApp Web Status</h1>
                <p style="color: green;">Successfully authenticated! You can now send messages.</p>
            </div>
        `);
    } else if (qrCodeUrl) {
        // Show QR Code for authentication
        res.send(`
            <div style="text-align: center;">
                <h1>Scan WhatsApp QR Code</h1>
                <p>Scan this QR code using your WhatsApp mobile app:</p>
                <img src="${qrCodeUrl}" alt="WhatsApp QR Code" />
                <p>The page will automatically refresh every 30 seconds...</p>
                <script>
                    setTimeout(() => {
                        window.location.reload();
                    }, 30000); // Refresh to get new QR code if needed
                </script>
            </div>
        `);
    } else {
        // Display loading message if QR code is not ready yet
        res.send(`
            <div style="text-align: center;">
                <h1>Initializing...</h1>
                <p>Please wait while the QR code is generated...</p>
                <script>
                    setTimeout(() => {
                        window.location.reload();
                    }, 5000); // Shorter refresh for initialization
                </script>
            </div>
        `);
    }
});

module.exports = router;
