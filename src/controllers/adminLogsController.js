const databaseService = require('../services/database');

/**
 * Admin Logs Controller
 * Handles requests for querying audit logs
 */
class AdminLogsController {
  /**
   * Get audit logs with optional filters and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getLogs(req, res, next) {
    try {
      // Parse query parameters
      const {
        event_type: eventType = null,
        application_id: applicationId = null,
        start_date: startDate = null,
        end_date: endDate = null,
        limit: limitParam = '50',
        offset: offsetParam = '0'
      } = req.query;

      // Parse and validate pagination parameters
      const limit = parseInt(limitParam, 10) || 50;
      const offset = parseInt(offsetParam, 10) || 0;

      // Query audit logs
      const result = await databaseService.queryAuditLogs({
        eventType,
        applicationId,
        startDate,
        endDate,
        limit,
        offset
      });

      // Calculate if there are more results
      const hasMore = (result.offset + result.limit) < result.total;

      // Send response
      res.status(200).json({
        success: true,
        data: {
          logs: result.logs,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            hasMore
          }
        }
      });
    } catch (error) {
      // Pass error to error handler middleware
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AdminLogsController();
