---
phase: 06-billing-subscription-enforcement
plan: 03
type: execute
wave: 3
depends_on: [02]
files_modified:
  - api/projects.ts
  - api/projects.js
  - api/ai.ts
  - api/invitations/create.ts
  - api/stripe/webhook.ts
  - src/lib/services/subscriptionService.ts
  - src/types/subscription.ts
  - api/stripe/__tests__/webhook.test.ts
  - api/_lib/middleware/__tests__/withQuotaCheck.integration.test.ts
autonomous: true
requirements: [BILL-01, BILL-02, BILL-05, BILL-06]
must_haves:
  truths:
    - "api/projects.ts is a REAL endpoint performing a Supabase insert into public.projects (no more mock stub)"
    - "api/projects.js is deleted (replaced by api/projects.ts)"
    - "POST /api/projects returns 402 quota_exceeded when free user has 1 project"
    - "POST /api/ai action=generate-ideas returns 402 quota_exceeded when free user has used 5 this month"
    - "POST /api/invitations/create returns 402 quota_exceeded when user tier limit reached"
    - "invoice.payment_failed webhook inserts a user_notifications row with type='payment_failed'"
    - "Duplicate webhook delivery of the same event_id is idempotent (no double-insert of notification)"
    - "past_due_since is set when status transitions to past_due; customer.subscription.deleted fires automatically via Stripe after grace period"
  artifacts:
    - path: "api/projects.ts"
      provides: "Real POST handler performing Supabase insert, quota-wrapped"
      contains: "withQuotaCheck('projects'"
    - path: "api/stripe/webhook.ts"
      provides: "Idempotent webhook handling + user_notifications insert on payment_failed"
      contains: "stripe_webhook_events"
    - path: "api/ai.ts"
      provides: "Quota-wrapped generate-ideas path"
      contains: "withQuotaCheck('ai_ideas'"
    - path: "api/invitations/create.ts"
      provides: "Quota-wrapped invitation create path"
      contains: "withQuotaCheck('users'"
    - path: "src/types/subscription.ts"
      provides: "SubscriptionUpdateParams extended with past_due_since?: Date | null"
      contains: "past_due_since"
  key_links:
    - from: "api/ai.ts generate-ideas"
      to: "withQuotaCheck('ai_ideas')"
      via: "compose wrapping"
      pattern: "withQuotaCheck\\('ai_ideas'"
    - from: "handlePaymentFailed"
      to: "user_notifications"
      via: "supabase insert"
      pattern: "user_notifications"
---

<objective>
Convert `api/projects.js` (currently a mock stub) into a real `api/projects.ts` endpoint backed by a Supabase insert, then wire `withQuotaCheck` into the three mutation endpoints (D-11), add webhook idempotency via `stripe_webhook_events`, insert `user_notifications` rows on payment failure (BILL-02), and record `past_due_since` for the 7-day grace period (D-17).

Purpose: This wave turns the middleware into actual enforcement and closes the BILL-02 notification gap in the webhook. This is where BILL-01/02/05/06 become true at runtime. The projects endpoint must be real — wrapping a mock with quota middleware enforces a no-op.
Output: Real projects endpoint + three wrapped endpoints + hardened webhook + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-billing-subscription-enforcement/06-CONTEXT.md
@.planning/phases/06-billing-subscription-enforcement/06-RESEARCH.md
@api/stripe/webhook.ts
@api/invitations/create.ts
@api/projects.js
@api/_lib/middleware/withQuotaCheck.ts

<interfaces>
From Wave 2 (Plan 02):
```ts
withQuotaCheck(resource: 'projects' | 'ai_ideas' | 'users', handler): WrappedHandler
// On over-limit: 402 { error: { code: 'quota_exceeded', resource, limit, used, tier, upgradeUrl } }
// On resolve error: 500 { error: { code: 'QUOTA_CHECK_FAILED' } }
// On success: req.quota = { userId, tier, limit, used, isUnlimited }
```

**api/projects.js today is a mock stub** — GET returns hardcoded fake projects, POST fabricates an in-memory object with `id: project-${Date.now()}` and returns it without writing to the DB. It must be REPLACED (not just wrapped) with a real endpoint that inserts into `public.projects` via a service-role client.

From existing `api/stripe/webhook.ts`:
```ts
async function handlePaymentFailed(invoice: Stripe.Invoice)
// Currently: sets status=past_due only. Missing: user_notifications insert.
```

The `public.projects` table has `owner_id uuid` (per research and the getTeamMemberCount query from Plan 02).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Convert api/projects.js → real api/projects.ts + wrap all three mutation endpoints with withQuotaCheck</name>
  <files>
    api/projects.ts
    api/projects.js
    api/ai.ts
    api/invitations/create.ts
  </files>
  <read_first>
    - api/projects.js (confirm it is a mock stub — will be deleted)
    - api/ai.ts (lines around action='generate-ideas' — line ~42/59 per research)
    - api/invitations/create.ts (lines 94-242, especially the getSupabaseAdmin + getAccessToken helpers to reuse)
    - api/_lib/middleware/withQuotaCheck.ts (Wave 2)
  </read_first>
  <action>
**Sub-step 1a — Create `api/projects.ts` as a REAL endpoint (NEW FILE).** This replaces the mock. The POST handler must perform a real Supabase insert into `public.projects` with `owner_id` set to the caller's user id. Use the same admin-client pattern as the middleware (service role + `auth.getUser(token)` to resolve the caller).

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { withQuotaCheck, type QuotaRequest } from './_lib/middleware'

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Missing Supabase service-role configuration')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || 'http://localhost:3003'
  res.setHeader('Access-Control-Allow-Origin', origin as string)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, Accept, Origin')
}

// Real create-project handler. Middleware has already resolved req.quota.userId and tier.
async function handleCreateProject(req: QuotaRequest, res: VercelResponse) {
  const { name, description } = (req.body ?? {}) as { name?: string; description?: string }
  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'name is required' } })
  }
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('projects')
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
      owner_id: req.quota.userId,
    })
    .select('*')
    .single()
  if (error) {
    console.error('[api/projects POST] insert failed:', error)
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Failed to create project' } })
  }
  return res.status(201).json({ project: data })
}

const wrappedPost = withQuotaCheck('projects', handleCreateProject)

// GET handler (list projects owned by caller). Keep minimal — read-only, no quota wrap.
async function handleListProjects(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } })
  const admin = getSupabaseAdmin()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } })
  const { data, error } = await admin
    .from('projects')
    .select('*')
    .eq('owner_id', userData.user.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: { code: 'DB_ERROR' } })
  return res.status(200).json({ projects: data ?? [], count: data?.length ?? 0 })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method === 'GET') return handleListProjects(req, res)
  if (req.method === 'POST') return wrappedPost(req as any, res)
  return res.status(405).json({ error: 'Method not allowed' })
}
```

**Sub-step 1b — Delete `api/projects.js`.** Use `rm api/projects.js` (or equivalent). Vercel routes `.ts` first, but having both files is ambiguous — delete the mock.

**Sub-step 1c — api/ai.ts:** The monolithic router dispatches by `action`. Wrap ONLY the `generate-ideas` case:

```ts
import { withQuotaCheck } from './_lib/middleware'

// At the top-level handler, before the switch:
if (req.method === 'POST' && req.query.action === 'generate-ideas') {
  return withQuotaCheck('ai_ideas', handleGenerateIdeas)(req, res)
}
// ... other actions fall through unchanged
```
Extract the existing generate-ideas logic into a named `handleGenerateIdeas(req, res)` function if not already separate. The middleware will auto-increment on 2xx.

**Sub-step 1d — api/invitations/create.ts:** This file does its own bearer auth inline. Refactor to wrap the existing handler body in `withQuotaCheck('users', ...)`. Because the middleware already does auth, REMOVE the duplicate `getAuthenticatedUser` call in the wrapped body — use `req.quota.userId` instead:

```ts
import { withQuotaCheck, type QuotaRequest } from '../_lib/middleware'

async function createInviteHandler(req: QuotaRequest, res: VercelResponse): Promise<VercelResponse> {
  const userId = req.quota.userId
  // ... existing body validation, project ownership check, idempotency lookup, insert, email send ...
  // (delete the old getAccessToken / getAuthenticatedUser block — middleware owns that now)
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }
  return withQuotaCheck('users', createInviteHandler)(req as any, res)
}
```

Preserve every existing behavior: idempotent re-invite, email send, token hashing, project ownership check, 403 on non-owner.
  </action>
  <verify>
    <automated>test ! -f api/projects.js && grep -q "withQuotaCheck('projects'" api/projects.ts && grep -q "from('projects').insert" api/projects.ts && grep -q "owner_id" api/projects.ts && grep -q "withQuotaCheck('ai_ideas'" api/ai.ts && grep -q "withQuotaCheck('users'" api/invitations/create.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - api/projects.js no longer exists
    - api/projects.ts exists, imports withQuotaCheck, performs a real supabase insert with owner_id
    - All three endpoints import and invoke withQuotaCheck with the correct resource
    - `npx tsc --noEmit` passes (no type regressions)
    - invitations/create.ts no longer has two auth paths (middleware-only)
  </acceptance_criteria>
  <done>Projects endpoint is real (not mock); three endpoints wired; typecheck clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Webhook idempotency + user_notifications insert + past_due_since + SubscriptionUpdateParams type</name>
  <files>
    api/stripe/webhook.ts
    src/lib/services/subscriptionService.ts
    src/types/subscription.ts
    api/stripe/__tests__/webhook.test.ts
  </files>
  <read_first>
    - api/stripe/webhook.ts (full file)
    - src/lib/services/subscriptionService.ts (after Plan 02 patches)
    - src/types/subscription.ts (locate SubscriptionUpdateParams interface)
  </read_first>
  <behavior>
    - Test 1: Duplicate delivery of same event_id returns 200 and does NOT call any handler
    - Test 2: First delivery inserts into stripe_webhook_events
    - Test 3: invoice.payment_failed inserts a row into user_notifications with type='payment_failed' and a message containing the invoice amount
    - Test 4: invoice.payment_failed updates subscriptions.status='past_due' AND sets past_due_since to now (if not already set)
    - Test 5: Replay of payment_failed event (same event_id) does NOT create a second user_notifications row
    - Test 6: customer.subscription.updated where status transitions from past_due -> active clears past_due_since to null
  </behavior>
  <action>
**Step 1 — Extend `SubscriptionUpdateParams` type** in `src/types/subscription.ts`. Read the file to locate the interface and add:
```ts
past_due_since?: Date | null;
```
(If the interface already has strict field keys enforced elsewhere in `subscriptionService.updateSubscription`, update the whitelist/mapping there too.)

**Step 2 — Idempotency guard at the top of the switch in `webhook.ts`:**

After signature verification but before the switch, add:

```ts
// Idempotency: dedupe Stripe webhook deliveries
const admin = getSupabaseAdmin()  // add a helper or reuse existing pattern
const { error: dedupErr } = await admin
  .from('stripe_webhook_events')
  .insert({ event_id: event.id, event_type: event.type })
if (dedupErr) {
  // 23505 = unique_violation → already processed
  if ((dedupErr as any).code === '23505') {
    console.log('[webhook] duplicate event, skipping:', event.id)
    return res.status(200).json({ received: true, duplicate: true })
  }
  console.error('[webhook] dedup insert failed:', dedupErr)
  return res.status(500).json({ error: 'Dedup check failed' })
}
```

Add a local `getSupabaseAdmin` factory mirroring the one in `api/invitations/create.ts` (createClient with service role, autoRefreshToken:false).

**Step 3 — Extend `handlePaymentFailed`:**

```ts
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return
  const subscription = await stripeService.getSubscription(subscriptionId)
  const userId = subscription.metadata?.user_id
  if (!userId) {
    console.error('Missing user_id in subscription metadata:', subscriptionId)
    return
  }

  // Mark past_due with grace anchor (D-17)
  await subscriptionService.updateSubscription(userId, {
    status: 'past_due',
    past_due_since: new Date(),
  })

  // BILL-02: insert notification
  const admin = getSupabaseAdmin()
  const amountCents = invoice.amount_due ?? 0
  const amount = (amountCents / 100).toFixed(2)
  const currency = (invoice.currency ?? 'usd').toUpperCase()
  const { error: notifErr } = await admin.from('user_notifications').insert({
    user_id: userId,
    type: 'payment_failed',
    message: `Your payment of ${currency} ${amount} failed. Please update your payment method to keep your subscription active.`,
    metadata: { invoice_id: invoice.id, amount_cents: amountCents, currency },
  })
  if (notifErr) {
    console.error('[webhook] user_notifications insert failed:', notifErr)
    // Do not throw — subscription status update already succeeded
  }
}
```

**Step 4 — `handleSubscriptionUpdated`:** When the incoming Stripe status is `active` (or not past_due), clear `past_due_since`:

```ts
const updates: SubscriptionUpdateParams = {
  tier: tier || 'free',
  status,
  current_period_start: new Date(subscription.current_period_start * 1000),
  current_period_end: new Date(subscription.current_period_end * 1000),
  cancel_at_period_end: subscription.cancel_at_period_end,
}
if (status === 'active') {
  updates.past_due_since = null
}
await subscriptionService.updateSubscription(userId, updates)
```

**Step 5 — Tests** in `api/stripe/__tests__/webhook.test.ts`: mock `stripeService.constructWebhookEvent` to return fixture events, mock `@supabase/supabase-js` createClient to capture inserts, mock `subscriptionService` methods. Cover all 6 behaviors. Use `stripe.webhooks.generateTestHeaderString` only if the real Stripe SDK is available; otherwise bypass signature verification by mocking constructWebhookEvent directly.
  </action>
  <verify>
    <automated>npx vitest run api/stripe/__tests__/webhook.test.ts && grep -q "stripe_webhook_events" api/stripe/webhook.ts && grep -q "user_notifications" api/stripe/webhook.ts && grep -q "past_due_since" api/stripe/webhook.ts && grep -q "past_due_since" src/types/subscription.ts</automated>
  </verify>
  <acceptance_criteria>
    - All 6 webhook tests pass
    - Idempotency guard inserted before switch
    - user_notifications insert present in handlePaymentFailed
    - past_due_since set on payment_failed and cleared on subscription back-to-active
    - SubscriptionUpdateParams type in src/types/subscription.ts includes past_due_since
  </acceptance_criteria>
  <done>Webhook idempotent, notifications flowing, grace period timestamp recorded, type extended.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: End-to-end smoke test with Stripe CLI</name>
  <what-built>Real projects endpoint + wrapped endpoints + idempotent webhook with notification insert</what-built>
  <how-to-verify>
    1. Start dev server: `npm run dev`
    2. Forward Stripe webhook: `stripe listen --forward-to localhost:3003/api/stripe/webhook`
    3. Trigger events: `stripe trigger invoice.payment_failed` — check Supabase `user_notifications` for new row
    4. Trigger same event twice — confirm only ONE row in user_notifications and ONE row in stripe_webhook_events
    5. As a free user in the app, POST /api/projects with a real name — confirm a row lands in `public.projects` with `owner_id` set
    6. POST /api/projects again — expect 402 body `{ error: { code: 'quota_exceeded', resource: 'projects', limit: 1, used: 1 } }`
    7. As a free user, call /api/ai?action=generate-ideas 6 times — 6th should return 402
    8. Confirm `usage_tracking` row for that user has count=5 (not 6 — increment is after success)
  </how-to-verify>
  <resume-signal>Type "approved" once 402s fire correctly and webhook idempotency confirmed</resume-signal>
</task>

</tasks>

<verification>
- vitest webhook suite passes
- tsc clean
- Live smoke test confirms real project inserts, 402 responses, and webhook idempotency
</verification>

<success_criteria>
BILL-01 enforced at runtime on all three endpoints (with a REAL projects endpoint — not a mock). BILL-02 notification row is created. Webhook is idempotent. Past-due grace anchor set.
</success_criteria>

<output>
Create `.planning/phases/06-billing-subscription-enforcement/06-03-SUMMARY.md` with 402 response samples captured from smoke test, webhook fixture JSON, and the exact stripe_webhook_events dedup SQL error code used.
</output>
