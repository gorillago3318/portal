const express = require('express');
const morgan = require('morgan');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: __dirname + '/.env' }); // Ensure your .env file is in your project root

// Import Models
const Lead = require('./models/lead');
const Agent = require('./models/agent');
// (TempReferral model removed)

// Import Routes
const authRouter = require('./routes/auth');    // Endpoints: POST /api/auth/login
const leadsRouter = require('./routes/leads');    // Endpoints for leads
const agentsRouter = require('./routes/agents');  // Endpoints for agents

// Validate environment variables
if (!process.env.DATABASE_URL || !process.env.PORT) {
  console.error('[ERROR] Missing required environment variables: DATABASE_URL and/or PORT');
  process.exit(1);
}

// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set Cache-Control header to prevent caching
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// Serve static files from the "public" folder (for CSS, JS, images, etc.)
app.use(express.static('public'));

// --- Custom Routes for HTML Pages ---
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.get('/agent-registration', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'agent_registration.html'));
});

app.get('/referrer-registration', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'referrer_registration.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin_dashboard.html'));
});

app.get('/agent-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'agent_dashboard.html'));
});
// --- End Custom HTML Routes ---

// Mount authentication routes first
app.use('/api/auth', authRouter);

// Example: Global middleware for protected routes (if needed)
const { authMiddleware } = require('./middleware/authMiddleware');
app.use('/api/protected-route', authMiddleware);

// Set up request logging via Morgan
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

// Debug: Log all incoming requests except for /metrics or when user-agent is vm_promscrape
app.use((req, res, next) => {
  if (req.originalUrl === '/metrics' || req.headers['user-agent'] === 'vm_promscrape') {
    return next();
  }
  console.log(`[DEBUG] Incoming Request: ${req.method} ${req.originalUrl}`);
  next();
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
    const start = Date.now();
    console.log('[DEBUG] Authenticating database connection...');
    await Lead.sequelize.authenticate();
    console.log('[DEBUG] Database authenticated successfully.');
    console.log('[DEBUG] Checking Lead and Agent tables...');
    await Promise.all([Lead.findOne(), Agent.findOne()]);
    const end = Date.now();
    healthCheck.dbLatency = `${end - start}ms`;
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

// Referral route – accepts a query parameter referral_code and redirects to a WhatsApp URL
app.get('/referral', async (req, res) => {
  const referralCode = req.query.referral_code;
  if (!referralCode) {
    return res.status(400).json({ error: 'Referral code is missing.' });
  }
  try {
    const token = crypto.createHash('sha256').update(referralCode + Date.now()).digest('hex');
    console.log(`[DEBUG] Generated referral token: ${token}`);
    // If session middleware is configured, store referral code in session.
    req.session = req.session || {};
    req.session.referral_code = referralCode;
    console.log(`[INFO] Referral code stored in session: ${referralCode}`);
    const whatsappBotUrl = `https://wa.me/60126181683?text=referral_start`;
    res.redirect(whatsappBotUrl);
  } catch (error) {
    console.error('[ERROR] Failed to process referral:', error.message);
    res.status(500).json({ error: 'Failed to process referral.' });
  }
});

// Mount the remaining API routes
console.log('[DEBUG] Registering API routes...');
app.use('/api/leads', leadsRouter);
app.use('/api/agents', agentsRouter);

// Debug: List registered routes for verification
console.log('[DEBUG] Listing all registered routes...');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`[DEBUG] Registered route: ${middleware.route.path}`);
  }
});

// Default 404 handler (with exception for /metrics)
app.use((req, res) => {
  if (req.originalUrl === '/metrics') {
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
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[INFO] Server is running on http://0.0.0.0:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log('[DEBUG] Syncing database...');
      await Promise.all([
        Lead.sync({ alter: true }),
        Agent.sync({ alter: true })
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
