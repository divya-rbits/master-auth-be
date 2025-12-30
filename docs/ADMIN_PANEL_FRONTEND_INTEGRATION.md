# Admin Panel Frontend Integration Guide

## Overview

This document explains how to integrate the Admin Panel frontend with the Master Password authentication backend. The Admin Panel allows administrators to manage applications, view analytics, manage tokens, and audit logs.

---

## Base URL

```
Backend API: http://localhost:3000
Admin Panel: http://localhost:3001 (not exposed - localhost only)
```

All admin API endpoints are prefixed with `/api/admin`.

**Architecture Note:**
- Master Auth Backend runs on `localhost:3000` on your server
- Admin Panel Frontend runs on `localhost:3001` (NOT exposed via Cloudflare)
- Admin Panel is only accessible on the server PC (physical or SSH access required)
- This ensures only authorized administrators with server access can manage the system

---

## Required Environment Variables

```env
VITE_API_BASE_URL=http://localhost:3000
```

---

## Admin Authentication Flow

```
1. Admin enters username/email and password
2. Frontend calls POST /api/admin/auth/login
3. Backend validates admin credentials
4. Backend returns admin JWT token
5. Frontend stores admin token
6. Frontend includes token in Authorization header for all admin API calls
7. Token expires after 30 minutes (default)
```

---

## Authentication

### 1. Admin Login

**Endpoint:** `POST /api/admin/auth/login`

**Purpose:** Authenticate admin user and receive JWT token.

**Rate Limit:** 5 requests per 15 minutes per IP address

**Request Body:**

```typescript
interface AdminLoginRequest {
  email: string;      // Admin email/username (required)
  password: string;   // Admin password (required)
}
```

**Example Request:**

```javascript
const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'admin_password'
  })
});
```

**Success Response (200 OK):**

```typescript
interface AdminLoginResponse {
  success: true;
  token: string;        // Admin JWT token (store securely)
  expiresIn: number;    // Token expiration in seconds (1800 = 30 minutes)
  expiresAt: string;    // ISO 8601 timestamp
  user: {
    username: string;   // Admin username
  };
}
```

**Example Success Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 1800,
  "expiresAt": "2025-12-05T10:30:00Z",
  "user": {
    "username": "admin"
  }
}
```

**Error Responses:**

```typescript
// 401 Unauthorized - Invalid credentials
{
  "success": false,
  "error": "Invalid email or password"
}

// 429 Too Many Requests
{
  "success": false,
  "error": "Too many login attempts, please try again later"
}
```

**Frontend Implementation:**

```javascript
async function adminLogin(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store admin token
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_username', data.user.username);
    localStorage.setItem('admin_token_expires_at', data.expiresAt);

    return data;

  } catch (error) {
    console.error('Admin login error:', error);
    throw error;
  }
}
```

---

### 2. Admin Logout

**Endpoint:** `POST /api/admin/auth/logout`

**Purpose:** Invalidate admin session.

**Authentication Required:** Yes (Bearer token)

**Request Headers:**

```
Authorization: Bearer <admin_jwt_token>
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Frontend Implementation:**

```javascript
async function adminLogout() {
  const token = localStorage.getItem('admin_token');

  try {
    await fetch(`${API_BASE_URL}/api/admin/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Always clear local storage
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_token_expires_at');
  }
}
```

---

## Application Management

### 3. List All Applications

**Endpoint:** `GET /api/admin/applications`

**Purpose:** Retrieve all applications with pagination and sorting.

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 100 requests per minute per IP address

**Query Parameters:**

```typescript
interface ListApplicationsParams {
  limit?: number;      // Results per page (1-100, default: 50)
  offset?: number;     // Skip N results (default: 0)
  sort_by?: string;    // Field to sort by: 'name' | 'created_at' (default: 'created_at')
  order?: string;      // Sort order: 'asc' | 'desc' (default: 'desc')
}
```

**Example Request:**

```javascript
const response = await fetch(
  `${API_BASE_URL}/api/admin/applications?limit=50&offset=0&sort_by=name&order=asc`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Success Response (200 OK):**

```typescript
interface ListApplicationsResponse {
  success: true;
  data: {
    applications: Array<{
      id: string;             // UUID
      app_id: string;         // Application ID
      app_name: string;       // Application name
      is_active: boolean;     // Active status
      created_at: string;     // ISO 8601 timestamp
      updated_at: string;     // ISO 8601 timestamp
    }>;
    pagination: {
      total: number;          // Total count
      limit: number;          // Results per page
      offset: number;         // Current offset
      hasMore: boolean;       // More results available
    };
  };
}
```

**Example Success Response:**

```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "app_id": "app-123e4567",
        "app_name": "My Application",
        "is_active": true,
        "created_at": "2025-12-01T10:00:00Z",
        "updated_at": "2025-12-01T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

---

### 4. Create Application

**Endpoint:** `POST /api/admin/applications`

**Purpose:** Create a new application with master password.

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 100 requests per minute per IP address

**Request Body:**

```typescript
interface CreateApplicationRequest {
  app_name: string;           // Application name (required)
  master_password: string;    // Master password (required, min 12 chars)
}
```

**Example Request:**

```javascript
const response = await fetch(`${API_BASE_URL}/api/admin/applications`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    app_name: 'My New App',
    master_password: 'SecurePassword123!'
  })
});
```

**Success Response (201 Created):**

```typescript
interface CreateApplicationResponse {
  success: true;
  data: {
    id: string;               // UUID
    app_id: string;           // Generated app ID
    app_name: string;         // Application name
    app_secret: string;       // Plain app secret (SAVE THIS - shown only once!)
    is_active: boolean;       // Active status (true)
    created_at: string;       // ISO 8601 timestamp
    updated_at: string;       // ISO 8601 timestamp
  };
  message: string;            // "Application created successfully. Save the app_secret..."
}
```

**IMPORTANT:** The `app_secret` is returned in plain text ONLY on creation. Store it securely - it will never be shown again!

**Error Responses:**

```typescript
// 400 Bad Request - Invalid input
{
  "success": false,
  "error": "app_name is required"
}
// or
{
  "success": false,
  "error": "master_password must be at least 12 characters"
}
```

---

### 5. Update Application

**Endpoint:** `PUT /api/admin/applications/:id`

**Purpose:** Update application name or active status.

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 100 requests per minute per IP address

**URL Parameters:**

- `:id` - Application UUID (required)

**Request Body (Partial Updates Supported):**

```typescript
interface UpdateApplicationRequest {
  app_name?: string;      // New application name (optional)
  is_active?: boolean;    // New active status (optional)
}
```

**Example Request:**

```javascript
const response = await fetch(
  `${API_BASE_URL}/api/admin/applications/123e4567-e89b-12d3-a456-426614174000`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      app_name: 'Updated App Name',
      is_active: false
    })
  }
);
```

**Success Response (200 OK):**

```typescript
interface UpdateApplicationResponse {
  success: true;
  data: {
    id: string;
    app_id: string;
    app_name: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  message: string;      // "Application updated successfully"
}
```

**Error Responses:**

```typescript
// 400 Bad Request - No fields provided
{
  "success": false,
  "error": "At least one field (app_name or is_active) must be provided"
}

// 404 Not Found
{
  "success": false,
  "error": "Application not found"
}
```

---

### 6. Delete Application

**Endpoint:** `DELETE /api/admin/applications/:id`

**Purpose:** Soft delete an application (sets `is_active` to false).

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 100 requests per minute per IP address

**URL Parameters:**

- `:id` - Application UUID (required)

**Example Request:**

```javascript
const response = await fetch(
  `${API_BASE_URL}/api/admin/applications/123e4567-e89b-12d3-a456-426614174000`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Application deleted successfully"
}
```

**Note:** Deleting an application will invalidate all its active tokens.

---

### 7. Change Master Password

**Endpoint:** `PUT /api/admin/applications/:id/password`

**Purpose:** Change the master password for an application.

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 5 attempts per hour per application

**URL Parameters:**

- `:id` - Application UUID (required)

**Request Body:**

```typescript
interface ChangePasswordRequest {
  current_master_password: string;    // Current password (required)
  new_master_password: string;        // New password (required, min 12 chars)
}
```

**Example Request:**

```javascript
const response = await fetch(
  `${API_BASE_URL}/api/admin/applications/123e4567-e89b-12d3-a456-426614174000/password`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      current_master_password: 'CurrentPassword123!',
      new_master_password: 'NewSecurePassword456!'
    })
  }
);
```

**Success Response (200 OK):**

```typescript
interface ChangePasswordResponse {
  success: true;
  message: string;                    // "Master password changed successfully..."
  data: {
    tokens_revoked: number;           // Number of tokens revoked
  };
}
```

**IMPORTANT:** All active tokens for this application will be automatically revoked when the password is changed.

**Error Responses:**

```typescript
// 401 Unauthorized - Incorrect password
{
  "success": false,
  "error": "Current password is incorrect"
}

// 429 Too Many Requests
{
  "success": false,
  "error": "Too many password change requests, please try again later"
}
```

---

## Token Management

### 8. List Active Tokens

**Endpoint:** `GET /api/admin/tokens`

**Purpose:** Retrieve all active tokens with optional filtering.

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 100 requests per minute per IP address

**Query Parameters:**

```typescript
interface ListActiveTokensParams {
  application_id?: string;    // Filter by app ID (optional)
  limit?: number;             // Results per page (1-100, default: 50)
  offset?: number;            // Skip N results (default: 0)
}
```

**Example Request:**

```javascript
const response = await fetch(
  `${API_BASE_URL}/api/admin/tokens?application_id=app-123e4567&limit=50&offset=0`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Success Response (200 OK):**

```typescript
interface ListActiveTokensResponse {
  success: true;
  data: {
    tokens: Array<{
      jti: string;              // JWT ID (unique token identifier)
      application_id: string;   // Application ID
      issued_at: string;        // ISO 8601 timestamp
      expires_at: string;       // ISO 8601 timestamp
      ip_address: string;       // IP where token was issued
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}
```

---

### 9. Revoke Token

**Endpoint:** `POST /api/admin/tokens/revoke`

**Purpose:** Revoke a specific token by its JWT ID.

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 50 requests per hour per IP address

**Request Body:**

```typescript
interface RevokeTokenRequest {
  jti: string;        // JWT ID to revoke (required)
  reason?: string;    // Optional reason for revocation
}
```

**Example Request:**

```javascript
const response = await fetch(`${API_BASE_URL}/api/admin/tokens/revoke`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    jti: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reason: 'Security concern'
  })
});
```

**Success Response (200 OK):**

```typescript
interface RevokeTokenResponse {
  success: true;
  message: string;              // "Token revoked successfully"
  data: {
    jti: string;                // The JWT ID that was revoked
    revoked_at: string;         // ISO 8601 timestamp
  };
}
```

---

### 10. Revoke All Tokens for Application

**Endpoint:** `POST /api/admin/applications/:id/revoke-all`

**Purpose:** Revoke all active tokens for a specific application.

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 50 requests per hour per IP address

**URL Parameters:**

- `:id` - Application UUID (required)

**Request Body (Optional):**

```typescript
interface RevokeAllTokensRequest {
  reason?: string;    // Optional reason for bulk revocation
}
```

**Example Request:**

```javascript
const response = await fetch(
  `${API_BASE_URL}/api/admin/applications/123e4567-e89b-12d3-a456-426614174000/revoke-all`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reason: 'Security audit'
    })
  }
);
```

**Success Response (200 OK):**

```typescript
interface RevokeAllTokensResponse {
  success: true;
  message: string;                  // "All tokens revoked successfully"
  data: {
    tokens_revoked: number;         // Number of tokens revoked
  };
}
```

---

## Audit Logs

### 11. Query Audit Logs

**Endpoint:** `GET /api/admin/logs`

**Purpose:** Retrieve audit logs with filters and pagination.

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 100 requests per minute per IP address

**Query Parameters:**

```typescript
interface QueryLogsParams {
  event_type?: string;        // Filter by event type (optional)
  application_id?: string;    // Filter by app ID (optional)
  start_date?: string;        // Filter by start date (ISO 8601, optional)
  end_date?: string;          // Filter by end date (ISO 8601, optional)
  limit?: number;             // Results per page (1-100, default: 50)
  offset?: number;            // Skip N results (default: 0)
}

// Valid event_type values:
// - login_success
// - login_failed
// - token_validation_success
// - token_validation_failed
// - logout
// - token_refresh
// - token_revoked
// - token_status_check
// - token_status_check_failed
// - rate_limit_exceeded
```

**Example Request:**

```javascript
const response = await fetch(
  `${API_BASE_URL}/api/admin/logs?` +
  `event_type=login_success&` +
  `application_id=app-123e4567&` +
  `start_date=2025-12-01T00:00:00Z&` +
  `end_date=2025-12-05T23:59:59Z&` +
  `limit=50&offset=0`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Success Response (200 OK):**

```typescript
interface QueryLogsResponse {
  success: true;
  data: {
    logs: Array<{
      id: string;                 // Log ID
      event_type: string;         // Event type
      application_id: string;     // Application ID
      ip_address: string;         // IP address
      user_agent: string;         // User agent
      details: object;            // Additional details
      created_at: string;         // ISO 8601 timestamp
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}
```

---

### 12. Export Audit Logs

**Endpoint:** `GET /api/admin/logs/export`

**Purpose:** Export audit logs in JSON or CSV format.

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 10 requests per hour per IP address

**Query Parameters:**

```typescript
interface ExportLogsParams {
  format: string;             // Export format: 'json' | 'csv' (default: 'json')
  event_type?: string;        // Filter by event type (optional)
  application_id?: string;    // Filter by app ID (optional)
  start_date?: string;        // Filter by start date (ISO 8601, optional)
  end_date?: string;          // Filter by end date (ISO 8601, optional)
  limit?: number;             // Number of results (1-100, default: 50)
  offset?: number;            // Skip N results (default: 0)
}
```

**Example Request:**

```javascript
const response = await fetch(
  `${API_BASE_URL}/api/admin/logs/export?format=csv&event_type=login_success&limit=100`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);

// Handle download
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `audit-logs-${new Date().toISOString()}.csv`;
a.click();
```

**Success Response (200 OK):**

**Content-Type:** `application/json` or `text/csv` (depending on format)

**JSON Format:**

```json
[
  {
    "id": "log-1",
    "event_type": "login_success",
    "application_id": "app-123",
    "ip_address": "127.0.0.1",
    "user_agent": "Mozilla/5.0",
    "details": {},
    "created_at": "2025-12-04T10:00:00Z"
  }
]
```

**CSV Format:**

```csv
id,event_type,application_id,ip_address,user_agent,details,created_at
log-1,login_success,app-123,127.0.0.1,Mozilla/5.0,{},2025-12-04T10:00:00Z
```

---

## Dashboard Statistics

### 13. Get Dashboard Overview

**Endpoint:** `GET /api/admin/dashboard`

**Purpose:** Retrieve dashboard statistics (cached for 5 minutes).

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 100 requests per minute per IP address

**Example Request:**

```javascript
const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  }
});
```

**Success Response (200 OK):**

```typescript
interface DashboardStatsResponse {
  success: true;
  data: {
    total_applications: number;           // Total apps (active + inactive)
    active_applications: number;          // Active apps only
    total_active_tokens: number;          // Currently active tokens
    failed_logins_24h: number;            // Failed logins in last 24 hours
    successful_logins_24h: number;        // Successful logins in last 24 hours
    token_validations_24h: number;        // Token validations in last 24 hours
    recent_activity: Array<{              // Last 10 events
      id: string;
      event_type: string;
      application_id: string;
      ip_address: string;
      user_agent: string;
      details: object;
      created_at: string;
    }>;
  };
}
```

**Example Success Response:**

```json
{
  "success": true,
  "data": {
    "total_applications": 10,
    "active_applications": 8,
    "total_active_tokens": 25,
    "failed_logins_24h": 5,
    "successful_logins_24h": 50,
    "token_validations_24h": 120,
    "recent_activity": [
      {
        "id": "log-1",
        "event_type": "login_success",
        "application_id": "app-123",
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0",
        "details": {},
        "created_at": "2025-12-04T10:00:00Z"
      }
    ]
  }
}
```

---

### 14. Get Application Analytics

**Endpoint:** `GET /api/admin/applications/:id/analytics`

**Purpose:** Retrieve detailed analytics for a specific application (cached for 5 minutes).

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 100 requests per minute per IP address

**URL Parameters:**

- `:id` - Application UUID (required)

**Query Parameters:**

```typescript
interface ApplicationAnalyticsParams {
  date_range?: string;    // Time range: '7d' | '30d' | '90d' (default: '30d')
}
```

**Example Request:**

```javascript
const response = await fetch(
  `${API_BASE_URL}/api/admin/applications/123e4567-e89b-12d3-a456-426614174000/analytics?date_range=30d`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Success Response (200 OK):**

```typescript
interface ApplicationAnalyticsResponse {
  success: true;
  data: {
    login_success_count: number;          // Successful logins in range
    login_failed_count: number;           // Failed logins in range
    active_token_count: number;           // Currently active tokens
    token_validations_count: number;      // Validations in range
    most_recent_activity: string | null;  // ISO 8601 timestamp or null
    peak_usage_times: Array<{             // Top 5 hours with most activity
      hour: number;                       // Hour of day in UTC (0-23)
      count: number;                      // Number of events in this hour
    }>;
  };
}
```

---

## API Helper Functions

### Authentication Helper

```javascript
class AdminAPI {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  getToken() {
    return localStorage.getItem('admin_token');
  }

  isAuthenticated() {
    const token = this.getToken();
    const expiresAt = localStorage.getItem('admin_token_expires_at');

    if (!token || !expiresAt) return false;

    return new Date(expiresAt) > new Date();
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();

    if (!token) {
      throw new Error('Not authenticated');
    }

    const defaultHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    if (response.status === 401) {
      // Token expired or invalid - clear and redirect
      localStorage.clear();
      window.location.href = '/admin/login';
      throw new Error('Authentication expired');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Application Management
  async listApplications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/applications?${query}`);
  }

  async createApplication(appName, masterPassword) {
    return this.request('/api/admin/applications', {
      method: 'POST',
      body: JSON.stringify({
        app_name: appName,
        master_password: masterPassword
      })
    });
  }

  async updateApplication(id, updates) {
    return this.request(`/api/admin/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteApplication(id) {
    return this.request(`/api/admin/applications/${id}`, {
      method: 'DELETE'
    });
  }

  async changePassword(id, currentPassword, newPassword) {
    return this.request(`/api/admin/applications/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({
        current_master_password: currentPassword,
        new_master_password: newPassword
      })
    });
  }

  // Token Management
  async listActiveTokens(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/tokens?${query}`);
  }

  async revokeToken(jti, reason) {
    return this.request('/api/admin/tokens/revoke', {
      method: 'POST',
      body: JSON.stringify({ jti, reason })
    });
  }

  async revokeAllTokens(applicationId, reason) {
    return this.request(`/api/admin/applications/${applicationId}/revoke-all`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Audit Logs
  async queryLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/logs?${query}`);
  }

  async exportLogs(params = {}) {
    const token = this.getToken();
    const query = new URLSearchParams(params).toString();

    const response = await fetch(
      `${this.baseURL}/api/admin/logs/export?${query}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }

  // Dashboard
  async getDashboardStats() {
    return this.request('/api/admin/dashboard');
  }

  async getApplicationAnalytics(id, dateRange = '30d') {
    return this.request(`/api/admin/applications/${id}/analytics?date_range=${dateRange}`);
  }
}

// Usage
const adminAPI = new AdminAPI(import.meta.env.VITE_API_BASE_URL);
```

---

## Complete Admin Login Example (React)

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError('Invalid email or password');
        } else if (response.status === 429) {
          setError('Too many login attempts. Please try again later.');
        } else {
          setError(data.error || 'Login failed');
        }
        return;
      }

      // Store admin token
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_username', data.user.username);
      localStorage.setItem('admin_token_expires_at', data.expiresAt);

      // Redirect to admin dashboard
      navigate('/admin/dashboard');

    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <h1>Admin Login</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin Password"
            disabled={loading}
            required
          />
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || !email || !password}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

---

## Error Handling

All admin endpoints return standardized error responses:

```typescript
interface ErrorResponse {
  success: false;
  error: string | {
    message: string;
    statusCode: number;
  };
}
```

Common HTTP status codes:
- **400** - Bad Request (invalid input)
- **401** - Unauthorized (invalid/expired token, wrong password)
- **404** - Not Found (resource doesn't exist)
- **429** - Too Many Requests (rate limit exceeded)
- **500** - Internal Server Error

---

## Rate Limits Summary

| Endpoint | Limit |
|----------|-------|
| Admin Login | 5 requests / 15 minutes |
| Admin Logout | 100 requests / minute |
| List Applications | 100 requests / minute |
| Create/Update/Delete Application | 100 requests / minute |
| Change Password | 5 requests / hour (per application) |
| List/Revoke Tokens | 50 requests / hour |
| Query Logs | 100 requests / minute |
| Export Logs | 10 requests / hour |
| Dashboard Stats | 100 requests / minute |
| Application Analytics | 100 requests / minute |

---

## Testing with Swagger UI

Navigate to: `http://localhost:3001/api-docs`

All admin endpoints are documented and testable via Swagger UI. Use the "Authorize" button to add your Bearer token.

---

## Security: Localhost-Only Access

### Why Admin Panel is NOT Exposed

**Design Decision:** The Admin Panel runs on `localhost:3001` and is intentionally NOT exposed via Cloudflare tunnel.

**Benefits:**
1. **Physical Security:** Only users with physical or SSH access to the server can access the admin panel
2. **No Internet Exposure:** Admin panel cannot be discovered or attacked from the internet
3. **No Brute Force Risk:** Login endpoints cannot be brute-forced remotely
4. **Simplified Security:** No need for complex firewall rules or VPN setup
5. **Zero Attack Surface:** Complete isolation from external networks

### Accessing Admin Panel

**On Server (Local Access):**
```bash
# On the server PC, open browser to:
http://localhost:3001
```

**Via SSH Tunnel (Remote Access):**
```bash
# From your local machine:
ssh -L 3001:localhost:3001 user@your-server-ip

# Then in your local browser:
http://localhost:3001
```

**Security Note:** SSH tunnel provides secure remote access without exposing the admin panel to the internet.

### Alternative Approaches (NOT Recommended)

If you need web-based remote access, consider these alternatives (in order of security):

1. **SSH Tunnel** (Recommended) - Described above
2. **VPN Access** - Connect to server via VPN, then access localhost:3001
3. **IP Whitelist + Cloudflare** - Expose admin panel but restrict to specific IPs (complex setup)
4. **HTTP Basic Auth + HTTPS** - Add another authentication layer (still vulnerable to attacks)

**Best Practice:** Stick with localhost-only access and use SSH tunnels for remote administration.

---

## Support

For issues or questions:
- Check Swagger documentation at `/api-docs`
- Review API response error messages
- Verify Bearer token is included in Authorization header
- Check token expiration (30 minutes by default)
- For admin panel access issues, ensure you're on the server or using SSH tunnel
