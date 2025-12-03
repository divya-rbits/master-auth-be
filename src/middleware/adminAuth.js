const { AuthenticationError, InternalServerError } = require('../utils/errors');

/**
 * Admin Authentication Middleware
 * Uses HTTP Basic Authentication to protect admin endpoints
 * Credentials are stored in environment variables
 */
const adminAuthMiddleware = (req, res, next) => {
  try {
    // Check if admin credentials are configured
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      throw new InternalServerError('Admin credentials not configured');
    }

    // Get Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      throw new AuthenticationError('Authentication required');
    }

    // Parse Basic Auth header
    const [authType, credentials] = authHeader.split(' ');

    if (authType !== 'Basic') {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      throw new AuthenticationError('Invalid authentication type. Basic auth required');
    }

    if (!credentials) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      throw new AuthenticationError('Missing credentials');
    }

    // Decode base64 credentials
    let decodedCredentials;
    try {
      decodedCredentials = Buffer.from(credentials, 'base64').toString('utf-8');
    } catch (error) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      throw new AuthenticationError('Invalid credentials format');
    }

    // Split username and password
    const colonIndex = decodedCredentials.indexOf(':');
    if (colonIndex === -1) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      throw new AuthenticationError('Invalid credentials format');
    }

    const username = decodedCredentials.substring(0, colonIndex);
    const password = decodedCredentials.substring(colonIndex + 1);

    // Validate credentials are not empty
    if (!username || !password) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      throw new AuthenticationError('Username and password are required');
    }

    // Compare with configured credentials
    // Using simple string comparison for Basic Auth
    if (username !== adminUsername || password !== adminPassword) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      throw new AuthenticationError('Invalid credentials');
    }

    // Authentication successful
    req.admin = { username };
    next();
  } catch (error) {
    // Pass error to error handler middleware
    next(error);
  }
};

module.exports = {
  adminAuthMiddleware
};
