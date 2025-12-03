const databaseService = require('../../src/services/database');

// Mock services
jest.mock('../../src/services/database');

// Import controller after mocks
const applicationController = require('../../src/controllers/applicationController');

describe('ApplicationController', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      query: {},
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

  describe('listApplications()', () => {
    describe('Success Cases', () => {
      it('should return list of applications with default pagination', async () => {
        // Arrange
        const mockApplications = [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            app_id: 'test-app-1',
            app_name: 'Test App 1',
            is_active: true,
            created_at: '2025-12-01T10:00:00Z',
            updated_at: '2025-12-01T10:00:00Z'
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174001',
            app_id: 'test-app-2',
            app_name: 'Test App 2',
            is_active: true,
            created_at: '2025-12-02T10:00:00Z',
            updated_at: '2025-12-02T10:00:00Z'
          }
        ];

        databaseService.getAllApplications.mockResolvedValue({
          applications: mockApplications,
          total: 2,
          limit: 50,
          offset: 0
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(databaseService.getAllApplications).toHaveBeenCalledWith({
          limit: 50,
          offset: 0,
          sortBy: 'created_at',
          order: 'desc'
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: {
            applications: mockApplications,
            pagination: {
              total: 2,
              limit: 50,
              offset: 0,
              hasMore: false
            }
          }
        });
      });

      it('should support custom pagination parameters', async () => {
        // Arrange
        req.query = {
          limit: '10',
          offset: '20'
        };

        const mockApplications = [];
        for (let i = 0; i < 10; i++) {
          mockApplications.push({
            id: `123e4567-e89b-12d3-a456-42661417400${i}`,
            app_id: `test-app-${i + 20}`,
            app_name: `Test App ${i + 20}`,
            is_active: true,
            created_at: '2025-12-01T10:00:00Z',
            updated_at: '2025-12-01T10:00:00Z'
          });
        }

        databaseService.getAllApplications.mockResolvedValue({
          applications: mockApplications,
          total: 100,
          limit: 10,
          offset: 20
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(databaseService.getAllApplications).toHaveBeenCalledWith({
          limit: 10,
          offset: 20,
          sortBy: 'created_at',
          order: 'desc'
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: {
            applications: mockApplications,
            pagination: {
              total: 100,
              limit: 10,
              offset: 20,
              hasMore: true
            }
          }
        });
      });

      it('should support sorting by name ascending', async () => {
        // Arrange
        req.query = {
          sort_by: 'name',
          order: 'asc'
        };

        const mockApplications = [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            app_id: 'app-a',
            app_name: 'App A',
            is_active: true,
            created_at: '2025-12-01T10:00:00Z',
            updated_at: '2025-12-01T10:00:00Z'
          }
        ];

        databaseService.getAllApplications.mockResolvedValue({
          applications: mockApplications,
          total: 1,
          limit: 50,
          offset: 0
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(databaseService.getAllApplications).toHaveBeenCalledWith({
          limit: 50,
          offset: 0,
          sortBy: 'name',
          order: 'asc'
        });

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should support sorting by created_at descending', async () => {
        // Arrange
        req.query = {
          sort_by: 'created_at',
          order: 'desc'
        };

        const mockApplications = [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            app_id: 'test-app',
            app_name: 'Test App',
            is_active: true,
            created_at: '2025-12-02T10:00:00Z',
            updated_at: '2025-12-02T10:00:00Z'
          }
        ];

        databaseService.getAllApplications.mockResolvedValue({
          applications: mockApplications,
          total: 1,
          limit: 50,
          offset: 0
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(databaseService.getAllApplications).toHaveBeenCalledWith({
          limit: 50,
          offset: 0,
          sortBy: 'created_at',
          order: 'desc'
        });

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should return empty array when no applications exist', async () => {
        // Arrange
        databaseService.getAllApplications.mockResolvedValue({
          applications: [],
          total: 0,
          limit: 50,
          offset: 0
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: {
            applications: [],
            pagination: {
              total: 0,
              limit: 50,
              offset: 0,
              hasMore: false
            }
          }
        });
      });

      it('should NOT return sensitive fields (master_password_hash, app_secret)', async () => {
        // Arrange
        const mockApplications = [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            app_id: 'test-app',
            app_name: 'Test App',
            is_active: true,
            created_at: '2025-12-01T10:00:00Z',
            updated_at: '2025-12-01T10:00:00Z'
            // master_password_hash and app_secret should NOT be present
          }
        ];

        databaseService.getAllApplications.mockResolvedValue({
          applications: mockApplications,
          total: 1,
          limit: 50,
          offset: 0
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              applications: expect.arrayContaining([
                expect.not.objectContaining({
                  master_password_hash: expect.anything(),
                  app_secret: expect.anything()
                })
              ])
            })
          })
        );
      });
    });

    describe('Validation Cases', () => {
      it('should enforce maximum limit of 100', async () => {
        // Arrange
        req.query = {
          limit: '500' // Exceeds maximum
        };

        const mockApplications = [];
        databaseService.getAllApplications.mockResolvedValue({
          applications: mockApplications,
          total: 0,
          limit: 100, // Should be capped at 100
          offset: 0
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(databaseService.getAllApplications).toHaveBeenCalledWith({
          limit: 100, // Should be capped
          offset: 0,
          sortBy: 'created_at',
          order: 'desc'
        });
      });

      it('should enforce minimum limit of 1', async () => {
        // Arrange
        req.query = {
          limit: '-5' // Invalid negative limit
        };

        const mockApplications = [];
        databaseService.getAllApplications.mockResolvedValue({
          applications: mockApplications,
          total: 0,
          limit: 1, // Should be at least 1
          offset: 0
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(databaseService.getAllApplications).toHaveBeenCalledWith({
          limit: 1, // Should be at least 1
          offset: 0,
          sortBy: 'created_at',
          order: 'desc'
        });
      });

      it('should enforce minimum offset of 0', async () => {
        // Arrange
        req.query = {
          offset: '-10' // Invalid negative offset
        };

        const mockApplications = [];
        databaseService.getAllApplications.mockResolvedValue({
          applications: mockApplications,
          total: 0,
          limit: 50,
          offset: 0 // Should be at least 0
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(databaseService.getAllApplications).toHaveBeenCalledWith({
          limit: 50,
          offset: 0, // Should be at least 0
          sortBy: 'created_at',
          order: 'desc'
        });
      });

      it('should default to created_at desc for invalid sort parameters', async () => {
        // Arrange
        req.query = {
          sort_by: 'invalid_field',
          order: 'invalid_order'
        };

        const mockApplications = [];
        databaseService.getAllApplications.mockResolvedValue({
          applications: mockApplications,
          total: 0,
          limit: 50,
          offset: 0
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(databaseService.getAllApplications).toHaveBeenCalledWith({
          limit: 50,
          offset: 0,
          sortBy: 'created_at', // Default
          order: 'desc' // Default
        });
      });
    });

    describe('Error Cases', () => {
      it('should handle database errors gracefully', async () => {
        // Arrange
        databaseService.getAllApplications.mockRejectedValue(
          new Error('Database connection failed')
        );

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to retrieve applications'
        });
      });

      it('should handle unexpected errors gracefully', async () => {
        // Arrange
        databaseService.getAllApplications.mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        // Act
        await applicationController.listApplications(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to retrieve applications'
        });
      });
    });
  });
});
