---
phase: 4
slug: audio-voice-to-idea
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:run` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | MM-03 | T-4-01 | Audio upload rejected if > 25MB | unit | `npm run test:run -- src/components/__tests__/AudioTab` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | MM-03 | T-4-02 | MIME type validated before upload | unit | `npm run test:run -- src/components/__tests__/AudioTab` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 2 | MM-04 | — | MediaRecorder starts/stops cleanly | unit | `npm run test:run -- src/components/__tests__/AudioRecorder` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 2 | MOB-02 | — | iOS Safari audio/mp4 fallback triggers | unit | `npm run test:run -- src/components/__tests__/AudioRecorder` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 3 | MM-06 | — | Progress feedback visible during transcription | component | `npm run test:components -- AudioTab` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 3 | MM-03 | T-4-03 | Transcription result creates idea card | integration | `npm run test:run -- src/hooks/__tests__/useAudioIdea` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/AudioTab.test.tsx` — stubs for MM-03 upload + MIME validation
- [ ] `src/components/__tests__/AudioRecorder.test.tsx` — stubs for MM-04 record flow + iOS fallback
- [ ] `src/hooks/__tests__/useAudioIdea.test.ts` — stub for transcription → idea creation
- [ ] Existing vitest infrastructure sufficient — no new framework installs needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Voice recording on real iOS Safari | MOB-02 | MediaRecorder requires real device/browser | Open app on iPhone, tap record, speak, verify card created |
| Whisper transcription accuracy | MM-03 | Subjective quality — no automated oracle | Upload sample audio, verify transcript makes sense |
| Progress feedback UX feel | MM-06 | Perceived responsiveness is subjective | Upload large audio file, verify spinner/progress shows without UI freeze |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
