---
phase: 07-mobile-polish-video-analysis
plan: 03
subsystem: multi-modal-ai
tags: [video, multi-modal, ai-sdk, generateObject, mobile]
requires: [02-ai-sdk-foundation]
provides: [analyze-video action, extractFrames utility, VideoAnalysisProgress component]
affects: [src/components/AIStarterModal.tsx, api/ai.ts]
tech_added: [zod schema for video analysis]
patterns: [client-side frame extraction, multi-image generateObject, async-seek await]
key_files_created:
  - src/lib/video/extractFrames.ts
  - src/lib/video/__tests__/extractFrames.test.ts
  - api/_lib/ai/analyzeVideo.ts
  - api/_lib/ai/__tests__/handlers/analyzeVideo.test.ts
  - src/lib/ai/aiService.ts
  - src/components/video/VideoAnalysisProgress.tsx
key_files_modified:
  - api/ai.ts
  - api/_lib/ai/index.ts
  - src/components/AIStarterModal.tsx
requirements_completed: [MM-05]
commits:
  - 72b5ce4 feat(07-03): client-side video frame extraction
  - 645a3a7 feat(07-03): analyzeVideo handler with multi-image generateObject
  - 4f1bcc5 feat(07-03): AIStarterModal video upload + multi-stage loader
completed: 2026-04-08
---

# Phase 07 Plan 03: Video Frame Extraction & AI Analysis Summary

End-to-end video analysis via client-side frame extraction + server-side multi-image `generateObject` call, wired into `AIStarterModal` as an "Upload video" entry point. The source video blob never leaves the browser — only 6 scaled JPEG frames are uploaded.

## What Shipped

### Task 1 — Client-side frame extraction (`72b5ce4`)

`src/lib/video/extractFrames.ts` exports `extractFrames(file, count, onProgress, deps?)` plus 4 error classes (`VideoTooLargeError`, `VideoTooLongError`, `VideoDecodeError`, `VideoUnsupportedFormatError`) and 6 constants. Implementation awaits the `seeked` event before every `drawImage` call, enforces the 100MB / 5-min / MP4+WebM+MOV constraints, and scales long edge to 1024px at JPEG quality 0.85.

`src/lib/video/__tests__/extractFrames.test.ts` — 8 Vitest specs using a fake `HTMLVideoElement` driven through the `deps` seam. Verifies happy path (6 frames returned, all `image/jpeg`, size ≤ 500KB), all 4 error paths, progress events, and — critically — that `draw` never precedes `seeked` in the instrumented draw-order log (research finding #5).

### Task 2 — `analyzeVideo` server handler (`645a3a7`)

`api/_lib/ai/analyzeVideo.ts` exports `handleAnalyzeVideo`. Uses `selectModel({ task: 'analyze-image', hasVision: true })` to force a vision-capable model, then makes a SINGLE `generateObject` call with N `{ type: 'image' }` content parts in `messages[0].content` (research finding #1 — never N separate calls). Zod schema `VideoAnalysisSchema = { summary, suggestedIdeas[] }` where each suggested idea matches the AI-fillable subset of `IdeaCard` (`content`, `details`, `x`, `y`, `priority`).

Registered in `api/ai.ts` router as `case 'analyze-video'` and exported through `api/_lib/ai/index.ts`.

`api/_lib/ai/__tests__/handlers/analyzeVideo.test.ts` — 5 specs: happy path returns `{analysis: {...}}`, 400 on missing frames, 400 on empty array, 400 on > 12 frames, and the critical assertion that `generateObject` is called exactly once with all 6 frames as image parts in the same message.

### Task 3 — UI integration (`4f1bcc5`)

- `src/lib/ai/aiService.ts` — `analyzeVideo(frames, projectContext, init)` converts each blob to a base64 data URL (`FileReader`) and POSTs to `/api/ai?action=analyze-video` with CSRF headers and the Supabase access token pulled lock-free from localStorage (same pattern used by `AIIdeaModal` image analysis to avoid the getSession deadlock).
- `src/components/video/VideoAnalysisProgress.tsx` — four rendered stages: `Extracting frames (X/Y)…`, `Analyzing video…`, `Done`, error card. Includes `role="status"` / `role="alert"` + `aria-live` regions and a progress bar driven from the `onProgress` callback.
- `src/components/AIStarterModal.tsx` — adds a new "Upload video" section at the top of the `initial` step. Accepts only `video/mp4,video/webm,video/quicktime`. On file select: extracts frames, maps each error class to a user-friendly message, then calls `analyzeVideo(...)` and merges the result into the existing `analysis` state so the downstream `ProjectReviewStep` keeps working unchanged.

## Verification

- `npx vitest run src/lib/video/__tests__/extractFrames.test.ts` — 8/8 passing
- `npx vitest run api/_lib/ai/__tests__/handlers/analyzeVideo.test.ts` — 5/5 passing
- `npm run type-check` — clean for all files introduced/modified by this plan. (Pre-existing TS errors in unrelated files — PDF generators, auth utils, realtime manager — were left untouched per scope boundary and logged below.)
- Grep contract: `seeked`, `playsInline`, `muted` all present in `extractFrames.ts`; `analyze-video` and `handleAnalyzeVideo` present in `api/ai.ts`; `generateObject` used in `analyzeVideo.ts`; `Upload video`, `video/mp4`, `video/webm`, `video/quicktime` present in `AIStarterModal.tsx`; `Extracting frames`, `Analyzing video` present in `VideoAnalysisProgress.tsx`.

### Manual smoke

Not performed in this agent run (no human verification step in the execute spec — Task 3's manual smoke line is informational). Recommended: run `npm run dev`, open AI Starter modal, upload a short MP4, confirm the loader cycles through extracting → analyzing → done and produces suggested ideas.

## Deviations from Plan

None of substance.

- **Minor (Rule 1):** Plan listed a 6th frame-extraction test ("mocked HTMLVideoElement, assert draw happens after seeked fires"). Implemented equivalently as the final test using an instrumented `drawOrder` array on a fake canvas — asserts the exact `seeked → draw` interleaving across multiple frames with a non-zero seek delay.
- **Minor (Rule 3):** Plan's `IdeaCardSchema` was left intentionally loose in the plan text. Matched it to the AI-fillable columns of the real `IdeaCard` interface (`content`, `details`, `x`, `y`, `priority`) — id/timestamps are populated when the idea is persisted downstream.
- **Minor:** Used `src/lib/config.ts`'s `SUPABASE_STORAGE_KEY` constant for the lock-free localStorage token read in `src/lib/ai/aiService.ts`, mirroring `AIIdeaModal`'s pattern. Kept this file separate from the existing `src/lib/aiService.ts` (which uses a different API) so we do not touch that module in a video-analysis plan.

## Known Stubs

None. The `analyze-video` action routes to a real multi-image `generateObject` call; suggested ideas are wired directly into the existing review step that creates DB rows on confirm.

## Deferred Issues (Out of Scope)

The repo has pre-existing TypeScript errors in the following files — all untouched by this plan:

- `src/lib/pdf/generators/*`, `src/lib/pdf/loaders/PdfLibraryLoader.ts` — `error` identifier not declared in catch blocks
- `src/lib/realtime/BrainstormRealtimeManager.ts` — `SessionParticipant` shape mismatch, unused imports
- `src/lib/services/BrainstormSessionService.ts`, `src/lib/services/CollaborationService.ts` — response type mismatches
- `src/utils/*` (auth perf monitor, auth token cache, locking tests, realtime diagnostic, roadmap export, perf utils) — `error`/`e`/`err` identifiers not declared in catch blocks

These were logged for deferred-items but not touched, per the plan's scope boundary (Rule: only auto-fix issues directly caused by the current task's changes).

## Self-Check: PASSED

- [x] `src/lib/video/extractFrames.ts` exists
- [x] `src/lib/video/__tests__/extractFrames.test.ts` exists
- [x] `api/_lib/ai/analyzeVideo.ts` exists
- [x] `api/_lib/ai/__tests__/handlers/analyzeVideo.test.ts` exists
- [x] `src/lib/ai/aiService.ts` exists
- [x] `src/components/video/VideoAnalysisProgress.tsx` exists
- [x] Commit `72b5ce4` present in `git log`
- [x] Commit `645a3a7` present in `git log`
- [x] Commit `4f1bcc5` present in `git log`
- [x] All verification greps PASS
- [x] Both vitest suites green (13 tests total)
