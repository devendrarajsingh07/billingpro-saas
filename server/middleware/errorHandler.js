'use strict';

const { validationResult } = require('express-validator');
const { ApiError, ValidationError } = require('../utils/ApiError');
const { logger } = require('../utils/logger');

/**
 * Global Express error handler middleware.
 * Must be registered as the LAST middleware in server.js.
 *
 * Handles:
 *  - Custom ApiError subclasses (operational errors)
 *  - express-validator validation result errors
 *  - SQLite constraint errors
 *  - JWT errors
 *  - Generic unhandled errors
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isDev = process.env.NODE_ENV === 'development';

  // ── 1. express-validator errors (passed via validationResult check middleware) ──
  if (err.type === 'express-validator') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code:    'VALIDATION_ERROR',
      errors:  err.errors,
    });
  }

  // ── 2. Operational ApiError instances ──
  if (err.isOperational) {
    // Log at warn level for 4xx, error for 5xx
    if (err.statusCode >= 500) {
      logger.error('[ErrorHandler] Operational 5xx error', {
        message:    err.message,
        code:       err.code,
        statusCode: err.statusCode,
        stack:      err.stack,
        url:        req.originalUrl,
        method:     req.method,
        ip:         req.ip,
      });
    } else {
      logger.warn('[ErrorHandler] Client error', {
        message:    err.message,
        code:       err.code,
        statusCode: err.statusCode,
        url:        req.originalUrl,
        method:     req.method,
        ip:         req.ip,
      });
    }

    const body = {
      success:    false,
      message:    err.message,
      code:       err.code,
    };

    if (err.errors) body.errors = err.errors;
    if (isDev)     body.stack  = err.stack;

    return res.status(err.statusCode).json(body);
  }

  // ── 3. SQLite unique constraint violation ──
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
    logger.warn('[ErrorHandler] SQLite constraint error', { message: err.message });
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
      code:    'CONFLICT',
      ...(isDev && { detail: err.message }),
    });
  }

  // ── 4. JWT errors ──
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
      code:    'INVALID_TOKEN',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token has expired.',
      code:    'TOKEN_EXPIRED',
    });
  }

  // ── 5. Body parser / payload size errors ──
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request payload is too large.',
      code:    'PAYLOAD_TOO_LARGE',
    });
  }

  // ── 6. Multer errors ──
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds the 5MB limit.',
      code:    'FILE_TOO_LARGE',
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field.',
      code:    'UNEXPECTED_FILE',
    });
  }

  // ── 7. SyntaxError from JSON body parse ──
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
      code:    'INVALID_JSON',
    });
  }

  // ── 8. Unknown / programmer errors ──
  logger.error('[ErrorHandler] Unhandled error', {
    message: err.message,
    name:    err.name,
    stack:   err.stack,
    url:     req.originalUrl,
    method:  req.method,
    ip:      req.ip,
    body:    req.body,
  });

  return res.status(500).json({
    success: false,
    message: isDev ? err.message : 'An unexpected error occurred. Please try again later.',
    code:    'INTERNAL_ERROR',
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * Middleware to check express-validator results and pass errors to global handler.
 * Place this AFTER your validation chains in any route.
 */
function handleValidationErrors(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map((e) => ({
      field:   e.path || e.param,
      message: e.msg,
      value:   e.value,
    }));
    const err = new ValidationError('Validation failed', errors);
    return next(err);
  }
  next();
}

module.exports = { errorHandler, handleValidationErrors };
