---
phase: 05.4b
feature: project-realtime-matrix
status: draft
author: sable-ux
created: 2026-04-09
requirements: [COLLAB-01-matrix, COLLAB-02, COLLAB-07]
depends_on: [phase-05.4a-session-scope-voting.md]
---

# Phase 05.4b — Project-Scope Realtime Matrix: UX Design

## Overview

Multiple users viewing the same project matrix see each other as a compact avatar stack, track each other's cursor positions with Figma-style labeled pointers, see idea cards visually locked when another user is mid-drag, and watch card positions update in real-time after a drop. A reconnecting badge surfaces connection loss after 1.5 seconds of silence and dismisses automatically with a "Back online. Synced." toast on recovery.

This phase extends realtime presence to the project scope — the matrix view without any active brainstorm session. The session-scope (05.4a) and project-scope presence stacks are **orthogonal**: a user can be on the matrix view without being in a session, and vice versa.

All new components consume the existing Animated Lux design tokens. Four locked component names govern this spec: `ProjectPresenceStack`, `LiveCursorsLayer`, `LockedCardOverlay`, `ReconnectingBadge`.

---

## 1. User Flows

### 1a. Joining a Project Matrix and Seeing Other Users

```
User opens a project and enters the fullscreen matrix view.

1. The browser subscribes to the ScopedRealtimeManager for
   scope { type: 'project', id: projectId }.

2. useProjectRealtime registers presence (track self) and fires
   onPresence. ProjectPresenceStack receives the initial participant list.

3. If other users are already on this matrix:
   → All their avatars appear in the ProjectPresenceStack stack in
     the top-right corner of the action bar (see §2a Placement).
   → The current user's own avatar appears first (leftmost) with a
     sapphire-400 ring indicating self.
   → An aria-live="polite" region announces (one per other user,
     debounced if multiple arrive simultaneously):
     "You joined. 3 others are viewing this matrix."

4. If the current user is the first on the matrix:
   → Only the current user's avatar is shown in the stack.
   → No presence announcement (no "you are alone" messaging).

5. As additional users join later:
   → Each new avatar slides in at the right end of the stack
     (200ms translate + opacity, animate-slide-right).
   → Overflow collapses to "+N" chip when total > 5.
   → aria-live region announces: "{Name} joined the matrix."
```

### 1b. Moving a Cursor and Others Seeing It

```
User moves their mouse across the matrix canvas.

1. useLiveCursors captures pointermove events on the matrix canvas.
   Cursor position is recorded in matrix-local coordinates
   (percentage of container width/height, 0–100).

2. On each animation frame tick that fires at ≤50ms intervals
   (20fps cap), the hook checks whether position has changed by
   ≥2px in either axis. If yes, a broadcast is sent:
     manager.sendBroadcast('cursor_move', {
       userId, x: pctX, y: pctY, displayName
     })

3. The hook does NOT broadcast while the current user is actively
   dragging a card (drag state disables cursor broadcast to avoid
   two simultaneous position signals from one user).

4. Other users' LiveCursorsLayer receives the broadcast:
   → A labeled cursor (pointer SVG + name pill) for that user
     appears at the matching position on the matrix canvas.
   → Cursor moves smoothly via CSS transform transition (80ms ease-out)
     between broadcast positions.

5. If a user stops moving:
   → Their cursor fades out after 5 seconds of no broadcast
     (opacity: 1 → 0, 400ms, after the 5s inactivity timer fires).
   → The cursor DOM element is removed 400ms later.
   → When that user's cursor reappears, it fades back in at the
     new position without a sliding entrance (instant position, fade opacity).

6. Cursor does not appear for the current user themselves.
   (Native OS cursor is sufficient; showing the user's own broadcast
   cursor on top of the native one would be disorienting.)
```

### 1c. Dragging a Card and Others Seeing It Locked

```
User A starts dragging an idea card.

1. User A: DndContext fires onDragStart for the card. The existing
   MatrixFullScreenView logic sets activeId and hides the card at
   its original position (opacity: 0.3, visibility: hidden).
   The DragOverlay renders the floating clone.

2. User A: useDragLock broadcasts:
     manager.sendBroadcast('drag_lock', {
       userId, ideaId, displayName
     })
   broadcast fires once on drag start (not on every pointermove
   during the drag — the lock is a single state event, not a
   position event).

3. User B: useDragLock receives the 'drag_lock' broadcast.
   → lockedCards: Map<ideaId, { userId, displayName }> is updated.
   → LiveCursorsLayer stops tracking cursor for user A
     (cursor broadcast halts during drag on user A's side — §1b step 3).
   → LockedCardOverlay renders over that card in DesignMatrix.

4. User B sees:
   → The idea card's normal content is still visible but the
     LockedCardOverlay sits above it: a sapphire-300 border ring +
     a translucent white tint (10% white overlay) + a small lock
     badge in the card's top-right corner reading "{Name} is moving this".
   → Cursor: not-allowed on the locked card's area (via overlay's
     pointer-events: none on the underlying card, except for the
     overlay label which itself has pointer-events: none).
   → The card does NOT move while user A is dragging — user B sees
     it locked in place at the original position.
   → If user A's cursor was visible before the drag, it disappears
     (cursor broadcast paused).

5. User A's LiveCursorsLayer does NOT show user A's own cursor
   overlay (never shows self).
   User B's LiveCursorsLayer is already not showing user A's cursor
   (broadcast paused on drag). This is intentional: the lock badge
   communicates "who" without needing a cursor during drag.
```

### 1d. Dropping a Card and Others Seeing It Move

```
User A releases the drag.

1. DndContext fires onDragEnd (handleDragEndWrapper).
   The existing optimistic update fires for user A:
   → idea.x and idea.y update immediately in user A's local state.
   → DB write is queued.

2. useDragLock broadcasts 'drag_release':
     manager.sendBroadcast('drag_release', { userId, ideaId })
   This fires immediately on drag end, before the DB write completes.

3. User B: 'drag_release' broadcast received.
   → lockedCards entry for ideaId is removed.
   → LockedCardOverlay unmounts (150ms fade-out).
   → The card remains at its ORIGINAL position on user B's matrix
     momentarily.

4. The idea position update arrives on user B via one of two paths:
   a. Faster path: postgres_changes UPDATE event (onPostgresChange
      listener registered on the 'ideas' table filtered by
      project_id = projectId) fires after the DB write completes.
      Expected latency: ~100–400ms after drag_release broadcast.
   b. Slower path: if polling fallback is active (connectionState
      = 'polling'), polling tick fires every N seconds and delivers
      the updated idea coordinates.

5. User B's matrix idea card animates to the new position:
   → CSS transition on the card's `left` and `top` properties
     (200ms ease-out glide).
   → This matches the existing MatrixFullScreenView DragOverlay
     drop animation (200ms ease).
   → No toast, no banner — the position change is the signal.

6. aria-live region (polite) on user B: No announcement.
   Position changes from others are purely visual — narrating every
   drag drop for screen readers in a collaborative matrix would
   create an overwhelming announcement queue. Lock/unlock alone
   is announced (see §5).

RACE CONDITION — User A drops, DB write fails:
   → User A sees an optimistic rollback (card snaps back).
   → User B has already received drag_release. The card briefly
     moved to the new position (if postgres_changes arrived) and
     then snaps back when the failure correction arrives.
   → This is the same eventual-consistency behavior as any
     optimistic update failure. No special UX is added beyond
     what already exists in the drag rollback flow.
```

### 1e. Losing Connection and Reconnecting

```
DISCONNECT:
1. ScopedRealtimeManager transitions to connectionState = 'reconnecting'
   (first attempt) after a CHANNEL_ERROR or TIMED_OUT event.

2. useProjectRealtime's onConnectionStateChange handler fires.
   A 1.5-second timer starts. If state transitions to 'connected'
   within 1.5s, no badge is shown (transient blip, not surfaced).

3. If the timer fires and state is still 'reconnecting' or 'polling':
   → ReconnectingBadge renders:
     - Placement: top-center of the fullscreen view, below the
       64px action bar, anchored to top: 72px (action bar + 8px gap).
     - Appears with animate-slide-down (200ms ease-out).
     - Copy: "Reconnecting…"
     - Style: pill badge (rounded-full), graphite-800 background,
       white text, LoaderCircle icon (lucide, 14px, animate-spin).

4. LiveCursorsLayer stops updating (no broadcasts received).
   Other users' cursors fade out on their natural 5s inactivity timer.
   ProjectPresenceStack shows last known state (may be stale, no
   badge or asterisk — presence staleness is acceptable in this
   brief window, it's not dangerous information).

RECONNECT:
5. ScopedRealtimeManager transitions to connectionState = 'connected'.
   useProjectRealtime fires.

6. ReconnectingBadge:
   a. Immediately dismisses (slides up, 150ms ease-in).
   b. Simultaneously a recovery toast appears:
      "Back online. Synced."
      Style: success toast — emerald-600 background, white text,
      CheckCircle icon (lucide, 14px). Bottom-right corner, matching
      the existing notification z-index (400). Auto-dismisses after
      3 seconds (no manual dismiss needed — message is informational).

7. Presence re-subscribes. ProjectPresenceStack may briefly flash
   as the participant list reconciles (avatars could disappear and
   reappear). This is expected and acceptable — the "Synced." copy
   sets the expectation that the state is fresh.

POLLING FALLBACK (after MAX_RECONNECT_ATTEMPTS = 5):
8. If connectionState = 'polling':
   → ReconnectingBadge copy changes to: "Working offline. Some
     updates may be delayed."
   → LoaderCircle icon stops spinning (WifiOff icon, lucide, 14px).
   → Badge persists until connectionState returns to 'connected'.
   → LiveCursorsLayer is effectively offline (no broadcasts, cursors
     fade out). ProjectPresenceStack shows only self.
   → No recovery toast when polling → connected transition happens
     (the "Synced." toast is reserved for reconnect after transient
     disconnect, not long-term polling recovery — where a full
     page refresh is more reliable). This is OQ-4 for Cal.
```

---

## 2. Component Designs

### 2a. ProjectPresenceStack

**Purpose:** Compact avatar stack showing which users are currently viewing the same project matrix. Powered by Supabase Presence via `ScopedRealtimeManager` in project scope. Mirrors `SessionPresenceStack` closely with two intentional differentiations (see below).

**Relationship to SessionPresenceStack:**

`ProjectPresenceStack` mirrors `SessionPresenceStack` in avatar size, HSL hash algorithm, self-first ordering rule, overflow chip, and ARIA live region pattern. Two deliberate differences signal "matrix scope, not session scope":

1. **No ring differentiation for self in the stack itself** — The session stack uses a sapphire-400 ring on the self-avatar to distinguish self from peers. In the matrix context, the action bar already has a strong visual identity (project name, exit button), so the sapphire ring on the self-avatar is retained, but the tooltip copy differs: "You (viewing this matrix)" vs. the session's "You — in this session". This subtle copy difference is meaningful for users who are simultaneously in a session and on the matrix.

2. **Label on the group container** — The session presence stack's `aria-label` says "Session participants: N online". The project presence stack's `aria-label` says "Matrix viewers: N online". This surfaces the scope distinction in the accessibility tree, which matters if both stacks are ever simultaneously visible (not expected in MVP, but defensively correct).

**Props:**
```
{
  scope: { type: 'project'; id: string }
  currentUserId: string
  currentUserDisplayName: string
  manager?: ScopedRealtimeManager
  className?: string
}
```

**States:**

| State | Visual |
|-------|--------|
| 1 user (self only) | Single self-avatar, sapphire-400 ring |
| 2–5 users | Full avatar stack, all visible |
| 6+ users | First 4 non-self avatars + self + overflow chip "+N" |
| User joining | New avatar slides in (translateX + opacity, 200ms) at right end |
| User leaving | Avatar fades + slides out (200ms), overflow chip adjusts |
| Loading / initial subscribe | 2 skeleton circles (same 28px size, animate-shimmer) while presence handshake completes |
| Disconnected (polling) | Self-avatar only; all other avatars removed silently |

**Avatar design (identical to SessionPresenceStack):**
- Diameter: 28px (`w-7 h-7`) desktop, 24px (`w-6 h-6`) at `< sm` breakpoint.
- Shape: `rounded-full`.
- Content: uppercase initials (1–2 chars), `text-xs font-semibold text-white`.
- Background: `hsl((hash(userId) % 360), 55%, 65%)` — same HSL algorithm as SessionPresenceStack (shared utility function from 05.4a, no duplication).
- Self ring: `ring-2 ring-white ring-sapphire-400` (sapphire outer ring with white gap).
- Others ring: `ring-2 ring-white`.
- Negative margin: `-ml-2` on all except first.
- Tooltip: `title` attribute with `"{displayName} — viewing this matrix"` / `"You (viewing this matrix)"`.
- Order: self first (leftmost), then other participants sorted by `joinedAt` ascending.

**Overflow chip:**
- Appears when total participants > 5.
- Shows count of hidden participants: `+N`.
- Style: `w-7 h-7 rounded-full bg-graphite-200 text-graphite-700 text-xs font-semibold flex items-center justify-center -ml-2 ring-2 ring-white`.
- `title`: "{N} more users viewing this matrix".
- `aria-label`: "{N} more users viewing this matrix".

**Placement:**

The `ProjectPresenceStack` mounts in the `MatrixFullScreenView` action bar, aligned to the right side, left of any session-scope controls that may be present. The action bar is 64px tall.

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Exit    [Project Name]     [+ New]  [AI]  [●●●+2]  [ReconnectBadge?]
│            action bar                  ──────────────
│                                        ProjectPresenceStack (right-aligned)
└────────────────────────────────────────────────────────────────────┘
```

The stack sits at `flex items-center gap-3` inline with the right-side action bar controls. On viewports narrower than 768px, the presence stack collapses to showing only the self-avatar (overflow all others into "+N") to preserve action bar space.

**Touch target:** Avatars are informational-only in MVP (no click action). No 44px target required. They do carry `aria-label` and `title` for AT users.

**Accessibility:**
- Container: `role="group"`, `aria-label="Matrix viewers: {N} online"`.
- Each avatar: `role="img"`, `aria-label="{displayName} — viewing this matrix"` / `"You (viewing this matrix)"`.
- Overflow chip: `aria-label="{N} more users viewing this matrix"`.
- `aria-live="polite"` region (separate `<p className="sr-only">` at root of fullscreen container, never inside the stack): announces "{Name} joined the matrix." / "{Name} left the matrix."
- Join/leave announcements are debounced at 300ms — if 3 users join in a burst, one announcement fires: "{Name}, {Name}, and {Name} joined the matrix."

**Animation specs:**
- Join: `animate-slide-right` (translateX(-10px) → (0), opacity 0 → 1, 200ms ease-out). Disabled under `prefers-reduced-motion` (instant appear).
- Leave: `opacity 1 → 0, translateX(-8px)`, 200ms ease-in. Disabled under `prefers-reduced-motion` (instant disappear).
- Overflow chip appear: `animate-scale-in` (scale 0.9 → 1, opacity 0 → 1, 120ms ease-out). Disabled under `prefers-reduced-motion`.

---

### 2b. LiveCursorsLayer

**Purpose:** An absolutely-positioned overlay on the matrix canvas area that renders labeled cursor markers for all other users currently viewing the matrix. Does not capture pointer events from the user.

**What it is NOT:** This is not a conflict with the native cursor. The current user's own cursor is their native OS cursor. `LiveCursorsLayer` only renders OTHER users' cursors.

**Props (consumed from useLiveCursors hook):**
```
{
  cursors: Map<userId, {
    x: number          // 0–100% of canvas width
    y: number          // 0–100% of canvas height
    displayName: string
    color: string      // pre-computed HSL string from userId hash
    lastSeenAt: number // timestamp, for fade-out logic
  }>
  lockedUserIds: Set<string>  // users in an active drag — no cursor shown
}
```

**Layer positioning:**

`LiveCursorsLayer` is a sibling of `DesignMatrix` inside the `DndContext` render area, absolutely positioned to cover the full canvas below the action bar.

```
┌──────────────────────────────────────────────┐
│  Action bar (z-index: 25, pointer-events)    │
├──────────────────────────────────────────────┤
│  Matrix canvas area (position: relative)     │
│  ┌────────────────────────────────────────┐  │
│  │  DesignMatrix (z-index: 1)             │  │
│  ├────────────────────────────────────────┤  │
│  │  LiveCursorsLayer (z-index: 15)        │  │  ← above cards, below DragOverlay
│  │  pointer-events: none                  │  │
│  ├────────────────────────────────────────┤  │
│  │  DragOverlay (z-index: 25)             │  │  ← dnd-kit manages this
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

`LiveCursorsLayer` has `pointer-events: none` on the entire layer and all children. It must never intercept clicks, drags, or hovers. Z-index 15 places it above idea cards (z-index 1 via stacking context in DesignMatrix) but below `DragOverlay` and the action bar.

**Cursor visual — labeled pointer style:**

Each cursor is composed of:

1. An SVG arrow pointer (14×20px) colored in the user's HSL color, with a 1.5px white stroke for legibility on any background.
2. A name pill immediately to the right and slightly below the pointer tip: `px-2 py-0.5 rounded-full text-xs font-semibold text-white`, background the same HSL color, `max-width: 120px`, text-overflow ellipsis. Minimum readable width 48px.

```
  ↖ [pointer SVG]
       [  {Name}  ]
```

The pill sits at `translate(12px, 6px)` relative to the pointer tip so the tip points accurately at the user's coordinate without the label overlapping the coordinate point.

**Cursor color:** Per-user HSL hash — `hsl((hash(userId) % 360), 55%, 65%)` — same algorithm as the presence stack avatar background. This creates visual identity consistency: the avatar's background and the user's cursor color always match.

**Throttle rate:** Broadcasts at a maximum of 20fps (one event per 50ms). The hook samples `pointermove` events on every frame but gates emission with a 50ms minimum interval check. This balances perceived smoothness (cursors feel live) against channel saturation (20 users × 20fps = 400 events/second worst case, which Supabase broadcast handles). The threshold distance check (≥2px movement) further reduces noise.

**Cursor position interpolation:** Receiving clients apply a CSS `transition: transform 80ms ease-out` on each cursor element. This provides smooth movement between discrete broadcast positions without requiring interpolation logic in JavaScript. The 80ms transition is intentionally shorter than the 50ms broadcast interval — it completes before the next broadcast arrives, avoiding visual lag accumulation.

**Fade-out behavior:**
- When a user stops moving their cursor (no broadcast received for 5 seconds), the cursor fades out: `opacity 1 → 0`, 400ms ease-in-out, using a `setTimeout` cleanup.
- The DOM node is removed after the fade completes (400ms after the opacity transition begins).
- When the user moves again, the cursor re-appears at the new position with a 150ms fade-in. It does NOT slide in from off-screen — it appears at the correct new position immediately.

**Out-of-viewport cursors:** No edge indicators. If a user's cursor is off the visible canvas (scrolled or zoomed out of view), their cursor simply is not visible. Edge indicators add implementation complexity for marginal UX benefit in a fixed-viewport fullscreen view. (This is a downgrade candidate if user feedback requests it — capture as OQ-3.)

**Self cursor:** Not rendered. The hook identifies the current userId and excludes it from the cursors Map before passing to the layer.

**Too-many-cursors degradation:**

When `cursors.size > 8` (9 or more other users simultaneously moving):
- Cursors beyond the 8 most recently active are suppressed (not rendered).
- "Most recently active" is determined by `lastSeenAt` timestamp.
- The 8 cap is applied client-side in the hook before rendering. No visual indicator of suppression is shown (a user seeing 8 live cursors is already at the attention limit — telling them there are more would add no actionable information).
- The presence stack avatar count accurately reflects all users regardless of cursor cap.

**Reduced-motion behavior:**
- CSS `transition: transform 80ms ease-out` on cursor position: replaced with `transition: none`. Cursors teleport to new positions instead of gliding.
- Fade-in / fade-out: replaced with instant `opacity: 0` / `opacity: 1`.
- The cursor label and pointer SVG remain visible — only motion is removed, not the cursors themselves.

**Accessibility:** `LiveCursorsLayer` has `aria-hidden="true"` on the entire container. Cursor positions of other users are conveyed through the presence stack and drag lock announcements — there is no meaningful way to narrate cursor position to a screen reader user in a spatial context, and attempting to do so would create announcement spam.

---

### 2c. LockedCardOverlay

**Purpose:** Visual indicator applied to an idea card that another user is currently dragging. Prevents local interaction on the card and communicates who holds the lock.

**Positioning:** `LockedCardOverlay` is rendered as a child inside the same absolutely-positioned wrapper `<div>` in `DesignMatrix` that contains the idea card (the wrapper at lines 411–444 of DesignMatrix.tsx). The overlay is `position: absolute; inset: 0` within that wrapper, sitting above the `OptimizedIdeaCard` content in z-order.

```
[Idea card wrapper — position: absolute at x%, y%]
  ├── OptimizedIdeaCard (z-index: auto, pointer-events: none while locked)
  └── LockedCardOverlay (position: absolute; inset: 0; z-index: 5)
       ├── sapphire-300 ring border
       ├── white tint overlay (10% opacity)
       └── lock badge (top-right corner)
```

**Visual signal:**

Three simultaneous signals communicate the locked state:
1. **Border ring:** `ring-2 ring-sapphire-300` on the card wrapper. The sapphire ring is consistent with the sapphire-500 primary brand color, signaling an active/owned state without using red (which reads as error) or green (which reads as success).
2. **White tint:** A `bg-white/10` (10% white) overlay that slightly dims the card content. Subtle enough to read the idea text, strong enough to indicate "not yours to interact with right now."
3. **Lock badge:** A small pill at the top-right corner of the card: `Lock` icon (lucide, 12px) + "{Name} is moving this". Badge style: `bg-sapphire-50 text-sapphire-700 text-xs font-medium px-2 py-0.5 rounded-full border border-sapphire-200`.

```
┌────────────────────────────────────────────────┐
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ [● Mia is moving this]       │
│                                                │
│  Idea content text here (slightly dimmed)      │
│                                                │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
└────────────────────────────────────────────────┘
sapphire-300 ring border; white/10 tint over content
```

**Copy:** `"{displayName} is moving this"` — limited to 18 characters of display name before truncation with ellipsis to prevent badge overflow on narrow cards.

**Lock duration after drop:** The overlay dismisses with a 150ms fade-out starting on receipt of the `drag_release` broadcast — not on receipt of the postgres_changes position update. This means the card briefly unlocks before its position visually settles. This sequencing is intentional: the card should feel released (unlocked) as soon as the user drops it, not after the network round-trip.

**Pointer events:** The underlying `OptimizedIdeaCard` in the locked wrapper has `pointer-events: none` applied while the overlay is present. The overlay itself is also `pointer-events: none` — it is purely visual. This prevents editing, drag-initiating, or deleting a card that someone else is moving. After the overlay fades, `pointer-events` is restored to `auto`.

**Race condition — double-grab:**

If two users nearly simultaneously grab the same card, the `useDragLock` hook on each client applies a first-broadcast-wins rule:
- The first 'drag_lock' broadcast for a given ideaId sets the lock and populates the `lockedCards` map.
- A second 'drag_lock' broadcast for the same ideaId while the card is already locked is ignored (no update to the lock holder).
- On the late-arriving user's own screen: their drag still initiates locally (DndContext fired), but they see the `LockedCardOverlay` appear on the card they are dragging. The overlay badge reads the first-broadcaster's name.
- Cal must specify in the ADR whether the late dragger's local drag should be cancelled programmatically (via a DndContext cancel call) or allowed to complete with the optimistic update winning. This is OQ-1.

**Lock timeout:** If a 'drag_release' broadcast never arrives (network drop mid-drag, browser close during drag), the lock automatically expires after 8 seconds. After 8 seconds with no 'drag_release', the `useDragLock` hook removes the lock entry, the overlay fades out, and no toast is shown. 8 seconds is long enough to cover a slow drop + DB write cycle but short enough to not leave cards visually stuck.

**Screen reader announcement:**
- When a card becomes locked: the matrix-level `aria-live="polite"` region announces: "{Name} is moving the card '{ideaTitle}'. It will be available again shortly."
- When the card unlocks: "{ideaTitle} is available."
- If the ideaTitle is longer than 40 characters: truncate to 37 + "…" in the announcement.
- These announcements are rate-limited — if 3+ cards lock simultaneously (bulk operation scenario), announce only the first: "{Name} is moving multiple cards."

**Reduced-motion:** The ring and tint are static (no pulse animation). The lock badge appears/disappears with instant opacity change instead of fade. The overlay dismiss uses instant opacity instead of 150ms fade.

**Touch target:** The overlay has no interactive elements. No 44px requirement applies.

---

### 2d. ReconnectingBadge

**Purpose:** Status indicator surfaced after 1.5 seconds of confirmed connection loss. Communicates "you are disconnected" during reconnect and auto-dismisses with a recovery toast when connection is restored.

**Disconnect threshold:** 1.5 seconds — confirmed per brief. The timer starts when `onConnectionStateChange` fires with `'reconnecting'` or `'polling'`. If `'connected'` is restored within 1.5s, the badge is never shown (silent recovery for transient blips).

**Placement:** Top-center of the fullscreen view, below the action bar. Specifically: `position: fixed; top: 72px; left: 50%; transform: translateX(-50%); z-index: 55`. This places it 64px (action bar) + 8px (gap) from the top of the viewport, horizontally centered. It floats above the matrix canvas and does not shift any layout.

The top-center placement was chosen over corner placement for two reasons:
1. The action bar's right side is occupied by `ProjectPresenceStack` and action buttons — a corner badge would compete with those controls.
2. Top-center is a well-established pattern for connection status indicators (Notion, Figma, Linear) and reads as "this is about the whole page, not a specific element."

**Visual design:**

```
┌──────────────────────────────────────────┐
│  ⟳  Reconnecting…                        │   ← disconnecting state
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  ⊘  Working offline. Updates may be     │   ← polling fallback state
│     delayed.                             │
└──────────────────────────────────────────┘
```

Badge container: `inline-flex items-center gap-2 px-4 py-2 rounded-full bg-graphite-800 text-white text-sm font-medium shadow-modal-lux`.

Reconnecting state icon: `LoaderCircle` (lucide, 14px, `animate-spin`).
Polling state icon: `WifiOff` (lucide, 14px, no animation).

**Appear animation:** `animate-slide-down` (translateY(-8px) → (0), opacity 0 → 1, 200ms ease-out). Disabled under `prefers-reduced-motion` (instant appear).

**Dismiss animation (on reconnect):** `opacity 1 → 0, translateY(-8px)`, 150ms ease-in. Disabled under `prefers-reduced-motion` (instant disappear).

**Copy — disconnected:** "Reconnecting…"
**Copy — polling fallback:** "Working offline. Updates may be delayed."

**Recovery toast:**

Appears simultaneously with the badge dismissal on `'connected'` state after a 'reconnecting' episode.

- Position: bottom-right corner of the viewport (`position: fixed; bottom: 24px; right: 24px; z-index: 400`). Matches existing `notification` z-index token.
- Style: `inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 text-white text-sm font-medium shadow-modal-lux`.
- Icon: `CheckCircle` (lucide, 16px).
- Copy: "Back online. Synced." — exact copy from brief, not modifiable.
- Auto-dismiss: 3 seconds. No manual dismiss affordance (informational-only, no action needed).
- Toast enter: `animate-slide-up` (translateY(8px) → (0), opacity 0 → 1, 200ms ease-out). Disabled under `prefers-reduced-motion`.
- Toast exit: `opacity 1 → 0`, 150ms ease-in. Disabled under `prefers-reduced-motion`.

**Accessibility:**
- Badge container: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`.
- Copy renders inside the `role="status"` region so screen readers announce on badge appear and copy change.
- `aria-live="polite"` is correct: the connection status is important but not so urgent that it should interrupt an in-progress screen reader announcement (which `"assertive"` would do). Connection loss is not an error requiring immediate interruption — the user can still read and navigate. When the badge appears, the screen reader will announce it at the next natural pause.
- Recovery toast: also `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. The copy "Back online. Synced." is self-explanatory without additional context.
- Both the badge and toast must not auto-focus. They are status announcements, not dialogs.

---

## 3. Interaction Patterns

### Cursor Broadcast Throttle

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Broadcast rate cap | 50ms (20fps) | Smooth without flooding at scale |
| Movement threshold | ≥2px in x or y | Eliminates micro-jitter from trackpads |
| Paused during drag | Yes | Prevents dual-signal confusion with drag lock |
| Paused during modal open | Yes | Modal covers the matrix; cursor position is irrelevant |
| Position encoding | % of container (0–100) | Resolution-independent; survives zoom level changes |

### Cursor Rendering (receiver side)

| Parameter | Value |
|-----------|-------|
| CSS transition on cursor element | 80ms ease-out |
| Inactivity fade delay | 5 seconds |
| Fade duration | 400ms ease-in-out |
| Fade re-appear (on movement resumption) | 150ms ease-in opacity |
| Maximum rendered cursors | 8 (most recently active) |
| Cursor element removal after fade | 400ms after fade start |

### Drag Lock

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Lock broadcast event | 'drag_lock', fires once on onDragStart | State event, not position event |
| Release broadcast event | 'drag_release', fires once on onDragEnd | Before DB write completes |
| Overlay appear | Immediate on 'drag_lock' receipt | No animation delay — urgency |
| Overlay dismiss | 150ms fade-out on 'drag_release' receipt | Smooth unlocking feeling |
| Lock timeout (no release broadcast) | 8 seconds | Covers slow drops; prevents permanent visual stuck |
| Double-grab handling | First-broadcast-wins; second ignored | Architectural decision — see OQ-1 |

### Reconnect Badge

| Parameter | Value |
|-----------|-------|
| Disconnect threshold before badge | 1.5 seconds |
| Badge appear animation | 200ms slide-down |
| Badge dismiss animation | 150ms fade + slide-up |
| Recovery toast duration | 3 seconds auto-dismiss |
| Toast appear animation | 200ms slide-up |
| Toast exit animation | 150ms fade-out |

### Card Position Update (after drop)

| Parameter | Value |
|-----------|-------|
| Expected latency (postgres_changes) | 100–400ms after drag_release broadcast |
| Card position animate-to | CSS transition 200ms ease-out on left/top |
| Polling fallback interval | To be decided by Cal (OQ-2) |

---

## 4. Error and Degraded States

### 4a. Connection Lost — ReconnectingBadge

**Trigger:** `connectionState` transitions to `'reconnecting'` and remains so for 1.5+ seconds.

**Visual:** ReconnectingBadge appears (top-center, graphite-800 pill, "Reconnecting…", spinner icon).

**Effect on other components:**
- `ProjectPresenceStack`: Shows last known participant list (stale but not cleared — brief disconnects shouldn't cause avatar flutter).
- `LiveCursorsLayer`: No new cursor broadcasts received; existing cursors fade on their 5s inactivity timers naturally.
- `LockedCardOverlay`: Any existing locks persist visually until the 8s timeout. New lock broadcasts will not arrive, so no new locks appear during disconnect.

**Recovery:** Badge dismisses, "Back online. Synced." toast appears, presence re-subscribes.

---

### 4b. Connection Lost — Polling Fallback

**Trigger:** `connectionState` transitions to `'polling'` (after MAX_RECONNECT_ATTEMPTS = 5 failures).

**Visual:** ReconnectingBadge copy updates to "Working offline. Updates may be delayed." Spinner replaced with WifiOff icon.

**Effect on other components:**
- `ProjectPresenceStack`: Only self-avatar visible (presence subscription is offline). No join/leave announcements.
- `LiveCursorsLayer`: All cursors fade out (no broadcasts). Layer renders empty.
- `LockedCardOverlay`: Any existing locks expire via 8s timeout. No new locks appear.

**Polling behavior:** `useProjectRealtime` uses `onPollingTick` to fetch idea updates from the DB on a polling interval. The matrix will reflect new idea positions (from other users' drops) on the polling interval, not in real-time.

**No automatic recovery toast for polling → connected.** See §1e step 8 and OQ-4.

---

### 4c. Too Many Cursors

**Trigger:** `cursors.size > 8`.

**Visual:** The 9th+ cursor (by `lastSeenAt` recency, least recent suppressed) simply is not rendered. No message, no indicator. The `ProjectPresenceStack` avatar count accurately reflects all users.

**Rationale:** 8 cursors simultaneously moving is already at the cognitive boundary. Indicating that "more cursors are hidden" adds visual noise for no actionable gain.

---

### 4d. Race Condition — Double Card Grab

**Trigger:** Two users initiate a drag on the same card within a single broadcast RTT window (~100ms).

**What user A sees (first broadcaster, lock winner):**
- Normal drag experience. DragOverlay renders. Their lock broadcast wins.
- User B's lock broadcast arrives and is ignored (card already locked by A).

**What user B sees (late broadcaster, lock loser):**
- DndContext fires locally (drag begins on B's device).
- B's 'drag_lock' broadcast goes out but arrives after A's lock is already registered.
- B's own 'drag_lock' broadcast returns (broadcast: self=true in ScopedRealtimeManager config) and is ignored because the card is already locked by A.
- Simultaneously: A's 'drag_lock' broadcast arrives at B. B sees LockedCardOverlay for A appear on the card they are currently dragging.
- B is now in an ambiguous state: their DragOverlay is live, but the card shows a lock for someone else.

**Resolution UX for user B (OQ-1 governs the architectural path — see §7):**
- Design intent: user B's drag should be cancelled (DndContext cancelDrop or equivalent) when the lock overlay appears on the card they are holding.
- Visual: B's DragOverlay snaps back (existing DragOverlay drop animation — 200ms ease). The LockedCardOverlay on the card shows A's name.
- No error message shown to B. The visual is self-explanatory: someone else got there first.
- aria-live region announces: "{Name} is moving this card. Your drag was cancelled."

---

### 4e. Lock Timeout (No Release Broadcast)

**Trigger:** A 'drag_lock' broadcast was received but no 'drag_release' arrives within 8 seconds (dragging user disconnected, crashed, or network dropped during drag).

**Visual:** `LockedCardOverlay` fades out (150ms) after 8s. No toast. Card returns to normal interaction state.

**Accessibility:** aria-live region announces: "{ideaTitle} is available." (same copy as normal unlock).

**Rationale for 8 seconds:** The ScopedRealtimeManager reconnect backoff goes up to 16s (5 attempts: 1s, 2s, 4s, 8s, 16s). A lock timeout of 8s coincides with the 4th reconnect attempt window — long enough that a reconnecting user A might successfully reconnect and send the release; short enough that user B is not blocked for the full max backoff.

---

## 5. Accessibility

### Keyboard Navigation

The keyboard flow for a user on the project matrix view with realtime features active:

```
Tab → action bar (Exit button, Add button, AI button)
Tab → ProjectPresenceStack (group, no interactive children in MVP)
Tab → matrix canvas area (useDrop target)
  ↓
  Each idea card is reachable via Tab. Cards follow DOM order
  (rendered in ideas array order, which correlates with position).

  If a card has LockedCardOverlay:
    → Card is NOT skipped from Tab order (user should be able to
      navigate to it to hear the locked state announcement).
    → When card receives focus: aria-describedby links to a hidden
      span: "Currently locked — {displayName} is moving this card."
    → No interactive actions (edit, delete) are available while locked.
      If user presses Enter/Space on the locked card: no action fires.
      The describedby text is sufficient.

Tab → ReconnectingBadge (if visible) — badge has role="status",
      not an interactive element; it receives natural focus only via
      Tab flow if positioned in the DOM before the matrix, which it
      is NOT (it is position: fixed). Screen readers announce it via
      the aria-live region without needing Tab focus.
Escape → exits fullscreen view (existing MatrixFullScreenView keyboard shortcut)
```

**Focus ring:** `focus-visible:ring-2 focus-visible:ring-sapphire-500 focus-visible:ring-offset-2` on all interactive elements. Matches `component.focus` token (sapphire-500, #3B82F6).

---

### ARIA Live Regions

Four live regions in the fullscreen matrix view, placed at the root of the fullscreen container (NOT inside any component that might unmount):

```html
<!-- Project presence join/leave (polite) -->
<p
  id="project-presence-live"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
/>

<!-- Drag lock / unlock (polite) -->
<p
  id="drag-lock-live"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
/>

<!-- Reconnect status (polite) -->
<p
  id="reconnect-status-live"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
/>

<!-- Recovery toast mirror (polite) — mirrors the visual toast for AT users
     who may not see the bottom-right corner notification -->
<p
  id="recovery-toast-live"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
/>
```

**Content rules:**

`project-presence-live`:
- On join: "{Name} joined the matrix." (single user) / "{Name}, {Name}, and N others joined the matrix." (burst debounce 300ms)
- On leave: "{Name} left the matrix."
- On self-join with others present: "You joined. {N} others are viewing this matrix."

`drag-lock-live`:
- On card lock: "{Name} is moving the card '{ideaTitle}'. It will be available again shortly."
- On card unlock (release or timeout): "'{ideaTitle}' is available."
- On double-grab cancel (user B): "{Name} is moving this card. Your drag was cancelled."
- On 3+ simultaneous locks: "{Name} is moving multiple cards."
- Rate-limited: one announcement per 500ms. Concurrent events queue and debounce.

`reconnect-status-live`:
- On badge appear (reconnecting): "Connection lost. Reconnecting…"
- On badge copy change (polling): "Working offline. Updates may be delayed."
- On badge dismiss (connected): (cleared — no content, recovery is announced by recovery-toast-live)

`recovery-toast-live`:
- On recovery: "Back online. Synced."

**Rate-limit rules:**
- `project-presence-live`: max 1 update per 300ms.
- `drag-lock-live`: max 1 update per 500ms.
- `reconnect-status-live`: no rate limit (state changes are rare).
- `recovery-toast-live`: no rate limit (fires at most once per reconnect cycle).

---

### Screen Reader Announcements — State Table

| Event | Region | Copy |
|-------|--------|------|
| User joins matrix | project-presence-live | "{Name} joined the matrix." |
| User leaves matrix | project-presence-live | "{Name} left the matrix." |
| Self joins with others | project-presence-live | "You joined. {N} others are viewing this matrix." |
| Card locked | drag-lock-live | "{Name} is moving '{ideaTitle}'. It will be available shortly." |
| Card unlocked (normal) | drag-lock-live | "'{ideaTitle}' is available." |
| Card unlocked (timeout) | drag-lock-live | "'{ideaTitle}' is available." |
| Double-grab cancel | drag-lock-live | "{Name} is moving this card. Your drag was cancelled." |
| Disconnect badge appears | reconnect-status-live | "Connection lost. Reconnecting…" |
| Disconnect → polling | reconnect-status-live | "Working offline. Updates may be delayed." |
| Reconnected | recovery-toast-live | "Back online. Synced." |
| Card focused while locked | aria-describedby on card | "Currently locked — {displayName} is moving this card." |

---

### Color Is Not the Sole Indicator

- `ProjectPresenceStack` avatars use initials + aria-label (color is identity cue only).
- `LockedCardOverlay` uses sapphire ring + white tint + text lock badge (color is not sole signal; the badge text names who holds the lock).
- `ReconnectingBadge` uses icon + text (not color alone).
- `LiveCursorsLayer` cursors use a name pill + pointer shape (color alone identifies the user but does not convey actionable state; the lock badge does that).

---

## 6. Design Tokens

### Colors

| Token | Tailwind class | Hex | Usage |
|-------|---------------|-----|-------|
| sapphire-500 | `ring-sapphire-500` | #3B82F6 | Self-avatar ring, focus rings |
| sapphire-400 | `ring-sapphire-400` | #60A5FA | Self-avatar ring (softer accent, matched to 05.4a) |
| sapphire-300 | `ring-sapphire-300` | #93C5FD | LockedCardOverlay border ring |
| sapphire-200 | `border-sapphire-200` | #BFDBFE | Lock badge border |
| sapphire-100 | `bg-sapphire-100` | #DBEAFE | Lock badge — NOT used (sapphire-50 preferred) |
| sapphire-50 | `bg-sapphire-50` | #EFF6FF | Lock badge background |
| sapphire-700 | `text-sapphire-700` | #1D4ED8 | Lock badge text |
| graphite-800 | `bg-graphite-800` | #1F2937 | ReconnectingBadge background |
| graphite-200 | `bg-graphite-200` | #E5E7EB | Avatar overflow chip background |
| graphite-700 | `text-graphite-700` | #374151 | Avatar overflow chip text |
| emerald-600 | `bg-emerald-600` | #059669 | Recovery toast background |
| white | `text-white` | #FFFFFF | Badge text, toast text, avatar initials |
| white/10 | `bg-white/10` | rgba(255,255,255,0.10) | LockedCardOverlay tint |
| Per-user HSL | inline style | computed | Avatar bg, cursor color (same algorithm) |

### Per-User Color Algorithm

```
function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  }
  return hash
}

function userIdToHsl(userId: string): string {
  const hue = hashString(userId) % 360
  return `hsl(${hue}, 55%, 65%)`
}
```

This function is already implemented in `SessionPresenceStack.tsx` (Phase 05.4a). It must be extracted to a shared utility (e.g., `src/utils/userColor.ts`) so `ProjectPresenceStack` and `useLiveCursors` both import from the same source without duplication.

### Spacing

| Usage | Token | Value |
|-------|-------|-------|
| Avatar overlap | `-ml-2` | -8px |
| Avatar diameter (desktop) | `w-7 h-7` | 28px |
| Avatar diameter (mobile) | `w-6 h-6` | 24px |
| Lock badge padding | `px-2 py-0.5` | 8px / 2px |
| ReconnectingBadge padding | `px-4 py-2` | 16px / 8px |
| Recovery toast padding | `px-4 py-3` | 16px / 12px |
| Badge from top of viewport | 72px | 64px action bar + 8px gap |
| Recovery toast from bottom | 24px | bottom-6 |
| Recovery toast from right | 24px | right-6 |
| Cursor name pill padding | `px-2 py-0.5` | 8px / 2px |

### Z-Index Stack

| Layer | z-index token | Value | Notes |
|-------|--------------|-------|-------|
| Idea cards | (stacking context default) | 1 | Inside DesignMatrix |
| LockedCardOverlay | `z-5` | 5 | Inside card wrapper, above card content |
| LiveCursorsLayer | `z-15` | 15 | Sibling of DesignMatrix, above cards |
| DragOverlay | dnd-kit internal | ~25 | Managed by @dnd-kit |
| Action bar | `z-25` | 25 | MatrixFullScreenView header |
| ReconnectingBadge | `z-55` | 55 | Above action bar (connection status is global) |
| Recovery toast | `notification` (400) | 400 | Matches existing notification system |

### Motion Durations

| Animation | Duration | Easing | Reduced-motion |
|-----------|----------|--------|----------------|
| Avatar join slide-in | 200ms | ease-out | instant appear |
| Avatar leave fade+slide | 200ms | ease-in | instant disappear |
| Overflow chip appear | 120ms scale-in | ease-out | instant |
| Cursor position CSS transition | 80ms | ease-out | removed (transform: none) |
| Cursor fade-out (inactivity) | 400ms | ease-in-out | instant opacity 0 |
| Cursor re-appear | 150ms | ease-in | instant opacity 1 |
| LockedCardOverlay appear | instant | — | instant |
| LockedCardOverlay dismiss | 150ms | ease-in | instant |
| ReconnectingBadge appear | 200ms slide-down | ease-out | instant |
| ReconnectingBadge dismiss | 150ms | ease-in | instant |
| Recovery toast appear | 200ms slide-up | ease-out | instant |
| Recovery toast dismiss | 150ms | ease-in | instant |
| Card position update (drop) | 200ms | ease-out | instant position |

### New Keyframes Required

The following keyframe additions are needed in `tailwind.config.js` for this phase. The `animate-slide-down` keyframe does not yet exist (05.4a added `slide-right`; `slide-down` is in the config but moves Y from -10px → 0, which is appropriate for the badge appearing from above the action bar).

Verify `slideDown` keyframe exists: it does (tailwind.config.js line 374). No new keyframes required — all animations compose from existing tokens.

---

## 7. Open Questions for Cal

**OQ-1: Double-grab architectural resolution**

When user B initiates a drag that arrives as the second 'drag_lock' broadcast for a card already locked by user A, should user B's local DndContext drag be programmatically cancelled? `@dnd-kit` does not expose a public `cancelDrag()` imperative API in the DndContext. Options include: (a) not cancelling — let user B's drag proceed but ignore the drop (no broadcast, no DB write), (b) cancelling via `onDragCancel` callback by setting a ref that short-circuits `handleDragEndWrapper`, (c) preventing the drag from starting if the card is already in `lockedCards` (check in `onDragStart` before firing the lock broadcast). Option (c) is the cleanest UX — the drag never starts. Cal must determine if `onDragStart` has enough information to check the locked state synchronously. This is the most critical architectural decision in the drag lock design.

**OQ-2: Polling fallback interval for idea position updates**

When `connectionState = 'polling'`, `useProjectRealtime` should use `onPollingTick` to fetch current idea positions. What interval? The existing `BrainstormRealtimeManager` uses 4s for polling. For the matrix (lower write frequency than brainstorm), 10s may be appropriate to reduce DB load. Cal to decide.

**OQ-3: Edge indicators for off-screen cursors**

This doc specifies no edge indicators when a user's cursor is outside the visible canvas area (zoomed or panned out of view). If user research or stakeholder feedback indicates this is a navigation problem, edge indicators (small colored arrows at viewport edges) could be added as a future iteration. Cal should note this as a deferred enhancement if the ADR scope is tight.

**OQ-4: Recovery toast on polling → connected transition**

Section 1e specifies no recovery toast when the state goes from `'polling'` to `'connected'` (only for `'reconnecting'` → `'connected'`). The rationale: polling is a long-term degraded state where "Back online. Synced." may overstate confidence (polling state could persist for minutes; the data may not be fully synced at the moment of reconnect). Cal should confirm this distinction is architecturally sound or specify a different recovery signal for the polling case.

**OQ-5: ProjectPresenceStack — shared manager vs. own instance**

`SessionPresenceStack` accepts an optional `manager?` prop (from 05.4a Wave 2 Finding 4 fix). `ProjectPresenceStack` should follow the same pattern. However, in the matrix context (no brainstorm session in scope), there is no parent that already holds a `ScopedRealtimeManager` for project scope. This means `ProjectPresenceStack` will typically create its own local manager instance. `useProjectRealtime` also creates a manager. This creates a risk of two managers subscribed to the same `project:{id}` channel. Cal must specify: (a) does `ProjectPresenceStack` receive the manager from `useProjectRealtime` via prop (clean, avoids double channel), or (b) does `ProjectPresenceStack` create its own manager independently (simpler mounting, but double channel)? D-14 from the context brief says Cal's ADR must pick one approach.

**OQ-6: LiveCursorsLayer mount point — inside or outside DndContext?**

Section 2b specifies `LiveCursorsLayer` as a sibling of `DesignMatrix` inside `DndContext`. However, `@dnd-kit`'s `DndContext` does not restrict what children can be rendered inside it — only the `useDraggable` and `useDroppable` hooks must be inside it. `LiveCursorsLayer` does not use either hook. Cal should confirm whether mounting `LiveCursorsLayer` inside `DndContext` causes any hook conflicts or interference with dnd-kit's internal event management. If yes, `LiveCursorsLayer` should mount outside `DndContext` but still inside the matrix canvas div, with coordinated positioning.

**OQ-7: Cursor coordinate system under zoom**

`DesignMatrix` applies `transform: scale(zoomLevel)` with `transformOrigin: 'center center'`. Cursor coordinates from broadcasts are % of the container element (before zoom transform). When a user is zoomed in and broadcasts their cursor position, the receiving client is at a different zoom level. The % coordinates refer to the logical container, not the visual position after CSS zoom. Cal must specify whether cursor positions are in logical space (container %) or visual space (accounting for zoom). Recommendation: logical space (container %) is simpler and the cursor visual is always in logical space too — the pointer appears at the correct logical position regardless of each user's zoom level.

---

## Definition of Done

This UX document is considered complete when:

- [x] All 5 user flows documented with explicit step-by-step descriptions
- [x] All 4 locked component names honored verbatim: `ProjectPresenceStack`, `LiveCursorsLayer`, `LockedCardOverlay`, `ReconnectingBadge`
- [x] ProjectPresenceStack differentiation from SessionPresenceStack documented (copy diff, aria-label scope, HSL algorithm shared via utility)
- [x] LiveCursorsLayer: throttle rate (20fps / 50ms), coordinate encoding (%), cursor style (labeled pointer), fade timing, z-index, too-many-cursors degradation (cap at 8)
- [x] LockedCardOverlay: three-signal visual (ring + tint + badge), copy, lock timeout (8s), race condition handling, pointer-events spec
- [x] ReconnectingBadge: 1.5s threshold, top-center placement, two-state copy (reconnecting / polling), recovery toast copy and duration
- [x] WCAG 2.1 AA: keyboard navigation flow, 4 ARIA live regions specified, screen reader copy table, color-not-sole-indicator verified
- [x] Reduced-motion behavior specified for every animated component
- [x] Design tokens mapped to existing tailwind.config.js values; new keyframes audited (none required)
- [x] Z-index stack fully specified without conflicts
- [x] 7 open questions surfaced for Cal's ADR
- [x] Visual layout sketches for each component
