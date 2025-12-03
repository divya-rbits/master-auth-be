# Audit Logging Documentation

## Overview

The audit logging system provides comprehensive tracking of all authentication-related events in the Master Password Authentication backend. Every authentication attempt, token operation, and security-related action is logged with detailed context information.

## Architecture

### Components

1. **Database Service** (`src/services/database.js`)
   - Central logging service with `logEvent()` method
   - Helper methods for standardized log entry creation
   - Built-in validation and error handling

2. **Audit Logs Table** (Supabase)
   - Table name: `audit_logs`
   - Stores all audit events with structured data

3. **Controller Integration**
   - All authentication endpoints log events automatically
   - Rate limiters log violation attempts
   - Errors are logged without breaking application flow

## Event Types

### Authentication Events

#### `login_success`
Logged when a user successfully authenticates with the master password.

**Details Object:**
```javascript
{
  message: "User authenticated successfully"
}
```

#### `login_failed`
Logged when authentication fails due to invalid credentials or configuration.

**Details Object:**
```javascript
{
  reason: "Invalid password" | "Password not configured"
}
```

### Token Validation Events

#### `token_validation_success`
Logged when a token is successfully validated.

**Details Object:**
```javascript
{
  jti: "unique-token-id",
  expiresIn: 3600 // seconds remaining
}
```

#### `token_validation_failed`
Logged when token validation fails.

**Details Object:**
```javascript
{
  reason: "Token expired" | "Token has been revoked" | "Invalid token"
}
```

### Session Management Events

#### `logout`
Logged when a user explicitly logs out.

**Details Object:**
```javascript
{
  jti: "token-id-being-revoked"
}
```

#### `token_refresh`
Logged when a token is refreshed.

**Details Object:**
```javascript
{
  oldJti: "previous-token-id",
  message: "Token refreshed successfully"
}
```

#### `token_revoked`
Logged when a token is manually revoked via the API.

**Details Object:**
```javascript
{
  revokedJti: "target-token-id",
  requestingJti: "requester-token-id",
  reason: "User-provided reason" | "Revoked via API"
}
```

### Token Status Events

#### `token_status_check`
Logged when token status is successfully checked.

**Details Object:**
```javascript
{
  jti: "token-id",
  valid: true
}
```

#### `token_status_check_failed`
Logged when token status check fails.

**Details Object:**
```javascript
{
  reason: "Error message"
}
```

### Security Events

#### `rate_limit_exceeded`
Logged when a client exceeds rate limits.

**Details Object:**
```javascript
{
  endpoint: "/api/auth/login",
  limit: 5 // requests per window
}
```

## Database Schema

### audit_logs Table

```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  application_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_application_id ON audit_logs(application_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN(details);
```

### Field Descriptions

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `id` | BIGSERIAL | Auto-incrementing primary key | Yes |
| `event_type` | TEXT | Type of event (see Event Types above) | Yes |
| `application_id` | TEXT | Identifier of the application | No |
| `ip_address` | TEXT | Client IP address (IPv4 or IPv6) | No |
| `user_agent` | TEXT | Client User-Agent string | No |
| `details` | JSONB | Event-specific structured data | No |
| `created_at` | TIMESTAMP | ISO 8601 timestamp of the event | Yes |

## Usage

### Logging an Event

```javascript
const databaseService = require('./services/database');

// Basic usage
await databaseService.logEvent(
  'login_success',           // event type
  'my-app-001',              // application ID
  '192.168.1.1',             // IP address
  'Mozilla/5.0...',          // user agent
  { message: 'Success' }     // details object
);
```

### In Controllers

The auth controller automatically logs events with request context:

```javascript
async login(req, res) {
  const ipAddress = req.ip;
  const userAgent = req.get('user-agent');

  await databaseService.logEvent(
    'login_success',
    application_id,
    ipAddress,
    userAgent,
    { message: 'User authenticated successfully' }
  );
}
```

### Error Handling

The logging system is designed to never break the application flow:

```javascript
// Logging failures return false but don't throw
const success = await databaseService.logEvent(...);
if (!success) {
  // Log to console but continue execution
  console.warn('Failed to log audit event');
}
```

## Querying Audit Logs

### Query by Event Type

```sql
SELECT * FROM audit_logs
WHERE event_type = 'login_failed'
ORDER BY created_at DESC
LIMIT 100;
```

### Query by Application

```sql
SELECT * FROM audit_logs
WHERE application_id = 'my-app-001'
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Query Failed Login Attempts

```sql
SELECT
  ip_address,
  COUNT(*) as attempt_count,
  MAX(created_at) as last_attempt
FROM audit_logs
WHERE event_type = 'login_failed'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) > 3
ORDER BY attempt_count DESC;
```

### Query Token Operations

```sql
SELECT
  event_type,
  details->>'jti' as token_id,
  created_at
FROM audit_logs
WHERE details->>'jti' = 'specific-token-id'
ORDER BY created_at DESC;
```

### Query by IP Address

```sql
SELECT * FROM audit_logs
WHERE ip_address = '192.168.1.1'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Security & Privacy Considerations

### What is Logged

✅ **Logged:**
- Event types and timestamps
- Application identifiers
- IP addresses
- User agent strings
- Token IDs (JTI)
- Success/failure reasons

❌ **NOT Logged:**
- Passwords (plain or hashed)
- Token contents (JWT or JWE)
- Salts or cryptographic keys
- Personal user data

### Data Retention

Implement a retention policy based on your requirements:

```sql
-- Delete audit logs older than 90 days
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

### GDPR Compliance

When handling user data deletion requests:

```sql
-- Anonymize logs for specific IP addresses
UPDATE audit_logs
SET ip_address = 'anonymized',
    user_agent = 'anonymized'
WHERE ip_address = '203.0.113.1';
```

## Monitoring & Alerting

### Failed Login Detection

Monitor for brute force attempts:

```sql
SELECT
  ip_address,
  COUNT(*) as failures,
  MAX(created_at) as last_failure
FROM audit_logs
WHERE event_type = 'login_failed'
AND created_at > NOW() - INTERVAL '10 minutes'
GROUP BY ip_address
HAVING COUNT(*) > 5;
```

### Unusual Activity

Detect unusual token operations:

```sql
SELECT
  application_id,
  COUNT(*) as revocations
FROM audit_logs
WHERE event_type = 'token_revoked'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY application_id
HAVING COUNT(*) > 10;
```

### Rate Limit Violations

Track rate limit abuse:

```sql
SELECT
  ip_address,
  details->>'endpoint' as endpoint,
  COUNT(*) as violations
FROM audit_logs
WHERE event_type = 'rate_limit_exceeded'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address, details->>'endpoint'
ORDER BY violations DESC;
```

## Testing

### Unit Tests

Located in `tests/services/database.test.js`:
- 20 comprehensive tests
- Mock Supabase client
- Test all event types
- Test error handling

### Integration Tests

Located in `tests/integration/audit-logging.test.js`:
- 13 end-to-end tests
- Test full request flow
- Verify logs created correctly
- Test data integrity

### Running Tests

```bash
# Run all audit logging tests
npm test -- audit

# Run unit tests only
npm test -- tests/services/database.test.js

# Run integration tests only
npm test -- tests/integration/audit-logging.test.js
```

## Best Practices

### 1. Always Provide Context

```javascript
// Good: Includes context
await databaseService.logEvent(
  'login_failed',
  'app-001',
  req.ip,
  req.get('user-agent'),
  { reason: 'Invalid password', attempt: 3 }
);

// Bad: Missing context
await databaseService.logEvent('login_failed');
```

### 2. Use Structured Details

```javascript
// Good: Structured data
{
  jti: 'token-id',
  expiresIn: 3600,
  renewalCount: 1
}

// Bad: Unstructured
{
  message: 'Token token-id expires in 3600 seconds, renewed 1 time'
}
```

### 3. Don't Block on Logging

```javascript
// Good: Async logging, don't await
databaseService.logEvent(...); // Fire and forget

// Acceptable: Await but catch errors
try {
  await databaseService.logEvent(...);
} catch (err) {
  console.error('Logging failed:', err);
}
```

### 4. Log Security Events Immediately

```javascript
// Log security events before taking action
await databaseService.logEvent('rate_limit_exceeded', ...);
return res.status(429).json({ error: 'Rate limit exceeded' });
```

## Troubleshooting

### Logs Not Appearing

1. Check Supabase connection
2. Verify table exists: `SELECT * FROM audit_logs LIMIT 1;`
3. Check service logs for errors
4. Verify `logEvent` is being called

### Performance Issues

1. Add indexes on frequently queried columns
2. Implement log archiving/deletion
3. Use materialized views for aggregations
4. Consider async batch logging for high volume

### Missing Data

1. Verify all required fields are provided
2. Check for validation errors in logs
3. Ensure middleware captures IP/user-agent correctly
4. Test with unit/integration tests

## Future Enhancements

- [ ] Async batch logging for high throughput
- [ ] Structured logging library integration (Winston/Pino)
- [ ] Real-time alerting webhooks
- [ ] Automated log rotation
- [ ] Export to external SIEM systems
- [ ] Advanced anomaly detection
- [ ] Compliance reporting dashboards

## References

- [Database Service Implementation](../src/services/database.js)
- [Auth Controller](../src/controllers/authController.js)
- [Backend Plan - Task 7.1](../Backend-Plan.md#task-71-implement-audit-logging-service)
- [Unit Tests](../tests/services/database.test.js)
- [Integration Tests](../tests/integration/audit-logging.test.js)
