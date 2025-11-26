const kdfService = require('../../src/services/kdf');
const crypto = require('crypto');

describe('KDF Service', () => {
  describe('deriveKey', () => {
    test('should successfully derive a key with valid inputs', async () => {
      const password = 'test-master-password';
      const salt = Buffer.from('1234567890abcdef', 'hex'); // 8 bytes for test
      const iterations = 100000;

      const key = await kdfService.deriveKey(password, salt, iterations);

      expect(key).toBeDefined();
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32); // 32-byte key (256 bits)
    });

    test('should use default iterations (100,000) when not specified', async () => {
      const password = 'test-master-password';
      const salt = Buffer.from('1234567890abcdef', 'hex');

      const key = await kdfService.deriveKey(password, salt);

      expect(key).toBeDefined();
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32);
    });

    test('should produce consistent keys for same password and salt', async () => {
      const password = 'test-master-password';
      const salt = Buffer.from('1234567890abcdef', 'hex');
      const iterations = 100000;

      const key1 = await kdfService.deriveKey(password, salt, iterations);
      const key2 = await kdfService.deriveKey(password, salt, iterations);

      expect(key1.equals(key2)).toBe(true);
    });

    test('should produce different keys for different passwords', async () => {
      const salt = Buffer.from('1234567890abcdef', 'hex');
      const iterations = 100000;

      const key1 = await kdfService.deriveKey('password1', salt, iterations);
      const key2 = await kdfService.deriveKey('password2', salt, iterations);

      expect(key1.equals(key2)).toBe(false);
    });

    test('should produce different keys for different salts', async () => {
      const password = 'test-master-password';
      const salt1 = Buffer.from('1234567890abcdef', 'hex');
      const salt2 = Buffer.from('fedcba0987654321', 'hex');
      const iterations = 100000;

      const key1 = await kdfService.deriveKey(password, salt1, iterations);
      const key2 = await kdfService.deriveKey(password, salt2, iterations);

      expect(key1.equals(key2)).toBe(false);
    });

    test('should throw error for invalid password (null)', async () => {
      const salt = Buffer.from('1234567890abcdef', 'hex');

      await expect(kdfService.deriveKey(null, salt, 100000))
        .rejects.toThrow('Invalid password');
    });

    test('should throw error for invalid password (empty string)', async () => {
      const salt = Buffer.from('1234567890abcdef', 'hex');

      await expect(kdfService.deriveKey('', salt, 100000))
        .rejects.toThrow('Invalid password');
    });

    test('should throw error for invalid password (non-string)', async () => {
      const salt = Buffer.from('1234567890abcdef', 'hex');

      await expect(kdfService.deriveKey(123, salt, 100000))
        .rejects.toThrow('Invalid password');
    });

    test('should throw error for invalid salt (null)', async () => {
      await expect(kdfService.deriveKey('password', null, 100000))
        .rejects.toThrow('Invalid salt');
    });

    test('should throw error for invalid salt (non-Buffer)', async () => {
      await expect(kdfService.deriveKey('password', 'not-a-buffer', 100000))
        .rejects.toThrow('Invalid salt');
    });

    test('should throw error for invalid iterations (negative)', async () => {
      const salt = Buffer.from('1234567890abcdef', 'hex');

      await expect(kdfService.deriveKey('password', salt, -1))
        .rejects.toThrow('Invalid iterations');
    });

    test('should throw error for invalid iterations (zero)', async () => {
      const salt = Buffer.from('1234567890abcdef', 'hex');

      await expect(kdfService.deriveKey('password', salt, 0))
        .rejects.toThrow('Invalid iterations');
    });

    test('should throw error for invalid iterations (non-number)', async () => {
      const salt = Buffer.from('1234567890abcdef', 'hex');

      await expect(kdfService.deriveKey('password', salt, 'invalid'))
        .rejects.toThrow('Invalid iterations');
    });

    test('should work with different iteration counts', async () => {
      const password = 'test-master-password';
      const salt = Buffer.from('1234567890abcdef', 'hex');

      const key1 = await kdfService.deriveKey(password, salt, 10000);
      const key2 = await kdfService.deriveKey(password, salt, 50000);

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1.equals(key2)).toBe(false); // Different iterations = different keys
    });
  });

  describe('generateSalt', () => {
    test('should generate a 16-byte salt', async () => {
      const salt = await kdfService.generateSalt();

      expect(salt).toBeDefined();
      expect(Buffer.isBuffer(salt)).toBe(true);
      expect(salt.length).toBe(16);
    });

    test('should generate unique salts', async () => {
      const salt1 = await kdfService.generateSalt();
      const salt2 = await kdfService.generateSalt();

      expect(salt1.equals(salt2)).toBe(false);
    });

    test('should generate cryptographically random salts', async () => {
      const salts = [];
      for (let i = 0; i < 10; i++) {
        salts.push(await kdfService.generateSalt());
      }

      // Check all salts are unique
      for (let i = 0; i < salts.length; i++) {
        for (let j = i + 1; j < salts.length; j++) {
          expect(salts[i].equals(salts[j])).toBe(false);
        }
      }
    });
  });

  describe('encodeSalt', () => {
    test('should encode Buffer salt to base64 string', () => {
      const salt = Buffer.from('1234567890abcdef1234567890abcdef', 'hex');
      const encoded = kdfService.encodeSalt(salt);

      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    test('should produce consistent encoding for same salt', () => {
      const salt = Buffer.from('1234567890abcdef1234567890abcdef', 'hex');
      const encoded1 = kdfService.encodeSalt(salt);
      const encoded2 = kdfService.encodeSalt(salt);

      expect(encoded1).toBe(encoded2);
    });

    test('should throw error for invalid salt (null)', () => {
      expect(() => kdfService.encodeSalt(null))
        .toThrow('Invalid salt');
    });

    test('should throw error for invalid salt (non-Buffer)', () => {
      expect(() => kdfService.encodeSalt('not-a-buffer'))
        .toThrow('Invalid salt');
    });

    test('should encode to URL-safe base64', () => {
      const salt = Buffer.from('1234567890abcdef1234567890abcdef', 'hex');
      const encoded = kdfService.encodeSalt(salt);

      // URL-safe base64 uses - and _ instead of + and /
      expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/);
    });
  });

  describe('decodeSalt', () => {
    test('should decode base64 string to Buffer', () => {
      const originalSalt = Buffer.from('1234567890abcdef1234567890abcdef', 'hex');
      const encoded = kdfService.encodeSalt(originalSalt);
      const decoded = kdfService.decodeSalt(encoded);

      expect(decoded).toBeDefined();
      expect(Buffer.isBuffer(decoded)).toBe(true);
      expect(decoded.equals(originalSalt)).toBe(true);
    });

    test('should throw error for invalid encoded salt (null)', () => {
      expect(() => kdfService.decodeSalt(null))
        .toThrow('Invalid encoded salt');
    });

    test('should throw error for invalid encoded salt (empty string)', () => {
      expect(() => kdfService.decodeSalt(''))
        .toThrow('Invalid encoded salt');
    });

    test('should throw error for invalid encoded salt (non-string)', () => {
      expect(() => kdfService.decodeSalt(123))
        .toThrow('Invalid encoded salt');
    });

    test('should handle URL-safe base64 decoding', () => {
      // Create a salt that would produce URL-unsafe characters in standard base64
      const salt = Buffer.alloc(16);
      salt.fill(255); // Will produce characters that differ in URL-safe encoding

      const encoded = kdfService.encodeSalt(salt);
      const decoded = kdfService.decodeSalt(encoded);

      expect(decoded.equals(salt)).toBe(true);
    });
  });

  describe('encode/decode round-trip', () => {
    test('should successfully encode and decode a generated salt', async () => {
      const originalSalt = await kdfService.generateSalt();
      const encoded = kdfService.encodeSalt(originalSalt);
      const decoded = kdfService.decodeSalt(encoded);

      expect(decoded.equals(originalSalt)).toBe(true);
    });

    test('should handle multiple round-trips', async () => {
      const originalSalt = await kdfService.generateSalt();

      for (let i = 0; i < 5; i++) {
        const encoded = kdfService.encodeSalt(originalSalt);
        const decoded = kdfService.decodeSalt(encoded);
        expect(decoded.equals(originalSalt)).toBe(true);
      }
    });
  });

  describe('end-to-end key derivation flow', () => {
    test('should complete full workflow: generate salt, derive key, encode salt', async () => {
      const password = 'my-master-password';

      // Generate random salt
      const salt = await kdfService.generateSalt();

      // Derive key
      const key = await kdfService.deriveKey(password, salt);

      // Encode salt for storage
      const encodedSalt = kdfService.encodeSalt(salt);

      // Verify everything worked
      expect(salt).toBeDefined();
      expect(salt.length).toBe(16);
      expect(key).toBeDefined();
      expect(key.length).toBe(32);
      expect(encodedSalt).toBeDefined();
      expect(typeof encodedSalt).toBe('string');
    });

    test('should verify salt can be decoded and used to derive same key', async () => {
      const password = 'my-master-password';

      // Generate and derive key
      const originalSalt = await kdfService.generateSalt();
      const originalKey = await kdfService.deriveKey(password, originalSalt);

      // Encode salt (simulating storage)
      const encodedSalt = kdfService.encodeSalt(originalSalt);

      // Later: decode salt and derive key again
      const decodedSalt = kdfService.decodeSalt(encodedSalt);
      const newKey = await kdfService.deriveKey(password, decodedSalt);

      // Keys should match
      expect(newKey.equals(originalKey)).toBe(true);
    });
  });
});
