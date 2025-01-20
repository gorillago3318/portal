// waClient.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Create .wwebjs_auth directory if it doesn't exist (or specify a custom path).
const AUTH_DIR = path.join(__dirname, '.wwebjs_auth');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Instantiate the WhatsApp client with LocalAuth
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'my-wa-client',    // Pick a unique name
    dataPath: AUTH_DIR,          // Ensure it points to your persistent folder
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
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ],
    defaultViewport: null,
    timeout: 0,
  },
  restartOnAuthFail: true,
  takeoverOnConflict: true,
  takeoverTimeoutMs: 0,
});

// Simple init function with a retry mechanism
const initializeClient = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[INFO] Initializing WA client (attempt ${i+1}/${retries})...`);
      await client.initialize();
      return true;
    } catch (err) {
      console.error(`[ERROR] init attempt ${i+1} failed:`, err);
      if (i < retries - 1) {
        console.log('[INFO] Waiting 5s before next attempt...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  return false;
};

// QR event handler
client.on('qr', qr => {
  console.log('[INFO] QR generated. Please scan:');
  qrcode.generate(qr, { small: true });
  
  // Optionally write it to file if you want to check logs later
  fs.writeFileSync(path.join(__dirname, 'last-qr.txt'), qr);
  console.log('[INFO] QR code also saved to last-qr.txt');
});

// Client is authenticated
client.on('authenticated', () => {
  console.log('[INFO] Client authenticated!');
  const qrFile = path.join(__dirname, 'last-qr.txt');
  if (fs.existsSync(qrFile)) {
    fs.unlinkSync(qrFile);
    console.log('[INFO] Removed last-qr.txt since we are authenticated now');
  }
});

// Auth failure
client.on('auth_failure', async msg => {
  console.error('[ERROR] auth_failure event:', msg);
  console.log('[INFO] Attempting re-initialize...');
  await initializeClient();
});

// Ready event
client.on('ready', () => {
  console.log('[INFO] WhatsApp client is ready!');
});

// Disconnected
client.on('disconnected', async reason => {
  console.warn('[WARN] Client disconnected:', reason);
  // Try reconnecting
  await new Promise(res => setTimeout(res, 5000)); // Wait 5s
  console.log('[INFO] Re-initializing client after disconnect...');
  await initializeClient();
});

// Other error
client.on('error', async error => {
  console.error('[ERROR] Client error event:', error);
  // Sometimes “Execution context was destroyed” errors can happen on Render
  // Attempt re-initialize if that happens
  if (error.message.includes('Execution context was destroyed')) {
    await new Promise(res => setTimeout(res, 5000));
    await initializeClient();
  }
});

// Start it up
(async () => {
  console.log('[INFO] Starting WhatsApp client...');
  const success = await initializeClient();
  if (!success) {
    console.error('[ERROR] Could not initialize after multiple attempts');
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[INFO] Caught SIGINT, shutting down...');
  try {
    await client.destroy();
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Failed client.destroy() on SIGINT:', err);
    process.exit(1);
  }
});

module.exports = { client };
