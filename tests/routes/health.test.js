const request = require('supertest');
const express = require('express');

// Mock HealthService BEFORE requiring routes
const mockGetOverallHealth = jest.fn();
const mockGetMetrics = jest.fn();

jest.mock('../../src/services/health', () => {
  return jest.fn().mockImplementation(() => ({
    getOverallHealth: mockGetOverallHealth,
    getMetrics: mockGetMetrics
  }));
});

const healthRoutes = require('../../src/routes/health');

describe('Health Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup express app
    app = express();
    app.use(express.json());
    app.use('/health', healthRoutes);
  });

  describe('GET /health', () => {
    it('should return healthy status when all services are healthy', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2025-12-03T10:00:00.000Z',
        version: '1.0.0',
        uptime: 3600,
        services: {
          database: {
            status: 'healthy',
            message: 'Connected',
            responseTime: 45
          },
          cryptography: {
            status: 'healthy',
            kdf: 'available',
            jwe: 'available'
          }
        }
      };

      mockGetOverallHealth.mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual(mockHealth);
      expect(response.body.status).toBe('healthy');
      expect(response.body.services.database.status).toBe('healthy');
      expect(response.body.services.cryptography.status).toBe('healthy');
    });

    it('should return degraded status when one service is unhealthy', async () => {
      const mockHealth = {
        status: 'degraded',
        timestamp: '2025-12-03T10:00:00.000Z',
        version: '1.0.0',
        uptime: 3600,
        services: {
          database: {
            status: 'unhealthy',
            message: 'Connection failed',
            responseTime: 5000
          },
          cryptography: {
            status: 'healthy',
            kdf: 'available',
            jwe: 'available'
          }
        }
      };

      mockGetOverallHealth.mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
      expect(response.body.services.database.status).toBe('unhealthy');
    });

    it('should return unhealthy status when all services are unhealthy', async () => {
      const mockHealth = {
        status: 'unhealthy',
        timestamp: '2025-12-03T10:00:00.000Z',
        version: '1.0.0',
        uptime: 3600,
        services: {
          database: {
            status: 'unhealthy',
            message: 'Connection failed'
          },
          cryptography: {
            status: 'unhealthy',
            message: 'Initialization failed'
          }
        }
      };

      mockGetOverallHealth.mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
    });

    it('should handle errors gracefully', async () => {
      mockGetOverallHealth.mockRejectedValue(
        new Error('Health check failed')
      );

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toContain('Health check failed');
    });
  });

  describe('GET /health/metrics', () => {
    it('should return system metrics', async () => {
      const mockMetrics = {
        timestamp: '2025-12-03T10:00:00.000Z',
        uptime: 3600,
        memory: {
          used: 50000000,
          total: 100000000,
          percentage: 50.0
        },
        process: {
          pid: 1234,
          cpu: 12.5
        }
      };

      mockGetMetrics.mockReturnValue(mockMetrics);

      const response = await request(app)
        .get('/health/metrics')
        .expect(200);

      expect(response.body).toEqual(mockMetrics);
      expect(response.body.memory).toBeDefined();
      expect(response.body.process).toBeDefined();
      expect(response.body.uptime).toBe(3600);
    });

    it('should handle errors when getting metrics', async () => {
      mockGetMetrics.mockImplementation(() => {
        throw new Error('Metrics collection failed');
      });

      const response = await request(app)
        .get('/health/metrics')
        .expect(500);

      expect(response.body.error).toContain('Metrics collection failed');
    });
  });
});
