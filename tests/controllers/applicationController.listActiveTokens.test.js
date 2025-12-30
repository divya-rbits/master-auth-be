const databaseService = require('../../src/services/database');

// Mock services
jest.mock('../../src/services/database');

// Import controller after mocks
const applicationController = require('../../src/controllers/applicationController');

describe('ApplicationController - listActiveTokens()', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      query: {},
      admin: {
        username: 'admin',
        role: 'admin'
      },
      ip: '127.0.0.1',
      get: jest.fn((header) => {
        if (header === 'user-agent') return 'Jest Test Agent';
        return null;
      })
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('Success Cases', () => {
    it('should list all active tokens with default pagination', async () => {
      // Arrange
      req.query = {};

      const mockTokens = [
        {
          jti: 'token-1',
          application_id: 'app-123',
          issued_at: '2025-12-04T10:00:00Z',
          expires_at: '2025-12-04T11:00:00Z',
          ip_address: '192.168.1.1'
        },
        {
          jti: 'token-2',
          application_id: 'app-456',
          issued_at: '2025-12-04T10:30:00Z',
          expires_at: '2025-12-04T11:30:00Z',
          ip_address: '192.168.1.2'
        }
      ];

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: mockTokens,
        total: 2,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 50,
        offset: 0,
        issuedFrom: null,
        issuedTo: null,
        expiresFrom: null,
        expiresTo: null
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tokens: mockTokens,
          pagination: {
            total: 2,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });
    });

    it('should list active tokens filtered by application_id', async () => {
      // Arrange
      req.query = {
        application_id: 'app-123'
      };

      const mockTokens = [
        {
          jti: 'token-1',
          application_id: 'app-123',
          issued_at: '2025-12-04T10:00:00Z',
          expires_at: '2025-12-04T11:00:00Z',
          ip_address: '192.168.1.1'
        }
      ];

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: mockTokens,
        total: 1,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: 'app-123',
        limit: 50,
        offset: 0,
        issuedFrom: null,
        issuedTo: null,
        expiresFrom: null,
        expiresTo: null
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tokens: mockTokens,
          pagination: {
            total: 1,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });
    });

    it('should list active tokens with custom pagination', async () => {
      // Arrange
      req.query = {
        limit: '10',
        offset: '5'
      };

      const mockTokens = Array.from({ length: 10 }, (_, i) => ({
        jti: `token-${i + 6}`,
        application_id: `app-${i}`,
        issued_at: '2025-12-04T10:00:00Z',
        expires_at: '2025-12-04T11:00:00Z',
        ip_address: '192.168.1.1'
      }));

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: mockTokens,
        total: 100,
        limit: 10,
        offset: 5
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 10,
        offset: 5,
        issuedFrom: null,
        issuedTo: null,
        expiresFrom: null,
        expiresTo: null
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tokens: mockTokens,
          pagination: {
            total: 100,
            limit: 10,
            offset: 5,
            hasMore: true
          }
        }
      });
    });

    it('should return empty array when no active tokens exist', async () => {
      // Arrange
      req.query = {};

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tokens: [],
          pagination: {
            total: 0,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });
    });

    it('should enforce maximum limit of 100', async () => {
      // Arrange
      req.query = {
        limit: '500' // Request more than max
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
        limit: 100,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 100, // Should be capped at 100
        offset: 0,
        issuedFrom: null,
        issuedTo: null,
        expiresFrom: null,
        expiresTo: null
      });
    });

    it('should enforce minimum limit of 1', async () => {
      // Arrange
      req.query = {
        limit: '0'
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
        limit: 1,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 1, // Should be at least 1
        offset: 0,
        issuedFrom: null,
        issuedTo: null,
        expiresFrom: null,
        expiresTo: null
      });
    });

    it('should enforce minimum offset of 0', async () => {
      // Arrange
      req.query = {
        offset: '-5'
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 50,
        offset: 0, // Should be at least 0
        issuedFrom: null,
        issuedTo: null,
        expiresFrom: null,
        expiresTo: null
      });
    });

    it('should calculate hasMore correctly when there are more results', async () => {
      // Arrange
      req.query = {
        limit: '10',
        offset: '0'
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: Array.from({ length: 10 }, (_, i) => ({
          jti: `token-${i}`,
          application_id: 'app-123',
          issued_at: '2025-12-04T10:00:00Z',
          expires_at: '2025-12-04T11:00:00Z',
          ip_address: '192.168.1.1'
        })),
        total: 50,
        limit: 10,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tokens: expect.any(Array),
          pagination: {
            total: 50,
            limit: 10,
            offset: 0,
            hasMore: true // 0 + 10 < 50
          }
        }
      });
    });

    it('should calculate hasMore correctly when on last page', async () => {
      // Arrange
      req.query = {
        limit: '10',
        offset: '45'
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: Array.from({ length: 5 }, (_, i) => ({
          jti: `token-${i}`,
          application_id: 'app-123',
          issued_at: '2025-12-04T10:00:00Z',
          expires_at: '2025-12-04T11:00:00Z',
          ip_address: '192.168.1.1'
        })),
        total: 50,
        limit: 10,
        offset: 45
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tokens: expect.any(Array),
          pagination: {
            total: 50,
            limit: 10,
            offset: 45,
            hasMore: false // 45 + 10 >= 50
          }
        }
      });
    });
  });

  describe('Date Filtering', () => {
    it('should filter tokens by issued_from date', async () => {
      // Arrange
      req.query = {
        issued_from: '2024-01-01T00:00:00Z'
      };

      const mockTokens = [
        {
          jti: 'token-1',
          application_id: 'app-123',
          issued_at: '2024-06-15T10:00:00Z',
          expires_at: '2024-06-15T11:00:00Z',
          ip_address: '192.168.1.1'
        }
      ];

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: mockTokens,
        total: 1,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 50,
        offset: 0,
        issuedFrom: '2024-01-01T00:00:00Z',
        issuedTo: null,
        expiresFrom: null,
        expiresTo: null
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should filter tokens by issued_to date', async () => {
      // Arrange
      req.query = {
        issued_to: '2024-12-31T23:59:59Z'
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 50,
        offset: 0,
        issuedFrom: null,
        issuedTo: '2024-12-31T23:59:59Z',
        expiresFrom: null,
        expiresTo: null
      });
    });

    it('should filter tokens by expires_from date', async () => {
      // Arrange
      req.query = {
        expires_from: '2025-01-01T00:00:00Z'
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 50,
        offset: 0,
        issuedFrom: null,
        issuedTo: null,
        expiresFrom: '2025-01-01T00:00:00Z',
        expiresTo: null
      });
    });

    it('should filter tokens by expires_to date', async () => {
      // Arrange
      req.query = {
        expires_to: '2025-12-31T23:59:59Z'
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 50,
        offset: 0,
        issuedFrom: null,
        issuedTo: null,
        expiresFrom: null,
        expiresTo: '2025-12-31T23:59:59Z'
      });
    });

    it('should combine multiple date filters', async () => {
      // Arrange
      req.query = {
        issued_from: '2024-01-01T00:00:00Z',
        issued_to: '2024-12-31T23:59:59Z',
        expires_from: '2025-01-01T00:00:00Z'
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: null,
        limit: 50,
        offset: 0,
        issuedFrom: '2024-01-01T00:00:00Z',
        issuedTo: '2024-12-31T23:59:59Z',
        expiresFrom: '2025-01-01T00:00:00Z',
        expiresTo: null
      });
    });

    it('should combine date filters with application_id', async () => {
      // Arrange
      req.query = {
        application_id: 'app-123',
        issued_from: '2024-06-01T00:00:00Z'
      };

      const mockTokens = [
        {
          jti: 'token-1',
          application_id: 'app-123',
          issued_at: '2024-06-15T10:00:00Z',
          expires_at: '2024-06-15T11:00:00Z',
          ip_address: '192.168.1.1'
        }
      ];

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: mockTokens,
        total: 1,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(databaseService.getActiveTokens).toHaveBeenCalledWith({
        applicationId: 'app-123',
        limit: 50,
        offset: 0,
        issuedFrom: '2024-06-01T00:00:00Z',
        issuedTo: null,
        expiresFrom: null,
        expiresTo: null
      });
    });

    it('should return 400 for invalid issued_from date format', async () => {
      // Arrange
      req.query = {
        issued_from: 'invalid-date'
      };

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format for issued_from. Expected ISO 8601 format (e.g., 2024-01-01T00:00:00Z)'
      });
      expect(databaseService.getActiveTokens).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid issued_to date format', async () => {
      // Arrange
      req.query = {
        issued_to: '2024/01/01'
      };

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format for issued_to. Expected ISO 8601 format (e.g., 2024-01-01T00:00:00Z)'
      });
    });

    it('should return 400 for invalid expires_from date format', async () => {
      // Arrange
      req.query = {
        expires_from: '01-01-2024'
      };

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format for expires_from. Expected ISO 8601 format (e.g., 2024-01-01T00:00:00Z)'
      });
    });

    it('should return 400 for invalid expires_to date format', async () => {
      // Arrange
      req.query = {
        expires_to: 'not-a-date'
      };

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format for expires_to. Expected ISO 8601 format (e.g., 2024-01-01T00:00:00Z)'
      });
    });

    it('should return 400 when issued_from is after issued_to', async () => {
      // Arrange
      req.query = {
        issued_from: '2024-12-31T00:00:00Z',
        issued_to: '2024-01-01T00:00:00Z'
      };

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'issued_from must be before or equal to issued_to'
      });
    });

    it('should return 400 when expires_from is after expires_to', async () => {
      // Arrange
      req.query = {
        expires_from: '2025-12-31T00:00:00Z',
        expires_to: '2025-01-01T00:00:00Z'
      };

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'expires_from must be before or equal to expires_to'
      });
    });

    it('should return empty results when no tokens match date range', async () => {
      // Arrange
      req.query = {
        issued_from: '2020-01-01T00:00:00Z',
        issued_to: '2020-12-31T23:59:59Z'
      };

      databaseService.getActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tokens: [],
          pagination: {
            total: 0,
            limit: 50,
            offset: 0,
            hasMore: false
          }
        }
      });
    });
  });

  describe('Error Cases', () => {
    it('should handle database errors', async () => {
      // Arrange
      req.query = {};

      databaseService.getActiveTokens.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve active tokens'
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      req.query = {};

      databaseService.getActiveTokens.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      await applicationController.listActiveTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve active tokens'
      });
    });
  });
});
