const databaseService = require('../services/database');
const passwordService = require('../services/password');

/**
 * Application Management Controller
 * Handles admin operations for managing applications
 */
class ApplicationController {
  /**
   * List all applications with pagination and sorting
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async listApplications(req, res) {
    try {
      // Parse query parameters
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const sortBy = req.query.sort_by || 'created_at';
      const order = req.query.order || 'desc';

      // Enforce parameter limits
      const safeLimit = Math.min(Math.max(1, limit), 100);
      const safeOffset = Math.max(0, offset);

      // Validate sort parameters
      const validSortFields = ['name', 'created_at'];
      const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';

      const validOrders = ['asc', 'desc'];
      const safeOrder = validOrders.includes(order) ? order : 'desc';

      // Query applications from database
      const result = await databaseService.getAllApplications({
        limit: safeLimit,
        offset: safeOffset,
        sortBy: safeSortBy,
        order: safeOrder
      });

      // Calculate if there are more results
      const hasMore = (result.offset + result.limit) < result.total;

      // Return success response
      return res.status(200).json({
        success: true,
        data: {
          applications: result.applications,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            hasMore
          }
        }
      });

    } catch (error) {
      console.error('Error listing applications:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve applications'
      });
    }
  }

  /**
   * Get a single application by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getApplication(req, res, next) {
    try {
      // Validate application ID
      const applicationId = req.params.id;

      if (!applicationId || applicationId.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Application ID is required'
        });
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(applicationId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid application ID format'
        });
      }

      // Fetch application from database
      const application = await databaseService.getApplicationById(applicationId);

      // Check if application was found
      if (application === null) {
        return res.status(404).json({
          success: false,
          error: 'Application not found'
        });
      }

      // Return success response
      return res.status(200).json({
        success: true,
        data: application
      });
    } catch (error) {
      // Pass error to error handler middleware
      next(error);
    }
  }

  /**
   * Create a new application with master password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createApplication(req, res) {
    try {
      const { app_name, master_password } = req.body;

      // Validate app_name
      if (!app_name || typeof app_name !== 'string' || app_name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'app_name is required'
        });
      }

      // Validate master_password
      if (!master_password || typeof master_password !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'master_password is required'
        });
      }

      if (master_password.length < 12) {
        return res.status(400).json({
          success: false,
          error: 'master_password must be at least 12 characters'
        });
      }

      // Hash master password using Argon2
      const master_password_hash = await passwordService.hashPassword(master_password);

      // Create application in database
      const application = await databaseService.createApplication({
        app_name: app_name.trim(),
        master_password_hash
      });

      // Log application creation event
      await databaseService.logEvent(
        'application_created',
        application.app_id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
        {
          admin_username: req.admin?.username,
          app_name: application.app_name
        }
      );

      // Return success response with application details
      // Include plain app_secret (one-time only)
      return res.status(201).json({
        success: true,
        data: {
          id: application.id,
          app_id: application.app_id,
          app_name: application.app_name,
          app_secret: application.plain_app_secret,
          is_active: application.is_active,
          created_at: application.created_at,
          updated_at: application.updated_at
        },
        message: 'Application created successfully. Save the app_secret - it will not be shown again.'
      });

    } catch (error) {
      console.error('Error creating application:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create application'
      });
    }
  }

  /**
   * Update an existing application
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateApplication(req, res) {
    try {
      const { id } = req.params;
      const { app_name, is_active } = req.body;

      // Validate id format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid application ID format'
        });
      }

      // Build update object
      const updates = {};

      // Validate and add app_name if provided
      if (app_name !== undefined) {
        if (typeof app_name !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'app_name must be a string'
          });
        }

        const trimmedName = app_name.trim();
        if (trimmedName.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'app_name cannot be empty'
          });
        }

        updates.app_name = trimmedName;
      }

      // Validate and add is_active if provided
      if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') {
          return res.status(400).json({
            success: false,
            error: 'is_active must be a boolean'
          });
        }

        updates.is_active = is_active;
      }

      // Check at least one field provided
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one field (app_name or is_active) must be provided'
        });
      }

      // Update application in database
      const updatedApplication = await databaseService.updateApplication(id, updates);

      // Check if application was found
      if (!updatedApplication) {
        return res.status(404).json({
          success: false,
          error: 'Application not found'
        });
      }

      // Log application update event
      try {
        await databaseService.logEvent(
          'application_updated',
          updatedApplication.app_id,
          req.ip || 'unknown',
          req.get('user-agent') || 'unknown',
          {
            admin_username: req.admin?.username,
            app_name: updates.app_name
          }
        );
      } catch (logError) {
        // Log error but don't fail the request
        console.error('Error logging application update:', logError);
      }

      // Return success response
      return res.status(200).json({
        success: true,
        data: updatedApplication,
        message: 'Application updated successfully'
      });

    } catch (error) {
      console.error('Error updating application:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update application'
      });
    }
  }

  /**
   * Delete an application (soft delete)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteApplication(req, res) {
    try {
      const { id } = req.params;

      // Validate id format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid application ID format'
        });
      }

      // Delete application in database (soft delete)
      const deletedApplication = await databaseService.deleteApplication(id);

      // Check if application was found
      if (!deletedApplication) {
        return res.status(404).json({
          success: false,
          error: 'Application not found'
        });
      }

      // Log application deletion event
      try {
        await databaseService.logEvent(
          'application_deleted',
          deletedApplication.app_id,
          req.ip || 'unknown',
          req.get('user-agent') || 'unknown',
          {
            admin_username: req.admin?.username,
            app_name: deletedApplication.app_name
          }
        );
      } catch (logError) {
        // Log error but don't fail the request
        console.error('Error logging application deletion:', logError);
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Application deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting application:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete application'
      });
    }
  }

  /**
   * List all active tokens with optional filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async listActiveTokens(req, res) {
    try {
      // Parse query parameters
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
      const applicationId = req.query.application_id || null;

      // Parse date filter parameters
      const issuedFrom = req.query.issued_from || null;
      const issuedTo = req.query.issued_to || null;
      const expiresFrom = req.query.expires_from || null;
      const expiresTo = req.query.expires_to || null;

      // Validate date formats (ISO 8601)
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

      if (issuedFrom && !iso8601Regex.test(issuedFrom)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format for issued_from. Expected ISO 8601 format (e.g., 2024-01-01T00:00:00Z)'
        });
      }

      if (issuedTo && !iso8601Regex.test(issuedTo)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format for issued_to. Expected ISO 8601 format (e.g., 2024-01-01T00:00:00Z)'
        });
      }

      if (expiresFrom && !iso8601Regex.test(expiresFrom)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format for expires_from. Expected ISO 8601 format (e.g., 2024-01-01T00:00:00Z)'
        });
      }

      if (expiresTo && !iso8601Regex.test(expiresTo)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format for expires_to. Expected ISO 8601 format (e.g., 2024-01-01T00:00:00Z)'
        });
      }

      // Validate date ranges
      if (issuedFrom && issuedTo) {
        const fromDate = new Date(issuedFrom);
        const toDate = new Date(issuedTo);
        if (fromDate > toDate) {
          return res.status(400).json({
            success: false,
            error: 'issued_from must be before or equal to issued_to'
          });
        }
      }

      if (expiresFrom && expiresTo) {
        const fromDate = new Date(expiresFrom);
        const toDate = new Date(expiresTo);
        if (fromDate > toDate) {
          return res.status(400).json({
            success: false,
            error: 'expires_from must be before or equal to expires_to'
          });
        }
      }

      // Enforce parameter limits
      const safeLimit = Math.min(Math.max(1, limit), 100);
      const safeOffset = Math.max(0, offset);

      // Query active tokens from database
      const result = await databaseService.getActiveTokens({
        applicationId,
        limit: safeLimit,
        offset: safeOffset,
        issuedFrom,
        issuedTo,
        expiresFrom,
        expiresTo
      });

      // Calculate if there are more results
      const hasMore = (result.offset + result.limit) < result.total;

      // Return success response
      return res.status(200).json({
        success: true,
        data: {
          tokens: result.tokens,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            hasMore
          }
        }
      });

    } catch (error) {
      console.error('Error listing active tokens:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve active tokens'
      });
    }
  }

  /**
   * Revoke a specific token by its jti
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async revokeToken(req, res) {
    try {
      const { jti, reason } = req.body;

      // Validate jti type first
      if (jti !== undefined && typeof jti !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'jti must be a string'
        });
      }

      // Validate jti is required and not empty
      if (!jti || jti.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'jti is required'
        });
      }

      // Validate reason type if provided
      if (reason !== undefined && typeof reason !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'reason must be a string'
        });
      }

      // Revoke token in database
      const result = await databaseService.revokeTokenById(jti, reason);

      // Check if token was found
      if (!result.success && result.notFound) {
        return res.status(404).json({
          success: false,
          error: 'Token not found'
        });
      }

      // Log revocation event
      try {
        await databaseService.logEvent(
          'token_revoked',
          result.token.application_id,
          req.ip || 'unknown',
          req.get('user-agent') || 'unknown',
          {
            admin_username: req.admin?.username,
            jti,
            reason
          }
        );
      } catch (logError) {
        // Log error but don't fail the request
        console.error('Error logging token revocation:', logError);
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Token revoked successfully',
        data: {
          jti: result.token.jti,
          revoked_at: result.token.revoked_at
        }
      });

    } catch (error) {
      console.error('Error revoking token:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to revoke token'
      });
    }
  }

  /**
   * Revoke all tokens for an application
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async revokeAllTokens(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Validate id format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid application ID format'
        });
      }

      // Validate reason if provided
      if (reason !== undefined) {
        if (typeof reason !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'reason must be a string'
          });
        }

        if (reason.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'reason cannot be empty'
          });
        }
      }

      // Retrieve application by ID
      const application = await databaseService.getApplicationById(id);

      // Check if application exists
      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'Application not found'
        });
      }

      // Revoke all active tokens for this application
      const tokensRevoked = await databaseService.revokeAllTokensForApplication(
        application.app_id,
        reason
      );

      // Log bulk revocation event
      try {
        await databaseService.logEvent(
          'tokens_bulk_revoked',
          application.app_id,
          req.ip || 'unknown',
          req.get('user-agent') || 'unknown',
          {
            admin_username: req.admin?.username,
            tokens_revoked: tokensRevoked,
            reason
          }
        );
      } catch (logError) {
        console.error('Error logging bulk token revocation:', logError);
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'All tokens revoked successfully',
        data: {
          tokens_revoked: tokensRevoked
        }
      });

    } catch (error) {
      console.error('Error revoking all tokens:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to revoke tokens'
      });
    }
  }

  /**
   * Change master password for an application
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async changePassword(req, res) {
    try {
      const { id } = req.params;
      const { current_master_password, new_master_password } = req.body;

      // Validate id format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid application ID format'
        });
      }

      // Validate current_master_password
      if (!current_master_password || typeof current_master_password !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'current_master_password is required'
        });
      }

      // Validate new_master_password
      if (!new_master_password || typeof new_master_password !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'new_master_password is required'
        });
      }

      // Validate new password strength (min 12 chars)
      if (new_master_password.length < 12) {
        return res.status(400).json({
          success: false,
          error: 'new_master_password must be at least 12 characters'
        });
      }

      // Retrieve application by ID
      const application = await databaseService.getApplicationById(id);

      // Check if application exists
      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'Application not found'
        });
      }

      // Verify current password against stored hash
      const isPasswordValid = await passwordService.verifyPassword(
        current_master_password,
        application.master_password_hash
      );

      if (!isPasswordValid) {
        // Log failed password change attempt
        try {
          await databaseService.logEvent(
            'master_password_change_failed',
            application.app_id,
            req.ip || 'unknown',
            req.get('user-agent') || 'unknown',
            {
              admin_username: req.admin?.username,
              reason: 'incorrect_current_password'
            }
          );
        } catch (logError) {
          console.error('Error logging failed password change:', logError);
        }

        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password with Argon2
      const newPasswordHash = await passwordService.hashPassword(new_master_password);

      // Update master_password_hash in database
      await databaseService.updateMasterPasswordHash(id, newPasswordHash);

      // Revoke ALL active tokens for this application
      const tokensRevoked = await databaseService.revokeAllTokensForApplication(application.app_id, 'master_password_changed');

      // Log password change event
      try {
        await databaseService.logEvent(
          'master_password_changed',
          application.app_id,
          req.ip || 'unknown',
          req.get('user-agent') || 'unknown',
          {
            admin_username: req.admin?.username,
            tokens_revoked: tokensRevoked
          }
        );
      } catch (logError) {
        console.error('Error logging password change:', logError);
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Master password changed successfully. All active tokens have been revoked.',
        data: {
          tokens_revoked: tokensRevoked
        }
      });

    } catch (error) {
      console.error('Error changing master password:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to change master password'
      });
    }
  }
}

// Export singleton instance
module.exports = new ApplicationController();
