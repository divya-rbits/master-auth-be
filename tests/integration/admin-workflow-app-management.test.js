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

// Import error handlers
const { errorHandler, notFoundHandler } = require('../../src/middleware/errorHandler');

// Create Express app for testing
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

describe('Admin Workflow: App Management Integration Tests', () => {
  let validAdminToken;
  let logEventSpy;

  beforeAll(() => {
    // Set up admin environment for JWT generation
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'AdminPass123!';
    process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret';
    process.env.ADMIN_SESSION_TIMEOUT = '1800';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Set a mock admin token
    validAdminToken = 'mock-admin-jwt-token';

    // Spy on logEvent to verify audit logging
    logEventSpy = jest.spyOn(databaseService, 'logEvent');
    logEventSpy.mockResolvedValue(true);

    // Mock admin authentication - these need to be set up as jest.fn() for each test
    adminAuthService.verifyAdminToken = jest.fn().mockReturnValue({ username: 'admin', role: 'admin' });
    adminAuthService.verifyCredentials = jest.fn().mockReturnValue(false); // Default to false, tests override
    adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);
  });

  afterEach(() => {
    logEventSpy.mockRestore();
  });

  describe('Complete Workflow: Login → Create App → Change Password → Revoke Tokens', () => {
    test('should successfully complete entire application management workflow', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      // Step 1: Admin Login
      adminAuthService.verifyCredentials = jest.fn().mockReturnValue(true);
      adminAuthService.generateAdminToken = jest.fn().mockReturnValue(validAdminToken);

      const loginResponse = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser')
        .set('X-Forwarded-For', '192.168.1.100');

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.token).toBeDefined();

      // Verify login was logged
      expect(logEventSpy).toHaveBeenCalledWith(
        'admin_login_success',
        'admin',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        expect.objectContaining({
          username: 'admin'
        })
      );

      // Step 2: Create Application
      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockHash');
      jest.spyOn(databaseService, 'createApplication').mockResolvedValue({
        id: validUuid,
        app_id: 'app-workflow-test',
        app_name: 'Workflow Test App',
        plain_app_secret: 'secret-123',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const createResponse = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 'Workflow Test App',
          master_password: 'SecurePassword123!'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.app_id).toBe('app-workflow-test');
      expect(createResponse.body.data.app_secret).toBe('secret-123');

      // Verify application creation was logged
      expect(logEventSpy).toHaveBeenCalledWith(
        'application_created',
        'app-workflow-test',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        expect.objectContaining({
          admin_username: 'admin',
          app_name: 'Workflow Test App'
        })
      );

      // Step 3: Change Master Password
      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-workflow-test',
        app_name: 'Workflow Test App',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$oldHash',
        is_active: true
      });

      passwordService.verifyPassword.mockResolvedValue(true);
      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$newHash');
      jest.spyOn(databaseService, 'updateMasterPasswordHash').mockResolvedValue(true);
      jest.spyOn(databaseService, 'revokeAllTokensForApplication').mockResolvedValue(3);

      const passwordResponse = await request(app)
        .put(`/api/admin/applications/${validUuid}/password`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          current_master_password: 'SecurePassword123!',
          new_master_password: 'NewSecurePassword456!'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      expect(passwordResponse.status).toBe(200);
      expect(passwordResponse.body.success).toBe(true);
      expect(passwordResponse.body.data.tokens_revoked).toBe(3);

      // Verify password change was logged
      expect(logEventSpy).toHaveBeenCalledWith(
        'master_password_changed',
        'app-workflow-test',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        expect.objectContaining({
          admin_username: 'admin',
          tokens_revoked: 3
        })
      );

      // Step 4: Revoke All Tokens
      jest.spyOn(databaseService, 'revokeAllTokensForApplication').mockResolvedValue(5);

      const revokeResponse = await request(app)
        .post(`/api/admin/applications/${validUuid}/revoke-all`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          reason: 'Security audit'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      expect(revokeResponse.status).toBe(200);
      expect(revokeResponse.body.success).toBe(true);
      expect(revokeResponse.body.data.tokens_revoked).toBe(5);

      // Verify token revocation was logged
      expect(logEventSpy).toHaveBeenCalledWith(
        'tokens_bulk_revoked',
        'app-workflow-test',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        expect.objectContaining({
          admin_username: 'admin',
          tokens_revoked: 5,
          reason: 'Security audit'
        })
      );

      // Verify total audit log calls (login + create + password change + revoke)
      expect(logEventSpy).toHaveBeenCalledTimes(4);
    });

    test('should fail workflow if admin authentication is invalid', async () => {
      // Attempt to create application without authentication
      const createResponse = await request(app)
        .post('/api/admin/applications')
        .send({
          app_name: 'Test App',
          master_password: 'SecurePassword123!'
        });

      expect(createResponse.status).toBe(401);
      expect(createResponse.body.success).toBe(false);
    });

    test('should fail workflow if application creation fails', async () => {
      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockHash');
      jest.spyOn(databaseService, 'createApplication').mockRejectedValue(
        new Error('Database error')
      );

      const createResponse = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 'Workflow Test App',
          master_password: 'SecurePassword123!'
        });

      expect(createResponse.status).toBe(500);
      expect(createResponse.body.success).toBe(false);
      expect(createResponse.body.error).toBe('Failed to create application');
    });

    test('should fail password change if current password is incorrect', async () => {
      const validUuid = '223e4567-e89b-12d3-a456-426614174001';

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue({
        id: validUuid,
        app_id: 'app-test',
        app_name: 'Test App',
        master_password_hash: '$argon2id$v=19$m=65536,t=3,p=4$oldHash',
        is_active: true
      });

      passwordService.verifyPassword.mockResolvedValue(false);

      const passwordResponse = await request(app)
        .put(`/api/admin/applications/${validUuid}/password`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          current_master_password: 'WrongPassword123!',
          new_master_password: 'NewSecurePassword456!'
        })
        .set('User-Agent', 'Mozilla/5.0 Test Browser');

      expect(passwordResponse.status).toBe(401);
      expect(passwordResponse.body.success).toBe(false);
      expect(passwordResponse.body.error).toBe('Current password is incorrect');

      // Verify failed password change was logged
      expect(logEventSpy).toHaveBeenCalledWith(
        'master_password_change_failed',
        'app-test',
        expect.any(String),
        'Mozilla/5.0 Test Browser',
        expect.objectContaining({
          admin_username: 'admin',
          reason: 'incorrect_current_password'
        })
      );
    });

    test('should fail token revocation if application not found', async () => {
      const validUuid = '323e4567-e89b-12d3-a456-426614174002';

      jest.spyOn(databaseService, 'getApplicationById').mockResolvedValue(null);

      const revokeResponse = await request(app)
        .post(`/api/admin/applications/${validUuid}/revoke-all`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          reason: 'Security audit'
        });

      expect(revokeResponse.status).toBe(404);
      expect(revokeResponse.body.success).toBe(false);
      expect(revokeResponse.body.error).toBe('Application not found');
    });
  });

  describe('Authentication Failures', () => {
    test('should reject requests with missing Authorization header', async () => {
      const response = await request(app)
        .post('/api/admin/applications')
        .send({
          app_name: 'Test App',
          master_password: 'SecurePassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject requests with malformed Bearer token', async () => {
      // Mock verifyAdminToken to throw an error for malformed token
      adminAuthService.verifyAdminToken = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', 'Bearer invalid-malformed-token')
        .send({
          app_name: 'Test App',
          master_password: 'SecurePassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject requests with expired JWT token', async () => {
      // Mock expired token verification
      adminAuthService.verifyAdminToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 'Test App',
          master_password: 'SecurePassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject requests without Bearer prefix', async () => {
      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Token ${validAdminToken}`) // Wrong prefix
        .send({
          app_name: 'Test App',
          master_password: 'SecurePassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Data Validation', () => {
    test('should reject application creation with missing app_name', async () => {
      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          master_password: 'SecurePassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('app_name is required');
    });

    test('should reject application creation with empty app_name', async () => {
      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: '   ',
          master_password: 'SecurePassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('app_name is required');
    });

    test('should reject application creation with missing master_password', async () => {
      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 'Test App'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('master_password is required');
    });

    test('should reject application creation with weak master_password', async () => {
      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 'Test App',
          master_password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('master_password must be at least 12 characters');
    });

    test('should reject password change with invalid UUID format', async () => {
      const response = await request(app)
        .put('/api/admin/applications/invalid-uuid/password')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          current_master_password: 'OldPassword123!',
          new_master_password: 'NewSecurePassword456!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid application ID format');
    });

    test('should reject password change with missing current password', async () => {
      const validUuid = '423e4567-e89b-12d3-a456-426614174003';

      const response = await request(app)
        .put(`/api/admin/applications/${validUuid}/password`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          new_master_password: 'NewSecurePassword456!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('current_master_password is required');
    });

    test('should reject password change with short new password', async () => {
      const validUuid = '523e4567-e89b-12d3-a456-426614174004';

      const response = await request(app)
        .put(`/api/admin/applications/${validUuid}/password`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          current_master_password: 'OldPassword123!',
          new_master_password: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('new_master_password must be at least 12 characters');
    });

    test('should reject token revocation with invalid UUID format', async () => {
      const response = await request(app)
        .post('/api/admin/applications/invalid-uuid/revoke-all')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          reason: 'Security audit'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid application ID format');
    });

    test('should reject application creation with non-string app_name', async () => {
      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 12345,
          master_password: 'SecurePassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('app_name is required');
    });

    test('should reject application creation with non-string master_password', async () => {
      const response = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 'Test App',
          master_password: 12345
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('master_password is required');
    });
  });

  describe('Token Persistence', () => {
    test('should maintain admin token across multiple operations', async () => {
      const validUuid = '623e4567-e89b-12d3-a456-426614174005';

      // Create application
      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockHash');
      jest.spyOn(databaseService, 'createApplication').mockResolvedValue({
        id: validUuid,
        app_id: 'app-persistence-test',
        app_name: 'Persistence Test',
        plain_app_secret: 'secret-123',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const createResponse = await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 'Persistence Test',
          master_password: 'SecurePassword123!'
        });

      expect(createResponse.status).toBe(201);

      // Update application with same token
      jest.spyOn(databaseService, 'updateApplication').mockResolvedValue({
        id: validUuid,
        app_id: 'app-persistence-test',
        app_name: 'Updated Persistence Test',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const updateResponse = await request(app)
        .put(`/api/admin/applications/${validUuid}`)
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 'Updated Persistence Test'
        });

      expect(updateResponse.status).toBe(200);

      // Delete application with same token
      jest.spyOn(databaseService, 'deleteApplication').mockResolvedValue({
        id: validUuid,
        app_id: 'app-persistence-test',
        app_name: 'Updated Persistence Test',
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const deleteResponse = await request(app)
        .delete(`/api/admin/applications/${validUuid}`)
        .set('Authorization', `Bearer ${validAdminToken}`);

      expect(deleteResponse.status).toBe(200);

      // Verify all operations succeeded with same token
      expect(createResponse.body.success).toBe(true);
      expect(updateResponse.body.success).toBe(true);
      expect(deleteResponse.body.success).toBe(true);
    });
  });

  describe('Audit Logging Verification', () => {
    test('should log all workflow steps with correct admin username', async () => {
      const validUuid = '723e4567-e89b-12d3-a456-426614174006';

      // Create application
      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockHash');
      jest.spyOn(databaseService, 'createApplication').mockResolvedValue({
        id: validUuid,
        app_id: 'app-audit-test',
        app_name: 'Audit Test App',
        plain_app_secret: 'secret-123',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({
          app_name: 'Audit Test App',
          master_password: 'SecurePassword123!'
        })
        .set('User-Agent', 'Test Browser');

      // Verify audit log contains admin_username
      const createLogCall = logEventSpy.mock.calls.find(
        call => call[0] === 'application_created'
      );
      expect(createLogCall).toBeDefined();
      expect(createLogCall[4]).toHaveProperty('admin_username', 'admin');
    });

    test('should capture IP address in audit logs', async () => {
      const validUuid = '823e4567-e89b-12d3-a456-426614174007';

      passwordService.hashPassword.mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockHash');
      jest.spyOn(databaseService, 'createApplication').mockResolvedValue({
        id: validUuid,
        app_id: 'app-ip-test',
        app_name: 'IP Test App',
        plain_app_secret: 'secret-123',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await request(app)
        .post('/api/admin/applications')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .set('X-Forwarded-For', '203.0.113.42')
        .send({
          app_name: 'IP Test App',
          master_password: 'SecurePassword123!'
        });

      // Verify IP address was captured
      const createLogCall = logEventSpy.mock.calls.find(
        call => call[0] === 'application_created'
      );
      expect(createLogCall).toBeDefined();
      expect(createLogCall[2]).toBeTruthy(); // IP address parameter
    });
  });
});
