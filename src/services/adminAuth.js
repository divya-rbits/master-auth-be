const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Admin Authentication Service
 * Handles authentication for admin panel users using simple username/password
 * credentials stored in environment variables and JWT tokens for session management
 */
class AdminAuthService {
  /**
   * Verifies admin credentials against environment variables
   * @param {string} username - Username to verify
   * @param {string} password - Password to verify
   * @returns {boolean} True if credentials match, false otherwise
   */
  verifyCredentials(username, password) {
    try {
      // Validate inputs
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return false;
      }

      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        return false;
      }

      // Get admin credentials from environment
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;

      // Check if environment variables are configured
      if (!adminUsername || !adminPassword) {
        return false;
      }

      // Compare credentials (case-sensitive)
      const usernameMatch = username === adminUsername;
      const passwordMatch = password === adminPassword;

      return usernameMatch && passwordMatch;
    } catch (error) {
      console.error('Error verifying admin credentials:', error);
      return false;
    }
  }

  /**
   * Generates a JWT token for authenticated admin user
   * @param {string} username - Admin username to include in token
   * @returns {string} Signed JWT token
   * @throws {Error} If username is invalid or environment is not configured
   */
  generateAdminToken(username) {
    try {
      // Validate username
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        throw new Error('username is required');
      }

      // Validate environment configuration
      const jwtSecret = process.env.ADMIN_JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('ADMIN_JWT_SECRET not configured in environment');
      }

      const sessionTimeout = process.env.ADMIN_SESSION_TIMEOUT;
      if (!sessionTimeout) {
        throw new Error('ADMIN_SESSION_TIMEOUT not configured in environment');
      }

      // Parse session timeout to number
      const expiresIn = parseInt(sessionTimeout, 10);
      if (isNaN(expiresIn)) {
        throw new Error('ADMIN_SESSION_TIMEOUT must be a number');
      }

      // Create token payload
      const payload = {
        username: username.trim(),
        role: 'admin'
      };

      // Sign and return token
      const token = jwt.sign(payload, jwtSecret, {
        expiresIn: expiresIn
      });

      return token;
    } catch (error) {
      console.error('Error generating admin token:', error);
      throw error;
    }
  }

  /**
   * Verifies and decodes an admin JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   * @throws {Error} If token is invalid, expired, or environment is not configured
   */
  verifyAdminToken(token) {
    try {
      // Validate token input
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        throw new Error('token is required');
      }

      // Validate environment configuration
      const jwtSecret = process.env.ADMIN_JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('ADMIN_JWT_SECRET not configured in environment');
      }

      // Verify and decode token
      const payload = jwt.verify(token.trim(), jwtSecret);

      return payload;
    } catch (error) {
      // Re-throw JWT errors with their original messages
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }

      // Re-throw other errors
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AdminAuthService();
