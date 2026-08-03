'use strict';

/**
 * Standard API response envelope.
 * All endpoints return a consistent JSON shape.
 */
class ApiResponse {
  /**
   * Generic success response.
   * @param {*} data - Payload to return
   * @param {string} message - Human-readable message
   * @param {object|null} meta - Optional metadata (pagination, etc.)
   * @returns {object}
   */
  static success(data, message = 'Success', meta = null) {
    const response = { success: true, message, data };
    if (meta) response.meta = meta;
    return response;
  }

  /**
   * Paginated list response.
   * @param {Array} data - Page of records
   * @param {number} total - Total count across all pages
   * @param {number} page - Current page (1-based)
   * @param {number} limit - Items per page
   * @returns {object}
   */
  static paginated(data, total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    return {
      success: true,
      message: 'Success',
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    };
  }

  /**
   * No content / operation-only response.
   * @param {string} message
   * @returns {object}
   */
  static noContent(message = 'Operation successful') {
    return { success: true, message };
  }

  /**
   * Created resource response.
   * @param {*} data
   * @param {string} message
   * @returns {object}
   */
  static created(data, message = 'Resource created successfully') {
    return { success: true, message, data };
  }
  /**
   * Generic error response — for the few call sites that build a 4xx
   * response inline (e.g. a quick guard clause) rather than throwing an
   * ApiError subclass for the central error handler to format.
   * Kept in the same shape the error handler itself produces
   * ({ success, message, code }) so API consumers see one consistent
   * error envelope regardless of which path produced it.
   * @param {string} message
   * @param {string} code
   * @returns {object}
   */
  static error(message = 'An error occurred', code = 'ERROR') {
    return { success: false, message, code };
  }
}

module.exports = ApiResponse;
