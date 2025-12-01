const request = require('supertest');
const express = require('express');
const { loginLimiter, validateLimiter } = require('../../src/middleware/rateLimiter');
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
});
