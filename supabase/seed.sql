-- ============================================================================
-- CI Test Seed Data
-- ----------------------------------------------------------------------------
-- Deterministic test fixtures for CI runs.
-- Applied automatically by `supabase start` after migrations.
-- All credentials are for an ephemeral local-only DB destroyed after each CI run.
--
-- NOTE: auth.users and public.users are NOT seeded here.
-- Users are created via the GoTrue Admin API in the CI workflow AFTER supabase
-- starts, then public.users profiles are inserted via a psql step.
-- Direct INSERTs into auth.users cause GoTrue v2 to return "Database error
-- querying schema" because GoTrue's internal state (e.g. identity rows,
-- confirmation tokens) is not set up by raw SQL inserts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Test project owned by user 1 (owner)
-- All required enum columns must be populated (table was dashboard-created,
-- no CREATE TABLE migration exists; schema inferred from src/types/index.ts).
-- ----------------------------------------------------------------------------

INSERT INTO projects (
  id, name, owner_id, project_type, status, visibility, priority_level,
  created_at, updated_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'CI Test Project',
  '11111111-1111-1111-1111-111111111111',
  'software', 'active', 'private', 'medium',
  NOW(), NOW()
);

-- ----------------------------------------------------------------------------
-- Collaborator relationship
-- User 2 (collaborator) is editor on the test project.
-- joined_at has default now() so it can be omitted, but included for clarity.
-- ----------------------------------------------------------------------------

INSERT INTO project_collaborators (project_id, user_id, role, joined_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'editor',
  NOW()
);

-- ----------------------------------------------------------------------------
-- Test invitations for accept_invitation RPC tests
-- token_hash uses extensions.digest to match the RPC in migration
-- 20260408150000_phase5_accept_invitation_ambiguity_fix.sql (line 24).
-- Column name is `email` (NOT `invited_email`) per migration schema (line 133).
-- Raw tokens stored in CI workflow as E2E_INVITE_RAW_TOKEN / E2E_INVITE_RAW_TOKEN_2.
-- ----------------------------------------------------------------------------

INSERT INTO project_invitations (
  project_id, email, role, token_hash, invited_by, expires_at, created_at
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'collaborator@test.com',
    'editor',
    encode(extensions.digest('ci-test-invite-token-1'::text, 'sha256'::text), 'hex'),
    '11111111-1111-1111-1111-111111111111',
    NOW() + interval '7 days',
    NOW()
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'stranger@test.com',
    'viewer',
    encode(extensions.digest('ci-test-invite-token-2'::text, 'sha256'::text), 'hex'),
    '11111111-1111-1111-1111-111111111111',
    NOW() + interval '7 days',
    NOW()
  );

-- ----------------------------------------------------------------------------
-- Refresh the admin materialized view now that public.users data exists.
-- admin_user_stats is built on public.users — without a refresh it remains
-- empty and any subsequent REFRESH MATERIALIZED VIEW CONCURRENTLY (which
-- requires an existing unique index on a non-empty view) would fail.
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  REFRESH MATERIALIZED VIEW public.admin_user_stats;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
