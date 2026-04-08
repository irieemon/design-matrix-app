---
phase: 06-billing-subscription-enforcement
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - api/_lib/middleware/withQuotaCheck.ts
  - api/_lib/middleware/index.ts
  - src/lib/services/subscriptionService.ts
  - src/lib/services/__tests__/subscriptionService.test.ts
  - api/_lib/middleware/__tests__/withQuotaCheck.test.ts
autonomous: true
requirements: [BILL-01, BILL-03, BILL-05, BILL-06]
must_haves:
  truths:
    - "withQuotaCheck returns 402 quota_exceeded when over limit"
    - "withQuotaCheck returns 500 deny (fail-closed) on any resolution error"
    - "subscriptionService.checkLimit no longer leaks bare throws to callers that could misinterpret"
    - "subscriptionService.incrementAiUsage exists and calls increment_ai_usage RPC"
    - "getTeamMemberCount counts project_collaborators rows (no more stub of 1)"
  artifacts:
    - path: "api/_lib/middleware/withQuotaCheck.ts"
      provides: "withQuotaCheck(resource, handler) factory returning wrapped handler"
      exports: ["withQuotaCheck", "QuotaRequest", "QuotaResource"]
    - path: "src/lib/services/subscriptionService.ts"
      provides: "incrementAiUsage + fixed getTeamMemberCount + deterministic checkLimit error shape"
  key_links:
    - from: "withQuotaCheck"
      to: "subscriptionService.checkLimit"
      via: "try/catch → 500 on throw"
      pattern: "subscriptionService\\.checkLimit"
    - from: "subscriptionService.incrementAiUsage"
      to: "increment_ai_usage RPC"
      via: "supabase.rpc('increment_ai_usage', { p_user_id })"
      pattern: "increment_ai_usage"
---

<objective>
Build the quota enforcement middleware (`withQuotaCheck`) and fix the three service-level gaps: BILL-03 fail-closed semantics, stub `getTeamMemberCount`, and the missing `incrementAiUsage` method. This plan delivers the enforcement primitive Wave 3 will wire into endpoints.

Purpose: Research §1 identifies these as the backend gaps blocking BILL-01/03. This plan closes them without touching any HTTP handlers (that's Wave 3).
Output: Tested middleware + tested service patches. No endpoint wiring yet.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-billing-subscription-enforcement/06-CONTEXT.md
@.planning/phases/06-billing-subscription-enforcement/06-RESEARCH.md
@src/lib/services/subscriptionService.ts
@api/invitations/create.ts
@src/lib/config/tierLimits.ts

<interfaces>
From `src/lib/services/subscriptionService.ts`:
```ts
class SubscriptionService {
  getSubscription(userId: string): Promise<Subscription | null>
  checkLimit(userId, resource: 'projects' | 'ai_ideas' | 'users'): Promise<LimitCheckResult>
  // LimitCheckResult = { canUse, current, limit, isUnlimited, percentageUsed }
  // currently: getTeamMemberCount returns 1 (stub); checkLimit throws on error
}
```

From `api/invitations/create.ts` (bearer auth pattern to reuse):
```ts
function getAccessToken(req: VercelRequest): string | null
async function getAuthenticatedUser(req, supabase): Promise<InviterUser | null>
```

Tier limits come from `getLimit(tier, resource)` in `src/lib/config/tierLimits.ts`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Patch subscriptionService — incrementAiUsage, real getTeamMemberCount, BILL-03 checkLimit contract</name>
  <files>
    src/lib/services/subscriptionService.ts
    src/lib/services/__tests__/subscriptionService.test.ts
  </files>
  <read_first>
    - src/lib/services/subscriptionService.ts (full file)
    - src/lib/config/tierLimits.ts
  </read_first>
  <behavior>
    - Test 1: incrementAiUsage('u1') calls supabase.rpc('increment_ai_usage', { p_user_id: 'u1' }) and returns the numeric result
    - Test 2: incrementAiUsage propagates RPC errors as thrown errors (caller decides best-effort)
    - Test 3: getTeamMemberCount returns count from project_collaborators joined via projects.owner_id
    - Test 4: checkLimit('u1', 'users') wraps getTeamMemberCount and includes the real count (not 1)
    - Test 5: checkLimit on DB error throws a SubscriptionCheckError (a named class) not a bare Error — enables middleware to detect-and-deny deterministically
    - Test 6: checkLimit uses get_current_ai_usage RPC for ai_ideas (read-path reset per D-05)
  </behavior>
  <action>
1. Export a named error class at the top of subscriptionService.ts:
```ts
export class SubscriptionCheckError extends Error {
  constructor(public readonly reason: string, cause?: unknown) {
    super(`Subscription check failed: ${reason}`)
    this.name = 'SubscriptionCheckError'
    if (cause) (this as any).cause = cause
  }
}
```

2. Add `incrementAiUsage(userId: string): Promise<number>`:
```ts
async incrementAiUsage(userId: string): Promise<number> {
  const client = this.getClient()
  if (!client) throw new SubscriptionCheckError('no_client')
  const { data, error } = await client.rpc('increment_ai_usage', { p_user_id: userId })
  if (error) throw new SubscriptionCheckError('rpc_failed', error)
  return (data as number) ?? 0
}
```

3. Replace `getMonthlyAIUsage` to call `get_current_ai_usage` RPC (D-05 reset on-read):
```ts
private async getMonthlyAIUsage(userId: string): Promise<number> {
  const client = this.getClient()
  if (!client) throw new SubscriptionCheckError('no_client')
  const { data, error } = await client.rpc('get_current_ai_usage', { p_user_id: userId })
  if (error) throw new SubscriptionCheckError('rpc_failed', error)
  return (data as number) ?? 0
}
```

4. Replace `getTeamMemberCount` stub (D-07). It must count distinct collaborators across all projects owned by the user:
```ts
private async getTeamMemberCount(userId: string): Promise<number> {
  const client = this.getClient()
  if (!client) throw new SubscriptionCheckError('no_client')
  // Two-step: fetch user's project ids, then count collaborators.
  const { data: projects, error: projErr } = await client
    .from('projects')
    .select('id')
    .eq('owner_id', userId)
  if (projErr) throw new SubscriptionCheckError('projects_query', projErr)
  const projectIds = (projects ?? []).map((p: { id: string }) => p.id)
  if (projectIds.length === 0) return 0
  const { count, error: collabErr } = await client
    .from('project_collaborators')
    .select('user_id', { count: 'exact', head: true })
    .in('project_id', projectIds)
  if (collabErr) throw new SubscriptionCheckError('collab_query', collabErr)
  return count ?? 0
}
```

5. In `checkLimit`, wrap every throw path to re-raise as `SubscriptionCheckError`:
```ts
async checkLimit(userId, resource) {
  try {
    // ... existing logic ...
  } catch (err) {
    if (err instanceof SubscriptionCheckError) throw err
    throw new SubscriptionCheckError('check_limit_failed', err)
  }
}
```

Write tests in `src/lib/services/__tests__/subscriptionService.test.ts` using vitest + mocked supabase client (mock `createAuthenticatedClientFromLocalStorage` and the module-level `supabase`). Cover all 6 behaviors above.
  </action>
  <verify>
    <automated>npx vitest run src/lib/services/__tests__/subscriptionService.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - All 6 tests pass
    - grep `incrementAiUsage` in subscriptionService.ts returns the new method
    - grep `SubscriptionCheckError` exported from subscriptionService.ts
    - No `return 1 // TODO` remains in getTeamMemberCount
  </acceptance_criteria>
  <done>Service patched, tests green, BILL-03 contract is a named error class middleware can key on.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build withQuotaCheck middleware with fail-closed + 402 semantics</name>
  <files>
    api/_lib/middleware/withQuotaCheck.ts
    api/_lib/middleware/index.ts
    api/_lib/middleware/__tests__/withQuotaCheck.test.ts
  </files>
  <read_first>
    - api/_lib/middleware/index.ts (or .js — confirm extension) to see existing compose/withAuth exports
    - api/invitations/create.ts lines 42-75 (bearer auth pattern)
    - src/lib/services/subscriptionService.ts (after Task 1 patches)
  </read_first>
  <behavior>
    - Test 1: handler wrapped with withQuotaCheck('ai_ideas', h) returns 401 when no bearer token on request
    - Test 2: returns 402 with body `{ error: { code: 'quota_exceeded', resource: 'ai_ideas', limit: 5, used: 5, tier: 'free', upgradeUrl: '/pricing' } }` when checkLimit.canUse is false
    - Test 3: returns 500 with `{ error: { code: 'QUOTA_CHECK_FAILED' } }` when checkLimit throws SubscriptionCheckError (fail closed per BILL-03)
    - Test 4: invokes handler when canUse is true and attaches req.quota with userId/tier/limit/used/isUnlimited
    - Test 5: on successful ai_ideas mutation (res.statusCode < 400), calls subscriptionService.incrementAiUsage AFTER handler (D-12)
    - Test 6: does NOT call incrementAiUsage for 'projects' or 'users' resources (those are counted on read, not incremented)
    - Test 7: increment failure is swallowed (logged, not returned) — mirror Resend best-effort pattern from D-12
  </behavior>
  <action>
Create `api/_lib/middleware/withQuotaCheck.ts` with the exact signature below. Use 402 (not 429) per research §3.

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { subscriptionService, SubscriptionCheckError } from '../../../src/lib/services/subscriptionService'
import type { SubscriptionTier } from '../../../src/types/subscription'

export type QuotaResource = 'projects' | 'ai_ideas' | 'users'

export interface QuotaContext {
  userId: string
  tier: SubscriptionTier
  limit: number | null  // null = unlimited
  used: number
  isUnlimited: boolean
}

export interface QuotaRequest extends VercelRequest {
  quota: QuotaContext
}

type Handler = (req: QuotaRequest, res: VercelResponse) => Promise<VercelResponse | void> | VercelResponse | void

function getAccessToken(req: VercelRequest): string | null {
  const cookieHeader = req.headers.cookie
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/)
    if (match) return decodeURIComponent(match[1])
  }
  const authHeader = req.headers.authorization || (req.headers as any).Authorization
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Missing Supabase service-role configuration')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function withQuotaCheck(resource: QuotaResource, handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // 1. Auth
    const token = getAccessToken(req)
    if (!token) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
    }
    let userId: string
    let tier: SubscriptionTier = 'free'
    try {
      const supa = getSupabaseAdmin()
      const { data, error } = await supa.auth.getUser(token)
      if (error || !data.user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } })
      }
      userId = data.user.id
      const sub = await subscriptionService.getSubscription(userId)
      tier = sub?.tier ?? 'free'
    } catch (err) {
      console.error('[quota] auth/subscription resolve failed — denying:', err)
      return res.status(500).json({ error: { code: 'QUOTA_CHECK_FAILED', message: 'Unable to verify subscription. Please try again.' } })
    }

    // 2. Quota lookup — FAIL CLOSED (BILL-03)
    let check
    try {
      check = await subscriptionService.checkLimit(userId, resource === 'ai_ideas' ? 'ai_ideas' : resource)
    } catch (err) {
      console.error('[quota] checkLimit threw — denying:', err)
      return res.status(500).json({ error: { code: 'QUOTA_CHECK_FAILED', message: 'Unable to verify subscription. Please try again.' } })
    }

    // 3. Enforce
    if (!check.canUse) {
      return res.status(402).json({
        error: {
          code: 'quota_exceeded',
          message: `You've reached your ${resource} limit for this plan.`,
          resource,
          limit: check.isUnlimited ? null : check.limit,
          used: check.current,
          tier,
          upgradeUrl: '/pricing'
        }
      })
    }

    // 4. Attach and run
    ;(req as QuotaRequest).quota = {
      userId,
      tier,
      limit: check.isUnlimited ? null : check.limit,
      used: check.current,
      isUnlimited: check.isUnlimited
    }

    const result = await handler(req as QuotaRequest, res)

    // 5. Post-success increment (D-12: only for ai_ideas, after 2xx)
    if (resource === 'ai_ideas' && res.statusCode < 400) {
      subscriptionService.incrementAiUsage(userId).catch((err) => {
        console.error('[quota] incrementAiUsage failed (non-blocking):', err)
      })
    }

    return result
  }
}
```

Re-export from `api/_lib/middleware/index.ts` (or .js — match existing file) alongside `withAuth`/`withRateLimit`/`compose`:
```ts
export { withQuotaCheck } from './withQuotaCheck'
export type { QuotaRequest, QuotaResource, QuotaContext } from './withQuotaCheck'
```

Write tests mocking subscriptionService and a minimal fake `@supabase/supabase-js` createClient for auth.getUser. Cover all 7 behaviors.
  </action>
  <verify>
    <automated>npx vitest run api/_lib/middleware/__tests__/withQuotaCheck.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - All 7 middleware tests pass
    - grep `withQuotaCheck` exported from api/_lib/middleware/index (.ts or .js)
    - Middleware returns 402 (not 429) on over-limit
    - Fail-closed: mockRejectedValue on checkLimit → 500 QUOTA_CHECK_FAILED
  </acceptance_criteria>
  <done>Middleware built, all tests green, ready for Wave 3 wiring.</done>
</task>

</tasks>

<verification>
- Both vitest suites pass
- `npm run type-check` passes
- Service patches and middleware file both in place
</verification>

<success_criteria>
BILL-03 enforced: any error in the quota pipeline returns 500 deny. Middleware is ready to wrap endpoints. subscriptionService no longer stubs team member count.
</success_criteria>

<output>
Create `.planning/phases/06-billing-subscription-enforcement/06-02-SUMMARY.md` listing the SubscriptionCheckError class, new methods, 402 response shape.
</output>
