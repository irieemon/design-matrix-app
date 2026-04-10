# Phase 10: CI Test Infrastructure - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable the full test suite (unit + integration + E2E) to run in GitHub Actions against a live Supabase test project with reproducible seed data. The 3 target test files with `test.skip` guards become runnable in CI. No new test authoring — this phase is strictly CI infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Supabase Test Project Strategy
- **D-01:** Use Supabase CLI local (`supabase start`) in CI via Docker — no cloud test project needed. Each CI run gets a fresh, ephemeral Supabase instance.
- **D-02:** Test users provisioned via SQL seed script with deterministic UUIDs — inserted directly into `auth.users` after migrations apply.

### Seed Data & Reset Strategy
- **D-03:** Seed data applied once per CI run (not per-test). Fresh `supabase start` + seed at workflow start; all tests share the same seeded state.
- **D-04:** Seed file lives at `supabase/seed.sql` — standard Supabase convention. `supabase start` auto-applies it after migrations, requiring zero extra scripting.

### Workflow Architecture
- **D-05:** Create a new dedicated GitHub Actions workflow (e.g., `integration-tests.yml`) — do NOT modify existing `playwright.yml` or `test.yml`.
- **D-06:** New workflow runs only the 3 previously-skipped test files: `invite-flow.spec.ts`, `project-realtime-matrix.spec.ts`, `phase05.3-migrations.integration.test.ts`.
- **D-07:** Dev server started as background process (`npm run dev &`) with port 3003 wait — standard Playwright CI pattern.

### Secret Management
- **D-08:** All test credentials hardcoded in seed script and workflow — no GitHub Secrets needed. The DB is ephemeral and local; deterministic passwords are safe.
- **D-09:** Use Supabase CLI known default values for anon key, service role key, and URL (`localhost:54321`) — do not parse from `supabase status` output.

### Claude's Discretion
- Exact seed SQL structure (table insertion order, UUID values, test project names)
- GitHub Actions workflow trigger conditions (push/PR/manual)
- Whether to use `supabase db reset` or just `supabase start` for fresh state
- How to convert `test.skip` to conditional skip (env-var guard vs removing entirely)
- Playwright config adjustments for the integration workflow

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CI Workflows
- `.github/workflows/playwright.yml` — Existing Playwright CI (6 jobs, sharded, cross-browser)
- `.github/workflows/test.yml` — Existing Vitest + lint CI
- `playwright.ci.config.ts` — Playwright CI-specific config

### Target Test Files
- `tests/e2e/invite-flow.spec.ts` — 6 test.skip E2E tests (invite flow, 2-browser pattern)
- `tests/e2e/project-realtime-matrix.spec.ts` — 6 test.skip E2E tests (realtime presence, 2-browser)
- `src/lib/__tests__/phase05.3-migrations.integration.test.ts` — 9 test.skip integration tests (RLS, RPC)

### Supabase Config
- `supabase/config.toml` — Supabase CLI project config (if exists)
- `supabase/migrations/` — SQL migrations that must be applied before tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `playwright.ci.config.ts` — CI-specific Playwright config already exists, can extend
- `.github/workflows/playwright.yml` — Mature CI patterns (caching, sharding, artifacts) to reference

### Established Patterns
- Test files use `process.env['E2E_*']` with fallback defaults — just need real values injected
- Two-browser pattern in E2E tests uses Playwright's `browser.newContext()` for multi-user simulation
- Integration tests use `@supabase/supabase-js` client with anon key + user access tokens

### Integration Points
- `supabase/migrations/` — All Phase 05.3 migrations must be applied by `supabase start`
- `package.json` dev server (`npm run dev`) — E2E tests expect port 3003
- `.env` / `.env.test` — Local env var convention; CI will set these as workflow env vars

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Supabase CLI + GitHub Actions integration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-ci-test-infrastructure*
*Context gathered: 2026-04-10*
