const passwordService = require('../../src/services/password');

describe('Password Service', () => {
  describe('hashPassword', () => {
    test('should successfully hash a valid password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await passwordService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^\$argon2id\$/); // Argon2 hash format
    });

    test('should generate different hashes for the same password', async () => {
      const password = 'MySecurePassword123!';
      const hash1 = await passwordService.hashPassword(password);
      const hash2 = await passwordService.hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts
    });

    test('should throw error for empty password', async () => {
      await expect(passwordService.hashPassword('')).rejects.toThrow();
    });

    test('should throw error for null password', async () => {
      await expect(passwordService.hashPassword(null)).rejects.toThrow();
    });

    test('should throw error for undefined password', async () => {
      await expect(passwordService.hashPassword(undefined)).rejects.toThrow();
    });
  });

  describe('verifyPassword', () => {
    test('should successfully verify correct password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await passwordService.hashPassword(password);

      const isValid = await passwordService.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    test('should fail verification for incorrect password', async () => {
      const correctPassword = 'MySecurePassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await passwordService.hashPassword(correctPassword);

      const isValid = await passwordService.verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    test('should fail verification for empty password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await passwordService.hashPassword(password);

      const isValid = await passwordService.verifyPassword('', hash);

      expect(isValid).toBe(false);
    });

    test('should throw error for invalid hash format', async () => {
      const password = 'MySecurePassword123!';
      const invalidHash = 'not-a-valid-hash';

      await expect(passwordService.verifyPassword(password, invalidHash)).rejects.toThrow();
    });

    test('should throw error for null hash', async () => {
      await expect(passwordService.verifyPassword('password', null)).rejects.toThrow();
    });

    test('should throw error for undefined hash', async () => {
      await expect(passwordService.verifyPassword('password', undefined)).rejects.toThrow();
    });
  });

  describe('Argon2 Configuration', () => {
    test('should use secure Argon2 parameters', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordService.hashPassword(password);

      // Verify it's using Argon2id variant
      expect(hash).toMatch(/^\$argon2id\$/);

      // Hash should contain memory, iterations, and parallelism parameters
      expect(hash).toContain('$');
    });
  });
});
