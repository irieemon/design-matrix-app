# Phase 11 Runbook — Local CI Reproduction Environment

**Phase:** 11 — Local CI Reproduction Environment
**Requirement:** E2E-00
**ADR:** [ADR-0010](../../../docs/architecture/ADR-0010-phase-11-local-ci-repro.md)

A single command — `npm run e2e:local` — runs the CI Playwright Integration
Tests suite against a local Supabase stack. Iterate in ~30-45 seconds
instead of 5-minute CI pipelines.

## Prerequisites

- **Docker Desktop** installed and running. `docker info` must succeed
  before the script will proceed past Step 2.
- **Supabase CLI** installed (`brew install supabase/tap/supabase` on macOS,
  or platform equivalent). No version pinning — local tracks whatever
  `brew upgrade supabase` picked up. See Known divergence risk #1 below.
- **Node 22.19.0** (see `.nvmrc`). Run `nvm use` in the repo root before
  the first invocation.
- **`jq`** on `$PATH` (used by the GoTrue user-seed step). `brew install jq`
  on macOS, `apt-get install jq` on Debian/Ubuntu.
- **Ports free:**
  - `54321` (Supabase API / GoTrue / PostgREST)
  - `54322` (Supabase Postgres)
  - `54323` (Supabase Studio — still reserved even though `-x studio` excludes it)
  - `3003` (Vite dev server — the script kills anything holding this port
    automatically, so a stray `npm run dev` is fine)

## Usage

Run all commands from the `design-matrix-app/` directory.

```bash
# Plumbing smoke / phase acceptance bar — T-055-100 (known-passing)
npm run e2e:local -- -g "T-055-100"

# Single target file
npm run e2e:local -- tests/e2e/invite-flow.spec.ts

# Full CI target file set (matches the workflow's Playwright step)
npm run e2e:local -- tests/e2e/invite-flow.spec.ts tests/e2e/project-realtime-matrix.spec.ts

# Debugger mode (Playwright Inspector — step through the test)
npm run e2e:local -- --debug -g "T-054B-300"
```

The `--` between `npm run e2e:local` and the Playwright arguments is
required — npm uses it to forward everything after to the underlying script.
Without `--`, npm swallows the flags.

## What the script does

`scripts/e2e-local.sh` executes ten steps in order. Total cold-start time on a
warm Docker host is ~30-45 seconds; subsequent runs against an already-running
Supabase stack are ~10-15 seconds (the `supabase db reset` cost dominates).

1. **Resolve repo root** — derives `SCRIPT_DIR` from `${BASH_SOURCE[0]}` and
   `cd`s into the design-matrix-app directory so all paths are stable.
2. **Check Docker is running** — `docker info`. Exits 1 with the message
   "Docker Desktop is not running. Start Docker Desktop and retry." if
   Docker Desktop is not up. Surfaces instantly, before any `supabase start`
   attempt that would otherwise hang for a minute.
3. **Free port 3003** — `lsof -ti:3003 | xargs kill -9 2>/dev/null || true`
   kills any process holding the Vite dev-server port. Safe to no-op if
   nothing is bound.
4. **Check supabase status; recover from orphan state** — if `supabase status`
   reports stale state, runs `supabase stop` then
   `supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime`
   (the same exclusion list the CI workflow uses to skip services unnecessary
   for these tests).
5. **Reset database to pristine state** — `supabase db reset`. Replays
   migrations and `supabase/seed.sql` from scratch. Costs ~5-10s on a warm
   Docker host but guarantees deterministic state for mutation tests.
6. **Source static env block** — loads `scripts/e2e-local.env.sh`, which
   mirrors `.github/workflows/integration-tests.yml` environment verbatim
   (top-level workflow env, Playwright step env, Vitest step env).
7. **Seed GoTrue users via Admin API** — POSTs owner / collaborator / stranger
   users to `http://localhost:54321/auth/v1/admin/users` using the same
   `create_user` bash function the CI workflow uses. Idempotent against
   `db reset` because reset wipes `auth.users`.
8. **Seed application data** — `psql` heredoc inserts `public.users` and
   `public.user_profiles` rows, the test project, the collaborator
   relationship, and two test invitations. Refreshes the
   `admin_user_stats` materialized view if present.
9. **Generate JWT access tokens inline** — `node -e` heredoc creates
   `E2E_COLLAB_OWNER_TOKEN`, `E2E_COLLAB_USER_TOKEN`, and `E2E_STRANGER_TOKEN`
   with 1-hour expiry, signed with the Supabase CLI default JWT secret.
   Tokens are exported into the current shell so they reach the Playwright
   `webServer` subprocess via `process.env` inheritance.
10. **Exec Playwright with CI config** — `exec npx playwright test --config
    playwright.ci.config.ts "$@"`. `exec` replaces the shell process so
    Playwright's exit code becomes the script's exit code and Ctrl+C
    propagates cleanly. The quoted `"$@"` forwards all script arguments
    (`-g`, `--debug`, file paths) to Playwright unchanged.

Step order is load-bearing. See ADR-0010 "Notes for Colby" for the rationale
on each ordering constraint.

## Troubleshooting

**"Docker Desktop is not running"** — Start Docker Desktop from the menu
bar and wait for the whale icon to stop pulsing. Re-run the command. The
script checks `docker info` before anything else so this error surfaces
instantly, not after a minute of `supabase start` hanging.

**"Port 54321 is already in use" (or 54322, 54323)** — Another Supabase
project on this machine has `supabase start`-ed and never stopped. Find
it (`supabase projects list` or check sibling repos) and run
`cd <other-project> && supabase stop`, then re-run `npm run e2e:local`.
The script does not auto-detect this case because port collision produces
a loud Supabase CLI error, not silent corruption.

**"Tests skip with no output"** — This is the `CI_SUPABASE=true`
load-bearing footgun. Every target test file gates on `CI_SUPABASE=true`
and silently skips if it is unset. Symptoms: Playwright reports 0 passed
+ 0 failed for a test name that should exist. Fix: verify
`scripts/e2e-local.env.sh` still contains `export CI_SUPABASE='true'`
with the `# LOAD-BEARING` comment immediately above it. If you copied
the env file into another script, re-check that copy too — the comment
exists exactly to prevent this footgun from spreading.

## Known divergence risks

These are divergence points between local and CI. They are flagged, not
mitigated — if local repro diverges from CI in Phase 12/13 debugging,
check this list first.

1. **Supabase CLI version drift between local and CI.** CI uses
   `supabase/setup-cli@v1` with `version: latest`. Local developers run
   whatever `brew install supabase` (or equivalent) gave them. Both track
   "current" but can diverge at a CI run boundary. Surfaces as
   migration/seed behavior differences, not as an obvious error message.
   No version pinning in Phase 11; v1.4+ may revisit with `.tool-versions`
   or `mise.toml` if drift becomes a measurable signal.

2. **Supabase default port collision (54321/54322/54323).** A second
   Supabase project running locally will cause `supabase start` to fail
   with a port-already-in-use error. The script does not auto-detect this;
   rely on the loud CLI error message and the troubleshooting section above.

3. **`supabase db reset` produces more pristine state than CI.** CI runs
   `supabase start` once, then seeds on top. Local runs `supabase db reset`
   before every invocation. A migration-order bug that surfaces in CI's
   "started once, seeded once" path may not surface in local's "reset
   fresh every time" path. If a test passes locally but fails in CI on a
   migration-specific error, this risk is the most likely cause.

4. **Dev server env leakage from ambient shell.** Environment variables set
   in the developer's shell (personal `.env`, prior `export VITE_*` commands,
   editor terminals with auto-loaded profiles) can leak into the Playwright
   `webServer` subprocess because Playwright merges parent environment with
   the config's `env:` block rather than replacing it. Mitigation:
   **run `npm run e2e:local` from a clean terminal tab** — the script does
   not scrub ambient state.

5. **No Windows support.** The script is bash-only. `lsof`, `kill -9`,
   here-doc redirection, `PGPASSWORD=postgres psql`, `${BASH_SOURCE[0]}`,
   and the sourcing semantics all assume a Unix shell. macOS and Linux
   only. Windows + WSL is a v1.4+ concern.

---

**Out of scope (per ADR-0010):** bug-hunting the eight failing tests.
Phase 11 ships the plumbing. Phase 12 debugs realtime (T-054B-300..305)
and Phase 13 debugs invite flow + RPC (T-055-101, `accept_invitation`).
