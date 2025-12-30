const applicationController = require('../../src/controllers/applicationController');
const databaseService = require('../../src/services/database');

// Mock the database service
jest.mock('../../src/services/database');

describe('ApplicationController.getApplication', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      admin: { username: 'admin', role: 'admin' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('Successful retrieval', () => {
    test('should return 200 and application data for valid UUID', async () => {
      const validUuid = '7df59ec8-b903-4265-b17a-b38a5e4a22a2';
      const mockApplication = {
        id: validUuid,
        app_id: 'APP123456',
        app_name: 'Test Application',
        is_active: true,
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-20T14:45:00.000Z'
      };

      req.params.id = validUuid;
      databaseService.getApplicationById.mockResolvedValue(mockApplication);

      await applicationController.getApplication(req, res, next);

      expect(databaseService.getApplicationById).toHaveBeenCalledWith(validUuid);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockApplication
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return all required fields', async () => {
      const validUuid = '7df59ec8-b903-4265-b17a-b38a5e4a22a2';
      const mockApplication = {
        id: validUuid,
        app_id: 'APP123456',
        app_name: 'Test Application',
        is_active: false,
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-20T14:45:00.000Z'
      };

      req.params.id = validUuid;
      databaseService.getApplicationById.mockResolvedValue(mockApplication);

      await applicationController.getApplication(req, res, next);

      const responseData = res.json.mock.calls[0][0].data;
      expect(responseData).toHaveProperty('id');
      expect(responseData).toHaveProperty('app_id');
      expect(responseData).toHaveProperty('app_name');
      expect(responseData).toHaveProperty('is_active');
      expect(responseData).toHaveProperty('created_at');
      expect(responseData).toHaveProperty('updated_at');
    });

    test('should NOT return sensitive fields', async () => {
      const validUuid = '7df59ec8-b903-4265-b17a-b38a5e4a22a2';
      const mockApplication = {
        id: validUuid,
        app_id: 'APP123456',
        app_name: 'Test Application',
        is_active: true,
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-20T14:45:00.000Z'
        // Note: Database service should not return master_password_hash or app_secret
      };

      req.params.id = validUuid;
      databaseService.getApplicationById.mockResolvedValue(mockApplication);

      await applicationController.getApplication(req, res, next);

      const responseData = res.json.mock.calls[0][0].data;
      expect(responseData).not.toHaveProperty('master_password_hash');
      expect(responseData).not.toHaveProperty('app_secret');
    });
  });

  describe('Validation errors', () => {
    test('should return 400 for missing application ID', async () => {
      req.params.id = undefined;

      await applicationController.getApplication(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application ID is required'
      });
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
    });

    test('should return 400 for empty application ID', async () => {
      req.params.id = '';

      await applicationController.getApplication(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application ID is required'
      });
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
    });

    test('should return 400 for whitespace-only application ID', async () => {
      req.params.id = '   ';

      await applicationController.getApplication(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application ID is required'
      });
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid UUID format', async () => {
      req.params.id = 'invalid-uuid-123';

      await applicationController.getApplication(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
    });

    test('should return 400 for malformed UUID', async () => {
      req.params.id = '12345678-1234-1234-1234-12345678901G'; // Invalid character 'G'

      await applicationController.getApplication(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid application ID format'
      });
      expect(databaseService.getApplicationById).not.toHaveBeenCalled();
    });
  });

  describe('Not found errors', () => {
    test('should return 404 when application does not exist', async () => {
      const validUuid = '7df59ec8-b903-4265-b17a-b38a5e4a22a2';
      req.params.id = validUuid;
      databaseService.getApplicationById.mockResolvedValue(null);

      await applicationController.getApplication(req, res, next);

      expect(databaseService.getApplicationById).toHaveBeenCalledWith(validUuid);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Application not found'
      });
    });
  });

  describe('Error handling', () => {
    test('should throw error for database failures', async () => {
      const validUuid = '7df59ec8-b903-4265-b17a-b38a5e4a22a2';
      const dbError = new Error('Database connection failed');

      req.params.id = validUuid;
      databaseService.getApplicationById.mockRejectedValue(dbError);

      await applicationController.getApplication(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should throw error for unexpected database errors', async () => {
      const validUuid = '7df59ec8-b903-4265-b17a-b38a5e4a22a2';
      const dbError = new Error('Unexpected error');

      req.params.id = validUuid;
      databaseService.getApplicationById.mockRejectedValue(dbError);

      await applicationController.getApplication(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
