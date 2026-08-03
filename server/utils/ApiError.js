'use strict';

/**
 * Base API Error — all custom errors extend this.
 */
class ApiError extends Error {
  /**
   * @param {string} message - Human-readable message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Machine-readable error code
   * @param {Array} [errors] - Optional field-level errors
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', errors = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true; // distinguishes known errors from programmer errors

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 404 Not Found
 */
class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 400 Bad Request / Validation Error
 */
class ValidationError extends ApiError {
  /**
   * @param {string} message
   * @param {Array} [errors] - Array of field validation errors
   */
  constructor(message = 'Validation failed', errors = null) {
    super(message, 400, 'VALIDATION_ERROR', errors);
  }
}

/**
 * 401 Unauthorized / Authentication Error
 */
class AuthError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR');
  }
}

/**
 * 403 Forbidden / Authorization Error
 */
class ForbiddenError extends ApiError {
  constructor(message = 'Access denied. Insufficient permissions.') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * 409 Conflict
 */
class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 402 Payment Required — used when a company's plan limit blocks an action.
 */
class PaymentRequiredError extends ApiError {
  constructor(message = 'This action requires a plan upgrade.') {
    super(message, 402, 'PLAN_LIMIT_REACHED');
  }
}

/**
 * 500 Internal Server Error
 */
class InternalError extends ApiError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR');
  }
}

/**
 * 429 Too Many Requests
 */
class RateLimitError extends ApiError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * 503 Service Unavailable
 */
class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

module.exports = {
  ApiError,
  NotFoundError,
  ValidationError,
  AuthError,
  ForbiddenError,
  ConflictError,
  PaymentRequiredError,
  InternalError,
  RateLimitError,
  ServiceUnavailableError,
};
