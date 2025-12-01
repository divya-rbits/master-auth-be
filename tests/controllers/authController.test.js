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

    // Validation Errors are now tested in middleware/validation.test.js
    // since validation logic moved to middleware

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

    // Validation Errors are now tested in middleware/validation.test.js

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

    // Validation Errors are now tested in middleware/validation.test.js

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

    // Validation Errors are now tested in middleware/validation.test.js

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

  describe('tokenStatus()', () => {
    describe('Success Cases', () => {
      it('should return detailed token status for valid token from body', async () => {
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
          iat: currentTime - 600 // Issued 10 minutes ago
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.tokenStatus(req, res);

        // Assert
        expect(tokenService.validateToken).toHaveBeenCalledWith(req.body.token, req.body.salt);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: true,
          status: expect.objectContaining({
            expiresIn: expect.any(Number),
            issuedAt: expect.any(String),
            sessionId: 'mock-jti-123',
            applicationId: 'test-app-123',
            revoked: false
          }),
          message: 'Token is valid'
        }));

        // Verify expiresIn is approximately 3600 seconds
        const response = res.json.mock.calls[0][0];
        expect(response.status.expiresIn).toBeGreaterThanOrEqual(3598);
        expect(response.status.expiresIn).toBeLessThanOrEqual(3600);
      });

      it('should return token status with correct ISO timestamp for issuedAt', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const currentTime = Math.floor(Date.now() / 1000);
        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: currentTime + 3600,
          iat: currentTime - 600
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.tokenStatus(req, res);

        // Assert
        const response = res.json.mock.calls[0][0];
        expect(response.status.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

        // Verify it's a valid ISO string
        const issuedAtDate = new Date(response.status.issuedAt);
        expect(issuedAtDate.getTime()).toBe(mockPayload.iat * 1000);
      });

      it('should handle token from Authorization header (Bearer format)', async () => {
        // Arrange
        req.headers.authorization = 'Bearer eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE';
        req.body = {
          salt: 'mockSaltBase64url'
        };

        const currentTime = Math.floor(Date.now() / 1000);
        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: currentTime + 3600,
          iat: currentTime
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.tokenStatus(req, res);

        // Assert
        expect(tokenService.validateToken).toHaveBeenCalledWith(
          'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          'mockSaltBase64url'
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: true
        }));
      });

      it('should log token status check event', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        const currentTime = Math.floor(Date.now() / 1000);
        const mockPayload = {
          appId: 'test-app-123',
          jti: 'mock-jti-123',
          exp: currentTime + 3600,
          iat: currentTime
        };

        tokenService.validateToken.mockResolvedValue(mockPayload);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.tokenStatus(req, res);

        // Assert
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'token_status_check',
          'test-app-123',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({
            jti: 'mock-jti-123',
            valid: true
          })
        );
      });
    });

    // Validation Errors are now tested in middleware/validation.test.js

    describe('Authentication Errors', () => {
      it('should return 401 for expired token with graceful message', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token expired'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.tokenStatus(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: false,
          error: 'Token expired'
        }));
      });

      it('should return 401 for revoked token with graceful message', async () => {
        // Arrange
        req.body = {
          token: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWE',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token has been revoked'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.tokenStatus(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: false,
          error: 'Token has been revoked'
        }));
      });

      it('should return 401 for invalid token', async () => {
        // Arrange
        req.body = {
          token: 'invalid-token',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Invalid token format'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.tokenStatus(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          valid: false,
          error: expect.any(String)
        }));
      });

      it('should log failed status check for invalid token', async () => {
        // Arrange
        req.body = {
          token: 'invalid-token',
          salt: 'mockSaltBase64url'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Invalid token format'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.tokenStatus(req, res);

        // Assert
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'token_status_check_failed',
          'unknown',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({
            reason: 'Invalid token format'
          })
        );
      });
    });
  });

  describe('revokeToken()', () => {
    describe('Success Cases', () => {
      it('should revoke a token successfully with valid requesting token', async () => {
        // Arrange
        req.body = {
          requestingToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..requestingJWE',
          requestingSalt: 'requestingSalt123',
          targetToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..targetJWE',
          targetSalt: 'targetSalt456',
          reason: 'User requested revocation'
        };

        const currentTime = Math.floor(Date.now() / 1000);
        const mockRequestingPayload = {
          appId: 'test-app-123',
          jti: 'requesting-jti-123',
          exp: currentTime + 3600,
          iat: currentTime
        };

        const mockTargetPayload = {
          appId: 'test-app-456',
          jti: 'target-jti-456',
          exp: currentTime + 3600,
          iat: currentTime
        };

        // Mock validation for requesting token (first call)
        tokenService.validateToken
          .mockResolvedValueOnce(mockRequestingPayload)
          .mockResolvedValueOnce(mockTargetPayload);

        databaseService.revokeToken.mockResolvedValue(true);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.revokeToken(req, res);

        // Assert
        expect(tokenService.validateToken).toHaveBeenCalledTimes(2);
        expect(tokenService.validateToken).toHaveBeenNthCalledWith(1, req.body.requestingToken, req.body.requestingSalt);
        expect(tokenService.validateToken).toHaveBeenNthCalledWith(2, req.body.targetToken, req.body.targetSalt);
        expect(databaseService.revokeToken).toHaveBeenCalledWith(
          mockTargetPayload.jti,
          expect.any(Date),
          'User requested revocation'
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: 'Token revoked successfully',
          revokedTokenId: 'target-jti-456'
        }));
      });

      it('should log revocation event with reason and requesting user info', async () => {
        // Arrange
        req.body = {
          requestingToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..requestingJWE',
          requestingSalt: 'requestingSalt123',
          targetToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..targetJWE',
          targetSalt: 'targetSalt456',
          reason: 'Security breach'
        };

        const currentTime = Math.floor(Date.now() / 1000);
        const mockRequestingPayload = {
          appId: 'test-app-123',
          jti: 'requesting-jti-123',
          exp: currentTime + 3600,
          iat: currentTime
        };

        const mockTargetPayload = {
          appId: 'test-app-456',
          jti: 'target-jti-456',
          exp: currentTime + 3600,
          iat: currentTime
        };

        tokenService.validateToken
          .mockResolvedValueOnce(mockRequestingPayload)
          .mockResolvedValueOnce(mockTargetPayload);

        databaseService.revokeToken.mockResolvedValue(true);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.revokeToken(req, res);

        // Assert
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'token_revoked',
          mockTargetPayload.appId,
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({
            revokedJti: 'target-jti-456',
            requestingJti: 'requesting-jti-123',
            reason: 'Security breach'
          })
        );
      });

      it('should handle already revoked target token gracefully', async () => {
        // Arrange
        req.body = {
          requestingToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..requestingJWE',
          requestingSalt: 'requestingSalt123',
          targetToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..targetJWE',
          targetSalt: 'targetSalt456',
          reason: 'User request'
        };

        const currentTime = Math.floor(Date.now() / 1000);
        const mockRequestingPayload = {
          appId: 'test-app-123',
          jti: 'requesting-jti-123',
          exp: currentTime + 3600,
          iat: currentTime
        };

        tokenService.validateToken
          .mockResolvedValueOnce(mockRequestingPayload)
          .mockRejectedValueOnce(new Error('Token has been revoked'));

        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.revokeToken(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: expect.stringContaining('already')
        }));
      });

      it('should use default reason if not provided', async () => {
        // Arrange
        req.body = {
          requestingToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..requestingJWE',
          requestingSalt: 'requestingSalt123',
          targetToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..targetJWE',
          targetSalt: 'targetSalt456'
          // No reason provided
        };

        const currentTime = Math.floor(Date.now() / 1000);
        const mockRequestingPayload = {
          appId: 'test-app-123',
          jti: 'requesting-jti-123',
          exp: currentTime + 3600,
          iat: currentTime
        };

        const mockTargetPayload = {
          appId: 'test-app-456',
          jti: 'target-jti-456',
          exp: currentTime + 3600,
          iat: currentTime
        };

        tokenService.validateToken
          .mockResolvedValueOnce(mockRequestingPayload)
          .mockResolvedValueOnce(mockTargetPayload);

        databaseService.revokeToken.mockResolvedValue(true);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.revokeToken(req, res);

        // Assert
        expect(databaseService.revokeToken).toHaveBeenCalledWith(
          mockTargetPayload.jti,
          expect.any(Date),
          'Revoked via API'
        );
      });
    });

    // Validation Errors are now tested in middleware/validation.test.js

    describe('Authentication Errors', () => {
      it('should return 401 when requesting token is invalid', async () => {
        // Arrange
        req.body = {
          requestingToken: 'invalid-token',
          requestingSalt: 'requestingSalt123',
          targetToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..targetJWE',
          targetSalt: 'targetSalt456'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Invalid token format'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.revokeToken(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.stringContaining('Unauthorized')
        }));
      });

      it('should return 401 when requesting token is expired', async () => {
        // Arrange
        req.body = {
          requestingToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..expiredJWE',
          requestingSalt: 'requestingSalt123',
          targetToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..targetJWE',
          targetSalt: 'targetSalt456'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token expired'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.revokeToken(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.stringContaining('Unauthorized')
        }));
      });

      it('should return 401 when requesting token is already revoked', async () => {
        // Arrange
        req.body = {
          requestingToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..revokedJWE',
          requestingSalt: 'requestingSalt123',
          targetToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..targetJWE',
          targetSalt: 'targetSalt456'
        };

        tokenService.validateToken.mockRejectedValue(new Error('Token has been revoked'));
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await authController.revokeToken(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.stringContaining('Unauthorized')
        }));
      });
    });

    describe('Server Errors', () => {
      it('should return 500 when database revocation fails', async () => {
        // Arrange
        req.body = {
          requestingToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..requestingJWE',
          requestingSalt: 'requestingSalt123',
          targetToken: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..targetJWE',
          targetSalt: 'targetSalt456'
        };

        const currentTime = Math.floor(Date.now() / 1000);
        const mockRequestingPayload = {
          appId: 'test-app-123',
          jti: 'requesting-jti-123',
          exp: currentTime + 3600,
          iat: currentTime
        };

        const mockTargetPayload = {
          appId: 'test-app-456',
          jti: 'target-jti-456',
          exp: currentTime + 3600,
          iat: currentTime
        };

        tokenService.validateToken
          .mockResolvedValueOnce(mockRequestingPayload)
          .mockResolvedValueOnce(mockTargetPayload);

        databaseService.revokeToken.mockRejectedValue(new Error('Database error'));

        // Act
        await authController.revokeToken(req, res);

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
