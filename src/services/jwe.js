const crypto = require('crypto');
require('dotenv').config();

/**
 * JWE Service - Handles JWE (Outer Encryption) for JWT tokens
 * Uses Node.js crypto module with A256GCM encryption algorithm
 *
 * Configuration:
 * - Algorithm: 'dir' (Direct Key Agreement - CEK is used directly)
 * - Encryption: 'A256GCM' (AES-256 in Galois/Counter Mode with authentication)
 */
class JweService {
  /**
   * JWE configuration parameters
   */
  constructor() {
    this.algorithm = 'dir'; // Direct encryption (no key wrapping)
    this.encryption = 'A256GCM'; // AES-256 GCM
    this.cekLength = 32; // 256 bits for A256GCM
    this.ivLength = 12; // 96 bits IV for GCM (recommended)
    this.authTagLength = 16; // 128 bits authentication tag
  }

  /**
   * Base64 URL encode (without padding)
   * @param {Buffer} buffer - Buffer to encode
   * @returns {string} Base64 URL encoded string
   */
  _base64UrlEncode(buffer) {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64 URL decode
   * @param {string} str - Base64 URL encoded string
   * @returns {Buffer} Decoded buffer
   */
  _base64UrlDecode(str) {
    // Add back padding if needed
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64');
  }

  /**
   * Encrypts a JWT into a JWE using the provided CEK
   * @param {string} jwt - The JWT token to encrypt
   * @param {Buffer} cek - Content Encryption Key (must be 32 bytes for A256GCM)
   * @returns {Promise<string>} The JWE in compact serialization format
   * @throws {Error} If inputs are invalid or encryption fails
   */
  async encryptJWE(jwt, cek) {
    try {
      // Validate JWT input
      if (!jwt || typeof jwt !== 'string') {
        throw new Error('Invalid jwt: must be a non-empty string');
      }

      if (jwt.trim().length === 0) {
        throw new Error('Invalid jwt: cannot be empty');
      }

      // Validate CEK input
      if (!cek || !Buffer.isBuffer(cek)) {
        throw new Error('Invalid cek: must be a Buffer');
      }

      if (cek.length !== this.cekLength) {
        throw new Error(`Invalid cek: must be ${this.cekLength} bytes for ${this.encryption}`);
      }

      // Create JWE Protected Header
      const protectedHeader = {
        alg: this.algorithm,
        enc: this.encryption
      };
      const protectedHeaderEncoded = this._base64UrlEncode(
        Buffer.from(JSON.stringify(protectedHeader))
      );

      // Generate random IV (12 bytes for GCM)
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher with GCM mode
      const cipher = crypto.createCipheriv('aes-256-gcm', cek, iv, {
        authTagLength: this.authTagLength
      });

      // Set AAD (Additional Authenticated Data) - the protected header
      cipher.setAAD(Buffer.from(protectedHeaderEncoded, 'ascii'));

      // Encrypt the JWT
      const jwtBuffer = Buffer.from(jwt, 'utf8');
      const ciphertext = Buffer.concat([
        cipher.update(jwtBuffer),
        cipher.final()
      ]);

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      // Build JWE in compact serialization format:
      // BASE64URL(UTF8(JWE Protected Header)) || '.' ||
      // BASE64URL(JWE Encrypted Key) || '.' ||
      // BASE64URL(JWE Initialization Vector) || '.' ||
      // BASE64URL(JWE Ciphertext) || '.' ||
      // BASE64URL(JWE Authentication Tag)
      const jwe = [
        protectedHeaderEncoded,
        '', // Empty encrypted key for direct encryption (alg=dir)
        this._base64UrlEncode(iv),
        this._base64UrlEncode(ciphertext),
        this._base64UrlEncode(authTag)
      ].join('.');

      return jwe;
    } catch (error) {
      console.error('Error encrypting JWE:', error.message);
      throw new Error(`Failed to encrypt JWE: ${error.message}`);
    }
  }

  /**
   * Decrypts a JWE and returns the original JWT
   * @param {string} jwe - The JWE token in compact serialization format
   * @param {Buffer} cek - Content Encryption Key (must be 32 bytes for A256GCM)
   * @returns {Promise<string>} The decrypted JWT token
   * @throws {Error} If inputs are invalid, JWE is tampered, or decryption fails
   */
  async decryptJWE(jwe, cek) {
    try {
      // Validate JWE input
      if (!jwe || typeof jwe !== 'string') {
        throw new Error('Invalid jwe: must be a non-empty string');
      }

      if (jwe.trim().length === 0) {
        throw new Error('Invalid jwe: cannot be empty');
      }

      // Validate CEK input
      if (!cek || !Buffer.isBuffer(cek)) {
        throw new Error('Invalid cek: must be a Buffer');
      }

      if (cek.length !== this.cekLength) {
        throw new Error(`Invalid cek: must be ${this.cekLength} bytes for ${this.encryption}`);
      }

      // Parse JWE compact serialization
      const parts = jwe.split('.');
      if (parts.length !== 5) {
        throw new Error('Invalid JWE format: must have 5 parts in compact serialization');
      }

      const [protectedHeaderEncoded, encryptedKey, ivEncoded, ciphertextEncoded, authTagEncoded] = parts;

      // Verify encrypted key is empty (for alg=dir)
      if (encryptedKey !== '') {
        throw new Error('Invalid JWE: encrypted key must be empty for direct encryption');
      }

      // Decode protected header
      const protectedHeader = JSON.parse(
        this._base64UrlDecode(protectedHeaderEncoded).toString('utf8')
      );

      // Verify algorithm and encryption
      if (protectedHeader.alg !== this.algorithm) {
        throw new Error(`Invalid algorithm in JWE: expected ${this.algorithm}, got ${protectedHeader.alg}`);
      }

      if (protectedHeader.enc !== this.encryption) {
        throw new Error(`Invalid encryption in JWE: expected ${this.encryption}, got ${protectedHeader.enc}`);
      }

      // Decode IV, ciphertext, and auth tag
      const iv = this._base64UrlDecode(ivEncoded);
      const ciphertext = this._base64UrlDecode(ciphertextEncoded);
      const authTag = this._base64UrlDecode(authTagEncoded);

      // Create decipher with GCM mode
      const decipher = crypto.createDecipheriv('aes-256-gcm', cek, iv, {
        authTagLength: this.authTagLength
      });

      // Set AAD (Additional Authenticated Data) - the protected header
      decipher.setAAD(Buffer.from(protectedHeaderEncoded, 'ascii'));

      // Set the authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt the ciphertext
      // If auth tag verification fails, this will throw an error
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);

      // Convert plaintext to string
      const jwt = plaintext.toString('utf8');

      return jwt;
    } catch (error) {
      // Provide specific error messages for common failure scenarios
      if (error.message.includes('Unsupported state or unable to authenticate data')) {
        throw new Error('Failed to decrypt JWE: invalid key or tampered data');
      }

      if (error.message.includes('Invalid JWE format')) {
        throw new Error(error.message);
      }

      console.error('Error decrypting JWE:', error.message);
      throw new Error(`Failed to decrypt JWE: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new JweService();
