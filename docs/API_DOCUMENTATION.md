# API Documentation

## Overview

The Master Password Authentication API provides secure token generation and validation using JWE (JSON Web Encryption) tokens. This API is designed to serve as an authentication middleware for multiple applications.

## Base URL

```
Development: http://localhost:3001
Production: https://your-domain.com
```

## Interactive Documentation

Swagger UI is available at `/api-docs` for testing endpoints interactively.

---

## Authentication Endpoints

### POST /api/auth/login

Authenticate with master password and receive an encrypted JWE token.

**Request Body:**
```json
{
  "password": "YourSecurePassword123",
  "application_id": "web-app-001"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...",
  "salt": "randomSaltValue123",
  "message": "Login successful"
}
```

**Error Responses:**

- **400 Bad Request** - Missing required fields
```json
{
  "success": false,
  "error": "password is required"
}
```

- **401 Unauthorized** - Invalid credentials
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

- **429 Too Many Requests** - Rate limit exceeded
```json
{
  "success": false,
  "error": "Too many login requests, please try again later"
}
```

**Rate Limit:** 5 requests per minute per IP address

---

### POST /api/auth/validate

Validate an encrypted JWE token and retrieve session information.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...",
  "salt": "randomSaltValue123"
}
```

**Success Response (200):**
```json
{
  "valid": true,
  "payload": {
    "appId": "web-app-001",
    "jti": "unique-token-id-123",
    "exp": 1735200000,
    "iat": 1735196400
  },
  "sessionId": "unique-token-id-123",
  "expiresIn": 3600,
  "permissions": [],
  "message": "Token is valid"
}
```

**Error Responses:**

- **400 Bad Request** - Missing required fields
```json
{
  "valid": false,
  "error": "token is required"
}
```

- **401 Unauthorized** - Invalid or expired token
```json
{
  "valid": false,
  "error": "Token expired"
}
```

**Rate Limit:** 100 requests per minute per IP address

---

### POST /api/auth/logout

Revoke a token by adding it to the revocation list.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...",
  "salt": "randomSaltValue123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Error Responses:**

- **400 Bad Request** - Missing required fields
```json
{
  "success": false,
  "error": "token is required"
}
```

- **500 Internal Server Error**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

### POST /api/auth/refresh

Generate a new token from an existing valid token. The old token is automatically revoked.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...",
  "salt": "oldSaltValue123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...",
  "salt": "newSaltValue456",
  "message": "Token refreshed successfully"
}
```

**Error Responses:**

- **400 Bad Request** - Missing required fields
- **401 Unauthorized** - Invalid, expired, or revoked token
- **500 Internal Server Error**

---

## Token Management Endpoints

### GET /api/auth/token/status

Get detailed information about a token including validity, expiration, and revocation status.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...",
  "salt": "randomSaltValue123"
}
```

**Alternative:** Token can be provided in Authorization header:
```
Authorization: Bearer eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...
```

**Success Response (200):**
```json
{
  "valid": true,
  "status": {
    "expiresIn": 3545,
    "issuedAt": "2025-11-27T10:30:00.000Z",
    "sessionId": "unique-jti-value-123",
    "applicationId": "web-app-001",
    "revoked": false
  },
  "message": "Token is valid"
}
```

**Error Responses:**

- **400 Bad Request** - Missing required fields
- **401 Unauthorized** - Invalid, expired, or revoked token

---

### POST /api/auth/token/revoke

Revoke a specific token. Requires authentication with a valid requesting token.

**Request Body:**
```json
{
  "requestingToken": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...",
  "requestingSalt": "requestingSalt123",
  "targetToken": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...",
  "targetSalt": "targetSalt456",
  "reason": "User requested logout from all devices"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Token revoked successfully",
  "revokedTokenId": "unique-jti-value-123"
}
```

**Error Responses:**

- **400 Bad Request** - Missing required fields
- **401 Unauthorized** - Invalid requesting token
- **500 Internal Server Error**

---

## Admin Endpoints

### GET /api/admin/logs

Query audit logs with filters and pagination. Requires admin authentication.

**Authentication:** HTTP Basic Auth
```
Authorization: Basic base64(admin_email:admin_password)
```

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `event_type` | string | Filter by event type | `login_success` |
| `application_id` | string | Filter by application | `test-app` |
| `start_date` | datetime | Filter by start date (ISO 8601) | `2025-12-01T00:00:00Z` |
| `end_date` | datetime | Filter by end date (ISO 8601) | `2025-12-02T23:59:59Z` |
| `limit` | integer | Results per page (max 100) | `50` |
| `offset` | integer | Number of results to skip | `0` |

**Event Types:**
- `login_success`
- `login_failed`
- `token_validation_success`
- `token_validation_failed`
- `logout`
- `token_refresh`
- `token_revoked`
- `token_status_check`
- `token_status_check_failed`
- `rate_limit_exceeded`

**Example Request:**
```
GET /api/admin/logs?event_type=login_failed&limit=20&offset=0
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "event_type": "login_success",
        "application_id": "test-app",
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0...",
        "details": {},
        "created_at": "2025-12-02T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

**Error Responses:**

- **401 Unauthorized** - Invalid or missing credentials
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error**

**Rate Limit:** 100 requests per minute per IP address

---

## System Endpoints

### GET /health

Health check endpoint to verify the API server is running.

**Success Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-11-25T10:30:00.000Z"
}
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/auth/login | 5 requests | 1 minute |
| POST /api/auth/validate | 100 requests | 1 minute |
| GET /api/admin/logs | 100 requests | 1 minute |

When rate limit is exceeded, the API returns:
- **HTTP 429** status code
- `RateLimit-*` headers with limit information
- Error message in response body

---

## Error Codes

All error responses follow a consistent format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Or for validation errors:

```json
{
  "valid": false,
  "error": "Error message here"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Request successful |
| 400 | Bad Request | Missing or invalid request parameters |
| 401 | Unauthorized | Invalid credentials or expired token |
| 404 | Not Found | Endpoint does not exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error occurred |

See [ERROR_CODES.md](ERROR_CODES.md) for detailed error documentation.

---

## Request Headers

### Required Headers

```
Content-Type: application/json
```

### Optional Headers

```
Authorization: Bearer <token>
User-Agent: YourApp/1.0
```

---

## Response Headers

All responses include:

```
Content-Type: application/json
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

Rate-limited endpoints include:

```
RateLimit-Limit: 5
RateLimit-Remaining: 4
RateLimit-Reset: 1701234567
```

---

## Security

### HTTPS Required

All production endpoints must use HTTPS. HTTP requests will be redirected.

### CORS

CORS is configured to allow requests from authorized origins only. Configure allowed origins in environment variables.

### Token Security

- Tokens are encrypted using JWE with A256GCM
- Each token has a unique salt for key derivation
- Tokens include expiration time (default: 1 hour)
- Revoked tokens are tracked in database
- Store tokens securely (use httpOnly cookies or secure storage)

---

## Versioning

Current version: **v1.0.0**

The API uses URL path versioning:
- Current: `/api/auth/*` (v1)
- Future versions will use: `/api/v2/auth/*`

---

## Support

- **Documentation:** `/api-docs`
- **Audit Logging:** See [AUDIT_LOGGING.md](AUDIT_LOGGING.md)
- **Integration Guide:** See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- **Error Codes:** See [ERROR_CODES.md](ERROR_CODES.md)

---

## Examples

### Complete Authentication Flow

```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    password: 'YourSecurePassword123',
    application_id: 'web-app-001'
  })
});

const { token, salt } = await loginResponse.json();

// 2. Validate token
const validateResponse = await fetch('http://localhost:3001/api/auth/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, salt })
});

const { valid, payload, expiresIn } = await validateResponse.json();

// 3. Logout
const logoutResponse = await fetch('http://localhost:3001/api/auth/logout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, salt })
});
```

See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for more examples.
