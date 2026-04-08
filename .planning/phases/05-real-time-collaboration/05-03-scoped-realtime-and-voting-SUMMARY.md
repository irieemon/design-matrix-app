# Phase 05 Plan 03 — Scoped Realtime and Voting (retroactive summary)

**Status:** ⚠️ Partially shipped — remaining work rolled forward to Phase 05.4
**Summary written:** 2026-04-08 retroactively

## What was actually delivered

- `src/lib/repositories/voteRepository.ts` — repository for `idea_votes` table (CRUD)
- `src/hooks/__tests__/useDotVoting.test.ts` — test file for the hook (but the hook itself was never implemented)
- `supabase/migrations/20260408000000_phase5_collab_schema.sql` — `idea_votes` table with RLS, 5-dot budget enforced by the SELECT-for-count-then-insert pattern in the policy

## What was NOT delivered

- `src/hooks/useDotVoting.ts` — the dot voting hook (test exists, implementation missing)
- `src/components/brainstorm/DotVoteControls.tsx` — UI controls for casting votes
- `ScopedRealtimeManager` refactor — the plan called for generalizing `BrainstormRealtimeManager` to accept a scope parameter (brainstorm vs project matrix); `BrainstormRealtimeManager.ts` exists but was not refactored
- Realtime vote tally broadcast UI — votes persist to the DB but no UI surface consumes the realtime channel for live tally updates

## Why it's partial

Phase 5 work was interrupted when the E2E invitation flow broke and surfaced 12 hidden bugs (Phase 05.3). The team prioritized fixing those + shipping Phase 05.2 (email) and Phase 06 (billing) before returning to voting. The voting feature is not user-visible yet.

## Deferred scope → Phase 05.4 (to be created)

The following work rolls forward to a new phase **05.4 — Finish dot voting and scoped realtime**:

1. Implement `useDotVoting` hook against the existing test file and `voteRepository`
2. Build `DotVoteControls` component and wire into brainstorm session view
3. Refactor `BrainstormRealtimeManager` into `ScopedRealtimeManager` with a scope parameter, or build a parallel `ProjectRealtimeManager` (see Plan 04 for the project-scoped half)
4. Wire realtime vote broadcast so tallies update live for all participants
5. End-to-end manual test: 2 browser sessions, both see live vote counts update

## Canonical refs

- Phase 5 CONTEXT.md D-01 through D-04 (dot voting spec)
- `src/lib/repositories/voteRepository.ts` (existing scaffolding)
- `src/hooks/__tests__/useDotVoting.test.ts` (red test file waiting for implementation)
