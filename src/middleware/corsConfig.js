const cors = require('cors');

/**
 * CORS Configuration Middleware
 * Configures Cross-Origin Resource Sharing with security best practices
 */

/**
 * Parse allowed origins from environment variable
 * @returns {string[]} Array of allowed origin URLs
 */
const getAllowedOrigins = () => {
  const origins = process.env.ALLOWED_ORIGINS || '';
  return origins.split(',').map(origin => origin.trim()).filter(origin => origin.length > 0);
};

/**
 * CORS options configuration
 */
const corsOptions = {
  /**
   * Dynamic origin validation
   * @param {string} origin - The origin of the request
   * @param {Function} callback - Callback function (error, allow)
   */
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },

  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'DELETE'],

  // Allowed headers
  allowedHeaders: ['Content-Type', 'Authorization'],

  // Enable credentials (cookies, authorization headers)
  credentials: true,

  // Pre-flight cache duration (in seconds)
  maxAge: 600,

  // Pass the CORS preflight response to the next handler
  preflightContinue: false,

  // Provide a status code to use for successful OPTIONS requests
  optionsSuccessStatus: 204
};

/**
 * Create and export configured CORS middleware
 */
const corsMiddleware = cors(corsOptions);

module.exports = {
  corsMiddleware,
  getAllowedOrigins,
  corsOptions
};
