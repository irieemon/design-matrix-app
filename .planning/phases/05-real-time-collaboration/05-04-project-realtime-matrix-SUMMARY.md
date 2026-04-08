# Phase 05 Plan 04 — Project Realtime Matrix (retroactive summary)

**Status:** ❌ Not started — rolled forward to Phase 05.4
**Summary written:** 2026-04-08 retroactively

## What was delivered

Nothing from this plan shipped. `BrainstormRealtimeManager` (the existing brainstorm-scoped manager) was not extended or paralleled for the project matrix view.

## What was in scope (not delivered)

1. `src/lib/realtime/ProjectRealtimeManager.ts` — project-scoped realtime manager (mirrors BrainstormRealtimeManager pattern)
2. Live cursors on matrix — Figma-style cursor broadcast throttled ~20Hz (Phase 5 CONTEXT D-13/D-14)
3. Soft drag lock — when one user grabs an idea card, others see it visually locked until drop/release/timeout (D-11/D-12, reuses existing `ideaLockingService` pattern)
4. Matrix idea position realtime sync — COLLAB-07 requirement, drag/drop position changes broadcast to all connected users
5. Presence avatars on project matrix view — new avatar stack showing users currently viewing
6. End-to-end multi-user Playwright test

## Why it's unshipped

Same reason as Plan 03: Phase 5 work was interrupted by the E2E invitation flow bug chain (Phase 05.3), then the team shipped Phase 05.2 (email) and Phase 06 (billing) before returning to realtime. The matrix multi-user experience is not user-visible yet.

## Deferred scope → Phase 05.4

Combined with Plan 03's deferred work into a single follow-on phase **05.4 — Finish dot voting, scoped realtime, and project matrix sync**. Plan 03's ScopedRealtimeManager refactor and Plan 04's ProjectRealtimeManager should be addressed together so the realtime architecture is consistent.

## Canonical refs

- Phase 5 CONTEXT.md D-09 through D-14 (realtime scope, drag lock, presence, cursors)
- `src/lib/realtime/BrainstormRealtimeManager.ts` (existing pattern to follow)
- `src/components/brainstorm/PresenceIndicators.tsx` (existing avatar component to reuse)
- REQUIREMENTS.md COLLAB-07 (matrix position sync — still pending)
