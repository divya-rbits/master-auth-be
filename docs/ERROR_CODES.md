# Error Codes Documentation

## Overview

This document provides detailed information about all error codes, their meanings, and how to handle them in the Master Password Authentication API.

---

## Error Response Format

All errors follow a consistent JSON structure:

### Standard Error Format
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### Validation Error Format
```json
{
  "valid": false,
  "error": "Human-readable error message"
}
```

### Detailed Error Format (Development Only)
```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "type": "ErrorType",
    "statusCode": 400,
    "details": {},
    "stack": "Error stack trace (development only)"
  }
}
```

---

## HTTP Status Codes

### 200 OK

**Meaning:** Request was successful.

**When Used:**
- Successful login
- Valid token validation
- Successful logout
- Token refreshed
- Token status retrieved
- Token revoked
- Admin logs retrieved

**Example Response:**
```json
{
  "success": true,
  "message": "Operation successful"
}
```

---

### 400 Bad Request

**Meaning:** The request contains invalid or missing parameters.

**When Used:**
- Missing required fields (password, token, salt, application_id)
- Invalid request format
- Malformed JSON

**Common Error Messages:**

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `password is required` | Missing password field | Include password in request body |
| `application_id is required` | Missing application_id | Include application_id in request body |
| `token is required` | Missing token field | Include token in request body |
| `salt is required` | Missing salt field | Include salt in request body |
| `requestingToken is required` | Missing requesting token | Include requestingToken in request body |

**Example Response:**
```json
{
  "success": false,
  "error": "password is required"
}
```

**How to Handle:**
1. Validate all required fields before making request
2. Check request body structure matches API specification
3. Ensure JSON is properly formatted

**Example Code:**
```javascript
// Validate before sending
const validateLoginRequest = (data) => {
  if (!data.password) throw new Error('password is required');
  if (!data.application_id) throw new Error('application_id is required');
};

try {
  validateLoginRequest(requestData);
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  });
} catch (error) {
  console.error('Validation error:', error.message);
}
```

---

### 401 Unauthorized

**Meaning:** Authentication failed or token is invalid.

**When Used:**
- Invalid master password
- Expired token
- Revoked token
- Tampered token
- Invalid token signature
- Invalid admin credentials

**Common Error Messages:**

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Invalid credentials` | Wrong master password | Verify password is correct |
| `Token expired` | Token past expiration time | Refresh token or login again |
| `Token has been revoked` | Token was logged out | Login again to get new token |
| `Invalid token` | Token signature invalid or corrupted | Login again to get new token |
| `Unauthorized: Invalid requesting token` | Requesting token is invalid | Use valid token for authentication |
| `Authentication required` | Admin credentials missing | Provide HTTP Basic Auth credentials |

**Example Response:**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**How to Handle:**
1. For invalid credentials: Prompt user to re-enter password
2. For expired tokens: Automatically refresh or redirect to login
3. For revoked tokens: Clear local storage and redirect to login
4. Log the user out and clear stored tokens

**Example Code:**
```javascript
const handleAuthError = async (response) => {
  if (response.status === 401) {
    const data = await response.json();

    if (data.error.includes('expired')) {
      // Try to refresh token
      await refreshToken();
    } else if (data.error.includes('revoked') || data.error.includes('Invalid')) {
      // Clear tokens and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('salt');
      window.location.href = '/login';
    }
  }
};
```

---

### 404 Not Found

**Meaning:** The requested endpoint does not exist.

**When Used:**
- Invalid API route
- Typo in endpoint URL
- Endpoint not implemented

**Example Response:**
```json
{
  "success": false,
  "error": {
    "message": "Route GET /api/auth/invalid not found",
    "type": "NotFoundError",
    "statusCode": 404
  }
}
```

**How to Handle:**
1. Check the endpoint URL for typos
2. Verify you're using the correct HTTP method (GET, POST, etc.)
3. Ensure you're using the correct API version
4. Refer to API documentation for valid endpoints

**Example Code:**
```javascript
const API_BASE = 'http://localhost:3001';
const ENDPOINTS = {
  login: '/api/auth/login',
  validate: '/api/auth/validate',
  logout: '/api/auth/logout'
};

// Use constants to avoid typos
const response = await fetch(`${API_BASE}${ENDPOINTS.login}`, {
  method: 'POST',
  // ...
});
```

---

### 429 Too Many Requests

**Meaning:** Rate limit exceeded for the endpoint.

**When Used:**
- Too many login attempts
- Too many validation requests
- Too many admin requests

**Rate Limits:**
- Login: 5 requests per minute per IP
- Validate: 100 requests per minute per IP
- Admin: 100 requests per minute per IP

**Example Response:**
```json
{
  "success": false,
  "error": "Too many login requests, please try again later"
}
```

**Response Headers:**
```
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 1701234567
```

**How to Handle:**
1. Implement exponential backoff
2. Show user-friendly error message
3. Wait until `RateLimit-Reset` timestamp
4. Cache validation results to reduce requests
5. Implement request throttling on client side

**Example Code:**
```javascript
const handleRateLimit = async (response) => {
  if (response.status === 429) {
    const resetTime = response.headers.get('RateLimit-Reset');
    const waitSeconds = resetTime - Math.floor(Date.now() / 1000);

    console.log(`Rate limited. Wait ${waitSeconds} seconds.`);

    // Show user message
    alert(`Too many requests. Please wait ${waitSeconds} seconds.`);

    // Optionally retry after waiting
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
    return retryRequest();
  }
};
```

---

### 500 Internal Server Error

**Meaning:** An unexpected error occurred on the server.

**When Used:**
- Database connection failure
- Cryptographic operation failure
- Unhandled exceptions
- Service unavailable

**Example Response:**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

**Production vs Development:**

**Production:**
- Generic error message
- No stack traces
- No sensitive details

**Development:**
- Detailed error message
- Stack trace included
- Additional debugging info

**How to Handle:**
1. Log the error for debugging
2. Show generic error message to user
3. Implement retry logic with exponential backoff
4. Contact API support if persistent

**Example Code:**
```javascript
const handleServerError = async (response, attempt = 1) => {
  if (response.status === 500) {
    console.error('Server error occurred');

    // Exponential backoff retry (max 3 attempts)
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(attempt + 1);
    }

    // Show user-friendly message
    alert('Service temporarily unavailable. Please try again later.');
  }
};
```

---

## Validation Errors

### Missing Required Fields

**Status Code:** 400

**Error Messages:**
- `password is required`
- `application_id is required`
- `token is required`
- `salt is required`
- `requestingToken is required`
- `requestingSalt is required`
- `targetToken is required`
- `targetSalt is required`

**Solution:** Ensure all required fields are included in request body.

---

### Token Validation Errors

**Status Code:** 401

**Error Messages:**
- `Token expired` - Token has passed its expiration time
- `Token has been revoked` - Token was explicitly revoked (logout)
- `Invalid token` - Token signature invalid or token corrupted
- `Token validation failed` - Generic validation failure

**Solution:** Refresh token or re-authenticate.

---

## Admin Authentication Errors

### Invalid Admin Credentials

**Status Code:** 401

**Error Message:**
```json
{
  "success": false,
  "error": {
    "message": "Authentication required",
    "statusCode": 401
  }
}
```

**Cause:**
- Missing Authorization header
- Invalid email/password combination
- Incorrect Basic Auth encoding

**Solution:**
```javascript
// Correct Basic Auth format
const credentials = btoa(`${adminEmail}:${adminPassword}`);
const response = await fetch('/api/admin/logs', {
  headers: {
    'Authorization': `Basic ${credentials}`
  }
});
```

---

## Best Practices

### 1. Always Check Status Code

```javascript
const response = await fetch('/api/auth/login', { /* ... */ });

if (!response.ok) {
  const error = await response.json();
  console.error(`Error ${response.status}:`, error);

  switch (response.status) {
    case 400:
      // Handle validation error
      break;
    case 401:
      // Handle authentication error
      break;
    case 429:
      // Handle rate limit
      break;
    case 500:
      // Handle server error
      break;
  }
}
```

### 2. Implement Retry Logic

```javascript
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) return response;

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry server errors (5xx)
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
};
```

### 3. Log Errors for Debugging

```javascript
const logError = (error, context) => {
  console.error('API Error:', {
    message: error.message || error,
    statusCode: error.statusCode,
    context,
    timestamp: new Date().toISOString()
  });
};
```

### 4. Show User-Friendly Messages

```javascript
const getUserFriendlyMessage = (error) => {
  const messages = {
    400: 'Please check your input and try again.',
    401: 'Authentication failed. Please log in again.',
    404: 'The requested resource was not found.',
    429: 'Too many requests. Please wait a moment.',
    500: 'Something went wrong. Please try again later.'
  };

  return messages[error.statusCode] || 'An unexpected error occurred.';
};
```

---

## Common Scenarios

### Scenario 1: Invalid Password

**Request:**
```json
{
  "password": "WrongPassword",
  "application_id": "web-app-001"
}
```

**Response:**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Status Code:** 401

**Handling:**
- Show error message to user
- Allow retry
- Implement account lockout after multiple failures

---

### Scenario 2: Expired Token

**Request:**
```json
{
  "token": "expired_token_here",
  "salt": "salt_here"
}
```

**Response:**
```json
{
  "valid": false,
  "error": "Token expired"
}
```

**Status Code:** 401

**Handling:**
- Attempt token refresh
- If refresh fails, redirect to login
- Clear stored tokens

---

### Scenario 3: Rate Limit Exceeded

**Request:** 6th login attempt within 1 minute

**Response:**
```json
{
  "success": false,
  "error": "Too many login requests, please try again later"
}
```

**Status Code:** 429

**Headers:**
```
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 1701234567
```

**Handling:**
- Calculate wait time from RateLimit-Reset header
- Show countdown timer to user
- Disable form submission until reset time

---

## Error Logging

All errors are logged to the audit logs system. See [AUDIT_LOGGING.md](AUDIT_LOGGING.md) for details.

**Logged Information:**
- Event type (e.g., `login_failed`, `token_validation_failed`)
- IP address
- User agent
- Timestamp
- Error reason (in details field)

**Example Audit Log Entry:**
```json
{
  "event_type": "login_failed",
  "application_id": "web-app-001",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "details": {
    "reason": "Invalid password"
  },
  "created_at": "2025-12-03T10:30:00Z"
}
```

---

## Support

For additional help:
- Review [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- Check [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- View Swagger UI at `/api-docs`
- Check audit logs for detailed error information
