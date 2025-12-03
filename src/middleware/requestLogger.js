const logger = require('../config/logger');

/**
 * Request Logging Middleware
 * Logs all incoming requests and their responses
 */
const requestLogger = (req, res, next) => {
  // Capture request start time
  const startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Capture original end function
  const originalEnd = res.end;

  // Override res.end to log response
  res.end = function (chunk, encoding) {
    // Calculate response time
    const duration = Date.now() - startTime;

    // Restore original end function
    res.end = originalEnd;

    // Call original end function
    res.end(chunk, encoding);

    // Log response
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  };

  next();
};

module.exports = { requestLogger };
