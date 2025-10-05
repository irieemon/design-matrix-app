# PDF Upload & Processing - Manual Validation Guide

## Fixes Implemented

✅ **Fix 1: PDF.js Module Import**
- Changed dynamic import to use direct module reference
- Added debug logging for PDF.js capabilities

✅ **Fix 2: Localhost AI Analysis Gate Removed**
- Removed environment check blocking AI analysis on localhost
- AI analysis now triggers in development

✅ **Fix 3: CSP-Compliant PDF Viewer**
- Created new PDFViewer component using canvas rendering
- Replaced iframe (CSP violation) with PDF.js canvas
- Added zoom, pagination, and keyboard controls

✅ **Fix 4: FileViewer Integration**
- Integrated PDFViewer into FileViewer component
- PDF preview now uses canvas rendering

---

## Manual Validation Steps

### Test 1: PDF Upload & Text Extraction

**Steps:**
1. Navigate to File Management page
2. Click "Upload" button
3. Select a PDF file (the one you just uploaded: `Steinr_Prioritas_Strategic_Insights_2025-09-15 (2).pdf`)
4. Wait for upload to complete

**Expected Results:**
- ✅ File appears in file list
- ✅ File status shows "AI Pending" or "Analyzing"
- ✅ **No error:** "pdfjs.getDocument is not a function"
- ✅ Console shows: "PDF.js loaded successfully" with `hasGetDocument: true`

**Console Check:**
```javascript
// Should NOT see:
❌ TypeError: pdfjs.getDocument is not a function

// Should see:
✅ PDF.js loaded successfully {hasGetDocument: true, hasGlobalWorkerOptions: true}
```

---

### Test 2: PDF Preview Rendering (CSP Compliance)

**Steps:**
1. Click on the uploaded PDF file in the list
2. Wait for preview modal to open
3. Observe the PDF rendering

**Expected Results:**
- ✅ PDF renders in canvas element (not iframe)
- ✅ Zoom controls visible (+ / - buttons)
- ✅ Page navigation visible (Previous / Next, Page X / Y)
- ✅ PDF content displays correctly
- ✅ **No CSP violation error in console**

**Console Check:**
```javascript
// Should NOT see:
❌ Refused to frame 'https://...supabase.co/' because it violates Content Security Policy

// Should see:
✅ PDF loaded successfully {numPages: X, fileName: "..."}
✅ Page rendered {pageNum: 1, scale: 1.X}
```

---

### Test 3: PDF Viewer Controls

**Steps:**
1. With PDF preview open, test controls:
   - Click "Zoom In" (+) button → PDF should zoom in, percentage increases
   - Click "Zoom Out" (-) button → PDF should zoom out, percentage decreases
   - If multi-page PDF:
     - Click "Next page" (→) → Should show page 2
     - Click "Previous page" (←) → Should show page 1
   - Press Arrow Right key → Next page
   - Press Arrow Left key → Previous page

**Expected Results:**
- ✅ Zoom controls work smoothly
- ✅ Page navigation works
- ✅ Keyboard shortcuts work
- ✅ Page number updates correctly
- ✅ Canvas re-renders without flickering

---

### Test 4: AI Analysis Triggers

**Steps:**
1. After uploading PDF, watch the file status
2. Wait up to 60 seconds

**Expected Results:**
- ✅ Status changes from "AI Pending" → "AI Analyzing" → "AI Ready"
- ✅ **AI analysis actually triggers (not stuck in "Pending")**
- ✅ Console shows API call: `POST /api/ai/analyze-file`

**Console Check:**
```javascript
// Should see:
✅ Background file analysis triggered
✅ API request to /api/ai/analyze-file

// Should NOT see:
❌ File stuck in "AI Pending" forever
❌ No API call to analyze-file
```

---

### Test 5: AI Insights Display

**Steps:**
1. Once AI analysis completes (status = "AI Ready")
2. Click on the PDF file again
3. Look for AI analysis panel

**Expected Results:**
- ✅ AI analysis panel visible
- ✅ Summary text present
- ✅ Key insights displayed
- ✅ Relevance score or similar metadata shown

---

### Test 6: Mobile Responsiveness

**Steps:**
1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or similar
4. Upload and preview PDF

**Expected Results:**
- ✅ Upload button accessible
- ✅ PDF preview opens in mobile view
- ✅ Mobile controls visible (Previous / Next buttons)
- ✅ Canvas scales to fit screen
- ✅ All functionality works on mobile

---

### Test 7: Error Handling

**Steps:**
1. Try uploading a very large PDF (>10MB) - should be rejected
2. Try uploading a corrupted PDF

**Expected Results:**
- ✅ Large files show error: "File too large"
- ✅ Corrupted PDFs show error message with download fallback
- ✅ Error UI displays: "Failed to load PDF document"
- ✅ Download button visible as fallback

---

## Quick Validation Checklist

Use this quick checklist for rapid validation:

- [ ] PDF upload completes without "getDocument is not a function" error
- [ ] PDF preview uses canvas (not iframe)
- [ ] No CSP violations in console
- [ ] Zoom controls work (+/-)
- [ ] Page navigation works (if multi-page)
- [ ] AI analysis triggers and completes
- [ ] AI insights display after completion
- [ ] Mobile responsive
- [ ] Error handling works for invalid files

---

## Console Monitoring

Open browser console (F12 → Console tab) and monitor for:

### ✅ Success Indicators:
```
✅ PDF.js loaded successfully {hasGetDocument: true, ...}
✅ PDF loaded successfully {numPages: X, fileName: "..."}
✅ Page rendered {pageNum: 1, scale: ...}
✅ Background file analysis triggered
✅ API: POST /api/ai/analyze-file
```

### ❌ Error Indicators to Watch For:
```
❌ TypeError: pdfjs.getDocument is not a function
❌ Refused to frame 'https://...supabase.co/'
❌ Content Security Policy directive violated
❌ Could not extract text from PDF
❌ File stuck in "AI Pending" with no API call
```

---

## Network Monitoring

Open Network tab (F12 → Network) and verify:

1. **PDF Upload:**
   - POST to `/api/files/upload` or Supabase Storage
   - Status: 200 OK
   - Response contains file metadata

2. **AI Analysis:**
   - POST to `/api/ai/analyze-file`
   - Status: 200 OK
   - Response contains analysis data

3. **PDF Worker:**
   - GET to `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`
   - Status: 200 OK
   - Type: application/javascript

---

## Known Issues (Not Bugs)

These are expected and can be ignored:

1. **"Multiple GoTrueClient instances"** - Benign warning from Supabase admin client in development
2. **"infinite recursion in policy for relation project_collaborators"** - Known database policy issue (already documented)
3. **"React DevTools"** - Standard development message
4. **"Vercel Analytics"** - Analytics debug mode message

---

## Success Criteria

All tests pass when:

1. ✅ PDF uploads without JavaScript errors
2. ✅ Text extraction works (content_preview populated)
3. ✅ PDF preview renders in canvas (no iframe, no CSP violation)
4. ✅ All viewer controls work (zoom, pagination, keyboard)
5. ✅ AI analysis triggers and completes
6. ✅ AI insights display correctly
7. ✅ Mobile responsive
8. ✅ Error handling graceful

---

## Troubleshooting

### If PDF.js error persists:
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check console for import errors
4. Verify network can access CDN (worker URL)

### If AI analysis doesn't trigger:
1. Check console for API errors
2. Verify OPENAI_API_KEY is set
3. Check Network tab for /api/ai/analyze-file request
4. Look for rate limit errors (429)

### If CSP violation persists:
1. Verify FileViewer uses PDFViewer component (not iframe)
2. Check browser console for exact CSP error
3. Inspect element - should see `<canvas>` not `<iframe>`

---

## Automated Test Suite

Comprehensive Playwright tests available in:
- `tests/pdf-upload-complete-flow.spec.ts`

Run tests:
```bash
npx playwright test tests/pdf-upload-complete-flow.spec.ts --headed
```

**Note:** Tests require test PDF fixtures in `tests/fixtures/` directory.
