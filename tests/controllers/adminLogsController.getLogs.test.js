const adminLogsController = require('../../src/controllers/adminLogsController');
const databaseService = require('../../src/services/database');

// Mock the database service
jest.mock('../../src/services/database');

describe('AdminLogsController - getLogs', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock request
    mockReq = {
      query: {},
      admin: {
        username: 'admin-user',
        id: 'admin-123'
      }
    };

    // Setup mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Setup mock next
    mockNext = jest.fn();
  });

  describe('Basic Query Without Filters', () => {
    test('should return logs with default pagination', async () => {
      // Mock database response
      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          details: { message: 'User logged in' },
          created_at: '2025-12-04T10:00:00Z'
        },
        {
          id: 'log-2',
          event_type: 'login_failed',
          application_id: 'app-456',
          ip_address: '192.168.1.1',
          user_agent: 'Chrome/90.0',
          details: { reason: 'Invalid password' },
          created_at: '2025-12-04T09:30:00Z'
        }
      ];

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 2,
        limit: 50,
        offset: 0
      });

      // Call controller
      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      // Verify database service was called with default parameters
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: null,
        endDate: null,
        limit: 50,
        offset: 0
      });

      // Verify response
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: mockLogs,
          pagination: {
            total: 2,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });
    });

    test('should calculate hasMore correctly when there are more results', async () => {
      databaseService.queryAuditLogs.mockResolvedValue({
        logs: Array(50).fill({ event_type: 'test' }),
        total: 150,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: expect.any(Array),
          pagination: {
            total: 150,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      });
    });

    test('should calculate hasMore correctly when on last page', async () => {
      mockReq.query = { offset: '100', limit: '50' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: Array(50).fill({ event_type: 'test' }),
        total: 150,
        limit: 50,
        offset: 100
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: expect.any(Array),
          pagination: {
            total: 150,
            limit: 50,
            offset: 100,
            hasMore: false
          }
        }
      });
    });
  });

  describe('Event Type Filter', () => {
    test('should filter by event_type when provided', async () => {
      mockReq.query = { event_type: 'login_success' };

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

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: 'login_success',
        applicationId: null,
        startDate: null,
        endDate: null,
        limit: 50,
        offset: 0
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: mockLogs,
          pagination: {
            total: 1,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });
    });

    test('should handle various event types', async () => {
      const eventTypes = [
        'login_success',
        'login_failed',
        'token_validation_success',
        'token_validation_failed',
        'logout',
        'token_refresh',
        'token_revoked',
        'token_status_check',
        'rate_limit_exceeded'
      ];

      for (const eventType of eventTypes) {
        mockReq.query = { event_type: eventType };

        databaseService.queryAuditLogs.mockResolvedValue({
          logs: [],
          total: 0,
          limit: 50,
          offset: 0
        });

        await adminLogsController.getLogs(mockReq, mockRes, mockNext);

        expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({ eventType })
        );
      }
    });
  });

  describe('Application ID Filter', () => {
    test('should filter by application_id when provided', async () => {
      mockReq.query = { application_id: 'app-123' };

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

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: 'app-123',
        startDate: null,
        endDate: null,
        limit: 50,
        offset: 0
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Date Range Filter', () => {
    test('should filter by start_date when provided', async () => {
      mockReq.query = { start_date: '2025-12-01T00:00:00Z' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: '2025-12-01T00:00:00Z',
        endDate: null,
        limit: 50,
        offset: 0
      });
    });

    test('should filter by end_date when provided', async () => {
      mockReq.query = { end_date: '2025-12-04T23:59:59Z' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: null,
        endDate: '2025-12-04T23:59:59Z',
        limit: 50,
        offset: 0
      });
    });

    test('should filter by date range when both start and end provided', async () => {
      mockReq.query = {
        start_date: '2025-12-01T00:00:00Z',
        end_date: '2025-12-04T23:59:59Z'
      };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: '2025-12-01T00:00:00Z',
        endDate: '2025-12-04T23:59:59Z',
        limit: 50,
        offset: 0
      });
    });
  });

  describe('Pagination', () => {
    test('should use custom limit when provided', async () => {
      mockReq.query = { limit: '25' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 25,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: null,
        endDate: null,
        limit: 25,
        offset: 0
      });
    });

    test('should use custom offset when provided', async () => {
      mockReq.query = { offset: '100' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 100
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: null,
        endDate: null,
        limit: 50,
        offset: 100
      });
    });

    test('should use both custom limit and offset', async () => {
      mockReq.query = { limit: '10', offset: '50' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 10,
        offset: 50
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: null,
        endDate: null,
        limit: 10,
        offset: 50
      });
    });

    test('should handle invalid limit by defaulting to 50', async () => {
      mockReq.query = { limit: 'invalid' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 })
      );
    });

    test('should handle invalid offset by defaulting to 0', async () => {
      mockReq.query = { offset: 'invalid' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 0 })
      );
    });

    test('should handle negative limit by defaulting to 50', async () => {
      mockReq.query = { limit: '-10' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 })
      );
    });

    test('should handle negative offset by defaulting to 0', async () => {
      mockReq.query = { offset: '-50' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 0 })
      );
    });
  });

  describe('Multiple Filters', () => {
    test('should apply all filters when multiple provided', async () => {
      mockReq.query = {
        event_type: 'login_success',
        application_id: 'app-123',
        start_date: '2025-12-01T00:00:00Z',
        end_date: '2025-12-04T23:59:59Z',
        limit: '20',
        offset: '10'
      };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 20,
        offset: 10
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: 'login_success',
        applicationId: 'app-123',
        startDate: '2025-12-01T00:00:00Z',
        endDate: '2025-12-04T23:59:59Z',
        limit: 20,
        offset: 10
      });
    });
  });

  describe('Error Handling', () => {
    test('should throw error when database service fails', async () => {
      const dbError = new Error('Database connection failed');
      databaseService.queryAuditLogs.mockRejectedValue(dbError);

      await expect(
        adminLogsController.getLogs(mockReq, mockRes, mockNext)
      ).rejects.toThrow('Database connection failed');

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    test('should throw error when queryAuditLogs throws', async () => {
      databaseService.queryAuditLogs.mockImplementation(() => {
        throw new Error('Failed to query audit logs');
      });

      await expect(
        adminLogsController.getLogs(mockReq, mockRes, mockNext)
      ).rejects.toThrow('Failed to query audit logs');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty logs array', async () => {
      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: [],
          pagination: {
            total: 0,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });
    });

    test('should handle logs with missing optional fields', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: null,
          user_agent: null,
          details: null,
          created_at: '2025-12-04T10:00:00Z'
        }
      ];

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: mockLogs,
          pagination: {
            total: 1,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });
    });

    test('should handle very large offset', async () => {
      mockReq.query = { offset: '999999' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 100,
        limit: 50,
        offset: 999999
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: [],
          pagination: {
            total: 100,
            limit: 50,
            offset: 999999,
            hasMore: false
          }
        }
      });
    });

    test('should handle limit of 0 by using 50', async () => {
      mockReq.query = { limit: '0' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 })
      );
    });
  });

  describe('Response Format', () => {
    test('should return response with correct structure', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          details: { message: 'Success' },
          created_at: '2025-12-04T10:00:00Z'
        }
      ];

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              event_type: expect.any(String),
              application_id: expect.any(String),
              ip_address: expect.any(String),
              user_agent: expect.any(String),
              details: expect.any(Object),
              created_at: expect.any(String)
            })
          ]),
          pagination: {
            total: expect.any(Number),
            limit: expect.any(Number),
            offset: expect.any(Number),
            hasMore: expect.any(Boolean)
          }
        }
      });
    });

    test('should include all pagination fields', async () => {
      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 100,
        limit: 25,
        offset: 50
      });

      await adminLogsController.getLogs(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data.pagination).toHaveProperty('total');
      expect(response.data.pagination).toHaveProperty('limit');
      expect(response.data.pagination).toHaveProperty('offset');
      expect(response.data.pagination).toHaveProperty('hasMore');
    });
  });
});
