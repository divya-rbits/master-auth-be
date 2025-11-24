# Backend Development Plan

## Overview
Build a secure authentication middleware API that generates and validates JWE tokens using master password authentication. The backend will serve multiple frontend platforms through RESTful APIs.

---

## Phase 1: Project Setup & Environment

### Task 1.1: Initialize Node.js Project
- [ ] Create `backend/` directory
- [ ] Run `npm init -y` to initialize package.json
- [ ] Create `.gitignore` file (ignore node_modules, .env)
- [ ] Create `.env.example` template file
- [ ] Create basic project structure:
  ```
  backend/
  ├── src/
  │   ├── config/
  │   ├── controllers/
  │   ├── middleware/
  │   ├── routes/
  │   ├── services/
  │   ├── utils/
  │   └── index.js
  ├── tests/
  ├── .env
  └── package.json
  ```

**Completion Criteria**: Directory structure created, package.json initialized

---

### Task 1.2: Install Core Dependencies
- [ ] Install Express.js: `npm install express`
- [ ] Install dotenv: `npm install dotenv`
- [ ] Install cors: `npm install cors`
- [ ] Install helmet: `npm install helmet`
- [ ] Install express-rate-limit: `npm install express-rate-limit`

**Completion Criteria**: All core dependencies installed in package.json

---

### Task 1.3: Install Cryptography & Authentication Libraries
- [ ] Install jose (JWE): `npm install jose`
- [ ] Install jsonwebtoken (JWT): `npm install jsonwebtoken`
- [ ] Install argon2 (password hashing): `npm install argon2`
- [ ] Install uuid (unique IDs): `npm install uuid`

**Completion Criteria**: All crypto libraries installed

---

### Task 1.4: Install Supabase Client
- [ ] Install Supabase: `npm install @supabase/supabase-js`
- [ ] Create `src/config/supabase.js` file
- [ ] Create environment variables structure in `.env.example`:
  ```
  SUPABASE_URL=
  SUPABASE_SERVICE_KEY=
  MASTER_PASSWORD_HASH=
  JWT_SECRET=
  PORT=3001
  NODE_ENV=development
  ```

**Completion Criteria**: Supabase client ready, env template created

---

### Task 1.5: Create Basic Express Server
- [ ] Create `src/index.js` with basic Express setup
- [ ] Add middleware: helmet, cors, express.json()
- [ ] Create health check endpoint: `GET /health`
- [ ] Add error handling middleware
- [ ] Test server starts on specified port

**Completion Criteria**: Server runs and responds to `/health` endpoint

---

## Phase 2: Database Setup

### Task 2.1: Create Supabase Account & Project
- [ ] Sign up at https://supabase.com
- [ ] Create new project
- [ ] Note down Project URL and Service Role Key
- [ ] Add credentials to `.env` file

**Completion Criteria**: Supabase project created, credentials saved

---

### Task 2.2: Create Database Schema
- [ ] Open Supabase SQL Editor
- [ ] Create `auth_config` table (password hash storage)
- [ ] Create `revoked_tokens` table (token revocation)
- [ ] Create `applications` table (registered apps)
- [ ] Create `audit_logs` table (authentication events)
- [ ] Add necessary indexes
- [ ] Create `cleanup_expired_tokens()` function

**Completion Criteria**: All tables created, schema visible in Supabase dashboard

---

### Task 2.3: Implement Supabase Database Service
- [ ] Create `src/services/database.js`
- [ ] Implement Supabase client initialization
- [ ] Add method: `getPasswordHash()`
- [ ] Add method: `updatePasswordHash(newHash)`
- [ ] Add method: `isTokenRevoked(jti)`
- [ ] Add method: `revokeToken(...params)`
- [ ] Add method: `logEvent(eventType, details)`
- [ ] Add method: `verifyApplication(appId, appSecret)`

**Completion Criteria**: Database service class with all methods implemented

---

### Task 2.4: Seed Initial Data
- [ ] Generate initial master password hash using Argon2
- [ ] Insert hash into `auth_config` table (id=1)
- [ ] Create test application entry in `applications` table
- [ ] Verify data inserted correctly via Supabase dashboard

**Completion Criteria**: Database contains initial password hash and test app

---

## Phase 3: Core Cryptography Services

### Task 3.1: Implement Password Service
- [ ] Create `src/services/password.js`
- [ ] Implement `hashPassword(password)` using Argon2
- [ ] Implement `verifyPassword(password, hash)` using Argon2
- [ ] Configure Argon2 parameters (memory, iterations, parallelism)
- [ ] Add error handling for hashing failures

**Completion Criteria**: Password hashing and verification working

---

### Task 3.2: Implement JWT Service (Inner Token)
- [ ] Create `src/services/jwt.js`
- [ ] Implement `generateJWT(payload)` - creates signed JWT
- [ ] Implement `verifyJWT(token)` - verifies signature and returns payload
- [ ] Configure JWT parameters (algorithm: HS256, expiration)
- [ ] Add claim validation (exp, iat, jti)

**Completion Criteria**: JWT generation and verification working

---

### Task 3.3: Implement Key Derivation Service
- [ ] Create `src/services/kdf.js`
- [ ] Implement `deriveKey(password, salt, iterations)` using PBKDF2
- [ ] Set default parameters: 100,000 iterations, 32-byte key, SHA-256
- [ ] Implement `generateSalt()` - creates random 16-byte salt
- [ ] Add salt encoding/decoding utilities

**Completion Criteria**: CEK derivation from password working

---

### Task 3.4: Implement JWE Service (Outer Encryption)
- [ ] Create `src/services/jwe.js`
- [ ] Implement `encryptJWE(jwt, cek)` using jose library
- [ ] Implement `decryptJWE(jwe, cek)` using jose library
- [ ] Configure JWE headers: alg='dir', enc='A256GCM'
- [ ] Handle encryption/decryption errors
- [ ] Validate authentication tags

**Completion Criteria**: JWE encryption and decryption working

---

### Task 3.5: Implement Token Service (Orchestration)
- [ ] Create `src/services/token.js`
- [ ] Implement `generateToken(appId, userContext)`:
  - Create JWT payload with claims
  - Sign JWT using JWT service
  - Generate salt
  - Derive CEK using master password
  - Encrypt JWT with JWE
  - Return complete JWE token
- [ ] Implement `validateToken(jweToken)`:
  - Parse JWE
  - Derive CEK from master password
  - Decrypt JWE to get JWT
  - Verify JWT signature
  - Validate claims (exp, jti, etc.)
  - Check revocation status
  - Return payload if valid

**Completion Criteria**: End-to-end token generation and validation working

---

## Phase 4: API Endpoints - Authentication

### Task 4.1: Create Authentication Controller
- [ ] Create `src/controllers/authController.js`
- [ ] Implement `login(req, res)` controller
- [ ] Implement `validate(req, res)` controller
- [ ] Implement `logout(req, res)` controller
- [ ] Implement `refresh(req, res)` controller
- [ ] Add proper error handling and status codes

**Completion Criteria**: All controller methods defined

---

### Task 4.2: Implement Login Endpoint
- [ ] Create route: `POST /api/auth/login`
- [ ] Extract `password` and `application_id` from request body
- [ ] Validate input (password not empty, app_id present)
- [ ] Retrieve password hash from database
- [ ] Verify password using password service
- [ ] If invalid: log failure, return 401 error
- [ ] If valid: generate JWE token
- [ ] Log successful login event
- [ ] Return token with expiration info

**Completion Criteria**: Login endpoint returns JWE token for valid password

---

### Task 4.3: Implement Validate Endpoint
- [ ] Create route: `POST /api/auth/validate`
- [ ] Extract `token` from request body
- [ ] Call token service to validate token
- [ ] Check if token is in revocation list
- [ ] If invalid/revoked: log event, return 401 error
- [ ] If valid: return success with remaining expiration time
- [ ] Include permissions and session_id in response

**Completion Criteria**: Validate endpoint correctly validates tokens

---

### Task 4.4: Implement Logout Endpoint
- [ ] Create route: `POST /api/auth/logout`
- [ ] Extract token from Authorization header
- [ ] Validate token structure
- [ ] Decrypt token to get payload (jti, exp)
- [ ] Add jti to revoked_tokens table
- [ ] Log logout event
- [ ] Return success response
- [ ] Handle case where token already revoked

**Completion Criteria**: Logout endpoint revokes tokens successfully

---

### Task 4.5: Implement Refresh Endpoint
- [ ] Create route: `POST /api/auth/refresh`
- [ ] Extract existing token from request
- [ ] Validate token is not expired (or recently expired)
- [ ] Validate token is not revoked
- [ ] Generate new token with extended expiration
- [ ] Optionally revoke old token
- [ ] Return new JWE token
- [ ] Log refresh event

**Completion Criteria**: Refresh endpoint generates new tokens

---

## Phase 5: API Endpoints - Token Management

### Task 5.1: Implement Token Status Endpoint
- [ ] Create route: `GET /api/token/status`
- [ ] Extract token from Authorization header or request body
- [ ] Decrypt and validate token
- [ ] Return detailed status:
  - Valid: true/false
  - Expires in: seconds remaining
  - Issued at: timestamp
  - Session ID
  - Application ID
  - Revoked: true/false
- [ ] Handle expired tokens gracefully

**Completion Criteria**: Status endpoint returns detailed token info

---

### Task 5.2: Implement Token Revoke Endpoint
- [ ] Create route: `POST /api/token/revoke`
- [ ] Require authentication (must have valid token)
- [ ] Extract token to revoke from request body
- [ ] Validate requesting token has permission
- [ ] Add specified token to revocation list
- [ ] Log revocation event with reason
- [ ] Return success confirmation

**Completion Criteria**: Revoke endpoint adds tokens to revocation list

---

## Phase 6: Security & Middleware

### Task 6.1: Implement Rate Limiting
- [ ] Create rate limiter for login endpoint (5 attempts/minute)
- [ ] Create rate limiter for validation endpoint (100 requests/minute)
- [ ] Add rate limiting middleware to routes
- [ ] Return 429 status when rate limit exceeded
- [ ] Log rate limit violations

**Completion Criteria**: Rate limiting prevents brute force attacks

---

### Task 6.2: Implement Request Validation Middleware
- [ ] Create `src/middleware/validation.js`
- [ ] Add schema validation for login request
- [ ] Add schema validation for validate request
- [ ] Add schema validation for logout request
- [ ] Validate required fields are present
- [ ] Return 400 for invalid requests

**Completion Criteria**: Invalid requests rejected before processing

---

### Task 6.3: Implement CORS Configuration
- [ ] Configure CORS to allow specific origins
- [ ] Set allowed methods: POST, GET
- [ ] Set allowed headers: Content-Type, Authorization
- [ ] Enable credentials if needed
- [ ] Create whitelist of allowed domains

**Completion Criteria**: CORS properly configured for cross-origin requests

---

### Task 6.4: Implement Security Headers
- [ ] Use Helmet.js for security headers
- [ ] Configure Content-Security-Policy
- [ ] Set X-Frame-Options: DENY
- [ ] Set X-Content-Type-Options: nosniff
- [ ] Disable X-Powered-By header
- [ ] Enable HSTS (Strict-Transport-Security)

**Completion Criteria**: Security headers present in all responses

---

### Task 6.5: Implement Error Handling Middleware
- [ ] Create global error handler middleware
- [ ] Catch and format all errors consistently
- [ ] Never expose sensitive error details
- [ ] Log errors with appropriate severity
- [ ] Return user-friendly error messages
- [ ] Map error types to appropriate HTTP status codes

**Completion Criteria**: All errors handled gracefully

---

## Phase 7: Logging & Monitoring

### Task 7.1: Implement Audit Logging Service
- [ ] Enhance database service with detailed logging
- [ ] Log all authentication attempts (success/failure)
- [ ] Log all token validations
- [ ] Log all token revocations
- [ ] Include IP address, user agent, timestamp
- [ ] Store structured data in audit_logs table

**Completion Criteria**: All auth events logged to database

---

### Task 7.2: Implement Application Logging
- [ ] Install winston or pino logger: `npm install winston`
- [ ] Configure log levels (error, warn, info, debug)
- [ ] Create log format with timestamps
- [ ] Log to console in development
- [ ] Log to file in production
- [ ] Implement log rotation

**Completion Criteria**: Application logs available for debugging

---

### Task 7.3: Create Audit Log Query Endpoints
- [ ] Create route: `GET /api/admin/logs`
- [ ] Add authentication for admin endpoints
- [ ] Implement filtering by event type
- [ ] Implement filtering by date range
- [ ] Implement filtering by application ID
- [ ] Implement pagination
- [ ] Return formatted log entries

**Completion Criteria**: Admin can query audit logs via API

---

## Phase 8: Testing

### Task 8.1: Setup Testing Framework
- [ ] Install Jest: `npm install --save-dev jest`
- [ ] Install Supertest: `npm install --save-dev supertest`
- [ ] Configure Jest in package.json
- [ ] Create test script: `npm test`
- [ ] Create `tests/` directory structure

**Completion Criteria**: Testing framework ready

---

### Task 8.2: Write Unit Tests - Cryptography Services
- [ ] Test password hashing and verification
- [ ] Test JWT generation and verification
- [ ] Test key derivation with different inputs
- [ ] Test JWE encryption and decryption
- [ ] Test salt generation uniqueness
- [ ] Test error handling in crypto functions

**Completion Criteria**: All crypto services have unit tests

---

### Task 8.3: Write Integration Tests - Authentication Flow
- [ ] Test complete login flow with valid password
- [ ] Test login with invalid password
- [ ] Test token validation with valid token
- [ ] Test token validation with expired token
- [ ] Test token validation with tampered token
- [ ] Test logout flow and revocation

**Completion Criteria**: Auth flow integration tests passing

---

### Task 8.4: Write API Endpoint Tests
- [ ] Test all endpoints with valid inputs
- [ ] Test all endpoints with invalid inputs
- [ ] Test authentication requirements
- [ ] Test rate limiting behavior
- [ ] Test CORS headers in responses
- [ ] Test error responses format

**Completion Criteria**: All API endpoints have tests

---

### Task 8.5: Write Security Tests
- [ ] Test token tampering detection
- [ ] Test replay attack prevention
- [ ] Test rate limiting effectiveness
- [ ] Test password brute force protection
- [ ] Test SQL injection attempts (Supabase handles this)
- [ ] Test XSS in error messages

**Completion Criteria**: Security tests validate protection mechanisms

---

## Phase 9: Documentation

### Task 9.1: Create API Documentation
- [ ] Document all API endpoints
- [ ] Include request/response examples
- [ ] Document error codes and meanings
- [ ] Document authentication requirements
- [ ] Document rate limits
- [ ] Create OpenAPI/Swagger spec (optional)

**Completion Criteria**: API documentation complete

---

### Task 9.2: Create Integration Guide
- [ ] Write step-by-step integration guide
- [ ] Provide code examples for different platforms
- [ ] Document token storage best practices
- [ ] Document error handling recommendations
- [ ] Create FAQ section
- [ ] Add troubleshooting guide

**Completion Criteria**: Developers can integrate using documentation

---

## Phase 10: Deployment Preparation

### Task 10.1: Create Docker Configuration
- [ ] Create `Dockerfile` for backend
- [ ] Create `.dockerignore` file
- [ ] Build and test Docker image locally
- [ ] Create `docker-compose.yml` for local development
- [ ] Document Docker deployment process

**Completion Criteria**: Backend runs in Docker container

---

### Task 10.2: Configure Environment Variables
- [ ] Review all environment variables needed
- [ ] Create production `.env.example`
- [ ] Document each variable's purpose
- [ ] Set up environment variable validation on startup
- [ ] Create different configs for dev/staging/prod

**Completion Criteria**: Environment configuration documented

---

### Task 10.3: Implement Health Check & Monitoring
- [ ] Enhance `/health` endpoint with detailed status
- [ ] Check database connectivity
- [ ] Check cryptographic services
- [ ] Return version information
- [ ] Add metrics endpoint for monitoring tools

**Completion Criteria**: Health check provides detailed service status

---

### Task 10.4: Setup Automated Token Cleanup
- [ ] Create cleanup service for expired tokens
- [ ] Schedule cleanup to run periodically (every 6 hours)
- [ ] Log cleanup operations
- [ ] Monitor cleanup performance
- [ ] Add manual cleanup endpoint for admin

**Completion Criteria**: Expired tokens automatically removed

---

### Task 10.5: Deploy to Production
- [ ] Choose hosting platform (Heroku, AWS, DigitalOcean, Railway, etc.)
- [ ] Set up production environment
- [ ] Configure production environment variables
- [ ] Deploy application
- [ ] Verify all endpoints working
- [ ] Set up SSL/TLS certificates
- [ ] Configure domain name
- [ ] Enable monitoring and alerts

**Completion Criteria**: Backend live and accessible via HTTPS

---

## Phase 11: Advanced Features (Optional)

### Task 11.1: Implement Application Management
- [ ] Create endpoint to register new applications
- [ ] Create endpoint to list registered applications
- [ ] Create endpoint to update application secrets
- [ ] Create endpoint to deactivate applications
- [ ] Add application-level permissions

**Completion Criteria**: Multiple applications can be managed

---

### Task 11.2: Implement Token Refresh Strategy
- [ ] Create refresh token alongside access token
- [ ] Implement sliding window refresh
- [ ] Add refresh token rotation
- [ ] Track refresh token usage
- [ ] Limit refresh token lifetime

**Completion Criteria**: Advanced token refresh implemented

---

### Task 11.3: Add WebSocket Support
- [ ] Install socket.io: `npm install socket.io`
- [ ] Create WebSocket server
- [ ] Implement real-time token validation
- [ ] Emit token expiration warnings
- [ ] Handle connection authentication

**Completion Criteria**: Real-time token status updates available

---

### Task 11.4: Implement Multi-Factor Authentication
- [ ] Add TOTP support (Google Authenticator)
- [ ] Create MFA enrollment endpoint
- [ ] Create MFA verification endpoint
- [ ] Store MFA secrets securely
- [ ] Add backup codes

**Completion Criteria**: Optional MFA available

---

## Success Metrics

The backend will be considered complete when:
- ✅ All Phase 1-10 tasks completed
- ✅ All API endpoints functional and tested
- ✅ Security measures implemented and verified
- ✅ Token generation/validation working reliably
- ✅ Supabase integration operational
- ✅ Documentation complete
- ✅ Deployed and accessible via HTTPS
- ✅ Average response time < 150ms for validation
- ✅ All tests passing (unit + integration)
- ✅ Ready for frontend integration

---

## Notes

- Each task should be small enough to complete in 15-60 minutes
- Test each task before moving to the next
- Keep security as the top priority
- Log everything for debugging and auditing
- Follow RESTful API design principles
