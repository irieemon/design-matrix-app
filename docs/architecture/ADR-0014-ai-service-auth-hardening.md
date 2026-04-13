# ADR-0014: AI Service Layer Auth/CSRF Hardening

## Status

Proposed

## DoR -- Definition of Ready

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| R1 | Fix `credentials: 'include'` missing from `BaseAiService.fetchWithErrorHandling()` | Research brief (scout-verified) | Ready |
| R2 | Fix `credentials: 'include'` missing from legacy `aiInsightsService` fetch calls | Research brief (scout-verified, AIInsightsModal direct import) | Ready |
| R3 | Migrate `AIInsightsModal.tsx` from legacy `aiInsightsService` to facade (`aiService`) | Research brief (only direct legacy consumer left) | Ready |
| R4 | Remove dead legacy services (`aiIdeaService.ts`, `aiRoadmapService.ts`) | Research brief (no direct importers outside tests) | Ready |
| R5 | Remove or fix legacy `aiInsightsService.ts` after migration | Research brief (AIInsightsModal is sole consumer) | Ready |
| R6 | Remove hardcoded `'Bearer placeholder-token'` from any surviving code | Research brief (aiIdeaService.ts:54, aiRoadmapService.ts:85) | Ready |
| R7 | Add 401 token refresh to AI service layer (match `apiClient.ts` pattern) | Existing pattern in `apiClient.ts:188-207` | Ready |
| R8 | ADR-0013 model profile routing continues to work | context-brief.md | Ready |
| R9 | All existing working AI features remain unbroken | Constraint | Ready |

**Retro risks:**
- Lesson 005 (Frontend Wiring Omission): This ADR changes the service import in `AIInsightsModal.tsx`. The facade's `generateInsights()` method signature must match what the component passes. Verified: facade signature is a subset of legacy signature -- `preferredModel` param exists on legacy but not on facade. This must be handled in Step 2.
- Lesson 001 (Sensitive Data in Return Shapes): Not directly applicable -- no new data access methods.

## Context

Production users receive `403 CSRF_COOKIE_MISSING` when calling AI endpoints. The root cause is that `BaseAiService.fetchWithErrorHandling()` -- the fetch wrapper used by all modular AI services introduced in ADR-0013 -- does not include `credentials: 'include'` in its fetch options. Without this, browsers do not send cookies (including the `csrf-token` cookie) with cross-origin or same-site requests where credential policy matters.

The CSRF middleware (`api/_lib/middleware/withCSRF.ts`) uses a double-submit cookie pattern:
1. Reads `csrf-token` from cookies (line 55)
2. Reads `X-CSRF-Token` from headers (line 68)
3. Compares them with constant-time comparison (line 81)

Without `credentials: 'include'`, the browser never sends the cookie, so check 1 fails with `CSRF_COOKIE_MISSING`.

Additionally, `AIInsightsModal.tsx` imports the legacy `aiInsightsService` directly instead of going through the facade, bypassing the ADR-0013 refactored service layer entirely.

Three legacy service files (`aiIdeaService.ts`, `aiRoadmapService.ts`, `aiInsightsService.ts`) remain in the codebase. Two of them have hardcoded `'Bearer placeholder-token'` auth headers. None of them include `credentials: 'include'`.

### Current Call Chain (broken)

```
Component (e.g., ProjectRoadmap.tsx)
  -> aiService (legacy wrapper, src/lib/aiService.ts)
    -> AiServiceFacade
      -> RoadmapService.generateRoadmap()
        -> BaseAiService.fetchWithErrorHandling()  <-- MISSING credentials: 'include'
          -> fetch() without cookies -> server returns 403 CSRF_COOKIE_MISSING
```

### AIInsightsModal Call Chain (bypasses facade)

```
AIInsightsModal.tsx
  -> aiInsightsService (legacy, direct import)
    -> fetch() without credentials: 'include' -> 403 CSRF_COOKIE_MISSING
```

### Reference Implementation (working)

`apiClient.ts` (line 180): `credentials: 'include'` -- always sends cookies. Auto-injects CSRF headers for mutations (line 125-131). Auto-refreshes on 401 (line 189-207).

## Decision

**Fix `BaseAiService` in place; do NOT migrate to `apiClient` now. Remove legacy services. Migrate AIInsightsModal to the facade.**

### Decision 1: Fix BaseAiService vs. migrate to apiClient

**Decision: Fix BaseAiService in place.** Add `credentials: 'include'` and 401 retry logic to `fetchWithErrorHandling()`.

Rationale: `apiClient` is a singleton class with its own lifecycle (`configure()`, `onUnauthorized` callback). The AI service layer has its own class hierarchy (`BaseAiService` -> `RoadmapService`/`InsightsService`/`IdeaGenerationService`), caching (`getOrSetCache`), and domain-specific error handling. Merging them would mean either (a) making `apiClient` understand AI caching and domain errors, or (b) making AI services delegates of `apiClient` -- both are larger refactors that risk breaking ADR-0013's model profile routing. The one-line fix (`credentials: 'include'`) plus a small 401-retry handler solves the production bug cleanly.

Future consideration: A unified HTTP client could be pursued later. Not now.

### Decision 2: Remove legacy services or keep with fixes

**Decision: Remove `aiIdeaService.ts` and `aiRoadmapService.ts` entirely. Remove `aiInsightsService.ts` after migrating AIInsightsModal.** These are dead code (only test files import the first two). The barrel export (`src/lib/ai/index.ts`) will drop the legacy re-exports.

### Decision 3: Migrate AIInsightsModal to facade

**Decision: Migrate.** The component currently calls `aiInsightsService.generateInsights()` with a `preferredModel` parameter that the facade's `generateInsights()` does not accept. The facade delegates to `InsightsService` (modular), which also does not accept `preferredModel`. However, the legacy `aiInsightsService.generateInsights()` uses `preferredModel` for model routing via `OpenAIModelRouter`. This logic must be preserved -- either by adding the parameter to the facade/InsightsService, or by passing it through the existing `projectContext`. The cleanest path: add `preferredModel` as an optional parameter to the facade's `generateInsights()` and to `InsightsService.generateInsights()`.

## Anti-Goals

1. **Anti-goal: Unify all HTTP clients into a single `apiClient`.** Reason: The AI service layer has domain-specific concerns (caching, model routing, multi-modal payloads) that would bloat `apiClient` or require a complex adapter. The production fix does not require architectural unification. Revisit: When a new service layer is added that would benefit from shared HTTP infrastructure, or when `apiClient` gains enough features (retry, caching) to serve as a universal base.

2. **Anti-goal: Add CSRF retry logic (wait-for-cookie-then-retry on 403).** Reason: The `waitForCsrfToken()` utility exists in `cookieUtils.ts` but the root cause here is not timing -- it is that cookies are never sent. Adding `credentials: 'include'` fixes the transport; adding retry adds unnecessary complexity for a problem that will not occur once cookies are sent. Revisit: If production telemetry shows 403s persisting after this fix due to cookie timing races on cold page loads.

3. **Anti-goal: Per-service `apiClient` instances (one for AI, one for admin, etc.).** Reason: Adds configuration surface without solving any current problem. Each service already has its own class. Revisit: When services need different base URLs or auth strategies.

## Spec Challenge

**The spec assumes that adding `credentials: 'include'` to `BaseAiService.fetchWithErrorHandling()` will fix the 403 for all AI endpoints.** If wrong, the design fails because the csrf-token cookie might not be set in the first place (e.g., returning users who never hit the auth endpoint that mints the cookie). However, this was already fixed in commit `28ca010` ("fix(auth): resolve pre-existing auth/CSRF issues") which mints the csrf-token cookie during session validation for returning users (`api/auth.ts:382-392`). The prior fix handles cookie issuance; this ADR handles cookie transmission.

**SPOF: The `csrf-token` cookie issuance flow in `api/auth.ts`.** Failure mode: If the session validation endpoint fails or is never called (e.g., app boots without calling `/api/auth?action=session`), no csrf-token cookie exists, and all CSRF-protected endpoints return 403 even with `credentials: 'include'`. Graceful degradation: The `getCsrfToken()` utility returns null, `getAuthHeaders()` omits the `X-CSRF-Token` header, and the server returns a clear `CSRF_COOKIE_MISSING` error. The user sees a specific error, not a silent failure.

## Alternatives Considered

### A: Migrate all AI services to use `apiClient.post()`

Replace `BaseAiService.fetchWithErrorHandling()` internals with `apiClient.post()`. This would give us CSRF injection, 401 refresh, and `credentials: 'include'` for free.

**Rejected because:** Would require making `apiClient` handle AI-specific caching, error mapping, and domain responses. The AI service class hierarchy (BaseAiService -> subclasses) would become a thin wrapper around `apiClient` with unclear value. Risk of breaking ADR-0013's model profile routing during refactor. Higher blast radius (8+ files) for a fix that needs 2 files.

### B: Fix legacy services in place (keep them alive)

Add `credentials: 'include'` and real auth tokens to all three legacy services.

**Rejected because:** Maintains two parallel code paths (legacy + modular) indefinitely. The legacy services were explicitly deprecated in the ADR-0013 refactor. Only one component still uses them. Better to finish the migration.

### C: Do nothing about legacy services, fix only BaseAiService

Minimal fix: add `credentials: 'include'` to `BaseAiService` only.

**Rejected because:** AIInsightsModal would remain broken (it imports legacy service directly). Dead code with hardcoded placeholder tokens remains in the codebase -- a security smell and maintenance burden.

## Consequences

### Positive
- All AI endpoints (roadmap, insights, idea generation) will send cookies and CSRF headers correctly
- Dead code with hardcoded `'Bearer placeholder-token'` is removed
- Single code path for all AI service calls (through the facade)
- 401 token refresh covers the AI service layer (previously unhandled)

### Negative
- Legacy service test files need to be removed or rewritten against the modular services
- Minor risk: AIInsightsModal's `preferredModel` plumbing through the facade could introduce a regression if the parameter is not threaded correctly

### Neutral
- `apiClient` remains a separate HTTP client used only by `useSecureAuth`, `SecureAuthContext`, and `AdminContext` -- no convergence with AI services yet

## Implementation Plan

### Step 1: Fix BaseAiService fetch and add 401 retry

**After this step, all AI endpoints that go through the facade (roadmap, idea generation, insights via facade) will send cookies and handle token expiry.**

Files to modify:
- `src/lib/ai/services/BaseAiService.ts` (add `credentials: 'include'` to fetch, add 401 retry logic)

Acceptance criteria:
- `fetchWithErrorHandling()` includes `credentials: 'include'` in fetch options
- On 401 response, attempts token refresh via `POST /api/auth?action=refresh` with `credentials: 'include'`, then retries the original request once
- On second 401, throws `Error` with clear message (no infinite retry)
- Existing `getAuthHeaders()` (CSRF + Bearer token) is unchanged
- All three modular services (RoadmapService, InsightsService, IdeaGenerationService) inherit the fix automatically via class hierarchy

Complexity: Low (1 file, ~20 lines changed)

### Step 2: Migrate AIInsightsModal to facade and thread preferredModel

**After this step, AIInsightsModal uses the same secure service path as all other AI components.**

Files to modify:
- `src/lib/ai/services/InsightsService.ts` (add optional `preferredModel` parameter to `generateInsights()`)
- `src/lib/ai/AiServiceFacade.ts` (add optional `preferredModel` parameter to `generateInsights()`, pass through)
- `src/components/AIInsightsModal.tsx` (change import from legacy `aiInsightsService` to `aiService` facade, adapt call signature)

Acceptance criteria:
- `AIInsightsModal.tsx` imports `aiService` from `'../lib/aiService'` (the facade wrapper)
- `aiService.generateInsights()` accepts and passes through the `preferredModel` parameter
- `InsightsService.generateInsights()` uses `preferredModel` for model selection (same logic as legacy service)
- The component's existing behavior (progress tracking, caching, error handling, historical insights) is preserved
- No import of any legacy AI service remains in non-test `src/` files

Complexity: Medium (3 files modified, parameter threading across layers)

### Step 3: Remove legacy services and clean barrel export

**After this step, dead code is gone. The barrel export only re-exports modular services.**

Files to modify:
- `src/lib/ai/aiIdeaService.ts` (DELETE)
- `src/lib/ai/aiRoadmapService.ts` (DELETE)
- `src/lib/ai/aiInsightsService.ts` (DELETE)
- `src/lib/ai/index.ts` (remove legacy re-exports)

Files to delete (test files for deleted services):
- `src/lib/ai/__tests__/aiIdeaService.test.ts` (DELETE)
- `src/lib/ai/__tests__/aiRoadmapService.test.ts` (DELETE)
- `src/lib/ai/__tests__/aiInsightsService.test.ts` (DELETE)

Files to modify (test that mocks legacy service):
- `src/components/__tests__/AIInsightsModal.test.tsx` (update mock to target facade instead of legacy service)

Acceptance criteria:
- No file named `aiIdeaService.ts`, `aiRoadmapService.ts`, or `aiInsightsService.ts` exists under `src/lib/ai/`
- `src/lib/ai/index.ts` has no `AIIdeaService`, `AIInsightsService`, or `AIRoadmapService` exports
- `AIInsightsModal.test.tsx` mocks `../lib/aiService` (the facade wrapper), not the legacy service
- `npm run build` succeeds with no import resolution errors
- `npm run type-check` passes
- All existing tests that were NOT testing deleted legacy services still pass

Complexity: Medium (4 files deleted, 2 files modified, 3 test files deleted/replaced)

## Test Specification

### Contract Boundaries

| Producer | Consumer | Shape | Contract Risk |
|----------|----------|-------|---------------|
| `BaseAiService.fetchWithErrorHandling()` | `RoadmapService`, `InsightsService`, `IdeaGenerationService` | `fetch()` with `credentials: 'include'` + CSRF header + Bearer token | High -- missing `credentials` is the root cause |
| `BaseAiService.getAuthHeaders()` | `fetchWithErrorHandling()` | `{ Authorization, X-CSRF-Token, Content-Type }` | Medium -- CSRF token may be null |
| `AiServiceFacade.generateInsights()` | `AIInsightsModal.tsx` | `(ideas, projectName?, projectType?, projectId?, currentProject?, preferredModel?) => Promise<InsightsReport>` | High -- parameter mismatch between legacy and facade |
| `InsightsService.generateInsights()` | `AiServiceFacade` | Must accept and use `preferredModel` parameter | High -- new parameter threading |
| `src/lib/ai/index.ts` barrel | All consumers | Must NOT export deleted legacy classes | Medium -- stale imports break build |

### Test Table

| ID | Category | Description | Step |
|---|---|---|---|
| T-0014-001 | unit | `fetchWithErrorHandling` includes `credentials: 'include'` in fetch options | 1 |
| T-0014-001b | regression | `fetchWithErrorHandling` sends `credentials: 'include'` when called from inside a `getOrSetCache` callback (not just on direct invocation) | 1 |
| T-0014-002 | unit | `fetchWithErrorHandling` sends `Authorization` header with Bearer token from localStorage | 1 |
| T-0014-003 | unit | `fetchWithErrorHandling` sends `X-CSRF-Token` header when csrf-token cookie exists | 1 |
| T-0014-004 | unit | `fetchWithErrorHandling` omits `X-CSRF-Token` header when csrf-token cookie is missing (does not throw) | 1 |
| T-0014-005 | unit | `fetchWithErrorHandling` retries once on 401 after successful token refresh | 1 |
| T-0014-005b | unit | After 401 retry succeeds, the retry request uses refreshed auth headers (not the original expired token) | 1 |
| T-0014-006 | unit | `fetchWithErrorHandling` throws after 401 when token refresh fails | 1 |
| T-0014-007 | unit | `fetchWithErrorHandling` throws after second consecutive 401 (no infinite retry) | 1 |
| T-0014-008 | unit | `fetchWithErrorHandling` propagates 429 rate-limit error without retry | 1 |
| T-0014-009 | unit | `fetchWithErrorHandling` propagates 500 server error without retry | 1 |
| T-0014-010 | unit | `getAuthHeaders` returns Bearer token from localStorage when session exists | 1 |
| T-0014-011 | unit | `getAuthHeaders` returns basic headers (no Authorization) when localStorage is empty | 1 |
| T-0014-012 | integration | `AiServiceFacade.generateInsights()` passes `preferredModel` through to InsightsService | 2 |
| T-0014-013 | unit | `InsightsService.generateInsights()` includes `modelSelection` in the request payload body when `preferredModel` is provided — asserts `body.modelSelection.model` equals `preferredModel` | 2 |
| T-0014-014 | unit | `InsightsService.generateInsights()` includes default model in request payload body when `preferredModel` is undefined — asserts `body.modelSelection.model` equals the router default | 2 |
| T-0014-015 | component | `AIInsightsModal` renders and calls `aiService.generateInsights` (facade mock) when modal opens with ideas — does NOT assert `Authorization: 'Bearer placeholder-token'` | 2 |
| T-0014-016 | component | `AIInsightsModal` passes `preferredModel` prop through to `aiService.generateInsights()` | 2 |
| T-0014-017 | component | `AIInsightsModal` displays insights report after successful generation (existing behavior preserved) | 2 |
| T-0014-018 | build | `npm run build` succeeds after legacy service deletion | 3 |
| T-0014-019 | build | `npm run type-check` passes after legacy service deletion | 3 |
| T-0014-020 | unit | `src/lib/ai/index.ts` does NOT export `AIIdeaService`, `AIInsightsService`, or `AIRoadmapService` | 3 |
| T-0014-021 | grep | No non-test file under `src/` imports from `aiIdeaService`, `aiRoadmapService`, or `aiInsightsService` | 3 |
| T-0014-022 | component | `AIInsightsModal.test.tsx` mocks facade wrapper, not legacy service | 3 |
| T-0014-023 | regression | `RoadmapService.generateRoadmap()` succeeds with mocked 200 response (credentials sent) | 1 |
| T-0014-023b | regression | `RoadmapService.generateRoadmap()` preserves existing error shape on 500 (regression) | 1 |
| T-0014-024 | regression | `IdeaGenerationService.generateIdea()` succeeds with mocked 200 response (credentials sent) | 1 |
| T-0014-024b | regression | `IdeaGenerationService.generateIdea()` preserves existing error shape on 500 (regression) | 1 |
| T-0014-025 | regression | `InsightsService.generateInsights()` succeeds with mocked 200 response (credentials sent) | 1 |

Failure path tests (T-0014-004 through T-0014-009) outnumber happy path tests -- this is intentional. The 403 bug was a failure-path problem.

**Implementation notes:**
- T-0014-018/019 (build tests) are CI gate checks run via `npm run build` and `npm run type-check`, not Vitest unit tests.
- T-0014-010/011 confirm pre-existing `getAuthHeaders` behavior -- these are not new behavior tests, they guard against regressions during Step 1 changes.
- When rewriting `AIInsightsModal.test.tsx` (Step 3), delete any assertion for `Authorization: 'Bearer placeholder-token'` from the test.

### Data Sensitivity

| Method | Tag | Rationale |
|--------|-----|-----------|
| `BaseAiService.getAuthHeaders()` | `auth-only` | Returns Bearer token and CSRF token |
| `BaseAiService.fetchWithErrorHandling()` | `auth-only` | Sends authenticated requests with credentials |
| `AiServiceFacade.generateInsights()` | `auth-only` | Delegates to authenticated endpoint |
| `AiServiceFacade.generateRoadmap()` | `auth-only` | Delegates to authenticated endpoint |
| `AiServiceFacade.generateIdea()` | `auth-only` | Delegates to authenticated endpoint |
| `InsightsService.generateInsights()` | `auth-only` | Calls authenticated endpoint |
| `RoadmapService.generateRoadmap()` | `auth-only` | Calls authenticated endpoint |
| `IdeaGenerationService.generateIdea()` | `auth-only` | Calls authenticated endpoint |

## Wiring Coverage

| Producer | Shape | Consumer | Step |
|----------|-------|----------|------|
| `BaseAiService.fetchWithErrorHandling()` (with `credentials: 'include'`) | `fetch()` call with cookies | `RoadmapService`, `InsightsService`, `IdeaGenerationService` | 1 |
| `InsightsService.generateInsights(preferredModel?)` | New optional parameter | `AiServiceFacade.generateInsights()` | 2 |
| `AiServiceFacade.generateInsights(preferredModel?)` | Passthrough parameter | `AIInsightsModal.tsx` | 2 |
| `src/lib/ai/index.ts` (cleaned barrel) | No legacy exports | All consumers of barrel import | 3 |
| `AIInsightsModal.test.tsx` (updated mock) | Mock targets facade | `AIInsightsModal` component test | 3 |

No orphan producers. Every producer has a consumer in the same or earlier step.

## Blast Radius

### Files Modified
| File | Step | Change |
|------|------|--------|
| `src/lib/ai/services/BaseAiService.ts` | 1 | Add `credentials: 'include'`, add 401 retry |
| `src/lib/ai/services/InsightsService.ts` | 2 | Add `preferredModel` parameter |
| `src/lib/ai/AiServiceFacade.ts` | 2 | Add `preferredModel` passthrough |
| `src/components/AIInsightsModal.tsx` | 2 | Change import, adapt call |
| `src/lib/ai/index.ts` | 3 | Remove legacy exports |
| `src/components/__tests__/AIInsightsModal.test.tsx` | 3 | Update mock target |

### Files Deleted
| File | Step | Reason |
|------|------|--------|
| `src/lib/ai/aiIdeaService.ts` | 3 | Dead code, no importers |
| `src/lib/ai/aiRoadmapService.ts` | 3 | Dead code, no importers |
| `src/lib/ai/aiInsightsService.ts` | 3 | Sole consumer migrated in Step 2 |
| `src/lib/ai/__tests__/aiIdeaService.test.ts` | 3 | Tests deleted service |
| `src/lib/ai/__tests__/aiRoadmapService.test.ts` | 3 | Tests deleted service |
| `src/lib/ai/__tests__/aiInsightsService.test.ts` | 3 | Tests deleted service |

### Files NOT Modified (verified safe)
| File | Why safe |
|------|----------|
| `src/lib/aiService.ts` (facade wrapper) | Already delegates to `AiServiceFacade`; no change needed |
| `src/lib/ai/aiService.ts` (video analysis) | Already has `credentials: 'include'` (line 55) |
| `src/lib/apiClient.ts` | Not touched -- separate HTTP client |
| `api/ai.ts` | Server-side, not affected by client-side fetch changes |
| `api/_lib/middleware/withCSRF.ts` | Server-side, not changed |
| All other components using `aiService` | Already go through facade |

### CI/CD Impact
- None. No build config, deployment config, or environment variable changes.

## Notes for Colby

### Proven Pattern: 401 Retry in apiClient

The 401 retry logic in `apiClient.ts` (lines 188-207) is the reference implementation. Key details:
- Singleton refresh promise prevents concurrent refresh attempts (`let refreshPromise: Promise<boolean> | null = null`)
- Refresh calls `POST /api/auth?action=refresh` with `credentials: 'include'`
- Retry count cap prevents infinite loops (`retryCount < 3`)
- On refresh failure, throws with clear error

For `BaseAiService`, a simpler version is appropriate (single retry, no singleton promise needed since AI calls are less frequent than general API calls). The pattern:
```
if (response.status === 401 && !isRetry) {
  const refreshed = await refreshToken()
  if (refreshed) return this.fetchWithErrorHandling(endpoint, payload, true)
  throw new Error('Authentication expired')
}
```

### AIInsightsModal Migration: Parameter Mismatch

The legacy `aiInsightsService.generateInsights()` signature:
```typescript
generateInsights(ideas, projectName?, projectType?, projectId?, currentProject?, preferredModel?)
```

The facade's current signature:
```typescript
generateInsights(ideas, projectName?, projectType?, projectId?, currentProject?)
```

Add `preferredModel?: OpenAIModel` as the 6th parameter to both `AiServiceFacade.generateInsights()` and `InsightsService.generateInsights()`. The `InsightsService` should implement the model selection override logic currently in the legacy service (lines 194-201 of `aiInsightsService.ts`).

### Barrel Export Cleanup

After deleting legacy files, `src/lib/ai/index.ts` should remove these three lines:
```typescript
export { AIIdeaService, aiIdeaService } from './aiIdeaService'
export { AIInsightsService, aiInsightsService } from './aiInsightsService'
export { AIRoadmapService, aiRoadmapService } from './aiRoadmapService'
```

### Step Sizing Verification

| Step | Files | S1 Demoable | S2 Context-bounded | S3 Independently verifiable | S4 Revert-cheap | S5 Already small |
|------|-------|-------------|--------------------|-----------------------------|-----------------|------------------|
| 1 | 1 | "After this step, AI roadmap/insights/idea generation sends cookies and handles 401" | 1 file | Yes -- mock fetch, verify credentials and retry | Yes -- single file revert | Yes |
| 2 | 4 | "After this step, AIInsightsModal uses the secure service path with model selection" | 4 files | Yes -- component renders, facade passes model | Yes -- revert 4 files | Yes |
| 3 | 8 (4 delete + 2 modify + 2 delete tests) | "After this step, dead legacy AI code is removed" | 8 files but 6 are deletions | Yes -- build and type-check pass | Yes -- re-add deleted files | Deletions are inherently low-risk |

## DoD -- Definition of Done

| DoR # | Requirement | Status | Evidence |
|-------|-------------|--------|----------|
| R1 | Fix `credentials: 'include'` in BaseAiService | Covered | Step 1, T-0014-001 |
| R2 | Fix `credentials: 'include'` in legacy aiInsightsService | Covered | Step 2 migrates away from it; Step 3 deletes it |
| R3 | Migrate AIInsightsModal to facade | Covered | Step 2, T-0014-015, T-0014-016 |
| R4 | Remove dead legacy services | Covered | Step 3, T-0014-020, T-0014-021 |
| R5 | Remove/fix legacy aiInsightsService | Covered | Step 3 (delete after migration) |
| R6 | Remove hardcoded placeholder tokens | Covered | Step 3 (files deleted) |
| R7 | Add 401 token refresh to AI services | Covered | Step 1, T-0014-005 through T-0014-007 |
| R8 | ADR-0013 model profile routing works | Covered | No server-side changes; model routing is in InsightsService (Step 2 preserves it) |
| R9 | Existing AI features unbroken | Covered | T-0014-023 through T-0014-025 (regression tests) |

No silent drops. All 9 DoR items map to implementation steps and test IDs.
