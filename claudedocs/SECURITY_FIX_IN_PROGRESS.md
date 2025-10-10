# 🚨 CRITICAL SECURITY FIX - IN PROGRESS

**Date**: 2025-10-10
**Priority**: 🔴 **P0 - CRITICAL**
**Status**: ⚙️ **IN PROGRESS** (Steps 1-2 complete)

---

## 🎯 Objective

Remove service role key exposure from frontend to prevent complete RLS bypass vulnerability (CVSS 9.8).

---

## ✅ Completed Steps

### Step 1: Remove Service Key from Frontend Environment ✅
**File**: `.env`
**Changes**:
- ✅ Removed `VITE_SUPABASE_SERVICE_ROLE_KEY` variable
- ✅ Added security comments explaining the removal
- ✅ Kept `SUPABASE_SERVICE_ROLE_KEY` (without VITE_ prefix) for backend-only use

**Code Change**:
```bash
# Before:
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# After:
# ❌ REMOVED: VITE_SUPABASE_SERVICE_ROLE_KEY (SECURITY FIX)
# Service role key was exposed to browser - CRITICAL vulnerability fixed
# Frontend now uses ONLY authenticated anon key clients with RLS enforcement
```

### Step 2: Remove supabaseAdmin Client from Frontend ✅
**File**: `src/lib/supabase.ts`
**Changes**:
- ✅ Removed `const supabaseServiceRoleKey` import
- ✅ Removed service key from debug logging
- ✅ Removed `supabaseAdmin` client export (lines 61-76)
- ✅ Deprecated admin helper functions (`adminGetAllProjects`, `adminGetAllUsers`)
- ✅ Added error messages directing to backend APIs

**Code Changes**:
```typescript
// ❌ REMOVED:
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, ...)

// ✅ ADDED:
// ✅ SECURITY FIX: Service role key removed from frontend
// Frontend uses ONLY authenticated anon key clients with RLS enforcement

// Admin functions now throw errors directing to backend:
export const adminGetAllProjects = async (): Promise<any[]> => {
  logger.error('❌ adminGetAllProjects called from frontend - DEPRECATED')
  logger.error('🔒 Admin operations must use backend API: /api/admin/projects')
  throw new Error('Admin operations must be performed via backend API endpoints')
}
```

---

## ⏳ Remaining Steps

### Step 3: Fix projectRepository Workaround ⚠️ IN PROGRESS
**File**: `src/lib/repositories/projectRepository.ts`
**Issue**: Lines 60-71 directly access removed `VITE_SUPABASE_SERVICE_ROLE_KEY`
**Impact**: Project loading will FAIL until fixed

**Current Problematic Code** (lines 60-71):
```typescript
// CRITICAL FIX: Supabase JS client hangs in browser, use direct REST API call
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY  // ❌ NOW UNDEFINED!

const response = await fetch(
  `${supabaseUrl}/rest/v1/projects?owner_id=eq.${validUserId}&order=created_at.desc`,
  {
    headers: {
      'apikey': serviceKey,  // ❌ WILL BE UNDEFINED
      'Authorization': `Bearer ${serviceKey}`,  // ❌ WILL BE UNDEFINED
      'Content-Type': 'application/json'
    }
  }
)
```

**Fix Required**:
Replace with authenticated Supabase client using user's access token:
```typescript
// ✅ Use authenticated client with RLS enforcement
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('owner_id', validUserId)
  .order('created_at', { ascending: false })

if (error) {
  logger.error('Error fetching projects:', error)
  throw new Error(error.message)
}

return data || []
```

**Files Affected**:
- `src/lib/repositories/projectRepository.ts` - Lines 60-71, 138, 179, 214, 244, 297, 422, 458, 477, 505, 534, 565

### Step 4: Update IdeaService to Require Authenticated Client
**File**: `src/lib/services/IdeaService.ts`
**Issue**: Optional `client` parameter with `supabaseAdmin` fallback (now broken)

**Changes Needed**:
```typescript
// Before:
static async updateIdea(
  id: string,
  updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>,
  options?: ServiceOptions,
  client?: SupabaseClient  // ❌ Optional
): Promise<ServiceResult<IdeaCard>> {
  const supabase = client || supabaseAdmin  // ❌ supabaseAdmin no longer exists!

  if (!client) {
    logger.warn('⚠️ updateIdea: Using supabaseAdmin (bypasses RLS).')
  }
  // ...
}

// After:
static async updateIdea(
  id: string,
  updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>,
  client: SupabaseClient,  // ✅ REQUIRED
  options?: ServiceOptions
): Promise<ServiceResult<IdeaCard>> {
  const supabase = client  // ✅ No fallback
  // ...
}
```

**Methods to Update**:
- `getIdeasByProject()` - Line 36
- `createIdea()` - Line 123
- `updateIdea()` - Line 198
- `deleteIdea()` - Line 264
- `lockIdeaForEditing()` - Line 311
- `unlockIdea()` - Line 392
- `cleanupStaleLocks()` - Line 438
- `getLockInfo()` - Line 483

### Step 5: Update DatabaseService to Pass Authenticated Client
**File**: `src/lib/database.ts`
**Changes Needed**:

```typescript
// Add client parameter to all methods:
static async updateIdea(
  id: string,
  updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>,
  client: SupabaseClient  // ✅ Add client parameter
): Promise<IdeaCard | null> {
  const result = await IdeaService.updateIdea(id, updates, client)  // ✅ Pass client
  return result.success ? result.data : null
}
```

### Step 6: Update All Hooks to Pass Authenticated Client
**Files**: `src/hooks/useIdeas.ts`, `src/hooks/useOptimizedMatrix.ts`, etc.

**Changes Needed**:
```typescript
// Import authenticated client
import { supabase } from '../lib/supabase'

// Pass to DatabaseService
const updateIdea = useCallback(async (updatedIdea: IdeaCard) => {
  const result = await DatabaseService.updateIdea(
    updatedIdea.id,
    updates,
    supabase  // ✅ Pass authenticated client
  )
}, [])
```

### Step 7: Fix AdminService to Use Backend APIs
**File**: `src/lib/adminService.ts`
**Issue**: Multiple methods use `supabaseAdmin` directly (lines 201, 221, 243, 265, 292, 319, 330, 341, 364, 406)

**Fix Strategy**:
- Create backend API endpoints: `/api/admin/users`, `/api/admin/projects`
- Update AdminService to call backend APIs instead of direct database access
- Backend APIs will use service role key securely (server-side only)

### Step 8: Test All Operations Work Correctly
**Test Plan**:
1. Start dev server: `npm run dev`
2. Login as test user
3. Test project operations:
   - ✅ Load projects list
   - ✅ Create new project
   - ✅ Delete project
4. Test idea operations:
   - ✅ Load ideas
   - ✅ Create idea
   - ✅ Edit idea (drag/drop, content edit)
   - ✅ Delete idea
5. Verify no RLS bypass warnings in console
6. Verify no errors in browser console
7. Verify backend logs show authenticated requests

### Step 9: Document Service Key Rotation
**Create**: `claudedocs/SERVICE_KEY_ROTATION_GUIDE.md`

**Content Needed**:
1. How to generate new service role key in Supabase Dashboard
2. Where to update the new key (`.env`, Vercel, etc.)
3. How to revoke old compromised key
4. Verification steps to ensure rotation succeeded

---

## 📊 Files Modified So Far

1. ✅ `.env` - Removed `VITE_SUPABASE_SERVICE_ROLE_KEY`
2. ✅ `src/lib/supabase.ts` - Removed `supabaseAdmin` client and service key import

---

## 🔴 Files That Need Immediate Fixes

### Critical (Will Break App):
1. ⚠️ `src/lib/repositories/projectRepository.ts` - Accessing removed service key
2. ⚠️ `src/lib/services/IdeaService.ts` - Referencing removed `supabaseAdmin`
3. ⚠️ `src/lib/adminService.ts` - Using removed `supabaseAdmin` extensively

### Important (Should Be Updated):
4. `src/lib/database.ts` - Need to pass authenticated client
5. `src/hooks/useIdeas.ts` - Need to pass authenticated client
6. `src/hooks/useOptimizedMatrix.ts` - Need to pass authenticated client

---

## 🎯 Next Immediate Action

**Fix `projectRepository.ts`** to use authenticated Supabase client instead of direct fetch with service key.

**Command to Continue**:
```bash
# Edit projectRepository.ts to replace service key workaround with authenticated client
```

---

## 📝 Notes

- Dev server may show errors until all fixes are complete
- This is expected and part of the security hardening process
- ALL frontend database operations MUST use authenticated clients with RLS
- Admin operations MUST go through backend API endpoints

---

**Last Updated**: 2025-10-10 18:10 UTC
**Next Update**: After Step 3 completion
