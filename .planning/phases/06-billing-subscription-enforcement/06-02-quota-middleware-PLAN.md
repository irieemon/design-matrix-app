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
    - "subscriptionService methods used by middleware accept an optional SupabaseClient parameter so callers can inject a service-role client (no more silent anon-key fail-open)"
    - "subscriptionService.checkLimit no longer leaks bare throws to callers that could misinterpret"
    - "subscriptionService.incrementAiUsage exists and calls increment_ai_usage RPC"
    - "getTeamMemberCount counts project_collaborators rows (no more stub of 1)"
  artifacts:
    - path: "api/_lib/middleware/withQuotaCheck.ts"
      provides: "withQuotaCheck(resource, handler) factory returning wrapped handler; constructs admin client and injects it into subscriptionService calls"
      exports: ["withQuotaCheck", "QuotaRequest", "QuotaResource"]
    - path: "src/lib/services/subscriptionService.ts"
      provides: "incrementAiUsage + fixed getTeamMemberCount + deterministic checkLimit error shape + optional client injection"
  key_links:
    - from: "withQuotaCheck"
      to: "subscriptionService.checkLimit"
      via: "passes admin client as third arg; try/catch → 500 on throw"
      pattern: "subscriptionService\\.checkLimit\\([^)]*adminClient"
    - from: "subscriptionService.incrementAiUsage"
      to: "increment_ai_usage RPC"
      via: "client.rpc('increment_ai_usage', { p_user_id })"
      pattern: "increment_ai_usage"
---

<objective>
Build the quota enforcement middleware (`withQuotaCheck`) and fix the service-level gaps: BILL-03 fail-closed semantics, stub `getTeamMemberCount`, missing `incrementAiUsage` method, and the silent anon-key fail-open caused by the module-level `supabase` singleton when called from server-side middleware. This plan delivers the enforcement primitive Wave 3 will wire into endpoints.

Purpose: Research §1 and verifier Blocker 4 identify these as the backend gaps blocking BILL-01/03. This plan closes them without touching any HTTP handlers (that's Wave 3).
Output: Tested middleware + tested service patches with client-injection support. No endpoint wiring yet.
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
  // BEFORE this plan — no client param; uses module-level anon supabase singleton on server side:
  getSubscription(userId: string): Promise<Subscription | null>
  checkLimit(userId, resource: 'projects' | 'ai_ideas' | 'users'): Promise<LimitCheckResult>
  // LimitCheckResult = { canUse, current, limit, isUnlimited, percentageUsed }
  // currently: getTeamMemberCount returns 1 (stub); checkLimit throws on error
}
```

**Critical context (verifier Blocker 4):** `subscriptionService` imports `supabase` (the anon-key browser singleton) from `src/lib/supabase`. On server side it uses that singleton — the anon key has no authenticated user, so RLS on `subscriptions`/`usage_tracking` returns empty rows. `getSubscription` then auto-creates a new 'free' sub on every call, and `checkLimit` always returns `canUse=true` until the counter somehow reaches the limit (which it never will because the increment path has the same issue). **The middleware is silently non-functional without client injection.**

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
  <name>Task 1: Patch subscriptionService — client injection, incrementAiUsage, real getTeamMemberCount, BILL-03 checkLimit contract</name>
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
    - Test 2: incrementAiUsage propagates RPC errors as thrown SubscriptionCheckError
    - Test 3: getTeamMemberCount returns count from project_collaborators joined via projects.owner_id
    - Test 4: checkLimit('u1', 'users') wraps getTeamMemberCount and includes the real count (not 1)
    - Test 5: checkLimit on DB error throws a SubscriptionCheckError (a named class) not a bare Error — enables middleware to detect-and-deny deterministically
    - Test 6: checkLimit uses get_current_ai_usage RPC for ai_ideas (read-path reset per D-05)
    - Test 7 (CLIENT INJECTION): When getSubscription(userId, injectedClient) is called with an explicit client, all supabase queries in that call use injectedClient — NOT the module-level singleton. Test by passing a mock client with a spy on .from() and asserting the spy was called, and the module singleton's .from() was NOT called.
    - Test 8 (CLIENT INJECTION): checkLimit(userId, resource, injectedClient) likewise propagates the injected client to internal helpers (getMonthlyAIUsage, getTeamMemberCount, getProjectCount, getSubscription).
    - Test 9 (CLIENT INJECTION): incrementAiUsage(userId, injectedClient) uses the injected client for the .rpc() call.
    - Test 10 (DEFAULT PRESERVED): When no client is passed, behavior is unchanged — uses this.getClient() (browser vs server singleton picker).
  </behavior>
  <action>
**Step 1 — Import SupabaseClient type** at the top of subscriptionService.ts:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
```

**Step 2 — Export a named error class** at the top of subscriptionService.ts:
```ts
export class SubscriptionCheckError extends Error {
  constructor(public readonly reason: string, cause?: unknown) {
    super(`Subscription check failed: ${reason}`)
    this.name = 'SubscriptionCheckError'
    if (cause) (this as any).cause = cause
  }
}
```

**Step 3 — Add optional `client` parameter to every method used by the middleware.** The pattern: when `client` is provided use it, otherwise fall back to `this.getClient()`. This preserves existing browser behavior (no caller passes a client) while enabling server-side injection.

Method signatures to update:
```ts
async getSubscription(userId: string, client?: SupabaseClient): Promise<Subscription | null>
async checkLimit(userId: string, resource: 'projects' | 'ai_ideas' | 'users', client?: SupabaseClient): Promise<LimitCheckResult>
async incrementAiUsage(userId: string, client?: SupabaseClient): Promise<number>
private async getMonthlyAIUsage(userId: string, client?: SupabaseClient): Promise<number>
private async getProjectCount(userId: string, client?: SupabaseClient): Promise<number>
private async getTeamMemberCount(userId: string, client?: SupabaseClient): Promise<number>
async recordUsage(userId: string, resourceType: string, client?: SupabaseClient): Promise<void>   // if used by middleware
```

In each method body, replace `const client = this.getClient();` with:
```ts
const db = client ?? this.getClient();
if (!db) throw new SubscriptionCheckError('no_client');
```
and use `db` for all supabase queries.

In `checkLimit`, when calling the internal helpers pass `db` through:
```ts
const current = await this.getMonthlyAIUsage(userId, db);
// etc.
```

Also in `getSubscription`, when the PGRST116 branch triggers `createSubscription`, pass `db` through (add `client?: SupabaseClient` to createSubscription as well and use `db`).

**Step 4 — Add `incrementAiUsage`:**
```ts
async incrementAiUsage(userId: string, client?: SupabaseClient): Promise<number> {
  const db = client ?? this.getClient();
  if (!db) throw new SubscriptionCheckError('no_client');
  const { data, error } = await db.rpc('increment_ai_usage', { p_user_id: userId });
  if (error) throw new SubscriptionCheckError('rpc_failed', error);
  return (data as number) ?? 0;
}
```

**Step 5 — Replace `getMonthlyAIUsage`** to call `get_current_ai_usage` RPC (D-05 reset on-read):
```ts
private async getMonthlyAIUsage(userId: string, client?: SupabaseClient): Promise<number> {
  const db = client ?? this.getClient();
  if (!db) throw new SubscriptionCheckError('no_client');
  const { data, error } = await db.rpc('get_current_ai_usage', { p_user_id: userId });
  if (error) throw new SubscriptionCheckError('rpc_failed', error);
  return (data as number) ?? 0;
}
```

**Step 6 — Replace `getTeamMemberCount` stub (D-07):**
```ts
private async getTeamMemberCount(userId: string, client?: SupabaseClient): Promise<number> {
  const db = client ?? this.getClient();
  if (!db) throw new SubscriptionCheckError('no_client');
  const { data: projects, error: projErr } = await db
    .from('projects')
    .select('id')
    .eq('owner_id', userId);
  if (projErr) throw new SubscriptionCheckError('projects_query', projErr);
  const projectIds = (projects ?? []).map((p: { id: string }) => p.id);
  if (projectIds.length === 0) return 0;
  const { count, error: collabErr } = await db
    .from('project_collaborators')
    .select('user_id', { count: 'exact', head: true })
    .in('project_id', projectIds);
  if (collabErr) throw new SubscriptionCheckError('collab_query', collabErr);
  return count ?? 0;
}
```

**Step 7 — Wrap `checkLimit` throws as SubscriptionCheckError:**
```ts
async checkLimit(userId, resource, client?: SupabaseClient) {
  try {
    // ... existing logic, passing client ?? this.getClient() through as `db` ...
  } catch (err) {
    if (err instanceof SubscriptionCheckError) throw err;
    throw new SubscriptionCheckError('check_limit_failed', err);
  }
}
```

Write tests in `src/lib/services/__tests__/subscriptionService.test.ts` using vitest. Create a mock SupabaseClient with spied `.from()`, `.rpc()`, etc., and pass it explicitly. Also mock the module-level `supabase` singleton import and assert it is NOT called when a client is injected. Cover all 10 behaviors above.
  </action>
  <verify>
    <automated>npx vitest run src/lib/services/__tests__/subscriptionService.test.ts && grep -q "client?: SupabaseClient" src/lib/services/subscriptionService.ts && grep -q "SubscriptionCheckError" src/lib/services/subscriptionService.ts && grep -q "incrementAiUsage" src/lib/services/subscriptionService.ts</automated>
  </verify>
  <acceptance_criteria>
    - All 10 tests pass
    - grep `client?: SupabaseClient` appears in subscriptionService.ts method signatures
    - grep `incrementAiUsage` in subscriptionService.ts returns the new method
    - grep `SubscriptionCheckError` exported from subscriptionService.ts
    - No `return 1 // TODO` remains in getTeamMemberCount
    - No caller in the existing codebase breaks (client param is optional)
  </acceptance_criteria>
  <done>Service patched with client injection + named error class + real team count + incrementAiUsage; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build withQuotaCheck middleware with fail-closed + 402 semantics + admin client injection</name>
  <files>
    api/_lib/middleware/withQuotaCheck.ts
    api/_lib/middleware/index.ts
    api/_lib/middleware/__tests__/withQuotaCheck.test.ts
  </files>
  <read_first>
    - api/_lib/middleware/index.ts (or .js — confirm extension) to see existing compose/withAuth exports
    - api/invitations/create.ts lines 42-75 (bearer auth pattern)
    - src/lib/services/subscriptionService.ts (after Task 1 patches — confirm client param is in place)
  </read_first>
  <behavior>
    - Test 1: handler wrapped with withQuotaCheck('ai_ideas', h) returns 401 when no bearer token on request
    - Test 2: returns 402 with body `{ error: { code: 'quota_exceeded', resource: 'ai_ideas', limit: 5, used: 5, tier: 'free', upgradeUrl: '/pricing' } }` when checkLimit.canUse is false
    - Test 3: returns 500 with `{ error: { code: 'QUOTA_CHECK_FAILED' } }` when checkLimit throws SubscriptionCheckError (fail closed per BILL-03)
    - Test 4: invokes handler when canUse is true and attaches req.quota with userId/tier/limit/used/isUnlimited
    - Test 5: on successful ai_ideas mutation (res.statusCode < 400), calls subscriptionService.incrementAiUsage AFTER handler (D-12)
    - Test 6: does NOT call incrementAiUsage for 'projects' or 'users' resources (those are counted on read, not incremented)
    - Test 7: increment failure is swallowed (logged, not returned) — mirror Resend best-effort pattern from D-12
    - Test 8 (CLIENT INJECTION): middleware passes an admin SupabaseClient into subscriptionService.getSubscription, checkLimit, and incrementAiUsage calls. Test by spying on subscriptionService methods and asserting the third argument is a truthy client object.
    - Test 9 (CLIENT INJECTION): the service's singleton .from() is never invoked during a middleware request (assert via mock).
  </behavior>
  <action>
Create `api/_lib/middleware/withQuotaCheck.ts` with the exact signature below. Use 402 (not 429) per research §3. The middleware constructs a service-role Supabase admin client once per request and **passes it into every subscriptionService call** (fixes verifier Blocker 4).

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
    let adminClient: SupabaseClient
    try {
      adminClient = getSupabaseAdmin()
      const { data, error } = await adminClient.auth.getUser(token)
      if (error || !data.user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } })
      }
      userId = data.user.id
      // CRITICAL: inject adminClient — do NOT rely on subscriptionService singleton (anon key would return empty rows under RLS, causing silent fail-open).
      const sub = await subscriptionService.getSubscription(userId, adminClient)
      tier = sub?.tier ?? 'free'
    } catch (err) {
      console.error('[quota] auth/subscription resolve failed — denying:', err)
      return res.status(500).json({ error: { code: 'QUOTA_CHECK_FAILED', message: 'Unable to verify subscription. Please try again.' } })
    }

    // 2. Quota lookup — FAIL CLOSED (BILL-03), injected adminClient
    let check
    try {
      check = await subscriptionService.checkLimit(userId, resource, adminClient)
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

    // 5. Post-success increment (D-12: only for ai_ideas, after 2xx), using injected admin client
    if (resource === 'ai_ideas' && res.statusCode < 400) {
      subscriptionService.incrementAiUsage(userId, adminClient).catch((err) => {
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

Write tests mocking `subscriptionService` methods with spies. Assertions:
- Tests 8 & 9 must verify `subscriptionService.getSubscription`, `checkLimit`, and `incrementAiUsage` were called with an admin client as an extra argument (truthy object), and that the underlying singleton was NOT used.
- Mock `@supabase/supabase-js` createClient to return a stub with `auth.getUser()` resolving to a fake user.
Cover all 9 behaviors.
  </action>
  <verify>
    <automated>npx vitest run api/_lib/middleware/__tests__/withQuotaCheck.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - All 9 middleware tests pass
    - grep `withQuotaCheck` exported from api/_lib/middleware/index (.ts or .js)
    - Middleware returns 402 (not 429) on over-limit
    - Fail-closed: mockRejectedValue on checkLimit → 500 QUOTA_CHECK_FAILED
    - Middleware passes an admin client into subscriptionService.getSubscription, checkLimit, and incrementAiUsage (verified by spy)
  </acceptance_criteria>
  <done>Middleware built with admin-client injection, all tests green, ready for Wave 3 wiring.</done>
</task>

</tasks>

<verification>
- Both vitest suites pass
- `npm run type-check` passes
- Service patches and middleware file both in place
- Anon-key fail-open root cause (verifier Blocker 4) resolved via client injection
</verification>

<success_criteria>
BILL-03 enforced: any error in the quota pipeline returns 500 deny. Middleware is ready to wrap endpoints and uses a service-role client end-to-end. subscriptionService no longer stubs team member count.
</success_criteria>

<output>
Create `.planning/phases/06-billing-subscription-enforcement/06-02-SUMMARY.md` listing the SubscriptionCheckError class, new methods, client-injection pattern, and 402 response shape.
</output>
