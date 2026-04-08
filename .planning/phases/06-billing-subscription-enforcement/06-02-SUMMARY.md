---
phase: 06-billing-subscription-enforcement
plan: 02
subsystem: billing
tags: [middleware, quota, subscription, fail-closed]
requires: ["06-01"]
provides:
  - "withQuotaCheck(resource, handler) middleware factory"
  - "QuotaRequest / QuotaResource / QuotaContext types"
  - "SubscriptionCheckError named class for fail-closed detection"
  - "subscriptionService.incrementAiUsage(userId, client?)"
  - "Optional SupabaseClient injection on every server-facing subscriptionService method"
  - "Real getTeamMemberCount via project_collaborators (no more stub of 1)"
affects:
  - api/_lib/middleware/index.ts
  - src/lib/services/subscriptionService.ts
key-files:
  created:
    - api/_lib/middleware/withQuotaCheck.ts
    - api/_lib/middleware/__tests__/withQuotaCheck.test.ts
    - src/lib/services/__tests__/subscriptionService.test.ts
  modified:
    - src/lib/services/subscriptionService.ts
    - api/_lib/middleware/index.ts
decisions:
  - "Service methods accept optional SupabaseClient — middleware ALWAYS injects the service-role admin client, fixing verifier Blocker 4 (anon-key fail-open under RLS)"
  - "checkLimit wraps all internal failures as SubscriptionCheckError so the middleware can deterministically deny on throw"
  - "402 Payment Required for quota_exceeded (per research §3) — NOT 429 Too Many Requests"
  - "Increment is best-effort, post-success, ai_ideas only (D-12); failures logged not returned"
  - "getMonthlyAIUsage now goes through get_current_ai_usage RPC (D-05 read-path reset)"
  - "getTeamMemberCount counts project_collaborators across user-owned projects (D-07)"
metrics:
  tasks: 2
  files: 5
  duration: ~25m
  completed: 2026-04-07
---

# Phase 6 Plan 02: Quota Middleware Summary

Built `withQuotaCheck` quota enforcement middleware and patched `subscriptionService` to support service-role client injection, eliminating the silent anon-key fail-open path identified as verifier Blocker 4. The middleware is now ready to wrap mutation endpoints in Wave 3.

## What changed

### subscriptionService.ts
- New exported class `SubscriptionCheckError(reason, cause?)` so callers can detect-and-deny.
- Every server-facing method (`getSubscription`, `createSubscription`, `updateSubscription`, `checkLimit`, `getProjectCount`, `getMonthlyAIUsage`, `getTeamMemberCount`, `getUserIdFromStripeCustomer`, `getStripeCustomerId`, `saveStripeCustomerId`, `getSubscriptionWithLimits`) accepts an optional `client?: SupabaseClient` parameter. When provided, all queries route through that client and never the module-level anon singleton.
- New `incrementAiUsage(userId, client?)` calls the `increment_ai_usage` RPC.
- `getMonthlyAIUsage` now calls `get_current_ai_usage` RPC (D-05 read-path reset) instead of inlining a usage_tracking SELECT.
- `getTeamMemberCount` now counts `project_collaborators` rows across the caller's owned projects (D-07) — no more stubbed `return 1`.
- `checkLimit` wraps all unexpected throws as `SubscriptionCheckError('check_limit_failed', cause)` so the middleware fails closed deterministically.

### withQuotaCheck.ts (new)
Signature: `withQuotaCheck(resource: 'projects' | 'ai_ideas' | 'users', handler)`

Pipeline:
1. Extract bearer from `sb-access-token` cookie or `Authorization: Bearer …` header.
2. Construct service-role admin client (`SUPABASE_SERVICE_ROLE_KEY`).
3. `adminClient.auth.getUser(token)` → 401 on failure.
4. `subscriptionService.getSubscription(userId, adminClient)` → tier resolution.
5. `subscriptionService.checkLimit(userId, resource, adminClient)` — any throw returns 500 `QUOTA_CHECK_FAILED` (BILL-03 fail-closed).
6. If `!check.canUse` → 402 with body:
   ```json
   {
     "error": {
       "code": "quota_exceeded",
       "message": "You've reached your <resource> limit for this plan.",
       "resource": "ai_ideas",
       "limit": 5,
       "used": 5,
       "tier": "free",
       "upgradeUrl": "/pricing"
     }
   }
   ```
7. Otherwise attaches `req.quota = { userId, tier, limit, used, isUnlimited }`, runs the handler.
8. After 2xx, for `ai_ideas` only, calls `subscriptionService.incrementAiUsage(userId, adminClient)` best-effort (D-12).

### api/_lib/middleware/index.ts
Re-exports `withQuotaCheck` and its types alongside the existing middleware barrel.

## Tests
- `src/lib/services/__tests__/subscriptionService.test.ts` — 9 tests covering client injection, RPC wiring, real team count, error wrapping, default fallback. The supabase singleton is mocked at module scope and asserted to never be called when an explicit client is injected.
- `api/_lib/middleware/__tests__/withQuotaCheck.test.ts` — 11 tests covering 401/402/500/handler-invocation/post-success increment ordering/skip-on-non-ai/skip-on-error/admin client forwarding. The post-success-after-handler ordering is asserted via a callOrder array.

```
✓ src/lib/services/__tests__/subscriptionService.test.ts (9 tests)
✓ api/_lib/middleware/__tests__/withQuotaCheck.test.ts (11 tests)
```

## Deviations from Plan
- Mock plumbing for both test suites had to use vitest's hoisted-friendly pattern (mock factory exposes spies on the module export, then test imports them via `import * as`) because top-level `const` references inside `vi.mock` factories trigger ReferenceErrors due to hoisting. Functionality unchanged; only test structure differs from plan's "spy directly" sketch. Logged as Rule 3 (blocking issue).
- Plan referenced `recordUsage` in the optional-client list; the existing service had no such method, so it wasn't added (no caller needs it; `incrementAiUsage` covers the post-success path).

## Self-Check: PASSED
- api/_lib/middleware/withQuotaCheck.ts: FOUND
- api/_lib/middleware/__tests__/withQuotaCheck.test.ts: FOUND
- src/lib/services/__tests__/subscriptionService.test.ts: FOUND
- subscriptionService.ts contains `SubscriptionCheckError`, `incrementAiUsage`, `client?: SupabaseClient`: FOUND
- index.ts re-exports `withQuotaCheck`: FOUND
- Both vitest suites green (9 + 11 = 20 tests)
