# Prioritas Platform Audit — Findings
**Audit date:** 2026-04-18
**Auditor:** Eva (autonomous session)
**Scope:** 5 of 14 planned surfaces (RLS, API authorization, secrets, security headers, observability). Remaining 9 surfaces deferred.

## Severity legend
- **P0** — ship-blocker. Fix before any public launch.
- **P1** — pre-launch. Fix before a paying customer touches the platform.
- **P2** — post-launch. Fix in the first 30 days of GA.

## Findings summary

| Severity | Count |
|---|---|
| P0 | 4 |
| P1 | 5 |
| P2 | 4 |

---

## P0 findings

### P0-01 — Brainstorm handlers have no authentication middleware
**Surface:** API routes authorization
**Evidence:** `api/brainstorm/create-session.ts:85`, `api/brainstorm/submit-idea.ts:118`, `api/brainstorm/end-session.ts:50`, `api/brainstorm/validate-token.ts:62` — all four handlers are bare `export default async function handler(...)` with no `compose(withAuth, ...)` wrapping. The service-role client is used directly. In `create-session.ts`, `facilitatorId` is read from the request body without verifying it matches the authenticated caller — any unauthenticated request can create sessions attributed to an arbitrary user ID.
**Risk:** Unauthenticated actors can create brainstorm sessions, submit ideas, and end sessions on behalf of any user ID. Service-role client means these writes bypass RLS entirely.
**Fix direction:** Wrap all four handlers in `compose(withUserRateLimit(), withCSRF(), withAuth)`. Replace body-supplied `facilitatorId` with `req.user.id` from `withAuth`.

---

### P0-02 — `src/lib/services/stripeService.ts` uses `STRIPE_SECRET_KEY` in frontend source tree
**Surface:** Secrets and config
**Evidence:** `src/lib/services/stripeService.ts:5` — `if (!process.env.STRIPE_SECRET_KEY) { throw new Error(...) }`. `src/lib/services/stripeService.ts:9` — `new Stripe(process.env.STRIPE_SECRET_KEY, ...)`. This file lives under `src/`, which Vite bundles for the browser. No frontend component currently imports it (the real implementation is `api/_lib/services/stripeService.ts`), but the file is live, exports `stripeService`, and could be accidentally imported.
**Risk:** A future or accidental import would embed the Stripe secret key in the browser JS bundle — giving any visitor full Stripe API access. Financial blast radius.
**Fix direction:** Delete `src/lib/services/stripeService.ts`. Confirm no `import` path points to it outside of test mocks. The canonical server-side implementation already exists at `api/_lib/services/stripeService.ts`.

---

### P0-03 — No Content-Security-Policy header in production
**Surface:** Security headers
**Evidence:** `vercel.json` (entire file) — headers block contains `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, but **no `Content-Security-Policy`**. The CSP defined in `vite.config.ts:14–27` is injected by the Vite dev-server middleware plugin only; it does not apply to Vercel's static asset serving in production.
**Risk:** No XSS mitigation in production. Reflected or stored XSS has unrestricted script execution across all routes.
**Fix direction:** Add a `Content-Security-Policy` header to the `"source": "/(.*)"` block in `vercel.json`. Start with the existing dev policy, tighten `script-src` to remove `'unsafe-eval'` if production output permits.

---

### P0-04 — `session_activity_log` INSERT policy is `WITH CHECK (true)` — any authenticated user can write
**Surface:** Supabase RLS policies
**Evidence:** `supabase/migrations/20250120000000_create_brainstorm_sessions.sql` — policy `"System can insert activity log"` on `session_activity_log`: `FOR INSERT WITH CHECK (true)`. RLS is enabled on the table, but the insert policy grants unrestricted write to every authenticated role.
**Risk:** Any authenticated user can forge activity log entries for any session they are not a participant of, corrupting audit trails and session analytics.
**Fix direction:** Restrict to service_role: `WITH CHECK (auth.role() = 'service_role')`. All legitimate inserts originate from the API server using the service-role client.

---

## P1 findings

### P1-01 — No `Strict-Transport-Security` (HSTS) header
**Surface:** Security headers
**Evidence:** `vercel.json` — no `Strict-Transport-Security` entry in the headers block.
**Risk:** Without HSTS, browsers will follow HTTP→HTTPS redirects on each visit rather than enforcing HTTPS proactively, enabling SSL-strip downgrade attacks on first connection and unprotected cookie transmission over plain HTTP.
**Fix direction:** Add `"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"` to the `/(.*)`  headers block in `vercel.json`.

---

### P1-02 — CORS allowlist contains a placeholder domain; `api/projects.ts` echoes any origin
**Surface:** API routes authorization
**Evidence:** `api/_lib/middleware/cors.ts:11` — `'https://your-production-domain.com'` is the third entry; the real production domain is never listed. `api/projects.ts:23` — `res.setHeader('Access-Control-Allow-Origin', origin)` echoes whatever `req.headers.origin` supplies with no allowlist validation and `Access-Control-Allow-Credentials: true`.
**Risk:** Cross-origin requests from attacker-controlled origins are accepted with credentials (cookies). This is the browser-side complement to CSRF — CORS misconfiguration with credentialed responses allows cross-site data exfiltration.
**Fix direction:** Replace the placeholder in `cors.ts` with the real domain (use an `ALLOWED_ORIGINS` env var). In `api/projects.ts`, validate `origin` against the same allowlist before echoing it. Return `403` on mismatch.

---

### P1-03 — AI generation handlers do not verify project ownership
**Surface:** API routes authorization
**Evidence:** `api/_lib/ai/generateIdeas.ts:35–65` — validates input, calls `checkLimit(userId, 'ai_ideas')`, then proceeds to generate AI content using the caller-supplied `projectId` without querying `projects.owner_id`. No grep hits for `owner_id`, `validateProjectAccess`, or collaborator check in `generateIdeas.ts`, `generateInsights.ts`, or `generateRoadmap.ts`.
**Risk:** Authenticated user B can supply user A's `projectId` to consume AI quota (charged to B's limit) while receiving A's project context in the AI prompt — data leakage between tenants.
**Fix direction:** Add `validateProjectAccess(supabaseAdmin, projectId, req.user.id)` as the first operation after input validation — identical pattern to `api/ideas.ts:100–135`.

---

### P1-04 — `stripe_webhook_events` has RLS enabled but zero policies
**Surface:** Supabase RLS policies
**Evidence:** `supabase/migrations/20260408160000_billing_schema.sql` — `ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;` with no `CREATE POLICY` statements and the comment `-- No SELECT policy: never user-readable`. In Supabase, RLS enabled + no policies = all PostgREST access denied. The webhook handler works today because it uses the service-role client (which bypasses RLS at the Postgres level), but this is implicit and fragile.
**Risk:** Any future code path using the anon/user client will silently fail to read or write idempotency records, allowing duplicate Stripe event processing (double-charges, double-provisioning).
**Fix direction:** Add explicit `FOR ALL USING (false)` policy to document intent, or add `FOR ALL USING (auth.role() = 'service_role')` to be explicit. Either removes ambiguity and prevents accidental anon-client access.

---

### P1-05 — No error monitoring wired for client or server
**Surface:** Observability
**Evidence:** No `@sentry/react`, `@sentry/node`, `bugsnag`, `datadog`, `raygun`, or `rollbar` package referenced anywhere in `src/` or `api/`. All exceptions are logged to `console.error` only.
**Risk:** You cannot answer "why did user X's request fail at 3am." Auth failures, AI timeouts, Stripe webhook errors, and RLS surprises all emit to Vercel function logs with no retention, no alerting, and no user-ID correlation.
**Fix direction:** Add `@sentry/react` to `src/main.tsx` and `@sentry/node` to API route entry points. Attach `user.id` as Sentry user context in `withAuth`. Configure a Slack/email alert for new error classes at launch.

---

## P2 findings

### P2-01 — Cookie `Secure` flag absent in non-production environments (affects Vercel preview deploys)
**Surface:** Security headers / cookie flags
**Evidence:** `api/_lib/middleware/cookies.ts:34` — `secure: process.env.NODE_ENV === 'production'`. Vercel preview deployments use HTTPS URLs but `NODE_ENV` may not be set to `production` by default, meaning auth cookies on preview URLs lack the `Secure` flag.
**Fix direction:** Use `secure: process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'` to cover Vercel preview environments.

---

### P2-02 — `Referrer-Policy` header absent
**Surface:** Security headers
**Evidence:** `vercel.json` — no `Referrer-Policy` header. The QR code service call in `api/brainstorm/create-session.ts:176` constructs a URL containing the session `accessToken`: `https://api.qrserver.com/v1/create-qr-code/?...data=${joinUrl}`. If `Referer` headers leak to third-party services, session join tokens could be exposed.
**Fix direction:** Add `"Referrer-Policy": "strict-origin-when-cross-origin"` to `vercel.json`.

---

### P2-03 — Five live `.env*` files with credentials in the working directory
**Surface:** Secrets and config
**Evidence:** `ls` output — `.env`, `.env.local`, `.env.production.local`, `.env.vercel`, `.env.vercel.production` all present. `.gitignore` correctly excludes them. `AUTH_FIX_PRODUCTION_ENV.md`, `VERCEL_ENV_GUIDE.md`, `VERCEL_ENV_SETUP.md` in the project root may contain plaintext credential values.
**Risk:** Developer machine compromise, cloud sync (iCloud/Dropbox), or accidental `git add -f` exposes production secrets.
**Fix direction:** Migrate all credentials to Vercel Environment Variables dashboard and 1Password. Delete `.env.vercel`, `.env.vercel.production` from disk. Audit the three `.md` files for embedded secrets and redact.

---

### P2-04 — Structured logging and request-ID correlation absent from API routes
**Surface:** Observability
**Evidence:** `api/auth.ts:70–77` — `newRequestId()` is defined and generates a UUID per request but the ID is never attached to log lines or response headers. All API routes emit `console.log`/`console.error` with ad-hoc strings and no consistent `{request_id, user_id, action, duration_ms, status}` schema.
**Fix direction:** Thread `requestId` through `AuthenticatedRequest`. Emit one structured JSON line at handler entry and exit with the core fields. Vercel captures stdout; JSON logs are filterable in the Vercel dashboard without any additional tooling.

---

## Surface coverage

### 1. Supabase RLS policies

| Table | RLS enabled | Coverage verdict |
|---|---|---|
| `users` | Yes | Adequate — SELECT/UPDATE own or admin |
| `user_profiles` | Yes | Adequate — SELECT/UPDATE own or admin |
| `teams` | Yes | Adequate — owner-scoped |
| `projects` | Yes | Adequate — SELECT/INSERT/UPDATE/DELETE owner or admin |
| `ideas` | Yes | Adequate — SELECT includes collaborators (20260412); write is owner/admin only |
| `project_files` | Yes | Adequate — SELECT/UPDATE added in 20260408 |
| `project_roadmaps` | Yes | Adequate |
| `project_insights` | Yes | Adequate |
| `brainstorm_sessions` | Yes | Active sessions readable without auth (by design for QR join) |
| `session_participants` | Yes | `is_anonymous = true` rows SELECT/UPDATE without uid match — by design, warrants periodic review |
| `session_activity_log` | Yes | **P0-04** — INSERT `WITH CHECK (true)` |
| `idea_votes` | Yes | Adequate — budget-enforced INSERT, session-participant SELECT |
| `project_collaborators` | Yes | Adequate — owner CRUD, self SELECT |
| `project_invitations` | Yes | Adequate — accept via SECURITY DEFINER function only |
| `subscriptions` | Yes | Adequate — SELECT only for users; writes via service role |
| `usage_tracking` | Yes | Adequate |
| `user_notifications` | Yes | Adequate |
| `stripe_webhook_events` | Yes | **P1-04** — no policies, implicit service-role-only access |
| `ai_token_usage` | Yes | INSERT `WITH CHECK (true)` — same concern as session_activity_log, lower sensitivity |
| `user_component_states` | **Not in migrations** | Table referenced in `api/user.ts` but no migration exists. If present, it was created outside version control. |

---

### 2. API routes authorization

| Route | Auth middleware | Ownership check | Rate limited |
|---|---|---|---|
| `api/auth.ts` | N/A (is auth) | N/A | `withStrictRateLimit` |
| `api/ai.ts` | `withAuth` | ❌ No project ownership check — **P1-03** | 20 req/hr |
| `api/ideas.ts` | `withAuth` | ✅ `validateProjectAccess()` | `withUserRateLimit` |
| `api/projects.ts` | `withQuotaCheck` | ✅ GET filters by `owner_id`; POST sets `owner_id` from auth | Quota-implicit |
| `api/user.ts` | `withAuth` | ✅ filters by `userId` | `withUserRateLimit` |
| `api/admin.ts` | `withAdmin` + `withRateLimit` | ✅ admin-role gated | Yes |
| `api/admin/projects.ts` | `withQuotaCheck` | ✅ `project.owner_id !== userId` check | Quota-implicit |
| `api/stripe.ts` | `withAuth` + `withRateLimit` | ✅ `userId` from token | Yes |
| `api/stripe/webhook.ts` | Stripe signature | N/A | `withRateLimit` |
| `api/email-link.ts` | `withAuth` | ✅ sends to `req.user.email` | `withUserRateLimit` |
| `api/invitations/create.ts` | `withQuotaCheck` | ✅ owner check | Quota-implicit |
| `api/invitations/accept.ts` | Token-based only | Token lookup via SECURITY DEFINER | None |
| `api/brainstorm/create-session.ts` | ❌ **None** — **P0-01** | ❌ `facilitatorId` from body | In-memory only |
| `api/brainstorm/submit-idea.ts` | ❌ **None** — **P0-01** | Session token DB lookup | In-memory per-participant |
| `api/brainstorm/end-session.ts` | ❌ **None** — **P0-01** | Unknown | None |
| `api/brainstorm/validate-token.ts` | ❌ **None** — **P0-01** | Session token DB lookup | None |
| `api/health.ts` | None (intentional) | N/A | None |

---

### 3. Secrets and config

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exposed to browser — correct and expected.
- No `SUPABASE_SERVICE_ROLE_KEY` in `src/` code paths (only comments and test mocks).
- `STRIPE_SECRET_KEY` referenced at `src/lib/services/stripeService.ts:9` — dead code but live risk (**P0-02**).
- No hardcoded API key literals found in `src/` or `api/`.
- `.env.example` present and committed — good.
- Five live env files in working directory (**P2-03**).
- `NEXT_PUBLIC_*` pattern not used; project correctly uses `VITE_*` for public vars.

---

### 4. Security headers

| Header | Production (vercel.json) | Notes |
|---|---|---|
| `Content-Security-Policy` | ❌ Missing — **P0-03** | Dev-server only |
| `X-Content-Type-Options` | ✅ `nosniff` | |
| `X-Frame-Options` | ✅ `DENY` | |
| `X-XSS-Protection` | ✅ `1; mode=block` | Legacy; CSP is the real fix |
| `Strict-Transport-Security` | ❌ Missing — **P1-01** | |
| `Referrer-Policy` | ❌ Missing — **P2-02** | |
| Cookie `HttpOnly` | ✅ Access + Refresh tokens | |
| Cookie `Secure` | ✅ Production only | ❌ Preview deploys unprotected — **P2-01** |
| Cookie `SameSite` | ✅ `Lax`/`Strict` per token | |
| CORS allowlist | ⚠️ Placeholder domain — **P1-02** | `api/projects.ts` echoes any origin |

---

### 5. Observability

| Capability | Status |
|---|---|
| Client-side error monitoring | ❌ Not present — **P1-05** |
| Server-side error monitoring | ❌ Not present — **P1-05** |
| Structured logging with request_id | ❌ Ad-hoc `console.log` only — **P2-04** |
| Auth event audit log | ✅ `api/_lib/auditLogger.ts` — LOGIN, LOGOUT, SIGNUP, PASSWORD_RESET with email hash, masked IP, UA family |
| Stripe event idempotency log | ✅ `stripe_webhook_events` table |
| AI token usage tracking | ✅ `ai_token_usage` + `increment_ai_usage()` |
| Health endpoint | ✅ `api/health.ts` — Supabase reachability, no sensitive data |

---

## Deferred surfaces

Nine surfaces not audited in this pass:

1. **Schema integrity** — FK constraints, nullable columns, missing indexes on hot paths
2. **Frontend resilience** — error boundaries, loading states, graceful API degradation
3. **Performance** — bundle size, Core Web Vitals, Supabase query plans
4. **Email deliverability** — SPF/DKIM/DMARC, bounce handling, Resend domain setup
5. **Billing** — Stripe webhook reliability, subscription state-machine edge cases, trial expiry
6. **Legal / compliance** — Privacy policy, cookie consent banner, GDPR data deletion
7. **CI/CD** — Coverage gates, preview deploy process, rollback procedure, secret rotation
8. **Ops / runbook** — Incident response, Supabase backup schedule, RLS audit tooling
9. **Account lifecycle** — Account deletion (right to erasure), email change security, OAuth flows
