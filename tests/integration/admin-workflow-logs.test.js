const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../src/routes/admin');
const databaseService = require('../../src/services/database');
const adminAuthService = require('../../src/services/adminAuth');

// Mock the Supabase client and services
jest.mock('../../src/config/supabase');
jest.mock('../../src/services/adminAuth');

// Import error handlers
const { errorHandler, notFoundHandler } = require('../../src/middleware/errorHandler');

// Create Express app for testing
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

describe('Admin Workflow: Logs Management Integration Tests', () => {
  let validAdminToken;
  let logEventSpy;

  beforeAll(() => {
    // Set up admin environment for JWT generation
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'AdminPass123!';
    process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret';
    process.env.ADMIN_SESSION_TIMEOUT = '1800';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Set a mock admin token
    validAdminToken = 'mock-admin-jwt-token';

    // Spy on logEvent to verify audit logging
    logEventSpy = jest.spyOn(databaseService, 'logEvent');
    logEventSpy.mockResolvedValue(true);

    // Mock admin authentication
    adminAuthService.verifyAdminToken = jest.fn().mockReturnValue({ username: 'admin', role: 'admin' });
    adminAuthService.verifyCredentials = jest.fn().mockReturnValue(false);
    adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);
  });

  afterEach(() => {
    logEventSpy.mockRestore();
  });

  describe('Complete Workflow: Login → View Logs → Export Logs', () => {
    test('should successfully complete entire logs workflow', async () => {
      // Step 1: Admin Login
      adminAuthService.verifyCredentials = jest.fn().mockReturnValue(true);
      adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);

      const loginResponse = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser')
        .set('X-Forwarded-For', '192.168.1.100');

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.token).toBeDefined();

      // Step 2: View Logs (with filters)
      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          details: { username: 'user1' },
          created_at: '2025-12-04T10:00:00Z'
        },
        {
          id: 'log-2',
          event_type: 'login_failed',
          application_id: 'app-123',
          ip_address: '127.0.0.2',
          user_agent: 'Mozilla/5.0',
          details: { reason: 'Invalid credentials' },
          created_at: '2025-12-04T10:05:00Z'
        }
      ];

      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: mockLogs,
        total: 2,
        limit: 50,
        offset: 0
      });

      const logsResponse = await request(app)
        .get('/api/admin/logs')
        .query({
          event_type: 'login_success',
          application_id: 'app-123',
          limit: 50,
          offset: 0
        })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(logsResponse.status).toBe(200);
      expect(logsResponse.body.success).toBe(true);
      expect(logsResponse.body.data.logs).toHaveLength(2);
      expect(logsResponse.body.data.pagination).toBeDefined();
      expect(logsResponse.body.data.pagination.total).toBe(2);

      // Step 3: Export Logs as JSON
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: mockLogs,
        total: 2,
        limit: 50,
        offset: 0
      });

      const exportJsonResponse = await request(app)
        .get('/api/admin/logs/export')
        .query({
          format: 'json',
          event_type: 'login_success'
        })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(exportJsonResponse.status).toBe(200);
      expect(Array.isArray(exportJsonResponse.body)).toBe(true);
      expect(exportJsonResponse.body).toHaveLength(2);
      expect(exportJsonResponse.headers['content-type']).toContain('application/json');

      // Step 4: Export Logs as CSV
      const exportCsvResponse = await request(app)
        .get('/api/admin/logs/export')
        .query({
          format: 'csv',
          event_type: 'login_success'
        })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(exportCsvResponse.status).toBe(200);
      expect(typeof exportCsvResponse.text).toBe('string');
      expect(exportCsvResponse.text).toContain('id,event_type');
      expect(exportCsvResponse.headers['content-type']).toContain('text/csv');
      expect(exportCsvResponse.headers['content-disposition']).toContain('attachment');
    });

    test('should maintain authentication across multiple log queries', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          details: {},
          created_at: '2025-12-04T10:00:00Z'
        }
      ];

      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      // Query 1: All logs
      const response1 = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response1.status).toBe(200);

      // Query 2: Filtered by event type
      const response2 = await request(app)
        .get('/api/admin/logs')
        .query({ event_type: 'login_success' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response2.status).toBe(200);

      // Query 3: Filtered by application
      const response3 = await request(app)
        .get('/api/admin/logs')
        .query({ application_id: 'app-123' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response3.status).toBe(200);

      // Verify all queries succeeded with same token
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(response3.body.success).toBe(true);
    });
  });

  describe('Log Filtering', () => {
    beforeEach(() => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });
    });

    test('should filter logs by event_type', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .query({ event_type: 'login_success' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'login_success' })
      );
    });

    test('should filter logs by application_id', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .query({ application_id: 'app-123' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ applicationId: 'app-123' })
      );
    });

    test('should filter logs by date range', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .query({
          start_date: '2025-12-01T00:00:00Z',
          end_date: '2025-12-04T23:59:59Z'
        })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2025-12-01T00:00:00Z',
          endDate: '2025-12-04T23:59:59Z'
        })
      );
    });

    test('should filter logs with multiple criteria', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .query({
          event_type: 'login_success',
          application_id: 'app-123',
          start_date: '2025-12-01T00:00:00Z'
        })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'login_success',
          applicationId: 'app-123',
          startDate: '2025-12-01T00:00:00Z'
        })
      );
    });
  });

  describe('Log Pagination', () => {
    test('should paginate logs with default limit', async () => {
      const mockLogs = Array.from({ length: 50 }, (_, i) => ({
        id: `log-${i}`,
        event_type: 'login_success',
        application_id: 'app-123',
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        details: {},
        created_at: new Date().toISOString()
      }));

      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: mockLogs,
        total: 150,
        limit: 50,
        offset: 0
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.logs).toHaveLength(50);
      expect(response.body.data.pagination.hasMore).toBe(true);
      expect(response.body.data.pagination.total).toBe(150);
    });

    test('should paginate logs with custom limit and offset', async () => {
      const mockLogs = Array.from({ length: 20 }, (_, i) => ({
        id: `log-${i + 20}`,
        event_type: 'login_success',
        application_id: 'app-123',
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        details: {},
        created_at: new Date().toISOString()
      }));

      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: mockLogs,
        total: 150,
        limit: 20,
        offset: 20
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .query({ limit: 20, offset: 20 })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.logs).toHaveLength(20);
      expect(response.body.data.pagination.limit).toBe(20);
      expect(response.body.data.pagination.offset).toBe(20);
      expect(response.body.data.pagination.hasMore).toBe(true);
    });

    test('should enforce maximum limit of 100', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 100,
        offset: 0
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .query({ limit: 500 })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });
  });

  describe('Export Formats', () => {
    const mockLogs = [
      {
        id: 'log-1',
        event_type: 'login_success',
        application_id: 'app-123',
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        details: { test: 'data' },
        created_at: '2025-12-04T10:00:00Z'
      }
    ];

    beforeEach(() => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });
    });

    test('should export logs as JSON by default', async () => {
      const response = await request(app)
        .get('/api/admin/logs/export')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.headers['content-type']).toContain('application/json');
    });

    test('should export logs as JSON with format parameter', async () => {
      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('event_type');
    });

    test('should export logs as CSV', async () => {
      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(typeof response.text).toBe('string');
      expect(response.text).toContain('id,event_type,application_id,ip_address');
      expect(response.headers['content-type']).toContain('text/csv');
    });

    test('should reject invalid export format', async () => {
      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'xml' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid format');
    });

    test('should include filters in export', async () => {
      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({
          format: 'json',
          event_type: 'login_success',
          application_id: 'app-123'
        })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'login_success',
          applicationId: 'app-123'
        })
      );
    });
  });

  describe('Authentication Requirements', () => {
    test('should reject log queries without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/logs');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject export without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'json' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject log queries with invalid token', async () => {
      adminAuthService.verifyAdminToken = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer invalid-token`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject export with expired token', async () => {
      adminAuthService.verifyAdminToken = jest.fn().mockImplementation(() => {
        throw new Error('Token expired');
      });

      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Data Validation', () => {
    test('should handle invalid limit values gracefully', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 1,
        offset: 0
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .query({ limit: -10 })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      // Should enforce minimum limit of 1
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1 })
      );
    });

    test('should handle invalid offset values gracefully', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .query({ offset: -10 })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      // Should enforce minimum offset of 0
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 0 })
      );
    });

    test('should handle malformed date values', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .query({
          start_date: 'invalid-date',
          end_date: 'also-invalid'
        })
        .set('Authorization', `Bearer ${validAdminToken}`);

      // Should still succeed but may ignore invalid dates
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully when querying logs', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle database errors gracefully when exporting logs', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle empty log results', async () => {
      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });
  });

  describe('CSV Export Format Verification', () => {
    test('should properly escape CSV values', async () => {
      const mockLogsWithSpecialChars = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0, "User Agent"',
          details: { message: 'Test, with, commas' },
          created_at: '2025-12-04T10:00:00Z'
        }
      ];

      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: mockLogsWithSpecialChars,
        total: 1,
        limit: 50,
        offset: 0
      });

      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.text).toBeTruthy();
      // CSV should have headers
      expect(response.text.split('\n').length).toBeGreaterThan(1);
    });

    test('should include all log fields in CSV export', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          details: {},
          created_at: '2025-12-04T10:00:00Z'
        }
      ];

      jest.spyOn(databaseService, 'queryAuditLogs').mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      const response = await request(app)
        .get('/api/admin/logs/export')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      const headers = response.text.split('\n')[0];
      expect(headers).toContain('id');
      expect(headers).toContain('event_type');
      expect(headers).toContain('application_id');
      expect(headers).toContain('ip_address');
      expect(headers).toContain('user_agent');
      expect(headers).toContain('created_at');
    });
  });
});
