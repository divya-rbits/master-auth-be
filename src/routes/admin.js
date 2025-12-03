const express = require('express');
const adminLogsController = require('../controllers/adminLogsController');
const adminAuthController = require('../controllers/adminAuthController');
const applicationController = require('../controllers/applicationController');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { adminLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Admin authentication routes (public - no auth middleware)
router.post('/auth/login', adminLimiter, adminAuthController.login.bind(adminAuthController));

// Admin logout route (requires auth)
router.post('/auth/logout', adminAuthMiddleware, adminLimiter, adminAuthController.logout.bind(adminAuthController));

// Apply admin authentication to all other routes
router.use(adminAuthMiddleware);

// Apply rate limiting to all admin routes
router.use(adminLimiter);

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Query audit logs
 *     description: Retrieve audit logs with optional filters and pagination. Requires admin authentication.
 *     tags:
 *       - Admin
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: event_type
 *         schema:
 *           type: string
 *           enum: [login_success, login_failed, token_validation_success, token_validation_failed, logout, token_refresh, token_revoked, token_status_check, token_status_check_failed, rate_limit_exceeded]
 *         description: Filter by event type
 *         example: login_success
 *       - in: query
 *         name: application_id
 *         schema:
 *           type: string
 *         description: Filter by application ID
 *         example: test-app
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date (ISO 8601 format)
 *         example: 2025-12-01T00:00:00Z
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date (ISO 8601 format)
 *         example: 2025-12-02T23:59:59Z
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of results per page (max 100)
 *         example: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip
 *         example: 0
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "123e4567-e89b-12d3-a456-426614174000"
 *                           event_type:
 *                             type: string
 *                             example: "login_success"
 *                           application_id:
 *                             type: string
 *                             example: "test-app"
 *                           ip_address:
 *                             type: string
 *                             example: "127.0.0.1"
 *                           user_agent:
 *                             type: string
 *                             example: "Mozilla/5.0..."
 *                           details:
 *                             type: object
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-12-02T10:30:00Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 150
 *                         limit:
 *                           type: integer
 *                           example: 50
 *                         offset:
 *                           type: integer
 *                           example: 0
 *                         hasMore:
 *                           type: boolean
 *                           example: true
 *       401:
 *         description: Unauthorized - Invalid or missing credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Authentication required"
 *                     statusCode:
 *                       type: integer
 *                       example: 401
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Too many admin requests, please try again later"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Failed to query audit logs"
 */
router.get('/logs', adminLogsController.getLogs.bind(adminLogsController));

/**
 * @swagger
 * /api/admin/applications:
 *   get:
 *     summary: List all applications
 *     description: Retrieve all applications with pagination and sorting. Requires admin authentication. Does not return sensitive fields (master_password_hash, app_secret).
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of results per page (max 100)
 *         example: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip
 *         example: 0
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [name, created_at]
 *           default: created_at
 *         description: Field to sort by
 *         example: name
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: asc
 *     responses:
 *       200:
 *         description: Applications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     applications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "123e4567-e89b-12d3-a456-426614174000"
 *                           app_id:
 *                             type: string
 *                             example: "test-app"
 *                           app_name:
 *                             type: string
 *                             example: "Test Application"
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-12-01T10:00:00Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-12-01T10:00:00Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 100
 *                         limit:
 *                           type: integer
 *                           example: 50
 *                         offset:
 *                           type: integer
 *                           example: 0
 *                         hasMore:
 *                           type: boolean
 *                           example: true
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Authentication required"
 *                     statusCode:
 *                       type: integer
 *                       example: 401
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Too many admin requests, please try again later"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve applications"
 */
router.get('/applications', applicationController.listApplications.bind(applicationController));

module.exports = router;
