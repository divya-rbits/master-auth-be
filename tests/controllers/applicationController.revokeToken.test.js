const databaseService = require('../../src/services/database');

// Mock services
jest.mock('../../src/services/database');

// Import controller after mocks
const applicationController = require('../../src/controllers/applicationController');

describe('ApplicationController - revokeToken()', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
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
    it('should revoke a token with jti and reason', async () => {
      // Arrange
      req.body = {
        jti: 'token-abc-123',
        reason: 'Security concern'
      };

      databaseService.revokeTokenById.mockResolvedValue({
        success: true,
        token: {
          jti: 'token-abc-123',
          application_id: 'app-123',
          revoked_at: '2025-12-04T12:00:00Z'
        }
      });

      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(databaseService.revokeTokenById).toHaveBeenCalledWith(
        'token-abc-123',
        'Security concern'
      );

      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'token_revoked',
        expect.any(String),
        '127.0.0.1',
        'Jest Test Agent',
        {
          admin_username: 'admin',
          jti: 'token-abc-123',
          reason: 'Security concern'
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token revoked successfully',
        data: {
          jti: 'token-abc-123',
          revoked_at: expect.any(String)
        }
      });
    });

    it('should revoke a token with only jti (no reason)', async () => {
      // Arrange
      req.body = {
        jti: 'token-xyz-456'
      };

      databaseService.revokeTokenById.mockResolvedValue({
        success: true,
        token: {
          jti: 'token-xyz-456',
          application_id: 'app-456',
          revoked_at: '2025-12-04T12:00:00Z'
        }
      });

      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(databaseService.revokeTokenById).toHaveBeenCalledWith(
        'token-xyz-456',
        undefined
      );

      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'token_revoked',
        expect.any(String),
        '127.0.0.1',
        'Jest Test Agent',
        {
          admin_username: 'admin',
          jti: 'token-xyz-456',
          reason: undefined
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token revoked successfully',
        data: {
          jti: 'token-xyz-456',
          revoked_at: expect.any(String)
        }
      });
    });

    it('should handle already revoked token gracefully', async () => {
      // Arrange
      req.body = {
        jti: 'already-revoked-token'
      };

      databaseService.revokeTokenById.mockResolvedValue({
        success: true,
        alreadyRevoked: true,
        token: {
          jti: 'already-revoked-token',
          revoked_at: '2025-12-04T11:00:00Z'
        }
      });

      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token revoked successfully',
        data: {
          jti: 'already-revoked-token',
          revoked_at: expect.any(String)
        }
      });
    });
  });

  describe('Validation Cases', () => {
    it('should return 400 when jti is missing', async () => {
      // Arrange
      req.body = {
        reason: 'Some reason'
      };

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(databaseService.revokeTokenById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'jti is required'
      });
    });

    it('should return 400 when jti is empty string', async () => {
      // Arrange
      req.body = {
        jti: ''
      };

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(databaseService.revokeTokenById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'jti is required'
      });
    });

    it('should return 400 when jti is not a string', async () => {
      // Arrange
      req.body = {
        jti: 12345
      };

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(databaseService.revokeTokenById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'jti must be a string'
      });
    });

    it('should return 400 when reason is not a string', async () => {
      // Arrange
      req.body = {
        jti: 'valid-token',
        reason: 12345
      };

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(databaseService.revokeTokenById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'reason must be a string'
      });
    });
  });

  describe('Error Cases', () => {
    it('should return 404 when token is not found', async () => {
      // Arrange
      req.body = {
        jti: 'non-existent-token'
      };

      databaseService.revokeTokenById.mockResolvedValue({
        success: false,
        notFound: true
      });

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token not found'
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      req.body = {
        jti: 'valid-token'
      };

      databaseService.revokeTokenById.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to revoke token'
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      req.body = {
        jti: 'valid-token'
      };

      databaseService.revokeTokenById.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      await applicationController.revokeToken(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to revoke token'
      });
    });

    it('should continue even if logging fails', async () => {
      // Arrange
      req.body = {
        jti: 'valid-token',
        reason: 'Test reason'
      };

      databaseService.revokeTokenById.mockResolvedValue({
        success: true,
        token: {
          jti: 'valid-token',
          application_id: 'app-123',
          revoked_at: '2025-12-04T12:00:00Z'
        }
      });

      // Make logging fail
      databaseService.logEvent.mockRejectedValue(
        new Error('Logging failed')
      );

      // Act
      await applicationController.revokeToken(req, res);

      // Assert - should still return success
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token revoked successfully',
        data: {
          jti: 'valid-token',
          revoked_at: expect.any(String)
        }
      });
    });
  });
});
