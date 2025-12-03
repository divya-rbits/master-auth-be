# Environment-Specific Configuration Guide

Complete guide for configuring the Master Password Authentication Backend across different environments.

## Table of Contents

- [Overview](#overview)
- [Development Environment](#development-environment)
- [Staging Environment](#staging-environment)
- [Production Environment](#production-environment)
- [Docker Environment](#docker-environment)
- [Testing Environment](#testing-environment)
- [Migration Between Environments](#migration-between-environments)
- [Security Checklist](#security-checklist)

## Overview

The application supports multiple environments, each with specific configuration requirements and security considerations.

**Environment Types**:
- **Development**: Local development with relaxed security
- **Staging**: Pre-production testing with production-like settings
- **Production**: Live environment with maximum security
- **Docker**: Containerized deployment
- **Testing**: Automated test execution

## Development Environment

### Purpose
Local development and debugging with developer-friendly settings.

### Setup Instructions

1. **Copy template**:
   ```bash
   cp .env.example .env
   ```

2. **Configure variables**:
   ```bash
   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # Supabase Configuration (use development project)
   SUPABASE_URL=https://your-dev-project.supabase.co
   SUPABASE_SERVICE_KEY=your_dev_service_key_here

   # Authentication (can be simpler for dev)
   JWT_SECRET=development_jwt_secret_at_least_32_characters_long_abc123
   TOKEN_EXPIRATION=7200  # 2 hours for convenience

   # CORS (allow local frontend)
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080

   # Admin Panel (simpler credentials OK for dev)
   ADMIN_USERNAME=dev_admin
   ADMIN_PASSWORD=dev_admin_password_16chars
   ```

3. **Start server**:
   ```bash
   npm run dev
   ```

### Characteristics

| Feature | Configuration |
|---------|---------------|
| Logging | Debug level, verbose |
| Error Messages | Full stack traces |
| Security | Relaxed for debugging |
| Token Expiration | Longer (2-4 hours) |
| CORS | Multiple localhost origins |
| Database | Development Supabase project |

### Best Practices

✅ **Do**:
- Use a separate Supabase development project
- Allow multiple localhost ports for frontend development
- Use longer token expiration for convenience
- Keep credentials simple but not "admin/admin"
- Commit `.env.example` but never `.env`

❌ **Don't**:
- Use production credentials in development
- Commit `.env` file to version control
- Share `.env` file via email/chat
- Use the same JWT_SECRET across environments

### Troubleshooting

**Issue**: Port 3001 already in use
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# Mac/Linux
lsof -ti:3001 | xargs kill -9

# Or change port
PORT=3002 npm run dev
```

**Issue**: CORS errors from frontend
```bash
# Add your frontend URL to ALLOWED_ORIGINS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080
```

---

## Staging Environment

### Purpose
Pre-production testing environment that mirrors production settings.

### Setup Instructions

1. **Copy production template**:
   ```bash
   cp .env.production.example .env.staging
   ```

2. **Configure variables**:
   ```bash
   # Server Configuration
   PORT=3001
   NODE_ENV=staging

   # Supabase Configuration (use staging project)
   SUPABASE_URL=https://your-staging-project.supabase.co
   SUPABASE_SERVICE_KEY=your_staging_service_key_here

   # Authentication (production-strength)
   JWT_SECRET=$(openssl rand -base64 48)
   TOKEN_EXPIRATION=3600

   # CORS (only staging domain)
   ALLOWED_ORIGINS=https://staging.yourdomain.com

   # Admin Panel (strong credentials)
   ADMIN_USERNAME=staging_admin_$(openssl rand -hex 4)
   ADMIN_PASSWORD=$(openssl rand -base64 24)
   ```

3. **Deploy and start**:
   ```bash
   # Copy to server
   scp .env.staging user@staging-server:/app/.env

   # On server
   cd /app
   NODE_ENV=staging npm start
   ```

### Characteristics

| Feature | Configuration |
|---------|---------------|
| Logging | Info level |
| Error Messages | Sanitized |
| Security | Production-level |
| Token Expiration | Same as production (1 hour) |
| CORS | Staging domain only |
| Database | Separate staging Supabase project |

### Best Practices

✅ **Do**:
- Use production-strength credentials
- Separate database from production
- Test production deployment process
- Mirror production security settings
- Document differences from production
- Use HTTPS only

❌ **Don't**:
- Share database with production
- Use weak credentials
- Allow HTTP in CORS
- Skip security validations
- Use production secrets

### Testing Checklist

Before promoting to production:
- [ ] Environment validation passes
- [ ] All API endpoints working
- [ ] CORS configured correctly
- [ ] Admin panel accessible
- [ ] Logging working
- [ ] Health check responding
- [ ] Token generation/validation working
- [ ] Database migrations applied
- [ ] Performance acceptable

---

## Production Environment

### Purpose
Live production environment serving real users.

### Setup Instructions

1. **Copy production template**:
   ```bash
   cp .env.production.example .env
   ```

2. **Generate secure credentials**:
   ```bash
   # JWT Secret (64 characters recommended)
   echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env

   # Admin Password (24+ characters)
   echo "ADMIN_PASSWORD=$(openssl rand -base64 32)" >> .env
   ```

3. **Configure variables**:
   ```bash
   # Server Configuration
   PORT=3001
   NODE_ENV=production

   # Supabase Configuration
   SUPABASE_URL=https://your-production-project.supabase.co
   SUPABASE_SERVICE_KEY=your_production_service_key_here

   # Authentication (use generated values above)
   JWT_SECRET=<paste generated JWT secret>
   TOKEN_EXPIRATION=3600

   # CORS (production domains only)
   ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

   # Admin Panel
   ADMIN_USERNAME=prod_admin_<unique_suffix>
   ADMIN_PASSWORD=<paste generated admin password>
   ```

4. **Secure the file**:
   ```bash
   chmod 600 .env
   chown appuser:appuser .env
   ```

5. **Verify configuration**:
   ```bash
   # Test validation (will show errors if any)
   node -e "require('dotenv').config(); require('./src/config/validateEnv').validateEnvironment()"
   ```

### Characteristics

| Feature | Configuration |
|---------|---------------|
| Logging | Warn/Error level only |
| Error Messages | Generic, no details |
| Security | Maximum |
| Token Expiration | 1 hour (recommended) |
| CORS | Production domains only, HTTPS |
| Database | Production Supabase project |
| Secrets | Stored in secrets manager |

### Security Requirements

**CRITICAL SECURITY CHECKLIST**:

#### Credentials
- [ ] `JWT_SECRET` is 64+ characters, cryptographically random
- [ ] `ADMIN_PASSWORD` is 24+ characters, high entropy
- [ ] `ADMIN_USERNAME` is unique, not "admin" or common username
- [ ] Different credentials from staging/development
- [ ] Credentials stored in password manager

#### Configuration
- [ ] `NODE_ENV=production`
- [ ] `ALLOWED_ORIGINS` contains only HTTPS URLs
- [ ] No localhost or HTTP URLs in `ALLOWED_ORIGINS`
- [ ] `SUPABASE_SERVICE_KEY` is correct for production project
- [ ] File permissions set to 600 (chmod 600 .env)

#### Deployment
- [ ] `.env` file NOT committed to version control
- [ ] Backup of `.env` stored securely (encrypted)
- [ ] Secrets also stored in secrets manager (AWS/Azure/GCP)
- [ ] Environment validation passes
- [ ] Health check endpoint working
- [ ] Monitoring and alerting configured
- [ ] Log rotation configured

#### Network
- [ ] HTTPS enforced (no HTTP)
- [ ] TLS 1.2+ only
- [ ] Security headers enabled
- [ ] Rate limiting active
- [ ] Firewall configured

### Secrets Management

**Using AWS Secrets Manager**:

```javascript
// config/secrets.js
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({ region: 'us-east-1' });

async function loadProductionSecrets() {
  const secret = await secretsManager
    .getSecretValue({ SecretId: 'master-auth/production' })
    .promise();

  const secrets = JSON.parse(secret.SecretString);

  process.env.JWT_SECRET = secrets.JWT_SECRET;
  process.env.ADMIN_PASSWORD = secrets.ADMIN_PASSWORD;
  process.env.SUPABASE_SERVICE_KEY = secrets.SUPABASE_SERVICE_KEY;
}

if (process.env.NODE_ENV === 'production') {
  loadProductionSecrets();
}
```

**Using Docker Secrets**:

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    image: master-auth-backend
    secrets:
      - jwt_secret
      - admin_password
      - supabase_key

secrets:
  jwt_secret:
    external: true
  admin_password:
    external: true
  supabase_key:
    external: true
```

### Monitoring

**Key Metrics**:
- Server uptime
- Response times
- Error rates
- Failed authentication attempts
- Admin panel access logs

**Health Check**:
```bash
# Automated health check
curl -f https://api.yourdomain.com/health || alert_team
```

**Log Monitoring**:
```bash
# Monitor error logs
tail -f logs/error.log | grep -i "error\|fatal\|critical"
```

---

## Docker Environment

### Purpose
Containerized deployment for consistency across environments.

### Setup Instructions

1. **Create `.env` file** (as above for your target environment)

2. **Build image**:
   ```bash
   docker build -t master-auth-backend:latest .
   ```

3. **Run with docker-compose**:
   ```bash
   docker-compose up -d
   ```

4. **Or run with docker CLI**:
   ```bash
   docker run -d \
     --name master-auth-backend \
     -p 3001:3001 \
     --env-file .env \
     --restart unless-stopped \
     master-auth-backend:latest
   ```

### Docker-Specific Configuration

**docker-compose.yml**:
```yaml
services:
  backend:
    build: .
    container_name: master-auth-backend
    ports:
      - "3001:3001"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health')"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### Environment Variables in Docker

**Option 1: .env file** (recommended for development)
```bash
docker-compose up -d  # Automatically loads .env
```

**Option 2: Environment section** (for simple configs)
```yaml
environment:
  - PORT=3001
  - NODE_ENV=production
```

**Option 3: Docker secrets** (recommended for production)
```yaml
secrets:
  - jwt_secret
  - admin_password
```

**Option 4: Inline** (not recommended, for testing only)
```bash
docker run -e PORT=3001 -e NODE_ENV=production ...
```

### Best Practices

✅ **Do**:
- Use `.env` file with docker-compose
- Use Docker secrets in production
- Set appropriate file permissions on host
- Use non-root user in container (already configured)
- Monitor container logs

❌ **Don't**:
- Hardcode secrets in docker-compose.yml
- Commit .env to version control
- Run as root inside container
- Use same .env across environments

---

## Testing Environment

### Purpose
Automated test execution with isolated test database.

### Setup Instructions

1. **Create `.env.test`**:
   ```bash
   # Server Configuration
   PORT=3001
   NODE_ENV=test

   # Test Database
   SUPABASE_URL=https://your-test-project.supabase.co
   SUPABASE_SERVICE_KEY=your_test_service_key_here

   # Test Credentials (can be simpler)
   JWT_SECRET=test_jwt_secret_minimum_32_characters_long_for_testing
   TOKEN_EXPIRATION=3600
   ALLOWED_ORIGINS=http://localhost:3000
   ADMIN_USERNAME=test_admin
   ADMIN_PASSWORD=test_admin_password_16chars
   ```

2. **Run tests**:
   ```bash
   NODE_ENV=test npm test
   ```

### Characteristics

- Isolated test database (reset between test runs)
- Fast token expiration for testing
- Simplified credentials
- No external integrations
- Deterministic behavior

---

## Migration Between Environments

### Development → Staging

1. **Update configuration**:
   ```bash
   # Copy staging template
   cp .env.production.example .env.staging

   # Update with staging values
   # - Staging Supabase project
   # - Staging domain in ALLOWED_ORIGINS
   # - Production-strength credentials
   ```

2. **Run database migrations**:
   ```bash
   # Apply any pending migrations to staging database
   npm run migrate:staging
   ```

3. **Deploy**:
   ```bash
   scp .env.staging user@staging:/app/.env
   ssh user@staging "cd /app && git pull && npm install && pm2 restart all"
   ```

4. **Verify**:
   ```bash
   curl https://staging.yourdomain.com/health
   ```

### Staging → Production

**Pre-deployment Checklist**:
- [ ] All staging tests passing
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Backup plan ready
- [ ] Rollback plan documented
- [ ] Team notified

**Deployment Steps**:

1. **Backup production database**:
   ```bash
   # Export current production data
   npm run db:backup:production
   ```

2. **Prepare production configuration**:
   ```bash
   # Generate new production secrets
   JWT_SECRET=$(openssl rand -base64 64)
   ADMIN_PASSWORD=$(openssl rand -base64 32)

   # Create production .env
   cp .env.production.example .env
   # Fill in all production values
   ```

3. **Upload to secrets manager**:
   ```bash
   aws secretsmanager create-secret \
     --name master-auth/production \
     --secret-string file://.env.json
   ```

4. **Deploy**:
   ```bash
   # Deploy via your CI/CD pipeline or manually
   git checkout main
   git pull
   docker build -t master-auth-backend:v1.0.0 .
   docker tag master-auth-backend:v1.0.0 registry.com/master-auth-backend:latest
   docker push registry.com/master-auth-backend:latest

   # On production server
   docker pull registry.com/master-auth-backend:latest
   docker-compose up -d
   ```

5. **Verify**:
   ```bash
   curl https://api.yourdomain.com/health

   # Check logs
   docker-compose logs -f --tail=100
   ```

6. **Monitor**:
   - Watch error logs for 30 minutes
   - Check response times
   - Verify authentication working
   - Test admin panel access

---

## Security Checklist

### All Environments

- [ ] `.env` file not committed to version control
- [ ] `.env` added to `.gitignore`
- [ ] File permissions set to 600
- [ ] No secrets in code or logs
- [ ] Environment validation enabled

### Development Only

- [ ] Separate Supabase project from production
- [ ] Can use simpler credentials
- [ ] Multiple localhost origins OK
- [ ] Verbose logging OK

### Staging

- [ ] Production-strength credentials
- [ ] Separate database from production
- [ ] HTTPS only in CORS
- [ ] Production-level logging
- [ ] Regular testing schedule

### Production

- [ ] 64+ character JWT_SECRET
- [ ] 24+ character ADMIN_PASSWORD
- [ ] Unique ADMIN_USERNAME
- [ ] HTTPS-only CORS origins
- [ ] Secrets in secrets manager
- [ ] Regular credential rotation (90 days)
- [ ] Monitoring and alerting configured
- [ ] Backup and disaster recovery plan
- [ ] Security audit completed
- [ ] Compliance requirements met

---

## Additional Resources

- [Environment Variables Documentation](./ENVIRONMENT_VARIABLES.md) - Complete variable reference
- [.env.example](../.env.example) - Development template
- [.env.production.example](../.env.production.example) - Production template
- [API Documentation](./API_DOCUMENTATION.md) - API reference
- [Docker Documentation](../README.md#docker-deployment) - Docker setup

---

**Last Updated**: 2025-12-03
**Version**: 1.0.0
