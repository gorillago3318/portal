const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const SESSION_FILE_PATH = path.join(__dirname, '../session.json'); // Path to save the session file

let sessionData = null;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH); // Load session data if it exists
}

// Initialize WhatsApp client
const client = new Client({
    session: sessionData, // Load saved session data
});

let qrCodeData = ''; // Store the latest QR code

// Event: QR Code generation
client.on('qr', (qr) => {
    qrCodeData = qr; // Save the QR code for the route
    console.log('[INFO] QR code generated. Scan it to authenticate.');
});

// Event: Client is authenticated
client.on('authenticated', (session) => {
    console.log('[INFO] WhatsApp client authenticated successfully!');
    qrCodeData = ''; // Clear the QR code after authentication

    // Save the session data to a file
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session));
});

// Event: Client is ready to send/receive messages
client.on('ready', () => {
    console.log('[INFO] WhatsApp client is ready!');
});

// Event: Authentication failure
client.on('auth_failure', (msg) => {
    console.error('[ERROR] Authentication failed:', msg);
    qrCodeData = ''; // Clear QR code data on failure

    // Remove session file to force re-login
    if (fs.existsSync(SESSION_FILE_PATH)) {
        fs.unlinkSync(SESSION_FILE_PATH);
    }
});

// Event: Client disconnected
client.on('disconnected', (reason) => {
    console.log('[INFO] WhatsApp client disconnected:', reason);
    qrCodeData = ''; // Clear the QR code

    // Attempt to reconnect automatically
    if (fs.existsSync(SESSION_FILE_PATH)) {
        sessionData = require(SESSION_FILE_PATH);
        client.initialize(); // Reinitialize client with the existing session
    } else {
        console.log('[INFO] Session data not found. Re-login required.');
    }
});

// Start the WhatsApp client
client.initialize();

// Function to retrieve the latest QR code
const getQRCode = () => qrCodeData;

// Function to send WhatsApp messages
const sendWhatsAppMessage = async (phone, message) => {
    try {
        const formattedPhone = `${phone}@c.us`; // WhatsApp format for phone numbers
        await client.sendMessage(formattedPhone, message);
        console.log(`[INFO] Message sent successfully to: ${phone}`);
    } catch (error) {
        console.error('[ERROR] Failed to send WhatsApp message:', error.message);
        throw new Error('Failed to send WhatsApp message');
    }
};

module.exports = {
    client,
    getQRCode,
    sendWhatsAppMessage,
};
