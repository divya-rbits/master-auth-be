const databaseService = require('../../src/services/database');
const passwordService = require('../../src/services/password');

// Mock services
jest.mock('../../src/services/database');
jest.mock('../../src/services/password');

// Import controller after mocks
const applicationController = require('../../src/controllers/applicationController');

describe('ApplicationController - changePassword()', () => {
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
    it('should change password with valid inputs and correct current password', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'NewSecurePassword456!';
      const currentPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$currenthash';
      const newPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$newhash';

      req.params = { id: applicationId };
      req.body = {
        current_master_password: currentPassword,
        new_master_password: newPassword
      };

      const mockApplication = {
        id: applicationId,
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        master_password_hash: currentPasswordHash,
        is_active: true
      };

      // Mock database and password service calls
      databaseService.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
      passwordService.verifyPassword = jest.fn().mockResolvedValue(true);
      passwordService.hashPassword = jest.fn().mockResolvedValue(newPasswordHash);
      databaseService.updateMasterPasswordHash = jest.fn().mockResolvedValue(true);
      databaseService.revokeAllTokensForApplication = jest.fn().mockResolvedValue(5);
      databaseService.logEvent = jest.fn().mockResolvedValue(true);

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(databaseService.getApplicationById).toHaveBeenCalledWith(applicationId);
      expect(passwordService.verifyPassword).toHaveBeenCalledWith(currentPassword, currentPasswordHash);
      expect(passwordService.hashPassword).toHaveBeenCalledWith(newPassword);
      expect(databaseService.updateMasterPasswordHash).toHaveBeenCalledWith(applicationId, newPasswordHash);
      expect(databaseService.revokeAllTokensForApplication).toHaveBeenCalledWith('app-123e4567', 'master_password_changed');
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'master_password_changed',
        'app-123e4567',
        '127.0.0.1',
        'Jest Test Agent',
        expect.objectContaining({
          admin_username: 'admin',
          tokens_revoked: 5
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Master password changed successfully. All active tokens have been revoked.',
        data: {
          tokens_revoked: 5
        }
      });
    });

    it('should accept new password with exactly 12 characters', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';
      const newPassword = 'NewPass12345'; // Exactly 12 characters

      req.params = { id: applicationId };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: newPassword
      };

      const mockApplication = {
        id: applicationId,
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$currenthash',
        is_active: true
      };

      databaseService.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
      passwordService.verifyPassword = jest.fn().mockResolvedValue(true);
      passwordService.hashPassword = jest.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$newhash');
      databaseService.updateMasterPasswordHash = jest.fn().mockResolvedValue(true);
      databaseService.revokeAllTokensForApplication = jest.fn().mockResolvedValue(0);
      databaseService.logEvent = jest.fn().mockResolvedValue(true);

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(passwordService.hashPassword).toHaveBeenCalledWith(newPassword);
    });
  });

  describe('Validation Cases', () => {
    it('should reject invalid application ID format', async () => {
      // Arrange
      req.params = { id: 'invalid-uuid' };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: 'NewSecurePassword456!'
      };

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
    });

    it('should reject missing current_master_password', async () => {
      // Arrange
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      req.body = {
        new_master_password: 'NewSecurePassword456!'
      };

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'current_master_password is required'
      });
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
    });

    it('should reject empty current_master_password', async () => {
      // Arrange
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      req.body = {
        current_master_password: '',
        new_master_password: 'NewSecurePassword456!'
      };

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'current_master_password is required'
      });
    });

    it('should reject missing new_master_password', async () => {
      // Arrange
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      req.body = {
        current_master_password: 'CurrentPassword123!'
      };

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'new_master_password is required'
      });
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
    });

    it('should reject new_master_password shorter than 12 characters', async () => {
      // Arrange
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: 'Short123' // Only 8 characters
      };

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'new_master_password must be at least 12 characters'
      });
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
    });

    it('should reject non-string current_master_password', async () => {
      // Arrange
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      req.body = {
        current_master_password: 12345,
        new_master_password: 'NewSecurePassword456!'
      };

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'current_master_password is required'
      });
    });

    it('should reject non-string new_master_password', async () => {
      // Arrange
      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: 12345
      };

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'new_master_password is required'
      });
    });
  });

  describe('Security Cases', () => {
    it('should reject incorrect current password', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';

      req.params = { id: applicationId };
      req.body = {
        current_master_password: 'WrongPassword123!',
        new_master_password: 'NewSecurePassword456!'
      };

      const mockApplication = {
        id: applicationId,
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$currenthash',
        is_active: true
      };

      databaseService.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
      passwordService.verifyPassword = jest.fn().mockResolvedValue(false); // Password verification fails

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(passwordService.verifyPassword).toHaveBeenCalledWith(
        'WrongPassword123!',
        '$argon2id$v=19$m=65536,t=3,p=4$currenthash'
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Current password is incorrect'
      });
      expect(databaseService.updateMasterPasswordHash).not.toHaveBeenCalled();
      expect(databaseService.revokeAllTokensForApplication).not.toHaveBeenCalled();
    });

    it('should log failed password change attempts', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';

      req.params = { id: applicationId };
      req.body = {
        current_master_password: 'WrongPassword123!',
        new_master_password: 'NewSecurePassword456!'
      };

      const mockApplication = {
        id: applicationId,
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$currenthash',
        is_active: true
      };

      databaseService.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
      passwordService.verifyPassword = jest.fn().mockResolvedValue(false);
      databaseService.logEvent = jest.fn().mockResolvedValue(true);

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(databaseService.logEvent).toHaveBeenCalledWith(
        'master_password_change_failed',
        'app-123e4567',
        '127.0.0.1',
        'Jest Test Agent',
        expect.objectContaining({
          admin_username: 'admin',
          reason: 'incorrect_current_password'
        })
      );
    });
  });

  describe('Error Cases', () => {
    it('should return 404 when application not found', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';

      req.params = { id: applicationId };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: 'NewSecurePassword456!'
      };

      databaseService.getApplicationById = jest.fn().mockResolvedValue(null);

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application not found'
      });
      expect(passwordService.verifyPassword).not.toHaveBeenCalled();
    });

    it('should handle database errors when retrieving application', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';

      req.params = { id: applicationId };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: 'NewSecurePassword456!'
      };

      databaseService.getApplicationById = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to change master password'
      });
    });

    it('should handle password hashing errors', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';

      req.params = { id: applicationId };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: 'NewSecurePassword456!'
      };

      const mockApplication = {
        id: applicationId,
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$currenthash',
        is_active: true
      };

      databaseService.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
      passwordService.verifyPassword = jest.fn().mockResolvedValue(true);
      passwordService.hashPassword = jest.fn().mockRejectedValue(
        new Error('Hashing failed')
      );

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to change master password'
      });
      expect(databaseService.updateMasterPasswordHash).not.toHaveBeenCalled();
    });

    it('should handle database errors during password update', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';

      req.params = { id: applicationId };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: 'NewSecurePassword456!'
      };

      const mockApplication = {
        id: applicationId,
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$currenthash',
        is_active: true
      };

      databaseService.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
      passwordService.verifyPassword = jest.fn().mockResolvedValue(true);
      passwordService.hashPassword = jest.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$newhash');
      databaseService.updateMasterPasswordHash = jest.fn().mockRejectedValue(
        new Error('Database update failed')
      );

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to change master password'
      });
    });
  });

  describe('Token Revocation', () => {
    it('should revoke all active tokens after password change', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';

      req.params = { id: applicationId };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: 'NewSecurePassword456!'
      };

      const mockApplication = {
        id: applicationId,
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$currenthash',
        is_active: true
      };

      databaseService.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
      passwordService.verifyPassword = jest.fn().mockResolvedValue(true);
      passwordService.hashPassword = jest.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$newhash');
      databaseService.updateMasterPasswordHash = jest.fn().mockResolvedValue(true);
      databaseService.revokeAllTokensForApplication = jest.fn().mockResolvedValue(10);
      databaseService.logEvent = jest.fn().mockResolvedValue(true);

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(databaseService.revokeAllTokensForApplication).toHaveBeenCalledWith('app-123e4567', 'master_password_changed');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tokens_revoked: 10
          }
        })
      );
    });

    it('should handle zero tokens revoked', async () => {
      // Arrange
      const applicationId = '123e4567-e89b-12d3-a456-426614174000';

      req.params = { id: applicationId };
      req.body = {
        current_master_password: 'CurrentPassword123!',
        new_master_password: 'NewSecurePassword456!'
      };

      const mockApplication = {
        id: applicationId,
        app_id: 'app-123e4567',
        app_name: 'Test Application',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$currenthash',
        is_active: true
      };

      databaseService.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
      passwordService.verifyPassword = jest.fn().mockResolvedValue(true);
      passwordService.hashPassword = jest.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$newhash');
      databaseService.updateMasterPasswordHash = jest.fn().mockResolvedValue(true);
      databaseService.revokeAllTokensForApplication = jest.fn().mockResolvedValue(0);
      databaseService.logEvent = jest.fn().mockResolvedValue(true);

      // Act
      await applicationController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tokens_revoked: 0
          }
        })
      );
    });
  });
});
