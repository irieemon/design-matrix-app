-- ═══════════════════════════════════════════════════════════
-- P0-04: Tighten session_activity_log INSERT RLS
-- Created: 2026-04-18
-- ═══════════════════════════════════════════════════════════
--
-- Previous policy ("System can insert activity log") used
--   WITH CHECK (true)
-- which allowed ANY authenticated user to forge activity log entries
-- for sessions they do not belong to.
--
-- New policy: an authenticated caller may insert a log row only when they
-- are either:
--   (a) a valid participant in the referenced brainstorm session, OR
--   (b) the facilitator of the referenced brainstorm session
--       (facilitators emit lifecycle events like session_started /
--        session_ended that are not tied to a participant row).
--
-- Service-role clients bypass RLS and are unaffected. This policy closes the
-- forgery vector for the authenticated role.
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "System can insert activity log" ON session_activity_log;
DROP POLICY IF EXISTS "Users can insert session activity log" ON session_activity_log;
DROP POLICY IF EXISTS "Users insert only their own session activity" ON session_activity_log;

CREATE POLICY "Users insert only their own session activity"
  ON session_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM session_participants sp
      WHERE sp.session_id = session_activity_log.session_id
        AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM brainstorm_sessions bs
      WHERE bs.id = session_activity_log.session_id
        AND bs.facilitator_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users insert only their own session activity"
  ON session_activity_log
  IS 'P0-04: Replaces WITH CHECK (true). Restricts INSERT to the session''s participants or facilitator. Service-role bypasses RLS.';
