const express = require('express');
const router = express.Router();
const { client } = require('../services/whatsappService'); // Import the initialized WhatsApp client

// State variables to track QR code URL and authentication status
let qrCodeUrl = '';
let isAuthenticated = false;

// Listen to WhatsApp client events and update the state
client.on('qr', (qr) => {
    console.log('[DEBUG] New QR code generated');
    qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
    isAuthenticated = false; // Reset authentication status when QR code is generated
});

client.on('ready', () => {
    console.log('[INFO] WhatsApp client is authenticated and ready');
    qrCodeUrl = ''; // Clear the QR code once authenticated
    isAuthenticated = true; // Mark as authenticated
});

client.on('auth_failure', (msg) => {
    console.error('[ERROR] Authentication failed:', msg);
    isAuthenticated = false; // Mark as not authenticated on failure
    qrCodeUrl = ''; // Reset QR code
});

client.on('disconnected', (reason) => {
    console.warn('[WARN] WhatsApp client disconnected:', reason);
    isAuthenticated = false; // Mark as not authenticated
});

// Define the QR Code display route
router.get('/', (req, res) => {
    console.log('[DEBUG] Serving QR code page...');

    if (isAuthenticated) {
        // Show success message if authenticated
        res.send(`
            <div style="text-align: center;">
                <h1>WhatsApp Client Status</h1>
                <p style="color: green;">Successfully authenticated! You can now send messages.</p>
            </div>
        `);
    } else if (qrCodeUrl) {
        // Show QR code for authentication
        res.send(`
            <div style="text-align: center;">
                <h1>Scan WhatsApp QR Code</h1>
                <p>Scan this QR code using your WhatsApp mobile app:</p>
                <img src="${qrCodeUrl}" alt="WhatsApp QR Code" />
                <p>This page will refresh every 30 seconds...</p>
                <script>
                    setTimeout(() => {
                        window.location.reload();
                    }, 30000); // Refresh the page every 30 seconds
                </script>
            </div>
        `);
    } else {
        // Show loading message while QR code is not yet available
        res.send(`
            <div style="text-align: center;">
                <h1>Initializing WhatsApp Client...</h1>
                <p>Please wait while the QR code is being generated...</p>
                <script>
                    setTimeout(() => {
                        window.location.reload();
                    }, 5000); // Refresh the page every 5 seconds
                </script>
            </div>
        `);
    }
});

module.exports = router;
