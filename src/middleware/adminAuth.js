const adminAuthService = require('../services/adminAuth');
const { AuthenticationError, InternalServerError } = require('../utils/errors');

/**
 * Admin Authentication Middleware
 * Uses JWT Bearer tokens to protect admin endpoints
 * Tokens are generated via /api/admin/auth/login endpoint
 */
const adminAuthMiddleware = (req, res, next) => {
  try {
    // Check if admin JWT secret is configured
    if (!process.env.ADMIN_JWT_SECRET) {
      throw new InternalServerError('Admin JWT secret not configured');
    }

    // Get Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('Authentication required');
    }

    // Parse Bearer token
    const parts = authHeader.trim().split(/\s+/);
    const authType = parts[0];
    const token = parts[1];

    if (authType !== 'Bearer') {
      throw new AuthenticationError('Bearer token required');
    }

    if (!token || token.trim() === '') {
      throw new AuthenticationError('Token not provided');
    }

    // Verify JWT token
    let payload;
    try {
      payload = adminAuthService.verifyAdminToken(token.trim());
    } catch (error) {
      // Handle specific JWT errors
      if (error.message.includes('expired')) {
        throw new AuthenticationError('Token expired');
      }
      if (error.message.includes('invalid')) {
        throw new AuthenticationError('Invalid token');
      }
      throw new AuthenticationError('Token verification failed');
    }

    // Attach admin user to request
    req.admin = {
      username: payload.username,
      role: payload.role
    };

    next();
  } catch (error) {
    // Pass error to error handler middleware
    next(error);
  }
};

module.exports = {
  adminAuthMiddleware
};
