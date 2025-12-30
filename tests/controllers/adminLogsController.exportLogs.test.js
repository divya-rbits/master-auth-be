const adminLogsController = require('../../src/controllers/adminLogsController');
const databaseService = require('../../src/services/database');

// Mock the database service
jest.mock('../../src/services/database');

describe('AdminLogsController - exportLogs', () => {
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
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    // Setup mock next
    mockNext = jest.fn();
  });

  describe('JSON Export Format', () => {
    test('should export logs as JSON when format is json', async () => {
      mockReq.query = { format: 'json' };

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

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      // Verify headers
      expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockRes.set).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename=audit-logs.json');

      // Verify response
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(JSON.stringify(mockLogs, null, 2));
    });

    test('should default to JSON format when format parameter is missing', async () => {
      mockReq.query = {};

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

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockRes.set).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename=audit-logs.json');
      expect(mockRes.send).toHaveBeenCalledWith(JSON.stringify(mockLogs, null, 2));
    });

    test('should export empty array as JSON when no logs found', async () => {
      mockReq.query = { format: 'json' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(JSON.stringify([], null, 2));
    });
  });

  describe('CSV Export Format', () => {
    test('should export logs as CSV when format is csv', async () => {
      mockReq.query = { format: 'csv' };

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

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      // Verify headers
      expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.set).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename=audit-logs.csv');

      // Verify CSV content
      expect(mockRes.status).toHaveBeenCalledWith(200);
      const csvContent = mockRes.send.mock.calls[0][0];

      // Check CSV header
      expect(csvContent).toContain('id,event_type,application_id,ip_address,user_agent,details,created_at');

      // Check CSV rows
      expect(csvContent).toContain('log-1,login_success,app-123,127.0.0.1,Mozilla/5.0');
      expect(csvContent).toContain('log-2,login_failed,app-456,192.168.1.1,Chrome/90.0');
    });

    test('should handle CSV export with empty logs', async () => {
      mockReq.query = { format: 'csv' };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const csvContent = mockRes.send.mock.calls[0][0];

      // Should still have header
      expect(csvContent).toBe('id,event_type,application_id,ip_address,user_agent,details,created_at\n');
    });

    test('should properly escape CSV fields with commas', async () => {
      mockReq.query = { format: 'csv' };

      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0, Chrome',
          details: { message: 'Success, user logged in' },
          created_at: '2025-12-04T10:00:00Z'
        }
      ];

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      const csvContent = mockRes.send.mock.calls[0][0];

      // Fields with commas should be quoted
      expect(csvContent).toContain('"Mozilla/5.0, Chrome"');
    });

    test('should properly escape CSV fields with quotes', async () => {
      mockReq.query = { format: 'csv' };

      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla "5.0"',
          details: { message: 'User "admin" logged in' },
          created_at: '2025-12-04T10:00:00Z'
        }
      ];

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      const csvContent = mockRes.send.mock.calls[0][0];

      // Quotes should be escaped as double quotes
      expect(csvContent).toContain('Mozilla ""5.0""');
    });

    test('should handle CSV export with null values', async () => {
      mockReq.query = { format: 'csv' };

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

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      const csvContent = mockRes.send.mock.calls[0][0];

      // Null values should be empty
      expect(csvContent).toContain('log-1,login_success,app-123,,,');
    });
  });

  describe('Invalid Format Parameter', () => {
    test('should return 400 error for invalid format', async () => {
      mockReq.query = { format: 'xml' };

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid format parameter. Supported formats: json, csv'
      });
    });

    test('should return 400 error for invalid format type', async () => {
      mockReq.query = { format: 'pdf' };

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid format parameter. Supported formats: json, csv'
      });
    });
  });

  describe('Export with Filters', () => {
    test('should export logs with event_type filter', async () => {
      mockReq.query = {
        format: 'json',
        event_type: 'login_success'
      };

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

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: 'login_success',
        applicationId: null,
        startDate: null,
        endDate: null,
        limit: 50,
        offset: 0
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('should export logs with application_id filter', async () => {
      mockReq.query = {
        format: 'csv',
        application_id: 'app-123'
      };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: 'app-123',
        startDate: null,
        endDate: null,
        limit: 50,
        offset: 0
      });
    });

    test('should export logs with date range filter', async () => {
      mockReq.query = {
        format: 'json',
        start_date: '2025-12-01T00:00:00Z',
        end_date: '2025-12-04T23:59:59Z'
      };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: null,
        applicationId: null,
        startDate: '2025-12-01T00:00:00Z',
        endDate: '2025-12-04T23:59:59Z',
        limit: 50,
        offset: 0
      });
    });

    test('should export logs with all filters combined', async () => {
      mockReq.query = {
        format: 'csv',
        event_type: 'login_success',
        application_id: 'app-123',
        start_date: '2025-12-01T00:00:00Z',
        end_date: '2025-12-04T23:59:59Z',
        limit: '100',
        offset: '0'
      };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 100,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith({
        eventType: 'login_success',
        applicationId: 'app-123',
        startDate: '2025-12-01T00:00:00Z',
        endDate: '2025-12-04T23:59:59Z',
        limit: 100,
        offset: 0
      });
    });
  });

  describe('Pagination Parameters', () => {
    test('should respect custom limit parameter', async () => {
      mockReq.query = {
        format: 'json',
        limit: '10'
      };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 10,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });

    test('should respect custom offset parameter', async () => {
      mockReq.query = {
        format: 'csv',
        offset: '50'
      };

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: [],
        total: 0,
        limit: 50,
        offset: 50
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      expect(databaseService.queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 50 })
      );
    });
  });

  describe('Error Handling', () => {
    test('should throw error when database service fails', async () => {
      mockReq.query = { format: 'json' };

      const dbError = new Error('Database connection failed');
      databaseService.queryAuditLogs.mockRejectedValue(dbError);

      await expect(
        adminLogsController.exportLogs(mockReq, mockRes, mockNext)
      ).rejects.toThrow('Database connection failed');

      expect(mockRes.send).not.toHaveBeenCalled();
    });

    test('should throw error when queryAuditLogs throws', async () => {
      mockReq.query = { format: 'csv' };

      databaseService.queryAuditLogs.mockImplementation(() => {
        throw new Error('Failed to query audit logs');
      });

      await expect(
        adminLogsController.exportLogs(mockReq, mockRes, mockNext)
      ).rejects.toThrow('Failed to query audit logs');
    });
  });

  describe('CSV Content Verification', () => {
    test('should generate valid CSV with all fields in correct order', async () => {
      mockReq.query = { format: 'csv' };

      const mockLogs = [
        {
          id: 'log-123',
          event_type: 'login_success',
          application_id: 'app-456',
          ip_address: '10.0.0.1',
          user_agent: 'TestAgent/1.0',
          details: { key: 'value' },
          created_at: '2025-12-04T12:00:00Z'
        }
      ];

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      const csvContent = mockRes.send.mock.calls[0][0];
      const lines = csvContent.trim().split('\n');

      // Check header
      expect(lines[0]).toBe('id,event_type,application_id,ip_address,user_agent,details,created_at');

      // Check data row
      expect(lines[1]).toContain('log-123');
      expect(lines[1]).toContain('login_success');
      expect(lines[1]).toContain('app-456');
      expect(lines[1]).toContain('10.0.0.1');
      expect(lines[1]).toContain('TestAgent/1.0');
      expect(lines[1]).toContain('2025-12-04T12:00:00Z');
    });

    test('should handle details object serialization in CSV', async () => {
      mockReq.query = { format: 'csv' };

      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'login_success',
          application_id: 'app-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          details: { message: 'Success', code: 200 },
          created_at: '2025-12-04T10:00:00Z'
        }
      ];

      databaseService.queryAuditLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        limit: 50,
        offset: 0
      });

      await adminLogsController.exportLogs(mockReq, mockRes, mockNext);

      const csvContent = mockRes.send.mock.calls[0][0];

      // Details object should be JSON stringified in CSV and properly escaped
      // Quotes inside the JSON are doubled for CSV escaping
      expect(csvContent).toContain('""message"":""Success""');
      expect(csvContent).toContain('""code"":200');
    });
  });
});
