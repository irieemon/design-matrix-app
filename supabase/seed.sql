-- ============================================================================
-- CI Test Seed Data
-- ----------------------------------------------------------------------------
-- Deterministic test fixtures for CI runs.
-- Applied automatically by `supabase start` after migrations.
-- All credentials are for an ephemeral local-only DB destroyed after each CI run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Test users
-- 3 users: owner (11...), collaborator (22...), stranger (33...)
-- Must insert into both auth.users AND auth.identities for GoTrue sign-in.
-- ----------------------------------------------------------------------------

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'owner@test.com',
    crypt('test-password-123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Test Owner"}',
    NOW(), NOW()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'collaborator@test.com',
    crypt('test-password-123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Test Collaborator"}',
    NOW(), NOW()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'stranger@test.com',
    crypt('test-password-123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Test Stranger"}',
    NOW(), NOW()
  );

-- ----------------------------------------------------------------------------
-- Public user profile rows
-- Required by RLS policies (users can only see their own row) and the
-- is_admin() function, both of which query public.users WHERE id = auth.uid().
-- Without these rows GoTrue may fail schema introspection with a 500 error
-- when it evaluates RLS policies during authentication.
-- ----------------------------------------------------------------------------

INSERT INTO public.users (id, email, full_name, role, is_active, created_at, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@test.com',        'Test Owner',        'user', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'collaborator@test.com', 'Test Collaborator', 'user', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'stranger@test.com',     'Test Stranger',     'user', true, NOW(), NOW());

-- Identity rows required for GoTrue email/password sign-in (post-2024 Supabase)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@test.com"}'::jsonb,
    'email',
    '11111111-1111-1111-1111-111111111111',
    NOW(), NOW(), NOW()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"collaborator@test.com"}'::jsonb,
    'email',
    '22222222-2222-2222-2222-222222222222',
    NOW(), NOW(), NOW()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '33333333-3333-3333-3333-333333333333',
    '{"sub":"33333333-3333-3333-3333-333333333333","email":"stranger@test.com"}'::jsonb,
    'email',
    '33333333-3333-3333-3333-333333333333',
    NOW(), NOW(), NOW()
  );

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

REFRESH MATERIALIZED VIEW IF EXISTS public.admin_user_stats;
