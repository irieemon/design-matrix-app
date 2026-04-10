# Phase 10: CI Test Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 10-ci-test-infrastructure
**Areas discussed:** Supabase test project strategy, Seed data & reset strategy, Workflow architecture, Secret management

---

## Supabase Test Project Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated test project | Separate Supabase project just for CI. Isolated from dev data, safe to reset between runs. | |
| Share dev project | Reuse existing dev Supabase project. Less setup, but CI runs could corrupt dev data. | |
| Use Supabase CLI local | Run Supabase locally in CI via `supabase start` (Docker-based). No cloud project needed. | |

**User's choice:** Use Supabase CLI local
**Notes:** Fully self-contained, no cloud project costs, ephemeral per-run.

---

| Option | Description | Selected |
|--------|-------------|----------|
| SQL seed script | Insert test users directly into auth.users + create test projects/invitations. Deterministic UUIDs. | |
| Supabase Auth API calls | Use supabase.auth.admin.createUser() in a setup script. More realistic but slower. | |

**User's choice:** SQL seed script
**Notes:** Standard approach with `supabase start` auto-applying seed.sql.

---

## Seed Data & Reset Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-run | Fresh `supabase start` + seed once at workflow start. All tests share same seeded state. | |
| Per-test file | Reset and re-seed between each test file. More isolation but significantly slower. | |

**User's choice:** Per-run
**Notes:** Tests must be written to not depend on mutation order.

---

| Option | Description | Selected |
|--------|-------------|----------|
| supabase/seed.sql | Standard Supabase convention — auto-applied after migrations. Zero extra scripting. | |
| tests/fixtures/seed.sql | Separate from Supabase config, closer to test files. Requires explicit psql call. | |

**User's choice:** supabase/seed.sql
**Notes:** None.

---

## Workflow Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| New integration workflow | Add a third workflow (integration-tests.yml). Keeps existing workflows untouched. | |
| Extend existing workflows | Add Supabase setup steps to playwright.yml and test.yml. Fewer files but more complex. | |
| Single unified workflow | Merge all test types into one workflow. Simplest long-term but biggest refactor. | |

**User's choice:** New integration workflow
**Notes:** Clean separation of concerns.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Background process in CI step | Run `npm run dev &`, wait for port 3003, then run tests. Standard Playwright CI pattern. | |
| Build + preview | Run `npm run build` then serve dist/ with `npx vite preview`. Closer to production. | |

**User's choice:** Background process in CI step
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Skipped tests only | New workflow runs only the 3 target test files. Existing workflows continue as-is. | |
| Full suite against live Supabase | Run complete test suite with Supabase available. More comprehensive but slower. | |

**User's choice:** Skipped tests only
**Notes:** None.

---

## Secret Management

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded in seed + workflow | Test credentials are deterministic. No GitHub Secrets needed — everything in repo. | |
| GitHub Secrets for credentials | Store test user credentials as GitHub Secrets even though DB is local. | |

**User's choice:** Hardcoded in seed + workflow
**Notes:** DB is ephemeral and local; deterministic passwords are safe.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Known defaults | Supabase CLI local always uses same anon key, service role key, URL. Hardcode in workflow. | |
| Parse from output | Capture `supabase status` JSON output and extract keys dynamically. | |

**User's choice:** Known defaults
**Notes:** Simpler and well-documented.

---

## Claude's Discretion

- Exact seed SQL structure
- GitHub Actions trigger conditions
- supabase db reset vs supabase start
- test.skip conversion approach
- Playwright config adjustments

## Deferred Ideas

None.
