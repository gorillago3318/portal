const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal'); // Add QR code generator
const logger = require('../config/logger');

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        handleSIGINT: false, // Prevent Puppeteer from registering its own SIGINT handler
    },
});

// QR Code Event
client.on('qr', (qr) => {
    logger.info('[INFO] QR Code received. Scan it with your WhatsApp app.');
    qrcode.generate(qr, { small: true }); // Display QR code in the terminal
});

// Ready Event
client.on('ready', () => {
    logger.info('✅ [INFO] WhatsApp client is ready!');
});

// Authentication Failed Event
client.on('auth_failure', (msg) => {
    logger.error('[ERROR] WhatsApp authentication failed:', msg);
});

// Disconnected Event
client.on('disconnected', (reason) => {
    logger.warn(`[WARN] WhatsApp client disconnected. Reason: ${reason}`);
    // Attempt to reconnect
    logger.info('[INFO] Reinitializing WhatsApp client after disconnect...');
    client.initialize().catch((err) => {
        logger.error('[ERROR] Failed to reinitialize after disconnect:', err.message);
    });
});

// Function to send WhatsApp messages
async function sendWhatsAppMessage(phone, message) {
    try {
        const recipientId = `${phone}@c.us`; // Ensure correct format for WhatsApp numbers
        await client.sendMessage(recipientId, message);
        logger.info(`[INFO] Message sent to ${phone}: ${message}`);
    } catch (error) {
        logger.error(`[ERROR] Failed to send message to ${phone}:`, error.message);
        throw error;
    }
}

// Initialize WhatsApp Client with error handling
const initializeWhatsApp = async () => {
    try {
        logger.info('[INFO] Initializing WhatsApp client...');
        await client.initialize();
        logger.info('[INFO] WhatsApp client initialized successfully.');
    } catch (err) {
        logger.error('[ERROR] Failed to initialize WhatsApp client:', err.message);
        throw err; // Re-throw to be handled by the calling code
    }
};

// Graceful shutdown handler
const handleShutdown = async () => {
    logger.info('[INFO] Shutting down WhatsApp client...');
    try {
        await client.destroy();
        logger.info('[INFO] WhatsApp client shut down successfully.');
        process.exit(0);
    } catch (err) {
        logger.error('[ERROR] Error during shutdown:', err.message);
        process.exit(1);
    }
};

// Register shutdown handlers
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

module.exports = {
    client, // Export client for event subscriptions elsewhere
    initializeWhatsApp,
    sendWhatsAppMessage,
    handleShutdown, // Export for testing or custom use
};
