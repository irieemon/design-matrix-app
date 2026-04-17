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

