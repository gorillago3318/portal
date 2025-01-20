const { Client } = require('whatsapp-web.js');

let qrCodeData = ''; // Variable to store the QR code data

// Initialize the WhatsApp client
const client = new Client();

client.on('qr', (qr) => {
    qrCodeData = qr; // Store the QR code when it's generated
    console.log('[INFO] QR code updated.');
});

client.on('ready', () => {
    console.log('[INFO] WhatsApp client is ready!');
});

client.on('authenticated', () => {
    console.log('[INFO] WhatsApp client authenticated successfully!');
    qrCodeData = ''; // Clear QR code data after successful authentication
});

client.on('auth_failure', (msg) => {
    console.error('[ERROR] Authentication failed:', msg);
    qrCodeData = ''; // Clear QR code data on authentication failure
});

client.on('disconnected', (reason) => {
    console.log('[INFO] WhatsApp client disconnected:', reason);
    qrCodeData = ''; // Clear QR code data on disconnect
});

// Start the WhatsApp client
client.initialize();

// Function to retrieve the latest QR code
const getQRCode = () => qrCodeData;

// Function to send WhatsApp messages
const sendWhatsAppMessage = async (phone, message) => {
    try {
        const formattedPhone = `${phone}@c.us`; // Format phone number for WhatsApp
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
