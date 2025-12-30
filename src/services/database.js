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
   * - application_created: Application created by admin
   * - application_updated: Application updated by admin
   * - application_deleted: Application deleted by admin
   * - master_password_changed: Master password changed by admin
   * - master_password_change_failed: Master password change failed
   * - tokens_bulk_revoked: All tokens revoked for an application
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

  /**
   * Creates a new application with master password
   * @param {Object} params - Application creation parameters
   * @param {string} params.app_name - Name of the application
   * @param {string} params.master_password_hash - Hashed master password (Argon2)
   * @returns {Promise<Object>} Created application with plain app_secret
   * @throws {Error} If database operation fails
   */
  async createApplication({ app_name, master_password_hash }) {
    try {
      const crypto = require('crypto');
      const { v4: uuidv4 } = require('uuid');
      const passwordService = require('./password');

      // Validate inputs
      if (!app_name || typeof app_name !== 'string') {
        throw new Error('Invalid app_name provided');
      }

      if (!master_password_hash || typeof master_password_hash !== 'string') {
        throw new Error('Invalid master_password_hash provided');
      }

      // Generate unique app_id (UUID-based)
      const uuid = uuidv4();
      const app_id = `app-${uuid.split('-')[0]}`;

      // Generate random 32-byte app_secret
      const plain_app_secret = crypto.randomBytes(32).toString('hex');

      // Hash the app_secret for storage
      const app_secret_hash = await passwordService.hashPassword(plain_app_secret);

      // Insert into database
      const { data, error } = await supabase
        .from('applications')
        .insert({
          app_id,
          app_name,
          app_secret: app_secret_hash,
          master_password_hash,
          is_active: true
        })
        .select('id, app_id, app_name, is_active, created_at, updated_at')
        .single();

      if (error) {
        throw error;
      }

      // Return application with plain secret (one-time only)
      return {
        ...data,
        plain_app_secret,
        app_secret_hash
      };
    } catch (error) {
      console.error('Error creating application:', error);
      throw new Error('Failed to create application');
    }
  }

  /**
   * Updates an existing application
   * @param {string} id - Application UUID
   * @param {Object} updates - Fields to update
   * @param {string} [updates.app_name] - New application name
   * @param {boolean} [updates.is_active] - New active status
   * @returns {Promise<Object|null>} Updated application or null if not found
   * @throws {Error} If database operation fails
   */
  async updateApplication(id, updates) {
    try {
      // Validate id
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid application ID provided');
      }

      // Validate updates object
      if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        throw new Error('No update fields provided');
      }

      // Build update object with only allowed fields
      const updateData = {};
      if (updates.app_name !== undefined) {
        updateData.app_name = updates.app_name;
      }
      if (updates.is_active !== undefined) {
        updateData.is_active = updates.is_active;
      }

      // Add updated_at timestamp
      updateData.updated_at = new Date().toISOString();

      // Update in database
      const { data, error } = await supabase
        .from('applications')
        .update(updateData)
        .eq('id', id)
        .select('id, app_id, app_name, is_active, created_at, updated_at')
        .single();

      if (error) {
        // If no row found, return null
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating application:', error);
      throw new Error('Failed to update application');
    }
  }

  /**
   * Deletes an application (soft delete by setting is_active to false)
   * @param {string} id - Application UUID
   * @returns {Promise<Object|null>} Deleted application or null if not found
   * @throws {Error} If database operation fails
   */
  async deleteApplication(id) {
    try {
      // Validate id
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid application ID provided');
      }

      // Soft delete by setting is_active to false
      const { data, error } = await supabase
        .from('applications')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('id, app_id, app_name, is_active, created_at, updated_at')
        .single();

      if (error) {
        // If no row found, return null
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error deleting application:', error);
      throw new Error('Failed to delete application');
    }
  }

  /**
   * Retrieves an application by its UUID
   * @param {string} id - Application UUID
   * @returns {Promise<Object|null>} Application object or null if not found
   * @throws {Error} If database operation fails
   */
  async getApplicationById(id) {
    try {
      // Validate id
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid application ID provided');
      }

      const { data, error} = await supabase
        .from('applications')
        .select('id, app_id, app_name, is_active, created_at, updated_at')
        .eq('id', id)
        .single();

      if (error) {
        // If no row found, return null
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error retrieving application by ID:', error);
      throw new Error('Failed to retrieve application');
    }
  }

  /**
   * Updates the master password hash for an application
   * @param {string} id - Application UUID
   * @param {string} newPasswordHash - New hashed password (Argon2)
   * @returns {Promise<boolean>} Success status
   * @throws {Error} If database operation fails
   */
  async updateMasterPasswordHash(id, newPasswordHash) {
    try {
      // Validate inputs
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid application ID provided');
      }

      if (!newPasswordHash || typeof newPasswordHash !== 'string') {
        throw new Error('Invalid password hash provided');
      }

      const { error } = await supabase
        .from('applications')
        .update({
          master_password_hash: newPasswordHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error updating master password hash:', error);
      throw new Error('Failed to update master password hash');
    }
  }

  /**
   * Revokes all active tokens for a specific application
   * @param {string} appId - Application ID (app_id, not UUID)
   * @param {string} [reason] - Optional reason for revocation (defaults to 'bulk_revocation')
   * @returns {Promise<number>} Number of tokens revoked
   * @throws {Error} If database operation fails
   */
  async revokeAllTokensForApplication(appId, reason = 'bulk_revocation') {
    try {
      // Validate appId
      if (!appId || typeof appId !== 'string') {
        throw new Error('Invalid application ID provided');
      }

      // Get all non-revoked tokens for this application
      const { data: tokens, error: selectError } = await supabase
        .from('tokens')
        .select('jti, expires_at')
        .eq('application_id', appId)
        .gt('expires_at', new Date().toISOString());

      if (selectError) {
        throw selectError;
      }

      // If no tokens found, return 0
      if (!tokens || tokens.length === 0) {
        return 0;
      }

      // Prepare revocation records
      const revocationRecords = tokens.map(token => ({
        jti: token.jti,
        expires_at: token.expires_at,
        reason: reason || 'bulk_revocation',
        revoked_at: new Date().toISOString()
      }));

      // Insert revocation records
      const { error: insertError } = await supabase
        .from('revoked_tokens')
        .insert(revocationRecords);

      if (insertError) {
        throw insertError;
      }

      return tokens.length;
    } catch (error) {
      console.error('Error revoking tokens for application:', error);
      throw new Error('Failed to revoke tokens');
    }
  }

  /**
   * Revokes a specific token by its jti
   * @param {string} jti - JWT ID to revoke
   * @param {string} [reason] - Optional reason for revocation
   * @returns {Promise<Object>} Result object with success status and token info
   * @throws {Error} If database operation fails
   */
  async revokeTokenById(jti, reason = undefined) {
    try {
      // Validate jti
      if (!jti || typeof jti !== 'string') {
        throw new Error('Invalid JTI provided');
      }

      // Check if token exists in audit_logs (login_success events)
      const { data: loginEvent, error: selectError } = await supabase
        .from('audit_logs')
        .select('details, application_id, created_at')
        .eq('event_type', 'login_success')
        .filter('details->>jti', 'eq', jti)
        .single();

      if (selectError) {
        // If token not found
        if (selectError.code === 'PGRST116') {
          return {
            success: false,
            notFound: true
          };
        }
        throw selectError;
      }

      // Check if already revoked
      const { data: revokedToken } = await supabase
        .from('revoked_tokens')
        .select('jti, revoked_at')
        .eq('jti', jti)
        .single();

      // If already revoked, return success with flag
      if (revokedToken) {
        return {
          success: true,
          alreadyRevoked: true,
          token: {
            jti,
            application_id: loginEvent.application_id,
            revoked_at: revokedToken.revoked_at
          }
        };
      }

      // Extract expires_at from login event details
      const expiresAt = loginEvent.details?.expires_at || null;

      // Insert into revoked_tokens table
      const { error: insertError } = await supabase
        .from('revoked_tokens')
        .insert({
          jti,
          expires_at: expiresAt,
          reason: reason || null,
          revoked_at: new Date().toISOString()
        });

      if (insertError) {
        // If duplicate (race condition), consider it success
        if (insertError.code === '23505') {
          return {
            success: true,
            alreadyRevoked: true,
            token: {
              jti,
              application_id: loginEvent.application_id,
              revoked_at: new Date().toISOString()
            }
          };
        }
        throw insertError;
      }

      return {
        success: true,
        token: {
          jti,
          application_id: loginEvent.application_id,
          revoked_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error revoking token by ID:', error);
      throw new Error('Failed to revoke token');
    }
  }

  /**
   * Retrieves all active tokens with optional filtering and pagination
   * Active tokens are login events from audit_logs that are NOT in revoked_tokens
   * @param {Object} params - Query parameters
   * @param {string} [params.applicationId] - Filter by application ID (optional)
   * @param {number} [params.limit=50] - Maximum results per page (max 100)
   * @param {number} [params.offset=0] - Number of results to skip
   * @returns {Promise<Object>} Query results with tokens array and pagination info
   * @throws {Error} If database query fails
   */
  async getActiveTokens({
    applicationId = null,
    limit = 50,
    offset = 0,
    issuedFrom = null,
    issuedTo = null,
    expiresFrom = null,
    expiresTo = null
  } = {}) {
    try {
      // Enforce limits
      const safeLimit = Math.min(Math.max(1, limit), 100);
      const safeOffset = Math.max(0, offset);

      // Build query to get login_success events from audit_logs
      let query = supabase
        .from('audit_logs')
        .select('details, created_at', { count: 'exact' })
        .eq('event_type', 'login_success');

      // Apply application filter if provided
      if (applicationId) {
        query = query.eq('application_id', applicationId);
      }

      // Apply sorting (newest first)
      query = query.order('created_at', { ascending: false });

      // Note: Date filtering on JSONB fields must be done post-fetch
      // Fetch more records to account for filtering
      const fetchLimit = (issuedFrom || issuedTo || expiresFrom || expiresTo)
        ? Math.min(safeLimit * 5, 500) // Fetch 5x more for filtering
        : safeLimit;

      // Apply pagination
      const rangeEnd = safeOffset + fetchLimit - 1;
      query = query.range(0, rangeEnd); // Fetch from start for filtering

      // Execute query
      const { data: loginEvents, error, count } = await query;

      if (error) {
        throw error;
      }

      // Extract token info from login events and apply filters
      let tokens = [];

      for (const event of loginEvents || []) {
        const details = event.details || {};
        const jti = details.jti;

        // Skip if no jti
        if (!jti) continue;

        // Check if token is revoked
        const { data: revokedToken, error: revokeError } = await supabase
          .from('revoked_tokens')
          .select('jti')
          .eq('jti', jti)
          .single();

        // Skip revoked tokens (if found in revoked_tokens table)
        if (revokedToken) continue;

        // Skip if revoke check failed (for reasons other than "not found")
        if (revokeError && revokeError.code !== 'PGRST116') {
          console.error('Error checking revocation status:', revokeError);
          continue;
        }

        // Apply date filters
        const tokenIssuedAt = details.issued_at;
        const tokenExpiresAt = details.expires_at;

        // Filter by issued_from
        if (issuedFrom && tokenIssuedAt) {
          if (new Date(tokenIssuedAt) < new Date(issuedFrom)) {
            continue;
          }
        }

        // Filter by issued_to
        if (issuedTo && tokenIssuedAt) {
          if (new Date(tokenIssuedAt) > new Date(issuedTo)) {
            continue;
          }
        }

        // Filter by expires_from
        if (expiresFrom && tokenExpiresAt) {
          if (new Date(tokenExpiresAt) < new Date(expiresFrom)) {
            continue;
          }
        }

        // Filter by expires_to
        if (expiresTo && tokenExpiresAt) {
          if (new Date(tokenExpiresAt) > new Date(expiresTo)) {
            continue;
          }
        }

        // Token passed all filters, add to results
        tokens.push({
          jti: jti,
          application_id: details.application_id || null,
          issued_at: tokenIssuedAt || null,
          expires_at: tokenExpiresAt || null,
          ip_address: details.ip_address || null
        });
      }

      // Apply pagination after filtering
      const paginatedTokens = tokens.slice(safeOffset, safeOffset + safeLimit);

      return {
        tokens: paginatedTokens,
        total: tokens.length,
        limit: safeLimit,
        offset: safeOffset
      };
    } catch (error) {
      console.error('Error retrieving active tokens:', error);
      throw new Error('Failed to retrieve active tokens');
    }
  }

  /**
   * Retrieves dashboard statistics for admin overview
   * Calculates various metrics including application counts, token counts,
   * and activity metrics for the last 24 hours
   * @returns {Promise<Object>} Dashboard statistics object
   * @throws {Error} If database query fails
   */
  async getDashboardStats() {
    try {
      // Calculate 24 hours ago timestamp
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 1. Get total applications count
      const { count: totalApps, error: totalAppsError } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true });

      if (totalAppsError) {
        throw totalAppsError;
      }

      // 2. Get active applications count
      const { count: activeApps, error: activeAppsError } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (activeAppsError) {
        throw activeAppsError;
      }

      // 3. Get total active tokens count (login_success events not in revoked_tokens)
      const { data: loginEvents, error: loginError } = await supabase
        .from('audit_logs')
        .select('details')
        .eq('event_type', 'login_success');

      if (loginError) {
        throw loginError;
      }

      // Count active tokens by checking which are not revoked
      let activeTokensCount = 0;
      for (const event of loginEvents || []) {
        const jti = event.details?.jti;
        if (!jti) continue;

        const { error: revokeError } = await supabase
          .from('revoked_tokens')
          .select('jti')
          .eq('jti', jti)
          .single();

        // If not found in revoked_tokens, it's active
        if (revokeError && revokeError.code === 'PGRST116') {
          activeTokensCount++;
        }
      }

      // 4. Get failed logins in last 24 hours
      const { count: failedLogins, error: failedError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'login_failed')
        .gte('created_at', twentyFourHoursAgo);

      if (failedError) {
        throw failedError;
      }

      // 5. Get successful logins in last 24 hours
      const { count: successfulLogins, error: successError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'login_success')
        .gte('created_at', twentyFourHoursAgo);

      if (successError) {
        throw successError;
      }

      // 6. Get token validations in last 24 hours
      const { count: tokenValidations, error: validationError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'token_validation_success')
        .gte('created_at', twentyFourHoursAgo);

      if (validationError) {
        throw validationError;
      }

      // 7. Get recent activity (last 10 events)
      const { data: recentActivity, error: activityError } = await supabase
        .from('audit_logs')
        .select('id, event_type, application_id, ip_address, user_agent, details, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (activityError) {
        throw activityError;
      }

      return {
        total_applications: totalApps || 0,
        active_applications: activeApps || 0,
        total_active_tokens: activeTokensCount,
        failed_logins_24h: failedLogins || 0,
        successful_logins_24h: successfulLogins || 0,
        token_validations_24h: tokenValidations || 0,
        recent_activity: recentActivity || []
      };
    } catch (error) {
      console.error('Error retrieving dashboard stats:', error);
      throw new Error('Failed to retrieve dashboard stats');
    }
  }

  /**
   * Retrieves analytics for a specific application
   * @param {string} applicationId - Application UUID
   * @param {string} dateRange - Date range (7d, 30d, 90d)
   * @returns {Promise<Object|null>} Analytics object or null if application not found
   * @throws {Error} If database query fails
   */
  async getApplicationAnalytics(applicationId, dateRange = '30d') {
    try {
      // Validate inputs
      if (!applicationId || typeof applicationId !== 'string') {
        throw new Error('Invalid application ID provided');
      }

      // Validate date range
      const validRanges = ['7d', '30d', '90d'];
      if (!validRanges.includes(dateRange)) {
        throw new Error('Invalid date range');
      }

      // First check if application exists
      const { data: app, error: appError } = await supabase
        .from('applications')
        .select('id, app_id')
        .eq('id', applicationId)
        .single();

      if (appError) {
        if (appError.code === 'PGRST116') {
          return null;
        }
        throw appError;
      }

      // Calculate date range
      const days = parseInt(dateRange);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Get app_id for querying logs
      const appId = app.app_id;

      // 1. Get login success count
      const { count: loginSuccessCount, error: loginSuccessError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'login_success')
        .eq('application_id', appId)
        .gte('created_at', startDate);

      if (loginSuccessError) {
        throw loginSuccessError;
      }

      // 2. Get login failed count
      const { count: loginFailedCount, error: loginFailedError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'login_failed')
        .eq('application_id', appId)
        .gte('created_at', startDate);

      if (loginFailedError) {
        throw loginFailedError;
      }

      // 3. Get active token count (login_success events not in revoked_tokens)
      const { data: loginEvents, error: loginError } = await supabase
        .from('audit_logs')
        .select('details')
        .eq('event_type', 'login_success')
        .eq('application_id', appId);

      if (loginError) {
        throw loginError;
      }

      let activeTokenCount = 0;
      for (const event of loginEvents || []) {
        const jti = event.details?.jti;
        if (!jti) continue;

        const { error: revokeError } = await supabase
          .from('revoked_tokens')
          .select('jti')
          .eq('jti', jti)
          .single();

        // If not found in revoked_tokens, it's active
        if (revokeError && revokeError.code === 'PGRST116') {
          activeTokenCount++;
        }
      }

      // 4. Get token validations count
      const { count: tokenValidationsCount, error: validationError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'token_validation_success')
        .eq('application_id', appId)
        .gte('created_at', startDate);

      if (validationError) {
        throw validationError;
      }

      // 5. Get most recent activity
      const { data: recentActivity } = await supabase
        .from('audit_logs')
        .select('created_at')
        .eq('application_id', appId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const mostRecentActivity = recentActivity ? recentActivity.created_at : null;

      // 6. Calculate peak usage times (group by hour)
      const { data: allEvents, error: eventsError } = await supabase
        .from('audit_logs')
        .select('created_at')
        .eq('application_id', appId)
        .gte('created_at', startDate);

      if (eventsError) {
        throw eventsError;
      }

      // Group events by hour
      const hourCounts = {};
      for (const event of allEvents || []) {
        const hour = new Date(event.created_at).getUTCHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }

      // Convert to array and sort by count (descending)
      const peakUsageTimes = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 peak hours

      return {
        login_success_count: loginSuccessCount || 0,
        login_failed_count: loginFailedCount || 0,
        active_token_count: activeTokenCount,
        token_validations_count: tokenValidationsCount || 0,
        most_recent_activity: mostRecentActivity,
        peak_usage_times: peakUsageTimes
      };
    } catch (error) {
      console.error('Error retrieving application analytics:', error);
      throw new Error('Failed to retrieve application analytics');
    }
  }
}

// Export singleton instance
module.exports = new DatabaseService();
