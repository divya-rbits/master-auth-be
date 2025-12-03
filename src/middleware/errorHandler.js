const { AppError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * Global Error Handler Middleware
 * Catches all errors and formats them consistently
 * Prevents sensitive information exposure
 */
const errorHandler = (err, req, res, next) => {
  // Determine error details
  const error = normalizeError(err);

  // Log error with appropriate severity
  logError(error, req);

  // Send error response
  sendErrorResponse(res, error);
};

/**
 * Normalize error to consistent format
 * @param {Error} err - The error object
 * @returns {Object} Normalized error
 */
function normalizeError(err) {
  // If it's already our custom error, use it
  if (err instanceof AppError) {
    return {
      message: err.message,
      type: err.name,
      statusCode: err.statusCode,
      details: err.details,
      stack: err.stack,
      isOperational: err.isOperational
    };
  }

  // Handle standard errors
  if (err instanceof Error) {
    return {
      message: err.message || 'An unexpected error occurred',
      type: 'Error',
      statusCode: err.statusCode || err.status || 500,
      details: null,
      stack: err.stack,
      isOperational: false
    };
  }

  // Handle non-Error objects
  return {
    message: err.message || 'An unexpected error occurred',
    type: 'UnknownError',
    statusCode: 500,
    details: null,
    stack: null,
    isOperational: false
  };
}

/**
 * Log error with appropriate severity level
 * @param {Object} error - Normalized error object
 * @param {Object} req - Express request object
 */
function logError(error, req) {
  const logData = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    errorType: error.type,
    statusCode: error.statusCode,
    message: error.message
  };

  // Determine log level based on status code
  if (error.statusCode >= 500) {
    // Server errors - log with full details including stack trace
    logger.error('Server error occurred', {
      ...logData,
      stack: error.stack,
      details: error.details
    });
  } else if (error.statusCode >= 400) {
    // Client errors - log as warning without stack trace
    logger.warn('Client error occurred', logData);
  } else {
    // Other errors
    logger.info('Request error', logData);
  }
}

/**
 * Send formatted error response
 * Ensures no sensitive data is exposed
 * @param {Object} res - Express response object
 * @param {Object} error - Normalized error object
 */
function sendErrorResponse(res, error) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Base error response
  const errorResponse = {
    success: false,
    error: {
      message: error.message,
      type: error.type,
      statusCode: error.statusCode
    }
  };

  // Include details if available (but sanitize in production)
  if (error.details) {
    errorResponse.error.details = error.details;
  }

  // Include stack trace only in development
  if (!isProduction && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  // For 500 errors in production, use generic message if not operational
  if (isProduction && error.statusCode === 500 && !error.isOperational) {
    errorResponse.error.message = 'Internal server error';
    delete errorResponse.error.details;
  }

  // Send response
  res.status(error.statusCode).json(errorResponse);
}

/**
 * 404 Not Found Handler
 * Catches requests to undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const NotFoundError = require('../utils/errors').NotFoundError;
  next(new NotFoundError(`Route ${req.method} ${req.url} not found`));
};

module.exports = {
  errorHandler,
  notFoundHandler
};
