const request = require('supertest');
const express = require('express');
const {
  loginLimiter,
  validateLimiter,
  adminLimiter,
  passwordChangeLimiter,
  exportLimiter,
  tokenRevocationLimiter
} = require('../../src/middleware/rateLimiter');
const databaseService = require('../../src/services/database');

// Mock the database service
jest.mock('../../src/services/database');

describe('Rate Limiter Middleware', () => {
  let app;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    databaseService.logEvent.mockResolvedValue();
  });

  describe('Login Rate Limiter', () => {
    beforeEach(() => {
      // Create a fresh app for each test to reset rate limit state
      app = express();
      app.use(express.json());
      app.post('/test-login', loginLimiter, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow requests within rate limit (5 per minute)', async () => {
      // Make 5 requests - all should succeed
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/test-login')
          .send({ test: 'data' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    test('should block 6th request and return 429', async () => {
      // Make 5 requests to hit the limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/test-login')
          .send({ test: 'data' });
      }

      // 6th request should be blocked
      const response = await request(app)
        .post('/test-login')
        .send({ test: 'data' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Too many login requests, please try again later');
    });

    test('should log rate limit violation', async () => {
      // Make 5 requests to hit the limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/test-login')
          .send({ test: 'data' });
      }

      // 6th request should trigger logging
      await request(app)
        .post('/test-login')
        .send({ test: 'data' });

      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'rate_limit_exceeded',
        'unknown',
        expect.any(String), // IP address
        expect.any(String), // User agent
        expect.objectContaining({
          endpoint: '/test-login',
          limit: 5
        })
      );
    });

    test('should include rate limit headers in response', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({ test: 'data' });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Validate Rate Limiter', () => {
    beforeEach(() => {
      // Create a fresh app for each test to reset rate limit state
      app = express();
      app.use(express.json());
      app.post('/test-validate', validateLimiter, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow requests within rate limit (100 per minute)', async () => {
      // Make 100 requests - all should succeed
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .post('/test-validate')
            .send({ test: 'data' })
        );
      }

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    test('should block 101st request and return 429', async () => {
      // Make 100 requests to hit the limit
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .post('/test-validate')
            .send({ test: 'data' })
        );
      }
      await Promise.all(requests);

      // 101st request should be blocked
      const response = await request(app)
        .post('/test-validate')
        .send({ test: 'data' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Too many validation requests, please try again later');
    });

    test('should log rate limit violation', async () => {
      // Make 100 requests to hit the limit
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .post('/test-validate')
            .send({ test: 'data' })
        );
      }
      await Promise.all(requests);

      // 101st request should trigger logging
      await request(app)
        .post('/test-validate')
        .send({ test: 'data' });

      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'rate_limit_exceeded',
        'unknown',
        expect.any(String), // IP address
        expect.any(String), // User agent
        expect.objectContaining({
          endpoint: '/test-validate',
          limit: 100
        })
      );
    });

    test('should include rate limit headers in response', async () => {
      const response = await request(app)
        .post('/test-validate')
        .send({ test: 'data' });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Rate Limiter Configuration', () => {
    test('login limiter should use IP-based rate limiting', async () => {
      app = express();
      app.use(express.json());
      app.post('/test-login', loginLimiter, (req, res) => {
        res.status(200).json({ success: true });
      });

      // Requests from same IP should count toward limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/test-login')
          .set('X-Forwarded-For', '192.168.1.1')
          .send({ test: 'data' });
      }

      const response = await request(app)
        .post('/test-login')
        .set('X-Forwarded-For', '192.168.1.1')
        .send({ test: 'data' });

      expect(response.status).toBe(429);
    });
  });

  describe('Admin Rate Limiter', () => {
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.get('/test-admin', adminLimiter, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow 100 requests per minute', async () => {
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(request(app).get('/test-admin'));
      }

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should block 101st request and return 429', async () => {
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(request(app).get('/test-admin'));
      }
      await Promise.all(requests);

      const response = await request(app).get('/test-admin');
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many admin requests, please try again later');
    });

    test('should log rate limit violation', async () => {
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(request(app).get('/test-admin'));
      }
      await Promise.all(requests);

      await request(app).get('/test-admin');

      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'rate_limit_exceeded',
        'unknown',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          endpoint: '/test-admin',
          limit: 100
        })
      );
    });
  });

  describe('Password Change Rate Limiter', () => {
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.put('/test-password/:id', passwordChangeLimiter, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow 5 password changes per hour per application', async () => {
      const appId = 'test-app-123';

      for (let i = 0; i < 5; i++) {
        const response = await request(app).put(`/test-password/${appId}`);
        expect(response.status).toBe(200);
      }
    });

    test('should block 6th password change attempt and return 429', async () => {
      const appId = 'test-app-123';

      for (let i = 0; i < 5; i++) {
        await request(app).put(`/test-password/${appId}`);
      }

      const response = await request(app).put(`/test-password/${appId}`);
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many password change requests, please try again later');
    });

    test('should rate limit per application ID, not per IP', async () => {
      const appId1 = 'test-app-123';
      const appId2 = 'test-app-456';

      // Exhaust limit for first app
      for (let i = 0; i < 5; i++) {
        await request(app).put(`/test-password/${appId1}`);
      }

      // Next request for first app should fail
      const response1 = await request(app).put(`/test-password/${appId1}`);
      expect(response1.status).toBe(429);

      // But request for second app should succeed (different key)
      const response2 = await request(app).put(`/test-password/${appId2}`);
      expect(response2.status).toBe(200);
    });
  });

  describe('Export Rate Limiter', () => {
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.get('/test-export', exportLimiter, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow 10 export requests per hour', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test-export');
        expect(response.status).toBe(200);
      }
    });

    test('should block 11th export request and return 429', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app).get('/test-export');
      }

      const response = await request(app).get('/test-export');
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many log export requests, please try again later');
    });

    test('should log rate limit violation', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app).get('/test-export');
      }

      await request(app).get('/test-export');

      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'rate_limit_exceeded',
        'unknown',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          endpoint: '/test-export',
          limit: 10
        })
      );
    });
  });

  describe('Token Revocation Rate Limiter', () => {
    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/test-revoke', tokenRevocationLimiter, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow 50 revocation requests per hour', async () => {
      for (let i = 0; i < 50; i++) {
        const response = await request(app).post('/test-revoke');
        expect(response.status).toBe(200);
      }
    });

    test('should block 51st revocation request and return 429', async () => {
      for (let i = 0; i < 50; i++) {
        await request(app).post('/test-revoke');
      }

      const response = await request(app).post('/test-revoke');
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many token revocation requests, please try again later');
    });

    test('should log rate limit violation', async () => {
      for (let i = 0; i < 50; i++) {
        await request(app).post('/test-revoke');
      }

      await request(app).post('/test-revoke');

      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'rate_limit_exceeded',
        'unknown',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          endpoint: '/test-revoke',
          limit: 50
        })
      );
    });

    test('should include rate limit headers in response', async () => {
      const response = await request(app).post('/test-revoke');

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });
});
