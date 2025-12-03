const supabase = require('../config/supabase');

/**
 * Database Service - Handles all interactions with Supabase tables
 * Provides methods for password management, token revocation,
 * application verification, and audit logging
 */
class DatabaseService {
  /**
   * Retrieves the master password hash from auth_config table
   * @returns {Promise<string|null>} The password hash or null if not set
   * @throws {Error} If database query fails
   */
  async getPasswordHash() {
    try {
      const { data, error } = await supabase
        .from('auth_config')
        .select('password_hash')
        .eq('id', 1)
        .single();

      if (error) {
        // If no row exists yet, return null instead of throwing
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data ? data.password_hash : null;
    } catch (error) {
      console.error('Error fetching password hash:', error);
      throw new Error('Failed to retrieve password hash');
    }
  }

  /**
   * Updates or inserts the master password hash
   * @param {string} newHash - The new Argon2 password hash
   * @returns {Promise<boolean>} Success status
   * @throws {Error} If database operation fails
   */
  async updatePasswordHash(newHash) {
    try {
      if (!newHash || typeof newHash !== 'string') {
        throw new Error('Invalid password hash provided');
      }

      // Use upsert to insert or update
      const { error } = await supabase
        .from('auth_config')
        .upsert(
          {
            id: 1,
            password_hash: newHash,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        );

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error updating password hash:', error);
      throw new Error('Failed to update password hash');
    }
  }

  /**
   * Checks if a token has been revoked
   * @param {string} jti - JWT ID to check
   * @returns {Promise<boolean>} True if revoked, false otherwise
   * @throws {Error} If database query fails
   */
  async isTokenRevoked(jti) {
    try {
      if (!jti || typeof jti !== 'string') {
        throw new Error('Invalid JTI provided');
      }

      const { data, error } = await supabase
        .from('revoked_tokens')
        .select('jti')
        .eq('jti', jti)
        .single();

      if (error) {
        // If not found, token is not revoked
        if (error.code === 'PGRST116') {
          return false;
        }
        throw error;
      }

      return data !== null;
    } catch (error) {
      console.error('Error checking token revocation:', error);
      throw new Error('Failed to check token revocation status');
    }
  }

  /**
   * Adds a token to the revocation list
   * @param {string} jti - JWT ID to revoke
   * @param {Date} expiresAt - Token expiration time
   * @param {string} reason - Optional reason for revocation
   * @returns {Promise<boolean>} Success status
   * @throws {Error} If database operation fails
   */
  async revokeToken(jti, expiresAt, reason = null) {
    try {
      if (!jti || typeof jti !== 'string') {
        throw new Error('Invalid JTI provided');
      }

      if (!(expiresAt instanceof Date)) {
        throw new Error('Invalid expiration date provided');
      }

      const { error } = await supabase
        .from('revoked_tokens')
        .insert({
          jti,
          expires_at: expiresAt.toISOString(),
          reason,
          revoked_at: new Date().toISOString()
        });

      if (error) {
        // If duplicate, it's already revoked - consider this success
        if (error.code === '23505') {
          return true;
        }
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error revoking token:', error);
      throw new Error('Failed to revoke token');
    }
  }

  /**
   * Verifies application credentials
   * @param {string} appId - Application ID
   * @param {string} appSecret - Application secret (will be compared with hashed version)
   * @returns {Promise<Object|null>} Application object if valid, null otherwise
   * @throws {Error} If database query fails
   */
  async verifyApplication(appId, appSecret) {
    try {
      if (!appId || typeof appId !== 'string') {
        throw new Error('Invalid application ID provided');
      }

      if (!appSecret || typeof appSecret !== 'string') {
        throw new Error('Invalid application secret provided');
      }

      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('app_id', appId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      // Note: In production, appSecret should be hashed and compared
      // For now, we'll return the application if found and active
      // The actual secret comparison will be implemented in Phase 11
      return data;
    } catch (error) {
      console.error('Error verifying application:', error);
      throw new Error('Failed to verify application');
    }
  }

  /**
   * Helper method to create a standardized audit log entry
   * @param {Object} params - Log entry parameters
   * @param {string} params.eventType - Type of event
   * @param {string} params.applicationId - Application identifier
   * @param {string} params.ipAddress - Client IP address
   * @param {string} params.userAgent - Client user agent
   * @param {Object} params.details - Event-specific details
   * @returns {Object} Standardized log entry object
   * @private
   */
  _createLogEntry({ eventType, applicationId, ipAddress, userAgent, details = {} }) {
    return {
      event_type: eventType,
      application_id: applicationId,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: details || {},
      created_at: new Date().toISOString()
    };
  }

  /**
   * Validates audit log parameters
   * @param {string} eventType - Event type to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   * @private
   */
  _validateLogParams(eventType) {
    if (!eventType || typeof eventType !== 'string') {
      throw new Error('Invalid event type provided');
    }
    return true;
  }

  /**
   * Logs an authentication event to audit_logs
   *
   * Event Types:
   * - login_success: Successful authentication
   * - login_failed: Failed authentication attempt
   * - token_validation_success: Token validated successfully
   * - token_validation_failed: Token validation failed
   * - logout: User logged out
   * - token_refresh: Token refreshed
   * - token_revoked: Token manually revoked
   * - token_status_check: Token status checked
   * - token_status_check_failed: Token status check failed
   * - rate_limit_exceeded: Rate limit exceeded
   *
   * @param {string} eventType - Type of event (login_success, login_failed, etc.)
   * @param {string} applicationId - ID of the application
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent string
   * @param {Object} details - Additional structured data
   * @returns {Promise<boolean>} Success status
   */
  async logEvent(eventType, applicationId, ipAddress, userAgent, details = {}) {
    try {
      // Validate parameters
      this._validateLogParams(eventType);

      // Create standardized log entry
      const logEntry = this._createLogEntry({
        eventType,
        applicationId,
        ipAddress,
        userAgent,
        details
      });

      // Insert into database
      const { error } = await supabase
        .from('audit_logs')
        .insert(logEntry);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error logging event:', error);
      // Don't throw for logging errors - just log and return false
      return false;
    }
  }

  /**
   * Queries audit logs with optional filters and pagination
   * @param {Object} params - Query parameters
   * @param {string} [params.eventType] - Filter by event type
   * @param {string} [params.applicationId] - Filter by application ID
   * @param {string} [params.startDate] - Filter by start date (ISO 8601)
   * @param {string} [params.endDate] - Filter by end date (ISO 8601)
   * @param {number} [params.limit=50] - Maximum results per page (max 100)
   * @param {number} [params.offset=0] - Number of results to skip
   * @returns {Promise<Object>} Query results with logs array and pagination info
   * @throws {Error} If database query fails
   */
  async queryAuditLogs({
    eventType = null,
    applicationId = null,
    startDate = null,
    endDate = null,
    limit = 50,
    offset = 0
  } = {}) {
    try {
      // Enforce maximum limit
      const safeLimit = Math.min(Math.max(1, limit), 100);
      const safeOffset = Math.max(0, offset);

      // Start building query
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      // Apply filters
      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      if (applicationId) {
        query = query.eq('application_id', applicationId);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      // Apply sorting (newest first)
      query = query.order('created_at', { ascending: false });

      // Apply pagination
      const rangeEnd = safeOffset + safeLimit - 1;
      query = query.range(safeOffset, rangeEnd);

      // Execute query
      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        logs: data || [],
        total: count || 0,
        limit: safeLimit,
        offset: safeOffset
      };
    } catch (error) {
      console.error('Error querying audit logs:', error);
      throw new Error('Failed to query audit logs');
    }
  }
}

// Export singleton instance
module.exports = new DatabaseService();
