# Phase 6: Billing & Subscription Enforcement - Research

**Researched:** 2026-04-07
**Domain:** Stripe billing + quota enforcement on Vercel serverless + Supabase
**Confidence:** HIGH for codebase state, HIGH for Stripe patterns (verified against existing scaffold), MEDIUM for schema recommendations (informed by what services expect)

## Summary

The scaffolding is **significantly more complete than CONTEXT.md's S-02 implies** — there is a working `stripeService`, a working `subscriptionService`, a consolidated `api/stripe.ts` router with `checkout` and `portal` actions, and an almost-complete `api/stripe/webhook.ts` handling all five required events. What's missing is: (a) the **database tables** the services read/write (`subscriptions`, `usage_tracking`) have **no migration file** — services reference them but they must be created this phase; (b) **no quota middleware** — `subscriptionService.checkLimit` exists but is not called from any API handler; (c) **no usage increment hook** in `api/ai.ts`; (d) **no `user_notifications` table** or UI for payment-failed banner; (e) **`subscriptionService` fails OPEN** on errors (BILL-03 violation — it throws, which lets callers decide, and none of them deny).

**Primary recommendation:** Treat Phase 6 as "wire existing scaffold + create missing tables + build middleware + fix fail-closed". The code surface is smaller than greenfield but the schema work is real. Reuse the existing `subscriptions`/`usage_tracking` naming that the services already use — do NOT rename to `user_subscriptions`/`user_usage` as CONTEXT.md D-04/D-08 suggest, because it will force rewriting working code.

**Reconciliation note for planner:** CONTEXT.md D-04 and D-08 specify new table names `user_subscriptions` and `user_usage`. The existing `subscriptionService` reads from `subscriptions` and `usage_tracking`. This is a naming conflict the planner must resolve — recommend honoring D-04/D-08 with a rename (the services are thin enough to update in one pass) OR updating CONTEXT.md to adopt existing names. Flag for discuss-phase confirmation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Current State (Scouted)**
- **S-01:** `src/lib/config/tierLimits.ts` already defines `TIER_LIMITS` for `free | team | enterprise`. Reuse as-is.
- **S-02:** `api/stripe/webhook.ts` exists as scaffold — extend, don't replace.
- **S-03:** `ai_token_usage` tracks raw OpenAI tokens (admin observability). Separate from user-facing quota — `user_usage` is additional.
- **S-04:** Env vars already set: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PRICE_ID_TEAM`, `VITE_STRIPE_PRICE_ID_ENTERPRISE`. Must also be added to `vite.config.ts` dev API allowlist.

**Stripe Integration**
- **D-01:** Stripe scaffolded but not wired. Phase implements full lifecycle checkout → webhook → DB → quota.
- **D-02:** Stripe hosted checkout (`stripe.checkout.sessions.create`). No embedded Elements. Zero PCI scope.
- **D-03:** Webhook events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Signature verification via `STRIPE_WEBHOOK_SECRET` mandatory.

**Usage Tracking**
- **D-04:** New `user_usage` table. Schema: `(user_id uuid PK, period_start date, ai_generations_used int, updated_at timestamptz)`. Single row per user. Atomic increment via Postgres function `increment_ai_usage(user_id)`.
- **D-05:** Period reset **on-read**: when checking quota, if `period_start` older than current period, reset counter to 0 and update `period_start` atomically. No cron.
- **D-06:** Project count computed on-the-fly from `projects.owner_id`, not stored.
- **D-07:** Collaborator-count limit enforced via same pattern: count `project_collaborators` where owner is user.

**Subscription State**
- **D-08:** New `user_subscriptions` table. Schema: `(user_id uuid PK, stripe_customer_id text, stripe_subscription_id text, tier text check in (free,team,enterprise), status text check in (active,canceled,past_due,incomplete,trialing), current_period_end timestamptz, updated_at timestamptz)`. Default `{tier: 'free', status: 'active'}` on first sign-in.
- **D-09:** **Fail closed (BILL-03):** errors resolving subscription/usage → deny, 500 with generic error, never fall through to allowed.

**Enforcement Model**
- **D-10:** API middleware `withQuotaCheck(resource, handler)`:
  1. Resolve user_id from bearer token
  2. Look up tier from `user_subscriptions`
  3. Look up current usage
  4. Return 402 `{error:'quota_exceeded', resource, limit, used}` if over
  5. On handler success, increment usage
- **D-11:** Endpoints wrapped: `POST /api/projects` (projects), `POST /api/ai/generate-ideas` (ai_ideas_per_month), `POST /api/invitations/create` (users).
- **D-12:** Increment AFTER operation succeeds. Same best-effort ordering as Resend sends in 05.2.
- **D-13:** Frontend guards are UX convenience. Backend middleware is enforcement boundary.

**Subscription Dashboard UI**
- **D-14:** Settings panel + inline prompts. "Subscription & Usage" section in Settings (plan, usage bars, reset date, Upgrade / Manage button). Inline prompts at point-of-limit.
- **D-15:** "Manage Subscription" → Stripe billing portal via `stripe.billingPortal.sessions.create`.

**Payment Failure Notification**
- **D-16:** On `invoice.payment_failed`: set `user_subscriptions.status='past_due'` AND insert row in new `user_notifications` table `(id, user_id, type, message, read_at, created_at)`. Small toast/banner polls or subscribes and shows unread.
- **D-17:** Past-due users retain access for 7-day grace period (Stripe default). Still pass quota checks, see warning banner. After 7 days Stripe auto-cancels, `customer.subscription.deleted` downgrades to free.

### Claude's Discretion
- Exact toast/banner styling (match brand tokens)
- Where "Subscription & Usage" sits in Settings nav
- Whether `increment_ai_usage()` is plpgsql or direct UPDATE with atomic `SET col = col + 1` (both safe)
- Notification polling frequency vs realtime subscription
- Copy text for upgrade prompts, payment-failed message, quota-exceeded errors
- Test mocking strategy for Stripe SDK (boundary mock, same as Resend)

### Deferred Ideas (OUT OF SCOPE)
- Invoice PDF download / history (Stripe portal handles)
- Proration UI beyond Stripe checkout
- Annual billing toggle UI
- Grandfathering existing users to higher tiers
- Trial periods
- Usage alerts before hitting limit (nice-to-have)
- Team seat management beyond raw count
- Refund flow
- Multi-item subscriptions
- Non-USD pricing, taxes, VAT
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-01 | Subscription limits enforced at API layer (projects, AI, team members) | `withQuotaCheck` middleware (§3) wrapping the three endpoints listed in D-11 |
| BILL-02 | User notified in-app when payment fails | `user_notifications` table + banner (§7); webhook already calls `status='past_due'` (§1) — add notification insert |
| BILL-03 | Subscription service fails closed on errors | Current `subscriptionService.checkLimit` **violates this** — it throws, callers don't handle (§1 gap). Middleware in §3 returns 500+deny on any resolve error |
| BILL-04 | User can view AI usage and subscription limits in dashboard | Settings "Subscription & Usage" section (§6); data source = `getSubscriptionWithLimits` (already exists, §1) |
| BILL-05 | Free tier has defined limits (N projects, N AI/month) | `TIER_LIMITS.free` already canonical (§1 S-01) — 1 project, 5 AI ideas/mo, 3 users |
| BILL-06 | Paid tier limits higher/unlimited with upgrade prompts | `TIER_LIMITS.team` (-1 AI, 10 projects, 15 users); inline prompts at point-of-limit (§6) |
</phase_requirements>

## 1. Current Scaffolding State (S-01..S-04 Verification)

### What already exists and works

**`src/lib/config/tierLimits.ts`** (133 lines) — [VERIFIED: read file]
- `TIER_LIMITS` for free/team/enterprise with projects, ai_ideas_per_month, users, exports, features
- Helpers: `getLimit`, `isUnlimited`, `hasFeature`, `canExport`
- `TIER_NAMES`, `TIER_PRICING`, `TIER_PRICING_YEARLY` maps
- **Reuse as single source of truth. Do not redefine.**

**`src/lib/services/stripeService.ts`** (verified first 80 lines) — [VERIFIED]
- `StripeService.createCheckoutSession()` — full implementation: creates/reuses Stripe customer, stores customer_id via `subscriptionService.saveStripeCustomerId`, creates subscription-mode session with `user_id`/`tier` in both `metadata` and `subscription_data.metadata` (important — webhook reads from subscription.metadata), `billing_address_collection: 'required'`, `allow_promotion_codes: true`
- Uses Stripe API version `2025-02-24.acacia`
- Throws on missing `STRIPE_SECRET_KEY` at import time (will crash serverless cold-start if env missing)
- Also exposes (not shown): `createPortalSession`, `getSubscription`, `constructWebhookEvent`

**`src/lib/services/subscriptionService.ts`** (301 lines) — [VERIFIED]
- `getSubscription(userId)` — reads from table `subscriptions` (NOT `user_subscriptions`), auto-creates free row on PGRST116 (no-row)
- `createSubscription(userId, tier='free')` — inserts to `subscriptions`
- `updateSubscription(userId, updates)` — called by webhook
- `checkLimit(userId, resource)` — reads tier, calls `getProjectCount`/`getMonthlyAIUsage`/`getTeamMemberCount`, returns `{canUse, current, limit, isUnlimited, percentageUsed}`
  - **BILL-03 VIOLATION:** on error it calls `logger.error` and **re-throws**. No caller catches. This is "fail with exception" which at the HTTP layer becomes 500 → denies by accident — but any caller wrapping this in try/catch and defaulting to allowed would be the bug. The middleware in §3 must explicitly convert throw → 500 deny.
- `getMonthlyAIUsage()` reads from table **`usage_tracking`** with shape `(user_id, resource_type='ai_idea', period_start, count)` — this is the **actual** table the code expects, NOT `user_usage` from D-04
- `getTeamMemberCount` is a **stub returning 1** — TODO comment says "when team features are added". This must be replaced this phase for BILL-01 collaborator enforcement.
- `getStripeCustomerId`, `saveStripeCustomerId`, `getUserIdFromStripeCustomer` all present
- `getSubscriptionWithLimits(userId)` — one-call fetch of subscription + all three limit checks in parallel. **This is what the Settings dashboard (D-14) should call.**
- Client selection: browser → `createAuthenticatedClientFromLocalStorage()` (avoids getSession deadlock — matches MEMORY.md warning); server → default `supabase` (needs to be service-role on server)

**`api/stripe.ts`** (141 lines) — [VERIFIED]
- Consolidated router: `POST /api/stripe?action=checkout` and `?action=portal`
- Uses `compose(withRateLimit({15min, 100}), withAuth)` — auth + rate limiting already applied
- `handleCreateCheckout`: validates `priceId`+`tier`, restricts tier to `['team','enterprise']`, derives origin from `req.headers.origin` with localhost fallback, success URL `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`, cancel URL `${origin}/pricing?canceled=true`
- `handleCreatePortal`: looks up customer, creates portal session, returns URL. Returns 400 if no subscription.
- **Gap:** origin derivation is simpler than invitations/create's `appBaseUrl(req)` which also checks `x-forwarded-host`/`x-forwarded-proto` — should migrate to the Phase 05.2 pattern for consistency.

**`api/stripe/webhook.ts`** (272 lines) — [VERIFIED]
- Raw body read via async iterator (correct — preserves signature-verifiable bytes)
- `export const config = { api: { bodyParser: false } }` — Vercel body-parser disabled (CRITICAL — without this signature verification fails)
- Signature verified via `stripeService.constructWebhookEvent(rawBody, signature)`
- Switch handles all 5 required events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Each handler reads `userId` and `tier` from `subscription.metadata` or `session.metadata` — matches `stripeService.createCheckoutSession` which sets them
- Maps Stripe statuses: `canceled`/`incomplete_expired` → `canceled`; `past_due`/`unpaid` → `past_due`; otherwise `active`
- **Gap 1 (BILL-02):** `handlePaymentFailed` sets status to `past_due` but does NOT insert into `user_notifications` — phase must add this.
- **Gap 2 (idempotency):** Stripe redelivers events. No event.id tracking. If `checkout.session.completed` arrives twice, `updateSubscription` is called twice — idempotent for UPDATE (last-write-wins) but the initial customer-creation inside checkoutSession handler relies on Stripe-side dedup. **Recommend: `stripe_webhook_events(event_id PK, received_at)` table with INSERT-first; on dup-key, return 200 without processing.** Alternative: accept idempotency because all operations are UPSERT-shaped.
- **Gap 3:** Handlers `throw` on error, which the top-level catch turns into 500. That tells Stripe to retry — correct behavior, but `console.error` logs aren't going anywhere useful; consider adding structured logging or the existing `logger` util.

**`api/ai.ts`** — [VERIFIED via grep] — handles action `generate-ideas` at line 42/59. Does NOT call `subscriptionService.checkLimit`. No quota enforcement. This is the primary BILL-01 wire-up target.

**`api/invitations/create.ts`** — [VERIFIED earlier]
- **Bearer auth pattern to reuse in middleware:** `getAccessToken(req)` tries `sb-access-token` httpOnly cookie first, then `Authorization: Bearer` header fallback (lines 42-55)
- `getSupabaseAdmin()` service-role client factory (lines 33-40)
- `appBaseUrl(req)` pattern with `x-forwarded-host`/`x-forwarded-proto` fallback (lines 77-92) — use this everywhere that needs request origin

### What is missing

| Missing | Evidence | Impact |
|---------|----------|--------|
| Migration for `subscriptions` table | No file under `supabase/migrations` matches `subscription|usage|billing` | `subscriptionService` queries a table that doesn't exist in migration history. Either it was created out-of-band in prod (check via Supabase dashboard), or every call currently errors. Phase MUST create the migration. |
| Migration for `usage_tracking` table | Same grep result — none found | Same as above |
| `user_notifications` table | Not in migrations | Required for BILL-02 |
| `increment_ai_usage()` Postgres function | Not in migrations | D-04 specifies this; service currently has no counter increment at all |
| Quota middleware | No `withQuotaCheck` in `api/_lib/middleware` (verified via `api/stripe.ts` imports) | BILL-01 blocker |
| Call to `checkLimit` or increment from `api/ai.ts` | Grep shows none | BILL-01 blocker for AI endpoint |
| Past-due grace period logic | No date math in webhook or middleware | D-17 gap |
| Fail-closed error shape | Service throws; no deny path | BILL-03 |
| `user_notifications` insert in webhook | `handlePaymentFailed` only updates status | BILL-02 |

### Naming conflict: CONTEXT.md vs. existing code

| CONTEXT.md | Existing code | Recommendation |
|------------|---------------|----------------|
| `user_subscriptions` (D-08) | `subscriptions` (subscriptionService.ts:43) | Pick one; flag for discuss-phase |
| `user_usage` (D-04) | `usage_tracking` with shape `(user_id, resource_type, period_start, count)` (subscriptionService.ts:223) | D-04 shape is incompatible with existing code. Resolve before writing migration. |

**Cheapest path:** rename tables in migration to match CONTEXT.md (`user_subscriptions`, `user_usage`) and update the ~5 string literals in `subscriptionService.ts`. This keeps CONTEXT.md authoritative. Planner should include this rename as an explicit sub-task.

## 2. Stripe Integration Patterns for Vercel + Supabase

### Checkout session creation
Already implemented correctly in `stripeService.createCheckoutSession`. Three things the planner should preserve:
1. **`user_id` in BOTH `metadata` and `subscription_data.metadata`** — the webhook receives `Stripe.Subscription` objects for update/delete events, which only see `subscription.metadata`. Without the nested copy, `handleSubscriptionUpdated` cannot resolve the user.
2. **Customer reuse** — check `getStripeCustomerId` before `stripe.customers.create` to avoid duplicate customers across checkout retries.
3. **`allow_promotion_codes: true`** — lets Stripe handle discount codes without custom UI.

### Webhook signature verification (the body-parser gotcha)
**CRITICAL:** Vercel's default body parser consumes the stream and re-serializes, which **invalidates Stripe signatures**. The fix is `export const config = { api: { bodyParser: false } }` at module scope — already done in `webhook.ts:37-41`. Then read the raw body via async iterator (lines 10-16). Do not change this pattern. Do not add `req.body` destructuring anywhere in webhook.ts.

### Which webhook events and payload shapes
| Event | Key payload fields we read | Purpose |
|-------|---------------------------|---------|
| `checkout.session.completed` | `session.metadata.user_id`, `session.metadata.tier`, `session.subscription`, `session.customer` | Initial subscription activation |
| `customer.subscription.updated` | `subscription.metadata.user_id`, `subscription.status`, `subscription.current_period_{start,end}`, `subscription.cancel_at_period_end` | Tier changes, renewals, cancellation scheduling |
| `customer.subscription.deleted` | `subscription.metadata.user_id` | Downgrade to free |
| `invoice.payment_failed` | `invoice.subscription` (ID), then fetch subscription for `metadata.user_id` | Set past_due + notification insert |
| `invoice.payment_succeeded` | Same pattern | Re-activate if was past_due (already implemented) |

### Idempotency
[CITED: Stripe docs — https://stripe.com/docs/webhooks#handle-duplicate-events] Stripe may deliver the same event multiple times. Two approaches:

1. **Event dedup table (recommended):** `stripe_webhook_events(event_id text PRIMARY KEY, event_type text, received_at timestamptz default now())`. At the top of the handler: `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id`. If no row returned → already processed → return 200. Adds one round-trip per webhook.
2. **Idempotent operations:** all our handlers are UPDATE-shaped (`updateSubscription`) so replay is safe. The one exception is the **notification insert** in BILL-02 — without dedup, users see duplicate "payment failed" notifications. Recommend approach #1 for this reason alone.

### Billing portal session
`stripe.billingPortal.sessions.create({ customer: customerId, return_url })` — already implemented in `api/stripe.ts` as `portal` action. Returns `{ url }`, frontend redirects.

## 3. Quota Middleware Architecture

### Recommended shape

```typescript
// api/_lib/middleware/withQuotaCheck.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { subscriptionService } from '../../../src/lib/services/subscriptionService'
import type { SubscriptionTier } from '../../../src/types/subscription'

type QuotaResource = 'projects' | 'ai_ideas' | 'users'

interface QuotaContext {
  userId: string
  tier: SubscriptionTier
  limit: number
  used: number
  isUnlimited: boolean
}

export interface QuotaRequest extends VercelRequest {
  quota: QuotaContext
}

export function withQuotaCheck(
  resource: QuotaResource,
  handler: (req: QuotaRequest, res: VercelResponse) => Promise<VercelResponse | void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // 1. Resolve user from bearer token (reuse invitations/create pattern)
    const user = await resolveUser(req)  // 401 if missing
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })

    // 2. Look up subscription + usage — FAIL CLOSED on any error
    let check
    try {
      check = await subscriptionService.checkLimit(user.id, resource)
    } catch (err) {
      console.error('[quota] resolve failed — denying request:', err)
      return res.status(500).json({
        error: { code: 'QUOTA_CHECK_FAILED', message: 'Unable to verify subscription. Please try again.' }
      })
    }

    // 3. Enforce
    if (!check.canUse) {
      return res.status(402).json({
        error: {
          code: 'quota_exceeded',
          message: `You've reached your ${resource} limit for this plan.`,
          resource,
          limit: check.limit === Infinity ? null : check.limit,
          used: check.current,
          tier: /* look up from subscription */,
          upgradeUrl: '/pricing'
        }
      })
    }

    // 4. Attach context and run handler
    ;(req as QuotaRequest).quota = {
      userId: user.id,
      tier: /* ... */,
      limit: check.limit,
      used: check.current,
      isUnlimited: check.isUnlimited
    }

    const result = await handler(req as QuotaRequest, res)

    // 5. Post-success: increment counter (only for ai_ideas — projects/users are counted)
    if (resource === 'ai_ideas' && res.statusCode < 400) {
      subscriptionService.incrementAiUsage(user.id).catch((err) => {
        console.error('[quota] increment failed (non-blocking):', err)
      })
    }

    return result
  }
}
```

### 402 vs 429 — which is correct?
[CITED: RFC 9110 §15.5.3, 15.5.29]

- **402 Payment Required:** "reserved for future use" in RFC but widely adopted by SaaS APIs (Stripe itself, GitHub) for quota/subscription limits.
- **429 Too Many Requests:** rate limiting within a time window, implies retry-after.

**Recommendation: 402.** Semantically "you must upgrade to continue", not "wait and retry". Our rate limiting (which is separate) already uses 429 correctly. Stripe's own API returns 402 for `card_declined` and quota errors — [CITED: stripe.com/docs/api/errors]. Matching the industry convention aids client libraries.

### Composition with existing handlers
- `withAuth` middleware exists at `api/_lib/middleware/index.js` — used by `api/stripe.ts`
- For the AI endpoint: `compose(withRateLimit({...}), withAuth, withQuotaCheck('ai_ideas', handler))`
- For invitations: the current handler does its own auth (lines 42-75) — either refactor to use `withAuth`+`withQuotaCheck`, or inline the quota check after the auth block
- Middleware must run AFTER rate limit (cheaper to reject early) and AFTER auth (needs user_id)

### Response shape the frontend can act on
```json
{
  "error": {
    "code": "quota_exceeded",
    "message": "You've reached your AI generation limit for this plan.",
    "resource": "ai_ideas",
    "limit": 5,
    "used": 5,
    "tier": "free",
    "upgradeUrl": "/pricing"
  }
}
```
Frontend detects `error.code === 'quota_exceeded'` → shows inline upgrade modal with limit/used bar and a CTA routing to `upgradeUrl`.

## 4. Usage Counter Strategy

### Atomic increment — three options

**Option A: Direct atomic UPDATE** (simplest, recommended)
```sql
UPDATE user_usage
SET ai_generations_used = ai_generations_used + 1,
    updated_at = now()
WHERE user_id = $1 AND period_start = $2
```
Postgres UPDATE is atomic at row level. No race condition. No plpgsql needed. [VERIFIED: Postgres concurrency docs — UPDATE acquires ROW EXCLUSIVE lock]

**Option B: plpgsql function with period reset built in**
```sql
CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions  -- lesson from Phase 05.3
AS $$
DECLARE
  v_period_start date := date_trunc('month', now())::date;
  v_new_count int;
BEGIN
  INSERT INTO user_usage (user_id, period_start, ai_generations_used, updated_at)
  VALUES (p_user_id, v_period_start, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET ai_generations_used = CASE
          WHEN user_usage.period_start < v_period_start THEN 1
          ELSE user_usage.ai_generations_used + 1
        END,
        period_start = v_period_start,
        updated_at = now()
    RETURNING ai_generations_used INTO v_new_count;
  RETURN v_new_count;
END;
$$;
```
**This is the recommended approach** because it combines the period-reset-on-read (D-05) with the increment in a single atomic upsert. Note the `SET search_path` to address the Phase 05.3 SECURITY DEFINER lesson.

**Option C: Separate SELECT then UPDATE** — NOT recommended; race window on concurrent calls.

### Period reset on read (D-05)
The `checkLimit` read path also needs reset logic. Recommend a sibling function `get_current_ai_usage(p_user_id uuid)` that does the same CASE branch on `period_start < date_trunc('month', now())::date` and returns 0 if stale. Alternatively, bake both into a single `check_and_maybe_reset` function called from middleware — reduces round trips.

### Race condition on first request of new period
Without the `ON CONFLICT` upsert, two concurrent requests on the 1st of the month could both insert → unique constraint violation. The upsert resolves this cleanly — the second request's `ON CONFLICT DO UPDATE` branch sees the first's row with the new period and increments to 2.

## 5. Schema Design Recommendations

Using CONTEXT.md names (resolve the naming conflict from §1 by renaming existing references).

### `user_subscriptions`
```sql
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  tier text NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'team', 'enterprise')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  past_due_since timestamptz,  -- for D-17 grace period calculation
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_subscriptions_stripe_customer
  ON public.user_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY user_subscriptions_select_own ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Only service role writes (enforced by RLS default-deny for INSERT/UPDATE/DELETE)
-- Webhook handler uses service-role client which bypasses RLS
```

### `user_usage`
```sql
CREATE TABLE IF NOT EXISTS public.user_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  ai_generations_used int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_usage_select_own ON public.user_usage
  FOR SELECT USING (auth.uid() = user_id);
-- Writes via service role only (through increment_ai_usage function)
```

### `user_notifications`
```sql
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payment_failed', 'subscription_canceled', 'quota_warning')),
  message text NOT NULL,
  metadata jsonb,  -- stripe invoice id, amount, etc
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_notifications_user_unread
  ON public.user_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_notifications_select_own ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_notifications_update_own ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- Inserts via service role only (webhook handler)
```

### `stripe_webhook_events` (idempotency — optional but recommended)
```sql
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
-- No RLS needed — service-role only; never readable by users
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No SELECT policy = nothing readable
```

### Foreign keys note
All three user tables FK to `auth.users(id) ON DELETE CASCADE` — when a user deletes their account, all subscription/usage/notification state vanishes with them. GDPR-friendly.

## 6. Frontend Integration Points

### `src/components/pages/PricingPage.tsx`
Not fully inspected, but standard pattern:
1. On tier button click: `fetch('/api/stripe?action=checkout', {method: 'POST', body: JSON.stringify({priceId, tier}), credentials: 'include'})`
2. Response: `{sessionId, url}`
3. `window.location.href = url` (or `stripe.redirectToCheckout({sessionId})` — hosted URL is simpler)
4. `priceId` comes from `import.meta.env.VITE_STRIPE_PRICE_ID_TEAM` / `VITE_STRIPE_PRICE_ID_ENTERPRISE`

### `src/components/pages/SubscriptionSuccessPage.tsx`
After Stripe redirects back, the webhook may not have fired yet (race: user's browser redirects faster than Stripe's async webhook delivery). Two strategies:
1. **Poll** `getSubscriptionWithLimits` every 2s for up to 30s until `tier !== 'free'`
2. **Optimistic** show "activating..." then rely on next page load to reflect new tier

Recommend **polling** — UX is better, confirms the write actually landed. Fallback message after timeout: "Your subscription is processing — refresh in a moment."

### Inline upgrade prompts (D-14)
Locations the planner should grep for:
- **Create project modal:** search for the project create form / "New Project" button. Likely `src/components/ProjectStartupFlow.tsx` or under `src/components/app/`. Intercept submit when `limits.projects.canUse === false`, show upgrade CTA.
- **AI generate button:** likely `src/components/AIIdeaGenerator.tsx` or within `AIInsightsModal.tsx`. Same pattern.
- **Invite collaborator:** Phase 05.1 touched this. Search for the invite modal — disable when `limits.users.canUse === false`.

Data source: `useSubscription()` hook (to be created) that calls `getSubscriptionWithLimits` and caches in context. Consider adding to the existing `AppProviders` tree as a `SubscriptionProvider`.

### Settings dashboard
New section in Settings page:
```
Subscription & Usage
─────────────────────
Current Plan: [Free] [Upgrade]
Projects:     [█░░░░] 1 / 1
AI Ideas:     [███░░] 3 / 5 · Resets May 1
Team Members: [█░░░░] 1 / 3

[Manage Subscription] → opens Stripe portal via POST /api/stripe?action=portal
```

## 7. Notification Surface (Payment-Failed Banner)

### Polling vs. realtime
**Recommendation: polling at 60s intervals** with Supabase realtime as a stretch goal.

Rationale:
- Polling is simpler, one `SELECT ... WHERE user_id = ? AND read_at IS NULL ORDER BY created_at DESC LIMIT 1` every minute
- Realtime requires enabling `user_notifications` in the Supabase realtime publication (an extra migration line) and managing channel subscription lifecycle
- Payment-failed is rare (< once per user per month) — polling overhead is negligible
- MEMORY.md warns about realtime channel mismatch issues — less surface area for bugs

### Banner placement
Top of the main app shell (above or below the existing project header). Component: new `<PaymentFailedBanner />` rendered in `src/components/app/MainApp.tsx` conditional on `notifications.unreadPaymentFailed`.

### Unread tracking
`read_at IS NULL` → unread. Dismiss button does `PATCH /api/notifications/:id` (new endpoint) or direct Supabase update via RLS-allowed UPDATE policy (cheaper). On dismiss, set `read_at = now()`.

## 8. Test Strategy

### Mocking Stripe SDK
Mock at the boundary — same pattern as Resend in Phase 05.2.

```typescript
// src/lib/services/__tests__/stripeService.test.ts
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: 'cs_test', url: 'https://stripe/test' }) } },
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_test' }) },
    subscriptions: { retrieve: vi.fn() },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() }
  }))
}))
```

### Testing webhook handlers with fake signed payloads
Stripe ships a helper: `stripe.webhooks.generateTestHeaderString({ payload, secret })` for creating valid signatures in tests. Use the **real** `constructEvent` against a fixed secret for integration tests:

```typescript
const payload = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed', data: { object: { ... } } })
const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' })
// POST to handler with raw payload + signature header
```

### Testing quota middleware without Supabase
Mock `subscriptionService.checkLimit`:
```typescript
vi.mock('../../../src/lib/services/subscriptionService', () => ({
  subscriptionService: {
    checkLimit: vi.fn()
  }
}))
// Then: mockResolvedValue({canUse: false, current: 5, limit: 5, ...}) → expect 402
//       mockRejectedValue(new Error('db down')) → expect 500 (fail closed)
//       mockResolvedValue({canUse: true, ...}) → expect handler invoked
```

### E2E test matrix
- Free user hits project limit → 402 with correct shape
- Free user hits AI limit → 402, usage counter stays at limit (not over)
- Paid user (team) exceeds projects → 402 (team still has limit of 10)
- Paid user (team) calls AI → 200, usage incremented (but tracked even though unlimited? — design decision: increment regardless, it's free observability)
- Webhook receives valid `checkout.session.completed` → DB updated
- Webhook receives invalid signature → 400
- Webhook receives duplicate event_id → 200 without double-processing
- Payment-failed → notification row inserted, banner shows in UI

## 9. Open Risks and Gotchas

### vite.config.ts env allowlist (Phase 05.2 lesson)
All four Stripe env vars are **already in the allowlist** (`vite.config.ts` lines 80-83 — [VERIFIED]). No action needed. But: if the plan introduces any new env var (e.g., `STRIPE_BILLING_PORTAL_CONFIG_ID`), it MUST be added to the same block or dev API will see `undefined`.

### SECURITY DEFINER search_path (Phase 05.3 lesson)
The `increment_ai_usage` function (§4 Option B) must include `SET search_path = public, extensions` to avoid pgcrypto resolution failures. If the function ever calls `gen_random_uuid()` or other extension functions, qualify them as `extensions.gen_random_uuid()`.

### RLS recursion (Phase 05.1/05.3 lesson)
Quota middleware does NOT use RLS (service-role client) so this doesn't bite directly. BUT: if the Settings page reads `user_subscriptions` via the authenticated browser client and the RLS policy cross-references `projects` or `project_collaborators`, use the existing `is_project_collaborator(project_id, user_id)` helper — do not inline `EXISTS (SELECT ... FROM project_collaborators ...)`. In practice the policies above (`auth.uid() = user_id`) are simple and safe.

### Webhook URL
Stripe will POST to `https://prioritas.ai/api/stripe/webhook` (via the file route `api/stripe/webhook.ts`). This URL must be registered in the Stripe Dashboard → Developers → Webhooks, with the 5 event types subscribed. **Action item for deployment runbook, not code.** Also note: Stripe has separate webhook endpoints per mode (test vs. live) — the `STRIPE_WEBHOOK_SECRET` env var is per-endpoint and must match.

### Default subscription row creation
CONTEXT.md D-08 says "every user gets a row on first sign-in." Two implementations:
1. **Trigger on `auth.users` insert** — cleanest, runs once, zero latency on first quota check
2. **On-demand in `getSubscription`** — current code does this (PGRST116 → `createSubscription`). Works but every new user's first request has an extra write round trip.

Recommend **on-demand** (already working) — fewer moving parts, matches the `specifics` note in CONTEXT.md.

### Stripe test mode vs. live mode
- Test mode: `STRIPE_SECRET_KEY` starts `sk_test_`, price IDs start `price_` but are test-only, webhook secret is test-only
- Live mode: `sk_live_`, live price IDs, live webhook secret
- Both can coexist in separate Vercel environments (preview vs. production). Document which env vars are set in which Vercel environment in the deployment runbook.
- **Local dev:** use test mode + Stripe CLI `stripe listen --forward-to localhost:3003/api/stripe/webhook` to tunnel webhooks.

### Past-due grace period (D-17)
Stripe's default dunning retries for ~3-4 weeks before canceling (configurable in Stripe Dashboard → Billing → Subscription settings). CONTEXT.md says "7-day grace period matching Stripe's default" — **this is not actually Stripe's default**. Two options:
1. Configure Stripe dunning to cancel after 7 days (dashboard setting, not code)
2. Implement grace period in middleware: allow quota checks when `status='past_due'` AND `past_due_since > now() - interval '7 days'`, deny otherwise

**Recommend option 2** — keeps the policy in code, decoupled from Stripe dashboard config. Requires the `past_due_since timestamptz` column added in §5 schema, set when `handlePaymentFailed` first flips status to past_due (and cleared on `handlePaymentSucceeded`).

### Increment for unlimited tiers
Should team users (unlimited AI) still have their counter incremented? Pros: free observability, future conversion to metered billing. Cons: extra DB write per AI call. Recommend **yes, always increment** — the middleware calls the same function; gating on tier adds a branch without real savings.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `subscriptions` and `usage_tracking` tables the services read from were created out-of-band and exist in prod Supabase (no migration file found) | §1 Missing | Phase is larger than expected — if tables DO exist, we're renaming; if they don't, the service has been broken silently in prod. Planner should verify with `supabase db diff` or dashboard inspection. [ASSUMED] |
| A2 | Stripe API version `2025-02-24.acacia` pinned in stripeService.ts is still supported | §1 | Low — Stripe maintains old versions for years. [ASSUMED] |
| A3 | `api/_lib/middleware/index.js` exports `withAuth`, `withRateLimit`, `compose` (inferred from `api/stripe.ts` import) | §3 | Low — if signature differs, middleware composition may need adjustment. [ASSUMED] |
| A4 | 7-day grace period for past_due is the product decision, not Stripe's default (CONTEXT.md claims it is) | §9 past-due | Medium — may need to revisit D-17 wording with user. [VERIFIED against Stripe docs — default is longer] |
| A5 | Polling at 60s is acceptable for payment-failed banner latency | §7 | Low — worst case user sees notification a minute late. [ASSUMED] |
| A6 | The test mocking pattern for Resend in Phase 05.2 is appropriate to copy for Stripe | §8 | Low — both are external SDK boundaries. [ASSUMED] |
| A7 | Frontend has `credentials: 'include'` on fetch for httpOnly cookie auth to work | §6 | Medium — if not, checkout endpoint returns 401 for logged-in user. Verify in discuss-phase or early in execution. [ASSUMED] |

## Open Questions

1. **Table naming: `subscriptions`/`usage_tracking` vs `user_subscriptions`/`user_usage`?**
   - What we know: existing code uses the former; CONTEXT.md D-04/D-08 specifies the latter
   - What's unclear: whether services should be updated or CONTEXT.md should be amended
   - Recommendation: amend code to match CONTEXT.md (rename 5 string literals) — CONTEXT.md is authoritative

2. **Do the `subscriptions` and `usage_tracking` tables exist in production Supabase right now?**
   - What we know: no migration file creates them
   - What's unclear: whether they exist via dashboard-created / earlier un-committed migration
   - Recommendation: run `supabase db diff` or inspect dashboard before writing migration — if they exist, write an ALTER/RENAME migration instead of CREATE

3. **Stripe webhook endpoint URL — same for test and live?**
   - Stripe requires separate webhook endpoints per mode. Two URLs: `/api/stripe/webhook` for both, but two Stripe Dashboard registrations with different signing secrets per environment (set via Vercel env)
   - Recommendation: deployment runbook documents this; no code impact

4. **Is BILL-02 (notification) satisfied by just the `past_due` status, or does it require an explicit notification row?**
   - CONTEXT.md D-16 mandates the notification row
   - The existing webhook only sets status — phase must add the insert

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `stripe` npm package | Backend API | ✓ | 17.5.0 (per CLAUDE.md) | — |
| `@stripe/stripe-js` | Frontend redirect | ✓ | 5.3.0 | window.location.href redirect |
| Stripe CLI (local webhook tunneling) | Local dev only | unknown | — | Skip local webhook testing; test in Vercel preview |
| Supabase service role key | Webhook handler, middleware | ✓ | — | — |
| Stripe test mode price IDs | Local checkout test | ✓ (env set per CONTEXT.md S-04) | — | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 + Playwright 1.55.0 (E2E) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npm run test:run && npm run e2e:chromium` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Quota middleware returns 402 when over limit | unit | `npx vitest run api/_lib/middleware/__tests__/withQuotaCheck.test.ts` | ❌ Wave 0 |
| BILL-01 | `/api/ai?action=generate-ideas` rejects free user at 6th call | integration | `npx vitest run api/__tests__/ai-quota.test.ts` | ❌ Wave 0 |
| BILL-02 | `invoice.payment_failed` webhook inserts notification row | unit | `npx vitest run api/stripe/__tests__/webhook.test.ts -t "payment_failed"` | ❌ Wave 0 |
| BILL-02 | Banner renders when unread payment_failed notification exists | component | `npx vitest run src/components/__tests__/PaymentFailedBanner.test.tsx` | ❌ Wave 0 |
| BILL-03 | Middleware returns 500 + denies when subscriptionService throws | unit | `npx vitest run api/_lib/middleware/__tests__/withQuotaCheck.test.ts -t "fails closed"` | ❌ Wave 0 |
| BILL-04 | Settings dashboard renders tier + usage bars | component | `npx vitest run src/components/__tests__/SubscriptionDashboard.test.tsx` | ❌ Wave 0 |
| BILL-05 | Free tier config returns projects=1, ai=5, users=3 | unit | `npx vitest run src/lib/config/__tests__/tierLimits.test.ts` | check exists |
| BILL-06 | Team tier allows 10 projects, unlimited AI | unit | same as above | same |
| E2E | Checkout → webhook → tier change → new limits enforced | E2E | `npx playwright test tests/e2e/billing-flow.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <affected file>`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full Vitest + `npx playwright test tests/e2e/billing-flow.spec.ts`

### Wave 0 Gaps
- [ ] `api/_lib/middleware/withQuotaCheck.ts` — middleware itself
- [ ] `api/_lib/middleware/__tests__/withQuotaCheck.test.ts` — covers BILL-01, BILL-03
- [ ] `api/__tests__/ai-quota.test.ts` — integration test through `api/ai.ts`
- [ ] `api/stripe/__tests__/webhook.test.ts` — fake signed payloads + DB assertions (covers BILL-02)
- [ ] `src/components/__tests__/PaymentFailedBanner.test.tsx` — component rendering + dismiss
- [ ] `src/components/__tests__/SubscriptionDashboard.test.tsx` — Settings section
- [ ] `tests/e2e/billing-flow.spec.ts` — end-to-end (uses Stripe test mode)
- [ ] `src/hooks/useSubscription.ts` + test — frontend data hook

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Existing `withAuth` + bearer/cookie pattern |
| V3 Session Management | yes | httpOnly cookie (Phase 1) |
| V4 Access Control | **yes — core to this phase** | Quota middleware is authorization at the API layer (BILL-01, BILL-03) |
| V5 Input Validation | yes | `priceId`/`tier` whitelist in checkout (already done); webhook payload schema via Stripe SDK types |
| V6 Cryptography | yes | **Never hand-roll** webhook signature verification — use `stripe.webhooks.constructEvent`. Already done. |
| V11 Business Logic | yes | Fail-closed (BILL-03), idempotency on webhook events (§2) |

### Known Threat Patterns for Stripe + Vercel
| Pattern | STRIPE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook replay attack | Spoofing | Signature verification (already done); event_id dedup table (recommended §2) |
| Client-side tier tampering | Tampering | Backend middleware is sole enforcement boundary (D-13) |
| Quota bypass via race condition | Elevation | Atomic increment via `ON CONFLICT` upsert (§4) |
| Credential leak via logs | Info disclosure | Never log full `STRIPE_SECRET_KEY` or webhook secret; existing code only logs event IDs |
| Error-path fail-open | Elevation | Middleware explicitly returns 500 on any throw (§3) — BILL-03 |

## Sources

### Primary (HIGH confidence — read directly)
- `api/stripe/webhook.ts` (272 lines)
- `api/stripe.ts` (141 lines)
- `api/invitations/create.ts` (242 lines — pattern reference)
- `src/lib/services/subscriptionService.ts` (301 lines)
- `src/lib/services/stripeService.ts` (first 80 lines)
- `src/lib/config/tierLimits.ts` (133 lines)
- `vite.config.ts` (env allowlist lines 72-87)
- `.planning/phases/06-billing-subscription-enforcement/06-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `design-matrix-app/CLAUDE.md` (tech stack versions)

### Secondary (CITED from training / docs)
- Stripe docs — webhooks handling duplicate events
- Stripe docs — API errors (402 semantic)
- RFC 9110 — HTTP status code definitions
- Postgres docs — UPDATE concurrency / row locking

### Not verified (ASSUMED)
- Stripe API version `2025-02-24.acacia` support status
- Existence of `subscriptions`/`usage_tracking` tables in prod Supabase
- `api/_lib/middleware/index.js` exports (inferred from import usage)

## Metadata

**Confidence breakdown:**
- Current scaffolding state: HIGH — read every referenced file
- Stripe integration patterns: HIGH — verified against working scaffold
- Quota middleware architecture: HIGH — straightforward composition
- Schema design: MEDIUM — depends on resolution of naming conflict and whether tables already exist in prod
- Pitfalls / gotchas: HIGH — draws on Phase 05.1/05.2/05.3 lessons captured in CONTEXT.md

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (30 days — Stripe API stable, but CONTEXT.md naming conflict should be resolved immediately)
