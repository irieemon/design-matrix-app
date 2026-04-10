-- ═══════════════════════════════════════════════════════════
-- Enable Realtime for Brainstorm Tables
-- Migration: 20251125000000
--
-- This migration enables Supabase Realtime for brainstorm tables
-- to fix "mismatch between server and client bindings for postgres changes"
-- error when mobile clients subscribe to session updates.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 1. Enable REPLICA IDENTITY FULL for change tracking
-- ═══════════════════════════════════════════════════════════
-- REPLICA IDENTITY FULL is required for Supabase Realtime to track
-- all column changes, especially for UPDATE and DELETE operations

ALTER TABLE brainstorm_sessions REPLICA IDENTITY FULL;
ALTER TABLE session_participants REPLICA IDENTITY FULL;
ALTER TABLE session_activity_log REPLICA IDENTITY FULL;

-- ═══════════════════════════════════════════════════════════
-- 2. Add tables to supabase_realtime publication
-- ═══════════════════════════════════════════════════════════
-- The supabase_realtime publication is used by Supabase Realtime
-- to track changes. Tables must be explicitly added.

-- Use DO block to handle case where tables might already be in publication
DO $$
BEGIN
    -- Add brainstorm_sessions to publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE brainstorm_sessions;
        RAISE NOTICE 'Added brainstorm_sessions to supabase_realtime publication';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'brainstorm_sessions already in supabase_realtime publication';
    END;

    -- Add session_participants to publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;
        RAISE NOTICE 'Added session_participants to supabase_realtime publication';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'session_participants already in supabase_realtime publication';
    END;

    -- Add session_activity_log to publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE session_activity_log;
        RAISE NOTICE 'Added session_activity_log to supabase_realtime publication';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'session_activity_log already in supabase_realtime publication';
    END;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 3. Verify ideas table is in publication (should already be)
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ideas;
        RAISE NOTICE 'Added ideas to supabase_realtime publication';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'ideas already in supabase_realtime publication';
    END;
END $$;

-- ═══════════════════════════════════════════════════════════
-- Migration Complete
-- ═══════════════════════════════════════════════════════════
-- This enables:
-- - Real-time INSERT/UPDATE/DELETE tracking for brainstorm sessions
-- - Participant join/leave events via session_participants
-- - Idea submissions via ideas table (session-filtered)
-- - Activity log streaming for facilitators
