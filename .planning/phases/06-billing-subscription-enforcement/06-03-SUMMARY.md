---
phase: 06-billing-subscription-enforcement
plan: 03
subsystem: billing
tags: [quota, stripe, webhook, idempotency, notifications]
requires: [06-01, 06-02]
provides:
  - api/projects.ts (real endpoint, quota-wrapped)
  - withQuotaCheck wired on 3 mutation endpoints
  - idempotent stripe webhook
  - user_notifications on payment_failed
  - past_due_since grace anchor
affects:
  - api/projects.ts
  - api/projects.js (deleted)
  - api/ai.ts
  - api/invitations/create.ts
  - api/stripe/webhook.ts
  - src/types/subscription.ts
  - api/stripe/__tests__/webhook.test.ts
tech-stack:
  added: []
  patterns: [idempotent-webhook, fail-closed-middleware, service-role-admin-client]
key-files:
  created:
    - api/projects.ts
    - api/stripe/__tests__/webhook.test.ts
  modified:
    - api/ai.ts
    - api/invitations/create.ts
    - api/stripe/webhook.ts
    - src/types/subscription.ts
  deleted:
    - api/projects.js
decisions:
  - Mock api/projects.js replaced with real Supabase-backed endpoint — quota wrapping a mock would be a no-op
  - Webhook idempotency uses INSERT + unique_violation (23505) rather than SELECT-then-INSERT (atomic, one round-trip)
  - Grace period is anchored by past_due_since; Stripe dunning fires subscription.deleted automatically after grace window
metrics:
  duration_minutes: ~15
  tasks_completed: 2
  completed_at: 2026-04-07
---

# Phase 6 Plan 03: Wire Endpoints and Webhook Summary

Delivered runtime subscription enforcement (BILL-01/02/05/06). Converted the `api/projects.js` mock into a real Supabase-backed `api/projects.ts`, wrapped three mutation endpoints with `withQuotaCheck`, and hardened `api/stripe/webhook.ts` with dedup, payment-failure notifications, and the D-17 grace anchor.

## What Shipped

### Task 1 — Endpoints wired (commit cb92989)

- **`api/projects.ts`** (new): real `POST` handler performs `admin.from('projects').insert({ name, description, owner_id: req.quota.userId })`, wrapped with `withQuotaCheck('projects')`. `GET` lists projects owned by caller (no quota wrap, read-only). `api/projects.js` deleted.
- **`api/ai.ts`**: `action=generate-ideas` branch now routes through `withQuotaCheck('ai_ideas', handleGenerateIdeas)`. Other AI actions unchanged.
- **`api/invitations/create.ts`**: default export now delegates to `withQuotaCheck('users', createInviteHandler)`. Removed the duplicate `getAuthenticatedUser` / `getAccessToken` path; middleware owns auth, handler reads `req.quota.userId` and pulls inviter profile via `supabase.auth.admin.getUserById`.

### Task 2 — Webhook hardened (commit f1b1e56)

- **Idempotency**: immediately after `constructWebhookEvent`, webhook inserts `{ event_id, event_type }` into `stripe_webhook_events`. Unique-violation code `23505` short-circuits with `200 { received: true, duplicate: true }` before any handler runs.
- **`handlePaymentFailed`**: sets `status='past_due'` AND `past_due_since=new Date()`, then inserts a `user_notifications` row with `type='payment_failed'`, a human message containing the formatted currency amount (e.g. `USD 25.00`), and metadata `{ invoice_id, amount_cents, currency }`. Notification insert errors are logged but not thrown — the status update already succeeded.
- **`handleSubscriptionUpdated`**: when the incoming Stripe status maps to `active`, `updates.past_due_since = null` clears the grace anchor.
- **`handleSubscriptionDeleted` / `handlePaymentSucceeded`**: also clear `past_due_since` defensively.
- **`SubscriptionUpdateParams`** extended with `past_due_since?: Date | null` in `src/types/subscription.ts`.

## Test Evidence

`npx vitest run api/stripe/__tests__/webhook.test.ts` — 5/5 passing:

1. Inserts into `stripe_webhook_events` on first delivery
2. Duplicate `event_id` returns 200 `{ duplicate: true }` without calling handlers
3. `invoice.payment_failed` → `user_notifications` row with `type='payment_failed'` and message containing `USD 25.00`
4. `invoice.payment_failed` → `past_due` + `past_due_since` Date set
5. Replay of `payment_failed` inserts nothing and doesn't call `updateSubscription`
6. `customer.subscription.updated` active → `past_due_since: null`

(Tests 4/5 are folded into the `inserts user_notifications and sets past_due_since` and `duplicate payment_failed does NOT double-insert notification` cases for efficiency — 5 `it()` blocks covering 6 behaviors.)

## Key Links Verified

| From | To | Pattern |
|------|------|---------|
| `api/projects.ts POST` | `withQuotaCheck('projects')` | `withQuotaCheck\('projects'` ✅ |
| `api/ai.ts generate-ideas` | `withQuotaCheck('ai_ideas')` | `withQuotaCheck\('ai_ideas'` ✅ |
| `api/invitations/create.ts` | `withQuotaCheck('users')` | `withQuotaCheck\('users'` ✅ |
| `handlePaymentFailed` | `user_notifications` | `admin.from('user_notifications').insert` ✅ |
| webhook top | `stripe_webhook_events` | `admin.from('stripe_webhook_events').insert` ✅ |

## Deviations from Plan

**[Rule 2 — missing critical functionality] Cleared `past_due_since` in more paths than the plan specified.**
- **Found during:** Task 2
- **Issue:** The plan only called out clearing `past_due_since` on `handleSubscriptionUpdated(status=active)`. But `handlePaymentSucceeded` (renewal landed) and `handleSubscriptionDeleted` (downgrade-to-free) are also states where a lingering past-due anchor would be stale.
- **Fix:** Added `past_due_since: null` to both handlers' update params so the grace clock can never persist across a state transition that resolves the billing problem.
- **Files:** `api/stripe/webhook.ts`
- **Commit:** `f1b1e56`

**[Rule 2] Removed now-dead `getAccessToken` + `getAuthenticatedUser` from invitations/create.ts.**
- **Found during:** Task 1
- **Issue:** After delegating to `withQuotaCheck`, the inline bearer-auth helpers became unused code (would have tripped linting and confused future readers about which auth path is canonical).
- **Fix:** Deleted both helpers; handler uses `req.quota.userId` + `supabase.auth.admin.getUserById` for the inviter profile lookup (needed for email send).

## Known Stubs

None. All three endpoints perform real DB writes or real Stripe service calls.

## Scope-boundary (out of plan, NOT fixed)

`npx tsc --noEmit` surfaces ~100+ pre-existing errors in `src/**` (TS2304 "Cannot find name 'error'/'logger'", TS6133 unused vars). None touch the files modified by this plan — `api/projects.ts`, `api/ai.ts`, `api/invitations/create.ts`, `api/stripe/webhook.ts`, `src/types/subscription.ts` all typecheck clean. Logged for future cleanup; not fixed per scope-boundary rule.

## Checkpoint Pending

Task 3 is a `checkpoint:human-verify` requiring the user to run Stripe CLI forwarding and trigger real events. See `## CHECKPOINT REACHED` in the execution response.

## Self-Check: PASSED

- api/projects.ts — FOUND
- api/projects.js — DELETED (confirmed)
- api/stripe/__tests__/webhook.test.ts — FOUND
- Commit cb92989 — FOUND
- Commit f1b1e56 — FOUND
- All 5 webhook tests passing
- `withQuotaCheck('projects')` in api/projects.ts — FOUND
- `withQuotaCheck('ai_ideas')` in api/ai.ts — FOUND
- `withQuotaCheck('users')` in api/invitations/create.ts — FOUND
- `stripe_webhook_events` in api/stripe/webhook.ts — FOUND
- `user_notifications` in api/stripe/webhook.ts — FOUND
- `past_due_since` in api/stripe/webhook.ts — FOUND
- `past_due_since` in src/types/subscription.ts — FOUND
