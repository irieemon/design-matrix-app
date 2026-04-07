---
phase: 05-real-time-collaboration
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/lib/realtime/ScopedRealtimeManager.ts
  - src/lib/realtime/BrainstormRealtimeManager.ts
  - src/hooks/useBrainstormRealtime.ts
  - src/hooks/useDotVoting.ts
  - src/hooks/__tests__/useDotVoting.test.ts
  - src/lib/realtime/__tests__/multiClient.test.ts
  - src/components/brainstorm/DotVoteControls.tsx
  - src/components/brainstorm/DotBudgetIndicator.tsx
autonomous: true
requirements: [COLLAB-01, COLLAB-02, COLLAB-05, COLLAB-06]
must_haves:
  truths:
    - "ScopedRealtimeManager accepts scope: { type: 'session' | 'project', id } and multiplexes postgres_changes + broadcast + presence on one channel"
    - "BrainstormRealtimeManager extends/uses ScopedRealtimeManager with zero regression in existing brainstorm sync"
    - "useDotVoting enforces 5-dot budget optimistically and rolls back on RLS rejection"
    - "Vote insert in one client triggers tally update in another within 2 seconds via postgres_changes"
    - "Session presence shows active participants via Supabase Presence API (COLLAB-01 for sessions)"
  artifacts:
    - path: src/lib/realtime/ScopedRealtimeManager.ts
      exports: [ScopedRealtimeManager, createScopedChannel]
    - path: src/hooks/useDotVoting.ts
      exports: [useDotVoting]
      provides: "{ votesUsed, tallies, castVote, removeVote, loading, error }"
    - path: src/components/brainstorm/DotVoteControls.tsx
      provides: "5 dot slots per idea card with optimistic toggling"
  key_links:
    - from: useDotVoting
      to: voteRepository.castVote
      pattern: "castVote\\("
    - from: ScopedRealtimeManager
      to: "supabase.channel"
      pattern: "supabase\\.channel"
    - from: useBrainstormRealtime
      to: ScopedRealtimeManager
      pattern: "ScopedRealtimeManager|new ScopedRealtimeManager"
---

<objective>
Generalize the realtime infrastructure and ship dot voting end-to-end. Refactors `BrainstormRealtimeManager` onto a new `ScopedRealtimeManager` base so plan 04 can add a project-scoped manager with zero duplication. Adds dot voting (COLLAB-05) with real-time tally broadcast (COLLAB-06). Also cements the existing session-scoped presence (COLLAB-01) and idea sync (COLLAB-02) via the new manager without regression.

Purpose: The research explicitly flagged "refactor vs parallel" as an open question — we resolve it by refactoring once here so plan 04 is a thin subclass instead of a copy.
Output: A generalized realtime manager, a working dot voting system with RLS-enforced budget, and a green multiClient test proving idea + vote broadcasts propagate.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/05-real-time-collaboration/05-CONTEXT.md
@.planning/phases/05-real-time-collaboration/05-RESEARCH.md
@.planning/phases/05-real-time-collaboration/05-UI-SPEC.md
@.planning/phases/05-real-time-collaboration/05-01-SUMMARY.md
@src/lib/realtime/BrainstormRealtimeManager.ts
@src/hooks/useBrainstormRealtime.ts
@src/lib/supabase.ts

<interfaces>
From plan 01:
- `voteRepository.castVote(sessionId, ideaId)` → `{ ok: true } | { ok: false, reason: 'budget_exceeded' | ... }`
- `voteRepository.removeVote(sessionId, ideaId)`
- `voteRepository.reconcileTallies(sessionId)` → `Map<string, number>`
- `src/test/fixtures/mockRealtimeChannel.ts` → `createMockChannel()` test fixture

Existing BrainstormRealtimeManager public surface (must not break):
- Read src/lib/realtime/BrainstormRealtimeManager.ts top-level exports and the class public methods
- useBrainstormRealtime consumers expect the existing callback shape — preserve it
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create ScopedRealtimeManager and refactor BrainstormRealtimeManager onto it</name>
  <read_first>
    - src/lib/realtime/BrainstormRealtimeManager.ts (ENTIRE file — it's 521 lines; understand reconnect loop, polling fallback, subscription lifecycle, diagnostic hooks)
    - src/hooks/useBrainstormRealtime.ts (ENTIRE file — callsite contract)
    - src/utils/realtimeDiagnostic.ts
    - .planning/phases/05-real-time-collaboration/05-RESEARCH.md §"Pattern 1: Multiplexed Channel" and §"Open Questions 2"
  </read_first>
  <files>
    src/lib/realtime/ScopedRealtimeManager.ts,
    src/lib/realtime/BrainstormRealtimeManager.ts,
    src/hooks/useBrainstormRealtime.ts,
    src/lib/realtime/__tests__/multiClient.test.ts
  </files>
  <behavior>
    ScopedRealtimeManager class:
    - Constructor: `new ScopedRealtimeManager({ scope: { type: 'session' | 'project'; id: string }, userId: string, displayName: string, onError?: (e) => void })`
    - Channel name: `${scope.type}:${scope.id}` (e.g. `session:abc123`, `project:def456`)
    - Methods:
      - `subscribe(): Promise<void>` — opens channel, calls `track()` with presence payload, starts reconnect loop
      - `unsubscribe(): Promise<void>` — cleanup
      - `onPostgresChange(table, filter, handler)` — register postgres_changes listener (registered before subscribe)
      - `onBroadcast(event, handler)` — register broadcast listener
      - `sendBroadcast(event, payload)` — fire broadcast message
      - `onPresence(handler: (state) => void)` — register presence sync listener
      - `getConnectionState(): 'connecting' | 'connected' | 'reconnecting' | 'polling' | 'disconnected'`
      - `onConnectionStateChange(handler)` — for reconnecting UI badge
    - Reconnect loop: copies the exact backoff pattern from BrainstormRealtimeManager
    - Polling fallback: delegated — base class exposes `onPollingTick(handler, intervalMs)` that subclasses implement with their own table queries
    - Presence key uses `${userId}:${tabId}` (tabId = `crypto.randomUUID()` per instance) to avoid multi-tab collisions (RESEARCH Pitfall 2)

    BrainstormRealtimeManager after refactor:
    - Becomes a thin subclass or wrapper: `class BrainstormRealtimeManager extends ScopedRealtimeManager` OR holds a ScopedRealtimeManager instance
    - Preserves every existing public method signature called by useBrainstormRealtime — no consumer changes required
    - Subscribes to `postgres_changes` on `ideas` filtered by session_id, plus presence (COLLAB-01, COLLAB-02)
    - Adds `postgres_changes` on `idea_votes` filtered by session_id (used by useDotVoting in Task 2)

    useBrainstormRealtime.ts: adjust only if internal imports change. External callsite behavior unchanged.

    multiClient.test.ts (from Wave 0 stub, now implemented):
    - Uses `createMockChannel()` fixture
    - Simulates two client instances subscribing to the same scope
    - Client A emits a postgres_changes INSERT on `ideas` → client B handler fires
    - Client A sends broadcast `drag_lock` → client B handler fires
    - Client A tracks presence → client B presence sync includes A's user_id
    - Client A disconnects → client B presence sync removes A after leave event
  </behavior>
  <action>
    Step 1: Extract the generic parts of BrainstormRealtimeManager (subscribe/reconnect/polling-fallback/diagnostic) into `ScopedRealtimeManager.ts`. Keep brainstorm-specific logic (session_id wiring, vote table filter) in BrainstormRealtimeManager. Use composition OR inheritance — pick whichever minimizes diff to consumer code.

    CRITICAL: Run `npx vitest run src/lib/realtime src/hooks/__tests__/useBrainstormRealtime*` BEFORE any refactor to capture the baseline. After refactor, the same command MUST stay green. No behavior change to existing brainstorm sync.

    Step 2: Add the `idea_votes` postgres_changes subscription to BrainstormRealtimeManager (or expose a hook for useDotVoting to attach its own listener on the shared channel — prefer the latter so voting logic stays in useDotVoting).

    Step 3: Flesh out `multiClient.test.ts` using `createMockChannel()`. Two manager instances, both subscribed to `session:test-1`. Drive the scenarios in <behavior>. Every assertion must use concrete values (no snapshots).

    Use SAFE MODE (per CLAUDE.md) — sequential edits, no parallel refactor of BrainstormRealtimeManager.
  </action>
  <verify>
    <automated>npx vitest run src/lib/realtime src/hooks/__tests__/useBrainstormRealtime.test.ts</automated>
  </verify>
  <done>ScopedRealtimeManager exports. BrainstormRealtimeManager extends/uses it. Existing brainstorm tests still pass. multiClient.test.ts has at least 4 cases (insert, broadcast, presence join, presence leave) all green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement useDotVoting hook + DotVoteControls + DotBudgetIndicator</name>
  <read_first>
    - src/lib/repositories/voteRepository.ts (from plan 01)
    - src/hooks/useOptimisticUpdates.ts (existing optimistic pattern — mirror it)
    - src/hooks/useBrainstormRealtime.ts (to know how to hook onto its channel for vote events)
    - src/components/brainstorm/ (list existing components to match import style)
    - .planning/phases/05-real-time-collaboration/05-UI-SPEC.md §"Dot voting" and §"Copywriting Contract"
    - src/hooks/__tests__/useDotVoting.test.ts (Wave 0 stub)
  </read_first>
  <files>
    src/hooks/useDotVoting.ts,
    src/hooks/__tests__/useDotVoting.test.ts,
    src/components/brainstorm/DotVoteControls.tsx,
    src/components/brainstorm/DotBudgetIndicator.tsx
  </files>
  <behavior>
    useDotVoting(sessionId, currentUserId):
    - Returns `{ votesUsed: number, votesRemaining: number, tallies: Map<ideaId, count>, myVotes: Set<ideaId>, castVote(ideaId), removeVote(ideaId), loading, error }`
    - On mount: calls `voteRepository.reconcileTallies(sessionId)` to load initial state
    - Subscribes to the existing brainstorm channel's `idea_votes` postgres_changes (via useBrainstormRealtime's exposed channel OR via a new subscription on the singleton supabase client — prefer hooking onto the shared channel)
    - On INSERT event: increment tally, add to myVotes if user_id matches current
    - On DELETE event: decrement tally, remove from myVotes if user_id matches
    - castVote(ideaId): optimistic — immediately increment + add to myVotes, then call voteRepository.castVote. On `{ ok: false, reason: 'budget_exceeded' }`: rollback + set error to UI-SPEC copy "You've used all 5 votes. Remove one to cast another."
    - Budget = 5 (hard-coded per D-02)
    - removeVote(ideaId): optimistic decrement + call repository.removeVote
    - Exposes a `reconcile()` method for D-16 reconnect reconciliation

    Tests (useDotVoting.test.ts, replacing Wave 0 stub):
    - Initial reconcile populates tallies map
    - castVote optimistically increments votesUsed from 0 to 1
    - castVote rollback on RLS rejection restores to 0 and sets error message
    - 6th castVote with budget full returns error without calling repository
    - DELETE event decrements tally

    DotVoteControls.tsx:
    - Props: `{ ideaId: string; sessionId: string }` — reads votes from useDotVoting context/hook
    - Renders 5 `<button>` dot slots
    - Filled dot (own vote) = `bg-brand-primary`, empty = `bg-graphite-300`, filled by others = ??? (UI-SPEC says all brand.primary, no per-user color)
    - Clicking a filled own-vote removes it; clicking an empty slot casts a vote
    - If votesRemaining === 0, empty slots show `cursor-not-allowed` but no alert until clicked
    - aria-label per dot: "Cast vote (N of 5 used)", aria-pressed reflects own-vote state

    DotBudgetIndicator.tsx:
    - Props: `{ votesUsed: number; total?: number }` (default total=5)
    - Renders chip: "{votesUsed} / {total} votes used" in graphite.700 on graphite.100 background
    - aria-live="polite" for screen reader updates
  </behavior>
  <action>
    Implement useDotVoting first with the optimistic update pattern from useOptimisticUpdates.ts. The hook should NOT create its own Supabase channel — it must receive the existing brainstorm channel from useBrainstormRealtime (pass as argument or use a context). If the coupling is ugly, accept a `channel` param and let the consumer plug it in.

    Write the test file to replace the Wave 0 `describe.skip` — use the mockRealtimeChannel fixture from plan 01 so tests don't hit real Supabase. Mock voteRepository with `vi.mock('../../lib/repositories/voteRepository', () => ({ castVote: vi.fn(), removeVote: vi.fn(), reconcileTallies: vi.fn() }))`.

    For DotVoteControls and DotBudgetIndicator, use the exact Tailwind tokens from UI-SPEC §"Color" and §"Dot voting". Copy strings are binding — use UI-SPEC copy exactly for the error toast message.

    SAFE MODE applies (voting is in the brainstorm-pipeline SAFE list from CLAUDE.md).
  </action>
  <verify>
    <automated>npx vitest run src/hooks/__tests__/useDotVoting.test.ts src/components/brainstorm/__tests__/DotVoteControls.test.tsx 2>/dev/null || npx vitest run src/hooks/__tests__/useDotVoting.test.ts</automated>
  </verify>
  <done>useDotVoting test suite passes with at least 5 cases. DotVoteControls renders 5 dots with correct aria labels. DotBudgetIndicator shows "N / 5 votes used". No console.* calls. Budget hard-coded at 5.</done>
</task>

<task type="auto">
  <name>Task 3: Wire DotVoteControls into idea card UI and add budget indicator to session header</name>
  <read_first>
    - src/components/brainstorm/ (find the idea card component rendered in brainstorm sessions — grep for usage in brainstorm pages)
    - src/components/brainstorm/PresenceIndicators.tsx (understand where session header lives)
    - .planning/phases/05-real-time-collaboration/05-UI-SPEC.md §"Interaction Contracts › Dot voting"
  </read_first>
  <files>
    (discover during task — likely src/components/brainstorm/BrainstormIdeaCard.tsx or similar, plus the brainstorm session page)
  </files>
  <behavior>
    - Each idea card in a brainstorm session renders `<DotVoteControls ideaId={idea.id} sessionId={sessionId} />` below the idea text
    - Session header renders `<DotBudgetIndicator votesUsed={votesUsed} />` next to `<PresenceIndicators />`
    - useDotVoting is instantiated once at the session page level and passed to children via context OR props
    - Clicking a dot causes the tally to update in the current browser AND any other browser subscribed to the same session within 2 seconds
  </behavior>
  <action>
    Discover the brainstorm session page component by searching for `useBrainstormRealtime` usages: `grep -r "useBrainstormRealtime" src/components/ src/pages/`. That file hosts the idea list and is where `useDotVoting` should be instantiated.

    Add a `DotVotingContext` or prop-drill (prefer context for only this session scope) so each idea card can read the shared hook state without re-subscribing.

    Insert `<DotBudgetIndicator>` in the session header adjacent to `<PresenceIndicators>`. Insert `<DotVoteControls>` in each idea card. Do not modify the matrix view — voting is brainstorm-session-only per CONTEXT.md.
  </action>
  <verify>
    <automated>npm run test:run -- src/components/brainstorm src/hooks/__tests__/useDotVoting.test.ts</automated>
  </verify>
  <done>Brainstorm session page instantiates useDotVoting once. Idea cards render DotVoteControls. Session header renders DotBudgetIndicator. Existing brainstorm tests still pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client vote action → Supabase RLS | 5-dot budget enforced server-side (plan 01 migration) |
| realtime channel → multi-client fanout | postgres_changes RLS determines who sees events |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-15 | Tampering | client-side vote budget | mitigate | RLS is the authority (plan 01); client enforces optimistically for UX only; any 6th vote hits 42501 and rolls back |
| T-05-16 | Information Disclosure | vote tally read | mitigate | RLS SELECT policy on idea_votes requires session_participants membership — non-members see nothing |
| T-05-17 | Spoofing | presence user_id | mitigate | Presence key is `${userId}:${tabId}`; the userId is derived from auth session, not user-supplied |
| T-05-18 | DoS | vote spam clicks | accept | RLS rate limiting would be nice but the 5-budget cap is a natural ceiling; no additional throttle needed |
| T-05-19 | Tampering | refactor breaks existing brainstorm sync | mitigate | Baseline test run before refactor, re-run after; SAFE MODE sequential edits |
</threat_model>

<verification>
- All existing brainstorm realtime tests still green after refactor
- useDotVoting test suite green (5+ cases)
- multiClient.test.ts green (4+ cases)
- Manual: cast vote in one browser, see tally update in another within 2s (will be validated in phase gate smoke test)
</verification>

<success_criteria>
- ScopedRealtimeManager ready for plan 04 to subclass for project scope
- COLLAB-01 (session presence) still works via new manager
- COLLAB-02 (idea sync) still works via new manager
- COLLAB-05 (dot voting with 5-budget) works end-to-end
- COLLAB-06 (real-time tally) propagates across two clients
- Zero regression in existing brainstorm features
</success_criteria>

<output>
After completion, create `.planning/phases/05-real-time-collaboration/05-03-SUMMARY.md` documenting the ScopedRealtimeManager API, the refactor approach taken (inheritance vs composition), and the dot voting integration points. Plan 04 reads this.
</output>
