---
status: awaiting_human_verify
trigger: "transcribe-audio 500 — see .planning/phases/04-audio-voice-to-idea/.continue-here.md"
created: 2026-04-07
updated: 2026-04-07
---

## Current Focus

hypothesis: THIRD ROOT CAUSE CONFIRMED — FileService.uploadFile uses singleton supabase client; the internal getSession() deadlocks on the auth lock (supabase-js #873 / anti-pattern #2). Upload never reaches the network.
test: HAR over 68s after prior fixes deployed shows ZERO POSTs to supabase storage endpoint. UI stuck on "Uploading" forever.
expecting: After switching uploadFile to createAuthenticatedClientFromLocalStorage(), the storage POST fires, upload completes, transcribe-audio is called, and transcription returns 200.
next_action: User commits + pushes + hard-refreshes (bundle hash changes) + retries and pastes new HAR or confirms success.

## Symptoms

expected: Audio uploaded from AIIdeaModal transcribes successfully and returns text.
actual: 500 response with generic body {"error":"Failed to transcribe audio"}. Reaches handler (not CSRF-blocked).
errors: Generic 500, real exception swallowed at transcribeAudio.ts:129-132.
reproduction: Login desktop Chrome → open AI Idea modal → upload/record audio → submit → 500.
started: Never worked in phase 04. Related CSRF 403 was resolved earlier this session.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-07
  checked: api/_lib/ai/transcribeAudio.ts full file
  found: Catch block at 129-132 returns only generic message, no debug info. Handler calls experimental_transcribe with `audio: new Uint8Array(audioBuffer)` and reads `transcriptionResult.text`. Fetches audioUrl on line 44 before transcribing.
  implication: Cannot determine root cause without error surfacing patch.

- timestamp: 2026-04-07
  checked: Production HAR response body after deploying debug-surfacing patch (commit e45309b).
  found: `TypeError: Failed to parse URL from projects/848426ce-.../files/1219bc18-..._recording-1775581224742.webm` at node:internal/deps/undici/undici:14902:13.
  implication: audioUrl is a Supabase Storage object path, not an absolute URL. undici fetch requires absolute URLs. Root cause confirmed.

- timestamp: 2026-04-07
  checked: src/components/AIIdeaModal.tsx:153-156 + FileService.uploadFile return shape.
  found: Client falls through `publicUrl || public_url || storage_path`. For private `project-files` bucket, publicUrl is absent, so storage_path is sent.
  implication: Server must resolve the path. analyzeFile.ts already uses the same pattern: `supabase.storage.from('project-files').createSignedUrl(storage_path, 3600)`. Consistent fix path.

## Resolution

root_cause: THREE layered root causes hid behind each other.
  1. transcribeAudio.ts called fetch() on a Supabase Storage object path instead of a signed URL → undici TypeError.
  2. OPENAI_API_KEY in Vercel was stale/invalid (rotated by user).
  3. FileService.uploadFile used the singleton `supabase` client. supabase-js triggers an internal getSession() on storage and table operations, which deadlocks on the auth lock (issue #873 / anti-pattern #2). Upload never hit the network — UI stuck on "Uploading".
fix:
  1. transcribeAudio.ts: added resolveAudioUrl() that mints a signed URL for storage paths via service-role/anon key.
  2. User rotated OPENAI_API_KEY in Vercel.
  3. fileService.ts: uploadFile now obtains a per-call client via createAuthenticatedClientFromLocalStorage() (lock-free, bypasses getSession). Both the storage upload and the project_files insert use the same lock-free client. cleanupFailedUpload accepts an optional client and prefers the lock-free client as well.
verification: Pending user hard-refresh + retry on prod deployment (frontend bundle hash changes, so hard refresh required).
files_changed:
  - api/_lib/ai/transcribeAudio.ts
  - src/lib/fileService.ts
