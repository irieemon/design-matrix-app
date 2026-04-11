#!/usr/bin/env bash
set -euo pipefail

# scripts/e2e-local.sh
#
# Local CI reproduction entry point. Runs the CI Playwright Integration
# Tests suite against a local Supabase stack. See
# .planning/phases/11-local-ci-repro/11-RUNBOOK.md for usage.
#
# Step order is load-bearing — see ADR-0010 "Notes for Colby". Docker
# check → port kill → supabase recovery → db reset → source env →
# seed users → seed data → generate JWT → exec playwright.

# ---- Step 1: Resolve repo root ----------------------------------------------
>&2 echo "[e2e-local] step 1: resolving repo root"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(dirname "$SCRIPT_DIR")
cd "$REPO_ROOT"

# ---- Step 1b: Preflight binary check ----------------------------------------
>&2 echo "[e2e-local] step 1b: preflight binary check"
for bin in docker supabase lsof jq psql node curl npx; do
  command -v "$bin" >/dev/null 2>&1 || {
    echo "ERROR: required binary '$bin' not on PATH. See .planning/phases/11-local-ci-repro/11-RUNBOOK.md Prerequisites." >&2
    exit 1
  }
done

# ---- Step 2: Verify Docker is running ---------------------------------------
>&2 echo "[e2e-local] step 2: checking Docker is running"
docker info >/dev/null 2>&1 || {
  echo "ERROR: Docker Desktop is not running. Start Docker Desktop and retry." >&2
  exit 1
}

# ---- Step 3: Free port 3003 (Vite dev server) -------------------------------
>&2 echo "[e2e-local] step 3: freeing port 3003"
lsof -ti:3003 | xargs kill -9 2>/dev/null || true

# ---- Step 4: Recover supabase stack if stale --------------------------------
>&2 echo "[e2e-local] step 4: checking supabase status"
if ! supabase status >/dev/null 2>&1; then
  >&2 echo "[e2e-local] step 4: supabase stack not running or stale — resetting"
  supabase stop 2>/dev/null || true
  supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime
fi

# ---- Step 5: Reset database to pristine state -------------------------------
>&2 echo "[e2e-local] step 5: resetting database (supabase db reset)"
supabase db reset

# ---- Step 6: Source static env block ----------------------------------------
>&2 echo "[e2e-local] step 6: sourcing env block"
source "$SCRIPT_DIR/e2e-local.env.sh"

# ---- Step 7: Seed GoTrue users via Admin API --------------------------------
# Verbatim from .github/workflows/integration-tests.yml:108-148
>&2 echo "[e2e-local] step 7: seeding GoTrue users (Admin API)"
API_URL="http://localhost:54321/auth/v1/admin/users"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

create_user() {
  local label="$1"
  local payload="$2"
  local result
  result=$(curl -s -X POST "$API_URL" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload")
  local id
  id=$(echo "$result" | jq -r '.id // empty')
  if [ -z "$id" ]; then
    echo "FAILED to create $label: $(echo "$result" | jq -r '.msg // .message // .')" >&2
    exit 1
  fi
  echo "Created $label: $id" >&2
}

create_user "owner" '{
  "id": "11111111-1111-1111-1111-111111111111",
  "email": "owner@test.com",
  "password": "test-password-123",
  "email_confirm": true,
  "user_metadata": {"display_name": "Test Owner"}
}'

create_user "collaborator" '{
  "id": "22222222-2222-2222-2222-222222222222",
  "email": "collaborator@test.com",
  "password": "test-password-123",
  "email_confirm": true,
  "user_metadata": {"display_name": "Test Collaborator"}
}'

create_user "stranger" '{
  "id": "33333333-3333-3333-3333-333333333333",
  "email": "stranger@test.com",
  "password": "test-password-123",
  "email_confirm": true,
  "user_metadata": {"display_name": "Test Stranger"}
}'

# ---- Step 8: Seed application data ------------------------------------------
# Verbatim from .github/workflows/integration-tests.yml:167-233
>&2 echo "[e2e-local] step 8: seeding application data (psql)"
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres <<'EOSQL'
  -- NOTE: INSERTs on projects / project_collaborators / project_invitations
  -- intentionally omit ON CONFLICT because step 5 (supabase db reset) wipes
  -- the DB first. If this block is ever run against a warm DB (e.g., manual
  -- debug mode without reset), expect duplicate-PK errors on these tables.
  -- public.users and public.user_profiles below use ON CONFLICT (id) DO NOTHING
  -- for symmetry with the CI workflow seed block.

  -- 1. public.users profiles (depend on auth.users — now exists via API)
  INSERT INTO public.users (id, email, full_name, role, is_active, created_at, updated_at) VALUES
    ('11111111-1111-1111-1111-111111111111', 'owner@test.com',        'Test Owner',        'user', true, NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222222', 'collaborator@test.com', 'Test Collaborator', 'user', true, NOW(), NOW()),
    ('33333333-3333-3333-3333-333333333333', 'stranger@test.com',     'Test Stranger',     'user', true, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 1b. public.user_profiles rows (required for withAuth + profile fetch queries)
  INSERT INTO public.user_profiles (id, email, full_name, role, created_at, updated_at) VALUES
    ('11111111-1111-1111-1111-111111111111', 'owner@test.com',        'Test Owner',        'user', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222222', 'collaborator@test.com', 'Test Collaborator', 'user', NOW(), NOW()),
    ('33333333-3333-3333-3333-333333333333', 'stranger@test.com',     'Test Stranger',     'user', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 2. Test project owned by user 1 (owner)
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

  -- 3. Collaborator relationship: user 2 is editor on the test project
  INSERT INTO project_collaborators (project_id, user_id, role, joined_at)
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'editor',
    NOW()
  );

  -- 4. Test invitations for accept_invitation RPC tests
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

  -- 5. Refresh admin materialized view now that all data exists
  DO $$ BEGIN
    REFRESH MATERIALIZED VIEW public.admin_user_stats;
  EXCEPTION WHEN undefined_table THEN NULL;
  END $$;
EOSQL

# ---- Step 9: Generate JWT access tokens inline ------------------------------
# Verbatim from .github/workflows/integration-tests.yml:247-265, modified
# ONLY to console.log (export into current shell) instead of
# fs.appendFileSync($GITHUB_ENV).
>&2 echo "[e2e-local] step 9: generating JWT access tokens"
JWT_OUTPUT=$(node -e "
const crypto = require('crypto');
const secret = 'super-secret-jwt-token-with-at-least-32-characters-long';
function makeJwt(sub) {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const payload = Buffer.from(JSON.stringify({sub,role:'authenticated',aud:'authenticated',iss:'supabase-demo',exp:now+3600,iat:now})).toString('base64url');
  const sig = crypto.createHmac('sha256',secret).update(header+'.'+payload).digest('base64url');
  return header+'.'+payload+'.'+sig;
}
console.log('E2E_COLLAB_OWNER_TOKEN=' + makeJwt('11111111-1111-1111-1111-111111111111'));
console.log('E2E_COLLAB_USER_TOKEN=' + makeJwt('22222222-2222-2222-2222-222222222222'));
console.log('E2E_STRANGER_TOKEN=' + makeJwt('33333333-3333-3333-3333-333333333333'));
") || {
  echo "ERROR: JWT generation failed — node -e exited non-zero" >&2
  exit 1
}
if [ -z "$JWT_OUTPUT" ]; then
  echo "ERROR: JWT generation produced empty output" >&2
  exit 1
fi
token_count=$(printf '%s\n' "$JWT_OUTPUT" | grep -c '^E2E_' || true)
if [ "$token_count" -ne 3 ]; then
  echo "ERROR: JWT generation produced $token_count token lines, expected 3" >&2
  echo "Output was:" >&2
  printf '%s\n' "$JWT_OUTPUT" >&2
  exit 1
fi
while IFS= read -r line; do
  export "$line"
done <<< "$JWT_OUTPUT"

# ---- Step 10: Exec Playwright with CI config --------------------------------
# exec replaces the shell process so Playwright's exit code becomes the
# script's exit code and signals (Ctrl+C) propagate cleanly. "$@" is
# quoted so args containing spaces forward correctly.
>&2 echo "[e2e-local] step 10: exec npx playwright test --config playwright.ci.config.ts $*"
exec npx playwright test --config playwright.ci.config.ts "$@"
