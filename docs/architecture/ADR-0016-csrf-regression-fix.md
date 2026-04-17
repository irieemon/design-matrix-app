# ADR-0016: CSRF Regression Fix -- Recovery, Zombie Sessions, and Mock Fallback Elimination

## Status

Proposed

## Relationship to Prior ADRs

This ADR **extends** ADR-0014 (AI Service Layer Auth/CSRF Hardening). It does not
supersede it. ADR-0014 fixed `credentials: 'include'` and added 401 retry/refresh
to `BaseAiService`. That work remains correct. This ADR adds the two recovery paths
ADR-0014 did not cover:

1. **CSRF cookie recovery** when `bootstrapCsrfCookie()` cannot mint on load.
2. **Zombie-session recovery** when localStorage says "logged in" but every
   authenticated backend call fails.

It also eliminates a separate failure-amplifier introduced long before ADR-0014:
AI services silently swallow errors and return mock data, converting a 403 into a
plausible-looking "generic ideas" payload with zero UI feedback.

## DoR -- Definition of Ready

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| R1 | Mint CSRF cookie when `/api/auth?action=user` returns 401 on bootstrap | Runtime evidence (prod zombie session) | Ready |
| R2 | Detect terminal auth failure (401 after refresh also 401) and hard-force user to `/login` with expired-session toast | User decision #1 | Ready |
| R3 | Re-mint CSRF cookie in-session when an AI request returns 403 `CSRF_COOKIE_MISSING` | User decision #2 | Ready |
| R4 | Extend `csrf-token` cookie maxAge from 3600s to 86400s (24h) | User decision #2 | Ready |
| R5 | Eliminate silent catch-and-return-mock pattern in `IdeaGenerationService` (2 call sites) | User decision #3 | Ready |
| R6 | Eliminate silent catch-and-return-mock pattern in `RoadmapService` (1 catch + 1 `\|\| fallback`) | User decision #3 | Ready |
| R7 | Eliminate silent catch-and-return-mock pattern in `InsightsService` (dev-only `isLocalhost()` gate + template-content mock) | User decision #3 | Ready |
| R8 | Gate all mock code paths behind `import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'` so Vite tree-shakes them from prod bundle | User decision #4 | Ready |
| R9 | Convert 200-empty responses into distinct errors so the UI surfaces "AI returned no ideas" rather than silently returning `[]` | User decision (additional constraint) | Ready |
| R10 | Error surface is the existing `useAIGeneration` error state rendered by `AIProgressOverlay` (NOT `ToastContext`) -- verified as the actual caller chain | Codebase verification | Ready |
| R11 | Demo-mode user flow (`isDemoUUID` in `src/hooks/useAuth.ts:298`) remains functional | Constraint | Ready |
| R12 | ADR-0014 behavior (credentials: include, 401 retry via refresh) remains intact | ADR-0014 | Ready |

**Retro risks:**

- **Lesson 001 (Sensitive Data in Return Shapes):** Not directly applicable -- this ADR
  changes error paths, not data access shapes. Noted as a non-risk.
- **Lesson 002 (Self-Reporting Bug Codification):** The existing test files for
  IdeaGenerationService and RoadmapService may contain assertions that codify the
  current "catch-then-return-mock" behavior as "correct." Colby must not adapt the
  new behavior to make those tests pass; Roz authors new tests first, old tests
  that assert mock-fallback-on-error get deleted.
- **Lesson 005 (Frontend Wiring Omission):** This ADR changes what flows out of
  AI services (throw vs. silent mock). The consumer chain (`useAIGeneration` ->
  `AIProgressOverlay.error` prop) must be verified end-to-end. Verified in R10.

## Context

### Production Symptom (2026-04-16)

User report: on `https://www.prioritas.ai`, every AI-driven action (generate ideas,
generate roadmap, generate insights) returns a plausible but generic response that
does not reflect the project context. No error toast. No progress-overlay error.
UI renders "success" state with mock data.

### Runtime Evidence

Captured from production Network tab and browser console:

1. `POST /api/ai?action=generate-ideas` -> **403** with body
   `{ "error": { "code": "CSRF_COOKIE_MISSING", ... } }`
2. `GET /api/auth?action=user` (called by `bootstrapCsrfCookie()` on app load) -> **401**
3. `POST /api/auth?action=refresh` (retry inside `bootstrapCsrfCookie`) -> **401**
4. `document.cookie` on `www.prioritas.ai`: no `csrf-token` cookie present
5. `localStorage.getItem('sb-<project>-auth-token')` returns a parsable session
   object with `access_token` set -- the client thinks it is logged in
6. UI state: "Generate Ideas" button enabled, no warning banner, no logout prompt

### Root Cause (HIGH confidence)

The user is in a **zombie session**: localStorage holds credentials that the
backend no longer accepts. When the app boots:

1. `bootstrapCsrfCookie()` (`src/hooks/useAuth.ts:73-118`) calls
   `GET /api/auth?action=user` with the localStorage access token.
2. The backend returns 401 (token expired or invalidated).
3. The recovery path attempts `supabase.auth.refreshSession()` and retries once.
   Both refresh and retry fail with 401.
4. `bootstrapCsrfCookie()` logs a warning and sets `csrfBootstrapped = false`.
   **There is no further recovery path in the session.** No UI notification.
   The user sees an authenticated-looking UI.
5. When the user clicks "Generate Ideas," `BaseAiService.fetchWithErrorHandling()`
   sends the request. The `csrf-token` cookie is absent, so the server returns
   403 `CSRF_COOKIE_MISSING`.
6. `IdeaGenerationService.generateMultipleIdeas()` catches the 403 at line 137,
   logs a warning, and returns `MockDataGenerator.generateMockIdeas(...)`. The
   UI renders the mock ideas as if they were real AI output.

The silent mock-fallback converts a zombie-session / CSRF failure into a
user-invisible bug. There is no operational signal in the UI, no error toast,
no console error surfaced to the user. Only a `logger.warn` line that is
throttled in production mode.

### Why ADR-0014's Fix Did Not Cover This

ADR-0014 assumed `bootstrapCsrfCookie()` would always succeed when the client
had a valid localStorage session. It did not contemplate:

- **Expired/invalidated server-side session while localStorage persists.** The
  401-after-refresh case has no further recovery.
- **CSRF cookie expiry mid-session.** The 1h `maxAge` on `csrf-token` means a
  user who keeps a tab open >1h loses CSRF even with a valid auth token.
- **Silent mock fallback amplifying the failure into user-invisible success.**
  This predates ADR-0014 and was not in its scope.

### Spec Challenge

**The spec assumes that extending `csrf-token` maxAge to 24h plus a 403 re-mint
retry will keep users out of zombie sessions.** If wrong, the design fails
because a user whose auth session is actually expired server-side will still
hit 401 on the re-mint attempt -- and we need a final-state recovery path.

Answer: the hard-force logout (user decision #1) is the final-state recovery.
It fires when the 401 refresh path exhausts. The 403 re-mint retry is a
middle-state recovery (auth valid, CSRF cookie missing/expired). The two
mechanisms compose: transient CSRF loss -> 403 re-mint fixes it; terminal auth
loss -> hard-force logout fixes it.

**SPOF: the 401-retry logic in `bootstrapCsrfCookie()` at `useAuth.ts:94-113`.**
Failure mode: if this function is called and both attempts return 401, the
current code sets `csrfBootstrapped = false` and continues silently. The user
is stuck in a zombie session with no recovery. **Graceful degradation:** this
ADR adds the hard-force logout path -- toast, 1s delay, clear auth localStorage,
navigate to `/login`. The 1s delay ensures the toast is visible before
navigation. Clearing localStorage guarantees the next load starts clean.

## Anti-Goals

1. **Anti-goal: Modal/inline re-auth prompt that preserves in-flight AI generation state.**
   Reason: Zombie-session recovery is a terminal event, not a pause-and-resume
   operation. The user's session is dead; the backend cannot honor in-flight
   requests under a new session without significant refactor. Hard-force is
   simpler, more predictable, and matches how every other major auth system
   handles 401 storms. Revisit: when we have a real demand for long-running
   AI operations that survive re-auth (months away, not weeks).

2. **Anti-goal: Infinite 403 re-mint retry loop.**
   Reason: A broken CSRF middleware or a permanently invalid session would
   trigger a retry storm. The single-attempt guard (per-request flag) caps
   retries to exactly 1. If the re-mint itself fails, we throw and let the
   user see the error. Revisit: never. The single-attempt guard is a
   structural correctness requirement.

3. **Anti-goal: Runtime env-var check for mock gating.**
   Reason: A runtime check (e.g., `if (process.env.USE_MOCK === 'true')`) would
   leave `MockDataGenerator` and `MockInsightsGenerator` code in the production
   bundle. An attacker or a misconfigured deploy could flip a flag and see mock
   data where real data is expected. Vite's static replacement of
   `import.meta.env.DEV` at build time guarantees dead-code elimination.
   The guarantee "mocks cannot ship to prod" must be bundler-enforced, not
   honor-system.

## Decision

**Fix the CSRF regression with four coordinated changes, shipped as one ADR in two
waves (P0 then P1).**

### Wave P0 -- CSRF Recovery and Zombie-Session Handling

1. **Extend `csrf-token` maxAge from 3600s to 86400s** in
   `api/_lib/middleware/cookies.ts:126`. Reduces the CSRF-loss surface by 24x.
   The access token still expires at 1h; if the access token is valid, the CSRF
   cookie outlasts it. If the access token expired, the 401 refresh path picks
   up.

2. **Add in-session 403 `CSRF_COOKIE_MISSING` recovery** in
   `BaseAiService.fetchWithErrorHandling()` at `src/lib/ai/services/BaseAiService.ts:143`.
   On 403 with `CSRF_COOKIE_MISSING` error code, call `bootstrapCsrfCookie()` once,
   then retry the original POST. Use a per-request `isCsrfRetry` flag so the retry
   cannot trigger a second re-mint. This guard is a parameter on
   `fetchWithErrorHandling`, **not a module-level state**, because concurrent AI
   requests (e.g., generate-ideas + generate-roadmap at the same time) must each
   get their own one-shot allowance.

3. **Hard-force zombie-session logout** when `bootstrapCsrfCookie()` exhausts
   its 401-refresh-retry path. Sequence:
   a. `showError('Your session expired, please sign in again')` via `ToastContext`
      (the only caller here is `useAuth`, which has a `ToastContext` consumer
      available through `useToast()`).
   b. `setTimeout(..., 1000)` so the toast renders before navigation clears it.
   c. Clear Supabase localStorage keys (`SUPABASE_STORAGE_KEY` plus
      `prioritasUser` plus any `sb-*-auth-token-code-verifier` keys).
   d. `window.location.href = '/login'`.

   **Implementation note:** `bootstrapCsrfCookie()` is currently called inside a
   non-component context (module-level function called from `useEffect`). Hoist
   the force-logout behavior into the calling `useEffect` in `useAuth.ts` where
   the `useToast()` hook is accessible. The bootstrap function returns an outcome
   (`'ok' | 'retryable' | 'terminal'`) and the caller reacts.

### Wave P1 -- Loud Errors and Mock Fallback Elimination

4. **Throw instead of silently returning mock** in all three AI services:
   - `IdeaGenerationService.generateIdea()` (line 68-76): replace
     `catch (_error) { return { content: title, ..., priority: 'moderate' } }`
     with `catch (error) { throw error }`. Remove the 200-empty branch at lines
     63-67 in favor of `throw new Error('AI returned no idea -- please try again')`.
   - `IdeaGenerationService.generateMultipleIdeas()` (line 137-141): replace
     `catch (_error) { ...; return MockDataGenerator.generateMockIdeas(...) }` with
     `catch (error) { throw error }`. Replace the 200-empty branch at lines 133-136
     with `throw new Error('AI returned no ideas -- please try again')`.
   - `RoadmapService.generateRoadmap()` (line 78-87): replace
     `catch (_error) { ...; return this.generateMockRoadmap(...) }` with
     `catch (error) { throw error }`. Replace the implicit 200-empty fallback
     at line 56 (`const roadmap = data.roadmap || this.generateMockRoadmap(...)`)
     with an explicit check: if `data.roadmap` is falsy, `throw new Error('AI returned no roadmap -- please try again')`.
   - `InsightsService.generateInsights()`: the catch at line 378 already throws
     in production (line 391-395). Remove the dev-only `isLocalhost()` mock
     branch at line 384-388 and the template-content mock branch at line 350-362
     -- replace both with `throw new Error('AI returned invalid insights -- please try again')`.
     The existing throw at line 376 stays but gets the same mock-gating treatment
     applied to the catch branches (see change #5).

5. **Gate `MockDataGenerator` / `MockInsightsGenerator` dynamic imports behind**
   `import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'`. This does
   NOT mean putting the gate inside a `catch` -- the catches throw
   unconditionally. The gate applies to any remaining DEV-only developer-testing
   entry points. The intent is structural: in a production bundle, no path in
   AI services can reach the mock modules, so Vite tree-shakes them entirely.
   Verification in the test spec asserts the prod bundle does not contain
   `MockDataGenerator` or `MockInsightsGenerator` strings.

## Alternatives Considered

### Per Architectural Decision

#### Decision 1: Zombie-session UX

- **A (CHOSEN): Hard-force logout with toast + 1s delay + navigate to `/login`.**
  Predictable, matches industry convention, zero state-preservation complexity.
- **B (Rejected): Inline re-auth modal preserving in-flight AI state.** Requires
  resuming in-flight fetches under a new session -- the backend cannot honor
  requests cross-session without significant refactor. High complexity for a
  rare edge case (zombie session).
- **C (Rejected): Blocking browser prompt.** Bad UX, not dismissible, does not
  fit the design system, does not render a branded message.

#### Decision 2: CSRF cookie resilience strategy

- **A (CHOSEN): Extend maxAge to 24h AND add 403 re-mint retry.** The maxAge
  extension reduces the rate of CSRF loss; the re-mint retry handles the
  residual cases (cookie cleared by browser, cross-device sync, etc.).
- **B (Rejected): maxAge extension only.** Does not handle in-session cookie
  loss (browser cookie jar full, user cleared cookies, extension interference).
- **C (Rejected): Re-mint retry only, keep 1h maxAge.** Every user who leaves a
  tab open >1h hits the re-mint path on their next action, adding a visible
  latency spike for a case that is better prevented than recovered.
- **D (Rejected): Module-level `isCsrfRetry` flag.** Concurrent AI requests
  (e.g., the insights panel firing on page load while the user also triggers
  roadmap generation) would share the flag -- one request consumes the one-shot
  allowance, the other gets no retry. Per-request flag avoids the race.

#### Decision 3: P1 scope

- **A (CHOSEN): All three services (Idea, Roadmap, Insights) in one ADR.**
  Single-ADR scope is justified because (i) the bug class is identical, (ii)
  the fix pattern is identical, (iii) partial fix would leave "sometimes you
  see mocks, sometimes you see errors" as a confusing user experience, and
  (iv) the test spec can reuse the same test template across services.
- **B (Rejected): Split into P0 (CSRF) + P1 (mock elimination) ADRs.** Extra
  ceremony with no benefit. The shared context (same bug, same services) makes
  one ADR more readable than two.

#### Decision 4: Mock gating mechanism

- **A (CHOSEN): `import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'`.**
  Vite performs static replacement at build time. The condition evaluates to
  `false && ...` in production, the entire branch is dead code, the import
  is tree-shaken, and the mock modules are not in the production bundle.
- **B (Rejected): `process.env.USE_MOCK === 'true'` (runtime).** Leaves mock
  code in the production bundle. Flag-flip can re-enable mocks in prod.
- **C (Rejected): Delete `MockDataGenerator` / `MockInsightsGenerator` entirely.**
  Developers do use them for local testing when the API is down. Keeping them
  DEV-gated preserves developer ergonomics without prod leakage.

## Consequences

### Positive

- Zombie sessions are now self-healing: either the session is valid and the
  user keeps working (re-mint), or it is not and the user is redirected to
  `/login` with a clear message.
- CSRF cookie expiry is no longer a 1h ticking clock; 24h aligns with typical
  working-session lengths.
- Every AI failure (403, 500, network, parse, timeout, empty-response) now
  surfaces a user-visible error via the existing `AIProgressOverlay` error UI.
- Production bundle no longer contains `MockDataGenerator` /
  `MockInsightsGenerator` -- smaller bundle, no risk of flag-flip leakage.
- Diagnostic signal improves dramatically: a silent 403 -> mock is now a
  visible 403 -> error toast, which users will report and which shows up in
  error telemetry.

### Negative

- **Users mid-generation during a zombie session will lose in-flight work.**
  The hard-force logout aborts any running AI request. This is acceptable
  because in-flight AI requests in a zombie session are already failing -- the
  user just does not know it yet.
- **Developers who relied on `MockDataGenerator` as a fallback when the API was
  down in local dev must explicitly opt in via `VITE_USE_MOCK=true`.**
  Documented in the runbook section.

### Neutral

- The 24h CSRF cookie lifetime is still within OWASP guidance (<= 24h for
  double-submit CSRF tokens bound to a session). No security posture change.
- `useAIGeneration` and `AIProgressOverlay` are unchanged -- the existing
  error-surface wiring already handles thrown errors from the services.

## Implementation Plan

Steps are ordered within each wave. Wave P0 lands first, Wave P1 follows.
Colby may implement them in a single commit chain; Roz verifies after each
step.

### Wave P0 -- CSRF Recovery and Zombie Sessions

#### Step 1: Extend csrf-token cookie maxAge to 24h

**Files to modify:**
- `api/_lib/middleware/cookies.ts:126` (change `maxAge: 60 * 60` to `maxAge: 60 * 60 * 24`)
- `api/auth.ts:396` (change `maxAge: 60 * 60` in `handleGetUser` CSRF-mint branch to `maxAge: 60 * 60 * 24`)

**Acceptance criteria:**
- Both call sites set maxAge to 86400 seconds (24h)
- The access token maxAge remains at 3600s (1h) -- they are intentionally
  different so the access-token refresh flow is exercised first
- A source grep confirms no other `maxAge` related to CSRF_TOKEN cookie
  remains at 3600

**Complexity:** Low (2 file:line edits, both 1-character changes)

#### Step 2: Add per-request 403 CSRF_COOKIE_MISSING re-mint retry

**Files to modify:**
- `src/lib/ai/services/BaseAiService.ts` (add `isCsrfRetry` parameter and retry
  logic in `fetchWithErrorHandling`)
- `src/hooks/useAuth.ts` (export `bootstrapCsrfCookie` so BaseAiService can
  call it directly; currently it is module-internal)

**Acceptance criteria:**
- `fetchWithErrorHandling` signature gains an `isCsrfRetry = false` parameter
  (last position, after `isRetry` and `signal`), analogous to the existing
  `isRetry` flag
- On `response.status === 403`, parse the error body. If
  `errorBody.error.code === 'CSRF_COOKIE_MISSING'` and `!isCsrfRetry`:
  1. Call `bootstrapCsrfCookie()` (forced re-bootstrap -- the imported
     function must accept a `force` flag to bypass the `csrfBootstrapped`
     module-level guard for this path)
  2. Recursively call `fetchWithErrorHandling(endpoint, payload, isRetry, signal, true)`
- If `isCsrfRetry === true` AND the retry also returns 403, throw
  `new Error('CSRF cookie could not be re-established')` -- no third attempt
- Per-request flag: each top-level call starts with `isCsrfRetry = false`.
  Concurrent calls from separate services get independent one-shot allowances.
  A module-level flag would be incorrect here.
- The existing 401 retry path is unchanged

**Complexity:** Medium (2 files, retry logic touches hot path, concurrency-sensitive)

#### Step 3: Hard-force logout on terminal CSRF bootstrap failure

**Files to modify:**
- `src/hooks/useAuth.ts` (refactor `bootstrapCsrfCookie` to return a typed
  outcome; add caller logic in the `useEffect` that invokes it; import
  `useToast` and call `showError` + `setTimeout` + localStorage clear +
  navigate)

**Acceptance criteria:**
- `bootstrapCsrfCookie` returns `Promise<'ok' | 'retryable' | 'terminal'>`:
  - `'ok'`: cookie is present (either pre-existing or newly minted)
  - `'retryable'`: transient failure (network, 500) -- caller should retry
    on next app interaction but NOT force logout
  - `'terminal'`: both the initial call AND the refresh retry returned 401,
    meaning the session is dead server-side
- In the `useEffect` caller at `useAuth.ts:574`, when outcome is `'terminal'`:
  1. `toast.showError('Your session expired, please sign in again')`
  2. `setTimeout(() => { ... }, 1000)` -- 1000ms delay
  3. Inside the setTimeout callback: clear localStorage keys
     `SUPABASE_STORAGE_KEY`, `'prioritasUser'`, and any
     `sb-*-auth-token-code-verifier` keys (use `Object.keys(localStorage).filter(...)`)
  4. `window.location.href = '/login'`
- Demo-mode flow (`isDemoUUID` in `useAuth.ts:298`) is not affected because
  demo users never call `bootstrapCsrfCookie` (the degraded-auth fallback
  path that invokes it is only reached for non-demo sessions)
- If `useToast()` is not available in `useAuth.ts` scope (check: `useAuth`
  may be called before `ToastProvider` wraps the tree), fall back to a
  `window.alert`-free inline error state that triggers the same localStorage
  clear + navigate sequence. Verify during implementation whether
  `ToastProvider` wraps `useAuth`'s mount point.

**Complexity:** Medium (1 file, but changes state machine semantics and
provider ordering assumptions)

### Wave P1 -- Loud Errors and Mock Elimination

#### Step 4: Replace silent mock fallbacks with thrown errors in IdeaGenerationService

**Precondition (owns T-0014-023b and T-0014-024b):**

Before writing any new IdeaGenerationService tests, Colby must invert or delete
two assertions in `src/lib/ai/services/__tests__/BaseAiService.test.ts` that
codify the old mock-fallback-on-500 behavior this step eliminates:

- **T-0014-023b** (`describe` at line 455, `it` at line 456): asserts
  `RoadmapService.generateRoadmap` returns mock data on 500. **Action: invert
  in place** -- change the assertion to `expect(roadmapService.generateRoadmap(...)).rejects.toThrow()`.
  (This test is also modified by Step 5; coordinate with Roz's test authoring
  order accordingly.)
- **T-0014-024b** (`describe` at line 502, `it` at line 503): asserts
  `IdeaGenerationService.generateIdea` returns a mock idea on 500. **Action:
  invert in place** -- change the assertion to
  `expect(ideaService.generateIdea(...)).rejects.toThrow()`.

**T-0014-025 audit result:** T-0014-025 (`describe` at line 516) tests
`InsightsService.generateInsights` succeeding on a valid 200 response. It does
NOT assert mock-fallback behavior and does NOT need inversion. It serves as a
regression guard for the happy path and must remain green after Step 6.

**Chosen action: invert in place (not delete).** The inverted tests remain as
regression guards confirming that the throw-on-error contract holds. Deleting
them would leave no negative assertion covering the 500-error path in the
shared BaseAiService test file.

**Files to modify:**
- `src/lib/ai/services/IdeaGenerationService.ts`
- `src/lib/ai/services/__tests__/BaseAiService.test.ts` (invert T-0014-023b, T-0014-024b)

**Acceptance criteria:**
- Line 68-76 (`generateIdea` catch): replaced with
  `} catch (error) { logger.error('Error generating idea:', error); throw error }`
  (preserve log, remove fallback object)
- Line 63-67 (`generateIdea` 200-empty): replaced with
  `throw new Error('AI returned no idea -- please try again')`
- Line 137-141 (`generateMultipleIdeas` catch): replaced with
  `} catch (error) { logger.error('AI generation failed:', error); throw error }`
- Line 133-136 (`generateMultipleIdeas` 200-empty): replaced with
  `throw new Error('AI returned no ideas -- please try again')`
- Dynamic imports of `MockDataGenerator` at lines 65, 134, 139 are removed
  from `IdeaGenerationService.ts` entirely
- AbortError special-case is preserved (rethrow without logging as error)

**Complexity:** Low (1 file, 4 edits)

#### Step 5: Replace silent mock fallbacks with thrown errors in RoadmapService

**Files to modify:**
- `src/lib/ai/services/RoadmapService.ts`

**Acceptance criteria:**
- Line 78-87 catch: replaced with
  `} catch (error) { if (error instanceof Error && error.name === 'AbortError') throw error; logger.error('AI roadmap failed:', error); throw error }`
- Line 56 `const roadmap = data.roadmap || this.generateMockRoadmap(...)`:
  replaced with explicit check:
  `if (!data.roadmap) throw new Error('AI returned no roadmap -- please try again'); const roadmap = data.roadmap`
- `generateMockRoadmap()` private method (lines 99-216) is **deleted** entirely
  (no remaining caller after the two fallbacks are removed)

**Complexity:** Low (1 file, 2 edits + method deletion)

#### Step 6: Replace silent mock fallbacks with thrown errors in InsightsService

**Files to modify:**
- `src/lib/ai/services/InsightsService.ts`

**Acceptance criteria:**
- Line 350-362 (template-content mock branch): the
  `checkForTemplateContent` logic stays, but the mock-return is replaced with
  `throw new Error('AI returned generic template content -- please try again')`.
  The dynamic import of `MockInsightsGenerator` is removed from this branch.
- Line 373-377 (200-empty): existing throw is preserved (already correct).
- Line 384-388 (`isLocalhost()` dev-mock branch): removed entirely. The
  `apiError` catch now unconditionally executes the line 391-395 throw.
- Line 378-396 refactored to: if AbortError, rethrow; else log and throw
  `new Error(\`Failed to generate insights: ${...}\`)`.
- `isLocalhost()` helper at `BaseAiService.ts:242-244` is **deleted** (no
  remaining caller).

**Complexity:** Low (1 file modified + 1 helper removed)

#### Step 7: Verify mock-code absence from production bundle

**Files to touch:**
- `vite.config.ts` (verify -- likely no change needed)
- New test: `src/test/prodBundleMockAbsence.test.ts` (or equivalent
  integration-level check)

**Acceptance criteria:**
- Build the production bundle with `npm run build`
- Search the emitted `dist/assets/*.js` for the strings `generateMockIdeas`,
  `generateMockIdea`, `generateMockRoadmap`, `generateProjectSpecificMockInsights`,
  `generateMockInsightsWithFiles`
- Assertion: NONE of these strings appear in the production bundle
- This is an integration test (CI gate), not a Vitest unit test

**Note:** Since Step 4-6 remove all non-dev imports of the mock modules, Vite's
default tree-shaking should remove them. The mock files themselves are NOT
deleted -- they remain available for developer use via a future explicit
DEV-only entry point or direct import in tests. The gate is that no
production-bundled code path reaches them.

**Complexity:** Low (CI verification, no source changes unless tree-shaking
fails to work, in which case we would add an explicit `if (import.meta.env.DEV
&& import.meta.env.VITE_USE_MOCK === 'true')` gate around any remaining
DEV-only entry point)

## Test Specification

Tests are authored by Roz before Colby builds. Every assertion has its own
test ID. Failure-path tests outnumber happy-path tests.

### Contract Boundaries

| Producer | Consumer | Shape | Contract Risk |
|----------|----------|-------|---------------|
| `bootstrapCsrfCookie()` (new return type) | `useEffect` in `useAuth.ts:574` | `Promise<'ok' \| 'retryable' \| 'terminal'>` | High -- new return type, caller must handle all three |
| `setSecureCookie(CSRF_TOKEN, ..., { maxAge: 86400 })` | Browser cookie jar | 24h maxAge | Medium -- mismatch with access-token 1h is intentional |
| `fetchWithErrorHandling(..., isCsrfRetry)` | Self (recursive) | Per-request flag | High -- concurrency safety depends on per-call flag, not module-level |
| `IdeaGenerationService.generateMultipleIdeas` (throws on any error) | `useAIGeneration.execute` | `Promise<IdeaCard[]>` OR throws | High -- caller chain (`AIProgressOverlay.error`) must render the thrown message |
| `RoadmapService.generateRoadmap` (throws on any error) | `ProjectRoadmap.generateRoadmap` | `Promise<any>` OR throws | High -- existing `state.error` path in component must catch |
| `InsightsService.generateInsights` (throws on any error, no dev-mock) | `AIInsightsModal` / facade | `Promise<InsightsReport>` OR throws | High -- removing the `isLocalhost()` branch changes dev-mode behavior |

### Test Table

| ID | Category | Description | Step |
|---|---|---|---|
| T-0016-001 | unit | `setSecureCookie` called in `setAuthCookies` sets CSRF cookie with `maxAge: 86400` | 1 |
| T-0016-002 | unit | `handleGetUser` CSRF-mint branch sets cookie with `maxAge: 86400` | 1 |
| T-0016-003 | unit | Access-token cookie maxAge remains at 3600 (regression guard) | 1 |
| T-0016-004 | unit | Refresh-token cookie maxAge remains at `60*60*24*7` (regression guard) | 1 |
| T-0016-005 | unit | `bootstrapCsrfCookie` happy path (cookie present) returns `'ok'` without network call | 2 |
| T-0016-006 | unit | `bootstrapCsrfCookie` successful mint returns `'ok'` after 200 from `/api/auth?action=user` | 2 |
| T-0016-007 | unit | `bootstrapCsrfCookie` 401-then-refresh-then-200 returns `'ok'` | 2 |
| T-0016-008 | unit | `bootstrapCsrfCookie` 401-then-refresh-then-401 returns `'terminal'` | 3 |
| T-0016-009 | unit | `bootstrapCsrfCookie` 500 on initial call returns `'retryable'` | 2 |
| T-0016-010 | unit | `bootstrapCsrfCookie` network error returns `'retryable'` | 2 |
| T-0016-011 | unit | `fetchWithErrorHandling` on 403 `CSRF_COOKIE_MISSING` with `isCsrfRetry=false` calls `bootstrapCsrfCookie(force=true)` exactly once | 2 |
| T-0016-012 | unit | `fetchWithErrorHandling` on 403 `CSRF_COOKIE_MISSING` with `isCsrfRetry=false` retries the POST exactly once | 2 |
| T-0016-013 | unit | `fetchWithErrorHandling` on 403 `CSRF_COOKIE_MISSING` after retry re-mint succeeds returns the retry response | 2 |
| T-0016-014 | unit | `fetchWithErrorHandling` on 403 `CSRF_COOKIE_MISSING` with `isCsrfRetry=true` throws `'CSRF cookie could not be re-established'` (no 3rd attempt) | 2 |
| T-0016-015 | unit | `fetchWithErrorHandling` on 403 WITHOUT `CSRF_COOKIE_MISSING` code does NOT trigger re-mint (propagates as server error) | 2 |
| T-0016-016 | integration | Two concurrent `fetchWithErrorHandling` calls each get their own one-shot re-mint allowance (no shared flag) | 2 |
| T-0016-017 | unit | 401 retry path from ADR-0014 still fires when response is 401 (regression) | 2 |
| T-0016-018 | component | When `bootstrapCsrfCookie` returns `'terminal'`, `useAuth` calls `showError('Your session expired, please sign in again')` | 3 |
| T-0016-019 | component | When `bootstrapCsrfCookie` returns `'terminal'`, `useAuth` waits 1000ms before navigating | 3 |
| T-0016-020 | component | When `bootstrapCsrfCookie` returns `'terminal'`, localStorage keys `SUPABASE_STORAGE_KEY`, `'prioritasUser'` are cleared | 3 |
| T-0016-021 | component | When `bootstrapCsrfCookie` returns `'terminal'`, any `sb-*-auth-token-code-verifier` keys are cleared | 3 |
| T-0016-022 | component | When `bootstrapCsrfCookie` returns `'terminal'`, `window.location.href` is set to `/login` | 3 |
| T-0016-023 | component | When `bootstrapCsrfCookie` returns `'retryable'`, NO toast/logout fires | 3 |
| T-0016-024 | component | When `bootstrapCsrfCookie` returns `'ok'`, NO toast/logout fires | 3 |
| T-0016-025 | component | Demo user flow (`isDemoUUID` returns true) does NOT invoke `bootstrapCsrfCookie` terminal path | 3 |
| T-0016-026 | unit | `IdeaGenerationService.generateIdea` on 403 throws; does NOT return fallback object | 4 |
| T-0016-027 | unit | `IdeaGenerationService.generateIdea` on 500 throws; does NOT return fallback object | 4 |
| T-0016-028 | unit | `IdeaGenerationService.generateIdea` on network error throws | 4 |
| T-0016-029 | unit | `IdeaGenerationService.generateIdea` on parse error throws | 4 |
| T-0016-030 | unit | `IdeaGenerationService.generateIdea` on 200-empty `data.ideas` throws `'AI returned no idea -- please try again'` | 4 |
| T-0016-031 | unit | `IdeaGenerationService.generateIdea` on AbortError rethrows AbortError (does NOT wrap) | 4 |
| T-0016-032 | unit | `IdeaGenerationService.generateMultipleIdeas` on 403 throws; no `MockDataGenerator` call | 4 |
| T-0016-033 | unit | `IdeaGenerationService.generateMultipleIdeas` on 500 throws | 4 |
| T-0016-034 | unit | `IdeaGenerationService.generateMultipleIdeas` on timeout throws | 4 |
| T-0016-035 | unit | `IdeaGenerationService.generateMultipleIdeas` on 200-empty `data.ideas` throws `'AI returned no ideas -- please try again'` | 4 |
| T-0016-036 | unit | `IdeaGenerationService` happy path still returns mapped ideas on 200 with populated `data.ideas` (regression) | 4 |
| T-0016-037 | unit | `RoadmapService.generateRoadmap` on 403 throws | 5 |
| T-0016-038 | unit | `RoadmapService.generateRoadmap` on 500 throws | 5 |
| T-0016-039 | unit | `RoadmapService.generateRoadmap` on network error throws | 5 |
| T-0016-040 | unit | `RoadmapService.generateRoadmap` on 200-empty `data.roadmap` throws `'AI returned no roadmap -- please try again'` | 5 |
| T-0016-041 | unit | `RoadmapService.generateRoadmap` on AbortError rethrows AbortError | 5 |
| T-0016-042 | unit | `RoadmapService.generateRoadmap` happy path returns roadmap on 200 with populated `data.roadmap` (regression) | 5 |
| T-0016-043 | unit | `RoadmapService` no longer exposes `generateMockRoadmap` (method removed) | 5 |
| T-0016-044 | unit | `InsightsService.generateInsights` on 403 throws in production | 6 |
| T-0016-045 | unit | `InsightsService.generateInsights` on 500 throws | 6 |
| T-0016-046 | unit | `InsightsService.generateInsights` on 200-empty insights throws (existing behavior regression) | 6 |
| T-0016-047 | unit | `InsightsService.generateInsights` on template-content detection throws `'AI returned generic template content -- please try again'`; does NOT call `MockInsightsGenerator` | 6 |
| T-0016-048 | unit | `InsightsService.generateInsights` in dev mode (simulated localhost) on 500 throws (no dev-mock fallback) | 6 |
| T-0016-049 | unit | `InsightsService.generateInsights` happy path returns insights on 200 with valid shape (regression) | 6 |
| T-0016-050 | unit | `InsightsService.generateInsights` on AbortError rethrows AbortError | 6 |
| T-0016-051 | unit | `BaseAiService` no longer exposes `isLocalhost()` helper (method removed) | 6 |
| T-0016-052 | integration | `useAIGeneration.execute` catches thrown error from service and sets `error` state (regression -- error surface wiring) | 4/5/6 |
| T-0016-053 | integration | `AIProgressOverlay` renders `aiGeneration.error` text when error is non-null (regression -- verifies the toast-surface claim) | 4/5/6 |
| T-0016-054 | build | Production bundle (`dist/assets/*.js`) does NOT contain `generateMockIdeas` string | 7 |
| T-0016-055 | build | Production bundle does NOT contain `generateMockIdea` string | 7 |
| T-0016-056 | build | Production bundle does NOT contain `generateMockRoadmap` string | 7 |
| T-0016-057 | build | Production bundle does NOT contain `generateProjectSpecificMockInsights` string | 7 |
| T-0016-058 | build | Production bundle does NOT contain `generateMockInsightsWithFiles` string | 7 |
| T-0016-059 | regression | ADR-0014 test T-0014-001 still passes (`credentials: 'include'` present) | P0+P1 |
| T-0016-060 | regression | ADR-0014 test T-0014-005 still passes (401 refresh-and-retry) | P0+P1 |
| T-0016-061 | regression | `npm run build` succeeds end-to-end | 7 |
| T-0016-062 | regression | `npm run type-check` passes after all steps | P0+P1 |

| T-0016-063 | unit | `bootstrapCsrfCookie` sets `csrfBootstrapped` flag ONLY after network call returns 200 -- flag is `false` while fetch is pending and on any non-200 response | 2/3 |
| T-0016-064 | component | `useAuth` useEffect at `useAuth.ts:574` awaits `bootstrapCsrfCookie` return value and dispatches terminal-logout when return value is `'terminal'` (not as an internal side effect of the function) | 3 |
| T-0016-065 | unit | `bootstrapCsrfCookie(force=true)` fires a network call even when `csrfBootstrapped` is already `true` (guard-bypass) | 2 |

**Authoring notes (from Roz NIT-2):** T-0016-043 ("RoadmapService no longer
exposes `generateMockRoadmap`") -- use `expect('generateMockRoadmap' in
roadmapService).toBe(false)` rather than a TypeScript cast. T-0016-054 through
T-0016-058 (bundle checks) are not Vitest tests; author as a standalone Node
script at `scripts/verify-bundle-no-mocks.mjs` invoked as a CI step after
`npm run build`.

**Failure paths (T-0016-026 through T-0016-048 + T-0016-063): 24 failure tests vs 11 happy
paths.** Ratio honors the design principle that the bug is a failure-path
regression.

### Data Sensitivity

| Method | Tag | Rationale |
|--------|-----|-----------|
| `bootstrapCsrfCookie()` (new signature) | `auth-only` | Operates on session tokens and cookies |
| `fetchWithErrorHandling(..., isCsrfRetry)` | `auth-only` | Sends auth credentials |
| `IdeaGenerationService.generate*` | `auth-only` | Requires valid session |
| `RoadmapService.generateRoadmap` | `auth-only` | Requires valid session |
| `InsightsService.generateInsights` | `auth-only` | Requires valid session |
| `MockDataGenerator.*` (if still exists after build) | `public-safe` | Hardcoded sample data, no sensitive content; but MUST NOT ship to prod per Step 7 |

## Wiring Coverage

| Producer | Shape | Consumer | Step |
|----------|-------|----------|------|
| `setSecureCookie(CSRF_TOKEN, ..., maxAge: 86400)` | 24h cookie | Browser + `fetchWithErrorHandling` CSRF header auto-include | 1 |
| `fetchWithErrorHandling` re-mint retry logic | Recursive call + retry flag | `IdeaGenerationService`, `RoadmapService`, `InsightsService` (inherited) | 2 |
| `bootstrapCsrfCookie` outcome (`'ok'\|'retryable'\|'terminal'`) | Typed return | `useEffect` caller in `useAuth.ts:574` | 3 |
| `showError + setTimeout + clearLocalStorage + navigate` | User-visible logout flow | User (browser navigation) | 3 |
| Throw from `IdeaGenerationService` | `Error` propagated | `useAIGeneration.execute` catch -> `setError(message)` | 4 |
| Throw from `RoadmapService` | `Error` propagated | `ProjectRoadmap.generateRoadmap` catch -> `state.error` state | 5 |
| Throw from `InsightsService` | `Error` propagated | `AIInsightsModal` caller / facade | 6 |
| Tree-shaken mock absence | No-op (verified negative) | Production bundle integrity | 7 |

No orphan producers. Every producer has a consumer in the same or earlier step.

## Blast Radius

### Files Modified
| File | Step | Change |
|------|------|--------|
| `api/_lib/middleware/cookies.ts` | 1 | CSRF maxAge 3600 -> 86400 |
| `api/auth.ts` | 1 | CSRF maxAge 3600 -> 86400 in `handleGetUser` |
| `src/lib/ai/services/BaseAiService.ts` | 2, 6 | Add `isCsrfRetry` param + 403 recovery; delete `isLocalhost()` helper |
| `src/hooks/useAuth.ts` | 2, 3 | Export `bootstrapCsrfCookie` with `force` flag + new outcome type; add terminal-outcome handler in useEffect |
| `src/lib/ai/services/__tests__/BaseAiService.test.ts` | 4 | Invert T-0014-023b (~L455) and T-0014-024b (~L502): assert throws instead of mock-fallback |
| `src/lib/ai/services/IdeaGenerationService.ts` | 4 | Remove mock fallbacks, throw on error |
| `src/lib/ai/services/RoadmapService.ts` | 5 | Remove mock fallback + `generateMockRoadmap` method |
| `src/lib/ai/services/InsightsService.ts` | 6 | Remove dev-mock + template-content mock branches |

### Files NOT Modified (verified safe)
| File | Why safe |
|------|----------|
| `src/lib/ai/mocks/MockDataGenerator.ts` | Kept for dev-only use; tree-shaken from prod |
| `src/lib/ai/mocks/MockInsightsGenerator.ts` | Same |
| `src/hooks/useAIGeneration.ts` | Already catches thrown errors and sets `error` state (verified) |
| `src/components/ui/AIProgressOverlay.tsx` | Already renders `error` prop (verified at line 125) |
| `src/components/AIIdeaModal.tsx`, `src/components/ProjectRoadmap/ProjectRoadmap.tsx` | Existing `try/catch` + `state.error` UI already handle thrown errors |
| `src/contexts/ToastContext.tsx` | `showError` already exists with the needed signature |
| `api/ai.ts` | Server-side CSRF check unchanged (still rejects missing cookie with 403) |
| `api/_lib/middleware/withCSRF.ts` | Unchanged; the 403 code path still fires as before -- client is what adapts |

### CI/CD Impact
- New CI gate: production-bundle mock-absence check (Step 7). Low-cost
  integration test that greps the build output.
- No environment variable changes.
- No deployment config changes.

## UI Specification

Applies to Step 3 only (terminal-session logout flow).

| Step | UI elements introduced | Sort order | Color coding | States | Nav wiring | Layout context |
|------|------------------------|-----------|--------------|--------|-----------|----------------|
| 3 | Toast via existing `ToastContext.showError` -- no new component | n/a | `bg-red-500 text-white` (existing error style, `ToastContext.tsx:85`) | Toast present for 5000ms (default duration) OR until navigation overrides; then /login page renders fresh | `window.location.href = '/login'` (hard navigation) after 1000ms | Existing `fixed top-4 right-4` toast container; `/login` is the existing login route |

All other steps are non-UI changes (backend cookies, service-layer error semantics).
Existing `AIProgressOverlay` error rendering is regression-tested (T-0016-053),
not newly wired.

## Notes for Colby

### Caller Chain Verified -- Error Surface is NOT ToastContext

The constraint asked us to assume `useAIGeneration` routes errors to
`ToastContext.showError`. Verification showed otherwise:

- `useAIGeneration.execute` at `src/hooks/useAIGeneration.ts:297` sets
  `error` via `setError(message)` on the hook's local state.
- Consumers (`AIIdeaModal`, `ProjectRoadmap`) pass `aiGeneration.error` as a
  prop to `AIProgressOverlay`.
- `AIProgressOverlay` renders `<p className="text-sm text-garnet-700 mb-3">{error}</p>`
  at line 125.

This is a **local-state error surface**, not a global toast. For zombie-session
logout (Step 3), we DO use `ToastContext.showError` because the failure is
session-level, not AI-request-level. For P1 service errors (Steps 4-6), the
existing local-state surface is sufficient -- no toast wiring change needed.

### Per-Request `isCsrfRetry` Flag, Not Module-Level

A module-level `let isCsrfRetry = false` would be incorrect because multiple
AI services can fire concurrent requests (e.g., `generate-ideas` from
`AIIdeaModal` + `generate-insights` from the background panel). A single
shared flag means one request consumes the one-shot allowance and the other
gets no retry. Use a parameter on `fetchWithErrorHandling`, analogous to the
existing `isRetry` parameter.

### `bootstrapCsrfCookie` Force Flag

The existing `csrfBootstrapped` module-level boolean prevents repeat bootstrap
calls. For the in-session 403 re-mint case, we need to bypass this guard. Add
a `force = false` parameter; when `true`, ignore the guard and reset it after
the bootstrap attempt.

### ToastProvider Ordering

Verify that `useAuth` is mounted inside `ToastProvider`. If not (e.g., `useAuth`
runs during early app bootstrap before `ToastProvider` wraps), fall back to
skipping the toast and going straight to the localStorage-clear + navigate
sequence. The clear + navigate are the critical path; the toast is UX polish.
Check `src/main.tsx` or the root `AppProviders` composition to confirm.

### MockDataGenerator / MockInsightsGenerator Files Stay

Per Decision C-rejection in "Decision 4: Mock gating mechanism," the mock
modules remain on disk. They are NOT deleted. They are simply not imported
from any production code path. Developers can still use them via explicit
test imports or a future DEV-gated entry point.

### Step Sizing Verification

| Step | Files | S1 Demoable | S2 Context-bounded | S3 Independently verifiable | S4 Revert-cheap | S5 Already small |
|------|-------|-------------|--------------------|-----------------------------|-----------------|------------------|
| 1 | 2 | "After this step, new sessions get 24h CSRF cookies" | 2 files | Yes -- inspect Set-Cookie header | Yes | Yes |
| 2 | 2 | "After this step, mid-session 403 CSRF_COOKIE_MISSING self-heals once" | 2 files | Yes -- mock fetch, verify re-mint + retry | Yes | Yes |
| 3 | 1 | "After this step, zombie sessions force re-login with toast" | 1 file | Yes -- component test with mock bootstrap outcomes | Yes | Yes |
| 4 | 2 | "After this step, IdeaGeneration errors surface as user-visible errors" | 2 files (source + test inversion) | Yes -- unit + integration | Yes | Yes |
| 5 | 1 | "After this step, Roadmap errors surface as user-visible errors" | 1 file | Yes | Yes | Yes |
| 6 | 1 | "After this step, Insights errors surface as user-visible errors in all environments" | 1 file | Yes | Yes | Yes |
| 7 | 0 (CI gate) | "After this step, prod bundle is mock-free" | Grep build output | Yes -- build log assertion | n/a | Yes |

All steps pass the 5-test sizing gate. No step touches more than 2 files.

### Migration and Rollback

This ADR changes cookie maxAge (Step 1) and adds new error paths (Steps 2-6).

- **Migration:** no DB migration needed. Cookie maxAge change applies to newly
  minted cookies; existing cookies in user browsers are unaffected until they
  expire (at which point the new 24h cookie replaces them).
- **Rollback window:** full ADR reverts cleanly via a single `git revert` of the
  ADR-implementing commits. The cookie maxAge extension does not break older
  clients (they will still honor the longer-lived cookie). The 403 re-mint
  retry is additive -- reverting removes recovery but does not introduce new
  failures.
- **Single-step rollback strategy:** revert the commits for Steps 2-6 first
  (removes the in-session recovery and re-introduces mock fallbacks if a user-
  visible error regression is reported). Step 1 (cookie maxAge) can stay or
  revert independently.

## DoD -- Definition of Done

| DoR # | Requirement | Status | Evidence |
|-------|-------------|--------|----------|
| R1 | Mint CSRF cookie on 401 bootstrap | Covered | Step 2 (403 re-mint during AI request handles the in-session case); Step 3 handles terminal case |
| R2 | Hard-force logout on terminal auth failure | Covered | Step 3, T-0016-008, T-0016-018 through T-0016-022, T-0016-064 (call-site await) |
| R3 | 403 in-session re-mint | Covered | Step 2, T-0016-011 through T-0016-014, T-0016-065 (force-bypass) |
| R4 | CSRF maxAge 24h | Covered | Step 1, T-0016-001, T-0016-002 |
| R5 | Eliminate IdeaGenerationService silent mock | Covered | Step 4, T-0016-026 through T-0016-036 |
| R6 | Eliminate RoadmapService silent mock | Covered | Step 5, T-0016-037 through T-0016-043 |
| R7 | Eliminate InsightsService silent mock | Covered | Step 6, T-0016-044 through T-0016-051 |
| R8 | Mock code tree-shaken from prod bundle | Covered | Step 7, T-0016-054 through T-0016-058 |
| R9 | 200-empty branches throw distinct errors | Covered | T-0016-030, T-0016-035, T-0016-040, T-0016-046 |
| R10 | Error surface verified as `useAIGeneration` -> `AIProgressOverlay`, not ToastContext | Covered | T-0016-052, T-0016-053 (regression) |
| R11 | Demo-mode flow unchanged | Covered | T-0016-025 |
| R12 | ADR-0014 behavior intact | Covered | T-0016-017, T-0016-059, T-0016-060 |

No silent drops. All 12 DoR items map to implementation steps and test IDs.

## References

- **ADR-0014:** `docs/architecture/ADR-0014-ai-service-auth-hardening.md` (extends,
  does not supersede)
- **Investigation ledger:** `docs/pipeline/investigation-ledger.md`
- **Runtime evidence:** production Network tab captures, 2026-04-16
- **Cookie middleware:** `api/_lib/middleware/cookies.ts`
- **CSRF middleware:** `api/_lib/middleware/withCSRF.ts`
- **AI service base class:** `src/lib/ai/services/BaseAiService.ts`
- **Auth hook:** `src/hooks/useAuth.ts`
- **Error surface hook:** `src/hooks/useAIGeneration.ts`
- **Error renderer:** `src/components/ui/AIProgressOverlay.tsx`
