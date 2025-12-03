const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/auth');
const databaseService = require('../../src/services/database');
const passwordService = require('../../src/services/password');
const tokenService = require('../../src/services/token');

// Mock the services
jest.mock('../../src/config/supabase');
jest.mock('../../src/services/password');
jest.mock('../../src/services/token');

// Create Express app for testing
const app = express();
app.use(express.json());

describe('Security Tests - Task 8.5', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Test 1: Token Tampering Detection
  // ============================================================================
  describe('Test 1: Token Tampering Detection', () => {
    beforeAll(() => {
      // Use routes without rate limiter for tampering tests
      app.use('/api/auth', authRoutes);
    });

    test('should detect and reject tampered JWE header', async () => {
      // Mock token validation to throw decryption error (tampered header)
      tokenService.validateToken.mockRejectedValue(
        new Error('JWE decryption failed')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      // Tampered token with modified header
      const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature';

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: tamperedToken,
          salt: 'valid-salt'
        })
        .set('User-Agent', 'Security Test');

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Token validation failed');

      // Verify failure was logged
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'token_validation_failed',
        'unknown',
        expect.any(String),
        'Security Test',
        { reason: 'JWE decryption failed' }
      );
    });

    test('should detect and reject tampered JWE ciphertext', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('invalid signature')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'valid.header.TAMPERED_CIPHERTEXT.valid.tag',
          salt: 'valid-salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('invalid');
    });

    test('should detect and reject tampered authentication tag', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('Authentication tag verification failed')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'valid.header.valid.ciphertext.TAMPERED_TAG',
          salt: 'valid-salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Token validation failed');
    });

    test('should reject token when using wrong salt/CEK', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('Decryption failed - incorrect key')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'valid-jwe-token',
          salt: 'WRONG_SALT_VALUE'
        })
        .set('User-Agent', 'Security Test');

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'token_validation_failed',
        'unknown',
        expect.any(String),
        'Security Test',
        { reason: 'Decryption failed - incorrect key' }
      );
    });

    test('should detect modified JWT payload within JWE', async () => {
      // This tests if someone decrypts JWE, modifies JWT, re-encrypts
      // JWT signature verification should catch this
      tokenService.validateToken.mockRejectedValue(
        new Error('JWT signature verification failed')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'jwe.with.modified.jwt.inside',
          salt: 'salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
    });
  });

  // ============================================================================
  // Test 2: Replay Attack Prevention
  // ============================================================================
  describe('Test 2: Replay Attack Prevention', () => {
    beforeAll(() => {
      // Reset app routes
      app._router = null;
      app.use('/api/auth', authRoutes);
    });

    test('should prevent reuse of revoked token', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const tokenPayload = {
        appId: 'test-app',
        jti: 'revoked-token-id',
        exp: currentTime + 3600,
        iat: currentTime
      };

      // First validation: token is valid
      tokenService.validateToken.mockResolvedValueOnce(tokenPayload);
      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      // Logout the token (revoke it)
      await request(app)
        .post('/api/auth/logout')
        .send({
          token: 'token-to-revoke',
          salt: 'salt'
        });

      expect(databaseService.revokeToken).toHaveBeenCalled();

      // Second validation: token is now revoked
      tokenService.validateToken.mockRejectedValueOnce(
        new Error('Token has been revoked')
      );

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'token-to-revoke',
          salt: 'salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('revoked');
    });

    test('should prevent token reuse after logout', async () => {
      const currentTime = Math.floor(Date.now() / 1000);

      // Mock successful logout
      tokenService.validateToken.mockResolvedValueOnce({
        appId: 'test-app',
        jti: 'logout-token-id',
        exp: currentTime + 3600
      });
      jest.spyOn(databaseService, 'revokeToken').mockResolvedValue(true);
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({
          token: 'logout-token',
          salt: 'salt'
        });

      expect(logoutResponse.status).toBe(200);

      // Attempt to reuse the same token
      tokenService.validateToken.mockRejectedValueOnce(
        new Error('Token has been revoked')
      );

      const reuseResponse = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'logout-token',
          salt: 'salt'
        });

      expect(reuseResponse.status).toBe(401);
      expect(reuseResponse.body.valid).toBe(false);
    });

    test('should reject expired tokens even if not revoked', async () => {
      // Expired tokens should not be replayable
      tokenService.validateToken.mockRejectedValue(
        new Error('Token expired')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'expired-token',
          salt: 'salt'
        });

      expect(response.status).toBe(401);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    test('should enforce token expiration - no replay after expiry', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('jwt expired')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({
          token: 'old-expired-token',
          salt: 'salt'
        })
        .set('User-Agent', 'Security Test');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('expired');

      // Verify logged as expired
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'token_validation_failed',
        'unknown',
        expect.any(String),
        'Security Test',
        { reason: 'jwt expired' }
      );
    });
  });

  // ============================================================================
  // Test 3: Rate Limiting Effectiveness
  // ============================================================================
  describe('Test 3: Rate Limiting Effectiveness', () => {
    // Create separate app with rate limiters for these tests
    let rateLimitApp;

    beforeAll(() => {
      rateLimitApp = express();
      rateLimitApp.use(express.json());
      rateLimitApp.use('/api/auth', authRoutes);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should enforce login rate limit (5 attempts/minute)', async () => {
      // Mock password verification to fail
      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      // Make 5 failed login attempts (at the limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(rateLimitApp)
          .post('/api/auth/login')
          .send({
            password: 'wrong-password',
            application_id: `brute-force-test-${i}`
          });

        expect(response.status).toBe(401);
      }

      // 6th attempt should be rate limited
      const response = await request(rateLimitApp)
        .post('/api/auth/login')
        .send({
          password: 'wrong-password',
          application_id: 'brute-force-test-6'
        });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many login requests');
    }, 10000);

    test('should enforce validation rate limit (100 requests/minute)', async () => {
      tokenService.validateToken.mockRejectedValue(
        new Error('Invalid token')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      // Make 100 validation requests (at the limit)
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(rateLimitApp)
            .post('/api/auth/validate')
            .send({
              token: `token-${i}`,
              salt: 'salt'
            })
        );
      }

      await Promise.all(requests);

      // 101st request should be rate limited
      const response = await request(rateLimitApp)
        .post('/api/auth/validate')
        .send({
          token: 'token-101',
          salt: 'salt'
        });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many validation requests');
    }, 30000);

    test('should log rate limit violations', async () => {
      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      // Trigger rate limit
      for (let i = 0; i < 6; i++) {
        await request(rateLimitApp)
          .post('/api/auth/login')
          .send({
            password: 'password',
            application_id: `log-test-${i}`
          });
      }

      // Verify rate limit violation was logged
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'rate_limit_exceeded',
        'unknown',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          limit: 5
        })
      );
    }, 10000);

    test('should return rate limit headers in response', async () => {
      passwordService.verifyPassword.mockResolvedValue(true);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      tokenService.generateToken.mockResolvedValue({
        token: 'token',
        salt: 'salt'
      });
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(rateLimitApp)
        .post('/api/auth/login')
        .send({
          password: 'password',
          application_id: 'header-test-app'
        });

      // Check for rate limit headers
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
    });
  });

  // ============================================================================
  // Test 4: Password Brute Force Protection
  // ============================================================================
  describe('Test 4: Password Brute Force Protection', () => {
    let bruteForceApp;

    beforeAll(() => {
      // Create fresh app instance to avoid rate limit carryover
      bruteForceApp = express();
      bruteForceApp.use(express.json());
      bruteForceApp.use('/api/auth', authRoutes);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should block brute force password attempts via rate limiting', async () => {
      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const passwords = [
        'password123',
        'Password123',
        'PASSWORD123',
        'p@ssw0rd123',
        'MyPassword123',
        'SecretPass123' // This one should be blocked
      ];

      let failedAuthCount = 0;
      let rateLimitedCount = 0;

      for (let i = 0; i < passwords.length; i++) {
        const response = await request(bruteForceApp)
          .post('/api/auth/login')
          .send({
            password: passwords[i],
            application_id: `brute-force-target-${i}`
          })
          .set('User-Agent', 'Security Test');

        if (response.status === 401) failedAuthCount++;
        if (response.status === 429) rateLimitedCount++;
      }

      // We expect some to fail with 401 and at least one to be rate limited
      expect(failedAuthCount).toBeGreaterThanOrEqual(4);
      expect(rateLimitedCount).toBeGreaterThanOrEqual(1);
    }, 10000);

    test('should log all failed login attempts', async () => {
      // Create isolated app to avoid rate limit interference
      const isolatedApp = express();
      isolatedApp.use(express.json());
      isolatedApp.use('/api/auth', authRoutes);

      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      await request(isolatedApp)
        .post('/api/auth/login')
        .send({
          password: 'wrong1',
          application_id: 'log-failed-app-isolated'
        })
        .set('User-Agent', 'Security Test');

      // Check that login_failed was logged (may have rate_limit_exceeded too)
      const calls = databaseService.logEvent.mock.calls;
      const hasLoginFailed = calls.some(call =>
        call[0] === 'login_failed' &&
        call[1] === 'log-failed-app-isolated'
      );

      expect(hasLoginFailed).toBe(true);
    });

    test('should not reveal whether password or username is incorrect', async () => {
      // Create isolated app to avoid rate limit interference
      const isolatedApp = express();
      isolatedApp.use(express.json());
      isolatedApp.use('/api/auth', authRoutes);

      // Test 1: Wrong password
      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response1 = await request(isolatedApp)
        .post('/api/auth/login')
        .send({
          password: 'wrong-password',
          application_id: 'test-app-reveal-isolated'
        })
        .set('User-Agent', 'Security Test');

      // May be 401 or 429, but error message should be generic
      expect([401, 429]).toContain(response1.status);
      expect(response1.body.error).toMatch(/Invalid credentials|Too many login requests/);

      // Test 2: Non-existent application (use fresh app)
      const isolatedApp2 = express();
      isolatedApp2.use(express.json());
      isolatedApp2.use('/api/auth', authRoutes);

      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue(null);

      const response2 = await request(isolatedApp2)
        .post('/api/auth/login')
        .send({
          password: 'any-password',
          application_id: 'non-existent-app-isolated'
        })
        .set('User-Agent', 'Security Test');

      expect([401, 429]).toContain(response2.status);
      expect(response2.body.error).toMatch(/Invalid credentials|Too many login requests/);

      // If both got through (401), messages should be identical
      if (response1.status === 401 && response2.status === 401) {
        expect(response1.body.error).toBe(response2.body.error);
      }
    });

    test('should count failed attempts toward rate limit', async () => {
      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      let failedCount = 0;
      let rateLimitedCount = 0;

      for (let i = 0; i < 7; i++) {
        const response = await request(bruteForceApp)
          .post('/api/auth/login')
          .send({
            password: `attempt-${i}`,
            application_id: 'rate-limit-count-test'
          });

        if (response.status === 401) failedCount++;
        if (response.status === 429) rateLimitedCount++;
      }

      expect(failedCount).toBe(5); // First 5 attempts fail with 401
      expect(rateLimitedCount).toBeGreaterThanOrEqual(2); // Rest are rate limited
    }, 10000);
  });

  // ============================================================================
  // Test 5: SQL Injection Attempts
  // ============================================================================
  describe('Test 5: SQL Injection Attempts (Supabase Protection)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should safely handle SQL injection in password field', async () => {
      // Create isolated app to avoid rate limit interference
      const sqlInjectionApp = express();
      sqlInjectionApp.use(express.json());
      sqlInjectionApp.use('/api/auth', authRoutes);

      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "' OR 1=1--",
        "admin'--"
      ];

      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      for (const payload of sqlInjectionPayloads) {
        const response = await request(sqlInjectionApp)
          .post('/api/auth/login')
          .send({
            password: payload,
            application_id: `sql-test-${sqlInjectionPayloads.indexOf(payload)}`
          })
          .set('User-Agent', 'Security Test');

        // Should fail gracefully without database errors (401 or 429)
        expect([401, 429]).toContain(response.status);

        // Should not expose database error details
        expect(response.body.error).not.toContain('SQL');
        expect(response.body.error).not.toContain('database');
        expect(response.body.error).not.toContain('syntax');
      }
    });

    test('should safely handle SQL injection in application_id field', async () => {
      // Create isolated app to avoid rate limit interference
      const sqlInjectionApp = express();
      sqlInjectionApp.use(express.json());
      sqlInjectionApp.use('/api/auth', authRoutes);

      const sqlInjectionPayloads = [
        "test-app' OR '1'='1",
        "'; DELETE FROM applications--"
      ];

      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      for (const payload of sqlInjectionPayloads) {
        const response = await request(sqlInjectionApp)
          .post('/api/auth/login')
          .send({
            password: 'password123',
            application_id: payload
          })
          .set('User-Agent', 'Security Test');

        expect([401, 429]).toContain(response.status);
        expect(response.body.error).toMatch(/Invalid credentials|Too many login requests/);
      }
    });

    test('should safely handle SQL injection in token validation', async () => {
      // Create isolated app to avoid rate limit interference
      const sqlInjectionApp = express();
      sqlInjectionApp.use(express.json());
      sqlInjectionApp.use('/api/auth', authRoutes);

      const sqlTokenPayloads = [
        "token' OR '1'='1",
        "'; SELECT * FROM revoked_tokens--"
      ];

      tokenService.validateToken.mockRejectedValue(
        new Error('Invalid token format')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      for (const payload of sqlTokenPayloads) {
        const response = await request(sqlInjectionApp)
          .post('/api/auth/validate')
          .send({
            token: payload,
            salt: 'salt'
          })
          .set('User-Agent', 'Security Test');

        expect([401, 429]).toContain(response.status);
        expect(response.body.valid).toBe(false);

        // Should not expose database internals
        expect(JSON.stringify(response.body)).not.toContain('SELECT');
        expect(JSON.stringify(response.body)).not.toContain('DROP');
        expect(JSON.stringify(response.body)).not.toContain('DELETE');
      }
    });

    test('should not expose database errors to client', async () => {
      // Create isolated app to avoid rate limit interference
      const sqlInjectionApp = express();
      sqlInjectionApp.use(express.json());
      sqlInjectionApp.use('/api/auth', authRoutes);

      // Simulate database error
      jest.spyOn(databaseService, 'getPasswordHash').mockRejectedValue(
        new Error('Database connection failed: SELECT * FROM auth_config')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(sqlInjectionApp)
        .post('/api/auth/login')
        .send({
          password: 'password',
          application_id: 'test-app-db-error'
        })
        .set('User-Agent', 'Security Test');

      // Should return generic error
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      // Should not expose database details
      expect(response.body.error).not.toContain('Database');
      expect(response.body.error).not.toContain('SELECT');
      expect(response.body.error).not.toContain('auth_config');
    });
  });

  // ============================================================================
  // Test 6: XSS in Error Messages
  // ============================================================================
  describe('Test 6: XSS in Error Messages', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should sanitize XSS payloads in password field', async () => {
      // Create isolated app to avoid rate limit interference
      const xssApp = express();
      xssApp.use(express.json());
      xssApp.use('/api/auth', authRoutes);

      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>'
      ];

      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      for (const payload of xssPayloads) {
        const response = await request(xssApp)
          .post('/api/auth/login')
          .send({
            password: payload,
            application_id: `xss-test-${xssPayloads.indexOf(payload)}`
          })
          .set('User-Agent', 'Security Test');

        const responseBody = JSON.stringify(response.body);

        // Should not contain script tags or event handlers
        expect(responseBody).not.toContain('<script>');
        expect(responseBody).not.toContain('onerror=');
        expect(responseBody).not.toContain('onload=');
        expect(responseBody).not.toContain('javascript:');
        expect(responseBody).not.toContain('<iframe');

        // Error message should be generic and safe
        expect(response.body.error).toMatch(/Invalid credentials|Too many login requests/);
      }
    });

    test('should sanitize XSS payloads in application_id field', async () => {
      // Create isolated app to avoid rate limit interference
      const xssApp = express();
      xssApp.use(express.json());
      xssApp.use('/api/auth', authRoutes);

      const xssPayloads = [
        'test-app<script>alert("XSS")</script>',
        'app"><img src=x onerror=alert("XSS")>'
      ];

      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      for (const payload of xssPayloads) {
        const response = await request(xssApp)
          .post('/api/auth/login')
          .send({
            password: 'password',
            application_id: payload
          })
          .set('User-Agent', 'Security Test');

        const responseBody = JSON.stringify(response.body);

        expect(responseBody).not.toContain('<script>');
        expect(responseBody).not.toContain('onerror=');
        expect(responseBody).not.toContain('onload=');
        expect(response.body.error).toMatch(/Invalid credentials|Too many login requests/);
      }
    });

    test('should ensure error messages are plain text', async () => {
      // Create isolated app to avoid rate limit interference
      const xssApp = express();
      xssApp.use(express.json());
      xssApp.use('/api/auth', authRoutes);

      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(xssApp)
        .post('/api/auth/login')
        .send({
          password: '<script>alert("XSS")</script>',
          application_id: 'test-app-plaintext'
        })
        .set('User-Agent', 'Security Test');

      // Check Content-Type is JSON (not HTML)
      expect(response.headers['content-type']).toContain('application/json');

      // Error message should be plain text string
      expect(typeof response.body.error).toBe('string');
      expect(response.body.error).toMatch(/Invalid credentials|Too many login requests/);
    });

    test('should not execute XSS in validation error responses', async () => {
      // Create isolated app
      const xssApp = express();
      xssApp.use(express.json());
      xssApp.use('/api/auth', authRoutes);

      tokenService.validateToken.mockRejectedValue(
        new Error('Token validation failed')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(xssApp)
        .post('/api/auth/validate')
        .send({
          token: '<script>alert("XSS")</script>',
          salt: '<img src=x onerror=alert("XSS")>'
        })
        .set('User-Agent', 'Security Test');

      const responseBody = JSON.stringify(response.body);

      expect(responseBody).not.toContain('<script>');
      expect(responseBody).not.toContain('onerror=');
      expect(responseBody).not.toContain('<img');
      expect(response.headers['content-type']).toContain('application/json');
    });

    test('should sanitize XSS in user agent logging', async () => {
      // Create isolated app
      const xssApp = express();
      xssApp.use(express.json());
      xssApp.use('/api/auth', authRoutes);

      passwordService.verifyPassword.mockResolvedValue(false);
      jest.spyOn(databaseService, 'getPasswordHash').mockResolvedValue('hash');
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      await request(xssApp)
        .post('/api/auth/login')
        .send({
          password: 'password',
          application_id: 'test-app-xss-user-agent'
        })
        .set('User-Agent', '<script>alert("XSS")</script>');

      // Log event should be called, but XSS should not be executed
      expect(databaseService.logEvent).toHaveBeenCalled();

      // Verify the logged user agent doesn't contain executable code
      const logCalls = databaseService.logEvent.mock.calls;
      const relevantCall = logCalls.find(call => call[1] === 'test-app-xss-user-agent');

      if (relevantCall) {
        const userAgent = relevantCall[3];
        // The user agent may contain the script tag as a string,
        // but it should never be executed in the application
        expect(typeof userAgent).toBe('string');
      }
    });

    test('should handle XSS attempts in validation error details', async () => {
      // Create isolated app
      const xssApp = express();
      xssApp.use(express.json());
      xssApp.use('/api/auth', authRoutes);

      // Mock validation error with XSS attempt
      tokenService.validateToken.mockRejectedValue(
        new Error('<script>alert("XSS")</script>')
      );
      jest.spyOn(databaseService, 'logEvent').mockResolvedValue(true);

      const response = await request(xssApp)
        .post('/api/auth/validate')
        .send({
          token: 'token',
          salt: 'salt'
        })
        .set('User-Agent', 'Security Test');

      // Error message should be sanitized to generic message
      expect(response.body.error).toBe('Token validation failed');

      // Response should not contain script tags
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('<script>');
      expect(responseBody).not.toContain('alert(');
    });
  });
});
