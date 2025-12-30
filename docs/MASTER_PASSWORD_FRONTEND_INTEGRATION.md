# Master Password Frontend Integration Guide

## Overview

This document explains how to integrate the Master Password frontend screen with the authentication backend. The Master Password screen is the core authentication interface where users enter their master password to generate authentication tokens.

---

## Base URL

```
Production: http://localhost:3000 (exposed via Cloudflare tunnel)
Development: http://localhost:3000
```

All API endpoints are prefixed with `/api/auth`.

**Architecture Note:**
- Backend runs on `localhost:3000` on your server
- Frontend is exposed via Cloudflare tunnel at `masterfrontend.reversebits.tech`
- Frontend makes API calls to `localhost:3000` (same machine)
- Admin Panel runs on `localhost:3001` (not exposed)

---

## Required Environment Variables

Configure these in your frontend environment:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_APPLICATION_ID=your-app-id-here

# Optional: For redirecting 3rd party apps
VITE_FRONTEND_URL=https://masterfrontend.reversebits.tech
```

---

## Authentication Flow

```
1. User lands on Master Password screen
2. User enters their master password
3. Frontend calls /api/auth/login
4. Backend validates password and generates JWE token
5. Frontend stores token securely
6. Frontend redirects to authenticated area
7. Frontend validates token on subsequent requests using /api/auth/validate
```

---

## API Endpoints for Master Password Screen

### 1. Login (Generate Token)

**Endpoint:** `POST /api/auth/login`

**Purpose:** Authenticate user with master password and generate a JWE token.

**Rate Limit:** 5 requests per minute per IP address

**Request Body:**

```typescript
interface LoginRequest {
  password: string;          // Master password (required, string)
  application_id: string;    // Application ID from environment (required)
}
```

**Example Request:**

```javascript
const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    password: userEnteredPassword,
    application_id: import.meta.env.VITE_APPLICATION_ID
  })
});
```

**Success Response (200 OK):**

```typescript
interface LoginResponse {
  success: true;
  token: string;              // JWE encrypted token (store this securely)
  expiresIn: number;          // Token expiration in seconds (e.g., 3600)
  expiresAt: string;          // ISO 8601 timestamp (e.g., "2025-12-05T11:00:00Z")
  sessionId: string;          // Unique session identifier (UUID)
}
```

**Example Success Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..X3jK9mN2pQ5rS8uV.wY1zA3bC5dE7fG9hI...",
  "expiresIn": 3600,
  "expiresAt": "2025-12-05T11:00:00Z",
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error Responses:**

```typescript
// 400 Bad Request - Invalid input
{
  "success": false,
  "error": "password is required"
}

// 401 Unauthorized - Invalid password
{
  "success": false,
  "error": "Invalid master password"
}

// 429 Too Many Requests - Rate limit exceeded
{
  "success": false,
  "error": "Too many login attempts, please try again later"
}

// 500 Internal Server Error
{
  "success": false,
  "error": "Failed to generate token"
}
```

**Frontend Implementation:**

```javascript
async function handleLogin(password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        application_id: import.meta.env.VITE_APPLICATION_ID
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle error
      if (response.status === 401) {
        showError('Invalid master password');
      } else if (response.status === 429) {
        showError('Too many attempts. Please try again later.');
      } else {
        showError(data.error || 'Login failed');
      }
      return;
    }

    // Store token securely
    sessionStorage.setItem('auth_token', data.token);
    sessionStorage.setItem('session_id', data.sessionId);
    sessionStorage.setItem('token_expires_at', data.expiresAt);

    // Redirect to authenticated area
    window.location.href = '/dashboard';

  } catch (error) {
    console.error('Login error:', error);
    showError('Network error. Please check your connection.');
  }
}
```

---

### 2. Validate Token

**Endpoint:** `POST /api/auth/validate`

**Purpose:** Validate if a token is still valid and not revoked.

**Rate Limit:** 100 requests per minute per IP address

**Request Body:**

```typescript
interface ValidateRequest {
  token: string;    // JWE token to validate (required)
}
```

**Example Request:**

```javascript
const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: sessionStorage.getItem('auth_token')
  })
});
```

**Success Response (200 OK):**

```typescript
interface ValidateResponse {
  success: true;
  valid: true;
  expiresIn: number;          // Remaining seconds until expiration
  sessionId: string;          // Session identifier
  applicationId: string;      // Application ID
  permissions: string[];      // Array of permissions (if any)
}
```

**Example Success Response:**

```json
{
  "success": true,
  "valid": true,
  "expiresIn": 2850,
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "applicationId": "app-123e4567",
  "permissions": []
}
```

**Error Responses:**

```typescript
// 401 Unauthorized - Invalid or expired token
{
  "success": false,
  "valid": false,
  "error": "Token has expired"
}

// 401 Unauthorized - Revoked token
{
  "success": false,
  "valid": false,
  "error": "Token has been revoked"
}

// 400 Bad Request
{
  "success": false,
  "error": "token is required"
}

// 429 Too Many Requests
{
  "success": false,
  "error": "Too many validation requests, please try again later"
}
```

**Frontend Implementation:**

```javascript
async function validateToken() {
  const token = sessionStorage.getItem('auth_token');

  if (!token) {
    redirectToLogin();
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!response.ok || !data.valid) {
      // Token invalid - clear and redirect
      sessionStorage.clear();
      redirectToLogin();
      return false;
    }

    // Token valid
    return true;

  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

// Call validateToken() on app initialization and protected routes
```

---

### 3. Logout (Revoke Token)

**Endpoint:** `POST /api/auth/logout`

**Purpose:** Revoke the current token and end the session.

**Request Body:**

```typescript
interface LogoutRequest {
  token: string;    // JWE token to revoke (required)
}
```

**Example Request:**

```javascript
const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: sessionStorage.getItem('auth_token')
  })
});
```

**Success Response (200 OK):**

```typescript
interface LogoutResponse {
  success: true;
  message: string;    // "Logout successful"
}
```

**Example Success Response:**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Error Responses:**

```typescript
// 400 Bad Request
{
  "success": false,
  "error": "token is required"
}

// 500 Internal Server Error
{
  "success": false,
  "error": "Failed to logout"
}
```

**Frontend Implementation:**

```javascript
async function handleLogout() {
  const token = sessionStorage.getItem('auth_token');

  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    // Clear local storage regardless of response
    sessionStorage.clear();

    // Redirect to login
    window.location.href = '/login';

  } catch (error) {
    console.error('Logout error:', error);
    // Still clear and redirect
    sessionStorage.clear();
    window.location.href = '/login';
  }
}
```

---

### 4. Refresh Token (Optional)

**Endpoint:** `POST /api/auth/refresh`

**Purpose:** Extend token expiration without re-entering password.

**Request Body:**

```typescript
interface RefreshRequest {
  token: string;    // Current JWE token (required)
}
```

**Example Request:**

```javascript
const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: sessionStorage.getItem('auth_token')
  })
});
```

**Success Response (200 OK):**

```typescript
interface RefreshResponse {
  success: true;
  token: string;              // New JWE token (replace old one)
  expiresIn: number;          // New expiration in seconds
  expiresAt: string;          // New expiration timestamp
  sessionId: string;          // Session ID (same as before)
}
```

**Example Success Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..newToken...",
  "expiresIn": 3600,
  "expiresAt": "2025-12-05T12:00:00Z",
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Frontend Implementation:**

```javascript
async function refreshToken() {
  const token = sessionStorage.getItem('auth_token');

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      // Refresh failed - require re-login
      redirectToLogin();
      return false;
    }

    const data = await response.json();

    // Update stored token
    sessionStorage.setItem('auth_token', data.token);
    sessionStorage.setItem('token_expires_at', data.expiresAt);

    return true;

  } catch (error) {
    console.error('Token refresh error:', error);
    redirectToLogin();
    return false;
  }
}

// Call refreshToken() before token expires (e.g., 5 minutes before expiration)
```

---

## Token Storage Best Practices

### Recommended: `sessionStorage`

```javascript
// Store token
sessionStorage.setItem('auth_token', token);
sessionStorage.setItem('session_id', sessionId);
sessionStorage.setItem('token_expires_at', expiresAt);

// Retrieve token
const token = sessionStorage.getItem('auth_token');

// Clear on logout
sessionStorage.clear();
```

**Why sessionStorage?**
- Cleared when tab is closed (better security)
- Not accessible across different tabs
- Not persisted to disk
- Suitable for session-based authentication

### Alternative: `localStorage` (Persistent Sessions)

```javascript
localStorage.setItem('auth_token', token);
```

**Use only if:**
- You want users to stay logged in across browser restarts
- Your security model allows persistent tokens

### Security Considerations

1. **Never store tokens in cookies** (XSS vulnerability)
2. **Use HTTPS in production** (prevent token interception)
3. **Validate token on every protected route**
4. **Clear tokens on logout**
5. **Handle token expiration gracefully**

---

## Error Handling

### Comprehensive Error Handler

```javascript
async function makeAuthRequest(endpoint, body) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // Handle HTTP errors
    if (!response.ok) {
      switch (response.status) {
        case 400:
          throw new Error(data.error || 'Invalid request');
        case 401:
          throw new Error(data.error || 'Unauthorized');
        case 429:
          throw new Error('Too many requests. Please try again later.');
        case 500:
          throw new Error('Server error. Please try again.');
        default:
          throw new Error(data.error || 'Request failed');
      }
    }

    return data;

  } catch (error) {
    if (error.name === 'TypeError') {
      // Network error
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
}
```

---

## Complete Login Component Example (React)

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID;

export default function MasterPasswordLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          application_id: APPLICATION_ID
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError('Invalid master password');
        } else if (response.status === 429) {
          setError('Too many attempts. Please try again in a few minutes.');
        } else {
          setError(data.error || 'Login failed');
        }
        return;
      }

      // Store token
      sessionStorage.setItem('auth_token', data.token);
      sessionStorage.setItem('session_id', data.sessionId);
      sessionStorage.setItem('token_expires_at', data.expiresAt);

      // Redirect to dashboard
      navigate('/dashboard');

    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h1>Master Password</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">Enter Master Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master Password"
            disabled={loading}
            autoFocus
            required
          />
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || !password}>
          {loading ? 'Authenticating...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

---

## Route Protection Example

```javascript
// Protected Route Component
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ children }) {
  const [isValid, setIsValid] = useState(null);

  useEffect(() => {
    validateToken();
  }, []);

  async function validateToken() {
    const token = sessionStorage.getItem('auth_token');

    if (!token) {
      setIsValid(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      setIsValid(response.ok && data.valid);

    } catch (error) {
      console.error('Token validation error:', error);
      setIsValid(false);
    }
  }

  if (isValid === null) {
    return <div>Loading...</div>;
  }

  if (!isValid) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
```

---

## Testing the Integration

### Manual Testing with cURL

```bash
# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-master-password","application_id":"test-app"}'

# Test validation
curl -X POST http://localhost:3001/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"token":"your-jwe-token-here"}'

# Test logout
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"token":"your-jwe-token-here"}'
```

### Testing with Swagger UI

Navigate to: `http://localhost:3001/api-docs`

All authentication endpoints are documented and testable via Swagger UI.

---

## Troubleshooting

### Issue: "Invalid master password"
- **Cause:** Password doesn't match the application's stored hash
- **Solution:** Verify the password is correct for your application

### Issue: "Token has expired"
- **Cause:** Token lifetime (default 1 hour) has passed
- **Solution:** Implement token refresh or require re-login

### Issue: "Token has been revoked"
- **Cause:** Admin revoked the token or password was changed
- **Solution:** Clear storage and redirect to login

### Issue: "Too many requests"
- **Cause:** Rate limit exceeded
- **Solution:** Wait before retrying, implement exponential backoff

### Issue: CORS errors
- **Cause:** Frontend domain not whitelisted
- **Solution:** Contact admin to add your domain to CORS whitelist

---

## Support

For issues or questions:
- Check the Swagger documentation: `/api-docs`
- Review error messages in API responses
- Check browser console for network errors
- Verify environment variables are configured correctly
