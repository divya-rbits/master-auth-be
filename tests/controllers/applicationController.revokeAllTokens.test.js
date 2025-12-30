const databaseService = require('../../src/services/database');

// Mock services
jest.mock('../../src/services/database');

// Import controller after mocks
const applicationController = require('../../src/controllers/applicationController');

describe('ApplicationController - revokeAllTokens()', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      params: {},
      body: {},
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
    it('should revoke all tokens for an application with reason', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        reason: 'Security audit'
      };

      const mockApplication = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        is_active: true
      };

      databaseService.getApplicationById.mockResolvedValue(mockApplication);
      databaseService.revokeAllTokensForApplication.mockResolvedValue(5);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(databaseService.getApplicationById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(databaseService.revokeAllTokensForApplication).toHaveBeenCalledWith('app-123e4567', 'Security audit');
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'tokens_bulk_revoked',
        'app-123e4567',
        '127.0.0.1',
        'Jest Test Agent',
        {
          admin_username: 'admin',
          tokens_revoked: 5,
          reason: 'Security audit'
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'All tokens revoked successfully',
        data: {
          tokens_revoked: 5
        }
      });
    });

    it('should revoke all tokens without reason', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {};

      const mockApplication = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        is_active: true
      };

      databaseService.getApplicationById.mockResolvedValue(mockApplication);
      databaseService.revokeAllTokensForApplication.mockResolvedValue(3);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(databaseService.revokeAllTokensForApplication).toHaveBeenCalledWith('app-123e4567', undefined);
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'tokens_bulk_revoked',
        'app-123e4567',
        '127.0.0.1',
        'Jest Test Agent',
        {
          admin_username: 'admin',
          tokens_revoked: 3,
          reason: undefined
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'All tokens revoked successfully',
        data: {
          tokens_revoked: 3
        }
      });
    });

    it('should handle case when no tokens exist to revoke', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        reason: 'Testing'
      };

      const mockApplication = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        is_active: true
      };

      databaseService.getApplicationById.mockResolvedValue(mockApplication);
      databaseService.revokeAllTokensForApplication.mockResolvedValue(0);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'All tokens revoked successfully',
        data: {
          tokens_revoked: 0
        }
      });
    });

    it('should continue even if logging fails', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        reason: 'Test reason'
      };

      const mockApplication = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        is_active: true
      };

      databaseService.getApplicationById.mockResolvedValue(mockApplication);
      databaseService.revokeAllTokensForApplication.mockResolvedValue(2);
      databaseService.logEvent.mockRejectedValue(new Error('Logging failed'));

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert - should still return success
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'All tokens revoked successfully',
        data: {
          tokens_revoked: 2
        }
      });
    });
  });

  describe('Validation Cases', () => {
    it('should return 400 for invalid UUID format', async () => {
      // Arrange
      req.params.id = 'invalid-uuid';
      req.body = {};

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
    });

    it('should return 400 when reason is not a string', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        reason: 12345
      };

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'reason must be a string'
      });
    });

    it('should return 400 when reason is an empty string', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        reason: ''
      };

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'reason cannot be empty'
      });
    });
  });

  describe('Error Cases', () => {
    it('should return 404 when application not found', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {};

      databaseService.getApplicationById.mockResolvedValue(null);

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application not found'
      });
    });

    it('should handle database errors during application lookup', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {};

      databaseService.getApplicationById.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to revoke tokens'
      });
    });

    it('should handle database errors during token revocation', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        reason: 'Test'
      };

      const mockApplication = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        is_active: true
      };

      databaseService.getApplicationById.mockResolvedValue(mockApplication);
      databaseService.revokeAllTokensForApplication.mockRejectedValue(
        new Error('Failed to revoke tokens')
      );

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to revoke tokens'
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {};

      databaseService.getApplicationById.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      await applicationController.revokeAllTokens(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to revoke tokens'
      });
    });
  });
});
