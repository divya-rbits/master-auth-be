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

describe('AdminDashboardController - getStats', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock request
    mockReq = {
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

  describe('Successful Dashboard Stats Retrieval', () => {
    test('should return all dashboard statistics with correct structure', async () => {
      // Mock database response
      const mockStats = {
        total_applications: 10,
        active_applications: 8,
        total_active_tokens: 25,
        failed_logins_24h: 5,
        successful_logins_24h: 50,
        token_validations_24h: 120,
        recent_activity: [
          {
            id: 'log-1',
            event_type: 'login_success',
            application_id: 'app-123',
            ip_address: '127.0.0.1',
            created_at: '2025-12-04T10:00:00Z'
          },
          {
            id: 'log-2',
            event_type: 'token_validation_success',
            application_id: 'app-456',
            ip_address: '192.168.1.1',
            created_at: '2025-12-04T09:55:00Z'
          }
        ]
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      // Call controller
      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      // Verify database service was called
      expect(databaseService.getDashboardStats).toHaveBeenCalledTimes(1);

      // Verify response
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          total_applications: 10,
          active_applications: 8,
          total_active_tokens: 25,
          failed_logins_24h: 5,
          successful_logins_24h: 50,
          token_validations_24h: 120,
          recent_activity: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              event_type: expect.any(String),
              application_id: expect.any(String)
            })
          ])
        }
      });
    });

    test('should handle zero values for all metrics', async () => {
      const mockStats = {
        total_applications: 0,
        active_applications: 0,
        total_active_tokens: 0,
        failed_logins_24h: 0,
        successful_logins_24h: 0,
        token_validations_24h: 0,
        recent_activity: []
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    test('should return exactly 10 recent activity items when available', async () => {
      const recentActivity = Array(10).fill(null).map((_, i) => ({
        id: `log-${i + 1}`,
        event_type: 'login_success',
        application_id: 'app-123',
        ip_address: '127.0.0.1',
        created_at: new Date(Date.now() - i * 60000).toISOString()
      }));

      const mockStats = {
        total_applications: 5,
        active_applications: 5,
        total_active_tokens: 15,
        failed_logins_24h: 2,
        successful_logins_24h: 30,
        token_validations_24h: 80,
        recent_activity: recentActivity
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data.recent_activity).toHaveLength(10);
    });

    test('should return fewer than 10 recent activity items when less available', async () => {
      const mockStats = {
        total_applications: 3,
        active_applications: 3,
        total_active_tokens: 5,
        failed_logins_24h: 1,
        successful_logins_24h: 10,
        token_validations_24h: 20,
        recent_activity: [
          {
            id: 'log-1',
            event_type: 'login_success',
            application_id: 'app-123',
            ip_address: '127.0.0.1',
            created_at: '2025-12-04T10:00:00Z'
          }
        ]
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data.recent_activity).toHaveLength(1);
    });
  });

  describe('Metric Validation', () => {
    test('should have total_applications >= active_applications', async () => {
      const mockStats = {
        total_applications: 10,
        active_applications: 8,
        total_active_tokens: 25,
        failed_logins_24h: 5,
        successful_logins_24h: 50,
        token_validations_24h: 120,
        recent_activity: []
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data.total_applications).toBeGreaterThanOrEqual(
        response.data.active_applications
      );
    });

    test('should return valid counts for 24-hour metrics', async () => {
      const mockStats = {
        total_applications: 5,
        active_applications: 5,
        total_active_tokens: 15,
        failed_logins_24h: 12,
        successful_logins_24h: 88,
        token_validations_24h: 200,
        recent_activity: []
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data.failed_logins_24h).toBeGreaterThanOrEqual(0);
      expect(response.data.successful_logins_24h).toBeGreaterThanOrEqual(0);
      expect(response.data.token_validations_24h).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Recent Activity Format', () => {
    test('should include all required fields in recent activity items', async () => {
      const mockStats = {
        total_applications: 5,
        active_applications: 5,
        total_active_tokens: 15,
        failed_logins_24h: 2,
        successful_logins_24h: 30,
        token_validations_24h: 80,
        recent_activity: [
          {
            id: 'log-1',
            event_type: 'login_success',
            application_id: 'app-123',
            ip_address: '127.0.0.1',
            user_agent: 'Mozilla/5.0',
            details: { message: 'Success' },
            created_at: '2025-12-04T10:00:00Z'
          }
        ]
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      const activity = response.data.recent_activity[0];

      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('event_type');
      expect(activity).toHaveProperty('application_id');
      expect(activity).toHaveProperty('created_at');
    });

    test('should handle various event types in recent activity', async () => {
      const mockStats = {
        total_applications: 5,
        active_applications: 5,
        total_active_tokens: 15,
        failed_logins_24h: 2,
        successful_logins_24h: 30,
        token_validations_24h: 80,
        recent_activity: [
          {
            id: 'log-1',
            event_type: 'login_success',
            application_id: 'app-123',
            created_at: '2025-12-04T10:00:00Z'
          },
          {
            id: 'log-2',
            event_type: 'login_failed',
            application_id: 'app-456',
            created_at: '2025-12-04T09:55:00Z'
          },
          {
            id: 'log-3',
            event_type: 'token_validation_success',
            application_id: 'app-789',
            created_at: '2025-12-04T09:50:00Z'
          },
          {
            id: 'log-4',
            event_type: 'token_revoked',
            application_id: 'app-123',
            created_at: '2025-12-04T09:45:00Z'
          }
        ]
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data.recent_activity).toHaveLength(4);
    });
  });

  describe('Error Handling', () => {
    test('should throw error when database service fails', async () => {
      const dbError = new Error('Database connection failed');
      databaseService.getDashboardStats.mockRejectedValue(dbError);

      await expect(
        adminDashboardController.getStats(mockReq, mockRes, mockNext)
      ).rejects.toThrow('Database connection failed');

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    test('should throw error when getDashboardStats throws', async () => {
      databaseService.getDashboardStats.mockImplementation(() => {
        throw new Error('Failed to retrieve dashboard stats');
      });

      await expect(
        adminDashboardController.getStats(mockReq, mockRes, mockNext)
      ).rejects.toThrow('Failed to retrieve dashboard stats');
    });
  });

  describe('Response Format', () => {
    test('should return response with correct structure', async () => {
      const mockStats = {
        total_applications: 10,
        active_applications: 8,
        total_active_tokens: 25,
        failed_logins_24h: 5,
        successful_logins_24h: 50,
        token_validations_24h: 120,
        recent_activity: []
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          total_applications: expect.any(Number),
          active_applications: expect.any(Number),
          total_active_tokens: expect.any(Number),
          failed_logins_24h: expect.any(Number),
          successful_logins_24h: expect.any(Number),
          token_validations_24h: expect.any(Number),
          recent_activity: expect.any(Array)
        }
      });
    });

    test('should include all 7 required metrics in response', async () => {
      const mockStats = {
        total_applications: 10,
        active_applications: 8,
        total_active_tokens: 25,
        failed_logins_24h: 5,
        successful_logins_24h: 50,
        token_validations_24h: 120,
        recent_activity: []
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data).toHaveProperty('total_applications');
      expect(response.data).toHaveProperty('active_applications');
      expect(response.data).toHaveProperty('total_active_tokens');
      expect(response.data).toHaveProperty('failed_logins_24h');
      expect(response.data).toHaveProperty('successful_logins_24h');
      expect(response.data).toHaveProperty('token_validations_24h');
      expect(response.data).toHaveProperty('recent_activity');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty recent activity array', async () => {
      const mockStats = {
        total_applications: 10,
        active_applications: 8,
        total_active_tokens: 25,
        failed_logins_24h: 0,
        successful_logins_24h: 0,
        token_validations_24h: 0,
        recent_activity: []
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    test('should handle very large metric values', async () => {
      const mockStats = {
        total_applications: 999999,
        active_applications: 999999,
        total_active_tokens: 999999,
        failed_logins_24h: 50000,
        successful_logins_24h: 100000,
        token_validations_24h: 500000,
        recent_activity: []
      };

      databaseService.getDashboardStats.mockResolvedValue(mockStats);

      await adminDashboardController.getStats(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.data.total_applications).toBe(999999);
    });
  });
});
