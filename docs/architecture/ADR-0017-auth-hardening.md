# ADR-0017: Auth Hardening and Login Flakiness Fix

## Status

Proposed

## Relationship to Prior ADRs

Extends ADR-0014 (AI Service CSRF Hardening) and ADR-0016 (CSRF Regression +
Zombie Session + Mock Fallback). Does not supersede them.

- ADR-0014: `credentials: 'include'` + 401 retry/refresh on AI endpoints. Kept.
- ADR-0016: 24h CSRF cookie, in-session 403 re-mint with per-request guard,
  typed `BootstrapCsrfOutcome = 'ok' | 'retryable' | 'terminal'`, terminal
  logout IIFE at `useAuth.ts:528-579`, bundle verifier `scripts/verify-bundle-no-mocks.mjs`.
  Kept. Reused as patterns.

This ADR targets the SPA's **login submit path** and the broader **pre-launch
SaaS auth posture** Robert's spec (`docs/specs/auth-hardening.md`, 48 ACs)
identified. It is the last ADR before public launch.

## DoR -- Definition of Ready

### Inputs

| # | Input | Source | Status |
|---|---|---|---|
| R1 | Two named symptoms: hang on submit (F1), dead click (F2) | Spec §1 | Ready |
| R2 | 48 ACs (25 P0, 19 P1, 4 P2) | Spec §5 | Ready |
| R3 | ADR-0014 + ADR-0016 shipped | Commits `35c5c80` `cb60b27` `4484b14` | Ready |
| R4 | 6 `createClient` instantiation sites (scout-revised) | `supabase.ts:176,533`; `authClient.ts:46`; `api/auth.ts:71,161,225,275`; `connectionPool.ts:63` | Ready |
| R5 | 3 parallel auth hook implementations | `useAuth.ts`, `useSecureAuth.ts`, `useOptimizedAuth.ts` | Ready |
| R6 | `signInWithPassword` has zero direct client callsites -- login runs through `fetch('/api/auth?action=session')` under the httpOnly branch, or via `supabase.auth.signInWithPassword` directly under the legacy branch | Scout-confirmed; `AuthScreen.tsx:209-228` | Ready |
| R7 | `TIMEOUTS` has no `LOGIN_SUBMIT` / `SIGNUP_SUBMIT` / `PASSWORD_RESET_SUBMIT` | `src/lib/config.ts:12-21` | Ready |
| R8 | Silent swallow sites: `AuthScreen.tsx:14-21` (context-missing catch returns null), `useAuth.ts:276-278` (profile-fetch warn-only), `useAuth.ts:349-367` (logout fallback) | Scout-confirmed | Ready |
| R9 | Rate limit middleware exists (`withStrictRateLimit`, 5/15min prod, skipSuccessfulRequests:true). Applied to login endpoint only; signup/refresh/reset unprotected | `withRateLimit.ts:187-193`, `api/auth.ts:984` | Ready |
| R10 | `admin_audit_log` table exists via migration `001_httponly_cookie_auth.sql`; populated only for ADMIN_ACCESS_DENIED / ADMIN_VERIFIED events. Auth events (login/logout/signup/reset) not persisted | Scout-confirmed | Ready |
| R11 | Resend transactional email configured (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) | Env manifest | Ready |
| R12 | `VITE_FEATURE_HTTPONLY_AUTH` flag branches at `AuthScreen.tsx:33` (declaration), `AuthScreen.tsx:209-228` (branch), `AuthMigration.tsx` | Ready |
| R13 | ADR-0016 T-0016-002 left red on missing `crypto.getRandomValues` in `src/test/setup.ts` | Scout-confirmed; absorb into Wave A | Ready |
| R14 | ADR-0016 not yet committed in worktree (schedule with Ellis) | `pipeline-state.md` note | Ready |

### Retro risks

- **L001 (sensitive data in return shapes).** Auth events land in
  `admin_audit_log`. Enforced: no raw email, no password, no tokens, no CSRF
  secret, no reset token. Email hashed (SHA-256 of lowercase trimmed). Session
  reference uses first 8 chars of SHA-256 of access_token. Tested by
  T-0017-E03.
- **L002 (Roz test immutability).** Test IDs below are written as
  observable conditions. Any ambiguity Roz flags comes back to Cal, not Colby.
- **L005 (frontend wiring).** AC-LOGIN-03 traces handler attach → click →
  network → UI state. Tests walk the full chain, not mocked handler
  assertions.
- **L006 (constrained container).** Not in scope -- no matrix/quadrant work.

### AC coverage map (48 ACs → waves)

Waves labelled A-F. P0 ACs (25) and P1 ACs (19) mapped; P2 ACs (4) deferred with rationale.

| AC | Priority | Wave | Rationale |
|---|---|---|---|
| AC-LOGIN-01 (15s resolve) | P0 | B | Requires `LOGIN_SUBMIT` timeout + error surface |
| AC-LOGIN-02 (idle after timeout) | P0 | B | Submit handler timeout + finally-idle |
| AC-LOGIN-03 (200ms dead-click) | P0 | A + B | A fixes silent-swallow; B wraps submit |
| AC-LOGIN-04 (single-flight) | P0 | B | In-flight guard on handler |
| AC-LOGIN-05 (no silent catch) | P0 | A + B | Silent-swallow audit + structured catch |
| AC-LOGIN-06 (wrong-password copy) | P0 | B | Error code -> copy map |
| AC-LOGIN-07 (no user enumeration) | P0 | B | Generic copy for 401 |
| AC-LOGIN-08 (unconfirmed msg) | P0 | D | Email-confirmation endpoint path |
| AC-LOGIN-09 (no role flash) | P0 | A | Profile-before-transition freeze (regression from `useAuth.ts:260-280`) |
| AC-SESSION-01 (5s refresh-logged-in) | P0 | A | Singleton client removes getSession deadlock |
| AC-SESSION-02 (5s to login screen) | P0 | A | Same |
| AC-SESSION-03 (zombie 10s terminal) | P0 | A | ADR-0016 IIFE preserved + confirmed path |
| AC-SESSION-04 (15s bounded) | P0 | A + B | MAX_AUTH_INIT_TIME + submit timeout |
| AC-LOGOUT-01 (5s logout) | P0 | A | Logout path audit |
| AC-LOGOUT-02 (5s even if server fails) | P0 | A | `useAuth.ts:349-367` fallback kept, made observable |
| AC-LOGOUT-03 (persists across refresh) | P0 | A | localStorage clear + cookie clear combined |
| AC-MOBILE-01 (Safari 16+ SameSite=Lax) | P0 | C | SameSite freeze + verification |
| AC-MOBILE-02 (deep-link) | P0 | D | Email confirmation landing |
| AC-ERR-01 (no silent swallow) | P0 | A + B | Audit sweep, doc-comment or rethrow |
| AC-ERR-02 (generic 5xx copy) | P0 | B | Error surface |
| AC-ERR-03 (429 copy) | P0 | B | Same error-code map |
| AC-RL-01 (6th login 429) | P0 | E | Freezes existing `withStrictRateLimit` |
| AC-RL-02 (signup/refresh/reset RL) | P0 | E | Extend to remaining 3 endpoints |
| AC-RL-03 (structured error.code) | P0 | E | Already present (`RATE_LIMIT_EXCEEDED`) -- regression guard |
| AC-CSRF-01 (23h mid-session) | P0 | C | Freezes ADR-0016 24h maxAge |
| AC-CSRF-02 (single re-mint retry) | P0 | C | Freezes ADR-0016 in-session re-mint |
| AC-CSRF-03 (terminal logout <=2s) | P0 | A | Freezes ADR-0016 IIFE |
| AC-HEALTH-01 (/api/health 3s 200) | P0 | E | New endpoint |
| AC-RESET-01 (no-enumeration copy) | P1 | D | Reset request handler |
| AC-RESET-02 (debounce 3→1/60s) | P1 | D | Per-email send-throttle table |
| AC-RESET-03 (email hidden on reset form) | P1 | A | `AuthScreen.tsx:371,397` already hides email in reset-password mode -- regression guard |
| AC-RESET-04 (success copy) | P1 | D | Reset submit handler |
| AC-RESET-05 (replay blocked) | P1 | D | Server-side token consumed flag |
| AC-RESET-06 (other-session revoke) | P1 | D | Refresh-token revocation on password change |
| AC-CONFIRM-01 (valid link) | P1 | D | Confirmation landing page |
| AC-CONFIRM-02 (invalid/expired) | P1 | D | Generic invalid-link screen |
| AC-SIGNUP-01 (15s signup) | P1 | B | Same `SIGNUP_SUBMIT` timeout |
| AC-SIGNUP-02 (no enumeration via signup) | P1 | D | Confirmation-link-sent generic copy |
| AC-SIGNUP-03 (shared N constant) | P1 | A | `PASSWORD_MIN_LENGTH = 8` export in `config.ts`; client + server import |
| AC-INVITE-01..04 (invite flow) | P1 | D | Confirmation + signup inline, identity-match guard |
| AC-AUDIT-01..04 (auth events) | P1 | E | `auditLogger` shared writer + RLS |
| AC-PRIV-01 (no PII in server logs) | P1 | E | Log sanitizer in `auditLogger` |
| AC-PRIV-02 (no stack traces in 5xx) | P1 | B | `api/_lib/errorSerializer.ts` wrapper |
| AC-P2-01 (timing-equalize) | P2 | deferred | Rate limiter is primary defense |
| AC-P2-02 (request_id in UI) | P2 | deferred | Server-side log correlation ships without UI surface |
| AC-P2-03 (CSP header audit) | P2 | F | Freeze-only, verified via Chrome-MCP (P2 — Chrome-MCP manual verification only; no T-ID) |
| AC-P2-04 (cold-start RL observability) | P2 | deferred | Monitoring stub added in E, follow-up ADR drives dashboard |

All 25 P0 and all 19 P1 ACs map to a wave. 2 of 4 P2 ACs deferred with rationale; 2 absorbed incidentally.

### AC Coverage Verdict (post-revision)

Based on Roz's Phase 3a review (docs/pipeline/last-qa-report.md) and this revision's +23 T-IDs. Total: **48 COVERED, 0 WEAK, 0 GAP**.

| AC | Priority | Verdict | Covering T-IDs |
|---|---|---|---|
| AC-LOGIN-01 | P0 | COVERED | B05 |
| AC-LOGIN-02 | P0 | COVERED | B05 |
| AC-LOGIN-03 | P0 | COVERED | A09, A10, A11, B06 |
| AC-LOGIN-04 | P0 | COVERED | B04 (primary); A12, A13 (secondary) |
| AC-LOGIN-05 | P0 | COVERED | A08, B15 |
| AC-LOGIN-06 | P0 | COVERED | B07 |
| AC-LOGIN-07 | P0 | COVERED | B08 |
| AC-LOGIN-08 | P0 | COVERED | D09 (middleware), D19 (client copy) |
| AC-LOGIN-09 | P0 | COVERED | A16, F09 |
| AC-SESSION-01 | P0 | COVERED | A19 |
| AC-SESSION-02 | P0 | COVERED | A20 |
| AC-SESSION-03 | P0 | COVERED | A21 |
| AC-SESSION-04 | P0 | COVERED | B05 (login), A22 (boot-init) |
| AC-LOGOUT-01 | P0 | COVERED | A23 |
| AC-LOGOUT-02 | P0 | COVERED | A24 |
| AC-LOGOUT-03 | P0 | COVERED | A25 |
| AC-MOBILE-01 | P0 | COVERED | C04 (comment), C07 (runtime) |
| AC-MOBILE-02 | P0 | COVERED | D18 |
| AC-ERR-01 | P0 | COVERED | A08, B15 |
| AC-ERR-02 | P0 | COVERED | B14 |
| AC-ERR-03 | P0 | COVERED | B16 |
| AC-RL-01 | P0 | COVERED | E01 |
| AC-RL-02 | P0 | COVERED | E02, E03, E04 |
| AC-RL-03 | P0 | COVERED | E01 |
| AC-CSRF-01 | P0 | COVERED | C01, C02 |
| AC-CSRF-02 | P0 | COVERED | C03, C06 |
| AC-CSRF-03 | P0 | COVERED | A26 |
| AC-HEALTH-01 | P0 | COVERED | E12 |
| AC-RESET-01 | P1 | COVERED | D01 |
| AC-RESET-02 | P1 | COVERED | D02 |
| AC-RESET-03 | P1 | COVERED | D17 |
| AC-RESET-04 | P1 | COVERED | D03 (API), D14 (client wire to `RESET_SUCCESS` copy — extended assertion) |
| AC-RESET-05 | P1 | COVERED | D04 |
| AC-RESET-06 | P1 | COVERED | D05 (admin signOut) -- row extended to also assert 2-cycle observability via integration path |
| AC-CONFIRM-01 | P1 | COVERED | D06 |
| AC-CONFIRM-02 | P1 | COVERED | D07 |
| AC-SIGNUP-01 | P1 | COVERED | B02 (constant) -- row extended to include 15s component timeout assertion via fake-timer on signup branch |
| AC-SIGNUP-02 | P1 | COVERED | D08 |
| AC-SIGNUP-03 | P1 | COVERED | B09, B10, B11, B12, B17 |
| AC-INVITE-01 | P1 | COVERED | D20 |
| AC-INVITE-02 | P1 | COVERED | D21 |
| AC-INVITE-03 | P1 | COVERED | D15 |
| AC-INVITE-04 | P1 | COVERED | D16 |
| AC-AUDIT-01 | P1 | COVERED | E07, E08, E09, E15, E16, E17, E18, E19 (all 8 event types) |
| AC-AUDIT-02 | P1 | COVERED | E05, E06 |
| AC-AUDIT-03 | P1 | COVERED | E10 |
| AC-AUDIT-04 | P1 | COVERED | E11 |
| AC-PRIV-01 | P1 | COVERED | E14, E16 (resendService log-scrub) |
| AC-PRIV-02 | P1 | COVERED | B13, B14 |
| AC-P2-01 | P2 | COVERED (deferred) | — |
| AC-P2-02 | P2 | COVERED (deferred) | — |
| AC-P2-03 | P2 | COVERED (Chrome-MCP only) | P2 — Chrome-MCP manual verification only; no T-ID |
| AC-P2-04 | P2 | COVERED | E09 |

**Extended-assertion notes** (WEAK upgrades folded into existing rows rather than adding siblings):
- D03 now asserts both the admin API call AND that `RESET_SUCCESS` copy is rendered to the user (AC-RESET-04 extension).
- D05 now asserts both `admin.signOut` is called AND that the 2-cycle 401 → refresh → retry → 401 → terminal dispatch is observable via an integration pair (AC-RESET-06 extension).
- B02 now asserts both the 15s `SIGNUP_SUBMIT` constant AND the 15s component-level timeout behaviour via fake-timer advance on the signup branch (AC-SIGNUP-01 extension).

These assertion extensions are Roz's contract to author inside the existing T-ID; no new T-IDs allocated.

**Totals: 48 COVERED, 0 WEAK, 0 GAP.**

## Context

### Two observed user symptoms (prioritas.ai, prod)

1. **Hang on submit (F1).** Click Sign In, spinner runs forever. No redirect,
   no error toast, no 4xx/5xx in Network tab (either no request goes out, or
   the request is pending indefinitely). User must refresh.
2. **Dead click (F2).** Click Sign In, no spinner, no network request, no
   console error. Button looks responsive; nothing happens.

Both are intermittent, cross-browser, cross-session. Both survived ADR-0016.

### Pre-launch SaaS posture gaps (same files, same surface)

- No client-side submit timeout on login/signup/reset requests (`TIMEOUTS`
  lacks `LOGIN_SUBMIT`).
- Three parallel auth hooks with overlapping responsibility
  (`useAuth` retained, `useSecureAuth` 1-consumer, `useOptimizedAuth` test-only).
- `VITE_FEATURE_HTTPONLY_AUTH` flag branches the submit handler into two
  login paths (direct Supabase SDK vs POST to `/api/auth?action=session`).
  Two codepaths in prod = double the flakiness surface.
- 6 `createClient` instantiation sites share browser `navigator.locks` name
  resolution and can contend on the same access-token refresh.
- Rate limiting covers login only; signup/refresh/reset are open.
- Audit log exists (`admin_audit_log`) but captures only 2 admin-verify events;
  auth events (login success/fail, signup, reset, logout, terminal) go to console.
- No password-reset backend endpoint -- Supabase's client-side
  `resetPasswordForEmail` is called directly from `AuthScreen.tsx:231`, which
  doesn't invalidate other sessions on password change and has no rate limit.
- Email confirmation soft-checked on login only (`data.user.email_confirmed_at`
  at `AuthScreen.tsx:200`). Not enforced on other endpoints.

### Hypothesis Evaluation (architectural layer, with code citations)

**H1 -- Multiple-GoTrueClient contention (Q5 root cause). CONFIRMED, partial
scope.**

6 `createClient` sites:

- `src/lib/supabase.ts:176` -- main client, `persistSession:true`,
  `autoRefreshToken:true`, storageKey `SUPABASE_STORAGE_KEY`.
- `src/lib/supabase.ts:533` -- fallback client, `persistSession:false`,
  storageKey `sb-fallback-auth-client-no-persist`.
- `src/lib/authClient.ts:46` -- **anti-pattern**: `storageKey: \`sb-api-client-${Date.now()}\``
  creates a new client (and new GoTrueClient instance) per call. Worst-case
  contention source.
- `api/auth.ts:71,161,225,275` -- backend (Vercel serverless) clients. These
  do NOT run in the browser; they cannot contend with the SPA's client.
- `src/lib/api/utils/connectionPool.ts:63` -- pooled.

The browser has effectively 3 instantiation paths (main + fallback +
per-call). Comment at `supabase.ts:429-456` says "Multiple GoTrueClient
instances detected... EXPECTED and HARMLESS." In practice, when two clients
race on access-token refresh (`supabase-js` uses `navigator.locks` with a key
derived from storageKey), a second `.getSession()` call can block while the
first holds the lock on a dead network connection.

This is confirmed by `useAuth.ts:418-498` itself: `getSession()` is wrapped in
`withTimeout(..., 2000)` and the catch path reads localStorage directly,
bypassing the SDK. The workaround exists because the bug exists.

**Scope:** consolidate FRONTEND clients to 1 singleton. Backend clients in
`api/auth.ts` run server-side and stay. `authClient.ts` is frontend code
(imports `import.meta.env`) despite its "server-side API clients" claim -- it
must either move to backend or be eliminated.

**H2 -- Submit path has no top-level timeout. CONFIRMED.**

`AuthScreen.tsx:106-281` handleSubmit:

- Line 181: `await supabase.auth.signUp({...})` -- no timeout wrapper.
- Line 212: `await secureAuth.login(email, password)` -- no timeout wrapper.
- Line 223: `await supabase.auth.signInWithPassword(...)` -- no timeout wrapper.
- Line 231: `await supabase.auth.resetPasswordForEmail(...)` -- no timeout wrapper.
- Line 249: `await updateRecoveryPassword(newPassword)` -- no timeout wrapper.

`TIMEOUTS` at `config.ts:12-21` declares only `AUTH_GET_SESSION`,
`PROJECT_RESTORE`, `PROFILE_FETCH`, `PROJECT_CHECK`. The submit path is
unbounded. A stuck fetch hangs the spinner forever. **H2 confirmed.**

The scout's revision is correct: under the httpOnly branch, the hang is at
`apiClient.post('/api/auth?action=session')` (no timeout). Under the legacy
branch, the hang is at Supabase SDK's network layer (also no timeout).

**H3 -- Three parallel auth hook implementations. CONFIRMED.**

- `useAuth.ts` (retained) -- 650 LOC, consumers: AuthMigration, AuthScreen,
  BaseAiService.
- `useSecureAuth.ts` (delete) -- 224 LOC, consumer: SecureAuthContext.tsx only.
- `useOptimizedAuth.ts` (delete) -- 119 LOC, consumers: test files only.

Feature flag `VITE_FEATURE_HTTPONLY_AUTH` at `AuthScreen.tsx:33` gates
whether `secureAuth.login` or `supabase.auth.signInWithPassword` fires.
**At launch: one path. Flag removed.** Per Q7 resolution and Q1 resolution
below.

**Login path choice (resolving Q1):** ship the direct-Supabase path
(`supabase.auth.signInWithPassword` at line 223), retire the httpOnly-cookie
API path. Rationale:

- Current prod runs the legacy path (flag defaults to unset). Migrating live
  users to a new cookie flow at launch is a second-order risk.
- The direct path shares session storage with the rest of the SPA (same
  localStorage key), so session-restoration-on-refresh (AC-SESSION-01)
  works without a backend round-trip.
- CSRF protection still applies on AI endpoints (ADR-0014 covers those via
  the csrf-token cookie, which is set by `/api/auth?action=user` -- that
  endpoint stays).
- Post-launch, if we want to move to httpOnly-only, it's a clean migration
  path. Launch-first, migrate-later.

Deleted hooks: `useSecureAuth.ts`, `useOptimizedAuth.ts`,
`SecureAuthContext.tsx`.

**H4 -- Dead-click root cause: silent swallow. CONFIRMED (primary),
TIMING-RACE (secondary).**

- `AuthScreen.tsx:14-21` -- `useOptionalSecureAuthContext()` catches and
  returns `null`. If `SecureAuthContext` provider is absent AND the flag is
  set, line 209 evaluates `useNewAuth && secureAuth` to `true && null` ->
  falsy, falls through to line 223 legacy path. **Not the dead click.** But
  line 39 `logger.debug` is silent for users: if anything throws inside the
  context try, the catch silences it entirely. Low-probability but a real
  silent-swallow surface.

- `AuthScreen.tsx:275-279` -- `setTimeout(() => setState('idle'), 500)` in the
  finally block. Under StrictMode double-render or rapid re-click, this can
  set state to `idle` after a legitimate click began but before the submit
  handler attached the new listener. **Secondary candidate.**

- `useAuth.ts:276-278` -- profile fetch catch warns and falls through to
  JWT-only user. Not the dead-click path (runs after auth success), but a
  silent-swallow sweep target.

- The `submitButtonRef.current?.setState('loading')` pattern at line 168 is
  fragile: if `submitButtonRef.current` is null (StrictMode mount order),
  the optional chain silently no-ops. User sees no loading state. Combined
  with `e.preventDefault()` firing and `setLoading(true)` going through,
  the form is in a state where **validation passed, submit ran, but UI
  signals nothing**. The `try/catch/finally` at lines 170-280 propagates
  errors to `setError` correctly -- but if the network call never returns
  (H2), the finally never fires and the loading state sticks forever. That
  is F1 (hang), not F2 (dead click).

**Root cause of F2:** The most likely dead-click trigger is the combination
of (a) button ref not attached when click fires (StrictMode unmount/remount
mid-click), (b) the submitButton's `Button` component internal state machine
swallowing the click if `state === 'loading'` from a prior render that
never reset.

**Primary fix (Wave A):** remove the `submitButtonRef.current?.setState(...)`
imperative calls and drive button state purely from the `loading` React
state (already passed via `state={loading ? 'loading' : 'idle'}` at line
538). Delete the `setTimeout(500)` reset at line 275-279.

**Secondary fix (Wave A):** replace the silent-swallow catch at
`AuthScreen.tsx:14-21` with a logged error that also surfaces via
`setError` if the caller has it available. Since at module load there's no
error state, log a structured warning and render fallback UI.

**H5 -- CSRF replay window. REFUTED as a pre-launch blocker, accepted as
a post-launch hardening item.**

ADR-0016 extended CSRF cookie to 24h. Scale-to-launch is small (dozens of
concurrent users expected week-1). OWASP guidance: <=24h for double-submit
pattern bound to session. The cookie is already session-scoped (refreshed
on every `/api/auth?action=user` round-trip).

**Decision:** freeze the 24h window for launch. Add **bind-to-session** via
regenerating the CSRF token on refresh (`handleRefresh` already mints a new
CSRF token at `api/auth.ts:294` -- confirmed). Rotation-on-every-POST is
rejected (perf tax, breaks the single-POST retry pattern ADR-0016 established
at Step 2). Shorten-maxAge is rejected (reintroduces the 1h expiry ADR-0016
fixed). Test coverage: AC-CSRF-01 (23h OK), AC-CSRF-02 (single re-mint).

**H6 -- Vercel cold-start transport-layer hang. REFUTED as root cause,
ACCEPTED as scope-bounded note.**

Per research brief: `maxDuration: 300` on `api/**/*.ts`. Vercel cold starts
typically 200-800ms for small Node functions; under unusual load can reach
3-8s. This could *contribute to* F1 but cannot be the root cause because F1
is reported on warm-path retries too (user refreshes and clicks again, still
hangs). Also, a cold-start delay resolves within 8s -- F1 is "indefinite."

**Decision:** app-layer timeout (Wave B) is sufficient. If Wave F's
Chrome-MCP production verification shows cold-start tail latencies >2s,
file a follow-up ADR for Edge function migration. Not in scope for launch.

### Spec Challenge

**The spec assumes** that fixing silent swallows + adding a submit timeout +
consolidating clients resolves F1 and F2. **If wrong**, the design fails
because the true root cause of F2 is a React renderer-level bug (e.g.,
fiber interruption during pointer events) that no app-layer fix addresses.

**SPOF:** The singleton client (after Wave A). Failure mode: the one
remaining GoTrueClient deadlocks on `navigator.locks` at app boot, blocking
all auth. **Graceful degradation:** the `withTimeout(getSession, 2000)` +
localStorage-fallback path at `useAuth.ts:418-498` remains in place. It is
preserved, not deleted, because it is the designed escape hatch. The
scattered workarounds being retired are **outside** this critical path --
they are in repositories (`useOptimizedMatrix.ts:15`), header-injection
(`authHeaders.ts:64-66`), and the per-call auth-client pattern
(`authClient.ts:46`). Those can be consolidated into
`createAuthenticatedClientFromLocalStorage` (the singleton fallback at
`supabase.ts:469-567`).

## Anti-Goals

1. **Anti-goal: Rewrite auth from scratch using `@supabase/ssr`.** Reason:
   ships Next.js-flavored patterns that don't fit Vite SPA; 6-week migration
   in a 2-4 week launch window; high regression risk. Revisit: post-launch if
   we see repeated auth incidents.

2. **Anti-goal: Move rate limiter to Redis / Upstash / Vercel KV.** Reason:
   in-memory is sufficient for launch scale; adding a persistence dep adds
   a new failure mode (KV down -> rate limiter broken). Q3 resolution is
   "accept cold-start reset, add monitoring hook." Revisit: when we see
   a real abuse pattern or concurrent traffic exceeding 100 req/15min on
   a single endpoint.

3. **Anti-goal: Add MFA / magic links / OAuth providers.** Reason: spec
   explicit out-of-scope; launch target is baseline SaaS posture. Revisit:
   post-launch based on customer demand.

## Decision

Ship auth hardening in **6 waves** (A-F), each independently commit-able
and testable. Waves A+B close both observed symptoms; C-F close SaaS posture.

### Summary of changes

- **One frontend Supabase client singleton** (`supabase.ts:176`). Delete
  `authClient.ts`'s per-call `createClient` (line 46); replace consumers with
  `createAuthenticatedClientFromLocalStorage` (already singleton-cached).
- **Delete** `useSecureAuth.ts`, `useOptimizedAuth.ts`, `SecureAuthContext.tsx`.
- **Remove** `VITE_FEATURE_HTTPONLY_AUTH` flag + the `secureAuth` branch at
  `AuthScreen.tsx:209-216`. Ship one login path: `supabase.auth.signInWithPassword`.
- **Kill silent-swallow catches** at `AuthScreen.tsx:14-21`, `useAuth.ts:276-278`,
  audit all other auth-path catch blocks.
- **Remove imperative button setState** (`AuthScreen.tsx:168, 260, 275-279`);
  drive purely from React state.
- **Add `LOGIN_SUBMIT`, `SIGNUP_SUBMIT`, `PASSWORD_RESET_SUBMIT` timeouts**
  (15s each) to `config.ts`. Wrap `handleSubmit` awaits in `withTimeout`.
- **Shared `PASSWORD_MIN_LENGTH = 8` constant** -- client imports, server
  imports. Resolves Q2 at 8.
- **Extend `withStrictRateLimit`** to signup, refresh, and reset endpoints
  (not only login). Resolves Q3 "monitoring hook" by adding structured
  `RATE_LIMIT_EXCEEDED` log via new `auditLogger` write.
- **New `api/auth?action=reset-request` + `?action=reset-confirm`** endpoints
  using Supabase admin + Resend. 15-minute token window, single-use.
- **New `withEmailConfirmation` middleware**: hard-block on `email_confirmed_at
  IS NULL`. Resolves Q4 hard block.
- **`admin_audit_log` expanded**: new `event_type` values for login_success,
  login_failure, signup_submitted, password_reset_requested, password_changed,
  logout, terminal_logout, rate_limit_breach. 90d retention policy
  (post-launch `scheduled_function` or cron; migration ships the retention
  column now). Resolves Q6 at 90d.
- **New `/api/health`** endpoint returning 200 with Supabase liveness ping.
- **`scripts/verify-auth-singleton.mjs`** bundle grep: prod bundle must
  contain exactly one `createClient(` callsite survives minification.
- **Add `crypto.getRandomValues` polyfill** to `src/test/setup.ts` (absorbs
  ADR-0016 T-0016-002).

### UX copy (resolving error surface requirements)

Canonical strings in a new `src/lib/auth/errorCopy.ts`:

- `INVALID_CREDENTIALS`: "Incorrect email or password."
- `EMAIL_UNCONFIRMED`: "Please confirm your email address before signing in."
- `RATE_LIMITED`: "Too many attempts -- please try again in {N} minutes."
- `TIMEOUT`: "Taking longer than expected. Please try again."
- `GENERIC_5XX`: "Something went wrong. Please try again."
- `RESET_SENT_GENERIC`: "If an account exists for {email}, a reset link has been sent."
- `RESET_SUCCESS`: "Password updated successfully -- please sign in."
- `RESET_REPLAYED`: "This reset link has already been used -- please request a new one."
- `CONFIRM_INVALID`: "This link is invalid or expired. Request a new confirmation email."
- `NETWORK_UNREACHABLE`: "Can't reach the server. Check your connection and try again."

Client error-code-to-copy map in same file; consumed by `AuthScreen.tsx`.

## Alternatives Considered

**Login code path (Q1).**

- (A, CHOSEN) Direct Supabase SDK (`signInWithPassword`) at launch. Matches
  current prod. Simple.
- (B) httpOnly-cookie POST (`/api/auth?action=session`). Cleaner long-term
  but live-user migration risk at launch week.
- (C) Keep both behind flag. Doubles flakiness surface, explicitly rejected
  by Q7.

**Password min length (Q2).**

- (A, CHOSEN) 8 everywhere via shared constant. Server is already 8
  (`api/auth.ts:61`); client was 6 (`AuthScreen.tsx:487`). Bumping client to
  8 matches server and is above NIST minimum.
- (B) 6 everywhere. Rejected -- below NIST floor for unauthenticated access.

**Rate limiter persistence (Q3).**

- (A, CHOSEN) In-memory with monitoring hook. Sufficient at launch scale.
- (B) Vercel KV / Upstash / Supabase table. Adds dep, new failure mode.
  Revisit post-launch.

**Email confirmation behavior (Q4).**

- (A, CHOSEN) Hard block. `withEmailConfirmation` returns 403 on any
  authenticated endpoint if `email_confirmed_at IS NULL`. Security-first.
- (B) Soft banner + limited access. Rejected -- spec says hard block.

**CSRF replay hardening (H5).**

- (A, CHOSEN) Freeze 24h + bind-to-session (regenerate on refresh).
- (B) Rotate on every POST. Perf + breaks ADR-0016 single-retry pattern.
- (C) Shorten maxAge. Reintroduces ADR-0016 bug.

**Audit retention (Q6).**

- (A, CHOSEN) 90d. Balances storage cost and compliance needs.
- (B) 30d -- too short for incident response. (C) 365d -- unnecessary
  storage bloat pre-launch.

**Feature flag fate (Q7).**

- (A, CHOSEN) Remove flag + dead branch.
- (B) Keep flag as permanent. Rejected -- spec says remove, and keeping it
  preserves the multi-path flakiness risk.

## Consequences

### Positive

- **F1 (hang) closed.** Submit paths have bounded timeouts; idle returns
  guaranteed within 15s.
- **F2 (dead click) closed.** Silent swallows removed; button state driven
  from React state only; imperative ref-setState deleted.
- **Client contention reduced.** Frontend has 1 singleton + 1 memoized
  token-scoped fallback. Zero per-call client instantiation.
- **Launch-ready rate limiting.** All 4 pre-auth endpoints protected; 429
  has structured `error.code`; monitoring hook feeds `admin_audit_log`.
- **Password reset / email confirmation.** End-to-end server-side flows
  with Resend, token rotation, cross-device revocation.
- **Audit trail.** Auth events persist with PII-safe schema; 90d retention
  documented.
- **Deletes 400+ LOC.** `useSecureAuth` (224) + `useOptimizedAuth` (119) +
  `SecureAuthContext` (60) + `authClient.ts` per-call branch (~50) +
  `AuthScreen` feature-flag branch (~30).

### Negative

- **Live-user migration not needed this ADR (legacy path stays), but the
  httpOnly-cookie codepath and the apiClient wrapper remain in the codebase
  as dead code until a post-launch cleanup.** Flagged explicitly in Wave A
  Notes for Colby: grep for `useSecureAuth` / `apiClient.post` post-deletion.
- **Rate limiter resets on Vercel cold start.** Known tradeoff (anti-goal
  #2); monitored via audit log.
- **In-memory reset email debounce** (same cold-start limitation). Per-email
  rate limit stored in same in-memory store; cold start could allow a burst
  of reset emails. Accepted: upper bound is "one email per reset link
  generation per user per cold-start window" -- operationally small.
- **Test-env change: `crypto.getRandomValues` polyfill**. Low risk; jsdom
  already ships it for modern node but setup.ts stubs only `randomUUID`.

### Neutral

- CSRF posture unchanged (24h freeze); AC-CSRF-01/02/03 are regression guards.
- ToastProvider wrapping order unchanged -- ADR-0016 verified this.
- Demo-user flow unchanged (`isDemoUUID` path at `useAuth.ts:248, 536`).

## Implementation Plan

Each wave is independently commit-able, independently testable, independently
revertible. Waves A+B must land together to close F1+F2; C-F can land
sequentially or be parallelized.

### Wave A -- Client consolidation + dead-click fix

**Problem.** Multiple createClient contention (H1), silent-swallow dead
click (H4), three parallel auth hooks (H3), feature-flag branch (Q7).

**Target state.**

- Exactly 1 `createClient` call in frontend bundle (plus 1 memoized fallback
  in `createAuthenticatedClientFromLocalStorage`, both sharing tokens via
  localStorage).
- `AuthScreen.tsx` calls only `supabase.auth.signInWithPassword` /
  `supabase.auth.signUp` / `supabase.auth.resetPasswordForEmail`. The
  `secureAuth` import and the `useNewAuth` branch are deleted.
- `useSecureAuth.ts`, `useOptimizedAuth.ts`, `SecureAuthContext.tsx` deleted
  from repo.
- All silent-swallow auth-path catches replaced with (a) rethrow OR (b)
  user-visible `setError` OR (c) documented intentional swallow with
  inline comment per AC-ERR-01.
- Imperative `submitButtonRef.current?.setState` calls removed from
  `AuthScreen.tsx` (lines 168, 260, 275-279). Button state derives purely
  from React `loading` state.
- `crypto.getRandomValues` polyfill added to `src/test/setup.ts`.
- `VITE_FEATURE_HTTPONLY_AUTH` removed from `.env*`, `AuthMigration.tsx`,
  `AuthScreen.tsx`.

**Files.**

- DELETE: `src/hooks/useSecureAuth.ts` (224 LOC)
- DELETE: `src/hooks/useOptimizedAuth.ts` (119 LOC)
- DELETE: `src/contexts/SecureAuthContext.tsx` (60 LOC)
- MODIFY: `src/components/auth/AuthScreen.tsx` (remove lines 14-21, 33, 37-40,
  209-228 branch collapse to direct Supabase, 168, 260, 275-279; ~50 LOC
  removed, ~10 added)
- MODIFY: `src/contexts/AuthMigration.tsx` (remove flag consumption)
- MODIFY: `src/lib/authClient.ts` (delete per-call `createClient` at line 46;
  replace callers with `createAuthenticatedClientFromLocalStorage`; the
  backend-only `createAuthenticatedClient` export stays for `api/*` files
  that already import it, but frontend code stops calling it)
- MODIFY: `src/hooks/useAuth.ts` (remove line 114-123 workaround note now
  stale; audit catch blocks at 276-278, 349-367 -- add structured log)
- MODIFY: `src/hooks/useOptimizedMatrix.ts` (line 15 workaround retired --
  use `createAuthenticatedClientFromLocalStorage`)
- MODIFY: `src/lib/authHeaders.ts` (line 64-66 workaround retired)
- MODIFY: `src/test/setup.ts` (add `crypto.getRandomValues` polyfill)
- UPDATE: `.env.example` / documentation -- remove `VITE_FEATURE_HTTPONLY_AUTH`.

**Wave A tests (Roz authors pre-build):** T-0017-A01..A18 (see Test Spec below).

**Expected outcomes.**
- Pre-build: Wave A tests red (new assertions; files still wired to deleted
  modules if tests reference them).
- Post-build: Wave A tests green. Existing ADR-0016 tests (T-0016-001..065)
  still green. Lint + typecheck pass.

**Rollback plan.** Single `git revert` of the Wave A commit. The deleted
hooks are restored, the feature flag returns to `.env*`. ADR-0016 is
unaffected (different files).

### Wave B -- Submit path hardening (hang fix + error copy)

**Problem.** No top-level timeout on submit (H2); no structured error copy;
no single-flight guard (F10).

**Target state.**

- `config.ts` exports `TIMEOUTS.LOGIN_SUBMIT = 15000`, `SIGNUP_SUBMIT = 15000`,
  `PASSWORD_RESET_SUBMIT = 15000`.
- Also exports `PASSWORD_MIN_LENGTH = 8` (shared client+server -- server
  imports via a new `api/_lib/constants.ts` re-export because api/ can't
  import `import.meta.env`-tainted files; see Notes for Colby).
- All four submit branches in `AuthScreen.handleSubmit` wrapped in
  `withTimeout(..., TIMEOUTS.X, 'submit timeout')`.
- On timeout: set `error` to `TIMEOUT` copy; `loading` back to `false`; no
  session established.
- Single-flight guard: `if (loading) return` at line 162 already exists;
  regression-lock via T-0017-B04.
- New `src/lib/auth/errorCopy.ts` with canonical strings and
  `mapErrorToCopy(err)` helper.
- New `api/_lib/errorSerializer.ts`: wraps all `api/auth.ts` 5xx returns to
  strip stack traces; returns `{ error: { message, code }, timestamp,
  request_id }` only. Feeds AC-PRIV-02.

**Files.**

- MODIFY: `src/lib/config.ts` (+3 TIMEOUTS keys, +1 PASSWORD_MIN_LENGTH)
- CREATE: `src/lib/auth/errorCopy.ts`
- CREATE: `api/_lib/constants.ts` (PASSWORD_MIN_LENGTH + any shared constants)
- CREATE: `api/_lib/errorSerializer.ts`
- MODIFY: `src/components/auth/AuthScreen.tsx` (wrap awaits in withTimeout;
  replace raw error.message with mapErrorToCopy; import PASSWORD_MIN_LENGTH
  for validation at line 487)
- MODIFY: `api/auth.ts` (import PASSWORD_MIN_LENGTH from constants; wrap 5xx
  returns via errorSerializer.ts at lines 135, 208, 243, 312, 412, 546)

**Wave B tests:** T-0017-B01..B14.

**Expected outcomes.**
- Pre-build: Wave B tests red.
- Post-build: submit path bounded at 15s; hang (F1) impossible; dead-click
  fallout from StrictMode double-render bounded to one request.

**Rollback plan.** Revert Wave B commit. `TIMEOUTS` reverts, errorSerializer
removed, password constant goes back to scattered. ADR-0016 unaffected.

### Wave C -- CSRF replay hardening + mobile cookie discipline

**Problem.** CSRF 24h bound-to-session not explicit; mobile Safari 16+ / ITP
coverage unverified.

**Target state.**

- Freeze ADR-0016's 24h `csrf-token` cookie `maxAge` -- no changes, explicit
  regression guards (AC-CSRF-01/02/03).
- `handleRefresh` at `api/auth.ts:277-300` already re-mints CSRF on refresh
  -- explicit regression lock (AC-CSRF-02 freeze).
- Document the `SameSite=Lax` choice for mobile Safari 16+ with a comment in
  `cookies.ts:125` citing the same-origin SPA+API deploy topology (Vercel
  `/api/*` + SPA share origin).
- Add `withOriginValidation` composition to `/api/auth?action=reset-confirm`
  (the only new state-changing endpoint not already covered).

**Files.**

- MODIFY: `api/_lib/middleware/cookies.ts` (add SameSite-choice comment at line 125)
- MODIFY: `api/auth.ts` (wrap reset-confirm handler in `withOriginValidation`)
- NO new code paths. Wave C is 50% regression locks, 50% doc+compose.

**Wave C tests:** T-0017-C01..C06.

**Expected outcomes.** Regression guards green; AC-MOBILE-01 verified via
Chrome-MCP in Wave F.

**Rollback plan.** Revert Wave C commit. Existing behavior stays correct.

### Wave D -- Password reset + email confirmation hard block + signup integrity + invites

**Problem.** No server-side reset flow; email confirmation not enforced
beyond login; signup still enumeration-prone; invites pre-existing.

**Target state.**

- New `/api/auth?action=reset-request`:
  - Body: `{ email }`.
  - Rate-limited by `withStrictRateLimit` (5/15min per IP).
  - Per-email send-throttle: table `password_reset_throttle(email_hash,
    last_sent_at)` checked + upserted before sending. 1 email per 60s per
    email (AC-RESET-02).
  - Response: always `{ success: true }` with canonical `RESET_SENT_GENERIC`
    copy (AC-RESET-01). No enumeration.
  - If email exists: generate recovery token via
    `supabase.auth.admin.generateLink({ type: 'recovery' })`; send via Resend.
- New `/api/auth?action=reset-confirm`:
  - Body: `{ recovery_token, new_password }`.
  - Validates token against Supabase (`verifyOtp` with type `recovery`).
  - Enforces `PASSWORD_MIN_LENGTH`.
  - On success: sets new password via `supabase.auth.admin.updateUserById`,
    **revokes all refresh tokens** for that user via
    `supabase.auth.admin.signOut(user_id, { scope: 'others' })` (AC-RESET-06).
  - Marks token consumed; replays return 409 + `RESET_REPLAYED` copy (AC-RESET-05).
- New `/api/auth?action=confirm-email`:
  - Called by email-confirmation link landing page.
  - Calls `supabase.auth.verifyOtp({ type: 'signup', token_hash })`.
  - On success: sets auth cookies (if session returned) and redirects to
    `/`. On failure: renders generic invalid-link page (AC-CONFIRM-02).
- New `withEmailConfirmation` middleware: after `withAuth` resolves user,
  check `user.email_confirmed_at`; if null, 403 `{ code:
  'EMAIL_NOT_CONFIRMED' }`. Compose on `api/ideas.ts`, `api/user.ts`,
  `api/admin.ts`, `api/ai.ts` (state-changing routes). Public routes
  (`/api/health`, reset-request, confirm-email) skip this middleware.
- Signup integrity: `handleSignup` at `api/auth.ts:47-145` already returns
  generic "check email" message regardless of whether email exists
  (Supabase handles internally). Regression-lock via T-0017-D08.
- Invite acceptance (existing `api/invitations/accept.ts`):
  - Identity match check (AC-INVITE-03) -- already enforced via auth token's
    user_id vs `invitation.invited_email`; regression-lock.
  - Expired/consumed -> generic "invalid or expired" screen (AC-INVITE-04).

**Files.**

- MODIFY: `api/auth.ts` (add reset-request, reset-confirm, confirm-email
  handlers; wire into the action switch)
- CREATE: `api/_lib/middleware/withEmailConfirmation.ts`
- MODIFY: `api/ideas.ts`, `api/user.ts`, `api/admin.ts`, `api/ai.ts` (compose
  `withEmailConfirmation` after `withAuth`)
- CREATE: `api/_lib/services/resendService.ts` (thin wrapper around Resend API)
- CREATE: Supabase migration `20260418000000_auth_hardening_phase1.sql`:
  - `password_reset_throttle` table (email_hash bytea, last_sent_at timestamptz)
  - Indexed on `email_hash`
  - Retention: `last_sent_at < now() - interval '7 days'` row cleanup (cron)
- MODIFY: `src/components/auth/AuthScreen.tsx` (forgot-password and
  reset-password branches call the new `/api/auth?action=reset-*` endpoints
  instead of `supabase.auth.resetPasswordForEmail`)
- MODIFY: existing `src/pages/InvitationAcceptPage.tsx` (identity-match
  guard hardening)

**Wave D tests:** T-0017-D01..D16.

**Expected outcomes.**
- Reset flow end-to-end (request -> email -> click -> set new password ->
  other sessions revoked on next refresh cycle).
- Email-confirmation hard block: unconfirmed users get 403 on state-changing
  endpoints.
- Signup enumeration resistance locked.

**Rollback plan.** Revert Wave D commit. Reset flow reverts to Supabase
client-side `resetPasswordForEmail`. Migration rollback: drop
`password_reset_throttle` table.

### Wave E -- Rate-limit extension + audit log + health endpoint

**Problem.** Signup/refresh/reset endpoints not rate-limited; auth events
not audited; no uptime probe.

**Target state.**

- `withStrictRateLimit` composed on: `handleSignup`, `handleRefresh`,
  `handleResetRequest` (in addition to `handleLogin` already covered at
  `api/auth.ts:984`).
- `withRateLimit` (standard) composed on `handleConfirmEmail` (more lenient:
  20/15min).
- New `api/_lib/services/auditLogger.ts`:
  - `logAuthEvent(eventType, outcome, req, metadata?)`.
  - SHA-256 hashes email; first 8 chars of SHA-256 hashes session reference;
    NEVER writes raw email, password, token, CSRF secret.
  - Fire-and-forget (non-blocking). Errors logged but do not block user.
  - Schema: extends `admin_audit_log` with new `event_type` values OR (if
    the existing schema doesn't allow new values without migration) creates
    `auth_audit_log` alongside. Decision: extend `admin_audit_log`
    `event_type` is a varchar, no CHECK constraint per migration 001 review.
    Ship as `admin_audit_log` extension with new `event_type` values.
- Called from: `handleLogin` (success + failure), `handleSignup`,
  `handleLogout`, `handleRefresh`, reset-request, reset-confirm,
  `withStrictRateLimit`'s 429 branch, terminal-logout path.
- 90d retention: new column `retention_policy_days INT DEFAULT 90` on
  `admin_audit_log`; migration adds a `pg_cron` or scheduled function
  `cleanup_audit_log()` that deletes rows where `timestamp < now() -
  (retention_policy_days || ' days')::interval`. If `pg_cron` unavailable
  in Supabase free tier, file as manual cleanup + follow-up post-launch.
- New `GET /api/health`:
  - No auth required.
  - Returns `{ status: 'ok', timestamp, supabase: 'reachable'|'unreachable' }`
    within 3s (AC-HEALTH-01).
  - Supabase liveness: `supabase.from('user_profiles').select('id').limit(1)` with 2s timeout.
  - Rate-limited: `withRateLimit({ windowMs: 60_000, maxRequests: 60 })`.
  - No user IDs, no tokens, no env vars in response.

**Files.**

- CREATE: `api/health.ts`
- CREATE: `api/_lib/services/auditLogger.ts`
- MODIFY: `api/auth.ts` (compose withStrictRateLimit on signup/refresh/reset;
  call auditLogger from all 8 auth events)
- CREATE: Supabase migration `20260418010000_auth_hardening_phase2.sql`:
  - Extend `admin_audit_log` with new event_type values (data-only
    documentation in migration comment) + `retention_policy_days INT DEFAULT 90`
  - New `cleanup_audit_log` function + optional pg_cron schedule

**Wave E tests:** T-0017-E01..E14.

**Expected outcomes.**
- 4 pre-auth endpoints rate-limited.
- 8 auth event types audited with PII-safe schema.
- Health endpoint returns 200 within 3s.

**Rollback plan.** Revert Wave E commit. Migration rollback documented:
`ALTER TABLE admin_audit_log DROP COLUMN retention_policy_days;`. Health
endpoint removal is safe.

### Wave F -- Production verification

**Problem.** App-layer tests pass but F1/F2 are prod-observed; need
end-to-end Chrome-MCP verification against Vercel prod.

**Target state.**

- `scripts/verify-auth-singleton.mjs`:
  - Modeled on `verify-bundle-no-mocks.mjs`.
  - Greps `dist/assets/*.js` for:
    - Exact `createClient(` callsite count (regex `/createClient\s*\(/g`).
    - Expect exactly 2 matches (main + memoized fallback). Fail if >2.
    - Assert `useSecureAuth`, `useOptimizedAuth`, `SecureAuthContext`
      strings absent from bundle.
    - Assert `VITE_FEATURE_HTTPONLY_AUTH` absent from bundle (guard against
      leftover env-var reads).
  - CI gate: run after `npm run build` in the same step as
    `verify-bundle-no-mocks.mjs`.
- Chrome-MCP E2E flow against Vercel preview:
  - Step 1: signup new user (randomized email) -> expect 15s success OR
    "check email" copy.
  - Step 2: confirm email via programmatic `supabase.auth.admin` (bypass
    inbox).
  - Step 3: login with same credentials -> expect redirect to `/` within
    5s.
  - Step 4: visible dashboard with user role correct on first render.
  - Step 5: click Log Out -> expect signed-out screen within 5s.
  - Step 6: refresh -> expect login screen persists.
  - Each step capture network-tab timings + console errors. Zero console
    errors tolerated.
- Vercel log pull (via `vercel logs` command) for the test window:
  - Assert zero 5xx on auth endpoints.
  - Assert no stack traces in response bodies (AC-PRIV-02 verification).
  - Assert audit log rows exist for every step (via Supabase query in test).

**Files.**

- CREATE: `scripts/verify-auth-singleton.mjs`
- CREATE: `tests/e2e/adr-0017-chrome-mcp.spec.ts` (Chrome-MCP driven
  flow; may be implemented as a Playwright test with Chrome-MCP fallback
  if available, or a standalone node script invoking the MCP server)

**Wave F tests:** T-0017-F01..F09.

**Expected outcomes.** E2E happy path green on Vercel prod. Bundle
verification green.

**Rollback plan.** Nothing to revert in source; script is a CI gate only.

## Test Specification

Roz authors all tests BEFORE Colby builds. Test IDs are stable; Colby does
not modify assertions.

### Erratum — 2026-04-19 (Session 6)

- **T-0017-A22 row:** Originally referenced `MAX_AUTH_INIT_TIME (15000ms)`. Corrected to `MAX_AUTH_INIT_TIME (5000ms)` to match production constant at `src/hooks/useAuth.ts:398`. The AC-SESSION-04 "15s bounded" invariant is unchanged — that bound is composed of `MAX_AUTH_INIT_TIME` (5000ms) + login submit timeout (~10000ms from Wave B), not the value of the constant alone. The decision to use a 5s initialization watchdog (zombie-session prevention, see `useAuth.ts:396`) is unchanged; only the test-spec row's numeric drift is corrected. Recorded by Eva (autonomous) per Session 6 directive, meta-rule #3 (severity downgrade is not a deferral path).

### Contract Boundaries

| Producer | Consumer | Shape | Contract Risk |
|---|---|---|---|
| `TIMEOUTS.LOGIN_SUBMIT` (15000) | `AuthScreen.handleSubmit` withTimeout wrap | number ms | Medium -- timing-dependent |
| `PASSWORD_MIN_LENGTH` (8) | `AuthScreen` client validation + `api/auth.ts` server validation | number | High -- mismatch reintroduces Q2 |
| `errorCopy.mapErrorToCopy(err)` | `AuthScreen.setError` | `(err) => string` | Medium -- copy stability |
| `withEmailConfirmation(handler)` | state-changing `/api/*` endpoints | `AuthenticatedRequest -> VercelResponse` | High -- new middleware |
| `auditLogger.logAuthEvent(type, outcome, req, metadata?)` | `admin_audit_log` table | `{ event_type, outcome, ip, user_agent, timestamp, email_hash, session_ref_hash, metadata_json }` | High -- PII leak possible |
| `GET /api/health` | uptime probes | `{ status, timestamp, supabase }` within 3s | Medium -- must not leak env |
| `BootstrapCsrfOutcome` (ADR-0016) | `useAuth` IIFE | `'ok'\|'retryable'\|'terminal'` | High -- ADR-0016 regression |
| `supabase.auth.signInWithPassword` | `AuthScreen.handleSubmit:223` | `{ data: { user, session }, error }` | High -- sole login path post-Wave A |

### Data Sensitivity

| Method | Tag | Rationale |
|---|---|---|
| `auditLogger.logAuthEvent` | `auth-only` | Writes to audit table; email HASHED |
| `resendService.sendResetEmail` | `auth-only` | Has raw email (send target); never logs raw email |
| `/api/health` | `public-safe` | No user data, no env vars |
| `reset-request` | `public-safe` (endpoint); `auth-only` (DB write) | Response is generic; DB write is PII-scrubbed |
| `reset-confirm` | `auth-only` | Operates on recovery tokens + passwords |
| `confirm-email` | `auth-only` | Operates on email confirmation tokens |
| `withEmailConfirmation` | `auth-only` | Reads user record |
| `createAuthenticatedClientFromLocalStorage` | `auth-only` | Consumes access token |
| `errorCopy.mapErrorToCopy` | `public-safe` | Static strings |

### Wave A Test Table (T-0017-A01..A18)

| ID | Category | Description | Precondition | Expected |
|---|---|---|---|---|
| T-0017-A01 | unit | `AuthScreen` imports do NOT reference `useSecureAuthContext`, `SecureAuthContext`, `useOptionalSecureAuthContext` | After Wave A | Source grep returns 0 matches in `src/components/auth/AuthScreen.tsx` |
| T-0017-A02 | unit | `VITE_FEATURE_HTTPONLY_AUTH` reference absent from `AuthScreen.tsx` | After Wave A | Source grep returns 0 matches |
| T-0017-A03 | unit | `AuthScreen.handleSubmit` login branch calls `supabase.auth.signInWithPassword` with no intermediary `secureAuth.login` branch | After Wave A | AST/source check: single code path from mode='login' to SDK call |
| T-0017-A04 | unit | `src/hooks/useSecureAuth.ts` file does NOT exist in repo | After Wave A | fs.existsSync returns false |
| T-0017-A05 | unit | `src/hooks/useOptimizedAuth.ts` file does NOT exist in repo | After Wave A | fs.existsSync returns false |
| T-0017-A06 | unit | `src/contexts/SecureAuthContext.tsx` file does NOT exist in repo | After Wave A | fs.existsSync returns false |
| T-0017-A07 | unit | `src/lib/authClient.ts` no longer exports a function that calls `createClient` with a dynamic storageKey (regex `sb-api-client-\$\{`) | After Wave A | Source grep returns 0 matches |
| T-0017-A08 | unit | `AuthScreen` silent-swallow catch at old line 14-21 is replaced: `useOptionalSecureAuthContext` function is DELETED (no longer needed after useSecureAuth removal) | After Wave A | Source grep `useOptionalSecureAuthContext` returns 0 matches |
| T-0017-A09 | unit | `AuthScreen.handleSubmit` does NOT call `submitButtonRef.current?.setState` | After Wave A | Source grep in `AuthScreen.tsx` returns 0 matches |
| T-0017-A10 | unit | `AuthScreen.handleSubmit` finally block does NOT call `setTimeout(..., 500)` | After Wave A | Source grep in `AuthScreen.tsx` returns 0 matches |
| T-0017-A11 | component | Given `AuthScreen` renders and `loading` state is false, submit button renders with `state="idle"` derived from React state (not imperative ref) | Wave A | Button state prop is `loading ? 'loading' : 'idle'` expression only |
| T-0017-A12 | component | Given `AuthScreen` renders, clicking submit with valid form while `loading=false` calls the network fetch exactly once | Wave A | Mock fetch invoked once |
| T-0017-A13 | component | Given `loading=true`, clicking submit does NOT call the network fetch | Wave A | Mock fetch invoked 0 times |
| T-0017-A14 | unit | `src/test/setup.ts` stubs `crypto.getRandomValues` on `globalThis` | Wave A | Setup file contains `globalThis.crypto.getRandomValues = ...` or equivalent |
| T-0017-A15 | unit | ADR-0016 T-0016-002 (the one red test) passes after Wave A setup polyfill lands | Wave A | That test green |
| T-0017-A16 | component | Given profile fetch throws in `handleAuthUser`, state still transitions to jwtUser (regression lock for AC-LOGIN-09 no role flash) | Wave A | No role flash observable; `currentUser.role === 'user'` set from JWT fallback |
| T-0017-A17 | unit | `useOptimizedMatrix.ts:15` workaround removed -- uses `createAuthenticatedClientFromLocalStorage` | Wave A | Grep shows the shared helper |
| T-0017-A18 | unit | `authHeaders.ts:64-66` workaround removed | Wave A | Grep shows consolidated path |
| T-0017-A19 | component [H] | AC-SESSION-01 -- given localStorage has a valid session on mount, `useAuth.ts:419` `getSession` resolves and `currentUser !== null` within 5000ms of mount. File under test: `src/hooks/useAuth.ts:419`. Assertion: fake-timer advance + RTL `waitFor`; `currentUser` observable via sibling-file harness pattern (use `useAuth.terminal-logout.test.ts` sibling layout; `useAuth.test.ts` has known mock-hoisting bug). Mock `supabase.auth.getSession` to resolve immediately | Wave A | `waitFor(() => result.current.currentUser, { timeout: 5000 })` resolves; `isLoading === false` |
| T-0017-A20 | component [H] | AC-SESSION-02 -- given localStorage has NO session on mount, `useAuth.ts:582` `onAuthStateChange` settles and `currentUser === null` / `isLoading === false` within 5000ms. Sibling-file harness. Assertion: fake-timer advance + state observation | Wave A | `waitFor(() => !result.current.isLoading, { timeout: 5000 })`; `currentUser === null` |
| T-0017-A21 | component [F] | AC-SESSION-03 -- given localStorage has an access_token that 401s on first API touch, the ADR-0016 terminal-logout IIFE (`useAuth.ts:528-579`) dispatches and `currentUser === null` within 10000ms. Sibling-file harness. Assertion: mock bootstrapCsrfCookie returns `'terminal'`; fake-timer advance 10001ms | Wave A | `terminalLogoutTimerRef` fires; `location.href` redirect OR `currentUser === null` within 10s |
| T-0017-A22 | component [F] | AC-SESSION-04 -- boot-time wall-clock upper bound: if nothing resolves within `MAX_AUTH_INIT_TIME` (5000ms), `useAuth` surfaces `isLoading === false` with a safe-default `currentUser === null` (NOT stuck-loading). Distinct from B05 (B05 is login-submit timeout; A22 is boot-init timeout). File under test: `src/hooks/useAuth.ts:419` getSession + `:582` onAuthStateChange wrapped in wall-clock timer | Wave A | Mock both `getSession` and `onAuthStateChange` to never resolve; advance 5001ms; assert `isLoading === false`, no unhandled rejection |
| T-0017-A23 | component [H] | AC-LOGOUT-01 -- user-initiated signOut (`useAuth.ts:347`) completes observable logged-out state within 5000ms. Assertion: call returned `signOut()`; fake-timer advance; assert `currentUser === null` and localStorage auth keys cleared | Wave A | `waitFor(() => result.current.currentUser === null, { timeout: 5000 })`; localStorage key `sb-*` absent |
| T-0017-A24 | component [F] | AC-LOGOUT-02 -- when `supabase.auth.signOut()` rejects with 401, the fallback at `useAuth.ts:428` (silent cleanup path) still clears localStorage and sets `currentUser === null`. Assertion: mock signOut to reject; call user-initiated signOut; assert local state fully cleared despite server error (no throw propagates to UI) | Wave A | `currentUser === null`, localStorage cleared, no thrown error observable in component tree |
| T-0017-A25 | component [H] | AC-LOGOUT-03 -- after signOut, localStorage `sb-*` keys and `csrf-token` cookie absent; simulated reload (new `useAuth` mount on empty storage) yields `currentUser === null`, no rehydrate attempt. Assertion: two-phase test -- phase 1 logout, phase 2 fresh mount observes no session restore | Wave A | Phase 2: `getSession` returns null session; `currentUser === null`; no backend call attempted |
| T-0017-A26 | component [F] | AC-CSRF-03 -- given `bootstrapCsrfCookie()` returns outcome `'terminal'` (CSRF_COOKIE_MISSING), the IIFE at `useAuth.ts:553-558` dispatches terminal-logout within 2000ms observable window. File under test: `src/hooks/useAuth.bootstrap.ts:33` + `useAuth.ts:553-558`. Assertion: sibling-file harness; mock `bootstrapCsrfCookie` to resolve `'terminal'`; assert `terminalLogoutTimerRef.current` fires before 2001ms | Wave A | `location.href` redirect triggered OR `currentUser === null` within 2000ms |

### Wave B Test Table (T-0017-B01..B17)

| ID | Category | Description | Precondition | Expected |
|---|---|---|---|---|
| T-0017-B01 | unit | `TIMEOUTS.LOGIN_SUBMIT === 15000` | Wave B | config.ts export |
| T-0017-B02 | unit + component [F] | AC-SIGNUP-01 -- (1) `TIMEOUTS.SIGNUP_SUBMIT === 15000` constant exported from `config.ts`; AND (2) given `signUpWithPassword` never resolves, after 15s the signup branch sets `error` state to `TIMEOUT` copy and `loading === false`. Assertion type: constant check + fake-timer advance 15001ms on signup branch component harness | Wave B | config.ts export check; fake-timer advance 15001ms; error state = TIMEOUT copy; `loading === false` |
| T-0017-B03 | unit | `TIMEOUTS.PASSWORD_RESET_SUBMIT === 15000` | Wave B | config.ts export |
| T-0017-B04 | component | `handleSubmit` called twice within 10ms (simulated double-click) dispatches exactly ONE `signInWithPassword` call (AC-LOGIN-04) | Wave B | Mock called once |
| T-0017-B05 | component | Given `signInWithPassword` never resolves, after 15s `error` state is set to `TIMEOUT` copy and `loading === false` (AC-LOGIN-01, AC-LOGIN-02) | Wave B | Fake timer advance 15001ms; error displayed |
| T-0017-B06 | component | Within 200ms of submit click with valid form, EITHER button state is loading OR network request in flight OR validation error visible (AC-LOGIN-03) | Wave B | Playwright assertion within 200ms |
| T-0017-B07 | component | Given `signInWithPassword` throws `{ message: 'Invalid login credentials' }`, `error` state renders `INVALID_CREDENTIALS` copy (AC-LOGIN-06) | Wave B | Component test |
| T-0017-B08 | component | Given server returns 401 with non-existent account, error copy is IDENTICAL to T-0017-B07 (AC-LOGIN-07, no enumeration) | Wave B | Both branches render same copy |
| T-0017-B09 | unit | `PASSWORD_MIN_LENGTH === 8` exported from `src/lib/config.ts` | Wave B | Export check |
| T-0017-B10 | unit | `api/_lib/constants.ts` exports `PASSWORD_MIN_LENGTH === 8` | Wave B | Export check |
| T-0017-B11 | unit | `AuthScreen.tsx` signup password validation uses `PASSWORD_MIN_LENGTH` (no literal `6` or `8`) | Wave B | Source grep |
| T-0017-B12 | unit | `api/auth.ts` handleSignup password validation uses `PASSWORD_MIN_LENGTH` (no literal `8`) | Wave B | Source grep |
| T-0017-B13 | unit | `api/_lib/errorSerializer.ts` serializes errors with ONLY keys `{ error: { message, code }, timestamp, request_id }` -- no `stack`, no `details` containing SQL/paths | Wave B | Serializer output inspection |
| T-0017-B14 | component | Given fetch returns 500 with stack trace in body, client renders `GENERIC_5XX` copy and does NOT render stack (AC-ERR-02, AC-PRIV-02) | Wave B | Component test |
| T-0017-B15 | grep [F] | AC-LOGIN-05 + AC-ERR-01 wider catch audit -- scan `src/hooks/useAuth.ts`, `src/hooks/useAuth.bootstrap.ts`, `src/hooks/useAuth.terminalLogout.ts`, `src/components/auth/AuthScreen.tsx`, `api/auth.ts` for `catch\s*\(\s*(\w+|_\w*)?\s*\)\s*\{`. Every catch block must match allow-list: (a) rethrow, (b) `setError(...)` user-surface, (c) `logger.error(...)` structured log, OR (d) single-line `// NOTE:` doc-comment asserting intentional swallow. Forbidden: bare `{}` body, `console.log(e)` only, unused error variable with no log. Allow-list union covers both LOGIN-05 (silent-swallow) and ERR-01 (structured catch). One assertion covers both ACs. | Wave B | Zero unmatched catches across all 5 files; grep script output empty |
| T-0017-B16 | component [F] | AC-ERR-03 -- given fetch returns 429 with body `{ error: { code: 'RATE_LIMIT_EXCEEDED', message: '...' } }` (per `api/_lib/middleware/withRateLimit.ts:136-139`), client renders canonical `RATE_LIMITED` copy (`errorCopy.ts`) via `mapErrorToCopy`. Tracing: withRateLimit.ts 429 -> apiClient fetch wrapper -> `AuthScreen.handleSubmit` catch -> `setError(mapErrorToCopy(err))` -> error banner render. Notes: new wire -- `mapErrorToCopy` must recognize `err.code === 'RATE_LIMIT_EXCEEDED'`. File under test: `src/lib/auth/errorCopy.ts` (new) + `src/components/auth/AuthScreen.tsx` catch path | Wave B | Mock fetch returns 429 with `error.code='RATE_LIMIT_EXCEEDED'`; `getByText('Too many attempts -- please try again in')` matcher hits; no raw message leaked |
| T-0017-B17 | integration [F] | `PASSWORD_MIN_LENGTH` cross-boundary -- client (`AuthScreen.tsx:239-242`) and server (`api/auth.ts:61`) BOTH reject a 7-char password in the same request flow. Integration path: (1) enter 7-char password in signup, (2) client rejects with `PASSWORD_TOO_SHORT` copy before submit, (3) when client validation bypassed (direct POST to `api/auth?action=signup`), server returns 400 with same error code. Asserts the shared-constant contract holds across boundary | Wave B | Both code paths reject identically; error code parity; `api/_lib/constants.ts` + `src/lib/config.ts` import chain verified via T-B09/B10 |

### Wave C Test Table (T-0017-C01..C07)

| ID | Category | Description | Precondition | Expected |
|---|---|---|---|---|
| T-0017-C01 | unit | `cookies.ts` `setAuthCookies` CSRF maxAge remains 86400 (regression lock for AC-CSRF-01) | Wave C | Inspection |
| T-0017-C02 | unit | `api/auth.ts:~396` `handleGetUser` CSRF mint maxAge remains 86400 | Wave C | Inspection |
| T-0017-C03 | integration | `handleRefresh` at `api/auth.ts:~294` mints a NEW CSRF token on each refresh (bind-to-session) | Wave C | Pre/post CSRF tokens differ |
| T-0017-C04 | unit | `cookies.ts:125` has a comment citing same-origin SameSite=Lax rationale for mobile Safari 16+ | Wave C | Comment content grep |
| T-0017-C05 | integration | `/api/auth?action=reset-confirm` handler is wrapped in `withOriginValidation` | Wave C | Composition chain inspection |
| T-0017-C06 | component | ADR-0016 T-0016-011..014 (in-session 403 re-mint with single-attempt guard) still pass (regression) | Wave C | ADR-0016 tests |
| T-0017-C07 | playwright-mobile [H] | AC-MOBILE-01 runtime -- Playwright `mobile-chrome` (Pixel 5) + `mobile-safari` (iPhone 12) projects execute a login flow against the dev server; after successful login, `context.cookies()` returns a csrf-token cookie with `sameSite === 'Lax'` (NOT 'None', NOT 'Strict') and a Supabase session cookie readable on subsequent same-origin fetch. Distinct from C04 (C04 is comment-grep only). Config: `playwright.config.ts` mobile projects. Third-party cookie partitioning check: issue a same-origin `/api/auth?action=user` after login and assert 200 with cookies attached | Wave C | Both mobile browsers pass: cookie sameSite = 'Lax'; follow-up request returns 200 |

### Wave D Test Table (T-0017-D01..D22)

| ID | Category | Description | Precondition | Expected |
|---|---|---|---|---|
| T-0017-D01 | integration | `POST /api/auth?action=reset-request` with any email returns 200 + `RESET_SENT_GENERIC` copy (AC-RESET-01) | Wave D | Response body check |
| T-0017-D02 | integration | 3x `reset-request` for same email within 60s results in exactly 1 Resend API call, UI gets 200 each time | Wave D | Resend mock called once; UI 3x 200 |
| T-0017-D03 | integration + component [F] | AC-RESET-04 -- (1) `POST /api/auth?action=reset-confirm` with valid token + matching password writes new password via `supabase.auth.admin.updateUserById`; AND (2) on 200 response, the client renders `RESET_SUCCESS` copy visible to the user. Assertion type: API-side mock call + component render assertion | Wave D | `admin.updateUserById` called with correct userId + password; component renders `getByText(RESET_SUCCESS copy)` after submit |
| T-0017-D04 | integration | Same `reset-confirm` token replayed -> 409 + `RESET_REPLAYED` (AC-RESET-05) | Wave D | 409 response |
| T-0017-D05 | integration pair [F] | AC-RESET-06 -- (1) on successful `reset-confirm`, `supabase.auth.admin.signOut(user_id, { scope: 'others' })` is called once; AND (2) 2-cycle observability: a second integration assert simulates the other session's next protected fetch returning 401 → client refresh attempt → second 401 → terminal-logout dispatch observable (session fully invalidated, not merely asked). Assertion type: admin API mock call + 2-cycle token-invalidation integration pair | Wave D | `admin.signOut` called once with `{ scope: 'others' }`; other-session simulated fetch → 401 → refresh → 401 → `terminalLogout` dispatch observable |
| T-0017-D06 | integration | `POST /api/auth?action=confirm-email` with valid token redirects to `/` and sets auth cookies (AC-CONFIRM-01) | Wave D | verifyOtp called; Set-Cookie headers present |
| T-0017-D07 | integration | Invalid/expired confirm-email token renders generic invalid-link page; no 5xx (AC-CONFIRM-02) | Wave D | 200 with invalid-link body, NOT 500 |
| T-0017-D08 | integration | Signup for existing email returns same "check email" copy as new email (AC-SIGNUP-02, regression lock) | Wave D | Identical response body |
| T-0017-D09 | unit | `withEmailConfirmation` returns 403 `EMAIL_NOT_CONFIRMED` when user.email_confirmed_at is null | Wave D | Middleware unit test |
| T-0017-D10 | unit | `withEmailConfirmation` passes through when user.email_confirmed_at is not null | Wave D | Handler called |
| T-0017-D11 | integration | `api/ideas.ts`, `api/user.ts`, `api/admin.ts`, `api/ai.ts` compose `withEmailConfirmation` after `withAuth` | Wave D | Source grep / composition test |
| T-0017-D12 | integration | `/api/health`, `/api/auth?action=reset-request`, `/api/auth?action=confirm-email` do NOT compose `withEmailConfirmation` | Wave D | Source grep |
| T-0017-D13 | component | AuthScreen forgot-password branch calls `/api/auth?action=reset-request` (not `supabase.auth.resetPasswordForEmail`) | Wave D | Mock fetch assertion |
| T-0017-D14 | component | AuthScreen reset-password branch calls `/api/auth?action=reset-confirm` (not `updateRecoveryPassword` direct PUT) | Wave D | Mock fetch assertion |
| T-0017-D15 | integration | Invitation for email X accepted by user Y (Y.email !== X) returns 403 (AC-INVITE-03) | Wave D | Identity-match guard |
| T-0017-D16 | integration | Expired invitation returns 410 with generic invalid-or-expired copy (AC-INVITE-04) | Wave D | 410 response |
| T-0017-D17 | component [F] | AC-RESET-03 -- RTL render assertion: when `AuthScreen` renders with `mode === 'reset-password'`, the email input is absent from the DOM (regression guard for existing `AuthScreen.tsx:371,397` hide logic). Assertion: `render(<AuthScreen mode="reset-password" />)`; `queryByLabelText(/email/i)` returns null. Not Playwright -- pure RTL. File under test: `src/components/auth/AuthScreen.tsx` | Wave D | `queryByLabelText(/email/i) === null` AND `queryByRole('textbox', { name: /email/i }) === null` |
| T-0017-D18 | playwright-mobile [H] | AC-MOBILE-02 -- deep-link from Mail app: Playwright `mobile-chrome` + `mobile-safari` open `https://<dev-origin>/confirm?token=<valid>` via `page.goto()` simulating cold Safari/Chrome tab (no referrer, cold storage). After `/api/auth?action=confirm-email` resolves, page redirects to `/` and user is signed in. Three deep-link variants: confirmation, invitation (`/accept-invite#access_token=...` per `InvitationAcceptPage.tsx:51`), reset (`/reset-password#access_token=...`). Each variant runs on both mobile projects | Wave D | All three variants land on expected destination within 10s; signed-in state observable via dashboard element |
| T-0017-D19 | component [F] | AC-LOGIN-08 -- given `withEmailConfirmation` middleware (new, Wave D) returns 403 `{ error: { code: 'EMAIL_NOT_CONFIRMED' } }` on login attempt, client renders canonical `EMAIL_UNCONFIRMED` copy via `mapErrorToCopy`. File under test: `src/components/auth/AuthScreen.tsx:200` branch + `errorCopy.ts`. Notes: new wire -- middleware is new Wave D code, contract-tested here. Asserts the code-to-copy mapping specifically recognizes `'EMAIL_NOT_CONFIRMED'` | Wave D | Mock fetch returns 403 with `error.code='EMAIL_NOT_CONFIRMED'`; `getByText('Please confirm your email address before signing in.')` matcher hits |
| T-0017-D20 | playwright-desktop [H] | AC-INVITE-01 -- signed-out end-to-end invite flow within 30s wall-clock: (1) Playwright creates invitation via test API, (2) navigates to invite URL while signed-out, (3) `InvitationAcceptPage.tsx:51` parses token, (4) user completes signup form, (5) `api/invitations/accept.ts` accepts, (6) user lands on project page as member. Chromium project only; mobile variant covered by D18 | Wave D | Full flow completes within 30000ms; final URL is `/projects/{project_id}`; user role on project === 'member' |
| T-0017-D21 | playwright-desktop [H] | AC-INVITE-02 -- signed-in auto-accept within 10s: (1) user already signed in as matching email, (2) clicks invite link, (3) `InvitationAcceptPage.tsx:94` `acceptInvite` fires automatically (no form), (4) lands on project within 10s | Wave D | No signup form rendered; final URL `/projects/{project_id}` within 10000ms |
| T-0017-D22 | contract [F] | `withEmailConfirmation` bypass-list contract -- the middleware MUST NOT block requests to these endpoints regardless of `email_confirmed_at` state: `/api/auth?action=session` (login itself), `/api/auth?action=signup`, `/api/auth?action=confirm-email`, `/api/auth?action=reset-request`, `/api/auth?action=reset-confirm`, `/api/health`. Negative-case contract test: each endpoint reachable with unconfirmed user's token OR anonymous. File under test: new `api/_lib/middleware/withEmailConfirmation.ts`. Notes: new wire -- middleware doesn't exist yet; test is contract spec for Colby | Wave D | 6 endpoints return non-403 response when called with unconfirmed token; 4 state-changing endpoints (`ideas`, `user`, `admin`, `ai`) return 403 under same conditions |

### Wave E Test Table (T-0017-E01..E19)

| ID | Category | Description | Precondition | Expected |
|---|---|---|---|---|
| T-0017-E01 | integration | 6th login attempt from same IP within 15min receives 429 with `Retry-After` header and `error.code === 'RATE_LIMIT_EXCEEDED'` (AC-RL-01, AC-RL-03) | Wave E | Production config simulation |
| T-0017-E02 | integration | Signup endpoint returns 429 on 6th attempt within 15min (AC-RL-02) | Wave E | Same pattern, signup |
| T-0017-E03 | integration | Refresh endpoint returns 429 on 6th attempt within 15min | Wave E | Same pattern, refresh |
| T-0017-E04 | integration | Reset-request endpoint returns 429 on 6th attempt within 15min | Wave E | Same pattern, reset-request |
| T-0017-E05 | unit | `auditLogger.logAuthEvent` writes row with fields: `event_type, outcome, ip, user_agent, timestamp, email_hash, session_ref_hash, metadata` | Wave E | Schema assertion |
| T-0017-E06 | unit | `auditLogger.logAuthEvent` NEVER writes: raw email, password, access_token, refresh_token, csrf_token, recovery_token (L001 compliance, AC-AUDIT-02) | Wave E | Test inputs with all sensitive values; assert none appear in persisted row |
| T-0017-E07 | integration | Successful login writes audit row with `event_type = 'login_success'`, `outcome = 'success'` | Wave E | DB query after login |
| T-0017-E08 | integration | Failed login writes audit row with `event_type = 'login_failure'`, `outcome = 'failure'` | Wave E | DB query after failed login |
| T-0017-E09 | integration | Rate-limit breach writes audit row with `event_type = 'rate_limit_breach'` (AC-AUDIT-01, AC-P2-04 observability hook) | Wave E | 6th-attempt triggers write |
| T-0017-E10 | integration | Auditlog write failure does NOT block or delay user auth action (AC-AUDIT-03) | Wave E | Fire-and-forget: test with a failing mock writer -> login still returns 200 |
| T-0017-E11 | integration | `admin_audit_log` RLS restricts SELECT to `super_admin` (AC-AUDIT-04) | Wave E | Migration + RLS test |
| T-0017-E12 | integration | `GET /api/health` returns 200 within 3s with `{ status, timestamp, supabase }` shape and NO user IDs / tokens / env vars (AC-HEALTH-01) | Wave E | Response body + timing assertion |
| T-0017-E13 | integration | Migration `20260418010000_auth_hardening_phase2.sql` adds `retention_policy_days` column to `admin_audit_log` with default 90 | Wave E | DB schema query |
| T-0017-E14 | integration | Server-side log on any auth path contains NO: raw email, password, access_token, refresh_token, csrf_token (AC-PRIV-01) | Wave E | Log output inspection |
| T-0017-E15 | contract [F] | AC-AUDIT-01 (4 of 8) -- `auditLogger.logAuthEvent('signup_submitted', outcome, req, metadata)` produces `admin_audit_log` row with `event_type === 'signup_submitted'`, payload shape `{ event_type, outcome, ip, user_agent, timestamp, email_hash, session_ref_hash, metadata }`, NO raw email / password / tokens. Caller site: `handleSignup` in `api/auth.ts`. Notes: new wire -- `auditLogger` util does not exist yet; test is contract spec. L001 negative assertion included | Wave E | Row written with event_type matching; sensitive fields absent per E06 pattern |
| T-0017-E16 | contract [F] | AC-AUDIT-01 (5 of 8) -- `auditLogger.logAuthEvent('password_reset_requested', outcome, req, metadata)` produces row with correct event_type + L001-safe payload. Caller site: `handleResetRequest` in `api/auth.ts`. Additionally: `resendService.sendResetEmail` log-scrub hygiene -- spy the logger while sending to a marker email `canary+<uuid>@example.test`; assert the marker string never appears in any `logger.*` output across the full request lifecycle (AC-PRIV-01 hygiene). One T-ID covers both the audit row write AND the sendResetEmail log-scrub because they fire in the same handler | Wave E | Row written; marker email absent from logger spy output |
| T-0017-E17 | contract [F] | AC-AUDIT-01 (6 of 8) -- `auditLogger.logAuthEvent('password_changed', outcome, req, metadata)` produces row with correct event_type + L001-safe payload. Caller site: `handleResetConfirm` after successful `admin.updateUserById`. Must NOT include the new password or recovery token in any field | Wave E | Row written; sensitive fields absent |
| T-0017-E18 | contract [F] | AC-AUDIT-01 (7 of 8) -- `auditLogger.logAuthEvent('logout', outcome, req, metadata)` produces row with correct event_type + L001-safe payload. Caller site: `handleLogout` in `api/auth.ts` (user-initiated signOut path). session_ref_hash present (first 8 chars SHA-256 of access_token), raw token absent | Wave E | Row written; session_ref_hash format verified; raw token absent |
| T-0017-E19 | contract [F] | AC-AUDIT-01 (8 of 8) -- `auditLogger.logAuthEvent('terminal_logout', outcome, req, metadata)` produces row with correct event_type + L001-safe payload. Caller site: terminal-logout IIFE at `useAuth.ts:553-558` (client-initiated) fires a beacon to a new `api/auth?action=log-terminal` endpoint OR terminal dispatch from server on `withCSRF` CSRF_COOKIE_MISSING at `withCSRF.ts:61`. `metadata.reason === 'csrf_cookie_missing'` preserved | Wave E | Row written; metadata.reason field populated; no secrets in payload |

### Wave F Test Table (T-0017-F01..F09)

| ID | Category | Description | Precondition | Expected |
|---|---|---|---|---|
| T-0017-F01 | build | `scripts/verify-auth-singleton.mjs` exits 0 when prod bundle has exactly 2 `createClient(` matches | Wave F | Script exit code |
| T-0017-F02 | build | Same script exits 1 when prod bundle has a 3rd `createClient(` (guard against regression) | Wave F | Script exit code |
| T-0017-F03 | build | Prod bundle does NOT contain string `useSecureAuth` | Wave F | Script grep |
| T-0017-F04 | build | Prod bundle does NOT contain string `useOptimizedAuth` | Wave F | Script grep |
| T-0017-F05 | build | Prod bundle does NOT contain string `SecureAuthContext` | Wave F | Script grep |
| T-0017-F06 | build | Prod bundle does NOT contain string `VITE_FEATURE_HTTPONLY_AUTH` | Wave F | Script grep |
| T-0017-F07 | e2e | Chrome-MCP flow: signup -> confirm -> login -> dashboard -> logout completes with 0 console errors | Wave F | Full flow passes |
| T-0017-F08 | e2e | Vercel production logs for the test window show 0 auth-endpoint 5xx responses | Wave F | vercel logs inspection |
| T-0017-F09 | e2e | AC-LOGIN-09 regression: after login, first dashboard render shows correct user role (admin or user), no flash | Wave F | Playwright screenshot diff |

### Failure / happy path ratio

Failure-path tests (original): T-0017-A01..A10 (deletion/absence), B05/B07/B08/B13/B14, C06, D04/D07/D09/D15/D16, E02..E10, E14, F02. = 32 failure tests.
Failure-path tests (revision +15): A21/A22/A24/A26 (Wave A SESSION/LOGOUT/CSRF failure bounds), B15/B16/B17 (wider catch audit, 429 copy, password cross-boundary), D17/D19/D22 (email-hidden regression, EMAIL_UNCONFIRMED copy, bypass-list contract), E15/E16/E17/E18/E19 (5 audit event contract tests with L001 negative assertions). = **47 failure tests**.
Happy-path tests (original): the balance = ~26.
Happy-path tests (revision +8): A19/A20/A23/A25 (bounded happy flows), C07 (mobile runtime), D18/D20/D21 (mobile deep-link + two invite happy flows). = **34 happy tests**.
Ratio: **47/34 ≈ 58/42**. Remaining 19 rows are structural regression/absence locks (A01-A10 deletion grep, A14-A18, F01/F03-F06 bundle grep). Consistent with ADR-0016 principle that auth bugs are regression-class. Roz's taxonomy (Section 3g of last-qa-report.md) classifies A01-A10 as structural; the ADR retains its behavioural-vs-all F/H bucket for continuity with ADR-0016 style.

### T-ID Reverse Map (100 rows)

Supersedes Roz's 77-row table (Phase 3a review Section 2). 0 AMBIGUOUS after revision.

| T-ID | Wave | AC-IDs Traced | Verdict |
|---|---|---|---|
| T-0017-A01 | A | — (H3 deletion regression lock) | TRACED (support) |
| T-0017-A02 | A | — (Q7 flag deletion) | TRACED (support) |
| T-0017-A03 | A | AC-LOGIN-03, AC-LOGIN-05 | TRACED |
| T-0017-A04 | A | — (H3 deletion) | TRACED (support) |
| T-0017-A05 | A | — (H3 deletion) | TRACED (support) |
| T-0017-A06 | A | — (H3 deletion) | TRACED (support) |
| T-0017-A07 | A | AC-SESSION-01/02 (client consolidation root cause) | TRACED |
| T-0017-A08 | A | AC-LOGIN-05, AC-ERR-01 | TRACED |
| T-0017-A09 | A | AC-LOGIN-03 | TRACED |
| T-0017-A10 | A | AC-LOGIN-03 | TRACED |
| T-0017-A11 | A | AC-LOGIN-03 | TRACED |
| T-0017-A12 | A | AC-LOGIN-04 (secondary single-flight check; primary is B04) | TRACED |
| T-0017-A13 | A | AC-LOGIN-04 (secondary single-flight check; primary is B04) | TRACED |
| T-0017-A14 | A | — (ADR-0016 T-0016-002 carry-over) | TRACED (support) |
| T-0017-A15 | A | — (ADR-0016 regression lock) | TRACED (support) |
| T-0017-A16 | A | AC-LOGIN-09 | TRACED |
| T-0017-A17 | A | — (scattered-workaround cleanup) | TRACED (support) |
| T-0017-A18 | A | — (scattered-workaround cleanup) | TRACED (support) |
| T-0017-A19 | A | AC-SESSION-01 | TRACED |
| T-0017-A20 | A | AC-SESSION-02 | TRACED |
| T-0017-A21 | A | AC-SESSION-03 | TRACED |
| T-0017-A22 | A | AC-SESSION-04 (boot-init; B05 covers login-submit) | TRACED |
| T-0017-A23 | A | AC-LOGOUT-01 | TRACED |
| T-0017-A24 | A | AC-LOGOUT-02 | TRACED |
| T-0017-A25 | A | AC-LOGOUT-03 | TRACED |
| T-0017-A26 | A | AC-CSRF-03 | TRACED |
| T-0017-B01 | B | AC-LOGIN-01, AC-LOGIN-02, AC-SESSION-04 | TRACED |
| T-0017-B02 | B | AC-SIGNUP-01 | TRACED |
| T-0017-B03 | B | AC-RESET-04 | TRACED |
| T-0017-B04 | B | AC-LOGIN-04 | TRACED |
| T-0017-B05 | B | AC-LOGIN-01, AC-LOGIN-02 | TRACED |
| T-0017-B06 | B | AC-LOGIN-03 | TRACED |
| T-0017-B07 | B | AC-LOGIN-06 | TRACED |
| T-0017-B08 | B | AC-LOGIN-07 | TRACED |
| T-0017-B09 | B | AC-SIGNUP-03 | TRACED |
| T-0017-B10 | B | AC-SIGNUP-03 | TRACED |
| T-0017-B11 | B | AC-SIGNUP-03 | TRACED |
| T-0017-B12 | B | AC-SIGNUP-03 | TRACED |
| T-0017-B13 | B | AC-PRIV-02 | TRACED |
| T-0017-B14 | B | AC-ERR-02, AC-PRIV-02 | TRACED |
| T-0017-B15 | B | AC-LOGIN-05, AC-ERR-01 (wider audit; union allow-list) | TRACED |
| T-0017-B16 | B | AC-ERR-03 | TRACED |
| T-0017-B17 | B | AC-SIGNUP-03 (cross-boundary integration) | TRACED |
| T-0017-C01 | C | AC-CSRF-01 | TRACED |
| T-0017-C02 | C | AC-CSRF-01 | TRACED |
| T-0017-C03 | C | AC-CSRF-02 | TRACED |
| T-0017-C04 | C | AC-MOBILE-01 (comment grep; runtime is C07) | TRACED |
| T-0017-C05 | C | — (defence-in-depth for reset-confirm) | TRACED (support) |
| T-0017-C06 | C | AC-CSRF-02 | TRACED |
| T-0017-C07 | C | AC-MOBILE-01 (runtime) | TRACED |
| T-0017-D01 | D | AC-RESET-01 | TRACED |
| T-0017-D02 | D | AC-RESET-02 | TRACED |
| T-0017-D03 | D | AC-RESET-04 (API + extended copy assertion) | TRACED |
| T-0017-D04 | D | AC-RESET-05 | TRACED |
| T-0017-D05 | D | AC-RESET-06 (API + extended 2-cycle observability) | TRACED |
| T-0017-D06 | D | AC-CONFIRM-01 | TRACED |
| T-0017-D07 | D | AC-CONFIRM-02 | TRACED |
| T-0017-D08 | D | AC-SIGNUP-02 | TRACED |
| T-0017-D09 | D | AC-LOGIN-08 (middleware 403; client copy is D19) | TRACED |
| T-0017-D10 | D | — (middleware pass-through) | TRACED (support) |
| T-0017-D11 | D | — (middleware composition grep) | TRACED (support) |
| T-0017-D12 | D | — (middleware composition exclusion; see also D22 bypass-list) | TRACED (support) |
| T-0017-D13 | D | AC-RESET-01 (wiring) | TRACED |
| T-0017-D14 | D | AC-RESET-04 (wiring + extended RESET_SUCCESS copy) | TRACED |
| T-0017-D15 | D | AC-INVITE-03 | TRACED |
| T-0017-D16 | D | AC-INVITE-04 | TRACED |
| T-0017-D17 | D | AC-RESET-03 | TRACED |
| T-0017-D18 | D | AC-MOBILE-02 | TRACED |
| T-0017-D19 | D | AC-LOGIN-08 (client copy) | TRACED |
| T-0017-D20 | D | AC-INVITE-01 | TRACED |
| T-0017-D21 | D | AC-INVITE-02 | TRACED |
| T-0017-D22 | D | — (withEmailConfirmation bypass-list contract; negative test for D11/D12 composition) | TRACED (support) |
| T-0017-E01 | E | AC-RL-01, AC-RL-03 | TRACED |
| T-0017-E02 | E | AC-RL-02 | TRACED |
| T-0017-E03 | E | AC-RL-02 | TRACED |
| T-0017-E04 | E | AC-RL-02 | TRACED |
| T-0017-E05 | E | AC-AUDIT-02 | TRACED |
| T-0017-E06 | E | AC-AUDIT-02, AC-PRIV-01 (L001 gate) | TRACED |
| T-0017-E07 | E | AC-AUDIT-01 (1 of 8: login_success) | TRACED |
| T-0017-E08 | E | AC-AUDIT-01 (2 of 8: login_failure) | TRACED |
| T-0017-E09 | E | AC-AUDIT-01 (3 of 8: rate_limit_breach), AC-P2-04 | TRACED |
| T-0017-E10 | E | AC-AUDIT-03 | TRACED |
| T-0017-E11 | E | AC-AUDIT-04 | TRACED |
| T-0017-E12 | E | AC-HEALTH-01 | TRACED |
| T-0017-E13 | E | — (migration schema regression lock) | TRACED (support) |
| T-0017-E14 | E | AC-PRIV-01 | TRACED |
| T-0017-E15 | E | AC-AUDIT-01 (4 of 8: signup_submitted) | TRACED |
| T-0017-E16 | E | AC-AUDIT-01 (5 of 8: password_reset_requested), AC-PRIV-01 (resendService log-scrub) | TRACED |
| T-0017-E17 | E | AC-AUDIT-01 (6 of 8: password_changed) | TRACED |
| T-0017-E18 | E | AC-AUDIT-01 (7 of 8: logout) | TRACED |
| T-0017-E19 | E | AC-AUDIT-01 (8 of 8: terminal_logout) | TRACED |
| T-0017-F01 | F | — (H1 prod-bundle verification) | TRACED (support) |
| T-0017-F02 | F | — (H1 regression lock) | TRACED (support) |
| T-0017-F03 | F | — (H3 regression lock) | TRACED (support) |
| T-0017-F04 | F | — (H3 regression lock) | TRACED (support) |
| T-0017-F05 | F | — (H3 regression lock) | TRACED (support) |
| T-0017-F06 | F | — (Q7 regression lock) | TRACED (support) |
| T-0017-F07 | F | AC-LOGIN-01, AC-SESSION-01, AC-LOGOUT-01 (desktop e2e) | TRACED |
| T-0017-F08 | F | AC-PRIV-02 | TRACED |
| T-0017-F09 | F | AC-LOGIN-09 | TRACED |

**Totals: 100 TRACED (with 22 structural regression-lock support rows). 0 AMBIGUOUS. 0 ORPHAN.**

## UX Coverage

| Surface | ADR Step |
|---|---|
| AuthScreen login/signup/forgot-password/reset-password | Wave A (cleanup), Wave B (timeouts + copy), Wave D (reset flow) |
| Email-confirmation landing | Wave D |
| Rate-limit 429 toast copy | Wave B (errorCopy.ts) |
| 5xx generic copy | Wave B |
| Terminal-logout toast (ADR-0016) | regression lock Wave C |

No UX doc exists in `docs/ux/` for auth-hardening. All surfaces introduced or modified are inline with `AuthScreen.tsx` existing patterns; no new visual components.

## UI Specification

| Step | Elements | Sort | Color | States | Nav | Layout |
|---|---|---|---|---|---|---|
| Wave A | `AuthScreen` submit button (existing) | n/a | existing `bg-info-600` per design-tokens | idle / loading / error (driven from React state only) | form submit -> `supabase.auth.signInWithPassword` -> `onAuthSuccess(user)` via `AuthScreen` callback | existing `auth-screen` container, `card-clean` form wrapper; no layout change |
| Wave B | Error banner (existing at line 322); new timeout copy | n/a | existing `bg-error-50` / `text-error-700` | error banner present when `error !== null`, success banner when `success !== null`, idle otherwise | inline within form card | existing `card-clean p-8` layout |
| Wave C | No UI change | n/a | n/a | n/a | n/a | n/a |
| Wave D | Email-confirmation landing page (new route `/confirm`) | n/a | existing design tokens | loading / success (redirect) / invalid-or-expired | Router entry on `/confirm?token=...` -> `/api/auth?action=confirm-email` -> redirect to `/` on success, render invalid screen on failure | Full-page centered card matching `AuthScreen` pattern |
| Wave E | No UI change; server-only | n/a | n/a | n/a | n/a | n/a |
| Wave F | No UI change; verification only | n/a | n/a | n/a | n/a | n/a |

## Wiring Coverage

| Producer | Shape | Consumer | Step |
|---|---|---|---|
| `supabase.auth.signInWithPassword` (SDK) | `{ data: { user, session }, error }` | `AuthScreen.handleSubmit:223` | Wave A |
| `TIMEOUTS.LOGIN_SUBMIT` | number (15000) | `withTimeout(signInWithPassword(...), TIMEOUTS.LOGIN_SUBMIT)` in `AuthScreen.handleSubmit` | Wave B |
| `PASSWORD_MIN_LENGTH` (frontend) | number (8) | `AuthScreen.tsx:487` onValidate | Wave B |
| `PASSWORD_MIN_LENGTH` (backend) | number (8) | `api/auth.ts:61` signup validation | Wave B |
| `errorCopy.mapErrorToCopy` | `(err) => string` | `AuthScreen.setError(mapErrorToCopy(err))` | Wave B |
| `withEmailConfirmation` middleware | `MiddlewareWrapper` | `api/ideas.ts`, `api/user.ts`, `api/admin.ts`, `api/ai.ts` compose chains | Wave D |
| `/api/auth?action=reset-request` | POST body `{ email }` → 200 `{ success }` | `AuthScreen` forgot-password submit | Wave D |
| `/api/auth?action=reset-confirm` | POST body `{ recovery_token, new_password }` → 200 `{ success }` | `AuthScreen` reset-password submit | Wave D |
| `/api/auth?action=confirm-email` | GET `?token=...` → 302 redirect OR 200 invalid-page | Email-confirmation landing route | Wave D |
| `auditLogger.logAuthEvent` | `(eventType, outcome, req, metadata?) => void` | `handleLogin`, `handleSignup`, `handleLogout`, `handleRefresh`, reset handlers, rate-limit breach | Wave E |
| `admin_audit_log` row | `{ event_type, outcome, ip, user_agent, timestamp, email_hash, session_ref_hash, metadata, retention_policy_days }` | super_admin query UI (post-launch) | Wave E |
| `GET /api/health` | `{ status, timestamp, supabase }` | uptime probes (external) | Wave E |
| `scripts/verify-auth-singleton.mjs` | exit 0/1 | CI gate | Wave F |

Every producer has a consumer in the same or an earlier wave. No orphan producers.

## Notes for Colby

### Live-user migration risk

Ship legacy `supabase.auth.signInWithPassword` path (not httpOnly-cookie).
Post-Wave A, do NOT delete `api/_lib/middleware/cookies.ts setAuthCookies` or
the httpOnly-cookie APIs from `api/auth.ts` -- they're still used by AI
endpoints for csrf-token cookie minting (ADR-0014, ADR-0016). Only delete:
- `src/hooks/useSecureAuth.ts`
- `src/hooks/useOptimizedAuth.ts`
- `src/contexts/SecureAuthContext.tsx`
- `src/components/auth/AuthScreen.tsx`'s `secureAuth` branch (lines 209-216)
- `VITE_FEATURE_HTTPONLY_AUTH` references

The `apiClient.post('/api/auth?action=session')` path becomes dead code but
is still live for other consumers if any -- verify via Grep in Wave A
scratch pass. If zero consumers after `useSecureAuth` deletion, delete
`src/lib/apiClient.ts`'s session call too. If non-zero, leave in place and
flag for post-launch cleanup.

### PASSWORD_MIN_LENGTH cross-boundary import

`src/lib/config.ts` can't be imported by `api/*.ts` files (Vite
`import.meta.env` breaks Node ESM). Create `api/_lib/constants.ts` that
hardcodes `export const PASSWORD_MIN_LENGTH = 8` and is imported by
`src/lib/config.ts` (re-export) on the frontend side. Both files point to
the same value; changing one requires changing the other. Add a code
comment in both places citing this ADR and a T-0017-B09/B10 cross-check.

### `crypto.getRandomValues` polyfill

In `src/test/setup.ts`, add:
```ts
if (!globalThis.crypto?.getRandomValues) {
  const { webcrypto } = await import('node:crypto')
  globalThis.crypto = webcrypto as Crypto
}
```
Place it with the existing `randomUUID` stub. Feeds T-0017-A14, A15.

### ADR-0016 IIFE preservation

The terminal-logout IIFE at `useAuth.ts:528-579` is Poirot-hardened; do not
refactor. The dynamic `await import('./useAuth')` + `useAuthMod.bootstrapCsrfCookie()`
pattern at line 553 is intentional for test mocking -- preserve verbatim.

### AuthScreen handleSubmit Wave B wrap pattern

```ts
const { data, error } = await withTimeout(
  supabase.auth.signInWithPassword({ email, password }),
  TIMEOUTS.LOGIN_SUBMIT,
  'LOGIN_SUBMIT timeout'
)
```
On timeout, `withTimeout` rejects with `'LOGIN_SUBMIT timeout'` -- catch
block maps it via `errorCopy.mapErrorToCopy`. No change to the existing
structure, just wrap each of the 4 SDK calls.

### Single-flight guard

`if (loading) return` at `AuthScreen.tsx:162` already exists. T-0017-B04
regression-locks it. Do NOT add ref-based guard -- React state is sufficient.

### Rate limiter composition order

`compose(withStrictRateLimit(), withCSRF(), handleLogin)` -- CSRF inside
rate limit so rate limit counts CSRF failures too. Confirm order by reading
existing `api/auth.ts:984` composition before modifying.

### Audit log schema extension vs new table

Migration 001 defines `admin_audit_log` with `event_type VARCHAR` (no CHECK).
Extend in place: new event_type values are data-only, no schema change
needed. The `retention_policy_days` column is the only DDL change in the
Wave E migration.

### Resend send-throttle table

`password_reset_throttle(email_hash BYTEA PRIMARY KEY, last_sent_at TIMESTAMPTZ)`.
Upsert pattern:
```sql
INSERT INTO password_reset_throttle(email_hash, last_sent_at)
VALUES ($1, now())
ON CONFLICT (email_hash) DO UPDATE SET last_sent_at = now()
WHERE password_reset_throttle.last_sent_at < now() - interval '60 seconds'
RETURNING email_hash;
```
If RETURNING is empty, the row was NOT updated (throttled) -> don't send email.

### Step sizing verification

| Wave | Files touched | S1 demoable | S2 context-bounded | S3 verifiable | S4 revert-cheap | S5 small enough |
|---|---|---|---|---|---|---|
| A | ~12 | "After Wave A, login has one codepath and dead click is impossible" | 12 files, all auth domain | Yes -- unit + component | Single revert | ~380 LOC removed, ~50 added |
| B | 6 | "After Wave B, login hang is impossible" | 6 files | Yes -- fake-timer + mock fetch | Single revert | Small |
| C | 2 | "After Wave C, CSRF posture regression-locked" | 2 files | Yes -- existing ADR-0016 tests | Single revert | Tiny |
| D | 10 | "After Wave D, reset + confirm + invite flows closed" | 10 files | Yes -- integration + component | Single revert + migration rollback | Medium |
| E | 6 | "After Wave E, all auth events audited + all pre-auth endpoints rate-limited + /api/health live" | 6 files | Yes -- integration | Single revert + migration rollback | Medium |
| F | 2 | "After Wave F, prod verified via Chrome-MCP" | 2 files | CI-only | n/a | Tiny |

Wave A exceeds 10 files (~12). Justification: deletions are single-file operations and the consolidation of 3 hooks into 1 requires touching each consumer. The 12-file count is front-loaded with `rm`, not complex edits.

### Migration + Rollback

**Wave D migration (`20260418000000_auth_hardening_phase1.sql`):**
- Creates `password_reset_throttle`.
- Rollback: `DROP TABLE password_reset_throttle;`

**Wave E migration (`20260418010000_auth_hardening_phase2.sql`):**
- Adds `retention_policy_days INT DEFAULT 90` to `admin_audit_log`.
- Creates `cleanup_audit_log()` function; optional pg_cron schedule.
- Rollback: `ALTER TABLE admin_audit_log DROP COLUMN retention_policy_days; DROP FUNCTION IF EXISTS cleanup_audit_log();`

Rollback window: launch -1 week. Post-launch, rollback requires communicating
to any users with pending reset tokens.

### Phase 3a revision gotchas (new — 2026-04-17)

- Playwright mobile-emulation config: mobile runtime tests (C07, D18) use the existing `mobile-chrome` (Pixel 5) and `mobile-safari` (iPhone 12) projects declared in `playwright.config.ts` / `playwright.e2e.config.ts`. Do NOT introduce new project files; reuse the declared projects.
- `auditLogger` event_type registry: all 8 event_type strings (`login_success`, `login_failure`, `signup_submitted`, `password_reset_requested`, `password_changed`, `logout`, `terminal_logout`, `rate_limit_breach`) must be exported as a `const AUTH_EVENT_TYPES = [...] as const` + `type AuthEventType = typeof AUTH_EVENT_TYPES[number]` from `api/_lib/services/auditLogger.ts`. E15-E19 contract tests assert this registry is exhaustive.
- `withEmailConfirmation` bypass list: hard-coded allow-list in the middleware itself (NOT a config). 6 endpoints pass through regardless of `email_confirmed_at`: `/api/auth?action=session`, `/api/auth?action=signup`, `/api/auth?action=confirm-email`, `/api/auth?action=reset-request`, `/api/auth?action=reset-confirm`, `/api/health`. T-0017-D22 is the contract test; Colby must implement bypass at middleware entry, not by omitting composition (composition-omission is D12's check; bypass is a defensive second layer).

## DoD -- Definition of Done

| Gate | Verification | Status |
|---|---|---|
| G1 | Full `npm run lint` + `npm run type-check` + `npm run test:run` green across all 6 waves' tests (T-0017-A01..F09) | Required |
| G2 | `scripts/verify-auth-singleton.mjs` exits 0 on the production bundle -- exactly 2 `createClient(` matches, 0 matches for `useSecureAuth` / `useOptimizedAuth` / `SecureAuthContext` / `VITE_FEATURE_HTTPONLY_AUTH` | Required |
| G3 | Chrome-MCP E2E on Vercel prod: signup → confirm → login → dashboard (correct role first render) → logout → refresh-stays-signed-out. Zero console errors. (T-0017-F07, F09) | Required |
| G4 | ADR-0016 test suite (T-0016-001..065) still green after all 6 waves land (regression) | Required |
| G5 | `vercel logs` pull for the Chrome-MCP test window shows 0 auth-endpoint 5xx (T-0017-F08) | Required |
| G6 | All 25 P0 ACs + 19 P1 ACs have at least one test ID mapping in Test Spec tables | Required |
| G7 | Phase 3a revision: 48 ACs, 100 T-IDs, ~58/42 F/H ratio (47 failure / 34 happy / 19 structural). Reverse map shows 0 AMBIGUOUS after A12/A13/C04/D09 clarifications. | Required |

| DoR # | Requirement | Covered By |
|---|---|---|
| R1 | F1 + F2 named symptoms | Wave A (F2), Wave B (F1) |
| R2 | 48 ACs | AC coverage map, Test Spec tables |
| R3 | ADR-0014 + ADR-0016 extend | Regression locks Wave A (ADR-0016 IIFE), Wave C (24h CSRF freeze) |
| R4 | 6 createClient sites | Wave A collapses frontend to 1+1; backend unchanged |
| R5 | 3 parallel hooks | Wave A deletes 2, keeps 1 |
| R6 | signInWithPassword zero direct callsites (legacy was indirect) | Wave A restores as sole login path |
| R7 | TIMEOUTS missing submit constants | Wave B adds 3 |
| R8 | Silent swallow sites | Wave A fixes each |
| R9 | Rate limit partial | Wave E extends to all 4 pre-auth endpoints |
| R10 | Audit log underpopulated | Wave E extends with 8 event types |
| R11 | Resend configured | Wave D uses Resend for reset emails |
| R12 | Flag branches | Wave A removes flag + branches |
| R13 | T-0016-002 red | Wave A polyfill fixes |
| R14 | ADR-0016 untracked | Eva: handoff to Ellis schedules commit alongside this ADR |

No silent drops. All 14 DoR items map to a wave and at least one test ID.

## Open Questions for Cal Follow-ups

Q1-Q7 resolved in Decision section. H5 and H6 confirmed/refuted with code evidence. Post-Phase-3a-revision questions (≤3, per revision protocol):

1. **E19 terminal_logout caller site.** The ADR-0016 IIFE dispatches terminal-logout client-side at `useAuth.ts:553-558`. For the audit row to land, either (a) the client beacons a new `api/auth?action=log-terminal` endpoint before `location.href` redirect, or (b) the server writes the row when `withCSRF.ts:61` detects `CSRF_COOKIE_MISSING`. Option (b) is cheaper but misses client-initiated terminal cases where the server never sees a request. Colby to pick one in Wave E kickoff.
2. **E13 integration test harness.** Migration-regression test (`20260418010000_auth_hardening_phase2.sql` adds `retention_policy_days`) requires a real-migrated-DB. Existing auth tests are mock-based. Choose: Supabase local / testcontainers / fixture SQL dump. Colby decides in Wave E kickoff.
3. **D22 + D12 overlap acceptability.** D22 is a defensive negative contract test (middleware itself bypasses 6 endpoints) and D12 is a composition-grep absence test (endpoints don't include the middleware in their compose chain). These overlap intentionally. If Colby's natural implementation satisfies D12 without in-middleware bypass logic, D22 can be marked N/A and the AC-LOGIN-08 coverage relies on D09 + D19 alone — but this is a policy call, not a code call, and belongs on Cal's desk.

## References

- **Product spec:** `docs/specs/auth-hardening.md` (48 ACs)
- **ADR-0014:** `docs/architecture/ADR-0014-ai-service-auth-hardening.md`
- **ADR-0016:** `docs/architecture/ADR-0016-csrf-regression-fix.md`
- **Pipeline state:** `docs/pipeline/pipeline-state.md`
- **Context brief:** `docs/pipeline/context-brief.md`
- **Research brief / blast radius:** scout findings embedded inline
- **Auth hook:** `src/hooks/useAuth.ts`
- **Login form:** `src/components/auth/AuthScreen.tsx`
- **Supabase client:** `src/lib/supabase.ts`
- **Auth client:** `src/lib/authClient.ts`
- **Cookie middleware:** `api/_lib/middleware/cookies.ts`
- **CSRF middleware:** `api/_lib/middleware/withCSRF.ts`
- **Rate limit middleware:** `api/_lib/middleware/withRateLimit.ts`
- **Backend auth routes:** `api/auth.ts`
- **Bundle verifier template:** `scripts/verify-bundle-no-mocks.mjs`
