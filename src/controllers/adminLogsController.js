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
      const parsedLimit = parseInt(limitParam, 10);
      const parsedOffset = parseInt(offsetParam, 10);

      // Ensure positive values or defaults
      const limit = (parsedLimit > 0) ? parsedLimit : 50;
      const offset = (parsedOffset >= 0) ? parsedOffset : 0;

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

  /**
   * Export audit logs in JSON or CSV format
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async exportLogs(req, res, next) {
    try {
      // Parse query parameters (same as getLogs)
      const {
        event_type: eventType = null,
        application_id: applicationId = null,
        start_date: startDate = null,
        end_date: endDate = null,
        limit: limitParam = '50',
        offset: offsetParam = '0',
        format = 'json'
      } = req.query;

      // Validate format parameter
      const normalizedFormat = format.toLowerCase();
      if (normalizedFormat !== 'json' && normalizedFormat !== 'csv') {
        return res.status(400).json({
          success: false,
          error: 'Invalid format parameter. Supported formats: json, csv'
        });
      }

      // Parse and validate pagination parameters
      const parsedLimit = parseInt(limitParam, 10);
      const parsedOffset = parseInt(offsetParam, 10);

      // Ensure positive values or defaults
      const limit = (parsedLimit > 0) ? parsedLimit : 50;
      const offset = (parsedOffset >= 0) ? parsedOffset : 0;

      // Query audit logs
      const result = await databaseService.queryAuditLogs({
        eventType,
        applicationId,
        startDate,
        endDate,
        limit,
        offset
      });

      // Export based on format
      if (normalizedFormat === 'json') {
        // JSON export
        res.set('Content-Type', 'application/json');
        res.set('Content-Disposition', 'attachment; filename=audit-logs.json');
        return res.status(200).send(JSON.stringify(result.logs, null, 2));
      } else {
        // CSV export
        const csv = this._convertLogsToCSV(result.logs);
        res.set('Content-Type', 'text/csv');
        res.set('Content-Disposition', 'attachment; filename=audit-logs.csv');
        return res.status(200).send(csv);
      }
    } catch (error) {
      // Pass error to error handler middleware
      throw error;
    }
  }

  /**
   * Convert logs array to CSV format
   * @param {Array} logs - Array of log objects
   * @returns {string} CSV formatted string
   * @private
   */
  _convertLogsToCSV(logs) {
    // CSV header
    const header = 'id,event_type,application_id,ip_address,user_agent,details,created_at\n';

    // If no logs, return just header
    if (!logs || logs.length === 0) {
      return header;
    }

    // Convert each log to CSV row
    const rows = logs.map(log => {
      const fields = [
        log.id,
        log.event_type,
        log.application_id,
        log.ip_address,
        log.user_agent,
        log.details ? JSON.stringify(log.details) : '',
        log.created_at
      ];

      // Escape and quote fields as needed
      return fields.map(field => this._escapeCSVField(field)).join(',');
    });

    return header + rows.join('\n') + '\n';
  }

  /**
   * Escape and quote CSV field if necessary
   * @param {*} field - Field value to escape
   * @returns {string} Escaped field value
   * @private
   */
  _escapeCSVField(field) {
    // Handle null/undefined
    if (field === null || field === undefined) {
      return '';
    }

    // Convert to string
    const value = String(field);

    // Check if field needs quoting (contains comma, quote, or newline)
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      // Escape quotes by doubling them
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    }

    return value;
  }
}

// Export singleton instance
module.exports = new AdminLogsController();
