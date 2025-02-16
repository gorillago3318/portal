const express = require('express');
const bodyParser = require('body-parser');
// Removed WhatsApp-related code: const { initializeWhatsApp } = require('./services/whatsappService');
const morgan = require('morgan');
const crypto = require('crypto');
require('dotenv').config({ path: __dirname + '/.env' }); // Use the relative path for the .env file in the same folder

// Import Models
const Lead = require('./models/lead');
const Agent = require('./models/agent');
// Removed TempReferral model as it's no longer needed
// const TempReferral = require('./models/tempReferral');

// Import Routes
const leadsRouter = require('./routes/leads');
const agentsRouter = require('./routes/agents');
// QR Route is disabled; do not import or mount it
// const qrRoute = require('./routes/qrRoute');

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
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Handles URL-encoded data

// Register the authRouter first
const authRouter = require('./routes/auth'); // Adjust path if needed
app.use('/api/auth', authRouter); // Register the authRouter before applying authMiddleware

// Disable QR Code Route by not mounting it
// app.use('/', qrRoute);

// Removed WhatsApp initialization
// initializeWhatsApp().catch((err) => {
//     console.error('[ERROR] Failed to initialize WhatsApp:', err.message);
//     process.exit(1);
// });

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

// Health-check route (removed TempReferral check)
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

// Removed /referral route because TempReferral/bridge is no longer used

// Register API Routes
console.log('[DEBUG] Registering API routes...');
app.use('/api/leads', leadsRouter);
app.use('/api/agents', agentsRouter);

// Removed TempReferral route registration
// const tempReferralRouter = require('./routes/tempReferral');
// app.use('/api/temp-referral', tempReferralRouter);

// Debugging: List registered routes
console.log('[DEBUG] Listing all registered routes...');
app._router.stack.forEach((middleware) => {
    if (middleware.route) {
        console.log(`[DEBUG] Registered route: ${middleware.route.path}`);
    }
});

// Default 404 handler with exception for /metrics
app.use((req, res) => {
    if (req.originalUrl === '/metrics') {
        // Silently handle /metrics requests without logging an error
        return res.status(200).send('');
    }
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
                Agent.sync({ alter: true })
                // Removed TempReferral sync
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
