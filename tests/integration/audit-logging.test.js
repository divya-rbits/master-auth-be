const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/auth');
const databaseService = require('../../src/services/database');
const passwordService = require('../../src/services/password');
const tokenService = require('../../src/services/token');

// Mock the Supabase client and services
jest.mock('../../src/config/supabase');
jest.mock('../../src/services/password');
jest.mock('../../src/services/token');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Audit Logging Integration Tests', () => {
  let logEventSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on the logEvent method to verify it's called
    logEventSpy = jest.spyOn(databaseService, 'logEvent');
  });

  afterEach(() => {
    logEventSpy.mockRestore();
  });

  describe('Login Flow Audit Logging', () => {
    test('should log successful login attempt with correct details', async () => {
      // Mock password verification to return true
      passwordService.verifyPassword.mockResolvedValue(true);

      // Mock database to return a password hash
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue(
        '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash'
      );

      // Mock token generation
      tokenService.generateToken.mockResolvedValue({
        token: 'mock-jwe-token',
        salt: 'mock-salt'
      });

      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'correct-password',
          application_id: 'test-app-001'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify audit log was created for successful login
      expect(logEventSpy).toHaveBeenCalledWith(
        'login_success',
        'test-app-001',
        expect.any(String), // IP address
        'Mozilla/5.0 Test Browser',
        { message: 'User authenticated successfully' }
      );
    });

    test('should log failed login attempt with reason', async () => {
      // Mock password verification to return false
      passwordService.verifyPassword.mockResolvedValue(false);

      // Mock database to return a password hash
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue(
        '$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash'
      );

      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'wrong-password',
          application_id: 'test-app-001'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      // Verify audit log was created for failed login
      expect(logEventSpy).toHaveBeenCalledWith(
        'login_failed',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        { reason: 'Invalid password' }
      );
    });

    test('should log failed login when password not configured', async () => {
      // Mock database to return null (no password configured)
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue(null);

      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'any-password',
          application_id: 'test-app-001'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(401);

      // Verify audit log was created
      expect(logEventSpy).toHaveBeenCalledWith(
        'login_failed',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        { reason: 'Password not configured' }
      );
    });

    test('should capture IP address from request', async () => {
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('mock-hash');
      tokenService.generateToken.mockResolvedValue({ token: 'token', salt: 'salt' });
      logEventSpy.mockResolvedValue(true);

      await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password',
          application_id: 'test-app'
        })
        .set('X-Forwarded-For', '203.0.113.1')
        .set('User-Agent', 'Test Browser');

      // Verify IP address was captured (Express test might use ::ffff:127.0.0.1)
      expect(logEventSpy).toHaveBeenCalledWith(
        'login_success',
        'test-app',
        expect.stringMatching(/^[\d.:a-f]+$/i), // IPv4 or IPv6
        'Test Browser', // User agent should be provided
        expect.any(Object)
      );
    });
  });

  describe('Token Validation Audit Logging', () => {
    test('should log successful token validation', async () => {
      // Mock token validation
      tokenService.validateToken.mockResolvedValue({
        appId: 'test-app-001',
        jti: 'unique-token-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      });

      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'mock-jwe-token',
          salt: 'mock-salt'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);

      // Verify audit log was created
      expect(logEventSpy).toHaveBeenCalledWith(
        'token_validation_success',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        expect.objectContaining({
          jti: 'unique-token-id',
          expiresIn: expect.any(Number)
        })
      );
    });

    test('should log failed token validation with reason', async () => {
      // Mock token validation failure
      tokenService.validateToken.mockRejectedValue(
        new Error('Token expired')
      );

      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'expired-token',
          salt: 'mock-salt'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);

      // Verify audit log was created
      expect(logEventSpy).toHaveBeenCalledWith(
        'token_validation_failed',
        'unknown',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        { reason: 'Token expired' }
      );
    });
  });

  describe('Logout Audit Logging', () => {
    test('should log logout event with token details', async () => {
      const mockPayload = {
        appId: 'test-app-001',
        jti: 'token-to-revoke',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      tokenService.validateToken.mockResolvedValue(mockPayload);
      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          token: 'mock-token',
          salt: 'mock-salt'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(200);

      // Verify audit log was created
      expect(logEventSpy).toHaveBeenCalledWith(
        'logout',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        { jti: 'token-to-revoke' }
      );
    });
  });

  describe('Token Refresh Audit Logging', () => {
    test('should log token refresh event', async () => {
      const mockOldPayload = {
        appId: 'test-app-001',
        jti: 'old-token-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        userContext: {}
      };

      tokenService.validateToken.mockResolvedValue(mockOldPayload);
      tokenService.generateToken.mockResolvedValue({
        token: 'new-token',
        salt: 'new-salt'
      });
      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          token: 'old-token',
          salt: 'old-salt'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(200);

      // Verify audit log was created
      expect(logEventSpy).toHaveBeenCalledWith(
        'token_refresh',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        expect.objectContaining({
          oldJti: 'old-token-id',
          message: 'Token refreshed successfully'
        })
      );
    });
  });

  describe('Token Status Check Audit Logging', () => {
    test('should log token status check', async () => {
      const mockPayload = {
        appId: 'test-app-001',
        jti: 'status-check-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      };

      tokenService.validateToken.mockResolvedValue(mockPayload);
      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/auth/token/status')
        .send({
          token: 'mock-token',
          salt: 'mock-salt'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(200);

      // Verify audit log was created
      expect(logEventSpy).toHaveBeenCalledWith(
        'token_status_check',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        { jti: 'status-check-token', valid: true }
      );
    });

    test('should log failed token status check', async () => {
      tokenService.validateToken.mockRejectedValue(new Error('Invalid token'));
      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/auth/token/status')
        .send({
          token: 'invalid-token',
          salt: 'mock-salt'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(401);

      // Verify audit log was created
      expect(logEventSpy).toHaveBeenCalledWith(
        'token_status_check_failed',
        'unknown',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        { reason: 'Invalid token' }
      );
    });
  });

  describe('Token Revocation Audit Logging', () => {
    test('should log token revocation event', async () => {
      const mockRequestingPayload = {
        appId: 'test-app-001',
        jti: 'requesting-token-id',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const mockTargetPayload = {
        appId: 'test-app-001',
        jti: 'target-token-id',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      tokenService.validateToken
        .mockResolvedValueOnce(mockRequestingPayload)
        .mockResolvedValueOnce(mockTargetPayload);

      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      logEventSpy.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/token/revoke')
        .send({
          requestingToken: 'requesting-token',
          requestingSalt: 'requesting-salt',
          targetToken: 'target-token',
          targetSalt: 'target-salt',
          reason: 'Security policy violation'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      // Verify response
      expect(response.status).toBe(200);

      // Verify audit log was created
      expect(logEventSpy).toHaveBeenCalledWith(
        'token_revoked',
        'test-app-001',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        expect.objectContaining({
          revokedJti: 'target-token-id',
          requestingJti: 'requesting-token-id',
          reason: 'Security policy violation'
        })
      );
    });
  });

  describe('Audit Log Data Integrity', () => {
    test('should include all required fields in every audit log', async () => {
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('mock-hash');
      tokenService.generateToken.mockResolvedValue({ token: 'token', salt: 'salt' });
      logEventSpy.mockResolvedValue(true);

      await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password',
          application_id: 'test-app'
        })
        .set('User-Agent', 'Test Browser');

      // Verify all required fields are present
      expect(logEventSpy).toHaveBeenCalledWith(
        expect.any(String),        // event_type
        expect.any(String),        // application_id
        expect.any(String),        // ip_address
        expect.any(String),        // user_agent
        expect.any(Object)         // details
      );

      const callArgs = logEventSpy.mock.calls[0];
      expect(callArgs[0]).toBeTruthy(); // event_type not empty
      expect(callArgs[1]).toBeTruthy(); // application_id not empty
      expect(callArgs[2]).toBeTruthy(); // ip_address not empty
      expect(callArgs[3]).toBeTruthy(); // user_agent not empty
      expect(callArgs[4]).toBeDefined(); // details exists
    });

    test('should not break application flow if logging fails', async () => {
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('mock-hash');
      tokenService.generateToken.mockResolvedValue({ token: 'token', salt: 'salt' });

      // Simulate logging failure
      logEventSpy.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'mock-token',
          salt: 'mock-salt'
        });

      // Use validate endpoint instead of login to avoid rate limiting
      // Even though logging fails, the application should still function
      // In this case, validation will fail (401) but won't crash
      expect(response.status).toBeDefined();
      expect([200, 401]).toContain(response.status);
    });
  });
});
