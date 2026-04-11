# ADR-0010: Phase 11 — Local CI Reproduction Environment

## Status

Proposed (2026-04-11)

**Phase:** 11
**Milestone:** v1.3 — E2E Realtime Hardening
**Requirements satisfied:** E2E-00 (prerequisite for E2E-01 through E2E-09)
**Depends on:** Nothing (unblocks Phases 12 and 13)

## Context

The v1.2 E2E triage arc (2026-04-10 → 2026-04-11) shipped four layers of
access-control fixes across six pipelines and closed at commit `568a72e` with
CI Integration Tests still at 3/10 passing. The arc closed per the
"onion-peel strategy change signal" retro lesson: three-plus consecutive
pipelines with unchanged pass count is a signal that the debug strategy is
wrong, not that more iterations are needed.

The remaining seven failures are a different error class:

- **T-054B-300..305** (six tests) — realtime rendering, driven by a
  `strict mode violation: locator('[data-testid="design-matrix"]') resolved to
  2 elements` strongly suggesting `MatrixFullScreenView.tsx` and
  `DesignMatrix.tsx` overlap in render lifecycle.
- **T-055-101** — post-accept navigation timeout in
  `invite-flow.spec.ts:228`.
- **`phase05.3-migrations.integration.test.ts:233`** — pre-existing
  `accept_invitation` RPC returns `P0001 invalid_or_expired` where success is
  expected.

None of these are amenable to CI-log-based debugging. React render lifecycles
and post-navigation state mutations need a breakpoint, a DevTools inspector,
and a sub-minute iteration loop. A five-minute CI cycle per hypothesis is the
wrong tool.

**Phase 11 is the tool-change.** Its sole purpose is building a local
reproduction environment that mirrors CI closely enough that a developer can
reproduce the failing tests, set a breakpoint, and iterate. It is
infrastructure. It ships zero production code changes.

Phase 12 (realtime cluster) and Phase 13 (invite flow + RPC + pattern hygiene)
both depend on Phase 11. They are explicitly out of scope here.

### Spec challenge

The spec assumes CI and a developer's local Docker-based Supabase instance are
close enough that bugs repro locally. If that assumption is wrong, Phase 11
ships infrastructure that produces local green tests while CI stays red, and
Phases 12/13 regress to CI-log debugging. Mitigation: the acceptance bar is
deliberately set to plumbing smoke (one known-passing test executing
end-to-end), not parity of a failing test. If a failing test repros locally,
that's a bonus; if not, Phase 11 still validates the plumbing and Phase 12
discovers the divergence as its first action.

**SPOF:** the local Supabase CLI Docker stack. Failure mode: Docker Desktop
not running, port collision, or `supabase start` hangs on image pull.
Graceful degradation: the shell script checks `docker info` before `supabase
start`, kills port 3003 unconditionally, and handles orphaned supabase
processes via `supabase status` exit-code check + `supabase stop && supabase
start`. Failures surface as exit codes with human-readable messages, not
silent hangs.

### Anti-goals

- **Anti-goal: bit-for-bit CI parity.** Reason: Supabase CLI version pinning,
  schema diff validation, and GoTrue version matching are a week of work for
  a milestone whose goal is "stabilize tests and ship." Revisit: if Phase
  12/13 discover a local-vs-CI divergence that can't be root-caused in 30
  minutes.

- **Anti-goal: warm-stateful debug loop.** Reason: the v1.3 scope includes
  `T-055-101` and `accept_invitation` RPC tests which mutate invitation state
  (token consumption, role upgrades, expiry). A stateful loop contaminates
  state between runs, which produces false greens. Revisit: never, for the
  mutation-test category. A separate warm loop for read-only realtime tests
  may make sense in v1.4 but is not in scope here.

- **Anti-goal: a second Playwright config file.** Reason: Phase 10 shipped
  `playwright.ci.config.ts` against `playwright.e2e.config.ts` and the retro
  noted that duplicated configs drift. A third config (`playwright.local`)
  would immediately become drift-prone. Revisit: if `playwright.ci.config.ts`
  grows CI-runner-specific behavior (shard count, GitHub annotations) that
  becomes hostile to local dev, fork at that point and only at that point.

## Decision

Phase 11 builds a local CI-equivalent debug environment as a single shell
entry point that reuses the existing CI Playwright configuration verbatim.
Five locked decisions drive the design:

1. **Scope: Pragmatic.** No Supabase CLI version pinning. No parity
   validation between local and CI schemas. No teardown automation.
   `supabase start` runs against the existing `supabase/config.toml` and
   `supabase/seed.sql` with no new artifacts introduced. The milestone
   trusts that CI and local stay in sync; any divergence is discovered
   during Phase 12/13 debugging, not in advance.

2. **Debug-loop cadence: `supabase db reset` between every run.** Pristine
   state each iteration. The ~5-10 second overhead per run is accepted as
   the cost of deterministic behavior under the T-055-101 / RPC mutation
   tests in scope.

3. **Playwright config: reuse `playwright.ci.config.ts` verbatim.** No new
   `playwright.local.config.ts`. No new project mode in
   `playwright.config.ts`. The shell script exports the same environment
   variables the CI workflow exports, then invokes the CI config directly:
   `npx playwright test --config playwright.ci.config.ts "$@"`. The
   Playwright `webServer` subprocess inherits `process.env`, so
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `VITE_CSP_DISABLED` reach the dev server
   without additional plumbing — the same inheritance mechanism documented
   in `docs/pipeline/last-qa-report.md:20-21` during the v1.2 arc.

4. **Acceptance bar: plumbing smoke only.** `npm run e2e:local -- -g
   "T-055-100"` runs end-to-end and returns a Playwright pass for
   `tests/e2e/invite-flow.spec.ts:117` (the one known-passing CI test in the
   target files). No assertion that a failing test matches the CI failure
   signature. The bar is "the plumbing works"; the bug-hunting is
   Phase 12/13.

5. **Defensive cleanup for port 3003 and orphaned supabase processes.**
   The shell script kills anything holding port 3003 before starting,
   checks `supabase status` exit code to detect orphaned stacks, runs
   `supabase stop && supabase start` on orphan detection, and unconditionally
   runs `supabase db reset` before every Playwright invocation.

The implementation is four artifacts: two new shell files under `scripts/`,
one new runbook under `.planning/phases/11-local-ci-repro/`, and a one-line
addition to `package.json`. JWT generation is done inline via `node -e` in the
shell script, copying the CI workflow's `makeJwt` function verbatim. No new
Node helper module is added.

### A note on shell strict mode

`scripts/e2e-local.sh` uses `set -euo pipefail`, which is stricter than the
existing repo convention. Two prior shell scripts in the repo
(`UPDATE_SUPABASE_KEY.sh` and `scripts/update-env-keys.sh`) use `set -e` only
or no strict-mode flag at all. This deviation is deliberate: the script has
multiple independent failure modes (Docker absent, port in use, supabase
stale, db reset fails, JWT generation fails, playwright misconfigured) and
each should halt immediately with an exit code rather than cascade into a
confusing later failure. If the repo adopts `set -euo pipefail` as a
convention later, nothing here needs to change.

### A note on `CI_SUPABASE=true`

`CI_SUPABASE=true` is load-bearing. Every target test file
(`invite-flow.spec.ts`, `project-realtime-matrix.spec.ts`,
`phase05.3-migrations.integration.test.ts`) gates execution on this variable
and **skips** if it is unset. The blast-radius scout found references at
16 locations across test files. If a future contributor copies
`scripts/e2e-local.env.sh` into a different script without `CI_SUPABASE=true`,
every target test will silently skip and report success. This is a
discoverable footgun; the env file contains a comment marking the line as
load-bearing.

## Implementation Plan

### Step 1 — Create `scripts/e2e-local.env.sh`

**File:** `scripts/e2e-local.env.sh` (new, sourceable, not directly
executable)

**Contents:** Static env vars sourced by the main script. Separated from the
main script so future tooling (e.g., a companion `scripts/e2e-local-inspect.sh`
for debugger mode) can source the same env block.

**Variables exported (copy verbatim from
`.github/workflows/integration-tests.yml`):**

- Top-level workflow env block (lines 19-30):
  - `CI='true'`
  - `CI_SUPABASE='true'` — **LOAD-BEARING** (comment: "target tests skip
    without this")
  - `VITE_SUPABASE_URL='http://localhost:54321'`
  - `VITE_SUPABASE_ANON_KEY='eyJhbGci...n_I0'` (well-known Supabase local
    anon key — copy verbatim from workflow line 24)
  - `SUPABASE_SERVICE_ROLE_KEY='eyJhbGci...IU'` (well-known Supabase local
    service role key — copy verbatim from workflow line 25)
  - `VITE_CSP_DISABLED='true'`

- Playwright step env vars (workflow lines 290-301):
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

- Vitest step env vars (workflow lines 313-319):
  - `E2E_COLLAB_OWNER_ID='11111111-1111-1111-1111-111111111111'`
  - `E2E_COLLAB_USER_ID='22222222-2222-2222-2222-222222222222'`
  - `E2E_COLLAB_PROJECT_ID='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`
  - `E2E_STRANGER_USER_ID='33333333-3333-3333-3333-333333333333'`
  - `E2E_INVITE_RAW_TOKEN='ci-test-invite-token-1'`
  - `E2E_INVITE_RAW_TOKEN_2='ci-test-invite-token-2'`

**File header:**
```bash
#!/usr/bin/env bash
# scripts/e2e-local.env.sh
#
# Sourceable env block for local CI reproduction. Mirrors the environment
# used by .github/workflows/integration-tests.yml so tests run the same
# locally as in CI.
#
# DO NOT execute directly. Source from scripts/e2e-local.sh.
```

**Export style:** Each variable with explicit `export VAR=value`. No
here-docs. Comments only where load-bearing (above `CI_SUPABASE`,
`VITE_CSP_DISABLED`).

**Acceptance criteria:**
- File exists and is readable.
- Sourcing from an interactive bash shell exports every variable listed
  above with no errors.
- `env | grep -c '^E2E_'` returns at least 16 after sourcing.

**Complexity:** Low. Mechanical copy from the workflow file.

**Files touched:** 1 (new).

---

### Step 2 — Create `scripts/e2e-local.sh`

**File:** `scripts/e2e-local.sh` (new, executable, `chmod +x`)

**Shebang and strict mode:**
```bash
#!/usr/bin/env bash
set -euo pipefail
```

**High-level sequence (each sub-step halts on failure via `set -e`):**

1. **Resolve repo root.** Use `SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)` and derive `REPO_ROOT=$(dirname "$SCRIPT_DIR")`. `cd "$REPO_ROOT"`.

2. **Check Docker is running.** `docker info >/dev/null 2>&1 || { echo "ERROR: Docker Desktop is not running. Start Docker Desktop and retry."; exit 1; }`.

3. **Free port 3003.** `lsof -ti:3003 | xargs kill -9 2>/dev/null || true`.
   Always runs. Defends against a previous `npm run dev` still holding the
   port.

4. **Check supabase status; recover from orphan state.**
   ```bash
   if ! supabase status >/dev/null 2>&1; then
     echo "Supabase stack not running or stale. Resetting..."
     supabase stop 2>/dev/null || true
     supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime
   fi
   ```
   The `-x` flags mirror the CI workflow (line 90) exactly. Studio, imgproxy,
   vector, logflare, supavisor, and edge-runtime are excluded — they are not
   needed by any target test and would slow cold-start by 1-2 minutes.

5. **Reset database to pristine state.** `supabase db reset`. Replays
   migrations and `seed.sql` from scratch. ~5-10s on a warm Docker host.

6. **Source static env block.** `source "$SCRIPT_DIR/e2e-local.env.sh"`.

7. **Seed GoTrue users via Admin API.** Inline bash block copying the
   workflow's `create_user` function verbatim (workflow lines 108-148).
   Creates owner, collaborator, and stranger users via
   `POST http://localhost:54321/auth/v1/admin/users` with the service-role
   key. Idempotent against `db reset` because the reset wipes auth.users
   along with everything else.

8. **Seed application data.** Inline `psql` heredoc copying the workflow's
   seed SQL verbatim (workflow lines 167-233). Inserts into `public.users`,
   `public.user_profiles`, `projects`, `project_collaborators`,
   `project_invitations`, and refreshes `admin_user_stats`. Connection:
   `PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres`.

9. **Generate JWT tokens inline.** Copy the workflow's `node -e` block
   verbatim (workflow lines 247-265), modified to `export` the tokens
   directly into the current shell rather than writing to `$GITHUB_ENV`:
   ```bash
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
   ")
   while IFS= read -r line; do
     export "$line"
   done <<< "$JWT_OUTPUT"
   ```
   Secret `super-secret-jwt-token-with-at-least-32-characters-long` is the
   Supabase CLI local default and matches the CI workflow.

10. **Invoke Playwright with CI config.** `exec npx playwright test --config
    playwright.ci.config.ts "$@"`. The `exec` replaces the shell process so
    Playwright's exit code is the script's exit code. `"$@"` forwards all
    script arguments (e.g., `-g "T-055-100"`, `--debug`, `--ui`, specific
    file paths) without quoting issues.

**Echo conventions:** Each major step prints a one-line status message to
stderr so the user sees progress (`>&2 echo "[e2e-local] step N: ..."`).

**Acceptance criteria:**
- `bash scripts/e2e-local.sh --help` forwards to `playwright test --help`
  and returns exit 0.
- `bash scripts/e2e-local.sh -g "nonexistent-test-name"` runs through all
  setup steps and Playwright reports zero tests run with exit 0.
- Running twice in succession from a clean state produces identical behavior
  (idempotent).
- Docker absent → exits 1 with "Docker Desktop is not running" before
  attempting `supabase start`.

**Complexity:** Medium. Multiple failure modes, inline code from two
workflow steps, strict-mode deviation from repo convention. ~100 lines of
bash.

**Files touched:** 1 (new).

---

### Step 3 — Add `e2e:local` npm script

**File:** `package.json` (modified)

**Change:** Add `"e2e:local": "bash scripts/e2e-local.sh"` to the scripts
block. Place it immediately after `"test:ci"` (line 75) for discoverability
— the two scripts are conceptually paired (CI vs local variant of the same
config).

**Why `bash` explicitly and not `./scripts/e2e-local.sh`:** Portability
across shells. A contributor using zsh or fish as their default shell still
gets bash as the executor. Also avoids needing `chmod +x` for the npm
script to work (though Step 2 still chmods the file for direct invocation).

**Acceptance criteria:**
- `npm run e2e:local -- --help` forwards to `playwright test --help`.
- `npm run e2e:local -- -g "T-055-100"` runs T-055-100 end-to-end and
  exits 0.
- The `--` separator correctly forwards arguments through npm to the
  shell script to Playwright.

**Complexity:** Trivial. One line.

**Files touched:** 1 (modified).

---

### Step 4 — Create `.planning/phases/11-local-ci-repro/11-RUNBOOK.md`

**File:** `.planning/phases/11-local-ci-repro/11-RUNBOOK.md` (new)

**Sections (in order):**

1. **Prerequisites** — Docker Desktop installed and running, Supabase CLI
   installed (`brew install supabase/tap/supabase` or platform equivalent),
   Node 22.19.0 (`.nvmrc`), ports 54321/54322/54323 free (no other Supabase
   project running locally), port 3003 free or killable.

2. **Usage** — Three forms:
   - `npm run e2e:local -- -g "T-055-100"` (single test)
   - `npm run e2e:local -- tests/e2e/invite-flow.spec.ts` (single file)
   - `npm run e2e:local -- tests/e2e/invite-flow.spec.ts tests/e2e/project-realtime-matrix.spec.ts` (full CI target set)
   - `npm run e2e:local -- --debug -g "T-054B-300"` (debugger mode)

3. **What the script does** — One-sentence summary per step from Step 2
   above. Developer should understand at a glance why it takes ~30-45s to
   start.

4. **Troubleshooting** — Three stubs for the risks flagged below:
   - "Docker Desktop not running" → start Docker.
   - "Port 54321 in use" → another Supabase project is running; stop it
     with `cd <other-project> && supabase stop`.
   - "Tests skip with no output" → check that the script exported
     `CI_SUPABASE=true`; re-run and `echo $CI_SUPABASE` in the same shell.

5. **Known divergence risks** — Inline copy of the five risks from this
   ADR's "Known Risks" section. The runbook owns the developer-facing
   version; the ADR owns the decision trail.

**Acceptance criteria:**
- File exists at the specified path.
- A developer unfamiliar with the project can run `npm run e2e:local --
  -g "T-055-100"` using only the runbook and see a green test.
- All five known risks are documented as a numbered list.

**Complexity:** Low. Pure documentation, no code.

**Files touched:** 1 (new, in `.planning/`, not `docs/`).

---

### Sizing summary

| Step | Files | Complexity | Risk |
|------|-------|-----------|------|
| 1. `e2e-local.env.sh` | 1 new | Low | Low (mechanical copy) |
| 2. `e2e-local.sh` | 1 new | Medium | Medium (failure modes, JWT) |
| 3. `package.json` entry | 1 modified | Trivial | Low |
| 4. `11-RUNBOOK.md` | 1 new | Low | Low |
| **Total** | **3 new + 1 modified** | **Medium** | **Medium** |

Four files, three new and one modified, all sized to fit the 5-test sizing
gate (S1-S5). No step exceeds 10 files. No step touches production code.

## Test Specification

Phase 11 is infrastructure. It is not Vitest-testable in the conventional
sense. The test specification below is for Roz to exercise the shell script
and runbook directly; most "tests" are manual shell invocations that verify
the plumbing does what it says on the tin.

| ID | Category | Description | Expected Outcome | Exercised Via |
|----|----------|-------------|------------------|---------------|
| T-P11-001 | Plumbing smoke (happy path) | Run `npm run e2e:local -- -g "T-055-100"` from a clean state with Docker running. | Exit code 0. Playwright reports 1 passed, 0 failed. `tests/e2e/invite-flow.spec.ts:117` executes against `http://localhost:3003` backed by local Supabase. This is the phase acceptance bar. | `npm run e2e:local -- -g "T-055-100"` |
| T-P11-002 | Env block sourcing | Source `scripts/e2e-local.env.sh` from an interactive bash shell and inspect environment. | Every variable listed in Step 1 is exported. `echo $CI_SUPABASE` returns `true`. `env \| grep -c '^E2E_'` returns at least 16. | `source scripts/e2e-local.env.sh && env \| grep '^E2E_\\\|^CI_SUPABASE\\\|^VITE_'` |
| T-P11-003 | Argument forwarding | Run `npm run e2e:local -- --help`. | Playwright prints its help text. Exit code 0. Confirms `"$@"` forwards through npm, bash, and exec to playwright. | `npm run e2e:local -- --help` |
| T-P11-004 | Empty test match | Run `npm run e2e:local -- -g "does-not-exist-asdf"`. | Script completes all setup steps (Docker check, port kill, supabase status, db reset, seed, JWT, exec). Playwright reports 0 tests run. Exit code 0 (no tests matching is not an error). | `npm run e2e:local -- -g "does-not-exist-asdf"` |
| T-P11-005 | Docker absent (negative) | Stop Docker Desktop. Run `npm run e2e:local`. | Exit code 1. Stderr contains "Docker Desktop is not running". No `supabase start` invocation occurs. | Stop Docker; `npm run e2e:local`; `echo $?` |
| T-P11-006 | Port 3003 occupied (negative) | Start a placeholder process on port 3003 (`nc -l 3003 &`). Run `npm run e2e:local -- -g "T-055-100"`. | Script kills the placeholder via `lsof -ti:3003 | xargs kill -9`, then proceeds normally. T-055-100 passes. Exit code 0. | `nc -l 3003 &; npm run e2e:local -- -g "T-055-100"` |
| T-P11-007 | Orphaned supabase recovery (negative) | Run `supabase stop` in the project root to leave a stopped stack. Run `npm run e2e:local -- -g "T-055-100"`. | `supabase status` exit code non-zero, script runs `supabase stop && supabase start`, then proceeds. Exit code 0, T-055-100 passes. | `supabase stop; npm run e2e:local -- -g "T-055-100"` |
| T-P11-008 | Idempotent re-run | Run `npm run e2e:local -- -g "T-055-100"` twice in succession. | Both runs return exit 0 and green T-055-100. Second run does not hang, does not warn about existing stack, does not produce stale-state errors. | `npm run e2e:local -- -g "T-055-100" && npm run e2e:local -- -g "T-055-100"` |
| T-P11-009 | Mutation test cleanliness | Run `npm run e2e:local -- -g "T-055-102"` (expired invite state) twice. | Both runs pass. Confirms `supabase db reset` between runs is effective — a test that consumes an invite token in run 1 does not contaminate run 2. | `npm run e2e:local -- -g "T-055-102" && npm run e2e:local -- -g "T-055-102"` |
| T-P11-010 | CI_SUPABASE load-bearing check | `unset CI_SUPABASE; npm run e2e:local -- -g "T-055-100"`. | T-055-100 still passes because the script sources `e2e-local.env.sh` which re-exports `CI_SUPABASE=true`. This test verifies the env file actually sets the variable rather than relying on ambient shell state. | `unset CI_SUPABASE; npm run e2e:local -- -g "T-055-100"` |
| T-P11-011 | Runbook walkthrough | A reader (Roz, another agent, or a human) follows `11-RUNBOOK.md` from Prerequisites through Usage on a machine with Docker + Supabase CLI installed but no prior project context. | Reader successfully runs T-P11-001 using only the runbook. Any step requiring knowledge not in the runbook is a documentation gap Roz files as a finding. | Manual walkthrough |

**Failure-mode coverage vs happy path:** 7 failure-mode tests (T-P11-004
through T-P11-010) vs 3 happy-path tests (T-P11-001, T-P11-002, T-P11-003).
Failure coverage exceeds happy-path coverage as required by agent standards
for infrastructure changes.

**Not covered (out of scope for Phase 11 testing):**
- Parity of a failing test's signature. Covered in Phase 12/13 as the first
  action.
- Windows compatibility. Bash-only; no testing on Windows.
- Cold-start time under 60 seconds (milestone success criterion). This is
  a v1.3 milestone criterion, not a Phase 11 test spec item — the cold-start
  is affected by Docker image cache state, supabase CLI version, network
  speed, and host hardware, none of which Phase 11 controls. A "works on
  my machine in 30-45 seconds" anecdote in the runbook is sufficient.

## Contract Boundaries

This phase has no API contracts, no data contracts, and no cross-module
shape changes. The single "contract" is between the shell script and the
Playwright process via environment variables.

| Producer | Shape | Consumer | Notes |
|----------|-------|----------|-------|
| `scripts/e2e-local.env.sh` | Env vars listed in Step 1 (16 `E2E_*`, 5 `VITE_*`/`CI*`/`SUPABASE_*`) | `scripts/e2e-local.sh` | Sourced, not forked |
| `scripts/e2e-local.sh` (JWT block) | `E2E_COLLAB_OWNER_TOKEN`, `E2E_COLLAB_USER_TOKEN`, `E2E_STRANGER_TOKEN` | `src/lib/__tests__/phase05.3-migrations.integration.test.ts` (lines 58, 60, 131) | Generated at script runtime, expiry 1h |
| `scripts/e2e-local.sh` (exec) | `process.env` | Playwright CLI → `playwright.ci.config.ts` webServer subprocess | `webServer.env` in Playwright merges with inherited env (not replace); relies on documented inheritance from `last-qa-report.md:20-21` |
| `playwright.ci.config.ts` webServer | `process.env` with `NODE_ENV=test`, `CI=true` added | `npm run dev` (Vite dev server) | `VITE_*` vars propagate to the Vite dev server at startup; Vite reads them via `loadEnv` in `vite.config.ts` |

## Wiring Coverage

Every producer in Phase 11 has a consumer inside Phase 11. No orphan
producers.

| Producer | Step | Consumer | Step |
|----------|------|----------|------|
| `scripts/e2e-local.env.sh` (static env vars) | Step 1 | `scripts/e2e-local.sh` (sources it) | Step 2 |
| `scripts/e2e-local.sh` (executable entry point) | Step 2 | `package.json` `e2e:local` npm script | Step 3 |
| `scripts/e2e-local.sh` (executable entry point) | Step 2 | `.planning/phases/11-local-ci-repro/11-RUNBOOK.md` (usage examples) | Step 4 |
| `package.json` `e2e:local` | Step 3 | `.planning/phases/11-local-ci-repro/11-RUNBOOK.md` (primary documented command) | Step 4 |
| `scripts/e2e-local.sh` (JWT exports) | Step 2 | Vitest target file `phase05.3-migrations.integration.test.ts` (existing, unchanged) | Pre-existing |
| `scripts/e2e-local.sh` (Playwright exec) | Step 2 | `playwright.ci.config.ts` (existing, unchanged) | Pre-existing |

All new artifacts consumed within the phase or by existing test infrastructure.

## UX Coverage

Not applicable. Phase 11 ships no UI. No UX doc exists or is required for
this phase. `ls docs/ux/*phase-11*` confirmed empty at ADR production time.

## Data Sensitivity

| Asset | Classification | Notes |
|-------|----------------|-------|
| Well-known Supabase local anon/service-role keys | Public | Documented by Supabase for local dev. Checked into `.github/workflows/integration-tests.yml` already. Safe to check into `scripts/e2e-local.env.sh`. |
| `E2E_*_PASSWORD` values (`test-password-123`) | Public | Test fixtures against a local-only Supabase instance bound to `localhost`. Not reachable from outside the dev machine. |
| `E2E_INVITE_RAW_TOKEN` values | Public | Deterministic strings used only against local Supabase seed data. |
| JWT secret `super-secret-jwt-token-with-at-least-32-characters-long` | Public | Supabase CLI local default, documented by Supabase. |
| Any real customer data | N/A — not present | Phase 11 never touches production credentials. `SUPABASE_SERVICE_ROLE_KEY` in the env file is the local-CLI key, not the production hosted-Supabase key. |

## Known Risks

These are flagged, not mitigated. They become Phase 12/13 debugging
signals if local repro diverges from CI.

1. **Supabase CLI version drift between local and CI.** CI uses
   `supabase/setup-cli@v1` with `version: latest` (`.github/workflows/
   integration-tests.yml:61-63`). Local developers run whatever version
   their `brew install supabase` picked up. Both environments track
   "current" which usually keeps them in lockstep but can diverge at a CI
   run boundary (new CLI released between local `brew upgrade` and next CI
   run). A divergence surfaces as migration/seed behavior differences, not
   as an obvious error message. Phase 11 does not pin a version; v1.4+ may
   revisit with `.tool-versions` or `mise.toml` if drift becomes a signal.

2. **Supabase default port collision (54321/54322/54323).** A developer
   running a second Supabase project on the same machine will find `supabase
   start` fails with a port-already-in-use error. The runbook documents the
   workaround (`cd <other-project> && supabase stop`) but the script does
   not auto-detect this case. Acceptable because port collision produces a
   loud Supabase CLI error, not a silent corruption.

3. **`supabase db reset` produces more pristine state than CI.** CI runs
   `supabase start` once, then seeds on top. Local runs `supabase db reset`
   before every test invocation. A migration-order bug that surfaces in CI's
   "started once, seeded once" path may not surface in local's "reset
   fresh every time" path. If a test passes locally but fails in CI on a
   migration-specific error, this risk is the cause.

4. **Dev server env leakage.** Environment variables set in the developer's
   shell (e.g., from their personal `.env` or prior `export VITE_*`
   commands) can leak into the Playwright `webServer` subprocess because
   Playwright merges the parent environment with the config's `env:` block
   rather than replacing it. The v1.2 arc QA report
   (`docs/pipeline/last-qa-report.md:20-21`) analyzed this same inheritance
   behavior and confirmed it is how the CI workflow's env block reaches the
   dev server successfully — this is load-bearing for Phase 11 too. The
   risk is that ambient shell env vars mask script-exported vars if they
   happen to share a name. The runbook recommends "run from a clean
   terminal tab" as the mitigation; the script does not scrub ambient
   state.

5. **No Windows support.** The script is bash-only. `lsof`, `kill -9`,
   `here-doc` redirection, `PGPASSWORD=postgres psql`, and sourcing
   semantics all assume a Unix shell. This is consistent with the
   project's solo-developer macOS setup and the v1.2 infrastructure's
   implicit assumptions. Windows support is a v1.4+ concern.

## Alternatives Considered

### Scope alternatives

**A. Faithful — bit-for-bit CI parity with version pinning and schema
diff validation.** Rejected. Would require `.tool-versions` or `mise.toml`
plus a schema-diff validation harness (dump local schema, dump CI schema,
diff). Estimated week of work for a milestone whose goal is "stabilize
tests and ship." Revisit if Phase 12/13 discover a local-vs-CI divergence
that blocks real bug investigation.

**B. Pragmatic.** **SELECTED.** Reuse CI's `supabase/config.toml` and
`seed.sql`, trust version alignment, no parity validation.

**C. Minimal — runbook only.** Rejected. Documentation drifts against
unpinned tooling within weeks. A runbook without an executed script is a
liability.

### Debug-loop cadence alternatives

**A. Long-running stateful.** Start supabase once, iterate freely against
warm state. Rejected. T-055-101 and the `accept_invitation` RPC test mutate
invitation state (token consumption, expiry, role upgrades). Warm state
between runs produces false greens.

**B. Pristine reset between every run.** **SELECTED.** `supabase db reset`
every time. 5-10 second cost per iteration, fully deterministic.

**C. Reset on smell.** Developer decides when to reset based on "feels
off" intuition. Rejected. Relies on human discipline at the exact moment
(late-night debugging of realtime bug) when discipline is lowest.

### Playwright config alternatives

**A. Duplicate as `playwright.local.config.ts`.** Rejected. Two configs
drift. Phase 10 retro explicitly flagged this failure mode when shipping
`playwright.ci.config.ts` alongside `playwright.e2e.config.ts`.

**B. Extend CI config via TypeScript inheritance.** Rejected. Abstraction
leaks. Any CI-specific change (sharding, GitHub annotations) breaks the
local inheritance chain.

**C. New project mode inside default `playwright.config.ts`.** Rejected.
Pollutes the default dev config with CI-specific concerns and bifurcates
"which mode am I in" into a new failure class.

**D. Reuse `playwright.ci.config.ts` verbatim from a shell script.**
**SELECTED.** No new config. Env vars come from the shell script.

### Acceptance bar alternatives

**A. Plumbing smoke — one known-passing test executes end-to-end.**
**SELECTED.** Acceptance: `npm run e2e:local -- -g "T-055-100"` → exit 0.

**B. Plumbing smoke + one known-failing test matches CI failure
signature.** Rejected. Hinging Phase 11 on a specific CI failure's
reproducibility creates coupling between infrastructure and the bug
actually being debugged. If Phase 12 later discovers a different root
cause, the Phase 11 acceptance test either needs rewriting or becomes
misleading.

**C. Runbook-only, no script execution required.** Rejected. Same
reasoning as scope option C — infrastructure that has not been executed is
a liability.

### Port collision strategy alternatives

**A. Fail-loud on collision.** Script exits 1 if port 3003 is in use,
prints "kill your dev server first". Rejected. Friendlier DX via
kill-and-restart than a scripted manual instruction.

**B. Kill-and-restart.** **SELECTED.** `lsof -ti:3003 | xargs kill -9
2>/dev/null || true` runs unconditionally.

### JWT generation alternatives

**A. Inline `node -e` heredoc in the shell script, copied verbatim from
the CI workflow.** **SELECTED.** Keeps Phase 11 to two shell files.
15 lines of inline code.

**B. Separate reusable `scripts/generate-e2e-jwt.mjs` helper.** Rejected
for now. Smaller surface area to ship. Promote to a helper if the inline
block grows past ~20 lines in a future phase.

## Out-of-Scope Fence

Phase 11 **does NOT** include any of the following. All are explicitly
deferred to later phases or milestones:

- **T-054B-300..305 fix work.** Deferred to Phase 12.
- **T-055-101 fix work.** Deferred to Phase 13.
- **`accept_invitation` RPC fix** (`phase05.3-migrations.integration.test.ts:233`).
  Deferred to Phase 13 as E2E-09.
- **`src/lib/services/CollaborationService.ts:97` pattern fix.** Deferred
  to Phase 13 as TECH-01.
- **Silent error swallowing ADR** (`validateProjectAccess` collab/admin
  queries re-introducing `error:` destructuring). Deferred to Phase 13 as
  TECH-02.
- **Supabase CLI version pinning mechanism.** No `.tool-versions`, no
  `mise.toml`, no `asdfrc`. Deferred to v1.4+ if drift becomes a signal.
- **New Playwright config file.** No `playwright.local.config.ts`. No new
  project mode in `playwright.config.ts`. Phase 11 reuses
  `playwright.ci.config.ts` verbatim.
- **Teardown automation.** No `trap` handler to `supabase stop` on exit.
  Developer is responsible for cleaning up their local stack when they're
  done iterating (or just leaving it running; it's cheap).
- **JWT caching or reuse across runs.** Tokens are regenerated on every
  invocation. 1-hour expiry is plenty for iteration.
- **Parity validation infrastructure.** No schema diff, no migration
  version check, no seed data diff.
- **Windows or WSL support.** Bash-only.
- **CI workflow changes.** `.github/workflows/integration-tests.yml` is
  untouched. Phase 11 copies from it, does not modify it.
- **Any production code changes.** Zero.
- **Any test code changes.** Zero. Target test files
  (`invite-flow.spec.ts`, `project-realtime-matrix.spec.ts`,
  `phase05.3-migrations.integration.test.ts`) are read by Phase 11 only to
  confirm they gate on `CI_SUPABASE`.

If Colby finds himself opening any file in the above list during Phase 11
execution, STOP and escalate — scope has drifted.

## Consequences

### What this ADR enables

- Phase 12 and Phase 13 can debug their respective failing tests against a
  local reproduction environment instead of CI logs. Iteration time drops
  from a five-minute CI cycle (push, wait, read log, hypothesize) to a
  30-45 second local cycle (edit, run, set breakpoint, inspect).
- A second developer (or the filer after a week) can follow the runbook
  and reproduce any CI test state on their machine without tribal knowledge.
- Future phases that need Supabase-backed integration tests can extend the
  pattern — `scripts/e2e-local.env.sh` becomes a reusable sourceable block
  for any script that needs the same CI-equivalent env.

### What this ADR costs

- 3 new files + 1 modified file in the repo. Low maintenance burden.
- A deliberate deviation from repo shell-script strict-mode convention
  (`set -euo pipefail` vs `set -e`). Documented and justified.
- Developers need Docker Desktop and the Supabase CLI installed locally.
  The runbook flags this as a prerequisite. CI-only contributors (unlikely
  on this solo-dev project) would not use the script.

### What debt this creates

- **Duplicated env configuration.** Values in `scripts/e2e-local.env.sh`
  are verbatim copies from `.github/workflows/integration-tests.yml`. If
  the CI workflow's env block changes, the local env file must be updated
  in lockstep. Mitigation: the file header comments direct readers to the
  workflow as the source of truth, and the duplication is small (~20
  variables). A future phase could extract to a YAML or JSON file sourced
  by both, but that is over-engineering for the current scope.

- **Supabase CLI version drift risk is unmitigated.** If drift causes a
  Phase 12/13 debugging false-positive, that is the trigger to revisit.
  This ADR accepts the risk rather than preemptively solving it.

- **Inline JWT generation code is duplicated between the CI workflow and
  `scripts/e2e-local.sh`.** The function is 15 lines. If it grows past
  20 lines or becomes needed by a third caller, promote to
  `scripts/generate-e2e-jwt.mjs`. Until then, duplication is cheaper than
  a helper module.

- **No automated teardown.** A developer's local supabase stack stays
  running indefinitely across iterations. This is fine for active work
  but consumes ~2GB RAM if they forget about it. Runbook mentions
  `supabase stop` as a manual cleanup step. Automated teardown is
  explicitly out of scope.

## Notes for Colby

- **Read `docs/pipeline/last-qa-report.md` lines 20-21 before writing the
  shell script.** The v1.2 arc analysis of Playwright `webServer`
  subprocess env inheritance is load-bearing. The script relies on the
  same inheritance behavior the CI workflow relies on — `webServer.env`
  in `playwright.ci.config.ts` augments rather than replaces inherited
  environment, so vars exported by the script reach the Vite dev server
  via `process.env`.

- **Copy the CI workflow's env block, seed SQL, GoTrue Admin API user
  creation, and JWT generation blocks verbatim.** This is a
  mechanical-transcription step. Do not "improve" or normalize them. Any
  divergence from the workflow's exact values is a Phase 11 failure.
  Verification: `diff <(grep -E '^\s+E2E_|^\s+VITE_|^\s+CI' .github/workflows/integration-tests.yml) scripts/e2e-local.env.sh`
  should show only formatting differences (workflow uses YAML `:`, script
  uses bash `export KEY=value`).

- **Check `docker info` before `supabase start`.** One extra line of
  bash buys a much better error message than letting `supabase start`
  hang or explode on a missing Docker daemon.

- **Use `exec` for the final Playwright invocation.** Not `playwright
  test` as a subshell. `exec` replaces the bash process so Playwright's
  exit code is the script's exit code, and signals (Ctrl+C) propagate
  cleanly.

- **`"$@"` must be quoted.** Forwarding arguments as `$@` unquoted will
  break on test names containing spaces. Always `exec npx playwright test
  --config playwright.ci.config.ts "$@"`.

- **The `-x` flag list for `supabase start` is literal:**
  `studio,imgproxy,vector,logflare,supavisor,edge-runtime`. Copy exactly
  from `.github/workflows/integration-tests.yml:90`. Reordering or
  reformatting these is fine; omitting one will slow cold-start.

- **`chmod +x scripts/e2e-local.sh`** after creating it. The npm script
  calls `bash scripts/e2e-local.sh` so chmod is strictly optional for the
  npm path, but direct invocation (`./scripts/e2e-local.sh`) should work
  from the runbook too.

- **Step order matters for the shell script.** Docker check → port
  kill → supabase recovery → db reset → source env → seed users → seed
  data → generate JWT → exec playwright. Any reordering creates a subtle
  failure mode (e.g., sourcing env before db reset means postgres
  connection env vars apply to the wrong database state).

- **Proven pattern:** the CI workflow steps at lines 60-265 are
  battle-tested across the v1.2 arc's 6 pipelines. Copying them verbatim
  is the low-risk path. Any deviation creates a new thing to debug.

## DoR — Requirements Sources

| Requirement | Source | Extracted content |
|-------------|--------|-------------------|
| E2E-00 prerequisite | `.planning/milestones/v1.3-REQUIREMENTS.md:41` | "A local CI-equivalent reproduction environment exists. Developer can run supabase start, seed GoTrue users with Admin API, run the failing Playwright specs against localhost:3003, and iterate in seconds rather than 5-pipeline CI cycles." |
| Phase 11 goal | `.planning/milestones/v1.3-ROADMAP.md:27` | "A developer can reproduce any of the 8 failing tests against a local Supabase instance in under a minute of cold-start time, with no CI dependency." |
| Success criterion 1 | `.planning/milestones/v1.3-ROADMAP.md:32` | "`supabase start` + GoTrue Admin user seeding documented in a runbook" — satisfied by Step 4. |
| Success criterion 2 | `.planning/milestones/v1.3-ROADMAP.md:33` | "`npm run e2e:local` runs the Playwright Integration Tests suite against `localhost:3003` with the same seed data as CI" — satisfied by Steps 2 and 3. |
| Success criterion 3 | `.planning/milestones/v1.3-ROADMAP.md:34` | "At least one of the 8 failing tests is successfully reproduced locally" — **deliberately relaxed** to "plumbing smoke against T-055-100 (known-passing)" per locked decision 4. Divergence noted in Consequences. |
| Success criterion 4 | `.planning/milestones/v1.3-ROADMAP.md:35` | "Runbook includes env var setup, seed commands, Playwright config pointer, troubleshooting section" — satisfied by Step 4. |
| Success criterion 5 | `.planning/milestones/v1.3-ROADMAP.md:36` | "Runbook is tested by running it on a clean machine state (or documented as known working from X state)" — satisfied by T-P11-011. |
| Retro risks | Onion-peel strategy change signal | Drove Phase 11's existence. Phase 11 itself has no recursion risk because it has a concrete acceptance bar (T-055-100 passes). |

## DoD — Verification Table

| Deliverable | Verification | Owner | No Silent Drop Check |
|-------------|--------------|-------|---------------------|
| `scripts/e2e-local.env.sh` exists and sources cleanly | T-P11-002 | Roz | Variables enumerated in Step 1; Roz greps for each. |
| `scripts/e2e-local.sh` exists and is executable | `ls -l scripts/e2e-local.sh` shows `x` bit | Colby (builds), Roz (verifies) | `chmod +x` done in Step 2. |
| `package.json` has `"e2e:local"` entry next to `"test:ci"` | `jq '.scripts."e2e:local"' package.json` returns the command | Colby | Eva's diff review catches any missing entry. |
| `.planning/phases/11-local-ci-repro/11-RUNBOOK.md` exists | `ls .planning/phases/11-local-ci-repro/11-RUNBOOK.md` | Colby | Runbook walkthrough (T-P11-011) validates content. |
| Plumbing smoke passes | T-P11-001 | Roz | Phase acceptance bar. Failure here = Phase 11 failure. |
| All 11 test-spec items pass | T-P11-001 through T-P11-011 | Roz | Roz reports each in her QA report by ID. |
| Shell script uses `set -euo pipefail` | `grep 'set -euo pipefail' scripts/e2e-local.sh` | Roz | Deviation from repo convention is documented; Roz confirms script actually uses strict mode. |
| Env file marks `CI_SUPABASE` load-bearing | `grep -B1 -A1 'CI_SUPABASE' scripts/e2e-local.env.sh` shows comment | Roz | Footgun documentation check. |
| No source files modified | `git diff --name-only HEAD` post-build shows only the 4 files from the plan | Roz | Out-of-scope fence enforcement. Anything else = scope drift. |
| JWT generation copies CI workflow verbatim | Diff against workflow lines 247-265 | Roz | Mechanical transcription check. |
| Playwright invocation uses `exec` | `grep 'exec npx playwright' scripts/e2e-local.sh` | Roz | Signal/exit-code propagation check. |
| Docker check precedes `supabase start` | `grep -B10 'supabase start' scripts/e2e-local.sh` shows `docker info` check | Roz | Error-message quality check. |
| Runbook lists all 5 known risks | `grep -c '^[0-9]\.' .planning/phases/11-local-ci-repro/11-RUNBOOK.md` | Roz | Risk transparency check. |

No silent drops. Every requirement from `v1.3-ROADMAP.md` Phase 11 success
criteria maps to a Step, a test-spec item, and a DoD verification row. The
one deliberate divergence (success criterion 3 relaxed from "failing test
repros locally" to "known-passing test T-055-100 runs end-to-end") is
documented in this table and in the Consequences section.
