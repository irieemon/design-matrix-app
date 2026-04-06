# Phase 1: Security Hardening & Production Fixes - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix security gaps (CSRF, rate limiting, password reset), production bugs (cookie path, error variables, fake data, hardcoded tier, fail-closed subscription), and admin placeholder data before exposing new endpoints or features. The application must be safe for public access after this phase.

</domain>

<decisions>
## Implementation Decisions

### Password Reset Flow
- **D-01:** Use Supabase built-in `resetPasswordForEmail()` — Supabase handles token generation, email delivery, and expiry. No custom token endpoint needed.
- **D-02:** Add "Forgot password?" link inline on the existing AuthScreen component. Toggles to a reset email input field on the same page.
- **D-03:** After clicking the emailed reset link, Supabase redirects back to the app with a token in the URL hash. AuthScreen detects this and shows a "Set new password" form inline (same component, update mode).

### Rate Limiting Strategy
- **D-04:** Auth endpoints (login, signup, password reset): strict 5 attempts per IP per 15-minute window.
- **D-05:** AI endpoints (idea generation, insights, roadmap): per-user 20 requests per hour. Requires `withAuth` applied before rate limit check.
- **D-06:** Admin and webhook endpoints: apply sensible defaults using existing `withRateLimit` middleware (Claude's discretion on exact numbers).
- **D-07:** 429 response format: JSON body `{ error: 'Rate limit exceeded', retryAfter: <seconds> }` with standard `Retry-After` HTTP header. Frontend can show toast with countdown.

### CSRF Enforcement
- **D-08:** Apply CSRF middleware to all state-changing API endpoints (POST/PUT/DELETE/PATCH) using the existing `withCSRF` middleware. Use `compose.ts` pre-built chains (`protectedEndpoint`, `adminEndpoint`) where applicable.
- **D-09:** Currently only `api/user.ts` has CSRF. Must add to: `api/auth.ts`, `api/ai.ts`, `api/ideas.ts`, `api/admin.ts`. `api/stripe.ts` webhooks should NOT get CSRF (Stripe sends its own signature verification).

### Admin Dashboard Metrics
- **D-10:** Show aggregate counts as top-level cards: total users, total projects, total ideas, active brainstorm sessions.
- **D-11:** Below aggregates, show a per-user table with columns: user email, project count, idea count, subscription tier. Satisfies ADMIN-01 and ADMIN-02.
- **D-12:** Stats fetched live via Supabase query on each admin page load. No caching layer — solo admin with modest data doesn't need it.

### Bug Fix Execution Order
- **D-13:** Claude handles all five fixes (SEC-06 through SEC-10) in crash-first severity order:
  1. SEC-07: Fix `ideas.ts` undefined error variable in catch block (runtime crash)
  2. SEC-08: Fix refresh token cookie path to work on all `/api/*` paths (auth breakage)
  3. SEC-06: Subscription service fails closed on errors — deny access, not `canUse: true` (security)
  4. SEC-09: Fix hardcoded `userTier: 'pro'` in AI insights — read from user context (data integrity)
  5. SEC-10: Remove multi-modal placeholder returns — no fake data in production (cleanup)

### Claude's Discretion
- Exact rate limit numbers for admin and webhook endpoints
- Toast/notification UI for rate limit feedback on the frontend
- How multi-modal placeholder removal is handled (return error vs return "feature not available" vs hide UI)
- CSRF token delivery mechanism details (cookie vs header)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security Middleware
- `api/_lib/middleware/withCSRF.ts` — CSRF middleware implementation, token validation logic
- `api/_lib/middleware/withRateLimit.ts` — Rate limiting middleware with `withAuthRateLimit()` and `withAIRateLimit()` factory functions
- `api/_lib/middleware/withAuth.ts` — Auth middleware, `withAdmin` wrapper for admin endpoints
- `api/_lib/middleware/compose.ts` — Pre-built middleware chains: `publicEndpoint`, `protectedEndpoint`, `adminEndpoint`
- `api/_lib/middleware/index.ts` — Middleware barrel exports

### API Endpoints (apply middleware to these)
- `api/auth.ts` — Auth endpoint (login, signup — needs CSRF + rate limiting)
- `api/ai.ts` — AI endpoint (2500+ lines — needs CSRF + per-user rate limiting)
- `api/ideas.ts` — Ideas CRUD (needs CSRF, contains SEC-07 bug at line ~117)
- `api/admin.ts` — Admin endpoint (needs admin rate limiting, contains hardcoded stats)
- `api/stripe.ts` — Stripe endpoint (already has withAuth, needs rate limiting but NOT CSRF on webhooks)
- `api/user.ts` — User endpoint (already has withCSRF + withAuth)

### Auth & Password Reset
- `src/components/auth/AuthScreen.tsx` — Login/signup UI, target for password reset form
- `src/hooks/useAuth.ts` — Auth hook (627 lines), session management, token handling
- `src/lib/supabase.ts` — Supabase client initialization

### Subscription & Billing
- `src/lib/services/subscriptionService.ts` — Contains SEC-06 fail-open bug
- `src/lib/ai/aiInsightsService.ts` — Contains SEC-09 hardcoded userTier

### Admin
- `src/components/admin/FAQAdmin.tsx` — Existing admin component pattern

### Multi-Modal Placeholders
- `src/lib/multiModalProcessor.ts` — Contains SEC-10 placeholder implementations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `withCSRF` middleware: Fully implemented, just needs to be imported by more endpoints
- `withRateLimit` middleware: Configurable with `withAuthRateLimit()` and `withAIRateLimit()` factories ready to use
- `compose.ts` chains: `protectedEndpoint()` bundles rate limit + CSRF + auth in one call
- `AuthScreen.tsx`: Existing login/signup toggle pattern can be extended with a "reset" mode
- `FAQAdmin.tsx`: Admin component pattern to follow for new admin stats views

### Established Patterns
- Middleware composition: `compose()` function chains middleware in order
- API route pattern: Each `api/*.ts` exports a default handler wrapped in middleware
- Admin verification: `withAdmin` middleware checks user role before proceeding
- Supabase queries: Repository pattern in `src/lib/repositories/` for data access

### Integration Points
- AuthScreen needs new state mode for password reset (currently has login/signup toggle)
- App.tsx hash routing needs to detect Supabase password reset redirect tokens
- Admin stats need a new API endpoint or action on existing `api/admin.ts`
- All API endpoints need middleware chain updates (mostly import changes)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-security-hardening-production-fixes*
*Context gathered: 2026-04-06*
