---
status: awaiting_human_verify
trigger: "csrf-403-transcribe-audio - POST /api/ai?action=transcribe-audio returns 403 after login"
created: 2026-04-07
updated: 2026-04-07
---

## Current Focus

hypothesis: Old-path login flow in AuthScreen runs TWO auth operations in parallel: (1) the new fetch to /api/auth?action=session (which correctly sets csrf-token cookie server-side), and (2) the legacy supabase.auth.signInWithPassword triggered by the surrounding useAuth flow. The old-path login in AuthScreen uses `onAuthSuccess(data.user)` to notify the app, but the root useAuth hook is still wired to supabase-js localStorage session — meaning the cookie IS set but nothing in the client holds a reference to the updated document.cookie at the point the AIIdeaModal opens.
test: Verified via direct code read of api/auth.ts (handleLogin + router), cookies.ts (setAuthCookies), AuthScreen.tsx login branch, useCsrfToken + cookieUtils, withCSRF middleware, api/ai.ts compose chain.
expecting: Identify whether 403 comes from CSRF middleware rejecting (cookie missing) or auth middleware rejecting (token missing).
next_action: Return structured diagnosis.

## Symptoms

expected: After login, csrf-token cookie set; POST /api/ai?action=transcribe-audio sends X-CSRF-Token; 200 returned.
actual: 403 returned; console logs `[useCsrfToken] No CSRF token found in cookie`.
errors: POST 403 Forbidden; "No CSRF token found in cookie" client warning.
reproduction: Log out -> log back in via old-path AuthScreen -> AI Idea Modal -> audio record -> submit.
started: Phase 04 Plan 04-02 Task 3 UAT (after commit d22912b).

## Eliminated

- hypothesis: `case 'session'` POST does not map to handleLogin (Hypothesis #1 from continue-here)
  evidence: api/auth.ts lines 869-872 explicitly route POST to handleLogin, and handleLogin (lines 146-210) calls setAuthCookies with a freshly generated csrfToken. Server code is correct.
  timestamp: 2026-04-07

## Evidence

- checked: api/auth.ts authRouter switch (lines 840-944)
  found: `case 'session':` with `req.method === 'POST'` returns `handleLogin(req, res)`. Routing correct.
  implication: Hypothesis #1 (routing mismatch) is FALSE.

- checked: api/auth.ts handleLogin (lines 146-210)
  found: Calls `supabase.auth.signInWithPassword`, generates csrfToken, calls `setAuthCookies(res, { accessToken, refreshToken, csrfToken })`. Returns 200 with user.
  implication: Server-side login correctly writes csrf-token cookie on success.

- checked: api/_lib/middleware/cookies.ts setAuthCookies (lines 95-129)
  found: csrf-token cookie set with httpOnly:false, secure:true in prod, sameSite:'lax', maxAge:3600, path:'/'. Configuration is correct for JS-readable cross-page cookie.
  implication: Cookie config is not the issue.

- checked: api/auth.ts export (lines 949-951)
  found: `compose(withStrictRateLimit())(authRouter)` — NO withCSRF wrapper on /api/auth. Login correctly bypasses CSRF check (pre-auth endpoint).
  implication: Login request itself is not blocked by CSRF middleware.

- checked: src/components/auth/AuthScreen.tsx login branch (lines 206-232)
  found: When `useNewAuth` is false (prod default), fetches `/api/auth?action=session` with `credentials: 'include'`, then calls `onAuthSuccess(data.user)`.
  implication: Client-side login path is correct and includes credentials, so Set-Cookie from response should be persisted.

- checked: src/hooks/useCsrfToken.ts + src/utils/cookieUtils.ts
  found: Reads `document.cookie` for `csrf-token` via standard parsing. Polls every 1s via watchCsrfToken. Initial read wrapped in setTimeout(0).
  implication: Client read logic is correct. If cookie exists in document.cookie, it will be picked up.

- checked: api/_lib/middleware/withCSRF.ts (lines 33-91)
  found: Rejects with 403 `CSRF_COOKIE_MISSING` if req has no csrf-token cookie, `CSRF_HEADER_MISSING` if no X-CSRF-Token header, `CSRF_TOKEN_MISMATCH` if values differ.
  implication: The 403 the user sees is almost certainly `CSRF_COOKIE_MISSING` since the client reports no cookie present (and thus omits the header — AIIdeaModal spreads getCsrfHeaders() which returns `{}` when csrfToken is null).

- checked: api/ai.ts middleware chain (lines 70-74)
  found: `compose(withUserRateLimit, withCSRF(), withAuth)(aiRouter)` — CSRF runs BEFORE auth.
  implication: 403 fires at CSRF layer, never reaches withAuth. So the 403 is not an auth-token problem; it is specifically a CSRF cookie/header problem.

- checked: src/components/AIIdeaModal.tsx transcribe-audio request (lines 158-175)
  found: Sends `credentials: 'include'`, spreads `getCsrfHeaders()` and a fallback `{'X-CSRF-Token': csrfToken}`. If csrfToken is null, no header is sent.
  implication: When cookie missing on client, header is also missing, so backend returns 403 CSRF_COOKIE_MISSING (or HEADER_MISSING, depending on whether the browser actually sends the cookie).

- checked: src/lib/apiClient.ts refreshToken() (lines 59-93)
  found: On any 401, triggers POST /api/auth?action=refresh which (per handleRefresh) clears all auth cookies on failure via clearAuthCookies.
  implication: If apiClient is invoked anywhere in the old-auth flow (e.g., by ProfileService or legacy hydration) and refresh fails, the csrf-token cookie will be wiped even though the user is "logged in" via localStorage. This is a plausible silent clear pathway.

- checked: src/components/auth/AuthScreen.tsx flag gate (line 32)
  found: `useNewAuth = import.meta.env.VITE_FEATURE_HTTPONLY_AUTH === 'true'`. Prod default (unless that env var is set) = false = old path.
  implication: Old-path branch executes in prod. But critically, in the old path, the REST of the app (useAuth, ProfileService) still uses supabase-js localStorage — NOT the cookies. The cookies set by /api/auth?action=session are essentially orphaned: no part of the app reads/renews them except useCsrfToken.

## Resolution

root_cause: |
  The old-path login successfully sets the `csrf-token` cookie via POST /api/auth?action=session (commit d22912b), BUT the cookie is orphaned: nothing in the legacy auth system (useAuth + supabase-js localStorage) owns or renews it. The most probable immediate cause of the user's 403 is one of the following, in order of likelihood:

  1. **Deploy/cache staleness (HIGHEST):** The user's browser still had a service worker / bfcache / CDN-cached AuthScreen bundle from BEFORE commit d22912b, so the login flow didn't actually hit /api/auth?action=session — it called supabase.auth.signInWithPassword directly (legacy behavior), which never sets a cookie. The console warning "No CSRF token found in cookie" is exactly what you'd see if the login never produced a Set-Cookie in the first place. Verify by: (a) Vercel function logs for /api/auth?action=session around the UAT timestamp — is there an invocation? (b) Network tab on the login request — was there a Set-Cookie: csrf-token= response header?

  2. **Silent clear via refresh on 401 (MEDIUM):** Some legacy code path (apiClient, ProfileService, or a GET to /api/auth?action=user) fires after login, returns 401 because it uses a legacy auth header, and triggers refreshToken() in apiClient.ts which calls /api/auth?action=refresh. The refresh token cookie IS present, so refresh should succeed... UNLESS supabase.auth.refreshSession rejects the token (for example because localStorage session and cookie session are out of sync). On failure, handleRefresh calls clearAuthCookies, wiping csrf-token. Then useCsrfToken's 1s poll picks up the missing cookie and logs the warning.

  3. **Cookie rejection by Safari ITP (LOW):** If prod domain is a first-party origin (same as the app), this is not the cause. ITP only affects third-party contexts.

  The structural bug is that the fix in d22912b is a band-aid: it sets cookies during login, but no other code in the old-auth path renews or defends them. Any subsequent 401 from a legacy endpoint will wipe them via the refresh-failure path.

fix: |
  **DO NOT FIX YET — goal was find_root_cause_only.** Recommended directions:

  A. **Verify #1 first (fastest check):** Have the user hard-reload (Cmd+Shift+R on Safari) or test in a fresh incognito window. If 403 disappears, it was deploy staleness — close ticket as cache issue.

  B. **If #1 is ruled out, instrument:** Add Vercel function logging to handleRefresh (log when clearAuthCookies fires and why) and to aiRouter's withCSRF rejection (log which code: CSRF_COOKIE_MISSING vs HEADER_MISSING vs TOKEN_MISMATCH). Reproduce and check logs.

  C. **Structural fix:** The old-auth path should not be used anymore for CSRF-protected endpoints. Two options:
     - Flip `VITE_FEATURE_HTTPONLY_AUTH=true` in Vercel env so prod uses the new secureAuth path end-to-end. This is the cleanest fix.
     - OR: Make /api/ai?action=transcribe-audio NOT require CSRF when the user is authenticated via legacy Authorization header. But this weakens security and mixes auth models.

  D. **Harden handleRefresh:** Don't call `clearAuthCookies` on refresh failure unless the refresh token is actually invalid. On transient errors (500, network), preserve cookies so a legitimate session isn't destroyed.

fix_applied: |
  Option 1 — Hydrate supabase-js session after API login.
  1. api/auth.ts handleLogin now returns `session: { access_token, refresh_token, expires_in, expires_at, token_type }` in the response body.
  2. src/components/auth/AuthScreen.tsx old-path login branch calls `supabase.auth.setSession({ access_token, refresh_token })` before `onAuthSuccess(data.user)`.
  This restores the localStorage session the rest of the app expects (ProjectRepository, useAuth) while preserving the cookie-based CSRF protection from d22912b. Also fixes the "no projects after login" regression caused by RLS returning 0 rows when the global supabase client had no session.
verification: Pending user device verification (iOS Safari: log out, log back in, confirm projects visible, try audio transcription).
files_changed:
  - api/auth.ts
  - src/components/auth/AuthScreen.tsx
