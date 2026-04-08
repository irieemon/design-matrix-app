# Phase 6: Billing & Subscription Enforcement - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing Stripe scaffolding into a working subscription lifecycle (checkout → webhook → tier update → quota enforcement → usage visibility → payment-failure notification). The user-facing outcome: free users hit clear, well-designed limits and see contextual upgrade prompts; paid users get the higher limits they paid for; anyone can see what they've used and what they're paying for.

**In scope:**
- Stripe checkout session endpoint that creates real subscriptions
- Stripe webhook handling for `customer.subscription.{created,updated,deleted}` and `invoice.payment_failed`
- `subscriptions` table (or equivalent) linking Supabase users → Stripe customer/subscription → tier + status
- `usage_tracking` table (or equivalent) tracking monthly quota-relevant counts (AI idea generations) that resets per billing period
- API middleware that runs on quota-consuming endpoints (create project, AI generate) and 402/429s when over limit
- Settings-panel subscription dashboard (current tier, usage/limits, upgrade CTA)
- Inline upgrade prompts at the point of limit (create-project modal, AI button)
- In-app notification when `invoice.payment_failed` fires

**Out of scope:**
- Invoice history / PDF download (deferred — ask Stripe customer portal to handle)
- Proration math beyond what Stripe handles automatically
- Enterprise custom-pricing flow (enterprise stays "contact sales")
- Team management UI changes (collaborator invites are Phase 5, quota on collaborator count is enforced but not redesigned)
- Grandfathering logic for existing users (all existing accounts default to `free`)
- Annual vs monthly pricing toggle work in the checkout (the price IDs already exist in env, the plan just uses them)

</domain>

<decisions>
## Implementation Decisions

### Current State (Scouted)
- **S-01:** `src/lib/config/tierLimits.ts` already defines `TIER_LIMITS` for `free | team | enterprise` with projects, `ai_ideas_per_month`, users, exports, and features. **Reuse this as-is** — do not redefine limits elsewhere.
- **S-02:** `api/stripe/webhook.ts` exists as a scaffold. Will be extended, not replaced.
- **S-03:** `ai_token_usage` table tracks raw OpenAI token consumption for cost/admin observability. **Different purpose from quota tracking** — quota counts "AI idea generations" as user-observable events, not tokens. A separate `usage_tracking` table is added alongside (decision D-04).
- **S-04:** Env vars already set: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PRICE_ID_TEAM`, `VITE_STRIPE_PRICE_ID_ENTERPRISE`. Also remember to add these to vite.config.ts dev API allowlist (same pattern as RESEND_API_KEY fix in 05.2).

### Stripe Integration
- **D-01:** **Stripe is scaffolded but not wired.** This phase implements the full subscription lifecycle from checkout to webhook to DB update.
- **D-02:** Use Stripe hosted checkout (`stripe.checkout.sessions.create`) rather than embedded Stripe Elements. Zero PCI scope, minimal code.
- **D-03:** Webhook events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Signature verification via `STRIPE_WEBHOOK_SECRET` is mandatory.

### Usage Tracking
- **D-04:** **New `usage_tracking` table.** Schema: `(user_id uuid PK, period_start date, ai_generations_used int, updated_at timestamptz)`. Single row per user. `period_start` is the start of the current billing period (or calendar month for free tier). Increments atomically via a Postgres function `increment_ai_usage(user_id)` called from the AI generation endpoint.
- **D-05:** Period reset happens **on-read**: when checking quota, if `period_start` is older than current period, reset counter to 0 and update `period_start` atomically. No cron job needed.
- **D-06:** Project count is **computed on-the-fly** from `projects.owner_id`, not stored in `usage_tracking`. Projects are durable, AI generations are ephemeral counters — different shape, different strategy.
- **D-07:** Collaborator-count limit is enforced via the same pattern: count `project_collaborators` rows where the project's owner is the user, compare to tier limit.

### Subscription State
- **D-08:** **New `subscriptions` table.** Schema: `(user_id uuid PK, stripe_customer_id text, stripe_subscription_id text, tier text check in (free,team,enterprise), status text check in (active,canceled,past_due,incomplete,trialing), current_period_end timestamptz, updated_at timestamptz)`. Every Supabase auth user gets a row on first sign-in defaulting to `{tier: 'free', status: 'active'}` (via trigger or on-demand insert — planner decides).
- **D-09:** **Fail closed on errors (BILL-03):** any error resolving a user's subscription/usage must deny the action, never grant unlimited access. The middleware explicitly returns a 500 with a generic error rather than falling through to "allowed".

### Enforcement Model
- **D-10:** **API middleware per endpoint.** A helper `withQuotaCheck(resource, handler)` wraps mutation endpoints that consume quota. The middleware:
  1. Resolves caller's user_id from bearer token
  2. Looks up their tier from `subscriptions`
  3. Looks up current usage for the resource
  4. Returns 402 `{ error: 'quota_exceeded', resource, limit, used }` if over, otherwise calls the handler
  5. On handler success, increments the usage counter
- **D-11:** Endpoints wrapped: `POST /api/projects` (resource: `projects`), `POST /api/ai/generate-ideas` (resource: `ai_ideas_per_month`), `POST /api/invitations/create` (resource: `users` — collaborator count).
- **D-12:** Increment happens **after** the underlying operation succeeds, never before. (Same best-effort ordering as Resend sends in 05.2.)
- **D-13:** Frontend MUST also guard buttons when tier/usage is known, as UX — but **the backend middleware is the enforcement boundary**. Frontend checks are convenience, not security.

### Subscription Dashboard UI
- **D-14:** **Settings panel + inline prompts.** Two UI surfaces:
  - A new "Subscription & Usage" section in the existing Settings page showing: current plan, tier badge, usage bars ("3/5 AI generations this month", "1/1 projects"), period reset date, "Upgrade" / "Manage Subscription" button that opens Stripe customer portal
  - **Inline upgrade prompts** that appear contextually when a user hits a limit in the main app flow (create-project modal disabled state with "Upgrade to create more projects", AI button with "Upgrade for unlimited AI generations")
- **D-15:** "Manage Subscription" links to Stripe's billing portal (hosted) — zero custom UI for payment method / invoice management. Created via `stripe.billingPortal.sessions.create`.

### Payment Failure Notification
- **D-16:** When `invoice.payment_failed` webhook fires, set `subscriptions.status = 'past_due'` AND insert a row into a new `user_notifications` table (`(id, user_id, type, message, read_at, created_at)`). A small toast/banner in the app header polls or subscribes to this table and shows the unread notification.
- **D-17:** Past-due users retain access for a 7-day grace period (matching Stripe's default `past_due` duration) — they still pass quota checks but see the warning banner. After 7 days Stripe auto-cancels and the `customer.subscription.deleted` webhook downgrades them to `free`.

### Claude's Discretion
- Exact toast/banner component styling (match existing brand tokens)
- Where exactly "Subscription & Usage" sits in the Settings nav (existing structure)
- Whether `increment_ai_usage()` is a plpgsql function or a simple UPDATE with atomic `SET ai_generations_used = ai_generations_used + 1` (both are safe — planner picks idiomatic)
- Notification polling frequency / realtime subscription vs poll
- Copy text for upgrade prompts, payment-failed message, quota-exceeded error messages
- Test mocking strategy for Stripe SDK (mock at the boundary, same as Resend)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — BILL-01 through BILL-06

### Existing code (reuse, don't rebuild)
- `src/lib/config/tierLimits.ts` — **canonical source of tier definitions and helper functions** (getLimit, isUnlimited, hasFeature, canExport). Do NOT redefine these.
- `api/stripe/webhook.ts` — existing scaffold, extend it
- `api/stripe/` directory — add new handlers (`create-checkout.ts`, `portal-session.ts`) alongside webhook
- `supabase/migrations/20250113000000_create_admin_system.sql` — reference for `ai_token_usage` table shape (for reading, not writing)
- `vite.config.ts` lines 72-85 — dev API env var allowlist. **Any new env var MUST be added here** (the lesson from Phase 05.2's RESEND_API_KEY debugging session).

### Environment variables (already set)
- `STRIPE_SECRET_KEY` — backend Stripe API calls
- `STRIPE_WEBHOOK_SECRET` — webhook signature verification
- `VITE_STRIPE_PRICE_ID_TEAM` — checkout session price for Team tier
- `VITE_STRIPE_PRICE_ID_ENTERPRISE` — checkout session price for Enterprise tier

### Integration points
- `POST /api/projects` (or equivalent project create endpoint) — wrap with `withQuotaCheck('projects', ...)`
- `POST /api/ai/*` or `api/ai.ts` — wrap generate-ideas handler with `withQuotaCheck('ai_ideas_per_month', ...)`
- `POST /api/invitations/create` — wrap with `withQuotaCheck('users', ...)`
- `src/components/pages/PricingPage.tsx` — existing pricing page, wire up checkout button to call new create-checkout endpoint
- `src/components/pages/SubscriptionSuccessPage.tsx` — existing success page after checkout

### Project-level
- `design-matrix-app/CLAUDE.md` — environment variables rules (STRIPE_SECRET_KEY backend only, never exposed to frontend)
- Phase 05.2's `05.2-SUMMARY.md` — lesson about env var allowlist in `vite.config.ts`

</canonical_refs>

<specifics>
## Specific Ideas

- **Prior art in this codebase:** Phase 05.2's best-effort email pattern is directly applicable to billing writes — do the mutation first, then update derived state (usage counter), never the other way around. Quota check BEFORE the mutation, counter increment AFTER.
- **Stripe customer portal** is a free feature that removes a huge amount of work — payment method edits, invoice history, plan cancellation, all handled outside our codebase. Use it.
- **Webhook endpoint must use raw body** for signature verification. The existing `webhook.ts` scaffold should already handle this — verify and preserve.
- **subscriptions row creation**: easier to create on-demand (first quota check that finds no row inserts a default `free/active` row) than to trigger on auth.users insert. Fewer moving parts.
- **Period boundary for free tier**: simplest is calendar month (1st to last day). When user upgrades, `period_start` rolls to the Stripe billing anchor date. Planner can pick the cleanest implementation.

</specifics>

<deferred>
## Deferred Ideas

- Invoice PDF download / history UI — Stripe customer portal handles this
- Proration UI beyond what Stripe shows in checkout
- Annual billing toggle in the app (prices exist, UI work is future)
- Grandfathering existing users to higher tiers
- Trial periods (free → team trial) — Stripe supports it but the flow adds complexity
- Usage alerts before hitting limits (e.g., "you've used 80% of your quota") — nice to have, not required
- Team/enterprise seat management beyond the raw count check
- Refund handling flow (admin-driven, out of scope for v1)
- Multiple subscription items per customer (addons) — not needed
- Non-USD pricing, taxes, VAT — Stripe Tax if needed, defer

</deferred>

---

*Phase: 06-billing-subscription-enforcement*
*Context gathered: 2026-04-08 via /gsd-discuss-phase (inline)*
