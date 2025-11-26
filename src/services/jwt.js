const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

/**
 * JWT Service - Handles JWT (Inner Token) generation and verification
 * Uses HS256 algorithm for signing tokens
 */
class JwtService {
  /**
   * JWT configuration parameters
   */
  constructor() {
    this.secret = process.env.JWT_SECRET || 'your_jwt_secret_here';
    this.algorithm = 'HS256';
    this.expiresIn = parseInt(process.env.TOKEN_EXPIRATION || '3600', 10); // Default: 1 hour

    // Validate configuration
    if (!process.env.JWT_SECRET) {
      console.warn('Warning: JWT_SECRET not set in environment. Using default (INSECURE)');
    }
  }

  /**
   * Generates a signed JWT with required claims
   * @param {Object} payload - The payload data to include in the JWT
   * @returns {Promise<string>} The signed JWT token
   * @throws {Error} If payload is invalid or token generation fails
   */
  async generateJWT(payload) {
    try {
      // Validate input
      if (payload === null || payload === undefined) {
        throw new Error('Invalid payload: must be an object');
      }

      if (typeof payload !== 'object') {
        throw new Error('Invalid payload: must be an object');
      }

      // Generate unique token ID (jti claim)
      const jti = crypto.randomUUID();

      // Current timestamp (iat claim)
      const iat = Math.floor(Date.now() / 1000);

      // Expiration timestamp (exp claim)
      const exp = iat + this.expiresIn;

      // Combine payload with required claims
      const tokenPayload = {
        ...payload,
        jti,
        iat,
        exp
      };

      // Sign the JWT
      const token = jwt.sign(tokenPayload, this.secret, {
        algorithm: this.algorithm
        // iat and exp are already in the payload, so don't use options
      });

      return token;
    } catch (error) {
      console.error('Error generating JWT:', error.message);
      throw new Error(`Failed to generate JWT: ${error.message}`);
    }
  }

  /**
   * Verifies a JWT and returns the payload
   * @param {string} token - The JWT token to verify
   * @returns {Promise<Object>} The decoded JWT payload
   * @throws {Error} If token is invalid, expired, or verification fails
   */
  async verifyJWT(token) {
    try {
      // Validate input
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token: must be a non-empty string');
      }

      if (token.trim().length === 0) {
        throw new Error('Invalid token: cannot be empty');
      }

      // Verify token signature and decode payload
      const decoded = jwt.verify(token, this.secret, {
        algorithms: [this.algorithm]
      });

      // Validate required claims exist
      this.validateClaims(decoded);

      return decoded;
    } catch (error) {
      // Provide specific error messages for different JWT errors
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }

      if (error.name === 'JsonWebTokenError') {
        throw new Error(`Invalid token: ${error.message}`);
      }

      if (error.name === 'NotBeforeError') {
        throw new Error('Token not yet valid');
      }

      console.error('Error verifying JWT:', error.message);
      throw new Error(`Failed to verify JWT: ${error.message}`);
    }
  }

  /**
   * Validates that required claims are present in the token payload
   * @param {Object} payload - The decoded token payload
   * @throws {Error} If required claims are missing
   */
  validateClaims(payload) {
    const requiredClaims = ['exp', 'iat', 'jti'];

    for (const claim of requiredClaims) {
      if (!(claim in payload)) {
        throw new Error(`Missing required claim: ${claim}`);
      }
    }

    // Validate claim types
    if (typeof payload.exp !== 'number') {
      throw new Error('Invalid exp claim: must be a number');
    }

    if (typeof payload.iat !== 'number') {
      throw new Error('Invalid iat claim: must be a number');
    }

    if (typeof payload.jti !== 'string') {
      throw new Error('Invalid jti claim: must be a string');
    }
  }
}

// Export singleton instance
module.exports = new JwtService();
