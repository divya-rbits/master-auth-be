const databaseService = require('../services/database');
const NodeCache = require('node-cache');

// Initialize cache with 5 minute TTL (300 seconds)
const dashboardCache = new NodeCache({ stdTTL: 300 });

/**
 * Admin Dashboard Controller
 * Handles requests for dashboard statistics and metrics
 */
class AdminDashboardController {
  /**
   * Get dashboard statistics
   * Cached for 5 minutes to reduce database load
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getStats(req, res, next) {
    try {
      const cacheKey = 'dashboard_stats';

      // Check if stats are in cache
      const cachedStats = dashboardCache.get(cacheKey);
      if (cachedStats) {
        return res.status(200).json({
          success: true,
          data: cachedStats
        });
      }

      // Get dashboard statistics from database service
      const stats = await databaseService.getDashboardStats();

      // Store in cache for 5 minutes
      dashboardCache.set(cacheKey, stats);

      // Send response
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      // Pass error to error handler middleware
      throw error;
    }
  }

  /**
   * Get application analytics
   * Cached for 5 minutes to reduce database load
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getApplicationAnalytics(req, res, next) {
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

      // Validate and normalize date_range parameter
      let dateRange = req.query.date_range || '30d';
      const validRanges = ['7d', '30d', '90d'];

      if (typeof dateRange !== 'string' || !validRanges.includes(dateRange)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date_range. Must be one of: 7d, 30d, 90d'
        });
      }

      // Check cache
      const cacheKey = `app_analytics_${applicationId}_${dateRange}`;
      const cachedAnalytics = dashboardCache.get(cacheKey);
      if (cachedAnalytics) {
        return res.status(200).json({
          success: true,
          data: cachedAnalytics
        });
      }

      // Get analytics from database service
      const analytics = await databaseService.getApplicationAnalytics(applicationId, dateRange);

      // Check if application was found
      if (analytics === null) {
        return res.status(404).json({
          success: false,
          error: 'Application not found'
        });
      }

      // Store in cache for 5 minutes
      dashboardCache.set(cacheKey, analytics);

      // Send response
      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      // Pass error to error handler middleware
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AdminDashboardController();
