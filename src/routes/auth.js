const express = require('express');
const authController = require('../controllers/authController');
const { loginLimiter, validateLimiter } = require('../middleware/rateLimiter');
const {
  validateLogin,
  validateTokenRequest,
  validateTokenStatus,
  validateRevokeToken
} = require('../middleware/validation');

const router = express.Router();

// Authentication routes
router.post('/login', loginLimiter, validateLogin, authController.login.bind(authController));
router.post('/validate', validateLimiter, validateTokenRequest, authController.validate.bind(authController));
router.post('/logout', validateTokenRequest, authController.logout.bind(authController));
router.post('/refresh', validateTokenRequest, authController.refresh.bind(authController));

// Token management routes
router.get('/token/status', validateTokenStatus, authController.tokenStatus.bind(authController));
router.post('/token/revoke', validateRevokeToken, authController.revokeToken.bind(authController));

module.exports = router;
