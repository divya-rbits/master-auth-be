const request = require('supertest');
const express = require('express');
const { adminAuthMiddleware } = require('../../src/middleware/adminAuth');
const { errorHandler } = require('../../src/middleware/errorHandler');
const adminAuthService = require('../../src/services/adminAuth');

describe('Admin Authentication Middleware (JWT)', () => {
  let app;
  let validToken;

  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set default admin credentials for testing
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'admin_password_here';
    process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret';
    process.env.ADMIN_SESSION_TIMEOUT = '1800';

    // Generate a valid token for tests
    validToken = adminAuthService.generateAdminToken('admin');

    app = express();
    app.use(express.json());

    // Test route protected by admin auth
    app.get('/admin/test', adminAuthMiddleware, (req, res) => {
      res.json({
        success: true,
        message: 'Admin authenticated',
        username: req.admin.username
      });
    });

    // Add error handler
    app.use(errorHandler);
  });

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  describe('Valid Authentication', () => {
    test('should allow access with valid JWT token', async () => {
      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.username).toBe('admin');
    });

    test('should attach admin user to request object', async () => {
      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('admin');
    });

    test('should handle token with extra whitespace', async () => {
      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Bearer  ${validToken}  `);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
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
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Bearer token required');
    });

    test('should reject request with missing token', async () => {
      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Token not provided');
    });

    test('should reject request with malformed JWT token', async () => {
      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject expired JWT token', async () => {
      // Generate an expired token
      process.env.ADMIN_SESSION_TIMEOUT = '0';
      const expiredToken = adminAuthService.generateAdminToken('admin');

      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject token signed with wrong secret', async () => {
      const jwt = require('jsonwebtoken');
      const wrongToken = jwt.sign(
        { username: 'admin', role: 'admin' },
        'wrong-secret',
        { expiresIn: '30m' }
      );

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Bearer ${wrongToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Environment Configuration', () => {
    test('should fail gracefully if ADMIN_JWT_SECRET not configured', async () => {
      const originalSecret = process.env.ADMIN_JWT_SECRET;
      delete process.env.ADMIN_JWT_SECRET;

      const response = await request(app)
        .get('/admin/test')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Admin JWT secret not configured');

      process.env.ADMIN_JWT_SECRET = originalSecret;
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
