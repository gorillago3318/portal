const express = require('express');
const bodyParser = require('body-parser');
const { initializeWhatsApp } = require('./services/whatsappService');
const morgan = require('morgan');
require('dotenv').config({ path: __dirname + '/.env' }); // Use the relative path for the .env file in the same folder

// Import Models
const Lead = require('./models/lead');
const Agent = require('./models/agent');

// Import Routes
const leadsRouter = require('./routes/leads');
const agentsRouter = require('./routes/agents');
const qrRoute = require('./routes/qrRoute');

// Import Middleware
const { authMiddleware } = require('./middleware/authMiddleware');

// Debug: Check if .env is loaded
console.log('[DEBUG] DATABASE_URL:', process.env.DATABASE_URL); // Log the DATABASE_URL
console.log('[DEBUG] PORT:', process.env.PORT); // Log the PORT

// Validate environment variables
if (!process.env.DATABASE_URL || !process.env.PORT) {
    console.error('[ERROR] Missing required environment variables: DATABASE_URL and/or PORT');
    process.exit(1);
}

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Register the authRouter first
const authRouter = require('./routes/auth'); // Adjust path if needed
app.use('/api/auth', authRouter); // Register the authRouter before applying authMiddleware

// Mount QR Code Route
app.use('/', qrRoute); // Root path for QR code handling

// Initialize WhatsApp
initializeWhatsApp().catch((err) => {
    console.error('[ERROR] Failed to initialize WhatsApp:', err.message);
    process.exit(1);
});

// Apply Global Middleware
app.use('/api/protected-route', authMiddleware); // Example protected route

// Set logging format
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat)); // Logging

// Debugging: Log incoming requests
app.use((req, res, next) => {
    console.log(`[DEBUG] Incoming Request: ${req.method} ${req.originalUrl}`);
    next(); // Pass control to the next middleware/route
});

// Health-check route
app.get('/health', async (req, res) => {
    console.log('[INFO] GET /health - Health check route hit');
    const healthCheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
    };

    try {
        const dbLatencyStart = Date.now();
        console.log('[DEBUG] Authenticating database connection...');
        await Lead.sequelize.authenticate();
        console.log('[DEBUG] Database authenticated successfully.');

        console.log('[DEBUG] Checking Lead and Agent tables...');
        await Promise.all([Lead.findOne(), Agent.findOne()]);

        const dbLatencyEnd = Date.now();
        healthCheck.dbLatency = `${dbLatencyEnd - dbLatencyStart}ms`;

        console.log('[INFO] Health check passed:', healthCheck);
        res.status(200).json(healthCheck);
    } catch (error) {
        console.error('[ERROR] Health check failed:', {
            message: error.message,
            stack: error.stack,
        });
        healthCheck.message = 'Unhealthy';
        healthCheck.details = error.message;
        res.status(500).json(healthCheck);
    }
});

app.get('/referral', async (req, res) => {
    console.log(`[DEBUG] Incoming request to /referral with query: ${JSON.stringify(req.query)}`); // Log request query

    const referralCode = req.query.referral_code; // Get referral_code from query string

    if (!referralCode) {
        console.error('[ERROR] Referral code is missing.');
        return res.status(400).json({ error: 'Referral code is missing.' });
    }

    console.log(`[DEBUG] Referral code received: ${referralCode}`); // Log the received referral code

    try {
        // Log database update attempt
        console.log(`[DEBUG] Attempting to update referral_code in the database for referral_code: ${referralCode}`);

        // Update referral_code in the Agents table
        const result = await Agent.update(
            { referral_code: referralCode },
            { where: { phone: 'tempPhone' } } // Replace 'tempPhone' with actual logic if needed
        );

        // Check if the update was successful
        console.log(`[DEBUG] Database update result: ${JSON.stringify(result)}`);
        if (result[0] === 0) {
            console.warn(`[WARN] No user found to update with referral code: ${referralCode}`);
        } else {
            console.log(`[INFO] Referral code ${referralCode} logged successfully.`);
        }

        // Redirect to WhatsApp bot
        const whatsappBotUrl = 'https://wa.me/60167177813';
        console.log(`[DEBUG] Redirecting to WhatsApp bot: ${whatsappBotUrl}`);
        res.redirect(whatsappBotUrl);
    } catch (error) {
        console.error('[ERROR] Failed to log referral code:', error.message);
        res.status(500).json({ error: 'Failed to log referral code.', details: error.message });
    }
});

// Register API Routes
console.log('[DEBUG] Registering API routes...');
app.use('/api/leads', leadsRouter);
app.use('/api/agents', agentsRouter);

// Debugging: List registered routes
console.log('[DEBUG] Listing all registered routes...');
app._router.stack.forEach((middleware) => {
    if (middleware.route) {
        console.log(`[DEBUG] Registered route: ${middleware.route.path}`);
    }
});

// Default 404 handler
app.use((req, res) => {
    console.error(`[ERROR] Invalid route accessed: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: 'Route not found',
        message: `The route '${req.originalUrl}' does not exist. Please check the documentation.`,
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[ERROR] Unhandled error:', {
        stack: err.stack,
        route: req.originalUrl,
        method: req.method,
    });
    res.status(500).json({
        error: 'Something went wrong!',
        details: process.env.NODE_ENV === 'production' ? undefined : err.message,
        route: req.originalUrl,
        method: req.method,
    });
});

// Start the server
const PORT = process.env.PORT || 4000; // Use port 4000 by default
app.listen(PORT, '0.0.0.0', async () => { // Bind to 0.0.0.0 for external access
    console.log(`[INFO] Server is running on http://0.0.0.0:${PORT}`);

    // Sync Database in development mode
    if (process.env.NODE_ENV !== 'production') {
        try {
            console.log('[DEBUG] Syncing database...');
            await Promise.all([
                Lead.sync({ alter: true }),
                Agent.sync({ alter: true }),
            ]);
            console.log('[INFO] Database synced successfully.');
        } catch (error) {
            console.error('[ERROR] Error syncing database:', error.message);
        }
    }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`[INFO] ${signal} signal received: closing database connection...`);
    try {
        await Lead.sequelize.close();
        console.log('[INFO] Database connection closed. Exiting gracefully.');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Error during shutdown:', error.message);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
