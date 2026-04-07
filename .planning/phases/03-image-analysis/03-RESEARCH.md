# Phase 3: Image Analysis - Research

**Researched:** 2026-04-06
**Domain:** Browser Canvas API, Supabase Storage, AI Vision endpoint integration, React modal UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Image upload lives as a new "Image" tab inside `AIIdeaModal` — alongside the existing "AI Generate" tab. No new toolbar button or separate modal.
- **D-02:** After analysis completes, the result is shown inside the modal for user review. User clicks "Create Idea" to add it. No auto-creation.
- **D-03:** Uploaded images persist in the project via the existing `FileService` / `project-files` bucket pattern. Reuse `FileService.uploadFile()` exactly.
- **Analysis type:** Always use `'general'` analysis type. No type-selection UI in Phase 3.

### Claude's Discretion

- Client-side resize to max 2048px longest edge, JPEG quality 0.85. Cap upload at ~4MB post-resize. Use Canvas API (no extra library).
- The `"Cancel"` button copy on the existing AI Generate tab is updated to `"Close"` for both tabs (matches UI-SPEC D-02 consistency note).

### Deferred Ideas (OUT OF SCOPE)

- Analysis type selection UI (ui_design, diagram_flow, document_screenshot)
- Attaching images to existing ideas
- Batch image upload
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MM-01 | User can upload image and receive AI-powered visual analysis | Backend `handleAnalyzeImage` is live at `POST /api/ai?action=analyze-image`; frontend needs upload → signed URL → call endpoint flow |
| MM-02 | User can upload image and receive OCR text extraction via GPT vision | Covered by the same `handleAnalyzeImage` endpoint (`general` analysis type); `textContent` field in response contains extracted text |
| MM-07 | File uploads go direct to Supabase Storage (not through serverless body) | `FileService.uploadFile()` already uses `supabase.storage.from('project-files').upload()` — satisfies this out of the box |
| MM-08 | Client-side image resize before upload to control API costs | Canvas API resize pattern documented below; no new library needed |
</phase_requirements>

---

## Summary

Phase 3 is primarily a frontend integration problem. The backend `handleAnalyzeImage` endpoint is already built and live at `POST /api/ai?action=analyze-image`. It accepts `{ imageUrl, projectContext, analysisType }` and returns a structured analysis object. The frontend work is: add an "Image" tab to `AIIdeaModal`, wire up a drag-and-drop file input, resize the image client-side with Canvas API, upload it to Supabase Storage via `FileService.uploadFile()`, obtain a signed URL, call the backend, display the result, and map it to the existing `onAdd()` idea shape.

The primary complexity is the URL hand-off: the `project-files` bucket is private, so `FileService.uploadFile()` stores the file but does not return a public URL. The analyze endpoint needs a URL the model can fetch. The solution is to call `supabase.storage.from('project-files').createSignedUrl(storagePath, 3600)` immediately after upload to get a 1-hour signed URL, then pass that to the backend. This pattern exists in `FileService.getFileUrl()` but is not wired into `uploadFile()` — a small inline call in the new image flow handles it.

The second consideration is CSRF: every `POST /api/ai` call must include the `X-CSRF-Token` header (read from the `csrf-token` cookie via `useCsrfToken()`). The existing `BaseAiService.fetchWithErrorHandling` does NOT include CSRF headers, so the new image analysis fetch must use `useCsrfToken()` directly inside the component — same pattern used elsewhere in the codebase.

**Primary recommendation:** Add the `ImageUploadTab` as inline JSX inside `AIIdeaModal.tsx` (not a separate component file — matches the existing modal pattern per UI-SPEC). Use `useCsrfToken()` hook to get CSRF headers. After `FileService.uploadFile()` succeeds, call `createSignedUrl` on the returned `storage_path`, then POST to the analyze endpoint.

---

## Standard Stack

### Core (all already in project — no new installs)

| Library / API | Purpose | Source |
|---------------|---------|--------|
| Browser Canvas API | Client-side image resize before upload | [VERIFIED: codebase — no canvas library used; Canvas API is built-in] |
| `FileService.uploadFile()` | Direct Supabase Storage upload, returns `ProjectFile` with `storage_path` | [VERIFIED: src/lib/fileService.ts] |
| `supabase.storage.createSignedUrl()` | Get 1-hour URL for the uploaded image to pass to backend | [VERIFIED: src/lib/fileService.ts — `getFileUrl()` uses this pattern] |
| `useCsrfToken()` | Provides `getCsrfHeaders()` — must be included in the analyze API call | [VERIFIED: src/hooks/useCsrfToken.ts] |
| `POST /api/ai?action=analyze-image` | Backend vision analysis endpoint (already built, Phase 2) | [VERIFIED: api/ai.ts line 51, api/_lib/ai/analyzeImage.ts] |
| `lucide-react` icons | `ImagePlus`, `Eye`, `RefreshCw`, `AlertCircle` for the new tab UI | [VERIFIED: src/components/AIIdeaModal.tsx — lucide already imported] |

### Installation

No new packages required. All dependencies are already installed. [VERIFIED: package.json review, all tooling pre-exists]

---

## Architecture Patterns

### Pattern 1: The Upload → Sign → Analyze Pipeline

This is the key 3-step sequence that must be understood before planning tasks.

```
[User selects/drops image]
      ↓
[Client-side resize via Canvas API]
      ↓
[FileService.uploadFile(resizedFile, projectId, contentPreview, userId)]
  → returns { success, file: { storage_path, ... } }
      ↓
[supabase.storage.from('project-files').createSignedUrl(storage_path, 3600)]
  → returns { data: { signedUrl } }
      ↓
[POST /api/ai?action=analyze-image  { imageUrl: signedUrl, projectContext, analysisType: 'general' }]
  with headers: Authorization + X-CSRF-Token
      ↓
[Display analysis result in modal preview card]
      ↓
[User clicks "Create Idea from Analysis" → maps analysis to IdeaCard shape → onAdd()]
```

**Why signed URL not public URL:** The `project-files` bucket is private (no `public: true` in `FileService.initializeBucket()`). The backend `handleAnalyzeImage` uses the AI SDK's `{ type: 'image', image: imageUrl }` vision content part, which fetches the URL directly. A signed URL with a 1-hour TTL is sufficient for the request lifecycle. [VERIFIED: src/lib/fileService.ts lines 401-407, api/_lib/ai/analyzeImage.ts lines 74-85]

### Pattern 2: Canvas API Client-Side Resize

```typescript
// Source: [ASSUMED — Canvas API is standard, no library docs needed]
async function resizeImageToBlob(
  file: File,
  maxEdgePx = 2048,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width, height } = img
      const longestEdge = Math.max(width, height)

      // If already within limit, return original
      if (longestEdge <= maxEdgePx) {
        resolve(file)
        return
      }

      const scale = maxEdgePx / longestEdge
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas resize failed')); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}
```

**Key detail:** Always output JPEG (`image/jpeg`) regardless of input format. This ensures consistent file size control. GIF animations are flattened to a single frame. [ASSUMED — Canvas toBlob JPEG output is standard browser behavior]

### Pattern 3: CSRF-Aware Fetch in a Component

The existing `BaseAiService.fetchWithErrorHandling` does NOT include CSRF headers. [VERIFIED: src/lib/ai/services/BaseAiService.ts lines 95-102]. The analyze-image call is made directly from the component (not through `aiService`), so CSRF must be included explicitly.

```typescript
// Source: [VERIFIED: src/hooks/useCsrfToken.ts]
const { getCsrfHeaders } = useCsrfToken()

const response = await fetch('/api/ai?action=analyze-image', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,  // from localStorage (BaseAiService pattern)
    ...getCsrfHeaders(),                        // X-CSRF-Token from cookie
  },
  body: JSON.stringify({
    imageUrl: signedUrl,
    projectContext: {
      projectName: currentProject?.name,
      projectType: currentProject?.project_type,
      description: currentProject?.description,
    },
    analysisType: 'general',
  }),
})
```

### Pattern 4: Analysis Result → IdeaCard Shape Mapping

The `onAdd()` callback expects `Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>`. The backend returns a freeform object (sometimes JSON, sometimes raw text — see `analyzeImage.ts` lines 89-112). The frontend must normalize this into the idea shape:

```typescript
// Source: [VERIFIED: src/components/AIIdeaModal.tsx lines 73-88 — existing handleSubmit pattern]
const mappedIdea = {
  content: analysis.subject || analysis.description || 'Image Analysis',
  details: [
    analysis.textContent ? `Extracted text: ${analysis.textContent}` : null,
    analysis.insights?.join(' ') || analysis.extractedText || '',
    analysis.description || '',
  ].filter(Boolean).join('\n\n'),
  x: Math.round(260 + Math.random() * 100 - 50),
  y: Math.round(260 + Math.random() * 100 - 50),
  priority: mapRelevanceToPriority(analysis.relevanceScore || analysis.relevance),
  created_by: currentUser?.id || 'Anonymous',
  is_collapsed: true,
  editing_by: null,
  editing_at: null,
}
```

**Key insight:** The backend response shape is NOT guaranteed to be the structured JSON described in CONTEXT.md (`analysisType`, `subject`, `visualElements`, etc.). `analyzeImageWithVision` only returns that shape if the AI model responds with JSON. More often it returns `{ type, description, extractedText, insights, relevance }`. The mapping function must handle both shapes. [VERIFIED: api/_lib/ai/analyzeImage.ts lines 88-113]

### Recommended Project Structure

No new directories needed. All changes are within existing files:

```
src/
├── components/
│   └── AIIdeaModal.tsx         ← MODIFY: add tab state + ImageUploadTab inline JSX
src/
├── lib/
│   └── fileService.ts          ← READ-ONLY: reuse FileService.uploadFile() + getFileUrl() pattern
api/
├── _lib/ai/
│   └── analyzeImage.ts         ← READ-ONLY: endpoint already built, no changes
```

### Anti-Patterns to Avoid

- **Do not pass the file through the serverless function body.** Always upload to Supabase Storage first, then pass the URL. The `project-files` bucket handles direct uploads. [VERIFIED: MM-07, FileService implementation]
- **Do not use the base64 data URL as the imageUrl.** The backend fetches the URL; a base64 data URL may exceed memory limits in the serverless function. Always use the Supabase signed URL.
- **Do not create a new `ImageUploadService` or service file.** The UI-SPEC and CONTEXT.md both specify the ImageUploadTab is inline in `AIIdeaModal.tsx`. Keep the logic co-located with the component for this phase.
- **Do not omit the CSRF header.** `POST /api/ai` is wrapped in `withCSRF()`. Missing the `X-CSRF-Token` header returns 403. [VERIFIED: api/ai.ts line 71, src/lib/api/middleware/withCSRF.ts]
- **Do not attempt to parse the analysis response as structured JSON unconditionally.** The backend sometimes returns `{ description, extractedText, insights, relevance }` instead of `{ subject, visualElements, textContent, insights, relevanceScore }`. [VERIFIED: api/_lib/ai/analyzeImage.ts lines 88-113]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File storage | Custom storage layer | `FileService.uploadFile()` | Already handles validation, path generation, sanitization, DB metadata, cleanup on failure |
| Signed URLs | Custom URL generation | `supabase.storage.createSignedUrl()` (pattern in `FileService.getFileUrl()`) | Already implemented, correct path normalization included |
| Drag-and-drop | dnd-kit or third-party | Native HTML5 drag events (`onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop`) | UI-SPEC specifies no library; native events are sufficient for a single drop zone |
| Image resize | `browser-image-compression`, `compressor.js` | Canvas API (`canvas.toBlob()`) | CONTEXT.md explicitly says "no extra library needed"; Canvas API is built-in and sufficient |
| Progress tracking | Custom progress state | Supabase upload progress callback + component state | Supabase Storage SDK supports upload progress via `onUploadProgress` option |

**Key insight:** This phase's complexity is entirely in sequencing three existing systems (Canvas resize → FileService upload → analyze endpoint), not in building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Private Bucket — No Public URL Available

**What goes wrong:** Developer calls `supabase.storage.from('project-files').getPublicUrl(path)` — it returns a URL that 403s because the bucket is private.
**Why it happens:** `FileService` uses `public: false` on the bucket. `getPublicUrl()` generates a URL but it only works if the bucket is public.
**How to avoid:** Always use `createSignedUrl(path, 3600)` after upload. This is already done in `FileService.getFileUrl()`.
**Warning signs:** Backend returns 500 or AI SDK logs a fetch error on the image URL. [VERIFIED: src/lib/fileService.ts lines 276-344]

### Pitfall 2: Backend Response Shape Variability

**What goes wrong:** Frontend destructures `{ subject, visualElements, textContent, insights, relevanceScore }` from the response and gets `undefined` for everything because the backend returned `{ description, extractedText, insights, relevance }`.
**Why it happens:** `analyzeImageWithVision` has two code paths — JSON parse success (returns the AI's JSON) vs. non-JSON (returns a normalized object with different field names).
**How to avoid:** Write a `normalizeAnalysisResult(raw)` function that accepts both shapes and maps to a stable internal type. Test against both shapes.
**Warning signs:** Analysis result card renders empty fields despite a successful API response. [VERIFIED: api/_lib/ai/analyzeImage.ts lines 88-113]

### Pitfall 3: CSRF Token Missing on First Render

**What goes wrong:** User opens the modal and immediately clicks "Analyze Image" — the fetch returns 403 CSRF_HEADER_MISSING.
**Why it happens:** `useCsrfToken()` reads from the `csrf-token` cookie asynchronously via `setTimeout(0)` on mount. If the component is fast, `csrfToken` is still `null` when the user clicks.
**How to avoid:** Disable the "Analyze Image" button while `!hasToken` (returned by `useCsrfToken()`). The token is typically available within one tick, so this is rarely visible to users.
**Warning signs:** 403 on the first analyze attempt in a fresh page load. [VERIFIED: src/hooks/useCsrfToken.ts lines 63-78]

### Pitfall 4: FileService Triggers Background AI Analysis

**What goes wrong:** `FileService.uploadFile()` automatically calls `triggerFileAnalysis(fileId, projectId)` after every upload. For images uploaded for visual analysis, this triggers a second analysis (the file-level analysis for the project files view). This is expected behavior, not a bug — but the developer might wonder why there are two analysis calls.
**Why it happens:** `FileService` is designed to auto-analyze all uploaded files.
**How to avoid:** No action needed — just be aware. The background `analyze-file` call and the synchronous `analyze-image` call are independent. [VERIFIED: src/lib/fileService.ts lines 134-140]

### Pitfall 5: Canvas Resize on Non-Raster Formats

**What goes wrong:** A GIF file loses its animation entirely (flattened to first frame). SVG files may render blank because Canvas cannot reliably draw SVG from an `<img>` element cross-browser.
**How to avoid:** Accept only `image/jpeg`, `image/png`, `image/webp`, `image/gif` (matches UI-SPEC). SVG is not in the accepted types. GIF animation loss is acceptable for analysis purposes.
**Warning signs:** User uploads animated GIF, only first frame analyzed — this is expected. [ASSUMED — standard Canvas behavior with GIF]

### Pitfall 6: File Too Large Before Resize Check

**What goes wrong:** User uploads a 25MB RAW file. Attempting to `URL.createObjectURL()` and draw to Canvas runs out of memory on low-end mobile.
**How to avoid:** Validate file size BEFORE resize attempt. Reject files above 20MB with the copy from UI-SPEC: "This image is too large (max 20MB). Please choose a smaller file." [VERIFIED: UI-SPEC copywriting contract]

---

## Code Examples

### Supabase Upload + Signed URL (the key sequence)

```typescript
// Source: [VERIFIED: src/lib/fileService.ts uploadFile() + getFileUrl()]

// Step 1: Upload
const uploadResult = await FileService.uploadFile(
  resizedFile,
  projectId,
  'Image uploaded for AI analysis',
  currentUser?.id
)
if (!uploadResult.success || !uploadResult.file) {
  throw new Error(uploadResult.error || 'Upload failed')
}

// Step 2: Get signed URL for the backend to fetch
const { data: signedData, error: signedError } = await supabase.storage
  .from('project-files')
  .createSignedUrl(uploadResult.file.storage_path, 3600)

if (signedError || !signedData?.signedUrl) {
  throw new Error('Could not generate image URL for analysis')
}

const imageUrl = signedData.signedUrl
```

### Tab State in AIIdeaModal

```typescript
// Source: [VERIFIED: src/components/AIIdeaModal.tsx — existing useState pattern]

type Tab = 'generate' | 'image'
const [activeTab, setActiveTab] = useState<Tab>('generate')
```

### Analysis Result Normalization

```typescript
// Source: [VERIFIED: api/_lib/ai/analyzeImage.ts lines 88-113 — derived from actual response shapes]

interface NormalizedAnalysis {
  subject: string
  description: string
  textContent: string
  insights: string[]
  relevanceScore: number  // 0-100
}

function normalizeAnalysisResult(raw: any): NormalizedAnalysis {
  return {
    subject: raw.subject || raw.description?.split('\n')[0] || 'Image Analysis',
    description: raw.description || raw.projectRelevance || '',
    textContent: raw.textContent || raw.extractedText || '',
    insights: Array.isArray(raw.insights) ? raw.insights : [],
    relevanceScore: typeof raw.relevanceScore === 'number'
      ? raw.relevanceScore
      : raw.relevance === 'high' ? 85
      : raw.relevance === 'medium' ? 55
      : 25,
  }
}
```

### Priority Mapping from Relevance Score

```typescript
// Source: [VERIFIED: src/types/index.ts — IdeaCard priority union type]

function mapRelevanceToPriority(score: number): IdeaCard['priority'] {
  if (score >= 70) return 'strategic'
  if (score >= 40) return 'moderate'
  return 'low'
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `fetch()` to OpenAI | AI SDK `generateText()` with vision content parts | Phase 2 | Backend already migrated; frontend just calls the existing endpoint |
| Monolithic `api/ai.ts` | Modular handlers in `api/_lib/ai/` | Phase 2 | `handleAnalyzeImage` is already extracted; no changes needed |

**Nothing deprecated in this phase.** All patterns used here are current as of the codebase at research time.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Canvas `toBlob('image/jpeg', 0.85)` produces a file ≤ 4MB for inputs ≤ 20MB resized to 2048px | Architecture Patterns — resize | Rare: very complex images at exactly 2048px could exceed 4MB; add a post-resize size check as fallback |
| A2 | GIF first-frame-only behavior in Canvas is acceptable for analysis purposes | Common Pitfalls | Low risk: GIF use case is not a stated priority |
| A3 | The CSRF token is always present in the cookie by the time the user completes file selection (UI timing) | Common Pitfalls | Low risk; mitigation is documented (disable button while !hasToken) |

---

## Open Questions

1. **Does the `project-files` bucket allow the backend serverless function to fetch signed URLs?**
   - What we know: Supabase signed URLs are public-facing HTTPS URLs; they work from any client including server-side fetch.
   - What's unclear: Whether there is any IP-restriction or Vercel-specific network path issue.
   - Recommendation: Test this during Wave 1 implementation. If signed URLs fail from the serverless context, fall back to temporarily making the bucket public or using a Supabase service role to generate a longer-lived signed URL.

2. **Should the image be cleaned up from storage if the user closes the modal without clicking "Create Idea"?**
   - What we know: CONTEXT.md D-03 says images persist alongside PDFs. The UI-SPEC says closing without creating is a "soft discard."
   - What's unclear: Whether orphaned uploads (analyzed but no idea created) are a storage cost concern.
   - Recommendation: Do not clean up on dismiss in Phase 3. The image is a valid `ProjectFile` record and appears in the project files view. Cleanup of unclaimed files is a future concern.

---

## Environment Availability

Step 2.6: The phase is purely frontend code changes plus integration with a pre-existing backend endpoint. No new external tools, CLIs, or services are required. `project-files` bucket must exist in Supabase (already present from Phase 2 / existing app).

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `project-files` Supabase bucket | MM-07 — direct storage upload | Assumed present (existing app) | — | `FileService.initializeBucket()` auto-creates in dev |
| `POST /api/ai?action=analyze-image` | MM-01, MM-02 | Built in Phase 2 | — | None — blocking if Phase 2 not complete |
| Canvas API | MM-08 | Built-in all modern browsers | — | None needed |

**Missing dependencies with no fallback:**
- Phase 2 must be complete (AI SDK foundation + `handleAnalyzeImage`). STATE.md shows Phase 2 plans 02-01, 02-02, 02-03 are marked complete. [VERIFIED: .planning/STATE.md, ROADMAP.md]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/components/__tests__/AIIdeaModal.test.tsx` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MM-01 | User uploads image and receives visual analysis result | component | `npx vitest run src/components/__tests__/AIIdeaModal.test.tsx` | ❌ Wave 0 |
| MM-02 | OCR text extraction surfaces in analysis result (textContent field) | component | `npx vitest run src/components/__tests__/AIIdeaModal.test.tsx` | ❌ Wave 0 |
| MM-07 | Upload goes direct to Supabase Storage (FileService mock called, not POST with body) | unit | `npx vitest run src/components/__tests__/AIIdeaModal.test.tsx` | ❌ Wave 0 |
| MM-08 | Canvas resize reduces image to ≤ 2048px before upload | unit | `npx vitest run src/components/__tests__/imageResize.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/__tests__/AIIdeaModal.test.tsx`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/__tests__/AIIdeaModal.image.test.tsx` — covers MM-01, MM-02, MM-07 (new test file, extend existing `AIIdeaModal.test.tsx` naming convention)
- [ ] `src/lib/__tests__/imageResize.test.ts` — covers MM-08 (Canvas resize utility)
- [ ] `src/test/mocks/fileService.ts` — mock `FileService.uploadFile()` for component tests (likely needs extension, not new file)

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `useCsrfToken()` for `X-CSRF-Token`; `Authorization: Bearer` from localStorage |
| V3 Session Management | no | Session already managed by existing auth layer |
| V4 Access Control | yes | `withAuth` middleware on `POST /api/ai` verifies the request is from an authenticated user |
| V5 Input Validation | yes | File type validation in drop zone (MIME type check); file size check before resize |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns for Image Upload + AI Vision

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file disguised as image | Tampering | MIME type validation client-side + Supabase bucket `allowedMimeTypes` (already configured) |
| Oversized payload DoS | Denial of Service | 20MB pre-resize client check; Supabase 50MB bucket limit (FileService.MAX_FILE_SIZE) |
| SSRF via imageUrl parameter | Elevation of Privilege | Backend uses the imageUrl directly in AI SDK vision content — only Supabase signed URLs should be passed; CSRF + auth ensures only legitimate users can trigger |
| Unauthenticated analysis calls | Spoofing | `withAuth` middleware on the route; frontend must include Bearer token |

---

## Sources

### Primary (HIGH confidence)

- `src/components/AIIdeaModal.tsx` — full component read; confirmed existing state/submit pattern
- `src/lib/fileService.ts` — full read; confirmed `uploadFile()` signature, `createSignedUrl` pattern in `getFileUrl()`
- `api/_lib/ai/analyzeImage.ts` — full read; confirmed endpoint request/response contract, dual response shapes
- `api/ai.ts` — full read; confirmed `POST /api/ai?action=analyze-image` route + CSRF middleware
- `src/hooks/useCsrfToken.ts` — full read; confirmed `getCsrfHeaders()` pattern
- `src/lib/ai/services/BaseAiService.ts` — partial read; confirmed no CSRF headers in existing service calls
- `src/types/index.ts` — confirmed `IdeaCard`, `ProjectFile`, `Project` shapes

### Secondary (MEDIUM confidence)

- `src/components/FileUpload.tsx` — read drag-and-drop and validation patterns as reference
- `.planning/phases/03-image-analysis/03-UI-SPEC.md` — interaction states, copy, accessibility requirements
- `.planning/phases/03-image-analysis/03-CONTEXT.md` — locked decisions, canonical refs

### Tertiary (LOW confidence)

- Canvas API resize behavior for GIF (A2) — standard browser behavior, not verified against a specific MDN page in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries/APIs read directly from source files
- Architecture: HIGH — pipeline derived from reading actual implementation files
- Pitfalls: HIGH for pitfalls 1-4 (verified in source); MEDIUM for pitfalls 5-6 (Canvas behavior is standard)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (30 days — stable codebase, no fast-moving dependencies)
