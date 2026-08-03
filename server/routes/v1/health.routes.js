'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Detailed health check with DB connectivity ping (used by orchestrators/uptime monitors)
 *     security: []
 *     responses:
 *       200: { description: Service healthy }
 *       503: { description: Service degraded (e.g. database unreachable) }
 */
router.get('/', (req, res) => {
  const start = Date.now();

  // Lightweight DB ping
  let dbStatus = 'ok';
  let dbLatencyMs = null;
  try {
    db.prepare('SELECT 1').get();
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'healthy' : 'degraded';
  const httpCode = status === 'healthy' ? 200 : 503;

  res.status(httpCode).json({
    status,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    },
  });
});

module.exports = router;
