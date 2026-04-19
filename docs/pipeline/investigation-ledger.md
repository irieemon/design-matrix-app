# Investigation Ledger — v1.3 Phase 12 Category A

**Pipeline:** phase12-cat-a-realtime-broadcast-96eaa321
**Investigator:** Roz (Opus)
**Date:** 2026-04-19

## Symptom

T-054B-301 + T-054B-302: Browser B never observes broadcast-driven DOM elements
(`[data-testid^="live-cursor-"]`, `[data-testid="locked-card-overlay-${ideaId}"]`)
after Browser A moves the mouse / starts a drag. Presence stack test T-054B-300
PASSES on the same channel, same auth, same local Supabase stack.

## Hypothesis Table

| # | Hypothesis | Layer | Evidence for | Evidence against | Verdict |
|---|-----------|-------|--------------|------------------|---------|
| a | Channel subscribed before auth is ready | Application | `subscribe()` fires synchronously in `acquireManager` (useProjectRealtime.ts:71) before any React re-render could sync auth state | T-054B-300 presence reaches `SUBSCRIBED` status (both browsers see each other in the stack). Auth is fine -- the channel is open. | REJECTED |
| b | RLS / private-channel authorization denies broadcast delivery | Transport | — | Channel names `project:${id}` are *custom broadcast* channels, not DB-bound; default Supabase broadcast is public. No `private: true` anywhere. Presence on the SAME channel works — if auth-on-channel were denying, presence would also fail. | REJECTED |
| c | Ghost / uncleaned subscription handlers | Application | Module-level `managerCache` in useProjectRealtime.ts:42 survives StrictMode re-mount | Failure mode is SILENCE (zero handlers firing), not duplicates. Uncleaned handlers produce N-times firing, not zero. | REJECTED |
| d | Server emitting on wrong channel name | Application | — | Channel name `${scope.type}:${scope.id}` is symmetric on both sides (one class, one naming rule). Presence cross-delivery on that name proves the two browsers share a channel. | REJECTED |
| **e** | **Broadcast listeners never wired to underlying Supabase channel — ordering bug between `ScopedRealtimeManager.subscribe()` and consumer `onBroadcast()` calls** | **Application** | See detailed trace below. Direct code-read. Presence (hard-wired in `buildChannel`) explains asymmetry with broadcast (registry-driven in `buildChannel`). | None found. | **ACCEPTED** |

## Root Cause — hypothesis (e)

**Shared failure point. Two collaborating files:**
- `src/hooks/useProjectRealtime.ts:71` — `acquireManager()` synchronously fires `void manager.subscribe()` inside `new ScopedRealtimeManager(...)` construction.
- `src/lib/realtime/ScopedRealtimeManager.ts:126-136` — `onBroadcast()` only pushes into the in-memory `broadcastListeners[]` registry; it does NOT call `this.channel.on('broadcast', …)` on the live channel.
- `src/lib/realtime/ScopedRealtimeManager.ts:236-275` — `buildChannel()` iterates the CURRENT contents of `broadcastListeners[]` and wires each to `ch.on('broadcast', {event}, …)`.

**Lifecycle trace:**

1. `useProjectRealtime` useEffect runs → `acquireManager(...)` (line 113).
2. `acquireManager` constructs `ScopedRealtimeManager` and immediately calls `void manager.subscribe()` (line 71).
3. `subscribe()` calls `this.channel = this.buildChannel()` (line 182). At this instant, `broadcastListeners[]` is **empty** — `useLiveCursors` and `useDragLock` have not yet received the manager (they receive it via React state that won't be set until `setManager(mgr)` on line 130). No `ch.on('broadcast', …)` is registered on the underlying Supabase channel.
4. `this.channel.subscribe(...)` lands at `SUBSCRIBED` (presence wiring succeeds because `buildChannel` hard-codes `ch.on('presence', ...)` at lines 278-294 regardless of handler registry).
5. React re-renders. `useLiveCursors` (line 107) and `useDragLock` (lines 102, 127) now receive a non-null manager and call `manager.onBroadcast('cursor_move'/'drag_lock'/'drag_release', handler)`. These calls only push into `broadcastListeners[]` (lines 131-134). **They never touch `this.channel.on(...)`**.
6. Inbound broadcast events arrive on the Supabase channel and find zero registered `broadcast` handlers. They are silently dropped.
7. Outbound `sendBroadcast` (line 219) still works because `this.channel.send(...)` does not require prior `ch.on`. This is why sender-side traces may show traffic going out with no visible errors.

**Why presence works:** `buildChannel()` registers presence listeners unconditionally (lines 278-294), regardless of whether `presenceHandlers[]` is populated. Presence wiring is hard-coded; broadcast wiring is registry-driven and runs once at build time.

**Why the documented contract is violated:** ScopedRealtimeManager.ts:106-107 comment says "Listeners registered BEFORE subscribe()". The consumer pattern in `useProjectRealtime` violates that contract — `subscribe()` is invoked inside `acquireManager`, strictly before any React render that could run `onBroadcast` calls. The bug is that `onBroadcast` does NOT compensate for late registration by attaching to the live channel.

**Cache doesn't save us:** On manager cache hit (same projectId/userId), the cached manager's channel is already built with an empty `broadcastListeners[]`. New `onBroadcast` calls still hit only the registry.

## Verdict

**SHARED.** One fix unblocks both T-054B-301 (cursor broadcast) and T-054B-302
(drag-lock broadcast). Confirmed by code read, cross-checked against the
presence-passes-broadcast-fails asymmetry.

**Proposed fix (brief — Colby spec):** In `ScopedRealtimeManager.onBroadcast`
(and symmetrically `onPostgresChange`, though not tested by this phase),
attach the handler to the live channel when `this.channel !== null`, in
addition to updating the registry. The registry is retained so
`resubscribe() → buildChannel()` (reconnect path) still works. Cleanest
shape: refactor `buildChannel` to register a single broadcast-event dispatcher
at `ch.on('broadcast', { event: '*' or per-event })` that reads the live
registry at dispatch time — that way late-registered listeners receive
events without needing channel mutation. Add a regression test that
registers a broadcast listener AFTER `subscribe()` has returned and verifies
delivery.

## Confidence: HIGH

Direct code evidence. The presence-passes-broadcast-fails asymmetry is
explained completely and uniquely by this bug. No alternative hypothesis
survives the presence cross-check.

## Recommendation for Eva

- **Route to Colby** as a single Micro/Small spec. Scope is narrow and
  internal to `ScopedRealtimeManager`; `onBroadcast` public shape preserved.
- **No ADR needed** — implementation detail inside the class, contract
  compatible.
- **Roz regression test** to accompany: register `onBroadcast` handler
  AFTER `subscribe()` resolves, verify the handler receives a simulated
  inbound broadcast. This is the missing test that would have caught the
  bug. Apply the same regression shape to `onPostgresChange`.
- **Latent risk worth flagging to Cal/Colby but NOT blocking this fix:**
  `onPostgresChange` has the same ordering bug. Any consumer that
  subscribes to postgres_changes via the manager AFTER `subscribe()` will
  silently miss row events. No test covers that path today. Fold into the
  same fix.
