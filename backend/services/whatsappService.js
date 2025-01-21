const { Client, LocalAuth } = require('whatsapp-web.js');
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
    logger.info('QR Code received. Scan it with your WhatsApp app.');
});

// Ready Event
client.on('ready', () => {
    logger.info('✅ WhatsApp client is ready!');
});

// Authentication Failed Event
client.on('auth_failure', (msg) => {
    logger.error('WhatsApp authentication failed:', msg);
});

// Disconnected Event
client.on('disconnected', (reason) => {
    logger.warn('WhatsApp client disconnected:', reason);
    // Attempt to reconnect
    logger.info('Reinitializing WhatsApp client after disconnect...');
    client.initialize().catch((err) => {
        logger.error('Failed to reinitialize after disconnect:', err);
    });
});

// Function to send WhatsApp messages
async function sendWhatsAppMessage(phone, message) {
    try {
        const recipientId = `${phone}@c.us`; // Ensure correct format for WhatsApp numbers
        await client.sendMessage(recipientId, message);
        logger.info(`Message sent to ${phone}: ${message}`);
    } catch (error) {
        logger.error(`Failed to send message to ${phone}:`, error);
        throw error;
    }
}

// Initialize WhatsApp Client with error handling
const initializeWhatsApp = async () => {
    try {
        logger.info('Initializing WhatsApp client...');
        await client.initialize();
    } catch (err) {
        logger.error('Failed to initialize WhatsApp client:', err);
        throw err; // Re-throw to be handled by the calling code
    }
};

// Graceful shutdown handler
const handleShutdown = async () => {
    logger.info('Shutting down WhatsApp client...');
    try {
        await client.destroy();
        logger.info('WhatsApp client shut down successfully');
        process.exit(0);
    } catch (err) {
        logger.error('Error during shutdown:', err);
        process.exit(1);
    }
};

// Register shutdown handlers
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

module.exports = {
    initializeWhatsApp,
    sendWhatsAppMessage,
    handleShutdown, // Export for testing purposes
};
