# Third-Party Application Integration Guide

## Overview

This guide explains how to integrate Master Password Authentication as a middleware for any third-party application. This allows your application to delegate authentication to the Master Password system, where users enter their master password to generate tokens for accessing your application.

**Key Concept:** Your application does NOT handle token generation or password verification. Instead, you redirect users to the Master Password frontend, which generates tokens. Your application only needs to verify tokens with the backend API.

---

## Your Architecture Setup

Based on your deployment configuration:

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Server PC                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Master Auth Backend                                         │
│  └─ localhost:3000                                           │
│                                                               │
│  3rd Party App Backend (transcriptdetective)                 │
│  └─ localhost:4000                                           │
│                                                               │
│  Admin Panel Frontend (localhost only - not exposed)         │
│  └─ localhost:3001                                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
        ▲                            ▲
        │                            │
        │ (via Cloudflare tunnel)    │ (via Cloudflare tunnel)
        │                            │
┌───────┴────────┐          ┌────────┴──────────┐
│ Master Frontend│          │ 3rd Party Frontend │
│ Domain         │          │ Domain             │
└────────────────┘          └────────────────────┘
masterfrontend              transcriptdetective
.reversebits.tech           .reversebits.tech
```

**Key Points:**
- Master Auth Backend runs on `localhost:3000` on your server
- 3rd Party App Frontend is exposed via Cloudflare tunnel
- 3rd Party App Frontend can directly call `localhost:3000` (same machine)
- Master Password Frontend exposed via Cloudflare tunnel
- Admin Panel stays on `localhost:3001` (not exposed - only accessible on server)

---

## Integration Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  User Browser                                                 │
│                                                                │
│  1. Visits: transcriptdetective.reversebits.tech              │
│     Check localStorage for token                              │
│                                                                │
│  2. No token? Redirect to:                                    │
│     masterfrontend.reversebits.tech                           │
│                                                                │
│  3. Enter master password                                     │
│     Frontend calls localhost:3000 (via Cloudflare)            │
│     Gets token back                                           │
│                                                                │
│  4. Redirected back with token:                               │
│     transcriptdetective.reversebits.tech?token=...            │
│                                                                │
│  5. Store token in localStorage                               │
│                                                                │
│  6. Validate token by calling:                                │
│     localhost:3000/api/auth/validate (via Cloudflare)         │
│     Directly from browser JavaScript                          │
│                                                                │
│  7. If valid: Access granted                                  │
│     If invalid: Redirect back to masterfrontend               │
└──────────────────────────────────────────────────────────────┘
```

**Important:** Token validation happens **client-side** (from browser JavaScript) by calling the Master Auth Backend API directly. This is possible because both frontends and the backend are on the same server, just exposed through Cloudflare tunnels.

---

## Prerequisites

Before integrating, you need:

1. **Application Registration** - Use Admin Panel (localhost:3001) to register your application
2. **Application Credentials** - Note your `app_id` from the admin panel
3. **CORS Configuration** - Master Auth Backend must whitelist your domain
4. **Cloudflare Tunnel** - Configure tunnel to route to localhost:3000

---

## Environment Variables

### For Your 3rd Party Frontend (transcriptdetective.reversebits.tech)

```env
# Master Password Authentication
VITE_MASTER_AUTH_BACKEND_URL=http://localhost:3000
VITE_MASTER_PASSWORD_FRONTEND_URL=https://masterfrontend.reversebits.tech
VITE_APPLICATION_ID=app-transcriptdetective

# Your application's callback URL
VITE_APP_CALLBACK_URL=https://transcriptdetective.reversebits.tech/auth/callback
```

**Note:** `VITE_MASTER_AUTH_BACKEND_URL` is `localhost:3000` because your frontend runs on the same server as the backend. Cloudflare tunnel routes the domain to your server, then the frontend makes localhost API calls.

---

## Step 1: Check for Existing Token on Page Load

When a user visits your application, first check if they already have a valid token.

### Example Implementation (React/Vite)

```jsx
// src/App.jsx
import { useEffect, useState } from 'react';
import { validateToken } from './services/auth';

const MASTER_PASSWORD_FRONTEND_URL = import.meta.env.VITE_MASTER_PASSWORD_FRONTEND_URL;
const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID;
const APP_CALLBACK_URL = import.meta.env.VITE_APP_CALLBACK_URL;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  async function checkAuthentication() {
    // Get token from localStorage
    const token = localStorage.getItem('auth_token');

    if (!token) {
      // No token - redirect to Master Password frontend
      redirectToLogin();
      return;
    }

    // Token exists - validate it
    try {
      const isValid = await validateToken(token);

      if (isValid) {
        setIsAuthenticated(true);
        setIsLoading(false);
      } else {
        // Token invalid - clear and redirect
        localStorage.removeItem('auth_token');
        redirectToLogin();
      }
    } catch (error) {
      console.error('Token validation error:', error);
      // On error, redirect to login
      redirectToLogin();
    }
  }

  function redirectToLogin() {
    const redirectUrl = `${MASTER_PASSWORD_FRONTEND_URL}/login?` +
      `app_id=${encodeURIComponent(APPLICATION_ID)}` +
      `&redirect_uri=${encodeURIComponent(APP_CALLBACK_URL)}`;

    window.location.href = redirectUrl;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="app">
      <h1>Welcome to Transcript Detective</h1>
      {/* Your app content */}
    </div>
  );
}
```

---

## Step 2: Implement Token Validation (Client-Side)

Create a service to validate tokens by calling the Master Auth Backend API directly from the browser.

### Token Validation Service

```javascript
// src/services/auth.js
const MASTER_AUTH_BACKEND_URL = import.meta.env.VITE_MASTER_AUTH_BACKEND_URL;

/**
 * Validate authentication token with Master Auth Backend
 * Called directly from browser (client-side)
 * @param {string} token - JWE token to validate
 * @returns {Promise<boolean>} - True if valid, false otherwise
 */
export async function validateToken(token) {
  try {
    const response = await fetch(`${MASTER_AUTH_BACKEND_URL}/api/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      console.error('Token validation failed:', response.status);
      return false;
    }

    const data = await response.json();
    return data.success && data.valid;

  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Get current authentication token from localStorage
 * @returns {string|null} - Token or null if not found
 */
export function getToken() {
  return localStorage.getItem('auth_token');
}

/**
 * Store authentication token in localStorage
 * @param {string} token - Token to store
 * @param {string} expiresAt - ISO timestamp when token expires
 */
export function storeToken(token, expiresAt) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('token_expires_at', expiresAt);
}

/**
 * Clear authentication token from localStorage
 */
export function clearToken() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('token_expires_at');
  localStorage.removeItem('session_id');
}

/**
 * Check if token is expired based on stored expiry time
 * @returns {boolean} - True if expired
 */
export function isTokenExpired() {
  const expiresAt = localStorage.getItem('token_expires_at');
  if (!expiresAt) return true;

  return new Date(expiresAt) <= new Date();
}
```

---

## Step 3: Handle Callback with Token

After successful authentication, the Master Password frontend will redirect back to your application with the token.

### Callback Route Handler

```jsx
// src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { validateToken, storeToken } from '../services/auth';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    // Get token from URL query parameters
    const token = searchParams.get('token');
    const sessionId = searchParams.get('session_id');
    const expiresAt = searchParams.get('expires_at');

    if (!token) {
      console.error('No token in callback');
      // Redirect back to login
      window.location.href = getLoginUrl();
      return;
    }

    // Validate token immediately
    try {
      const isValid = await validateToken(token);

      if (!isValid) {
        console.error('Invalid token received');
        alert('Authentication failed. Please try again.');
        window.location.href = getLoginUrl();
        return;
      }

      // Token valid - store it
      storeToken(token, expiresAt);
      if (sessionId) {
        localStorage.setItem('session_id', sessionId);
      }

      // Redirect to dashboard or home
      navigate('/dashboard', { replace: true });

    } catch (error) {
      console.error('Token validation error:', error);
      alert('Authentication error. Please try again.');
      window.location.href = getLoginUrl();
    }
  }

  function getLoginUrl() {
    const MASTER_PASSWORD_FRONTEND_URL = import.meta.env.VITE_MASTER_PASSWORD_FRONTEND_URL;
    const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID;
    const APP_CALLBACK_URL = import.meta.env.VITE_APP_CALLBACK_URL;

    return `${MASTER_PASSWORD_FRONTEND_URL}/login?` +
      `app_id=${encodeURIComponent(APPLICATION_ID)}` +
      `&redirect_uri=${encodeURIComponent(APP_CALLBACK_URL)}`;
  }

  return (
    <div>
      <p>Authenticating...</p>
    </div>
  );
}
```

### Route Configuration (React Router)

```jsx
// src/main.jsx or App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Other routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Step 4: Protect Routes with Authentication

Create a wrapper component to protect routes that require authentication.

### Protected Route Component

```jsx
// src/components/ProtectedRoute.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateToken, getToken, isTokenExpired, clearToken } from '../services/auth';

const MASTER_PASSWORD_FRONTEND_URL = import.meta.env.VITE_MASTER_PASSWORD_FRONTEND_URL;
const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID;
const APP_CALLBACK_URL = import.meta.env.VITE_APP_CALLBACK_URL;

export default function ProtectedRoute({ children }) {
  const [isValid, setIsValid] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const token = getToken();

    // No token
    if (!token) {
      redirectToLogin();
      return;
    }

    // Check expiry first (avoid unnecessary API call)
    if (isTokenExpired()) {
      clearToken();
      redirectToLogin();
      return;
    }

    // Validate with backend
    try {
      const valid = await validateToken(token);

      if (valid) {
        setIsValid(true);
      } else {
        clearToken();
        redirectToLogin();
      }
    } catch (error) {
      console.error('Auth check error:', error);
      redirectToLogin();
    }
  }

  function redirectToLogin() {
    const redirectUrl = `${MASTER_PASSWORD_FRONTEND_URL}/login?` +
      `app_id=${encodeURIComponent(APPLICATION_ID)}` +
      `&redirect_uri=${encodeURIComponent(APP_CALLBACK_URL)}`;

    window.location.href = redirectUrl;
  }

  if (isValid === null) {
    return <div>Loading...</div>;
  }

  return children;
}
```

### Usage in Routes

```jsx
// src/App.jsx
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';

<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

---

## Step 5: Implement Logout

To log users out, revoke their token and clear localStorage.

### Logout Implementation

```javascript
// src/services/auth.js (add this function)

/**
 * Logout user by revoking token and clearing storage
 */
export async function logout() {
  const token = getToken();

  if (token) {
    try {
      // Revoke token via backend API
      await fetch(`${MASTER_AUTH_BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });
    } catch (error) {
      console.error('Token revocation error:', error);
      // Continue with logout even if revocation fails
    }
  }

  // Clear all auth data
  clearToken();

  // Redirect to home or login
  window.location.href = '/';
}
```

### Logout Button Component

```jsx
// src/components/LogoutButton.jsx
import { logout } from '../services/auth';

export default function LogoutButton() {
  async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  }

  return (
    <button onClick={handleLogout} className="logout-btn">
      Logout
    </button>
  );
}
```

---

## CORS Configuration Required

Since your frontend will call the backend API directly from the browser, you **MUST** configure CORS on the Master Auth Backend.

### Backend CORS Setup (Already Done)

The backend should whitelist your domain in `src/middleware/cors.js`:

```javascript
const allowedOrigins = [
  'http://localhost:5173',  // Local development
  'http://localhost:3001',  // Admin panel
  'https://masterfrontend.reversebits.tech',
  'https://transcriptdetective.reversebits.tech'  // ← Your domain
];
```

**Verify this is configured** before testing your integration.

---

## Complete Integration Example

Here's a complete example showing all pieces together:

### Project Structure

```
transcriptdetective-frontend/
├── src/
│   ├── services/
│   │   └── auth.js              # Token validation & storage
│   ├── components/
│   │   ├── ProtectedRoute.jsx   # Route protection
│   │   └── LogoutButton.jsx     # Logout component
│   ├── pages/
│   │   ├── AuthCallback.jsx     # Handle callback
│   │   ├── Dashboard.jsx        # Protected page
│   │   └── Home.jsx             # Public page
│   ├── App.jsx                  # Main app with routes
│   └── main.jsx                 # Entry point
├── .env                         # Environment variables
└── vite.config.js               # Vite configuration
```

### Main App Component

```jsx
// src/App.jsx - Complete integration
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { validateToken, getToken, isTokenExpired, clearToken } from './services/auth';

import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import ProtectedRoute from './components/ProtectedRoute';

const MASTER_PASSWORD_FRONTEND_URL = import.meta.env.VITE_MASTER_PASSWORD_FRONTEND_URL;
const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID;
const APP_CALLBACK_URL = import.meta.env.VITE_APP_CALLBACK_URL;

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkInitialAuth();
  }, []);

  async function checkInitialAuth() {
    const token = getToken();

    if (!token || isTokenExpired()) {
      clearToken();
      setAuthChecked(true);
      return;
    }

    try {
      const valid = await validateToken(token);
      setIsAuthenticated(valid);

      if (!valid) {
        clearToken();
      }
    } catch (error) {
      console.error('Initial auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  }

  if (!authChecked) {
    return <div>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home isAuthenticated={isAuthenticated} />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Cloudflare Tunnel Configuration

Your Cloudflare tunnel should route:

```yaml
# cloudflared config.yml (example)
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # Master Password Frontend
  - hostname: masterfrontend.reversebits.tech
    service: http://localhost:5173  # or wherever master frontend runs

  # Transcript Detective Frontend
  - hostname: transcriptdetective.reversebits.tech
    service: http://localhost:5174  # or your frontend port

  # Master Auth Backend API (important!)
  - hostname: api.reversebits.tech
    service: http://localhost:3000

  # Catch-all
  - service: http_status:404
```

**Alternative:** If you want to use `localhost:3000` directly from the frontend (since they're on the same machine), you don't need a separate API domain. Just ensure your frontend build process doesn't rewrite localhost URLs.

---

## Security Considerations

### 1. Client-Side Token Validation is Safe (with caveats)

✅ **Safe because:**
- Token validation only checks if token is valid
- Backend still verifies token before granting access to resources
- Token cannot be tampered with (JWE encryption + signature)

⚠️ **Important:**
- Never expose sensitive data through the validation endpoint
- Always re-validate tokens on your backend API before accessing protected resources
- Use HTTPS in production

### 2. Token Storage in localStorage

✅ **Acceptable for your use case:**
- Tokens persist across browser restarts
- Convenient for single-page applications

⚠️ **XSS Risk:**
- If your app has XSS vulnerabilities, tokens can be stolen
- Ensure you sanitize all user inputs
- Use Content Security Policy (CSP) headers

### 3. CORS Must Be Properly Configured

```javascript
// Master Auth Backend must allow:
const allowedOrigins = [
  'https://transcriptdetective.reversebits.tech'
];
```

Without proper CORS, browser will block API calls.

---

## Testing Your Integration

### Step 1: Test Initial Redirect

1. Open browser to `https://transcriptdetective.reversebits.tech`
2. Should redirect to `https://masterfrontend.reversebits.tech/login?app_id=...`
3. URL should include your `app_id` and `redirect_uri`

### Step 2: Test Login Flow

1. Enter master password on Master Password frontend
2. Should redirect back to `https://transcriptdetective.reversebits.tech/auth/callback?token=...`
3. Check browser console - should see token being validated
4. Should redirect to dashboard

### Step 3: Test Token Persistence

1. Close browser
2. Reopen `https://transcriptdetective.reversebits.tech`
3. Should NOT redirect to login (token still valid)
4. Should go directly to dashboard

### Step 4: Test Token Validation

1. Open browser DevTools → Application → Local Storage
2. Modify the `auth_token` value (corrupt it)
3. Refresh page
4. Should redirect to login (invalid token)

### Step 5: Test Logout

1. Click logout button
2. Should clear localStorage
3. Should redirect to home/login
4. Try accessing dashboard - should redirect to login

### Manual API Testing

```bash
# Test token validation directly
curl -X POST http://localhost:3000/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"token":"your-token-here"}'
```

---

## Troubleshooting

### Issue: CORS errors in browser console

**Error:** `Access to fetch at 'http://localhost:3000/api/auth/validate' from origin 'https://transcriptdetective.reversebits.tech' has been blocked by CORS policy`

**Cause:** Backend not whitelisting your domain

**Solution:**
1. Edit `master-auth-be/src/middleware/cors.js`
2. Add your domain to `allowedOrigins` array
3. Restart backend: `npm start`

```javascript
const allowedOrigins = [
  'https://transcriptdetective.reversebits.tech'  // Add this
];
```

---

### Issue: Infinite redirect loop

**Symptom:** Browser keeps redirecting between your app and Master Password frontend

**Cause:** Token validation always failing

**Debug:**
1. Check browser console for errors
2. Test validation API directly:
   ```javascript
   fetch('http://localhost:3000/api/auth/validate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ token: 'your-token' })
   }).then(r => r.json()).then(console.log)
   ```
3. Check backend logs for errors
4. Verify `VITE_APPLICATION_ID` matches registered app

---

### Issue: "Network error" or cannot reach localhost:3000

**Cause:** Frontend build process or Cloudflare is intercepting localhost URLs

**Solutions:**

1. **Check Vite Config:** Ensure proxy is not rewriting localhost
   ```javascript
   // vite.config.js
   export default {
     // Should NOT have proxy config for localhost:3000
   }
   ```

2. **Use Cloudflare tunnel subdomain for API:**
   ```env
   # Instead of localhost, use subdomain
   VITE_MASTER_AUTH_BACKEND_URL=https://api.reversebits.tech
   ```

   Then configure Cloudflare tunnel:
   ```yaml
   ingress:
     - hostname: api.reversebits.tech
       service: http://localhost:3000
   ```

---

### Issue: Token validation succeeds but app doesn't allow access

**Cause:** Protected route logic not checking correctly

**Debug:**
```jsx
// Add logging to ProtectedRoute component
async function checkAuth() {
  const token = getToken();
  console.log('Token:', token);

  const valid = await validateToken(token);
  console.log('Validation result:', valid);

  setIsValid(valid);
}
```

---

## Admin Panel Access (localhost only)

As per your requirement, the Admin Panel runs on `localhost:3001` and is **NOT exposed via Cloudflare**.

**Access:**
- ✅ On server PC: Navigate to `http://localhost:3001`
- ❌ Remote access: Not possible (by design)

**Security Benefits:**
- Admin panel cannot be accessed from internet
- Only users with physical/SSH access to server can manage applications
- No risk of unauthorized admin access

**Managing Applications:**
1. SSH into your server or access locally
2. Open browser to `http://localhost:3001`
3. Login with admin credentials
4. Create applications, view logs, manage tokens, etc.

---

## Summary Checklist

### Prerequisites
- [ ] Registered application via Admin Panel (localhost:3001)
- [ ] Noted your `app_id` (e.g., "app-transcriptdetective")
- [ ] Configured CORS on backend to allow your domain
- [ ] Cloudflare tunnel configured for your frontend

### Implementation
- [ ] Configured environment variables (`.env`)
- [ ] Created token validation service (`auth.js`)
- [ ] Implemented callback handler (`AuthCallback.jsx`)
- [ ] Created protected route component (`ProtectedRoute.jsx`)
- [ ] Implemented logout functionality
- [ ] Added token expiration checks
- [ ] Configured routes in main app

### Testing
- [ ] Test redirect to Master Password frontend
- [ ] Test login flow end-to-end
- [ ] Test token validation (valid token)
- [ ] Test token validation (invalid/expired token)
- [ ] Test logout
- [ ] Test protected routes
- [ ] Test token persistence across browser restarts

### Production
- [ ] Verified HTTPS for all domains
- [ ] Tested CORS configuration
- [ ] Added error boundaries for auth failures
- [ ] Implemented proper loading states
- [ ] Added user-friendly error messages

---

## Differences from Server-Side Validation

Your architecture differs from traditional server-side validation:

### Traditional Approach (Server-Side)
```
Browser → Your Backend → Validate Token → Master Auth Backend → Response
```
- Token never exposed to browser
- More secure but requires backend API

### Your Approach (Client-Side)
```
Browser → Validate Token → Master Auth Backend → Response
```
- Token validation happens in browser
- Simpler architecture (no backend API needed)
- Acceptable because:
  - Both frontends and backend on same server
  - Token validation only checks validity (no sensitive data)
  - Backend still protects actual resources

**When to use which:**
- Use client-side (your approach): When frontend and backend are co-located on same server
- Use server-side: When frontend and backend are on different machines/networks

---

## Support

For integration issues:
- Test token validation in browser DevTools console
- Check CORS configuration in backend
- Verify Cloudflare tunnel is routing correctly
- Use Admin Panel (localhost:3001) to check application registration
- Check backend logs: `docker logs master-auth-backend` (or however you run it)

Once integrated, users will seamlessly authenticate through Master Password and access your application!
