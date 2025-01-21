const express = require('express');
const router = express.Router();
const { getQRCode } = require('../services/whatsappService'); // Import the function to retrieve the QR code

// QR Code display route (replaces the existing test route)
app.get('/', (req, res) => {
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
