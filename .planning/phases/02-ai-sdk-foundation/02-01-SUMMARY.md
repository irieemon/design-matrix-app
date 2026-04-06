---
phase: 02-ai-sdk-foundation
plan: 01
subsystem: api
tags: [ai-sdk, vercel-ai-gateway, model-router, openai, anthropic, minimax]

# Dependency graph
requires:
  - phase: 01-security-hardening-production-fixes
    provides: Middleware chain (withAuth, withCSRF, withUserRateLimit, compose)
provides:
  - AI SDK v6 installed and configured with Vercel AI Gateway provider
  - Gateway provider factory (getModel) for all three providers
  - Capability-based model router (selectModel) enforcing vision/audio constraints
  - Shared utilities (parseJsonResponse, mapUsageToTracking, getProjectTypePersona)
  - Wave 0 test stubs for handler migrations in Plans 02 and 03
  - Barrel export (api/_lib/ai/index.ts) for handler imports
affects: [02-ai-sdk-foundation plan 02, 02-ai-sdk-foundation plan 03]

# Tech tracking
tech-stack:
  added: [ai@6.x (Vercel AI SDK with built-in gateway provider)]
  patterns: [lazy gateway initialization for serverless, capability-based model routing, AI SDK usage-to-tracking format mapping]

key-files:
  created:
    - api/_lib/ai/providers.ts
    - api/_lib/ai/modelRouter.ts
    - api/_lib/ai/utils/parsing.ts
    - api/_lib/ai/utils/tokenTracking.ts
    - api/_lib/ai/utils/prompts.ts
    - api/_lib/ai/index.ts
    - api/_lib/ai/__tests__/utils.test.ts
    - api/_lib/ai/__tests__/router.test.ts
    - api/_lib/ai/__tests__/handlers/ideas.test.ts
    - api/_lib/ai/__tests__/handlers/insights.test.ts
    - api/_lib/ai/__tests__/handlers/roadmap.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "AI SDK v6 LanguageModelUsage uses inputTokens/outputTokens (not promptTokens/completionTokens as plan stated) -- mapUsageToTracking adapted to actual SDK types"
  - "Gateway provider uses lazy singleton pattern to avoid serverless cold-start env var issues"
  - "Model router defaults all text tasks to openai/gpt-4o as primary provider"

patterns-established:
  - "Lazy gateway initialization: never create provider at module top level in serverless"
  - "Capability-based routing: selectModel enforces vision!=minimax, audio=whisper-1"
  - "Usage mapping: AI SDK camelCase -> snake_case for existing trackTokenUsage DB function"
  - "TDD workflow: RED (failing tests) -> GREEN (implementation) -> commit per phase"

requirements-completed: [AI-01, AI-02, AI-03]

# Metrics
duration: 8min
completed: 2026-04-06
---

# Phase 2 Plan 01: AI SDK Foundation Summary

**AI SDK v6 with Vercel AI Gateway, capability-based model router enforcing vision/audio constraints, and shared utilities for handler migrations**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-06T19:49:38Z
- **Completed:** 2026-04-06T19:57:38Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Installed AI SDK v6 with built-in Vercel AI Gateway provider (single package, no separate provider packages needed)
- Created capability-based model router that enforces hard constraints: vision tasks never route to MiniMax, audio tasks always route to whisper-1
- Built shared utilities (JSON parsing, token tracking, prompt builders) consolidating repeated logic from the 2550-line api/ai.ts monolith
- Established Wave 0 test scaffolding with 26 passing tests and 7 todo stubs for Plans 02/03

## Task Commits

Each task was committed atomically:

1. **Task 1: Install AI SDK and create provider + utility foundations**
   - `fe253ff` (test: failing tests for parseJsonResponse and mapUsageToTracking)
   - `809a2fc` (feat: install AI SDK v6, providers.ts, parsing.ts, tokenTracking.ts, prompts.ts)
2. **Task 2: Create model router with capability-based routing and Wave 0 test stubs**
   - `2741ba7` (test: failing tests for model router capability routing)
   - `f3bbd28` (feat: modelRouter.ts, router tests, Wave 0 handler stubs, barrel index.ts)

_TDD tasks have two commits each (RED: test -> GREEN: feat)_

## Files Created/Modified
- `api/_lib/ai/providers.ts` - Gateway provider factory with lazy initialization
- `api/_lib/ai/modelRouter.ts` - Capability-based model selection (selectModel)
- `api/_lib/ai/utils/parsing.ts` - JSON extraction from AI responses (strips markdown fences)
- `api/_lib/ai/utils/tokenTracking.ts` - AI SDK usage to snake_case DB format mapping
- `api/_lib/ai/utils/prompts.ts` - Shared getProjectTypePersona extracted from api/ai.ts
- `api/_lib/ai/index.ts` - Barrel export for all providers, router, and utilities
- `api/_lib/ai/__tests__/utils.test.ts` - 11 tests for parsing and token tracking
- `api/_lib/ai/__tests__/router.test.ts` - 15 tests for capability routing rules
- `api/_lib/ai/__tests__/handlers/ideas.test.ts` - 3 todo stubs for Plan 02
- `api/_lib/ai/__tests__/handlers/insights.test.ts` - 2 todo stubs for Plan 02
- `api/_lib/ai/__tests__/handlers/roadmap.test.ts` - 2 todo stubs for Plan 03
- `package.json` - Added ai@^6.0.149 dependency
- `package-lock.json` - Updated lockfile

## Decisions Made
- **AI SDK usage field names:** The plan referenced `promptTokens`/`completionTokens` but the actual AI SDK v6 `LanguageModelUsage` type uses `inputTokens`/`outputTokens`/`totalTokens`. Adapted `mapUsageToTracking` to map from actual SDK field names. [Rule 1 - Bug fix for plan inaccuracy]
- **Gateway lazy singleton:** Provider instance created on first `getModel()` call, not at module level, to handle serverless env var timing correctly.
- **Model ID choices:** Using `openai/gpt-4o` as primary for all text tasks. The model router is designed to be easily updated with newer model IDs as they become available.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected AI SDK usage field names in tokenTracking**
- **Found during:** Task 1 (TDD RED phase - writing tests)
- **Issue:** Plan specified `promptTokens`/`completionTokens`/`totalTokens` but actual AI SDK v6 `LanguageModelUsage` type uses `inputTokens`/`outputTokens`/`totalTokens`
- **Fix:** Updated interface and mapping to use actual SDK field names: `inputTokens` -> `prompt_tokens`, `outputTokens` -> `completion_tokens`
- **Files modified:** `api/_lib/ai/utils/tokenTracking.ts`, `api/_lib/ai/__tests__/utils.test.ts`
- **Verification:** All 11 utility tests pass; types match AI SDK source (`node_modules/ai/dist/index.d.ts`)
- **Committed in:** `809a2fc` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix for plan inaccuracy)
**Impact on plan:** Essential correction to match actual SDK API. No scope creep.

## Issues Encountered
- Full test suite has pre-existing failures in unrelated tests (connectionPool, performanceMonitor, useProjectFiles, Textarea) -- these are NOT caused by AI SDK installation. The new AI-specific tests (26 passing, 7 todo) all pass cleanly.

## User Setup Required

**External services require manual configuration.** Per plan frontmatter `user_setup`:
- `AI_GATEWAY_API_KEY`: Provision in Vercel Dashboard -> Project Settings -> AI Gateway
- `MINIMAX_API_KEY`: Add to Vercel environment variables for gateway BYOK routing

These are needed before handlers can make actual AI calls (Plans 02/03).

## Next Phase Readiness
- Foundation complete: providers, router, utilities, and test scaffolding are ready
- Plans 02 and 03 can import from `api/_lib/ai/index.ts` to migrate handlers
- Wave 0 test stubs (7 it.todo) are ready to be implemented as handlers are migrated
- No blockers for proceeding

---
*Phase: 02-ai-sdk-foundation*
*Completed: 2026-04-06*
