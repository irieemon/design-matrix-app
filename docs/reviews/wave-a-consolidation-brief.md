# Wave A Consolidation Brief — ADR-0017 Auth Hardening

**Commit:** `1e50fed`
**Filed by:** Agatha (autonomous — no Sean sign-off required for this document)
**Sean's trust-gate decision on the consolidation itself remains separate.**

---

## Scope

Wave A landed at `1e50fed` as a -1659 net-line consolidation: 108 insertions, 1767 deletions across 12 files. The commit eliminates three redundant auth hook layers (useSecureAuth, useOptimizedAuth, SecureAuthContext) and the standalone authClient.ts abstraction, collapsing them into the existing useAuth pattern. All 28 Wave A acceptance-criteria tests passed at commit time with 0 Poirot blockers per commit body.

---

## What Was Removed (5 deleted files)

- `src/hooks/useSecureAuth.ts` (224 lines) — httpOnly-cookie auth hook; no longer needed once the feature flag split was retired.
- `src/hooks/useOptimizedAuth.ts` (369 lines) — performance-oriented wrapper around useSecureAuth; duplicate of useAuth's own optimized path.
- `src/hooks/__tests__/useOptimizedAuth.test.ts` (671 lines) — test suite for the deleted hook; Wave A tests in useAuth cover the merged behavior.
- `src/contexts/SecureAuthContext.tsx` (106 lines) — React context wrapping useSecureAuth; the adapter pattern it provided is now handled directly by AuthMigration.tsx.
- `src/lib/authClient.ts` (195 lines) — thin client factory used only by the deleted hooks; the singleton Supabase client in supabase.ts supersedes it.

---

## What Was Consolidated (retained files and their absorbed responsibilities)

- `src/hooks/useAuth.ts` — absorbs logout-cleanup responsibilities from the deleted hooks; gains `clearAuthLocalStorage` helper (AC-LOGOUT-01/02/03) and the existing `MAX_AUTH_INIT_TIME` watchdog confirmed as sole auth-init safety net.
- `src/contexts/AuthMigration.tsx` — stripped from ~120 lines to 34; no longer switches between old/new auth via `VITE_FEATURE_HTTPONLY_AUTH`; now a thin pass-through from useAuth into UserProvider.
- `src/lib/supabase.ts` — gains `getAuthTokensFromLocalStorage` (40 lines added): a lock-free localStorage read that replaces the inline `localStorage.getItem` calls previously scattered across the deleted hooks and authClient.ts.
- `src/lib/authHeaders.ts` — refactored to consume `getAuthTokensFromLocalStorage` from supabase.ts and re-export `createAuthenticatedClientFromLocalStorage`; the async `getAuthHeaders()` shim is retained for backward compatibility but now delegates to the sync path.

---

## Invariants Preserved

- **AC-SESSION-01** — Session restoration on browser refresh still goes through useAuth's `initAuth` path; the singleton Supabase client removes the getSession deadlock that previously required a separate client factory.
- **AC-SESSION-02** — 5s login-screen appearance guarantee is upheld; `MAX_AUTH_INIT_TIME = 5000ms` is the single enforced bound (`useAuth.ts:398`).
- **AC-SESSION-03** — ADR-0016 zombie-session 10s terminal-logout IIFE is untouched; AuthMigration.tsx no longer wraps it in a feature-flag branch that could skip it.
- **AC-LOGOUT-01/02** — User-initiated signOut and the server-401 fallback both call `clearAuthLocalStorage()` explicitly (`useAuth.ts:360` and `useAuth.ts:381`) before returning, so the storage slot is empty synchronously.
- **AC-LOGOUT-03** — Post-logout `sb-*` localStorage and CSRF cookie clearance preserved from ADR-0016; Wave A adds the explicit `SUPABASE_STORAGE_KEY` removal to close the async race.

---

## Three Spots Worth a Human Eyeball

1. **`src/hooks/useAuth.ts:360` and `:381` — dual `clearAuthLocalStorage()` call sites.**
   The happy-path logout calls it at line 360 (after `supabase.auth.signOut()`); the catch-branch fallback calls it at line 381. Check that both branches actually reach the call — if the fallback throws before line 381 and the outer catch also throws, the storage slot would survive logout. The comment at line 360 explains the async-race rationale.

2. **`src/hooks/useAuth.ts:398-429` — `MAX_AUTH_INIT_TIME` watchdog.**
   This is the single wall-clock bound on auth initialization (AC-SESSION-02/04). Verify that every success path inside `initAuth` reaches `clearTimeout(authInitTimeout)` before returning — a missed clearTimeout would cause a double-state-set on a slow but eventually-resolving `getSession()` call. Grepping for `clearTimeout(authInitTimeout)` shows six call sites; each branch needs to be traced.

3. **`src/lib/supabase.ts:598-617` — `getAuthTokensFromLocalStorage` implementation.**
   This is the new shared lock-free token read that both `authHeaders.ts` and the logout path in `useAuth.ts` depend on. The type-guard (`typeof parsed.access_token === 'string'`) is correct, but confirm the `SUPABASE_STORAGE_KEY` constant resolves to the project-specific key (`sb-<ref>-auth-token`) and not a hardcoded legacy string — a key mismatch here would silently return `{ accessToken: null }` for all authenticated callers.

---

## What Was Not in Scope

Waves B through F remain deferred; Waves A and B have shipped to production at `faa5290`. Waves C (SameSite/CSRF freeze), D (email confirmation / password reset), E (rate limiting / audit logging), and F (CSP header audit) are still pending.
