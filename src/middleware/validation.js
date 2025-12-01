/**
 * Request Validation Middleware
 * Validates incoming requests before they reach controllers
 */

/**
 * Checks if a value is a non-empty string
 * @param {*} value - Value to check
 * @returns {boolean} - True if value is a non-empty string
 */
const isNonEmptyString = (value) => {
  return typeof value === 'string' && value.trim().length > 0;
};

/**
 * Creates a validation error response
 * @param {Response} res - Express response object
 * @param {string} fieldName - Name of the field that failed validation
 */
const validationError = (res, fieldName) => {
  return res.status(400).json({
    success: false,
    error: `${fieldName} is required`
  });
};

/**
 * Validates login request
 * Required fields: password, application_id
 */
const validateLogin = (req, res, next) => {
  const { password, application_id } = req.body;

  // Validate password
  if (!isNonEmptyString(password)) {
    return validationError(res, 'password');
  }

  // Validate application_id
  if (!isNonEmptyString(application_id)) {
    return validationError(res, 'application_id');
  }

  next();
};

/**
 * Validates token request (used for validate, logout, refresh endpoints)
 * Required fields: token, salt
 */
const validateTokenRequest = (req, res, next) => {
  const { token, salt } = req.body;

  // Validate token
  if (!isNonEmptyString(token)) {
    return validationError(res, 'token');
  }

  // Validate salt
  if (!isNonEmptyString(salt)) {
    return validationError(res, 'salt');
  }

  next();
};

/**
 * Validates token status request
 * Required fields: salt
 * Optional: token (can be in body or Authorization header)
 */
const validateTokenStatus = (req, res, next) => {
  // Extract token from Authorization header (Bearer format) or request body
  let token = req.body.token;
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  const { salt } = req.body;

  // Validate token (from either body or header)
  if (!isNonEmptyString(token)) {
    return validationError(res, 'token');
  }

  // Validate salt
  if (!isNonEmptyString(salt)) {
    return validationError(res, 'salt');
  }

  next();
};

/**
 * Validates revoke token request
 * Required fields: requestingToken, requestingSalt, targetToken, targetSalt
 */
const validateRevokeToken = (req, res, next) => {
  const { requestingToken, requestingSalt, targetToken, targetSalt } = req.body;

  // Validate requestingToken
  if (!isNonEmptyString(requestingToken)) {
    return validationError(res, 'requestingToken');
  }

  // Validate requestingSalt
  if (!isNonEmptyString(requestingSalt)) {
    return validationError(res, 'requestingSalt');
  }

  // Validate targetToken
  if (!isNonEmptyString(targetToken)) {
    return validationError(res, 'targetToken');
  }

  // Validate targetSalt
  if (!isNonEmptyString(targetSalt)) {
    return validationError(res, 'targetSalt');
  }

  next();
};

module.exports = {
  validateLogin,
  validateTokenRequest,
  validateTokenStatus,
  validateRevokeToken
};
