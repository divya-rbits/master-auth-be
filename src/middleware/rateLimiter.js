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
 * Limits: 5 attempts per 15 minutes per IP address
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
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

/**
 * Rate limiter for password change endpoint
 * Limits: 5 attempts per hour per application
 * Uses application ID as the key instead of IP address
 */
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each application to 5 password change attempts per hour
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use application ID from params as the key, with proper IPv6 handling
  keyGenerator: (req, ipKeyGenerator) => {
    return req.params.id || ipKeyGenerator(req);
  },
  handler: createRateLimitHandler('password change', 5),
  skipFailedRequests: false,
  skipSuccessfulRequests: false
});

/**
 * Rate limiter for log export endpoint
 * Limits: 10 exports per hour per IP address
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 export requests per hour
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: createRateLimitHandler('log export', 10),
  skipFailedRequests: false,
  skipSuccessfulRequests: false
});

/**
 * Rate limiter for token revocation endpoints
 * Limits: 50 revocation requests per hour per IP address
 */
const tokenRevocationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 revocation requests per hour
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: createRateLimitHandler('token revocation', 50),
  skipFailedRequests: false,
  skipSuccessfulRequests: false
});

module.exports = {
  loginLimiter,
  validateLimiter,
  adminLimiter,
  passwordChangeLimiter,
  exportLimiter,
  tokenRevocationLimiter
};
