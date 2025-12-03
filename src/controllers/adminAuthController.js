const adminAuthService = require('../services/adminAuth');
const databaseService = require('../services/database');

/**
 * Admin Authentication Controller
 * Handles admin login and logout operations using JWT tokens
 */
class AdminAuthController {
  /**
   * @swagger
   * /api/admin/auth/login:
   *   post:
   *     summary: Admin login
   *     description: Authenticate admin user and receive JWT token
   *     tags:
   *       - Admin Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 description: Admin username
   *                 example: "admin"
   *               password:
   *                 type: string
   *                 description: Admin password
   *                 example: "admin_password"
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 token:
   *                   type: string
   *                   description: JWT token for admin authentication
   *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *                 expiresIn:
   *                   type: integer
   *                   description: Token expiration time in seconds
   *                   example: 1800
   *                 message:
   *                   type: string
   *                   example: "Admin login successful"
   *       400:
   *         description: Bad request - Missing required fields
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
   *                   example: "username and password are required"
   *       401:
   *         description: Unauthorized - Invalid credentials
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
   *                   example: "Invalid credentials"
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
   *                   example: "Internal server error"
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Validate input
      if (!username || !password || username.trim() === '' || password.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'username and password are required'
        });
      }

      // Verify credentials
      const isValid = adminAuthService.verifyCredentials(username, password);

      if (!isValid) {
        // Log failed login attempt
        await databaseService.logEvent(
          'admin_login_failed',
          username,
          ipAddress,
          userAgent,
          { reason: 'Invalid credentials' }
        );

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Generate JWT token
      const token = adminAuthService.generateAdminToken(username);

      // Get expiration time from environment
      const expiresIn = parseInt(process.env.ADMIN_SESSION_TIMEOUT, 10) || 1800;

      // Log successful login
      await databaseService.logEvent(
        'admin_login_success',
        username,
        ipAddress,
        userAgent,
        { username, message: 'Admin authenticated successfully' }
      );

      // Return success response with token
      return res.status(200).json({
        success: true,
        token,
        expiresIn,
        message: 'Admin login successful'
      });

    } catch (error) {
      console.error('Admin login error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/admin/auth/logout:
   *   post:
   *     summary: Admin logout
   *     description: Logout admin user (logs the event, JWT is stateless so token remains valid until expiration)
   *     tags:
   *       - Admin Authentication
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
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
   *                   example: "Admin logout successful"
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
   *                   example: "Internal server error"
   */
  async logout(req, res) {
    try {
      const username = req.admin.username;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Log logout event
      await databaseService.logEvent(
        'admin_logout',
        username,
        ipAddress,
        userAgent,
        { username, message: 'Admin logged out' }
      );

      return res.status(200).json({
        success: true,
        message: 'Admin logout successful'
      });

    } catch (error) {
      console.error('Admin logout error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

// Export singleton instance
module.exports = new AdminAuthController();
