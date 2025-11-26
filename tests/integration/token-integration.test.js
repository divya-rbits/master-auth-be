const tokenService = require('../../src/services/token');
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

describe('Token Service - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock revocation check to return no revoked token
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle authentication flow for a web application', async () => {
      const appId = 'web-app-12345';
      const userContext = {
        userId: 'user-abc-123',
        email: 'john.doe@example.com',
        role: 'admin',
        permissions: ['read', 'write', 'delete']
      };

      // Step 1: Generate token (during login)
      const { token, salt } = await tokenService.generateToken(appId, userContext);

      expect(token).toBeDefined();
      expect(salt).toBeDefined();

      // Step 2: Validate token (during API request)
      const payload = await tokenService.validateToken(token, salt);

      expect(payload.appId).toBe(appId);
      expect(payload.userContext.userId).toBe('user-abc-123');
      expect(payload.userContext.email).toBe('john.doe@example.com');
      expect(payload.userContext.role).toBe('admin');
      expect(payload.userContext.permissions).toEqual(['read', 'write', 'delete']);
    });

    it('should handle multiple applications with different contexts', async () => {
      const apps = [
        {
          appId: 'mobile-app',
          userContext: { platform: 'iOS', version: '1.0.0', deviceId: 'abc123' }
        },
        {
          appId: 'desktop-app',
          userContext: { platform: 'Windows', version: '2.5.1', machineId: 'xyz789' }
        },
        {
          appId: 'api-service',
          userContext: { serviceAccount: true, scopes: ['api:read', 'api:write'] }
        }
      ];

      const tokens = [];

      // Generate tokens for all apps
      for (const app of apps) {
        const result = await tokenService.generateToken(app.appId, app.userContext);
        tokens.push({ ...result, appId: app.appId });
      }

      // Validate all tokens
      for (let i = 0; i < tokens.length; i++) {
        const payload = await tokenService.validateToken(tokens[i].token, tokens[i].salt);
        expect(payload.appId).toBe(apps[i].appId);
        expect(payload.userContext).toEqual(apps[i].userContext);
      }
    });

    it('should handle token without userContext (service-to-service)', async () => {
      const appId = 'internal-service';

      // Generate token without user context
      const { token, salt } = await tokenService.generateToken(appId);

      // Validate token
      const payload = await tokenService.validateToken(token, salt);

      expect(payload.appId).toBe(appId);
      expect(payload.userContext).toBeUndefined();
    });

    it('should handle complex nested userContext', async () => {
      const appId = 'complex-app';
      const userContext = {
        user: {
          id: 123,
          profile: {
            name: 'Jane Doe',
            preferences: {
              theme: 'dark',
              language: 'en-US'
            }
          }
        },
        session: {
          id: 'session-xyz',
          loginTime: new Date().toISOString(),
          ipAddress: '192.168.1.1'
        },
        metadata: {
          tags: ['premium', 'verified'],
          customFields: { department: 'Engineering' }
        }
      };

      const { token, salt } = await tokenService.generateToken(appId, userContext);
      const payload = await tokenService.validateToken(token, salt);

      expect(payload.userContext).toEqual(userContext);
      expect(payload.userContext.user.profile.name).toBe('Jane Doe');
      expect(payload.userContext.session.id).toBe('session-xyz');
      expect(payload.userContext.metadata.tags).toEqual(['premium', 'verified']);
    });
  });

  describe('Security Scenarios', () => {
    it('should prevent token reuse with different salts', async () => {
      const appId = 'test-app';
      const userContext = { userId: 'user-123' };

      // Generate two different tokens
      const result1 = await tokenService.generateToken(appId, userContext);
      const result2 = await tokenService.generateToken(appId, userContext);

      // Try to validate token1 with salt2 (should fail)
      await expect(
        tokenService.validateToken(result1.token, result2.salt)
      ).rejects.toThrow();

      // Try to validate token2 with salt1 (should fail)
      await expect(
        tokenService.validateToken(result2.token, result1.salt)
      ).rejects.toThrow();
    });

    it('should detect token tampering', async () => {
      const appId = 'test-app';
      const { token, salt } = await tokenService.generateToken(appId, { userId: 'user-123' });

      // Tamper with different parts of the token
      const parts = token.split('.');

      // Tamper with header
      const tamperedHeader = parts[0].slice(0, -5) + 'XXXXX';
      const tamperedToken1 = [tamperedHeader, ...parts.slice(1)].join('.');
      await expect(tokenService.validateToken(tamperedToken1, salt)).rejects.toThrow();

      // Tamper with ciphertext
      const tamperedCiphertext = parts[3].slice(0, -5) + 'YYYYY';
      const tamperedToken2 = [...parts.slice(0, 3), tamperedCiphertext, parts[4]].join('.');
      await expect(tokenService.validateToken(tamperedToken2, salt)).rejects.toThrow();

      // Tamper with auth tag
      const tamperedAuthTag = parts[4].slice(0, -5) + 'ZZZZZ';
      const tamperedToken3 = [...parts.slice(0, 4), tamperedAuthTag].join('.');
      await expect(tokenService.validateToken(tamperedToken3, salt)).rejects.toThrow();
    });

    it('should handle revoked tokens correctly', async () => {
      const appId = 'test-app';
      const { token, salt } = await tokenService.generateToken(appId, { userId: 'user-123' });

      // First validation should succeed
      await tokenService.validateToken(token, salt);

      // Mock token as revoked
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { jti: 'some-jti', revoked_at: new Date().toISOString() },
              error: null
            })
          })
        })
      });

      // Second validation should fail
      await expect(tokenService.validateToken(token, salt)).rejects.toThrow('Token has been revoked');
    });
  });

  describe('Performance Tests', () => {
    it('should generate tokens efficiently in batch', async () => {
      const startTime = Date.now();
      const batchSize = 10;

      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        promises.push(tokenService.generateToken(`app-${i}`, { userId: `user-${i}` }));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(batchSize);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all tokens are unique
      const tokens = results.map(r => r.token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(batchSize);
    });

    it('should validate tokens efficiently in batch', async () => {
      // Generate tokens first
      const tokens = [];
      for (let i = 0; i < 10; i++) {
        const result = await tokenService.generateToken(`app-${i}`, { userId: `user-${i}` });
        tokens.push(result);
      }

      const startTime = Date.now();

      // Validate all tokens
      const validationPromises = tokens.map(({ token, salt }) =>
        tokenService.validateToken(token, salt)
      );

      const payloads = await Promise.all(validationPromises);
      const endTime = Date.now();

      expect(payloads).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all payloads are correct
      payloads.forEach((payload, i) => {
        expect(payload.appId).toBe(`app-${i}`);
        expect(payload.userContext.userId).toBe(`user-${i}`);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should handle database connection errors gracefully', async () => {
      const appId = 'test-app';
      const { token, salt } = await tokenService.generateToken(appId, { userId: 'user-123' });

      // Mock database error
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Database connection failed'))
          })
        })
      });

      // Should fail closed (reject the token)
      await expect(tokenService.validateToken(token, salt)).rejects.toThrow('Revocation check failed');
    });

    it('should provide clear error messages for common issues', async () => {
      // Missing appId
      await expect(tokenService.generateToken()).rejects.toThrow('appId is required');

      // Empty token
      await expect(tokenService.validateToken('', 'salt')).rejects.toThrow('token is required');

      // Missing salt
      await expect(tokenService.validateToken('token')).rejects.toThrow('salt is required');

      // Invalid JWE format
      await expect(tokenService.validateToken('invalid-token', 'valid-salt')).rejects.toThrow();
    });
  });

  describe('Token Lifecycle', () => {
    it('should maintain token integrity throughout its lifecycle', async () => {
      const appId = 'lifecycle-test-app';
      const originalContext = {
        userId: 'user-789',
        email: 'test@example.com',
        timestamp: Date.now()
      };

      // 1. Generation
      const { token, salt } = await tokenService.generateToken(appId, originalContext);
      expect(token).toBeTruthy();
      expect(salt).toBeTruthy();

      // 2. First validation (immediate)
      const payload1 = await tokenService.validateToken(token, salt);
      expect(payload1.userContext).toEqual(originalContext);

      // 3. Second validation (simulating later use)
      await new Promise(resolve => setTimeout(resolve, 100));
      const payload2 = await tokenService.validateToken(token, salt);
      expect(payload2.userContext).toEqual(originalContext);

      // 4. Verify token hasn't changed
      expect(payload1.jti).toBe(payload2.jti);
      expect(payload1.exp).toBe(payload2.exp);
      expect(payload1.iat).toBe(payload2.iat);
    });
  });
});
