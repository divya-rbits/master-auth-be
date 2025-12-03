const request = require('supertest');
const express = require('express');
const { errorHandler } = require('../../src/middleware/errorHandler');
const {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  InternalServerError
} = require('../../src/utils/errors');
const logger = require('../../src/config/logger');

describe('Error Handler Middleware', () => {
  let app;
  let loggerErrorSpy;
  let loggerWarnSpy;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Spy on logger methods to verify logging
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  describe('Validation Errors (400)', () => {
    test('should handle ValidationError with 400 status', async () => {
      app.get('/test', (req, res, next) => {
        next(new ValidationError('Invalid input data'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid input data');
      expect(response.body.error.type).toBe('ValidationError');
      expect(response.body.error.statusCode).toBe(400);
    });

    test('should handle validation error with details', async () => {
      app.post('/test', (req, res, next) => {
        const error = new ValidationError('Validation failed', {
          fields: ['email', 'password']
        });
        next(error);
      });
      app.use(errorHandler);

      const response = await request(app).post('/test');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.details).toEqual({ fields: ['email', 'password'] });
    });
  });

  describe('Authentication Errors (401)', () => {
    test('should handle AuthenticationError with 401 status', async () => {
      app.get('/test', (req, res, next) => {
        next(new AuthenticationError('Invalid credentials'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid credentials');
      expect(response.body.error.type).toBe('AuthenticationError');
      expect(response.body.error.statusCode).toBe(401);
    });

    test('should handle token expired authentication error', async () => {
      app.get('/test', (req, res, next) => {
        next(new AuthenticationError('Token has expired'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Token has expired');
    });
  });

  describe('Authorization Errors (403)', () => {
    test('should handle AuthorizationError with 403 status', async () => {
      app.get('/test', (req, res, next) => {
        next(new AuthorizationError('Insufficient permissions'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Insufficient permissions');
      expect(response.body.error.type).toBe('AuthorizationError');
      expect(response.body.error.statusCode).toBe(403);
    });
  });

  describe('Not Found Errors (404)', () => {
    test('should handle NotFoundError with 404 status', async () => {
      app.get('/test', (req, res, next) => {
        next(new NotFoundError('Resource not found'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Resource not found');
      expect(response.body.error.type).toBe('NotFoundError');
      expect(response.body.error.statusCode).toBe(404);
    });
  });

  describe('Internal Server Errors (500)', () => {
    test('should handle InternalServerError with 500 status', async () => {
      app.get('/test', (req, res, next) => {
        next(new InternalServerError('Database connection failed'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Database connection failed');
      expect(response.body.error.type).toBe('InternalServerError');
      expect(response.body.error.statusCode).toBe(500);
    });

    test('should handle generic Error as 500', async () => {
      app.get('/test', (req, res, next) => {
        next(new Error('Unexpected error'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Unexpected error');
      expect(response.body.error.statusCode).toBe(500);
    });
  });

  describe('Sensitive Data Protection', () => {
    test('should not expose stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.get('/test', (req, res, next) => {
        const error = new Error('Critical error');
        error.stack = 'SENSITIVE STACK TRACE';
        next(error);
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body.error).not.toHaveProperty('stack');

      process.env.NODE_ENV = originalEnv;
    });

    test('should not expose internal error details', async () => {
      app.get('/test', (req, res, next) => {
        const error = new Error('Database error');
        error.sqlMessage = 'SELECT * FROM users WHERE password = "secret"';
        error.internalCode = 'DB_ERR_001';
        next(error);
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.body).not.toHaveProperty('sqlMessage');
      expect(response.body).not.toHaveProperty('internalCode');
      expect(response.body.error).not.toHaveProperty('sqlMessage');
      expect(response.body.error).not.toHaveProperty('internalCode');
    });

    test('should sanitize error messages in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.get('/test', (req, res, next) => {
        next(new InternalServerError('Internal server error'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Internal server error');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Consistent Error Format', () => {
    test('should always return consistent error structure', async () => {
      const errorTypes = [
        new ValidationError('Test'),
        new AuthenticationError('Test'),
        new AuthorizationError('Test'),
        new NotFoundError('Test'),
        new InternalServerError('Test')
      ];

      for (const error of errorTypes) {
        app = express();
        app.get('/test', (req, res, next) => next(error));
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('type');
        expect(response.body.error).toHaveProperty('statusCode');
      }
    });

    test('should include error type in response', async () => {
      app.get('/test', (req, res, next) => {
        next(new ValidationError('Test error'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.body.error.type).toBe('ValidationError');
    });
  });

  describe('Error Logging', () => {
    test('should log errors with error level', async () => {
      app.get('/test', (req, res, next) => {
        next(new InternalServerError('Critical error'));
      });
      app.use(errorHandler);

      await request(app).get('/test');

      expect(loggerErrorSpy).toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Server error occurred'),
        expect.any(Object)
      );
    });

    test('should log validation errors with warn level', async () => {
      app.get('/test', (req, res, next) => {
        next(new ValidationError('Invalid input'));
      });
      app.use(errorHandler);

      await request(app).get('/test');

      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    test('should include request info in logs', async () => {
      app.get('/test', (req, res, next) => {
        next(new Error('Test error'));
      });
      app.use(errorHandler);

      await request(app).get('/test');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'GET',
          url: '/test'
        })
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle errors without message', async () => {
      app.get('/test', (req, res, next) => {
        const error = new Error();
        next(error);
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBeDefined();
    });

    test('should handle non-Error objects', async () => {
      app.get('/test', (req, res, next) => {
        next({ message: 'String error' });
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });
});
