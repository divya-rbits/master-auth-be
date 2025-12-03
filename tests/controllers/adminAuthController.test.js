const adminAuthService = require('../../src/services/adminAuth');
const databaseService = require('../../src/services/database');

// Mock services
jest.mock('../../src/services/adminAuth');
jest.mock('../../src/services/database');

// Import controller after mocks
const adminAuthController = require('../../src/controllers/adminAuthController');

describe('AdminAuthController', () => {
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
      it('should return token on valid admin login', async () => {
        // Arrange
        req.body = {
          username: 'admin',
          password: 'admin_password'
        };

        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockAdminToken';
        const mockExpiresIn = 1800; // 30 minutes

        adminAuthService.verifyCredentials.mockReturnValue(true);
        adminAuthService.generateAdminToken.mockReturnValue(mockToken);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(adminAuthService.verifyCredentials).toHaveBeenCalledWith('admin', 'admin_password');
        expect(adminAuthService.generateAdminToken).toHaveBeenCalledWith('admin');
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'admin_login_success',
          'admin',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({ username: 'admin' })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          token: mockToken,
          expiresIn: expect.any(Number),
          message: 'Admin login successful'
        }));
      });

      it('should include expiration time in response', async () => {
        // Arrange
        req.body = {
          username: 'admin',
          password: 'admin_password'
        };

        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockAdminToken';

        adminAuthService.verifyCredentials.mockReturnValue(true);
        adminAuthService.generateAdminToken.mockReturnValue(mockToken);
        databaseService.logEvent.mockResolvedValue(true);

        // Mock environment variable
        process.env.ADMIN_SESSION_TIMEOUT = '1800';

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          expiresIn: 1800
        }));
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 when username is missing', async () => {
        // Arrange
        req.body = {
          password: 'admin_password'
        };

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'username and password are required'
        });
        expect(adminAuthService.verifyCredentials).not.toHaveBeenCalled();
      });

      it('should return 400 when password is missing', async () => {
        // Arrange
        req.body = {
          username: 'admin'
        };

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'username and password are required'
        });
        expect(adminAuthService.verifyCredentials).not.toHaveBeenCalled();
      });

      it('should return 400 when both username and password are missing', async () => {
        // Arrange
        req.body = {};

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'username and password are required'
        });
      });

      it('should return 400 when username is empty string', async () => {
        // Arrange
        req.body = {
          username: '',
          password: 'admin_password'
        };

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'username and password are required'
        });
      });

      it('should return 400 when password is empty string', async () => {
        // Arrange
        req.body = {
          username: 'admin',
          password: ''
        };

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'username and password are required'
        });
      });
    });

    describe('Authentication Errors', () => {
      it('should return 401 when credentials are invalid', async () => {
        // Arrange
        req.body = {
          username: 'admin',
          password: 'wrong_password'
        };

        adminAuthService.verifyCredentials.mockReturnValue(false);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(adminAuthService.verifyCredentials).toHaveBeenCalledWith('admin', 'wrong_password');
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'admin_login_failed',
          'admin',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({ reason: 'Invalid credentials' })
        );
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid credentials'
        });
        expect(adminAuthService.generateAdminToken).not.toHaveBeenCalled();
      });

      it('should log failed login attempt', async () => {
        // Arrange
        req.body = {
          username: 'hacker',
          password: 'wrong_password'
        };

        adminAuthService.verifyCredentials.mockReturnValue(false);
        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'admin_login_failed',
          'hacker',
          '127.0.0.1',
          'Jest Test Agent',
          expect.any(Object)
        );
      });
    });

    describe('Server Errors', () => {
      it('should return 500 when token generation fails', async () => {
        // Arrange
        req.body = {
          username: 'admin',
          password: 'admin_password'
        };

        adminAuthService.verifyCredentials.mockReturnValue(true);
        adminAuthService.generateAdminToken.mockImplementation(() => {
          throw new Error('Token generation failed');
        });

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });

      it('should return 500 when database logging fails', async () => {
        // Arrange
        req.body = {
          username: 'admin',
          password: 'admin_password'
        };

        adminAuthService.verifyCredentials.mockReturnValue(true);
        adminAuthService.generateAdminToken.mockReturnValue('mockToken');
        databaseService.logEvent.mockRejectedValue(new Error('Database error'));

        // Act
        await adminAuthController.login(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });
    });
  });

  describe('logout()', () => {
    describe('Success Cases', () => {
      it('should return success on logout', async () => {
        // Arrange
        req.admin = { username: 'admin' };

        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await adminAuthController.logout(req, res);

        // Assert
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'admin_logout',
          'admin',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({ username: 'admin' })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Admin logout successful'
        });
      });

      it('should include logout message in log', async () => {
        // Arrange
        req.admin = { username: 'testadmin' };

        databaseService.logEvent.mockResolvedValue(true);

        // Act
        await adminAuthController.logout(req, res);

        // Assert
        expect(databaseService.logEvent).toHaveBeenCalledWith(
          'admin_logout',
          'testadmin',
          '127.0.0.1',
          'Jest Test Agent',
          expect.objectContaining({
            username: 'testadmin',
            message: 'Admin logged out'
          })
        );
      });
    });

    describe('Server Errors', () => {
      it('should return 500 when logging fails', async () => {
        // Arrange
        req.admin = { username: 'admin' };

        databaseService.logEvent.mockRejectedValue(new Error('Database error'));

        // Act
        await adminAuthController.logout(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });
    });
  });
});
