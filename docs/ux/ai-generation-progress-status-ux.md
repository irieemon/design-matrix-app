---
feature: ai-generation-progress-status
status: draft
author: sable-ux
created: 2026-04-13
upstream: docs/product/ai-generation-progress-status.md
requirements: [US-1, US-2, US-3, US-4, US-5, US-6]
---

# AI Generation Progress & Status System -- UX Design

## Overview

This document specifies the interaction design, component states, copy, and accessibility contracts for four deliverables: a shared AI progress overlay (AIProgressOverlay), post-completion toast notifications, a persistent navigation quota badge (AIQuotaBadge), and a quota-exhausted modal (QuotaExhaustedModal). All designs consume existing Animated Lux tokens. No new design primitives are introduced.

---

## Definition of Readiness (DoR)

| Requirement | Source | Verified |
|---|---|---|
| Feature spec with acceptance criteria AC-1 through AC-13 | `docs/product/ai-generation-progress-status.md` | Yes |
| Gold standard progress pattern in AIInsightsModal.tsx lines 390-468 | Source code audit | Yes |
| Existing ToastContext with success/error/warning/info types at `src/contexts/ToastContext.tsx` | Source code | Yes |
| Sidebar footer layout documented (user profile, admin, logout) | `src/components/Sidebar.tsx` lines 299-392 | Yes |
| MobileTopBar layout documented (logo, project selector, user button) | `src/components/mobile/MobileTopBar.tsx` | Yes |
| Tailwind design tokens audited (sapphire, amber, garnet, graphite scales; animation keyframes) | `tailwind.config.js` | Yes |
| Prior UX doc template format reviewed for consistency | `docs/ux/phase-05.4a-session-scope-voting.md` | Yes |
| Retro risks | None found in retro-lessons for this feature area | N/A |

---

## Jobs to Be Done

| JTBD | Actor | Outcome |
|---|---|---|
| When I trigger an AI generation, I want to see it is working and how long to wait, so I do not abandon or reload. | Any user (esp. mobile) | Confidence that the operation is alive; reduced abandonment |
| When I change my mind during a generation, I want to cancel and return to my work without waiting. | Any user | Control; no wasted time |
| When a generation finishes, I want a brief confirmation so I know results are ready. | Any user | Closure; smooth transition from modal to results |
| When I am on the free tier, I want to see how many AI generations I have left this month. | Free-tier user | Usage awareness; informed upgrade decision |
| When I have hit my limit, I want to understand what happened and how to get more. | Free-tier user | Clarity; clear path to upgrade |

---

## 1. User Flows

### 1a. Generation with Progress (Happy Path)

```
User clicks "Generate [Roadmap | Insights | Ideas]"
  |
  v
Frontend calls GET /api/ai/quota-status?type={type}
  |-- canUse: false --> QuotaExhaustedModal (flow 1d)
  |-- canUse: true  -->
  v
Modal content area transitions to AIProgressOverlay
  - Progress bar animates from 0%
  - Stage text updates through operation-specific sequence
  - Estimated time countdown ticks down
  - Cancel button is visible and focused for keyboard users
  |
  |-- Generation completes -->
  |     Progress jumps to 100%, stage reads "Complete!"
  |     600ms pause (user reads confirmation)
  |     Modal closes
  |     Toast appears: operation-specific success message (3s auto-dismiss)
  |     AIQuotaBadge refreshes silently in background
  |
  |-- User clicks Cancel --> flow 1b
  |-- Generation fails --> flow 1c
  |-- Estimated time reaches 0 --> countdown text changes to "Almost done..."
  |     Progress bar continues at reduced speed (1% per 2 seconds)
```

### 1b. Cancel In-Flight Generation

```
User clicks "Cancel" during progress overlay
  |
  v
AbortController.abort() fires immediately (no confirmation dialog).
  - Rationale: a confirmation dialog on cancel is friction on friction.
    The user already waited; asking "are you sure?" compounds the
    interruption. Fast undo is better than slow prevention.
  |
  v
Modal closes. No partial results saved. No toast shown.
Progress state resets. Quota is NOT consumed (server did not complete).
```

### 1c. Generation Failure

```
Fetch returns error (500, network loss, timeout)
  |
  v
Progress overlay transitions to error state IN-PLACE (modal stays open):
  - Progress bar turns garnet-500
  - Stage text: "Something went wrong"
  - Body text: specific error message or "Please try again in a moment."
  - Two buttons: [Retry] (primary) and [Close] (ghost)
  |
  |-- User clicks Retry --> progress restarts from 0%, new fetch initiated
  |-- User clicks Close --> modal closes, no toast
```

### 1d. Quota Exhausted

```
Pre-check returns canUse: false
  |
  v
QuotaExhaustedModal renders (replaces any generate action)
  - NOT an error state; this is an upsell moment
  - Sapphire visual, not garnet/red
  - Shows usage count, reset date, upgrade CTA
  |
  |-- User clicks "Upgrade to Team" --> navigates to /pricing
  |-- User clicks "Close" --> modal closes, user returns to previous view
```

### 1e. Quota Badge Lifecycle

```
User logs in (free tier)
  |
  v
AIQuotaBadge mounts in sidebar footer, fetches quota status
  |-- Loading --> skeleton pill (32x20px shimmer)
  |-- Loaded, 0-79% used --> neutral style: "3/5 AI"
  |-- Loaded, 80-99% used --> amber style: "4/5 AI"
  |-- Loaded, 100% used --> garnet style: "5/5 AI"
  |
After any AI generation completes:
  --> Badge re-fetches quota, updates count with tally-bump animation
  |
User upgrades to Team/Enterprise:
  --> Badge unmounts (not rendered for paid tiers)
```

---

## 2. Component Designs

### 2a. AIProgressOverlay

**Purpose:** Shared progress UI extracted from AIInsightsModal.tsx. Renders inside any AI generation modal, replacing the modal's content area during generation.

**Placement rule:** The overlay replaces the modal's body content (not an overlay on top, not a bottom bar). The modal's header and close button remain visible. This means:
- Modal header stays in place for orientation ("AI Insights", "Generate Roadmap", etc.)
- Modal close button (X) triggers the same cancel flow as the Cancel button
- The overlay occupies the full content area below the header

**Layout (desktop, 600px+ modal width):**

```
+--------------------------------------------------+
|  [Modal Header]                          [X]     |
+--------------------------------------------------+
|                                                  |
|  +--------------------------------------------+ |
|  | [Sparkles icon]  Stage Text        Progress | |
|  |                  ~8s remaining       67%    | |
|  |                                             | |
|  | [============================--------]      | |
|  |  sapphire-600 bar with pulse overlay        | |
|  +--------------------------------------------+ |
|                                                  |
|  +--------------------------------------------+ |
|  | AI Processing Steps                         | |
|  |   * Collecting idea data                    | |
|  |   * Analyzing patterns                      | |
|  |   > Generating recommendations              | |
|  |   . Formatting report                       | |
|  +--------------------------------------------+ |
|                                                  |
|       o   o   *   .            [Cancel]          |
|     stages (dot indicators)                      |
+--------------------------------------------------+
```

Legend: `*` = active (pulsing sapphire), `o` = completed (emerald), `.` = pending (graphite-300)

**Layout (mobile, < 600px):**

The layout stacks identically but the modal is full-screen on mobile (existing pattern). The Cancel button expands to full-width at the bottom of the overlay content, meeting the 44px touch target requirement. The processing steps list has `max-h-24 overflow-y-auto` to avoid pushing Cancel below the fold.

**States:**

| State | Visual Description |
|---|---|
| Generating (0-99%) | Sapphire progress bar with white pulse overlay animating left-to-right. Stage text with emoji prefix. Countdown timer. Active step highlighted in sapphire. Stage dots show completed/active/pending. |
| Complete (100%) | Bar full sapphire, stage text "Complete!", emerald checkmark replaces sparkles icon. All stage dots emerald. 600ms hold then modal auto-closes. |
| Error | Bar turns garnet-500, pulse stops. Stage text "Something went wrong". Error detail text below. Retry + Close buttons replace Cancel. |
| Cancelled | No visual state -- modal closes immediately on cancel. |
| Overtime (est. time = 0) | Countdown text changes to "Almost done..." in italics. Bar continues advancing at 1% per 2 seconds. No alarm styling -- this is normal, not an error. |

**Animation specs:**

| Property | Value | Rationale |
|---|---|---|
| Progress bar width | `transition-all duration-500 ease-out` | Matches existing insights pattern; smooth without jank |
| Progress bar pulse | `animate-pulse` on white overlay (existing pattern) | Communicates activity; uses CSS opacity only |
| Stage dot active | `animate-pulse` + `scale-125` | Draws eye to current stage |
| Stage dot completed | `bg-emerald-500`, no animation | Settled, done |
| Stage text transition | No animation (instant swap) | Text animation is disorienting when reading |
| Processing step highlight | `transition-all duration-300` on text color/weight | Smooth attention shift |
| Error transition | `transition-colors duration-300` on bar color | Not jarring; garnet fades in |

**Copy contract (stage text by operation type):**

| Operation | Stage 1 | Stage 2 | Stage 3 | Stage 4 |
|---|---|---|---|---|
| Insights | Analyzing Ideas | Synthesizing Insights | Optimizing Recommendations | Finalizing Report |
| Roadmap | Loading Project Data | Planning Milestones | Sequencing Dependencies | Building Timeline |
| Project Ideas (batch) | Analyzing Project Context | Generating Ideas | Evaluating Feasibility | Formatting Results |
| Single Idea (text) | Processing Input | Analyzing Content | Generating Idea Card | -- |
| Single Idea (image) | Uploading Image | Analyzing Visual Content | Generating Idea Card | -- |
| Single Idea (audio) | Processing Audio | Transcribing Content | Generating Idea Card | -- |
| Single Idea (video) | Extracting Frames | Analyzing Video Content | Generating Idea Card | -- |

**Processing steps copy contract:**

| Operation | Step 1 | Step 2 | Step 3 | Step 4 |
|---|---|---|---|---|
| Insights | Collecting idea data | Analyzing patterns | Generating recommendations | Formatting report |
| Roadmap | Reading project context | Identifying priorities | Ordering deliverables | Rendering roadmap |
| Project Ideas (batch) | Scanning project brief | Brainstorming concepts | Scoring viability | Preparing idea cards |
| Single Idea (text) | Reading submission | Extracting themes | Building card | -- |
| Single Idea (image) | Transferring file | Running vision analysis | Building card | -- |
| Single Idea (audio) | Decoding audio | Converting speech to text | Building card | -- |
| Single Idea (video) | Sampling key frames | Running multi-modal analysis | Building card | -- |

---

### 2b. Post-Completion Toasts

**Purpose:** Brief confirmation after AI generation completes and the modal closes. Uses the existing ToastContext -- no new toast infrastructure.

**Placement:** Fixed top-right (`top-4 right-4`), matching the existing ToastContext container. On mobile, toasts render full-width with horizontal padding (`mx-4`).

**Toast stacking:** The existing ToastContext already stacks toasts vertically in a `space-y-2` container. If multiple operations complete in rapid succession (unlikely but possible with batch ideas), toasts stack naturally. Maximum visible: 3 (older toasts auto-dismiss before newer ones expire).

**Copy contract:**

| Event | Message | Type | Duration |
|---|---|---|---|
| Insights generated | "Insights generated successfully" | success | 3000ms |
| Roadmap generated | "Roadmap generated successfully" | success | 3000ms |
| Ideas generated (batch) | "{count} ideas generated" | success | 3000ms |
| Single idea created | "Idea created" | success | 3000ms |
| Generation failed (after close) | "Generation failed. Please try again." | error | 5000ms |
| Quota exhausted (after attempt) | "Monthly AI limit reached. Upgrade for unlimited access." | warning | 5000ms |

**States:**

| State | Visual |
|---|---|
| Entering | `animate-slide-left` (slides in from right edge, 300ms) |
| Visible | Solid color pill per existing ToastContext (green/red/yellow/blue + white text) |
| Dismissing (auto or manual) | `opacity-0 translate-x-4`, 300ms transition, then removed from DOM |

No changes to existing toast appearance are proposed. The current styling is consistent with the Animated Lux system.

---

### 2c. AIQuotaBadge

**Purpose:** Persistent indicator showing free-tier AI usage. Lives in the sidebar footer (desktop) and mobile top bar.

**Desktop placement -- sidebar footer:**

The badge renders between the user profile NavItem and the admin/logout buttons, as a non-interactive display element. When the sidebar is collapsed, it renders as a compact icon-only badge.

```
Expanded sidebar footer:
+--------------------------------------------+
|  [User avatar] user@email.com   [Logout]   |
|  [Sparkles] 3/5 AI                         |  <-- AIQuotaBadge
|  [Shield] Admin Portal                     |
+--------------------------------------------+

Collapsed sidebar footer:
+----------+
|  [User]  |
|  3/5     |  <-- AIQuotaBadge compact
|  [Admin] |
|  [Out]   |
+----------+
```

**Mobile placement -- top bar:**

The badge renders between the project selector and the user avatar button in the MobileTopBar. It is compact by default (just the count, no icon).

```
Mobile top bar:
+---------------------------------------------------+
| [Logo] [Project: My Project v]  3/5 AI  [User]   |
+---------------------------------------------------+
```

**States:**

| State | Condition | Display Text | Tailwind Classes | Accessibility |
|---|---|---|---|---|
| Loading | Quota data not yet fetched | Skeleton pill | `w-14 h-5 rounded-full bg-graphite-200 animate-shimmer` | `aria-label="Loading AI usage"` |
| Neutral | 0-79% used | "3/5 AI" | `text-graphite-600 bg-graphite-100 border border-hairline-default` | `aria-label="AI usage: 3 of 5 generations used this month"` |
| Warning | 80-99% used | "4/5 AI" | `text-amber-700 bg-amber-50 border border-amber-200` | `aria-label="AI usage warning: 4 of 5 generations used this month"` |
| Exhausted | 100% used | "5/5 AI" | `text-garnet-700 bg-garnet-50 border border-garnet-200` | `aria-label="AI usage limit reached: 5 of 5 generations used this month"` |
| Exhausted hover | 100% + hover/focus | Tooltip: "Upgrade for unlimited" | Tooltip appears above badge, `bg-graphite-800 text-white text-xs rounded px-2 py-1` | Tooltip `role="tooltip"`, linked via `aria-describedby` |
| Hidden | Team/Enterprise tier | Not rendered | -- | -- |
| Error | Fetch failed | "-- AI" | `text-graphite-400 bg-graphite-50` | `aria-label="AI usage unavailable"` |

**Visual spec:**

- Badge shape: `rounded-full px-2 py-0.5` (pill shape, matching existing tag/badge patterns)
- Font: `text-xs font-medium`
- Icon: Sparkles (`w-3 h-3`) to the left of the text, only in expanded sidebar and mobile
- Collapsed sidebar: text only, no icon, `text-xs` centered
- Minimum touch target on mobile: the badge itself is not interactive; it is a display element. No click handler needed for v1 (clicking opens nothing). If a click handler is added later (to show quota details), the wrapper must be a button with 44x44px minimum.

**Update animation:** When the count changes after a generation completes, the badge text plays the existing `animate-tally-bump` (180ms scale 1 -> 1.18 -> 1) to signal the update.

---

### 2d. QuotaExhaustedModal

**Purpose:** Explains quota exhaustion and offers an upgrade path. This is a marketing moment, not an error state.

**Visual hierarchy:** The modal uses sapphire tones (aspiration, possibility) rather than garnet (error, failure). The goal is to make the user feel they have gotten value from the free tier and want more, not that they hit a wall.

**Layout (desktop):**

```
+--------------------------------------------------+
|                                          [X]     |
|                                                  |
|            [Sparkles icon, 48px]                 |
|            sapphire-500, static                  |
|                                                  |
|        Monthly AI Limit Reached                  |
|        text-xl font-bold graphite-900            |
|                                                  |
|    You've used all 5 AI generations this         |
|    month. Your limit resets on May 1, 2026.      |
|    text-sm graphite-600, centered                |
|                                                  |
|    +------------------------------------------+  |
|    |  Upgrade to Team                         |  |
|    |  Unlimited AI generations -- $29/mo       |  |
|    +------------------------------------------+  |
|    sapphire-600 bg, white text, full-width       |
|    min-h-[44px] for touch target                 |
|                                                  |
|                  [Close]                         |
|    ghost button, graphite-500, text-sm           |
+--------------------------------------------------+
```

**Layout (mobile):** Same structure, full-screen modal (matching existing mobile modal pattern). Upgrade button full-width. Close button below with generous spacing (16px gap).

**States:**

| State | Description |
|---|---|
| Default | As laid out above |
| Loading (rare -- if quota fetch is slow) | Skeleton lines replacing count and date; buttons disabled |
| Upgrade button hover/focus | `bg-sapphire-700`, `shadow-button-lux-hover`, `focus-ring-lux` |
| Upgrade button active | `bg-sapphire-800`, `scale-[0.98]` via transform |
| Close button hover/focus | `bg-graphite-100`, `focus-ring-lux` |

**Copy contract:**

| Element | Text |
|---|---|
| Heading | "Monthly AI Limit Reached" |
| Body | "You've used all {limit} AI generations this month. Your limit resets on {reset_date}." |
| CTA button | "Upgrade to Team -- $29/mo" |
| CTA subtext (optional, below button) | "Unlimited AI generations for your whole team" |
| Close button | "Close" |

**Date formatting:** Reset date uses long format: "May 1, 2026" (not "2026-05-01"). Use `Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })`.

---

## 3. Interaction Patterns

### 3a. Cancel Confirmation -- None

The Cancel button fires immediately with no confirmation dialog. Rationale:

1. The user has already been waiting during generation. Adding "Are you sure?" doubles the friction.
2. Cancel discards no user-authored content -- only server-generated content they have not seen yet.
3. No partial results means no "you'll lose progress" risk to communicate.
4. The operation can be re-triggered at any time.

If analytics later show accidental cancels are common (> 5% cancel rate where users immediately re-trigger), a lightweight "Cancelled. [Undo]" toast could be added. Not for v1.

### 3b. Modal Close = Cancel

While the progress overlay is active:
- Clicking the modal's X button triggers the cancel flow (abort + close, no toast).
- Pressing Escape triggers the cancel flow.
- Clicking the backdrop overlay triggers the cancel flow.

All three paths route through the same `onCancel` callback. There is no scenario where the modal closes and the generation continues in the background (that is explicitly out of scope per the feature spec).

### 3c. Double-Click Prevention

The generate button (`[Generate Roadmap]`, `[Generate Insights]`, etc.) is disabled immediately on first click via `disabled={isGenerating}`. The `useAIGeneration` hook's `isGenerating` boolean flips to `true` synchronously before the first async tick. The AbortController ref is checked -- if one already exists and is not aborted, `execute()` returns early.

### 3d. Progress Simulation Strategy

Progress is simulated client-side (no real-time server events). The simulation follows a deceleration curve:

| Progress Range | Speed | Rationale |
|---|---|---|
| 0-60% | Linear against estimated time | First 60% of time produces first 60% of bar |
| 60-85% | 0.7x speed | Slows down to build buffer for server response |
| 85-95% | 0.3x speed | Crawls to avoid hitting 100% before server responds |
| 95-99% | Stops (holds at 95%) | Waits for actual server response |
| 99-100% | Instant jump on server success | Completion feel |

If the server responds before the simulated progress reaches 95%, the bar jumps to 100% from wherever it is (with the 500ms `ease-out` transition making the jump feel smooth, not jarring).

### 3e. Focus Management

| Event | Focus Target | Method |
|---|---|---|
| Progress overlay appears | Cancel button | `autoFocus` prop or `ref.focus()` in useEffect |
| Error state appears | Retry button | `ref.focus()` in useEffect |
| QuotaExhaustedModal opens | Close button (not upgrade, to avoid accidental purchase) | `ref.focus()` in useEffect |
| Modal closes (any reason) | The element that triggered the modal open | Return focus via `useRef` stored before modal mount |

---

## 4. Error States

### 4a. Network Loss During Generation

| Aspect | Specification |
|---|---|
| Detection | AbortController fires `abort` event; fetch rejects with `AbortError` or `TypeError` (network) |
| Visual | Progress bar turns garnet-500; stage text: "Connection lost" |
| Body text | "Your internet connection was interrupted. Your work is safe -- nothing was saved." |
| Actions | [Retry] (primary), [Close] (ghost) |
| Screen reader | `aria-live="assertive"` announces "Generation interrupted. Connection lost. Retry button available." |

### 4b. Server Error (500)

| Aspect | Specification |
|---|---|
| Visual | Progress bar turns garnet-500; stage text: "Something went wrong" |
| Body text | "Our servers encountered an error. Please try again in a moment." |
| Actions | [Retry] (primary), [Close] (ghost) |
| Screen reader | `aria-live="assertive"` announces error message |

### 4c. Quota Race Condition (402 mid-generation)

| Aspect | Specification |
|---|---|
| Trigger | Pre-check said `canUse: true` but backend returns 402 (another tab used last quota) |
| Visual | Progress overlay closes; QuotaExhaustedModal renders in its place |
| No error styling | This is a quota event, not a server error; sapphire treatment |

### 4d. Quota Fetch Failure (badge)

| Aspect | Specification |
|---|---|
| Trigger | GET /api/ai/quota-status returns error or times out |
| Visual | Badge shows "-- AI" in muted graphite-400 |
| Retry | Silent retry after 60 seconds; no user-facing retry button |
| Generate buttons | Remain enabled; quota check runs again at generation time (server is authoritative) |

---

## 5. Accessibility

### 5a. Screen Reader Announcements

| Event | Announcement | Region |
|---|---|---|
| Progress overlay appears | "AI generation in progress. {Stage text}. Estimated {N} seconds remaining. Press Cancel to stop." | `aria-live="polite"` |
| Stage change | "{New stage text}" | `aria-live="polite"` |
| Progress reaches 100% | "Generation complete." | `aria-live="polite"` |
| Error during generation | "Generation failed. {Error message}. Retry button available." | `aria-live="assertive"` |
| Cancel activated | No announcement (modal closes; focus returns to trigger) | -- |
| Toast appears | Toast message text (existing ToastContext handles this) | `aria-live="polite"` (success/info) or `aria-live="assertive"` (error/warning) |
| Quota badge updates | "AI usage: {N} of {limit} generations used this month" | `aria-live="polite"` (only on count change, not on mount) |
| Quota badge enters warning | "AI usage warning: {N} of {limit} generations used this month" | `aria-live="polite"` |
| Quota exhausted modal opens | Modal heading ("Monthly AI Limit Reached") read by screen reader via dialog role | `role="dialog" aria-labelledby` |

### 5b. Keyboard Navigation

| Component | Tab Order | Key Bindings |
|---|---|---|
| AIProgressOverlay | Cancel button is the only focusable element during generation | `Enter`/`Space`: activates cancel; `Escape`: same as cancel |
| AIProgressOverlay (error) | Retry, then Close | `Enter`/`Space` on focused button |
| QuotaExhaustedModal | Close (first), Upgrade (second) | `Escape`: closes modal; `Enter`/`Space` on buttons |
| AIQuotaBadge | Not focusable (display only, no interaction in v1) | -- |
| AIQuotaBadge (exhausted, with tooltip) | Focusable via `tabindex="0"` to reveal tooltip | `Escape` dismisses tooltip |

### 5c. Contrast Requirements (WCAG 2.1 AA)

| Element | Foreground | Background | Ratio | Passes |
|---|---|---|---|---|
| Neutral badge text | `graphite-600` (#4B5563) | `graphite-100` (#F3F4F6) | 7.3:1 | Yes |
| Warning badge text | `amber-700` (#B45309) | `amber-50` (#FFFBEB) | 6.2:1 | Yes |
| Exhausted badge text | `garnet-700` (#B91C1C) | `garnet-50` (#FEF2F2) | 6.8:1 | Yes |
| Progress percentage | `sapphire-600` (#2563EB) | `canvas-secondary` (#F9FAFB) | 5.1:1 | Yes |
| Stage text | `graphite-900` (#111827) | `canvas-secondary` (#F9FAFB) | 17.2:1 | Yes |
| Error text | `garnet-700` (#B91C1C) | `surface-primary` (#FFFFFF) | 7.1:1 | Yes |
| Upgrade button text | `#FFFFFF` | `sapphire-600` (#2563EB) | 4.6:1 | Yes |
| Toast text (all types) | `#FFFFFF` | Respective bg (green/red/yellow/blue 500) | 4.5:1+ | Yes (existing) |

### 5d. Reduced Motion

When `prefers-reduced-motion: reduce` is active:
- Progress bar pulse overlay is hidden (`animate-pulse` disabled)
- Stage dot pulse replaced with static sapphire-500 fill
- Tally-bump animation on badge replaced with instant color change
- Toast enter/exit uses opacity-only fade (no translateX)
- All `transition-duration` values capped at 0ms except opacity transitions

Implementation: wrap motion-dependent classes in `motion-safe:` Tailwind variant.

---

## 6. Design Tokens Used

All tokens reference existing `tailwind.config.js` values. No new tokens are introduced.

**Colors:**

| Token | Usage |
|---|---|
| `sapphire-500`, `sapphire-600` | Progress bar, active stage dots, quota exhausted modal accent |
| `sapphire-700`, `sapphire-800` | Upgrade button hover/active |
| `emerald-500` | Completed stage dots |
| `graphite-100` through `graphite-900` | Neutral badge, text hierarchy, borders, backgrounds |
| `amber-50`, `amber-200`, `amber-700` | Warning badge |
| `garnet-50`, `garnet-200`, `garnet-500`, `garnet-700` | Exhausted badge, error progress bar |
| `canvas-secondary` (#F9FAFB) | Progress container background |
| `surface-primary` (#FFFFFF) | Processing steps card, modal background |
| `hairline-default` (#E8EBED) | Card borders, badge borders |

**Spacing:**

| Token | Usage |
|---|---|
| `modal-padding` (24px) | QuotaExhaustedModal content padding |
| `component-sm` (12px) | Gap between progress bar and steps card |
| `component-md` (16px) | Internal padding of steps card |

**Shadows:**

| Token | Usage |
|---|---|
| `modal-lux` | QuotaExhaustedModal |
| `button-lux-hover` | Upgrade button hover |
| `focus-ring-lux` | All focusable elements |

**Animations:**

| Token | Usage |
|---|---|
| `animate-pulse` | Progress bar overlay, active stage dot |
| `animate-shimmer` | Badge loading skeleton |
| `animate-tally-bump` (180ms) | Badge count update |
| `animate-slide-left` | Toast entrance |
| `animate-spin` | Sparkles icon during generation (existing pattern) |

**Border radius:**

| Token | Usage |
|---|---|
| `rounded-2xl` (16px) | Progress container (matches existing) |
| `rounded-xl` (12px) | Processing steps card, QuotaExhaustedModal |
| `rounded-full` (9999px) | Badge pill, stage dots |
| `rounded-lg` (8px) | Buttons |

---

## 7. Component Inventory for Colby

| Component | File Location | New/Modified | Dependencies |
|---|---|---|---|
| `AIProgressOverlay` | `src/components/ui/AIProgressOverlay.tsx` | New (extracted from AIInsightsModal) | Lucide: Sparkles, CheckCircle, AlertTriangle, X |
| `AIQuotaBadge` | `src/components/ui/AIQuotaBadge.tsx` | New | Lucide: Sparkles; `useAIQuota` hook |
| `QuotaExhaustedModal` | `src/components/ui/QuotaExhaustedModal.tsx` | New | Lucide: Sparkles; `useAIQuota` hook |
| `useAIGeneration` | `src/hooks/useAIGeneration.ts` | New | AbortController, `useToast` |
| `useAIQuota` | `src/hooks/useAIQuota.ts` | New | Fetch, 60s cache |
| `AIInsightsModal` | `src/components/AIInsightsModal.tsx` | Modified (replace inline progress with AIProgressOverlay) | AIProgressOverlay |
| `AIIdeaModal` | `src/components/AIIdeaModal.tsx` | Modified (wire AIProgressOverlay) | AIProgressOverlay |
| `AIStarterModal` | `src/components/AIStarterModal.tsx` | Modified (wire AIProgressOverlay) | AIProgressOverlay |
| `ProjectRoadmap` | `src/components/ProjectRoadmap/ProjectRoadmap.tsx` | Modified (add AIProgressOverlay + cancel) | AIProgressOverlay |
| `Sidebar` | `src/components/Sidebar.tsx` | Modified (add AIQuotaBadge in footer) | AIQuotaBadge |
| `MobileTopBar` | `src/components/mobile/MobileTopBar.tsx` | Modified (add compact AIQuotaBadge) | AIQuotaBadge |
| `ToastContext` | `src/contexts/ToastContext.tsx` | No changes | -- |

---

## 8. Notes for Cal (Architecture)

1. **useAIGeneration hook scope:** This hook owns the AbortController lifecycle, progress simulation, and stage state. It does NOT own the fetch URL or request body -- those are passed in by the calling component. The hook returns `{ execute, cancel, isGenerating, progress, stage, estimatedSecondsRemaining, processingSteps, error }`. Cal should decide whether this is a standalone hook or composed with the existing `useAsyncOperation` pattern already used in AIInsightsModal.

2. **useAIQuota cache invalidation:** The hook caches quota status for 60 seconds. It exposes a `refresh()` method called by `useAIGeneration` on successful completion. Cal should decide the event bus pattern: direct import, React Context, or a simple custom event (`window.dispatchEvent(new Event('ai-quota-changed'))`).

3. **Quota pre-check vs. server authority:** The pre-check is advisory. The server is authoritative. If the pre-check says "available" but the server returns 402, the frontend handles it gracefully (flow 4c). Cal should confirm this does not require changes to the existing error handling middleware.

4. **AIProgressOverlay rendering strategy:** The overlay replaces modal content (not a portal, not a z-indexed overlay). This means each modal's JSX needs a conditional: `{isGenerating ? <AIProgressOverlay ... /> : <NormalContent />}`. Cal should decide if a higher-order wrapper or render-prop pattern is cleaner than inline conditionals in 7 modals.

---

## 9. Notes for Colby (Implementation)

1. **Extract, do not rewrite.** The gold standard is AIInsightsModal.tsx lines 390-468. Copy the JSX structure, class names, and animation patterns. The new component parameterizes what was previously hard-coded (stage names, step text, estimated time).

2. **Progress simulation interval:** Use `setInterval(100)` for smooth visual updates. At each tick, advance progress based on the deceleration curve in section 3d. Clear the interval on completion, error, cancel, or unmount.

3. **AbortController cleanup:** The `useEffect` cleanup in `useAIGeneration` must call `controller.abort()` to prevent state updates on unmounted components. Test with React StrictMode (double-mount) to catch leaks.

4. **Badge in collapsed sidebar:** When `isCollapsed` is true, render only the count text ("3/5") without the Sparkles icon, centered in the sidebar's 80px width. Use the same conditional pattern as the existing NavItem collapsed state.

5. **Toast after modal close timing:** Fire the toast in the `onClose` callback of the modal, not in the generation completion handler. This ensures the toast appears after the modal's exit animation finishes, not while the modal is still visible.

6. **Date formatting for QuotaExhaustedModal:** Use `new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(resetsAt))`. Do not use a date library for this single formatting need.

---

## Definition of Done (DoD)

| Criterion | Verification | Maps to AC |
|---|---|---|
| AIProgressOverlay renders inside all 7 generation modals with correct stage text, progress bar, countdown, steps, and dots | Manual test matrix + Playwright e2e (roadmap, insights, single idea text) | AC-1 |
| Cancel button aborts fetch, closes modal, saves no partial results, shows no toast | Playwright test + network tab assertion (aborted request) | AC-2 |
| Success toast appears in top-right after generation completes and modal closes | Playwright screenshot; toast auto-dismisses within 3.5s | AC-3 |
| AIQuotaBadge renders correctly at 0%, 50%, 80%, 100% usage for free tier | Component unit test with mocked quota responses | AC-4 |
| AIQuotaBadge hidden (not in DOM) for Team and Enterprise tiers | Component unit test | AC-5 |
| AIQuotaBadge count updates after generation without page reload (tally-bump animation) | Integration test: generate idea, assert badge updates | AC-6 |
| QuotaExhaustedModal renders with count, reset date (long format), and upgrade CTA | Playwright test with mocked exhausted quota | AC-11 |
| Progress overlay fully visible on 375px mobile viewport; cancel button meets 44x44px touch target | Playwright mobile viewport screenshot + axe audit | AC-12 |
| No "state update on unmounted component" warnings during generation cancel or navigation | React StrictMode test; console assertion | AC-13 |
| All screen reader announcements fire correctly (progress, stage changes, errors, badge updates) | Manual screen reader test (VoiceOver) + axe audit | Accessibility NFR |
| Contrast ratios pass WCAG 2.1 AA per section 5c | axe-core automated audit returns 0 critical/serious | Accessibility NFR |
| Focus management follows section 3e (cancel focused on overlay mount, return focus on close) | Manual keyboard navigation test | Accessibility NFR |
| `prefers-reduced-motion` disables pulse, bump, and slide animations per section 5d | Manual test with reduced motion enabled | Accessibility NFR |
| No new TypeScript errors (`npm run type-check`) | CI | General |
| No new ESLint violations (`npm run lint`) | CI | General |
| Existing test suite passes (`npm run test:run`) | CI | General |
