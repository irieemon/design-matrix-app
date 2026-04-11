#!/usr/bin/env bash
# scripts/e2e-local.env.sh
#
# Sourceable env block for local CI reproduction. Mirrors the environment
# used by .github/workflows/integration-tests.yml so tests run the same
# locally as in CI.
#
# DO NOT execute directly. Source from scripts/e2e-local.sh (or another
# script that wraps the full local CI reproduction sequence).
#
# Source of truth: .github/workflows/integration-tests.yml
#   - Top-level workflow env block (lines 19-30)
#   - Playwright step env vars (lines 290-301)
#   - Vitest step env vars (lines 313-319)
# If the CI workflow env block changes, update this file in lockstep.
#
# SECURITY NOTE: SUPABASE_SERVICE_ROLE_KEY below is the Supabase CLI LOCAL
# default key (well-known, documented by Supabase). It is NOT the production
# hosted-Supabase service role key. Never use this file in a production
# context.

# ----------------------------------------------------------------------------
# Top-level workflow env (integration-tests.yml:19-30)
# ----------------------------------------------------------------------------
export CI='true'

# Every target test file (invite-flow.spec.ts, project-realtime-matrix.spec.ts,
# phase05.3-migrations.integration.test.ts) gates execution on the variable
# below and SKIPS SILENTLY if unset. Dropping the next line causes target
# tests to report success with zero actual runs.
# LOAD-BEARING — do not remove without updating every CI_SUPABASE check site.
export CI_SUPABASE='true'

export VITE_SUPABASE_URL='http://localhost:54321'
export VITE_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
export SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

# LOAD-BEARING: bypasses vite.config.ts CSP middleware so the Supabase client
# can reach http://localhost:54321 from the dev server (different port from
# 3003 = different origin under CSP 'self').
export VITE_CSP_DISABLED='true'

# ----------------------------------------------------------------------------
# Playwright step env (integration-tests.yml:290-301)
# ----------------------------------------------------------------------------
export E2E_OWNER_EMAIL='owner@test.com'
export E2E_OWNER_PASSWORD='test-password-123'
export E2E_INVITEE_EMAIL='collaborator@test.com'
export E2E_INVITEE_PASSWORD='test-password-123'
export E2E_PROJECT_ID='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
export E2E_BASE_URL='http://localhost:3003'
export E2E_USER_A_EMAIL='owner@test.com'
export E2E_USER_A_PASSWORD='test-password-123'
export E2E_USER_B_EMAIL='collaborator@test.com'
export E2E_USER_B_PASSWORD='test-password-123'
export E2E_PROJECT_URL='http://localhost:3003/?project=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

# ----------------------------------------------------------------------------
# Vitest step env (integration-tests.yml:313-319)
# ----------------------------------------------------------------------------
export E2E_COLLAB_OWNER_ID='11111111-1111-1111-1111-111111111111'
export E2E_COLLAB_USER_ID='22222222-2222-2222-2222-222222222222'
export E2E_COLLAB_PROJECT_ID='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
export E2E_STRANGER_USER_ID='33333333-3333-3333-3333-333333333333'
export E2E_INVITE_RAW_TOKEN='ci-test-invite-token-1'
export E2E_INVITE_RAW_TOKEN_2='ci-test-invite-token-2'
