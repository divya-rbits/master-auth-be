const rateLimit = require('express-rate-limit');
const databaseService = require('../services/database');

/**
 * Custom handler for rate limit exceeded events
 * Logs the violation and returns a standardized error response
 */
const createRateLimitHandler = (endpointName, limit) => {
  return async (req, res) => {
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent') || 'unknown';

    // Log rate limit violation
    await databaseService.logEvent(
      'rate_limit_exceeded',
      'unknown',
      ipAddress,
      userAgent,
      {
        endpoint: req.path,
        limit: limit
      }
    );

    // Return standardized error response
    return res.status(429).json({
      success: false,
      error: `Too many ${endpointName} requests, please try again later`
    });
  };
};

/**
 * Rate limiter for login endpoint
 * Limits: 5 attempts per minute per IP address
 */
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: createRateLimitHandler('login', 5),
  // Skip failed requests (don't count them toward rate limit)
  skipFailedRequests: false,
  // Skip successful requests (count all requests)
  skipSuccessfulRequests: false
});

/**
 * Rate limiter for validation endpoint
 * Limits: 100 requests per minute per IP address
 */
const validateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: createRateLimitHandler('validation', 100),
  // Skip failed requests (don't count them toward rate limit)
  skipFailedRequests: false,
  // Skip successful requests (count all requests)
  skipSuccessfulRequests: false
});

/**
 * Rate limiter for admin endpoints
 * Limits: 100 requests per minute per IP address
 */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: createRateLimitHandler('admin', 100),
  skipFailedRequests: false,
  skipSuccessfulRequests: false
});

module.exports = {
  loginLimiter,
  validateLimiter,
  adminLimiter
};
