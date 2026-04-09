---
status: awaiting_human_verify
trigger: "csrf-403-transcribe-audio - POST /api/ai?action=transcribe-audio returns 403 after login"
created: 2026-04-07
updated: 2026-04-07
---

## Round 5 — post-CSRF/auth-chain-fix: UI hangs on "Transcribing", no fetch ever leaves the browser

**HAR evidence (/Users/sean.mcinerney/Downloads/2www.prioritas.ai.har, 140 entries):**
- Storage upload to `project-files/...` → 200 (file uploaded successfully)
- Insert into `project_files` table → 201
- ZERO requests to `/api/ai?action=transcribe-audio` anywhere in the HAR.
- No console errors. UI stuck on "Transcribing" forever.

**Implication:** The fetch is never issued. Code hangs between `setAudioStage({ kind: 'transcribing' })` and `fetch('/api/ai?action=transcribe-audio')`. The only awaited call in that gap is `await supabase.auth.getSession()` (line 161, added in Round 4).

**Root cause: supabase-js auth-lock deadlock — third manifestation in this app.**

This is the SAME anti-pattern that was fixed in commit `c8c8815 fix(file-service): use lock-free supabase client to avoid auth deadlock`. The singleton supabase-js client holds an internal auth lock; calling `getSession()` from within certain code paths (post-storage-upload, in particular) deadlocks and the promise never resolves. Round 4's "canonical" fix (use `getSession()` instead of the broken `localStorage.getItem('sb-access-token')` flat key) was the right *correctness* fix but wrong *concurrency* fix — it traded a 401 for an indefinite hang.

The Round 4 commit message itself flagged that `analyze-image` had the same broken pattern but was untested in UAT. Now, both `transcribe-audio` AND `analyze-image` use `getSession()` and both will deadlock when exercised.

**Round 5 fix applied:**
1. Added a small `getAccessTokenFromLocalStorage()` helper at the top of `src/components/AIIdeaModal.tsx` that reads `SUPABASE_STORAGE_KEY` directly from localStorage and parses out `access_token`. Synchronous, lock-free, no supabase-js client involvement.
2. Replaced `await supabase.auth.getSession()` in `uploadAndTranscribeAudio` (was line 161) with `getAccessTokenFromLocalStorage()`.
3. Replaced `await supabase.auth.getSession()` in the analyze-image flow (was line 395) with the same helper.
4. Imported `SUPABASE_STORAGE_KEY` from `../lib/config`.

The `supabase` import is still needed (used by `supabase.storage.from('project-files').createSignedUrl(...)` in the analyze-image flow). Typecheck clean for AIIdeaModal.tsx — all remaining type errors elsewhere in the repo are pre-existing and unrelated.

**Files changed (Round 5):**
- src/components/AIIdeaModal.tsx

## Round 4 — post-Authorization-fix (still 401)

**HAR evidence after Round 3 fix deployed + hard reload:**
- Both transcribe-audio and analyze-file → 401 UNAUTHORIZED.
- CSRF layer now PASSING (analyze-file moved 403→401, proving CSRF cleared).
- The Bearer token attached by Round 3's fix is invalid: `localStorage.getItem('sb-access-token')` returns null because supabase-js v2 does NOT store tokens under that flat key. It stores the ENTIRE session JSON under `SUPABASE_STORAGE_KEY` (`sb-vfovtgtjailvrphsgafv-auth-token`), with access_token nested inside. So every request sent `Authorization: Bearer ` (empty) → withAuth rejected with 401.

**Canonical fix pattern (already present in repo):**
- `src/lib/authHeaders.ts::getAuthHeaders()` uses `await supabase.auth.getSession()` → `session.access_token`.
- `src/services/ProfileService.ts:176`, `src/components/pages/PricingPage.tsx:180`, `src/components/pages/UserSettings.tsx:109` all use `supabase.auth.getSession()`.
- The `localStorage.getItem('sb-access-token')` pattern appears in exactly 3 places: the two we're fixing plus the analyze-image fetch in the same AIIdeaModal.tsx file — all broken, just nobody noticed because analyze-image hadn't been exercised in UAT.

**Round 4 fix applied:**
1. `src/components/AIIdeaModal.tsx` transcribe-audio (line 158): replaced `localStorage.getItem('sb-access-token')` with `const { data: { session } } = await supabase.auth.getSession(); const accessToken = session?.access_token || ''`.
2. `src/components/AIIdeaModal.tsx` analyze-image (line 391): same replacement. Also added missing `credentials: 'include'` (analyze-image was missing it entirely — silent latent bug).
3. `src/lib/fileService.ts::triggerFileAnalysis` (line 382): same replacement.

Typecheck clean for all three touched files.

## Round 3 — post-CSRF-fix

**HAR evidence (after handleGetUser CSRF mint deployed):**
- analyze-file: 403 `CSRF_HEADER_MISSING`. Request sent NO `x-csrf-token` header at all.
- transcribe-audio: 401 `UNAUTHORIZED` ("No authentication token provided"). Request DID send `x-csrf-token: tlJ0Xt...`, but NO `Authorization` header.

**Root cause(s):**
1. `src/lib/fileService.ts::triggerFileAnalysis` was a bare fetch — no CSRF header, no Authorization, no credentials. It pre-dated all the auth/CSRF wiring and was never updated.
2. `src/components/AIIdeaModal.tsx` transcribe-audio fetch attached CSRF + credentials but forgot `Authorization: Bearer`. The legacy auth path never sets the httpOnly `sb-access-token` cookie, so withAuth had no token source. (Compare to the analyze-image fetch a few hundred lines down, which correctly does `localStorage.getItem('sb-access-token')` + Bearer header — that's the working pattern in the same file.)

withAuth (api/_lib/middleware/withAuth.ts:84-96) tries httpOnly cookie first, then falls back to `Authorization: Bearer`. With neither present → 401.

**Fix applied:**
- `src/components/AIIdeaModal.tsx`: read `sb-access-token` from localStorage, add `Authorization: Bearer ${accessToken}` to the transcribe-audio fetch headers.
- `src/lib/fileService.ts`: import `getCsrfToken` from `../utils/cookieUtils`; in `triggerFileAnalysis`, attach `Authorization: Bearer`, `X-CSRF-Token`, and `credentials: 'include'`.

**Verification:** typecheck clean. Pending production deploy + UAT.

## Current Focus

hypothesis: Round 3's Authorization header used a non-existent localStorage key ('sb-access-token'), so Bearer token was empty and withAuth returned 401. Fix: use supabase.auth.getSession() — the canonical accessor also used by authHeaders.ts and ProfileService.
test: Deploy Round 4, hard reload, retry transcribe-audio and file upload analyze flows.
expecting: Both endpoints return 200.
next_action: User verifies in production after deploy.

legacy_hypothesis: Option 1 fix (mint csrf-token on POST /api/auth?action=session) only covers fresh logins. Returning users whose Supabase session is restored from localStorage on app boot never call the session endpoint, so they never receive a csrf-token cookie. HAR proves this: 138 entries, zero POST session calls, zero Set-Cookie responses, and the transcribe-audio request sent no X-CSRF-Token header, with the server returning CSRF_COOKIE_MISSING.
test: Mint csrf-token cookie inside handleGetUser (GET /api/auth?action=user) whenever it is missing. This endpoint is called during hydration by every returning user with a Bearer token already verified, so it is the natural bootstrap point.
expecting: After deploy, returning users will have csrf-token in document.cookie after the initial /api/auth?action=user call, and subsequent /api/ai?action=transcribe-audio will send X-CSRF-Token and return 200.
next_action: Commit fix, deploy, re-verify.

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

- timestamp: 2026-04-07 (post-Option-1)
  checked: HAR capture /Users/sean.mcinerney/Downloads/www.prioritas.ai.har after Option 1 deployed
  found: 138 total entries. ZERO POST /api/auth?action=session requests. ZERO Set-Cookie response headers anywhere. The failing POST /api/ai?action=transcribe-audio sent NO X-CSRF-Token header (Chrome HAR does not strip custom headers, only Cookie/Authorization), and the server returned `{"code":"CSRF_COOKIE_MISSING"}`. There was a successful GET /api/auth?action=user that returned 200 with the user profile, indicating the user was authenticated via legacy Bearer-token / localStorage session restoration — not via the new session POST.
  implication: The Option 1 fix only mints the csrf-token cookie on fresh login through AuthScreen. Returning users (the common case) never traverse that path, so the cookie is never minted, and every CSRF-protected endpoint 403s. Root cause: cookie minting is gated on the wrong event (login) instead of the always-fired bootstrap event (handleGetUser).

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
  Option 1 — Hydrate supabase-js session after API login. (INSUFFICIENT — only covered fresh logins.)

fix_applied_v2: |
  Mint csrf-token cookie inside handleGetUser (GET /api/auth?action=user) when missing.
  - api/auth.ts: import setSecureCookie; in handleGetUser, after Bearer token verification and profile fetch succeed, check getCookie(req, COOKIE_NAMES.CSRF_TOKEN). If absent, generateCSRFToken() and setSecureCookie with httpOnly:false, sameSite:'lax', path:'/', maxAge:3600, secure in prod.
  - This is the bootstrap path every returning session traverses during app hydration. Bearer token is already verified at that point, so minting CSRF is safe. Idempotent: if cookie already present (e.g., from a prior login), it is left alone.
verification: Type-check clean for api/auth.ts. Pending production deploy + end-to-end test: returning user opens app, audio-transcription succeeds.
files_changed:
  - api/auth.ts
  - src/components/auth/AuthScreen.tsx
