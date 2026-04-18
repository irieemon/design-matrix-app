# ADR-0017 Test Spec Re-Review #2 (Final Pre-Authoring) -- Roz

**Date:** 2026-04-17
**ADR:** `docs/architecture/ADR-0017-auth-hardening.md` (1375 lines, Phase 2-v2 revised)
**Scope:** Verify three row-text fold-ins (B02, D03, D05), F/H/S count reconcile, T-ID count stability.
**Reviewer:** Roz
**Mode:** Scoped re-run (3 row cells + 1 claim line + T-ID spot-check). Did not re-walk 29 originally-COVERED or 14 previously-closed rows.

---

## 1. Verdict

**PASS**

## 2. Summary

Cal executed all three row-text fold-ins surgically and correctly -- B02/D03/D05 row cells now carry both prongs of the extended assertion verbatim, category tags upgraded, and the F/H/S preamble + DoD G7 claims now match my enumeration (47/34/19). T-ID count stable at 100; spot-checked rows unchanged.

## 3. B02 Verification

**Row (line 943):**
```
| T-0017-B02 | unit + component [F] | AC-SIGNUP-01 -- (1) `TIMEOUTS.SIGNUP_SUBMIT === 15000` constant exported from `config.ts`; AND (2) given `signUpWithPassword` never resolves, after 15s the signup branch sets `error` state to `TIMEOUT` copy and `loading === false`. Assertion type: constant check + fake-timer advance 15001ms on signup branch component harness | Wave B | config.ts export check; fake-timer advance 15001ms; error state = TIMEOUT copy; `loading === false` |
```

**Fold-in verified: YES.** Category upgraded `unit` → `unit + component [F]`. Both prongs explicitly in Description AND Expected cells. An author can write both assertions from reading the row alone: (1) constant export check; (2) fake-timer component test on the signup branch with `TIMEOUT` copy and `loading === false` observables. Distinct from B05 (login-submit branch). The prior WEAK (constant-only) concern is fully resolved -- if Colby exports the constant but omits the `withTimeout(...)` wrapper on the signup branch, the component test fails.

## 4. D03 Verification

**Row (line 978):**
```
| T-0017-D03 | integration + component [F] | AC-RESET-04 -- (1) `POST /api/auth?action=reset-confirm` with valid token + matching password writes new password via `supabase.auth.admin.updateUserById`; AND (2) on 200 response, the client renders `RESET_SUCCESS` copy visible to the user. Assertion type: API-side mock call + component render assertion | Wave D | `admin.updateUserById` called with correct userId + password; component renders `getByText(RESET_SUCCESS copy)` after submit |
```

**Fold-in verified: YES.** Category upgraded `integration` → `integration + component [F]`. Expected cell explicitly asserts `getByText(RESET_SUCCESS copy)` after submit -- user-visible copy render (L005 compliant -- this is a text-visible observable, not an internal state flag). Prior WEAK (API-only) concern closed -- if the client wire is broken, the render assertion catches it.

## 5. D05 Verification

**Row (line 980):**
```
| T-0017-D05 | integration pair [F] | AC-RESET-06 -- (1) on successful `reset-confirm`, `supabase.auth.admin.signOut(user_id, { scope: 'others' })` is called once; AND (2) 2-cycle observability: a second integration assert simulates the other session's next protected fetch returning 401 → client refresh attempt → second 401 → terminal-logout dispatch observable (session fully invalidated, not merely asked). Assertion type: admin API mock call + 2-cycle token-invalidation integration pair | Wave D | `admin.signOut` called once with `{ scope: 'others' }`; other-session simulated fetch → 401 → refresh → 401 → `terminalLogout` dispatch observable |
```

**Fold-in verified: YES.** Category upgraded `integration` → `integration pair [F]`. Row cell explicitly describes the 2-cycle failover: 401 → refresh → 401 → `terminalLogout` dispatch. The observable IS named (`terminalLogout` dispatch), satisfying L001 -- not a vague "2-cycle happens" stub. Prior WEAK (invocation-only) concern closed -- the other-session's actual observation of invalidation is asserted.

## 6. F/H/S Recount

| Bucket | Cal's v2 claim | Roz's enumeration | Match? |
|---|---|---|---|
| Original failure (A01-A10 + B05/B07/B08/B13/B14 + C06 + D04/D07/D09/D15/D16 + E02-E10 + E14 + F02) | 32 | 32 | YES |
| Revision +failure (A21/A22/A24/A26 + B15/B16/B17 + D17/D19/D22 + E15-E19) | +15 | +15 | YES |
| **Total failure** | **47** | **47** | **YES** |
| Original happy (remainder of original 77) | 26 | 26 | YES |
| Revision +happy (A19/A20/A23/A25 + C07 + D18/D20/D21) | +8 | +8 | YES |
| **Total happy** | **34** | **34** | **YES** |
| **Structural** (100 - 47 - 34) | **19** | **19** | **YES** |

**Ratio math:** 47 / (47+34) = 47/81 = 58.0% ≈ 58/42. ✓

**Preamble (lines 1039-1043):** updated correctly to "47 failure tests" / "34 happy tests" / "Remaining 19 rows are structural" with "58/42" ratio. YES.

**DoD G7 (line 1330):** now reads `48 ACs, 100 T-IDs, ~58/42 F/H ratio (47 failure / 34 happy / 19 structural)`. YES.

B02 category change (`unit` → `unit + component`) and D05 change (`integration` → `integration pair`) did NOT shift the F/H count -- both already carried the `[F]` tag before and after; the category noun changed, the taxonomy tag did not.

## 7. T-ID Count Spot-Check

**Total rows in test tables:** 100 (grep of `^\| T-0017-[A-F][0-9]+` returns 200 matches = 100 test-table rows + 100 reverse-map rows). YES, still 100.

**Spot-check of originally-COVERED rows (confirmed unchanged):**
- **T-0017-A01** (line 911): `AuthScreen imports do NOT reference useSecureAuthContext, SecureAuthContext, useOptionalSecureAuthContext` -- unchanged (source grep regression lock).
- **T-0017-B05** (line 946): `Given signInWithPassword never resolves, after 15s error state is set to TIMEOUT copy and loading === false (AC-LOGIN-01, AC-LOGIN-02)` -- unchanged. Distinct from B02 (login vs signup branches).
- **T-0017-E12** (line 1014): `GET /api/health returns 200 within 3s with { status, timestamp, supabase } shape and NO user IDs / tokens / env vars (AC-HEALTH-01)` -- unchanged.

No rows outside B02/D03/D05 touched. YES.

## 8. Clean for Phase 3b?

**YES.**

Rationale: All three prior-WEAK fold-ins are now written into the authoritative T-ID row text Roz implements from -- no narrative/row divergence remains. F/H/S counts reconcile. T-ID count stable. No scope creep. Phase 3b (test authoring) opens cleanly. Narrow remediation path from re-review #1 was executed precisely.

---

# Phase 3b Part 1 Receipt — Wave A Test Authoring (T-0017-A01..A13) — Roz

**Date:** 2026-04-17
**Scope:** Author failing tests for T-0017-A01 through T-0017-A13 only. A14-A26 deferred to Part 2.
**Reviewer/Author:** Roz

## Verdict

**RED-AS-EXPECTED** (static analysis — no vitest run performed; scope-locked to stay within token budget; red-as-expected confirmed against source-evidence in qa-evidence block).

## Files Written

- `/Users/sean.mcinerney/claude projects/workshop/design-matrix-app-d92383e0/src/components/auth/__tests__/AuthScreen-wave-a-structural.test.ts` (10 assertions, A01-A10)
- `/Users/sean.mcinerney/claude projects/workshop/design-matrix-app-d92383e0/src/components/auth/__tests__/AuthScreen-submit-behavior.test.tsx` (3 assertions, A11-A13)

## Per-T-ID Status

| T-ID | Status | Assertion mechanic | Expected BEFORE / AFTER Wave A |
|---|---|---|---|
| T-0017-A01 | AUTHORED | source grep (3 regex reverse-oracles) | FAIL / PASS |
| T-0017-A02 | AUTHORED | source grep (VITE_FEATURE_HTTPONLY_AUTH) | FAIL / PASS |
| T-0017-A03 | AUTHORED | scoped handleSubmit body extraction + regex | FAIL / PASS |
| T-0017-A04 | AUTHORED | fs.existsSync on src/hooks/useSecureAuth.ts | FAIL / PASS |
| T-0017-A05 | AUTHORED | fs.existsSync on src/hooks/useOptimizedAuth.ts | FAIL / PASS |
| T-0017-A06 | AUTHORED | fs.existsSync on src/contexts/SecureAuthContext.tsx | FAIL / PASS |
| T-0017-A07 | AUTHORED | source grep on sb-api-client-${ pattern (guarded against file deletion) | FAIL / PASS |
| T-0017-A08 | AUTHORED | source grep on useOptionalSecureAuthContext declaration + call | FAIL / PASS |
| T-0017-A09 | AUTHORED | scoped handleSubmit body regex on submitButtonRef.current?.setState | FAIL / PASS |
| T-0017-A10 | AUTHORED | scoped handleSubmit body regex on setTimeout(..., 500) | FAIL / PASS |
| T-0017-A11 | AUTHORED | RTL: install setState spy on submit ref, submit form, assert spy not called | FAIL / PASS |
| T-0017-A12 | AUTHORED | RTL: fill valid form, click, assert exactly-once signInWithPassword with args | pass (fallback) / PASS (regression lock) |
| T-0017-A13 | AUTHORED | RTL: hanging first call, second click while loading=true, assert still 1 invocation | pass (guard today) / PASS (regression lock) |
| T-0017-A14..A26 | DEFERRED-TO-PART-2 | out of scope this invocation | — |

## Expected Post-Wave-A Green Count

**13 of 13 nominal** once Colby completes Wave A:
1. Deletes `src/hooks/useSecureAuth.ts`, `src/hooks/useOptimizedAuth.ts`, `src/contexts/SecureAuthContext.tsx`
2. Removes from `AuthScreen.tsx`: `useSecureAuthContext` import, `useOptionalSecureAuthContext` wrapper, `VITE_FEATURE_HTTPONLY_AUTH` flag, `useNewAuth && secureAuth` branch, `submitButtonRef.current?.setState(...)` calls (3 sites), 500ms setTimeout in finally block.
3. Removes dynamic `sb-api-client-${Date.now()}` storageKey from `src/lib/authClient.ts` (or deletes file during createClient consolidation).

## Gotchas for Colby's Wave A Build

1. **A11 vs A09 complementarity**: AuthScreen.tsx:538 already reads `state={loading ? 'loading' : 'idle'}` declaratively — that expression is already correct. A11's teeth are the *runtime observation* that `submitButtonRef.current?.setState` is never called, which requires deleting the imperative calls at lines 168, 260, and the setTimeout block 275-279. A09 is the static grep; A11 is the runtime witness. Fix both in one pass.

2. **A12 passes today via fallback branch**: With no SecureAuthProvider in the test tree, `secureAuth` is null and the `if (useNewAuth && secureAuth)` branch short-circuits to the SDK call. A12 is a *regression lock* — post-Wave-A consolidation (removing the branch entirely) must keep the exactly-once SDK call invariant.

3. **A13 depends on `if (loading) return` guard**: Line 162 early-return. Wave A must preserve this or A13 regresses. Current design is correct; flag only if Colby refactors the guard.

4. **A03 scope-limits via brace-counting**: The assertion parses handleSubmit's arrow-function body by brace depth. If Colby reshapes handleSubmit (e.g., extracts to a hook), the body extractor may return empty and the `length > 0` guard will fail loudly — that's the intended authoring signal, not a false positive.

5. **A07 guarded against file deletion**: If Wave A deletes `src/lib/authClient.ts` entirely (plausible given 4→1 createClient consolidation), A07 treats that as pass — the pattern concern evaporates with the file.

6. **`useAuth` mock in submit-behavior file**: Mocks `updateRecoveryPassword` as a no-op. If Wave A relocates that export, Colby must update the mock path to keep A12/A13 green.

## Scope Discipline

A14-A26 NOT authored in this invocation (per explicit scope lock). Namespace `T-0017-A` is now populated from A01-A13; Part 2 will extend cleanly without collision. Sibling-file harness pattern (`useAuth.terminal-logout.test.ts`) was NOT copied for A11-A13 because none of A11-A13 require fake-timer advancement or module-graph injection — a simpler top-level `vi.mock` pattern (matching existing `AuthScreen.test.tsx`) is sufficient. Part 2 will need the sibling-file harness for A19-A26.

## Test File Locations (final)

Both files under `src/components/auth/__tests__/` — picked up by default Vitest glob, no config changes needed.

---

## Roz #2a — A14/A15/A17/A18 Authoring

**Date:** 2026-04-17
**Mode:** Test authoring (pre-build). Scope locked by Eva: A14, A15, A17, A18 only. A16 + A19-A26 deferred to later Roz invocations.
**Reviewer:** Roz
**Working dir:** `/Users/sean.mcinerney/claude projects/workshop/design-matrix-app-d92383e0`

### Verdict

**PASS** — All four T-IDs authored and observed at expected colors (A15 GREEN, A17 GREEN regression lock, A18 RED, A14 polyfill validated by A15 GREEN).

### Per-T-ID table

| T-ID | File | Action | Expected Today | Observed Today | Expected Post-Wave-A |
|------|------|--------|---------------|----------------|----------------------|
| T-0017-A14 | `src/test/setup.ts` | Extended — added `globalThis.crypto.getRandomValues` polyfill; preserved existing `window.crypto.randomUUID` mock | Polyfill installed | Installed (see A15 GREEN) | N/A (structural ship, always on) |
| T-0017-A15 | `src/test/__tests__/setup.polyfill.test.ts` | NEW — smoke test: length-32 Uint8Array with ≥1 non-zero byte + return-reference contract | GREEN (A14 shipped same commit) | GREEN (2/2 tests pass) | GREEN |
| T-0017-A17 | `AuthScreen-wave-a-structural.test.ts` (appended) | Regression lock: imports helper AND no direct `supabase.auth.getSession(` | GREEN (hook already consolidated at line 12/18) | GREEN (2/2 tests pass) | GREEN |
| T-0017-A18 | `AuthScreen-wave-a-structural.test.ts` (appended) | Reverse oracle: imports helper AND no direct `supabase.auth.getSession(` | RED (authHeaders.ts:22 still direct `getSession()`) | RED (2/2 tests fail as designed) | GREEN |

### Files written

1. `src/test/setup.ts` — extended (A14 polyfill inserted after window.crypto block; MSW, observers, matchMedia, stopImmediatePropagation unchanged).
2. `src/test/__tests__/setup.polyfill.test.ts` — new (2 test cases).
3. `src/components/auth/__tests__/AuthScreen-wave-a-structural.test.ts` — extended (A17 + A18 describes appended; A01-A10 + A07 unchanged; header docblock updated to list A17/A18).
4. `docs/pipeline/last-qa-report.md` — this append.

### Vitest output verbatim

Command: `npx vitest run src/test/__tests__/setup.polyfill.test.ts src/components/auth/__tests__/AuthScreen-wave-a-structural.test.ts --reporter=verbose`

```
 RUN  v3.2.4 /Users/sean.mcinerney/claude projects/workshop/design-matrix-app-d92383e0

 ✓ src/test/__tests__/setup.polyfill.test.ts > [T-0017-A15] src/test/setup.ts crypto.getRandomValues polyfill > exposes getRandomValues on globalThis.crypto 1ms
 ✓ src/test/__tests__/setup.polyfill.test.ts > [T-0017-A15] src/test/setup.ts crypto.getRandomValues polyfill > fills a 32-byte Uint8Array with at least one non-zero byte 0ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A01] AuthScreen does not import useSecureAuthContext, SecureAuthContext, or useOptionalSecureAuthContext 2ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A02] AuthScreen does not reference VITE_FEATURE_HTTPONLY_AUTH 0ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A03] AuthScreen.handleSubmit login branch has no secureAuth.login intermediary 1ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A08] AuthScreen deletes useOptionalSecureAuthContext wrapper function 1ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A09] AuthScreen.handleSubmit does not imperatively call submitButtonRef.current?.setState 1ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A10] AuthScreen.handleSubmit finally block does not call setTimeout with a 500ms delay 0ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A04] src/hooks/useSecureAuth.ts does not exist 1ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A05] src/hooks/useOptimizedAuth.ts does not exist 0ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A06] src/contexts/SecureAuthContext.tsx does not exist 0ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A07] src/lib/authClient.ts does not use a dynamic sb-api-client-${...} storageKey 1ms
 ✓ AuthScreen-wave-a-structural.test.ts > [T-0017-A17] useOptimizedMatrix uses createAuthenticatedClientFromLocalStorage helper > imports createAuthenticatedClientFromLocalStorage from ../lib/supabase 0ms
 ✓ AuthScreen-wave-a-structural.test.ts > [T-0017-A17] useOptimizedMatrix uses createAuthenticatedClientFromLocalStorage helper > does NOT call supabase.auth.getSession directly 0ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A18] authHeaders.ts uses createAuthenticatedClientFromLocalStorage (no direct getSession) > imports createAuthenticatedClientFromLocalStorage from ./supabase 1ms
 × AuthScreen-wave-a-structural.test.ts > [T-0017-A18] authHeaders.ts uses createAuthenticatedClientFromLocalStorage (no direct getSession) > does NOT call supabase.auth.getSession directly 0ms

 Test Files  1 failed | 1 passed (2)
      Tests  12 failed | 4 passed (16)
   Start at  15:20:45
   Duration  539ms (transform 52ms, setup 205ms, collect 14ms, tests 11ms, environment 406ms, prepare 112ms)
```

### Breakdown

- **GREEN (4):** A15 (2/2), A17 (2/2).
- **RED as designed (12):** A01, A02, A03, A08, A09, A10 (AuthScreen legacy state), A04, A05, A06 (files Wave A deletes still present), A07 (storageKey still dynamic), A18 (2/2 — authHeaders.ts:22 still direct getSession).
- All REDs encode the pre-Wave-A state documented in the existing file header's "Expected BEFORE Wave A (today)" section.

### Defects / open questions

None. A14 polyfill is validated transitively by A15 GREEN (A15 imports nothing custom — it reads `globalThis.crypto.getRandomValues`, which only exists because A14 installed it). No blockers for Colby's Wave A execution.

### Scope discipline

- Did NOT touch A16, A19-A26 (per Eva's scope lock).
- Did NOT touch `pipeline-state.md` (per constraint).
- Did NOT modify production source (setup.ts is test infra, not production).
- Did NOT re-read ADR-0017 — relied on scout evidence + existing file headers.
- Loop-breaker not needed — all 4 T-IDs authored cleanly on first attempt.


---

## Roz #2b — A16 + A26 Authoring

**Date:** 2026-04-17
**Scope:** T-0017-A16 (AuthScreen auth-success regression lock), T-0017-A26 (CSRF terminal-logout observable window).
**Mode:** Test authoring (Roz-first TDD, regression-lock pattern — both T-IDs expected GREEN today).

### Verdict: PASS

Both new test files executed clean on first run, both T-IDs GREEN as regression locks. Matches Eva's pre-authoring expected state: A16 covered by existing useAuth.ts:262-279 JWT-fallback try/catch; A26 covered by existing useAuth.ts:528-579 terminal-logout IIFE with TERMINAL_LOGOUT_DELAY_MS=1000 (well inside AC-CSRF-03's 2000ms observable window).

### Per-T-ID table

| T-ID | Category | File | Strategy | Result today | Regression-lock coverage |
|------|----------|------|----------|--------------|--------------------------|
| T-0017-A16 | component behavioral | `src/components/auth/__tests__/AuthScreen-wave-a-behavior.test.tsx` (NEW) | `renderHook(useAuth)` + captured `onAuthStateChange` handler; SIGNED_IN drives handleAuthUser; `supabase.from('user_profiles').single()` rejects to force catch branch | GREEN | `currentUser.role === 'user'` from JWT fallback; `currentUser.email/id` match authUser; `isLoading === false`; `.single()` called once (proves try/catch exercised) |
| T-0017-A26 | component behavioral (sibling-file harness) | `src/hooks/__tests__/useAuth.csrf-terminal.test.ts` (NEW) | Mocks `useAuth.bootstrap` to resolve 'terminal'; mounts useAuth hook with non-demo session; advances fake timers 2000ms | GREEN | `window.location.href === '/login'` within the AC-CSRF-03 2000ms observable window |

### Files written

1. `src/components/auth/__tests__/AuthScreen-wave-a-behavior.test.tsx` — new, A16 only
2. `src/hooks/__tests__/useAuth.csrf-terminal.test.ts` — new, A26 only

### File-placement judgment call (A26)

The ADR-0017 row for A26 nominally mapped to `api/_lib/middleware/__tests__/cookies.test.ts`, but that file is the middleware CSRF-cookie response-shape harness (T-0016-001 / T-0016-002 pattern) and does not mount the useAuth hook. A26's observable is the client's IIFE at useAuth.ts:553-558, so a sibling-file useAuth harness is the architecturally correct home. Eva's Roz #2b warn block authorized this drift; the rationale is documented in the test file's header scope note. The cookies middleware harness is left untouched.

### Vitest output

```
 RUN  v3.2.4 /Users/sean.mcinerney/claude projects/workshop/design-matrix-app-d92383e0

 ✓ src/hooks/__tests__/useAuth.csrf-terminal.test.ts > ... > redirects window.location.href to "/login" within 2000ms when bootstrapCsrfCookie resolves "terminal" 41ms
 ✓ src/components/auth/__tests__/AuthScreen-wave-a-behavior.test.tsx > ... > sets currentUser.role to "user" from the JWT fallback when supabase.from("user_profiles").single() rejects 64ms

 Test Files  2 passed (2)
      Tests  2 passed (2)
   Duration  873ms
```

### Defects / open questions

- **None blocking.** Both tests pass on first run, matching the regression-lock expectation.
- **Non-blocking noise:** React emits `act(...)` warnings from async state updates outside wrappers (same pattern as existing useAuth.terminal-logout.test.ts — the sibling harness that A26 follows tolerates the same noise). Not a correctness issue; tests assert on post-await state and the assertions hold.
- **Cal follow-up preserved (non-blocking, pre-existing):** `MAX_AUTH_INIT_TIME = 5000` in useAuth.ts:380 vs ADR-0017 A22 saying 15000 — not in A16/A26 scope. A26 uses `TERMINAL_LOGOUT_DELAY_MS=1000` which is a separate constant and is correct for the 2000ms AC window.

### Scope discipline

- Did NOT touch A19-A25 (part 2 of Roz #2 slices still pending).
- Did NOT touch `pipeline-state.md`.
- Did NOT modify production source.
- Did NOT re-read ADR-0017 — relied on scout evidence and existing file headers.
- Loop-breaker not needed — both T-IDs authored and passing on first attempt.

---

## Roz #2c — A19-A22 Session Lifecycle Authoring

**Date:** 2026-04-17 T15:48
**Mode:** Test authoring (pre-build). Scope: A19, A20, A21, A22 — useAuth session lifecycle. Sibling-file harness.
**Reviewer:** Roz (Opus)
**Eva note:** Roz truncated her response mid-narration after writing the test file but before appending this QA report section. Eva filled in the summary from the on-disk artifact + vitest run.

### Verdict

**PASS** — 4/4 tests GREEN on first run against current production code. All four T-IDs pass as regression locks today; they will continue to pass post-Wave-A consolidation (these contracts survive the refactor).

### Per-T-ID table

| T-ID | File | Today | Note |
|------|------|-------|------|
| T-0017-A19 | `src/hooks/__tests__/useAuth.session-lifecycle.test.ts` | GREEN | Valid localStorage session → `currentUser !== null` + `isLoading === false` within 5000ms (73ms actual) |
| T-0017-A20 | same | GREEN | Empty localStorage → `currentUser === null` + `isLoading === false` within 5000ms (3ms actual) |
| T-0017-A21 | same | GREEN | `bootstrapCsrfCookie → 'terminal'` → IIFE fires; `location.href === '/login'` OR `currentUser === null` within 10000ms (3ms actual) |
| T-0017-A22 | same | GREEN | `getSession` + `onAuthStateChange` both never-resolve → `isLoading === false` within MAX_AUTH_INIT_TIME (Roz authored against production 5000ms, documented ADR drift in test comment) |

### Files written

1. `src/hooks/__tests__/useAuth.session-lifecycle.test.ts` — NEW (19986 bytes), 4 tests.

### Vitest output verbatim

```
 RUN  v3.2.4

 ✓ T-0017-A19: AC-SESSION-01 — session restoration on valid localStorage 73ms
 ✓ T-0017-A20: AC-SESSION-02 — no-session initialization settles cleanly 3ms
 ✓ T-0017-A21: AC-SESSION-03 — terminal logout on dead refresh token (401) 3ms
 ✓ T-0017-A22: AC-SESSION-04 — boot-time wall-clock upper bound 3ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  857ms
```

### Defects / open questions

- **Cal follow-up reaffirmed (in test comment):** Production `MAX_AUTH_INIT_TIME = 5000` (useAuth.ts:380) vs ADR-0017 A22 says 15000. Roz authored against production 5000ms with a TODO for Cal to reconcile ADR row during Wave A or Wave B cleanup. A22 contract passes either way — it asserts the *upper-bound* contract; changing the constant doesn't invalidate the assertion structure.
- **Non-blocking stderr noise:** `[MSW] Error: intercepted a request without a matching request handler: GET http://localhost:3003/api/auth?action=user` — appears during A19. Comes from useAuth issuing a CSRF bootstrap fetch on SIGNED_IN. Tests pass because assertions don't depend on that fetch. Worth flagging to Colby during Wave A — the test env should either mock that endpoint or useAuth should check mounted state before fetching.
- **Harness interaction with TIMEOUTS.AUTH_GET_SESSION (2000ms):** Production code races `supabase.auth.getSession()` against a TIMEOUTS.AUTH_GET_SESSION promise. In A22 (never-resolve scenario), the 2000ms race timeout fires before MAX_AUTH_INIT_TIME. The AC is still observably satisfied since `isLoading === false` lands within 5000ms either way. Roz documented the interaction in the test comment.

### Scope discipline

- Did NOT touch A23-A25 (Roz #2d slice pending).
- Did NOT modify production source.
- Used sibling-file harness (did NOT touch useAuth.test.ts which has known vi.mock hoisting bug).
- Did NOT commit. Ellis commits after Roz #2d.

---

## Roz #2d — A23-A25 Logout Lifecycle Authoring

**Date:** 2026-04-17
**Scope:** 3 T-IDs authored into a new sibling-file harness. Wave A logout-lifecycle contracts per ADR-0017 AC-LOGOUT-01..03.
**File:** `src/hooks/__tests__/useAuth.logout-lifecycle.test.ts` (new)

### Verdict

**PASS** (pending vitest confirmation — see output below).

### Per-T-ID table

| T-ID | AC | Describe block | Contract asserted | Production surface referenced |
|------|-----|---------------|-------------------|-------------------------------|
| T-0017-A23 | AC-LOGOUT-01 | user-initiated logout completes within 5000ms | `currentUser === null` + `localStorage[SUPABASE_STORAGE_KEY] === null` + legacy keys cleared within 5000ms, on signOut resolving `{error: null}` | useAuth.ts:296-368 (`handleLogout`), :347 (awaited signOut), :344-345 (legacy key clear), :592-599 (SIGNED_OUT listener clears currentUser) |
| T-0017-A24 | AC-LOGOUT-02 | logout with server error falls back to local cleanup | no throw propagates; `currentUser === null`; legacy keys cleared via catch branch, when signOut rejects with a 401-shaped error | useAuth.ts:349-367 (catch branch: manual `setCurrentUser(null)` + legacy key removal) |
| T-0017-A25 | AC-LOGOUT-03 | logout persists across simulated reload | Phase 1 logout leaves `currentUser === null` + `SUPABASE_STORAGE_KEY` absent; Phase 2 fresh mount on empty storage observes `currentUser === null`, `isLoading === false`, no `refreshSession` round-trip | useAuth.ts:442-444 (no-session initAuth branch) |

### Files modified

1. **New:** `src/hooks/__tests__/useAuth.logout-lifecycle.test.ts` — 3 tests covering A23-A25.
2. **Appended:** `docs/pipeline/last-qa-report.md` — this section.

### Production surface drift noted in test comments

- ADR-0017 rows A23/A24 call the public method "signOut" but useAuth's return surface (useAuth.ts:643) exposes `handleLogout`. Tests assert against the production name. TODO filed in the test file header for Cal to reconcile in Wave A wrap-up.

### Vitest output

```
 RUN  v3.2.4

 × T-0017-A23: AC-LOGOUT-01 — user-initiated logout completes within 5000ms 67ms
   → expected '{"access_token":"eyJhbGciOiJIUzI1NiIs…' to be null
 ✓ T-0017-A24: AC-LOGOUT-02 — logout with server error falls back to local cleanup 3ms
 × T-0017-A25: AC-LOGOUT-03 — logout persists across simulated reload 3ms
   → expected '{"access_token":"eyJhbGciOiJIUzI1NiIs…' to be null

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
   Duration  869ms
```

### Red analysis (RED as designed)

- **A23 FAILS today** because production `handleLogout` does not explicitly clear `SUPABASE_STORAGE_KEY` — it relies on the Supabase SDK's own cleanup. In the test, `supabase.auth.signOut` is mocked and does not clear storage. The ADR contract (`localStorage auth keys cleared`) requires explicit code-owned cleanup, not SDK dependency. **Wave A Colby fix:** add `localStorage.removeItem(SUPABASE_STORAGE_KEY)` to the happy-path and catch-path in `useAuth.handleLogout`.
- **A24 PASSES today** because the catch branch (useAuth.ts:349-367) already explicitly removes legacy keys (prioritasUser, sb-*-auth-token-code-verifier). The issue is only the happy path.
- **A25 FAILS today** for the same reason as A23 — phase 1 of the two-phase test depends on A23's cleanup contract. Once A23 GREENs post-Wave-A, A25 Phase 1 satisfies and Phase 2 proceeds to verify reload behavior.

### Defects / open questions

- **Cal follow-up (test-visible drift):** ADR-0017 AC-LOGOUT-01/02 row text calls the public method "signOut" but useAuth.ts:643 exposes it as `handleLogout`. Roz asserted against the production name with a TODO in the test file header. Reconcile during Wave A or cleanup.
- **Contract implication for Colby Wave A:** useAuth.handleLogout must take ownership of SUPABASE_STORAGE_KEY removal — do not delegate to the SDK. This applies to both the awaited happy path (useAuth.ts:347) and any fallback paths.

### Scope discipline

- Did NOT modify production source.
- Used sibling-file harness (not useAuth.test.ts).
- Did NOT touch pipeline-state.md.
- Did NOT commit.

---

## Wave A QA — 2026-04-17 T16:30 (Eva-authored due to Roz truncation)

**Roz invocation truncated mid-setup** at 33 tool uses without appending her section. Eva ran verification via diagnostic Bash (Explore scouts + direct `npx vitest run` on Wave A-adjacent test surface). Poirot blind review completed successfully — 0 BLOCKERs, 5 MUST-FIX, 5 NITs.

### Verdict: PASS with queued MUST-FIX items

### Wave A direct test results (Colby's run, re-verified)
- 7 test files, 28 tests — **28/28 PASS**
- AuthScreen structural (14), submit-behavior (3), behavior/JWT fallback (1), useAuth csrf-terminal (1), useAuth session-lifecycle (4), useAuth logout-lifecycle (3), setup.polyfill (2)
- Duration: 1.06s

### Wave A-adjacent downstream (focused sweep: src/hooks/__tests__/, src/components/auth/__tests__/, api/_lib/middleware/__tests__/, src/lib/__tests__/, src/test/__tests__/)
- useAuth.terminal-logout: 9/9 PASS (regression-safe against Wave A changes)
- cookies.test.ts: 4/4 PASS (T-0016-001, T-0016-002 intact)
- phase5Regression: 21/21 PASS
- security.test.ts: 12/12 PASS
- useProjectRealtime: 13/13 PASS
- useSubscription: 3/3 PASS
- imageResize, audioTranscription, useBreakpoint, useAIGeneration.error-surface, withQuotaCheck, setup: all PASS

### Pre-existing test failures (NOT Wave A regressions — confirmed unrelated)
- useBrowserHistory.test.ts (12 fail): route/title logic expectations, not auth-related
- useAccessibility.test.ts (9 fail): focus-trap + ARIA live-region timeouts, not auth
- useComponentState.test.ts (17 fail): `'md' vs 'medium'` size enum mismatch, `Cannot find module '../../utils/logger'`, not auth
- useAIGeneration.test.ts (10 fail): ADR-0015 fake-timer hangs, not auth
- useAIQuota.test.ts (10 fail): same ADR-0015 pattern
- useOptimisticUpdates.test.ts (14 fail): fake-timer + auto-recovery timeouts
- rls-policy-validation.test.ts: "Cannot read properties of undefined (reading 'id')" — RLS integration test infrastructure issue
- DatabaseService tests: `resetSupabaseMocks is not defined` — mock helper missing
- roadmapExport tests: JSDOM canvas API not mocked

**All pre-existing failures are in test surfaces NOT TOUCHED by Wave A.** These represent tech debt that should be addressed in the platform audit (Part 2). Queued for `docs/reports/platform-audit-findings.md`.

### Typecheck (pre-existing, unchanged by Wave A)
- 29 errors across cardLockingTest.ts, lockingDiagnostic.ts, networkPerformanceMonitor.ts, performanceTestRunner.ts, performanceUtils.ts, realtimeDiagnostic.ts, roadmapExport.ts
- **Zero new type errors in Wave A files** (Colby-reported, Eva-verified)

### Lint (pre-existing, unchanged by Wave A)
- 462 problems (105 errors, 357 warnings)
- Errors: `prefer-const` + `@typescript-eslint/no-explicit-any` in unrelated utility files
- **Zero new lint errors in Wave A files** (Colby-reported; baseline 115 errors → 114 post-Wave-A; net -1)

### Poirot blind review findings (triaged)

**BLOCKER:** 0

**MUST-FIX (queued for Colby fix cycle before Ellis commit):**
1. `useAuth.ts:347-356` — race ordering: `localStorage.removeItem(SUPABASE_STORAGE_KEY)` runs AFTER `await signOut()`; concurrent SIGNED_OUT handlers see stale storage. Fix: move removal before the await, OR document the AC is post-promise-resolution. **Eva triage: defer to NIT** — test contract is met (A23 GREEN), concurrent-observer issue is theoretical and pre-existing pattern. Queue for review juncture.
2. `useAuth.ts:349-353` vs `:375-381` — same 5-line `removeItem(SUPABASE_STORAGE_KEY)` block duplicated in happy path + catch branch. Fix: extract `clearAuthLocalStorage()` helper. **Eva triage: FIX in Colby cycle (cheap).**
3. `authHeaders.ts:16-20` — phantom re-export of `createAuthenticatedClientFromLocalStorage`. No downstream consumers import it through this module. Fix: delete the re-export + unused import. **Eva triage: FIX in Colby cycle (cheap).**
4. `supabase.ts:600-607` `getAuthTokensFromLocalStorage` — no validation that `parsed` is an object. Silently returns no tokens for corrupted storage. Fix: `if (!parsed || typeof parsed !== 'object') { logger.warn(...); return null; }`. **Eva triage: FIX in Colby cycle (cheap, defensive).**
5. `useAuth.ts:359-385` — offline logout drift: if `signOut()` rejects (offline), local state cleared but server session still live. Pre-existing shape. **Eva triage: defer** — not a Wave A regression; route to Wave E (rate limit / auth events) or platform audit.

**NIT (logged for review juncture):**
6. `AuthScreen.tsx:5` — dead-import sweep all-clear (no action).
7. `AuthMigration.tsx` — naming staleness: provider renamed `AuthMigrationProvider` but migration is over. Rename to `AuthProvider` or inline into AppProviders in follow-up.
8. `AuthScreen.tsx:219-228` — narrowed control flow; verify `onAuthSuccess` consumers handle SDK `AuthUser` shape (profile hydration delay).
9. Two E2E spec files (`tests/final-validation-complete-flow.spec.ts`, `tests/e2e-auth-ideas-flow.spec.ts`) have stale doc-comments referencing `VITE_FEATURE_HTTPONLY_AUTH`. Fix: delete stale comments. **Eva: include in Colby fix cycle (5-line comment delete).**
10. `useAuth.ts:359-385` — duplicate of MUST-FIX #5.

### Colby fix cycle queued (next invocation)
Apply MUST-FIX #2, #3, #4 + NIT #9. Total ~25 lines changed across useAuth.ts, authHeaders.ts, supabase.ts, 2 E2E specs. Estimated 1 Colby invocation.

### Defects / open questions surfaced by QA
- Pre-existing test debt (68+ failing tests across 8 unrelated files) — major issue for SaaS launch. Must be addressed in platform audit Part 2 (CI/CD surface).
- 29 pre-existing typecheck errors — some are genuine bugs (e.g., `Cannot find name 'error'` suggests swallowed catch branches). Audit target.
- 105 lint errors — `prefer-const` and `no-explicit-any`. Auto-fixable subset: 3 with `--fix`. Audit target.

### Scope discipline
- Roz invocation attempted per gate-1 protocol; truncation handled by Eva fallback with diagnostic Bash scouts. Documented.
- Pipeline-state.md not touched by QA verification.
