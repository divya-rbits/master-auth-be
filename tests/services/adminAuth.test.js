const adminAuth = require('../../src/services/adminAuth');
const jwt = require('jsonwebtoken');

// Mock environment variables
const originalEnv = process.env;

describe('Admin Authentication Service', () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env = {
      ...originalEnv,
      ADMIN_USERNAME: 'testadmin',
      ADMIN_PASSWORD: 'testpassword123',
      ADMIN_JWT_SECRET: 'test-admin-jwt-secret-key',
      ADMIN_SESSION_TIMEOUT: '1800'
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('verifyCredentials()', () => {
    describe('Success Cases', () => {
      test('should return true for valid username and password', () => {
        const result = adminAuth.verifyCredentials('testadmin', 'testpassword123');
        expect(result).toBe(true);
      });

      test('should be case-sensitive for username', () => {
        const result = adminAuth.verifyCredentials('TestAdmin', 'testpassword123');
        expect(result).toBe(false);
      });

      test('should be case-sensitive for password', () => {
        const result = adminAuth.verifyCredentials('testadmin', 'TestPassword123');
        expect(result).toBe(false);
      });
    });

    describe('Failure Cases', () => {
      test('should return false for invalid username', () => {
        const result = adminAuth.verifyCredentials('wronguser', 'testpassword123');
        expect(result).toBe(false);
      });

      test('should return false for invalid password', () => {
        const result = adminAuth.verifyCredentials('testadmin', 'wrongpassword');
        expect(result).toBe(false);
      });

      test('should return false for both invalid credentials', () => {
        const result = adminAuth.verifyCredentials('wronguser', 'wrongpassword');
        expect(result).toBe(false);
      });

      test('should return false for empty username', () => {
        const result = adminAuth.verifyCredentials('', 'testpassword123');
        expect(result).toBe(false);
      });

      test('should return false for empty password', () => {
        const result = adminAuth.verifyCredentials('testadmin', '');
        expect(result).toBe(false);
      });

      test('should return false for null username', () => {
        const result = adminAuth.verifyCredentials(null, 'testpassword123');
        expect(result).toBe(false);
      });

      test('should return false for null password', () => {
        const result = adminAuth.verifyCredentials('testadmin', null);
        expect(result).toBe(false);
      });

      test('should return false for undefined username', () => {
        const result = adminAuth.verifyCredentials(undefined, 'testpassword123');
        expect(result).toBe(false);
      });

      test('should return false for undefined password', () => {
        const result = adminAuth.verifyCredentials('testadmin', undefined);
        expect(result).toBe(false);
      });

      test('should return false when ADMIN_USERNAME env var is missing', () => {
        delete process.env.ADMIN_USERNAME;
        const result = adminAuth.verifyCredentials('testadmin', 'testpassword123');
        expect(result).toBe(false);
      });

      test('should return false when ADMIN_PASSWORD env var is missing', () => {
        delete process.env.ADMIN_PASSWORD;
        const result = adminAuth.verifyCredentials('testadmin', 'testpassword123');
        expect(result).toBe(false);
      });
    });
  });

  describe('generateAdminToken()', () => {
    describe('Success Cases', () => {
      test('should return a valid JWT token string', () => {
        const token = adminAuth.generateAdminToken('testadmin');

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
      });

      test('should include username in token payload', () => {
        const token = adminAuth.generateAdminToken('testadmin');
        const decoded = jwt.decode(token);

        expect(decoded.username).toBe('testadmin');
      });

      test('should include role as admin in token payload', () => {
        const token = adminAuth.generateAdminToken('testadmin');
        const decoded = jwt.decode(token);

        expect(decoded.role).toBe('admin');
      });

      test('should include expiration in token', () => {
        const token = adminAuth.generateAdminToken('testadmin');
        const decoded = jwt.decode(token);

        expect(decoded.exp).toBeDefined();
        expect(typeof decoded.exp).toBe('number');
        expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      });

      test('should include issued at timestamp in token', () => {
        const token = adminAuth.generateAdminToken('testadmin');
        const decoded = jwt.decode(token);

        expect(decoded.iat).toBeDefined();
        expect(typeof decoded.iat).toBe('number');
      });

      test('should set expiration to ADMIN_SESSION_TIMEOUT seconds', () => {
        const token = adminAuth.generateAdminToken('testadmin');
        const decoded = jwt.decode(token);

        const expectedExpiration = decoded.iat + 1800;
        expect(decoded.exp).toBe(expectedExpiration);
      });

      test('should be verifiable with ADMIN_JWT_SECRET', () => {
        const token = adminAuth.generateAdminToken('testadmin');

        expect(() => {
          jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        }).not.toThrow();
      });

      test('should generate different tokens for same username (due to iat)', async () => {
        const token1 = adminAuth.generateAdminToken('testadmin');

        // Wait 1000ms to ensure different iat (iat is in seconds)
        await new Promise(resolve => setTimeout(resolve, 1000));

        const token2 = adminAuth.generateAdminToken('testadmin');

        expect(token1).not.toBe(token2);
      });
    });

    describe('Failure Cases', () => {
      test('should throw error for empty username', () => {
        expect(() => adminAuth.generateAdminToken('')).toThrow('username is required');
      });

      test('should throw error for null username', () => {
        expect(() => adminAuth.generateAdminToken(null)).toThrow('username is required');
      });

      test('should throw error for undefined username', () => {
        expect(() => adminAuth.generateAdminToken(undefined)).toThrow('username is required');
      });

      test('should throw error when ADMIN_JWT_SECRET is missing', () => {
        delete process.env.ADMIN_JWT_SECRET;
        expect(() => adminAuth.generateAdminToken('testadmin')).toThrow('ADMIN_JWT_SECRET not configured');
      });

      test('should throw error when ADMIN_SESSION_TIMEOUT is missing', () => {
        delete process.env.ADMIN_SESSION_TIMEOUT;
        expect(() => adminAuth.generateAdminToken('testadmin')).toThrow('ADMIN_SESSION_TIMEOUT not configured');
      });

      test('should throw error when ADMIN_SESSION_TIMEOUT is not a number', () => {
        process.env.ADMIN_SESSION_TIMEOUT = 'invalid';
        expect(() => adminAuth.generateAdminToken('testadmin')).toThrow('ADMIN_SESSION_TIMEOUT must be a number');
      });
    });
  });

  describe('verifyAdminToken()', () => {
    describe('Success Cases', () => {
      test('should successfully verify a valid token', () => {
        const token = adminAuth.generateAdminToken('testadmin');
        const payload = adminAuth.verifyAdminToken(token);

        expect(payload).toBeDefined();
        expect(payload.username).toBe('testadmin');
        expect(payload.role).toBe('admin');
      });

      test('should return full payload including iat and exp', () => {
        const token = adminAuth.generateAdminToken('testadmin');
        const payload = adminAuth.verifyAdminToken(token);

        expect(payload.iat).toBeDefined();
        expect(payload.exp).toBeDefined();
        expect(typeof payload.iat).toBe('number');
        expect(typeof payload.exp).toBe('number');
      });

      test('should verify token signed with correct secret', () => {
        const token = jwt.sign(
          { username: 'testadmin', role: 'admin' },
          process.env.ADMIN_JWT_SECRET,
          { expiresIn: '30m' }
        );

        const payload = adminAuth.verifyAdminToken(token);
        expect(payload.username).toBe('testadmin');
      });
    });

    describe('Failure Cases', () => {
      test('should throw error for expired token', () => {
        // Create an expired token
        const expiredToken = jwt.sign(
          { username: 'testadmin', role: 'admin' },
          process.env.ADMIN_JWT_SECRET,
          { expiresIn: '-1s' } // Already expired
        );

        expect(() => adminAuth.verifyAdminToken(expiredToken)).toThrow('expired');
      });

      test('should throw error for token with invalid signature', () => {
        const token = jwt.sign(
          { username: 'testadmin', role: 'admin' },
          'wrong-secret',
          { expiresIn: '30m' }
        );

        expect(() => adminAuth.verifyAdminToken(token)).toThrow();
      });

      test('should throw error for malformed token', () => {
        expect(() => adminAuth.verifyAdminToken('not.a.valid.jwt')).toThrow();
      });

      test('should throw error for empty token', () => {
        expect(() => adminAuth.verifyAdminToken('')).toThrow('token is required');
      });

      test('should throw error for null token', () => {
        expect(() => adminAuth.verifyAdminToken(null)).toThrow('token is required');
      });

      test('should throw error for undefined token', () => {
        expect(() => adminAuth.verifyAdminToken(undefined)).toThrow('token is required');
      });

      test('should throw error when ADMIN_JWT_SECRET is missing', () => {
        const token = adminAuth.generateAdminToken('testadmin');
        delete process.env.ADMIN_JWT_SECRET;

        expect(() => adminAuth.verifyAdminToken(token)).toThrow('ADMIN_JWT_SECRET not configured');
      });

      test('should reject token signed with main JWT_SECRET', () => {
        // Simulate token from main auth system
        const mainToken = jwt.sign(
          { username: 'testadmin', role: 'admin' },
          'different-jwt-secret',
          { expiresIn: '30m' }
        );

        expect(() => adminAuth.verifyAdminToken(mainToken)).toThrow();
      });
    });
  });

  describe('Integration Tests', () => {
    test('should complete full auth flow: verify credentials -> generate token -> verify token', () => {
      // Step 1: Verify credentials
      const isValid = adminAuth.verifyCredentials('testadmin', 'testpassword123');
      expect(isValid).toBe(true);

      // Step 2: Generate token
      const token = adminAuth.generateAdminToken('testadmin');
      expect(token).toBeDefined();

      // Step 3: Verify token
      const payload = adminAuth.verifyAdminToken(token);
      expect(payload.username).toBe('testadmin');
      expect(payload.role).toBe('admin');
    });

    test('should fail auth flow with invalid credentials', () => {
      // Step 1: Verify credentials (should fail)
      const isValid = adminAuth.verifyCredentials('wronguser', 'wrongpass');
      expect(isValid).toBe(false);

      // Should not proceed to generate token
    });

    test('should handle token expiration correctly', () => {
      // Generate token with very short expiration
      process.env.ADMIN_SESSION_TIMEOUT = '0';

      const token = adminAuth.generateAdminToken('testadmin');

      // Token should be expired immediately
      expect(() => adminAuth.verifyAdminToken(token)).toThrow('expired');
    });
  });
});
