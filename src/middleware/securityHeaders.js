const helmet = require('helmet');

/**
 * Security headers middleware configuration using Helmet.js
 * Implements comprehensive security headers to protect against common web vulnerabilities
 */
const securityHeadersMiddleware = helmet({
  // Content Security Policy - controls resources the browser is allowed to load
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Swagger UI
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for Swagger UI
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },

  // X-Frame-Options: DENY - prevents clickjacking attacks
  frameguard: {
    action: 'deny'
  },

  // X-Content-Type-Options: nosniff - prevents MIME type sniffing
  noSniff: true,

  // X-DNS-Prefetch-Control: off - controls browser DNS prefetching
  dnsPrefetchControl: {
    allow: false
  },

  // X-Download-Options: noopen - prevents IE from executing downloads in site context
  ieNoOpen: true,

  // Strict-Transport-Security (HSTS) - enforces HTTPS connections
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },

  // X-Permitted-Cross-Domain-Policies: none - restricts Adobe Flash/PDF cross-domain requests
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none'
  },

  // Referrer-Policy - controls referrer information
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },

  // X-XSS-Protection - legacy XSS protection (mostly deprecated but still useful)
  xssFilter: true,

  // Hide X-Powered-By header to obscure technology stack
  hidePoweredBy: true
});

module.exports = {
  securityHeadersMiddleware
};
