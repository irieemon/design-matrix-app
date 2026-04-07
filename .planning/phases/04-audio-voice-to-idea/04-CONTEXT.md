# Phase 4: Audio & Voice-to-Idea - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can upload audio files or record voice on mobile and receive a Whisper-transcribed idea card. Both paths (file upload and live recording) live inside the existing `AIIdeaModal` as a new "Audio" tab. The result flows into the same review-then-create pattern established in Phase 3 for images. Backend transcription endpoint is already live (Phase 2).

</domain>

<decisions>
## Implementation Decisions

### Entry Point
- **D-01:** Audio features live as a new **"Audio" tab inside `AIIdeaModal`** — 3rd tab alongside the existing "Generate" and "Image" tabs. Both sub-features (microphone recording and file upload) are accessible from within this single tab. No new toolbar button or separate modal. Consistent with the Phase 3 pattern of extending `AIIdeaModal` for each new modality.

### Audio Tab Layout
- **D-02:** The Audio tab has two side-by-side sub-sections within the tab: **Record** (mic icon, tap-to-toggle recording) and **Upload** (file picker / drag-and-drop for audio files). User picks whichever path they want.

### Voice Recording UX
- **D-03:** Recording is **tap to start / tap to stop** (toggle). Not push-to-talk. A live timer shows elapsed recording time while recording is active. A pulsing indicator (● REC) shows the recording state clearly. No press-and-hold required — better for longer thoughts and hands-free after the first tap.

### Transcription → Idea Card Flow
- **D-04:** After Whisper returns, **show the transcript for review** before creating an idea. Display: full transcription text, summary (2-3 sentences), key points. User can edit the auto-filled title before clicking "Create Idea". Consistent with Phase 3 image flow — deliberate, no auto-creation surprises. Same stages: `idle → recording/uploading → transcribing → done | error`.

### Progress Feedback (MM-06)
- **D-05:** Use **step indicators** matching Phase 3's stage-based feedback pattern. For file upload path: Upload → Transcribing → Done. For recording path: Recording → Uploading → Transcribing → Done. User sees exactly which step is active, complete, or pending. No fake progress bars — Whisper gives no real progress signal.

### Accepted File Formats
- **Claude's Discretion:** Accept standard audio formats: `audio/mpeg` (mp3), `audio/wav`, `audio/webm`, `audio/mp4` (m4a), `audio/ogg`. Browser `MediaRecorder` typically outputs `audio/webm` — pass through directly to Whisper without conversion (Whisper supports it). Cap pre-upload file size at ~25MB (Whisper API limit).

### Mobile Recording API
- **Claude's Discretion:** Use browser `MediaRecorder` API with `navigator.mediaDevices.getUserMedia({ audio: true })`. No external library needed. Handle permission denied gracefully with a clear message. iOS Safari requires a direct user gesture (the tap) to open the mic — the tap-to-start design satisfies this requirement naturally.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — already built in Phase 2
- `api/_lib/ai/transcribeAudio.ts` — `handleTranscribeAudio(req, res)` handler. Takes `{ audioUrl, projectContext, language }`. Returns `{ transcription: { text, summary, keyPoints, language, duration } }`. Endpoint: `POST /api/ai?action=transcribe-audio`. Uses `experimental_transcribe` via `@ai-sdk/openai` (targeted exception — Vercel AI Gateway doesn't support transcription models).

### Frontend — entry point to modify
- `src/components/AIIdeaModal.tsx` — Add "Audio" tab here. Currently has two tabs: "Generate" (text) and "Image" (Phase 3). New tab: sub-section with mic recorder + sub-section with file upload → upload audio → transcribe → review → create idea card. Same `onAdd()` callback wired to matrix.

### Frontend — Phase 3 image tab as pattern to follow
- Phase 3 added the Image tab to `AIIdeaModal` — reuse the exact stage machine pattern (`ImageStage` → `AudioStage`), the normalized result → `IdeaCard` mapping, and the file upload → Supabase Storage → analyze-endpoint flow.
- `src/lib/fileService.ts` — `FileService.uploadFile()` handles direct Supabase Storage upload. Reuse for audio files.
- `src/lib/imageResize.ts` — Canvas-based resize utility for images. No equivalent needed for audio, but the pattern of client-side processing before upload is relevant.

### Types
- `src/types/index.ts` — `ProjectFile`, `IdeaCard` types. Audio files will use `ProjectFile` with `mime_type: audio/*`.

### Requirements
- `.planning/REQUIREMENTS.md` §Multi-Modal AI — MM-03, MM-04, MM-06
- `.planning/REQUIREMENTS.md` §Mobile Experience — MOB-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AIIdeaModal.tsx` — Already has a two-tab structure (`generate` | `image`). Adding `audio` extends the `Tab` type union and adds a third tab header. The image tab's stage machine (`idle → resizing → uploading → analyzing → done | error`) maps directly to an audio equivalent.
- `FileService.uploadFile(file, projectId, contentPreview, uploadedBy)` — Direct Supabase Storage upload to `project-files` bucket. Reuse for audio files (no changes needed to FileService).
- `normalizeAnalysisResult()` pattern in `AIIdeaModal.tsx` — Translates backend analysis shape into `{ subject, description, textContent, insights, relevanceScore }` for the review UI. Audio transcription result needs a similar normalizer: `{ text, summary, keyPoints }` → `{ subject (from summary first line), description (summary), textContent (full transcript), insights (keyPoints) }`.
- `mapRelevanceToPriority()` in `AIIdeaModal.tsx` — Maps relevance score → `IdeaCard['priority']`. Reuse or default to `'moderate'` for voice (no relevance score from transcription).

### Established Patterns
- Stage machine for async multi-step operations (idle → uploading → analyzing → done | error) established in Phase 3 for images. Audio follows the same pattern with an additional `recording` stage at the front of the recording path.
- `resizeImageToFile()` utility: client-side processing before upload. Audio doesn't need resize but same pattern applies (process → upload → call endpoint with URL).
- `useCsrfToken()` hook used in AIIdeaModal for authenticated API calls — carry forward unchanged.
- All modals use `BaseModal` wrapper — no new modal structure needed.

### Integration Points
- `onAdd(idea: Omit<IdeaCard, ...>)` callback — already wired from `AIIdeaModal` to the matrix. Audio path maps transcription result to the same shape.
- `POST /api/ai?action=transcribe-audio` — endpoint is live. Frontend calls it with `{ audioUrl, projectContext, language: 'en' }`. `audioUrl` comes from Supabase Storage public URL after upload.
- `projectContext: { projectName, projectDescription, projectType }` from `currentProject` prop already passed to `AIIdeaModal`.
- Browser `MediaRecorder` → `audio/webm` blob → `FileService.uploadFile()` → Supabase Storage URL → transcribe endpoint. No server-side conversion needed.

</code_context>

<specifics>
## Specific Ideas

- Recording UI: "● REC" pulsing indicator + elapsed timer (e.g., `0:04`) during active recording, clearly visible on mobile
- Audio tab internal layout: two sub-sections side by side — "🎤 Record" on the left, "📁 Upload" on the right (or stacked on narrow mobile viewports)
- Review screen mirrors image review: transcript text block, key points list, editable title field pre-filled from summary, "Create Idea" + "Discard" buttons

</specifics>

<deferred>
## Deferred Ideas

- **Language selection** — `handleTranscribeAudio` accepts a `language` param, but exposing it to users is deferred. Default to `'en'` for now.
- **Recording in brainstorm view** — A dedicated mic button in the brainstorm session toolbar (outside AIIdeaModal) was considered but deferred. The Audio tab in AIIdeaModal is sufficient for Phase 4; a faster brainstorm-native path can be added later.
- **Audio file attachment to existing ideas** — Attaching audio to existing ideas (not creating new ones) is out of scope.
- **Waveform visualization** — Real-time audio waveform during recording would be polished but adds complexity. Step indicators are sufficient for now.

</deferred>

---

*Phase: 04-audio-voice-to-idea*
*Context gathered: 2026-04-06*
