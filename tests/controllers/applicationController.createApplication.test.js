const databaseService = require('../../src/services/database');
const passwordService = require('../../src/services/password');

// Mock services
jest.mock('../../src/services/database');
jest.mock('../../src/services/password');

// Import controller after mocks
const applicationController = require('../../src/controllers/applicationController');

describe('ApplicationController - createApplication()', () => {
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
    it('should create application with valid inputs', async () => {
      // Arrange
      req.body = {
        app_name: 'Test Application',
        master_password: 'SecurePassword123!'
      };

      const mockPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$somehash';
      const mockApplication = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        app_secret_hash: '$argon2id$v=19$m=65536,t=3,p=4$secrethash',
        plain_app_secret: 'abc123def456ghi789jkl012mno345pq',
        is_active: true,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T10:00:00Z'
      };

      passwordService.hashPassword.mockResolvedValue(mockPasswordHash);
      databaseService.createApplication.mockResolvedValue(mockApplication);

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(passwordService.hashPassword).toHaveBeenCalledWith('SecurePassword123!');
      expect(databaseService.createApplication).toHaveBeenCalledWith({
        app_name: 'Test Application',
        master_password_hash: mockPasswordHash
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: mockApplication.id,
          app_id: mockApplication.app_id,
          app_name: mockApplication.app_name,
          app_secret: mockApplication.plain_app_secret,
          is_active: mockApplication.is_active,
          created_at: mockApplication.created_at,
          updated_at: mockApplication.updated_at
        },
        message: 'Application created successfully. Save the app_secret - it will not be shown again.'
      });
    });

    it('should generate unique UUID for app_id', async () => {
      // Arrange
      req.body = {
        app_name: 'Unique App',
        master_password: 'SecurePassword123!'
      };

      const mockPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$somehash';
      const mockApplication = {
        id: '987e6543-e21b-32d1-b654-123456789abc',
        app_id: 'app-987e6543',
        app_name: 'Unique App',
        app_secret_hash: '$argon2id$v=19$m=65536,t=3,p=4$secrethash',
        plain_app_secret: 'xyz987uvw654rst321opq098mno765lk',
        is_active: true,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T10:00:00Z'
      };

      passwordService.hashPassword.mockResolvedValue(mockPasswordHash);
      databaseService.createApplication.mockResolvedValue(mockApplication);

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            app_id: expect.stringMatching(/^app-[a-f0-9-]+$/)
          })
        })
      );
    });

    it('should return plain app_secret only once', async () => {
      // Arrange
      req.body = {
        app_name: 'Secret Test App',
        master_password: 'SecurePassword123!'
      };

      const mockPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$somehash';
      const mockApplication = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Secret Test App',
        app_secret_hash: '$argon2id$v=19$m=65536,t=3,p=4$secrethash',
        plain_app_secret: 'plainSecretShouldBeReturned123456',
        is_active: true,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T10:00:00Z'
      };

      passwordService.hashPassword.mockResolvedValue(mockPasswordHash);
      databaseService.createApplication.mockResolvedValue(mockApplication);

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            app_secret: 'plainSecretShouldBeReturned123456'
          })
        })
      );
    });

    it('should NOT return master_password_hash or app_secret_hash in response', async () => {
      // Arrange
      req.body = {
        app_name: 'Secure App',
        master_password: 'SecurePassword123!'
      };

      const mockPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$somehash';
      const mockApplication = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Secure App',
        app_secret_hash: '$argon2id$v=19$m=65536,t=3,p=4$secrethash',
        plain_app_secret: 'plainSecret123',
        master_password_hash: mockPasswordHash,
        is_active: true,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T10:00:00Z'
      };

      passwordService.hashPassword.mockResolvedValue(mockPasswordHash);
      databaseService.createApplication.mockResolvedValue(mockApplication);

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            master_password_hash: expect.anything(),
            app_secret_hash: expect.anything()
          })
        })
      );
    });
  });

  describe('Validation Cases', () => {
    it('should reject request with missing app_name', async () => {
      // Arrange
      req.body = {
        master_password: 'SecurePassword123!'
      };

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'app_name is required'
      });
      expect(passwordService.hashPassword).not.toHaveBeenCalled();
      expect(databaseService.createApplication).not.toHaveBeenCalled();
    });

    it('should reject request with empty app_name', async () => {
      // Arrange
      req.body = {
        app_name: '   ',
        master_password: 'SecurePassword123!'
      };

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'app_name is required'
      });
    });

    it('should reject request with missing master_password', async () => {
      // Arrange
      req.body = {
        app_name: 'Test App'
      };

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'master_password is required'
      });
      expect(passwordService.hashPassword).not.toHaveBeenCalled();
      expect(databaseService.createApplication).not.toHaveBeenCalled();
    });

    it('should reject master_password shorter than 12 characters', async () => {
      // Arrange
      req.body = {
        app_name: 'Test App',
        master_password: 'Short123' // Only 8 characters
      };

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'master_password must be at least 12 characters'
      });
      expect(passwordService.hashPassword).not.toHaveBeenCalled();
      expect(databaseService.createApplication).not.toHaveBeenCalled();
    });

    it('should accept master_password with exactly 12 characters', async () => {
      // Arrange
      req.body = {
        app_name: 'Test App',
        master_password: 'Secure123456' // Exactly 12 characters
      };

      const mockPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$somehash';
      const mockApplication = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        app_id: 'app-123e4567',
        app_name: 'Test App',
        app_secret_hash: '$argon2id$v=19$m=65536,t=3,p=4$secrethash',
        plain_app_secret: 'plainSecret123',
        is_active: true,
        created_at: '2025-12-03T10:00:00Z',
        updated_at: '2025-12-03T10:00:00Z'
      };

      passwordService.hashPassword.mockResolvedValue(mockPasswordHash);
      databaseService.createApplication.mockResolvedValue(mockApplication);

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(passwordService.hashPassword).toHaveBeenCalled();
      expect(databaseService.createApplication).toHaveBeenCalled();
    });
  });

  describe('Error Cases', () => {
    it('should handle password hashing errors', async () => {
      // Arrange
      req.body = {
        app_name: 'Test App',
        master_password: 'SecurePassword123!'
      };

      passwordService.hashPassword.mockRejectedValue(
        new Error('Hashing failed')
      );

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create application'
      });
      expect(databaseService.createApplication).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      // Arrange
      req.body = {
        app_name: 'Test App',
        master_password: 'SecurePassword123!'
      };

      const mockPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$somehash';
      passwordService.hashPassword.mockResolvedValue(mockPasswordHash);
      databaseService.createApplication.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create application'
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      req.body = {
        app_name: 'Test App',
        master_password: 'SecurePassword123!'
      };

      passwordService.hashPassword.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      await applicationController.createApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create application'
      });
    });
  });
});
