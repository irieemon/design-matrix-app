# Roadmap: Prioritas

## Shipped Milestones

- **v1.0** — Launch Readiness (2026-04-06 → 2026-04-09) — 36/43 requirements, 5 deferred to v1.1. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).
- **v1.1** — Advanced Collaboration & Quality (2026-04-09 → 2026-04-10) — 10/10 requirements. Realtime voting, live cursors, drag lock, presence, quality debt closed. See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

## Current Milestone: v1.2 — Production Hardening

**Goal:** Make Prioritas production-ready — fix known bugs, close operational gaps, get the test suite running against live infrastructure in CI. No new user-facing features.

**Scope principle:** Ops, infra, and bug fixes only. New features go to v1.3+.

### Phases

- [x] **Phase 08: Operational Fixes** ✅ (2026-04-10) — CSRF race fixed (waitForCsrfToken), AI Gateway last gap closed (transcribeAudio summary), Resend domain config runbook ready. See `.planning/phases/08-operational-fixes/08-VERIFICATION.md`.
- [ ] **Phase 09: RealtimeSubscriptionManager Bug Fix** — Fix the root-cause ideas-clearing bug (BUG-01), remove D-34 workaround from useProjectRealtime
- [ ] **Phase 10: CI Test Infrastructure** — Enable test.skip E2E + integration tests in GitHub Actions with live Supabase, seed data strategy

### Phase Details

#### Phase 08: Operational Fixes
**Goal:** Close the three operational gaps carried from v1.0/v1.1 so all API endpoints are production-safe
**Depends on:** Nothing (independent fixes)
**Requirements:** OPS-01, OPS-02, OPS-03
**Success Criteria:**
  1. Invitation emails send from a verified domain (not `onboarding@resend.dev`) and deliver to external recipients
  2. File analysis requests do not intermittently 403 due to CSRF token timing
  3. All AI handlers route through Vercel AI Gateway with no regression in existing AI features
**Plans:** TBD (run /gsd-plan-phase 08)

#### Phase 09: RealtimeSubscriptionManager Bug Fix
**Goal:** Fix the root-cause `subscribeToIdeas` clearing bug so remote realtime events properly merge instead of clearing local state
**Depends on:** Phase 08 (AI Gateway may touch related API handlers)
**Requirements:** BUG-01
**Success Criteria:**
  1. `RealtimeSubscriptionManager.subscribeToIdeas` callback receives properly merged idea arrays (INSERT appends, UPDATE replaces, DELETE removes) — NOT `callback([])`
  2. `useProjectRealtime`'s D-34 workaround (own postgres_changes listener) is removed — the manager handles it correctly
  3. Existing brainstorm realtime sync (BrainstormRealtimeManager) is unaffected — 43/43 tests still green
  4. Phase 05.4b success criteria (position updates within 2s, idea sync across clients) still hold after removing the workaround
**Plans:** TBD (run /gsd-plan-phase 09)

#### Phase 10: CI Test Infrastructure
**Goal:** The full test suite (unit + integration + E2E) runs in GitHub Actions against a live Supabase test project with reproducible seed data
**Depends on:** Phase 09 (BUG-01 fix may affect integration test behavior)
**Requirements:** CI-01, CI-02, CI-03
**Success Criteria:**
  1. `tests/e2e/invite-flow.spec.ts` runs (not skipped) in CI and passes
  2. `tests/e2e/project-realtime-matrix.spec.ts` runs in CI and passes (or has documented skip conditions for realtime-dependent tests)
  3. `src/lib/__tests__/phase05.3-migrations.integration.test.ts` runs in CI and passes
  4. CI workflow uses a dedicated Supabase test project with seed data that is reset between runs
  5. GitHub Actions workflow file committed and documented
**Plans:** TBD (run /gsd-plan-phase 10)

### Deferred to v1.3+

- Advanced features from v2 backlog (COLLAB-V2-*, AI-V2-*, PLAT-V2-*)
- Mobile video re-enablement (WebCodecs API)
- 5 test.todo DndKit sensor integration tests
- OAuth login

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 08. Operational Fixes | 0/? | Not started | - |
| 09. RealtimeSubscriptionManager Bug Fix | 0/? | Not started | - |
| 10. CI Test Infrastructure | 0/? | Not started | - |

---
*Last updated: 2026-04-10 — v1.2 milestone opened via /gsd-new-milestone*
