# Phase 11: Local CI Reproduction Environment — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Source:** ADR-0010 express path (ADR treated as locked design contract; no /gsd-discuss-phase required because decisions were already locked via /architect)

<domain>
## Phase Boundary

Phase 11 builds a local CI-equivalent debug environment that lets a developer run the CI Integration Tests Playwright suite against a local Supabase stack via a single command (`npm run e2e:local`). Debug iterations complete in seconds-to-tens-of-seconds instead of 5-minute CI pipelines.

**What ships:**
- `scripts/e2e-local.env.sh` (sourceable static env block mirroring CI workflow env)
- `scripts/e2e-local.sh` (executable orchestration script — Docker check, port cleanup, supabase lifecycle, db reset, user seed, app data seed, JWT inline, exec Playwright)
- `package.json` — one-line `"e2e:local"` npm script entry
- `.planning/phases/11-local-ci-repro/11-RUNBOOK.md` — developer-facing usage documentation

**What does NOT ship:**
- Any production source code change
- Any new Playwright config file (the script reuses `playwright.ci.config.ts` verbatim)
- Any JS/TS helper module for JWT generation (inline `node -e` heredoc only)
- Any parity validation between local and CI (anti-goal — discovered in Phase 12/13)
- Any warm-stateful debug loop (anti-goal — mutation tests in scope require pristine state)
- Any Windows support (anti-goal — macOS/Linux bash only)

**Phase boundary rule:** If a fix requires changing production code (`src/**`, `api/**`, `supabase/migrations/**`, `playwright.ci.config.ts`), it is out of scope and belongs to Phase 12 or 13.

</domain>

<decisions>
## Implementation Decisions (Locked by ADR-0010)

### D-01: Scope — Pragmatic, no parity validation
Do NOT pin Supabase CLI version. Do NOT validate schema parity between local and CI. Do NOT add teardown automation. `supabase start` runs against existing `supabase/config.toml` and `supabase/seed.sql` unchanged. Any local-vs-CI divergence is discovered during Phase 12/13 debugging, not in advance.

### D-02: Debug-loop cadence — `supabase db reset` between every run
Pristine state each iteration. The ~5-10s overhead per run is accepted as the cost of deterministic behavior under mutation tests (T-055-101, `accept_invitation` RPC) in v1.3 scope.

### D-03: Playwright config — reuse `playwright.ci.config.ts` verbatim
NO new `playwright.local.config.ts`. NO new project mode in `playwright.config.ts`. The shell script exports the same env vars the CI workflow exports, then invokes: `npx playwright test --config playwright.ci.config.ts "$@"`. Playwright's `webServer` subprocess inherits `process.env`, so `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `VITE_CSP_DISABLED` reach the dev server without additional plumbing (same inheritance mechanism documented in `docs/pipeline/last-qa-report.md:20-21` during the v1.2 arc).

### D-04: Acceptance bar — plumbing smoke ONLY
`npm run e2e:local -- -g "T-055-100"` runs end-to-end and returns a Playwright pass for `tests/e2e/invite-flow.spec.ts:117` (the one known-passing CI test in target files). NO assertion that a failing test matches the CI failure signature. The bar is "the plumbing works"; bug-hunting is Phase 12/13.

### D-05: Defensive cleanup for port 3003 and orphaned supabase processes
Shell script unconditionally:
- Checks `docker info` before `supabase start` (exit 1 with human-readable message if Docker absent)
- Kills anything holding port 3003 via `lsof -ti:3003 | xargs kill -9 2>/dev/null || true`
- Checks `supabase status` exit code; runs `supabase stop && supabase start` on orphan detection
- Runs `supabase db reset` before every Playwright invocation

### D-06: Shell strict mode `set -euo pipefail`
Deliberate deviation from existing repo scripts (`UPDATE_SUPABASE_KEY.sh`, `scripts/update-env-keys.sh`) which use `set -e` only or no strict mode. Reason: multiple independent failure modes (Docker absent, port in use, supabase stale, db reset fails, JWT fails, playwright misconfigured) — each must halt immediately rather than cascade.

### D-07: Env file separation (`e2e-local.env.sh` separate from `e2e-local.sh`)
Static env block sourceable from companion scripts (e.g., future `scripts/e2e-local-inspect.sh` for debugger mode). Explicit `export VAR=value` lines, no heredocs. Comments only where load-bearing (above `CI_SUPABASE`, `VITE_CSP_DISABLED`).

### D-08: `CI_SUPABASE=true` is LOAD-BEARING
Every target test file (`invite-flow.spec.ts`, `project-realtime-matrix.spec.ts`, `phase05.3-migrations.integration.test.ts`) gates execution on `CI_SUPABASE=true` and **skips** if unset. Blast-radius scout found 16 references across test files. The env file MUST contain a comment marking the line as load-bearing. Copying `e2e-local.env.sh` into a different script without this variable causes silent test skips reported as success — a discoverable footgun requiring explicit documentation.

### D-09: Playwright -x exclusion flags mirror CI workflow
`supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime` — identical to `.github/workflows/integration-tests.yml:90`. Excluded services are unnecessary for target tests and would slow cold-start by 1-2 minutes.

### D-10: JWT generation inline via `node -e` heredoc
Copy CI workflow's `makeJwt` function verbatim (`.github/workflows/integration-tests.yml:247-265`). Modified ONLY to `export` tokens into the current shell rather than writing to `$GITHUB_ENV`. Secret `super-secret-jwt-token-with-at-least-32-characters-long` (Supabase CLI local default). NO separate Node helper module.

### D-11: GoTrue user seeding via Admin API (inline bash block)
Copy workflow's `create_user` function verbatim (`.github/workflows/integration-tests.yml:108-148`). Creates owner/collaborator/stranger via `POST http://localhost:54321/auth/v1/admin/users` with service-role key. Idempotent against `db reset` because reset wipes `auth.users`.

### D-12: Application data seed via inline `psql` heredoc
Copy workflow's seed SQL verbatim (`.github/workflows/integration-tests.yml:167-233`). Inserts into `public.users`, `public.user_profiles`, `projects`, `project_collaborators`, `project_invitations`, refreshes `admin_user_stats`. Connection: `PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres`.

### D-13: `exec npx playwright test` at final step
Use `exec` so Playwright's exit code becomes the script's exit code. `"$@"` forwards all script arguments (`-g`, `--debug`, `--ui`, file paths) without quoting issues.

### D-14: Echo conventions
Each major step prints one-line status to stderr: `>&2 echo "[e2e-local] step N: ..."`.

### D-15: Portable `bash scripts/...` invocation in npm script
`"e2e:local": "bash scripts/e2e-local.sh"` — NOT `./scripts/e2e-local.sh`. Portability across shells (zsh/fish), avoids requiring `chmod +x` for npm script to work.

### D-16: Runbook placement under `.planning/phases/11-local-ci-repro/`
NOT under `docs/`. Reason: Phase 11 is scoped debug infrastructure, not long-term product documentation. Co-locates with phase artifacts. Fifth known risk (Windows support) and first place in repo where Docker is declared a dev prereq.

### Claude's Discretion
- Specific wording of echo status messages (`[e2e-local] step N: ...` format locked, message content is Claude's)
- Exact `mkdir -p` / `chmod +x` placement if tooling doesn't auto-handle
- Error-message phrasing beyond "Docker Desktop is not running. Start Docker Desktop and retry." (which is locked verbatim)
- Runbook narrative structure within the five locked sections (Prerequisites / Usage / What it does / Troubleshooting / Known risks)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture contract (primary source of truth)
- `docs/architecture/ADR-0010-phase-11-local-ci-repro.md` — Locked design. 16 decisions, 4 implementation steps, 11 test cases, 5 known risks, alternatives considered. Any deviation from this ADR requires re-opening `/architect`.

### CI workflow (verbatim-copy source for env vars, user seeding, app seed, JWT)
- `.github/workflows/integration-tests.yml:19-30` — Top-level workflow env block (CI, CI_SUPABASE, VITE_* vars). Copy verbatim.
- `.github/workflows/integration-tests.yml:61-63` — `supabase/setup-cli@v1` version pinning reference (not copied — see D-01 anti-goal).
- `.github/workflows/integration-tests.yml:90` — `supabase start -x` exclusion flags. Copy verbatim.
- `.github/workflows/integration-tests.yml:108-148` — `create_user` GoTrue Admin API function. Copy verbatim into inline bash block.
- `.github/workflows/integration-tests.yml:167-233` — Application data seed SQL. Copy verbatim into inline `psql` heredoc.
- `.github/workflows/integration-tests.yml:247-265` — `makeJwt` Node function. Copy verbatim into `node -e` heredoc, modified only to `export` rather than write `$GITHUB_ENV`.
- `.github/workflows/integration-tests.yml:290-301` — Playwright step env vars (E2E_*). Copy verbatim into env file.
- `.github/workflows/integration-tests.yml:313-319` — Vitest step env vars (E2E_COLLAB_*, E2E_INVITE_RAW_TOKEN*). Copy verbatim into env file.

### Playwright config (reused verbatim, not modified)
- `playwright.ci.config.ts` — The config the script invokes. DO NOT MODIFY. If modification is required, the phase is out of scope.
- `docs/pipeline/last-qa-report.md:20-21` — Documents the Playwright `webServer` env inheritance mechanism that makes D-03 viable.

### Target test files (existing, unchanged)
- `tests/e2e/invite-flow.spec.ts:117` — T-055-100 (phase 11 acceptance bar — known-passing test that MUST pass locally)
- `tests/e2e/invite-flow.spec.ts:228` — T-055-101 (Phase 13 scope, not Phase 11)
- `tests/e2e/project-realtime-matrix.spec.ts` — T-054B-300..305 (Phase 12 scope)
- `src/lib/__tests__/phase05.3-migrations.integration.test.ts:58,60,131,233` — consumes JWT tokens, verifies RPC (Phase 13 scope)

### Existing repo scripts (precedent — Phase 11 deviates deliberately on strict mode)
- `UPDATE_SUPABASE_KEY.sh` — uses `set -e` only
- `scripts/update-env-keys.sh` — uses no strict mode
- Phase 11 uses `set -euo pipefail` per D-06

### Milestone / requirement context
- `.planning/REQUIREMENTS.md:20` — E2E-00 requirement text
- `.planning/milestones/v1.3-ROADMAP.md:25-42` — Phase 11 section (milestone-level)
- `.planning/ROADMAP.md` (current milestone section) — Phase 11 hoisted detail
- `.planning/STATE.md` — Current project state, Eva+GSD hybrid contract

</canonical_refs>

<specifics>
## Specific Ideas (from ADR-0010 implementation plan)

**Exact file list:**
- NEW: `scripts/e2e-local.env.sh` (sourceable, not executable)
- NEW: `scripts/e2e-local.sh` (executable, `chmod +x`, ~100 lines bash)
- MODIFIED: `package.json` (one line after `"test:ci"` at line 75)
- NEW: `.planning/phases/11-local-ci-repro/11-RUNBOOK.md`

**Exact env variables exported by `e2e-local.env.sh` (21 total minimum):**
- `CI='true'`
- `CI_SUPABASE='true'` (LOAD-BEARING comment required)
- `VITE_SUPABASE_URL='http://localhost:54321'`
- `VITE_SUPABASE_ANON_KEY='eyJhbGci...n_I0'` (copy verbatim from workflow line 24)
- `SUPABASE_SERVICE_ROLE_KEY='eyJhbGci...IU'` (copy verbatim from workflow line 25)
- `VITE_CSP_DISABLED='true'`
- `E2E_OWNER_EMAIL='owner@test.com'`
- `E2E_OWNER_PASSWORD='test-password-123'`
- `E2E_INVITEE_EMAIL='collaborator@test.com'`
- `E2E_INVITEE_PASSWORD='test-password-123'`
- `E2E_PROJECT_ID='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`
- `E2E_BASE_URL='http://localhost:3003'`
- `E2E_USER_A_EMAIL='owner@test.com'`
- `E2E_USER_A_PASSWORD='test-password-123'`
- `E2E_USER_B_EMAIL='collaborator@test.com'`
- `E2E_USER_B_PASSWORD='test-password-123'`
- `E2E_PROJECT_URL='http://localhost:3003/?project=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`
- `E2E_COLLAB_OWNER_ID='11111111-1111-1111-1111-111111111111'`
- `E2E_COLLAB_USER_ID='22222222-2222-2222-2222-222222222222'`
- `E2E_COLLAB_PROJECT_ID='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`
- `E2E_STRANGER_USER_ID='33333333-3333-3333-3333-333333333333'`
- `E2E_INVITE_RAW_TOKEN='ci-test-invite-token-1'`
- `E2E_INVITE_RAW_TOKEN_2='ci-test-invite-token-2'`

**Exact `e2e-local.sh` sequence (10 steps):**
1. Resolve repo root via `SCRIPT_DIR` / `REPO_ROOT`
2. `docker info` check → exit 1 "Docker Desktop is not running..." if failing
3. Free port 3003: `lsof -ti:3003 | xargs kill -9 2>/dev/null || true`
4. `supabase status` exit check → `supabase stop && supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime` on failure
5. `supabase db reset`
6. `source "$SCRIPT_DIR/e2e-local.env.sh"`
7. Inline bash loop calling `create_user` via `curl POST http://localhost:54321/auth/v1/admin/users` with service-role key
8. Inline `psql` heredoc against `PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres`
9. Inline `node -e` heredoc generating `E2E_COLLAB_OWNER_TOKEN`, `E2E_COLLAB_USER_TOKEN`, `E2E_STRANGER_TOKEN`; export via `while IFS= read -r line; do export "$line"; done <<< "$JWT_OUTPUT"`
10. `exec npx playwright test --config playwright.ci.config.ts "$@"`

**Runbook sections (5 locked, in order):**
1. Prerequisites — Docker Desktop, Supabase CLI, Node 22.19.0, ports 54321/54322/54323, port 3003
2. Usage — 4 invocation forms (single test, single file, target file set, debugger mode)
3. What the script does — one sentence per step
4. Troubleshooting — 3 stubs: Docker not running, port 54321 in use, tests skip with no output
5. Known divergence risks — inline copy of ADR Known Risks 1-5

**Test spec (11 tests from ADR §Test Specification):**
- T-P11-001 (happy path — acceptance bar)
- T-P11-002 (env sourcing)
- T-P11-003 (arg forwarding via `--help`)
- T-P11-004 (empty test match)
- T-P11-005 (Docker absent)
- T-P11-006 (port 3003 occupied)
- T-P11-007 (orphaned supabase recovery)
- T-P11-008 (idempotent re-run)
- T-P11-009 (mutation test cleanliness — double T-055-102 run)
- T-P11-010 (CI_SUPABASE load-bearing check)
- T-P11-011 (runbook walkthrough)

7 failure-mode vs 3 happy-path — failure coverage exceeds happy-path per agent standards for infrastructure.

**Sizing:** 4 files (3 new + 1 modified). Medium complexity in script step only (multiple failure modes, inline JWT/curl/psql). Trivial elsewhere. Fits 5-plan sizing gate. Likely 1 plan total.

</specifics>

<deferred>
## Deferred Ideas

**Explicitly deferred by ADR-0010:**
- Supabase CLI version pinning (`.tool-versions`/`mise.toml`) — revisit v1.4+ if drift becomes a signal
- Schema parity validation between local and CI — anti-goal; discovered in Phase 12/13
- Teardown automation — not required
- Warm-stateful debug loop — anti-goal (mutation tests require pristine state); revisit v1.4+ for read-only realtime subset
- A second Playwright config file (`playwright.local.config.ts`) — anti-goal; fork only if `playwright.ci.config.ts` grows CI-runner-specific behavior
- Windows support — bash-only; v1.4+ concern
- Cold-start time under 60 seconds as test spec item — v1.3 milestone criterion, not Phase 11 test (too many uncontrolled variables)
- Parity of failing test signature — Phase 12/13 first action

**Companion script stubs deferred:**
- `scripts/e2e-local-inspect.sh` (debugger mode) — env file structure supports it but script itself is future work

</deferred>

---

*Phase: 11-local-ci-repro*
*Context gathered: 2026-04-11 via ADR-0010 express path (no /gsd-discuss-phase required — decisions locked by /architect)*
