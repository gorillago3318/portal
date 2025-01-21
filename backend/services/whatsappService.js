const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal'); // Terminal QR code display
const fs = require('fs');
const path = require('path');

// Ensure session directory exists
const SESSION_FILE_PATH = path.join(__dirname, '../sessions');
if (!fs.existsSync(SESSION_FILE_PATH)) {
    fs.mkdirSync(SESSION_FILE_PATH, { recursive: true });
}

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: SESSION_FILE_PATH,
        clientId: 'whatsapp-client',
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
});

// Event: QR Code received
client.on('qr', (qr) => {
    console.log('[INFO] Scan the QR code below to authenticate WhatsApp:');
    qrcode.generate(qr, { small: true }); // Display QR code in terminal
});

// Event: Client is ready
client.on('ready', () => {
    console.log('[INFO] WhatsApp client is ready!');
});

// Event: Client authenticated
client.on('authenticated', () => {
    console.log('[INFO] WhatsApp client authenticated successfully!');
});

// Event: Authentication failure
client.on('auth_failure', () => {
    console.error('[ERROR] WhatsApp authentication failed. Please try again.');
});

// Event: Client disconnected
client.on('disconnected', (reason) => {
    console.log(`[INFO] WhatsApp client disconnected. Reason: ${reason}`);
});

// Initialize the client
client.initialize();

module.exports = { client };
