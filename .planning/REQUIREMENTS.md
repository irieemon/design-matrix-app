# Requirements: Prioritas v1.2

**Defined:** 2026-04-10
**Milestone:** v1.2 — Production Hardening
**Core Value:** Make Prioritas production-ready — fix known bugs, close operational gaps, get the test suite running against live infrastructure in CI. No new user-facing features.

## Scope Principle

**No new features.** v1.2 is strictly ops, infra, and bug fixes. Any new feature goes to v1.3+.

## v1.2 Requirements

### Operations (carried from v1.0/v1.1)

- [ ] **OPS-01**: Resend domain verification — production email delivery from a verified sender domain (not `onboarding@resend.dev`)
- [ ] **OPS-02**: Fix analyze-file 403 CSRF race — `src/hooks/useCsrfToken.ts` timing issue causes intermittent 403 on file analysis requests
- [ ] **OPS-03**: AI Gateway project-wide migration — migrate all AI handlers to Vercel AI Gateway (user-confirmed direction 2026-04-07)

### Bug Fixes

- [ ] **BUG-01**: Fix RealtimeSubscriptionManager.subscribeToIdeas clearing bug — `callback([])` clears local ideas on every realtime event. Remove the D-34 workaround in `useProjectRealtime` after fixing the root cause. Requires careful regression testing since D-34 is load-bearing.

### CI / Test Infrastructure

- [ ] **CI-01**: Enable test.skip E2E tests in CI — configure GitHub Actions workflow with live Supabase test project for invite-flow.spec.ts and project-realtime-matrix.spec.ts
- [ ] **CI-02**: Enable test.skip integration tests in CI — phase05.3-migrations.integration.test.ts against live Supabase
- [ ] **CI-03**: Seed data strategy — create reproducible test fixtures for CI (test users, test projects, test invitations)

## Out of Scope (v1.2)

| Feature | Reason |
|---------|--------|
| Any new user-facing capability | v1.2 is stabilization only |
| Mobile video re-enablement | Deferred until WebCodecs API matures |
| Advanced collaboration (v2 backlog) | v1.3+ scope |
| OAuth login | v1.3+ scope |
| 5 test.todo DndKit sensor tests | Blocked on DndKit test utilities; defer |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPS-01 | Phase 08 | Pending |
| OPS-02 | Phase 08 | Pending |
| OPS-03 | Phase 08 | Pending |
| BUG-01 | Phase 09 | Pending |
| CI-01 | Phase 10 | Pending |
| CI-02 | Phase 10 | Pending |
| CI-03 | Phase 10 | Pending |

**Coverage:**
- v1.2 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Defined: 2026-04-10 during /gsd-new-milestone 1.2*
