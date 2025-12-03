const supabase = require('../config/supabase');

/**
 * Database Service - Handles all interactions with Supabase tables
 * Provides methods for password management, token revocation,
 * application verification, and audit logging
 */
class DatabaseService {
  /**
   * Retrieves the master password hash for a specific application
   * @param {string} applicationId - The application ID to get the password hash for
   * @returns {Promise<string|null>} The password hash or null if not found
   * @throws {Error} If database query fails or applicationId is invalid
   */
  async getPasswordHash(applicationId) {
    try {
      if (!applicationId || typeof applicationId !== 'string') {
        throw new Error('Invalid application ID provided');
      }

      const { data, error } = await supabase
        .from('applications')
        .select('master_password_hash')
        .eq('app_id', applicationId)
        .eq('is_active', true)
        .single();

      if (error) {
        // If no row exists, return null instead of throwing
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data ? data.master_password_hash : null;
    } catch (error) {
      console.error('Error fetching password hash:', error);
      throw new Error('Failed to retrieve password hash');
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
   * - admin_login_success: Admin successfully logged in
   * - admin_login_failed: Admin login failed
   * - admin_logout: Admin logged out
   *
   * @param {string} eventType - Type of event (login_success, login_failed, etc.)
   * @param {string} applicationId - ID of the application (or admin username for admin events)
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

  /**
   * Retrieves all applications with pagination and sorting
   * Excludes sensitive fields (master_password_hash, app_secret)
   * @param {Object} params - Query parameters
   * @param {number} [params.limit=50] - Maximum results per page (max 100)
   * @param {number} [params.offset=0] - Number of results to skip
   * @param {string} [params.sortBy='created_at'] - Field to sort by (name, created_at)
   * @param {string} [params.order='desc'] - Sort order (asc, desc)
   * @returns {Promise<Object>} Query results with applications array and pagination info
   * @throws {Error} If database query fails
   */
  async getAllApplications({
    limit = 50,
    offset = 0,
    sortBy = 'created_at',
    order = 'desc'
  } = {}) {
    try {
      // Enforce limits
      const safeLimit = Math.min(Math.max(1, limit), 100);
      const safeOffset = Math.max(0, offset);

      // Validate sortBy field
      const validSortFields = ['name', 'created_at'];
      const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';

      // Map 'name' to 'app_name' for database column
      const dbSortField = safeSortBy === 'name' ? 'app_name' : safeSortBy;

      // Validate order
      const safeOrder = order === 'asc' ? 'asc' : 'desc';
      const ascending = safeOrder === 'asc';

      // Build query - select only non-sensitive fields
      let query = supabase
        .from('applications')
        .select('id, app_id, app_name, is_active, created_at, updated_at', { count: 'exact' });

      // Apply sorting
      query = query.order(dbSortField, { ascending });

      // Apply pagination
      const rangeEnd = safeOffset + safeLimit - 1;
      query = query.range(safeOffset, rangeEnd);

      // Execute query
      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        applications: data || [],
        total: count || 0,
        limit: safeLimit,
        offset: safeOffset
      };
    } catch (error) {
      console.error('Error retrieving applications:', error);
      throw new Error('Failed to retrieve applications');
    }
  }
}

// Export singleton instance
module.exports = new DatabaseService();
