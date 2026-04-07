---
phase: 04-audio-voice-to-idea
plan: 02
subsystem: ai-idea-modal-audio-tab
tags: [audio, modal, mediarecorder, whisper, ios-safari]
requires: [04-01]
provides:
  - AIIdeaModal Audio tab (Record + Upload sub-sections)
  - AudioStage state machine
  - End-to-end record → upload → transcribe → review → create flow
affects:
  - src/components/AIIdeaModal.tsx
tech_stack:
  added: []
  patterns: [tagged-union-state-machine, hook-driven-recorder, csrf-fetch]
key_files:
  created:
    - src/components/__tests__/AIIdeaModal.audio.test.tsx
  modified:
    - src/components/AIIdeaModal.tsx
decisions:
  - "Audio tab is third tab in AIIdeaModal — same pattern as Image (no separate modal)"
  - "AudioStage tagged union (idle/recording/uploading/transcribing/reviewing/error) drives all UI"
  - "fireEvent.change used for MIME-reject test (userEvent.upload filters by accept attr)"
  - "FileService.uploadFile reused as-is — Plan 02 added no new upload primitives"
  - "Modal Close button cleans up active recording via handleCloseWithCleanup"
metrics:
  duration: "~25 min"
  tasks: 2 of 3 (Task 3 is human-verify checkpoint — pending)
  tests_added: 10
  completed: "2026-04-06"
requirements: [MM-03, MM-04, MM-06, MOB-02]
---

# Phase 04 Plan 02: AIIdeaModal Audio Tab Summary

**One-liner:** Audio tab added to AIIdeaModal with Record + Upload sub-sections, AudioStage tagged-union state machine, step indicators (3-step upload / 4-step record), transcript review with editable title, and onAdd dispatch — 10/10 tests green; iOS Safari real-device verification pending (Task 3 checkpoint).

## What Was Built

### `src/components/AIIdeaModal.tsx` (modified, +302 lines)

1. **Imports** — added `useEffect`, `Mic` icon, `useAudioRecorder`, and `audioTranscription` lib (`validateAudioFile`, `normalizeTranscriptionResult`, `ACCEPTED_AUDIO_MIME_TYPES`, types).
2. **Tab union** — `Tab = 'generate' | 'image' | 'audio'`.
3. **AudioStage tagged union** — `idle | recording | uploading | transcribing | reviewing | error`.
4. **Helpers** — `formatElapsed`, `stepStateForUpload/Transcribing/Done` (module-level pure fns).
5. **State** — `audioStage`, `audioTitle`, `useAudioRecorder()` hook instance.
6. **`uploadAndTranscribeAudio(file)`** — validates, uploads via `FileService.uploadFile`, POSTs to `/api/ai?action=transcribe-audio` with `X-CSRF-Token` + `language: 'en'`, normalizes response, advances stage to `reviewing`.
7. **`handleRecordToggle`** — toggles record/stop; on stop, builds File from blob and chains into upload+transcribe.
8. **`handleAudioFilePick`** — file picker → `uploadAndTranscribeAudio`.
9. **`handleCreateAudioIdea`** — builds IdeaCard payload (content/details/x/y/priority/created_by/is_collapsed/editing_by/editing_at) and calls `onAdd(...)` then `onClose()`.
10. **`handleCloseWithCleanup`** — wraps onClose, stops recorder if active.
11. **Unmount cleanup `useEffect`** — defense-in-depth mic release.
12. **Audio tab header button** — third tab matching existing styling.
13. **Audio tab panel** — step indicator `<ol aria-label="Audio progress">`, two-section grid (Record + Upload), uploading/transcribing inline status, review panel with editable title input and Discard/Create buttons.

### `src/components/__tests__/AIIdeaModal.audio.test.tsx` (created, 324 lines)

10 tests covering MM-03 (upload happy path, size reject, MIME reject), MM-04 (record happy path, permission denied), MM-06 (3-step upload / 4-step record indicators), review-then-create with custom title, CSRF + endpoint contract, and modal-close cleanup.

## Test Results

- `npx vitest run src/components/__tests__/AIIdeaModal.audio.test.tsx` → **10/10 passing**
- `npx vitest run src/components/__tests__/AIIdeaModal.image.test.tsx` → **5/5 passing** (no Phase 3 regression)

## Commits

- `e67b7b3` test(04-02): add failing tests for AIIdeaModal audio tab
- `871a25a` feat(04-02): add audio tab to AIIdeaModal with record + upload + transcribe

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test infra] userEvent.upload filters by `accept` attribute**
- **Found during:** Task 2 GREEN (test 3 MIME-reject failed because `text/plain` was filtered before reaching the change handler).
- **Fix:** Switched test 3 to `fireEvent.change(input, { target: { files: [txt] } })` to bypass userEvent's accept filter while still exercising the React handler.
- **Files modified:** `src/components/__tests__/AIIdeaModal.audio.test.tsx`
- **Commit:** rolled into 871a25a

**2. [Rule 2 — Defense-in-depth] Added unmount cleanup useEffect**
- The plan called for cleanup in the modal-close path; I additionally added a `useEffect` cleanup on unmount as a second guard. The hook itself also cleans up, but the modal-level guard catches edge cases where the component unmounts before the recorder hook finishes. Threat T-4-04 is now mitigated at three layers (hook unmount, modal close handler, modal unmount).

### Plan Step Consolidation

Plan-suggested 3 commit checkpoints inside Task 2 (types-only, handlers, JSX). I consolidated into a single Task 2 commit because all three layers reference each other and need to compile/test together — splitting would break type-check between commits. Task 1 RED commit + Task 2 GREEN commit = clean TDD pair.

## Deferred Issues

- **Pre-existing TS errors** in `src/utils/{lockingDiagnostic,networkPerformanceMonitor,performanceTestRunner,performanceUtils,realtimeDiagnostic,roadmapExport}.ts` — unused-catch-variable errors unrelated to this plan; same set called out in Plan 01 deferred items. AIIdeaModal.tsx itself has no TS errors.
- **Stale worktrees** at `.claude/worktrees/agent-a4af7a5e/` and `.claude/worktrees/agent-a59dbb0d/` cause vitest to pick up duplicate (older) test files. Pre-existing infra noise; vitest config could exclude `.claude/**` in a future cleanup. All main-tree tests pass.

## Threat Mitigations Applied

- **T-4-01 (DoS large upload):** `validateAudioFile` runs before `FileService.uploadFile` — verified by test 2 (30MB rejected with no upload).
- **T-4-02 (MIME tampering):** Whitelist enforced client-side via `validateAudioFile`; file picker `accept` attr also constrains; backend Whisper still validates — verified by test 3.
- **T-4-03 (CSRF on transcribe):** `X-CSRF-Token` header + `credentials: 'include'` on the fetch — verified by test 9.
- **T-4-04 (mic privacy):** Three-layer cleanup — hook unmount + modal `handleCloseWithCleanup` + modal unmount `useEffect` — verified by test 10.

## Pending: Task 3 — iOS Safari Human Verification Checkpoint

**Status:** awaiting human verification (cannot be automated).

This plan has `autonomous: false` because MOB-02 requires real-device iOS Safari testing of:
- MediaRecorder MIME fallback (`audio/mp4` path)
- Real microphone permission prompt
- Real Whisper transcription accuracy
- iOS status-bar mic indicator clearing on modal close
- iPhone Files-app picker upload path

See PLAN.md `<task name="Task 3">` for the full 10-step verification protocol. The orchestrator should pause this plan in `awaiting_checkpoint` state until a human runs the iOS test pass and reports back.

## Self-Check: PASSED

- `src/components/__tests__/AIIdeaModal.audio.test.tsx` — FOUND
- `src/components/AIIdeaModal.tsx` — modified, contains `'audio'` Tab union, `AudioStage`, `useAudioRecorder()`, `transcribe-audio`, `validateAudioFile`, `normalizeTranscriptionResult`, `ACCEPTED_AUDIO_MIME_TYPES`, `● REC`, `aria-selected={activeTab === 'audio'}`, `Recording`/`Uploading`/`Transcribing`/`Done` step labels
- Commits e67b7b3, 871a25a — present in `git log`
- 10/10 audio tests passing; 5/5 image tests passing (no regression)
