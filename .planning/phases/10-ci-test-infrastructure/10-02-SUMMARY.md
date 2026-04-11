---
phase: 10-ci-test-infrastructure
plan: 02
status: complete
wave: 2
completed: 2026-04-10
---

# Plan 10-02 Summary — GitHub Actions Integration Tests Workflow

## What Was Built

`.github/workflows/integration-tests.yml` — a dedicated CI workflow that runs
the 3 previously-skipped test files against an ephemeral Supabase instance.

`vite.config.ts` — added `VITE_CSP_DISABLED` env-var support to the
`development-csp` middleware, allowing the workflow to bypass CSP headers in CI
so the Supabase client can reach `http://localhost:54321`.

## Artifacts Produced

| File | Purpose |
|------|---------|
| `.github/workflows/integration-tests.yml` | New dedicated CI workflow (D-05) |
| `vite.config.ts` | Added VITE_CSP_DISABLED support (Pitfall 4 fix) |

## Workflow Structure

1. `actions/checkout@v4`
2. `supabase/setup-cli@v2` — installs Supabase CLI
3. `actions/setup-node@v4` — Node 20.x with npm cache
4. `npm ci`
5. `supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime` — ephemeral DB with seed applied automatically
6. Inline Node.js JWT generation — creates `E2E_COLLAB_OWNER_TOKEN`, `E2E_COLLAB_USER_TOKEN`, `E2E_STRANGER_TOKEN` via `crypto.createHmac('sha256', secret)` with 1-hour dynamic expiry
7. `npx playwright install --with-deps chromium`
8. Playwright run — `invite-flow.spec.ts` + `project-realtime-matrix.spec.ts` with all E2E_* env vars
9. Vitest run — `phase05.3-migrations.integration.test.ts` with all E2E_COLLAB_* env vars
10. Artifact upload on failure (`test-results/`, `playwright-report/`, 14-day retention)

## Key Decisions Applied

- **D-01/D-03/D-04:** `supabase start` creates ephemeral DB, applies migrations, seeds automatically
- **D-05:** New file only; `playwright.yml` and `test.yml` are untouched
- **D-06:** Exactly 3 target test files, no more
- **D-07 (revised via Q3 RESOLVED):** Dev server handled by `playwright.ci.config.ts` `webServer` config — inherits `process.env` including `VITE_SUPABASE_URL`; no `npm run dev &` step
- **D-08:** All credentials hardcoded in workflow (safe for ephemeral DB)
- **D-09:** Well-known Supabase local anon/service-role keys hardcoded in env block

## CSP Resolution (Pitfall 4)

`vite.config.ts` CSP hardcodes `https://vfovtgtjailvrphsgafv.supabase.co` in
`connect-src`. `localhost:54321` is a different port from the dev server
(`3003`) and is not covered by `'self'` under CSP. Added `VITE_CSP_DISABLED`
env-var check in the `development-csp` middleware — when `true`, the middleware
skips setting the CSP header. The workflow sets `VITE_CSP_DISABLED: 'true'` in
its `env` block. The Playwright `webServer` subprocess inherits this via
`process.env`.

## Contracts Consumed

| Env Var | Source | Value |
|---------|--------|-------|
| `VITE_SUPABASE_URL` | D-09 well-known default | `http://localhost:54321` |
| `VITE_SUPABASE_ANON_KEY` | D-09 well-known default | `eyJhbGci...n_I0` |
| `SUPABASE_SERVICE_ROLE_KEY` | D-09 well-known default | `eyJhbGci...IU` |
| `E2E_COLLAB_OWNER_ID` | Plan 10-01 seed contract | `11111111-...` |
| `E2E_COLLAB_USER_ID` | Plan 10-01 seed contract | `22222222-...` |
| `E2E_COLLAB_PROJECT_ID` | Plan 10-01 seed contract | `aaaaaaaa-...` |
| `E2E_STRANGER_USER_ID` | Plan 10-01 seed contract | `33333333-...` |
| `E2E_INVITE_RAW_TOKEN` | Plan 10-01 seed contract | `ci-test-invite-token-1` |
| `E2E_INVITE_RAW_TOKEN_2` | Plan 10-01 seed contract | `ci-test-invite-token-2` |
| `E2E_COLLAB_OWNER_TOKEN` | Generated at step 6 | JWT for `11111111-...` |
| `E2E_COLLAB_USER_TOKEN` | Generated at step 6 | JWT for `22222222-...` |
| `E2E_STRANGER_TOKEN` | Generated at step 6 | JWT for `33333333-...` |
