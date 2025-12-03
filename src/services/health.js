const supabase = require('../config/supabase');
const KdfService = require('./kdf');
const JweService = require('./jwe');
const packageJson = require('../../package.json');

/**
 * Health Service - Monitors system health and provides status information
 * Checks database connectivity, cryptographic services, and system metrics
 */
class HealthService {
  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Checks database connectivity by performing a simple query
   * @returns {Promise<Object>} Database health status
   */
  async checkDatabase() {
    const startTime = Date.now();
    try {
      const { data, error} = await supabase
        .from('applications')
        .select('id')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          status: 'unhealthy',
          message: `Database error: ${error.message}`,
          responseTime
        };
      }

      return {
        status: 'healthy',
        message: 'Connected',
        responseTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Checks cryptographic services availability
   * @returns {Promise<Object>} Cryptography health status
   */
  async checkCryptography() {
    try {
      // KdfService and JweService are exported as singleton instances
      // Verify services have required methods
      const kdfAvailable = typeof KdfService.deriveKey === 'function';
      const jweAvailable = typeof JweService.encryptJWE === 'function';

      if (kdfAvailable && jweAvailable) {
        return {
          status: 'healthy',
          kdf: 'available',
          jwe: 'available'
        };
      }

      return {
        status: 'unhealthy',
        message: 'Crypto services missing required methods',
        kdf: kdfAvailable ? 'available' : 'unavailable',
        jwe: jweAvailable ? 'available' : 'unavailable'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Crypto services check failed: ${error.message}`,
        kdf: 'unavailable',
        jwe: 'unavailable'
      };
    }
  }

  /**
   * Gets overall system health by checking all services
   * @returns {Promise<Object>} Complete health status
   */
  async getOverallHealth() {
    const [databaseHealth, cryptoHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkCryptography()
    ]);

    // Determine overall status
    let overallStatus = 'healthy';
    const unhealthyServices = [];

    if (databaseHealth.status === 'unhealthy') {
      unhealthyServices.push('database');
    }
    if (cryptoHealth.status === 'unhealthy') {
      unhealthyServices.push('cryptography');
    }

    if (unhealthyServices.length === 2) {
      overallStatus = 'unhealthy';
    } else if (unhealthyServices.length === 1) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {
        database: databaseHealth,
        cryptography: cryptoHealth
      }
    };
  }

  /**
   * Gets system metrics for monitoring
   * @returns {Object} System metrics including memory and CPU usage
   */
  getMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100 * 100) / 100
      },
      process: {
        pid: process.pid,
        cpu: Math.round((cpuUsage.user + cpuUsage.system) / 1000) / 1000
      }
    };
  }
}

module.exports = HealthService;
