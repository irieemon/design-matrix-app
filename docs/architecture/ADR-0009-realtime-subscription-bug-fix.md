# ADR-0009: RealtimeSubscriptionManager BUG-01 Fix + D-34 Workaround Removal

## Status

Proposed (2026-04-09)

## Context

`RealtimeSubscriptionManager.subscribeToIdeas` (line 84) contains a placeholder `callback([])` that was never implemented. Two compensation layers mask the bug: (1) `DatabaseService.subscribeToIdeas` wraps the callback with a full refetch, and (2) the D-34 workaround in `useProjectRealtime` adds a second subscription via `ScopedRealtimeManager` with proper INSERT/UPDATE/DELETE merge handlers. Both paths call the same `setIdeas`, creating race conditions and wasted DB queries.

## Decision

**Option B: Event-merge pattern.** Fix the manager to pass realtime event payloads through to the callback, update the DatabaseService facade to pass-through (drop refetch wrapper), move merge logic into useIdeas, and remove the D-34 workaround from useProjectRealtime.

## Consequences

- One subscription path instead of two (eliminates race condition)
- No full-table refetch per realtime event (O(1) merge instead of O(n) query)
- `RealtimeSubscriptionManager.subscribeToIdeas` callback signature changes to `(payload: RealtimeIdeaPayload) => void`
- D-34 polling fallback (10s reconciliation) remains as graceful degradation

Full implementation plan, test spec, and blast radius analysis: `.planning/phases/09-realtime-subscription-bug-fix/09-PLAN.md`
