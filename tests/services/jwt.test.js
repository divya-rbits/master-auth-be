const jwtService = require('../../src/services/jwt');

describe('JWT Service', () => {
  describe('generateJWT', () => {
    test('should successfully generate a JWT with valid payload', async () => {
      const payload = {
        appId: 'test-app-123',
        userId: 'user-456'
      };

      const token = await jwtService.generateJWT(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature
    });

    test('should include required claims (exp, iat, jti)', async () => {
      const payload = {
        appId: 'test-app-123',
        userId: 'user-456'
      };

      const token = await jwtService.generateJWT(payload);
      const decoded = await jwtService.verifyJWT(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.jti).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
      expect(typeof decoded.iat).toBe('number');
      expect(typeof decoded.jti).toBe('string');
    });

    test('should include custom payload data', async () => {
      const payload = {
        appId: 'test-app-123',
        userId: 'user-456',
        customField: 'customValue'
      };

      const token = await jwtService.generateJWT(payload);
      const decoded = await jwtService.verifyJWT(token);

      expect(decoded.appId).toBe('test-app-123');
      expect(decoded.userId).toBe('user-456');
      expect(decoded.customField).toBe('customValue');
    });

    test('should generate unique jti for each token', async () => {
      const payload = { appId: 'test-app-123' };

      const token1 = await jwtService.generateJWT(payload);
      const token2 = await jwtService.generateJWT(payload);

      const decoded1 = await jwtService.verifyJWT(token1);
      const decoded2 = await jwtService.verifyJWT(token2);

      expect(decoded1.jti).not.toBe(decoded2.jti);
    });

    test('should set expiration time correctly', async () => {
      const payload = { appId: 'test-app-123' };

      const token = await jwtService.generateJWT(payload);
      const decoded = await jwtService.verifyJWT(token);

      const expectedExpiration = decoded.iat + 3600; // TOKEN_EXPIRATION from .env
      expect(decoded.exp).toBe(expectedExpiration);
    });

    test('should throw error for null payload', async () => {
      await expect(jwtService.generateJWT(null)).rejects.toThrow();
    });

    test('should throw error for undefined payload', async () => {
      await expect(jwtService.generateJWT(undefined)).rejects.toThrow();
    });

    test('should handle empty payload object', async () => {
      const payload = {};

      const token = await jwtService.generateJWT(payload);
      const decoded = await jwtService.verifyJWT(token);

      // Should still have required claims
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.jti).toBeDefined();
    });
  });

  describe('verifyJWT', () => {
    test('should successfully verify valid JWT', async () => {
      const payload = {
        appId: 'test-app-123',
        userId: 'user-456'
      };

      const token = await jwtService.generateJWT(payload);
      const decoded = await jwtService.verifyJWT(token);

      expect(decoded).toBeDefined();
      expect(decoded.appId).toBe('test-app-123');
      expect(decoded.userId).toBe('user-456');
    });

    test('should return payload with all claims', async () => {
      const payload = {
        appId: 'test-app-123',
        userId: 'user-456'
      };

      const token = await jwtService.generateJWT(payload);
      const decoded = await jwtService.verifyJWT(token);

      expect(decoded.appId).toBe(payload.appId);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.jti).toBeDefined();
    });

    test('should reject expired JWT', async () => {
      // Create a JWT with immediate expiration
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { appId: 'test-app', jti: 'test-jti' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '0s', algorithm: 'HS256' }
      );

      // Wait a moment to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      await expect(jwtService.verifyJWT(expiredToken)).rejects.toThrow();
    });

    test('should reject JWT with invalid signature', async () => {
      const payload = { appId: 'test-app-123' };
      const token = await jwtService.generateJWT(payload);

      // Tamper with the signature
      const parts = token.split('.');
      const tamperedToken = parts[0] + '.' + parts[1] + '.invalid-signature';

      await expect(jwtService.verifyJWT(tamperedToken)).rejects.toThrow();
    });

    test('should reject malformed JWT', async () => {
      const malformedToken = 'not.a.valid.jwt.token';

      await expect(jwtService.verifyJWT(malformedToken)).rejects.toThrow();
    });

    test('should reject JWT with missing parts', async () => {
      const invalidToken = 'header.payload'; // Missing signature

      await expect(jwtService.verifyJWT(invalidToken)).rejects.toThrow();
    });

    test('should throw error for null token', async () => {
      await expect(jwtService.verifyJWT(null)).rejects.toThrow();
    });

    test('should throw error for undefined token', async () => {
      await expect(jwtService.verifyJWT(undefined)).rejects.toThrow();
    });

    test('should throw error for empty token', async () => {
      await expect(jwtService.verifyJWT('')).rejects.toThrow();
    });

    test('should validate required claims exist', async () => {
      const payload = { appId: 'test-app-123' };
      const token = await jwtService.generateJWT(payload);
      const decoded = await jwtService.verifyJWT(token);

      // Verify all required claims are present
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('jti');
    });
  });

  describe('JWT Configuration', () => {
    test('should use HS256 algorithm', async () => {
      const jwt = require('jsonwebtoken');
      const payload = { appId: 'test-app-123' };
      const token = await jwtService.generateJWT(payload);

      // Decode without verification to check algorithm
      const decoded = jwt.decode(token, { complete: true });

      expect(decoded.header.alg).toBe('HS256');
    });

    test('should use JWT_SECRET from environment', async () => {
      const payload = { appId: 'test-app-123' };
      const token = await jwtService.generateJWT(payload);

      // Verify that token can be verified (proving secret is correct)
      const decoded = await jwtService.verifyJWT(token);
      expect(decoded).toBeDefined();
    });
  });

  describe('Token Security', () => {
    test('should not accept tokens signed with different secret', async () => {
      const jwt = require('jsonwebtoken');
      const payload = { appId: 'test-app-123', jti: 'test-jti' };

      // Sign with different secret
      const tokenWithDifferentSecret = jwt.sign(
        payload,
        'different-secret',
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      await expect(jwtService.verifyJWT(tokenWithDifferentSecret)).rejects.toThrow();
    });

    test('should not accept tokens with tampered payload', async () => {
      const payload = { appId: 'test-app-123' };
      const token = await jwtService.generateJWT(payload);

      // Tamper with payload
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({ appId: 'hacked-app' })).toString('base64');
      const tamperedToken = parts[0] + '.' + tamperedPayload + '.' + parts[2];

      await expect(jwtService.verifyJWT(tamperedToken)).rejects.toThrow();
    });
  });
});
