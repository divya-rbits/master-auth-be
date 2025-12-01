const request = require('supertest');
const express = require('express');
const { corsMiddleware, getAllowedOrigins } = require('../../src/middleware/corsConfig');

// Mock environment variable
const originalEnv = process.env.ALLOWED_ORIGINS;

describe('CORS Configuration Middleware', () => {
  let app;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(corsMiddleware);
    app.get('/test', (req, res) => {
      res.json({ success: true });
    });
    app.post('/test', (req, res) => {
      res.json({ success: true });
    });
    app.put('/test', (req, res) => {
      res.json({ success: true });
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env.ALLOWED_ORIGINS = originalEnv;
  });

  describe('getAllowedOrigins', () => {
    it('should parse comma-separated origins from environment variable', () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
      const origins = getAllowedOrigins();
      expect(origins).toEqual(['http://localhost:3000', 'https://example.com']);
    });

    it('should handle whitespace in origin list', () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000, https://example.com , http://test.com';
      const origins = getAllowedOrigins();
      expect(origins).toEqual(['http://localhost:3000', 'https://example.com', 'http://test.com']);
    });

    it('should return empty array when ALLOWED_ORIGINS is not set', () => {
      delete process.env.ALLOWED_ORIGINS;
      const origins = getAllowedOrigins();
      expect(origins).toEqual([]);
    });

    it('should filter out empty strings', () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,,https://example.com';
      const origins = getAllowedOrigins();
      expect(origins).toEqual(['http://localhost:3000', 'https://example.com']);
    });
  });

  describe('Origin Validation', () => {
    beforeEach(() => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
    });

    it('should allow requests from whitelisted origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should allow requests with no origin header', async () => {
      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(200);
    });

    it('should reject requests from non-whitelisted origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://malicious-site.com');

      // CORS middleware blocks the request, no CORS headers present
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should allow multiple whitelisted origins', async () => {
      const response1 = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      const response2 = await request(app)
        .get('/test')
        .set('Origin', 'https://example.com');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });

  describe('Allowed Methods', () => {
    beforeEach(() => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    });

    it('should allow GET requests', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
    });

    it('should allow POST requests', async () => {
      const response = await request(app)
        .post('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
    });

    it('should not allow PUT requests', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'PUT');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).not.toContain('PUT');
    });

    it('should return allowed methods in preflight request', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('Allowed Headers', () => {
    beforeEach(() => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    });

    it('should allow Content-Type header', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });

    it('should allow Authorization header', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });

    it('should not allow non-whitelisted headers', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'X-Custom-Header');

      expect(response.status).toBe(204);
      const allowedHeaders = response.headers['access-control-allow-headers'] || '';
      expect(allowedHeaders).not.toContain('X-Custom-Header');
    });
  });

  describe('Credentials Support', () => {
    beforeEach(() => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    });

    it('should enable credentials in response', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should enable credentials in preflight response', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Preflight Request Handling', () => {
    beforeEach(() => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
    });

    it('should include max-age header in preflight response', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-max-age']).toBe('600');
    });
  });
});
