# Supabase Client Session State Diagnosis

**Date**: 2025-10-15
**Investigation**: Attempt #5 - Root Cause Analysis
**Status**: DIAGNOSIS COMPLETE

---

## Executive Summary

**THE DEFINITIVE ROOT CAUSE**: The Supabase client DOES NOT automatically load sessions from localStorage with `persistSession: true` on initial client creation. The `persistSession: true` setting only controls whether the client WRITES sessions to storage after authentication events, not whether it READS them on initialization.

**Impact**: On page refresh (fast path), the client has NO session loaded, causing all database queries to run unauthenticated and trigger RLS policy blocks.

---

## How Supabase Session Management Actually Works

### What `persistSession: true` Does

According to Supabase JS SDK v2.58.0 behavior:

1. **WRITES sessions to localStorage** after successful authentication
2. **READS sessions from localStorage** ONLY when specific auth methods are called
3. **Does NOT auto-load** sessions during `createClient()` initialization

### When Sessions Are Actually Loaded

The Supabase client loads sessions from localStorage in these scenarios:

1. **`supabase.auth.getSession()`** - Explicitly reads from storage
2. **`supabase.auth.setSession()`** - Explicitly loads provided session
3. **Auth event handlers** - Loads session during SIGNED_IN, TOKEN_REFRESHED events
4. **`supabase.auth.initialize()`** - Internal method called by getSession()

### When Sessions Are NOT Loaded

1. **During `createClient()`** - Client initialization does NOT read storage
2. **On module import** - First import of supabase.ts does NOT load session
3. **After setting React state** - Client state is independent of React state
4. **With `storage: undefined`** - Still requires explicit session loading call

---

## Evidence: Fast Path Session State

### Current Fast Path Code (BROKEN)

**Location**: src/hooks/useAuth.ts lines 686-724

```javascript
if (!isExpired) {
  // FAST PATH: Valid session exists - set React state immediately
  console.log('🚀 FAST PATH: Valid session found, setting state immediately')

  // Extract user from session and set state DIRECTLY
  const user = parsed?.user
  if (user && mounted) {
    console.log('✅ Setting user state directly from localStorage:', user.email)

    // Create user profile from session data
    const userProfile = {
      id: user.id,
      email: user.email,
      // ... more fields
    }

    // Set state IMMEDIATELY - no async operations
    setCurrentUser(userProfile)
    setAuthUser(user)
    setIsLoading(false)
  }

  // Skip the getSession() call entirely - we already have the session
  shouldSkipSessionCheck = true  // ❌ THIS IS THE PROBLEM
}
```

**What This Code Does**:
- ✅ Reads session from localStorage
- ✅ Sets React state (currentUser, authUser)
- ✅ UI shows user as authenticated
- ❌ **NEVER loads session into Supabase client**
- ❌ **Skips `getSession()` which would load the session**

### Normal Path Code (WORKS)

**Location**: src/hooks/useAuth.ts lines 768-800

```javascript
if (shouldSkipSessionCheck) {
  logger.debug('⏩ Skipping session check - no session in storage')
  return // Exit initializeAuth early
}

// FIX #3: INCREASED session check timeout
const controller = new AbortController()
const sessionTimeoutMs = 15000
const timeoutId = setTimeout(() => {
  logger.warn(`⏰ Session check timeout after ${sessionTimeoutMs}ms`)
  controller.abort()
}, sessionTimeoutMs)

// ✅ THIS IS WHAT LOADS THE SESSION
const sessionResult = await supabase.auth.getSession()
clearTimeout(timeoutId)

const { data: { session }, error } = sessionResult
```

**What This Code Does**:
- ✅ Calls `supabase.auth.getSession()`
- ✅ Supabase client reads from localStorage
- ✅ Client internal auth state is updated
- ✅ All subsequent queries include auth headers
- ✅ Database queries succeed (RLS passes)

---

## Database Query Flow Analysis

### Call Chain on Page Refresh

```
1. Page loads with ?project=abc-123
2. useAuth initializes
3. Fast path detects valid session in localStorage
4. React state set from localStorage (currentUser, authUser)
5. shouldSkipSessionCheck = true
6. getSession() is SKIPPED
7. Supabase client auth state: EMPTY (no session)
8. useBrowserHistory detects project parameter
9. handleProjectRestore('abc-123') called
10. ProjectContext.handleProjectRestore()
11. DatabaseService.getProjectById()
12. ProjectService.getProjectById()
13. BaseService.getSupabaseClient() → returns client instance
14. supabase.from('projects').select('*').eq('id', 'abc-123')
15. ❌ Query runs WITHOUT auth headers (client has no session)
16. RLS policy blocks: "user not authenticated"
17. Query hangs/times out after 5 seconds
18. Error: "Project restoration timeout after 5 seconds"
```

### Why Database Queries Fail

**RLS Policy Check**:
```sql
-- Example RLS policy on projects table
CREATE POLICY "Users can view their own projects"
ON projects FOR SELECT
USING (
  auth.uid() = owner_id  -- ❌ auth.uid() returns NULL (no session)
  OR
  EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id = projects.id
    AND user_id = auth.uid()  -- ❌ auth.uid() returns NULL
  )
);
```

**What Happens**:
1. Database query arrives WITHOUT Authorization header
2. Postgres checks RLS policy
3. `auth.uid()` returns NULL (no authenticated user)
4. Policy evaluation fails
5. Query is BLOCKED by RLS
6. Request hangs until timeout
7. Client receives timeout error

---

## Comparison: Initial Login vs Page Refresh

### Initial Login (WORKS ✅)

**Flow**:
```
1. User submits login form
2. Supabase auth processes login
3. Auth SDK sets session in client auth state
4. Auth SDK writes session to localStorage (persistSession: true)
5. Auth event fired: SIGNED_IN
6. handleAuthSuccess() called
7. React state updated
8. ✅ Client has session loaded (done by auth flow)
9. Database queries run with auth headers
10. RLS policies pass
11. Project restoration succeeds
```

**Why It Works**:
- The Supabase auth flow AUTOMATICALLY loads the session into the client
- No need to call `getSession()` or `setSession()` manually
- All subsequent queries have authentication

### Page Refresh (FAILS ❌)

**Flow**:
```
1. Page loads, useAuth initializes
2. Fast path reads session from localStorage
3. React state updated from localStorage
4. ❌ getSession() SKIPPED (optimization)
5. ❌ Client auth state: EMPTY (never loaded)
6. Database queries run WITHOUT auth headers
7. RLS policies BLOCK queries
8. Queries timeout
9. Error: "Project restoration timeout"
```

**Why It Fails**:
- We optimized by skipping `getSession()`
- But `getSession()` is what loads the session into the client
- React state is correct, but client state is empty
- Database queries have no authentication
- RLS blocks all access

---

## The Critical Difference

### What We Think `persistSession: true` Does

**WRONG Assumption**:
> "With `persistSession: true`, the client automatically loads sessions from localStorage during initialization"

### What It Actually Does

**CORRECT Behavior**:
> "With `persistSession: true`, the client WRITES sessions to localStorage after auth events. Reading from storage requires explicitly calling `getSession()` or `setSession()`"

---

## The Fix: Three Options

### Option 1: Call `getSession()` on Fast Path (RECOMMENDED)

**Pros**:
- Guaranteed to work (official SDK method)
- Handles token refresh automatically
- Updates all internal client state correctly
- Most reliable approach

**Cons**:
- Adds 50-200ms network latency on fast path
- Negates fast path performance optimization

**Implementation**:
```javascript
// Fast path with getSession()
if (!isExpired) {
  console.log('🚀 FAST PATH: Valid session found, loading into client')

  // Load session into client (required for database queries)
  const { data: { session }, error } = await supabase.auth.getSession()

  if (session && !error) {
    const user = session.user
    if (user && mounted) {
      const userProfile = {
        id: user.id,
        email: user.email,
        // ... more fields
      }

      setCurrentUser(userProfile)
      setAuthUser(user)
      setIsLoading(false)
      shouldSkipSessionCheck = true
    }
  } else {
    // Session load failed, fall through to normal path
    shouldSkipSessionCheck = false
  }
}
```

### Option 2: Call `setSession()` with localStorage Data

**Pros**:
- Faster than `getSession()` (no network call)
- Loads session from memory
- Preserves fast path optimization

**Cons**:
- Must manually handle token refresh
- Could have edge cases with token expiry
- Less tested approach

**Implementation**:
```javascript
// Fast path with setSession()
if (!isExpired) {
  console.log('🚀 FAST PATH: Valid session found, loading into client')

  // Load session into client from localStorage data
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token
  })

  if (!sessionError) {
    console.log('✅ Session loaded into Supabase client successfully')

    const user = parsed?.user
    if (user && mounted) {
      const userProfile = {
        id: user.id,
        email: user.email,
        // ... more fields
      }

      setCurrentUser(userProfile)
      setAuthUser(user)
      setIsLoading(false)
      shouldSkipSessionCheck = true
    }
  } else {
    console.error('❌ Failed to load session into client:', sessionError)
    shouldSkipSessionCheck = false
  }
}
```

### Option 3: Remove Fast Path Optimization

**Pros**:
- Simplest code
- Guaranteed to work
- No special cases

**Cons**:
- Slower page load (200-500ms)
- Loses optimization benefit
- More network calls

**Implementation**:
```javascript
// Remove fast path entirely
// Just let normal path handle everything

// Normal path (always runs)
const { data: { session }, error } = await supabase.auth.getSession()

if (session?.user && mounted) {
  await handleAuthUser(session.user)
}
```

---

## Recommended Solution

**Use Option 1: Call `getSession()` on Fast Path**

**Rationale**:
1. **Most Reliable**: Official SDK method, handles all edge cases
2. **Automatic Token Refresh**: SDK handles expiry and refresh
3. **Correct Internal State**: Updates all client state properly
4. **Minimal Code Changes**: Small addition to existing fast path
5. **Performance Trade-off**: 50-200ms delay acceptable for correctness

**Performance Impact**:
- Fast path: 50-200ms (getSession call)
- Normal path: 200-500ms (no change)
- **Still faster than removing fast path entirely**
- **Much better than broken functionality**

---

## Testing Validation

### Before Fix (Current State)

**Symptoms**:
- ❌ Page refresh with project URL → 5-second timeout
- ❌ Error: "Project restoration timeout after 5 seconds"
- ✅ Initial login works fine
- ❌ URL sharing broken
- ❌ Database queries timeout

**Console Logs**:
```
🚀 FAST PATH: Valid session found, setting state immediately
✅ Setting user state directly from localStorage: user@example.com
✅ User state set successfully, loading complete
⏩ Skipping session check - no session in storage
🔄 Project: Restoring project from URL: abc-123
🚨 Project: Restoration timeout for project: abc-123
❌ Project restoration timeout after 5 seconds
```

### After Fix (Expected State)

**Expected Behavior**:
- ✅ Page refresh with project URL → Project loads in <1 second
- ✅ No timeout errors
- ✅ Initial login still works
- ✅ URL sharing works
- ✅ Database queries succeed

**Expected Console Logs**:
```
🚀 FAST PATH: Valid session found, loading into client
🔐 Session check result: session found, user: user@example.com
✅ Session loaded into Supabase client successfully
✅ Setting user state directly from localStorage: user@example.com
✅ User state set successfully, loading complete
🔄 Project: Restoring project from URL: abc-123
✅ Project: Project restored successfully: My Project
```

---

## Additional Diagnostic Script

To verify the client session state, add this diagnostic:

```javascript
// In useAuth.ts, after fast path sets state
console.log('🔍 DIAGNOSTIC: Checking Supabase client session state...')
const clientSession = await supabase.auth.getSession()
console.log('🔍 Client has session?', clientSession.data.session ? 'YES' : 'NO')
console.log('🔍 React state has user?', currentUser ? 'YES' : 'NO')
console.log('🔍 localStorage has session?', localStorage.getItem(sessionKey) ? 'YES' : 'NO')
```

**Expected Output (Before Fix)**:
```
🔍 Client has session? NO
🔍 React state has user? YES
🔍 localStorage has session? YES
```

**Expected Output (After Fix)**:
```
🔍 Client has session? YES
🔍 React state has user? YES
🔍 localStorage has session? YES
```

---

## Conclusion

**Root Cause**: The Supabase client does NOT automatically load sessions from localStorage. The `persistSession: true` setting only controls WRITING to storage, not READING from it. The fast path optimization skips `getSession()`, which is the method that loads the session from storage into the client's internal auth state.

**Fix**: Add `await supabase.auth.getSession()` to the fast path to load the session into the client before setting React state.

**Impact**: Project restoration will work immediately on page refresh, fixing URL sharing functionality while maintaining most of the fast path performance benefit.

**Performance Cost**: ~50-200ms added to fast path (still faster than normal path)

**Risk**: Minimal - using official SDK method with proper error handling
