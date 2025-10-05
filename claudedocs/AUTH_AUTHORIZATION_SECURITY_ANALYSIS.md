# Authentication & Authorization Security Analysis
## Project Creation Failure Root Cause Investigation

**Analysis Date**: 2025-10-01
**Analyst**: Security Engineer Agent
**Priority**: HIGH - Active production issue
**Status**: Critical security and authorization gaps identified

---

## Executive Summary

The Playwright test successfully generated AI ideas but **failed to save the project**, returning a generic error. Root cause analysis reveals **multiple authentication and authorization vulnerabilities** that could prevent project creation, with the most critical being:

1. **Missing authentication token passing** in client-side project creation
2. **Row Level Security (RLS) policy gaps** allowing unauthenticated access
3. **No server-side authentication enforcement** for project creation
4. **Service role key exposure risk** in client-side code
5. **Demo user vs real user authorization inconsistencies**

---

## 1. Authentication Flow Analysis

### 1.1 Client-Side Authentication State Management

**File**: `/src/hooks/useAuth.ts`

**Current Flow**:
```
User Login → Supabase Auth → Session Token → User Profile Fetch → Cache Token
```

**Key Findings**:

✅ **Working Components**:
- Token caching with 10-minute TTL (lines 27-32)
- Session validation and refresh mechanism (lines 656-687)
- Clear cache on login/logout (lines 498-610)
- Token refresh on 401/403 responses (lines 221-286)

⚠️ **Vulnerabilities Identified**:

1. **Demo User Token Bypass** (lines 344-381)
   - Demo users create fallback profiles WITHOUT database validation
   - No verification that demo users have valid authentication
   - Could allow unauthorized access if demo UUID is guessed

2. **Legacy localStorage Bypass Removed** (lines 732-739)
   - Previous security fix removed localStorage auth bypass
   - Good security practice, but may have broken demo user flows

3. **Token Not Passed to DatabaseService**
   - `useAuth` manages tokens but doesn't pass them to `DatabaseService.createProject()`
   - Project creation happens WITHOUT explicit authentication header

### 1.2 API Authentication Middleware

**File**: `/api/auth/middleware.ts`

**Authentication Function**: `authenticate()` (lines 67-163)

**Security Analysis**:

✅ **Strong Components**:
- Bearer token validation (lines 72-88)
- Token caching to reduce Supabase calls (lines 90-108, TTL: 1 minute)
- UUID format validation (lines 136-140)
- Email sanitization (line 104)
- 400ms timeout for auth checks (line 112)

❌ **Critical Gap**:
**NO PROJECT CREATION ENDPOINT CALLS authenticate() MIDDLEWARE**

The `/api/projects.js` file is a **mock endpoint** that doesn't enforce authentication:

```javascript
// api/projects.js - MOCK IMPLEMENTATION
export default async function handler(req, res) {
  // NO AUTHENTICATION CHECK
  if (req.method === 'POST') {
    // Mock create project response
    return res.status(201).json({ project: newProject })
  }
}
```

**Impact**: Anyone can create projects by calling this API endpoint directly.

---

## 2. Row Level Security (RLS) Policy Analysis

### 2.1 Project Creation RLS Policy

**File**: `/database-migration-clean-install-v2.sql` (lines 237-243)

**Current Policy**:
```sql
CREATE POLICY "Users can create projects" ON public.projects
    FOR INSERT WITH CHECK (
        auth.uid() IS NULL OR  -- ⚠️ DANGEROUS: Allow if no auth
        owner_id = auth.uid() OR
        owner_id IS NULL  -- ⚠️ DANGEROUS: Allow NULL owner
    );
```

### 🚨 CRITICAL SECURITY VULNERABILITIES

#### Vulnerability 1: Unauthenticated Project Creation
```sql
auth.uid() IS NULL  -- Allows creation WITHOUT authentication
```
**Risk**: Anyone can create projects without logging in
**Business Impact**: Database pollution, resource abuse, data integrity issues

#### Vulnerability 2: NULL Owner Allowed
```sql
owner_id IS NULL  -- Allows projects with no owner
```
**Risk**: Orphaned projects that no one can manage
**Business Impact**: Data management nightmare, no accountability

### 2.2 Recommended RLS Policy Fix

```sql
-- SECURE RLS POLICY FOR PROJECT CREATION
CREATE POLICY "Authenticated users can create their own projects"
ON public.projects
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND  -- Require authentication
        owner_id = auth.uid()       -- Must own the project being created
    );
```

### 2.3 Other RLS Policies Review

**Teams Policy** (lines 182-197):
```sql
auth.uid() IS NULL OR  -- ⚠️ Development mode bypass
```
**Status**: Same vulnerability - allows unauthenticated access

**Ideas Policy** (lines 260-276):
```sql
auth.uid() IS NULL OR  -- ⚠️ Development mode bypass
```
**Status**: Same vulnerability - allows unauthenticated access

**Recommendation**: Remove all `auth.uid() IS NULL` conditions before production deployment.

---

## 3. Project Creation Code Path Analysis

### 3.1 Client-Side Project Creation

**File**: `/src/components/AIInsightsModal.tsx` (via AIStarterModal pattern)

**Call Chain**:
```
AIStarterModal.handleStart()
  → DatabaseService.createProject(projectData)
    → supabase.from('projects').insert([project])
```

**File**: `/src/lib/database.ts` (lines 628-654)

```typescript
static async createProject(project): Promise<Project | null> {
  // ⚠️ NO TOKEN PASSED - Uses default Supabase client
  const { data, error } = await supabase
    .from('projects')
    .insert([projectWithId])
    .select()
    .single()
}
```

**Critical Issue**:
- Uses **anon key client** (`supabase` from `/src/lib/supabase.ts`)
- Does NOT use **service role client** (`supabaseAdmin`)
- Relies ENTIRELY on RLS policies for authorization
- **With broken RLS, this should work... but doesn't**

### 3.2 Why Project Creation Still Fails

**Theory**: The RLS policy says `auth.uid() IS NULL OR owner_id = auth.uid()`

**Test Scenario Analysis**:
```
1. Playwright test logs in as demo user
2. Demo user has auth session (auth.uid() IS NOT NULL)
3. Demo user tries to create project with owner_id = demo_user_id
4. RLS checks: auth.uid() === owner_id?
5. If demo UUID is not properly formatted → RLS FAILS
6. If auth session is not properly set → RLS FAILS
```

**Root Cause Hypothesis**:
The demo user authentication creates a **client-side user object** but may not properly establish a **Supabase auth session** that RLS can validate.

**Evidence**:
```typescript
// useAuth.ts lines 344-381
if (authUser.isDemoUser || isDemoUUID(authUser.id)) {
  const fallbackUser = {
    id: ensureUUID(authUser.id),  // ⚠️ Creates UUID but doesn't set auth.uid()
    email: authUser.email,
    // ... rest of user object
  }
  setCurrentUser(fallbackUser)  // ⚠️ React state only, not Supabase session
}
```

**The Problem**:
- Demo user is stored in React state (`currentUser`)
- Demo user is NOT authenticated with Supabase (`auth.uid()` is NULL)
- RLS policy checks `auth.uid()` → NULL → checks `owner_id = auth.uid()` → NULL = demo_uuid → FALSE
- RLS policy falls back to `auth.uid() IS NULL` → TRUE → **SHOULD ALLOW**

**Wait... if `auth.uid() IS NULL` returns TRUE, why does it still fail?**

---

## 4. The Real Root Cause: Mock API Endpoint

**File**: `/api/projects.js`

The frontend is calling `/api/projects` which is a **MOCK endpoint** that:
1. Does NOT connect to Supabase
2. Does NOT save to database
3. Returns fake success responses

**Evidence**:
```javascript
// api/projects.js line 35-51
if (req.method === 'POST') {
  const newProject = {
    id: `project-${Date.now()}`,  // ⚠️ Fake ID
    name: req.body?.name || 'New Project',
    // ...
  }
  return res.status(201).json({
    project: newProject,  // ⚠️ Not saved to database
    message: 'Project created successfully'
  })
}
```

**Verification Needed**:
Check if frontend is calling `/api/projects` (mock) vs direct Supabase client calls.

---

## 5. Demo User vs Real User Authorization Flow

### 5.1 Demo User Flow

**File**: `/src/hooks/useAuth.ts` (lines 344-381)

```typescript
if (authUser.isDemoUser || isDemoUUID(authUser.id)) {
  // Create fallback user WITHOUT database verification
  const fallbackUser = {
    id: ensureUUID(authUser.id),  // Generate UUID format
    email: authUser.email,
    role: determineRole(authUser.email),  // Client-side role assignment
  }
  setCurrentUser(fallbackUser)
  setIsLoading(false)
}
```

**Security Issues**:
1. **No database validation** - demo users never hit database
2. **Client-side role assignment** - roles assigned based on email pattern
3. **No Supabase session** - `auth.uid()` remains NULL
4. **RLS bypass reliance** - depends on `auth.uid() IS NULL` allowing access

### 5.2 Real User Flow

**File**: `/src/hooks/useAuth.ts` (lines 383-453)

```typescript
else {
  // Get profile with token
  const userProfile = await getCachedUserProfile(authUser.id, authUser.email)
  // Uses /api/auth/user endpoint which calls authenticate()
  setCurrentUser(userProfile)
  setIsLoading(false)
}
```

**Authentication Path**:
```
Real User Login
  → Supabase Auth (sets auth.uid())
  → /api/auth/user (validates token with authenticate())
  → Database lookup (gets profile from user_profiles table)
  → Sets currentUser with verified data
```

**Security Difference**:
- Real users have `auth.uid()` set by Supabase
- Real users pass RLS checks via `owner_id = auth.uid()`
- Real users don't need `auth.uid() IS NULL` bypass

---

## 6. Service Role Key Security Assessment

**File**: `/src/lib/supabase.ts`

### 6.1 Service Role Client Configuration

```typescript
// Line 6: ⚠️ CRITICAL - Service role key in client-side code
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// Lines 56-68: Service role client with RLS bypass
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey,  // ⚠️ Fallback to anon
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
```

### 🚨 CRITICAL SECURITY RISK

**Exposure**: Service role key is imported in **client-side bundle**
**Access**: Available in `import.meta.env` which is **bundled into JavaScript**
**Risk Level**: **CRITICAL** - Full database access with RLS bypass

**Evidence**:
```typescript
// src/lib/supabase.ts exports supabaseAdmin
// src/lib/supabase.ts is imported by client-side components
// Vite bundles VITE_* env vars into client bundle
```

**Verification**:
```bash
# Check if service role key is in production build
npm run build
grep -r "VITE_SUPABASE_SERVICE_ROLE_KEY" dist/
```

**Impact if Exposed**:
- Attacker can bypass ALL RLS policies
- Full read/write access to ALL tables
- Can impersonate any user
- Can delete entire database

### 6.2 Proper Service Role Key Usage

**Current Usage**:
```typescript
// src/lib/supabase.ts - ❌ WRONG: Client-side import
export const supabaseAdmin = createClient(url, supabaseServiceRoleKey)

// Components can import and use:
import { supabaseAdmin } from '../lib/supabase'
```

**Recommended Pattern**:
```typescript
// ✅ CORRECT: Server-side only
// api/auth/user.ts (Vercel serverless function)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Server-side only
)
```

**Migration Required**:
1. Remove `supabaseAdmin` export from `/src/lib/supabase.ts`
2. Create server-side helper: `/api/lib/supabase-admin.ts`
3. Audit all `supabaseAdmin` usage in client code
4. Move admin operations to API endpoints

---

## 7. Token Passing Between Client and API

### 7.1 Current Token Flow

**Authentication Token Retrieval** (`/src/hooks/useAuth.ts`):
```typescript
// Line 199: Get token for API calls
const token = (await supabase.auth.getSession()).data.session?.access_token

// Line 209-216: Pass token in Authorization header
const response = await fetch('/api/auth/user', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

**API Token Validation** (`/api/auth/middleware.ts`):
```typescript
// Line 67-163: authenticate() function
const authHeader = req.headers.authorization
const token = authHeader.substring(7)  // Remove 'Bearer '
const { data: { user } } = await supabase.auth.getUser(token)
```

### 7.2 Project Creation Token Gap

**Problem**: `DatabaseService.createProject()` does NOT call any API endpoint

```typescript
// ❌ Current: Direct Supabase call (no token passed to API)
static async createProject(project) {
  const { data, error } = await supabase  // Uses session cookie
    .from('projects')
    .insert([project])
}
```

**Why This Might Fail**:
1. Supabase client uses session from `localStorage`
2. Session might be expired or invalid
3. RLS policy checks `auth.uid()` from JWT token
4. If JWT is invalid/expired → `auth.uid()` is NULL
5. Demo users never have valid JWT → always NULL

**Solution Options**:

**Option 1**: Create API endpoint for project creation
```typescript
// api/projects/create.ts
export default async function handler(req, res) {
  const { user } = await authenticate(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Use user's auth context for RLS
  const { data, error } = await supabase
    .from('projects')
    .insert([{ ...req.body, owner_id: user.id }])

  return res.status(201).json({ project: data })
}
```

**Option 2**: Use service role client on server (secure)
```typescript
// api/projects/create.ts
export default async function handler(req, res) {
  const { user } = await authenticate(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Service role bypasses RLS (server-side only)
  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert([{ ...req.body, owner_id: user.id }])

  return res.status(201).json({ project: data })
}
```

---

## 8. Error Message Analysis

### 8.1 Current Error Handling

**Frontend** (`/src/lib/database.ts`):
```typescript
static async createProject(project): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert([project])
    .single()

  if (error) {
    logger.error('Error creating project:', error)  // ❌ Generic message
    return null  // ❌ No error details passed to caller
  }
  return data
}
```

**Issues**:
1. Returns `null` on error (no error details)
2. Caller receives generic "Failed to create project"
3. Real error (auth, RLS, validation) is hidden in logs
4. User sees "Something went wrong" - no actionable info

### 8.2 Improved Error Handling

```typescript
static async createProject(project): Promise<{ data: Project | null, error: string | null }> {
  const { data, error } = await supabase
    .from('projects')
    .insert([project])
    .single()

  if (error) {
    // Parse Supabase error for user-friendly message
    const userMessage = this.parseSupabaseError(error)
    logger.error('Project creation failed:', {
      code: error.code,
      message: error.message,
      details: error.details
    })
    return { data: null, error: userMessage }
  }

  return { data, error: null }
}

private static parseSupabaseError(error: any): string {
  if (error.code === '42501') return 'Permission denied. Please check your account settings.'
  if (error.code === '23505') return 'A project with this name already exists.'
  if (error.message.includes('JWT')) return 'Session expired. Please log in again.'
  if (error.message.includes('RLS')) return 'Authorization check failed. Contact support.'
  return 'Failed to create project. Please try again.'
}
```

---

## 9. Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                          │
└─────────────────────────────────────────────────────────────────┘

REAL USER FLOW:
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────┐
│  Login   │───→│ Supabase     │───→│ JWT Token   │───→│ RLS:    │
│  Screen  │    │ Auth         │    │ with        │    │ auth.   │
│          │    │              │    │ auth.uid()  │    │ uid()   │
└──────────┘    └──────────────┘    └─────────────┘    │ = user  │
                                           │             └─────────┘
                                           ▼                  │
                                    ┌─────────────┐          │
                                    │ /api/auth/  │          │
                                    │ user        │          │
                                    │ (validate)  │          │
                                    └─────────────┘          │
                                           │                  │
                                           ▼                  │
                                    ┌─────────────┐          │
                                    │ Get User    │          │
                                    │ Profile     │          │
                                    │ from DB     │          │
                                    └─────────────┘          │
                                           │                  │
                                           ▼                  ▼
                                    ┌──────────────────────────┐
                                    │ CREATE PROJECT:          │
                                    │ supabase.from('projects')│
                                    │ .insert({ owner_id })    │
                                    │ → RLS validates owner    │
                                    │ → ✅ SUCCESS             │
                                    └──────────────────────────┘

DEMO USER FLOW:
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────┐
│  Demo    │───→│ NO Supabase  │───→│ NO JWT      │───→│ RLS:    │
│  Login   │    │ Auth         │    │ Token       │    │ auth.   │
│          │    │              │    │             │    │ uid()   │
└──────────┘    └──────────────┘    └─────────────┘    │ = NULL  │
                       │                                 └─────────┘
                       ▼                                      │
                ┌─────────────┐                              │
                │ Generate    │                              │
                │ Demo UUID   │                              │
                │ (client)    │                              │
                └─────────────┘                              │
                       │                                      │
                       ▼                                      │
                ┌─────────────┐                              │
                │ Create      │                              │
                │ Fallback    │                              │
                │ User Object │                              │
                └─────────────┘                              │
                       │                                      │
                       ▼                                      ▼
                ┌──────────────────────────────────────────────┐
                │ CREATE PROJECT:                              │
                │ supabase.from('projects')                    │
                │ .insert({ owner_id: demo_uuid })             │
                │ → RLS checks: auth.uid() = demo_uuid?        │
                │ → auth.uid() IS NULL (no session)            │
                │ → Falls back to: auth.uid() IS NULL? TRUE    │
                │ → ✅ SHOULD WORK... but doesn't?             │
                └──────────────────────────────────────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │ WHY FAILURE? │
                            │ 1. Mock API? │
                            │ 2. RLS bug?  │
                            │ 3. Session?  │
                            └──────────────┘
```

---

## 10. Recommended Security Fixes

### Priority 1: CRITICAL (Immediate Action Required)

#### 1.1 Remove Service Role Key from Client Bundle
```typescript
// ❌ REMOVE from src/lib/supabase.ts
export const supabaseAdmin = createClient(url, serviceRoleKey)

// ✅ ADD to api/lib/supabase-admin.ts (server-side only)
export function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

#### 1.2 Fix RLS Policies - Remove Development Bypasses
```sql
-- ❌ REMOVE this dangerous policy
CREATE POLICY "Users can create projects" ON public.projects
    FOR INSERT WITH CHECK (
        auth.uid() IS NULL OR owner_id = auth.uid()
    );

-- ✅ REPLACE with secure policy
CREATE POLICY "Authenticated users create own projects" ON public.projects
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        owner_id = auth.uid()
    );
```

#### 1.3 Create Authenticated API Endpoint for Project Creation
```typescript
// api/projects/create.ts
import { authenticate } from '../auth/middleware'

export default async function handler(req, res) {
  // Enforce authentication
  const { user, error } = await authenticate(req)
  if (!user || error) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to create projects'
    })
  }

  // Validate input
  const { name, description, project_type } = req.body
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Project name is required' })
  }

  try {
    // Use server-side admin client with explicit owner_id
    const adminClient = getAdminClient()
    const { data, error: dbError } = await adminClient
      .from('projects')
      .insert([{
        name: name.trim(),
        description: description?.trim(),
        project_type: project_type || 'other',
        owner_id: user.id,  // Enforce owner from authenticated user
        status: 'active',
        priority_level: 'medium',
        visibility: 'private',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (dbError) {
      logger.error('Project creation failed:', dbError)
      return res.status(500).json({
        error: 'Failed to create project',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      })
    }

    return res.status(201).json({
      success: true,
      project: data
    })
  } catch (error) {
    logger.error('Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

### Priority 2: HIGH (Fix Within 1 Week)

#### 2.1 Update Client-Side DatabaseService to Call API
```typescript
// src/lib/database.ts
static async createProject(project: CreateProjectInput): Promise<{ data: Project | null, error: string | null }> {
  try {
    // Get auth token
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return {
        data: null,
        error: 'Authentication required. Please log in.'
      }
    }

    // Call authenticated API endpoint
    const response = await fetch('/api/projects/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(project)
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        data: null,
        error: errorData.message || 'Failed to create project'
      }
    }

    const { project: createdProject } = await response.json()
    return { data: createdProject, error: null }
  } catch (error) {
    logger.error('Project creation error:', error)
    return {
      data: null,
      error: 'Network error. Please check your connection.'
    }
  }
}
```

#### 2.2 Fix Demo User Authentication
```typescript
// src/hooks/useAuth.ts
if (authUser.isDemoUser || isDemoUUID(authUser.id)) {
  // Create proper Supabase session for demo user
  try {
    // Option 1: Use signInAnonymously()
    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name,
          is_demo: true
        }
      }
    })

    if (error) throw error

    // Now demo user has auth.uid() set
    const demoUser = {
      id: data.user.id,  // Real Supabase user ID
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.email,
      role: determineRole(authUser.email),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    setCurrentUser(demoUser)
    setIsLoading(false)
  } catch (error) {
    logger.error('Demo user session creation failed:', error)
    // Fallback to old behavior
  }
}
```

### Priority 3: MEDIUM (Fix Within 2 Weeks)

#### 3.1 Add Rate Limiting to Project Creation
```typescript
// api/projects/create.ts
import { checkUserRateLimit } from '../auth/middleware'

export default async function handler(req, res) {
  const { user } = await authenticate(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Rate limit: 10 projects per hour per user
  if (!checkUserRateLimit(user.id, 10, 3600000)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'You can create up to 10 projects per hour'
    })
  }

  // ... rest of creation logic
}
```

#### 3.2 Add Audit Logging
```typescript
// After successful project creation
await supabaseAdmin
  .from('audit_logs')
  .insert([{
    user_id: user.id,
    action: 'project.created',
    resource_type: 'project',
    resource_id: data.id,
    metadata: { name: data.name, project_type: data.project_type },
    ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    user_agent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  }])
```

### Priority 4: LOW (Fix Within 1 Month)

#### 4.1 Add Project Creation Webhooks
#### 4.2 Add Email Notification on Project Creation
#### 4.3 Add Project Deletion Audit Trail

---

## 11. Immediate Action Items for Investigation

### Step 1: Determine Which Project Creation Path is Being Used

Run this in Playwright test:
```typescript
// Add before project creation
await page.evaluate(() => {
  window._projectCreationDebug = true

  // Override fetch to log API calls
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    console.log('[FETCH]', args[0], args[1])
    return originalFetch(...args)
  }

  // Override Supabase client
  console.log('[SUPABASE] Client config:', window.supabase?.supabaseUrl)
})

// Then create project and check console logs
```

### Step 2: Check if Mock API is Being Called

```bash
# Search for API endpoint imports
grep -r "/api/projects" src/
grep -r "DatabaseService.createProject" src/
```

### Step 3: Verify Demo User Session

```typescript
// Add to Playwright test after demo login
const sessionInfo = await page.evaluate(async () => {
  const { data, error } = await window.supabase.auth.getSession()
  return {
    hasSession: !!data.session,
    userId: data.session?.user?.id,
    authUid: data.session?.user?.id,
    accessToken: data.session?.access_token ? 'present' : 'missing',
    error: error
  }
})
console.log('[SESSION]', sessionInfo)
```

### Step 4: Check RLS Policy Execution

```sql
-- Run in Supabase SQL Editor
SELECT * FROM pg_policies
WHERE tablename = 'projects'
AND policyname LIKE '%create%';

-- Test RLS policy as unauthenticated user
SET ROLE anon;
INSERT INTO public.projects (name, owner_id, project_type, status, priority_level, visibility)
VALUES ('Test Project', NULL, 'test', 'active', 'medium', 'private');
-- Should this succeed or fail?
```

---

## 12. Security Compliance Checklist

### Authentication
- [ ] Remove service role key from client bundle
- [ ] Verify all API endpoints use `authenticate()` middleware
- [ ] Audit token caching and expiration
- [ ] Test token refresh flow
- [ ] Verify session validation on critical operations

### Authorization
- [ ] Remove `auth.uid() IS NULL` from all RLS policies
- [ ] Remove `owner_id IS NULL` from INSERT policies
- [ ] Verify RLS policies prevent unauthorized access
- [ ] Test with different user roles (user, admin, super_admin)
- [ ] Audit project access permissions

### Data Protection
- [ ] Verify demo users cannot access real user data
- [ ] Test that users can only see their own projects
- [ ] Verify collaborator permissions work correctly
- [ ] Test team-based access controls
- [ ] Audit file upload permissions

### Error Handling
- [ ] Ensure error messages don't leak sensitive data
- [ ] Log detailed errors server-side only
- [ ] Return user-friendly error messages
- [ ] Test error recovery flows
- [ ] Monitor error rates in production

### Rate Limiting
- [ ] Implement per-user rate limits
- [ ] Add IP-based rate limiting
- [ ] Monitor for abuse patterns
- [ ] Test rate limit enforcement
- [ ] Add rate limit headers to API responses

---

## 13. Conclusion

### Root Cause Summary

The project creation failure is caused by **multiple compounding issues**:

1. **Primary Suspect**: Mock API endpoint (`/api/projects.js`) not saving to database
2. **Authentication Gap**: Demo users don't have valid Supabase sessions (`auth.uid()` is NULL)
3. **RLS Bypass Dependency**: System relies on dangerous `auth.uid() IS NULL` policy
4. **Token Passing Gap**: Direct Supabase calls don't explicitly pass auth tokens
5. **Error Hiding**: Generic error messages hide the real failure cause

### Recommended Investigation Priority

1. **Immediate**: Verify if `/api/projects.js` mock is being called (should take 5 minutes)
2. **Quick Win**: Test with real API endpoint calling `supabase.from('projects').insert()`
3. **Medium**: Fix demo user authentication to create proper Supabase sessions
4. **Critical**: Remove RLS bypass policies before production deployment
5. **Essential**: Remove service role key from client bundle

### Security Risk Assessment

**Current Risk Level**: **HIGH**

**Immediate Threats**:
- Service role key exposure → Database takeover
- Unauthenticated project creation → Resource abuse
- NULL owner projects → Data integrity issues

**Business Impact**:
- User data at risk of unauthorized access
- Database pollution from unauthenticated users
- Potential regulatory compliance violations (GDPR, CCPA)

**Recommendation**: **Block production deployment** until Priority 1 fixes are implemented.

---

## 14. Additional Resources

**Files Analyzed**:
- `/src/hooks/useAuth.ts` - Client authentication flow
- `/api/auth/middleware.ts` - Server authentication validation
- `/src/lib/database.ts` - Database service layer
- `/src/lib/services/ProjectService.ts` - Project service layer
- `/src/lib/supabase.ts` - Supabase client configuration
- `/api/projects.js` - Mock API endpoint
- `/database-migration-clean-install-v2.sql` - RLS policies

**Related Reports**:
- `AUTHENTICATION_SECURITY_AUDIT.md`
- `SECURITY_VULNERABILITY_ASSESSMENT.md`
- `ADMIN_DATABASE_ACCESS_IMPLEMENTATION.md`

**Contact**: Security Engineer Agent
**Next Review**: After Priority 1 fixes implemented
