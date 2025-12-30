const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../src/routes/admin');
const databaseService = require('../../src/services/database');
const passwordService = require('../../src/services/password');
const adminAuthService = require('../../src/services/adminAuth');

// Mock the Supabase client and services
jest.mock('../../src/config/supabase');
jest.mock('../../src/services/password');
jest.mock('../../src/services/adminAuth');

// Import error handlers
const { errorHandler, notFoundHandler } = require('../../src/middleware/errorHandler');

// Create Express app for testing
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

describe('Admin Workflow: Rate Limiting Integration Tests', () => {
  let validAdminToken;
  let logEventSpy;

  beforeAll(() => {
    // Set up admin environment for JWT generation
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'AdminPass123!';
    process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret';
    process.env.ADMIN_SESSION_TIMEOUT = '1800';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Set a mock admin token
    validAdminToken = 'mock-admin-jwt-token';

    // Spy on logEvent to verify rate limit logging
    logEventSpy = jest.spyOn(databaseService, 'logEvent');
    logEventSpy.mockResolvedValue(true);

    // Mock admin authentication
    adminAuthService.verifyAdminToken = jest.fn().mockReturnValue({ username: 'admin', role: 'admin' });
    adminAuthService.verifyCredentials = jest.fn().mockReturnValue(false);
    adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);
  });

  afterEach(() => {
    logEventSpy.mockRestore();
  });

  describe('Login Rate Limiter (5 attempts / 15 minutes per IP)', () => {
    test('should allow up to 5 login attempts', async () => {
      adminAuthService.verifyCredentials = jest.fn().mockReturnValue(true);
      adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);

      // Make 5 login attempts
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/admin/auth/login')
          .send({
            username: 'admin',
            password: `AdminPass${i}!`
          })
          .set('X-Forwarded-For', '192.168.1.100');

        expect(response.status).toBe(200);
      }
    });

    test('should block 6th login attempt within rate limit window', async () => {
      adminAuthService.verifyCredentials = jest.fn().mockReturnValue(true);
      adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);

      // Make 5 successful attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/admin/auth/login')
          .send({
            username: 'admin',
            password: `AdminPass${i}!`
          })
          .set('X-Forwarded-For', '192.168.1.101');
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass6!'
        })
        .set('X-Forwarded-For', '192.168.1.101');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many');
    });

    test('should include rate limit headers in response', async () => {
      adminAuthService.verifyCredentials = jest.fn().mockReturnValue(true);
      adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!'
        })
        .set('X-Forwarded-For', '192.168.1.102');

      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    test('should log rate limit exceeded events', async () => {
      adminAuthService.verifyCredentials = jest.fn().mockReturnValue(true);
      adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/admin/auth/login')
          .send({
            username: 'admin',
            password: `AdminPass${i}!`
          })
          .set('X-Forwarded-For', '192.168.1.103');
      }

      // Trigger rate limit
      await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass6!'
        })
        .set('X-Forwarded-For', '192.168.1.103')
        .set('User-Agent', 'Test Browser');

      // Verify rate limit exceeded was logged
      const rateLimitLog = logEventSpy.mock.calls.find(
        call => call[0] === 'rate_limit_exceeded'
      );
      expect(rateLimitLog).toBeDefined();
    });
  });

  describe('Admin General Rate Limiter (100 requests / minute per IP)', () => {
    beforeEach(() => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });
    });

    test('should allow up to 100 admin requests per minute', async () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .get('/api/admin/logs')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.104');

        expect(response.status).toBe(200);
      }
    });

    test('should block 101st request within rate limit window', async () => {
      // Make 100 successful requests
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/admin/logs')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.105');
      }

      // 101st request should be rate limited
      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.105');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many');
    });

    test('should apply rate limit independently per IP address', async () => {
      // IP 1: Make 100 requests
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/admin/logs')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.106');
      }

      // IP 1: Should be rate limited
      const response1 = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.106');

      expect(response1.status).toBe(429);

      // IP 2: Should still work
      const response2 = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.107');

      expect(response2.status).toBe(200);
    });
  });

  describe('Password Change Rate Limiter (5 attempts / hour per application)', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    beforeEach(() => {
      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-ratelimit-test',
        app_name: 'Rate Limit Test App',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$oldHash',
        is_active: true
      });

      passwordService.verifyPassword.mockResolvedValue(true);
      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$newHash');
      jest.spyOn(databaseService, 'updateMasterPasswordHash').mockResolvedValue(true);
      jest.spyOn(databaseService, 'revokeAllTokensForApplication').mockResolvedValue(0);
    });

    test('should allow up to 5 password change attempts per hour', async () => {
      // Make 5 password change attempts
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .put(`/api/admin/applications/${validUuid}/password`)
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            current_master_password: 'CurrentPassword123!',
            new_master_password: `NewPassword${i}123!`
          });

        expect(response.status).toBe(200);
      }
    });

    test('should block 6th password change attempt within rate limit window', async () => {
      // Make 5 successful attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .put(`/api/admin/applications/${validUuid}/password`)
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            current_master_password: 'CurrentPassword123!',
            new_master_password: `NewPassword${i}123!`
          });
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .put(`/api/admin/applications/${validUuid}/password`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          current_master_password: 'CurrentPassword123!',
          new_master_password: 'NewPassword6123!'
        });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many password change requests');
    });

    test('should apply rate limit per application ID', async () => {
      const validUuid2 = '223e4567-e89b-12d3-a456-426614174001';

      jest.spyOn(databaseService, 'getApplicationById').mockImplementation((id) => {
        if (id === validUuid) {
          return Promise.resolve({
            id: validUuid,
            app_id: 'app-1',
            app_name: 'App 1',
            master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$oldHash',
            is_active: true
          });
        } else if (id === validUuid2) {
          return Promise.resolve({
            id: validUuid2,
            app_id: 'app-2',
            app_name: 'App 2',
            master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$oldHash',
            is_active: true
          });
        }
        return Promise.resolve(null);
      });

      // App 1: Make 5 attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .put(`/api/admin/applications/${validUuid}/password`)
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            current_master_password: 'CurrentPassword123!',
            new_master_password: `NewPassword${i}123!`
          });
      }

      // App 1: Should be rate limited
      const response1 = await request(app)
        .put(`/api/admin/applications/${validUuid}/password`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          current_master_password: 'CurrentPassword123!',
          new_master_password: 'NewPassword6123!'
        });

      expect(response1.status).toBe(429);

      // App 2: Should still work (different app)
      const response2 = await request(app)
        .put(`/api/admin/applications/${validUuid2}/password`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          current_master_password: 'CurrentPassword123!',
          new_master_password: 'NewPassword1123!'
        });

      expect(response2.status).toBe(200);
    });
  });

  describe('Export Rate Limiter (10 exports / hour per IP)', () => {
    beforeEach(() => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });
    });

    test('should allow up to 10 export requests per hour', async () => {
      // Make 10 export requests
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/admin/logs/export')
          .query({ format: 'json' })
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.108');

        expect(response.status).toBe(200);
      }
    });

    test('should block 11th export request within rate limit window', async () => {
      // Make 10 successful exports
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/admin/logs/export')
          .query({ format: 'json' })
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.109');
      }

      // 11th export should be rate limited
      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.109');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many log export requests');
    });

    test('should apply rate limit for both JSON and CSV exports', async () => {
      // Make 5 JSON exports
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/admin/logs/export')
          .query({ format: 'json' })
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.110');
      }

      // Make 5 CSV exports
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/admin/logs/export')
          .query({ format: 'csv' })
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.110');
      }

      // 11th export (JSON) should be rate limited
      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.110');

      expect(response.status).toBe(429);
    });
  });

  describe('Token Revocation Rate Limiter (50 revocations / hour per IP)', () => {
    const validUuid = '323e4567-e89b-12d3-a456-426614174002';

    beforeEach(() => {
      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-revoke-test',
        app_name: 'Revoke Test App',
        is_active: true
      });

      jest.spyOn(databaseService, 'revokeAllTokensForApplication').mockResolvedValue(5);
    });

    test('should allow up to 50 token revocations per hour', async () => {
      // Make 50 revocation requests
      for (let i = 0; i < 50; i++) {
        const response = await request(app)
          .post(`/api/admin/applications/${validUuid}/revoke-all`)
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({ reason: `Revoke ${i}` })
          .set('X-Forwarded-For', '192.168.1.111');

        expect(response.status).toBe(200);
      }
    });

    test('should block 51st revocation request within rate limit window', async () => {
      // Make 50 successful revocations
      for (let i = 0; i < 50; i++) {
        await request(app)
          .post(`/api/admin/applications/${validUuid}/revoke-all`)
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({ reason: `Revoke ${i}` })
          .set('X-Forwarded-For', '192.168.1.112');
      }

      // 51st revocation should be rate limited
      const response = await request(app)
        .post(`/api/admin/applications/${validUuid}/revoke-all`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({ reason: 'Revoke 51' })
        .set('X-Forwarded-For', '192.168.1.112');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many');
    });

    test('should apply same rate limit for single token revocations', async () => {
      jest.spyOn(databaseService, 'revokeTokenById').mockResolvedValue({
        success: true,
        token: {
          jti: 'token-jti-123',
          application_id: 'app-test',
          revoked_at: new Date().toISOString()
        }
      });

      // Make 50 single token revocations
      for (let i = 0; i < 50; i++) {
        await request(app)
          .post('/api/admin/tokens/revoke')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            jti: `token-jti-${i}`,
            reason: 'Test'
          })
          .set('X-Forwarded-For', '192.168.1.113');
      }

      // 51st revocation should be rate limited
      const response = await request(app)
        .post('/api/admin/tokens/revoke')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          jti: 'token-jti-51',
          reason: 'Test'
        })
        .set('X-Forwarded-For', '192.168.1.113');

      expect(response.status).toBe(429);
    });
  });

  describe('Rate Limit Headers', () => {
    beforeEach(() => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });
    });

    test('should include RateLimit-Limit header', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(parseInt(response.headers['ratelimit-limit'], 10)).toBeGreaterThan(0);
    });

    test('should include RateLimit-Remaining header', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(parseInt(response.headers['ratelimit-remaining'], 10)).toBeGreaterThanOrEqual(0);
    });

    test('should include RateLimit-Reset header', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.headers['ratelimit-reset']).toBeDefined();
      expect(parseInt(response.headers['ratelimit-reset'], 10)).toBeGreaterThan(0);
    });

    test('should decrement RateLimit-Remaining with each request', async () => {
      const response1 = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.114');

      const remaining1 = parseInt(response1.headers['ratelimit-remaining'], 10);

      const response2 = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.114');

      const remaining2 = parseInt(response2.headers['ratelimit-remaining'], 10);

      expect(remaining2).toBeLessThan(remaining1);
    });

    test('should include headers in 429 rate limit response', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/admin/logs')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.115');
      }

      // Trigger rate limit
      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.115');

      expect(response.status).toBe(429);
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBe('0');
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Cross-Endpoint Rate Limiting', () => {
    test('should track admin limiter across different endpoints', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      jest.spyOn(databaseService, 'getAllApplications').mockResolvedValue({
        applications: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      jest.spyOn(databaseService, 'getDashboardStats').mockResolvedValue({
        total_applications: 0,
        active_applications: 0,
        total_active_tokens: 0,
        failed_logins_24h: 0,
        successful_logins_24h: 0,
        token_validations_24h: 0,
        recent_activity: []
      });

      // Make 50 requests to /logs
      for (let i = 0; i < 50; i++) {
        await request(app)
          .get('/api/admin/logs')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.116');
      }

      // Make 50 requests to /applications
      for (let i = 0; i < 50; i++) {
        await request(app)
          .get('/api/admin/applications')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.116');
      }

      // Next request to any admin endpoint should be rate limited (100 total)
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.116');

      expect(response.status).toBe(429);
    });

    test('should not apply login limiter to other endpoints', async () => {
      adminAuthService.verifyCredentials = jest.fn().mockReturnValue(true);
      adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);

      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Exhaust login limiter
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/admin/auth/login')
          .send({
            username: 'admin',
            password: `AdminPass${i}!`
          })
          .set('X-Forwarded-For', '192.168.1.117');
      }

      // Login should be rate limited
      const loginResponse = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass6!'
        })
        .set('X-Forwarded-For', '192.168.1.117');

      expect(loginResponse.status).toBe(429);

      // But logs endpoint should still work
      const logsResponse = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.117');

      expect(logsResponse.status).toBe(200);
    });
  });

  describe('Rate Limit Error Messages', () => {
    test('should return descriptive error for login rate limit', async () => {
      adminAuthService.verifyCredentials = jest.fn().mockReturnValue(true);
      adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/admin/auth/login')
          .send({
            username: 'admin',
            password: `AdminPass${i}!`
          })
          .set('X-Forwarded-For', '192.168.1.118');
      }

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass6!'
        })
        .set('X-Forwarded-For', '192.168.1.118');

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Too many');
    });

    test('should return descriptive error for export rate limit', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/admin/logs/export')
          .query({ format: 'json' })
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.119');
      }

      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.119');

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Too many log export requests');
    });

    test('should return descriptive error for password change rate limit', async () => {
      const validUuid = '423e4567-e89b-12d3-a456-426614174003';

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-test',
        app_name: 'Test App',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$oldHash',
        is_active: true
      });

      passwordService.verifyPassword.mockResolvedValue(true);
      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$newHash');
      jest.spyOn(databaseService, 'updateMasterPasswordHash').mockResolvedValue(true);
      jest.spyOn(databaseService, 'revokeAllTokensForApplication').mockResolvedValue(0);

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .put(`/api/admin/applications/${validUuid}/password`)
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            current_master_password: 'CurrentPassword123!',
            new_master_password: `NewPassword${i}123!`
          });
      }

      const response = await request(app)
        .put(`/api/admin/applications/${validUuid}/password`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          current_master_password: 'CurrentPassword123!',
          new_master_password: 'NewPassword6123!'
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Too many password change requests');
    });
  });

  describe('Rate Limit Response Format', () => {
    test('should return consistent error format for rate limit', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/admin/logs')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .set('X-Forwarded-For', '192.168.1.120');
      }

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '192.168.1.120');

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });
  });
});
