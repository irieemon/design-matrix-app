# Root Cause Analysis: Projects Page Infinite Loading State

**Date**: 2025-10-01
**Status**: CRITICAL - Blocking user workflow
**Severity**: HIGH

---

## Executive Summary

Projects page stuck in infinite loading state after successful httpOnly cookie authentication. User authenticates successfully, but projects query never completes, leaving UI in perpetual loading skeleton state.

---

## Evidence Chain

### 1. Authentication Success
```
✅ [useSecureAuth] Login successful
✅ [AuthScreen] Login successful with httpOnly cookies
✅ User ID: e5aa576d-18bf-417a-86a9-1de0518f4f0e
```

### 2. Projects Query Initiates
```
❌ [DEBUG] 📋 Loading projects for user: e5aa576d-18bf-417a-86a9-1de0518f4f0e
❌ [DEBUG] 🖥️ ProjectManagement render - isLoading: true projects: 0
❌ [DEBUG] 🔄 ProjectManagement showing loading state
```

### 3. Query Never Completes
- No success log: `✅ Database query succeeded! Projects: X`
- No error log: `❌ Database query failed`
- No finally block execution: `📋 Setting loading to false`

---

## Root Cause Analysis

### **PRIMARY ROOT CAUSE: Supabase Client Not Authenticated**

**Location**: `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/src/lib/supabase.ts:24-56`

**Problem**: The Supabase client configuration has `persistSession: false` (line 33), which means:
1. JWT tokens are NOT stored in localStorage (security fix)
2. Supabase client has NO authentication state after page navigation
3. All Supabase queries execute as anonymous/unauthenticated requests

**Code Evidence**:
```typescript
// src/lib/supabase.ts:28-34
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      // SECURITY FIX: Disable localStorage token persistence
      persistSession: false, // ← THIS IS THE PROBLEM
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    // ...
  }
)
```

### Authentication Flow Mismatch

**What Happens**:
1. User logs in via `/api/auth/session` (httpOnly cookie-based auth)
2. httpOnly cookies set by backend: `sb-access-token`, `sb-refresh-token`
3. `useSecureAuth` stores user object in React state
4. User navigates to Projects page
5. `ProjectManagement` component calls `ProjectRepository.getUserOwnedProjects(currentUser.id)`
6. `ProjectRepository` uses `supabase.from('projects')` client
7. **Supabase client has NO session** (persistSession: false)
8. Query executes as **anonymous request**
9. Row Level Security (RLS) blocks query (no authenticated user)
10. Query silently hangs or fails with RLS policy denial

### Secondary Issue: Missing Error Handling

**Location**: `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/src/components/ProjectManagement.tsx:78-145`

**Problem**: The `loadProjects` function has error handling, BUT:

```typescript
// Line 86: getUserOwnedProjects call
const userProjects = await ProjectRepository.getUserOwnedProjects(currentUser.id)
```

If the Supabase query hangs waiting for auth that never comes, or if RLS silently blocks it:
- No explicit timeout on the query
- Supabase client may wait indefinitely for response
- `finally` block never executes
- `isLoading` never set to `false`

---

## Technical Details

### Supabase Query Execution Path

```
ProjectManagement.loadProjects()
  ↓
ProjectRepository.getUserOwnedProjects(userId)
  ↓
supabase.from('projects').select('*').eq('owner_id', validUserId)
  ↓
[Supabase client has NO session because persistSession: false]
  ↓
Query sent as ANONYMOUS request
  ↓
RLS Policy on 'projects' table checks authenticated user
  ↓
NO authenticated user → RLS blocks query
  ↓
Query hangs or returns empty (depending on RLS policy)
```

### RLS Policy Expectation

Typical RLS policy on `projects` table:
```sql
CREATE POLICY "Users can read their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = owner_id);
```

Since Supabase client is unauthenticated:
- `auth.uid()` returns `NULL`
- `NULL = owner_id` is always `FALSE`
- Query returns no rows OR hangs depending on policy configuration

---

## Why This Wasn't Caught Earlier

1. **Authentication appears to work**: Login succeeds, user object is in React state
2. **Frontend state is correct**: `currentUser` has valid `id` field
3. **Cookie auth is working**: httpOnly cookies are set correctly
4. **Mismatch is subtle**: Frontend uses cookie auth, database queries use Supabase client auth
5. **No error thrown**: RLS policies may silently filter results or hang

---

## Solution Design

### Option 1: Use Supabase Session with httpOnly Cookies (RECOMMENDED)

**Approach**: Configure Supabase client to use httpOnly cookie-based session storage

**Implementation**:
```typescript
// src/lib/supabase.ts
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      // Use custom cookie-based storage instead of localStorage
      storage: {
        getItem: async (key) => {
          // Read from httpOnly cookie via API endpoint
          const response = await fetch('/api/auth/session-token', { credentials: 'include' })
          if (response.ok) {
            const data = await response.json()
            return data.token
          }
          return null
        },
        setItem: async (key, value) => {
          // Cookies are set by backend, no-op here
          return
        },
        removeItem: async (key) => {
          // Cookies are cleared by backend, no-op here
          return
        }
      },
      persistSession: true, // Enable session persistence with custom storage
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    // ...
  }
)
```

**Pros**:
- Uses existing httpOnly cookie infrastructure
- Maintains security (tokens not in localStorage)
- Supabase client properly authenticated
- All queries work with RLS policies

**Cons**:
- Requires new API endpoint `/api/auth/session-token` to extract token from cookie
- More complex setup

---

### Option 2: Pass Supabase Session After Login (SIMPLER)

**Approach**: After successful login, set the Supabase session explicitly

**Implementation**:
```typescript
// src/hooks/useSecureAuth.ts
const login = useCallback(async (email: string, password: string) => {
  try {
    loginInProgress.current = true
    setIsLoading(true)
    setError(null)

    logger.debug('Attempting login...', { email })

    // Login via httpOnly cookie endpoint
    const response = await apiClient.post<{
      user: User
      session: { access_token: string, refresh_token: string } // ← Add this
    }>('/api/auth/session', {
      email,
      password,
    })

    // Set Supabase session from tokens
    await supabase.auth.setSession({
      access_token: response.session.access_token,
      refresh_token: response.session.refresh_token
    })

    setUser(response.user)
    logger.debug('Login successful', { userId: response.user.id })
  } catch (err) {
    logger.error('Login failed:', err)
    setError(err instanceof Error ? err : new Error('Login failed'))
    throw err
  } finally {
    setIsLoading(false)
    loginInProgress.current = false
  }
}, [logger])
```

**Backend Change** (`/api/auth/session.ts`):
```typescript
// Return tokens in response (NOT as httpOnly cookies)
res.status(200).json({
  user: userData,
  session: {
    access_token: session.access_token,
    refresh_token: session.refresh_token
  }
})
```

**Pros**:
- Simpler to implement
- Supabase client gets authenticated session
- All queries work immediately

**Cons**:
- **SECURITY RISK**: Tokens now in JavaScript memory (XSS vulnerability)
- Defeats purpose of httpOnly cookie security fix
- NOT RECOMMENDED for production

---

### Option 3: Use Service Role for Authenticated Operations (TEMPORARY WORKAROUND)

**Approach**: Use `supabaseAdmin` (service role) for authenticated user queries

**Implementation**:
```typescript
// src/lib/repositories/projectRepository.ts
static async getUserOwnedProjects(userId: string): Promise<Project[]> {
  try {
    const validUserId = sanitizeUserId(userId)
    if (!validUserId) {
      logger.warn(`Invalid user ID format for getUserOwnedProjects: ${userId}`)
      return []
    }

    // TEMPORARY: Use service role to bypass RLS
    // TODO: Fix Supabase client authentication
    const { data, error } = await supabaseAdmin // ← Change from supabase to supabaseAdmin
      .from('projects')
      .select('*')
      .eq('owner_id', validUserId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching user projects:', error)
      throw new Error(error.message)
    }

    return data || []
  } catch (error) {
    logger.error('Failed to get user projects:', error)
    throw error
  }
}
```

**Pros**:
- Immediate fix, unblocks users
- No architectural changes needed
- Works with existing httpOnly cookie auth

**Cons**:
- **SECURITY**: Bypasses RLS policies (service role has full access)
- Not scalable (must apply to ALL repository methods)
- Not a proper solution, just a workaround

---

## Recommended Solution

**IMMEDIATE (Unblock users)**: Use **Option 3** as temporary workaround

**PROPER FIX**: Implement **Option 1** (custom cookie-based storage for Supabase)

### Implementation Plan

#### Phase 1: Immediate Workaround (Today)
1. Change `ProjectRepository.getUserOwnedProjects` to use `supabaseAdmin`
2. Add logging to track all service role usage
3. Test projects page loads correctly
4. Deploy to unblock users

#### Phase 2: Proper Solution (This Week)
1. Create `/api/auth/session-token` endpoint
   - Reads httpOnly cookie
   - Extracts and returns access_token
   - Validates token before returning
2. Implement custom storage adapter for Supabase client
3. Configure Supabase client to use custom storage
4. Test full authentication flow
5. Revert all `supabaseAdmin` workarounds back to `supabase`
6. Verify RLS policies are enforced correctly

---

## Test Plan

### Verification Tests

1. **Login Flow**
   - User logs in successfully
   - httpOnly cookies are set
   - User object stored in React state

2. **Projects Query**
   - Navigate to Projects page
   - Verify query executes
   - Verify projects load (empty or with data)
   - Check console logs for timing

3. **Authentication Persistence**
   - Refresh page
   - Verify session restored
   - Verify projects still load

4. **Security Verification**
   - Check localStorage (should be empty of tokens)
   - Verify httpOnly cookies present
   - Test XSS attack scenarios

---

## Code Locations

| Component | File | Lines |
|-----------|------|-------|
| Supabase Config | `src/lib/supabase.ts` | 24-56 |
| ProjectManagement | `src/components/ProjectManagement.tsx` | 78-145 |
| ProjectRepository | `src/lib/repositories/projectRepository.ts` | 38-63 |
| useSecureAuth Hook | `src/hooks/useSecureAuth.ts` | 109-138 |
| Auth User Endpoint | `api/auth/user.ts` | 8-74 |

---

## Additional Observations

### Why Finally Block Doesn't Execute

Looking at the code structure:
```typescript
const loadProjects = async () => {
  setIsLoading(true)
  try {
    logger.debug('📋 Loading projects for user:', currentUser.id)

    try {
      logger.debug('🔄 Attempting database query...')
      const userProjects = await ProjectRepository.getUserOwnedProjects(currentUser.id)
      logger.debug('✅ Database query succeeded! Projects:', userProjects.length)
      // ...
    } catch (dbError) {
      logger.error('❌ Database query failed, falling back to test data:', dbError)
      // ...
    }
  } catch (error) {
    logger.error('Error in loadProjects:', error)
    setProjects([])
  } finally {
    logger.debug('📋 Setting loading to false, projects count:', projects.length)
    setIsLoading(false) // ← THIS NEVER RUNS
  }
}
```

**If query hangs indefinitely**:
- `await` never resolves
- Function execution stuck
- `finally` block never reached
- `isLoading` stays `true` forever

**Most likely**: Supabase query hangs waiting for authentication that never comes.

---

## Conclusion

**Root Cause**: Architectural mismatch between frontend auth (httpOnly cookies) and database client auth (Supabase session).

**Immediate Impact**: Complete blocking of Projects page functionality.

**Proper Solution**: Implement custom storage adapter for Supabase client to use httpOnly cookie-based session.

**Temporary Workaround**: Use service role client for authenticated queries (security tradeoff).

---

## Next Steps

1. ✅ Document root cause analysis (this file)
2. ⏳ Implement temporary workaround (Option 3)
3. ⏳ Test workaround with user flow
4. ⏳ Design and implement proper solution (Option 1)
5. ⏳ Remove workaround and verify security

---

**Analysis Completed By**: Claude (Root Cause Analyst Agent)
**Timestamp**: 2025-10-01
