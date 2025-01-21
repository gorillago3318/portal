const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const SESSION_FILE_PATH = path.join(__dirname, '../sessions');
const EMAIL = 'makwaikit@gmail.com'; // Replace with your email
const EMAIL_PASSWORD = 'Makjoeseng1!'; // Use an app password if required

// Ensure session directory exists
if (!fs.existsSync(SESSION_FILE_PATH)) {
    fs.mkdirSync(SESSION_FILE_PATH, { recursive: true });
}

// Email transporter setup
const transporter = nodemailer.createTransport({
    service: 'Gmail', // Or another email provider
    auth: {
        user: EMAIL,
        pass: EMAIL_PASSWORD,
    },
});

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

client.on('qr', async (qr) => {
    console.log('[INFO] Generating QR code for WhatsApp...');

    try {
        const qrCodeImage = await qrcode.toDataURL(qr);

        // Email the QR code
        const mailOptions = {
            from: EMAIL,
            to: EMAIL, // Email yourself
            subject: 'Your WhatsApp QR Code',
            html: `<p>Scan this QR code with your WhatsApp app:</p><img src="${qrCodeImage}" alt="QR Code" />`,
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('[ERROR] Failed to send QR code via email:', err);
            } else {
                console.log('[INFO] QR code emailed successfully:', info.response);
            }
        });
    } catch (error) {
        console.error('[ERROR] Failed to generate QR code image:', error);
    }
});

client.on('ready', () => {
    console.log('[INFO] WhatsApp client is ready!');
});

client.on('authenticated', () => {
    console.log('[INFO] WhatsApp client authenticated!');
});

client.on('auth_failure', () => {
    console.error('[ERROR] Authentication failed!');
});

client.on('disconnected', (reason) => {
    console.log(`[INFO] WhatsApp client disconnected: ${reason}`);
});

client.initialize();

module.exports = {
    client,
};
