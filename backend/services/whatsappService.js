const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Initialize WhatsApp client
const client = new Client();

// Display QR code in console for authentication
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('[INFO] Scan the QR code above with your WhatsApp to log in.');
});

client.on('ready', () => {
    console.log('[INFO] WhatsApp client is ready!');
});

client.on('authenticated', () => {
    console.log('[INFO] WhatsApp client authenticated successfully!');
});

client.on('auth_failure', (msg) => {
    console.error('[ERROR] Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('[INFO] WhatsApp client disconnected:', reason);
});

// Start the client
client.initialize();

// Function to send WhatsApp messages
const sendWhatsAppMessage = async (phone, message) => {
    try {
        const formattedPhone = `${phone}@c.us`; // WhatsApp uses this format for numbers
        await client.sendMessage(formattedPhone, message);
        console.log(`[INFO] Message sent successfully to: ${phone}`);
    } catch (error) {
        console.error('[ERROR] Failed to send WhatsApp message:', error.message);
        throw new Error('Failed to send WhatsApp message');
    }
};

module.exports = {
    sendWhatsAppMessage,
};
