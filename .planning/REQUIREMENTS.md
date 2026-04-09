# Requirements: Prioritas v1.1

**Defined:** 2026-04-09
**Milestone:** v1.1 — Advanced Collaboration & Quality
**Core Value:** Finish the real-time collaboration experience deferred from v1.0 and close the quality-debt backlog before any further production push.

## Scope Principle

**No brand-new features.** v1.1 is strictly "finish what v1.0 deferred and stabilize." Any brand-new feature request goes to v1.2.

## v1.1 Requirements

Requirements for v1.1. Each maps to a roadmap phase.

### Real-Time Collaboration (carried from v1.0)

- [ ] **COLLAB-01**: User sees real-time presence indicators (who's online) in brainstorm sessions AND on project matrix views
- [ ] **COLLAB-02**: Ideas created by any participant appear for all users in real-time without refresh (project matrix scope — session scope already shipped in v1.0)
- [ ] **COLLAB-05-UI**: User can cast dot votes on ideas during brainstorm via UI controls (data layer shipped in v1.0; this is the hook + components)
- [ ] **COLLAB-06**: Vote tallies update in real-time for all session participants
- [ ] **COLLAB-07**: Idea position changes on project matrix broadcast to all connected users with soft drag lock

### Mobile (carried from v1.0)

- [ ] **MOB-02-verify**: Voice-to-idea flow verified on real iOS Safari device (Phase 04-02 Task 3 human checkpoint)

### Quality (new for v1.1)

- [ ] **QA-01**: Playwright mobile critical-paths spec parity — `tests/e2e/mobile-critical-paths.spec.ts` passes on iPhone 14 Pro + Galaxy S21 projects (3 currently failing: DesktopOnlyHint role, projects submit button 44px target, MobileJoinPage 16px font)
- [ ] **QA-02**: Automated Playwright E2E regression for owner → invite → accept → collaborator-sees-project flow (currently manual only, verified in Phase 05.3)
- [ ] **QA-03**: pgTAP (or equivalent) coverage for Phase 05.3 SQL migrations — RLS recursion fix, digest() schema qualification, accept_invitation() OUT-param ambiguity, projects SELECT RLS widening

## Deferred to v1.2

Production hardening items intentionally deferred — not scope creep.

- **OPS-01**: Resend domain verification for production external email delivery
- **OPS-02**: analyze-file 403 CSRF race (separate `/gsd-debug` session; fix likely in `src/hooks/useCsrfToken.ts`)
- **OPS-03**: AI Gateway project-wide migration (user-confirmed direction 2026-04-07)

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| Any brand-new capability | v1.1 is stabilization only |
| CRDT-based conflict resolution | Soft drag-lock is sufficient for v1.1; CRDT is v2 scope |
| Cursor tracking beyond matrix (brainstorm, sidebar, etc.) | Matrix-only for v1.1; full-app cursor tracking is v2 |
| Activity feed | v2 scope (COLLAB-V2-03) |
| Commenting on ideas | v2 scope (COLLAB-V2-04) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COLLAB-01 (session scope) | 05.4a | Pending |
| COLLAB-01 (matrix scope) | 05.4b | Pending |
| COLLAB-02 | 05.4b | Pending |
| COLLAB-05-UI | 05.4a | Pending |
| COLLAB-06 | 05.4a | Pending |
| COLLAB-07 | 05.4b | Pending |
| MOB-02-verify | 05.5 | Pending |
| QA-01 | 05.5 | Pending |
| QA-02 | 05.5 | Pending |
| QA-03 | 05.5 | Pending |

**Coverage:**
- v1.1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Defined: 2026-04-09 during /gsd-new-milestone 1.1*
