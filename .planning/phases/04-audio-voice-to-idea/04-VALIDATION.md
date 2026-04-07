---
phase: 4
slug: audio-voice-to-idea
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-07
revised: 2026-04-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.4 (unit/component) + Playwright 1.55.0 (optional e2e) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:run` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds for touched files |

---

## Sampling Rate

- **After every task commit:** Run the touched test file directly
- **After every plan wave:** Run `npm run test:hooks && npm run test:components`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | MM-04, MOB-02 | T-4-04 | MediaRecorder mock + useAudioRecorder RED tests (cleanup, iOS fallback) | unit | `npx vitest run src/hooks/__tests__/useAudioRecorder.test.ts` | ❌→✅ W0 (created by this task) | ⬜ pending |
| 04-01-02 | 01 | 1 | MM-04, MOB-02 | T-4-04 | useAudioRecorder GREEN — tracks released, no mic leak | unit | `npx vitest run src/hooks/__tests__/useAudioRecorder.test.ts` | ✅ after 04-01-01 | ⬜ pending |
| 04-01-03 | 01 | 1 | MM-03 | T-4-01, T-4-02 | validateAudioFile rejects >25MB + non-audio MIME; normalizeTranscriptionResult shape | unit | `npx vitest run src/lib/__tests__/audioTranscription.test.ts` | ❌→✅ W0 (created by this task) | ⬜ pending |
| 04-02-01 | 02 | 2 | MM-03, MM-04, MM-06 | T-4-03 | AIIdeaModal audio tab RED tests (upload, record, stages, CSRF, cleanup) | component | `npx vitest run src/components/__tests__/AIIdeaModal.audio.test.tsx` | ❌→✅ W0 (created by this task) | ⬜ pending |
| 04-02-02 | 02 | 2 | MM-03, MM-04, MM-06 | T-4-01, T-4-02, T-4-03, T-4-04 | Audio tab implementation passes all 10 tests; no Phase 3 regression | component | `npx vitest run src/components/__tests__/AIIdeaModal.audio.test.tsx && npx vitest run src/components/__tests__/AIIdeaModal` | ✅ after 04-02-01 | ⬜ pending |
| 04-02-03 | 02 | 2 | MOB-02 | T-4-04 | iOS Safari real-device record → transcribe → create idea + mic cleanup | manual | iPhone Safari smoke (see Plan 02 Task 3) | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 (RED test scaffolding) is satisfied **inside Plan 01 Task 1 and Plan 02 Task 1** — TDD-RED tasks create the test files as their explicit deliverable before any implementation runs. No separate Wave 0 task is required.

Files created as part of the TDD RED tasks:

- [x] `src/test/mocks/mediaRecorder.ts` — Shared MediaRecorder mock fixture (Plan 01 Task 1)
- [x] `src/hooks/__tests__/useAudioRecorder.test.ts` — 9 tests covering MM-04 + iOS fallback + cleanup (Plan 01 Task 1)
- [x] `src/lib/__tests__/audioTranscription.test.ts` — 7 tests covering MM-03 validation + normalization (Plan 01 Task 3)
- [x] `src/components/__tests__/AIIdeaModal.audio.test.tsx` — 10 tests covering MM-03/04/06 + CSRF + cleanup (Plan 02 Task 1)
- [x] Existing vitest infrastructure sufficient — no new framework installs needed

**Wave 0 complete:** The plan's first task in each wave IS the Wave 0 test creation step (RED state). This satisfies the Nyquist rule that an automated verify must exist before implementation — the verify runs against the just-written failing test file.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Voice recording on real iOS Safari | MOB-02 | MediaRecorder MIME fallback + mic permission flow only reproducible on real device | Plan 02 Task 3 checkpoint — iPhone Safari, record → transcribe → create idea, verify mic indicator clears on close |
| Whisper transcription accuracy | MM-03 | Subjective quality — no automated oracle | Upload sample audio, verify transcript makes sense |
| Progress feedback UX feel | MM-06 | Perceived responsiveness is subjective | Record/upload, verify step indicators advance smoothly without UI freeze |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit manual checkpoints
- [x] Sampling continuity: every implementation task has an automated verify
- [x] Wave 0 satisfied by TDD RED tasks (Plan 01 Task 1, Plan 01 Task 3, Plan 02 Task 1)
- [x] No watch-mode flags
- [x] Feedback latency < 30s for touched test files
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** approved (revised post-checker reconciliation)
