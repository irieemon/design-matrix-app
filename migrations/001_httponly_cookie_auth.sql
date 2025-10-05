-- migrations/001_httponly_cookie_auth.sql
-- httpOnly Cookie Authentication Infrastructure
-- Date: 2025-10-01
-- Description: Database schema for server-side component state storage and admin audit logging

-- ============================================
-- 1. Component States Table
-- ============================================

-- Drop existing objects if re-running
DROP TRIGGER IF EXISTS trigger_update_user_component_states_updated_at ON user_component_states;
DROP FUNCTION IF EXISTS update_user_component_states_updated_at();
DROP TABLE IF EXISTS user_component_states;

CREATE TABLE user_component_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  component_key VARCHAR(255) NOT NULL,
  state_data JSONB NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ,

  -- Unique constraint: one state per user per component
  CONSTRAINT unique_user_component UNIQUE(user_id, component_key),

  -- Size limit constraint (100KB max)
  CONSTRAINT state_size_check CHECK (pg_column_size(state_data) <= 102400)
);

-- Indexes for performance
CREATE INDEX idx_user_component_states_user_id
  ON user_component_states(user_id);

CREATE INDEX idx_user_component_states_component_key
  ON user_component_states(component_key);

CREATE INDEX idx_user_component_states_expires_at
  ON user_component_states(expires_at)
  WHERE expires_at IS NOT NULL;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_component_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_component_states_updated_at
  BEFORE UPDATE ON user_component_states
  FOR EACH ROW
  EXECUTE FUNCTION update_user_component_states_updated_at();

-- RLS Policies
ALTER TABLE user_component_states ENABLE ROW LEVEL SECURITY;

-- Users can only access their own component states
CREATE POLICY user_component_states_select_own
  ON user_component_states
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_component_states_insert_own
  ON user_component_states
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_component_states_update_own
  ON user_component_states
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY user_component_states_delete_own
  ON user_component_states
  FOR DELETE
  USING (auth.uid() = user_id);

-- Cleanup function for expired states
CREATE OR REPLACE FUNCTION cleanup_expired_component_states()
RETURNS void AS $$
BEGIN
  DELETE FROM user_component_states
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Note: To schedule automatic cleanup, use pg_cron extension:
-- SELECT cron.schedule('cleanup-component-states', '0 0 * * *',
--   'SELECT cleanup_expired_component_states();');

-- ============================================
-- 2. Admin Audit Log Table
-- ============================================

-- Drop existing objects if re-running
DROP TABLE IF EXISTS admin_audit_log;

CREATE TABLE admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  is_admin BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address VARCHAR(45),  -- IPv4 or IPv6
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Ensure timestamp is not in future
  CONSTRAINT audit_log_timestamp_check CHECK (timestamp <= NOW())
);

-- Indexes for performance
CREATE INDEX idx_admin_audit_log_user_id
  ON admin_audit_log(user_id);

CREATE INDEX idx_admin_audit_log_timestamp
  ON admin_audit_log(timestamp DESC);

CREATE INDEX idx_admin_audit_log_action
  ON admin_audit_log(action);

-- Composite index for common queries
CREATE INDEX idx_admin_audit_log_user_timestamp
  ON admin_audit_log(user_id, timestamp DESC);

-- RLS Policies
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY admin_audit_log_select_admin
  ON admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR role = 'super_admin')
    )
  );

-- Service role can insert (API endpoints will use service role)
CREATE POLICY admin_audit_log_insert_system
  ON admin_audit_log
  FOR INSERT
  WITH CHECK (true);

-- No updates or deletes allowed (immutable audit log)

-- ============================================
-- 3. Update User Profiles Table
-- ============================================

-- Ensure user_profiles table has role column
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role
  ON user_profiles(role)
  WHERE role IN ('admin', 'super_admin');

-- Update existing users to have default role
UPDATE user_profiles
SET role = 'user'
WHERE role IS NULL;

-- ============================================
-- Verification
-- ============================================

-- Verify tables were created
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_name IN ('user_component_states', 'admin_audit_log')
    AND table_schema = 'public';

  IF table_count = 2 THEN
    RAISE NOTICE 'SUCCESS: All tables created successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: Expected 2 tables, found %', table_count;
  END IF;
END $$;

-- Display table information
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('user_component_states', 'admin_audit_log')
  AND table_schema = 'public';
