const tokenService = require('../../src/services/token');
const jwtService = require('../../src/services/jwt');
const jweService = require('../../src/services/jwe');
const kdfService = require('../../src/services/kdf');
const supabase = require('../../src/config/supabase');

// Mock Supabase
jest.mock('../../src/config/supabase', () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    }))
  }))
}));

describe('Token Service', () => {
  const validAppId = 'test-app-123';
  const validUserContext = { userId: 'user-456', role: 'admin' };
  const masterPassword = process.env.MASTER_PASSWORD || 'test-master-password';

  beforeEach(() => {
    // Set master password in environment if not set
    if (!process.env.MASTER_PASSWORD) {
      process.env.MASTER_PASSWORD = 'test-master-password';
    }
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate valid JWE token with appId and userContext', async () => {
      const result = await tokenService.generateToken(validAppId, validUserContext);

      // Check return structure
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('salt');
      expect(typeof result.token).toBe('string');
      expect(typeof result.salt).toBe('string');

      // Check JWE format (5 parts separated by dots)
      const parts = result.token.split('.');
      expect(parts).toHaveLength(5);
    });

    it('should create JWT with correct claims', async () => {
      const result = await tokenService.generateToken(validAppId, validUserContext);

      // Decode and verify the token to check claims
      const saltBuffer = kdfService.decodeSalt(result.salt);
      const cek = await kdfService.deriveKey(masterPassword, saltBuffer);
      const jwt = await jweService.decryptJWE(result.token, cek);
      const payload = await jwtService.verifyJWT(jwt);

      // Check standard claims
      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('jti');
      expect(typeof payload.exp).toBe('number');
      expect(typeof payload.iat).toBe('number');
      expect(typeof payload.jti).toBe('string');

      // Check custom claims
      expect(payload.appId).toBe(validAppId);
      expect(payload.userContext).toEqual(validUserContext);
    });

    it('should generate unique tokens on multiple calls', async () => {
      const result1 = await tokenService.generateToken(validAppId, validUserContext);
      const result2 = await tokenService.generateToken(validAppId, validUserContext);

      // Tokens should be different (different salts and JTIs)
      expect(result1.token).not.toBe(result2.token);
      expect(result1.salt).not.toBe(result2.salt);
    });

    it('should work without userContext (optional parameter)', async () => {
      const result = await tokenService.generateToken(validAppId);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('salt');

      // Decode and verify
      const saltBuffer = kdfService.decodeSalt(result.salt);
      const cek = await kdfService.deriveKey(masterPassword, saltBuffer);
      const jwt = await jweService.decryptJWE(result.token, cek);
      const payload = await jwtService.verifyJWT(jwt);

      expect(payload.appId).toBe(validAppId);
      expect(payload.userContext).toBeUndefined();
    });

    it('should throw error if appId is missing', async () => {
      await expect(tokenService.generateToken()).rejects.toThrow('appId is required');
    });

    it('should throw error if appId is empty string', async () => {
      await expect(tokenService.generateToken('')).rejects.toThrow('appId is required');
    });

    it('should throw error if appId is not a string', async () => {
      await expect(tokenService.generateToken(123)).rejects.toThrow('appId must be a string');
    });

    it('should throw error if userContext is not an object', async () => {
      await expect(tokenService.generateToken(validAppId, 'invalid')).rejects.toThrow('userContext must be an object');
    });

    it('should throw error if master password not set', async () => {
      const originalPassword = process.env.MASTER_PASSWORD;
      delete process.env.MASTER_PASSWORD;

      await expect(tokenService.generateToken(validAppId)).rejects.toThrow('MASTER_PASSWORD not configured');

      process.env.MASTER_PASSWORD = originalPassword;
    });
  });

  describe('validateToken', () => {
    let validToken;
    let validSalt;

    beforeEach(async () => {
      // Generate a valid token for testing
      const result = await tokenService.generateToken(validAppId, validUserContext);
      validToken = result.token;
      validSalt = result.salt;

      // Mock revocation check to return no revoked token
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });
    });

    it('should validate and decrypt valid JWE token', async () => {
      const payload = await tokenService.validateToken(validToken, validSalt);

      expect(payload).toHaveProperty('appId', validAppId);
      expect(payload).toHaveProperty('userContext');
      expect(payload.userContext).toEqual(validUserContext);
      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('jti');
    });

    it('should return payload with all claims', async () => {
      const payload = await tokenService.validateToken(validToken, validSalt);

      // Standard JWT claims
      expect(typeof payload.exp).toBe('number');
      expect(typeof payload.iat).toBe('number');
      expect(typeof payload.jti).toBe('string');

      // Custom claims
      expect(payload.appId).toBe(validAppId);
      expect(payload.userContext).toEqual(validUserContext);

      // Verify exp is in the future
      const currentTime = Math.floor(Date.now() / 1000);
      expect(payload.exp).toBeGreaterThan(currentTime);
    });

    it('should throw error for expired token', async () => {
      // Mock JWT service to throw expired error
      const originalVerify = jwtService.verifyJWT;
      jwtService.verifyJWT = jest.fn().mockRejectedValue(new Error('Token has expired'));

      await expect(tokenService.validateToken(validToken, validSalt)).rejects.toThrow('Token has expired');

      jwtService.verifyJWT = originalVerify;
    });

    it('should throw error for invalid JWE format', async () => {
      const invalidToken = 'invalid.jwe.format';

      await expect(tokenService.validateToken(invalidToken, validSalt)).rejects.toThrow();
    });

    it('should throw error for tampered token', async () => {
      // Tamper with the token by modifying a character
      const tamperedToken = validToken.slice(0, -10) + 'X' + validToken.slice(-9);

      await expect(tokenService.validateToken(tamperedToken, validSalt)).rejects.toThrow();
    });

    it('should throw error for wrong salt', async () => {
      // Generate a different salt
      const wrongSalt = kdfService.encodeSalt(await kdfService.generateSalt());

      await expect(tokenService.validateToken(validToken, wrongSalt)).rejects.toThrow();
    });

    it('should throw error if token is missing', async () => {
      await expect(tokenService.validateToken()).rejects.toThrow('token is required');
    });

    it('should throw error if token is empty string', async () => {
      await expect(tokenService.validateToken('', validSalt)).rejects.toThrow('token is required');
    });

    it('should throw error if salt is missing', async () => {
      await expect(tokenService.validateToken(validToken)).rejects.toThrow('salt is required');
    });

    it('should throw error if salt is empty string', async () => {
      await expect(tokenService.validateToken(validToken, '')).rejects.toThrow('salt is required');
    });

    it('should throw error if token is not a string', async () => {
      await expect(tokenService.validateToken(123, validSalt)).rejects.toThrow('token must be a string');
    });

    it('should throw error if salt is not a string', async () => {
      await expect(tokenService.validateToken(validToken, 123)).rejects.toThrow('salt must be a string');
    });

    it('should check revocation status in database', async () => {
      await tokenService.validateToken(validToken, validSalt);

      // Verify Supabase was called to check revocation
      expect(supabase.from).toHaveBeenCalledWith('revoked_tokens');
    });

    it('should throw error if token is revoked', async () => {
      // Decode token to get JTI
      const saltBuffer = kdfService.decodeSalt(validSalt);
      const cek = await kdfService.deriveKey(masterPassword, saltBuffer);
      const jwt = await jweService.decryptJWE(validToken, cek);
      const payload = await jwtService.verifyJWT(jwt);

      // Mock revocation check to return revoked token
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { jti: payload.jti, revoked_at: new Date().toISOString() },
              error: null
            })
          })
        })
      });

      await expect(tokenService.validateToken(validToken, validSalt)).rejects.toThrow('Token has been revoked');
    });

    it('should throw error if master password not set', async () => {
      const originalPassword = process.env.MASTER_PASSWORD;
      delete process.env.MASTER_PASSWORD;

      await expect(tokenService.validateToken(validToken, validSalt)).rejects.toThrow('MASTER_PASSWORD not configured');

      process.env.MASTER_PASSWORD = originalPassword;
    });
  });

  describe('End-to-End Flow', () => {
    beforeEach(() => {
      // Mock revocation check to return no revoked token
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });
    });

    it('should complete full cycle: generate → validate', async () => {
      // Generate token
      const { token, salt } = await tokenService.generateToken(validAppId, validUserContext);

      // Validate token
      const payload = await tokenService.validateToken(token, salt);

      // Verify payload matches original input
      expect(payload.appId).toBe(validAppId);
      expect(payload.userContext).toEqual(validUserContext);
    });

    it('should work with different appIds', async () => {
      const appId1 = 'app-one';
      const appId2 = 'app-two';

      const result1 = await tokenService.generateToken(appId1, { user: 'john' });
      const result2 = await tokenService.generateToken(appId2, { user: 'jane' });

      const payload1 = await tokenService.validateToken(result1.token, result1.salt);
      const payload2 = await tokenService.validateToken(result2.token, result2.salt);

      expect(payload1.appId).toBe(appId1);
      expect(payload2.appId).toBe(appId2);
      expect(payload1.userContext.user).toBe('john');
      expect(payload2.userContext.user).toBe('jane');
    });

    it('should fail validation with mismatched token and salt', async () => {
      const result1 = await tokenService.generateToken('app1', { user: 'alice' });
      const result2 = await tokenService.generateToken('app2', { user: 'bob' });

      // Try to validate token1 with salt2 (should fail)
      await expect(
        tokenService.validateToken(result1.token, result2.salt)
      ).rejects.toThrow();
    });
  });
});
