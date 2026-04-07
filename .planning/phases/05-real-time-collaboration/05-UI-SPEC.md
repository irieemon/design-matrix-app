---
phase: 5
slug: real-time-collaboration
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-07
---

# Phase 5 — UI Design Contract

> Visual and interaction contract for real-time collaboration: presence, live cursors, dot voting, soft drag locks, invitations, and reconnect indicators. Extends existing Animated Lux design tokens already in `tailwind.config.js`. No new design system; all new components must consume existing `graphite`, `canvas`, `neutral`, and `brand` tokens.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn — existing Tailwind + bespoke components) |
| Preset | not applicable |
| Component library | none (in-house components in `src/components/`) |
| Icon library | lucide-react 0.294.0 |
| Font | system font stack (Tailwind default) |

**Detected source of truth:** `design-matrix-app/tailwind.config.js` — Animated Lux palette (graphite text scale, canvas surfaces, brand black). Existing reusable components: `PresenceIndicators.tsx`, `InviteCollaboratorModal.tsx`, `Modal.tsx`. Phase 5 wires these up and adds new overlays.

---

## Spacing Scale

Declared values (multiples of 4 — match Tailwind defaults already in use):

| Token | Value | Usage in Phase 5 |
|-------|-------|------------------|
| xs | 4px | Cursor label padding, dot-vote dot gap |
| sm | 8px | Avatar stack overlap offset, vote chip padding |
| md | 16px | Default modal/control padding (invitation modal, vote controls) |
| lg | 24px | InviteCollaboratorModal section gaps |
| xl | 32px | Modal vertical rhythm |
| 2xl | 48px | (unused this phase) |
| 3xl | 64px | (unused this phase) |

**Exceptions:**
- Avatar stack overlap: -8px negative margin (visual stacking only — not a spacing token)
- Live cursor hotspot: 2px stroke (decorative SVG, not layout)

---

## Typography

Use existing Tailwind defaults — no new sizes introduced.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 16px (`text-base`) | 400 (`font-normal`) | 1.5 | Modal body, invitation form |
| Label | 14px (`text-sm`) | 500 (`font-medium`) | 1.4 | Vote count, role selector, cursor name labels |
| Heading | 20px (`text-xl`) | 600 (`font-semibold`) | 1.2 | Modal titles ("Invite collaborator") |
| Display | 28px (`text-3xl`) | 600 (`font-semibold`) | 1.2 | (unused this phase) |

**Constraint:** No new font sizes. No more than 2 weights (400, 600) plus the existing 500 used for labels.

---

## Color

Mapped to existing `tailwind.config.js` tokens.

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Dominant (60%) | `canvas.primary` | #FAFBFC | Page surfaces, modal backgrounds |
| Secondary (30%) | `graphite.100` / `neutral.150` | #F3F4F6 / #F4F6F8 | Cards, locked-card overlay tint, vote chip background |
| Accent (10%) | `brand.primary` | #000000 | Primary CTA only ("Send invite", "Cast vote") |
| Destructive | `red-600` (Tailwind default) | #DC2626 | "Remove collaborator", "Revoke invite" |

**Accent reserved for:**
1. Primary CTA button in `InviteCollaboratorModal` ("Send invite")
2. Active dot indicator in vote controls (filled dot = cast)
3. Selected role pill in role picker

**NOT accent (must use graphite/neutral):**
- Cursor colors (deterministic HSL hash per user — see Live Cursors below)
- Presence avatar borders
- Soft-lock overlay (uses `graphite.300` @ 40% opacity)
- Reconnecting indicator (uses `graphite.500`)

### Live Cursor Colors (special palette — not part of 60/30/10)

Deterministic per `user_id` via HSL hash: `hsl((hash % 360), 70%, 50%)`. Cursor color is **identity**, not brand accent. Maximum 8 distinct hues displayed; additional users wrap.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA — invite | **Send invite** |
| Primary CTA — accept | **Join project** |
| Primary CTA — vote | **Cast vote** (or tap-to-toggle dot, no button) |
| Empty state heading — no collaborators | **Just you so far** |
| Empty state body — no collaborators | Invite teammates by email to brainstorm together. Each invite expires in 7 days. |
| Empty state heading — no votes yet | **No votes yet** |
| Empty state body — no votes yet | You have 5 dots to spend. Tap an idea to cast a vote. |
| Reconnecting indicator | **Reconnecting…** (subtle, graphite.500, no icon spin storm) |
| Reconnected toast | **Back online. Synced.** (auto-dismiss 2s) |
| Error — invite send failed | **Couldn't send invite.** Check the email address and try again. |
| Error — invalid/expired token | **This invite link is no longer valid.** Ask the project owner for a new one. |
| Error — vote budget exhausted | **You've used all 5 votes.** Remove one to cast another. |
| Soft-lock tooltip on locked card | **{Name} is moving this** |
| Destructive — remove collaborator | **Remove {name}?** They'll lose access to this project immediately. → Button: **Remove access** |
| Destructive — revoke invite | **Revoke this invite?** The link will stop working. → Button: **Revoke invite** |

**Voice rules:**
- Use the user's first name in soft-lock tooltips and removal confirmations.
- Never say "user" — say "teammate", "collaborator", or use the name.
- Never use "Are you sure?" — state the consequence directly.

---

## Component Inventory (new + reused)

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| `PresenceIndicators.tsx` | reuse + extend | `src/components/brainstorm/` | Add `scope` prop ("session" \| "project") |
| `ProjectPresenceStack.tsx` | NEW | `src/components/matrix/` | Avatar stack on matrix view, max 5 visible + "+N" overflow |
| `LiveCursorsLayer.tsx` | NEW | `src/components/matrix/` | Absolutely-positioned SVG cursor + label per remote user |
| `DotVoteControls.tsx` | NEW | `src/components/brainstorm/` | 5-dot budget chip on each idea card |
| `DotBudgetIndicator.tsx` | NEW | `src/components/brainstorm/` | Header chip: "3 / 5 votes used" |
| `LockedCardOverlay.tsx` | NEW | `src/components/matrix/` | Grayscale + tooltip when remote user is dragging |
| `ReconnectingBadge.tsx` | NEW | `src/components/shared/` | Subtle top-of-viewport pill |
| `InviteCollaboratorModal.tsx` | reuse + wire | `src/components/` | 310 lines exist; wire to `/api/invitations` |
| `InvitationAcceptPage.tsx` | NEW | `src/pages/` | Token landing page → signup → join |
| `RolePicker.tsx` | NEW | `src/components/` | Viewer / Editor segmented control inside invite modal |

---

## Interaction Contracts

### Presence avatars
- Stack max 5 visible, 32px diameter, -8px overlap, 2px white border
- Overflow chip: `+N` with `graphite.200` background, `graphite.700` text
- Hover: tooltip with full name (use existing Tooltip component if present, else native title)
- Self-presence appears first, slightly larger ring (no extra color)

### Dot voting
- Idea card shows 5 dot slots; filled = `brand.primary`, empty = `graphite.300`
- Tap a dot to toggle. Optimistic update; rollback on RLS rejection with error toast
- Budget indicator in session header updates in realtime
- Reaching 5/5 disables empty dots on other cards (cursor: not-allowed) — no error until user actually clicks

### Live cursors
- 16px SVG arrow + 4px-padded name label below-right
- Smooth interpolation between broadcast frames (CSS transition 80ms linear)
- Fade out after 2s of no movement, fully remove on Presence leave
- Own cursor: never rendered (browser already shows it)

### Soft drag lock
- Locked card: `graphite.300` @ 40% overlay, pointer-events: none, cursor: not-allowed
- Small badge in top-right of card with first name of holder
- Auto-release after 10s if no further broadcast OR on Presence leave
- Holder's own card is **not** dimmed for the holder

### Reconnecting state
- Subtle pill at top-center: `graphite.100` background, `graphite.700` text, `graphite.500` dot (NO spinner thrash)
- Appears after 1.5s of disconnect (avoid flashing on quick blips)
- Auto-dismisses on reconnect with brief "Back online. Synced." toast

### Invitation modal
- Reuse existing `InviteCollaboratorModal.tsx` chrome
- Add `RolePicker` (Viewer / Editor segmented control, default Editor)
- Email input → validate via `validator` package on blur
- Submit shows inline spinner on the **Send invite** button (not full-page loader)
- Success: clear form, show inline confirmation "Invite sent to {email}", keep modal open for batch invites

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none — shadcn not initialized | not applicable |
| third-party | none | not applicable |

No third-party UI registries used. All components are in-house and consume existing Tailwind tokens. No `npx shadcn view` gate required.

---

## Accessibility Contract

- All new interactive elements: keyboard reachable, visible focus ring (`focus:ring-2 focus:ring-graphite-700`)
- Cursor labels and presence avatars have `aria-label` with the user's name
- Locked cards announce "Locked by {name}" via `aria-live="polite"` region (single shared region for the matrix)
- Dot vote dots are `<button>` elements with `aria-label="Cast vote (3 of 5 used)"` and `aria-pressed`
- Reconnecting badge uses `role="status"` `aria-live="polite"` (NOT assertive — must not interrupt)
- Color contrast: all text on graphite/canvas surfaces meets WCAG AA (graphite.700 on canvas.primary = 9.4:1)

---

## Out of Scope (deferred — do not design)

- Cursor tracking history / playback
- Per-user vote color (all dots are brand.primary)
- Animated avatar transitions
- Custom invitation email template design (EmailJS template lives in EmailJS console)
- Tier-based UI gating (Phase 6 owns billing UI)
- Activity feed (v2)
- Comments on ideas (v2)

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
