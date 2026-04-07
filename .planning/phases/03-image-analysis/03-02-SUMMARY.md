---
phase: 03-image-analysis
plan: 02
subsystem: ai-multimodal
tags: [image-analysis, modal, vision, ocr, csrf, supabase-storage]
requires: [03-01]
provides: [image-tab, image-analysis-pipeline]
affects: [src/components/AIIdeaModal.tsx]
tech_added: []
patterns: [direct-storage-upload, signed-url-handoff, normalized-response-shape]
key_files:
  created: []
  modified:
    - src/components/AIIdeaModal.tsx
    - src/components/__tests__/AIIdeaModal.image.test.tsx
decisions:
  - "Mock resizeImageToFile in test (JSDOM cannot fire Image.onload) — passthrough returns input File"
metrics:
  duration: ~25m
  completed: 2026-04-06
  loc_delta: "+486 / -120"
  tests_passed: 5/5
---

# Phase 3 Plan 02: AIIdeaModal Image Tab Summary

One-liner: Adds an "Image" tab to AIIdeaModal that runs the full client-side resize → direct Supabase Storage upload → 1h signed URL → /api/ai?action=analyze-image → result review → create-idea pipeline (MM-01, MM-02, MM-07, MM-08).

## What Was Built

- Tabbed UI inside `AIIdeaModal` with `role="tablist"` and two `role="tab"` buttons. Default tab remains `generate` (no regression to existing AI Generate flow).
- New image tab with: drop zone (drag & drop + click to browse), preview card with filename + size + Analyze/Remove buttons, progress region (`aria-live="polite"`) with stage labels, error region (`aria-live="assertive"`) with retry, and analysis result card (subject, description, extracted text, insights list, relevance badge).
- Pipeline implemented in `handleAnalyzeImage`:
  1. Pre-flight MIME whitelist (`image/jpeg|png|webp|gif`) + 20MB cap (T-03-12, T-03-13).
  2. `resizeImageToFile(file, { maxEdgePx: 2048, quality: 0.85 })` (MM-08 consumer).
  3. `FileService.uploadFile(resized, projectId, 'Image uploaded for AI analysis', userId)` — no image bytes ever sent through the serverless function body (MM-07).
  4. `supabase.storage.from('project-files').createSignedUrl(storage_path, 3600)` for 1h handoff URL (T-03-15).
  5. `fetch('/api/ai?action=analyze-image', …)` with `Authorization: Bearer`, `X-CSRF-Token` (via `useCsrfToken`), and JSON body `{ imageUrl, projectContext, analysisType: 'general' }`.
  6. `normalizeAnalysisResult` accepts both response shapes (`subject/visualElements/textContent/relevanceScore` AND `description/extractedText/relevance`).
- `handleCreateIdeaFromAnalysis` maps normalized result → `Omit<IdeaCard,'id'|'created_at'|'updated_at'>` with `is_collapsed: true`, `editing_by: null`, `editing_at: null`, randomized center coords, and `mapRelevanceToPriority` derived priority.
- Footer updates: both tabs use "Close" instead of "Cancel" (UI-SPEC D-02). Image tab primary right button is "Create Idea from Analysis" (disabled until `analysis` exists).

## Files Modified

- `src/components/AIIdeaModal.tsx` — +~480 lines. Existing AI Generate JSX wrapped in `{activeTab === 'generate' && …}`; new image tab panel added as sibling. All existing props, handlers, and behavior preserved.
- `src/components/__tests__/AIIdeaModal.image.test.tsx` — added a single `vi.mock('../../lib/imageResize', …)` block (passthrough). See Deviations.

## Test Results

`npx vitest run src/components/__tests__/AIIdeaModal.image.test.tsx` — **5/5 GREEN**:

- MM-01: visual analysis renders ✓
- MM-02: OCR `Extracted Text:` surfaces ✓
- MM-07: FileService called once, fetch body carries signed URL ✓
- X-CSRF-Token header present on analyze fetch ✓
- Create Idea from Analysis maps to onAdd payload ✓

`npm run type-check` — no errors introduced in `AIIdeaModal.tsx` or `imageResize.ts`. Pre-existing unrelated errors in `src/utils/{networkPerformanceMonitor,performanceTestRunner,performanceUtils,realtimeDiagnostic,roadmapExport}.ts` are out of scope and logged as deferred.

## Deviations from Plan

### [Rule 3 - Blocking] Test mock for `resizeImageToFile`

- **Found during:** Task 1 verification
- **Issue:** `resizeImageToFile` uses `new Image()` + `img.onload`, which never fires in JSDOM. The pipeline hung at the resize step in tests, never reaching `FileService.uploadFile`. All 5 Plan 01 RED tests timed out instead of asserting against the implementation.
- **Fix:** Added a `vi.mock('../../lib/imageResize', () => ({ resizeImageToFile: vi.fn(async (file: File) => file) }))` block to `src/components/__tests__/AIIdeaModal.image.test.tsx`. This is a passthrough — production behavior is unchanged and the standalone `imageResize.test.ts` (Plan 01) still validates the real Canvas resize logic.
- **Justification:** Modifying the test was the only way to keep the production import path intact while letting JSDOM-bound tests progress past the resize step. Alternative (mocking inside `setup.ts`) would silently affect every other test file.
- **Files modified:** `src/components/__tests__/AIIdeaModal.image.test.tsx`
- **Commit:** 7d6ff85

## Known Stubs

None. All states wired to real data; preview thumbnail uses `URL.createObjectURL`, result card pulls from normalized analysis, errors come from real pipeline failures.

## Manual Verification Checklist (Open Question #1: signed URL reachable from serverless)

The frontend hand-off has been validated by tests; the end-to-end signed-URL ↔ backend reachability still needs human confirmation in dev:

- [ ] Run `npm run dev` and open the matrix on a project with at least one user logged in.
- [ ] Open AIIdeaModal, switch to Image tab, drop a real JPEG/PNG (~1–5MB).
- [ ] Confirm progress UI cycles through "Resizing image..." → "Uploading..." → "Analyzing image with AI...".
- [ ] Confirm the result card renders with non-empty subject and at least one insight.
- [ ] In Network tab: confirm `/api/ai?action=analyze-image` request body has `imageUrl` pointing at `*.supabase.co/storage/v1/object/sign/...` and headers include `X-CSRF-Token`.
- [ ] Confirm backend successfully fetched the signed URL (200 response).
- [ ] Click "Create Idea from Analysis" → confirm new card appears on the matrix at center coords.
- [ ] Try a 25MB file → confirm error "This image is too large (max 20MB). Please choose a smaller file." and no upload.
- [ ] Try an SVG → confirm "This file type is not supported…".

## Self-Check: PASSED

- [x] `src/components/AIIdeaModal.tsx` modified (grep activeTab → 7)
- [x] Commit 7d6ff85 exists in worktree-agent-a4af7a5e branch
- [x] All 5 Plan 01 RED tests now GREEN
- [x] Type-check produces no new errors in modified files
