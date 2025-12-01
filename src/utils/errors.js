/**
 * Custom Error Classes
 * Provides specific error types for different scenarios with appropriate HTTP status codes
 */

/**
 * Base Application Error
 * All custom errors extend from this class
 */
class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Used to distinguish operational errors from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error (400)
 * Used for input validation failures
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, details);
  }
}

/**
 * Authentication Error (401)
 * Used when authentication fails or token is invalid
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details = null) {
    super(message, 401, details);
  }
}

/**
 * Authorization Error (403)
 * Used when user doesn't have permission to access resource
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access forbidden', details = null) {
    super(message, 403, details);
  }
}

/**
 * Not Found Error (404)
 * Used when requested resource doesn't exist
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, details);
  }
}

/**
 * Conflict Error (409)
 * Used when request conflicts with current state (e.g., duplicate resource)
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, details);
  }
}

/**
 * Internal Server Error (500)
 * Used for unexpected server errors
 */
class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, 500, details);
  }
}

/**
 * Service Unavailable Error (503)
 * Used when service is temporarily unavailable (e.g., database down)
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', details = null) {
    super(message, 503, details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError
};
