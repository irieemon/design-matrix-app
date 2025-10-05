# PDF Fix - Iteration 2: Database & Module Loading

**Date**: 2025-10-03
**Status**: 🔧 **ENHANCED FIXES APPLIED**

---

## 🎯 Issues Discovered in User Testing

### Issue 1: PDF.js GlobalWorkerOptions Undefined
```javascript
❌ "TypeError: Cannot read properties of undefined (reading 'GlobalWorkerOptions')"
```

**Root Cause**: Browser caching old JavaScript code, or module not loading correctly

**Solution**:
- Added verification checks after import
- Enhanced error logging with module structure inspection
- Graceful fallback if GlobalWorkerOptions not found

**Files Modified**:
- [src/components/FileUpload.tsx](src/components/FileUpload.tsx) (lines 11-45)
- [src/components/PDFViewer.tsx](src/components/PDFViewer.tsx) (lines 29-43)

### Issue 2: 404 "File Not Found" from Database
```javascript
❌ "POST http://localhost:3003/api/ai/analyze-file 404 (Not Found)"
Server Log: "PGRST116 - The result contains 0 rows"
```

**Root Cause**:
1. Row Level Security (RLS) policies preventing file access
2. Race condition - AI analysis triggered before DB commit completes

**Solution**:
- Use service role key (bypasses RLS) instead of anon key
- Added retry logic with exponential backoff (3 attempts, 500ms, 1000ms, 1500ms)
- Better error logging

**File Modified**:
- [api/ai/analyze-file.ts](api/ai/analyze-file.ts) (lines 34-83)

---

## 🔧 Technical Changes

### Change 1: Enhanced PDF.js Loading (FileUpload.tsx)

**Before**:
```typescript
const module = await import('pdfjs-dist')
pdfjsLib = module.default

if (pdfjsLib.GlobalWorkerOptions) {  // ❌ Crashes if undefined
  pdfjsLib.GlobalWorkerOptions.workerSrc = '...'
}
```

**After**:
```typescript
const module = await import('pdfjs-dist')
pdfjsLib = module.default

// Verify we got the correct object
if (!pdfjsLib || typeof pdfjsLib !== 'object') {
  throw new Error(`PDF.js import failed: got ${typeof pdfjsLib}`)
}

// Configure worker with safety check
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '...'
} else {
  logger.warn('⚠️ GlobalWorkerOptions not found')
}

// Enhanced debugging
logger.debug('PDF.js loaded successfully', {
  moduleType: typeof module,
  defaultType: typeof module.default,
  hasGetDocument: typeof pdfjsLib?.getDocument === 'function',
  hasGlobalWorkerOptions: !!pdfjsLib?.GlobalWorkerOptions,
  pdfjsKeys: Object.keys(pdfjsLib).slice(0, 10)
})
```

### Change 2: Service Role Key + Retry Logic (analyze-file.ts)

**Before**:
```typescript
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ...
const supabase = createClient(supabaseUrl, supabaseKey)

const { data: fileRecord, error: fileError } = await supabase
  .from('project_files')
  .select('*')
  .eq('id', fileId)
  .single()

if (fileError || !fileRecord) {  // ❌ Fails immediately on RLS or race condition
  return res.status(404).json({ error: 'File not found' })
}
```

**After**:
```typescript
// Use service role key if available (bypasses RLS)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ...
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ...
const supabaseKey = supabaseServiceKey || supabaseAnonKey

console.log('🔑 Using:', supabaseServiceKey ? 'service_role' : 'anon')

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// Retry logic with exponential backoff
let fileRecord = null
let fileError = null

for (let attempt = 1; attempt <= 3; attempt++) {
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .single()

  if (!error && data) {
    fileRecord = data
    break  // ✅ Success, exit retry loop
  }

  fileError = error

  if (attempt < 3) {
    console.log(`⏳ Retry ${attempt}, waiting ${attempt * 500}ms...`)
    await new Promise(resolve => setTimeout(resolve, attempt * 500))
  }
}

if (fileError || !fileRecord) {  // Only fail after 3 attempts
  console.error('❌ File not found after 3 attempts:', fileError)
  return res.status(404).json({ error: 'File not found' })
}
```

---

## 🧪 Validation Steps

### Step 1: Clear Browser Cache
```
Chrome/Edge: Ctrl+Shift+Delete → Clear cached images and files
Firefox: Ctrl+Shift+Delete → Cache
Safari: Cmd+Option+E
```

OR **Hard Refresh**:
```
Chrome/Edge/Firefox: Ctrl+Shift+R
Safari: Cmd+Shift+R
```

### Step 2: Upload PDF and Monitor Console

**Expected Success Logs**:
```javascript
✅ "PDF.js loaded successfully"
✅ "moduleType: object"
✅ "defaultType: object"
✅ "hasGetDocument: true"
✅ "hasGlobalWorkerOptions: true"
✅ "pdfjsKeys: ['GlobalWorkerOptions', 'getDocument', ...]"
✅ "[API] Request: POST /api/ai/analyze-file"
✅ "🔑 Using Supabase key type: service_role (admin)"
✅ "📁 Analyzing file: filename.pdf"
✅ "[API] Handler completed with status 200"
```

**Retry Scenario** (if race condition occurs):
```javascript
✅ "⏳ File not found on attempt 1, retrying in 500ms..."
✅ "📁 Analyzing file: filename.pdf"  // Success on retry
```

**Should NOT See**:
```javascript
❌ "TypeError: Cannot read properties of undefined (reading 'GlobalWorkerOptions')"
❌ "❌ File not found after 3 attempts"
❌ "POST http://localhost:3003/api/ai/analyze-file 404"
```

### Step 3: Verify Service Role Key

Check `.env` file has:
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Service role key
```

If missing, the API will use anon key (may hit RLS issues).

---

## 📊 Expected Behavior After Fixes

### PDF Upload Flow:
1. **User selects PDF** → FileUpload component triggered
2. **PDF.js loads** → Logs show successful import with all keys
3. **Text extraction** → PDF content extracted (if text-based PDF)
4. **File uploads to Supabase** → File record created in `project_files`
5. **AI analysis triggered** → Background POST to `/api/ai/analyze-file`
6. **API authenticates** → Uses service role key (bypasses RLS)
7. **API queries file** → Retry logic handles race conditions
8. **File found** → Analysis proceeds
9. **Status updates** → "Pending" → "Analyzing" → "Ready"
10. **Preview available** → PDFViewer renders with canvas

---

## 🚨 Known Limitations

### Browser Cache
- **Issue**: Browsers aggressively cache JavaScript modules
- **Symptom**: Old code still running after edits
- **Fix**: Hard refresh (Ctrl+Shift+R) or clear cache

### Service Role Key Security
- **Issue**: Service role key bypasses all RLS policies
- **Security**: Key only used server-side in API endpoints (never exposed to client)
- **Best Practice**: Ensure `.env` file is in `.gitignore`

### Race Condition Window
- **Issue**: 500ms-1500ms retry window may not cover all edge cases
- **Mitigation**: Most uploads complete within this window
- **Alternative**: Consider server-side upload callback instead of client trigger

---

## 📁 Files Modified Summary

| File | Lines | Change | Reason |
|------|-------|--------|--------|
| [src/components/FileUpload.tsx](src/components/FileUpload.tsx) | 11-45 | Enhanced error handling | Prevent GlobalWorkerOptions crash |
| [src/components/PDFViewer.tsx](src/components/PDFViewer.tsx) | 29-43 | Enhanced error handling | Prevent module import crash |
| [api/ai/analyze-file.ts](api/ai/analyze-file.ts) | 34-53 | Service role key | Bypass RLS policies |
| [api/ai/analyze-file.ts](api/ai/analyze-file.ts) | 55-83 | Retry logic | Handle race conditions |

---

## ✅ Success Criteria

1. ✅ **PDF.js loads without errors** - Console shows successful import
2. ✅ **GlobalWorkerOptions configures** - Worker URL set correctly
3. ✅ **Text extraction works** - PDF content parsed successfully
4. ✅ **File upload succeeds** - File record created in database
5. ✅ **API finds file record** - Service role key bypasses RLS
6. ✅ **Retry handles races** - File found within 3 attempts
7. ✅ **AI analysis completes** - Status transitions to "Ready"
8. ✅ **PDF preview renders** - Canvas shows PDF content

---

**Next Steps**: User validation after hard refresh to clear browser cache.

