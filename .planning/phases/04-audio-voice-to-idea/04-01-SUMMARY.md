---
phase: 04-audio-voice-to-idea
plan: 01
subsystem: audio-foundations
tags: [audio, mediarecorder, whisper, hooks, lib]
requires: []
provides:
  - useAudioRecorder hook
  - audioTranscription lib (validate + normalize)
  - MediaRecorder mock fixture
affects: []
tech_stack:
  added: []
  patterns: [react-hook-with-refs, mime-fallback, blob-assembly]
key_files:
  created:
    - src/hooks/useAudioRecorder.ts
    - src/hooks/__tests__/useAudioRecorder.test.ts
    - src/lib/audioTranscription.ts
    - src/lib/__tests__/audioTranscription.test.ts
    - src/test/mocks/mediaRecorder.ts
  modified: []
decisions:
  - "iOS Safari WebM fallback: audio/webm preferred, audio/mp4 second, browser default third"
  - "Validation is client-side defense-in-depth; backend still re-validates"
  - "deriveTitleFromSummary strips terminal punctuation from first sentence for cleaner subject lines"
metrics:
  duration: "~15 min"
  tasks: 3
  tests_added: 17
  completed: "2026-04-06"
---

# Phase 04 Plan 01: Audio Foundations Summary

**One-liner:** MediaRecorder-backed `useAudioRecorder` hook with iOS MP4 fallback, mic-leak cleanup, and a Whisper response normalizer library — pure logic primitives that unblock the AudioTab UI in Plan 02.

## Hook API

```typescript
import { useAudioRecorder } from '@/hooks/useAudioRecorder'

const { isRecording, elapsedMs, error, start, stop } = useAudioRecorder()

// start() MUST be called inside a user gesture (button click)
await start()
// ...user speaks...
const blob: Blob = await stop()  // mic released, blob assembled from chunks
```

Behavior:
- Prefers `audio/webm`, falls back to `audio/mp4` (iOS Safari), then browser default
- `stop()` and unmount both call `stream.getTracks().forEach(t => t.stop())` — no mic leak
- `elapsedMs` ticks every 100ms while recording
- `error` populated with human-readable string on `getUserMedia` rejection; `isRecording` stays false

## Lib API

```typescript
import {
  validateAudioFile,
  normalizeTranscriptionResult,
  deriveTitleFromSummary,
  ACCEPTED_AUDIO_MIME_TYPES,
  MAX_AUDIO_BYTES,
} from '@/lib/audioTranscription'

const v = validateAudioFile(file)
if (!v.ok) showError(v.error)

const idea = normalizeTranscriptionResult(whisperResponse)
// { subject, description, textContent, insights, relevanceScore }
```

- `MAX_AUDIO_BYTES = 25 * 1024 * 1024`
- Whitelist: `audio/mpeg`, `audio/wav`, `audio/webm`, `audio/mp4`, `audio/ogg`
- `deriveTitleFromSummary` takes first sentence, truncates to 80 chars with `…`

## Mock Fixture Usage

```typescript
import {
  createMockMediaRecorder,
  createMockGetUserMedia,
} from '@/test/mocks/mediaRecorder'

const mr = createMockMediaRecorder({ isTypeSupported: (m) => m === 'audio/mp4' })
const gum = createMockGetUserMedia()
// ...renderHook, act...
mr.emitData(new Blob(['audio'], { type: 'audio/mp4' }))
mr.emitStop()
// mr.MockClass.instances[0].mimeType === 'audio/mp4'
// gum.tracks[0].stop toHaveBeenCalled
mr.restore(); gum.restore()
```

Reusable by Plan 02 component tests.

## Test Count

- `useAudioRecorder.test.ts`: **9 passing**
- `audioTranscription.test.ts`: **8 passing** (added one extra boundary test for `MAX_AUDIO_BYTES` constant)
- **Total: 17 tests, all green**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] mr.instances stale reference after restore**
- **Found during:** Task 2 GREEN run
- **Issue:** Tests 3 & 4 called `mr.restore()` then recreated the mock, but held onto the old `mr.instances` array reference (empty). Also didn't re-create `gum` after `vi.unstubAllGlobals()` cleared navigator.
- **Fix:** Restore both `mr` and `gum`, recreate both, and access instances via `mr.MockClass.instances`.
- **Files modified:** `src/hooks/__tests__/useAudioRecorder.test.ts`
- **Commit:** 17351dd (rolled into GREEN commit since test file had to change to match the stable mock surface)

**2. [Rule 2 - Test completeness] Added MAX_AUDIO_BYTES boundary assertion**
- Added an 8th test in `audioTranscription.test.ts` that asserts `MAX_AUDIO_BYTES === 25 * 1024 * 1024` to lock the constant against accidental drift. Plan specified 7 tests; delivered 8.

## Deferred Issues

- **Pre-existing TypeScript errors** in `src/utils/*` (lockingDiagnostic, networkPerformanceMonitor, performanceTestRunner, performanceUtils, realtimeDiagnostic, roadmapExport) — unused-catch-variable errors unrelated to this plan. Out of scope per the scope-boundary rule; `npm run type-check` does not gate CI for this plan. Three new files I authored introduce no TS errors.

## Authentication Gates

None — pure client-side primitives with no network or auth.

## Threat Mitigations Applied

- **T-4-01 (DoS via large upload):** `validateAudioFile` rejects files > 25MB before any upload.
- **T-4-02 (MIME tampering):** Whitelist enforced client-side; backend still validates.
- **T-4-04 (mic privacy leak):** Both `stop()` and unmount path release all MediaStream tracks; enforced by tests 6 & 7.

## Commits

- `3cff0e8` test(04-01): add failing tests for useAudioRecorder + MediaRecorder mock
- `17351dd` feat(04-01): implement useAudioRecorder hook with iOS fallback + cleanup
- `963e7b6` feat(04-01): add audioTranscription validate + normalize lib

## Self-Check: PASSED

- `src/hooks/useAudioRecorder.ts` — FOUND
- `src/hooks/__tests__/useAudioRecorder.test.ts` — FOUND
- `src/lib/audioTranscription.ts` — FOUND
- `src/lib/__tests__/audioTranscription.test.ts` — FOUND
- `src/test/mocks/mediaRecorder.ts` — FOUND
- Commits 3cff0e8, 17351dd, 963e7b6 — all present in `git log`
- 17/17 tests passing
