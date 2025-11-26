const passwordService = require('../services/password');
const tokenService = require('../services/token');
const databaseService = require('../services/database');

/**
 * Authentication Controller
 * Handles login, validation, logout, and token refresh operations
 */
class AuthController {
  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Authenticate and generate JWE token
   *     description: Authenticates using master password and generates an encrypted JWE token
   *     tags:
   *       - Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - password
   *               - application_id
   *             properties:
   *               password:
   *                 type: string
   *                 description: Master password for authentication
   *                 example: "YourSecurePassword123"
   *               application_id:
   *                 type: string
   *                 description: Unique identifier for the application
   *                 example: "web-app-001"
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
   *                   description: Encrypted JWE token
   *                   example: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWEtoken"
   *                 salt:
   *                   type: string
   *                   description: Base64url encoded salt for key derivation
   *                   example: "randomSaltValue123"
   *                 message:
   *                   type: string
   *                   example: "Login successful"
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
   *                   example: "password is required"
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
      const { password, application_id } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Validate required fields
      if (!password || (typeof password === 'string' && password.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'password is required'
        });
      }

      if (!application_id || (typeof application_id === 'string' && application_id.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'application_id is required'
        });
      }

      // Get password hash from database
      const passwordHash = await databaseService.getPasswordHash();

      if (!passwordHash) {
        await databaseService.logEvent(
          'login_failed',
          application_id,
          ipAddress,
          userAgent,
          { reason: 'Password not configured' }
        );

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Verify password
      const isValid = await passwordService.verifyPassword(password, passwordHash);

      if (!isValid) {
        await databaseService.logEvent(
          'login_failed',
          application_id,
          ipAddress,
          userAgent,
          { reason: 'Invalid password' }
        );

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Generate token
      const { token, salt } = await tokenService.generateToken(application_id);

      // Log successful login
      await databaseService.logEvent(
        'login_success',
        application_id,
        ipAddress,
        userAgent,
        { message: 'User authenticated successfully' }
      );

      // Return success response
      return res.status(200).json({
        success: true,
        token,
        salt,
        message: 'Login successful'
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/auth/validate:
   *   post:
   *     summary: Validate a JWE token
   *     description: Validates an encrypted JWE token and returns the payload with session information if valid. Logs all validation attempts to audit logs.
   *     tags:
   *       - Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *               - salt
   *             properties:
   *               token:
   *                 type: string
   *                 description: Encrypted JWE token to validate
   *                 example: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWEtoken"
   *               salt:
   *                 type: string
   *                 description: Base64url encoded salt used during token generation
   *                 example: "randomSaltValue123"
   *     responses:
   *       200:
   *         description: Token is valid
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 valid:
   *                   type: boolean
   *                   example: true
   *                 payload:
   *                   type: object
   *                   description: Decoded JWT payload
   *                   properties:
   *                     appId:
   *                       type: string
   *                       example: "web-app-001"
   *                     jti:
   *                       type: string
   *                       example: "unique-token-id-123"
   *                     exp:
   *                       type: integer
   *                       description: Expiration timestamp (Unix epoch seconds)
   *                       example: 1735200000
   *                     iat:
   *                       type: integer
   *                       description: Issued at timestamp (Unix epoch seconds)
   *                       example: 1735196400
   *                 sessionId:
   *                   type: string
   *                   description: Unique session identifier (same as jti)
   *                   example: "unique-token-id-123"
   *                 expiresIn:
   *                   type: integer
   *                   description: Remaining time until token expiration in seconds
   *                   example: 3600
   *                 permissions:
   *                   type: array
   *                   description: Array of permissions associated with this token (empty for now, reserved for future use)
   *                   items:
   *                     type: string
   *                   example: []
   *                 message:
   *                   type: string
   *                   example: "Token is valid"
   *       400:
   *         description: Bad request - Missing required fields
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 valid:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: "token is required"
   *       401:
   *         description: Unauthorized - Invalid, expired, or revoked token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 valid:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: "Token has been revoked"
   */
  async validate(req, res) {
    try {
      const { token, salt } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Validate required fields
      if (!token || (typeof token === 'string' && token.trim().length === 0)) {
        return res.status(400).json({
          valid: false,
          error: 'token is required'
        });
      }

      if (!salt || (typeof salt === 'string' && salt.trim().length === 0)) {
        return res.status(400).json({
          valid: false,
          error: 'salt is required'
        });
      }

      // Validate token
      const payload = await tokenService.validateToken(token, salt);

      // Calculate remaining expiration time in seconds
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresIn = payload.exp - currentTime;

      // Log successful validation
      await databaseService.logEvent(
        'token_validation_success',
        payload.appId,
        ipAddress,
        userAgent,
        { jti: payload.jti, expiresIn }
      );

      // Return success response with enhanced format
      return res.status(200).json({
        valid: true,
        payload,
        sessionId: payload.jti,
        expiresIn,
        permissions: [],
        message: 'Token is valid'
      });

    } catch (error) {
      console.error('Validation error:', error);

      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Log failed validation
      await databaseService.logEvent(
        'token_validation_failed',
        'unknown',
        ipAddress,
        userAgent,
        { reason: error.message }
      );

      // Check if it's a validation error or server error
      if (error.message.includes('expired') ||
          error.message.includes('invalid') ||
          error.message.includes('revoked')) {
        return res.status(401).json({
          valid: false,
          error: error.message
        });
      }

      return res.status(401).json({
        valid: false,
        error: 'Token validation failed'
      });
    }
  }

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Logout and revoke token
   *     description: Revokes the provided token by adding it to the revocation list
   *     tags:
   *       - Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *               - salt
   *             properties:
   *               token:
   *                 type: string
   *                 description: JWE token to revoke
   *                 example: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockJWEtoken"
   *               salt:
   *                 type: string
   *                 description: Base64url encoded salt
   *                 example: "randomSaltValue123"
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
   *                   example: "Logout successful"
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
   *                   example: "token is required"
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
      const { token, salt } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Validate required fields
      if (!token || (typeof token === 'string' && token.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'token is required'
        });
      }

      if (!salt || (typeof salt === 'string' && salt.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'salt is required'
        });
      }

      // Check if token is already revoked
      let payload;
      try {
        payload = await tokenService.validateToken(token, salt);
      } catch (error) {
        // If token is already revoked, return success
        if (error.message.includes('revoked')) {
          return res.status(200).json({
            success: true,
            message: 'Token already revoked'
          });
        }
        throw error;
      }

      // Revoke the token
      const expiresAt = new Date(payload.exp * 1000);
      await databaseService.revokeToken(payload.jti, expiresAt, 'User logout');

      // Log logout event
      await databaseService.logEvent(
        'logout',
        payload.appId,
        ipAddress,
        userAgent,
        { jti: payload.jti }
      );

      return res.status(200).json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/auth/refresh:
   *   post:
   *     summary: Refresh an existing token
   *     description: Generates a new token from an existing valid token and revokes the old one
   *     tags:
   *       - Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *               - salt
   *             properties:
   *               token:
   *                 type: string
   *                 description: Existing JWE token to refresh
   *                 example: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockOldJWEtoken"
   *               salt:
   *                 type: string
   *                 description: Base64url encoded salt for the existing token
   *                 example: "oldSaltValue123"
   *     responses:
   *       200:
   *         description: Token refreshed successfully
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
   *                   description: New encrypted JWE token
   *                   example: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..mockNewJWEtoken"
   *                 salt:
   *                   type: string
   *                   description: New base64url encoded salt
   *                   example: "newSaltValue456"
   *                 message:
   *                   type: string
   *                   example: "Token refreshed successfully"
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
   *                   example: "token is required"
   *       401:
   *         description: Unauthorized - Invalid, expired, or revoked token
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
   *                   example: "Token has been revoked"
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
  async refresh(req, res) {
    try {
      const { token, salt } = req.body;

      // Validate required fields
      if (!token || (typeof token === 'string' && token.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'token is required'
        });
      }

      if (!salt || (typeof salt === 'string' && salt.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'salt is required'
        });
      }

      // Validate the existing token
      const oldPayload = await tokenService.validateToken(token, salt);

      // Generate new token with same appId and userContext
      const { token: newToken, salt: newSalt } = await tokenService.generateToken(
        oldPayload.appId,
        oldPayload.userContext
      );

      // Revoke the old token
      const expiresAt = new Date(oldPayload.exp * 1000);
      await databaseService.revokeToken(oldPayload.jti, expiresAt, 'Token refreshed');

      // Log refresh event
      await databaseService.logEvent(
        'token_refresh',
        oldPayload.appId,
        req.ip,
        req.get('user-agent'),
        { oldJti: oldPayload.jti, message: 'Token refreshed successfully' }
      );

      return res.status(200).json({
        success: true,
        token: newToken,
        salt: newSalt,
        message: 'Token refreshed successfully'
      });

    } catch (error) {
      console.error('Refresh error:', error);

      // Check if it's a validation error
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('expired') ||
          errorMsg.includes('invalid') ||
          errorMsg.includes('revoked')) {
        return res.status(401).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

// Export singleton instance
module.exports = new AuthController();
