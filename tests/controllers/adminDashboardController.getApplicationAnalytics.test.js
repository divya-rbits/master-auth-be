const databaseService = require('../../src/services/database');

// Mock the database service
jest.mock('../../src/services/database');

// Mock node-cache to disable caching during tests
jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => {
    return {
      get: jest.fn(() => undefined), // Always return cache miss
      set: jest.fn()
    };
  });
});

const adminDashboardController = require('../../src/controllers/adminDashboardController');

describe('AdminDashboardController - getApplicationAnalytics', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock request
    mockReq = {
      params: {
        id: '123e4567-e89b-12d3-a456-426614174000'
      },
      query: {
        date_range: '30d'
      },
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

  describe('Successful Analytics Retrieval', () => {
    test('should return analytics with 7d date range', async () => {
      mockReq.query.date_range = '7d';

      const mockAnalytics = {
        login_success_count: 50,
        login_failed_count: 5,
        active_token_count: 10,
        token_validations_count: 120,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [
          { hour: 9, count: 15 },
          { hour: 14, count: 20 },
          { hour: 17, count: 18 }
        ]
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(databaseService.getApplicationAnalytics).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        '7d'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics
      });
    });

    test('should return analytics with 30d date range', async () => {
      mockReq.query.date_range = '30d';

      const mockAnalytics = {
        login_success_count: 200,
        login_failed_count: 15,
        active_token_count: 25,
        token_validations_count: 500,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [
          { hour: 10, count: 40 },
          { hour: 15, count: 50 }
        ]
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(databaseService.getApplicationAnalytics).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        '30d'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics
      });
    });

    test('should return analytics with 90d date range', async () => {
      mockReq.query.date_range = '90d';

      const mockAnalytics = {
        login_success_count: 600,
        login_failed_count: 45,
        active_token_count: 30,
        token_validations_count: 1500,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [
          { hour: 11, count: 80 },
          { hour: 16, count: 100 }
        ]
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(databaseService.getApplicationAnalytics).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        '90d'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics
      });
    });

    test('should default to 30d when date_range not provided', async () => {
      delete mockReq.query.date_range;

      const mockAnalytics = {
        login_success_count: 200,
        login_failed_count: 15,
        active_token_count: 25,
        token_validations_count: 500,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: []
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(databaseService.getApplicationAnalytics).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        '30d'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Response Structure Validation', () => {
    test('should include all required fields in response', async () => {
      const mockAnalytics = {
        login_success_count: 50,
        login_failed_count: 5,
        active_token_count: 10,
        token_validations_count: 120,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [{ hour: 14, count: 20 }]
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data).toHaveProperty('login_success_count');
      expect(response.data).toHaveProperty('login_failed_count');
      expect(response.data).toHaveProperty('active_token_count');
      expect(response.data).toHaveProperty('token_validations_count');
      expect(response.data).toHaveProperty('most_recent_activity');
      expect(response.data).toHaveProperty('peak_usage_times');
    });

    test('should have correct data types for all fields', async () => {
      const mockAnalytics = {
        login_success_count: 50,
        login_failed_count: 5,
        active_token_count: 10,
        token_validations_count: 120,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [{ hour: 14, count: 20 }]
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(typeof response.data.login_success_count).toBe('number');
      expect(typeof response.data.login_failed_count).toBe('number');
      expect(typeof response.data.active_token_count).toBe('number');
      expect(typeof response.data.token_validations_count).toBe('number');
      expect(typeof response.data.most_recent_activity).toBe('string');
      expect(Array.isArray(response.data.peak_usage_times)).toBe(true);
    });

    test('should have valid peak_usage_times structure', async () => {
      const mockAnalytics = {
        login_success_count: 50,
        login_failed_count: 5,
        active_token_count: 10,
        token_validations_count: 120,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [
          { hour: 9, count: 15 },
          { hour: 14, count: 20 }
        ]
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      const peakTimes = response.data.peak_usage_times;

      expect(peakTimes).toHaveLength(2);
      expect(peakTimes[0]).toHaveProperty('hour');
      expect(peakTimes[0]).toHaveProperty('count');
      expect(typeof peakTimes[0].hour).toBe('number');
      expect(typeof peakTimes[0].count).toBe('number');
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero values for all metrics', async () => {
      const mockAnalytics = {
        login_success_count: 0,
        login_failed_count: 0,
        active_token_count: 0,
        token_validations_count: 0,
        most_recent_activity: null,
        peak_usage_times: []
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics
      });
    });

    test('should handle empty peak_usage_times array', async () => {
      const mockAnalytics = {
        login_success_count: 10,
        login_failed_count: 2,
        active_token_count: 5,
        token_validations_count: 30,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: []
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data.peak_usage_times).toEqual([]);
    });

    test('should handle null most_recent_activity', async () => {
      const mockAnalytics = {
        login_success_count: 0,
        login_failed_count: 0,
        active_token_count: 0,
        token_validations_count: 0,
        most_recent_activity: null,
        peak_usage_times: []
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data.most_recent_activity).toBeNull();
    });
  });

  describe('Validation - Invalid Application ID', () => {
    test('should return 400 for invalid UUID format', async () => {
      mockReq.params.id = 'invalid-uuid';

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
      expect(databaseService.getApplicationAnalytics).not.toHaveBeenCalled();
    });

    test('should return 400 for missing application ID', async () => {
      delete mockReq.params.id;

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application ID is required'
      });
      expect(databaseService.getApplicationAnalytics).not.toHaveBeenCalled();
    });

    test('should return 400 for empty application ID', async () => {
      mockReq.params.id = '';

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application ID is required'
      });
      expect(databaseService.getApplicationAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('Validation - Invalid Date Range', () => {
    test('should return 400 for invalid date_range value', async () => {
      mockReq.query.date_range = '60d';

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date_range. Must be one of: 7d, 30d, 90d'
      });
      expect(databaseService.getApplicationAnalytics).not.toHaveBeenCalled();
    });

    test('should return 400 for non-string date_range', async () => {
      mockReq.query.date_range = 30;

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date_range. Must be one of: 7d, 30d, 90d'
      });
      expect(databaseService.getApplicationAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('Application Not Found', () => {
    test('should return 404 when application does not exist', async () => {
      databaseService.getApplicationAnalytics.mockResolvedValue(null);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application not found'
      });
    });
  });

  describe('Error Handling', () => {
    test('should throw error when database service fails', async () => {
      const dbError = new Error('Database connection failed');
      databaseService.getApplicationAnalytics.mockRejectedValue(dbError);

      await expect(
        adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext)
      ).rejects.toThrow('Database connection failed');

      expect(mockRes.status).not.toHaveBeenCalledWith(200);
    });

    test('should throw error when getApplicationAnalytics throws', async () => {
      databaseService.getApplicationAnalytics.mockImplementation(() => {
        throw new Error('Failed to retrieve analytics');
      });

      await expect(
        adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext)
      ).rejects.toThrow('Failed to retrieve analytics');
    });
  });

  describe('Response Format', () => {
    test('should return response with success=true', async () => {
      const mockAnalytics = {
        login_success_count: 50,
        login_failed_count: 5,
        active_token_count: 10,
        token_validations_count: 120,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: []
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('data');
    });

    test('should return 200 status code on success', async () => {
      const mockAnalytics = {
        login_success_count: 50,
        login_failed_count: 5,
        active_token_count: 10,
        token_validations_count: 120,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: []
      };

      databaseService.getApplicationAnalytics.mockResolvedValue(mockAnalytics);

      await adminDashboardController.getApplicationAnalytics(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
