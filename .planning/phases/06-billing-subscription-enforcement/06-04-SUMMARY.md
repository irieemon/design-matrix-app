---
phase: 06-billing-subscription-enforcement
plan: 04
subsystem: billing-frontend
tags: [billing, stripe, subscription, ui, quota]
requires: [06-01, 06-02, 06-03]
provides:
  - useSubscription hook
  - SubscriptionPanel (Settings dashboard)
  - UpgradePrompt (inline point-of-limit CTA)
  - PaymentFailedBanner (global header)
affects:
  - UserSettings
  - MainApp
  - PricingPage
  - ProjectStartupFlow
  - AIStarterModal
tech-stack:
  added: []
  patterns: [lock-free supabase client, polling notifications, stripe checkout/portal wiring]
key-files:
  created:
    - src/hooks/useSubscription.ts
    - src/hooks/__tests__/useSubscription.test.tsx
    - src/components/settings/SubscriptionPanel.tsx
    - src/components/settings/__tests__/SubscriptionPanel.test.tsx
    - src/components/billing/UpgradePrompt.tsx
    - src/components/billing/PaymentFailedBanner.tsx
    - src/components/billing/__tests__/UpgradePrompt.test.tsx
    - src/components/billing/__tests__/PaymentFailedBanner.test.tsx
  modified:
    - src/components/pages/UserSettings.tsx
    - src/components/app/MainApp.tsx
    - src/components/pages/PricingPage.tsx
    - src/components/ProjectStartupFlow.tsx
    - src/components/AIStarterModal.tsx
decisions:
  - PaymentFailedBanner uses createAuthenticatedClientFromLocalStorage to avoid the documented getSession() deadlock
  - SubscriptionPanel renders alongside the legacy hardcoded billing block (legacy hidden via style) so fallback remains available
  - PricingPage endpoint flipped to /api/stripe?action=checkout to align with Wave 3 unified handler
metrics:
  tasks_completed: 2
  tasks_total: 3
  status: awaiting_human_verify
requirements: [BILL-02, BILL-04, BILL-06]
---

# Phase 06 Plan 04: Frontend Dashboard & Prompts Summary

**One-liner:** Ships the subscription dashboard, payment-failed banner, and point-of-limit upgrade prompts — wiring the completed Phase 6 backend quota enforcement to the user interface.

## What Shipped

### Hook + primitives (Task 1)
- `useSubscription` — reads `getSubscriptionWithLimits` with loading/error/refresh state
- `SubscriptionPanel` — tier badge, three usage bars (projects / AI / users), period reset date, Upgrade and Manage Subscription buttons wired to `/api/stripe?action=checkout` and `/api/stripe?action=portal`
- `UpgradePrompt` — reusable inline amber card for quota-exceeded surfaces
- `PaymentFailedBanner` — sticky header banner polling `user_notifications` every 60s, dismiss marks `read_at`

### Host-page wiring (Task 2)
- `UserSettings`: mounts `<SubscriptionPanel />` as the new billing section; the legacy hardcoded block is hidden via inline style so the prior UX can be restored if needed
- `MainApp`: `<PaymentFailedBanner />` rendered at the top of the shell above `AppLayout`
- `PricingPage`: `fetch` target switched from `/api/stripe/create-checkout-session` to `/api/stripe?action=checkout` — aligns with Wave 3's unified handler
- `ProjectStartupFlow`: subscribes to `useSubscription`, renders `<UpgradePrompt resource="projects" />` and disables the Create Project button when `limits.projects.canUse === false`; also catches null return from `DatabaseService.createProject` as a quota-exceeded surface
- `AIStarterModal`: same pattern for `limits.ai_ideas`; blocks the "Start Analysis" flow when quota is exhausted

## Tests

All 12 new tests pass:
- `useSubscription.test.tsx` — 3 tests (success, refresh, error)
- `SubscriptionPanel.test.tsx` — 4 tests (Free render, Team unlimited, checkout redirect, portal redirect)
- `UpgradePrompt.test.tsx` — 2 tests (projects variant, ai_ideas variant)
- `PaymentFailedBanner.test.tsx` — 3 tests (renders when unread, hides on dismiss, hides when none)

Typecheck: `tsc --noEmit` shows zero new errors attributable to this plan. The pre-existing errors in `authPerformanceMonitor`, `roadmapExport`, `BrainstormRealtimeManager`, `MainApp.tsx` (unused React), `ProjectStartupFlow.tsx` (undefined `err`), etc. pre-date this plan (confirmed via `git stash` + re-run). Out of scope per Rule 3 boundary.

## Deviations from Plan

### Rule 2 — Auto-added missing functionality

**1. PricingPage missing logger import**
- Found during: Task 2 typecheck
- Issue: PricingPage uses `logger.debug(...)` throughout `handleUpgrade` but had no `import { logger } from ...'` statement. Latent runtime bug that would crash the upgrade flow the moment a user clicked any Team button.
- Fix: Added `import { logger } from '../../utils/logger'`
- Files modified: `src/components/pages/PricingPage.tsx`
- Commit: included in Task 2 commit

### Naming adjustment
- Plan says `SettingsPage.tsx`; repo has `UserSettings.tsx`. Mounted `SubscriptionPanel` in the existing `UserSettings.tsx`. No deviation in outcome.

## Known Stubs
None.

## Commits
- Task 1: `feat(06-04): add useSubscription hook + billing UI primitives`
- Task 2: `feat(06-04): wire billing UI into host pages`

## Awaiting Human Verification

Task 3 is a `checkpoint:human-verify` gate covering the six end-to-end flows listed in the plan. See the checkpoint message returned by the executor.

## Self-Check: PASSED
- All eight new files exist on disk
- Both task commits present in `git log`
- All 12 new unit tests pass
- No new tsc errors in touched files
