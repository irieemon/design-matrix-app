# ADR-0009: RealtimeSubscriptionManager BUG-01 Fix + D-34 Workaround Removal

## Status

Proposed (2026-04-09)

## DoR -- Definition of Ready

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| R1 | `subscribeToIdeas` callback receives properly merged idea arrays (INSERT appends, UPDATE replaces, DELETE removes) -- NOT `callback([])` | ROADMAP Phase 09 SC-1 | Ready |
| R2 | `useProjectRealtime`'s D-34 workaround (own postgres_changes listener) is removed -- the manager handles it correctly | ROADMAP Phase 09 SC-2 | Ready |
| R3 | Existing brainstorm realtime sync (BrainstormRealtimeManager) is unaffected -- 43/43 tests still green | ROADMAP Phase 09 SC-3 | Ready |
| R4 | Phase 05.4b success criteria (position updates within 2s, idea sync across clients) still hold | ROADMAP Phase 09 SC-4 | Ready |

**Retro risks:** Lesson 005 (Frontend Wiring Omission) -- relevant because we're changing a callback contract between `RealtimeSubscriptionManager` and `useIdeas`. Must verify the wiring end-to-end: realtime event -> manager -> callback -> useIdeas state -> UI render.

## Context

### The Bug

`RealtimeSubscriptionManager.subscribeToIdeas` (line 84) contains a placeholder `callback([])` instead of actual realtime event handling. This was never implemented -- the comment reads "This is a placeholder - actual implementation would fetch fresh data."

### The Compensating Workaround Stack

Two layers of compensation exist:

1. **DatabaseService facade** (`src/lib/database.ts:164-175`): Wraps the callback so it ignores the `[]` argument and refetches the full idea list from `IdeaService.getIdeasByProject`. This masks the bug -- `useIdeas` gets real data despite the placeholder. However, every realtime event triggers a full SELECT query, which is wasteful and adds latency.

2. **D-34 workaround** (`useProjectRealtime.ts:66-107`): Phase 05.4b added a *second* subscription via `ScopedRealtimeManager.onPostgresChange` with per-event handlers (INSERT appends, UPDATE merges, DELETE removes). This bypasses `subscribeToIdeas` entirely and merges realtime payloads directly into `setIdeas`. This is the load-bearing realtime path.

### The Dual-Subscription Problem

Currently both subscriptions run simultaneously:
- **useIdeas** creates channel `project_{id}` via `RealtimeSubscriptionManager` -> on each event, full refetch via API
- **useProjectRealtime** creates channel `project:{id}` via `ScopedRealtimeManager` -> on each event, surgical merge

Both call the same `setIdeas` setter. This creates race conditions where useProjectRealtime merges correctly, but useIdeas's slower refetch overwrites the merge a moment later. It also wastes a Supabase channel and DB queries.

## Decision

**Option B (Event-merge pattern)** -- but with a critical twist: we do NOT change the callback signature.

### Rationale for rejecting the other options

**Option A (Refetch pattern) -- Rejected.** The DatabaseService facade *already* implements this. It works, but adds a full SELECT per realtime event. With the D-34 workaround removed, this would be the sole realtime path, and it would be slower than what D-34 provides. Also, the useIdeas consumer's callback still does `freshIdeas.filter(...)` on the refetched result, which is redundant work when the initial subscription already scoped to `projectId`.

**Option C (Hybrid with internal cache) -- Rejected.** Adding mutable state to a static class (`RealtimeSubscriptionManager`) is architecturally wrong. The class has no lifecycle, no constructor, no cleanup. A cache would leak across projects and require invalidation logic that duplicates what React state already does.

### The actual fix: two-layer change

**Layer 1: Fix `RealtimeSubscriptionManager.subscribeToIdeas`** to pass the realtime payload through to the callback instead of `callback([])`. Change the callback signature from `(ideas: IdeaCard[]) => void` to `(payload: RealtimeIdeaPayload) => void` where:

```typescript
type RealtimeIdeaPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Partial<IdeaCard>
  old: Partial<IdeaCard> | null
}
```

This is Option B's core idea. But we do NOT change the callback signature directly -- we change the `DatabaseService.subscribeToIdeas` facade to perform the merge, keeping `useIdeas`'s callback unchanged.

**Wait -- better approach.** On deeper analysis, the cleanest path is:

**Remove `useIdeas`'s subscription entirely.** The `useProjectRealtime` hook already handles idea syncing correctly via `ScopedRealtimeManager`. The `useIdeas` subscription via `RealtimeSubscriptionManager` is redundant and actively harmful (race conditions). Instead of fixing a broken manager that nobody should be calling:

1. Fix `RealtimeSubscriptionManager.subscribeToIdeas` to pass event payloads (not `[]`) so it's no longer broken for any other consumers.
2. Remove the `useIdeas` subscription effect (lines 427-472) -- it's the duplicate.
3. Keep `useProjectRealtime`'s D-34 merge logic as the CANONICAL path.
4. Rename the D-34 comment markers to reflect it's now the primary implementation.

**BUT** -- the task explicitly says "remove the D-34 workaround from useProjectRealtime" and "useIdeas (the original consumer) should work correctly again." This means the intended direction is to fix the manager and have `useIdeas` work correctly through its existing subscription path.

### Final decision: Fix the manager, update the facade, remove D-34

1. **Fix `RealtimeSubscriptionManager.subscribeToIdeas`** to pass the realtime event payload (`{ eventType, new, old }`) to the callback instead of `callback([])`.

2. **Update `DatabaseService.subscribeToIdeas` facade** to perform event-merge logic (INSERT/UPDATE/DELETE) instead of full refetch. The facade KEEPS the existing `(ideas: IdeaCard[]) => void` callback signature from `useIdeas`'s perspective by using a functional state update pattern -- but internally it receives event payloads from the manager.

   Actually, this won't work either, because the facade's callback expects to call `callback(fullArray)`, but `useIdeas` calls `setIdeas(filtered)` which replaces state entirely. For merge-style updates, you need `setIdeas(prev => ...)`, not `setIdeas(newArray)`.

### FINAL decision: Move merge logic into useIdeas, remove D-34

The cleanest path that satisfies all constraints:

1. **Fix `RealtimeSubscriptionManager.subscribeToIdeas`** to pass `{ eventType, new, old }` to callback instead of `callback([])`. Change the callback type.

2. **Update `DatabaseService.subscribeToIdeas` facade** to pass through the event payload (not wrap with refetch).

3. **Update `useIdeas` subscription effect** (lines 427-472) to handle the event payload with merge logic (same INSERT/UPDATE/DELETE logic currently in `useProjectRealtime`).

4. **Remove D-34 workaround** from `useProjectRealtime` (lines 66-107). The hook keeps presence, connection state, and polling -- only the ideas merge handlers are removed.

5. **Keep `useProjectRealtime`'s polling fallback** (D-22, line 128-131) as the reconciliation safety net.

## Anti-Goals

**Anti-goal: Fixing `subscribeToProjects` or `subscribeToProjectCollaborators`.** Reason: Same `callback([])` bug exists in those methods (lines 186, 222), but they're not load-bearing for any current feature and fixing them increases scope. Revisit: When project switching or collaborator invite goes through realtime.

**Anti-goal: Replacing `RealtimeSubscriptionManager` with `ScopedRealtimeManager`.** Reason: That's a larger refactor -- `RealtimeSubscriptionManager` is consumed by `DatabaseService` which is the facade for the entire data layer. Revisit: v2.0 architecture cleanup.

**Anti-goal: Adding reconnection/backoff to `RealtimeSubscriptionManager`.** Reason: `ScopedRealtimeManager` already handles reconnection via `useProjectRealtime`. Adding it to both would create competing reconnect logic. Revisit: If `RealtimeSubscriptionManager` needs to operate without `ScopedRealtimeManager`.

## Spec Challenge

**The spec assumes** the `DatabaseService.subscribeToIdeas` facade can be updated to pass through event payloads without breaking other consumers. **If wrong, the design fails because** any code calling `DatabaseService.subscribeToIdeas` with the old `(ideas: IdeaCard[]) => void` callback signature would break. Mitigation: grep confirms the ONLY consumer is `useIdeas.ts:444`. No other call site exists in production code.

**SPOF:** `RealtimeSubscriptionManager.subscribeToIdeas` is the single point for idea realtime events after D-34 removal. **Failure mode:** If the manager fails to subscribe or the channel errors out, no realtime updates reach `useIdeas`. **Graceful degradation:** `useProjectRealtime`'s D-22 polling fallback (10s interval via `ScopedRealtimeManager.onPollingTick`) remains in place and calls `IdeaRepository.getProjectIdeas` to reconcile state. This catches any events the broken manager might miss.

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A: Refetch per event | Simple, already partially implemented in facade | Full SELECT per event, slower than merge, wasteful | Rejected |
| B: Event-merge (chosen) | Surgical updates, low latency, matches D-34 proven pattern | Changes callback signature | **Chosen** |
| C: Internal cache in manager | Keeps old callback signature | Mutable static state, no lifecycle, leak risk | Rejected |
| D: Remove useIdeas subscription, keep D-34 as canonical | Least code change | Contradicts task directive to remove D-34 | Rejected |

## Consequences

**Positive:**
- One subscription path instead of two (eliminates race condition)
- No full-table refetch per realtime event (O(1) merge instead of O(n) query)
- Cleaner separation: `useProjectRealtime` owns connection/presence/polling, `useIdeas` owns idea state
- `RealtimeSubscriptionManager.subscribeToIdeas` no longer ships with a placeholder

**Negative:**
- Callback signature change propagates through `DatabaseService` facade
- `useIdeas` gains ~25 lines of merge logic (moved from `useProjectRealtime`)
- The merge logic is now duplicated between `RealtimeSubscriptionManager` (raw pass-through) and `useIdeas` (merge into state) -- not a DRY violation since they operate at different layers

**Neutral:**
- `subscribeToProjects` and `subscribeToProjectCollaborators` still have `callback([])` -- tracked as known tech debt, not in scope

## Implementation Plan

### Step 1: Fix RealtimeSubscriptionManager + DatabaseService facade

**Files to modify (3):**
- `src/lib/database/services/RealtimeSubscriptionManager.ts` -- change `subscribeToIdeas` to pass event payload, add `RealtimeIdeaPayload` type export
- `src/lib/database.ts` -- update `DatabaseService.subscribeToIdeas` facade to pass through payload (remove refetch wrapper)
- `src/types/index.ts` -- add `RealtimeIdeaPayload` type (if not placed in manager file)

**What changes:**
- `RealtimeSubscriptionManager.subscribeToIdeas` callback signature changes from `(ideas: IdeaCard[]) => void` to `(payload: RealtimeIdeaPayload) => void`
- The postgres_changes handler (line 68-87) passes `{ eventType: payload.eventType, new: payload.new, old: payload.old }` instead of `callback([])`
- Error handler (line 89-91) logs the error but does NOT call `callback([])` -- error recovery is the consumer's job
- Initial load path (line 133-137) is removed -- initial load is handled by `useIdeas.loadIdeas` and `skipInitialLoad: true` is already the norm
- `DatabaseService.subscribeToIdeas` facade drops the refetch wrapper and passes through the payload

**Acceptance criteria:**
- `RealtimeSubscriptionManager.subscribeToIdeas` never calls `callback([])` in any code path
- The payload type includes `eventType`, `new`, and `old` fields
- `DatabaseService.subscribeToIdeas` signature matches the new callback type
- TypeScript compiles (dependent changes in Step 2 will make the full chain compile)

**Complexity:** Low (signature change + delete placeholder code)

**Sizing gate:** S1: "After this step, the manager passes realtime payloads instead of empty arrays." S2: 3 files. S3: Manager tests verify independently. S4: One invocation. S5: 3 files, one clear behavior.

### Step 2: Update useIdeas subscription + remove D-34 workaround

**Files to modify (2):**
- `src/hooks/useIdeas.ts` -- update subscription callback (lines 444-466) to handle `RealtimeIdeaPayload` with merge logic (INSERT/UPDATE/DELETE)
- `src/hooks/useProjectRealtime.ts` -- remove D-34 idea merge handlers (lines 66-107), remove `IdeaRepository` import (no longer needed for idea merge), keep presence/connection/polling

**What changes in `useIdeas.ts`:**
- Subscription callback changes from `(freshIdeas: IdeaCard[]) => void` to `(payload: RealtimeIdeaPayload) => void`
- INSERT: `setIdeas(prev => prev.some(i => i.id === incoming.id) ? prev : [...prev, incoming])`
- UPDATE: `setIdeas(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i))`
- DELETE: `setIdeas(prev => prev.filter(i => i.id !== deletedId))`
- Project-scoping filter moves into each case (check `project_id` before merging)

**What changes in `useProjectRealtime.ts`:**
- Remove lines 66-107 (the three `onPostgresChange` registrations and their unsubscribe calls in cleanup)
- Remove `IdeaRepository` import (only used by polling tick, which stays but uses the import differently)
- Actually -- `IdeaRepository` is still needed for the polling tick (line 129). Keep it.
- Remove `setIdeasRef` (lines 53-56) -- no longer needed since the postgres_changes handlers are gone
- Actually -- `setIdeasRef` is still needed for the polling tick handler (line 130). Keep it.
- Update the cleanup function to remove the three `unsub*` calls for postgres_changes
- Update the D-34 comment block to note it was resolved by ADR-0009

**What stays in `useProjectRealtime.ts`:**
- `ScopedRealtimeManager` instantiation and lifecycle (subscribe/unsubscribe)
- Presence handlers (line 112-114)
- Connection state handlers (line 119-123)
- Polling tick handler (line 128-131) -- this is the D-22 reconciliation safety net
- `setIdeasRef` -- still needed for polling tick

**Acceptance criteria:**
- `useIdeas` receives INSERT/UPDATE/DELETE payloads and merges correctly
- `useProjectRealtime` no longer registers `onPostgresChange` for 'ideas' table
- Polling tick still calls `IdeaRepository.getProjectIdeas` and sets ideas via `setIdeasRef`
- TypeScript compiles with no errors
- No duplicate idea entries after INSERT events (idempotency check)

**Complexity:** Medium (merge logic is proven from D-34, but rewiring it into useIdeas requires careful state management)

**Sizing gate:** S1: "After this step, realtime idea events merge correctly through useIdeas without clearing state." S2: 2 files. S3: Can test merge logic with unit tests against useIdeas. S4: One invocation. S5: 2 files, one behavior.

## Test Specification

| ID | Category | Description |
|----|----------|-------------|
| T-0009-001 | Unit | `RealtimeSubscriptionManager.subscribeToIdeas` passes `{ eventType: 'INSERT', new: {...}, old: null }` to callback on INSERT event |
| T-0009-002 | Unit | `RealtimeSubscriptionManager.subscribeToIdeas` passes `{ eventType: 'UPDATE', new: {...}, old: {...} }` to callback on UPDATE event |
| T-0009-003 | Unit | `RealtimeSubscriptionManager.subscribeToIdeas` passes `{ eventType: 'DELETE', new: {}, old: {...} }` to callback on DELETE event |
| T-0009-004 | Unit | `RealtimeSubscriptionManager.subscribeToIdeas` does NOT call callback on event for different project |
| T-0009-005 | Unit | `RealtimeSubscriptionManager.subscribeToIdeas` error handler logs error without calling callback |
| T-0009-006 | Unit | `useIdeas` subscription INSERT handler appends idea and is idempotent (no duplicate on re-receive) |
| T-0009-007 | Unit | `useIdeas` subscription UPDATE handler merges position fields into existing idea |
| T-0009-008 | Unit | `useIdeas` subscription DELETE handler removes idea by id |
| T-0009-009 | Unit | `useIdeas` subscription ignores events for different project (project_id mismatch) |
| T-0009-010 | Regression | `useProjectRealtime` does NOT register `onPostgresChange` for 'ideas' table (D-34 removed) |

**Test counts:** 10 tests total (5 manager unit, 4 useIdeas unit, 1 regression). Failure cases (T-0009-004, T-0009-005, T-0009-009, T-0009-010) >= happy path cases (T-0009-001, T-0009-002, T-0009-003, T-0009-006, T-0009-007, T-0009-008). Ratio: 4 failure / 6 happy = 0.67.

### Existing test impact

- `src/hooks/__tests__/useProjectRealtime.test.ts`: Tests T-054B-014 through T-054B-020 test the D-34 postgres_changes handlers. These tests will FAIL after D-34 removal. They should be updated: T-054B-014/015/016 (handler registration checks) should assert the handlers are NOT registered. T-054B-017/018/019/020 (merge logic tests) should be REMOVED since the merge logic moves to useIdeas.
- `src/hooks/__tests__/useIdeas.test.ts` and `useIdeas.comprehensive.test.ts`: Tests that mock `DatabaseService.subscribeToIdeas` will need updated mock return types.
- `src/contexts/__tests__/ProjectRealtimeContext.test.tsx`: Mocks useProjectRealtime -- should be unaffected since the mock return shape doesn't change.
- Brainstorm tests (43/43): Completely separate class, zero blast radius.

## Contract Boundaries

| Producer | Shape | Consumer |
|----------|-------|----------|
| `RealtimeSubscriptionManager.subscribeToIdeas` | `(payload: RealtimeIdeaPayload) => void` callback | `DatabaseService.subscribeToIdeas` facade |
| `DatabaseService.subscribeToIdeas` | `(payload: RealtimeIdeaPayload) => void` callback (pass-through) | `useIdeas` subscription effect |
| `useProjectRealtime.onPollingTick` | `IdeaCard[]` (full array from `IdeaRepository.getProjectIdeas`) | `setIdeasRef.current(ideas)` |

### Type definition

```typescript
// In RealtimeSubscriptionManager.ts (exported)
export type RealtimeIdeaPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Partial<IdeaCard> & { id: string }
  old: (Partial<IdeaCard> & { id: string }) | null
}
```

## Wiring Coverage

| Producer | Shape | Consumer | Step |
|----------|-------|----------|------|
| `RealtimeSubscriptionManager.subscribeToIdeas` callback | `RealtimeIdeaPayload` | `DatabaseService.subscribeToIdeas` wrapper | Step 1 |
| `DatabaseService.subscribeToIdeas` pass-through | `RealtimeIdeaPayload` | `useIdeas` subscription effect | Step 2 |
| `useIdeas` merge handlers (INSERT/UPDATE/DELETE) | `setIdeas(prev => ...)` | React state -> `optimisticData` -> UI | Step 2 |
| `useProjectRealtime.onPollingTick` | `IdeaCard[]` | `setIdeasRef.current` -> `setIdeas` | Unchanged |

No orphan producers. Every producer has a consumer in the same or earlier step.

## Data Sensitivity

| Method | Classification | Notes |
|--------|---------------|-------|
| `RealtimeSubscriptionManager.subscribeToIdeas` | auth-only | Requires active Supabase session for channel subscription |
| `DatabaseService.subscribeToIdeas` | auth-only | Passes through to manager |
| `useIdeas` subscription effect | auth-only | Checks `currentUser` before subscribing, skips demo users |
| `IdeaRepository.getProjectIdeas` | auth-only | Supabase RLS enforces row-level access |
| Polling tick in `useProjectRealtime` | auth-only | Uses default Supabase client with session token |

## Blast Radius

| File | Change Type | Risk |
|------|-------------|------|
| `src/lib/database/services/RealtimeSubscriptionManager.ts` | Modify (callback signature + handler logic) | Medium -- core realtime infrastructure |
| `src/lib/database.ts` | Modify (facade wrapper removal) | Low -- thin delegation layer |
| `src/hooks/useIdeas.ts` | Modify (subscription callback rewrite) | Medium -- state management changes |
| `src/hooks/useProjectRealtime.ts` | Modify (remove D-34 handlers) | Low -- deletion only |
| `src/hooks/__tests__/useProjectRealtime.test.ts` | Modify (update D-34 tests) | Low -- test-only |
| `src/hooks/__tests__/useIdeas.test.ts` | Modify (update mock types) | Low -- test-only |
| `src/hooks/__tests__/useIdeas.comprehensive.test.ts` | Modify (update mock types) | Low -- test-only |
| New: `src/lib/database/services/__tests__/RealtimeSubscriptionManager.test.ts` | Create | None -- new test file |

**CI/CD impact:** None. No build config, no deployment config, no migration.

**BrainstormRealtimeManager impact:** None. Separate class, separate channel, separate tests. Zero coupling.

## Notes for Colby

### Proven pattern: lift merge logic from useProjectRealtime

The INSERT/UPDATE/DELETE merge handlers in `useProjectRealtime.ts:70-107` are battle-tested (16 unit tests, E2E skipped but structurally complete). Copy the merge logic directly into useIdeas's subscription callback. The only adaptation needed: `useProjectRealtime` uses `setIdeasRef.current(prev => ...)` while `useIdeas` can use `setIdeas(prev => ...)` directly.

### Key detail: project_id filtering

`useProjectRealtime` scopes its postgres_changes with `filter: project_id=eq.${projectId}` at the Supabase channel level. `RealtimeSubscriptionManager` does NOT use a filter on the channel (line 65-67: "Removed complex filters to prevent binding mismatch"). Instead, it filters in the callback handler (lines 75-77). After the fix, `useIdeas` must continue to check `payload.new.project_id === activeProject.id` before merging. The `currentProjectRef` pattern (lines 421-424) is already in place for this.

### Edge case: the `shouldRefresh` logic

Lines 75-77 of `RealtimeSubscriptionManager` check whether the event's `project_id` matches the subscribed project. This filtering MUST be preserved in the fix. Pass the payload to the callback ONLY when `shouldRefresh` is true. Otherwise the consumer gets events from other projects.

### Type assertion caution

The realtime payload's `new` is `Record<string, any>`, not a full `IdeaCard`. The merge logic must handle partial data -- spread `{ ...idea, ...payload.new }` is correct because Supabase sends the full new row on UPDATE, but only the new row on INSERT (no `old`), and only the old row's id on DELETE.

### DatabaseService facade change

The current facade (database.ts:164-175) wraps the callback with a refetch. After the fix, it should be a thin pass-through:

```typescript
static subscribeToIdeas(
  callback: (payload: RealtimeIdeaPayload) => void,
  projectId?: string,
  userId?: string,
  options?: { skipInitialLoad?: boolean }
) {
  return RealtimeSubscriptionManager.subscribeToIdeas(callback, projectId, userId, options)
}
```

The `client` parameter (5th arg) is no longer needed since we're not refetching.

### File count: 5 modified, 1 created = 6 total (within S5 gate)

Step 1: 3 files (manager, database.ts, types). Step 2: 2 files (useIdeas, useProjectRealtime). Tests across both steps: 1 new file + 3 modified test files.

## DoD -- Definition of Done

| # | Requirement | Verification | Status |
|---|-------------|-------------|--------|
| R1 | `subscribeToIdeas` passes event payloads, never `callback([])` | T-0009-001 through T-0009-005 pass | Pending |
| R2 | D-34 workaround removed from `useProjectRealtime` | T-0009-010 passes, grep confirms no `onPostgresChange('ideas',...)` in file | Pending |
| R3 | BrainstormRealtimeManager tests green (43/43) | `npm run test -- src/lib/realtime/__tests__/BrainstormRealtimeManager` passes | Pending |
| R4 | Phase 05.4b success criteria hold | T-0009-006 through T-0009-009 pass, polling tick unchanged | Pending |
| R5 | TypeScript compiles | `npm run type-check` passes | Pending |
| R6 | No duplicate subscriptions | grep confirms single `subscribeToIdeas` call site in hooks, single channel per project | Pending |
| R7 | `useIdeas` merge logic handles INSERT/UPDATE/DELETE with project filtering | T-0009-006 through T-0009-009 | Pending |
| R8 | All existing useIdeas tests updated and passing | `npm run test -- src/hooks/__tests__/useIdeas` passes | Pending |
| R9 | All existing useProjectRealtime tests updated and passing | `npm run test -- src/hooks/__tests__/useProjectRealtime` passes | Pending |

No silent drops. Every requirement maps to a verification method.
