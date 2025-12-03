const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../src/routes/admin');
const { errorHandler } = require('../../src/middleware/errorHandler');
const databaseService = require('../../src/services/database');
const adminAuthService = require('../../src/services/adminAuth');

// Mock database service
jest.mock('../../src/services/database');

describe('Admin Logs Endpoint - Integration Tests', () => {
  let app;
  let validToken;

  beforeAll(() => {
    // Set admin credentials and JWT secret
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'admin_password_here';
    process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret';
    process.env.ADMIN_SESSION_TIMEOUT = '1800';
  });

  beforeEach(() => {
    // Generate a valid token for tests
    validToken = adminAuthService.generateAdminToken('admin');

    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use(errorHandler);

    jest.clearAllMocks();
  });

  describe('GET /api/admin/logs', () => {
    test('should return logs with valid authentication', async () => {
      const mockResult = {
        logs: [
          {
            id: '1',
            event_type: 'login_success',
            application_id: 'test-app',
            ip_address: '127.0.0.1',
            user_agent: 'Test Agent',
            details: {},
            created_at: '2025-12-02T10:00:00Z'
          }
        ],
        total: 1,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toHaveLength(1);
      expect(response.body.data.pagination.total).toBe(1);
    });

    test('should reject request without authentication', async () => {
      const response = await request(app).get('/api/admin/logs');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject request with invalid credentials', async () => {
      const invalidToken = 'invalid.jwt.token';

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should filter by event_type', async () => {
      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs?event_type=login_success')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'login_success'
        })
      );
    });

    test('should filter by application_id', async () => {
      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs?application_id=test-app')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: 'test-app'
        })
      );
    });

    test('should filter by date range', async () => {
      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs?start_date=2025-12-01T00:00:00Z&end_date=2025-12-02T23:59:59Z')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2025-12-01T00:00:00Z',
          endDate: '2025-12-02T23:59:59Z'
        })
      );
    });

    test('should handle pagination parameters', async () => {
      const mockResult = {
        logs: [],
        total: 100,
        limit: 25,
        offset: 50
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs?limit=25&offset=50')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
          offset: 50
        })
      );
      expect(response.body.data.pagination.limit).toBe(25);
      expect(response.body.data.pagination.offset).toBe(50);
    });

    test('should combine multiple filters', async () => {
      const mockResult = {
        logs: [],
        total: 5,
        limit: 10,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs?event_type=login_success&application_id=test-app&limit=10')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: 'login_success',
        applicationId: 'test-app',
        startDate: null,
        endDate: null,
        limit: 10,
        offset: 0
      });
    });

    test('should return empty array when no logs found', async () => {
      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.logs).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
      expect(response.body.data.pagination.hasMore).toBe(false);
    });

    test('should handle database errors', async () => {
      databaseService.queryAuditLogs.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    test('should include rate limit headers', async () => {
      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    test('should calculate hasMore correctly', async () => {
      const mockResult = {
        logs: new Array(50).fill({ id: '1' }),
        total: 150,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.hasMore).toBe(true);
    });

    test('should handle special characters in filters', async () => {
      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/admin/logs?application_id=test-app%2Bspecial')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: 'test-app+special'
        })
      );
    });
  });
});
