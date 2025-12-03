# Master Password Authentication Backend

A secure authentication middleware API that generates and validates JWE (JSON Web Encryption) tokens using master password authentication.

## Features

- 🔐 **Secure Token Generation** - JWE tokens with A256GCM encryption
- 🔑 **Master Password Authentication** - Single password for multiple applications
- ✅ **Token Validation** - Verify and decode encrypted tokens
- 🔄 **Token Refresh** - Refresh tokens before expiration
- 🚫 **Token Revocation** - Logout and revoke tokens
- 📊 **Audit Logging** - Complete logging of all authentication events
- 🛡️ **Rate Limiting** - Protection against brute force attacks
- 👨‍💼 **Admin Panel** - Query and manage audit logs
- 📖 **Interactive API Docs** - Swagger UI for testing

## Quick Start

### Prerequisites

- Node.js 14+
- Supabase account
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/divya-rbits/master-auth-be.git
cd master-auth-be

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Start server
npm start
```

### Environment Variables

```env
# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key

# Master Password (hashed with Argon2)
MASTER_PASSWORD_HASH=your-argon2-hash

# JWT Configuration
JWT_SECRET=your-jwt-secret

# Admin Credentials
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=your-admin-password
ADMIN_JWT_SECRET=your-admin-jwt-secret

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Test the API

```bash
# Health check
curl http://localhost:3001/health

# View API documentation
open http://localhost:3001/api-docs
```

## Documentation

### API Documentation

- **[API Documentation](docs/API_DOCUMENTATION.md)** - Complete API reference with request/response examples
- **[Error Codes](docs/ERROR_CODES.md)** - Detailed error codes and handling strategies
- **[Integration Guide](docs/INTEGRATION_GUIDE.md)** - Step-by-step integration with code examples
- **[Environment Variables](docs/ENVIRONMENT_VARIABLES.md)** - Complete environment variable reference
- **[Environment Setup](docs/ENVIRONMENT_SETUP.md)** - Environment-specific configuration guide
- **[Audit Logging](docs/AUDIT_LOGGING.md)** - Comprehensive audit logging documentation

### Interactive Documentation

Swagger UI is available at: `http://localhost:3001/api-docs`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Authenticate and get token |
| POST | `/api/auth/validate` | Validate token |
| POST | `/api/auth/logout` | Revoke token |
| POST | `/api/auth/refresh` | Refresh token |

### Token Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/token/status` | Get token status |
| POST | `/api/auth/token/revoke` | Revoke specific token |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/logs` | Query audit logs |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

## Usage Example

```javascript
// Login
const response = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    password: 'YourMasterPassword',
    application_id: 'web-app-001'
  })
});

const { token, salt } = await response.json();

// Validate token
const validateResponse = await fetch('http://localhost:3001/api/auth/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, salt })
});

const { valid, payload } = await validateResponse.json();
```

See [Integration Guide](docs/INTEGRATION_GUIDE.md) for more examples.

## Security Features

- **JWE Encryption** - Tokens encrypted with A256GCM
- **Argon2 Password Hashing** - Memory-hard hashing algorithm
- **PBKDF2 Key Derivation** - 100,000 iterations with unique salts
- **Rate Limiting** - Protection against brute force
- **CORS Configuration** - Whitelist allowed origins
- **Security Headers** - Helmet.js security headers
- **Audit Logging** - All events logged to database
- **Token Revocation** - Explicit logout and revocation support

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Login | 5 requests/minute |
| Validate | 100 requests/minute |
| Admin | 100 requests/minute |

## Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- auth

# Run with coverage
npm test -- --coverage
```

### Test Results

- ✅ Unit Tests: 100+ tests passing
- ✅ Integration Tests: 40+ tests passing
- ✅ Code Coverage: 85%+

## Project Structure

```
master-auth-be/
├── src/
│   ├── config/           # Configuration files
│   │   ├── logger.js
│   │   └── swagger.js
│   ├── controllers/      # Request handlers
│   │   ├── authController.js
│   │   └── adminLogsController.js
│   ├── middleware/       # Express middleware
│   │   ├── adminAuth.js
│   │   ├── corsConfig.js
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   ├── requestLogger.js
│   │   ├── securityHeaders.js
│   │   └── validation.js
│   ├── routes/           # API routes
│   │   ├── admin.js
│   │   └── auth.js
│   ├── services/         # Business logic
│   │   ├── database.js
│   │   ├── jwe.js
│   │   ├── jwt.js
│   │   ├── kdf.js
│   │   ├── password.js
│   │   └── token.js
│   ├── utils/            # Utilities
│   │   └── errors.js
│   └── index.js          # Entry point
├── tests/                # Test files
├── docs/                 # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── AUDIT_LOGGING.md
│   ├── ERROR_CODES.md
│   └── INTEGRATION_GUIDE.md
├── .env.example          # Environment template
├── package.json
└── README.md
```

## Architecture

### Token Flow

```
1. User provides master password
2. Password verified with Argon2
3. Generate JWT with claims
4. Derive CEK from master password + salt (PBKDF2)
5. Encrypt JWT with JWE (A256GCM)
6. Return encrypted token + salt
```

### Validation Flow

```
1. Receive token + salt
2. Derive CEK from master password + salt
3. Decrypt JWE to get JWT
4. Verify JWT signature
5. Check token expiration
6. Check revocation status
7. Return payload if valid
```

## Technologies

- **Express.js** - Web framework
- **Supabase** - Database and authentication
- **jose** - JWE encryption
- **jsonwebtoken** - JWT handling
- **Argon2** - Password hashing
- **Swagger** - API documentation
- **Jest** - Testing framework

## Development

### Run in Development Mode

```bash
npm run dev
```

### Lint Code

```bash
npm run lint
```

### Generate Password Hash

```bash
node -e "const argon2 = require('argon2'); argon2.hash('YourPassword').then(console.log)"
```

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong master password
- [ ] Configure HTTPS
- [ ] Set up CORS whitelist
- [ ] Configure rate limits
- [ ] Enable audit logging
- [ ] Set up log rotation
- [ ] Configure database backups
- [ ] Set up monitoring
- [ ] Review security headers

### Docker Deployment

#### Using Docker Compose (Recommended)

```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

#### Using Docker CLI

```bash
# Build image
docker build -t master-auth-backend:latest .

# Run container
docker run -d \
  --name master-auth-backend \
  -p 3001:3001 \
  --env-file .env \
  master-auth-backend:latest

# View logs
docker logs -f master-auth-backend

# Stop container
docker stop master-auth-backend

# Remove container
docker rm master-auth-backend
```

#### Docker Configuration

The application includes:
- **Multi-stage build** for optimized image size
- **Node.js 24 Alpine** base image (lightweight)
- **Non-root user** for security
- **Health checks** built-in
- **Volume mounts** for development logs
- **Automatic restart** policy

#### Docker Image Details

- Base: `node:24-alpine`
- Size: ~180MB (optimized)
- Port: 3001
- Health Check: `/health` endpoint
- User: `node` (non-root)

#### Troubleshooting Docker

**Port already in use:**
```bash
# Check what's using port 3001
netstat -ano | findstr :3001  # Windows
lsof -i :3001                  # Mac/Linux

# Use a different port
docker run -p 3002:3001 --env-file .env master-auth-backend:latest
```

**Container not starting:**
```bash
# Check logs
docker logs master-auth-backend

# Check environment variables
docker exec master-auth-backend env
```

**Permission issues:**
```bash
# The container runs as non-root user 'node' (uid: 1000)
# Ensure logs directory is writable
chmod -R 755 logs
```

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

### Audit Logs

Query audit logs via admin API:

```bash
curl -u admin@localhost:password \
  "http://localhost:3001/api/admin/logs?event_type=login_failed&limit=20"
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License.

## Support

- **Documentation**: [docs/](docs/)
- **API Docs**: http://localhost:3001/api-docs
- **Issues**: https://github.com/divya-rbits/master-auth-be/issues

## Roadmap

- [ ] Multi-factor authentication
- [ ] WebSocket support for real-time updates
- [ ] Application management endpoints
- [ ] Token analytics dashboard
- [ ] Performance optimization
- [x] Docker Compose setup
- [ ] CI/CD pipeline

## Changelog

### v1.0.0 (2025-12-03)

- ✅ Core authentication endpoints
- ✅ JWE token encryption
- ✅ Audit logging system
- ✅ Rate limiting
- ✅ Admin panel
- ✅ Comprehensive documentation
- ✅ Swagger API docs
- ✅ 100+ tests

## Acknowledgments

- Built with security best practices
- Follows OWASP guidelines
- Uses industry-standard cryptography

---

Made with ❤️ for secure authentication
