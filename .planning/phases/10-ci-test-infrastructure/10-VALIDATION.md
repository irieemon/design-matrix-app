---
phase: 10
slug: ci-test-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 + Playwright 1.55.0 |
| **Config file** | `vitest.config.ts`, `playwright.ci.config.ts` |
| **Quick run command** | `npx vitest run src/lib/__tests__/phase05.3-migrations.integration.test.ts` |
| **Full suite command** | `npx vitest run && npx playwright test --config=playwright.ci.config.ts` |
| **Estimated runtime** | ~120 seconds (local), ~300 seconds (CI with supabase start) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (integration test file)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | CI-01 | — | N/A | config | `test -f supabase/config.toml` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | CI-03 | — | N/A | config | `test -f supabase/seed.sql` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 2 | CI-01 | — | N/A | e2e | `npx playwright test tests/e2e/invite-flow.spec.ts` | ✅ | ⬜ pending |
| 10-01-04 | 01 | 2 | CI-01 | — | N/A | e2e | `npx playwright test tests/e2e/project-realtime-matrix.spec.ts` | ✅ | ⬜ pending |
| 10-01-05 | 01 | 2 | CI-02 | — | N/A | integration | `npx vitest run src/lib/__tests__/phase05.3-migrations.integration.test.ts` | ✅ | ⬜ pending |
| 10-01-06 | 01 | 3 | CI-01 | — | N/A | ci | `gh workflow run integration-tests.yml` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/config.toml` — Supabase CLI project config (created via `supabase init` or manually)
- [ ] `supabase/seed.sql` — Deterministic test data (auth.users, projects, invitations)
- [ ] `.github/workflows/integration-tests.yml` — New CI workflow file

*Existing infrastructure covers test frameworks (Vitest, Playwright already installed).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI workflow passes on GitHub | CI-01, CI-02 | Requires GitHub Actions runner | Push branch, verify green check on Actions tab |
| Seed data resets between runs | CI-03 | Requires CI environment | Run workflow twice, verify no state leakage |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
