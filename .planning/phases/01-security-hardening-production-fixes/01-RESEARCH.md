# Phase 1: Security Hardening & Production Fixes - Research

**Researched:** 2026-04-06
**Domain:** API security middleware, Supabase auth flows, subscription enforcement, admin dashboard
**Confidence:** HIGH

## Summary

Phase 1 addresses security gaps and production bugs in a React/TypeScript SPA with Vercel serverless API routes and Supabase auth. The codebase already has well-implemented security middleware (`withCSRF`, `withRateLimit`, `withAuth`, `compose`) that simply needs to be applied to more endpoints. The five production bugs (SEC-06 through SEC-10) are all localized, well-understood issues with clear fixes. The password reset flow is partially implemented -- the "forgot password" UI exists and calls `supabase.auth.resetPasswordForEmail()`, but the app does not detect the Supabase `PASSWORD_RECOVERY` event to show a "set new password" form. Admin dashboard stats require a new query endpoint and frontend component.

The infrastructure is mature. Middleware composition via `compose.ts` provides pre-built chains (`authenticatedEndpoint`, `adminEndpoint`, `publicEndpoint`) that bundle rate limiting, CSRF, and auth verification. The main work is wiring these chains into endpoints that currently lack them, fixing three fail-open error handlers in the backend subscription service, and adding the password reset completion flow.

**Primary recommendation:** Apply existing middleware chains to all API endpoints first (lowest risk, highest security impact), then fix the five production bugs in crash-severity order per D-13, then build the admin stats and password reset completion features.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Supabase built-in `resetPasswordForEmail()` -- Supabase handles token generation, email delivery, and expiry. No custom token endpoint needed.
- **D-02:** Add "Forgot password?" link inline on the existing AuthScreen component. Toggles to a reset email input field on the same page.
- **D-03:** After clicking the emailed reset link, Supabase redirects back to the app with a token in the URL hash. AuthScreen detects this and shows a "Set new password" form inline (same component, update mode).
- **D-04:** Auth endpoints (login, signup, password reset): strict 5 attempts per IP per 15-minute window.
- **D-05:** AI endpoints (idea generation, insights, roadmap): per-user 20 requests per hour. Requires `withAuth` applied before rate limit check.
- **D-06:** Admin and webhook endpoints: apply sensible defaults using existing `withRateLimit` middleware (Claude's discretion on exact numbers).
- **D-07:** 429 response format: JSON body `{ error: 'Rate limit exceeded', retryAfter: <seconds> }` with standard `Retry-After` HTTP header. Frontend can show toast with countdown.
- **D-08:** Apply CSRF middleware to all state-changing API endpoints (POST/PUT/DELETE/PATCH) using the existing `withCSRF` middleware. Use `compose.ts` pre-built chains where applicable.
- **D-09:** Currently only `api/user.ts` has CSRF. Must add to: `api/auth.ts`, `api/ai.ts`, `api/ideas.ts`, `api/admin.ts`. `api/stripe.ts` webhooks should NOT get CSRF (Stripe sends its own signature verification).
- **D-10:** Show aggregate counts as top-level cards: total users, total projects, total ideas, active brainstorm sessions.
- **D-11:** Below aggregates, show a per-user table with columns: user email, project count, idea count, subscription tier. Satisfies ADMIN-01 and ADMIN-02.
- **D-12:** Stats fetched live via Supabase query on each admin page load. No caching layer.
- **D-13:** Bug fix execution order: SEC-07 > SEC-08 > SEC-06 > SEC-09 > SEC-10 (crash-first severity).

### Claude's Discretion
- Exact rate limit numbers for admin and webhook endpoints
- Toast/notification UI for rate limit feedback on the frontend
- How multi-modal placeholder removal is handled (return error vs return "feature not available" vs hide UI)
- CSRF token delivery mechanism details (cookie vs header)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | User can reset password via email link | Supabase `resetPasswordForEmail()` already called from AuthScreen. Missing: `PASSWORD_RECOVERY` event detection in `onAuthStateChange` and "set new password" form. |
| SEC-02 | CSRF middleware applied to all state-changing endpoints | `withCSRF` middleware fully implemented. Only `api/user.ts` uses it. Must add to auth, ai, ideas, admin. `compose.ts` chains ready. |
| SEC-03 | Rate limiting on auth endpoints | `withStrictRateLimit()` factory exists (5 req/15min in prod). Apply to `api/auth.ts`. |
| SEC-04 | Rate limiting on AI endpoints | `withUserRateLimit()` factory exists. Needs custom config: 20 req/hour per user. Apply to `api/ai.ts`. |
| SEC-05 | Rate limiting on admin and webhook endpoints | `withRateLimit()` with default config. Apply to `api/admin.ts` and `api/stripe.ts`. |
| SEC-06 | Subscription service fails closed on errors | Backend `api/_lib/services/subscriptionService.ts` returns `canUse: true` on 3 error paths (lines 29, 73, 117). Must change to `canUse: false`. |
| SEC-07 | Fix ideas.ts undefined error variable in catch block | `src/lib/multiModalProcessor.ts` line 113-118: catches as `_error` but references `error` in the body. |
| SEC-08 | Fix refresh token cookie path | `cookies.ts` line 118 sets refresh token path to `/api/auth`. Only auth refresh endpoint reads it, but if other endpoints need token refresh, path is too narrow. Verify behavior. |
| SEC-09 | Fix hardcoded userTier in AI insights | `aiInsightsService.ts` lines 182 and 925: `userTier: 'pro'` hardcoded. Also `intelligentMockData.ts` lines 370 and 524. Must read from user context. |
| SEC-10 | Remove multi-modal placeholder returns | `multiModalProcessor.ts` has placeholder strings for OCR (line 149), video transcription (line 187), and audio transcription (line 221). |
| ADMIN-01 | Admin dashboard shows real user stats | `api/admin.ts` currently handles migrations only. Need new action for stats queries. |
| ADMIN-02 | Admin can view per-user project and idea counts | Requires new Supabase query joining user_profiles, projects, ideas, subscriptions tables. |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.57.2 | Auth, DB, realtime | Already in use, handles password reset flow natively |
| express-rate-limit | 8.1.0 | Rate limiting patterns | Already installed, but project uses custom in-memory middleware |
| helmet | 8.1.0 | HTTP security headers | Already installed for CSP |
| DOMPurify | 3.2.7 | HTML sanitization | Already in use in api/user.ts |
| zod | (installed) | Input validation | Already used in api/auth.ts and api/ai.ts |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^3.2.4 | Unit testing | All middleware and service tests |
| @playwright/test | ^1.55.0 | E2E testing | Password reset flow, rate limit behavior |
| msw | 2.11.2 | API mocking | Mock Supabase responses in tests |

### No New Libraries Needed

This phase requires **zero new dependencies**. All middleware, auth patterns, and testing infrastructure already exist. [VERIFIED: codebase inspection]

## Architecture Patterns

### Existing Middleware Composition Pattern
```
api/_lib/middleware/
  compose.ts          # compose(), publicEndpoint, authenticatedEndpoint, adminEndpoint
  withAuth.ts         # withAuth, withAdmin, withOptionalAuth
  withCSRF.ts         # withCSRF(), withOriginValidation()
  withRateLimit.ts    # withRateLimit(), withStrictRateLimit(), withUserRateLimit()
  cookies.ts          # setAuthCookies(), clearAuthCookies(), getCookie()
  types.ts            # AuthenticatedRequest, MiddlewareWrapper, etc.
  index.ts            # barrel exports
```

### Pattern: Applying Middleware to Endpoints
**What:** Each API endpoint wraps its handler with composed middleware.
**Current state:** Only `api/user.ts` uses the full chain. Others use ad-hoc auth or none.
**Target state:** All state-changing endpoints use pre-built chains from `compose.ts`.

**Example (current api/user.ts -- the reference pattern):**
```typescript
// Source: api/user.ts lines 1-24 [VERIFIED: codebase]
import {
  withUserRateLimit,
  withCSRF,
  withAuth,
  compose,
  type AuthenticatedRequest,
} from './_lib/middleware/index.js'

// Handler wrapped with middleware chain
export default compose(
  withUserRateLimit(),
  withCSRF(),
  withAuth
)(async (req: AuthenticatedRequest, res) => {
  // Handler logic
})
```

### Pattern: Auth Endpoint Middleware
**Complication:** `api/auth.ts` has inline cookie utilities (duplicated from `cookies.ts`) and does NOT import from the middleware directory. It defines its own `AuthenticatedRequest` type (line 36-48). [VERIFIED: codebase]

**Action needed:** Refactor `api/auth.ts` to import from `_lib/middleware/` instead of inlining everything. This deduplication is a prerequisite to cleanly applying `withStrictRateLimit` and `withCSRF`.

### Pattern: Supabase Password Recovery Flow
**What:** Supabase `resetPasswordForEmail()` sends an email with a magic link. When the user clicks the link, Supabase redirects to the app's configured redirect URL with tokens in the URL fragment hash. The `onAuthStateChange` listener fires a `PASSWORD_RECOVERY` event.
**Current state:** AuthScreen already has `forgot-password` mode and calls `resetPasswordForEmail()` with redirect to `${origin}/reset-password`. But NO code listens for `PASSWORD_RECOVERY` event anywhere. [VERIFIED: grep found zero matches for PASSWORD_RECOVERY in src/]

**Implementation pattern:**
```typescript
// Source: Supabase docs [ASSUMED - standard Supabase v2 pattern]
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    // Show "set new password" form
    // Then call: supabase.auth.updateUser({ password: newPassword })
  }
})
```

### Pattern: Admin Stats Query
**What:** Admin endpoint queries aggregate stats using service role client.
**Existing pattern:** `api/admin.ts` already creates a service role client. New action `get-stats` follows same pattern.

### Anti-Patterns to Avoid
- **Fail-open error handling:** Never return `canUse: true` when subscription check fails. This is the SEC-06 bug. Always deny on error.
- **Inline middleware duplication:** `api/auth.ts` duplicates cookie utilities from `_lib/middleware/cookies.ts`. Do not propagate this; refactor to import.
- **Hardcoded tier values:** `userTier: 'pro'` appears in 6 places across AI services. Always read from user context/subscription.
- **Placeholder data in production:** Return proper errors or "feature not available" instead of fake OCR/transcription strings.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSRF protection | Custom token generation/validation | Existing `withCSRF()` middleware | Already handles double-submit cookie pattern with constant-time comparison |
| Rate limiting | Custom counters | Existing `withRateLimit()` / `withStrictRateLimit()` / `withUserRateLimit()` | Already has dev/prod modes, cleanup, key generation |
| Auth verification | Manual JWT parsing | Existing `withAuth` / `withAdmin` middleware | Already handles cookie + header fallback, profile fetch, role check |
| Middleware composition | Manual nesting | Existing `compose()` / `authenticatedEndpoint` / `adminEndpoint` | Clean left-to-right execution order |
| Password reset tokens | Custom token system | Supabase `resetPasswordForEmail()` + `updateUser()` | Supabase handles email delivery, token expiry, security |
| CSRF token generation | Custom random | Existing `generateCSRFToken()` from cookies.ts | Uses `crypto.getRandomValues` with base64url encoding |

**Key insight:** This phase is 80% wiring existing infrastructure to existing endpoints. The middleware layer is complete and battle-tested (api/user.ts proves it works). The main effort is applying it consistently.

## Common Pitfalls

### Pitfall 1: Refresh Token Cookie Path Restriction (SEC-08)
**What goes wrong:** The refresh token cookie has `path: '/api/auth'`, meaning the browser only sends it with requests to `/api/auth/*` paths. If the refresh flow is initiated from a different endpoint (e.g., intercepting 401s at `/api/ai`), the refresh token is invisible.
**Why it happens:** Security best practice is to restrict cookie scope, but the implementation is too narrow.
**How to avoid:** The cookie path should be `/api` (not `/api/auth`) so ALL API endpoints can initiate a token refresh. Must also update `clearAuthCookies()` which uses the same path.
**Warning signs:** Users getting logged out unexpectedly on AI or ideas requests. [VERIFIED: cookies.ts line 118 and line 145]

### Pitfall 2: auth.ts Inline Middleware Duplication
**What goes wrong:** `api/auth.ts` defines its own `AuthenticatedRequest`, `setSecureCookie`, `setAuthCookies`, `clearAuthCookies`, `parseCookies`, `getCookie`, `generateCSRFToken` -- ALL of which already exist in `_lib/middleware/`. Applying rate limiting and CSRF while keeping the inline versions creates maintenance divergence.
**Why it happens:** auth.ts was written before the middleware directory existed (comment at line 33: "INLINE COOKIE UTILITIES (to avoid middleware import issues)").
**How to avoid:** Refactor auth.ts to import from `_lib/middleware/` before adding new middleware. Test that cookie behavior is identical. [VERIFIED: api/auth.ts lines 33-131]
**Warning signs:** Two different cookie implementations with slightly different behavior.

### Pitfall 3: Stripe Webhook CSRF Exclusion
**What goes wrong:** Adding CSRF to `api/stripe.ts` breaks webhook processing because Stripe POSTs directly to your endpoint without your CSRF token.
**Why it happens:** CSRF protects browser-initiated requests; webhooks are server-to-server.
**How to avoid:** Per D-09, `api/stripe.ts` webhooks must NOT get CSRF. Only the checkout/portal actions (browser-initiated) need CSRF. Route-level middleware differentiation needed.
**Warning signs:** Stripe webhook signature verification already handles authenticity. [VERIFIED: CONTEXT.md D-09]

### Pitfall 4: Rate Limiter In-Memory Store in Serverless
**What goes wrong:** Vercel serverless functions have ephemeral memory. Each cold start resets the rate limit counters, making limits weaker than configured.
**Why it happens:** The rate limiter uses `Map<string, RateLimitEntry>` in module scope. Different function invocations may hit different instances.
**How to avoid:** Accept this limitation for v1. The in-memory approach still protects against burst attacks within a single instance's lifetime. For sustained attacks, Vercel's own DDoS protection adds a layer. Document as a known limitation. [VERIFIED: withRateLimit.ts line 34]
**Warning signs:** Rate limits appearing inconsistent under load.

### Pitfall 5: Password Recovery Redirect URL Mismatch
**What goes wrong:** `resetPasswordForEmail()` is called with `redirectTo: ${getRedirectUrl()}/reset-password` but the app uses hash-based routing (`window.location.hash`), not path-based routing. The redirect URL must match what App.tsx can detect.
**Why it happens:** Supabase appends tokens as hash fragments. The app's hash router might not handle the combination of path + hash correctly.
**How to avoid:** Verify the exact redirect URL format Supabase uses. Consider using `#reset-password` hash or ensuring the path `/reset-password` is handled by vercel.json as a SPA fallback. [VERIFIED: AuthScreen.tsx line 213, App.tsx hash routing]

### Pitfall 6: Undefined Error Variable in multiModalProcessor (SEC-07)
**What goes wrong:** Line 113 catches as `_error` (prefixed to indicate unused) but line 114 references bare `error` which is undefined in that scope. This is a runtime crash.
**Why it happens:** Naming convention (`_error` for unused) was applied but the body still references the old name.
**How to avoid:** Rename `_error` to `error` in the catch block. [VERIFIED: multiModalProcessor.ts lines 113-118]

## Code Examples

### Applying Middleware to an Existing Endpoint (auth.ts)
```typescript
// Source: Modeled after api/user.ts pattern [VERIFIED: codebase]
import { compose, withCSRF, withStrictRateLimit } from './_lib/middleware/index.js'

// For auth endpoints: strict rate limit + CSRF on state-changing methods
// Note: withAuth is NOT applied because auth endpoints handle their own auth
export default compose(
  withStrictRateLimit(),  // 5 req/15min in prod (D-04)
  withCSRF()              // Skip for GET/HEAD/OPTIONS automatically
)(async (req, res) => {
  const action = req.query.action as string
  // ... existing action routing
})
```

### AI Endpoint Rate Limiting (per-user, 20/hour)
```typescript
// Source: Modeled after withUserRateLimit pattern [VERIFIED: codebase]
import { compose, withCSRF, withAuth, withUserRateLimit } from './_lib/middleware/index.js'

export default compose(
  withUserRateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour (D-05)
    maxRequests: 20             // 20 per user per hour (D-05)
  }),
  withCSRF(),
  withAuth
)(async (req, res) => {
  // ... existing AI handler logic
})
```

### Fail-Closed Subscription Check (SEC-06 fix)
```typescript
// Source: api/_lib/services/subscriptionService.ts [VERIFIED: codebase]
// BEFORE (fail-open):
} catch (error) {
  console.error('Error in checkLimit:', error)
  return { canUse: true, current: 0, limit: 999999, ... }  // BAD
}

// AFTER (fail-closed):
} catch (error) {
  console.error('Error in checkLimit:', error)
  return { canUse: false, current: 0, limit: 0, percentageUsed: 100, isUnlimited: false }
}
```

### Password Recovery Detection
```typescript
// Source: Supabase v2 auth pattern [ASSUMED - standard Supabase onAuthStateChange]
// Add to useAuth.ts or a dedicated hook
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      // Navigate to password update form
      // session contains the recovery token
      setShowPasswordUpdate(true)
    }
  })
  return () => subscription.unsubscribe()
}, [])

// Then to update the password:
const { error } = await supabase.auth.updateUser({ password: newPassword })
```

### Admin Stats Query
```typescript
// Source: Pattern from api/admin.ts service role usage [VERIFIED: codebase]
async function handleGetStats(req: AuthenticatedRequest, res: VercelResponse) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // Aggregate counts
  const [users, projects, ideas, sessions] = await Promise.all([
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('ideas').select('*', { count: 'exact', head: true }),
    supabase.from('brainstorm_sessions').select('*', { count: 'exact', head: true })
      .eq('status', 'active')
  ])

  // Per-user breakdown
  const { data: userStats } = await supabase.rpc('get_admin_user_stats')
  // Or manual join query if RPC not available
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage tokens | httpOnly cookies | Already migrated (feature flag) | CSRF tokens now needed for all state-changing requests |
| No rate limiting | In-memory rate limiting | Middleware exists, partially applied | Must apply to all endpoints |
| Fail-open subscription | Fail-closed subscription | This phase | Prevents unlimited access on errors |

**Deprecated/outdated:**
- Inline cookie utilities in `api/auth.ts` -- should import from `_lib/middleware/cookies.ts`
- `Authorization: Bearer` header auth -- still supported as fallback but httpOnly cookies are primary

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase v2 fires `PASSWORD_RECOVERY` event on `onAuthStateChange` when user clicks reset link | Code Examples | Password reset completion flow would not work; need alternative detection method |
| A2 | `supabase.auth.updateUser({ password })` is the correct call to set new password after recovery | Code Examples | Would need different API call for password update |
| A3 | Supabase appends recovery tokens as URL hash fragments (not query params) | Pitfall 5 | Hash-based detection logic would miss the token |
| A4 | Admin and webhook rate limits of ~50 req/15min for admin, ~100 req/15min for Stripe are reasonable defaults | Claude's Discretion | Too restrictive could block legitimate admin operations; too lax provides no protection |

## Open Questions

1. **Supabase recovery redirect format**
   - What we know: `resetPasswordForEmail()` is called with `redirectTo: ${origin}/reset-password`
   - What's unclear: Exactly how Supabase formats the redirect URL with tokens, and whether the SPA's hash router will handle it correctly
   - Recommendation: Test the actual redirect URL in development. May need to update `redirectTo` or add a Vercel rewrite rule for `/reset-password` to serve `index.html`.

2. **auth.ts refactoring scope**
   - What we know: auth.ts has ~600+ lines with inline cookie utilities duplicating `_lib/middleware/cookies.ts`
   - What's unclear: Whether there are subtle behavioral differences between the inline and shared implementations
   - Recommendation: Diff the inline vs shared implementations before refactoring. Test login/logout/refresh flows after switchover.

3. **ideas.ts SEC-07 location discrepancy**
   - What we know: CONTEXT.md says SEC-07 is "Fix ideas.ts undefined error variable in catch block (line ~117)". But `api/ideas.ts` has no such bug -- its error handling is correct. The actual `_error`/`error` mismatch is in `src/lib/multiModalProcessor.ts` line 113-118.
   - What's unclear: Whether SEC-07 refers to `api/ideas.ts` or `multiModalProcessor.ts` or both
   - Recommendation: Fix the multiModalProcessor.ts bug (confirmed real). Also audit `api/ideas.ts` catch blocks for similar issues.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npm run test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Password reset email sent and new password set | E2E (manual Supabase) | Manual verification | No - Wave 0 |
| SEC-02 | CSRF rejection on missing/invalid tokens | unit | `npx vitest run api/__tests__/csrf-enforcement.test.ts` | No - Wave 0 |
| SEC-03 | Auth endpoint returns 429 after 5 attempts | unit | `npx vitest run api/__tests__/rate-limit-auth.test.ts` | No - Wave 0 |
| SEC-04 | AI endpoint returns 429 after 20/hour | unit | `npx vitest run api/__tests__/rate-limit-ai.test.ts` | No - Wave 0 |
| SEC-05 | Admin/webhook endpoints rate limited | unit | `npx vitest run api/__tests__/rate-limit-admin.test.ts` | No - Wave 0 |
| SEC-06 | Subscription denies access on error | unit | `npx vitest run api/__tests__/subscription-fail-closed.test.ts` | No - Wave 0 |
| SEC-07 | No undefined error variable crash | unit | `npx vitest run src/lib/__tests__/multiModalProcessor.test.ts` | No - Wave 0 |
| SEC-08 | Cookie path allows refresh from all /api/* | unit | `npx vitest run api/__tests__/cookie-path.test.ts` | No - Wave 0 |
| SEC-09 | userTier read from context, not hardcoded | unit | `npx vitest run src/lib/ai/__tests__/aiInsightsService.test.ts` | Yes (needs update) |
| SEC-10 | No placeholder data returned | unit | `npx vitest run src/lib/__tests__/multiModalProcessor.test.ts` | No - Wave 0 |
| ADMIN-01 | Admin dashboard shows real counts | unit + component | `npx vitest run api/__tests__/admin-stats.test.ts` | No - Wave 0 |
| ADMIN-02 | Per-user stats visible in admin | component | `npx vitest run src/components/admin/__tests__/AdminStats.test.tsx` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npm run test:run && npm run lint`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `api/__tests__/csrf-enforcement.test.ts` -- covers SEC-02
- [ ] `api/__tests__/rate-limit-auth.test.ts` -- covers SEC-03
- [ ] `api/__tests__/subscription-fail-closed.test.ts` -- covers SEC-06
- [ ] `api/__tests__/admin-stats.test.ts` -- covers ADMIN-01, ADMIN-02
- [ ] `src/lib/__tests__/multiModalProcessor.test.ts` -- covers SEC-07, SEC-10

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth + httpOnly cookies (existing) |
| V3 Session Management | yes | httpOnly cookies with Secure, SameSite, Path restrictions |
| V4 Access Control | yes | `withAuth` + `withAdmin` middleware + Supabase RLS |
| V5 Input Validation | yes | Zod schemas in API routes, DOMPurify for HTML |
| V6 Cryptography | no | No custom crypto -- Supabase handles token generation |
| V8 Data Protection | yes | CSRF double-submit cookie pattern, constant-time comparison |
| V11 HTTP Security | yes | Helmet for headers, CORS middleware |
| V13 API Security | yes | Rate limiting, CSRF, input validation on all endpoints |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on state-changing endpoints | Tampering | Double-submit cookie pattern via `withCSRF()` |
| Brute-force login | Spoofing | `withStrictRateLimit()` -- 5 req/15min per IP |
| AI cost exploitation | Denial of Service | `withUserRateLimit()` -- 20 req/hour per user |
| Fail-open subscription bypass | Elevation of Privilege | Fail-closed error handling (SEC-06 fix) |
| Hardcoded tier privilege escalation | Elevation of Privilege | Read tier from user context (SEC-09 fix) |
| Webhook spoofing | Spoofing | Stripe signature verification (already exists) |
| XSS via stored state | Tampering | DOMPurify sanitization + Zod validation |

## Sources

### Primary (HIGH confidence)
- `api/_lib/middleware/` -- Full middleware implementation reviewed (compose.ts, withCSRF.ts, withRateLimit.ts, withAuth.ts, cookies.ts)
- `api/auth.ts` -- Auth endpoint with inline cookie utilities (lines 1-50 reviewed)
- `api/ai.ts` -- AI endpoint with withAuth but no CSRF/rate limit (lines 1-60 reviewed)
- `api/admin.ts` -- Admin endpoint with no middleware (lines 1-80 reviewed)
- `api/ideas.ts` -- Ideas endpoint with no middleware (full file reviewed)
- `api/stripe.ts` -- Stripe endpoint with withAuth only (lines 1-60 reviewed)
- `api/user.ts` -- Reference implementation with full middleware chain (lines 1-40 reviewed)
- `api/_lib/services/subscriptionService.ts` -- Backend subscription with fail-open bugs (full file reviewed)
- `src/lib/multiModalProcessor.ts` -- Placeholder data and error variable bug (full file reviewed)
- `src/lib/ai/aiInsightsService.ts` -- Hardcoded userTier at lines 182, 925
- `src/lib/ai/openaiModelRouter.ts` -- userTier default 'pro' at line 62
- `src/components/auth/AuthScreen.tsx` -- Existing forgot-password mode (lines 1-80 and grep results)
- `src/App.tsx` -- Hash routing, no PASSWORD_RECOVERY handling (lines 1-60 reviewed)
- `vitest.config.ts` -- Test configuration (full file reviewed)

### Secondary (MEDIUM confidence)
- Supabase v2 `onAuthStateChange` PASSWORD_RECOVERY event pattern [ASSUMED -- standard documented behavior]

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified via codebase
- Architecture: HIGH -- existing middleware patterns fully reviewed, composition approach proven
- Pitfalls: HIGH -- all bugs verified in source code with exact line numbers
- Password reset flow: MEDIUM -- Supabase PASSWORD_RECOVERY event handling is assumed from docs

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable, existing codebase)
