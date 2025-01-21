const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
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


// Event: QR Code generation
client.on('qr', (qr) => {
    console.log('[INFO] QR Code received. Displaying in terminal...');
    qrcode.generate(qr, { small: true }); // Display QR code in terminal
});

// Event: Ready
client.on('ready', () => {
    console.log('[INFO] WhatsApp client is ready!');
});

// Event: Authenticated
client.on('authenticated', () => {
    console.log('[INFO] WhatsApp client authenticated!');
});

// Event: Disconnected
client.on('disconnected', (reason) => {
    console.log(`[INFO] WhatsApp client disconnected: ${reason}`);
    client.initialize(); // Reinitialize on disconnect
});

// Initialize Client
console.log('[INFO] Initializing WhatsApp client...');
client.initialize();

module.exports = client;
