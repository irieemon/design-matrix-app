# Phase 4: Audio & Voice-to-Idea - Research

**Researched:** 2026-04-06
**Domain:** Browser audio capture + Whisper transcription integrated into existing AIIdeaModal
**Confidence:** HIGH (backend live, Phase 3 pattern established, MediaRecorder is standard browser API)

## Summary

Phase 4 adds an "Audio" tab to `AIIdeaModal` with two sub-paths (record via `MediaRecorder`, or upload audio file), both flowing through Supabase Storage → existing `POST /api/ai?action=transcribe-audio` endpoint → review screen → idea card creation. The backend (`api/_lib/ai/transcribeAudio.ts`) is already built and live from Phase 2. Phase 3's image tab established the exact stage-machine, normalizer, and review-then-create pattern that this phase mirrors.

**Primary recommendation:** Mirror Phase 3's `ImageStage` machine in a new `AudioStage` machine, reuse `FileService.uploadFile()` for both recording blobs and file picks, use browser-native `MediaRecorder` (no library), and add a thin `audioRecorder` hook to encapsulate permission/start/stop/blob lifecycle.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Audio features live as a new "Audio" tab inside `AIIdeaModal` (3rd tab alongside Generate + Image). No new toolbar button, no separate modal.
- **D-02:** Audio tab has two side-by-side sub-sections: **Record** (mic, tap-to-toggle) and **Upload** (file picker / drag-and-drop). Stack vertically on narrow viewports.
- **D-03:** Recording is **tap-to-start / tap-to-stop** (toggle, not push-to-talk). Live elapsed timer + pulsing `● REC` indicator.
- **D-04:** After Whisper returns, **show transcript for review** before creating idea. Display: full transcription, summary, key points. Editable title field. User confirms via "Create Idea" button. No auto-creation. Stages: `idle → recording/uploading → transcribing → done | error`.
- **D-05:** **Step indicators** for progress (matches Phase 3). Upload path: Upload → Transcribing → Done. Record path: Recording → Uploading → Transcribing → Done. No fake progress bars.

### Claude's Discretion
- Accepted formats: `audio/mpeg`, `audio/wav`, `audio/webm`, `audio/mp4`, `audio/ogg`. Pass through to Whisper without conversion. Cap at ~25MB (Whisper API limit).
- Use browser `MediaRecorder` + `getUserMedia({ audio: true })`. No external library. Handle permission denial with clear message. iOS Safari satisfied by tap-to-start gesture.

### Deferred Ideas (OUT OF SCOPE)
- Language selection UI (default `'en'`)
- Mic button in brainstorm session toolbar (outside AIIdeaModal)
- Attaching audio to existing ideas
- Real-time waveform visualization

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MM-03 | Upload audio file → Whisper transcription | File upload sub-section + reuse `FileService.uploadFile` + existing transcribe endpoint |
| MM-04 | Record voice on mobile → idea card via Whisper | `MediaRecorder` recorder sub-section + same upload + transcribe pipeline |
| MM-06 | Multi-modal processing shows progress feedback (non-blocking) | Stage-machine step indicators (D-05), reused from Phase 3 image pattern |
| MOB-02 | Voice-to-idea works on mobile | iOS Safari MediaRecorder support (mp4/webm fallback), tap-gesture mic permission, mobile-friendly tab layout |

## Project Constraints (from CLAUDE.md)

- React 18 + TypeScript strict mode + Vite + Supabase + Vercel — no stack changes
- Must use `useCsrfToken()` for state-changing API calls
- Use `logger.*` (not `console.*`); honor `?debug=true` toggle
- Never bypass Supabase RLS; storage uploads go through `FileService` which already enforces RLS
- Use `BaseModal` wrapper — already in place via `AIIdeaModal`
- ESLint flat config; named exports preferred; PascalCase components, `use*` hooks
- SAFE MODE applies: this touches Supabase auth (CSRF), file uploads, and modal state — sequential, no parallel agent work

## Standard Stack

### Core (already in repo — no new installs required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser `MediaRecorder` API | native | Capture mic audio in browser | [VERIFIED: MDN] Supported in all evergreen browsers + iOS Safari 14.1+. No library needed. |
| Browser `getUserMedia` | native | Request microphone permission | [VERIFIED: MDN] Standard `navigator.mediaDevices` API. |
| `FileService.uploadFile()` | in-repo | Direct Supabase Storage upload | [VERIFIED: src/lib/fileService.ts] Already used by Phase 3 image tab; works for any blob/File. |
| `@ai-sdk/openai experimental_transcribe` | already in `api/_lib/ai/transcribeAudio.ts` | Whisper backend | [VERIFIED: CONTEXT.md canonical_refs] Phase 2 deliverable, live. |
| React 18 + hooks | 18.2.0 | UI + state | existing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useCsrfToken()` (in-repo) | — | CSRF token for `/api/ai` POST | All transcribe calls |
| `BaseModal` (in-repo) | — | Modal shell | Already in AIIdeaModal — no change |
| `logger` (in-repo) | — | Debug/error logging | All recorder lifecycle events + transcription errors |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `MediaRecorder` | `recordrtc`, `mic-recorder-to-mp3` | [ASSUMED] Adds dependency + bundle weight; native API is fully sufficient for our use. Reject. |
| Pass-through webm to Whisper | Client-side transcode to mp3 via `lamejs` | [VERIFIED: OpenAI Whisper docs accept webm] Whisper accepts webm directly; transcode adds complexity, CPU, bundle. Reject. |
| `MediaRecorder` | Web Audio API + manual encoding | More control but huge complexity; rejected — `MediaRecorder` blob output is exactly what we need. |

**Installation:** None — all dependencies already in repo.

## Architecture Patterns

### Component Structure
```
src/components/AIIdeaModal.tsx          # extend Tab type to include 'audio'; mount AudioTab
src/components/aiIdea/                   # (or wherever Phase 3's ImageTab lives — verify in plan)
  ├── AudioTab.tsx                       # NEW — top-level Audio tab UI
  ├── AudioRecorder.tsx                  # NEW — Record sub-section (mic, timer, REC indicator)
  ├── AudioUploader.tsx                  # NEW — Upload sub-section (file picker / drag-drop)
  └── AudioReviewPanel.tsx               # NEW — transcript + summary + key points + editable title
src/hooks/
  └── useAudioRecorder.ts                # NEW — encapsulates getUserMedia + MediaRecorder lifecycle
src/lib/
  └── audioTranscription.ts              # NEW — normalizeTranscriptionResult + maps to IdeaCard shape
```

### Pattern 1: Audio Stage Machine (mirrors `ImageStage`)
**What:** Discriminated union state for the audio flow, two entry paths converge.
**When:** Both record and upload paths.
```typescript
// Source: pattern lifted from Phase 3 ImageStage in src/components/AIIdeaModal.tsx
type AudioStage =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: number }     // record path only
  | { kind: 'uploading'; progress?: number }     // both paths
  | { kind: 'transcribing' }                     // both paths
  | { kind: 'reviewing'; result: NormalizedTranscription; sourceFile: ProjectFile }
  | { kind: 'error'; message: string; recoverable: boolean }
```
The reviewing state holds the editable result so the user can adjust title before clicking "Create Idea", which calls existing `onAdd()`.

### Pattern 2: useAudioRecorder Hook
**What:** Encapsulates `getUserMedia` + `MediaRecorder` + cleanup. Returns `{ isRecording, elapsedMs, start, stop, error }`.
**Why a hook:** Lifecycle (acquire stream → record → stop → release tracks) must clean up on unmount or tab switch to avoid the mic indicator staying on. Component-local effects make this brittle.
```typescript
// Skeleton — verify against MDN MediaRecorder API
function useAudioRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // start: getUserMedia → new MediaRecorder(stream) → ondataavailable → start()
  // stop: returns Promise<Blob> resolved in onstop handler
  // cleanup: stream.getTracks().forEach(t => t.stop())
}
```
[CITED: MDN MediaRecorder] `ondataavailable` collects blob chunks; `onstop` fires after `stop()` and is when you assemble the final Blob via `new Blob(chunks, { type: recorder.mimeType })`.

### Pattern 3: Normalizer
Mirror `normalizeAnalysisResult()` from `AIIdeaModal.tsx`:
```typescript
function normalizeTranscriptionResult(raw: TranscribeAudioResponse) {
  const text = raw.transcription.text
  const summary = raw.transcription.summary
  return {
    subject: deriveTitleFromSummary(summary),  // first sentence, truncated
    description: summary,
    textContent: text,
    insights: raw.transcription.keyPoints,
    relevanceScore: undefined,                  // none from transcription
  }
}
```
Then reuse `mapRelevanceToPriority()` with default `'moderate'`.

### Anti-Patterns to Avoid
- **Forgetting to release the MediaStream:** Mic indicator stays on after stop. Always call `track.stop()` on every track in cleanup AND in the recorder's `onstop`.
- **Sending the recorded blob through the API request body:** Hits the 4.5MB Vercel function limit. Always upload to Supabase Storage first (same pattern as Phase 3 image), then pass the public URL. (MM-07 already covers this.)
- **Auto-creating the idea after transcription:** Violates D-04 (review-then-create). Always pause at `reviewing` stage.
- **Push-to-hold UX:** Violates D-03. Tap-toggle only.
- **Calling getUserMedia outside a user gesture handler:** Will fail on iOS Safari. The `start` action MUST be invoked synchronously inside the tap handler.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio capture in browser | Web Audio + manual PCM encoding | `MediaRecorder` API | Native, supported, gives ready-to-upload blob |
| Audio file upload to storage | Custom Supabase upload | `FileService.uploadFile()` | Already handles RLS, content type, public URL retrieval |
| Audio transcription | Direct OpenAI client call from frontend | Existing `POST /api/ai?action=transcribe-audio` | Server-side key, CSRF, rate limiting, already built |
| Format conversion (webm → mp3) | `lamejs` / `ffmpeg.wasm` | Pass webm directly | Whisper accepts webm; transcode wastes time + bundle |
| MIME type detection | manual sniffing | `file.type` from `<input type=file>` and `recorder.mimeType` from MediaRecorder | Browser provides it correctly |
| Stage machine | one-off booleans (`isRecording`, `isUploading`, `isTranscribing`) | Discriminated union (Phase 3 pattern) | Boolean soup creates impossible states |

## Runtime State Inventory

Not applicable — this is a greenfield additive phase (new tab + new components). No renames, no migrations, no stored state changes. No existing audio data to migrate.

| Category | Items | Action |
|----------|-------|--------|
| Stored data | None | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | `OPENAI_API_KEY` already configured for Phase 2 | None |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: iOS Safari MediaRecorder MIME type quirks
**What goes wrong:** iOS Safari's `MediaRecorder` historically only supported `audio/mp4` (not webm). Code that hardcodes `audio/webm` fails on iPhone.
**Why it happens:** Browser feature detection skipped.
**How to avoid:** Use `MediaRecorder.isTypeSupported('audio/webm')` and fall back to `audio/mp4`. Let MediaRecorder pick by passing no `mimeType` if both fail; read final type from `recorder.mimeType` after construction. Whisper accepts both.
**Warning signs:** MM-04/MOB-02 fails on iPhone test only. STATE.md already flags this: *"iOS Safari MediaRecorder WebM support may need MP4 fallback."*
**Confidence:** [VERIFIED: STATE.md research flag] [CITED: MDN MediaRecorder.isTypeSupported]

### Pitfall 2: Microphone permission must come from a direct user gesture
**What goes wrong:** `getUserMedia()` called inside an async `useEffect` or after a `setTimeout` is rejected silently or with a permission error on iOS Safari.
**How to avoid:** Call `getUserMedia` synchronously inside the tap handler. Don't wrap in async chains before the call.
**Warning signs:** Works on desktop, fails on iPhone with no clear error.

### Pitfall 3: 25MB Whisper file limit
**What goes wrong:** User uploads a 1-hour podcast → API rejects.
**How to avoid:** Validate `file.size <= 25 * 1024 * 1024` client-side BEFORE upload. Show clear error. Long recordings can also exceed this — show recording duration estimate (rule-of-thumb: webm opus ≈ 1MB/min, so warn at 20 minutes).
**Confidence:** [CITED: OpenAI Whisper API docs — 25MB limit]

### Pitfall 4: MediaRecorder cleanup leaks on unmount
**What goes wrong:** User closes the modal mid-recording. Mic stays hot. Browser shows persistent mic-in-use indicator.
**How to avoid:** `useEffect` cleanup MUST call `recorder.stop()` (if active) AND `stream.getTracks().forEach(t => t.stop())`. Same on tab switch within AIIdeaModal.

### Pitfall 5: Whisper has no real progress signal
**What goes wrong:** Plan tries to show a progress bar during the transcribing stage.
**How to avoid:** D-05 already handles this — use step indicators only. Show indeterminate spinner during the transcribing step, NOT a fake percentage bar.

### Pitfall 6: CSRF token must be carried through transcribe call
**What goes wrong:** Forgetting `useCsrfToken()` → 403 on `/api/ai`.
**How to avoid:** Reuse the exact pattern from Phase 3 image tab — it already calls `/api/ai` with CSRF.

### Pitfall 7: Modal close during transcription
**What goes wrong:** User closes modal while transcription is in flight; result arrives, tries to set state on unmounted component, crashes.
**How to avoid:** AbortController on the fetch + mounted ref check OR have the stage machine in a context that survives a re-render. Phase 3 image tab solved this — copy its approach.

## Code Examples

### MediaRecorder lifecycle (verify against MDN before final implementation)
```typescript
// Source: MDN MediaRecorder — https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
const mimeType = MediaRecorder.isTypeSupported('audio/webm')
  ? 'audio/webm'
  : 'audio/mp4'
const recorder = new MediaRecorder(stream, { mimeType })
const chunks: Blob[] = []
recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: recorder.mimeType })
  stream.getTracks().forEach(t => t.stop())
  // → upload via FileService → call transcribe endpoint
}
recorder.start()
// later: recorder.stop()
```

### Transcribe call (mirrors Phase 3 image analyze call)
```typescript
const csrfToken = useCsrfToken()
const res = await fetch('/api/ai?action=transcribe-audio', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  credentials: 'include',
  body: JSON.stringify({
    audioUrl: uploadedFile.publicUrl,
    projectContext: { projectName, projectDescription, projectType },
    language: 'en',
  }),
})
const { transcription } = await res.json()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Upload audio through API request body | Direct-to-Supabase-Storage + pass URL | Phase 3 (MM-07) | Bypasses 4.5MB Vercel limit; enables 25MB audio |
| Hardcoded `audio/webm` | Feature-detect + mp4 fallback | iOS Safari support | MM-04/MOB-02 works on iPhone |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Whisper accepts `audio/webm` directly without transcoding | Standard Stack alternatives | If wrong, recordings on Chrome would fail and we'd need client-side transcode. Mitigation: verify with one quick curl test against the existing transcribe endpoint in Wave 0. |
| A2 | Webm opus rate ≈ 1MB/min for size warning threshold | Pitfall 3 | Off-by-2x at most; warning still useful. |
| A3 | Phase 3's image tab files live under `src/components/aiIdea/` (or similar) | Component Structure | Wrong path is cosmetic — planner verifies actual location from Phase 3 commits before writing tasks. |
| A4 | Existing transcribe endpoint signature is `{ audioUrl, projectContext, language }` returning `{ transcription: { text, summary, keyPoints, language, duration } }` | Pattern 3 | Sourced from CONTEXT.md canonical_refs, marked verified there. Plan should still grep `api/_lib/ai/transcribeAudio.ts` to confirm exact field names. |

## Open Questions (RESOLVED)

1. **Exact location of Phase 3's ImageTab files — RESOLVED**
   - **Answer:** Phase 3's image tab is **inline in `src/components/AIIdeaModal.tsx`**, NOT extracted to a sub-folder. Verified via grep: `type Tab = 'generate' | 'image'` at line 32, `type ImageStage` at line 33, `imageStage` state at line 82, image handlers at lines 161-275, image tab panel at line 469 (`{activeTab === 'image' && ...}`), and `onAdd()` call site at lines 263-273.
   - **Implication:** Audio tab MUST also be inline in `AIIdeaModal.tsx` — do NOT create `src/components/aiIdea/AudioTab.tsx` or similar sub-folder. All AudioStage/handlers/JSX live directly in `AIIdeaModal.tsx` alongside the image equivalents. The `useAudioRecorder` hook and `audioTranscription` lib remain as separate files (logic extraction, not UI extraction).

2. **Does AIIdeaModal already pass `currentProject` and CSRF context to tab children? — RESOLVED**
   - **Answer:** Not applicable — there are no tab children. Tabs are inline JSX within `AIIdeaModal.tsx`, so `currentProject`, `currentUser`, `onAdd`, `onClose` are **component props** (already destructured at the top of the function component), and `useCsrfToken()` is **called inside the component** (not passed down). The audio tab uses the exact same props and hook call in the same scope.

3. **Should the Audio tab share a single `AudioStage` machine for both record and upload, or two separate stage machines? — RESOLVED**
   - **Answer:** Single `AudioStage` discriminated union. Both paths converge at `uploading → transcribing → reviewing`. The `recording` variant is record-only; upload path starts directly at `uploading`. Less duplication, fewer impossible states.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| OpenAI API key (`OPENAI_API_KEY`) | Whisper transcription | ✓ | configured Phase 2 | — |
| Supabase Storage `project-files` bucket | Audio uploads | ✓ | live, used by Phase 3 | — |
| `MediaRecorder` API | Voice recording | ✓ in target browsers | — | mp4 fallback for iOS Safari |
| `@ai-sdk/openai experimental_transcribe` | Backend transcribe | ✓ | installed Phase 2 | — |
| Existing `/api/ai?action=transcribe-audio` route | All transcription | ✓ | live | — |

**Missing dependencies with no fallback:** None — phase is fully unblocked.

**Missing dependencies with fallback:** iOS Safari `audio/webm` support — fall back to `audio/mp4` via `MediaRecorder.isTypeSupported`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 (unit/component) + Playwright 1.55.0 (e2e) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `npm run test:run -- src/hooks/__tests__/useAudioRecorder.test.ts` |
| Full suite command | `npm run test:run && npm run e2e:chromium` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MM-03 | Upload audio file → transcription returned and shown in review | component (mocked fetch) | `npx vitest run src/components/__tests__/AudioUploader.test.tsx` | ❌ Wave 0 |
| MM-04 | Recording flow: tap-start → tap-stop → blob uploaded → transcribed → review | component + manual mobile | `npx vitest run src/hooks/__tests__/useAudioRecorder.test.ts` (mock MediaRecorder) | ❌ Wave 0 |
| MM-04 (mobile) | iOS Safari MIME fallback | manual-only | iPhone Safari smoke test | manual |
| MM-06 | Stage indicators advance correctly during async pipeline | component | `npx vitest run src/components/__tests__/AudioTab.stages.test.tsx` | ❌ Wave 0 |
| MOB-02 | End-to-end voice → idea card on mobile viewport | e2e | `npx playwright test tests/e2e/audio-voice-to-idea.spec.ts --project=mobile-safari` | ❌ Wave 0 |
| MM-03/04 | Title editing in review screen persists to created idea | component | `npx vitest run src/components/__tests__/AudioReviewPanel.test.tsx` | ❌ Wave 0 |
| Cleanup | MediaStream tracks released on unmount | component | included in `useAudioRecorder.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** quick run of touched test file
- **Per wave merge:** `npm run test:components && npm run test:hooks`
- **Phase gate:** Full suite + at least one mobile-viewport Playwright run before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useAudioRecorder.test.ts` — covers MM-04 + cleanup. Needs MediaRecorder mock (vitest `vi.stubGlobal('MediaRecorder', ...)`).
- [ ] `src/components/__tests__/AudioUploader.test.tsx` — covers MM-03
- [ ] `src/components/__tests__/AudioRecorder.test.tsx` — covers MM-04 UI (REC indicator, timer)
- [ ] `src/components/__tests__/AudioReviewPanel.test.tsx` — covers MM-03/04 review-then-create
- [ ] `src/components/__tests__/AudioTab.stages.test.tsx` — covers MM-06 stage indicator
- [ ] `tests/e2e/audio-voice-to-idea.spec.ts` — covers MOB-02 end-to-end
- [ ] Shared MediaRecorder mock fixture under `src/test/mocks/mediaRecorder.ts`

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Reuses existing Supabase auth — no new login surface |
| V3 Session Management | yes | Reuses existing httpOnly cookie session |
| V4 Access Control | yes | RLS on `project_files` enforced via `FileService` |
| V5 Input Validation | yes | Validate file MIME type + size client-side; backend already validates `audioUrl` |
| V6 Cryptography | n/a | No new crypto |
| V13 API Security | yes | CSRF token on `/api/ai` POST (existing requirement); rate limiting already enforced from Phase 1 SEC-04 |

### Known Threat Patterns for browser audio + storage uploads
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file masquerading as audio | Tampering | Validate `file.type` + size client-side; backend Whisper rejects non-audio anyway |
| Oversized upload (DoS / cost abuse) | DoS | 25MB client cap + rate limiting on `/api/ai` (SEC-04, in place) |
| CSRF on transcribe endpoint | Tampering | `useCsrfToken()` already required for `/api/ai` (SEC-02) |
| Unauthorized access to other users' audio in Storage | Info Disclosure | RLS on `project-files` bucket already enforced |
| Mic permission abuse / phantom recording | Privacy | Cleanup MediaStream tracks on unmount; clear visual REC indicator (D-03) |
| User uploads private audio they don't own (e.g., copyrighted) | n/a (user consent) | Out of scope — terms-of-service issue |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/04-audio-voice-to-idea/04-CONTEXT.md` — locked decisions, canonical refs
- `.planning/REQUIREMENTS.md` — MM-03, MM-04, MM-06, MOB-02 definitions
- `.planning/STATE.md` — Phase 3 completion + iOS Safari WebM research flag
- `design-matrix-app/CLAUDE.md` — stack and conventions
- MDN: MediaRecorder API, MediaRecorder.isTypeSupported, MediaStream.getTracks

### Secondary (MEDIUM confidence)
- OpenAI Whisper API docs — 25MB file limit, accepted formats (webm, mp4, mp3, wav, m4a, ogg)
- Phase 3 implementation pattern (stage machine, normalizer) — referenced via CONTEXT.md, planner should grep actual files

### Tertiary (LOW confidence — verify in Wave 0)
- Webm opus bitrate estimate (~1MB/min) — used only for size warning threshold

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libs already in repo, MediaRecorder is browser-native
- Architecture: HIGH — Phase 3 established the exact pattern to mirror
- Pitfalls: HIGH — iOS Safari quirks documented in MDN + STATE.md research flag
- Backend integration: HIGH — endpoint live, signature documented in CONTEXT.md

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable APIs, established patterns)

---
*Phase: 04-audio-voice-to-idea — research complete, ready for planning.*
