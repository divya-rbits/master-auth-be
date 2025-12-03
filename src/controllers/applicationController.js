const databaseService = require('../services/database');

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
}

// Export singleton instance
module.exports = new ApplicationController();
