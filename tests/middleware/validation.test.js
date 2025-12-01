const request = require('supertest');
const express = require('express');
const {
  validateLogin,
  validateTokenRequest,
  validateTokenStatus,
  validateRevokeToken
} = require('../../src/middleware/validation');

describe('Validation Middleware', () => {
  describe('validateLogin', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/test-login', validateLogin, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow valid login request', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          password: 'validPassword123',
          application_id: 'web-app-001'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject request with missing password', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          application_id: 'web-app-001'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('password is required');
    });

    test('should reject request with null password', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          password: null,
          application_id: 'web-app-001'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('password is required');
    });

    test('should reject request with empty string password', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          password: '',
          application_id: 'web-app-001'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('password is required');
    });

    test('should reject request with whitespace-only password', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          password: '   ',
          application_id: 'web-app-001'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('password is required');
    });

    test('should reject request with missing application_id', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          password: 'validPassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('application_id is required');
    });

    test('should reject request with null application_id', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          password: 'validPassword123',
          application_id: null
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('application_id is required');
    });

    test('should reject request with empty string application_id', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          password: 'validPassword123',
          application_id: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('application_id is required');
    });

    test('should reject request with whitespace-only application_id', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          password: 'validPassword123',
          application_id: '   '
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('application_id is required');
    });
  });

  describe('validateTokenRequest', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/test-token', validateTokenRequest, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow valid token request', async () => {
      const response = await request(app)
        .post('/test-token')
        .send({
          token: 'validJWEToken',
          salt: 'validSalt123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject request with missing token', async () => {
      const response = await request(app)
        .post('/test-token')
        .send({
          salt: 'validSalt123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('token is required');
    });

    test('should reject request with null token', async () => {
      const response = await request(app)
        .post('/test-token')
        .send({
          token: null,
          salt: 'validSalt123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('token is required');
    });

    test('should reject request with empty string token', async () => {
      const response = await request(app)
        .post('/test-token')
        .send({
          token: '',
          salt: 'validSalt123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('token is required');
    });

    test('should reject request with whitespace-only token', async () => {
      const response = await request(app)
        .post('/test-token')
        .send({
          token: '   ',
          salt: 'validSalt123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('token is required');
    });

    test('should reject request with missing salt', async () => {
      const response = await request(app)
        .post('/test-token')
        .send({
          token: 'validJWEToken'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('salt is required');
    });

    test('should reject request with null salt', async () => {
      const response = await request(app)
        .post('/test-token')
        .send({
          token: 'validJWEToken',
          salt: null
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('salt is required');
    });

    test('should reject request with empty string salt', async () => {
      const response = await request(app)
        .post('/test-token')
        .send({
          token: 'validJWEToken',
          salt: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('salt is required');
    });

    test('should reject request with whitespace-only salt', async () => {
      const response = await request(app)
        .post('/test-token')
        .send({
          token: 'validJWEToken',
          salt: '   '
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('salt is required');
    });
  });

  describe('validateTokenStatus', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.get('/test-status', validateTokenStatus, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow valid request with token in body', async () => {
      const response = await request(app)
        .get('/test-status')
        .send({
          token: 'validJWEToken',
          salt: 'validSalt123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should allow valid request with token in Authorization header', async () => {
      const response = await request(app)
        .get('/test-status')
        .set('Authorization', 'Bearer validJWEToken')
        .send({
          salt: 'validSalt123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject request with missing token (no body, no header)', async () => {
      const response = await request(app)
        .get('/test-status')
        .send({
          salt: 'validSalt123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('token is required');
    });

    test('should reject request with missing salt', async () => {
      const response = await request(app)
        .get('/test-status')
        .send({
          token: 'validJWEToken'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('salt is required');
    });

    test('should reject request with null salt', async () => {
      const response = await request(app)
        .get('/test-status')
        .send({
          token: 'validJWEToken',
          salt: null
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('salt is required');
    });

    test('should reject request with empty string salt', async () => {
      const response = await request(app)
        .get('/test-status')
        .send({
          token: 'validJWEToken',
          salt: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('salt is required');
    });
  });

  describe('validateRevokeToken', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/test-revoke', validateRevokeToken, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should allow valid revoke request', async () => {
      const response = await request(app)
        .post('/test-revoke')
        .send({
          requestingToken: 'validRequestingToken',
          requestingSalt: 'validRequestingSalt',
          targetToken: 'validTargetToken',
          targetSalt: 'validTargetSalt'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject request with missing requestingToken', async () => {
      const response = await request(app)
        .post('/test-revoke')
        .send({
          requestingSalt: 'validRequestingSalt',
          targetToken: 'validTargetToken',
          targetSalt: 'validTargetSalt'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('requestingToken is required');
    });

    test('should reject request with missing requestingSalt', async () => {
      const response = await request(app)
        .post('/test-revoke')
        .send({
          requestingToken: 'validRequestingToken',
          targetToken: 'validTargetToken',
          targetSalt: 'validTargetSalt'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('requestingSalt is required');
    });

    test('should reject request with missing targetToken', async () => {
      const response = await request(app)
        .post('/test-revoke')
        .send({
          requestingToken: 'validRequestingToken',
          requestingSalt: 'validRequestingSalt',
          targetSalt: 'validTargetSalt'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('targetToken is required');
    });

    test('should reject request with missing targetSalt', async () => {
      const response = await request(app)
        .post('/test-revoke')
        .send({
          requestingToken: 'validRequestingToken',
          requestingSalt: 'validRequestingSalt',
          targetToken: 'validTargetToken'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('targetSalt is required');
    });

    test('should reject request with empty string requestingToken', async () => {
      const response = await request(app)
        .post('/test-revoke')
        .send({
          requestingToken: '',
          requestingSalt: 'validRequestingSalt',
          targetToken: 'validTargetToken',
          targetSalt: 'validTargetSalt'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('requestingToken is required');
    });

    test('should reject request with whitespace-only targetToken', async () => {
      const response = await request(app)
        .post('/test-revoke')
        .send({
          requestingToken: 'validRequestingToken',
          requestingSalt: 'validRequestingSalt',
          targetToken: '   ',
          targetSalt: 'validTargetSalt'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('targetToken is required');
    });
  });

  describe('Validation Error Response Format', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/test', validateLogin, (req, res) => {
        res.status(200).json({ success: true });
      });
    });

    test('should return consistent error response structure', async () => {
      const response = await request(app)
        .post('/test')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
      expect(typeof response.body.error).toBe('string');
    });

    test('should not call next middleware on validation failure', async () => {
      let controllerCalled = false;

      app.post('/test2', validateLogin, (req, res) => {
        controllerCalled = true;
        res.status(200).json({ success: true });
      });

      await request(app)
        .post('/test2')
        .send({});

      expect(controllerCalled).toBe(false);
    });
  });
});
