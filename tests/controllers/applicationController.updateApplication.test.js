const databaseService = require('../../src/services/database');

// Mock services
jest.mock('../../src/services/database');

// Import controller after mocks
const applicationController = require('../../src/controllers/applicationController');

describe('ApplicationController - updateApplication()', () => {
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
    it('should update application with app_name only', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        app_name: 'Updated App Name'
      };

      const mockUpdatedApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Updated App Name',
        is_active: true,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T11:00:00Z'
      };

      databaseService.updateApplication.mockResolvedValue(mockUpdatedApp);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(databaseService.updateApplication).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        { app_name: 'Updated App Name' }
      );

      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'application_updated',
        mockUpdatedApp.app_id,
        '127.0.0.1',
        'Jest Test Agent',
        {
          admin_username: 'admin',
          app_name: 'Updated App Name'
        }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedApp,
        message: 'Application updated successfully'
      });
    });

    it('should update application with is_active only', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        is_active: false
      };

      const mockUpdatedApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Test App',
        is_active: false,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T11:00:00Z'
      };

      databaseService.updateApplication.mockResolvedValue(mockUpdatedApp);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(databaseService.updateApplication).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        { is_active: false }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedApp,
        message: 'Application updated successfully'
      });
    });

    it('should update application with both app_name and is_active', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        app_name: 'Fully Updated App',
        is_active: false
      };

      const mockUpdatedApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Fully Updated App',
        is_active: false,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T11:00:00Z'
      };

      databaseService.updateApplication.mockResolvedValue(mockUpdatedApp);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(databaseService.updateApplication).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        { app_name: 'Fully Updated App', is_active: false }
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should trim whitespace from app_name', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        app_name: '  Trimmed App Name  '
      };

      const mockUpdatedApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Trimmed App Name',
        is_active: true,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T11:00:00Z'
      };

      databaseService.updateApplication.mockResolvedValue(mockUpdatedApp);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(databaseService.updateApplication).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        { app_name: 'Trimmed App Name' }
      );
    });

    it('should NOT return sensitive fields in response', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        app_name: 'Updated App'
      };

      const mockUpdatedApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Updated App',
        is_active: true,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T11:00:00Z'
      };

      databaseService.updateApplication.mockResolvedValue(mockUpdatedApp);
      databaseService.logEvent.mockResolvedValue(true);

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            master_password_hash: expect.anything(),
            app_secret: expect.anything(),
            app_secret_hash: expect.anything()
          })
        })
      );
    });
  });

  describe('Validation Cases', () => {
    it('should reject update with empty body', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {};

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'At least one field (app_name or is_active) must be provided'
      });
      expect(databaseService.updateApplication).not.toHaveBeenCalled();
    });

    it('should reject update with empty string app_name', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        app_name: '   '
      };

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'app_name cannot be empty'
      });
      expect(databaseService.updateApplication).not.toHaveBeenCalled();
    });

    it('should reject update with non-string app_name', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        app_name: 123
      };

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'app_name must be a string'
      });
      expect(databaseService.updateApplication).not.toHaveBeenCalled();
    });

    it('should reject update with non-boolean is_active', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        is_active: 'true'
      };

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'is_active must be a boolean'
      });
      expect(databaseService.updateApplication).not.toHaveBeenCalled();
    });

    it('should reject update with invalid UUID format', async () => {
      // Arrange
      req.params.id = 'invalid-uuid';
      req.body = {
        app_name: 'Updated App'
      };

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
      expect(databaseService.updateApplication).not.toHaveBeenCalled();
    });

    it('should reject update with missing id parameter', async () => {
      // Arrange
      req.params = {};
      req.body = {
        app_name: 'Updated App'
      };

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
      expect(databaseService.updateApplication).not.toHaveBeenCalled();
    });
  });

  describe('Error Cases', () => {
    it('should handle application not found error', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        app_name: 'Updated App'
      };

      databaseService.updateApplication.mockResolvedValue(null);

      // Act
      await applicationController.updateApplication(req, res);

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
      req.body = {
        app_name: 'Updated App'
      };

      databaseService.updateApplication.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update application'
      });
    });

    it('should handle audit log errors gracefully', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        app_name: 'Updated App'
      };

      const mockUpdatedApp = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Updated App',
        is_active: true,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T11:00:00Z'
      };

      databaseService.updateApplication.mockResolvedValue(mockUpdatedApp);
      databaseService.logEvent.mockRejectedValue(new Error('Logging failed'));

      // Act
      await applicationController.updateApplication(req, res);

      // Assert - Should still succeed even if logging fails
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedApp,
        message: 'Application updated successfully'
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      req.params.id = '123e4567-e89b-12d3-a456-426614174000';
      req.body = {
        app_name: 'Updated App'
      };

      databaseService.updateApplication.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      await applicationController.updateApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update application'
      });
    });
  });
});
