---
phase: 05-real-time-collaboration
plan: 04
type: execute
wave: 3
depends_on: [01, 02, 03]
files_modified:
  - src/lib/realtime/ProjectRealtimeManager.ts
  - src/lib/realtime/cursorThrottle.ts
  - src/lib/services/dragLockService.ts
  - src/hooks/useProjectRealtime.ts
  - src/hooks/__tests__/useProjectRealtime.test.ts
  - src/hooks/useLiveCursors.ts
  - src/hooks/useDragLock.ts
  - src/components/matrix/LiveCursorsLayer.tsx
  - src/components/matrix/ProjectPresenceStack.tsx
  - src/components/matrix/LockedCardOverlay.tsx
  - src/components/shared/ReconnectingBadge.tsx
  - tests/e2e/matrix-drag-sync.spec.ts
  - (discover) src/components/matrix/DesignMatrix.tsx or equivalent — insert overlays + drag handlers
autonomous: false
requirements: [COLLAB-01, COLLAB-02, COLLAB-07]
must_haves:
  truths:
    - "Multiple users viewing the same project see each other via avatar stack and live cursors"
    - "Dragging an idea on the matrix shows the card as locked for other users until drop"
    - "Dropping an idea broadcasts the final position and persists to DB; other users see the update within 2 seconds"
    - "Ideas created on the matrix view (not in a session) sync across clients in real time"
    - "Reconnecting badge appears after 1.5s of disconnect and dismisses with 'Back online. Synced.' toast on reconnect"
  artifacts:
    - path: src/lib/realtime/ProjectRealtimeManager.ts
      provides: "Project-scope channel — presence + cursors + drag_lock + drag_position + postgres_changes on ideas"
    - path: src/components/matrix/LiveCursorsLayer.tsx
      provides: "SVG cursor overlay on matrix"
    - path: src/components/matrix/LockedCardOverlay.tsx
      provides: "Grayscale lock state on cards currently held by other users"
  key_links:
    - from: DesignMatrix drag onDragStart
      to: dragLockService.acquire
      pattern: "dragLockService\\.acquire|acquireLock"
    - from: DesignMatrix drag onDragEnd
      to: "ideaRepository.updatePosition + dragLockService.release"
      pattern: "updatePosition|releaseLock"
    - from: useProjectRealtime
      to: ProjectRealtimeManager
      pattern: "new ProjectRealtimeManager"
---

<objective>
Ship project-scope realtime: presence avatar stack, live cursors, soft drag lock, in-flight drag broadcasts, and matrix idea sync. Closes COLLAB-01 (for project scope), COLLAB-02 (for project scope), and COLLAB-07. Consumes the ScopedRealtimeManager from plan 03.

Purpose: This is the highest-visibility deliverable of Phase 5 — users actually see each other on the matrix and see drags in real time. Must feel like Figma, not like a page-reload ghost.
Output: Project-scoped realtime manager, cursor/lock/presence overlays on the matrix, reconnecting UI, and an e2e test that proves two-browser drag sync.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/05-real-time-collaboration/05-CONTEXT.md
@.planning/phases/05-real-time-collaboration/05-RESEARCH.md
@.planning/phases/05-real-time-collaboration/05-UI-SPEC.md
@.planning/phases/05-real-time-collaboration/05-03-SUMMARY.md
@src/lib/realtime/ScopedRealtimeManager.ts
@src/components/brainstorm/PresenceIndicators.tsx

<interfaces>
From plan 03:
- `ScopedRealtimeManager` base class with onPostgresChange, onBroadcast, sendBroadcast, onPresence, getConnectionState, onConnectionStateChange
- Channel name format: `project:${projectId}`
- Presence key format: `${userId}:${tabId}`

From plan 01:
- `collaboratorRepository.getRoleForUser(projectId, userId)` → `'owner' | 'viewer' | 'editor' | null`

Existing to read before touching:
- `src/components/matrix/DesignMatrix.tsx` (or whichever file hosts the @dnd-kit drag context — grep for `DndContext` in src/components/matrix/)
- `src/lib/repositories/ideaRepository.ts` — updatePosition method
- `src/components/brainstorm/PresenceIndicators.tsx` — copy pattern for ProjectPresenceStack
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: ProjectRealtimeManager + cursorThrottle + dragLockService + useProjectRealtime hook</name>
  <read_first>
    - src/lib/realtime/ScopedRealtimeManager.ts (from plan 03)
    - src/lib/realtime/BrainstormRealtimeManager.ts (as the sibling template)
    - src/hooks/__tests__/useProjectRealtime.test.ts (Wave 0 stub from plan 01)
    - src/test/fixtures/mockRealtimeChannel.ts
    - .planning/phases/05-real-time-collaboration/05-RESEARCH.md §"Pattern 3: Soft-Lock" and §"Pattern 4: Cursor Throttle"
  </read_first>
  <files>
    src/lib/realtime/ProjectRealtimeManager.ts,
    src/lib/realtime/cursorThrottle.ts,
    src/lib/services/dragLockService.ts,
    src/hooks/useProjectRealtime.ts,
    src/hooks/__tests__/useProjectRealtime.test.ts
  </files>
  <behavior>
    ProjectRealtimeManager extends ScopedRealtimeManager:
    - Constructor takes `{ projectId, userId, displayName }`, sets scope to `{ type: 'project', id: projectId }`
    - On subscribe: registers postgres_changes on `ideas` filtered by `project_id=eq.${projectId}` (COLLAB-02 matrix scope)
    - Exposes `sendCursor({ x, y })`, `sendDragLock(ideaId, action: 'acquire' | 'release', expiresAt?)`, `sendDragPosition(ideaId, x, y)` as typed wrappers over sendBroadcast
    - Exposes `onCursor(handler)`, `onDragLock(handler)`, `onDragPosition(handler)`, `onIdeaChange(handler)`, `onPresence(handler)`

    cursorThrottle.ts — exports `createCursorThrottle(send: (pos) => void, intervalMs = 50)`:
    - Uses requestAnimationFrame + lastSent timestamp per RESEARCH.md §"Pattern 4"
    - Returns `{ schedule(x, y), flush(), cancel() }`
    - Target: 20Hz (50ms interval). Coalesces frames.

    dragLockService.ts — exports:
    - `acquireLock(projectId, ideaId, userId, manager: ProjectRealtimeManager)` → sends broadcast with expiresAt = now + 10000ms
    - `releaseLock(projectId, ideaId, userId, manager)` → sends broadcast action='release'
    - `getLocksSnapshot()` → Map<ideaId, { userId, userName, expiresAt }>
    - Internal state: Map of active locks; auto-prunes entries past expiresAt on read
    - Subscribes to manager's onDragLock + onPresence leave events to sweep locks from disconnected users

    useProjectRealtime(projectId) hook:
    - Creates and owns a ProjectRealtimeManager for the project
    - Returns `{ presence: Presence[], cursors: Map<userId, {x,y,name,color}>, locks: Map<ideaId, LockInfo>, connectionState, sendCursor, acquireLock, releaseLock, sendDragPosition }`
    - On unmount: unsubscribes and sends release broadcasts for any held locks
    - On `beforeunload`: best-effort release broadcast (per RESEARCH Pitfall 4)
    - Presence dedupes by userId (multiple tabs collapse to one avatar)

    useProjectRealtime.test.ts (replaces Wave 0 stub):
    - Subscribe fires subscribed state
    - Remote cursor broadcast updates cursors map
    - Lock acquire broadcast adds entry; release removes it
    - Presence leave clears locks held by departed user
    - Connection state transitions from 'connecting' → 'connected'
  </behavior>
  <action>
    Build ProjectRealtimeManager as a minimal subclass — it should be <150 lines. The ScopedRealtimeManager base from plan 03 does all the heavy lifting. This class only adds the typed broadcast helpers and the ideas postgres_changes subscription.

    cursorThrottle.ts: implement exactly per RESEARCH.md §"Pattern 4" code example. Use `performance.now()` and `requestAnimationFrame`. In test env (jsdom) rAF is polyfilled — no special handling needed.

    dragLockService.ts: maintain the Map in module scope (or as a class). The sweep-on-presence-leave hook wires up when `acquireLock` first creates a subscription. Auto-prune expired locks on every `getLocksSnapshot()` call.

    useProjectRealtime: use `useEffect` with cleanup returning `manager.unsubscribe()`. Use `useRef` to hold the manager instance (not state — don't re-render on internal state). Use `useState` for the returned presence/cursors/locks maps so React re-renders on updates.

    Replace the Wave 0 `describe.skip` in useProjectRealtime.test.ts with real tests using `createMockChannel()`. At least 5 cases per <behavior>.

    SAFE MODE (realtime is in the list). Sequential edits.
  </action>
  <verify>
    <automated>npx vitest run src/hooks/__tests__/useProjectRealtime.test.ts src/lib/realtime</automated>
  </verify>
  <done>ProjectRealtimeManager subclasses ScopedRealtimeManager. cursorThrottle produces at most 20 sends/sec in a synthetic 1000-move test. dragLockService sweeps locks on presence leave. useProjectRealtime test suite has 5+ green cases.</done>
</task>

<task type="auto">
  <name>Task 2: Build matrix overlays (cursors, presence stack, lock overlay, reconnecting badge) and wire into DesignMatrix</name>
  <read_first>
    - src/components/matrix/ (full listing — find the drag context file, the idea card file, the matrix container)
    - src/components/brainstorm/PresenceIndicators.tsx (copy stacking pattern)
    - .planning/phases/05-real-time-collaboration/05-UI-SPEC.md §"Interaction Contracts" all subsections
    - src/lib/repositories/ideaRepository.ts updatePosition method signature
  </read_first>
  <files>
    src/components/matrix/LiveCursorsLayer.tsx,
    src/components/matrix/ProjectPresenceStack.tsx,
    src/components/matrix/LockedCardOverlay.tsx,
    src/components/shared/ReconnectingBadge.tsx,
    src/hooks/useLiveCursors.ts,
    src/hooks/useDragLock.ts,
    (discover) src/components/matrix/DesignMatrix.tsx
  </files>
  <behavior>
    LiveCursorsLayer.tsx:
    - Absolutely positioned full-size overlay pinned to matrix bounds
    - Consumes cursors map from useProjectRealtime (or prop)
    - Renders one SVG arrow + label per remote cursor (NEVER renders own cursor)
    - CSS transition `transform 80ms linear` for smooth interpolation
    - Label uses `DOMPurify.sanitize(userName)` before rendering
    - Color = deterministic HSL hash of userId: `hsl((hashCode(userId) % 360), 70%, 50%)`
    - Fades to 0 opacity after 2s of no updates (setTimeout per cursor)
    - aria-label on each cursor: "{name}'s cursor"

    ProjectPresenceStack.tsx:
    - Consumes presence array (deduped by userId)
    - Max 5 avatars shown, 32px diameter, -8px overlap per UI-SPEC
    - +N chip for overflow with graphite.200 background
    - Self avatar first, slightly larger ring
    - Hover tooltip with full name

    LockedCardOverlay.tsx:
    - Props: `{ lockHolder: { userId, userName } | null; children: ReactNode }`
    - If lockHolder is set AND lockHolder.userId !== currentUserId: wraps children in a div with `graphite-300/40` overlay and `pointer-events-none cursor-not-allowed`
    - Shows badge in top-right: "{firstName} is moving this"
    - aria-live="polite" region announces "Locked by {name}"

    ReconnectingBadge.tsx:
    - Consumes connectionState from useProjectRealtime
    - Shows pill at top-center with "Reconnecting…" only after 1.5s of disconnected/reconnecting state (uses setTimeout)
    - On reconnect: auto-dismiss + fires onReconnected callback (parent shows toast "Back online. Synced." for 2s)
    - role="status" aria-live="polite"

    useLiveCursors(manager): helper hook combining cursorThrottle + mousemove listener on matrix container. Attaches mousemove handler to the matrix element ref, computes x/y relative to container, calls throttle.schedule.

    useDragLock(manager, projectId, userId): helper hook returning `{ locks, acquireLock, releaseLock }`. Wraps dragLockService.

    DesignMatrix integration (discover file via grep `DndContext.*matrix` in src/components/matrix/):
    - Get projectId from props/context
    - `const { cursors, presence, locks, connectionState, acquireLock, releaseLock, sendDragPosition } = useProjectRealtime(projectId)`
    - Attach useLiveCursors to the matrix container ref
    - In `onDragStart(event)`: call `acquireLock(event.active.id)`
    - In `onDragMove(event)`: throttled call to `sendDragPosition(event.active.id, x, y)` (throttled at rAF, not per-move)
    - In `onDragEnd(event)`: call `ideaRepository.updatePosition(ideaId, x, y)` then `releaseLock(ideaId)`
    - Wrap each idea card in `<LockedCardOverlay lockHolder={locks.get(idea.id) ?? null}>`
    - Render `<LiveCursorsLayer />` and `<ProjectPresenceStack />` as children of the matrix container
    - Render `<ReconnectingBadge connectionState={connectionState} />` at the app level (or matrix level)

    Send release on `beforeunload` via window event listener in useDragLock.
  </behavior>
  <action>
    Build the overlay components in isolation first — they should be pure and take props. Then create useLiveCursors and useDragLock as thin wrappers.

    Discover DesignMatrix: `grep -rn "DndContext" src/components/matrix/ src/components/pages/`. Read the full file to understand how onDragStart/onDragMove/onDragEnd are currently wired. Preserve existing behavior — only add the realtime calls alongside.

    For cursor color, implement `hashCode(str)` as a simple multiply-by-31 hash; stable across reloads because it's pure.

    Use Tailwind tokens only from UI-SPEC §"Color" (graphite, canvas, neutral, brand). No new colors. Accent (`brand.primary`) ONLY on the dot voting dots from plan 03 — NOT on cursors or presence borders.

    SAFE MODE. Sequential edits. This task touches live drag handlers — any bug here causes matrix regressions. Take it in steps: build overlays → wire cursors → wire locks → wire drag_position broadcast → wire updatePosition persist. After each step, `npm run test:run -- src/components/matrix`.
  </action>
  <verify>
    <automated>npm run test:run -- src/components/matrix src/hooks/__tests__/useProjectRealtime.test.ts</automated>
  </verify>
  <done>All four overlay components exist. useLiveCursors + useDragLock hooks exist. DesignMatrix integrates all of them without breaking existing drag behavior. Existing matrix tests still green. No unused imports (lint clean on touched files).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: E2E two-browser drag sync test + full phase smoke test</name>
  <read_first>
    - tests/e2e/ (list existing specs; read one to understand fixture style + auth helper)
    - tests/e2e/matrix-drag-sync.spec.ts (Wave 0 stub from plan 01)
    - playwright.config.ts
    - .planning/phases/05-real-time-collaboration/05-UI-SPEC.md (to know what to eyeball)
  </read_first>
  <files>tests/e2e/matrix-drag-sync.spec.ts</files>
  <behavior>
    Playwright test replacing the Wave 0 stub:
    - Uses two browser contexts (two "users") authenticated as project owner + project collaborator (seed via API or existing auth helper)
    - Both open the same project matrix page
    - Context A drags an idea card to a new position
    - Context B sees the lock overlay appear on the card during the drag
    - Context A drops the card
    - Context B sees the card at the new position within 2 seconds
    - Context B tries to drag the same card while Context A is still holding it → drag is blocked (pointer-events none)
    - Assertion on final position via DOM read of the idea's inline style / data attribute
  </behavior>
  <action>
    Write the Playwright spec using two browser contexts from a single test. Reuse any existing auth helper (`tests/e2e/helpers/auth.ts` if present; otherwise bypass via localStorage token injection).

    Use `page.locator('[data-idea-id="..."]').dragTo(targetLocator)` for the drag. Add a `data-idea-id` attribute to idea cards in DesignMatrix if not already present (small change in Task 2, can defer here if needed).

    This task is a checkpoint because the e2e test will exercise the full flow and requires a human smoke test after it passes. The human verification covers all 5 success criteria for the phase.
  </action>
  <what-built>
    - Two-browser Playwright test for drag sync
    - Full Phase 5 realtime stack live
  </what-built>
  <how-to-verify>
    Automated:
    1. Run `npx playwright test tests/e2e/matrix-drag-sync.spec.ts --project=chromium` → must pass
    2. Run `npm run test:run` → all unit tests green

    Manual smoke (required for phase gate):
    3. Open the app in browser A (Chrome), log in as project owner
    4. Open same project in browser B (Firefox or Chrome incognito), log in as collaborator (created via invite flow from plan 02)
    5. COLLAB-01 presence: expect both users' avatars in the ProjectPresenceStack on the matrix view
    6. COLLAB-01 live cursors: move mouse in browser A, expect cursor to appear in browser B with browser A's name and unique color, and vice versa
    7. COLLAB-02 idea sync: create a new idea in browser A, expect it to appear in browser B within 2s without refresh
    8. COLLAB-05 voting: in a brainstorm session shared between both, cast votes in browser A, see budget indicator and tally update in browser B
    9. COLLAB-06 vote tally: cast 5 dots in browser A, expect 6th to fail with "You've used all 5 votes."
    10. COLLAB-07 drag sync: drag an idea in browser A, expect browser B to show LockedCardOverlay with "{name} is moving this", then see the new position after drop
    11. Disconnect test: briefly kill network in browser A (DevTools offline), wait 2s, expect ReconnectingBadge; re-enable network, expect "Back online. Synced." toast
    12. Tab close test: start dragging in browser A, close the tab, expect lock to clear in browser B within 30s (Presence leave sweep)
  </how-to-verify>
  <resume-signal>Type "approved" if steps 1-12 all pass, or describe failures for a revision plan.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client broadcast → other clients | Cursor/lock/drag_position are ephemeral; no DB write |
| client → ideaRepository.updatePosition (on drop) | RLS enforces editor role to write |
| presence track payload → other clients | displayName flows user-controlled string into UI |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-20 | Tampering | Viewer tries to drag | mitigate | ideaRepository.updatePosition fails via RLS (requires editor role); UI should also disable drag for viewers based on getRoleForUser result (read-only mode) |
| T-05-21 | XSS | Cursor label displayName | mitigate | DOMPurify.sanitize before rendering in LiveCursorsLayer |
| T-05-22 | DoS | Cursor broadcast flood | mitigate | cursorThrottle caps at ~20Hz via rAF + 50ms gate |
| T-05-23 | Tampering | Drag lock never released (tab close) | mitigate | expiresAt 10s + Presence leave sweep + beforeunload release |
| T-05-24 | Information Disclosure | Non-collaborator sees project cursors | mitigate | RLS on project_collaborators + subscription gate: ProjectRealtimeManager only subscribes after collaboratorRepository.getRoleForUser returns non-null |
| T-05-25 | Elevation | Fake drag_lock from non-editor | accept | Broadcasts are ephemeral; worst case is visual lock on a card. If abuse emerges, move to DB-backed locks. Acceptable for MVP. |
| T-05-26 | DoS | Presence key collision across tabs | mitigate | Key format `${userId}:${tabId}` where tabId is crypto.randomUUID() per manager instance |
</threat_model>

<verification>
- `npx vitest run src/hooks/__tests__/useProjectRealtime.test.ts src/lib/realtime src/components/matrix` all green
- `npx playwright test tests/e2e/matrix-drag-sync.spec.ts` green
- Manual 12-step smoke test passes
- grep: `DOMPurify` import present in LiveCursorsLayer
- grep: `expiresAt` in dragLockService.ts
</verification>

<success_criteria>
All 5 phase success criteria verified in the manual smoke test:
1. Users see online presence via avatar stack
2. Ideas created by any user appear in real-time without refresh
3. Invitations + permissions (already proved in plan 02)
4. Vote tallies update in real-time (already proved in plan 03, cross-verified here)
5. Drag sync works across browsers

All 7 COLLAB requirement IDs covered across plans 01-04.
</success_criteria>

<output>
After completion, create `.planning/phases/05-real-time-collaboration/05-04-SUMMARY.md` documenting the overlay components, the DesignMatrix integration points (line numbers of the onDragStart/onDragMove/onDragEnd calls), the final cursor throttle rate measured, and any lock grace timeout adjustments. This SUMMARY is the phase retrospective input.
</output>
