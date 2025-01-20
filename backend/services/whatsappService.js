const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Create .wwebjs_auth directory if it doesn't exist
const AUTH_DIR = path.join(__dirname, '.wwebjs_auth');
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Initialize the WhatsApp client with more robust puppeteer config
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-client",
        dataPath: AUTH_DIR,
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
            '--single-process', // Important for stability
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        defaultViewport: null,
        timeout: 0,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    },
    clientId: 'whatsapp-client',
    restartOnAuthFail: true,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});

// Add retry mechanism for initialization
const initializeClient = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[INFO] Attempting to initialize client (attempt ${i + 1}/${retries})`);
            await client.initialize();
            return true;
        } catch (error) {
            console.error(`[ERROR] Failed to initialize client (attempt ${i + 1}/${retries}):`, error);
            if (i < retries - 1) {
                console.log('[INFO] Waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
            }
        }
    }
    return false;
};

// Event: QR code generation
client.on('qr', (qr) => {
    console.log('[INFO] QR code generated. Scan it to authenticate:');
    qrcode.generate(qr, { small: true });
    
    // Save QR code to file
    try {
        fs.writeFileSync(path.join(__dirname, 'last-qr.txt'), qr);
        console.log('[INFO] QR code saved to last-qr.txt');
    } catch (err) {
        console.error('[ERROR] Failed to save QR code:', err);
    }
});

client.on('loading_screen', (percent, message) => {
    console.log('[INFO] Loading:', percent, '%', message);
});

client.on('authenticated', () => {
    console.log('[INFO] WhatsApp client authenticated successfully!');
    
    // Clear the QR code file after successful authentication
    const qrPath = path.join(__dirname, 'last-qr.txt');
    if (fs.existsSync(qrPath)) {
        try {
            fs.unlinkSync(qrPath);
            console.log('[INFO] QR code file removed after successful authentication');
        } catch (err) {
            console.error('[ERROR] Failed to remove QR code file:', err);
        }
    }
});

client.on('auth_failure', async (msg) => {
    console.error('[ERROR] Authentication failed:', msg);
    console.log('[INFO] Attempting to reinitialize client...');
    await initializeClient();
});

client.on('ready', () => {
    console.log('[INFO] WhatsApp client is ready!');
});

client.on('disconnected', async (reason) => {
    console.log('[INFO] Client disconnected:', reason);
    // Wait before attempting to reconnect
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('[INFO] Attempting to reconnect...');
    await initializeClient();
});

// Handle errors more gracefully
client.on('error', async (error) => {
    console.error('[ERROR] Client error:', error);
    if (error.message.includes('Execution context was destroyed')) {
        console.log('[INFO] Detected context destruction, attempting to reinitialize...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await initializeClient();
    }
});

// Start the client with retry mechanism
(async () => {
    console.log('[INFO] Starting WhatsApp client...');
    const success = await initializeClient();
    if (!success) {
        console.error('[ERROR] Failed to initialize client after multiple attempts');
        process.exit(1);
    }
})();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('[INFO] Shutting down...');
    try {
        await client.destroy();
        console.log('[INFO] Client destroyed successfully');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error while shutting down:', error);
        process.exit(1);
    }
});

// Export the client
module.exports = {
    client,
};