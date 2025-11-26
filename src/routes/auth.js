const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Authentication routes
router.post('/login', authController.login.bind(authController));
router.post('/validate', authController.validate.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));

module.exports = router;
