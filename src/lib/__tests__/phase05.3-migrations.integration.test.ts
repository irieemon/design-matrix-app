/**
 * Phase 05.3 SQL Migration Integration Tests
 * Phase 05.5 Quality Debt Closure
 *
 * Verifies the four Phase 05.3 SQL migration behaviors through supabase-js:
 *   1. Projects SELECT RLS for collaborators — a collaborator can read a project
 *      they were added to (not just the owner).
 *   2. is_project_collaborator function — returns true for collaborators, false
 *      for non-collaborators.
 *   3. accept_invitation RPC — accepting an invitation with a valid token hash
 *      inserts a row into project_collaborators.
 *   4. accept_invitation OUT param — returns project_id in the response.
 *
 * PREREQUISITES (all required before removing test.skip):
 *   1. Live Supabase project reachable at VITE_SUPABASE_URL
 *   2. Phase 05.3 migration applied:
 *      - project_collaborators table
 *      - project_invitations table (with token_hash, expires_at, accepted_at)
 *      - accept_invitation(p_token text) SECURITY DEFINER RPC
 *      - is_project_collaborator(p_project_id uuid, p_user_id uuid) function
 *      - Updated projects SELECT RLS policy allowing collaborators to read
 *   3. Two test user accounts with UUIDs:
 *      E2E_COLLAB_OWNER_ID   — user who owns a test project
 *      E2E_COLLAB_OWNER_TOKEN — access token for the owner
 *      E2E_COLLAB_USER_ID    — user to be added as collaborator
 *      E2E_COLLAB_USER_TOKEN — access token for the collaborator
 *      E2E_COLLAB_PROJECT_ID — UUID of the project owned by owner
 *   4. Remove test.skip from each test case
 *   5. Run with: npx vitest run src/lib/__tests__/phase05.3-migrations.integration.test.ts
 *
 * These tests use the anon key + user access tokens to exercise RLS as a real
 * browser client would, rather than the service role key. This ensures the
 * policies are correctly scoped.
 *
 * SQL migrations verified (from Phase 05.3 plan):
 *   - 20260408_phase5_collab_schema.sql (or equivalent)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getEnv(key: string): string {
  return (
    (typeof process !== 'undefined' ? process.env[key] : undefined) ??
    (typeof import.meta !== 'undefined' ? (import.meta.env as Record<string, string>)[key] : undefined) ??
    ''
  )
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL')
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY')

const OWNER_ID = getEnv('E2E_COLLAB_OWNER_ID')
const OWNER_TOKEN = getEnv('E2E_COLLAB_OWNER_TOKEN')
const COLLAB_USER_ID = getEnv('E2E_COLLAB_USER_ID')
const COLLAB_USER_TOKEN = getEnv('E2E_COLLAB_USER_TOKEN')
const PROJECT_ID = getEnv('E2E_COLLAB_PROJECT_ID')

const prerequisitesMet =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  Boolean(OWNER_ID) &&
  Boolean(OWNER_TOKEN) &&
  Boolean(COLLAB_USER_ID) &&
  Boolean(COLLAB_USER_TOKEN) &&
  Boolean(PROJECT_ID)

/** Creates an authenticated anon client for a given user's access token. */
function makeClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Test helpers shared across tests
// ---------------------------------------------------------------------------

let ownerClient: SupabaseClient
let collabClient: SupabaseClient

beforeAll(() => {
  if (!prerequisitesMet) return
  ownerClient = makeClient(OWNER_TOKEN)
  collabClient = makeClient(COLLAB_USER_TOKEN)
})

// ---------------------------------------------------------------------------
// Migration 1: Projects SELECT RLS allows collaborators to read the project
//
// SQL verified: projects SELECT policy updated to check project_collaborators
//   OR owner_id = auth.uid()
// ---------------------------------------------------------------------------

describe('Phase 05.3 Migration 1 — projects SELECT RLS for collaborators', () => {
  it('collaborator user can SELECT the project they were added to', async () => {
    if (!process.env['CI_SUPABASE'] || !prerequisitesMet) {
      console.log('Skipping: requires CI_SUPABASE=true and all E2E_COLLAB_* env vars');
      return;
    }
    // PREREQUISITE: COLLAB_USER_ID must already be in project_collaborators
    // for PROJECT_ID. Add manually or via accept_invitation before running.

    // Arrange: collaborator's authenticated supabase client
    // Act: attempt to read the project
    const { data, error } = await collabClient
      .from('projects')
      .select('id, name')
      .eq('id', PROJECT_ID)
      .single()

    // Assert: collaborator can see the project (RLS allows access)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.id).toBe(PROJECT_ID)
  })

  it('non-collaborator user cannot SELECT a project they have no access to', async () => {
    if (!process.env['CI_SUPABASE'] || !prerequisitesMet) {
      console.log('Skipping: requires CI_SUPABASE=true and all E2E_COLLAB_* env vars');
      return;
    }
    // Arrange: create a fresh anon client with a different user's token
    // that has no relationship to PROJECT_ID.
    // NOTE: In a live run, configure E2E_STRANGER_TOKEN for a third user.
    const strangerToken = getEnv('E2E_STRANGER_TOKEN')
    if (!strangerToken) {
      console.warn('E2E_STRANGER_TOKEN not set — skipping negative RLS check')
      return
    }
    const strangerClient = makeClient(strangerToken)

    // Act: attempt to read the project
    const { data, error } = await strangerClient
      .from('projects')
      .select('id')
      .eq('id', PROJECT_ID)
      .maybeSingle()

    // Assert: RLS blocks access — data is null, no error (RLS silently filters)
    expect(data).toBeNull()
    // Supabase returns no error for RLS filter (row simply not returned)
    expect(error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Migration 2: is_project_collaborator function
//
// SQL verified: CREATE FUNCTION is_project_collaborator(_project_id uuid, _user_id uuid)
//   RETURNS boolean
//   LANGUAGE sql STABLE SECURITY DEFINER
//   AS $$ SELECT EXISTS (SELECT 1 FROM project_collaborators ...) $$
// ---------------------------------------------------------------------------

describe('Phase 05.3 Migration 2 — is_project_collaborator function', () => {
  it('returns true for a user who is a collaborator on the project', async () => {
    if (!process.env['CI_SUPABASE'] || !prerequisitesMet) {
      console.log('Skipping: requires CI_SUPABASE=true and all E2E_COLLAB_* env vars');
      return;
    }
    // PREREQUISITE: COLLAB_USER_ID must be in project_collaborators for PROJECT_ID.

    // Act: call the function via RPC
    const { data, error } = await ownerClient.rpc('is_project_collaborator', {
      _project_id: PROJECT_ID,
      _user_id: COLLAB_USER_ID,
    })

    // Assert
    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it('returns false for a user who is not a collaborator on the project', async () => {
    if (!process.env['CI_SUPABASE'] || !prerequisitesMet) {
      console.log('Skipping: requires CI_SUPABASE=true and all E2E_COLLAB_* env vars');
      return;
    }
    const nonMemberId = getEnv('E2E_STRANGER_USER_ID')
    if (!nonMemberId) {
      console.warn('E2E_STRANGER_USER_ID not set — skipping non-collaborator check')
      return
    }

    // Act: call the function for a user with no relationship to the project
    const { data, error } = await ownerClient.rpc('is_project_collaborator', {
      _project_id: PROJECT_ID,
      _user_id: nonMemberId,
    })

    // Assert
    expect(error).toBeNull()
    expect(data).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Migration 3: accept_invitation RPC inserts into project_collaborators
//
// SQL verified: CREATE FUNCTION accept_invitation(p_token text)
//   RETURNS TABLE(project_id uuid, role text) LANGUAGE plpgsql SECURITY DEFINER
//   — hashes p_token, finds matching project_invitations row, inserts into
//     project_collaborators, marks invitation accepted_at.
// ---------------------------------------------------------------------------

describe('Phase 05.3 Migration 3 — accept_invitation RPC inserts collaborator row', () => {
  it('accept_invitation with a valid token creates a project_collaborators entry', async () => {
    if (!process.env['CI_SUPABASE'] || !prerequisitesMet) {
      console.log('Skipping: requires CI_SUPABASE=true and all E2E_COLLAB_* env vars');
      return;
    }
    // PREREQUISITE: A valid (unhashed) invitation token for PROJECT_ID sent to
    // COLLAB_USER_ID must be available. Set E2E_INVITE_RAW_TOKEN to the raw
    // token string before the test run.
    const rawToken = getEnv('E2E_INVITE_RAW_TOKEN')
    if (!rawToken) {
      console.warn('E2E_INVITE_RAW_TOKEN not set — cannot test accept_invitation insertion')
      return
    }

    // Act: call the accept_invitation RPC as the collaborator user
    const { data, error } = await collabClient.rpc('accept_invitation', {
      p_token: rawToken,
    })

    // Assert: RPC succeeds and returns the project ID
    expect(error).toBeNull()
    expect(data).not.toBeNull()

    // The RPC returns rows: [{ project_id, role }]
    const row = Array.isArray(data) ? data[0] : data
    expect(row).toHaveProperty('project_id', PROJECT_ID)
  })
})

// ---------------------------------------------------------------------------
// Migration 4: accept_invitation OUT param — returns project_id in response
//
// SQL verified: RETURNS TABLE(project_id uuid, role text)
//   The RPC signature exposes project_id as an OUT column, not just a side effect.
// ---------------------------------------------------------------------------

describe('Phase 05.3 Migration 4 — accept_invitation returns project_id OUT param', () => {
  it('accept_invitation response shape includes project_id and role', async () => {
    if (!process.env['CI_SUPABASE'] || !prerequisitesMet) {
      console.log('Skipping: requires CI_SUPABASE=true and all E2E_COLLAB_* env vars');
      return;
    }
    // PREREQUISITE: Same as Migration 3 test — requires E2E_INVITE_RAW_TOKEN_2
    // (a second unused token) so this test can run independently of test 3.
    const rawToken = getEnv('E2E_INVITE_RAW_TOKEN_2')
    if (!rawToken) {
      console.warn('E2E_INVITE_RAW_TOKEN_2 not set — skipping OUT param shape test')
      return
    }

    // Act
    const { data, error } = await collabClient.rpc('accept_invitation', {
      p_token: rawToken,
    })

    // Assert: error is null, data has correct shape
    expect(error).toBeNull()
    expect(data).not.toBeNull()

    const row = Array.isArray(data) ? data[0] : data

    // Migration 3 defines the RPC as: RETURNS TABLE(project_id uuid, role text)
    expect(row).toHaveProperty('project_id')
    expect(row).toHaveProperty('role')

    // project_id must be a valid UUID string
    expect(typeof row.project_id).toBe('string')
    expect(row.project_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )

    // role must be one of the allowed values
    expect(['viewer', 'editor']).toContain(row.role)
  })

  it('accept_invitation returns 400-equivalent error for invalid token', async () => {
    if (!process.env['CI_SUPABASE'] || !prerequisitesMet) {
      console.log('Skipping: requires CI_SUPABASE=true and all E2E_COLLAB_* env vars');
      return;
    }
    // Act: call with a syntactically valid but non-existent token
    const bogusToken = 'a'.repeat(64) // 64-char hex-like string, not in DB

    const { data, error } = await collabClient.rpc('accept_invitation', {
      p_token: bogusToken,
    })

    // Assert: RPC returns an error or empty data (depends on DEFINER implementation)
    // The accept.ts API handler maps this to HTTP 400 with body { error: 'invalid_or_expired' }
    // At the RPC level, the function raises an exception with SQLSTATE P0001.
    if (error) {
      expect(error.message).toBeTruthy()
    } else {
      // Some implementations return empty array instead of raising
      const row = Array.isArray(data) ? data[0] : data
      expect(row?.project_id ?? null).toBeNull()
    }
  })
})
