const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;


// Express app setup
const app = express();
const port = process.env.PORT || 3000; // Use Render's assigned port or fallback to 3000 for local testing

console.log('[DEBUG] Starting WhatsApp automation service...');

// Enhanced client configuration
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './sessions',
        clientId: 'whatsapp-client', // Consistent client ID for session management
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ],
    },
    qrMaxRetries: 3, // Maximum number of QR code generation attempts
    restartOnAuthFail: true, // Automatically restart on authentication failure
});

// State management
let qrCodeUrl = '';
let isAuthenticated = false;
let connectionRetries = 0;
const MAX_RETRIES = 3;

// Session management functions
const ensureSessionDirectory = () => {
    const sessionPath = path.join(__dirname, 'sessions');
    if (!fs.existsSync(sessionPath)) {
        console.log('[DEBUG] Creating sessions directory...');
        fs.mkdirSync(sessionPath, { recursive: true });
    }
};

const clearSessionDirectory = () => {
    const sessionPath = path.join(__dirname, 'sessions');
    if (fs.existsSync(sessionPath)) {
        console.log('[DEBUG] Clearing existing session data...');
        fs.rmSync(sessionPath, { recursive: true, force: true });
        fs.mkdirSync(sessionPath, { recursive: true });
    }
};

// WhatsApp client event handlers
client.on('qr', (qr) => {
    console.log('[DEBUG] New QR code received.');
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('[ERROR] QR code generation failed:', err);
            qrCodeUrl = '';
            return;
        }
        qrCodeUrl = url;
        console.log('[INFO] QR code generated successfully. Please scan using WhatsApp mobile app.');
    });
});

client.on('loading_screen', (percent, message) => {
    console.log(`[DEBUG] Loading WhatsApp: ${percent}% - ${message}`);
});

client.on('ready', () => {
    isAuthenticated = true;
    connectionRetries = 0;
    qrCodeUrl = ''; // Clear the QR code once authenticated
    console.log('[INFO] WhatsApp client is ready and fully authenticated!');
});

client.on('authenticated', () => {
    isAuthenticated = true;
    qrCodeUrl = ''; // Clear QR code once authenticated
    console.log('[INFO] WhatsApp authentication successful!');
});

client.on('auth_failure', async (msg) => {
    console.error('[ERROR] Authentication failed:', msg);
    isAuthenticated = false;

    if (connectionRetries < MAX_RETRIES) {
        connectionRetries++;
        console.log(`[INFO] Retrying authentication (Attempt ${connectionRetries}/${MAX_RETRIES})...`);
        clearSessionDirectory();
        client.initialize().catch((err) => console.error('[ERROR] Failed to reinitialize client:', err));
    } else {
        console.error('[ERROR] Maximum authentication retries reached. Please restart the application.');
    }
});

client.on('disconnected', (reason) => {
    console.log(`[INFO] WhatsApp client disconnected. Reason: ${reason}`);
    isAuthenticated = false;

    if (connectionRetries < MAX_RETRIES) {
        connectionRetries++;
        console.log(`[INFO] Attempting to reconnect (Attempt ${connectionRetries}/${MAX_RETRIES})...`);
        client.initialize().catch((err) => console.error('[ERROR] Failed to reconnect client:', err));
    } else {
        console.error('[ERROR] Maximum reconnection attempts reached. Please restart the application.');
    }
});

// Express routes
app.get('/', (req, res) => {
    console.log('[DEBUG] Serving QR code page...');

    if (isAuthenticated) {
        res.send(`
            <div style="text-align: center;">
                <h1>WhatsApp Web Status</h1>
                <p style="color: green;">Successfully authenticated! You can now send messages.</p>
            </div>
        `);
    } else if (qrCodeUrl) {
        res.send(`
            <div style="text-align: center;">
                <h1>Scan WhatsApp QR Code</h1>
                <p>Scan this QR code using your WhatsApp mobile app:</p>
                <img src="${qrCodeUrl}" alt="WhatsApp QR Code" />
                <p>The page will automatically refresh every 30 seconds...</p>
                <script>
                    setTimeout(() => {
                        window.location.reload();
                    }, 30000);
                </script>
            </div>
        `);
    } else {
        res.send(`
            <div style="text-align: center;">
                <h1>Initializing...</h1>
                <p>Please wait while the QR code is generated...</p>
                <script>
                    setTimeout(() => {
                        window.location.reload();
                    }, 5000);
                </script>
            </div>
        `);
    }
});

// Message sending function
const sendWhatsAppMessage = async (phone, message) => {
    if (!isAuthenticated) {
        throw new Error('WhatsApp client is not authenticated');
    }

    console.log(`[DEBUG] Attempting to send message to ${phone}...`);
    try {
        const formattedPhone = phone.includes('@c.us') ? phone : `${phone}@c.us`;
        await client.sendMessage(formattedPhone, message);
        console.log(`[INFO] Message sent successfully to ${phone}`);
        return true;
    } catch (error) {
        console.error('[ERROR] Failed to send message:', error);
        throw new Error(`Failed to send WhatsApp message: ${error.message}`);
    }
};

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('[DEBUG] Shutting down WhatsApp client...');
    try {
        await client.destroy();
        console.log('[INFO] WhatsApp client destroyed successfully');
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error);
    }
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled Promise Rejection:', reason);
});

// Initialize the service
ensureSessionDirectory();
console.log('[DEBUG] Initializing WhatsApp client...');
client.initialize().catch((err) => {
    console.error('[ERROR] Failed to initialize WhatsApp client:', err);
});

// Start Express server
app.listen(port, () => {
    console.log(`[INFO] Server running at ${BASE_URL}`);
});

module.exports = {
    sendWhatsAppMessage,
    client,
};
