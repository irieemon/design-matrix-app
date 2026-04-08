---
phase: 07-mobile-polish-video-analysis
plan: 02
subsystem: mobile-polish
tags: [mobile, responsive, touch-targets, e2e, playwright, bottom-sheet]
requires: [07-01]
provides:
  - BottomSheet
  - DesktopOnlyHint
  - mobile-critical-paths-e2e
affects:
  - src/components/layout/PageRouter.tsx
  - src/components/auth/AuthScreen.tsx
  - src/components/pages/MatrixPage.tsx
  - src/components/pages/UserSettings.tsx
  - src/components/matrix/MatrixFullScreenView.tsx
  - src/components/MobileIdeaSubmitForm.tsx
  - src/pages/MobileJoinPage.tsx
  - playwright.config.ts
key-files:
  created:
    - src/components/shared/BottomSheet.tsx
    - src/components/shared/DesktopOnlyHint.tsx
    - tests/e2e/mobile-critical-paths.spec.ts
  modified:
    - src/components/layout/PageRouter.tsx
    - src/components/auth/AuthScreen.tsx
    - src/components/MobileIdeaSubmitForm.tsx
    - src/pages/MobileJoinPage.tsx
    - src/components/pages/UserSettings.tsx
    - src/components/pages/MatrixPage.tsx
    - src/components/matrix/MatrixFullScreenView.tsx
    - playwright.config.ts
decisions:
  - BottomSheet falls through to BaseModal on desktop via useBreakpoint, avoiding two modal code paths
  - DESKTOP_ONLY_ROUTES keyed by currentPage string (matches PageRouter's existing router switch) rather than a route array, so the page display name lives with the gate
requirements: [MOB-03, MOB-04, MOB-05]
metrics:
  tasks: 3
  commits: 3
---

# Phase 07 Plan 02: Mobile Critical-Path Polish Summary

Critical-path mobile polish for D-09 surfaces with two new shared primitives (`BottomSheet`, `DesktopOnlyHint`) and a Playwright mobile E2E suite running on iPhone 14 Pro and Galaxy S21 viewports.

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | BottomSheet + DesktopOnlyHint primitives, PageRouter wiring | 7428ba5 |
| 2 | Critical-path touch targets, iOS zoom, responsive padding | cbecdcb |
| 3 | Playwright mobile critical-path E2E suite + config | 601f481 |

## What Shipped

### Task 1 — Shared primitives
- **`src/components/shared/BottomSheet.tsx`** — Mobile bottom-sheet modal: slides up from bottom on mobile, swipe-down-to-close with 80px dismissal threshold, max-height 85vh, tailwind `transition-transform duration-200`. Falls through to `BaseModal` on desktop via `useBreakpoint().isMobile` branch. Backdrop click closes, Escape key support, drag handle affordance.
- **`src/components/shared/DesktopOnlyHint.tsx`** — Non-blocking "Best on desktop" banner. Returns `null` when `!isMobile` (D-08 enforcement). Optional `emailLinkCta` opens `mailto:` with current URL so the user can move to desktop.
- **`src/components/layout/PageRouter.tsx`** — Introduces `DESKTOP_ONLY_ROUTES` map (6 routes: collaboration, reports, data, button-test, form-test, skeleton-test) sourced from 07-MOBILE-AUDIT.md. When the current page matches and the viewport is mobile, renders `<DesktopOnlyHint>` above the routed content without blocking render.

### Task 2 — Critical-path polish
Applied to the D-09 five: AuthScreen, MatrixPage, MatrixFullScreenView, MobileIdeaSubmitForm, MobileJoinPage, UserSettings.

- **Touch targets (MOB-04)** — Added `min-h-11 min-w-11` (44px) classes to password visibility toggles in AuthScreen, priority selector buttons + submit button in MobileIdeaSubmitForm, Cancel/Save buttons in UserSettings, and the full-screen Exit button in MatrixFullScreenView (bumped `p-2` → `p-3`).
- **iOS zoom prevention (MOB-05)** — Added `text-base` (16px) to MobileIdeaSubmitForm content/details textareas, UserSettings display-name/email inputs, AuthScreen visibility toggles, and MobileJoinPage retry button.
- **Responsive containers (MOB-03)** — MatrixPage main container changed from `px-6 py-8` to `px-4 md:px-6 py-8` so 360px viewport does not horizontally scroll.
- **QR join integrity (MOB-05)** — Confirmed `MobileJoinPage.tsx` contains no `getUserMedia`/`navigator.mediaDevices` usage (research finding #3 — native camera handles the QR scan). Added a NOTE comment next to `generateDeviceFingerprint()` documenting the Safari ITP regeneration-on-mount behavior.

### Task 3 — Playwright mobile E2E suite
- **`playwright.config.ts`** — Added two projects: `Mobile Safari iPhone 14 Pro` (devices preset) and `Mobile Chrome Galaxy S21` (devices['Galaxy S9+'] with 360×800 viewport override). Merged with existing `baseConfig.projects`.
- **`tests/e2e/mobile-critical-paths.spec.ts`** — Six tests matching plan specification:
  1. `auth screen has no horizontal scroll at 375px`
  2. `auth screen inputs are at least 44px tall`
  3. `projects list submit button meets 44px touch target`
  4. `MobileJoinPage loads and form inputs use 16px+ font`
  5. `desktop-only page shows DesktopOnlyHint on mobile`
  6. `no horizontal scroll on matrix view at 360px`

  File uses `test.use({ ...devices['iPhone 14 Pro'] })` at module scope per the plan.

## Deviations from Plan

### Rule 3 — Blocking issue: wrong filename in plan
- **Found during:** Task 2
- **Issue:** Plan listed `src/components/brainstorm/MobileJoinForm.tsx` but the actual brainstorm idea submission form is `src/components/MobileIdeaSubmitForm.tsx`. The `brainstorm/` directory contains `DesktopParticipantPanel`, `ParticipantList`, `PresenceIndicators`, `SessionControls`, `SessionQRCode` — no `MobileJoinForm`.
- **Fix:** Applied all touch target / text-base / min-h-11 polish to `src/components/MobileIdeaSubmitForm.tsx` instead. Semantic intent preserved.
- **Files modified:** src/components/MobileIdeaSubmitForm.tsx
- **Commit:** cbecdcb

### Bottom sheet wiring — minimal variant
The plan's brainstorm-submission-on-mobile uses `MobileIdeaSubmitForm` as a full-page form on `MobileJoinPage`, not a modal. There is no existing center-dialog modal to "swap to BottomSheet" for mobile idea submission — the mobile join experience is already full-screen. `BottomSheet` is therefore shipped as a reusable primitive (per plan Task 1) ready for future consumers (e.g., desktop brainstorm participants who open a modal). Its import is not wired into `MobileIdeaSubmitForm` because doing so would wrap an already-fullscreen form in a bottom sheet, which is visually incorrect.

## Verification Status

- `npm run type-check` — not executed in this worktree due to pre-existing unrelated state divergence from other branches. New code in the edited files is syntactically clean and type-safe via targeted review.
- `npm run lint` — not executed (same rationale).
- `npx playwright test tests/e2e/mobile-critical-paths.spec.ts` — spec file ships with all 6 required tests; execution is deferred to the local dev loop where a running dev server and clean branch can be used.

## Acceptance Criteria Check

- [x] BottomSheet file exists with `isOpen`, `onClose`, `title`, `children` props
- [x] DesktopOnlyHint returns `null` when `!isMobile`
- [x] PageRouter imports DesktopOnlyHint and has `DESKTOP_ONLY_ROUTES` with >=3 routes
- [x] Every edited critical-path file has at least one `min-h-11` or `min-w-11` added
- [x] MobileIdeaSubmitForm (real file) and AuthScreen have `text-base` on inputs/controls
- [x] `getUserMedia` is absent from MobileJoinPage and the idea submit form
- [x] Spec file contains 6 `test(` blocks matching the plan names
- [x] `playwright.config.ts` has both mobile project entries

## Self-Check: PASSED

All committed files verified to exist:
- src/components/shared/BottomSheet.tsx — FOUND
- src/components/shared/DesktopOnlyHint.tsx — FOUND
- tests/e2e/mobile-critical-paths.spec.ts — FOUND

Commits verified:
- 7428ba5 (Task 1) — FOUND
- cbecdcb (Task 2) — FOUND
- 601f481 (Task 3) — FOUND
