const databaseService = require('../../src/services/database');

// Mock services
jest.mock('../../src/services/database');

// Import controller after mocks
const applicationController = require('../../src/controllers/applicationController');

describe('ApplicationController - deleteApplication()', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      params: {},
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
    it('should soft delete application by setting is_active to false', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';

      const mockDeletedApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Deleted Application',
        is_active: false,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-04T12:00:00Z'
      };

      databaseService.deleteApplication.mockResolvedValue(mockDeletedApp);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.deleteApplication(req, res);

      // Assert
      expect(databaseService.deleteApplication).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'application_deleted',
        mockDeletedApp.app_id,
        '127.0.0.1',
        'Jest Test Agent',
        {
          admin_username: 'admin',
          app_name: mockDeletedApp.app_name
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Application deleted successfully'
      });
    });

    it('should NOT return sensitive fields in response', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';

      const mockDeletedApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Deleted Application',
        is_active: false,
        master_password_hash: 'should-not-be-returned',
        app_secret_hash: 'should-not-be-returned',
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-04T12:00:00Z'
      };

      databaseService.deleteApplication.mockResolvedValue(mockDeletedApp);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.deleteApplication(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String)
        })
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.not.objectContaining({
          data: expect.anything()
        })
      );
    });
  });

  describe('Validation Cases', () => {
    it('should reject delete with invalid UUID format', async () => {
      // Arrange
      req.params.id = 'invalid-uuid';

      // Act
      await applicationController.deleteApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
      expect(databaseService.deleteApplication).not.toHaveBeenCalled();
    });

    it('should reject delete with missing id parameter', async () => {
      // Arrange
      req.params = {};

      // Act
      await applicationController.deleteApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
      expect(databaseService.deleteApplication).not.toHaveBeenCalled();
    });

    it('should reject delete with malformed UUID', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-42661417400'; // Missing one character

      // Act
      await applicationController.deleteApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
      expect(databaseService.deleteApplication).not.toHaveBeenCalled();
    });
  });

  describe('Error Cases', () => {
    it('should handle application not found error', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';

      databaseService.deleteApplication.mockResolvedValue(null);

      // Act
      await applicationController.deleteApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application not found'
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';

      databaseService.deleteApplication.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      await applicationController.deleteApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to delete application'
      });
    });

    it('should handle audit log errors gracefully', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';

      const mockDeletedApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Deleted Application',
        is_active: false,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-04T12:00:00Z'
      };

      databaseService.deleteApplication.mockResolvedValue(mockDeletedApp);
      databaseService.logEvent.mockRejectedValue(new Error('Logging failed'));

      // Act
      await applicationController.deleteApplication(req, res);

      // Assert - Should still succeed even if logging fails
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Application deleted successfully'
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';

      databaseService.deleteApplication.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      await applicationController.deleteApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to delete application'
      });
    });
  });
});
