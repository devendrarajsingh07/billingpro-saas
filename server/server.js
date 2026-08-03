'use strict';

// Load environment variables first
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');

const config = require('./config/env');
const db = require('./config/database');
const { logger, httpLogger } = require('./utils/logger');
const runMigrations   = require('./migrations/001_initial_schema');
const runMigration003 = require('./migrations/003_totp_2fa');
const runMigration004 = require('./migrations/004_sales_orders');
const runMigration005 = require('./migrations/005_invoice_reminders_product_barcode');
const runMigration006 = require('./migrations/006_supplier_payments');
const runMigration007 = require('./migrations/007_company_upi');
const registerAuthEvents = require('./events/handlers/auth.events');
const registerNotificationEvents = require('./events/handlers/notification.events');
const { registerCronJobs } = require('./cron');
const v1Routes = require('./routes/v1');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();

// Initialize audit and auth events
registerAuthEvents();
registerNotificationEvents();

// Run migrations on startup (in order)
try {
  runMigrations();    // 001 — initial schema
  runMigration003();  // 003 — TOTP 2FA columns
  runMigration004();  // 004 — Sales Orders tables
  runMigration005();  // 005 — invoice last_reminder_sent, product barcode/image
  runMigration006();  // 006 — supplier payments
  runMigration007();  // 007 — company upi_id
} catch (err) {
  logger.error(`[Migration Error] Failed to run database migrations: ${err.message}`);
  process.exit(1);
}

// Scheduled background jobs (recurring invoices, etc.) — skip during tests
if (config.env !== 'test') {
  registerCronJobs();
}

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS setup
app.use(cors({
  origin: config.app.frontendUrl || 'http://localhost:5174',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request logger
app.use(morgan(config.env === 'production' ? 'combined' : 'dev', { stream: httpLogger.stream }));

// Body parser with raw body retention for webhook verification
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for file uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// General API rate limiting
app.use('/api/', generalLimiter);

// Mount version 1 API routes
app.use('/api/v1', v1Routes);

// ── Swagger API Documentation ─────────────────────────────────
// Interactive UI: GET /api/docs
// Raw OpenAPI JSON spec: GET /api/docs.json
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'SaaS Billing API Docs',
  customCss: `
    .swagger-ui .topbar { background: linear-gradient(135deg, #4f46e5, #7c3aed); }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info .title { color: #4f46e5; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
}));
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date(),
    environment: config.env
  });
});

// Catch-all for unknown routes (404)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start listening (skip in tests — supertest binds `app` to an ephemeral
// port itself; a real listener here would collide across parallel workers)
let server;
if (config.env !== 'test') {
  server = app.listen(config.port, () => {
    logger.info(`🚀 SaaS Billing Platform Server running on port ${config.port}`);
    logger.info(`Environment : ${config.env}`);
  });
}

// ── Process-level safety net ──────────────────────────────────
// Log and exit cleanly on uncaught errors so the process manager
// (PM2, Docker, etc.) can restart the service rather than leaving
// it in an unknown/broken state.
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Process] Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.stack : String(reason),
    promise,
  });
  // Give the logger time to flush, then exit so process manager restarts
  setTimeout(() => process.exit(1), 1000);
});

process.on('uncaughtException', (err) => {
  logger.error('[Process] Uncaught Exception — shutting down', {
    message: err.message,
    stack:   err.stack,
  });
  // Attempt a graceful shutdown
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
  // Force exit if server.close takes too long
  setTimeout(() => process.exit(1), 5000);
});

module.exports = { app, server };
