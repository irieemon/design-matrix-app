# Pipeline State

## Active Pipeline
**Feature:** Phase 05.4a — Session-Scope Voting
**Phase:** build
**Sizing:** Large (downsized from full 05.4)
**Stop Reason:** (none -- pipeline active)
**Started:** 2026-04-09

<!-- PIPELINE_STATUS: {"phase": "build", "sizing": "large", "roz_qa": "approved_test_spec", "telemetry_captured": false, "stop_reason": null} -->

## Current Unit
**Unit 1 of 5:** voteRepository.removeVote D-07 fix (~60 LOC, low risk)
**Depends on:** Sable UX (done), Cal ADR (done), Roz test spec review (approved)
**GSD mirror:** .planning/phases/05.4a-session-scope-voting/
**ADR:** .planning/phases/05.4a-session-scope-voting/05.4a-PLAN.md

## Configuration
**Branching Strategy:** trunk-based
**Platform:** GitHub
**Integration Branch:** main
**Feature Branch:** main

## Progress

| # | Unit | Agent | Status | Notes |
|---|------|-------|--------|-------|
| — | Sable UX | sable-ux | DONE | docs/ux/phase-05.4a-session-scope-voting.md |
| — | Cal ADR | cal | DONE | 05.4a-PLAN.md, 13 decisions, 5 units, 81 tests |
| — | Roz test spec review | roz | APPROVED | Scoped re-review 2026-04-09 |
| 1 | voteRepository D-07 fix | colby | PENDING | ~60 LOC, TDD |
| 2 | ScopedRealtimeManager + tests | colby | QUEUED | ~450 LOC |
| 3 | useDotVoting + DotVotingContext | colby | QUEUED | ~500 LOC |
| 4 | DotVoteControls + DotBudgetIndicator + SessionPresenceStack | colby | QUEUED | ~900 LOC |
| 5 | Wire-up in MatrixFullScreenView | colby | QUEUED | ~50 LOC |

## Queue
(unit 1 next)
