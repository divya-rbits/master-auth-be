const crypto = require('crypto');

/**
 * Key Derivation Service - Handles key derivation using PBKDF2
 * Used to derive Content Encryption Keys (CEK) from master password
 */
class KdfService {
  /**
   * PBKDF2 configuration parameters
   */
  constructor() {
    this.defaultIterations = 100000;  // 100,000 iterations (OWASP recommendation)
    this.keyLength = 32;               // 32-byte key (256 bits)
    this.digest = 'sha256';            // SHA-256 hash algorithm
    this.saltLength = 16;              // 16-byte salt (128 bits)
  }

  /**
   * Derives a key from a password using PBKDF2
   * @param {string} password - The password to derive the key from
   * @param {Buffer} salt - The salt to use for key derivation
   * @param {number} [iterations] - Number of iterations (default: 100,000)
   * @returns {Promise<Buffer>} The derived key (32 bytes)
   * @throws {Error} If inputs are invalid or derivation fails
   */
  async deriveKey(password, salt, iterations = this.defaultIterations) {
    return new Promise((resolve, reject) => {
      try {
        // Validate password
        if (!password || typeof password !== 'string') {
          return reject(new Error('Invalid password: must be a non-empty string'));
        }

        if (password.trim().length === 0) {
          return reject(new Error('Invalid password: cannot be empty'));
        }

        // Validate salt
        if (!salt || !Buffer.isBuffer(salt)) {
          return reject(new Error('Invalid salt: must be a Buffer'));
        }

        // Validate iterations
        if (typeof iterations !== 'number' || iterations <= 0 || !Number.isInteger(iterations)) {
          return reject(new Error('Invalid iterations: must be a positive integer'));
        }

        // Derive key using PBKDF2
        crypto.pbkdf2(
          password,
          salt,
          iterations,
          this.keyLength,
          this.digest,
          (err, derivedKey) => {
            if (err) {
              return reject(new Error(`Failed to derive key: ${err.message}`));
            }
            resolve(derivedKey);
          }
        );
      } catch (error) {
        reject(new Error(`Failed to derive key: ${error.message}`));
      }
    });
  }

  /**
   * Generates a cryptographically random salt
   * @returns {Promise<Buffer>} A random 16-byte salt
   * @throws {Error} If salt generation fails
   */
  async generateSalt() {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(this.saltLength, (err, buffer) => {
        if (err) {
          return reject(new Error(`Failed to generate salt: ${err.message}`));
        }
        resolve(buffer);
      });
    });
  }

  /**
   * Encodes a salt Buffer to a URL-safe base64 string for storage
   * @param {Buffer} salt - The salt Buffer to encode
   * @returns {string} URL-safe base64 encoded salt
   * @throws {Error} If salt is invalid
   */
  encodeSalt(salt) {
    try {
      // Validate salt
      if (!salt || !Buffer.isBuffer(salt)) {
        throw new Error('Invalid salt: must be a Buffer');
      }

      // Convert to URL-safe base64
      // Standard base64: +, /, =
      // URL-safe base64: -, _, no padding
      return salt
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } catch (error) {
      throw new Error(`Failed to encode salt: ${error.message}`);
    }
  }

  /**
   * Decodes a URL-safe base64 string back to a salt Buffer
   * @param {string} encodedSalt - The URL-safe base64 encoded salt
   * @returns {Buffer} The decoded salt Buffer
   * @throws {Error} If encoded salt is invalid
   */
  decodeSalt(encodedSalt) {
    try {
      // Validate encoded salt
      if (!encodedSalt || typeof encodedSalt !== 'string') {
        throw new Error('Invalid encoded salt: must be a non-empty string');
      }

      if (encodedSalt.trim().length === 0) {
        throw new Error('Invalid encoded salt: cannot be empty');
      }

      // Convert URL-safe base64 back to standard base64
      let base64 = encodedSalt
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      // Add padding if needed
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }

      // Decode to Buffer
      return Buffer.from(base64, 'base64');
    } catch (error) {
      throw new Error(`Failed to decode salt: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new KdfService();
