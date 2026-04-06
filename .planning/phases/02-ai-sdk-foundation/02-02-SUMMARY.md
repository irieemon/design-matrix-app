---
phase: 02-ai-sdk-foundation
plan: 02
subsystem: ai-handlers
tags: [ai-sdk, migration, text-handlers, tdd]
dependency_graph:
  requires: [02-01]
  provides: [handleGenerateIdeas, handleGenerateInsights, handleGenerateRoadmap]
  affects: [api/ai.ts, api/_lib/ai/index.ts]
tech_stack:
  added: []
  patterns: [ai-sdk-generateText, model-router, gateway-provider]
key_files:
  created:
    - api/_lib/ai/generateIdeas.ts
    - api/_lib/ai/generateInsights.ts
    - api/_lib/ai/generateRoadmap.ts
  modified:
    - api/_lib/ai/index.ts
    - api/_lib/ai/__tests__/handlers/ideas.test.ts
    - api/_lib/ai/__tests__/handlers/insights.test.ts
    - api/_lib/ai/__tests__/handlers/roadmap.test.ts
decisions:
  - Preserved process.env.OPENAI_API_KEY checks for fallback routing (gateway handles actual auth)
  - Moved handler-specific prompt builders into their handler files per D-06
  - Preserved rate limiting in insights handler at handler level (not middleware)
metrics:
  duration: 25m
  completed: "2026-04-06T20:45:00Z"
  tasks: 2/2
  tests: 25 new tests (51 total in AI suite)
  files_created: 3
  files_modified: 4
---

# Phase 02 Plan 02: Text Handler Migration Summary

Three core text-only AI handlers (ideas, insights, roadmap) extracted from monolithic api/ai.ts into standalone files using AI SDK generateText() via the gateway, with full TDD coverage and identical response shapes preserved.

## Tasks Completed

| Task | Name | Commit(s) | Key Files |
|------|------|-----------|-----------|
| 1 | Extract generateIdeas and generateInsights handlers | 5231343, 205258e | generateIdeas.ts, generateInsights.ts, ideas.test.ts, insights.test.ts |
| 2 | Extract generateRoadmap handler + barrel update | 3ce4437, 0e159cb | generateRoadmap.ts, roadmap.test.ts, index.ts |

## What Changed

### generateIdeas.ts
- Replaced raw `fetch('https://api.openai.com/v1/chat/completions')` with `generateText({ model: getModel(selection.gatewayModelId), ... })`
- Uses `selectModel({ task: 'generate-ideas' })` for model selection
- Uses `parseJsonResponse()` for JSON extraction (replaces inline markdown stripping)
- Uses `mapUsageToTracking(usage)` for token format conversion
- Preserves: InputValidator validation, checkLimit/trackAIUsage/trackTokenUsage call order, getProjectTypePersona prompts, identical `{ ideas: [...] }` response shape
- T-02-05: Input validation preserved from original
- T-02-06: Error responses exclude raw AI SDK details in production
- T-02-07: checkLimit is first operation after auth

### generateInsights.ts
- Replaced raw fetch to both OpenAI and Anthropic APIs with AI SDK generateText()
- Anthropic fallback preserved: if OpenAI generateText fails, retries with `getModel('anthropic/claude-3-5-sonnet-20241022')`
- Preserved: rate limiting, multi-modal content processing (cached file analysis), complex prompt construction, identical `{ insights: {...} }` response shape
- Handler-specific helpers (processCachedFileAnalysis, prompt builders) moved into this file per D-06

### generateRoadmap.ts
- Replaced raw fetch to OpenAI with AI SDK generateText()
- Handles both 'generate-roadmap' and 'generate-roadmap-v2' actions
- Preserved: project-type-specific personas and prompts, clarifying questions, industry insights, identical `{ roadmap: {...} }` response shape
- Handler-specific prompt builders (getRoadmapPersona, getRoadmapClarifyingQuestions, etc.) moved into this file per D-06

### index.ts (barrel)
- Added exports for handleGenerateIdeas, handleGenerateInsights, handleGenerateRoadmap
- These will be imported by the thin router in Plan 03

## Test Results

- **ideas.test.ts**: 9 tests -- JSON shape, checkLimit ordering, 403 on limit, token tracking, trackAIUsage, selectModel, getModel integration, validation failure, production error handling
- **insights.test.ts**: 7 tests -- JSON shape, selectModel, getModel integration, Anthropic fallback, missing ideas validation, no AI service, invalid JSON handling
- **roadmap.test.ts**: 9 tests -- JSON shape, v1/v2 format, selectModel, getModel integration, missing fields validation, no AI service, JSON parse failure, project type adaptation
- **All 51 AI tests passing** (including Plan 01 router and utils tests)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All handlers are fully functional with real AI SDK integration (mocked in tests).

## Self-Check: PASSED

- All 7 key files exist on disk
- All 4 commits verified in git history
- 51/51 AI tests passing
