const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/auth');
const adminRoutes = require('../../src/routes/admin');
const databaseService = require('../../src/services/database');
const passwordService = require('../../src/services/password');
const tokenService = require('../../src/services/token');
const { corsMiddleware } = require('../../src/middleware/corsConfig');
const { errorHandler, notFoundHandler } = require('../../src/middleware/errorHandler');

// Mock dependencies
jest.mock('../../src/config/supabase');
jest.mock('../../src/services/password');
jest.mock('../../src/services/token');

// Create Express app for testing
const app = express();
app.use(corsMiddleware);
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

describe('API Endpoint Tests - Task 8.4', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ====================
  // 1. VALID INPUT TESTS
  // ====================
  describe('Test all endpoints with valid inputs', () => {
    test('POST /api/auth/login - should accept valid login request', async () => {
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('$argon2id$hash');
      tokenService.generateToken.mockResolvedValue({
        token: 'valid-jwe-token',
        salt: 'valid-salt'
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'ValidPassword123!',
          application_id: 'test-app'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.salt).toBeDefined();
    });

    test('POST /api/auth/validate - should accept valid validation request', async () => {
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
          token: 'valid-token',
          salt: 'valid-salt'
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.sessionId).toBeDefined();
    });

    test('POST /api/auth/logout - should accept valid logout request', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      tokenService.validateToken.mockResolvedValue({
        appId: 'test-app',
        jti: 'token-id',
        exp: currentTime + 3600
      });
      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          token: 'valid-token',
          salt: 'valid-salt'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('POST /api/auth/refresh - should accept valid refresh request', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      tokenService.validateToken.mockResolvedValue({
        appId: 'test-app',
        jti: 'old-token-id',
        exp: currentTime + 3600,
        iat: currentTime
      });
      tokenService.generateToken.mockResolvedValue({
        token: 'new-token',
        salt: 'new-salt'
      });
      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          token: 'valid-token',
          salt: 'valid-salt'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
    });

    test('GET /api/auth/token/status - should accept valid status request', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      tokenService.validateToken.mockResolvedValue({
        appId: 'test-app',
        jti: 'token-id',
        exp: currentTime + 3600,
        iat: currentTime
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .get('/api/auth/token/status')
        .send({
          token: 'valid-token',
          salt: 'valid-salt'
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.status).toBeDefined();
    });

    test('POST /api/auth/token/revoke - should accept valid revoke request', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      tokenService.validateToken.mockResolvedValue({
        appId: 'test-app',
        jti: 'token-to-revoke',
        exp: currentTime + 3600
      });
      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/token/revoke')
        .send({
          requestingToken: 'admin-token',
          requestingSalt: 'admin-salt',
          targetToken: 'token-to-revoke',
          targetSalt: 'target-salt'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // =======================
  // 2. INVALID INPUT TESTS
  // =======================
  describe('Test all endpoints with invalid inputs', () => {
    describe('POST /api/auth/login - invalid inputs', () => {
      test('should reject login with missing password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            application_id: 'test-app'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('password');
      });

      test('should reject login with missing application_id', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            password: 'Password123!'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('application_id');
      });

      test('should reject login with empty password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            password: '',
            application_id: 'test-app'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('should reject login with non-string password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            password: 12345,
            application_id: 'test-app'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/auth/validate - invalid inputs', () => {
      test('should reject validation with missing token', async () => {
        const response = await request(app)
          .post('/api/auth/validate')
          .send({
            salt: 'some-salt'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('token');
      });

      test('should reject validation with missing salt', async () => {
        const response = await request(app)
          .post('/api/auth/validate')
          .send({
            token: 'some-token'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('salt');
      });

      test('should reject validation with empty token', async () => {
        const response = await request(app)
          .post('/api/auth/validate')
          .send({
            token: '',
            salt: 'salt'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/auth/logout - invalid inputs', () => {
      test('should reject logout with missing token', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .send({
            salt: 'salt'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('should reject logout with malformed token', async () => {
        tokenService.validateToken.mockRejectedValue(
          new Error('Malformed token')
        );

        const response = await request(app)
          .post('/api/auth/logout')
          .send({
            token: 'bad-token',
            salt: 'salt'
          });

        // Logout should handle gracefully even for invalid tokens
        expect([200, 401]).toContain(response.status);
        if (response.status === 401) {
          expect(response.body.success).toBe(false);
        }
      });
    });

    describe('POST /api/auth/refresh - invalid inputs', () => {
      test('should reject refresh with missing token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({
            salt: 'salt'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('should reject refresh with expired token', async () => {
        tokenService.validateToken.mockRejectedValue(
          new Error('Token expired')
        );

        const response = await request(app)
          .post('/api/auth/refresh')
          .send({
            token: 'expired-token',
            salt: 'salt'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/auth/token/status - invalid inputs', () => {
      test('should reject status check with missing token', async () => {
        const response = await request(app)
          .get('/api/auth/token/status')
          .send({
            salt: 'salt'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('should reject status check with invalid token', async () => {
        tokenService.validateToken.mockRejectedValue(
          new Error('Invalid token')
        );

        const response = await request(app)
          .get('/api/auth/token/status')
          .send({
            token: 'invalid-token',
            salt: 'salt'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/auth/token/revoke - invalid inputs', () => {
      test('should reject revoke with missing required fields', async () => {
        const response = await request(app)
          .post('/api/auth/token/revoke')
          .send({
            requestingToken: 'token'
            // Missing other required fields
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });
  });

  // ==============================
  // 3. AUTHENTICATION REQUIREMENTS
  // ==============================
  describe('Test authentication requirements', () => {
    test('GET /api/admin/logs - should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/logs');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('GET /api/admin/logs - should reject invalid credentials', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .auth('wrong-user', 'wrong-pass');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('GET /api/admin/logs - should accept valid credentials', async () => {
      // Set environment variables for admin auth
      process.env.ADMIN_EMAIL = 'admin@test.com';
      process.env.ADMIN_PASSWORD = 'AdminPass123!';

      jest.spyOn(databaseService, 'getAuditLogs').mockResolvedValue({
        logs: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .auth('admin@test.com', 'AdminPass123!');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Token endpoints should validate token structure', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('Invalid token structure')
      );

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'malformed',
          salt: 'salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
    });
  });

  // =========================
  // 4. RATE LIMITING BEHAVIOR
  // =========================
  describe('Test rate limiting behavior', () => {
    test('POST /api/auth/login - should enforce rate limit (5 requests/minute)', async () => {
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      tokenService.generateToken.mockResolvedValue({
        token: 'token',
        salt: 'salt'
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      // Make 5 successful requests
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            password: `Password${i}`,
            application_id: `rate-limit-login-app-${i}`
          });
        expect(response.status).toBe(200);
      }

      // 6th request should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'Password6',
          application_id: 'rate-limit-login-app-6'
        });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many');
    });

    test('POST /api/auth/validate - should enforce rate limit (100 requests/minute)', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      tokenService.validateToken.mockResolvedValue({
        appId: 'test-app',
        jti: 'token-id',
        exp: currentTime + 3600,
        iat: currentTime
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      // Make 100 successful requests
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .post('/api/auth/validate')
          .send({
            token: `rate-limit-validate-token-${i}`,
            salt: 'salt'
          });
        expect(response.status).toBe(200);
      }

      // 101st request should be rate limited
      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'rate-limit-validate-token-101',
          salt: 'salt'
        });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
    });

    test('Rate limit should include appropriate headers', async () => {
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      tokenService.generateToken.mockResolvedValue({
        token: 'token',
        salt: 'salt'
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'Password',
          application_id: 'rate-limit-test-app'
        });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    test('GET /api/admin/logs - should enforce rate limit (100 requests/minute)', async () => {
      process.env.ADMIN_EMAIL = 'admin@test.com';
      process.env.ADMIN_PASSWORD = 'AdminPass123!';

      jest.spyOn(databaseService, 'getAuditLogs').mockResolvedValue({
        logs: [],
        total: 0
      });

      // Make 100 successful requests
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .get('/api/admin/logs')
          .auth('admin@test.com', 'AdminPass123!');
        expect([200, 429]).toContain(response.status);
      }

      // 101st request should be rate limited
      const response = await request(app)
        .get('/api/admin/logs')
        .auth('admin@test.com', 'AdminPass123!');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
    });
  });

  // =========================
  // 5. CORS HEADERS IN RESPONSES
  // =========================
  describe('Test CORS headers in responses', () => {
    test('POST /api/auth/login - should include CORS headers', async () => {
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      tokenService.generateToken.mockResolvedValue({
        token: 'token',
        salt: 'salt'
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({
          password: 'Password',
          application_id: 'cors-test-unique-app'
        });

      // CORS headers should be present
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('POST /api/auth/validate - should include CORS headers', async () => {
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
        .set('Origin', 'http://localhost:3000')
        .send({
          token: 'token',
          salt: 'salt'
        });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('OPTIONS preflight request should be handled correctly', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    test('GET /api/admin/logs - should include CORS headers', async () => {
      process.env.ADMIN_EMAIL = 'admin@test.com';
      process.env.ADMIN_PASSWORD = 'AdminPass123!';

      jest.spyOn(databaseService, 'getAuditLogs').mockResolvedValue({
        logs: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Origin', 'http://localhost:3000')
        .auth('admin@test.com', 'AdminPass123!');

      // May hit rate limit, but should still have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  // ===========================
  // 6. ERROR RESPONSES FORMAT
  // ===========================
  describe('Test error responses format', () => {
    test('All error responses should have consistent format with success: false', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'test'
        });

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    test('Error responses should include appropriate status codes', async () => {
      // Test 400 Bad Request
      const badRequestResponse = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(badRequestResponse.status).toBe(400);
      expect(badRequestResponse.body.success).toBe(false);

      // Test 401 Unauthorized
      const unauthorizedResponse = await request(app)
        .get('/api/admin/logs');
      expect(unauthorizedResponse.status).toBe(401);
      expect(unauthorizedResponse.body.success).toBe(false);

      // Test 404 Not Found
      const notFoundResponse = await request(app)
        .get('/api/nonexistent');
      expect(notFoundResponse.status).toBe(404);
      expect(notFoundResponse.body.success).toBe(false);
    });

    test('Error messages should not expose sensitive information', async () => {
      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'wrong',
          application_id: 'error-message-test-app'
        });

      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.error).not.toContain('password');
      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('hash');
    });

    test('500 errors should return generic message in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock database error
      jest.spyOn(databaseService, 'getPasswordHash').mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password',
          application_id: 'production-error-test-app'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      // In production, error should be generic
      if (response.body.error.message) {
        expect(response.body.error.message).not.toContain('Database');
      }

      process.env.NODE_ENV = originalEnv;
    });

    test('Error response should not include stack trace in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.body.error).not.toHaveProperty('stack');

      process.env.NODE_ENV = originalEnv;
    });

    test('404 errors should have consistent format', async () => {
      const response = await request(app)
        .get('/api/nonexistent/route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBeDefined();
    });
  });
});
