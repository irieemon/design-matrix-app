# Roadmap: Prioritas

## Shipped Milestones

- **v1.0** — Launch Readiness (2026-04-06 → 2026-04-09) — 36/43 requirements complete, 2 partial, 5 deferred to v1.1. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

## Current Milestone: v1.1 — Advanced Collaboration & Quality

**Goal:** Finish the real-time collaboration experience deferred from v1.0 and close the quality-debt backlog before any further production push. No brand-new features.

**Scope principle:** Stabilization only. Brand-new features go to v1.2.

### Phases

- [x] **Phase 05.4a: Session-Scope Voting** ✅ (2026-04-09) — Dot-voting UI + realtime tallies + session presence. See `.planning/phases/05.4a-session-scope-voting/05.4a-VERIFICATION.md`. Satisfied COLLAB-01-session, COLLAB-05-UI, COLLAB-06. 10 tech debt items routed to Phase 05.5 QA-04.
- [x] **Phase 05.4b: Project-Scope Realtime Matrix** ✅ (2026-04-10) — ProjectPresenceStack, LiveCursorsLayer, LockedCardOverlay, ReconnectingBadge, useDragLock, useLiveCursors, useProjectRealtime. Satisfied COLLAB-01-matrix, COLLAB-02, COLLAB-07. 151 tests + 5 todo + 6 E2E skip. ~1.249M tokens. See `.planning/phases/05.4b-project-realtime-matrix/05.4b-VERIFICATION.md`.
- [x] **Phase 05.5: Quality Debt Closure** ✅ (2026-04-10) — MOB-02 verified on real iOS device, BRM 22 test failures fixed (43/43), invite E2E + SQL migration tests written (test.skip), Playwright mobile specs confirmed passing, iOS video input bug fixed + mobile video gate added. See `.planning/phases/05.5-quality-debt-closure/05.5-VERIFICATION.md`.

### Phase Details

#### Phase 05.4a: Session-Scope Voting
**Goal:** Users in a brainstorm session can cast dot votes on ideas and see tallies update in real-time; session participants are shown via presence indicators.
**Depends on:** v1.0 Phase 5 (voteRepository, idea_votes schema)
**Requirements:** COLLAB-01 (session scope), COLLAB-05-UI, COLLAB-06
**Success Criteria:**
  1. User can cast up to 5 dot votes on ideas in a brainstorm session via `DotVoteControls` UI
  2. Attempting a 6th vote is blocked by optimistic UI + server RLS (budget enforcement)
  3. Vote tallies update for all session participants within 2 seconds of a vote being cast (postgres_changes)
  4. Session participants see each other via presence avatars in the session view (Supabase Presence API)
  5. Vote operations (cast/remove) roll back optimistic state on RLS rejection
**Plans:** TBD (run /gsd-plan-phase 05.4a)
**UI hint:** yes

#### Phase 05.4b: Project-Scope Realtime Matrix
**Goal:** Multiple users viewing the same project matrix see each other's presence, cursors, drag operations, and idea position updates in real-time.
**Depends on:** Phase 05.4a (shared `ScopedRealtimeManager` refactor)
**Requirements:** COLLAB-01 (matrix scope), COLLAB-02, COLLAB-07
**Success Criteria:**
  1. Two browser sessions on the same project matrix see each other via avatar stack
  2. Live cursors (Figma-style, throttled) show other users' mouse positions on the matrix
  3. When user A drags a card, user B sees it visually locked until drop
  4. When user A drops a card in a new position, user B sees the card move within 2 seconds
  5. Ideas created on the matrix view (not in a session) sync across clients in real-time
  6. Reconnecting badge appears after 1.5s of disconnect; "Back online. Synced." toast on recovery
**Plans:** TBD (run /gsd-plan-phase 05.4b)
**UI hint:** yes

#### Phase 05.5: Quality Debt Closure
**Goal:** Close the quality debt carried forward from v1.0 so v1.1 ships with a clean regression baseline.
**Depends on:** Phase 05.4a, Phase 05.4b (so E2E specs cover the new flows)
**Requirements:** MOB-02-verify, QA-01, QA-02, QA-03
**Success Criteria:**
  1. `tests/e2e/mobile-critical-paths.spec.ts` passes all 6 tests on iPhone 14 Pro + Galaxy S21 projects
  2. Automated Playwright E2E test covers owner → invite → accept → collaborator-sees-project flow end-to-end
  3. pgTAP (or equivalent) tests cover the 4 Phase 05.3 SQL migrations (RLS recursion, digest qualification, accept_invitation ambiguity, projects SELECT widening)
  4. MOB-02 iOS Safari voice-to-idea flow verified on a real iOS device; verification captured in phase VERIFICATION.md
**Plans:** TBD (run /gsd-plan-phase 05.5)
**UI hint:** no (test/verification work only)

### Deferred to v1.2

- **OPS-01**: Resend domain verification for production external email delivery
- **OPS-02**: analyze-file 403 CSRF race (`src/hooks/useCsrfToken.ts`)
- **OPS-03**: AI Gateway project-wide migration
- **Advanced features** from v2 backlog (COLLAB-V2-*, AI-V2-*, PLAT-V2-*)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 05.4a. Session-Scope Voting | 0/? | Not started | - |
| 05.4b. Project-Scope Realtime Matrix | 0/? | Not started | - |
| 05.5. Quality Debt Closure | 0/? | Not started | - |

---
*Last updated: 2026-04-09 — v1.1 milestone opened via /gsd-new-milestone*
