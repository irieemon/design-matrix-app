---
phase: 02-ai-sdk-foundation
plan: 03
subsystem: api
tags: [ai-sdk, vercel-ai-gateway, openai, whisper, vision, multimodal, refactor]

requires:
  - phase: 02-01
    provides: providers.ts (getModel), modelRouter.ts (selectModel), middleware composition
  - phase: 02-02
    provides: generateIdeas, generateInsights, generateRoadmap handlers, barrel index.ts

provides:
  - analyzeFile handler using generateText() with sub-handlers for image, audio, and text
  - analyzeImage handler using generateText() with AI SDK vision content parts
  - transcribeAudio handler using experimental_transcribe + generateText two-step pipeline
  - Thin router (74 lines) replacing the 2550-line monolithic api/ai.ts
  - Complete AI SDK migration — zero raw fetch() calls to OpenAI/Anthropic in api/

affects: [03-security, frontend-ai-calls, vercel-functions]

tech-stack:
  added: [experimental_transcribe (ai package), @ai-sdk/openai (transcription targeted exception)]
  patterns:
    - Vision content parts format for image analysis (messages array with type 'image')
    - Two-step transcription pipeline (experimental_transcribe -> generateText)
    - Targeted exception pattern for transcription (gateway lacks transcription model support)
    - Thin router dispatching to extracted handlers via switch/action

key-files:
  created:
    - api/_lib/ai/analyzeFile.ts
    - api/_lib/ai/analyzeImage.ts
    - api/_lib/ai/transcribeAudio.ts
    - api/_lib/ai/__tests__/handlers/analyzeFile.test.ts
    - api/_lib/ai/__tests__/handlers/analyzeImage.test.ts
    - api/_lib/ai/__tests__/handlers/transcribeAudio.test.ts
  modified:
    - api/ai.ts (replaced 2550-line monolith with 74-line router)
    - api/_lib/ai/index.ts (all 6 handlers now exported)

key-decisions:
  - "Use @ai-sdk/openai directly for transcription (targeted exception) because Vercel AI Gateway does not support transcription models; all other calls continue through the gateway"
  - "analyzeFile vision sub-handler uses selectModel with hasVision=true, enforcing AI-04 (never MiniMax for vision)"
  - "thin router preserves generate-roadmap-v2 alias alongside generate-roadmap for backwards compatibility"
  - "pre-existing ai-generate-ideas.test.ts failure (imports ../ai/generate-ideas which never existed) is not a regression from this plan"

patterns-established:
  - "Vision pattern: messages array with { type: 'image', image: url } content part"
  - "Transcription pattern: experimental_transcribe(@ai-sdk/openai.transcription('whisper-1')) + generateText summary"
  - "Thin router pattern: switch(action) with default 404 and valid action list"

requirements-completed: [AI-04, AI-05]

duration: 22min
completed: 2026-04-06
---

# Phase 02 Plan 03: Multi-Modal Handler Extraction and Thin Router Summary

**Replaced 2550-line monolithic api/ai.ts with a 74-line thin router; extracted analyzeFile (4 fetch migrations), analyzeImage (vision content parts), and transcribeAudio (Whisper + summary two-step) into AI SDK handlers with zero raw fetch() calls remaining.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-04-06T16:55:00Z
- **Completed:** 2026-04-06T17:17:00Z
- **Tasks:** 2 (Task 3 is the human-verify checkpoint — approved by user)
- **Files modified:** 8

## Accomplishments

- Extracted and migrated all 4 fetch calls inside `analyzeFile`: image vision (generateText + vision content parts), audio Whisper transcription (experimental_transcribe), audio transcript summary (generateText), text file analysis (generateText)
- Extracted `analyzeImage` using AI SDK vision content parts format; `selectModel` with `hasVision=true` enforces AI-04 (never MiniMax)
- Extracted `transcribeAudio` two-step pipeline: `experimental_transcribe` via `@ai-sdk/openai` (targeted exception for transcription) + `generateText` via gateway for summary
- Replaced the entire 2550-line `api/ai.ts` monolith with a 74-line thin router dispatching to all 6 handlers
- All 70 AI lib tests pass (8 test files)

## Task Commits

1. **Task 1: Extract multi-modal handlers + update barrel** - `15c015b` (feat)
2. **Task 2: Replace monolithic api/ai.ts with thin router** - `c28117f` (feat)

## Files Created/Modified

- `api/_lib/ai/analyzeFile.ts` — File analysis handler with 4 migrated fetch calls (image/audio/text sub-handlers)
- `api/_lib/ai/analyzeImage.ts` — Image analysis handler using AI SDK vision content parts
- `api/_lib/ai/transcribeAudio.ts` — Audio transcription using experimental_transcribe + generateText summary
- `api/_lib/ai/__tests__/handlers/analyzeFile.test.ts` — Tests for all 3 file type paths + AI-04 enforcement
- `api/_lib/ai/__tests__/handlers/analyzeImage.test.ts` — Tests for vision content parts format + model routing
- `api/_lib/ai/__tests__/handlers/transcribeAudio.test.ts` — Tests for two-step pipeline + response shape
- `api/_lib/ai/index.ts` — Updated barrel exporting all 6 handlers
- `api/ai.ts` — Replaced with 74-line thin router (was 2550 lines)

## Decisions Made

- Used `@ai-sdk/openai` as a targeted exception for transcription because Vercel AI Gateway does not support transcription models. All other AI calls continue through the gateway. This is documented in both the handler and research notes.
- `generate-roadmap-v2` preserved as a router alias for backwards compatibility with any existing frontend calls.
- Vision sub-handlers always use `selectModel({ hasVision: true })` to enforce AI-04 constraint (never route vision tasks to MiniMax).

## Deviations from Plan

None — plan executed exactly as written. The `api/__tests__/ai-generate-ideas.test.ts` test was already broken before this plan (imports `../ai/generate-ideas` which is a path that never existed in the codebase). This is a pre-existing issue, not a regression from this work.

## Issues Encountered

- The `api/__tests__/ai-generate-ideas.test.ts` file imports from `../ai/generate-ideas` — a path that does not exist and predates this phase's work. The old monolith was always a single `api/ai.ts` file, not a directory. This test was never executable and is not a regression from Plan 03.

## User Setup Required

None — no external service configuration required. The `@ai-sdk/openai` package was already installed from Phase 02-01 and 02-02 work.

## Next Phase Readiness

- Phase 02 (AI SDK Foundation) is now complete: all 6 AI action endpoints migrated to AI SDK via Vercel AI Gateway, zero raw fetch() calls remain in api/, capability routing enforced (AI-04/AI-05)
- Ready for Phase 03 (Security hardening: CSRF, rate limiting, password reset) — the thin router preserves the exact middleware chain required
- The ai-generate-ideas.test.ts import issue should be cleaned up as a housekeeping task (separate from security phase)

---
*Phase: 02-ai-sdk-foundation*
*Completed: 2026-04-06*
