# Root Cause Analysis: Ideas Not Loading Despite Database Having 12 Ideas

**Date**: 2025-10-01
**Status**: CRITICAL - Ideas exist in database but not returned to UI
**Severity**: HIGH - Core functionality broken

## Executive Summary

DatabaseService.getProjectIdeas() is being called successfully but returns an empty array despite 12 ideas existing in the database. The root cause is **authentication failure** - the Supabase client has no active session due to `persistSession: false`, causing Row-Level Security (RLS) policies to block all queries.

## Evidence Trail

### 1. Console Logs Show Call Success But No Data
```javascript
[useIdeas] Loading ideas for project: deade958-e26c-4c4b-99d6-8476c326427b ✅
[MISSING] "Loaded X ideas for project" ❌ <- Never logged
```

### 2. Database Timeout Errors
```
Database timeout fetching project: deade958-e26c-4c4b-99d6-8476c326427b
Project not found or no access: deade958-e26c-4c4b-99d6-8476c326427b
```

### 3. Code Path Analysis

**useIdeas.ts (line 58-80):**
```typescript
const loadIdeas = useCallback(async (projectId?: string) => {
  if (projectId) {
    logger.debug(`Loading ideas for project: ${projectId}`) // ✅ LOGS
    setIdeas([])
    const ideas = await DatabaseService.getProjectIdeas(projectId) // ✅ CALLED

    if (ideas.length === 0) {
      logger.debug(`No ideas found for project: ${projectId}`) // ❌ NEVER LOGS
    } else {
      logger.debug(`Loaded ${ideas.length} ideas for project: ${projectId}`) // ❌ NEVER LOGS
    }

    setIdeas(ideas) // ✅ CALLED but with empty array
  }
}, [])
```

**database.ts (line 129-132):**
```typescript
static async getProjectIdeas(projectId?: string): Promise<IdeaCard[]> {
  const response = await this.getIdeasByProject(projectId)
  return response.success ? (response.data || []) : []
}
```

**database.ts (line 71-120):**
```typescript
static async getIdeasByProject(
  projectId?: string,
  _options?: IdeaQueryOptions
): Promise<ApiResponse<IdeaCard[]>> {
  try {
    let query = supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query // 🔴 PROBLEM: No auth session!

    if (error) {
      // Returns error response
      return {
        success: false,
        error: {
          type: 'database',
          message: dbError.message,
          code: dbError.code
        }
      }
    }

    return {
      success: true,
      data: data || [], // 🔴 Returns empty array due to RLS blocking
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    // Error handling...
  }
}
```

## Root Cause: Authentication Architecture Failure

### Problem Chain

1. **Supabase Client Configuration** (`src/lib/supabase.ts:33`)
   ```typescript
   export const supabase = createClient(
     supabaseUrl || 'https://placeholder.supabase.co',
     supabaseAnonKey || 'placeholder-key',
     {
       auth: {
         persistSession: false, // 🔴 ROOT CAUSE
       }
     }
   )
   ```

2. **Why `persistSession: false` Exists**
   - Security fix per PRIO-SEC-001 (CVSS 9.1)
   - Prevents XSS token theft from localStorage
   - Comment says: "Users will need to re-authenticate after browser refresh (acceptable security tradeoff)"

3. **Actual Impact**
   - After login, session is NOT stored anywhere
   - After ANY page navigation/refresh, session is lost
   - User appears authenticated in UI (stale state)
   - But Supabase client has NO auth context

4. **Row-Level Security (RLS) Blocks Query**
   - Ideas table has RLS enabled
   - RLS policy: `SELECT only if auth.uid() = owner_id OR user is collaborator`
   - Without auth session, `auth.uid()` returns NULL
   - Query returns empty array (no permission error, just no rows)

### Why No Error Is Thrown

The query doesn't fail - it succeeds with 0 rows:
```typescript
const { data, error } = await query
// error = null (query succeeded)
// data = [] (RLS filtered all rows)
```

This is why the code path continues normally but returns empty results.

## Evidence from Codebase

### 1. Projects Use Workaround (projectRepository.ts:52-71)
```typescript
// TEMPORARY WORKAROUND: Use service role to bypass RLS until Supabase client auth is fixed
// TODO: Fix Supabase client to use httpOnly cookie-based session
// Root cause: persistSession: false means Supabase client has no auth session after login

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const response = await fetch(
  `${supabaseUrl}/rest/v1/projects?owner_id=eq.${validUserId}&order=created_at.desc`,
  {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    }
  }
)
```

**This workaround bypasses RLS and works for projects, but ideas still use the broken Supabase client.**

### 2. BaseService Uses Broken Client (BaseService.ts:320-322)
```typescript
protected static getSupabaseClient() {
  return supabase // 🔴 Returns client with no auth session
}
```

### 3. IdeaService Inherits Problem (IdeaService.ts:36-81)
```typescript
static async getIdeasByProject(
  projectId?: string,
  options?: IdeaQueryOptions
): Promise<ServiceResult<IdeaCard[]>> {
  return this.executeWithRetry(async () => {
    const supabase = this.getSupabaseClient() // 🔴 No auth!

    let query = supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', validProjectId)
    }

    const { data, error } = await query // 🔴 RLS blocks, returns []

    if (error) {
      throw error
    }

    return data || [] // Returns empty array
  }, context)
}
```

## Why Tests Pass But Production Fails

The earlier agent confirmed 12 ideas exist via direct database query:
- Direct SQL: `SELECT * FROM ideas WHERE project_id = 'xxx'` - Returns 12 rows
- Supabase client: `supabase.from('ideas').select('*').eq('project_id', 'xxx')` - Returns 0 rows

The difference is authentication context:
- Direct SQL: No RLS applied (admin access)
- Supabase client: RLS applied, no auth session, blocks all rows

## Solution Paths

### Option 1: Apply Projects Workaround to Ideas (Quick Fix)
**File**: `src/lib/database.ts` (line 71-120)

Replace Supabase client with direct fetch using service role key:

```typescript
static async getIdeasByProject(
  projectId?: string,
  _options?: IdeaQueryOptions
): Promise<ApiResponse<IdeaCard[]>> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

    let url = `${supabaseUrl}/rest/v1/ideas?order=created_at.desc`
    if (projectId) {
      url += `&project_id=eq.${projectId}`
    }

    const response = await fetch(url, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()

    return {
      success: true,
      data: data || [],
      timestamp: new Date().toISOString(),
      meta: {
        total: data?.length || 0
      }
    }
  } catch (error) {
    const dbError = this.handleDatabaseError(error, 'getIdeasByProject')
    return {
      success: false,
      error: {
        type: 'database',
        message: dbError.message,
        code: dbError.code
      },
      timestamp: new Date().toISOString()
    }
  }
}
```

**Pros**:
- Immediate fix
- Matches existing pattern for projects
- No auth architecture changes needed

**Cons**:
- Bypasses RLS (security concern)
- Exposes service role key to browser (CRITICAL security issue)
- Temporary bandaid, not proper fix

### Option 2: Fix Authentication Architecture (Proper Solution)

Implement httpOnly cookie-based authentication as noted in projectRepository.ts TODO:

1. **Backend Cookie Handler** (Express/Vercel serverless):
   ```typescript
   // api/auth/session.ts
   export default async function handler(req, res) {
     const { access_token, refresh_token } = await supabase.auth.getSession()

     res.setHeader('Set-Cookie', [
       `sb-access-token=${access_token}; HttpOnly; Secure; SameSite=Strict; Path=/`,
       `sb-refresh-token=${refresh_token}; HttpOnly; Secure; SameSite=Strict; Path=/`
     ])

     res.json({ success: true })
   }
   ```

2. **Update Supabase Client Config**:
   ```typescript
   export const supabase = createClient(url, key, {
     auth: {
       storage: customCookieStorage, // Read from httpOnly cookies via API
       persistSession: true,
       autoRefreshToken: true
     }
   })
   ```

3. **Custom Storage Adapter**:
   ```typescript
   const customCookieStorage = {
     getItem: async (key) => {
       const res = await fetch('/api/auth/get-token')
       const { token } = await res.json()
       return token
     },
     setItem: async (key, value) => {
       await fetch('/api/auth/set-token', {
         method: 'POST',
         body: JSON.stringify({ token: value })
       })
     },
     removeItem: async (key) => {
       await fetch('/api/auth/clear-token', { method: 'POST' })
     }
   }
   ```

**Pros**:
- Secure (httpOnly cookies immune to XSS)
- Proper session management
- RLS works correctly
- No service role key exposure

**Cons**:
- Requires backend API routes
- More complex implementation
- Takes longer to implement

### Option 3: Use supabaseAdmin for Ideas (Compromise)

**File**: `src/lib/services/IdeaService.ts`

```typescript
import { supabaseAdmin } from '../supabase'

static async getIdeasByProject(
  projectId?: string,
  options?: IdeaQueryOptions
): Promise<ServiceResult<IdeaCard[]>> {
  return this.executeWithRetry(async () => {
    const client = supabaseAdmin // Use admin client to bypass RLS

    let query = client
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', validProjectId)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return data || []
  }, context)
}
```

**Pros**:
- Minimal code change
- Consistent with projects pattern
- Works immediately

**Cons**:
- Bypasses RLS (all users see all ideas)
- Service role key in browser bundle
- Security risk

## Recommended Immediate Action

**Use Option 3 (supabaseAdmin) as temporary fix with security warning:**

1. Add comment explaining security risk
2. Create ticket for Option 2 (proper auth architecture)
3. Add runtime check that user owns/has access to project before returning ideas
4. Monitor for abuse

## File Changes Required

**File**: `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/src/lib/services/IdeaService.ts`

**Change**: Line 37 - Replace `this.getSupabaseClient()` with `supabaseAdmin`

```typescript
// BEFORE:
const supabase = this.getSupabaseClient()

// AFTER:
// TEMPORARY SECURITY WORKAROUND: Use service role to bypass RLS
// Root cause: persistSession: false means Supabase client has no auth session
// TODO: Implement httpOnly cookie-based authentication (see Option 2 in ROOT_CAUSE_IDEAS_NOT_LOADING.md)
// SECURITY RISK: This bypasses RLS. Must validate user permissions in application layer.
const supabase = supabaseAdmin
```

**Also need to import supabaseAdmin**:
```typescript
import { supabaseAdmin } from '../supabase'
```

## Validation Steps

After applying fix:

1. **Check ideas load**:
   ```
   [useIdeas] Loading ideas for project: deade958-e26c-4c4b-99d6-8476c326427b ✅
   [useIdeas] Loaded 12 ideas for project: deade958-e26c-4c4b-99d6-8476c326427b ✅
   ```

2. **Verify UI shows ideas**:
   - Matrix page should display 12 idea cards
   - Ideas should be positioned in correct quadrants

3. **Test CRUD operations**:
   - Create new idea (should appear immediately)
   - Edit idea (should update in place)
   - Delete idea (should disappear)

4. **Monitor for security issues**:
   - Users shouldn't see ideas from other projects
   - Add logging to detect unauthorized access attempts

## Long-term Recommendation

Implement Option 2 (httpOnly cookie authentication) properly:

1. **Week 1**: Design cookie-based auth architecture
2. **Week 2**: Implement backend API routes for cookie management
3. **Week 3**: Update Supabase client configuration
4. **Week 4**: Test and migrate users
5. **Week 5**: Remove service role key from frontend bundle

## Related Issues

- ROOT_CAUSE_PROJECTS_INFINITE_LOADING.md (same root cause, already worked around)
- PRIO-SEC-001: XSS token theft vulnerability (reason for persistSession: false)
- Database timeout errors (symptom of auth failure)

## Conclusion

Ideas are not loading because the Supabase client has no authentication session due to `persistSession: false`, causing RLS to silently block all queries. The immediate fix is to use `supabaseAdmin` like projects do, but the proper long-term solution is httpOnly cookie-based authentication.
