# Auth Hardening + Login Flakiness Fix — Product Spec

**Pipeline:** auth-hardening-d92383e0 (Large, full ceremony)
**Author:** Robert (robert-spec)
**Status:** Proposed — handoff to Cal next
**Target:** pre-launch (2-4 weeks), prioritas.ai SPA

---

## 1. Problem

Two user-observed failure modes on the live login form, intermittent across sessions and browsers, both surviving recent CSRF-family fixes (`35c5c80`, `cb60b27`, `4484b14`):

- **Hang on submit.** Click Sign In, spinner runs indefinitely, no redirect, no error. User must refresh.
- **Dead click on Sign In.** Click Sign In, nothing happens — no network request, no spinner, no console error. Classic swallowed exception OR event-listener-never-attached.

Overlaying these: prioritas.ai launches as paid SaaS in 2-4 weeks. The auth surface must meet baseline SaaS-hardening posture before public access — rate limits enforced, reset/confirmation flows closed, mobile-cookie behavior verified, errors surfaced (not swallowed), and session restoration bounded under all conditions.

This spec is behavior-only. No implementation. Cal writes the ADR; Roz derives failing tests from the ACs below; Colby builds in waves.

---

## 2. DoR — Definition of Ready

| # | Input | Source | Status |
|---|-------|--------|--------|
| R1 | Two named symptoms (hang, dead click) | Context brief §Scope | Ready |
| R2 | Recent auth commits already landed (CSRF cookie 24h, bootstrap outcome type, terminal logout, AI timeouts, mock-fallback elimination) | ADR-0014, ADR-0016, commits `35c5c80` / `cb60b27` / `4484b14` | Ready |
| R3 | Login surface maps: `AuthScreen.tsx` + `useAuth.ts` + `useAuth.bootstrap.ts` + `useAuth.terminalLogout.ts` + `api/auth.ts` | Worktree read | Ready |
| R4 | Two login paths exist today behind `VITE_FEATURE_HTTPONLY_AUTH` (direct supabase-js vs POST /api/auth?action=session) | `AuthScreen.tsx:209-228` | Ready — flagged as Open Question #1 |
| R5 | Client/server password-minimum mismatch (client 6, server 8) | `AuthScreen.tsx:487`, `api/auth.ts:61` | Ready — flagged as Open Question #2 |
| R6 | Rate limiter is in-memory Map, resets on Vercel cold start | `api/_lib/middleware/withRateLimit.ts` | Ready — flagged as Open Question #3 |
| R7 | Mobile brainstorming is a key use case — third-party-cookie restrictions apply | CLAUDE.md, context brief | Ready |
| R8 | Retro lessons L001 (sensitive data), L002 (Colby mustn't modify Roz assertions), L005 (frontend wiring) | `retro-lessons.md` | Applied in §5–§7 |

**Missing / inferred:**
- No production telemetry on login success vs failure rate, so F1/F2 frequency is anecdotal. Spec treats them as must-fix regardless.
- No formal mobile browser matrix in-repo. Spec uses "mobile Safari 16+, mobile Chrome 114+" as the target set; Cal may tighten.

**Retro risks noted:**
- L001 — audit log schema must exclude raw email, tokens, password hashes. See AC-PRIV-01.
- L002 — ACs below are written as observable conditions, not as "Colby must do X." Roz asserts the behavior; Colby meets it.
- L005 — "dead click" AC explicitly traces the full chain (handler attached → network → UI state).

---

## 3. Scope

### In
- Login submit path end-to-end (both `VITE_FEATURE_HTTPONLY_AUTH` branches — Cal picks one to ship).
- Session restoration on browser refresh (bounded load time; no infinite loader).
- Password reset **request** + **recovery** (set-new-password) flows.
- Email confirmation link flow (valid / consumed / expired).
- Logout (local + server cache-clear).
- CSRF posture — residual gaps after ADR-0016 (see §5.1 for list).
- Mobile-cookie behavior: third-party-cookie restrictions on Safari/iOS and mobile Chrome.
- Structured error surfaces — every catch either rethrows, renders, or is documented.
- Rate limiting coverage audit on pre-auth endpoints (signup, login, refresh, reset).
- Auth-events audit log (minimal schema, no PII beyond IP + UA).
- Generic error copy on pre-auth endpoints (no account enumeration).
- `GET /api/health` endpoint for uptime probes.

### Out (explicit non-goals)
- SSO, SAML, OIDC.
- OAuth providers (Google, GitHub, Apple).
- Magic-link passwordless login.
- MFA / TOTP / SMS OTP / email OTP.
- Passkeys / WebAuthn.
- Password strength meter beyond length enforcement.
- Device fingerprinting, risk-based auth, CAPTCHA.
- Account deletion / GDPR export endpoints.
- Session listing / remote logout UI.
- Email change flow.
- Audit-log UI / admin console views of the audit table.

---

## 4. Stack Reality Check

For Cal's benefit: the user's intent is "make login bulletproof + SaaS-hardened." Any Next.js-flavored verbiage that leaks into upstream conversation translates to:

- **Not** Next.js App Router. **Vite SPA + React 18** — no middleware.ts, no server components, no route handlers.
- **Not** `@supabase/ssr` or `@supabase/auth-helpers-nextjs`. Client is `@supabase/supabase-js 2.57.2`.
- Backend is **Vercel serverless functions** under `api/`. "Middleware" maps to the custom CSRF/rate-limit composers in `api/_lib/middleware/`.
- Two auth code paths exist today; **Open Question #1** asks Cal to pick one.

---

## 5. User-Facing Requirements

Format: `WHEN <situation> THEN <observable user-facing outcome>`. Each AC is observable end-to-end. No AC references implementation (`useAuth.ts`, `AbortController`, class names) — only what a user, Roz, or a browser DevTools observer can see.

---

### P0 — Launch blockers (flakiness fix + minimum SaaS posture)

**These must ship or prioritas.ai does not go public.**

#### Login submit integrity

- **AC-LOGIN-01** WHEN a user submits the login form with any valid-shape input THEN within 15 seconds the UI produces exactly one of: (a) navigation away from the login screen into an authenticated destination, OR (b) a visible error message in the error banner. Never both, never neither. *(covers F1 "hang")*

- **AC-LOGIN-02** WHEN the login network request has not resolved within 15 seconds THEN the submit button returns to its idle (non-loading) state, the error banner shows a user-readable timeout message, and no session is established. *(covers F1 "hang")*

- **AC-LOGIN-03** WHEN a user clicks the Sign In button with a valid-shape form THEN within 200ms at least one of the following is observable in the browser: the button visually enters a loading state, OR a network request to the login endpoint is in flight, OR the error banner shows a validation error. A click that produces none of these within 200ms is a launch-blocker defect. *(covers F2 "dead click")*

- **AC-LOGIN-04** WHEN a user clicks Sign In repeatedly during an in-flight login request THEN only one login network request is issued for the whole click sequence. *(covers F10 double-submit)*

- **AC-LOGIN-05** WHEN any exception is thrown inside the login submit handler THEN the user sees either a specific error banner message OR the generic "Unable to sign in right now — please try again" message. No code path may complete the submit handler with the UI idle and no banner shown. *(covers F3 swallowed exception)*

- **AC-LOGIN-06** WHEN a user enters wrong credentials THEN within 5 seconds they see "Incorrect email or password" (or equivalent approved copy) in the error banner, the submit button returns to idle, and no session is established.

- **AC-LOGIN-07** WHEN a user enters an email for a non-existent account THEN the error copy they see is identical to AC-LOGIN-06. (No user enumeration via copy differences.)

- **AC-LOGIN-08** WHEN a user enters credentials for an unconfirmed account THEN they see "Please confirm your email address before signing in" (approved exception to the enumeration rule — legitimate-user hint) and no session is established.

- **AC-LOGIN-09** WHEN a user completes a successful login THEN the post-login destination renders with the correct role (admin vs user) on its first render — no role-flash or "Access Denied" flash between render 1 and render 2.

#### Session restoration (refresh while signed in)

- **AC-SESSION-01** WHEN a signed-in user hard-refreshes the tab with a valid session still accepted by the backend THEN within 5 seconds they land on the authenticated destination with no login screen in between. *(covers F7 hang-on-refresh)*

- **AC-SESSION-02** WHEN a user loads the app with no session THEN within 5 seconds they land on the login screen.

- **AC-SESSION-03** WHEN a user loads the app with a zombie session (localStorage claims authenticated; backend rejects every call) THEN within 10 seconds they land on the login screen with a visible "Your session expired, please sign in again" message. No infinite loader. *(covers F9)*

- **AC-SESSION-04** WHEN the app is loading under any known session state THEN the loading screen resolves in bounded time (≤15s wall-clock). "The only recovery is to close the tab" must never describe the app after this pipeline ships.

#### Logout integrity

- **AC-LOGOUT-01** WHEN a signed-in user clicks Log Out THEN within 5 seconds the app lands on the signed-out state, with auth-related localStorage keys cleared and auth cookies cleared.

- **AC-LOGOUT-02** WHEN a signed-in user clicks Log Out and the server-side cache-clear call fails or times out THEN the client-side logout still completes within 5 seconds and the user lands on the signed-out state (server failure is logged but not user-visible).

- **AC-LOGOUT-03** WHEN a user who has logged out refreshes the page THEN the signed-out state persists — the session does not silently restore.

#### Mobile cookie behavior

- **AC-MOBILE-01** WHEN a user completes login on mobile Safari 16+ or mobile Chrome 114+, with third-party cookies blocked at browser-default settings THEN the session establishes successfully and post-login CSRF-protected requests succeed. (Because the SPA and the `/api/*` functions share the same origin in production, SameSite=Lax is sufficient — this AC verifies that assumption holds in the field.)

- **AC-MOBILE-02** WHEN a user logs in on mobile via a deep-link flow (e.g., email confirmation, invitation, password reset link clicked from a mobile mail client) THEN the session establishes and the user lands on the correct post-auth destination. Specifically: confirmation → signed-in home; invitation → project page; reset link → reset-password form.

#### Structured error surfaces (no silent swallows)

- **AC-ERR-01** WHEN any error is thrown on any auth path (login, signup, logout, reset request, recovery, session restore) THEN exactly one of the following must occur: the error is rethrown to a component error boundary, OR a user-visible error message is rendered, OR the catch block has an inline comment explaining why swallowing is correct. No auth-path catch block may silently drop an error without one of these three.

- **AC-ERR-02** WHEN any 5xx server response is received by the client on an auth path THEN the user sees a "something went wrong — please try again" class message and the submit control returns to idle. The raw server error body is never rendered verbatim. *(covers F15)*

- **AC-ERR-03** WHEN any pre-auth endpoint (login, signup, refresh, reset request) returns a rate-limit (429) response THEN the client surfaces "Too many attempts — please try again in N minutes" (exact copy TBD by product; Cal picks a source file). Raw GoTrue / backend messages never reach the user.

#### Minimum rate limiting (launch posture)

- **AC-RL-01** WHEN 6 failed login attempts are made from the same client IP within 15 minutes in production config THEN the 6th and subsequent attempts receive HTTP 429 with a `Retry-After` header within the response window. (Current `withStrictRateLimit` is 5/15min — this AC freezes that.)

- **AC-RL-02** WHEN the signup endpoint, refresh endpoint, or password-reset-request endpoint receives requests at above-threshold rates from the same IP THEN the same 429 response contract is upheld. All four pre-auth endpoints must share rate-limiting coverage at launch.

- **AC-RL-03** WHEN a rate limit is reached THEN the server's 429 response includes a structured `error.code` (e.g., `RATE_LIMIT_EXCEEDED`) that the client can map to approved copy without parsing human-readable strings.

#### CSRF posture — close remaining gaps

- **AC-CSRF-01** WHEN a user has been signed in for 23 hours continuously THEN their next CSRF-protected request succeeds (cookie maxAge is the 24h value from `35c5c80`; this AC freezes that).

- **AC-CSRF-02** WHEN a CSRF-protected request returns 403 `CSRF_COOKIE_MISSING` mid-session THEN the client performs at most one re-mint + retry (ADR-0016 behavior freeze — Roz asserts single retry, not "retry works").

- **AC-CSRF-03** WHEN the terminal-logout path fires (zombie session detected) THEN the user sees the expiration message, localStorage auth keys are cleared, and the user lands on the login screen within ~2 seconds of detection. (Freezes ADR-0016 Step 3 behavior — this spec requires it remain intact.)

#### Health check

- **AC-HEALTH-01** WHEN `GET /api/health` is called by an anonymous client THEN within 3 seconds the response is HTTP 200 with a body containing `status`, `timestamp`, and a Supabase liveness indicator. No user IDs, no tokens, no env var values ever appear in the body.

---

### P1 — SaaS launch hardening

**These ship before public launch, but can land later in the pipeline.**

#### Password reset & recovery

- **AC-RESET-01** WHEN a user submits the forgot-password form for any email (existing or not) THEN they see "If an account exists for <email>, a reset link has been sent" — copy is identical for both cases. (No enumeration.)

- **AC-RESET-02** WHEN 3 forgot-password submissions occur for the same email within 60 seconds THEN at most 1 reset email is sent by the backend. The UI still confirms each submission with AC-RESET-01 copy.

- **AC-RESET-03** WHEN a user opens a valid reset link THEN the reset-password form renders with the email field hidden and both password fields empty.

- **AC-RESET-04** WHEN a user submits matching, sufficient-length new passwords with a valid recovery token THEN within 15 seconds the UI renders "Password updated successfully — please sign in" and the token is marked consumed server-side.

- **AC-RESET-05** WHEN a user attempts to submit the reset form a second time with an already-consumed token THEN they see "This reset link has already been used — please request a new one." Never succeeds on replay. *(covers F14)*

- **AC-RESET-06** WHEN a user successfully changes their password via the reset flow THEN within the next refresh cycle (≤2 cycles), any other active session for that user on other devices receives 401 and enters the terminal-logout flow. *(covers F11 — session revocation)*

#### Email confirmation

- **AC-CONFIRM-01** WHEN a user clicks a valid email confirmation link THEN they land on prioritas.ai either signed-in (if the signup session cookie is still present) OR on the login screen with a "Email confirmed — please sign in" message.

- **AC-CONFIRM-02** WHEN a user clicks a confirmation link that is expired, already consumed, or tampered with THEN they see a generic "This link is invalid or expired — request a new confirmation email" screen with a way to trigger resend. The server does not return 5xx for these cases.

#### Signup integrity

- **AC-SIGNUP-01** WHEN a user submits the signup form with a valid-shape input THEN within 15 seconds they see either (a) "Please check your email for a confirmation link" and transition to login mode, OR (b) a visible error message.

- **AC-SIGNUP-02** WHEN a signup submission uses an email that already has an account THEN the UI message is identical to AC-SIGNUP-01(a). (No enumeration via signup.)

- **AC-SIGNUP-03** WHEN a user submits a password shorter than the server-enforced minimum THEN they see "Password must be at least N characters" where N is the value from a single shared constant. Client-side and server-side minima must agree. *(Open Question #2)*

#### Invitation acceptance

- **AC-INVITE-01** WHEN a signed-out user clicks an invite URL THEN they see the invite preview, complete signup or login inline, and land on the project page within 30 seconds total wall-clock.

- **AC-INVITE-02** WHEN a user signed in as the invitee's email clicks an invite URL THEN they auto-accept and land on the project page within 10 seconds, no credential prompt.

- **AC-INVITE-03** WHEN a user signed in as a *different* email clicks an invite URL THEN they see "This invitation was sent to someone else" and the invite is NOT silently accepted under the wrong identity.

- **AC-INVITE-04** WHEN a user clicks an expired or already-consumed invite THEN they see a generic "invalid or expired" screen. The server does not return 5xx.

#### Audit log

- **AC-AUDIT-01** WHEN any of the following events occur — login success, login failure, signup submission, password reset request, password change, logout, terminal-logout trigger, rate-limit hit — THEN exactly one row is written to the auth events audit table.

- **AC-AUDIT-02** Each audit row contains `request_id`, `event_type`, `outcome`, `ip`, `user_agent`, `timestamp`, and `email_hash` (SHA-256 of lowercase trimmed email — NEVER raw email). It MUST NOT contain: raw email, password, any token, password hash, reset token, CSRF token. *(L001)*

- **AC-AUDIT-03** WHEN the audit write itself fails THEN the user's auth action is not blocked or delayed by the audit failure (fire-and-forget from the user's perspective).

- **AC-AUDIT-04** Read access to the auth audit table is restricted to `super_admin` role via RLS. No user-facing UI reads from it at launch.

#### Privacy & PII in logs

- **AC-PRIV-01** WHEN any server-side log entry is emitted on an auth path THEN the log fields do not contain raw email, password, access token, refresh token, CSRF token, recovery token, or any GoTrue response body that may embed tokens. `email_hash` and `user_id` are permitted.

- **AC-PRIV-02** WHEN a 5xx server response is returned to the client THEN the response body contains only `{error: {message, code}, timestamp, request_id}` — no stack traces, no SQL fragments, no internal file paths. Stack traces go to server logs only.

---

### P2 — Nice-to-have (defer if scope risk)

**Ship if time allows. OK to punt to the next pipeline if Cal sees scope risk.**

- **AC-P2-01** WHEN the server responds to "wrong password" vs "no such email" THEN the median response times are within 50ms of each other. (Timing-enumeration protection — defer if rate-limit-only is deemed sufficient.)

- **AC-P2-02** WHEN the user triggers any auth error from the client THEN the error response from the server includes a `request_id` header that is also surfaced in UI developer-tools-friendly form (e.g., logged to `console.debug`) for support cross-referencing.

- **AC-P2-03** WHEN the CSP header audit runs on launch day THEN the current `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection` minima remain intact. (Freeze-only — no new CSP work this pipeline unless Cal flags cheap wins.)

- **AC-P2-04** WHEN the rate limiter experiences a Vercel function cold start THEN monitoring data is captured to later inform whether cold-start reset is a real abuse vector. (Not a fix — an observability hook. Defer if Cal judges Open Question #3 belongs in a follow-up.)

---

## 6. Symptom → AC Traceability

Cross-reference for the two named symptoms plus the SaaS-hardening requirements, so Roz can build her test matrix directly.

| Symptom / Requirement | Primary ACs | Supporting ACs |
|---|---|---|
| **F1 — Hang on submit** | AC-LOGIN-01, AC-LOGIN-02 | AC-SESSION-04, AC-ERR-02 |
| **F2 — Dead click on Sign In** | AC-LOGIN-03 | AC-LOGIN-05, AC-ERR-01 |
| **F3 — Silent swallowed exception** | AC-ERR-01 | AC-LOGIN-05 |
| **F7 — Session hangs on refresh-from-logged-in** | AC-SESSION-01, AC-SESSION-04 | AC-SESSION-03 |
| **F9 — Zombie session with signed-in-looking UI** | AC-SESSION-03, AC-CSRF-03 | AC-SESSION-04 |
| **F10 — Double-submit** | AC-LOGIN-04 | — |
| **F11 — Password change doesn't revoke other sessions** | AC-RESET-06 | — |
| **F14 — Reset link replay** | AC-RESET-05 | — |
| **F15 — PII / stack trace in server error bodies** | AC-PRIV-02 | AC-ERR-02 |
| **CSRF regression posture** | AC-CSRF-01, AC-CSRF-02, AC-CSRF-03 | — |
| **Rate limiting coverage** | AC-RL-01, AC-RL-02, AC-RL-03 | AC-ERR-03 |
| **Account enumeration resistance** | AC-LOGIN-07, AC-RESET-01, AC-SIGNUP-02 | AC-LOGIN-08 (approved exception) |
| **Mobile (Safari/Chrome third-party cookies)** | AC-MOBILE-01, AC-MOBILE-02 | — |
| **Email confirmation integrity** | AC-CONFIRM-01, AC-CONFIRM-02 | — |
| **Password reset integrity** | AC-RESET-01 through AC-RESET-06 | — |
| **Audit log (L001 compliant)** | AC-AUDIT-01, AC-AUDIT-02, AC-AUDIT-04 | AC-PRIV-01 |
| **Health endpoint** | AC-HEALTH-01 | — |
| **Structured error surfaces** | AC-ERR-01, AC-ERR-02, AC-ERR-03 | AC-LOGIN-05 |

---

## 7. Open Questions for Cal

Short list. Each has a product default; Cal decides. Not blocking — Cal can resolve in the ADR.

1. **Login code path consolidation.** Two paths exist behind `VITE_FEATURE_HTTPONLY_AUTH`: direct `supabase.auth.signInWithPassword` and `POST /api/auth?action=session`. **Product default: ship one path at launch.** Alternative: keep both and harden each. Cal picks; fewer branches = fewer flakiness surfaces.

2. **Password minimum length reconciliation.** Client enforces 6 (`AuthScreen.tsx:487`), server enforces 8 (`api/auth.ts:61`). **Product default: 8 everywhere, with a single shared constant file.** Alternative: 6 everywhere. Cal picks.

3. **Rate limiter persistence.** In-memory `Map` resets on Vercel cold start. **Product default: accept the cold-start reset for launch, add the monitoring hook (AC-P2-04), revisit post-launch.** Alternative: push to a persistent store (Supabase table, Upstash, Vercel KV) now. Cal picks; if persistent, which store.

4. **Email-confirmation blocking behavior.** Should an unconfirmed user be hard-blocked at login (current behavior, AC-LOGIN-08) or allowed in with a banner nudging confirmation? **Product default: hard block — security posture first.** Alternative: banner nudge with limited-mode access. Cal picks.

5. **`supabase.auth.getSession()` deadlock root cause.** Currently bounded by timeout-and-fallback. **Product default: timeout-and-fallback is sufficient for launch if AC-SESSION-01 through AC-SESSION-04 pass under load.** Alternative: root-cause the multiple-GoTrueClient contention now. Cal picks; if root-cause now, flags scope escalation.

6. **Audit table retention policy.** **Product default: 90 days at launch.** Alternative: 30 days or 365 days. Cal picks.

7. **Feature-flag `VITE_FEATURE_HTTPONLY_AUTH` fate.** Depends on Question 1 resolution. If httpOnly wins: flag removed. If legacy wins: flag removed. If both retained: flag documented as permanent. **Product default: flag removed at launch.**

---

## 8. DoD — Definition of Done (spec handoff to Cal)

Spec is done when:

1. Every P0 AC has a clear, observable pass/fail condition a Roz test can assert against.
2. Both named symptoms (hang, dead click) have at least one AC each that states the user-facing fix condition. (F1 → AC-LOGIN-01, AC-LOGIN-02; F2 → AC-LOGIN-03.) ✓
3. The symptom→AC traceability table in §6 covers every failure mode the pipeline is chartered to close. ✓
4. Open Questions (§7) are short, each with a product default + at least one alternative, none block Cal from starting. ✓
5. Scope §3 IN/OUT lists are mirrored to the user's constraint list (SSO/SAML/MFA out, reset/confirmation/mobile in). ✓
6. Retro lessons L001 (§7 audit log PII exclusion), L002 (observable ACs, not implementation), L005 (AC-LOGIN-03 traces handler→network→UI) are applied. ✓
7. Stack reality check (§4) is stated explicitly so Cal's ADR does not translate from Next.js patterns by accident.

**This spec is not a launch gate on its own.** It hands off to Cal's ADR, which becomes Roz's test source of truth, which becomes Colby's build target. Robert-subagent (reviewer mode) will verify implementation against these ACs at the review juncture — the ACs above are the verification contract.

---

## Provenance

- Worktree: `/Users/sean.mcinerney/claude projects/workshop/design-matrix-app-d92383e0`
- Source files read: `src/components/auth/AuthScreen.tsx` (login/signup/reset UI, two auth paths behind feature flag); `src/hooks/useAuth.ts`, `src/hooks/useAuth.bootstrap.ts`, `src/hooks/useAuth.terminalLogout.ts` (auth hook, CSRF bootstrap outcome type, terminal logout IIFE); `api/auth.ts` (login/signup/refresh handlers, password min 8 at line 61); `api/_lib/middleware/cookies.ts` (CSRF cookie 24h maxAge, access token 1h, refresh token 7d).
- ADRs read: ADR-0014 (AI service auth hardening — `credentials: 'include'` + 401 retry); ADR-0016 (CSRF regression fix — cookie 24h, bootstrap outcome `'ok'|'retryable'|'terminal'`, in-session 403 re-mint, zombie-session terminal logout).
- Recent commits informing prior-art: `35c5c80`, `cb60b27`, `4484b14`, `6fd676d`, `65444ef`.
- Retro lessons applied: L001 (sensitive data in return shapes → AC-AUDIT-02, AC-PRIV-01), L002 (Colby doesn't modify Roz assertions → ACs are observable, not implementation-prescriptive), L005 (frontend wiring omission → AC-LOGIN-03 traces the full click-to-UI chain).
