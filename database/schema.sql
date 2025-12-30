-- ============================================================================
-- Master Password Authentication System - Database Schema
-- ============================================================================
-- This schema defines the complete database structure for the Master Password
-- Authentication System built on Supabase.
--
-- Tables:
--   1. applications     - Third-party application registrations
--   2. revoked_tokens   - JWT token revocation blacklist
--   3. audit_logs       - Comprehensive event logging
--
-- Features:
--   - UUID-based primary keys
--   - Comprehensive indexing for performance
--   - Automatic timestamp management
--   - Token cleanup function
--   - Soft deletion support
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: applications
-- ============================================================================
-- Stores all registered third-party applications that use the authentication
-- system. Each application has its own credentials and master password.
--
-- Usage:
--   - Applications authenticate using app_id and app_secret
--   - Master password is stored as Argon2 hash
--   - Soft deletion via is_active flag
-- ============================================================================

CREATE TABLE IF NOT EXISTS applications (
    -- Primary identifier (UUID)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Human-readable application identifier (format: app-[uuid])
    -- Used for authentication and references
    app_id TEXT NOT NULL UNIQUE,

    -- Display name of the application
    app_name TEXT NOT NULL,

    -- Hashed secret for application authentication (bcrypt/argon2)
    app_secret TEXT NOT NULL,

    -- Argon2 hash of the master password for this application
    master_password_hash TEXT NOT NULL,

    -- Soft deletion flag (false = deleted, true = active)
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamp when the application was created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    -- Timestamp when the application was last updated
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index for fast application lookup by app_id
CREATE INDEX IF NOT EXISTS idx_applications_app_id ON applications(app_id);

-- Index for filtering active applications
CREATE INDEX IF NOT EXISTS idx_applications_is_active ON applications(is_active);

-- Comment on the table
COMMENT ON TABLE applications IS 'Stores registered third-party applications with their credentials and configuration';

-- ============================================================================
-- Table: revoked_tokens
-- ============================================================================
-- Maintains a blacklist of revoked JWT tokens. Tokens are checked against
-- this table during validation to ensure they haven't been revoked.
--
-- Usage:
--   - Each token has a unique JTI (JWT ID) claim
--   - Expired tokens are periodically cleaned up
--   - Supports bulk revocation with reason tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS revoked_tokens (
    -- Primary identifier (UUID)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- JWT ID claim from the token (unique identifier for each token)
    jti TEXT NOT NULL,

    -- Token expiration timestamp (for cleanup purposes)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Timestamp when the token was revoked
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    -- Optional reason for revocation (e.g., "User logout", "Password changed", "bulk_revocation")
    reason TEXT
);

-- Index for fast revocation checks by JTI
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);

-- Index for cleanup queries (removing expired tokens)
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);

-- Comment on the table
COMMENT ON TABLE revoked_tokens IS 'Blacklist of revoked JWT tokens for validation checks';

-- ============================================================================
-- Table: audit_logs
-- ============================================================================
-- Comprehensive event logging for all authentication, authorization, and
-- application management operations.
--
-- Usage:
--   - Every significant action is logged
--   - JSONB details field stores event-specific data
--   - Used for analytics, monitoring, and security auditing
--   - Supports filtering by event type, application, and date range
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    -- Primary identifier (UUID)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Event category (e.g., login_success, login_failed, token_revoked, etc.)
    event_type TEXT NOT NULL,

    -- Associated application ID (app_id from applications table)
    application_id TEXT,

    -- Client IP address that originated the request
    ip_address TEXT,

    -- Client user agent string
    user_agent TEXT,

    -- Event-specific structured data in JSONB format
    -- Examples:
    --   - Login events: {jti, issued_at, expires_at}
    --   - Admin events: {admin_username, action_details}
    --   - Validation events: {result, reason}
    details JSONB,

    -- Timestamp when the event occurred
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index for filtering by event type
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);

-- Index for time-range queries and sorting
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Index for filtering by application
CREATE INDEX IF NOT EXISTS idx_audit_logs_application_id ON audit_logs(application_id);

-- GIN index for JSONB queries on details field
CREATE INDEX IF NOT EXISTS idx_audit_logs_details ON audit_logs USING GIN(details);

-- Comment on the table
COMMENT ON TABLE audit_logs IS 'Comprehensive event logging for authentication, authorization, and application management';

-- ============================================================================
-- Function: cleanup_expired_tokens
-- ============================================================================
-- Removes expired tokens from the revoked_tokens table to prevent unlimited
-- growth. This function should be called periodically (e.g., daily cron job).
--
-- Usage:
--   SELECT cleanup_expired_tokens();
--
-- Returns:
--   Number of tokens deleted
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete tokens where expires_at is in the past
    DELETE FROM revoked_tokens
    WHERE expires_at < TIMEZONE('utc', NOW());

    -- Get the number of deleted rows
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment on the function
COMMENT ON FUNCTION cleanup_expired_tokens() IS 'Removes expired tokens from revoked_tokens table and returns count of deleted rows';

-- ============================================================================
-- Trigger: update_applications_updated_at
-- ============================================================================
-- Automatically updates the updated_at timestamp whenever an application
-- record is modified.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment on the trigger
COMMENT ON TRIGGER update_applications_updated_at ON applications IS 'Automatically updates updated_at timestamp on application modifications';

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
-- Note: RLS is disabled by default for service role access.
-- Enable RLS if you need row-level access control for different roles.
-- ============================================================================

-- Uncomment to enable RLS on tables
-- ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Example policy for applications (service role has full access)
-- CREATE POLICY "Service role has full access to applications"
--     ON applications
--     FOR ALL
--     TO service_role
--     USING (true)
--     WITH CHECK (true);

-- ============================================================================
-- Initial Data / Seed (Optional)
-- ============================================================================
-- Uncomment to create a sample application for testing

-- INSERT INTO applications (app_id, app_name, app_secret, master_password_hash, is_active)
-- VALUES (
--     'app-' || uuid_generate_v4()::text,
--     'Sample Application',
--     '$2b$10$exampleHashedSecretHere',
--     '$argon2id$v=19$m=65536,t=3,p=4$exampleHashHere',
--     true
-- );

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these queries to verify the schema was created successfully

-- Check all tables exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('applications', 'revoked_tokens', 'audit_logs');

-- Check all indexes exist
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('applications', 'revoked_tokens', 'audit_logs');

-- Check functions exist
-- SELECT proname FROM pg_proc WHERE proname IN ('cleanup_expired_tokens', 'update_updated_at_column');

-- ============================================================================
-- End of Schema
-- ============================================================================
