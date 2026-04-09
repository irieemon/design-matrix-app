---
phase: 05.4a
feature: session-scope-voting
status: draft
author: sable-ux
created: 2026-04-09
requirements: [COLLAB-01, COLLAB-05-UI, COLLAB-06]
---

# Phase 05.4a — Session-Scope Voting: UX Design

## Overview

Dot voting lets brainstorm session participants cast up to 5 votes across session ideas, see their remaining budget at a glance, and watch tally counts update in real-time as other participants vote. Session presence (who is currently in the room) surfaces as an avatar stack in the session header — the first use of Supabase Presence API in the app.

All designs consume existing Animated Lux tokens. No new components except the three named in the locked plan: `DotVoteControls`, `DotBudgetIndicator`, and `SessionPresenceStack` (presence avatar stack for the session header, functionally equivalent to the planned `ProjectPresenceStack` but scoped to brainstorm sessions).

---

## 1. User Flows

### 1a. Casting a Vote

```
User is in an active brainstorm session, vote mode is available.

1. User sees an idea card. Below the idea text, 5 dot slots are visible.
   Empty dots are rendered as small graphite-300 circles (12px diameter).

2. User taps/clicks an empty dot slot.
   → Optimistic update fires immediately:
     - That dot fills with brand.primary (black).
     - DotBudgetIndicator in the session header increments: "2 / 5 votes used".
     - The dot's aria-pressed changes to "true".
     - An aria-live="polite" region announces: "Vote cast. 2 of 5 votes used."

3. castVote(ideaId) resolves successfully (ok: true).
   → No visible change (optimistic state was correct). Tally count on the
     idea card increments by 1 (or the realtime postgres_changes event
     delivers the increment — whichever arrives first; the hook deduplicates).

4. Other participants' sessions receive a postgres_changes INSERT event.
   → Their tally count on that idea card increments with a brief scale
     animation (see section 3 — realtime tally animation).
```

### 1b. Removing a Vote

```
1. User taps/clicks a filled dot (own vote — distinguished by filled state
   on dots the current user cast).

2. Optimistic update fires immediately:
   - That dot empties (returns to graphite-300).
   - DotBudgetIndicator decrements: "1 / 5 votes used".
   - aria-live region announces: "Vote removed. 1 of 5 votes used."

3. removeVote(ideaId) is called server-side. On success, no visible change.

4. Other participants see tally decrement with the same scale animation.
```

### 1c. Hitting the 5-Dot Budget Limit

```
1. User has cast 5 votes (votesRemaining === 0).
   → All empty dot slots across ALL idea cards show cursor: not-allowed.
   → DotBudgetIndicator reads: "5 / 5 votes used" with a subtle filled
     indicator style (all 5 dots in the indicator filled).
   → No blocking alert or modal is shown yet.

2. User taps/clicks an empty dot slot anyway.
   → No optimistic update fires (budget check runs client-side first).
   → A non-blocking inline error message appears below the idea card:
     "You've used all 5 votes. Remove one to cast another."
     (exact copy from 05-UI-SPEC.md copywriting contract)
   → Error message fades after 4 seconds (auto-dismiss).
   → aria-live="assertive" region announces the error copy immediately.

3. User removes a vote from a different idea card.
   → Budget frees up. Empty dots across all cards return to normal
     (cursor: default, hover state re-enabled).
   → If the inline error message was still visible, it dismisses early.
```

### 1d. Watching Tallies Update from Another User's Vote

```
1. Remote participant casts a vote on idea X.

2. Supabase postgres_changes INSERT event arrives on the shared brainstorm
   channel (idea_votes table, filtered by session_id).

3. useDotVoting hook updates the tallies Map for ideaId X:
   - tally increments by 1.

4. The numeric tally count on idea card X plays a brief scale animation
   (100ms, scale 1.0 → 1.12 → 1.0, ease-out) to draw attention without
   jarring the layout. The number itself updates atomically — no mid-
   animation value flicker.

5. No toast, no modal, no full re-render. The card remains in position.
   The update is perceived as a live, quiet counter tick.

Note: If the current user triggered the event (their own vote completing
server-side), the hook deduplicates via myVotes Set — no double-increment.
```

### 1e. Seeing Session Presence Update

```
JOIN:
1. A new participant opens the session URL and their browser subscribes
   to the Supabase Presence channel.

2. SessionPresenceStack receives the presence sync event.
   - A new avatar appears at the right end of the stack.
   - It slides in with a 200ms translate + fade animation.
   - If total avatars now exceeds 5, the leftmost non-self avatar
     collapses into the "+N" overflow chip (N updates).
   - An aria-live="polite" region in the session header announces:
     "{Name} joined the session."

LEAVE:
1. A participant closes their tab or navigates away. The Presence leave
   event fires (or the tab key expires within ~10 seconds).

2. Their avatar slides out and fades (200ms). The overflow chip adjusts
   if applicable.
   - aria-live region announces: "{Name} left the session."

SELF:
The current user's avatar always appears first in the stack with a
slightly larger ring (2px sapphire-500 ring vs. 2px white ring for
others). Self is never counted in the "+N" overflow.
```

---

## 2. Component Designs

### 2a. DotVoteControls

**Purpose:** Per-idea voting UI. Renders 5 interactive dot slots inline with the idea card. Lets the current user cast and remove their votes on that specific idea.

**Props (locked by 05-03 plan):**
```
{ ideaId: string; sessionId: string }
```
Reads `votesUsed`, `tallies`, `myVotes`, `castVote`, `removeVote`, `loading` from `useDotVoting` context.

**States:**

| State | Visual |
|-------|--------|
| Default — empty slot | 12×12px circle, `bg-graphite-300`, cursor: pointer |
| Default — own vote | 12×12px circle, `bg-brand-primary` (black), cursor: pointer |
| Hover — empty slot, budget available | Scale 1.15, ring: 1px sapphire-300, transition 120ms |
| Hover — own vote | Scale 1.15, ring: 1px graphite-400, transition 120ms |
| Budget-full — empty slot | `bg-graphite-200`, cursor: not-allowed, no hover scale |
| Optimistic — just cast | Snap to filled immediately (no transition delay) |
| Optimistic — just removed | Snap to empty immediately |
| Error — after budget click | Inline error copy below row, auto-dismisses 4s |
| Loading (initial reconcile) | 5 × skeleton circles (same size, `animate-shimmer`) |
| Disabled (session ended) | All dots `bg-graphite-100`, cursor: not-allowed |

**Tally counter:** A small numeric label (`text-xs`, `graphite-500`) appears to the right of the 5 dots showing the total vote count for that idea. Updates with the scale animation described in section 3.

**Layout sketch (single idea card row):**

```
┌─────────────────────────────────────────┐
│  [Idea text content]                    │
│                                         │
│  ● ● ● ○ ○   3                          │
│  ─────────── ─                          │
│  dots (12px) tally count (text-xs)      │
└─────────────────────────────────────────┘
```

Row: `flex items-center gap-1` (dot gap = 4px / xs). Tally counter: `ml-2` (8px).

**Touch target:** Each dot button is rendered as `<button>` with minimum 44×44px hit area via `p-4` padding (the circle itself is 12px; the invisible hit area extends to 44px). On mobile the dots lay out with `gap-2` (8px) to prevent adjacent-target confusion.

**Accessibility notes:**
- Each dot is a `<button>` element, never a `<div>`.
- `aria-label`: "Cast vote for [idea title]. N of 5 votes used." (filled: "Remove vote from [idea title]. N of 5 votes used.")
- `aria-pressed="true|false"` reflects own-vote state.
- `aria-disabled="true"` on empty dots when budget is full (not HTML `disabled` — keeps focus reachability for AT users who need to hear the state).
- Container has `role="group"` with `aria-label="Votes for [idea title]"`.
- Error message in `role="alert"` (assertive, auto-dismissed).

**Mobile (360×800):** Dots use `gap-2` (8px) on mobile breakpoint. Tally counter drops to the next line on very narrow viewports (`flex-wrap`). Min row height 44px.

---

### 2b. DotBudgetIndicator

**Purpose:** Always-visible vote budget chip in the session header. Shows how many of 5 votes the current user has spent. Updates in real-time as the user casts or removes votes.

**Props (locked):**
```
{ votesUsed: number; total?: number }  // total defaults to 5
```

**States:**

| State | Visual |
|-------|--------|
| Budget available (0–4 used) | Graphite-100 background, graphite-700 text, count + mini dots |
| Budget full (5/5) | Graphite-200 background, graphite-800 text, subtle bold weight |
| Loading (reconcile in progress) | Skeleton shimmer, same chip dimensions |
| Error (hook error) | Hidden — vote controls remain but indicator shows "--/5" |

**Layout sketch:**

```
┌─────────────────────────┐
│  ● ● ● ○ ○   3 / 5      │
│  mini dots   text label  │
└─────────────────────────┘
```

Chip: `inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-graphite-100`

Mini dots (5 × 8px circles): filled `bg-graphite-700`, empty `bg-graphite-300`. These are decorative (`aria-hidden="true"`). The text label carries the accessible value.

Text: `"3 / 5 votes used"` — `text-sm font-semibold text-graphite-700`.

At 5/5: text reads `"5 / 5 votes used"`, all mini dots filled, background shifts to `graphite-200`.

**Placement in session header:** Inline with the `SessionPresenceStack`. Header layout:

```
┌──────────────────────────────────────────────────────┐
│  [Session title]        [AvatarStack]  [BudgetChip]  │
│                         ●●●+2          ● ● ● ○ ○  3/5│
└──────────────────────────────────────────────────────┘
```

On 360px viewport, the chip and avatar stack stack vertically below the session title (`flex-col` below `sm` breakpoint).

**Accessibility:**
- `aria-live="polite"` on the text label only (not the whole chip).
- `aria-label` on the chip: "Vote budget: 3 of 5 votes used."
- Screen reader hears polite update on every vote cast or removed.
- Mini dots are `aria-hidden="true"` (purely decorative, text conveys the count).

---

### 2c. SessionPresenceStack

**Purpose:** Compact avatar stack showing who is currently in the brainstorm session. Surfaces Supabase Presence data. Appears in the session header adjacent to `DotBudgetIndicator`.

**Note on naming:** The locked plan references `PresenceIndicators.tsx` (extended) and the UI-SPEC references `ProjectPresenceStack`. For the session-scope brainstorm context, this component is `SessionPresenceStack` to avoid confusion with the future matrix-scoped presence. Colby should confirm naming against 05-03 SUMMARY when it is written.

**Props:**
```
{
  participants: PresenceParticipant[]  // from ScopedRealtimeManager presence
  currentUserId: string
  className?: string
}

type PresenceParticipant = {
  userId: string
  displayName: string
  joinedAt: number
}
```

**States:**

| State | Visual |
|-------|--------|
| 1–5 participants | Full avatar stack, all visible |
| 6+ participants | First 4 avatars + overflow chip "+N" |
| Participant joining | New avatar slides in (translateX + opacity, 200ms) |
| Participant leaving | Avatar slides out + fades (200ms) |
| No others (self only) | Single avatar (self), no overflow chip |
| Empty (session not started) | Nothing rendered |

**Avatar design:**
- Diameter: 28px (`w-7 h-7`) on desktop, 24px (`w-6 h-6`) on mobile.
- Shape: `rounded-full`.
- Content: uppercase initials (1–2 chars), `text-xs font-semibold`.
- Background: deterministic HSL hash of `userId`: `hsl((hash(userId) % 360), 55%, 65%)`. Generates visually distinct, mid-saturation colors per user. Same algorithm to be shared with cursor color generation in 05.4b.
- Border: 2px solid white (`ring-2 ring-white`) for all participants. Current user gets additional `ring-1 ring-sapphire-400` (1px inner accent ring) to distinguish self.
- Overlap: `-ml-2` (−8px negative margin, matching UI-SPEC) except the first avatar.
- Order: self first, then other participants sorted by `joinedAt` ascending.
- Tooltip: native `title` attribute with full display name (matches existing component patterns — no new Tooltip component introduced).

**Overflow chip:**
- Appears when total participants > 5.
- Shows the count of non-visible participants: `+N`.
- Style: `w-7 h-7 rounded-full bg-graphite-200 text-graphite-700 text-xs font-semibold flex items-center justify-center -ml-2 ring-2 ring-white`.
- `title` attribute: "{N} more participants in this session".

**Layout sketch (5 participants visible, self first):**

```
  [You] [A] [B] [C] [D] +3
   ↑self    ──────────── overflow chip
   sapphire ring
```

**Touch target:** Avatars are read-only (no click action required for MVP). They carry `aria-label` only. Touch target is not a concern for read-only elements.

**Accessibility:**
- Container: `role="group"` with `aria-label="Session participants: {N} online"`.
- Each avatar: `aria-label="{displayName} — in this session"`.
- Current user avatar: `aria-label="You — in this session"`.
- Overflow chip: `aria-label="{N} more participants in this session"`.
- `aria-live="polite"` region (separate from avatar stack DOM, placed at session header root): announces join/leave events. Copy: "{Name} joined the session." / "{Name} left the session."
- The live region is a single `<p>` element; it is cleared and re-set on each event, which triggers the polite announcement without accumulating text.

---

## 3. Interaction Patterns

### Optimistic Update Timing

```
User action
    │
    ├─ Immediate: UI state updates (dot fills / unfills, budget counter changes)
    │   Duration: 0ms — synchronous state mutation in useDotVoting
    │
    ├─ 0–50ms: castVote() / removeVote() network call initiates
    │
    └─ Network response (~100–500ms typical):
        ├─ Success (ok: true):  no UI change (optimistic was correct)
        └─ Failure (budget_exceeded / unknown): rollback fires
```

**Rollback visual:** The dot that was just filled snaps back to empty. The budget counter reverts. The snap-back uses a brief `animate-scale-in` (120ms) to signal the revert was intentional, not a render bug. The error message then appears (see error states section).

### Rollback on RLS Rejection

When `castVote` returns `{ ok: false, reason: 'budget_exceeded' }`:

1. Dot snaps back to empty (same frame as error is set in hook state).
2. Budget counter reverts (same frame).
3. Inline error renders below the idea card's dot row:

```
┌───────────────────────────────────────────────────────┐
│  ● ● ● ○ ○   3                                        │
│  ⚠ You've used all 5 votes. Remove one to cast another.│
└───────────────────────────────────────────────────────┘
```

Error text: `text-xs text-error-600` (garnet-600 / #DC2626). Icon: `AlertCircle` (lucide, 12px, inline). Auto-dismisses after 4 seconds. `role="alert"` for immediate screen reader announcement.

When `castVote` returns `{ ok: false, reason: 'unknown' }` (network failure):

Same rollback. Different copy: "Couldn't save your vote. Check your connection and try again."

### Realtime Tally Animation Spec

When a remote vote INSERT event arrives and the tally for an idea updates:

- The tally count label transitions: `transform: scale(1)` → `scale(1.18)` → `scale(1)`.
- Duration: 180ms total. Keyframes: 0ms scale(1), 80ms scale(1.18), 180ms scale(1).
- Easing: `ease-out` for the scale-up, `ease-in` for the return.
- CSS class: add `animate-tally-bump` temporarily via `setTimeout` cleanup after 180ms.
- No layout shift. The label's width is fixed at `min-w-[1.5rem] text-center` to prevent adjacent dot row from jumping.
- `prefers-reduced-motion` respected: when enabled, the number updates with no animation (instant value change only).

Keyframe definition (to be added to tailwind.config.js keyframes):
```
tallyBump: {
  '0%':   { transform: 'scale(1)' },
  '44%':  { transform: 'scale(1.18)' },
  '100%': { transform: 'scale(1)' },
}
```

Animation duration: 180ms. This is short enough to read as "live update" rather than "animation" at normal attention levels.

### Presence Stack Ordering and Update Logic

- **Ordering rule:** Self always first. Other participants ordered by `joinedAt` ascending (longest in session leftmost after self).
- **Stack collapse on overflow:** When a 6th participant joins, participant index 4 (0-based, excluding self) collapses into the overflow chip. The chip appears with a `animate-scale-in` (120ms). The other 4 avatars do not shift position — only the rightmost visible slot is replaced.
- **Deduplication:** Supabase Presence uses `${userId}:${tabId}` as the presence key (per 05-03 plan, Pitfall 2). `SessionPresenceStack` must deduplicate by `userId` before rendering — a user with two tabs shows only one avatar (use the most recently active entry per userId).
- **Stale presence:** Presence leave events arrive within ~10 seconds of tab close. The UI should not show a user as present indefinitely on network partition — use the presence `leave` event, not a timeout. (No client-side stale-detection timer needed for MVP.)

---

## 4. Error States

### 4a. RLS Rejection — Budget Exceeded

**Trigger:** `castVote` returns `{ ok: false, reason: 'budget_exceeded' }`.

**Visual:**
- Dot snaps back to empty (120ms scale-in animation on the empty dot).
- Inline error appears below the dot row of the specific idea card.
- No toast notification (the error is card-scoped, not global).

**Copy:** "You've used all 5 votes. Remove one to cast another."

**Dismissal:** 4 seconds auto-dismiss, or on any subsequent interaction with that card.

**ARIA:** `role="alert"` — screen reader announces immediately.

---

### 4b. Network Failure During Vote Cast

**Trigger:** `castVote` returns `{ ok: false, reason: 'unknown' }` (network error, unexpected server error).

**Visual:** Same rollback animation as 4a. Different inline error.

**Copy:** "Couldn't save your vote. Check your connection and try again."

**Recovery affordance:** No retry button inline (keeps the UI clean). User can simply tap the dot again to retry.

**Dismissal:** 4 seconds auto-dismiss.

**ARIA:** `role="alert"`.

---

### 4c. Network Failure During Vote Removal

**Trigger:** `removeVote` fails at network level. (The repository's `removeVote` currently returns void and swallows errors via `logger.error`. The hook must detect this by catching the thrown error or by checking connection state.)

**Design recommendation:** If `removeVote` fails, the dot should snap back to filled (rollback the removal optimistic update). Inline error: "Couldn't remove your vote. Try again."

**NOTE for Cal/Colby:** The current `voteRepository.removeVote` returns `void` and does not surface errors to callers — it logs them but eats them. The UX assumes the hook wraps the call in try/catch and checks for thrown exceptions or provides a return type. This is an open question (see section 7).

---

### 4d. Presence Sync Failure

**Trigger:** The Supabase Presence channel fails to subscribe or loses connection.

**Visual:** `SessionPresenceStack` shows only the current user's avatar (self-presence is always known locally). A subtle `ConnectionStatus` badge (already exists in `PresenceIndicators.tsx`) can show "Reconnecting…" per the existing pattern.

**Copy:** "Reconnecting…" (graphite-500, per existing `ConnectionStatus` component).

**No inline error on the avatar stack itself** — the reconnecting badge handles it. The stack does not show stale presence data from before the failure; it clears non-self entries until sync resumes.

---

### 4e. Initial Tally Load Failure

**Trigger:** `voteRepository.reconcileTallies()` fails on mount.

**Visual:** Dot rows show in loading skeleton state. After 3s with no resolution, skeleton is replaced with "–" tally count labels and an empty dot set (treat as 0 votes for display).

**Copy:** No explicit error shown to user (not user-actionable). Realtime deltas will self-correct tallies as subsequent votes arrive.

---

## 5. Accessibility

### Keyboard Flow

The complete keyboard flow for a user who does not use a pointer device:

```
Tab → focus session header (SessionPresenceStack, then DotBudgetIndicator)
Tab → focus first idea card
Tab → focus first dot button in DotVoteControls for idea card 1
  Space/Enter → cast vote (or remove if already cast)
Tab → focus second dot button
  ...
Tab → focus fifth dot button
Tab → focus next idea card
  ...
Shift+Tab → navigate backwards through dots and cards
Escape → dismiss any open inline error message
```

Focus order follows DOM order: idea cards are rendered in a natural vertical stack; within each card, dot buttons follow left-to-right. The budget indicator in the header is reachable before the first card.

**Focus ring:** `focus-visible:ring-2 focus-visible:ring-sapphire-500 focus-visible:ring-offset-2` on every dot button. Matches `component.focus` token (#3B82F6 / sapphire-500). Never hidden.

---

### ARIA Live Regions

Two live regions in the brainstorm session page, placed high in DOM (near session root, not inside idea cards):

```html
<!-- Vote budget announcements (polite — non-urgent) -->
<p
  id="vote-budget-live"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
/>

<!-- Vote error announcements (assertive — urgent) -->
<p
  id="vote-error-live"
  aria-live="assertive"
  aria-atomic="true"
  class="sr-only"
/>

<!-- Presence join/leave announcements (polite) -->
<p
  id="presence-live"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
/>
```

**Content rules:**
- `vote-budget-live` is updated on every vote cast or removed: "Vote cast. N of 5 votes used." / "Vote removed. N of 5 votes used."
- `vote-error-live` is updated when an error occurs: exact error copy. Cleared after 4s.
- `presence-live` is updated on presence join/leave: "{Name} joined the session." / "{Name} left the session."
- Live regions are never updated faster than once per 300ms to prevent screen reader queue flooding (debounce rapid tally updates — only budget and presence changes trigger the live region, not individual remote tally deltas).

---

### Screen Reader Announcements — State by State

| Event | Region | Announcement |
|-------|--------|--------------|
| Vote cast (success) | vote-budget-live | "Vote cast. 2 of 5 votes used." |
| Vote removed (success) | vote-budget-live | "Vote removed. 1 of 5 votes used." |
| Budget full (5/5) | vote-budget-live | "All 5 votes used. Remove a vote to continue." |
| Budget-full click | vote-error-live | "You've used all 5 votes. Remove one to cast another." |
| Network error on cast | vote-error-live | "Couldn't save your vote. Check your connection and try again." |
| Rollback (budget) | vote-error-live | "You've used all 5 votes. Remove one to cast another." |
| Participant joins | presence-live | "{Name} joined the session." |
| Participant leaves | presence-live | "{Name} left the session." |
| Remote tally update | (none) | No announcement — only the visual animation. Tally deltas from others are not narrated to avoid overwhelming AT users in active sessions. |

---

### Color Is Not the Sole Indicator

- Filled dots (own vote) vs. empty dots are distinguished by fill color AND by `aria-pressed` state.
- Budget-full empty dots use `cursor: not-allowed` AND `aria-disabled="true"` (not color alone).
- Presence avatars use initials + `aria-label` with name (color is supplementary identity cue).

---

### Reduced Motion

All animations respect `prefers-reduced-motion: reduce`:
- Tally bump animation: disabled (number updates instantly).
- Presence avatar slide-in/out: disabled (instant appear/disappear).
- Dot snap-back on rollback: disabled (instant state change).
- The `DotBudgetIndicator` mini-dot update: always instant (no animation on this element regardless of preference).

Implementation: wrap all animation class additions in a check against `window.matchMedia('(prefers-reduced-motion: reduce)').matches` or use Tailwind's `motion-reduce:` variant.

---

## 6. Design Tokens

### Colors Used in This Feature

| Token | Tailwind class | Hex | Usage |
|-------|---------------|-----|-------|
| sapphire-500 | `bg-sapphire-500` / `text-sapphire-500` | #3B82F6 | Self-avatar inner ring, focus rings, connection status |
| brand.primary | `bg-brand-primary` | #000000 | Filled dot (own vote cast) |
| graphite-300 | `bg-graphite-300` | #D1D5DB | Empty dot slot (default) |
| graphite-200 | `bg-graphite-200` | #E5E7EB | Empty dot slot (budget-full disabled), overflow chip bg |
| graphite-100 | `bg-graphite-100` | #F3F4F6 | DotBudgetIndicator chip background (available) |
| graphite-200 | `bg-graphite-200` | #E5E7EB | DotBudgetIndicator chip background (budget-full) |
| graphite-700 | `text-graphite-700` | #374151 | Budget chip text, avatar initials text |
| graphite-800 | `text-graphite-800` | #1F2937 | Budget chip text at 5/5 |
| error-600 / garnet-600 | `text-error-600` | #DC2626 | Inline error message text |
| error-50 | `bg-error-50` | #FFECEC | Inline error message background (subtle) |
| white | `ring-white` | #FFFFFF | Avatar border ring |

### Spacing

| Usage | Token | Value |
|-------|-------|-------|
| Gap between dot buttons (desktop) | `gap-1` | 4px |
| Gap between dot buttons (mobile) | `gap-2` | 8px |
| Dot hit area padding | `p-4` (effective: 44×44px total) | 16px each side |
| Budget chip horizontal padding | `px-3` | 12px |
| Budget chip vertical padding | `py-1.5` | 6px |
| Avatar overlap | `-ml-2` | -8px |
| Error message margin-top | `mt-1.5` | 6px |
| Tally counter left margin | `ml-2` | 8px |

### Dimensions

| Element | Dimension |
|---------|-----------|
| Dot circle (visual) | 12×12px |
| Dot touch target | 44×44px minimum |
| Mini dot in budget indicator | 8×8px (decorative, `aria-hidden`) |
| Avatar (desktop) | 28×28px (`w-7 h-7`) |
| Avatar (mobile) | 24×24px (`w-6 h-6`) |
| Avatar self ring | 2px white + 1px sapphire-400 |
| Avatar others ring | 2px white |

### Motion Durations

| Animation | Duration | Easing | Reduced-motion |
|-----------|----------|--------|----------------|
| Tally bump (remote vote) | 180ms | ease-out up, ease-in down | skip |
| Dot rollback snap | 120ms `scale-in` | ease-out | skip |
| Avatar slide-in (join) | 200ms translate+opacity | ease-out | skip |
| Avatar slide-out (leave) | 200ms translate+opacity | ease-in | skip |
| Overflow chip appear | 120ms `scale-in` | ease-out | skip |
| Error message appear | 150ms `fade-in` | ease-in-out | skip |
| Error message auto-dismiss | 4000ms timeout, then 150ms fade-out | — | skip fade |

All durations map to existing `transitionDuration` tokens in tailwind.config.js.

---

## 7. Open Questions

The following items could not be fully resolved from the brief and the existing code. They are inputs for Cal's ADR and Colby's implementation decisions.

**OQ-1: removeVote return type**
`voteRepository.removeVote()` currently returns `void` and swallows errors internally. The UX for a failed vote removal (rollback the empty dot) requires the hook to detect failure. Should `removeVote` be updated to return `{ ok: boolean }` matching `castVote`? Or should the hook use a try/catch with the current `void` return? Recommend updating the return type to `{ ok: boolean }` for consistency, but this may touch the frozen data layer — confirm with Cal.

**OQ-2: Tally display for votes cast by others (not the current user)**
The 05-03 plan states all dots are `brand.primary` regardless of who voted. The DotVoteControls should show the current user's own dots as filled (and interactive), but the tally count reflects ALL votes. The dot row represents the user's own 5 slots — it does not visualize other users' contributions dot-by-dot. Only the numeric tally label reflects aggregate vote count. This is consistent with the plan, but needs explicit confirmation: **is the numeric tally label the only cross-user vote signal on the idea card?** If yes, that is a significant discoverability difference from tools like MIRO where you see colored dots per voter.

**OQ-3: Tally label visibility on idea cards with 0 votes**
Should the tally label show "0" or be hidden when no votes have been cast on an idea? Showing "0" is noisier but establishes the pattern early; hiding it until >0 is cleaner but introduces layout shift when the first vote arrives. Recommendation: show "0" always once vote mode is active (consistent layout, no shift).

**OQ-4: SessionPresenceStack naming vs. PresenceIndicators extension**
The 05-UI-SPEC lists `PresenceIndicators.tsx` as "reuse + extend (add scope prop)". The 05-03 plan does not name the session header avatar stack component explicitly. This document calls it `SessionPresenceStack` to match the matrix-scope naming convention (`ProjectPresenceStack`). Colby should confirm whether to extend the existing component or create a new one, given the existing `PresenceIndicators` implementation renders a typing indicator tray (bottom-fixed overlay) — a structurally different pattern from a header avatar stack.

**OQ-5: Presence deduplication across tabs**
The 05-03 plan specifies the presence key is `${userId}:${tabId}` to avoid multi-tab collisions. `SessionPresenceStack` must deduplicate by `userId` before rendering. What is the ordering rule when a user has two tabs? (Most recently joined tab's `joinedAt` used as the avatar's timestamp?) Propose: use the entry with the largest (most recent) `joinedAt` value.

**OQ-6: Vote mode activation**
Is voting always active when a session is in `active` status, or does the facilitator explicitly enable a "voting round"? The requirements and plan do not specify a mode-toggle. This document assumes voting is always available during active sessions. If a voting-round concept exists in the data model, the DotVoteControls disabled state needs a `sessionPhase` prop.

**OQ-7: Tally animation on high-frequency vote events**
In a large session, multiple votes could arrive within a single animation frame. Should the tally animation coalesce (batch rapid deltas, play one bump) or play sequentially? Recommend: coalesce via debounce at 80ms — only trigger the bump once per 80ms window per idea card, using the final tally value at the time of render.

---

## Definition of Done

This UX document is considered complete when:

- [ ] All 5 user flows documented with explicit step-by-step descriptions
- [ ] All 3 locked component names honored verbatim: `DotVoteControls`, `DotBudgetIndicator`, `SessionPresenceStack`
- [ ] Hook contract `{ votesUsed, tallies, castVote, removeVote, loading, error }` reflected in component designs without deviation
- [ ] All states documented (default, hover, active, disabled, error, loading) for each component
- [ ] WCAG 2.1 AA: keyboard navigation flow specified, ARIA live regions specified, color-not-sole-indicator verified
- [ ] Mobile-first layout specified for 360×800 viewport with 44×44px touch targets
- [ ] Optimistic update and rollback visual states specified
- [ ] Realtime tally animation specified with duration and easing
- [ ] All design tokens mapped to existing tailwind.config.js values
- [ ] Open questions surfaced for Cal/ADR input
- [ ] Copywriting uses exact strings from 05-UI-SPEC.md copywriting contract
