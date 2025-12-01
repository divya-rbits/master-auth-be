const request = require('supertest');
const express = require('express');
const { securityHeadersMiddleware } = require('../../src/middleware/securityHeaders');

describe('Security Headers Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(securityHeadersMiddleware);

    // Simple test route
    app.get('/test', (req, res) => {
      res.json({ message: 'test' });
    });
  });

  describe('Helmet.js Security Headers', () => {
    test('should apply Helmet.js middleware', async () => {
      const response = await request(app).get('/test');

      // Helmet adds several security headers by default
      expect(response.headers).toBeDefined();
    });

    test('should set Content-Security-Policy header', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    test('should set X-Frame-Options to DENY', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should set X-Content-Type-Options to nosniff', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should remove X-Powered-By header', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('should set Strict-Transport-Security (HSTS) header', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=');
    });

    test('should set X-DNS-Prefetch-Control to off', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });

    test('should set X-Download-Options to noopen', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-download-options']).toBe('noopen');
    });

    test('should set X-Permitted-Cross-Domain-Policies to none', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    });
  });

  describe('Security Headers on Different Routes', () => {
    test('should apply security headers to all routes', async () => {
      app.get('/another-route', (req, res) => {
        res.json({ data: 'test' });
      });

      const response = await request(app).get('/another-route');

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    test('should apply security headers to error responses', async () => {
      app.get('/error-route', (req, res) => {
        res.status(500).json({ error: 'test error' });
      });

      const response = await request(app).get('/error-route');

      expect(response.status).toBe(500);
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
