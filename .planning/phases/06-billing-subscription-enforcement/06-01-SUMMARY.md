---
phase: 06-billing-subscription-enforcement
plan: 01
subsystem: billing
tags: [schema, migration, supabase, rls, quota]
requires: []
provides:
  - "public.subscriptions table"
  - "public.usage_tracking table"
  - "public.user_notifications table"
  - "public.stripe_webhook_events table"
  - "public.increment_ai_usage(uuid) RPC"
  - "public.get_current_ai_usage(uuid) RPC"
  - "SubscriptionStatus union includes 'trialing'"
affects:
  - src/lib/config/tierLimits.ts
key-files:
  created:
    - supabase/migrations/20260408160000_billing_schema.sql
  modified:
    - src/lib/config/tierLimits.ts
decisions:
  - "Honored existing table names (subscriptions, usage_tracking) to match subscriptionService.ts queries"
  - "Used 14-digit timestamp 20260408160000 to sit after Phase 05.x migrations and avoid history reconciliation"
  - "SECURITY DEFINER funcs set search_path = public, extensions (Phase 05.3 lesson)"
  - "RLS policies are select_own only; writes restricted to service role"
metrics:
  tasks: 1
  files: 2
  duration: ~5m
  completed: 2026-04-08
---

# Phase 6 Plan 01: Billing Schema Migration Summary

Created the foundational billing schema (subscriptions, usage_tracking, user_notifications, stripe_webhook_events) plus atomic quota RPCs (`increment_ai_usage`, `get_current_ai_usage`) in a single idempotent migration. Extended the TypeScript `SubscriptionStatus` union with `'trialing'` to match the new DB CHECK constraint.

## Tables Created
- `public.subscriptions` — PK user_id, tier/status CHECKs, past_due_since for D-17 grace period
- `public.usage_tracking` — composite PK (user_id, resource_type), shape matches existing subscriptionService.getMonthlyAIUsage query
- `public.user_notifications` — typed notifications with partial index on unread rows
- `public.stripe_webhook_events` — idempotency ledger, no SELECT policy

## Functions
- `increment_ai_usage(p_user_id uuid) → int` — atomic upsert; resets to 1 when stored period_start is older than current month
- `get_current_ai_usage(p_user_id uuid) → int` — read-path reset returning 0 for stale periods

Both `SECURITY DEFINER` with `SET search_path = public, extensions`, granted to `authenticated, service_role`.

## RLS
- `subscriptions_select_own`, `usage_tracking_select_own`, `user_notifications_select_own`, `user_notifications_update_own`
- All write paths restricted to service role (no INSERT/UPDATE/DELETE policies for end users)
- No cross-table cycles (Phase 05.3 lesson respected)

## Deviations from Plan
- Migration timestamp adjusted from `20260408000000` to `20260408160000` because earlier Phase 05.x migrations already occupy `20260408000000`–`20260408150000`. New timestamp keeps the migration strictly after applied history, satisfying the 14-digit-prefix guidance.
- Migration file required `git add -f` because `supabase/migrations/` is gitignored in this repo.

## Self-Check: PASSED
- supabase/migrations/20260408160000_billing_schema.sql: FOUND
- src/lib/config/tierLimits.ts trialing literal: FOUND
- Commit da54246: FOUND
