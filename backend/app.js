const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
require('dotenv').config();

// Import Models
const Lead = require('./models/lead');
const Agent = require('./models/agent');

// Import Routes
const leadsRouter = require('./routes/leads');
const agentsRouter = require('./routes/agents');

// Validate environment variables
if (!process.env.DATABASE_URL) {
    console.error('[ERROR] Missing DATABASE_URL in environment variables');
    process.exit(1);
}

// Initialize Express app
const app = express();

// Middleware
app.use((req, res, next) => {
    if (req.method !== 'GET') {
        bodyParser.json()(req, res, next);
    } else {
        next();
    }
});

// Set logging format
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat)); // Logging

// Test route
app.get('/', (req, res) => {
    console.log('[INFO] GET / - Test route hit');
    res.send('Portal Backend is Running!');
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

// API Routes
console.log('[DEBUG] Registering API routes...');
app.use('/api/leads', leadsRouter);
app.use('/api/agents', agentsRouter);

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
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`[INFO] Server is running on port ${PORT}`);

    // Sync Database in development mode
    if (process.env.NODE_ENV !== 'production') {
        try {
            console.log('[DEBUG] Syncing database...');
            await Promise.all([Lead.sync({ alter: true }), Agent.sync({ alter: true })]);
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
