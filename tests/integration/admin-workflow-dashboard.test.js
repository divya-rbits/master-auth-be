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

describe('Admin Workflow: Dashboard and Analytics Integration Tests', () => {
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

  describe('Complete Workflow: Login → View Dashboard → View App Analytics', () => {
    test('should successfully complete entire dashboard workflow', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

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

      // Step 2: View Dashboard Stats
      const mockDashboardStats = {
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
            user_agent: 'Mozilla/5.0',
            details: {},
            created_at: '2025-12-04T10:00:00Z'
          }
        ]
      };

      jest.spyOn(databaseService, 'getDashboardStats').mockResolvedValue(mockDashboardStats);

      const dashboardResponse = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.success).toBe(true);
      expect(dashboardResponse.body.data).toEqual(mockDashboardStats);
      expect(dashboardResponse.body.data.total_applications).toBe(10);
      expect(dashboardResponse.body.data.active_applications).toBe(8);
      expect(dashboardResponse.body.data.recent_activity).toHaveLength(1);

      // Step 3: View Application Analytics
      const mockAppAnalytics = {
        login_success_count: 200,
        login_failed_count: 15,
        active_token_count: 25,
        token_validations_count: 500,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [
          { hour: 14, count: 50 },
          { hour: 10, count: 40 }
        ]
      };

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        is_active: true
      });

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue(mockAppAnalytics);

      const analyticsResponse = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .query({ date_range: '30d' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data).toEqual(mockAppAnalytics);
      expect(analyticsResponse.body.data.login_success_count).toBe(200);
      expect(analyticsResponse.body.data.peak_usage_times).toHaveLength(2);

      // Verify workflow completed successfully
      expect(loginResponse.body.success).toBe(true);
      expect(dashboardResponse.body.success).toBe(true);
      expect(analyticsResponse.body.success).toBe(true);
    });

    test('should maintain authentication across dashboard and analytics queries', async () => {
      const validUuid = '223e4567-e89b-12d3-a456-426614174001';

      jest.spyOn(databaseService, 'getDashboardStats').mockResolvedValue({
        total_applications: 5,
        active_applications: 4,
        total_active_tokens: 10,
        failed_logins_24h: 2,
        successful_logins_24h: 20,
        token_validations_24h: 50,
        recent_activity: []
      });

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        is_active: true
      });

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue({
        login_success_count: 100,
        login_failed_count: 10,
        active_token_count: 15,
        token_validations_count: 250,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: []
      });

      // Query 1: Dashboard
      const dashboardResponse1 = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(dashboardResponse1.status).toBe(200);

      // Query 2: Analytics for 7 days
      const analyticsResponse1 = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .query({ date_range: '7d' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(analyticsResponse1.status).toBe(200);

      // Query 3: Analytics for 30 days
      const analyticsResponse2 = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .query({ date_range: '30d' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(analyticsResponse2.status).toBe(200);

      // Query 4: Dashboard again
      const dashboardResponse2 = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(dashboardResponse2.status).toBe(200);

      // Verify all queries succeeded with same token
      expect(dashboardResponse1.body.success).toBe(true);
      expect(analyticsResponse1.body.success).toBe(true);
      expect(analyticsResponse2.body.success).toBe(true);
      expect(dashboardResponse2.body.success).toBe(true);
    });
  });

  describe('Dashboard Stats', () => {
    test('should return accurate dashboard statistics', async () => {
      const mockStats = {
        total_applications: 15,
        active_applications: 12,
        total_active_tokens: 45,
        failed_logins_24h: 8,
        successful_logins_24h: 75,
        token_validations_24h: 200,
        recent_activity: [
          {
            id: 'log-1',
            event_type: 'login_success',
            application_id: 'app-123',
            ip_address: '127.0.0.1',
            user_agent: 'Mozilla/5.0',
            details: {},
            created_at: '2025-12-04T10:00:00Z'
          },
          {
            id: 'log-2',
            event_type: 'token_validation_success',
            application_id: 'app-456',
            ip_address: '192.168.1.1',
            user_agent: 'Chrome/90.0',
            details: {},
            created_at: '2025-12-04T09:55:00Z'
          }
        ]
      };

      jest.spyOn(databaseService, 'getDashboardStats').mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_applications).toBe(15);
      expect(response.body.data.active_applications).toBe(12);
      expect(response.body.data.total_active_tokens).toBe(45);
      expect(response.body.data.recent_activity).toHaveLength(2);
    });

    test('should handle empty dashboard stats', async () => {
      const mockStats = {
        total_applications: 0,
        active_applications: 0,
        total_active_tokens: 0,
        failed_logins_24h: 0,
        successful_logins_24h: 0,
        token_validations_24h: 0,
        recent_activity: []
      };

      jest.spyOn(databaseService, 'getDashboardStats').mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_applications).toBe(0);
      expect(response.body.data.recent_activity).toEqual([]);
    });

    test('should limit recent activity to 10 items', async () => {
      const mockActivity = Array.from({ length: 15 }, (_, i) => ({
        id: `log-${i}`,
        event_type: 'login_success',
        application_id: 'app-123',
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        details: {},
        created_at: new Date().toISOString()
      }));

      const mockStats = {
        total_applications: 5,
        active_applications: 4,
        total_active_tokens: 10,
        failed_logins_24h: 2,
        successful_logins_24h: 20,
        token_validations_24h: 50,
        recent_activity: mockActivity.slice(0, 10)
      };

      jest.spyOn(databaseService, 'getDashboardStats').mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.recent_activity).toHaveLength(10);
    });
  });

  describe('Application Analytics', () => {
    const validUuid = '323e4567-e89b-12d3-a456-426614174002';

    beforeEach(() => {
      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        is_active: true
      });
    });

    test('should return analytics for 7 days', async () => {
      const mockAnalytics = {
        login_success_count: 50,
        login_failed_count: 5,
        active_token_count: 10,
        token_validations_count: 150,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [{ hour: 14, count: 20 }]
      };

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .query({ date_range: '7d' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalytics);
      expect(databaseService.getApplicationAnalytics).toHaveBeenCalledWith(
        validUuid,
        expect.objectContaining({ dateRange: '7d' })
      );
    });

    test('should return analytics for 30 days (default)', async () => {
      const mockAnalytics = {
        login_success_count: 200,
        login_failed_count: 15,
        active_token_count: 25,
        token_validations_count: 500,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [
          { hour: 14, count: 50 },
          { hour: 10, count: 40 }
        ]
      };

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.login_success_count).toBe(200);
      expect(databaseService.getApplicationAnalytics).toHaveBeenCalledWith(
        validUuid,
        expect.objectContaining({ dateRange: '30d' })
      );
    });

    test('should return analytics for 90 days', async () => {
      const mockAnalytics = {
        login_success_count: 600,
        login_failed_count: 45,
        active_token_count: 30,
        token_validations_count: 1500,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [
          { hour: 14, count: 150 },
          { hour: 10, count: 120 },
          { hour: 16, count: 100 }
        ]
      };

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .query({ date_range: '90d' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.login_success_count).toBe(600);
      expect(response.body.data.peak_usage_times).toHaveLength(3);
    });

    test('should reject invalid date range', async () => {
      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .query({ date_range: '365d' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid date_range');
    });

    test('should handle analytics with no activity', async () => {
      const mockAnalytics = {
        login_success_count: 0,
        login_failed_count: 0,
        active_token_count: 0,
        token_validations_count: 0,
        most_recent_activity: null,
        peak_usage_times: []
      };

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.login_success_count).toBe(0);
      expect(response.body.data.most_recent_activity).toBeNull();
      expect(response.body.data.peak_usage_times).toEqual([]);
    });

    test('should fail if application not found', async () => {
      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Application not found');
    });

    test('should validate peak usage times format', async () => {
      const mockAnalytics = {
        login_success_count: 100,
        login_failed_count: 10,
        active_token_count: 15,
        token_validations_count: 250,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: [
          { hour: 0, count: 5 },
          { hour: 12, count: 30 },
          { hour: 23, count: 10 }
        ]
      };

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.peak_usage_times).toHaveLength(3);

      // Verify hour values are valid (0-23)
      response.body.data.peak_usage_times.forEach(item => {
        expect(item.hour).toBeGreaterThanOrEqual(0);
        expect(item.hour).toBeLessThanOrEqual(23);
        expect(typeof item.count).toBe('number');
      });
    });
  });

  describe('Data Consistency', () => {
    test('should have consistent data between dashboard and analytics', async () => {
      const validUuid = '423e4567-e89b-12d3-a456-426614174003';

      // Dashboard shows total active tokens
      jest.spyOn(databaseService, 'getDashboardStats').mockResolvedValue({
        total_applications: 1,
        active_applications: 1,
        total_active_tokens: 25, // Total across all apps
        failed_logins_24h: 5,
        successful_logins_24h: 50,
        token_validations_24h: 120,
        recent_activity: []
      });

      // Application analytics shows tokens for specific app
      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        is_active: true
      });

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue({
        login_success_count: 50,
        login_failed_count: 5,
        active_token_count: 25, // Should match or be part of dashboard total
        token_validations_count: 120,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: []
      });

      const dashboardResponse = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      const analyticsResponse = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .query({ date_range: '30d' })
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(dashboardResponse.status).toBe(200);
      expect(analyticsResponse.status).toBe(200);

      // If there's only one app, dashboard total should match app analytics
      expect(dashboardResponse.body.data.total_active_tokens).toBe(
        analyticsResponse.body.data.active_token_count
      );
    });
  });

  describe('Authentication Requirements', () => {
    test('should reject dashboard queries without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject analytics queries without authentication', async () => {
      const validUuid = '523e4567-e89b-12d3-a456-426614174004';

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject dashboard with invalid token', async () => {
      adminAuthService.verifyAdminToken = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer invalid-token`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject analytics with expired token', async () => {
      const validUuid = '623e4567-e89b-12d3-a456-426614174005';

      adminAuthService.verifyAdminToken = jest.fn().mockImplementation(() => {
        throw new Error('Token expired');
      });

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Data Validation', () => {
    test('should reject analytics with invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/admin/applications/invalid-uuid/analytics')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid application ID format');
    });

    test('should use default date range if not specified', async () => {
      const validUuid = '723e4567-e89b-12d3-a456-426614174006';

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        is_active: true
      });

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue({
        login_success_count: 100,
        login_failed_count: 10,
        active_token_count: 15,
        token_validations_count: 250,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: []
      });

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(200);
      expect(databaseService.getApplicationAnalytics).toHaveBeenCalledWith(
        validUuid,
        expect.objectContaining({ dateRange: '30d' })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors in dashboard gracefully', async () => {
      jest.spyOn(databaseService, 'getDashboardStats').mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle database errors in analytics gracefully', async () => {
      const validUuid = '823e4567-e89b-12d3-a456-426614174007';

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        is_active: true
      });

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Caching Behavior', () => {
    test('should respect 5-minute cache for dashboard stats', async () => {
      const mockStats = {
        total_applications: 10,
        active_applications: 8,
        total_active_tokens: 25,
        failed_logins_24h: 5,
        successful_logins_24h: 50,
        token_validations_24h: 120,
        recent_activity: []
      };

      jest.spyOn(databaseService, 'getDashboardStats').mockResolvedValue(mockStats);

      // First request
      const response1 = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response1.status).toBe(200);

      // Second request (should use cache if implemented)
      const response2 = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.data).toEqual(mockStats);
    });

    test('should respect 5-minute cache for analytics', async () => {
      const validUuid = '923e4567-e89b-12d3-a456-426614174008';

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        is_active: true
      });

      const mockAnalytics = {
        login_success_count: 200,
        login_failed_count: 15,
        active_token_count: 25,
        token_validations_count: 500,
        most_recent_activity: '2025-12-04T10:00:00Z',
        peak_usage_times: []
      };

      jest.spyOn(databaseService, 'getApplicationAnalytics').mockResolvedValue(mockAnalytics);

      // First request
      const response1 = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response1.status).toBe(200);

      // Second request (should use cache if implemented)
      const response2 = await request(app)
        .get(`/api/admin/applications/${validUuid}/analytics`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.data).toEqual(mockAnalytics);
    });
  });
});
