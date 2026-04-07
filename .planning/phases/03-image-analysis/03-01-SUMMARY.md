---
phase: 03-image-analysis
plan: 01
subsystem: ai-image-analysis
tags: [test-scaffolding, canvas-resize, mm-08, wave-0]
requires: []
provides:
  - resizeImageToFile utility (MM-08)
  - Wave 0 RED tests for AIIdeaModal image tab (MM-01, MM-02, MM-07)
  - FileService test mocks for signed URL flow
affects: []
tech-stack:
  added: []
  patterns:
    - Canvas API client-side resize (no library)
    - vi.mock for supabase storage + useCsrfToken in component tests
key-files:
  created:
    - src/lib/imageResize.ts
    - src/lib/__tests__/imageResize.test.ts
    - src/test/mocks/fileService.ts
    - src/components/__tests__/AIIdeaModal.image.test.tsx
  modified: []
decisions:
  - Override HTMLCanvasElement width/height accessors in JSDOM to bypass JSDOM clamp
  - Mock Image via global class with microtask onload dispatch
  - Tests assert drawImage args (positions 3,4 = w,h) since canvas dims are unobservable in JSDOM
metrics:
  duration: ~10min
  completed: 2026-04-06
---

# Phase 03 Plan 01: Wave 0 Test Scaffolding + Image Resize Utility Summary

Established Wave 0 test scaffolding for Phase 3 image analysis and shipped the standalone client-side `resizeImageToFile` Canvas utility (MM-08) with full unit-test coverage.

## What Was Built

### `src/lib/imageResize.ts`
Exports:
```ts
export interface ResizeOptions { maxEdgePx?: number; quality?: number }
export async function resizeImageToFile(file: File, options?: ResizeOptions): Promise<File>
```
Defaults: `maxEdgePx = 2048`, `quality = 0.85`. Uses `URL.createObjectURL` + `new Image()` + `<canvas>.toBlob('image/jpeg', q)`. Returns the original file unchanged when the longest edge is already within the limit. Always outputs a `.jpg` filename when resizing. Rejects with `Image load failed` on decode error and `Canvas resize failed` if `toBlob` returns null.

### `src/lib/__tests__/imageResize.test.ts` — 5 unit tests, all GREEN
1. 3000×1500 → longest edge exactly 2048, output `image/jpeg`
2. 1000×1000 → returned unchanged (same File reference, original mime preserved)
3. Decode failure → rejects with `Image load failed`
4. `photo.png` → output filename `photo.jpg`
5. Aspect ratio preserved within tolerance for 4000×3000

### `src/test/mocks/fileService.ts`
Exports `mockUploadFile`, `mockCreateSignedUrl`, `resetFileServiceMocks` for use in component tests that exercise the upload→signed-URL→analyze pipeline.

### `src/components/__tests__/AIIdeaModal.image.test.tsx` — 5 RED tests (expected failing)
- MM-01 visual analysis renders
- MM-02 OCR textContent + "Extracted Text:" label
- MM-07 FileService.uploadFile called with File + projectId + preview + userId; fetch receives `https://signed.example/test.jpg?token=abc`
- X-CSRF-Token header present on `/api/ai?action=analyze-image`
- Create Idea from Analysis maps to `onAdd` payload with `is_collapsed: true`, `editing_by/at: null`, `created_by` = userId

Mocks: `../../lib/fileService`, `../../lib/supabase` (storage.from().createSignedUrl), `../../hooks/useCsrfToken`. Plan 02 will implement the Image tab in `AIIdeaModal.tsx` to turn these green.

## Mock Assumptions for Canvas in JSDOM

JSDOM does **not** implement Canvas. The tests:
1. Override `HTMLCanvasElement.prototype.width`/`height` accessors with property getters/setters that store any value the SUT writes (JSDOM's defaults clamp to 1024).
2. Spy on `getContext` to return `{ drawImage: () => {} }`.
3. Spy on `toBlob` to synchronously invoke the callback with `new Blob(['resized'], { type: 'image/jpeg' })`.
4. Replace `global.Image` with a `MockImage` class whose `src` setter dispatches `onload` (or `onerror`) on a microtask, populating `width`/`height` from a per-test variable.

Because canvas dimensions are unobservable through `canvas.width` (we replaced the prototype accessors), the resize-correctness tests assert via the `drawImage` call's width/height arguments (indices 3 and 4 of `drawImage(img, 0, 0, w, h)`).

## Verification

| Command | Result |
|---|---|
| `npx vitest run src/lib/__tests__/imageResize.test.ts` | 5/5 PASS |
| `npx vitest run src/components/__tests__/AIIdeaModal.image.test.tsx` | 5/5 FAIL (assertion errors only — no SyntaxError, no Cannot find module) — expected RED |

## Deviations from Plan

None — plan executed as written. One self-correction during TDD: initial `drawImage` arg index was wrong (used 4,5 instead of 3,4) and JSDOM canvas-dim clamping required the prototype accessor override. Both fixed inline before commit.

## Commits

- `feat(03-01): add client-side imageResize utility (MM-08)`
- `test(03-01): add Wave 0 RED tests for AIIdeaModal image tab`

## Self-Check: PASSED

- src/lib/imageResize.ts — FOUND
- src/lib/__tests__/imageResize.test.ts — FOUND
- src/test/mocks/fileService.ts — FOUND
- src/components/__tests__/AIIdeaModal.image.test.tsx — FOUND
- Both task commits present on branch
