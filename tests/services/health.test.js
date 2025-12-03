const HealthService = require('../../src/services/health');

// Mock dependencies
jest.mock('../../src/config/supabase');
jest.mock('../../src/services/kdf', () => ({
  deriveKey: jest.fn()
}));
jest.mock('../../src/services/jwe', () => ({
  encryptJWE: jest.fn(),
  decryptJWE: jest.fn()
}));

const supabase = require('../../src/config/supabase');

describe('HealthService', () => {
  let healthService;

  beforeEach(() => {
    jest.clearAllMocks();
    healthService = new HealthService();
  });

  describe('checkDatabase', () => {
    it('should return healthy status when database is connected', async () => {
      const mockData = { id: 1 };
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [mockData],
            error: null
          })
        })
      });

      const result = await healthService.checkDatabase();

      expect(result.status).toBe('healthy');
      expect(result.message).toBe('Connected');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when database connection fails', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed' }
          })
        })
      });

      const result = await healthService.checkDatabase();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Connection failed');
    });

    it('should handle unexpected errors gracefully', async () => {
      supabase.from = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await healthService.checkDatabase();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Unexpected error');
    });
  });

  describe('checkCryptography', () => {
    it('should return healthy status when crypto services are available', async () => {
      const result = await healthService.checkCryptography();

      expect(result.status).toBe('healthy');
      expect(result.kdf).toBe('available');
      expect(result.jwe).toBe('available');
    });
  });

  describe('getOverallHealth', () => {
    it('should return healthy status when all services are healthy', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: 1 }],
            error: null
          })
        })
      });

      const result = await healthService.getOverallHealth();

      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.cryptography.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return degraded status when database is unhealthy', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB error' }
          })
        })
      });

      const result = await healthService.getOverallHealth();

      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('unhealthy');
      expect(result.services.cryptography.status).toBe('healthy');
    });
  });

  describe('getMetrics', () => {
    it('should return system metrics', () => {
      const result = healthService.getMetrics();

      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.memory).toBeDefined();
      expect(result.memory.used).toBeGreaterThan(0);
      expect(result.memory.total).toBeGreaterThan(0);
      expect(result.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(result.memory.percentage).toBeLessThanOrEqual(100);
      expect(result.process).toBeDefined();
      expect(result.process.pid).toBeGreaterThan(0);
      expect(result.process.cpu).toBeGreaterThanOrEqual(0);
    });
  });
});
