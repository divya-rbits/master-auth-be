# Integration Guide

## Overview

This guide provides step-by-step instructions for integrating the Master Password Authentication API into your application. It includes code examples for different platforms and best practices for secure token management.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication Flow](#authentication-flow)
3. [Platform-Specific Examples](#platform-specific-examples)
4. [Token Storage Best Practices](#token-storage-best-practices)
5. [Error Handling](#error-handling)
6. [Security Considerations](#security-considerations)
7. [Testing](#testing)

---

## Quick Start

### Prerequisites

- API endpoint URL (e.g., `http://localhost:3001`)
- Master password
- Application ID

### Basic Integration Steps

1. **Login** - Authenticate with master password
2. **Store Token** - Securely store the JWE token and salt
3. **Validate** - Validate token on subsequent requests
4. **Refresh** - Refresh token before expiration
5. **Logout** - Revoke token when user logs out

---

## Authentication Flow

### Complete Flow Diagram

```
┌─────────┐                                    ┌─────────────┐
│ Client  │                                    │   API       │
└────┬────┘                                    └──────┬──────┘
     │                                                │
     │  1. POST /api/auth/login                      │
     │    { password, application_id }               │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  2. { token, salt }                           │
     │<───────────────────────────────────────────────┤
     │                                                │
     │  Store token & salt securely                  │
     │                                                │
     │  3. POST /api/auth/validate                   │
     │    { token, salt }                            │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  4. { valid: true, payload, ... }             │
     │<───────────────────────────────────────────────┤
     │                                                │
     │  5. POST /api/auth/refresh (before expiry)    │
     │    { token, salt }                            │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  6. { token: new_token, salt: new_salt }      │
     │<───────────────────────────────────────────────┤
     │                                                │
     │  7. POST /api/auth/logout                     │
     │    { token, salt }                            │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  8. { success: true }                         │
     │<───────────────────────────────────────────────┤
     │                                                │
```

---

## Platform-Specific Examples

### Web Application (JavaScript/TypeScript)

#### 1. Create Authentication Service

```javascript
// authService.js
class AuthService {
  constructor(apiBaseUrl, applicationId) {
    this.apiBaseUrl = apiBaseUrl;
    this.applicationId = applicationId;
  }

  async login(password) {
    const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        application_id: this.applicationId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const { token, salt } = await response.json();

    // Store in secure storage
    this.storeToken(token, salt);

    return { token, salt };
  }

  async validate() {
    const { token, salt } = this.getToken();

    if (!token || !salt) {
      throw new Error('No token found');
    }

    const response = await fetch(`${this.apiBaseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, salt })
    });

    if (!response.ok) {
      const error = await response.json();

      // If token expired, try to refresh
      if (error.error && error.error.includes('expired')) {
        return await this.refresh();
      }

      throw new Error(error.error || 'Validation failed');
    }

    const result = await response.json();
    return result;
  }

  async refresh() {
    const { token, salt } = this.getToken();

    const response = await fetch(`${this.apiBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, salt })
    });

    if (!response.ok) {
      // Refresh failed, clear tokens and redirect to login
      this.clearToken();
      throw new Error('Session expired. Please login again.');
    }

    const { token: newToken, salt: newSalt } = await response.json();

    // Store new token
    this.storeToken(newToken, newSalt);

    return { token: newToken, salt: newSalt };
  }

  async logout() {
    const { token, salt } = this.getToken();

    if (token && salt) {
      await fetch(`${this.apiBaseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, salt })
      });
    }

    this.clearToken();
  }

  // Storage methods
  storeToken(token, salt) {
    // Use httpOnly cookies in production for better security
    sessionStorage.setItem('auth_token', token);
    sessionStorage.setItem('auth_salt', salt);
  }

  getToken() {
    return {
      token: sessionStorage.getItem('auth_token'),
      salt: sessionStorage.getItem('auth_salt')
    };
  }

  clearToken() {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_salt');
  }

  isAuthenticated() {
    const { token, salt } = this.getToken();
    return !!(token && salt);
  }
}

// Usage
const authService = new AuthService('http://localhost:3001', 'web-app-001');

export default authService;
```

#### 2. Login Component

```javascript
// LoginComponent.js
import authService from './authService';

async function handleLogin(event) {
  event.preventDefault();

  const password = document.getElementById('password').value;

  try {
    await authService.login(password);

    // Redirect to dashboard
    window.location.href = '/dashboard';
  } catch (error) {
    console.error('Login error:', error);
    alert(error.message);
  }
}

// HTML
/*
<form onsubmit="handleLogin(event)">
  <input type="password" id="password" required />
  <button type="submit">Login</button>
</form>
*/
```

#### 3. Protected Route Middleware

```javascript
// authMiddleware.js
import authService from './authService';

async function requireAuth() {
  if (!authService.isAuthenticated()) {
    window.location.href = '/login';
    return false;
  }

  try {
    await authService.validate();
    return true;
  } catch (error) {
    console.error('Authentication error:', error);
    window.location.href = '/login';
    return false;
  }
}

// Usage in your app
window.addEventListener('DOMContentLoaded', async () => {
  const isProtectedRoute = window.location.pathname !== '/login';

  if (isProtectedRoute) {
    const authenticated = await requireAuth();
    if (!authenticated) return;
  }

  // Load page content
  loadPageContent();
});
```

#### 4. Auto-Refresh Token

```javascript
// tokenRefreshService.js
import authService from './authService';

class TokenRefreshService {
  constructor(checkInterval = 60000) { // Check every 60 seconds
    this.checkInterval = checkInterval;
    this.intervalId = null;
  }

  start() {
    this.intervalId = setInterval(() => this.checkAndRefresh(), this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async checkAndRefresh() {
    try {
      const result = await authService.validate();

      // Refresh if less than 5 minutes remaining
      if (result.expiresIn < 300) {
        console.log('Token expiring soon, refreshing...');
        await authService.refresh();
      }
    } catch (error) {
      console.error('Token refresh check failed:', error);
      // Let normal validation flow handle this
    }
  }
}

// Start auto-refresh when user logs in
const tokenRefreshService = new TokenRefreshService();

export default tokenRefreshService;
```

---

### React Application

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const API_BASE = 'http://localhost:3001';
const APP_ID = 'react-app-001';

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    validateToken();
  }, []);

  const login = async (password: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, application_id: APP_ID })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const { token, salt } = await response.json();

      sessionStorage.setItem('token', token);
      sessionStorage.setItem('salt', salt);

      setAuthState({ isAuthenticated: true, loading: false, error: null });
    } catch (error: any) {
      setAuthState({ isAuthenticated: false, loading: false, error: error.message });
    }
  };

  const validateToken = async () => {
    const token = sessionStorage.getItem('token');
    const salt = sessionStorage.getItem('salt');

    if (!token || !salt) {
      setAuthState({ isAuthenticated: false, loading: false, error: null });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, salt })
      });

      if (!response.ok) throw new Error('Invalid token');

      setAuthState({ isAuthenticated: true, loading: false, error: null });
    } catch (error) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('salt');
      setAuthState({ isAuthenticated: false, loading: false, error: null });
    }
  };

  const logout = async () => {
    const token = sessionStorage.getItem('token');
    const salt = sessionStorage.getItem('salt');

    if (token && salt) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, salt })
      });
    }

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('salt');
    setAuthState({ isAuthenticated: false, loading: false, error: null });
  };

  return { ...authState, login, logout, validateToken };
};
```

```typescript
// components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
```

---

### Node.js Backend

```javascript
// services/authClient.js
const fetch = require('node-fetch');

class AuthClient {
  constructor(apiBaseUrl, applicationId, masterPassword) {
    this.apiBaseUrl = apiBaseUrl;
    this.applicationId = applicationId;
    this.masterPassword = masterPassword;
    this.token = null;
    this.salt = null;
  }

  async authenticate() {
    const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: this.masterPassword,
        application_id: this.applicationId
      })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const { token, salt } = await response.json();
    this.token = token;
    this.salt = salt;

    return { token, salt };
  }

  async validateToken() {
    if (!this.token || !this.salt) {
      await this.authenticate();
    }

    const response = await fetch(`${this.apiBaseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: this.token,
        salt: this.salt
      })
    });

    if (!response.ok) {
      // Token invalid, re-authenticate
      await this.authenticate();
      return this.validateToken();
    }

    const result = await response.json();
    return result;
  }

  getAuthToken() {
    return { token: this.token, salt: this.salt };
  }
}

module.exports = AuthClient;
```

```javascript
// Usage in Express middleware
const AuthClient = require('./services/authClient');

const authClient = new AuthClient(
  process.env.AUTH_API_URL,
  process.env.APPLICATION_ID,
  process.env.MASTER_PASSWORD
);

// Middleware to validate requests
const authenticateRequest = async (req, res, next) => {
  try {
    await authClient.validateToken();
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication required' });
  }
};

app.use('/api/protected', authenticateRequest, protectedRoutes);
```

---

### Mobile App (React Native)

```javascript
// services/AuthService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthService {
  constructor(apiBaseUrl, applicationId) {
    this.apiBaseUrl = apiBaseUrl;
    this.applicationId = applicationId;
  }

  async login(password) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          application_id: this.applicationId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store securely
      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('auth_salt', data.salt);

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async validate() {
    const token = await AsyncStorage.getItem('auth_token');
    const salt = await AsyncStorage.getItem('auth_salt');

    if (!token || !salt) {
      throw new Error('No token found');
    }

    const response = await fetch(`${this.apiBaseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, salt })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Validation failed');
    }

    return data;
  }

  async logout() {
    const token = await AsyncStorage.getItem('auth_token');
    const salt = await AsyncStorage.getItem('auth_salt');

    if (token && salt) {
      await fetch(`${this.apiBaseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, salt })
      });
    }

    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_salt');
  }

  async isAuthenticated() {
    const token = await AsyncStorage.getItem('auth_token');
    return !!token;
  }
}

export default new AuthService('http://192.168.1.100:3001', 'mobile-app-001');
```

---

## Token Storage Best Practices

### Web Applications

#### ✅ Recommended: httpOnly Cookies

```javascript
// Backend sets httpOnly cookie
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict',
  maxAge: 3600000 // 1 hour
});
```

**Benefits:**
- Not accessible via JavaScript
- Protected from XSS attacks
- Automatically sent with requests

#### ⚠️ Alternative: sessionStorage

```javascript
// Store in sessionStorage (cleared on tab close)
sessionStorage.setItem('auth_token', token);
sessionStorage.setItem('auth_salt', salt);
```

**Benefits:**
- Isolated per tab
- Cleared when tab closes
- Simple implementation

**Drawbacks:**
- Accessible via JavaScript
- Vulnerable to XSS

#### ❌ Not Recommended: localStorage

- Persists across sessions
- Higher XSS risk
- Use only if session persistence is required

### Mobile Applications

#### ✅ Recommended: Secure Storage

```javascript
// React Native
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('auth_token', token);
const token = await SecureStore.getItemAsync('auth_token');
```

```swift
// iOS - Keychain
let keychain = KeychainSwift()
keychain.set(token, forKey: "auth_token")
```

```kotlin
// Android - EncryptedSharedPreferences
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val encryptedPrefs = EncryptedSharedPreferences.create(
    context,
    "auth_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

encryptedPrefs.edit().putString("auth_token", token).apply()
```

---

## Error Handling

### Comprehensive Error Handler

```javascript
class APIError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.statusCode = statusCode;
    this.response = response;
  }
}

async function apiRequest(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new APIError(
        data.error || 'Request failed',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.statusCode) {
        case 400:
          console.error('Validation error:', error.message);
          break;
        case 401:
          console.error('Authentication error:', error.message);
          // Redirect to login
          window.location.href = '/login';
          break;
        case 429:
          console.error('Rate limited:', error.message);
          // Show retry message
          break;
        case 500:
          console.error('Server error:', error.message);
          // Show error message
          break;
      }
    }
    throw error;
  }
}
```

---

## Security Considerations

### 1. HTTPS Only in Production

```javascript
const apiBaseUrl = process.env.NODE_ENV === 'production'
  ? 'https://api.yourapp.com'
  : 'http://localhost:3001';
```

### 2. Never Log Sensitive Data

```javascript
// ❌ Bad
console.log('Token:', token);

// ✅ Good
console.log('Token received, length:', token.length);
```

### 3. Clear Tokens on Logout

```javascript
async function logout() {
  await authService.logout();

  // Clear all storage
  sessionStorage.clear();
  localStorage.clear();

  // Redirect
  window.location.href = '/login';
}
```

### 4. Implement CSRF Protection

```javascript
// Include CSRF token in requests
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

fetch('/api/auth/login', {
  headers: {
    'X-CSRF-Token': csrfToken
  }
});
```

### 5. Validate Token on App Start

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await authService.validate();
  } catch (error) {
    // Token invalid, redirect to login
    window.location.href = '/login';
  }
});
```

---

## Testing

### Unit Tests

```javascript
// authService.test.js
import authService from './authService';

describe('AuthService', () => {
  beforeEach(() => {
    authService.clearToken();
    global.fetch = jest.fn();
  });

  test('login stores token and salt', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'test-token', salt: 'test-salt' })
    });

    await authService.login('password123');

    expect(sessionStorage.getItem('auth_token')).toBe('test-token');
    expect(sessionStorage.getItem('auth_salt')).toBe('test-salt');
  });

  test('logout clears tokens', async () => {
    sessionStorage.setItem('auth_token', 'test-token');
    sessionStorage.setItem('auth_salt', 'test-salt');

    await authService.logout();

    expect(sessionStorage.getItem('auth_token')).toBeNull();
    expect(sessionStorage.getItem('auth_salt')).toBeNull();
  });
});
```

### Integration Tests

```javascript
// integration.test.js
describe('Authentication Flow', () => {
  test('complete authentication flow', async () => {
    // Login
    const loginResult = await authService.login('testpassword');
    expect(loginResult.token).toBeDefined();

    // Validate
    const validateResult = await authService.validate();
    expect(validateResult.valid).toBe(true);

    // Refresh
    const refreshResult = await authService.refresh();
    expect(refreshResult.token).toBeDefined();

    // Logout
    await authService.logout();
    expect(authService.isAuthenticated()).toBe(false);
  });
});
```

---

## FAQ

### Q: How long do tokens last?

A: Tokens expire after 1 hour by default. Use the refresh endpoint before expiration.

### Q: Can I use the same token across multiple devices?

A: Yes, but each device should store its own copy securely.

### Q: What happens if my token is revoked?

A: Validation will fail with a 401 error. You must login again to get a new token.

### Q: How do I handle token refresh automatically?

A: Implement a background service that checks token expiration and refreshes before it expires (see Auto-Refresh Token example above).

### Q: Should I store the master password?

A: No, never store the master password. Only store the generated tokens.

---

## Next Steps

- Review [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete API reference
- Check [ERROR_CODES.md](ERROR_CODES.md) for error handling details
- See [AUDIT_LOGGING.md](AUDIT_LOGGING.md) for logging information
- Test your integration using Swagger UI at `/api-docs`

---

## Support

For issues or questions:
- Check existing documentation
- Review audit logs for debugging
- Test endpoints using Swagger UI
