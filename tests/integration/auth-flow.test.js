const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/auth');
const databaseService = require('../../src/services/database');
const passwordService = require('../../src/services/password');
const tokenService = require('../../src/services/token');

// Mock the services and rate limiter
jest.mock('../../src/config/supabase');
jest.mock('../../src/services/password');
jest.mock('../../src/services/token');

// Mock rate limiter to prevent rate limiting in tests
jest.mock('../../src/middleware/rateLimiter', () => ({
  loginLimiter: (req, res, next) => next(),
  validateLimiter: (req, res, next) => next(),
  adminLimiter: (req, res, next) => next()
}));

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Test 1: Complete login flow with valid password', () => {
    test('should successfully login with valid password and return token', async () => {
      // Mock password verification to return true
      passwordService.verifyPassword.mockResolvedValue(true);

      // Mock database to return a password hash
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue(
        '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash'
      );

      // Mock token generation
      tokenService.generateToken.mockResolvedValue({
        token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWEtoken',
        salt: 'mockSaltBase64url'
      });

      // Mock logging
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'MasterPassword123!',
          application_id: 'test-app-001'
        })
        .set('User-Agent', 'Mozilla/5.0 Integration Test');

      // Verify response status and structure
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('salt');
      expect(response.body).toHaveProperty('message', 'Login successful');

      // Verify token and salt are not empty
      expect(response.body.token).toBeTruthy();
      expect(response.body.salt).toBeTruthy();

      // Verify password verification was called correctly
      expect(passwordService.verifyPassword).toHaveBeenCalledWith(
        'MasterPassword123!',
        '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash'
      );

      // Verify token generation was called
      expect(tokenService.generateToken).toHaveBeenCalledWith('test-app-001');

      // Verify successful login was logged
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'login_success',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Integration Test',
        { message: 'User authenticated successfully' }
      );
    });

    test('should return token that can be used for subsequent operations', async () => {
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('mock-hash');

      const mockToken = 'valid-jwe-token-for-reuse';
      const mockSalt = 'valid-salt-for-reuse';

      tokenService.generateToken.mockResolvedValue({
        token: mockToken,
        salt: mockSalt
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'MasterPassword123!',
          application_id: 'test-app'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBe(mockToken);
      expect(loginResponse.body.salt).toBe(mockSalt);
    });
  });

  describe('Test 2: Login with invalid password', () => {
    test('should reject login with incorrect password', async () => {
      // Mock password verification to return false
      passwordService.verifyPassword.mockResolvedValue(false);

      // Mock database to return a password hash
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue(
        '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash'
      );

      // Mock logging
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'WrongPassword123!',
          application_id: 'test-app-001'
        })
        .set('User-Agent', 'Mozilla/5.0 Integration Test');

      // Verify response status and error
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');

      // Verify token was NOT generated
      expect(tokenService.generateToken).not.toHaveBeenCalled();

      // Verify failed login was logged with reason
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'login_failed',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Integration Test',
        { reason: 'Invalid password' }
      );
    });

    test('should reject login when password is not configured', async () => {
      // Mock database to return null (no password configured)
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue(null);
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'AnyPassword123!',
          application_id: 'test-app-001'
        })
        .set('User-Agent', 'Mozilla/5.0 Integration Test');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');

      // Verify logged with correct reason
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'login_failed',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Integration Test',
        { reason: 'Password not configured' }
      );
    });

    test('should not expose sensitive information in error message', async () => {
      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'wrong',
          application_id: 'test-app'
        });

      // Error message should be generic
      expect(response.body.error).toBe('Invalid credentials');
      // Should not say "invalid password" or "password not found" to user
      expect(response.body.error).not.toContain('password');
    });
  });

  describe('Test 3: Token validation with valid token', () => {
    test('should successfully validate a valid token', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        appId: 'test-app-001',
        jti: 'unique-token-id-123',
        exp: currentTime + 3600, // Expires in 1 hour
        iat: currentTime,
        userContext: {
          userId: 'user-123',
          email: 'test@example.com'
        }
      };

      // Mock token validation
      tokenService.validateToken.mockResolvedValue(mockPayload);
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'valid-jwe-token',
          salt: 'valid-salt'
        })
        .set('User-Agent', 'Mozilla/5.0 Integration Test');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('payload');
      expect(response.body).toHaveProperty('sessionId', 'unique-token-id-123');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('permissions');
      expect(response.body).toHaveProperty('message', 'Token is valid');

      // Verify payload contains expected data
      expect(response.body.payload.appId).toBe('test-app-001');
      expect(response.body.payload.jti).toBe('unique-token-id-123');
      expect(response.body.payload.userContext.userId).toBe('user-123');

      // Verify expiresIn is calculated correctly
      expect(response.body.expiresIn).toBeGreaterThan(3595); // ~1 hour
      expect(response.body.expiresIn).toBeLessThanOrEqual(3600);

      // Verify validation was logged
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'token_validation_success',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Integration Test',
        expect.objectContaining({
          jti: 'unique-token-id-123',
          expiresIn: expect.any(Number)
        })
      );
    });

    test('should include correct permissions array', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      tokenService.validateToken.mockResolvedValue({
        appId: 'test-app',
        jti: 'token-id',
        exp: currentTime + 3600,
        iat: currentTime
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'token',
          salt: 'salt'
        });

      expect(response.body.permissions).toEqual([]);
      expect(Array.isArray(response.body.permissions)).toBe(true);
    });
  });

  describe('Test 4: Token validation with expired token', () => {
    test('should reject expired token', async () => {
      // Mock token validation to throw expired error
      tokenService.validateToken.mockRejectedValue(
        new Error('Token expired')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'expired-jwe-token',
          salt: 'salt'
        })
        .set('User-Agent', 'Mozilla/5.0 Integration Test');

      // Verify response
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('error', 'Token expired');

      // Verify validation failure was logged
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'token_validation_failed',
        'unknown',
        expect.any(String),
        'Mozilla/5.0 Integration Test',
        { reason: 'Token expired' }
      );
    });

    test('should handle token that expired recently', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('jwt expired')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'recently-expired-token',
          salt: 'salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('expired');
    });
  });

  describe('Test 5: Token validation with tampered token', () => {
    test('should reject token with tampered header', async () => {
      // Mock token validation to throw invalid signature error
      tokenService.validateToken.mockRejectedValue(
        new Error('JWE decryption failed')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'tampered.jwe.token.with.modified.header',
          salt: 'salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Token validation failed');
    });

    test('should reject token with tampered ciphertext', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('invalid signature')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'token.with.tampered.ciphertext',
          salt: 'salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('invalid');
    });

    test('should reject token with tampered authentication tag', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('Authentication tag verification failed')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'token.with.bad.auth.tag',
          salt: 'salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
    });

    test('should reject token with wrong salt', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('Decryption failed - incorrect key')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'valid-token',
          salt: 'wrong-salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
    });
  });

  describe('Test 6: Logout flow and revocation', () => {
    test('should successfully logout and revoke token', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        appId: 'test-app-001',
        jti: 'token-to-revoke',
        exp: currentTime + 3600
      };

      // Mock token validation (token is valid before logout)
      tokenService.validateToken.mockResolvedValue(mockPayload);

      // Mock token revocation
      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          token: 'valid-token-to-logout',
          salt: 'valid-salt'
        })
        .set('User-Agent', 'Mozilla/5.0 Integration Test');

      // Verify logout response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Logout successful');

      // Verify token was revoked in database
      expect(databaseService.revokeToken).toHaveBeenCalledWith(
        'token-to-revoke',
        expect.any(Date),
        'User logout'
      );

      // Verify logout was logged
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'logout',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Integration Test',
        { jti: 'token-to-revoke' }
      );
    });

    test('should verify revoked token cannot be validated', async () => {
      const currentTime = Math.floor(Date.now() / 1000);

      // First call: token is valid (for logout)
      tokenService.validateToken.mockResolvedValueOnce({
        appId: 'test-app',
        jti: 'token-id',
        exp: currentTime + 3600
      });

      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      // Logout the token
      await request(app)
        .post('/api/auth/logout')
        .send({
          token: 'token',
          salt: 'salt'
        });

      // Second call: token is revoked (for validation)
      tokenService.validateToken.mockRejectedValueOnce(
        new Error('Token has been revoked')
      );

      // Try to validate the revoked token
      const validateResponse = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'token',
          salt: 'salt'
        });

      expect(validateResponse.status).toBe(401);
      expect(validateResponse.body.valid).toBe(false);
      expect(validateResponse.body.error).toContain('revoked');
    });

    test('should handle logout of already revoked token gracefully', async () => {
      // Mock token validation to throw revoked error
      tokenService.validateToken.mockRejectedValue(
        new Error('Token has been revoked')
      );

      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          token: 'already-revoked-token',
          salt: 'salt'
        });

      // Should return success even if already revoked
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token already revoked');
    });

    test('should complete full authentication lifecycle', async () => {
      const currentTime = Math.floor(Date.now() / 1000);

      // Step 1: Login
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      tokenService.generateToken.mockResolvedValue({
        token: 'lifecycle-token',
        salt: 'lifecycle-salt'
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password',
          application_id: 'lifecycle-test-app' // Use unique app ID to avoid rate limit conflicts
        })
        .set('User-Agent', 'Mozilla/5.0 Lifecycle Test');

      expect(loginResponse.status).toBe(200);
      const { token, salt } = loginResponse.body;

      // Step 2: Validate token
      tokenService.validateToken.mockResolvedValueOnce({
        appId: 'test-app',
        jti: 'lifecycle-jti',
        exp: currentTime + 3600,
        iat: currentTime
      });

      const validateResponse = await request(app)
        .post('/api/auth/validate')
        .send({ token, salt });

      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body.valid).toBe(true);

      // Step 3: Logout
      tokenService.validateToken.mockResolvedValueOnce({
        appId: 'test-app',
        jti: 'lifecycle-jti',
        exp: currentTime + 3600
      });
      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({ token, salt });

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      // Step 4: Verify token is now invalid
      tokenService.validateToken.mockRejectedValueOnce(
        new Error('Token has been revoked')
      );

      const finalValidateResponse = await request(app)
        .post('/api/auth/validate')
        .send({ token, salt });

      expect(finalValidateResponse.status).toBe(401);
      expect(finalValidateResponse.body.valid).toBe(false);
    });
  });
});
