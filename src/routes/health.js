const express = require('express');
const HealthService = require('../services/health');

const router = express.Router();
const healthService = new HealthService();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Comprehensive health check endpoint
 *     description: Returns detailed health status including database connectivity, cryptographic services, and system information
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-12-03T10:30:00.000Z
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 3600
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, unhealthy]
 *                         message:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                     cryptography:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, unhealthy]
 *                         kdf:
 *                           type: string
 *                         jwe:
 *                           type: string
 *       503:
 *         description: One or more services are unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                 services:
 *                   type: object
 */
router.get('/', async (req, res) => {
  try {
    const health = await healthService.getOverallHealth();

    // Return 503 if status is not healthy
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: System metrics endpoint
 *     description: Returns system performance metrics including memory usage, CPU, and uptime
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: System metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-12-03T10:30:00.000Z
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 3600
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: number
 *                       description: Heap memory used in bytes
 *                     total:
 *                       type: number
 *                       description: Total heap memory in bytes
 *                     percentage:
 *                       type: number
 *                       description: Memory usage percentage
 *                 process:
 *                   type: object
 *                   properties:
 *                     pid:
 *                       type: number
 *                       description: Process ID
 *                     cpu:
 *                       type: number
 *                       description: CPU usage in milliseconds
 *       500:
 *         description: Error retrieving metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = healthService.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
