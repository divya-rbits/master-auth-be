const jwtService = require('./jwt');
const jweService = require('./jwe');
const kdfService = require('./kdf');
const supabase = require('../config/supabase');
const logger = require('../config/logger');
require('dotenv').config();

/**
 * Token Service - Orchestrates JWT and JWE operations for token generation and validation
 * Combines JWT signing, JWE encryption, and key derivation for secure token handling
 */
class TokenService {
  /**
   * Generates a secure JWE token containing a signed JWT
   * @param {string} appId - The application ID (required)
   * @param {Object} [userContext] - Optional user context/custom claims
   * @returns {Promise<{token: string, salt: string}>} The JWE token and its salt
   * @throws {Error} If inputs are invalid or token generation fails
   */
  async generateToken(appId, userContext) {
    try {
      // Validate appId
      if (!appId || (typeof appId === 'string' && appId.trim().length === 0)) {
        throw new Error('appId is required');
      }

      if (typeof appId !== 'string') {
        throw new Error('appId must be a string');
      }

      // Validate userContext if provided
      if (userContext !== undefined && userContext !== null) {
        if (typeof userContext !== 'object' || Array.isArray(userContext)) {
          throw new Error('userContext must be an object');
        }
      }

      // Validate master password is configured
      const masterPassword = process.env.MASTER_PASSWORD;
      if (!masterPassword) {
        throw new Error('MASTER_PASSWORD not configured in environment');
      }

      // Step 1: Create JWT payload with appId and optional userContext
      const payload = {
        appId,
        ...(userContext && { userContext })
      };

      // Step 2: Generate signed JWT (adds exp, iat, jti automatically)
      const jwt = await jwtService.generateJWT(payload);

      // Step 3: Generate random salt for key derivation
      const saltBuffer = await kdfService.generateSalt();

      // Step 4: Derive CEK (Content Encryption Key) from master password + salt
      const cek = await kdfService.deriveKey(masterPassword, saltBuffer);

      // Step 5: Encrypt JWT into JWE using the derived CEK
      const jwe = await jweService.encryptJWE(jwt, cek);

      // Step 6: Encode salt for transmission
      const encodedSalt = kdfService.encodeSalt(saltBuffer);

      // Return JWE token and salt (salt needed for decryption)
      return {
        token: jwe,
        salt: encodedSalt
      };
    } catch (error) {
      logger.error('Error generating token', { error: error.message });
      throw error;
    }
  }

  /**
   * Validates and decrypts a JWE token, returning the payload
   * @param {string} token - The JWE token to validate
   * @param {string} salt - The salt used to derive the encryption key
   * @returns {Promise<Object>} The decoded and verified JWT payload
   * @throws {Error} If token is invalid, expired, revoked, or validation fails
   */
  async validateToken(token, salt) {
    try {
      // Validate token input
      if (!token || (typeof token === 'string' && token.trim().length === 0)) {
        throw new Error('token is required');
      }

      if (typeof token !== 'string') {
        throw new Error('token must be a string');
      }

      // Validate salt input
      if (!salt || (typeof salt === 'string' && salt.trim().length === 0)) {
        throw new Error('salt is required');
      }

      if (typeof salt !== 'string') {
        throw new Error('salt must be a string');
      }

      // Validate master password is configured
      const masterPassword = process.env.MASTER_PASSWORD;
      if (!masterPassword) {
        throw new Error('MASTER_PASSWORD not configured in environment');
      }

      // Step 1: Decode salt from base64url format
      const saltBuffer = kdfService.decodeSalt(salt);

      // Step 2: Derive CEK from master password + salt
      const cek = await kdfService.deriveKey(masterPassword, saltBuffer);

      // Step 3: Decrypt JWE to get the JWT
      const jwt = await jweService.decryptJWE(token, cek);

      // Step 4: Verify JWT signature and decode payload
      // This also validates exp, iat, jti claims
      const payload = await jwtService.verifyJWT(jwt);

      // Step 5: Check if token has been revoked
      await this._checkRevocation(payload.jti);

      // Return the validated payload
      return payload;
    } catch (error) {
      logger.error('Error validating token', { error: error.message });
      throw error;
    }
  }

  /**
   * Checks if a token has been revoked by querying the revoked_tokens table
   * @param {string} jti - The JWT ID (jti claim) to check
   * @throws {Error} If token is revoked or database query fails
   * @private
   */
  async _checkRevocation(jti) {
    try {
      const { data, error } = await supabase
        .from('revoked_tokens')
        .select('*')
        .eq('jti', jti)
        .single();

      if (error) {
        // If error is "no rows returned", token is not revoked (good)
        if (error.code === 'PGRST116') {
          return; // Token not revoked
        }
        // Other database errors should be thrown
        throw new Error(`Failed to check revocation status: ${error.message}`);
      }

      // If data exists, token has been revoked
      if (data) {
        throw new Error('Token has been revoked');
      }
    } catch (error) {
      // Re-throw revocation errors
      if (error.message.includes('Token has been revoked')) {
        throw error;
      }
      // For database connection errors, we might want to fail open or closed
      // For security, we fail closed (reject the token)
      logger.error('Revocation check failed', { error: error.message });
      throw new Error(`Revocation check failed: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new TokenService();
