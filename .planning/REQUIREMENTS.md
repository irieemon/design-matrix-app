# Requirements: Prioritas v1.3

**Defined:** 2026-04-11
**Milestone:** v1.3 — E2E Realtime Hardening
**Status:** Filed, not started
**Archive:** `.planning/milestones/v1.3-REQUIREMENTS.md` (filing document with full rationale)

## Scope Principle

**No new features.** v1.3 is strictly E2E and integration test stabilization. Fix CI Integration Tests from 3/10 green → 10/10 green. No refactors beyond what a failing test forces. Any new feature goes to v1.4+.

## Context

v1.2 shipped the ephemeral Supabase CI workflow and fixed four layers of access-control bugs via a 6-pipeline E2E triage arc. The arc closed at CI 3/10 because the remaining failures are a different error class (React render lifecycle, invite-flow navigation, pre-existing `accept_invitation` RPC bug) mismatched with per-test orchestration against a 5-minute CI loop. v1.3 re-scopes that work with local CI reproduction as prerequisite.

## v1.3 Requirements

### Prerequisite — Debug environment

- [ ] **E2E-00**: Local CI-equivalent reproduction environment — developer can run `supabase start`, seed GoTrue users via Admin API, run failing Playwright specs against `localhost:3003`, iterate in seconds. Documented runbook. No more CI-log-based debugging of realtime React code.

### Realtime rendering (React/UI layer) — 6 tests

- [ ] **E2E-01**: T-054B-300 (presence stack — `toHaveCount(2)`) passes in CI
- [ ] **E2E-02**: T-054B-301 (cursor broadcast — `getAttribute` timeout) passes in CI
- [ ] **E2E-03**: T-054B-302 (drag starts lock overlay in browser B) passes in CI
- [ ] **E2E-04**: T-054B-303 (drop propagates position within 2s) passes in CI
- [ ] **E2E-05**: T-054B-304 (reconnecting badge on disconnect) passes in CI
- [ ] **E2E-06**: T-054B-305 (recovery toast on reconnect) passes in CI
- [ ] **E2E-07**: No `strict mode violation: 2 design-matrix elements` in any Playwright log — matrix renders exactly once per route state

### Invite flow — 1 test

- [ ] **E2E-08**: T-055-101 (invitee accepts invitation — post-accept navigation to `/?project=<id>`) passes in CI. Fix scope: `src/pages/InvitationAcceptPage.tsx` redirect logic.

### Migration RPC — 1 test

- [ ] **E2E-09**: `phase05.3-migrations.integration.test.ts:233` passes. Fix scope: `accept_invitation` RPC in `supabase/migrations/20260408140000_phase5_accept_invitation_digest_fix.sql`. Currently returns `P0001 invalid_or_expired` where test expects success.

### Pattern hygiene from v1.2 arc

- [ ] **TECH-01**: `src/lib/services/CollaborationService.ts:97` — same `project_collaborators.select('id')` → `.select('project_id')` pattern as commit `568a72e`. Roz flagged during v1.2 wave QA; fix not shipped in arc.
- [ ] **TECH-02**: Follow-up ADR on silent error swallowing in `validateProjectAccess` collab/admin queries. Re-introduce `error:` destructuring and `console.error` for non-`PGRST116` codes. Poirot flagged during arc.

## Out of Scope (v1.3)

| Feature | Reason |
|---------|--------|
| Any new user-facing capability | v1.3 is stabilization only |
| Refactoring `ScopedRealtimeManager` or `BrainstormRealtimeManager` | Beyond minimum-fix scope |
| 5 `test.todo` DndKit sensor tests | Deferred since v1.1; separate concern |
| OAuth login | v1.4+ scope |
| Mobile video re-enablement | WebCodecs-dependent, out of scope |
| v2 backlog items | v2.0+ scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| E2E-00 | Phase 11 | Pending |
| E2E-01 | Phase 12 | Pending |
| E2E-02 | Phase 12 | Pending |
| E2E-03 | Phase 12 | Pending |
| E2E-04 | Phase 12 | Pending |
| E2E-05 | Phase 12 | Pending |
| E2E-06 | Phase 12 | Pending |
| E2E-07 | Phase 12 | Pending |
| E2E-08 | Phase 13 | Pending |
| E2E-09 | Phase 13 | Pending |
| TECH-01 | Phase 13 | Pending |
| TECH-02 | Phase 13 | Pending |

**Coverage:**
- v1.3 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

## Success Criteria (milestone-level)

1. CI Integration Tests workflow: **10/10 green** on a commit tagged `v1.3`
2. Vitest migration tests: **7/7 green** on the same commit
3. Local repro runbook documented and validated (second developer can set up without questions)
4. TECH-01 + TECH-02 ship in the same milestone — no slippage to v1.4

---
*Defined 2026-04-11 by Eva after `/gsd-complete-milestone 1.2`. Replaces the v1.2 requirements content.*
