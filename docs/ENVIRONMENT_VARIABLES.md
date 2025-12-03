# Environment Variables Documentation

Complete reference for all environment variables used in the Master Password Authentication Backend.

## Table of Contents

- [Overview](#overview)
- [Quick Reference](#quick-reference)
- [Detailed Variables](#detailed-variables)
  - [Server Configuration](#server-configuration)
  - [Database Configuration](#database-configuration)
  - [Authentication & Security](#authentication--security)
  - [CORS Configuration](#cors-configuration)
  - [Admin Panel](#admin-panel)
- [Environment-Specific Configurations](#environment-specific-configurations)
- [Security Best Practices](#security-best-practices)
- [Validation](#validation)
- [Troubleshooting](#troubleshooting)

## Overview

The application uses environment variables for configuration management. These variables control server behavior, security settings, database connections, and feature toggles.

**Configuration File**: `.env` (not committed to version control)
**Template Files**:
- `.env.example` - Development template
- `.env.production.example` - Production template

## Quick Reference

| Variable | Required | Default | Environment |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | All |
| `NODE_ENV` | No | development | All |
| `SUPABASE_URL` | **Yes** | - | All |
| `SUPABASE_SERVICE_KEY` | **Yes** | - | All |
| `JWT_SECRET` | **Yes** | - | All |
| `TOKEN_EXPIRATION` | No | 3600 | All |
| `ALLOWED_ORIGINS` | **Yes** | - | All |
| `ADMIN_USERNAME` | **Yes** | - | All |
| `ADMIN_PASSWORD` | **Yes** | - | All |

## Detailed Variables

### Server Configuration

#### `PORT`

**Description**: TCP port number the server listens on.

- **Type**: Integer
- **Required**: No
- **Default**: `3001`
- **Valid Range**: 1-65535
- **Example**: `3001`, `8080`, `443`

**Usage**:
```javascript
const PORT = process.env.PORT || 3001;
app.listen(PORT);
```

**Validation**:
- Must be a valid integer
- Must be between 1 and 65535
- Must not conflict with other services

**Common Values**:
- Development: `3001`
- Production: `3001`, `8080`, `443`, `80`
- Docker: `3001` (internal), mapped externally

---

#### `NODE_ENV`

**Description**: Application environment mode controlling behavior, logging, and error handling.

- **Type**: String (enum)
- **Required**: No
- **Default**: `development`
- **Valid Values**: `development`, `staging`, `production`

**Impact**:
- **Development**: Verbose logging, detailed errors, relaxed security
- **Staging**: Moderate logging, sanitized errors, production-like
- **Production**: Minimal logging, generic errors, maximum security

**Usage**:
```javascript
const isProduction = process.env.NODE_ENV === 'production';
```

**Effects by Environment**:

| Feature | Development | Production |
|---------|-------------|------------|
| Error Details | Full stack traces | Generic messages |
| Logging Level | Debug | Info/Warn |
| CORS | Permissive | Strict |
| Security Headers | Relaxed | Strict |

---

### Database Configuration

#### `SUPABASE_URL`

**Description**: URL of your Supabase project for database connectivity.

- **Type**: URL
- **Required**: **Yes**
- **Format**: `https://[project-id].supabase.co`
- **Example**: `https://abcdefghijklmnop.supabase.co`

**Where to Find**:
1. Go to Supabase Dashboard
2. Select your project
3. Settings > API
4. Copy "Project URL"

**Usage**:
```javascript
const supabase = createClient(process.env.SUPABASE_URL, ...);
```

**Validation**:
- Must be a valid HTTPS URL
- Must match Supabase URL pattern
- Must be accessible from deployment environment

**Security**: Public value, but paired with service key

---

#### `SUPABASE_SERVICE_KEY`

**Description**: Service role key with full database access, bypassing RLS policies.

- **Type**: String (JWT)
- **Required**: **Yes**
- **Security**: 🔴 **CRITICAL** - Never expose publicly!
- **Length**: ~300+ characters (JWT format)

**Where to Find**:
1. Go to Supabase Dashboard
2. Select your project
3. Settings > API
4. Copy "service_role" key (not anon key!)

**Usage**:
```javascript
const supabase = createClient(url, process.env.SUPABASE_SERVICE_KEY);
```

**Security Considerations**:
- ⚠️ Bypasses ALL Row Level Security (RLS) policies
- ⚠️ Has full read/write access to entire database
- ⚠️ Never use in client-side code
- ⚠️ Never log or expose in error messages
- ⚠️ Rotate regularly (every 90 days recommended)
- ⚠️ Store in secrets manager in production

**Validation**:
- Must be a valid JWT format
- Must match your Supabase project
- Should start with `eyJ...`

---

### Authentication & Security

#### `JWT_SECRET`

**Description**: Secret key for signing and verifying JWT tokens.

- **Type**: String
- **Required**: **Yes**
- **Minimum Length**: 32 characters (recommended: 64+)
- **Security**: 🔴 **CRITICAL** - Compromise = all tokens invalid

**Generate**:
```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Usage**:
```javascript
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
```

**Security Considerations**:
- ⚠️ Changing this invalidates ALL existing tokens
- ⚠️ Users will need to re-authenticate
- ⚠️ Use cryptographically secure random generation
- ⚠️ Different secret per environment
- ⚠️ Store in secrets manager in production
- ⚠️ Never commit to version control
- ⚠️ Rotate periodically (every 6-12 months)

**Validation**:
- Minimum 32 characters
- Alphanumeric + special characters
- High entropy (not a dictionary word or pattern)

---

#### `TOKEN_EXPIRATION`

**Description**: JWT token lifetime in seconds before expiration.

- **Type**: Integer (seconds)
- **Required**: No
- **Default**: `3600` (1 hour)
- **Recommended Range**: 3600 (1h) to 86400 (24h)

**Common Values**:
- Short-lived: `3600` (1 hour)
- Medium: `14400` (4 hours)
- Long: `86400` (24 hours)
- Very long: `604800` (7 days) - not recommended

**Usage**:
```javascript
const expiresIn = parseInt(process.env.TOKEN_EXPIRATION || '3600', 10);
```

**Tradeoffs**:

| Duration | Security | User Experience |
|----------|----------|-----------------|
| 1 hour | High | May need frequent re-auth |
| 4 hours | Medium | Balanced |
| 24 hours | Lower | Convenient, less secure |

**Recommendations**:
- Financial apps: 15-60 minutes
- Business apps: 1-4 hours
- Consumer apps: 4-24 hours
- Internal tools: 8-24 hours

---

### CORS Configuration

#### `ALLOWED_ORIGINS`

**Description**: Comma-separated whitelist of origins allowed to make cross-origin requests.

- **Type**: String (comma-separated URLs)
- **Required**: **Yes** for web applications
- **Format**: `https://domain1.com,https://domain2.com`
- **Security**: Only trusted domains should be listed

**Examples**:
```bash
# Single domain
ALLOWED_ORIGINS=https://app.example.com

# Multiple domains
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com

# Development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Mixed (not recommended)
ALLOWED_ORIGINS=http://localhost:3000,https://prod.example.com
```

**Usage**:
```javascript
const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
```

**Important Rules**:
- ✅ Use HTTPS in production (not HTTP)
- ✅ No trailing slashes: `https://example.com` not `https://example.com/`
- ✅ Include protocol: `https://` or `http://`
- ✅ Include port if non-standard: `http://localhost:3000`
- ❌ No wildcards: `*.example.com` not supported
- ❌ No paths: `https://example.com` not `https://example.com/app`

**Security Considerations**:
- Only add domains you control
- Regularly audit the list
- Remove unused domains
- Use different lists per environment
- Be cautious with subdomains

**Validation**:
- Must be valid URLs
- Must include protocol
- No wildcards allowed
- No trailing slashes

---

### Admin Panel

#### `ADMIN_USERNAME`

**Description**: Username for HTTP Basic Authentication on admin endpoints.

- **Type**: String
- **Required**: **Yes** if using admin endpoints
- **Recommended Length**: 8-32 characters
- **Format**: Alphanumeric (no special restrictions)

**Examples**:
```bash
# Avoid obvious usernames
ADMIN_USERNAME=admin              # ❌ Too common
ADMIN_USERNAME=administrator      # ❌ Too common
ADMIN_USERNAME=master_auth_admin  # ✅ Unique to app
ADMIN_USERNAME=sys_audit_2024     # ✅ Descriptive + unique
```

**Usage**:
```javascript
if (username !== process.env.ADMIN_USERNAME) {
  throw new AuthenticationError('Invalid credentials');
}
```

**Security**:
- Use unique, non-obvious username
- Different username per environment
- Not an email address
- Not "admin" or "administrator"

---

#### `ADMIN_PASSWORD`

**Description**: Password for HTTP Basic Authentication on admin endpoints.

- **Type**: String
- **Required**: **Yes** if using admin endpoints
- **Security**: 🔴 **CRITICAL** - Protects admin access
- **Minimum Length**: 16 characters (recommended: 24+)

**Generate**:
```bash
# Linux/Mac
openssl rand -base64 24

# Node.js
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

**Usage**:
```javascript
if (password !== process.env.ADMIN_PASSWORD) {
  throw new AuthenticationError('Invalid credentials');
}
```

**Security Requirements**:
- ✅ Minimum 16 characters (24+ recommended)
- ✅ Mix of uppercase, lowercase, numbers, symbols
- ✅ High entropy (not dictionary words)
- ✅ Unique per environment
- ✅ Store in password manager
- ✅ Rotate every 90 days
- ❌ Not based on service name
- ❌ Not reused from other services

**Password Strength**:
- Weak: `admin123` ❌
- Medium: `AdminPass2024!` ⚠️
- Strong: `mK9$nP2#vL8@qR4*wE7` ✅
- Very Strong: `kN8$xT3#mQ9@pL2*vR7&hK5!wE4` ✅

---

## Environment-Specific Configurations

### Development Environment

**File**: `.env` (based on `.env.example`)

```bash
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_SERVICE_KEY=dev_service_key_here
JWT_SECRET=dev_jwt_secret_minimum_32_chars
TOKEN_EXPIRATION=7200
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080
ADMIN_USERNAME=dev_admin
ADMIN_PASSWORD=dev_admin_password
```

**Characteristics**:
- Relaxed security for easier debugging
- Local database or dev Supabase instance
- Multiple localhost origins allowed
- Longer token expiration for convenience
- Verbose logging enabled

---

### Staging Environment

**File**: `.env` (based on `.env.production.example`)

```bash
PORT=3001
NODE_ENV=staging
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_SERVICE_KEY=staging_service_key_here
JWT_SECRET=staging_jwt_secret_different_from_prod_and_dev
TOKEN_EXPIRATION=3600
ALLOWED_ORIGINS=https://staging.yourdomain.com
ADMIN_USERNAME=staging_admin_unique
ADMIN_PASSWORD=strong_staging_password_here
```

**Characteristics**:
- Production-like configuration
- Separate database from production
- Production security settings
- Limited origins (staging domain only)
- Production-level logging

---

### Production Environment

**File**: `.env` (based on `.env.production.example`)

```bash
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_KEY=prod_service_key_highly_secure
JWT_SECRET=prod_jwt_secret_64_chars_cryptographically_secure_random_string
TOKEN_EXPIRATION=3600
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
ADMIN_USERNAME=prod_admin_unique_complex
ADMIN_PASSWORD=very_strong_complex_password_24plus_chars
```

**Characteristics**:
- Maximum security
- Production database
- Strict CORS (only production domains)
- Strong credentials
- Minimal logging
- Secrets stored in secrets manager

---

### Docker Environment

**File**: `.env` (loaded by docker-compose)

```bash
# Same as above, but ensure:
PORT=3001  # Must match container EXPOSE and docker-compose port mapping
SUPABASE_URL=https://your-project.supabase.co  # Must be accessible from container
```

**Additional Considerations**:
- Network connectivity between container and Supabase
- Port mapping in `docker-compose.yml`: `3001:3001`
- Volume mounts for logs directory
- Health checks configured

---

## Security Best Practices

### 1. File Permissions

```bash
# Linux/Mac
chmod 600 .env              # Owner read/write only
chown appuser:appuser .env  # Owned by application user

# Verify
ls -la .env
# Should show: -rw------- 1 appuser appuser
```

### 2. Version Control

```bash
# .gitignore must include:
.env
.env.local
.env.*.local
.env.production
.env.staging

# Never commit:
git add .env               # ❌ NEVER
git add .env.production    # ❌ NEVER

# Always commit:
git add .env.example       # ✅ Template only
git add .env.production.example  # ✅ Template only
```

### 3. Secrets Management

**Development**: `.env` file is acceptable

**Production**: Use dedicated secrets manager

Options:
- AWS Secrets Manager
- Azure Key Vault
- Google Cloud Secret Manager
- HashiCorp Vault
- Kubernetes Secrets
- Docker Secrets

**Example (AWS Secrets Manager)**:
```javascript
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function loadSecrets() {
  const secret = await secretsManager
    .getSecretValue({ SecretId: 'master-auth/production' })
    .promise();

  const secrets = JSON.parse(secret.SecretString);
  process.env.JWT_SECRET = secrets.JWT_SECRET;
  // ... load other secrets
}
```

### 4. Rotation Schedule

| Secret | Rotation Frequency | Reason |
|--------|-------------------|--------|
| `JWT_SECRET` | 6-12 months | Invalidates all tokens |
| `ADMIN_PASSWORD` | 90 days | Security best practice |
| `SUPABASE_SERVICE_KEY` | 90 days | Limit exposure window |

### 5. Access Control

**Who should have access**:
- Development: All developers
- Staging: Dev team + QA
- Production: DevOps + Senior developers only

**How to share**:
- ❌ Email, Slack, chat
- ❌ Shared documents
- ✅ Password manager (1Password, LastPass, Bitwarden)
- ✅ Secrets manager
- ✅ Encrypted storage

### 6. Audit Logging

Log all access to production secrets:
- Who accessed
- When accessed
- What was accessed
- From where (IP address)

### 7. Backup

- ✅ Backup production `.env` in secure location
- ✅ Encrypted backup
- ✅ Access-controlled storage
- ✅ Regular backup verification

---

## Validation

The application validates environment variables on startup. See [Validation Implementation](#validation-implementation) for technical details.

### Validation Rules

| Variable | Validation |
|----------|------------|
| `SUPABASE_URL` | Must be valid HTTPS URL matching Supabase pattern |
| `SUPABASE_SERVICE_KEY` | Must be non-empty string (JWT format) |
| `JWT_SECRET` | Must be at least 32 characters |
| `TOKEN_EXPIRATION` | Must be positive integer |
| `ALLOWED_ORIGINS` | Must contain at least one valid URL |
| `ADMIN_USERNAME` | Must be non-empty string |
| `ADMIN_PASSWORD` | Must be at least 16 characters |
| `PORT` | Must be integer between 1-65535 |

### Validation Errors

**Example error output**:
```
❌ Environment validation failed:
  - JWT_SECRET: Must be at least 32 characters (current: 12)
  - SUPABASE_URL: Required variable is missing
  - ADMIN_PASSWORD: Must be at least 16 characters (current: 8)

Server cannot start until all environment variables are valid.
Please check your .env file and refer to docs/ENVIRONMENT_VARIABLES.md
```

---

## Troubleshooting

### Common Issues

#### 1. "Missing Supabase environment variables"

**Cause**: `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` not set

**Solution**:
```bash
# Check if variables are set
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY

# Verify .env file exists and is readable
ls -la .env
cat .env | grep SUPABASE

# Ensure dotenv is loading
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"
```

#### 2. "JWT secret not configured"

**Cause**: `JWT_SECRET` not set or too short

**Solution**:
```bash
# Generate new secret
openssl rand -base64 32

# Add to .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

#### 3. "Origin not allowed by CORS"

**Cause**: Request origin not in `ALLOWED_ORIGINS`

**Solution**:
```bash
# Check current origins
echo $ALLOWED_ORIGINS

# Add your frontend URL
ALLOWED_ORIGINS=https://your-frontend.com,http://localhost:3000
```

#### 4. "Admin credentials not configured"

**Cause**: `ADMIN_USERNAME` or `ADMIN_PASSWORD` not set

**Solution**:
```bash
# Set admin credentials
ADMIN_USERNAME=your_admin_user
ADMIN_PASSWORD=$(openssl rand -base64 24)
```

#### 5. "Port 3001 already in use"

**Cause**: Another process using the port

**Solution**:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# Mac/Linux
lsof -ti:3001 | xargs kill -9

# Or use different port
PORT=3002
```

#### 6. Environment variables not loading in Docker

**Cause**: `.env` file not mounted or `--env-file` not specified

**Solution**:
```bash
# With docker-compose (automatic)
docker-compose up

# With docker run (manual)
docker run --env-file .env -p 3001:3001 master-auth-backend

# Or use environment variables directly
docker run -e PORT=3001 -e NODE_ENV=production ...
```

---

## Additional Resources

- [.env.example](../.env.example) - Development template
- [.env.production.example](../.env.production.example) - Production template
- [API Documentation](./API_DOCUMENTATION.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Deployment Guide](../README.md#deployment)

---

**Last Updated**: 2025-12-03
**Version**: 1.0.0
