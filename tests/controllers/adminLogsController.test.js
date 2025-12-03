const adminLogsController = require('../../src/controllers/adminLogsController');
const databaseService = require('../../src/services/database');

// Mock database service
jest.mock('../../src/services/database');

describe('Admin Logs Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      admin: { username: 'admin' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('getLogs', () => {
    test('should return logs with default parameters', async () => {
      const mockResult = {
        logs: [
          {
            id: '1',
            event_type: 'login_success',
            application_id: 'test-app',
            created_at: '2025-12-02T10:00:00Z'
          }
        ],
        total: 1,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: null,
        endDate: null,
        limit: 50,
        offset: 0
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: mockResult.logs,
          pagination: {
            total: 1,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });
    });

    test('should parse and pass event_type filter', async () => {
      req.query = { event_type: 'login_success' };

      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: 'login_success',
        applicationId: null,
        startDate: null,
        endDate: null,
        limit: 50,
        offset: 0
      });
    });

    test('should parse and pass application_id filter', async () => {
      req.query = { application_id: 'test-app' };

      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: 'test-app',
        startDate: null,
        endDate: null,
        limit: 50,
        offset: 0
      });
    });

    test('should parse and pass date range filters', async () => {
      req.query = {
        start_date: '2025-12-01T00:00:00Z',
        end_date: '2025-12-02T23:59:59Z'
      };

      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: '2025-12-01T00:00:00Z',
        endDate: '2025-12-02T23:59:59Z',
        limit: 50,
        offset: 0
      });
    });

    test('should parse and pass pagination parameters', async () => {
      req.query = {
        limit: '25',
        offset: '10'
      };

      const mockResult = {
        logs: [],
        total: 100,
        limit: 25,
        offset: 10
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: null,
        endDate: null,
        limit: 25,
        offset: 10
      });
    });

    test('should calculate hasMore correctly when more results exist', async () => {
      const mockResult = {
        logs: new Array(50).fill({}),
        total: 150,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pagination: expect.objectContaining({
              hasMore: true
            })
          })
        })
      );
    });

    test('should calculate hasMore correctly when no more results', async () => {
      const mockResult = {
        logs: new Array(50).fill({}),
        total: 50,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pagination: expect.objectContaining({
              hasMore: false
            })
          })
        })
      );
    });

    test('should handle invalid limit (non-numeric)', async () => {
      req.query = { limit: 'invalid' };

      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      // Should use default limit
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50
        })
      );
    });

    test('should handle invalid offset (non-numeric)', async () => {
      req.query = { offset: 'invalid' };

      const mockResult = {
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      // Should use default offset
      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 0
        })
      );
    });

    test('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      databaseService.queryAuditLogs.mockRejectedValue(error);

      const next = jest.fn();
      req.next = next;

      await expect(adminLogsController.getLogs(req, res, next)).rejects.toThrow('Database connection failed');
    });

    test('should combine all filters', async () => {
      req.query = {
        event_type: 'login_success',
        application_id: 'test-app',
        start_date: '2025-12-01T00:00:00Z',
        end_date: '2025-12-02T23:59:59Z',
        limit: '25',
        offset: '10'
      };

      const mockResult = {
        logs: [],
        total: 0,
        limit: 25,
        offset: 10
      };

      databaseService.queryAuditLogs.mockResolvedValue(mockResult);

      await adminLogsController.getLogs(req, res);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: 'login_success',
        applicationId: 'test-app',
        startDate: '2025-12-01T00:00:00Z',
        endDate: '2025-12-02T23:59:59Z',
        limit: 25,
        offset: 10
      });
    });
  });
});
