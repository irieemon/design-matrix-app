# Phase 3: Image Analysis - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can upload images and receive AI-powered visual analysis and text extraction. The result flows into the idea creation workflow — users review the analysis and create an idea card from it. Image uploads go direct to Supabase Storage (not through serverless function body) to avoid the 4.5MB limit. Images are resized client-side before upload to control API costs.

Backend analysis endpoint is already built (Phase 2). This phase is primarily a frontend integration problem.

</domain>

<decisions>
## Implementation Decisions

### Upload Entry Point
- **D-01:** Image upload lives as a new **"Image" tab inside `AIIdeaModal`** — alongside the existing "AI Generate" (text-based) tab. No new toolbar button or separate modal. Minimal new UI surface, users are already in the AI idea creation flow.

### Analysis → Idea Card Flow
- **D-02:** After analysis completes, the result is shown **inside the modal for user review**. User sees what AI found (visual summary, extracted text, insights), then clicks "Create Idea" to add it to the matrix. The idea card is pre-filled with the analysis content. No auto-creation — user confirms before committing.

### Image Persistence
- **D-03:** Uploaded images **persist in the project** alongside PDFs and other project files. Reuses the existing `FileService` / `project-files` bucket pattern exactly. Users can reference the image later from the project files view.

### Analysis Type
- **Claude's Discretion:** Always use `'general'` analysis type for now (the handler already supports ui_design, diagram_flow, document_screenshot — but don't expose type selection to users in Phase 3). Simplest approach; analysis type selection can be added in a future iteration.

### Client-Side Resize (MM-08)
- **Claude's Discretion:** Resize images client-side to max 2048px on longest edge, JPEG quality 0.85, before uploading to Supabase Storage. Cap total upload size at ~4MB after resize. Use Canvas API (no extra library needed).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — already built in Phase 2
- `api/_lib/ai/analyzeImage.ts` — `handleAnalyzeImage(req, res)` handler. Takes `{ imageUrl, projectContext, analysisType }`. Returns `{ analysis: { analysisType, subject, visualElements, textContent, insights, relevanceScore, confidence, projectRelevance } }`. Endpoint: `POST /api/ai?action=analyze-image`.

### Frontend — image upload entry point to modify
- `src/components/AIIdeaModal.tsx` — Add "Image" tab here. Currently has one flow: text title → AI generates idea. New tab: image upload → analyze → review → create idea.

### Frontend — file upload and storage pattern to follow
- `src/components/FileUpload.tsx` — Existing file upload component; uses FileService and Supabase Storage. Pattern to follow for image upload.
- `src/lib/fileService.ts` — `FileService.uploadFile()` handles direct Supabase Storage upload to `project-files` bucket at path `projects/${projectId}/files/...`. Reuse for images.

### Types and storage config
- `src/types/index.ts` — `ProjectFile` type; images will use the same type (mime_type: `image/*`).

### Requirements
- `.planning/REQUIREMENTS.md` §Multi-Modal AI — MM-01, MM-02, MM-07, MM-08

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FileService.uploadFile(file, projectId, contentPreview, uploadedBy)` — Direct Supabase Storage upload, returns `{ success, file, error }`. Reuse for image uploads exactly.
- `FileUpload.tsx` — Full drag-and-drop upload UI component already exists. Can be adapted or used as reference for image upload UI inside `AIIdeaModal`.
- `AIIdeaModal.tsx` — Component to modify: add "Image" tab. Currently: user types title → `aiService.generateIdea()` → `generatedIdea` state → "Add Idea" button. New tab mirrors this: file input → upload → analyze → `analyzedImage` state → "Create Idea" button.

### Established Patterns
- `FileService` uses `supabase.storage.from('project-files').upload(storagePath, file)` — direct upload, no serverless body involvement. Satisfies MM-07 out of the box.
- `AIIdeaModal` result state pattern: `generatedIdea: { content, details, priority }` — the image analysis result should map to the same shape before calling `onAdd()`.
- All modals use `BaseModal` wrapper from `src/components/shared/` — `AIIdeaModal` already does.
- Client-side Canvas resize: use `canvas.toBlob()` / `canvas.toDataURL()` before `FileService.uploadFile()`. No extra library needed.

### Integration Points
- `onAdd(idea)` callback in `AIIdeaModal` — already wired to the matrix. Image analysis result maps to the same `Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>` shape.
- `POST /api/ai?action=analyze-image` — endpoint is live. Frontend just needs to call it with `{ imageUrl, projectContext, analysisType: 'general' }`. The `imageUrl` comes from the Supabase Storage public URL after upload.
- `projectContext` for the analyze call: `{ projectName, projectDescription, projectType }` from `currentProject` prop (already passed to `AIIdeaModal`).

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- **Analysis type selection UI** — backend already supports ui_design, diagram_flow, document_screenshot. Exposing these to users is a future iteration.
- **Image-only idea attachment** — attaching images to existing ideas (not creating new ones) is out of scope for this phase.
- **Batch image upload** — uploading multiple images at once and getting multiple ideas. Deferred.

</deferred>

---

*Phase: 03-image-analysis*
*Context gathered: 2026-04-06*
