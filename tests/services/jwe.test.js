const jweService = require('../../src/services/jwe');
const crypto = require('crypto');

describe('JWE Service', () => {
  // Sample test data
  const validJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBJZCI6InRlc3QtYXBwIiwidXNlcklkIjoidXNlci0xMjMiLCJpYXQiOjE2MzAwMDAwMDAsImV4cCI6MTYzMDAwMzYwMCwianRpIjoiYWJjZC0xMjM0In0.signature';
  const validCEK = crypto.randomBytes(32); // 256-bit key for A256GCM

  describe('encryptJWE', () => {
    test('should successfully encrypt a JWT with valid CEK', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);

      expect(jwe).toBeDefined();
      expect(typeof jwe).toBe('string');
      expect(jwe.length).toBeGreaterThan(0);
    });

    test('should return JWE in compact serialization format (5 parts)', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);

      const parts = jwe.split('.');
      expect(parts.length).toBe(5); // JWE compact format: header.encrypted_key.iv.ciphertext.tag
    });

    test('should throw error for invalid JWT input (null)', async () => {
      await expect(jweService.encryptJWE(null, validCEK))
        .rejects.toThrow(/Invalid jwt/i);
    });

    test('should throw error for invalid JWT input (undefined)', async () => {
      await expect(jweService.encryptJWE(undefined, validCEK))
        .rejects.toThrow(/Invalid jwt/i);
    });

    test('should throw error for invalid JWT input (empty string)', async () => {
      await expect(jweService.encryptJWE('', validCEK))
        .rejects.toThrow(/Invalid jwt/i);
    });

    test('should throw error for invalid JWT input (non-string)', async () => {
      await expect(jweService.encryptJWE(12345, validCEK))
        .rejects.toThrow(/Invalid jwt/i);
    });

    test('should throw error for invalid CEK (null)', async () => {
      await expect(jweService.encryptJWE(validJWT, null))
        .rejects.toThrow(/Invalid cek/i);
    });

    test('should throw error for invalid CEK (undefined)', async () => {
      await expect(jweService.encryptJWE(validJWT, undefined))
        .rejects.toThrow(/Invalid cek/i);
    });

    test('should throw error for invalid CEK (wrong length - too short)', async () => {
      const shortKey = crypto.randomBytes(16); // Only 128 bits
      await expect(jweService.encryptJWE(validJWT, shortKey))
        .rejects.toThrow(/Invalid cek.*32 bytes/i);
    });

    test('should throw error for invalid CEK (wrong length - too long)', async () => {
      const longKey = crypto.randomBytes(64); // 512 bits
      await expect(jweService.encryptJWE(validJWT, longKey))
        .rejects.toThrow(/Invalid cek.*32 bytes/i);
    });

    test('should throw error for invalid CEK (not a Buffer)', async () => {
      await expect(jweService.encryptJWE(validJWT, 'not-a-buffer'))
        .rejects.toThrow(/Invalid cek/i);
    });

    test('should produce different ciphertext for same JWT (random IV)', async () => {
      const jwe1 = await jweService.encryptJWE(validJWT, validCEK);
      const jwe2 = await jweService.encryptJWE(validJWT, validCEK);

      expect(jwe1).not.toBe(jwe2); // Different due to random IV
    });
  });

  describe('decryptJWE', () => {
    test('should successfully decrypt valid JWE and return original JWT', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);
      const decrypted = await jweService.decryptJWE(jwe, validCEK);

      expect(decrypted).toBe(validJWT);
    });

    test('should verify JWT content matches original after encrypt/decrypt cycle', async () => {
      const originalJWT = 'eyJhbGciOiJIUzI1NiJ9.eyJkYXRhIjoidGVzdCJ9.sig';
      const jwe = await jweService.encryptJWE(originalJWT, validCEK);
      const decrypted = await jweService.decryptJWE(jwe, validCEK);

      expect(decrypted).toBe(originalJWT);
    });

    test('should throw error for tampered JWE (modified ciphertext)', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);

      // Tamper with the ciphertext part (4th component)
      const parts = jwe.split('.');
      parts[3] = parts[3].slice(0, -5) + 'AAAAA'; // Change last 5 chars
      const tamperedJWE = parts.join('.');

      await expect(jweService.decryptJWE(tamperedJWE, validCEK))
        .rejects.toThrow();
    });

    test('should throw error for tampered JWE (modified auth tag)', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);

      // Tamper with the authentication tag (5th component)
      const parts = jwe.split('.');
      parts[4] = parts[4].slice(0, -5) + 'BBBBB';
      const tamperedJWE = parts.join('.');

      await expect(jweService.decryptJWE(tamperedJWE, validCEK))
        .rejects.toThrow();
    });

    test('should throw error for wrong CEK', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);
      const wrongCEK = crypto.randomBytes(32); // Different key

      await expect(jweService.decryptJWE(jwe, wrongCEK))
        .rejects.toThrow();
    });

    test('should throw error for invalid JWE format (not 5 parts)', async () => {
      const invalidJWE = 'invalid.jwe.format';

      await expect(jweService.decryptJWE(invalidJWE, validCEK))
        .rejects.toThrow();
    });

    test('should throw error for invalid JWE input (null)', async () => {
      await expect(jweService.decryptJWE(null, validCEK))
        .rejects.toThrow(/Invalid jwe/i);
    });

    test('should throw error for invalid JWE input (undefined)', async () => {
      await expect(jweService.decryptJWE(undefined, validCEK))
        .rejects.toThrow(/Invalid jwe/i);
    });

    test('should throw error for invalid JWE input (empty string)', async () => {
      await expect(jweService.decryptJWE('', validCEK))
        .rejects.toThrow(/Invalid jwe/i);
    });

    test('should throw error for invalid JWE input (non-string)', async () => {
      await expect(jweService.decryptJWE(12345, validCEK))
        .rejects.toThrow(/Invalid jwe/i);
    });

    test('should throw error for decryption with invalid CEK (null)', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);

      await expect(jweService.decryptJWE(jwe, null))
        .rejects.toThrow(/Invalid cek/i);
    });

    test('should throw error for decryption with invalid CEK (wrong length)', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);
      const shortKey = crypto.randomBytes(16);

      await expect(jweService.decryptJWE(jwe, shortKey))
        .rejects.toThrow(/Invalid cek.*32 bytes/i);
    });
  });

  describe('JWE Configuration', () => {
    test('should use algorithm "dir" (Direct Key Agreement)', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);

      // Decode the protected header (first part of JWE)
      const headerPart = jwe.split('.')[0];
      const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString());

      expect(header.alg).toBe('dir');
    });

    test('should use encryption "A256GCM"', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);

      // Decode the protected header
      const headerPart = jwe.split('.')[0];
      const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString());

      expect(header.enc).toBe('A256GCM');
    });

    test('should have empty encrypted key (second part) for direct encryption', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);
      const parts = jwe.split('.');

      // In direct key agreement, encrypted key should be empty
      expect(parts[1]).toBe('');
    });
  });

  describe('Edge Cases', () => {
    test('should handle JWT with special characters', async () => {
      const specialJWT = 'header.payload_with-special.chars+/=';
      const jwe = await jweService.encryptJWE(specialJWT, validCEK);
      const decrypted = await jweService.decryptJWE(jwe, validCEK);

      expect(decrypted).toBe(specialJWT);
    });

    test('should handle very long JWT', async () => {
      const longPayload = 'a'.repeat(10000);
      const longJWT = `header.${longPayload}.signature`;
      const jwe = await jweService.encryptJWE(longJWT, validCEK);
      const decrypted = await jweService.decryptJWE(jwe, validCEK);

      expect(decrypted).toBe(longJWT);
    });

    test('should handle multiple encrypt/decrypt cycles', async () => {
      let current = validJWT;

      for (let i = 0; i < 5; i++) {
        const jwe = await jweService.encryptJWE(current, validCEK);
        const decrypted = await jweService.decryptJWE(jwe, validCEK);
        expect(decrypted).toBe(current);
      }
    });

    test('should validate authentication tag correctly', async () => {
      const jwe = await jweService.encryptJWE(validJWT, validCEK);

      // Valid JWE should decrypt successfully (tag validated)
      const decrypted = await jweService.decryptJWE(jwe, validCEK);
      expect(decrypted).toBe(validJWT);

      // Modified JWE should fail tag validation
      const parts = jwe.split('.');
      // Flip multiple bits by replacing characters in the auth tag
      const originalTag = parts[4];
      const modifiedTag = originalTag.substring(0, 4) + 'AAAA' + originalTag.substring(8);
      parts[4] = modifiedTag;
      const invalidJWE = parts.join('.');

      await expect(jweService.decryptJWE(invalidJWE, validCEK))
        .rejects.toThrow();
    });
  });
});
