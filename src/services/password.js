const argon2 = require('argon2');

/**
 * Password Service - Handles password hashing and verification using Argon2
 * Uses Argon2id variant for optimal security against both side-channel and GPU attacks
 */
class PasswordService {
  /**
   * Argon2 configuration parameters
   * Based on OWASP recommendations for server-side password hashing
   */
  constructor() {
    this.argonConfig = {
      type: argon2.argon2id,    // Hybrid version (side-channel + GPU resistant)
      memoryCost: 65536,         // 64 MB memory (2^16 KB)
      timeCost: 3,               // 3 iterations
      parallelism: 4             // 4 parallel threads
    };
  }

  /**
   * Hashes a password using Argon2id
   * @param {string} password - The password to hash
   * @returns {Promise<string>} The Argon2 hash string
   * @throws {Error} If password is invalid or hashing fails
   */
  async hashPassword(password) {
    try {
      // Validate input
      if (!password || typeof password !== 'string') {
        throw new Error('Invalid password: must be a non-empty string');
      }

      if (password.trim().length === 0) {
        throw new Error('Invalid password: cannot be empty');
      }

      // Hash password with configured parameters
      const hash = await argon2.hash(password, this.argonConfig);

      return hash;
    } catch (error) {
      console.error('Error hashing password:', error.message);
      throw new Error(`Failed to hash password: ${error.message}`);
    }
  }

  /**
   * Verifies a password against an Argon2 hash
   * @param {string} password - The password to verify
   * @param {string} hash - The Argon2 hash to verify against
   * @returns {Promise<boolean>} True if password matches, false otherwise
   * @throws {Error} If inputs are invalid or verification fails
   */
  async verifyPassword(password, hash) {
    try {
      // Validate inputs
      if (!hash || typeof hash !== 'string') {
        throw new Error('Invalid hash: must be a non-empty string');
      }

      if (!password || typeof password !== 'string') {
        // Don't verify if password is invalid, just return false
        return false;
      }

      if (password.trim().length === 0) {
        // Empty password never matches
        return false;
      }

      // Verify password against hash
      const isValid = await argon2.verify(hash, password);

      return isValid;
    } catch (error) {
      // If it's a verification error (hash format issue), throw
      if (error.message.includes('Invalid hash') || error.message.includes('invalid')) {
        throw new Error(`Failed to verify password: ${error.message}`);
      }

      console.error('Error verifying password:', error.message);
      throw new Error(`Failed to verify password: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new PasswordService();
