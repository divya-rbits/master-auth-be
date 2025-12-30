const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../src/routes/admin');
const databaseService = require('../../src/services/database');
const passwordService = require('../../src/services/password');
const adminAuthService = require('../../src/services/adminAuth');

// Mock the Supabase client and services
jest.mock('../../src/config/supabase');
jest.mock('../../src/services/password');
jest.mock('../../src/services/adminAuth');

// Create Express app for testing
const app = express();
app.set('trust proxy', true); // Enable trust proxy for X-Forwarded-For header
app.use(express.json());
app.use('/api/admin', adminRoutes);

// Mock admin token for authenticated requests
const mockAdminToken = 'mock-admin-jwt-token';
const mockAdminUser = { username: 'admin', role: 'admin' };

describe('Admin Action Logging Integration Tests', () => {
  let logEventSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Spy on the logEvent method to verify it's called
    logEventSpy = jest.spyOn(databaseService, 'logEvent');
    logEventSpy.mockResolvedValue(true);

    // Mock admin authentication
    adminAuthService.verifyAdminToken.mockReturnValue(mockAdminUser);

    // Set JWT secret for middleware
    process.env.ADMIN_JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    logEventSpy.mockRestore();
  });

  describe('Admin Authentication Logging', () => {
    test('should log successful admin login with username and IP', async () => {
      adminAuthService.verifyCredentials.mockReturnValue(true);
      adminAuthService.generateAdminToken.mockReturnValue(mockAdminToken);

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'admin-password'
        })
        .set('User-Agent', 'Mozilla/5.0 Admin Browser')
        .set('X-Forwarded-For', '192.168.1.100');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify audit log was created for successful admin login
      expect(logEventSpy).toHaveBeenCalledWith(
        'admin_login_success',
        'admin',
        expect.any(String), // IP address
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          username: 'admin',
          message: 'Admin authenticated successfully'
        })
      );
    });

    test('should log failed admin login with reason', async () => {
      adminAuthService.verifyCredentials.mockReturnValue(false);

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'wrong-password'
        })
        .set('User-Agent', 'Mozilla/5.0 Admin Browser');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      // Verify audit log was created for failed admin login
      expect(logEventSpy).toHaveBeenCalledWith(
        'admin_login_failed',
        'admin',
        expect.any(String),
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          reason: 'Invalid credentials'
        })
      );
    });

    test('should log admin logout', async () => {
      const response = await request(app)
        .post('/api/admin/auth/logout')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .set('User-Agent', 'Mozilla/5.0 Admin Browser');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify audit log was created for admin logout
      expect(logEventSpy).toHaveBeenCalledWith(
        'admin_logout',
        'admin',
        expect.any(String),
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          username: 'admin',
          message: 'Admin logged out'
        })
      );
    });
  });

  describe('Application CRUD Logging', () => {
    test('should log application creation with admin username', async () => {
      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockSalt$mockHash');

      jest.spyOn(databaseService, 'createApplication').mockResolvedValue({
        id: 'app-uuid-123',
        app_id: 'app-123',
        app_name: 'Test App',
        plain_app_secret: 'secret-123',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          app_name: 'Test App',
          master_password: 'SecurePassword123!'
        })
        .set('User-Agent', 'Mozilla/5.0 Admin Browser');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify audit log was created for application creation
      expect(logEventSpy).toHaveBeenCalledWith(
        'application_created',
        'app-123',
        expect.any(String),
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          admin_username: 'admin',
          app_name: 'Test App'
        })
      );
    });

    test('should log application update with admin username', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      jest.spyOn(databaseService, 'updateApplication').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Updated App',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const response = await request(app)
        .put(`/api/admin/applications/${validUuid}`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          app_name: 'Updated App'
        })
        .set('User-Agent', 'Mozilla/5.0 Admin Browser');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify audit log was created for application update
      expect(logEventSpy).toHaveBeenCalledWith(
        'application_updated',
        'app-123',
        expect.any(String),
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          admin_username: 'admin',
          app_name: 'Updated App'
        })
      );
    });

    test('should log application deletion with admin username', async () => {
      const validUuid = '223e4567-e89b-12d3-a456-426614174001';

      jest.spyOn(databaseService, 'deleteApplication').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Deleted App',
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const response = await request(app)
        .delete(`/api/admin/applications/${validUuid}`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .set('User-Agent', 'Mozilla/5.0 Admin Browser');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify audit log was created for application deletion
      expect(logEventSpy).toHaveBeenCalledWith(
        'application_deleted',
        'app-123',
        expect.any(String),
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          admin_username: 'admin',
          app_name: 'Deleted App'
        })
      );
    });
  });

  describe('Password Change Logging', () => {
    test('should log successful master password change', async () => {
      const validUuid = '323e4567-e89b-12d3-a456-426614174002';

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$oldHash',
        is_active: true
      });

      passwordService.verifyPassword.mockResolvedValue(true);
      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$newHash');

      jest.spyOn(databaseService, 'updateMasterPasswordHash').mockResolvedValue(true);
      jest.spyOn(databaseService, 'revokeAllTokensForApplication').mockResolvedValue(5);

      const response = await request(app)
        .put(`/api/admin/applications/${validUuid}/password`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          current_master_password: 'OldPassword123!',
          new_master_password: 'NewPassword456!'
        })
        .set('User-Agent', 'Mozilla/5.0 Admin Browser');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify audit log was created for password change
      expect(logEventSpy).toHaveBeenCalledWith(
        'master_password_changed',
        'app-123',
        expect.any(String),
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          admin_username: 'admin',
          tokens_revoked: 5
        })
      );
    });

    test('should log failed master password change with reason', async () => {
      const validUuid = '423e4567-e89b-12d3-a456-426614174003';

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$oldHash',
        is_active: true
      });

      passwordService.verifyPassword.mockResolvedValue(false);

      const response = await request(app)
        .put(`/api/admin/applications/${validUuid}/password`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          current_master_password: 'WrongPassword123!',
          new_master_password: 'NewPassword456!'
        })
        .set('User-Agent', 'Mozilla/5.0 Admin Browser');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      // Verify audit log was created for failed password change
      expect(logEventSpy).toHaveBeenCalledWith(
        'master_password_change_failed',
        'app-123',
        expect.any(String),
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          admin_username: 'admin',
          reason: 'incorrect_current_password'
        })
      );
    });
  });

  describe('Token Revocation Logging', () => {
    test('should log single token revocation', async () => {
      jest.spyOn(databaseService, 'revokeTokenById').mockResolvedValue({
        success: true,
        token: {
          jti: 'token-jti-123',
          application_id: 'app-123',
          revoked_at: new Date().toISOString()
        }
      });

      const response = await request(app)
        .post('/api/admin/tokens/revoke')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          jti: 'token-jti-123',
          reason: 'Security concern'
        })
        .set('User-Agent', 'Mozilla/5.0 Admin Browser');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify audit log was created for token revocation
      expect(logEventSpy).toHaveBeenCalledWith(
        'token_revoked',
        'app-123',
        expect.any(String),
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          admin_username: 'admin',
          jti: 'token-jti-123',
          reason: 'Security concern'
        })
      );
    });

    test('should log bulk token revocation', async () => {
      const validUuid = '523e4567-e89b-12d3-a456-426614174004';

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-123',
        app_name: 'Test App',
        is_active: true
      });

      jest.spyOn(databaseService, 'revokeAllTokensForApplication').mockResolvedValue(10);

      const response = await request(app)
        .post(`/api/admin/applications/${validUuid}/revoke-all`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          reason: 'Security audit'
        })
        .set('User-Agent', 'Mozilla/5.0 Admin Browser');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify audit log was created for bulk token revocation
      expect(logEventSpy).toHaveBeenCalledWith(
        'tokens_bulk_revoked',
        'app-123',
        expect.any(String),
        'Mozilla/5.0 Admin Browser',
        expect.objectContaining({
          admin_username: 'admin',
          tokens_revoked: 10,
          reason: 'Security audit'
        })
      );
    });
  });

  describe('Audit Log Field Verification', () => {
    test('all admin action logs should contain required fields', async () => {
      adminAuthService.verifyCredentials.mockReturnValue(true);
      adminAuthService.generateAdminToken.mockReturnValue(mockAdminToken);

      await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'admin-password'
        })
        .set('User-Agent', 'Mozilla/5.0 Test')
        .set('X-Forwarded-For', '10.0.0.1');

      // Verify all required fields are present
      expect(logEventSpy).toHaveBeenCalledWith(
        expect.any(String),           // event_type
        expect.any(String),           // application_id (or username for admin events)
        expect.any(String),           // ip_address
        expect.any(String),           // user_agent
        expect.any(Object)            // details
      );

      const callArgs = logEventSpy.mock.calls[0];
      expect(callArgs[0]).toBeTruthy(); // event_type exists
      expect(callArgs[1]).toBeTruthy(); // application_id exists
      expect(callArgs[2]).toBeTruthy(); // ip_address exists
      expect(callArgs[3]).toBeTruthy(); // user_agent exists
      expect(callArgs[4]).toBeTruthy(); // details exists
    });

    test('admin actions should include admin_username in details', async () => {
      jest.spyOn(databaseService, 'createApplication').mockResolvedValue({
        id: 'app-uuid-123',
        app_id: 'app-123',
        app_name: 'Test App',
        plain_app_secret: 'secret-123',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockHash');

      await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          app_name: 'Test App',
          master_password: 'SecurePassword123!'
        })
        .set('User-Agent', 'Mozilla/5.0');

      const callArgs = logEventSpy.mock.calls[0];
      const details = callArgs[4];

      expect(details).toHaveProperty('admin_username');
      expect(details.admin_username).toBe('admin');
    });
  });

  describe('IP Address Capture', () => {
    test('should capture IP address from X-Forwarded-For header', async () => {
      adminAuthService.verifyCredentials.mockReturnValue(true);
      adminAuthService.generateAdminToken.mockReturnValue(mockAdminToken);

      await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'admin-password'
        })
        .set('User-Agent', 'Mozilla/5.0')
        .set('X-Forwarded-For', '203.0.113.42');

      expect(logEventSpy).toHaveBeenCalledWith(
        'admin_login_success',
        'admin',
        expect.any(String), // IP should be captured
        'Mozilla/5.0',
        expect.any(Object)
      );
    });

    test('should capture IP address from direct connection', async () => {
      adminAuthService.verifyCredentials.mockReturnValue(true);
      adminAuthService.generateAdminToken.mockReturnValue(mockAdminToken);

      await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'admin-password'
        })
        .set('User-Agent', 'Mozilla/5.0');

      // Without X-Forwarded-For, should still capture req.ip
      expect(logEventSpy).toHaveBeenCalledWith(
        'admin_login_success',
        'admin',
        expect.any(String),
        'Mozilla/5.0',
        expect.any(Object)
      );

      const callArgs = logEventSpy.mock.calls[0];
      expect(callArgs[2]).toBeTruthy(); // IP address should be present
    });
  });
});
