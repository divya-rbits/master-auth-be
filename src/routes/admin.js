const express = require('express');
const adminLogsController = require('../controllers/adminLogsController');
const adminAuthController = require('../controllers/adminAuthController');
const adminDashboardController = require('../controllers/adminDashboardController');
const applicationController = require('../controllers/applicationController');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { adminLimiter, passwordChangeLimiter, exportLimiter, tokenRevocationLimiter } = require('../middleware/rateLimiter');

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
 *     description: Retrieve audit logs with optional filters and pagination. Requires admin authentication. Rate limited to 100 requests per minute per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
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
 * /api/admin/logs/export:
 *   get:
 *     summary: Export audit logs
 *     description: Export audit logs in JSON or CSV format with optional filters. Requires admin authentication. Rate limited to 10 exports per hour per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format (json or csv)
 *         example: csv
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
 *         example: 2025-12-04T23:59:59Z
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of results to export (max 100)
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
 *         description: Audit logs exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "123e4567-e89b-12d3-a456-426614174000"
 *                   event_type:
 *                     type: string
 *                     example: "login_success"
 *                   application_id:
 *                     type: string
 *                     example: "test-app"
 *                   ip_address:
 *                     type: string
 *                     example: "127.0.0.1"
 *                   user_agent:
 *                     type: string
 *                     example: "Mozilla/5.0..."
 *                   details:
 *                     type: object
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-12-04T10:00:00Z"
 *             examples:
 *               jsonExport:
 *                 summary: JSON export example
 *                 value:
 *                   - id: "log-1"
 *                     event_type: "login_success"
 *                     application_id: "app-123"
 *                     ip_address: "127.0.0.1"
 *                     user_agent: "Mozilla/5.0"
 *                     details: {}
 *                     created_at: "2025-12-04T10:00:00Z"
 *           text/csv:
 *             schema:
 *               type: string
 *             examples:
 *               csvExport:
 *                 summary: CSV export example
 *                 value: |
 *                   id,event_type,application_id,ip_address,user_agent,details,created_at
 *                   log-1,login_success,app-123,127.0.0.1,Mozilla/5.0,{},2025-12-04T10:00:00Z
 *       400:
 *         description: Bad request - Invalid format parameter
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
 *                   example: "Invalid format parameter. Supported formats: json, csv"
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
 *         description: Too many export requests (rate limit exceeded - 10 per hour)
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
 *                   example: "Too many log export requests, please try again later"
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
 *                   example: "Failed to export audit logs"
 */
router.get('/logs/export', adminAuthMiddleware, exportLimiter, adminLogsController.exportLogs.bind(adminLogsController));

/**
 * @swagger
 * /api/admin/applications:
 *   post:
 *     summary: Create a new application
 *     description: Create a new application with a master password. Requires admin authentication. Returns the plain app_secret only once - save it securely. Rate limited to 100 requests per minute per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - app_name
 *               - master_password
 *             properties:
 *               app_name:
 *                 type: string
 *                 description: Name of the application
 *                 example: "My New Application"
 *               master_password:
 *                 type: string
 *                 format: password
 *                 description: Master password for the application (minimum 12 characters)
 *                 example: "SecurePassword123!"
 *     responses:
 *       201:
 *         description: Application created successfully
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     app_id:
 *                       type: string
 *                       example: "app-123e4567"
 *                     app_name:
 *                       type: string
 *                       example: "My New Application"
 *                     app_secret:
 *                       type: string
 *                       description: Plain application secret (shown only once - save it!)
 *                       example: "abc123def456ghi789jkl012mno345pqrst678uvw901xyz234"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-03T10:00:00Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-03T10:00:00Z"
 *                 message:
 *                   type: string
 *                   example: "Application created successfully. Save the app_secret - it will not be shown again."
 *       400:
 *         description: Bad request - Invalid input
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
 *                   example: "app_name is required"
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
 *                   example: "Failed to create application"
 */
router.post('/applications', applicationController.createApplication.bind(applicationController));

/**
 * @swagger
 * /api/admin/applications:
 *   get:
 *     summary: List all applications
 *     description: Retrieve all applications with pagination and sorting. Requires admin authentication. Does not return sensitive fields (master_password_hash, app_secret). Rate limited to 100 requests per minute per IP address.
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

/**
 * @swagger
 * /api/admin/applications/{id}:
 *   get:
 *     summary: Get application by ID
 *     description: Retrieve details for a specific application by UUID. Returns application data without sensitive fields (master_password_hash, app_secret). Requires admin authentication. Rate limited to 100 requests per minute per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Application UUID
 *         example: "7df59ec8-b903-4265-b17a-b38a5e4a22a2"
 *     responses:
 *       200:
 *         description: Application retrieved successfully
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       description: Application UUID
 *                       example: "7df59ec8-b903-4265-b17a-b38a5e4a22a2"
 *                     app_id:
 *                       type: string
 *                       description: Application identifier
 *                       example: "APP123456"
 *                     app_name:
 *                       type: string
 *                       description: Application name
 *                       example: "My Application"
 *                     is_active:
 *                       type: boolean
 *                       description: Whether application is active
 *                       example: true
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: Creation timestamp
 *                       example: "2024-01-15T10:30:00.000Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: Last update timestamp
 *                       example: "2024-01-20T14:45:00.000Z"
 *       400:
 *         description: Invalid request - Missing or malformed UUID
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
 *                   example: "Invalid application ID format"
 *       401:
 *         description: Unauthorized - Invalid or missing Bearer token
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
 *                     type:
 *                       type: string
 *                       example: "AuthenticationError"
 *                     statusCode:
 *                       type: number
 *                       example: 401
 *       404:
 *         description: Application not found
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
 *                   example: "Application not found"
 *       429:
 *         description: Too many requests - Rate limit exceeded
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
 *         description: Server error
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
 *                   example: "Failed to retrieve application"
 */
router.get('/applications/:id', applicationController.getApplication.bind(applicationController));

/**
 * @swagger
 * /api/admin/applications/{id}:
 *   put:
 *     summary: Update an application
 *     description: Update an existing application's name or active status. Requires admin authentication. Supports partial updates. Rate limited to 100 requests per minute per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Application UUID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               app_name:
 *                 type: string
 *                 description: New application name (optional)
 *                 example: "Updated Application Name"
 *               is_active:
 *                 type: boolean
 *                 description: New active status (optional)
 *                 example: false
 *           examples:
 *             updateName:
 *               summary: Update only app_name
 *               value:
 *                 app_name: "My Updated App"
 *             updateStatus:
 *               summary: Update only is_active
 *               value:
 *                 is_active: false
 *             updateBoth:
 *               summary: Update both fields
 *               value:
 *                 app_name: "Deactivated App"
 *                 is_active: false
 *     responses:
 *       200:
 *         description: Application updated successfully
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     app_id:
 *                       type: string
 *                       example: "app-123e4567"
 *                     app_name:
 *                       type: string
 *                       example: "Updated Application Name"
 *                     is_active:
 *                       type: boolean
 *                       example: false
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-03T10:00:00Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-03T11:30:00Z"
 *                 message:
 *                   type: string
 *                   example: "Application updated successfully"
 *       400:
 *         description: Bad request - Invalid input
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
 *               examples:
 *                 emptyBody:
 *                   summary: Empty request body
 *                   value:
 *                     success: false
 *                     error: "At least one field (app_name or is_active) must be provided"
 *                 emptyName:
 *                   summary: Empty app_name
 *                   value:
 *                     success: false
 *                     error: "app_name cannot be empty"
 *                 invalidType:
 *                   summary: Invalid is_active type
 *                   value:
 *                     success: false
 *                     error: "is_active must be a boolean"
 *                 invalidId:
 *                   summary: Invalid UUID format
 *                   value:
 *                     success: false
 *                     error: "Invalid application ID format"
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
 *       404:
 *         description: Application not found
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
 *                   example: "Application not found"
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
 *                   example: "Failed to update application"
 */
router.put('/applications/:id', applicationController.updateApplication.bind(applicationController));

/**
 * @swagger
 * /api/admin/applications/{id}:
 *   delete:
 *     summary: Delete an application
 *     description: Soft deletes an application by setting is_active to false. Requires admin authentication. This will effectively invalidate all tokens for this application. Rate limited to 100 requests per minute per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Application UUID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Application deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Application deleted successfully"
 *       400:
 *         description: Bad request - Invalid UUID format
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
 *                   example: "Invalid application ID format"
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
 *       404:
 *         description: Application not found
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
 *                   example: "Application not found"
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
 *                   example: "Failed to delete application"
 */
router.delete('/applications/:id', applicationController.deleteApplication.bind(applicationController));

/**
 * @swagger
 * /api/admin/tokens:
 *   get:
 *     summary: List all active tokens
 *     description: Retrieve all active tokens with optional filtering and pagination. Active tokens are login events that have not been revoked. Requires admin authentication. Rate limited to 100 requests per minute per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: application_id
 *         schema:
 *           type: string
 *         description: Filter by application ID (optional)
 *         example: app-123e4567
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
 *         name: issued_from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter tokens issued on or after this date (ISO 8601 format)
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: issued_to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter tokens issued on or before this date (ISO 8601 format)
 *         example: "2024-12-31T23:59:59Z"
 *       - in: query
 *         name: expires_from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter tokens expiring on or after this date (ISO 8601 format)
 *         example: "2025-01-01T00:00:00Z"
 *       - in: query
 *         name: expires_to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter tokens expiring on or before this date (ISO 8601 format)
 *         example: "2025-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Active tokens retrieved successfully
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
 *                     tokens:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           jti:
 *                             type: string
 *                             description: JWT ID (unique token identifier)
 *                             example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                           application_id:
 *                             type: string
 *                             description: Application ID that owns this token
 *                             example: "app-123e4567"
 *                           issued_at:
 *                             type: string
 *                             format: date-time
 *                             description: Token issue timestamp
 *                             example: "2025-12-04T10:00:00Z"
 *                           expires_at:
 *                             type: string
 *                             format: date-time
 *                             description: Token expiration timestamp
 *                             example: "2025-12-04T11:00:00Z"
 *                           ip_address:
 *                             type: string
 *                             description: IP address where token was issued
 *                             example: "192.168.1.1"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           description: Total number of active tokens
 *                           example: 150
 *                         limit:
 *                           type: integer
 *                           description: Number of results per page
 *                           example: 50
 *                         offset:
 *                           type: integer
 *                           description: Number of results skipped
 *                           example: 0
 *                         hasMore:
 *                           type: boolean
 *                           description: Whether there are more results available
 *                           example: true
 *       400:
 *         description: Bad request - Invalid date format or date range
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
 *                   examples:
 *                     - "Invalid date format for issued_from. Expected ISO 8601 format (e.g., 2024-01-01T00:00:00Z)"
 *                     - "issued_from must be before or equal to issued_to"
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
 *                   type: string
 *                   example: "Failed to retrieve active tokens"
 */
router.get('/tokens', applicationController.listActiveTokens.bind(applicationController));

/**
 * @swagger
 * /api/admin/tokens/revoke:
 *   post:
 *     summary: Revoke a specific token
 *     description: Revoke a token by its JWT ID (jti). The token will be added to the revoked_tokens table and will no longer be valid. Requires admin authentication. Rate limited to 50 revocation requests per hour per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jti
 *             properties:
 *               jti:
 *                 type: string
 *                 description: JWT ID (unique token identifier) to revoke
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *               reason:
 *                 type: string
 *                 description: Optional reason for revocation
 *                 example: "Security concern - suspicious activity detected"
 *           examples:
 *             withReason:
 *               summary: Revoke token with reason
 *               value:
 *                 jti: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                 reason: "Security concern"
 *             withoutReason:
 *               summary: Revoke token without reason
 *               value:
 *                 jti: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Token revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Token revoked successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jti:
 *                       type: string
 *                       description: The JWT ID that was revoked
 *                       example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                     revoked_at:
 *                       type: string
 *                       format: date-time
 *                       description: Timestamp when the token was revoked
 *                       example: "2025-12-04T12:00:00Z"
 *       400:
 *         description: Bad request - Invalid input
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
 *               examples:
 *                 missingJti:
 *                   summary: Missing jti
 *                   value:
 *                     success: false
 *                     error: "jti is required"
 *                 invalidJtiType:
 *                   summary: Invalid jti type
 *                   value:
 *                     success: false
 *                     error: "jti must be a string"
 *                 invalidReasonType:
 *                   summary: Invalid reason type
 *                   value:
 *                     success: false
 *                     error: "reason must be a string"
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
 *       404:
 *         description: Token not found
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
 *                   example: "Token not found"
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
 *                   example: "Failed to revoke token"
 */
router.post('/tokens/revoke', tokenRevocationLimiter, applicationController.revokeToken.bind(applicationController));

/**
 * @swagger
 * /api/admin/applications/{id}/password:
 *   put:
 *     summary: Change master password for an application
 *     description: Change the master password for a specific application. Requires admin authentication and current password verification. All active tokens will be revoked upon successful password change. Rate limited to 5 attempts per hour per application.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Application UUID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current_master_password
 *               - new_master_password
 *             properties:
 *               current_master_password:
 *                 type: string
 *                 format: password
 *                 description: Current master password for verification
 *                 example: "CurrentPassword123!"
 *               new_master_password:
 *                 type: string
 *                 format: password
 *                 description: New master password (minimum 12 characters)
 *                 minLength: 12
 *                 example: "NewSecurePassword456!"
 *     responses:
 *       200:
 *         description: Master password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Master password changed successfully. All active tokens have been revoked."
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens_revoked:
 *                       type: integer
 *                       description: Number of active tokens that were revoked
 *                       example: 5
 *       400:
 *         description: Bad request - Invalid input
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
 *               examples:
 *                 missingCurrent:
 *                   summary: Missing current password
 *                   value:
 *                     success: false
 *                     error: "current_master_password is required"
 *                 missingNew:
 *                   summary: Missing new password
 *                   value:
 *                     success: false
 *                     error: "new_master_password is required"
 *                 shortPassword:
 *                   summary: Password too short
 *                   value:
 *                     success: false
 *                     error: "new_master_password must be at least 12 characters"
 *                 invalidId:
 *                   summary: Invalid UUID format
 *                   value:
 *                     success: false
 *                     error: "Invalid application ID format"
 *       401:
 *         description: Unauthorized - Authentication failed or incorrect password
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
 *               examples:
 *                 authRequired:
 *                   summary: Authentication required
 *                   value:
 *                     success: false
 *                     error:
 *                       message: "Authentication required"
 *                       statusCode: 401
 *                 incorrectPassword:
 *                   summary: Incorrect current password
 *                   value:
 *                     success: false
 *                     error: "Current password is incorrect"
 *       404:
 *         description: Application not found
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
 *                   example: "Application not found"
 *       429:
 *         description: Too many password change attempts
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
 *                   example: "Too many password change requests, please try again later"
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
 *                   example: "Failed to change master password"
 */
router.put('/applications/:id/password', passwordChangeLimiter, applicationController.changePassword.bind(applicationController));

/**
 * @swagger
 * /api/admin/applications/{id}/revoke-all:
 *   post:
 *     summary: Revoke all tokens for an application
 *     description: Revokes all active tokens for a specific application. All tokens will be added to the revoked_tokens table. Requires admin authentication. This is a destructive action. Rate limited to 50 revocation requests per hour per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Application UUID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Optional reason for revoking all tokens
 *                 example: "Security audit - suspicious activity detected"
 *           examples:
 *             withReason:
 *               summary: Revoke with reason
 *               value:
 *                 reason: "Security audit"
 *             withoutReason:
 *               summary: Revoke without reason
 *               value: {}
 *     responses:
 *       200:
 *         description: All tokens revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "All tokens revoked successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens_revoked:
 *                       type: integer
 *                       description: Number of tokens that were revoked
 *                       example: 5
 *       400:
 *         description: Bad request - Invalid input
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
 *               examples:
 *                 invalidId:
 *                   summary: Invalid UUID format
 *                   value:
 *                     success: false
 *                     error: "Invalid application ID format"
 *                 invalidReason:
 *                   summary: Invalid reason type
 *                   value:
 *                     success: false
 *                     error: "reason must be a string"
 *                 emptyReason:
 *                   summary: Empty reason
 *                   value:
 *                     success: false
 *                     error: "reason cannot be empty"
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
 *       404:
 *         description: Application not found
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
 *                   example: "Application not found"
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
 *                   example: "Failed to revoke tokens"
 */
router.post('/applications/:id/revoke-all', tokenRevocationLimiter, applicationController.revokeAllTokens.bind(applicationController));

/**
 * @swagger
 * /api/admin/applications/{id}/analytics:
 *   get:
 *     summary: Get per-application analytics
 *     description: Retrieve detailed analytics for a specific application including login statistics, active tokens, validation counts, and peak usage times. Results are cached for 5 minutes to reduce database load. Requires admin authentication. Rate limited to 100 requests per minute per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Application UUID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: date_range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Time range for analytics data
 *         example: "30d"
 *     responses:
 *       200:
 *         description: Application analytics retrieved successfully
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
 *                     login_success_count:
 *                       type: integer
 *                       description: Number of successful logins in the date range
 *                       example: 200
 *                     login_failed_count:
 *                       type: integer
 *                       description: Number of failed login attempts in the date range
 *                       example: 15
 *                     active_token_count:
 *                       type: integer
 *                       description: Number of currently active (non-revoked) tokens
 *                       example: 25
 *                     token_validations_count:
 *                       type: integer
 *                       description: Number of token validations in the date range
 *                       example: 500
 *                     most_recent_activity:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Timestamp of most recent activity (null if no activity)
 *                       example: "2025-12-04T10:00:00Z"
 *                     peak_usage_times:
 *                       type: array
 *                       description: Top 5 hours with highest activity (UTC hours 0-23)
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: integer
 *                             minimum: 0
 *                             maximum: 23
 *                             description: Hour of day in UTC (0-23)
 *                             example: 14
 *                           count:
 *                             type: integer
 *                             description: Number of events in this hour
 *                             example: 50
 *             examples:
 *               analyticsData:
 *                 summary: Application analytics example
 *                 value:
 *                   success: true
 *                   data:
 *                     login_success_count: 200
 *                     login_failed_count: 15
 *                     active_token_count: 25
 *                     token_validations_count: 500
 *                     most_recent_activity: "2025-12-04T10:00:00Z"
 *                     peak_usage_times:
 *                       - hour: 14
 *                         count: 50
 *                       - hour: 10
 *                         count: 40
 *                       - hour: 16
 *                         count: 35
 *       400:
 *         description: Bad request - Invalid parameters
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
 *               examples:
 *                 invalidId:
 *                   summary: Invalid application ID format
 *                   value:
 *                     success: false
 *                     error: "Invalid application ID format"
 *                 invalidRange:
 *                   summary: Invalid date range
 *                   value:
 *                     success: false
 *                     error: "Invalid date_range. Must be one of: 7d, 30d, 90d"
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
 *       404:
 *         description: Application not found
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
 *                   example: "Application not found"
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
 *                   example: "Failed to retrieve application analytics"
 */
router.get('/applications/:id/analytics', adminDashboardController.getApplicationAnalytics.bind(adminDashboardController));

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     description: Retrieve overview statistics for the admin dashboard. Includes application counts, token counts, and activity metrics for the last 24 hours. Results are cached for 5 minutes to reduce database load. Requires admin authentication. Rate limited to 100 requests per minute per IP address.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
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
 *                     total_applications:
 *                       type: integer
 *                       description: Total number of applications (active and inactive)
 *                       example: 10
 *                     active_applications:
 *                       type: integer
 *                       description: Number of active applications
 *                       example: 8
 *                     total_active_tokens:
 *                       type: integer
 *                       description: Total number of active (non-revoked) tokens
 *                       example: 25
 *                     failed_logins_24h:
 *                       type: integer
 *                       description: Number of failed login attempts in the last 24 hours
 *                       example: 5
 *                     successful_logins_24h:
 *                       type: integer
 *                       description: Number of successful logins in the last 24 hours
 *                       example: 50
 *                     token_validations_24h:
 *                       type: integer
 *                       description: Number of successful token validations in the last 24 hours
 *                       example: 120
 *                     recent_activity:
 *                       type: array
 *                       description: Last 10 audit log events (most recent first)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "log-123"
 *                           event_type:
 *                             type: string
 *                             example: "login_success"
 *                           application_id:
 *                             type: string
 *                             example: "app-123"
 *                           ip_address:
 *                             type: string
 *                             example: "127.0.0.1"
 *                           user_agent:
 *                             type: string
 *                             example: "Mozilla/5.0"
 *                           details:
 *                             type: object
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-12-04T10:00:00Z"
 *             examples:
 *               dashboardStats:
 *                 summary: Dashboard statistics example
 *                 value:
 *                   success: true
 *                   data:
 *                     total_applications: 10
 *                     active_applications: 8
 *                     total_active_tokens: 25
 *                     failed_logins_24h: 5
 *                     successful_logins_24h: 50
 *                     token_validations_24h: 120
 *                     recent_activity:
 *                       - id: "log-1"
 *                         event_type: "login_success"
 *                         application_id: "app-123"
 *                         ip_address: "127.0.0.1"
 *                         user_agent: "Mozilla/5.0"
 *                         details: {}
 *                         created_at: "2025-12-04T10:00:00Z"
 *                       - id: "log-2"
 *                         event_type: "token_validation_success"
 *                         application_id: "app-456"
 *                         ip_address: "192.168.1.1"
 *                         user_agent: "Chrome/90.0"
 *                         details: {}
 *                         created_at: "2025-12-04T09:55:00Z"
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
 *                   type: string
 *                   example: "Failed to retrieve dashboard stats"
 */
router.get('/dashboard', adminDashboardController.getStats.bind(adminDashboardController));

module.exports = router;
