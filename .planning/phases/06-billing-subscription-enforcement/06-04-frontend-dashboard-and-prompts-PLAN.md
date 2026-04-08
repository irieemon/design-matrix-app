---
phase: 06-billing-subscription-enforcement
plan: 04
type: execute
wave: 4
depends_on: [03]
files_modified:
  - src/hooks/useSubscription.ts
  - src/hooks/__tests__/useSubscription.test.tsx
  - src/components/settings/SubscriptionPanel.tsx
  - src/components/billing/UpgradePrompt.tsx
  - src/components/billing/PaymentFailedBanner.tsx
  - src/components/pages/PricingPage.tsx
  - src/components/pages/SettingsPage.tsx
  - src/components/app/MainApp.tsx
  - src/components/ProjectStartupFlow.tsx
  - src/components/AIStarterModal.tsx
autonomous: false
requirements: [BILL-02, BILL-04, BILL-06]
must_haves:
  truths:
    - "User can open Settings and see current plan, projects/AI/users usage bars, and period reset date"
    - "User sees 'Upgrade' and 'Manage Subscription' buttons that launch Stripe checkout and portal respectively"
    - "When the user hits their project limit, the Create Project flow shows an inline upgrade prompt instead of silently failing"
    - "When the user hits their AI generation limit, the AI generate button shows an inline upgrade prompt"
    - "Unread payment_failed notification shows a banner in the app header until dismissed"
    - "PricingPage 'Upgrade' button POSTs to /api/stripe?action=checkout and redirects to the returned url"
  artifacts:
    - path: "src/hooks/useSubscription.ts"
      provides: "Hook returning { subscription, limits, isLoading, refresh } backed by getSubscriptionWithLimits"
      exports: ["useSubscription"]
    - path: "src/components/settings/SubscriptionPanel.tsx"
      provides: "Settings UI with plan badge, usage bars, reset date, upgrade + manage buttons"
      min_lines: 80
    - path: "src/components/billing/UpgradePrompt.tsx"
      provides: "Reusable inline card: <UpgradePrompt resource='projects' limit={1} used={1} />"
    - path: "src/components/billing/PaymentFailedBanner.tsx"
      provides: "Banner component polling user_notifications for unread payment_failed rows"
  key_links:
    - from: "SubscriptionPanel"
      to: "getSubscriptionWithLimits"
      via: "useSubscription hook"
      pattern: "getSubscriptionWithLimits"
    - from: "PricingPage upgrade button"
      to: "/api/stripe?action=checkout"
      via: "fetch POST"
      pattern: "action=checkout"
    - from: "PaymentFailedBanner"
      to: "user_notifications"
      via: "supabase select where read_at is null and type='payment_failed'"
      pattern: "user_notifications"
---

<objective>
Ship the Phase 6 user-facing surfaces: subscription dashboard in Settings (BILL-04), inline upgrade prompts at point-of-limit (BILL-06), payment-failed banner (BILL-02), and wire PricingPage's upgrade button to the real Stripe checkout endpoint.

Purpose: Backend is enforcing; now users can see and act on it. This plan closes BILL-02, BILL-04, BILL-06.
Output: Four new UI components + one new hook + three edited host components + human-verify checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-billing-subscription-enforcement/06-CONTEXT.md
@src/lib/services/subscriptionService.ts
@src/lib/config/tierLimits.ts
@src/components/pages/PricingPage.tsx
@src/components/app/MainApp.tsx

<interfaces>
From subscriptionService (already exists):
```ts
getSubscriptionWithLimits(userId): Promise<{
  ...subscription,
  limits: {
    projects: LimitCheckResult,
    ai_ideas: LimitCheckResult,
    users: LimitCheckResult,
  }
}>
// LimitCheckResult = { canUse, current, limit, isUnlimited, percentageUsed }
```

From tierLimits.ts:
```ts
TIER_NAMES: Record<SubscriptionTier, string>   // 'Free' | 'Team' | 'Enterprise'
TIER_PRICING: Record<SubscriptionTier, number>
```

From api/stripe.ts (already exists):
- POST /api/stripe?action=checkout body `{ priceId, tier }` → `{ sessionId, url }`
- POST /api/stripe?action=portal → `{ url }`

Env vars (frontend): `VITE_STRIPE_PRICE_ID_TEAM`, `VITE_STRIPE_PRICE_ID_ENTERPRISE`

402 response shape from Wave 3: `{ error: { code: 'quota_exceeded', resource, limit, used, tier, upgradeUrl } }`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useSubscription hook + SubscriptionPanel + UpgradePrompt + PaymentFailedBanner</name>
  <files>
    src/hooks/useSubscription.ts
    src/hooks/__tests__/useSubscription.test.tsx
    src/components/settings/SubscriptionPanel.tsx
    src/components/billing/UpgradePrompt.tsx
    src/components/billing/PaymentFailedBanner.tsx
  </files>
  <read_first>
    - src/lib/services/subscriptionService.ts (getSubscriptionWithLimits signature)
    - src/lib/config/tierLimits.ts (TIER_NAMES, TIER_PRICING, SubscriptionTier)
    - src/hooks/useAuth.ts (see auth user shape)
    - Any existing Settings page to match styling
  </read_first>
  <behavior>
    - Test 1: useSubscription calls subscriptionService.getSubscriptionWithLimits with the current user id and returns { subscription, limits, isLoading: false } on success
    - Test 2: useSubscription sets isLoading=true initially and exposes a refresh() that re-fetches
    - Test 3: useSubscription returns error state on failure (does not crash)
    - Test 4: SubscriptionPanel renders 'Free' badge, '1 / 1' for projects, '3 / 5' for AI when given known limits; renders 'Unlimited' when isUnlimited
    - Test 5: SubscriptionPanel upgrade button calls POST /api/stripe?action=checkout and redirects window.location.href to returned url (test with fetch mocked)
    - Test 6: SubscriptionPanel 'Manage Subscription' calls POST /api/stripe?action=portal and redirects
    - Test 7: UpgradePrompt renders resource label, used/limit, a CTA linking to /pricing
    - Test 8: PaymentFailedBanner polls user_notifications, renders when row exists, hides when dismissed (PATCH sets read_at)
  </behavior>
  <action>
**useSubscription.ts:**
```ts
import { useCallback, useEffect, useState } from 'react'
import { subscriptionService } from '../lib/services/subscriptionService'
import { useAuth } from './useAuth'
import type { SubscriptionWithLimits } from '../types/subscription'

export function useSubscription() {
  const { currentUser } = useAuth()
  const [data, setData] = useState<SubscriptionWithLimits | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!currentUser?.id) return
    setIsLoading(true)
    try {
      const result = await subscriptionService.getSubscriptionWithLimits(currentUser.id)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [currentUser?.id])

  useEffect(() => { void refresh() }, [refresh])

  return { subscription: data, limits: data?.limits ?? null, isLoading, error, refresh }
}
```

**SubscriptionPanel.tsx:** Render the dashboard spec from research §6:
- Current Plan badge (`TIER_NAMES[tier]`), status indicator
- Three usage bars: projects, AI ideas, team members. For each: `{used} / {limit}` or `{used} / Unlimited`
- Period reset date (next month's 1st for free tier, subscription.current_period_end for paid)
- Upgrade button (if tier === 'free'): POST /api/stripe?action=checkout with team tier + VITE_STRIPE_PRICE_ID_TEAM
- Manage Subscription button (if tier !== 'free'): POST /api/stripe?action=portal
- Both buttons `window.location.href = data.url` on success
- Include credentials: 'include' in fetch

**UpgradePrompt.tsx:** Props `{ resource: 'projects' | 'ai_ideas' | 'users'; limit: number | null; used: number; compact?: boolean }`. Renders a card with:
- Icon, title "You've reached your {resource label} limit"
- Used/Limit readout
- "Upgrade to {next tier}" CTA linking to `/pricing`

**PaymentFailedBanner.tsx:** Uses the browser supabase client to SELECT from `user_notifications` where `user_id = currentUser.id AND type='payment_failed' AND read_at IS NULL ORDER BY created_at DESC LIMIT 1`. Polls every 60 seconds (setInterval + cleanup). When a notification exists, renders a sticky banner at the top of the app with the message and a dismiss (X) button. Dismiss does `UPDATE user_notifications SET read_at = now() WHERE id = ?` (RLS policy from Plan 01 allows this).

Write vitest tests covering all 8 behaviors. Mock subscriptionService, fetch, supabase client.
  </action>
  <verify>
    <automated>npx vitest run src/hooks/__tests__/useSubscription.test.tsx src/components/settings/__tests__ src/components/billing/__tests__ 2>/dev/null || npx vitest run src/hooks/__tests__/useSubscription.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - All tests pass
    - Four new component/hook files exist
    - SubscriptionPanel contains grep-visible strings: 'Subscription', 'Upgrade', 'Manage Subscription'
    - PaymentFailedBanner queries user_notifications
  </acceptance_criteria>
  <done>Hook + three components built and tested.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire new UI into host pages — Settings, MainApp, PricingPage, create-project + AI flows</name>
  <files>
    src/components/pages/SettingsPage.tsx
    src/components/app/MainApp.tsx
    src/components/pages/PricingPage.tsx
    src/components/ProjectStartupFlow.tsx
    src/components/AIStarterModal.tsx
  </files>
  <read_first>
    - src/components/pages/SettingsPage.tsx (find section layout — where to insert SubscriptionPanel)
    - src/components/app/MainApp.tsx (find app shell header to insert PaymentFailedBanner)
    - src/components/pages/PricingPage.tsx (find tier buttons — wire to /api/stripe?action=checkout)
    - src/components/ProjectStartupFlow.tsx (find create button/submit — intercept when limits.projects.canUse === false)
    - src/components/AIStarterModal.tsx (find AI generate button — intercept when limits.ai_ideas.canUse === false)
  </read_first>
  <action>
**SettingsPage.tsx:** Import `SubscriptionPanel` and render it as a new section "Subscription & Usage" in the existing settings layout. Exact location is Claude's discretion — choose the section ordering that matches the existing nav.

**MainApp.tsx:** Import `PaymentFailedBanner` and render at the top of the main shell above the existing project header. Conditional: only for authenticated users.

**PricingPage.tsx:** Find the existing tier upgrade buttons (Team / Enterprise). Replace their handlers with:
```ts
async function handleUpgrade(tier: 'team' | 'enterprise') {
  const priceId = tier === 'team'
    ? import.meta.env.VITE_STRIPE_PRICE_ID_TEAM
    : import.meta.env.VITE_STRIPE_PRICE_ID_ENTERPRISE
  const res = await fetch('/api/stripe?action=checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ priceId, tier }),
  })
  if (!res.ok) {
    // Show error toast (use existing toast mechanism in the codebase)
    return
  }
  const { url } = await res.json()
  if (url) window.location.href = url
}
```

**ProjectStartupFlow.tsx:** Use `useSubscription` hook. When `limits?.projects && !limits.projects.canUse && !limits.projects.isUnlimited`, render `<UpgradePrompt resource='projects' limit={limits.projects.limit} used={limits.projects.current} />` in place of (or above) the create button, and disable the create button. Also handle the 402 response from POST /api/projects: if response has `error.code === 'quota_exceeded'`, show the same prompt.

**AIStarterModal.tsx:** Same pattern for `limits.ai_ideas`. Intercept the generate button; show `<UpgradePrompt resource='ai_ideas' ... />` when over limit. On 402 response from /api/ai?action=generate-ideas, show the prompt.

Do not alter unrelated behavior. If any target file is large, locate the exact modification spot via grep for the button text or handler name before editing.
  </action>
  <verify>
    <automated>grep -l "SubscriptionPanel" src/components/pages/SettingsPage.tsx && grep -l "PaymentFailedBanner" src/components/app/MainApp.tsx && grep -l "action=checkout" src/components/pages/PricingPage.tsx && grep -l "UpgradePrompt" src/components/ProjectStartupFlow.tsx && grep -l "UpgradePrompt" src/components/AIStarterModal.tsx && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 5 host files import and use the new components
    - `npx tsc --noEmit` passes
    - No regressions in unrelated behavior (existing tests still pass: `npm run test:run`)
  </acceptance_criteria>
  <done>UI wired end-to-end, typecheck green.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Full-flow UX verification</name>
  <what-built>Subscription dashboard, inline upgrade prompts, payment-failed banner, wired PricingPage</what-built>
  <how-to-verify>
    1. Log in as a free user. Open Settings → Subscription & Usage. Confirm: Free badge, three usage bars, period reset date visible.
    2. Click "Upgrade" → lands on Stripe checkout (test mode). Use `4242 4242 4242 4242` to complete payment. Return to app — dashboard should show "Team" (wait a few seconds for webhook).
    3. As free user with 1 project already: click "Create Project" — confirm upgrade prompt appears in-flow, button disabled.
    4. As free user who has used 5 AI generations: click AI Starter generate — confirm upgrade prompt in-flow.
    5. Trigger `stripe trigger invoice.payment_failed` — within 60 seconds, banner should appear at top of app. Click dismiss — banner disappears and does not return on reload.
    6. Click "Manage Subscription" — Stripe customer portal opens.
  </how-to-verify>
  <resume-signal>Type "approved" once all six flows work; describe any failures otherwise</resume-signal>
</task>

</tasks>

<verification>
- vitest tests pass for new components
- tsc clean
- Human verified all six flows end-to-end
</verification>

<success_criteria>
BILL-02, BILL-04, BILL-06 delivered end-to-end. Phase 6 success criteria 1-4 from ROADMAP.md all observable in the live app.
</success_criteria>

<output>
Create `.planning/phases/06-billing-subscription-enforcement/06-04-SUMMARY.md` with screenshots (or descriptions) of each UI surface and any Stripe test-mode caveats discovered.
</output>
