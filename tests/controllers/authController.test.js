const authController = require('../../src/controllers/authController');
const passwordService = require('../../src/services/password');
const tokenService = require('../../src/services/token');
const databaseService = require('../../src/services/database');

// Mock all services
jest.mock('../../src/services/password');
jest.mock('../../src/services/token');
jest.mock('../../src/services/database');

describe('AuthController', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      body: {},
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn((header) => {
        if (header === 'user-agent') return 'Jest Test Agent';
        return req.headers[header];
      })
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('login()', () => {
    describe('Success Cases', () => {
      it('should return token on valid login', async () => {
        // Arrange
        req.body = {
          password: 'ValidPassword123',
          application_id: 'test-app-123'
        };

        const mockHash = '$argon2id$v=19$m=65536,t=3,p=4$mockHash';
        const mockToken = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE';
        const mockSalt = 'mockSaltBase64url';

        databaseService.getPasswordHash.mockResolvedValue(mockHash);
        passwordService.verifyPassword.mockResolvedValue(true);
        tokenService.generateToken.mockResolvedValue({
          token: mockToken,
          salt: mockSalt
        });
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.login(req, res);

        // Assert
        expect(databaseService.getPasswordHash).toHaveBeenCalled();
        expect(passwordService.verifyPassword).toHaveBeenCalledWith('ValidPassword123', mockHash);
        expect(tokenService.generateToken).toHaveBeenCalledWith('test-app-123');
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'login_success',
          'test-app-123',
          '127.0.0.1',
          'Jest Test Agent',
          expect.any(Object)
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          token: mockToken,
          salt: mockSalt
        }));
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 when password is missing', async () => {
        // Arrange
        req.body = {
          application_id: 'test-app-123'
        };

        // Act
        await authController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.stringContaining('password')
        }));
      });

      it('should return 400 when application_id is missing', async () => {
        // Arrange
        req.body = {
          password: 'ValidPassword123'
        };

        // Act
        await authController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.stringContaining('application_id')
        }));
      });

      it('should return 400 when password is empty string', async () => {
        // Arrange
        req.body = {
          password: '',
          application_id: 'test-app-123'
        };

        // Act
        await authController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.any(String)
        }));
      });
    });

    describe('Authentication Errors', () => {
      it('should return 401 when password is incorrect', async () => {
        // Arrange
        req.body = {
          password: 'WrongPassword',
          application_id: 'test-app-123'
        };

        const mockHash = '$argon2id$v=19$m=65536,t=3,p=4$mockHash';
        databaseService.getPasswordHash.mockResolvedValue(mockHash);
        passwordService.verifyPassword.mockResolvedValue(false);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.login(req, res);

        // Assert
        expect(passwordService.verifyPassword).toHaveBeenCalledWith('WrongPassword', mockHash);
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'login_failed',
          'test-app-123',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({ reason: 'Invalid password' })
        );
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: 'Invalid credentials'
        }));
      });

      it('should return 401 when password hash not found', async () => {
        // Arrange
        req.body = {
          password: 'ValidPassword123',
          application_id: 'test-app-123'
        };

        databaseService.getPasswordHash.mockResolvedValue(null);

        // Act
        await authController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.any(String)
        }));
      });
    });

    describe('Server Errors', () => {
      it('should return 500 when database error occurs', async () => {
        // Arrange
        req.body = {
          password: 'ValidPassword123',
          application_id: 'test-app-123'
        };

        databaseService.getPasswordHash.mockRejectedValue(new Error('Database connection failed'));

        // Act
        await authController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.any(String)
        }));
      });

      it('should return 500 when token generation fails', async () => {
        // Arrange
        req.body = {
          password: 'ValidPassword123',
          application_id: 'test-app-123'
        };

        const mockHash = '$argon2id$v=19$m=65536,t=3,p=4$mockHash';
        databaseService.getPasswordHash.mockResolvedValue(mockHash);
        passwordService.verifyPassword.mockResolvedValue(true);
        tokenService.generateToken.mockRejectedValue(new Error('Token generation failed'));

        // Act
        await authController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.any(String)
        }));
      });
    });
  });

  describe('validate()', () => {
    describe('Success Cases', () => {
      it('should return success on valid token', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000)
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.validate(req, res);

        // Assert
        expect(tokenService.validateToken).toHaveBeenCalledWith(req.body.token, req.body.salt);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: true,
          payload: mockPayload
        }));
      });

      it('should include expiresIn in response', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const currentTime = Math.floor(Date.now() / 1000);
        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: currentTime + 3600, // Expires in 1 hour
          iat: currentTime
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.validate(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: true,
          expiresIn: expect.any(Number)
        }));

        // Verify expiresIn is approximately 3600 seconds (allow 2 second variance for execution time)
        const response = res.json.mock.calls[0][0];
        expect(response.expiresIn).toBeGreaterThanOrEqual(3598);
        expect(response.expiresIn).toBeLessThanOrEqual(3600);
      });

      it('should include sessionId in response', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000)
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.validate(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: true,
          sessionId: 'mock-jti-123'
        }));
      });

      it('should include permissions array in response', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000)
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.validate(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: true,
          permissions: expect.any(Array)
        }));
      });

      it('should log successful validation event', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000)
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.validate(req, res);

        // Assert
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'token_validation_success',
          'test-app-123',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({
            jti: 'mock-jti-123',
            expiresIn: expect.any(Number)
          })
        );
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 when token is missing', async () => {
        // Arrange
        req.body = {
          salt: 'mockSaltBase64url'
        };

        // Act
        await authController.validate(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: false,
          error: expect.stringContaining('token')
        }));
      });

      it('should return 400 when salt is missing', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE'
        };

        // Act
        await authController.validate(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: false,
          error: expect.stringContaining('salt')
        }));
      });
    });

    describe('Authentication Errors', () => {
      it('should return 401 when token is invalid', async () => {
        // Arrange
        req.body = {
          token: 'invalid-token',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Invalid token format'));

        // Act
        await authController.validate(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: false,
          error: expect.any(String)
        }));
      });

      it('should return 401 when token is expired', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token expired'));

        // Act
        await authController.validate(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: false,
          error: expect.any(String)
        }));
      });

      it('should return 401 when token is revoked', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token has been revoked'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.validate(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: false,
          error: expect.any(String)
        }));
      });

      it('should log failed validation event for revoked token', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token has been revoked'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.validate(req, res);

        // Assert
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'token_validation_failed',
          'unknown',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({
            reason: 'Token has been revoked'
          })
        );
      });

      it('should log failed validation event for expired token', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token expired'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.validate(req, res);

        // Assert
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'token_validation_failed',
          'unknown',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({
            reason: 'Token expired'
          })
        );
      });
    });
  });

  describe('logout()', () => {
    describe('Success Cases', () => {
      it('should revoke token successfully', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000)
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.revokeToken.mockResolvedValue(true);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.logout(req, res);

        // Assert
        expect(tokenService.validateToken).toHaveBeenCalledWith(req.body.token, req.body.salt);
        expect(databaseService.revokeToken).toHaveBeenCalledWith(
          mockPayload.jti,
          expect.any(Date),
          'User logout'
        );
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'logout',
          mockPayload.appId,
          '127.0.0.1',
          'Jest Test Agent',
          expect.any(Object)
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: expect.any(String)
        }));
      });

      it('should handle already revoked token gracefully', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token has been revoked'));

        // Act
        await authController.logout(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: expect.stringContaining('already')
        }));
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 when token is missing', async () => {
        // Arrange
        req.body = {
          salt: 'mockSaltBase64url'
        };

        // Act
        await authController.logout(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.stringContaining('token')
        }));
      });

      it('should return 400 when salt is missing', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE'
        };

        // Act
        await authController.logout(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.stringContaining('salt')
        }));
      });
    });

    describe('Server Errors', () => {
      it('should return 500 when revocation fails', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000)
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.revokeToken.mockRejectedValue(new Error('Database error'));

        // Act
        await authController.logout(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.any(String)
        }));
      });
    });
  });

  describe('refresh()', () => {
    describe('Success Cases', () => {
      it('should generate new token from valid token', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockOldJWE',
          salt: 'mockSaltBase64url'
        };

        const mockOldPayload = {
          appId: 'test-app-123',
          jti: 'old-jti-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          userContext: { userId: 'user-456' }
        };

        const mockNewToken = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockNewJWE';
        const mockNewSalt = 'newMockSaltBase64url';

        tokenService.validateToken.mockResolvedValue(mockOldPayload);
        tokenService.generateToken.mockResolvedValue({
          token: mockNewToken,
          salt: mockNewSalt
        });
        databaseService.revokeToken.mockResolvedValue(true);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.refresh(req, res);

        // Assert
        expect(tokenService.validateToken).toHaveBeenCalledWith(req.body.token, req.body.salt);
        expect(tokenService.generateToken).toHaveBeenCalledWith(
          mockOldPayload.appId,
          mockOldPayload.userContext
        );
        expect(databaseService.revokeToken).toHaveBeenCalledWith(
          mockOldPayload.jti,
          expect.any(Date),
          'Token refreshed'
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          token: mockNewToken,
          salt: mockNewSalt
        }));
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 when token is missing', async () => {
        // Arrange
        req.body = {
          salt: 'mockSaltBase64url'
        };

        // Act
        await authController.refresh(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.stringContaining('token')
        }));
      });

      it('should return 400 when salt is missing', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE'
        };

        // Act
        await authController.refresh(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.stringContaining('salt')
        }));
      });
    });

    describe('Authentication Errors', () => {
      it('should return 401 when token is invalid', async () => {
        // Arrange
        req.body = {
          token: 'invalid-token',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Invalid token'));

        // Act
        await authController.refresh(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.any(String)
        }));
      });

      it('should return 401 when token is revoked', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token has been revoked'));

        // Act
        await authController.refresh(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.any(String)
        }));
      });
    });

    describe('Server Errors', () => {
      it('should return 500 when new token generation fails', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000)
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        tokenService.generateToken.mockRejectedValue(new Error('Token generation failed'));

        // Act
        await authController.refresh(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.any(String)
        }));
      });
    });
  });
});
