const databaseService = require('../../src/services/database');
const supabase = require('../../src/config/supabase');

// Mock the Supabase client
jest.mock('../../src/config/supabase', () => ({
  from: jest.fn()
}));

describe('DatabaseService - Audit Logging', () => {
  let mockFrom;
  let mockSelect;
  let mockInsert;
  let mockEq;
  let mockSingle;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock chain for Supabase queries
    mockSingle = jest.fn();
    mockEq = jest.fn(() => ({ single: mockSingle }));
    mockSelect = jest.fn(() => ({ eq: mockEq }));
    mockInsert = jest.fn(() => ({ error: null }));

    mockFrom = jest.fn((table) => {
      if (table === 'audit_logs') {
        return { insert: mockInsert };
      }
      return { select: mockSelect };
    });

    supabase.from = mockFrom;
  });

  describe('logEvent', () => {
    test('should log a successful login event with all required fields', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'login_success',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0',
        { message: 'User authenticated successfully' }
      );

      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('audit_logs');
      expect(mockInsert).toHaveBeenCalledWith({
        event_type: 'login_success',
        application_id: 'test-app-001',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        details: { message: 'User authenticated successfully' },
        created_at: expect.any(String)
      });
    });

    test('should log a failed login event with reason', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'login_failed',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0',
        { reason: 'Invalid password' }
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'login_failed',
          details: { reason: 'Invalid password' }
        })
      );
    });

    test('should log token validation success event', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'token_validation_success',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0',
        { jti: 'unique-token-id', expiresIn: 3600 }
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'token_validation_success',
          details: { jti: 'unique-token-id', expiresIn: 3600 }
        })
      );
    });

    test('should log token validation failed event', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'token_validation_failed',
        'unknown',
        '192.168.1.1',
        'Mozilla/5.0',
        { reason: 'Token expired' }
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'token_validation_failed',
          application_id: 'unknown',
          details: { reason: 'Token expired' }
        })
      );
    });

    test('should log logout event with jti', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'logout',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0',
        { jti: 'unique-token-id' }
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'logout',
          details: { jti: 'unique-token-id' }
        })
      );
    });

    test('should log token refresh event', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'token_refresh',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0',
        { oldJti: 'old-token-id', message: 'Token refreshed successfully' }
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'token_refresh',
          details: { oldJti: 'old-token-id', message: 'Token refreshed successfully' }
        })
      );
    });

    test('should log token revocation event', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'token_revoked',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0',
        {
          revokedJti: 'target-token-id',
          requestingJti: 'requesting-token-id',
          reason: 'Security policy violation'
        }
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'token_revoked',
          details: {
            revokedJti: 'target-token-id',
            requestingJti: 'requesting-token-id',
            reason: 'Security policy violation'
          }
        })
      );
    });

    test('should log token status check event', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'token_status_check',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0',
        { jti: 'unique-token-id', valid: true }
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'token_status_check',
          details: { jti: 'unique-token-id', valid: true }
        })
      );
    });

    test('should log rate limit exceeded event', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'rate_limit_exceeded',
        'unknown',
        '192.168.1.1',
        'Mozilla/5.0',
        { endpoint: '/api/auth/login', limit: 5 }
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'rate_limit_exceeded',
          details: { endpoint: '/api/auth/login', limit: 5 }
        })
      );
    });

    test('should handle logging with empty details object', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'login_success',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          details: {}
        })
      );
    });

    test('should handle logging with null details by converting to empty object', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'login_success',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0',
        null
      );

      expect(result).toBe(true);
      // Helper method converts null to empty object for consistency
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          details: {}
        })
      );
    });

    test('should include ISO timestamp in created_at field', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const beforeTime = new Date().toISOString();
      await databaseService.logEvent(
        'login_success',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0'
      );
      const afterTime = new Date().toISOString();

      const callArgs = mockInsert.mock.calls[0][0];
      expect(callArgs.created_at).toBeDefined();
      expect(callArgs.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(callArgs.created_at >= beforeTime).toBe(true);
      expect(callArgs.created_at <= afterTime).toBe(true);
    });

    test('should return false when database insert fails', async () => {
      mockInsert.mockResolvedValue({
        error: { message: 'Database connection failed' }
      });

      const result = await databaseService.logEvent(
        'login_success',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(result).toBe(false);
    });

    test('should not throw error when logging fails', async () => {
      mockInsert.mockRejectedValue(new Error('Network error'));

      await expect(
        databaseService.logEvent(
          'login_success',
          'test-app-001',
          '192.168.1.1',
          'Mozilla/5.0'
        )
      ).resolves.toBe(false);
    });

    test('should return false for invalid event type', async () => {
      const result = await databaseService.logEvent(
        null,
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0'
      );
      expect(result).toBe(false);
    });

    test('should return false for empty event type', async () => {
      const result = await databaseService.logEvent(
        '',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0'
      );
      expect(result).toBe(false);
    });

    test('should return false for non-string event type', async () => {
      const result = await databaseService.logEvent(
        123,
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0'
      );
      expect(result).toBe(false);
    });

    test('should handle complex nested details object', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const complexDetails = {
        user: { id: '123', role: 'admin' },
        metadata: { loginAttempts: 3, lastLogin: '2025-01-01' },
        nested: { deep: { value: 'test' } }
      };

      const result = await databaseService.logEvent(
        'login_success',
        'test-app-001',
        '192.168.1.1',
        'Mozilla/5.0',
        complexDetails
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          details: complexDetails
        })
      );
    });

    test('should handle special characters in IP address and user agent', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'login_success',
        'test-app-001',
        '::ffff:192.168.1.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: '::ffff:192.168.1.1',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
      );
    });

    test('should handle null or undefined application_id', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await databaseService.logEvent(
        'login_failed',
        null,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          application_id: null
        })
      );
    });
  });
});
