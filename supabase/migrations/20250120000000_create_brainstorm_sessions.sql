-- ═══════════════════════════════════════════════════════════
-- Collaborative Mobile Brainstorming - Database Schema
-- Phase One Implementation
-- Created: 2025-01-20
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 1. Brainstorm Sessions Table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brainstorm_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session metadata
  name TEXT NOT NULL DEFAULT 'Brainstorm Session',
  description TEXT,

  -- Session state
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),

  -- Access control
  join_code TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_participants INTEGER DEFAULT 50,

  -- Session configuration
  allow_anonymous BOOLEAN DEFAULT true,
  require_approval BOOLEAN DEFAULT false,
  enable_voting BOOLEAN DEFAULT false,
  time_limit_minutes INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS brainstorm_sessions_project_id_idx ON brainstorm_sessions(project_id);
CREATE INDEX IF NOT EXISTS brainstorm_sessions_facilitator_id_idx ON brainstorm_sessions(facilitator_id);
CREATE INDEX IF NOT EXISTS brainstorm_sessions_access_token_idx ON brainstorm_sessions(access_token);
CREATE INDEX IF NOT EXISTS brainstorm_sessions_join_code_idx ON brainstorm_sessions(join_code);
CREATE INDEX IF NOT EXISTS brainstorm_sessions_status_idx ON brainstorm_sessions(status);
CREATE INDEX IF NOT EXISTS brainstorm_sessions_expires_at_idx ON brainstorm_sessions(expires_at);

-- RLS Policies
ALTER TABLE brainstorm_sessions ENABLE ROW LEVEL SECURITY;

-- Facilitators can manage their sessions
CREATE POLICY "Facilitators can manage their sessions"
  ON brainstorm_sessions
  FOR ALL
  USING (facilitator_id = auth.uid());

-- Anyone can read active sessions with valid token (for validation)
CREATE POLICY "Active sessions readable for validation"
  ON brainstorm_sessions
  FOR SELECT
  USING (
    status = 'active'
    AND expires_at > now()
  );

-- ═══════════════════════════════════════════════════════════
-- 2. Session Participants Table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,

  -- Participant identification
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  device_fingerprint TEXT,

  -- Participant metadata
  is_anonymous BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT true,
  contribution_count INTEGER DEFAULT 0,

  -- Connection tracking
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disconnected_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS session_participants_session_id_idx ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS session_participants_user_id_idx ON session_participants(user_id);
CREATE INDEX IF NOT EXISTS session_participants_last_active_idx ON session_participants(last_active_at DESC);
CREATE INDEX IF NOT EXISTS session_participants_device_fingerprint_idx ON session_participants(device_fingerprint);

-- RLS Policies
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

-- Facilitators can view all participants in their sessions
CREATE POLICY "Facilitators can view participants"
  ON session_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brainstorm_sessions
      WHERE id = session_participants.session_id
      AND facilitator_id = auth.uid()
    )
  );

-- Participants can view themselves
CREATE POLICY "Participants can view self"
  ON session_participants
  FOR SELECT
  USING (user_id = auth.uid() OR is_anonymous = true);

-- Participants can join active sessions
CREATE POLICY "Participants can join"
  ON session_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brainstorm_sessions
      WHERE id = session_participants.session_id
      AND status = 'active'
      AND expires_at > now()
    )
  );

-- Participants can update their own activity
CREATE POLICY "Participants can update self"
  ON session_participants
  FOR UPDATE
  USING (user_id = auth.uid() OR is_anonymous = true);

-- ═══════════════════════════════════════════════════════════
-- 3. Extend Ideas Table for Session Tracking
-- ═══════════════════════════════════════════════════════════
-- Add session tracking columns to existing ideas table
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES brainstorm_sessions(id) ON DELETE SET NULL;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES session_participants(id) ON DELETE SET NULL;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS submitted_via TEXT DEFAULT 'desktop' CHECK (submitted_via IN ('desktop', 'mobile', 'api'));

-- Index for session queries
CREATE INDEX IF NOT EXISTS ideas_session_id_idx ON ideas(session_id);
CREATE INDEX IF NOT EXISTS ideas_participant_id_idx ON ideas(participant_id);
CREATE INDEX IF NOT EXISTS ideas_submitted_via_idx ON ideas(submitted_via);

-- Update RLS to allow session participants to create ideas
-- Drop if exists, then create
DROP POLICY IF EXISTS "Session participants can create ideas" ON ideas;

CREATE POLICY "Session participants can create ideas"
  ON ideas
  FOR INSERT
  WITH CHECK (
    session_id IS NULL OR -- Allow non-session ideas (existing functionality)
    EXISTS (
      SELECT 1 FROM session_participants sp
      JOIN brainstorm_sessions bs ON sp.session_id = bs.id
      WHERE sp.id = participant_id
      AND bs.status = 'active'
      AND bs.expires_at > now()
      AND sp.is_approved = true
    )
  );

-- ═══════════════════════════════════════════════════════════
-- 4. Session Activity Log (for undo/audit)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS session_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES session_participants(id) ON DELETE SET NULL,

  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'idea_created', 'idea_updated', 'idea_deleted', 'idea_moved',
    'participant_joined', 'participant_left', 'session_paused', 'session_resumed',
    'session_started', 'session_ended'
  )),

  -- Data snapshot (for undo)
  -- NOTE: idea_id is TEXT to match production ideas table schema
  idea_id TEXT REFERENCES ideas(id) ON DELETE SET NULL,
  snapshot_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  ip_address INET,
  user_agent TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS session_activity_log_session_id_idx ON session_activity_log(session_id);
CREATE INDEX IF NOT EXISTS session_activity_log_participant_id_idx ON session_activity_log(participant_id);
CREATE INDEX IF NOT EXISTS session_activity_log_created_at_idx ON session_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS session_activity_log_activity_type_idx ON session_activity_log(activity_type);

-- RLS Policies
ALTER TABLE session_activity_log ENABLE ROW LEVEL SECURITY;

-- Facilitators can view session logs
CREATE POLICY "Facilitators can view activity log"
  ON session_activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brainstorm_sessions
      WHERE id = session_activity_log.session_id
      AND facilitator_id = auth.uid()
    )
  );

-- System can insert activity logs
CREATE POLICY "System can insert activity log"
  ON session_activity_log
  FOR INSERT
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- 5. Triggers for Automatic Updates
-- ═══════════════════════════════════════════════════════════

-- Update updated_at timestamp on brainstorm_sessions
CREATE OR REPLACE FUNCTION update_brainstorm_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brainstorm_sessions_updated_at_trigger
  BEFORE UPDATE ON brainstorm_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_brainstorm_sessions_updated_at();

-- Update last_active_at on session_participants when they contribute
CREATE OR REPLACE FUNCTION update_participant_last_active()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.participant_id IS NOT NULL THEN
        UPDATE session_participants
        SET last_active_at = now(),
            contribution_count = contribution_count + 1
        WHERE id = NEW.participant_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_participant_last_active_trigger
  AFTER INSERT ON ideas
  FOR EACH ROW
  WHEN (NEW.participant_id IS NOT NULL)
  EXECUTE FUNCTION update_participant_last_active();

-- ═══════════════════════════════════════════════════════════
-- 6. Helper Functions
-- ═══════════════════════════════════════════════════════════

-- Function to check if session is active
CREATE OR REPLACE FUNCTION is_session_active(session_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM brainstorm_sessions
        WHERE id = session_uuid
        AND status = 'active'
        AND expires_at > now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active participant count
CREATE OR REPLACE FUNCTION get_active_participant_count(session_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM session_participants
        WHERE session_id = session_uuid
        AND disconnected_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE brainstorm_sessions
    SET status = 'completed',
        ended_at = now()
    WHERE status = 'active'
    AND expires_at < now();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════
-- 7. Comments for Documentation
-- ═══════════════════════════════════════════════════════════

COMMENT ON TABLE brainstorm_sessions IS 'Collaborative brainstorming sessions with QR code access';
COMMENT ON TABLE session_participants IS 'Mobile participants in brainstorm sessions';
COMMENT ON TABLE session_activity_log IS 'Audit trail for session activities (undo/replay support)';

COMMENT ON COLUMN brainstorm_sessions.access_token IS 'Cryptographically secure UUID for QR code access';
COMMENT ON COLUMN brainstorm_sessions.join_code IS 'Human-readable code (ABCD-1234 format) for manual entry';
COMMENT ON COLUMN session_participants.device_fingerprint IS 'Anonymous device tracking hash';
COMMENT ON COLUMN session_participants.contribution_count IS 'Auto-incremented by trigger on idea creation';
COMMENT ON COLUMN ideas.submitted_via IS 'Tracks submission source: desktop, mobile, or API';

-- ═══════════════════════════════════════════════════════════
-- Migration Complete
-- ═══════════════════════════════════════════════════════════
-- Phase One: Database schema, indexes, RLS policies, triggers, and helper functions
-- Next Phase: Repository layer implementation
