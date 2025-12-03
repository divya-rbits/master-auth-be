const databaseService = require('../../src/services/database');
const supabase = require('../../src/config/supabase');

// Mock Supabase
jest.mock('../../src/config/supabase', () => ({
  from: jest.fn()
}));

describe('Database Service - Audit Logs Query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('queryAuditLogs', () => {
    test('should query all logs with default parameters', async () => {
      const mockLogs = [
        {
          id: '1',
          event_type: 'login_success',
          application_id: 'test-app',
          ip_address: '127.0.0.1',
          created_at: '2025-12-02T10:00:00Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
        count: 1
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        range: mockRange
      });

      const result = await databaseService.queryAuditLogs({});

      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockRange).toHaveBeenCalledWith(0, 49);
      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    test('should filter by event_type', async () => {
      const mockEq = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        range: mockRange
      });

      await databaseService.queryAuditLogs({ eventType: 'login_success' });

      expect(mockEq).toHaveBeenCalledWith('event_type', 'login_success');
    });

    test('should filter by application_id', async () => {
      const mockEq = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        range: mockRange
      });

      await databaseService.queryAuditLogs({ applicationId: 'test-app' });

      expect(mockEq).toHaveBeenCalledWith('application_id', 'test-app');
    });

    test('should filter by date range (startDate)', async () => {
      const mockGte = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        gte: mockGte,
        order: mockOrder,
        range: mockRange
      });

      await databaseService.queryAuditLogs({ startDate: '2025-12-01T00:00:00Z' });

      expect(mockGte).toHaveBeenCalledWith('created_at', '2025-12-01T00:00:00Z');
    });

    test('should filter by date range (endDate)', async () => {
      const mockLte = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        lte: mockLte,
        order: mockOrder,
        range: mockRange
      });

      await databaseService.queryAuditLogs({ endDate: '2025-12-02T23:59:59Z' });

      expect(mockLte).toHaveBeenCalledWith('created_at', '2025-12-02T23:59:59Z');
    });

    test('should handle pagination with custom limit', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 150
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        range: mockRange
      });

      const result = await databaseService.queryAuditLogs({ limit: 25 });

      expect(mockRange).toHaveBeenCalledWith(0, 24);
      expect(result.limit).toBe(25);
    });

    test('should handle pagination with offset', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 150
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        range: mockRange
      });

      const result = await databaseService.queryAuditLogs({ offset: 50 });

      expect(mockRange).toHaveBeenCalledWith(50, 99);
      expect(result.offset).toBe(50);
    });

    test('should enforce maximum limit of 100', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 150
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        range: mockRange
      });

      const result = await databaseService.queryAuditLogs({ limit: 200 });

      expect(mockRange).toHaveBeenCalledWith(0, 99);
      expect(result.limit).toBe(100);
    });

    test('should combine multiple filters', async () => {
      const mockEq = jest.fn().mockReturnThis();
      const mockGte = jest.fn().mockReturnThis();
      const mockLte = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 10
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        gte: mockGte,
        lte: mockLte,
        order: mockOrder,
        range: mockRange
      });

      await databaseService.queryAuditLogs({
        eventType: 'login_success',
        applicationId: 'test-app',
        startDate: '2025-12-01T00:00:00Z',
        endDate: '2025-12-02T23:59:59Z',
        limit: 10,
        offset: 5
      });

      expect(mockEq).toHaveBeenCalledWith('event_type', 'login_success');
      expect(mockEq).toHaveBeenCalledWith('application_id', 'test-app');
      expect(mockGte).toHaveBeenCalledWith('created_at', '2025-12-01T00:00:00Z');
      expect(mockLte).toHaveBeenCalledWith('created_at', '2025-12-02T23:59:59Z');
      expect(mockRange).toHaveBeenCalledWith(5, 14);
    });

    test('should handle database errors', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
        count: null
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        range: mockRange
      });

      await expect(databaseService.queryAuditLogs({})).rejects.toThrow('Failed to query audit logs');
    });

    test('should return empty array when no logs found', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        range: mockRange
      });

      const result = await databaseService.queryAuditLogs({});

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });

    test('should handle null data from database', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockRange = jest.fn().mockResolvedValue({
        data: null,
        error: null,
        count: 0
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        range: mockRange
      });

      const result = await databaseService.queryAuditLogs({});

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
