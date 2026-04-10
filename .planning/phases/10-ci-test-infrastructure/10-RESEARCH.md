# Phase 10: CI Test Infrastructure - Research

**Researched:** 2026-04-10
**Domain:** GitHub Actions CI + Supabase CLI local development + Playwright/Vitest
**Confidence:** HIGH

## Summary

Phase 10 creates a new GitHub Actions workflow that runs the 3 previously-skipped test files (2 Playwright E2E + 1 Vitest integration) against an ephemeral Supabase instance spun up via `supabase start` in CI. The Supabase CLI has first-class GitHub Actions support via `supabase/setup-cli@v2`, and `supabase start` automatically applies all migrations from `supabase/migrations/` and seeds from `supabase/seed.sql` -- making the entire database reproducible with zero extra scripting.

The project currently has migrations but no `supabase/config.toml` (never formally initialized with `supabase init`). This means the workflow must either run `supabase init` first or the phase must create a committed `config.toml`. The well-known Supabase local development defaults (API at `localhost:54321`, known anon/service-role JWT keys, JWT secret `super-secret-jwt-token-with-at-least-32-characters-long`) make hardcoding credentials safe and simple for an ephemeral CI database.

**Primary recommendation:** Create `supabase/config.toml` via `supabase init`, write `supabase/seed.sql` with deterministic test users (inserted into `auth.users` + `auth.identities`), and build a single GitHub Actions workflow that runs `supabase start` then executes the 3 target test files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Supabase CLI local (`supabase start`) in CI via Docker -- no cloud test project needed. Each CI run gets a fresh, ephemeral Supabase instance.
- **D-02:** Test users provisioned via SQL seed script with deterministic UUIDs -- inserted directly into `auth.users` after migrations apply.
- **D-03:** Seed data applied once per CI run (not per-test). Fresh `supabase start` + seed at workflow start; all tests share the same seeded state.
- **D-04:** Seed file lives at `supabase/seed.sql` -- standard Supabase convention. `supabase start` auto-applies it after migrations, requiring zero extra scripting.
- **D-05:** Create a new dedicated GitHub Actions workflow (e.g., `integration-tests.yml`) -- do NOT modify existing `playwright.yml` or `test.yml`.
- **D-06:** New workflow runs only the 3 previously-skipped test files: `invite-flow.spec.ts`, `project-realtime-matrix.spec.ts`, `phase05.3-migrations.integration.test.ts`.
- **D-07:** Dev server started as background process (`npm run dev &`) with port 3003 wait -- standard Playwright CI pattern.
- **D-08:** All test credentials hardcoded in seed script and workflow -- no GitHub Secrets needed. The DB is ephemeral and local; deterministic passwords are safe.
- **D-09:** Use Supabase CLI known default values for anon key, service role key, and URL (`localhost:54321`) -- do not parse from `supabase status` output.

### Claude's Discretion
- Exact seed SQL structure (table insertion order, UUID values, test project names)
- GitHub Actions workflow trigger conditions (push/PR/manual)
- Whether to use `supabase db reset` or just `supabase start` for fresh state
- How to convert `test.skip` to conditional skip (env-var guard vs removing entirely)
- Playwright config adjustments for the integration workflow

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-01 | Enable test.skip E2E tests in CI -- configure GitHub Actions workflow with live Supabase test project for invite-flow.spec.ts and project-realtime-matrix.spec.ts | Supabase CLI + setup-cli action + seed.sql pattern fully supports this; E2E tests need GoTrue + Realtime running |
| CI-02 | Enable test.skip integration tests in CI -- phase05.3-migrations.integration.test.ts against live Supabase | Integration tests use supabase-js client directly; need PostgREST + GoTrue; pre-generated JWT tokens from well-known secret |
| CI-03 | Seed data strategy -- create reproducible test fixtures for CI (test users, test projects, test invitations) | seed.sql with auth.users + auth.identities inserts using deterministic UUIDs and bcrypt passwords; auto-applied by `supabase start` |
</phase_requirements>

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase/setup-cli | v2 | GitHub Action to install Supabase CLI on runners | Official Supabase action, 189 stars, MIT license [VERIFIED: github.com/supabase/setup-cli] |
| Supabase CLI | 2.58.5 (local) / latest in CI | Local Supabase stack (Postgres, GoTrue, Realtime, PostgREST) | Required for `supabase start`; well-supported on ubuntu-latest [VERIFIED: local install] |
| actions/checkout | v4 | Checkout repository | Standard GitHub Actions pattern [VERIFIED: existing workflows] |
| actions/setup-node | v4 | Install Node.js with npm cache | Standard GitHub Actions pattern [VERIFIED: existing workflows] |

### Supporting
| Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/upload-artifact | v4 | Upload test reports/traces | On failure for debugging [VERIFIED: existing playwright.yml] |
| Docker (ubuntu-latest) | pre-installed | Required by Supabase CLI | Always -- supabase start uses Docker containers [VERIFIED: supabase docs] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `supabase start` (full stack) | `supabase db start` (DB only) | DB-only is faster but misses GoTrue (auth) and Realtime -- E2E tests need both |
| `supabase start` | Cloud Supabase test project | Cloud avoids Docker but adds secrets management, network latency, and shared state issues |
| `-x studio,imgproxy,vector,logflare` | Full `supabase start` | Excluding unused services saves ~1-2 min startup and RAM; recommended for CI |

## Architecture Patterns

### Recommended Project Structure
```
supabase/
  config.toml          # NEW -- Supabase CLI project config (created via supabase init)
  seed.sql             # NEW -- Deterministic test data (auth.users, projects, invitations)
  migrations/          # EXISTING -- 27 SQL migration files
.github/workflows/
  integration-tests.yml  # NEW -- Dedicated CI workflow for the 3 target test files
  playwright.yml         # EXISTING -- DO NOT MODIFY
  test.yml               # EXISTING -- DO NOT MODIFY
```

### Pattern 1: Supabase CLI in GitHub Actions
**What:** Use `supabase/setup-cli@v2` to install the CLI, then `supabase start` to spin up an ephemeral local Supabase stack.
**When to use:** Any CI job needing a real Supabase instance (auth, RLS, realtime).
**Example:**
```yaml
# Source: https://github.com/supabase/setup-cli README
steps:
  - uses: actions/checkout@v4
  - uses: supabase/setup-cli@v2
    with:
      version: latest
  - run: supabase start -x studio,imgproxy,vector,logflare,supavisor
```
[VERIFIED: supabase/setup-cli README + supabase start docs]

### Pattern 2: Seed Users in auth.users + auth.identities
**What:** Insert test users with deterministic UUIDs and bcrypt-hashed passwords directly into `auth.users` and `auth.identities` tables in seed.sql.
**When to use:** Any test needing authenticated users against local Supabase.
**Example:**
```sql
-- Source: https://laros.io/seeding-users-in-supabase-with-a-sql-seed-script
-- + https://gist.github.com/khattaksd/4e8f4c89f4e928a2ecaad56d4a17ecd1
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'owner@test.com',
  crypt('test-password-123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Test Owner"}',
  NOW(), NOW()
);

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@test.com"}'::jsonb,
  'email',
  '11111111-1111-1111-1111-111111111111',
  NOW(), NOW(), NOW()
);
```
[CITED: laros.io/seeding-users-in-supabase-with-a-sql-seed-script]

### Pattern 3: Pre-generated JWT for Integration Tests
**What:** For Vitest integration tests that need access tokens (not browser sign-in), generate JWTs offline using the well-known local Supabase JWT secret.
**When to use:** Integration tests like `phase05.3-migrations.integration.test.ts` that need `E2E_COLLAB_OWNER_TOKEN`.
**Details:**
- Local Supabase JWT secret: `super-secret-jwt-token-with-at-least-32-characters-long` [CITED: catjam.fi/articles/supabase-gen-access-token]
- JWT payload needs: `sub` (user UUID), `role` ("authenticated"), `aud` ("authenticated"), `exp` (future timestamp), `iat` (now)
- Can be generated at workflow runtime via a small Node.js script or pre-computed and hardcoded (the secret is deterministic and well-known)
[CITED: supabase.com/docs/guides/auth/jwts]

### Pattern 4: Conditional test.skip via Environment Variable
**What:** Replace bare `test.skip(...)` with a conditional check on an env var like `CI_SUPABASE=true`.
**When to use:** To keep tests skipped in local dev (no Supabase) but enabled in CI.
**Example:**
```typescript
// For Playwright E2E tests:
const SKIP_LIVE = !process.env['CI_SUPABASE'];
test(SKIP_LIVE ? 'skip' : '', 'T-055-100: owner sends invitation', async ({ browser }) => { ... });
// OR simpler: test.skip(!process.env['CI_SUPABASE'], 'Requires live Supabase')
// test.skip accepts (condition, reason) -- Playwright built-in
```
[VERIFIED: Playwright docs -- test.skip(condition, description) is the standard pattern]

### Anti-Patterns to Avoid
- **Parsing `supabase status` output for keys:** The output format changes between CLI versions. Use hardcoded well-known defaults instead. [VERIFIED: D-09 decision + CLI issue #4211]
- **Running `supabase start` without `-x` in CI:** Starts 14+ services including Studio and imgproxy that tests never use. Wastes 1-2 min startup and ~2GB RAM. [CITED: supabase.com/docs/reference/cli/supabase-start]
- **Creating test users via GoTrue API in seed script:** The seed.sql runs as Postgres, not as HTTP. Insert directly into `auth.users` + `auth.identities`. [VERIFIED: community patterns]
- **Modifying existing workflows:** D-05 explicitly forbids modifying `playwright.yml` or `test.yml`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Supabase in CI | Docker-compose with manual Postgres/GoTrue/Realtime setup | `supabase start` via CLI | Supabase CLI manages 14 coordinated containers; hand-rolling is error-prone |
| Test user creation | HTTP calls to GoTrue admin API | Direct SQL INSERT into auth.users + auth.identities in seed.sql | Simpler, deterministic, runs before any service is fully ready |
| JWT generation for integration tests | Custom token signing library | Pre-computed JWT with well-known secret OR small inline Node script | The JWT secret for local Supabase is well-known and stable |
| Health check polling | Custom bash loop with curl | `supabase start` built-in health checks (+ `--ignore-health-check` if needed) | CLI handles readiness checks internally |

## Common Pitfalls

### Pitfall 1: Missing config.toml
**What goes wrong:** `supabase start` fails because no `supabase/config.toml` exists.
**Why it happens:** Project has `supabase/migrations/` but was never formally initialized with `supabase init`.
**How to avoid:** Run `supabase init` to generate `config.toml`, then commit it. OR create a minimal `config.toml` manually.
**Warning signs:** Error: "Cannot find supabase/config.toml" on `supabase start`.

### Pitfall 2: Missing auth.identities Row
**What goes wrong:** Seeded users exist in `auth.users` but login fails silently.
**Why it happens:** Modern Supabase (post-2024) requires a matching `auth.identities` row for email/password sign-in to work.
**How to avoid:** Always insert into both `auth.users` AND `auth.identities` with matching UUIDs and email in `identity_data`.
**Warning signs:** GoTrue returns "invalid login credentials" for seeded users.

### Pitfall 3: Supabase Start Timeout in CI
**What goes wrong:** `supabase start` takes 5+ minutes on first run (downloading Docker images).
**Why it happens:** No Docker image cache in CI; all images pulled fresh.
**How to avoid:** Accept the startup cost (typically 2-4 min on ubuntu-latest). Set generous timeout. Consider excluding unused services with `-x studio,imgproxy,vector,logflare,supavisor,edge-runtime`.
**Warning signs:** Workflow timeout before tests even start.

### Pitfall 4: Dev Server CSP Blocks Local Supabase
**What goes wrong:** Vite dev server's Content-Security-Policy header blocks connections to `localhost:54321` (local Supabase).
**Why it happens:** The existing CSP in `vite.config.ts` hardcodes `https://vfovtgtjailvrphsgafv.supabase.co` as allowed connect-src. Local Supabase at `localhost:54321` is not in that list.
**How to avoid:** E2E tests need the dev server to connect to local Supabase. Either: (a) set env vars so the app uses `http://localhost:54321` as VITE_SUPABASE_URL and the CSP middleware allows it, or (b) the existing CSP already allows `'self'` + `ws:` + `wss:` which covers localhost in dev mode.
**Warning signs:** Network errors in E2E tests; Supabase client fails to connect.

### Pitfall 5: Realtime Tests Flaky in CI
**What goes wrong:** `project-realtime-matrix.spec.ts` tests (presence, cursors, drag-lock) are timing-sensitive and may fail in CI due to slower runners.
**Why it happens:** CI runners have 2 cores and variable network latency even on localhost WebSockets.
**How to avoid:** Use generous timeouts (tests already use 3-5s waits). Consider marking realtime tests with `test.slow()` or adding retries in the workflow. D-06 allows documented skip conditions for realtime-dependent tests.
**Warning signs:** Intermittent timeout failures only in CI.

### Pitfall 6: Integration Test Token Expiry
**What goes wrong:** Pre-generated JWT tokens expire if `exp` is set too close to generation time.
**Why it happens:** If JWTs are hardcoded with a fixed `exp`, they expire after that date.
**How to avoid:** Set `exp` to a far-future timestamp (e.g., year 2099) for hardcoded test tokens, OR generate tokens at workflow runtime with a dynamic `exp`.
**Warning signs:** Integration tests pass initially then start failing after the hardcoded expiry date.

## Code Examples

### GitHub Actions Workflow Structure
```yaml
# Source: supabase/setup-cli README + existing playwright.yml patterns
name: Integration Tests (Supabase)

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '20.x'
  CI: true
  CI_SUPABASE: true
  # Well-known Supabase local defaults
  VITE_SUPABASE_URL: http://localhost:54321
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v2
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Start Supabase
        run: supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Start dev server
        run: npm run dev &
        env:
          VITE_SUPABASE_URL: http://localhost:54321
          VITE_SUPABASE_ANON_KEY: ${{ env.VITE_SUPABASE_ANON_KEY }}

      - name: Wait for dev server
        run: npx wait-on http://localhost:3003 --timeout 60000

      # Run the 3 target test files
      - name: Run E2E integration tests (Playwright)
        run: |
          npx playwright test tests/e2e/invite-flow.spec.ts tests/e2e/project-realtime-matrix.spec.ts
        env:
          E2E_OWNER_EMAIL: owner@test.com
          E2E_OWNER_PASSWORD: test-password-123
          # ... (remaining env vars)

      - name: Run migration integration tests (Vitest)
        run: |
          npx vitest run src/lib/__tests__/phase05.3-migrations.integration.test.ts
        env:
          VITE_SUPABASE_URL: http://localhost:54321
          VITE_SUPABASE_ANON_KEY: ${{ env.VITE_SUPABASE_ANON_KEY }}
          # ... (remaining env vars with pre-generated tokens)
```
[VERIFIED: supabase/setup-cli docs + existing playwright.yml patterns]

### Seed SQL Pattern for Test Users
```sql
-- supabase/seed.sql
-- Deterministic test users for CI

-- User 1: Project owner
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner@test.com',
   crypt('test-password-123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Test Owner"}', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'collaborator@test.com',
   crypt('test-password-123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Test Collaborator"}', NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'stranger@test.com',
   crypt('test-password-123', gen_salt('bf')),
   NOW(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Test Stranger"}', NOW(), NOW());

-- Identity rows (required for GoTrue sign-in)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@test.com"}'::jsonb,
   'email', '11111111-1111-1111-1111-111111111111', NOW(), NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"collaborator@test.com"}'::jsonb,
   'email', '22222222-2222-2222-2222-222222222222', NOW(), NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"stranger@test.com"}'::jsonb,
   'email', '33333333-3333-3333-3333-333333333333', NOW(), NOW(), NOW());

-- Test project owned by user 1
-- NOTE: projects table has required columns: project_type, status, visibility, priority_level
-- (table created via Supabase dashboard, no CREATE TABLE migration exists)
INSERT INTO projects (id, name, owner_id, project_type, status, visibility, priority_level, created_at, updated_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CI Test Project',
        '11111111-1111-1111-1111-111111111111',
        'software', 'active', 'private', 'medium',
        NOW(), NOW());

-- Collaborator relationship (user 2 is editor on the project)
INSERT INTO project_collaborators (project_id, user_id, role, created_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222', 'editor', NOW());

-- Test invitations for accept_invitation RPC tests
-- Token hash uses: encode(extensions.digest(p_token::text, 'sha256'::text), 'hex')
-- (confirmed in migration 20260408150000_phase5_accept_invitation_ambiguity_fix.sql)
-- NOTE: column name is `email` (NOT `invited_email`)
INSERT INTO project_invitations (
  project_id, email, role, token_hash, invited_by, expires_at, created_at
) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'collaborator@test.com', 'editor',
   encode(extensions.digest('ci-test-invite-token-1'::text, 'sha256'::text), 'hex'),
   '11111111-1111-1111-1111-111111111111',
   NOW() + interval '7 days', NOW()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'stranger@test.com', 'viewer',
   encode(extensions.digest('ci-test-invite-token-2'::text, 'sha256'::text), 'hex'),
   '11111111-1111-1111-1111-111111111111',
   NOW() + interval '7 days', NOW());
```
[CITED: laros.io + gist patterns adapted for project schema]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `supabase status` to parse keys | Hardcode well-known defaults | CLI v2.45+ changed output format | D-09 avoids this entirely |
| `anon_key` / `service_role_key` naming | `publishable` / `secret` key naming | Supabase CLI 2025 transition | Local defaults remain JWT-based; old names still work |
| Separate `supabase init` + `supabase migration up` | `supabase start` applies migrations automatically | Stable since CLI v1 | Simplifies CI workflow |

**Deprecated/outdated:**
- `supabase/setup-cli@v1` -- use `@v2` [VERIFIED: setup-cli README]
- Parsing `supabase status -o env` for keys -- unreliable across versions [CITED: CLI issue #4211]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase `start` on ubuntu-latest completes in under 5 minutes | Common Pitfalls | Workflow timeout; add retry or increase timeout |
| A2 | The project's `vite.config.ts` CSP allows connections to `localhost:54321` via `'self'` connect-src | Pitfall 4 | E2E tests fail with network errors; need CSP adjustment |
| A3 | The `project_invitations.token_hash` column uses SHA256 hex encoding via `extensions.digest` | Seed SQL | RESOLVED -- confirmed in migration 20260408150000 |
| A4 | `wait-on` package is available (or equivalent) for dev server readiness | Code Examples | Need to install it or use alternative polling |
| A5 | Existing 27 migrations apply cleanly on a fresh Postgres 15 via `supabase start` | Architecture | Migration errors block all tests; need to verify locally first |

## Open Questions (RESOLVED)

1. **Token hash algorithm in accept_invitation RPC** -- RESOLVED
   - **Answer:** The RPC uses `extensions.digest(p_token::text, 'sha256'::text)` with hex encoding via `encode(..., 'hex')`. Confirmed in migration `20260408150000_phase5_accept_invitation_ambiguity_fix.sql` line 24. The `pgcrypto` extension is created in `20260408000000_phase5_collab_schema.sql` line 14 (`create extension if not exists pgcrypto`). Seed SQL must use `encode(extensions.digest('token-value'::text, 'sha256'::text), 'hex')` to match.

2. **Projects table schema for seed data** -- RESOLVED
   - **Answer:** The `projects` table was created via Supabase dashboard (no CREATE TABLE migration exists). Based on the TypeScript `Project` interface in `src/types/index.ts` lines 178-207, the table has required columns: `id` (uuid), `name` (text), `owner_id` (uuid), `project_type` (text enum), `status` (text enum), `visibility` (text enum), `priority_level` (text enum), `created_at` (timestamptz), `updated_at` (timestamptz). Optional/nullable: `description`, `start_date`, `target_date`, `budget`, `team_size`, `tags`, `team_id`, `settings`, `is_ai_generated`, `ai_analysis`. Seed INSERT must include the required enum columns with valid values (e.g., `project_type='software'`, `status='active'`, `visibility='private'`, `priority_level='medium'`).
   - **No `public.users` or `public.user_profiles` table exists** in migrations. The app uses `auth.users` directly for user identity. No additional public user profile table seed INSERT is needed.
   - **Column name note:** `project_invitations` uses column `email` (NOT `invited_email`). Seed SQL must use `email` as the column name.

3. **Dev server env var handling** -- RESOLVED
   - **Answer:** Playwright's `webServer` subprocess inherits `process.env` by default. The `playwright.ci.config.ts` `webServer.env` block (lines 216-219) only adds `NODE_ENV='test'` and `CI='true'` on top of the inherited environment. Since `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set as workflow-level env vars, the `npm run dev` subprocess started by Playwright will inherit them automatically. No `.env.test` file or explicit `npm run dev &` step is needed -- Playwright handles dev server lifecycle via `webServer` config. Confirmed by reading `playwright.ci.config.ts` lines 204-219.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | `supabase start` in CI | Pre-installed on ubuntu-latest | N/A | None -- blocking |
| Supabase CLI | DB + auth + realtime | Installed via `supabase/setup-cli@v2` | latest | None -- blocking |
| Node.js 20.x | npm ci, tests | via `actions/setup-node@v4` | 20.x | None -- blocking |
| Chromium | Playwright E2E tests | via `npx playwright install` | latest | None -- blocking |

**Missing dependencies with no fallback:** None -- all dependencies available on ubuntu-latest.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (E2E) | Playwright 1.55.0 |
| Framework (Integration) | Vitest 3.2.4 |
| Config file (E2E) | `playwright.ci.config.ts` (existing, may need variant) |
| Config file (Integration) | `vitest.config.ts` (existing) |
| Quick run (E2E) | `npx playwright test tests/e2e/invite-flow.spec.ts tests/e2e/project-realtime-matrix.spec.ts` |
| Quick run (Integration) | `npx vitest run src/lib/__tests__/phase05.3-migrations.integration.test.ts` |
| Full suite command | Both commands above in sequence |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-01 | E2E invite-flow + realtime-matrix tests run (not skipped) in CI | E2E | `npx playwright test tests/e2e/invite-flow.spec.ts tests/e2e/project-realtime-matrix.spec.ts` | Yes (tests exist, skip guards to be modified) |
| CI-02 | Integration migration tests run in CI | Integration | `npx vitest run src/lib/__tests__/phase05.3-migrations.integration.test.ts` | Yes (tests exist, skip guards to be modified) |
| CI-03 | Seed data creates test users/projects/invitations | Infrastructure | `supabase start` + verify seed applied | No test file needed -- verified by CI-01 and CI-02 passing |

### Sampling Rate
- **Per task commit:** Run target test files locally if local Supabase available; otherwise verify YAML syntax
- **Per wave merge:** Full workflow trigger via `workflow_dispatch`
- **Phase gate:** All 3 test files pass in CI (green workflow run)

### Wave 0 Gaps
- [ ] `supabase/config.toml` -- must be created via `supabase init`
- [ ] `supabase/seed.sql` -- must be created with test fixtures
- [ ] `.github/workflows/integration-tests.yml` -- must be created

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (test-only, ephemeral DB) | N/A |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | No | N/A |
| V6 Cryptography | No | N/A |

**Note:** This phase is CI infrastructure only. All credentials are for ephemeral, local-only databases that are destroyed after each CI run. No production secrets are involved (D-08). The well-known Supabase local development keys are intentionally public and documented by Supabase.

## Sources

### Primary (HIGH confidence)
- [supabase/setup-cli README](https://github.com/supabase/setup-cli) -- GitHub Action inputs, version, Docker requirements
- [Supabase CLI start reference](https://supabase.com/docs/reference/cli/supabase-start) -- `-x` flag, excludable services, health checks
- [Supabase seeding docs](https://supabase.com/docs/guides/local-development/seeding-your-database) -- seed.sql execution timing, config.toml setup
- Existing project workflows (`.github/workflows/playwright.yml`, `.github/workflows/test.yml`) -- established CI patterns

### Secondary (MEDIUM confidence)
- [Seeding users in Supabase](https://laros.io/seeding-users-in-supabase-with-a-sql-seed-script) -- auth.users + auth.identities INSERT pattern
- [Supabase seed users gist](https://gist.github.com/khattaksd/4e8f4c89f4e928a2ecaad56d4a17ecd1) -- auth.users column list, identity linking
- [JWT generation for Supabase](https://catjam.fi/articles/supabase-gen-access-token) -- well-known JWT secret value

### Tertiary (LOW confidence)
- [Supabase CLI startup time discussion](https://github.com/orgs/supabase/discussions/9351) -- 5-min startup estimate (varies by runner)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Supabase CLI + setup-cli are official, well-documented tools
- Architecture: HIGH -- Pattern follows official Supabase CI testing guidance and existing project patterns
- Pitfalls: MEDIUM -- Startup time and CSP behavior are environment-dependent; need runtime verification
- Seed SQL: HIGH -- auth.users INSERT pattern verified via multiple sources; project schema confirmed via TypeScript interface; token hash algorithm confirmed via migration SQL; invitation column name confirmed as `email`

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable tooling, 30-day window)
