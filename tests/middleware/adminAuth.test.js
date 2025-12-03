const request = require('supertest');
const express = require('express');
const { adminAuthMiddleware } = require('../../src/middleware/adminAuth');
const { errorHandler } = require('../../src/middleware/errorHandler');

describe('Admin Authentication Middleware', () => {
  let app;

  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set default admin credentials for testing
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'admin_password_here';

    app = express();
    app.use(express.json());

    // Test route protected by admin auth
    app.get('/admin/test', adminAuthMiddleware, (req, res) => {
      res.json({ success: true, message: 'Admin authenticated' });
    });

    // Add error handler
    app.use(errorHandler);
  });

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  describe('Valid Authentication', () => {
    test('should allow access with correct credentials', async () => {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'admin_password_here';
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Basic ${credentials}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle credentials with special characters', async () => {
      // Temporarily set env vars with special characters
      const originalUsername = process.env.ADMIN_USERNAME;
      const originalPassword = process.env.ADMIN_PASSWORD;

      process.env.ADMIN_USERNAME = 'admin@test';
      process.env.ADMIN_PASSWORD = 'pass:word!@#';

      const credentials = Buffer.from('admin@test:pass:word!@#').toString('base64');

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Basic ${credentials}`);

      expect(response.status).toBe(200);

      // Restore original env vars
      process.env.ADMIN_USERNAME = originalUsername;
      process.env.ADMIN_PASSWORD = originalPassword;
    });
  });

  describe('Invalid Authentication', () => {
    test('should reject request without Authorization header', async () => {
      const response = await request(app).get('/admin/test');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication required');
    });

    test('should reject request with invalid Authorization format', async () => {
      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', 'InvalidFormat credentials');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject request with malformed base64', async () => {
      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', 'Basic invalid!!!base64');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject request with incorrect username', async () => {
      const password = process.env.ADMIN_PASSWORD || 'admin_password_here';
      const credentials = Buffer.from(`wronguser:${password}`).toString('base64');

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Basic ${credentials}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid credentials');
    });

    test('should reject request with incorrect password', async () => {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const credentials = Buffer.from(`${username}:wrongpassword`).toString('base64');

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Basic ${credentials}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid credentials');
    });

    test('should reject request with missing username', async () => {
      const password = process.env.ADMIN_PASSWORD || 'admin_password_here';
      const credentials = Buffer.from(`:${password}`).toString('base64');

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Basic ${credentials}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject request with missing password', async () => {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const credentials = Buffer.from(`${username}:`).toString('base64');

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Basic ${credentials}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject request with empty credentials', async () => {
      const credentials = Buffer.from(':').toString('base64');

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Basic ${credentials}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Environment Configuration', () => {
    test('should fail gracefully if ADMIN_USERNAME not configured', async () => {
      const originalUsername = process.env.ADMIN_USERNAME;
      delete process.env.ADMIN_USERNAME;

      const credentials = Buffer.from('admin:password').toString('base64');

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Basic ${credentials}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      process.env.ADMIN_USERNAME = originalUsername;
    });

    test('should fail gracefully if ADMIN_PASSWORD not configured', async () => {
      const originalPassword = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_PASSWORD;

      const credentials = Buffer.from('admin:password').toString('base64');

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Basic ${credentials}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      process.env.ADMIN_PASSWORD = originalPassword;
    });
  });

  describe('Security Headers', () => {
    test('should include WWW-Authenticate header on 401', async () => {
      const response = await request(app).get('/admin/test');

      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Basic realm="Admin Area"');
    });
  });

  describe('Response Format', () => {
    test('should return consistent error format', async () => {
      const response = await request(app).get('/admin/test');

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('statusCode', 401);
    });
  });
});
