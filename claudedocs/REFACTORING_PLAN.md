# COMPREHENSIVE REFACTORING PLAN
**Date**: 2025-10-16
**Status**: PLANNING
**Critical Success Criteria**: ❌ **ZERO FUNCTIONALITY BREAKS** - Any break is a fail

---

## 🎯 Executive Summary

**Current State**:
- 817-line useAuth hook (God hook)
- 130+ diagnostic console.logs
- 3 duplicate cache implementations
- Hardcoded values in 4+ locations
- Technical debt ratio: ~25%

**Target State**:
- useAuth reduced to ~100 lines
- Clean production logging
- Single CacheManager implementation
- Centralized configuration
- Technical debt ratio: <15%

**Timeline**: 3 weeks (3 phases, each 1 week)
**Risk Level**: MEDIUM (with comprehensive validation)

---

## 🔒 Safety Protocol

### Pre-Refactoring Checklist
- [ ] All tests pass: `npm run test:run`
- [ ] Type checking clean: `npm run type-check`
- [ ] Lint passing: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Dev server runs: `npm run dev`
- [ ] Git status clean (commit all work)
- [ ] Create backup branch: `git checkout -b backup/pre-refactoring`

### Per-Step Validation Gates
After EVERY refactoring step:
1. **Unit Tests**: `npm run test:run` → MUST pass 100%
2. **Type Check**: `npm run type-check` → MUST pass with 0 errors
3. **Build**: `npm run build` → MUST succeed
4. **Manual Testing**:
   - ✅ Login flow works
   - ✅ Project list loads
   - ✅ **Project URL refresh works** (CRITICAL)
   - ✅ Matrix displays
   - ✅ No console errors
5. **Git Checkpoint**: Commit with descriptive message
6. **Rollback Plan**: Know the last good commit

### Rollback Procedure
If ANY validation fails:
```bash
git reset --hard HEAD~1  # Roll back last commit
# Or
git checkout backup/pre-refactoring  # Full rollback
```

---

## 📋 PHASE 1: Foundation & Low-Risk Wins (Week 1)
**Goal**: Clean up code without touching core logic
**Risk**: LOW
**Value**: HIGH (immediate code quality improvement)

---

### **STEP 1.1: Diagnostic Logging Cleanup**
**Priority**: IMMEDIATE
**Effort**: 4 hours
**Risk**: VERY LOW (no logic changes)
**Agent**: `refactoring-expert`

#### Why This First?
- No logic changes, purely cosmetic
- Immediate code readability improvement
- Makes subsequent refactoring easier to review
- Zero risk to functionality

#### Files to Modify:
1. `src/hooks/useAuth.ts` (60+ console.logs)
2. `src/contexts/ProjectContext.tsx` (20+ console.logs)
3. `src/lib/supabase.ts` (15+ console.logs)
4. `src/contexts/AuthMigration.tsx` (10+ console.logs)

#### Agent Prompt:
```
You are a refactoring-expert. Clean up diagnostic logging from recent debugging session.

TASK: Remove 90% of console.log statements while preserving strategic logging

FILES: src/hooks/useAuth.ts, src/contexts/ProjectContext.tsx, src/lib/supabase.ts, src/contexts/AuthMigration.tsx

RULES:
1. KEEP these patterns:
   - logger.error() for errors
   - logger.warn() for warnings
   - logger.info() for key events (login, logout, project load)
   - Strategic logger.debug() for auth flow checkpoints (max 5 per file)

2. REMOVE these patterns:
   - console.log('🔍 ...') diagnostic traces
   - console.log execution tracking
   - console.log state dumps
   - Redundant timing logs

3. PRESERVE FUNCTIONALITY:
   - Do NOT remove try-catch blocks
   - Do NOT change any conditional logic
   - Do NOT modify error handling
   - Keep all functional code intact

4. VALIDATION:
   - Run npm run type-check after changes
   - Run npm run test:run after changes
   - Commit with message: "refactor: clean up diagnostic logging"

DELIVERABLE: Clean code with <15 log statements per file, all tests passing
```

#### Success Criteria:
- [ ] console.log statements reduced from 130+ to <20
- [ ] All tests pass: `npm run test:run`
- [ ] Type check passes: `npm run type-check`
- [ ] Manual validation: Login → Project refresh works
- [ ] Git commit created

---

### **STEP 1.2: Extract Hardcoded Constants**
**Priority**: IMMEDIATE
**Effort**: 2 hours
**Risk**: VERY LOW
**Agent**: `refactoring-expert`

#### Why This Next?
- Simple find-and-replace refactoring
- No logic changes
- Reduces fragility for future changes
- Easy to validate

#### Constants to Extract:

**Storage Key** (appears 4+ times):
```typescript
// Current
const storageKey = 'sb-vfovtgtjailvrphsgafv-auth-token'

// Target: src/lib/config.ts
export const SUPABASE_STORAGE_KEY = 'sb-vfovtgtjailvrphsgafv-auth-token'
```

**Timeout Durations** (inconsistent across files):
```typescript
// Current
2000  // getSession timeout (useAuth.ts line 634)
5000  // project restore timeout (ProjectContext.tsx line 115)
10000 // profile fetch timeout (useAuth.ts line 201)

// Target: src/lib/config.ts
export const TIMEOUTS = {
  AUTH_GET_SESSION: 2000,
  PROJECT_RESTORE: 5000,
  PROFILE_FETCH: 10000,
  PROJECT_CHECK: 10000
} as const
```

**Cache Durations**:
```typescript
// Current
10 * 60 * 1000  // user profile cache (useAuth.ts line 29)
2 * 60 * 1000   // session cache (useAuth.ts line 33)
5 * 60 * 1000   // project existence cache (useAuth.ts line 90)

// Target: src/lib/config.ts
export const CACHE_DURATIONS = {
  USER_PROFILE: 10 * 60 * 1000,
  SESSION: 2 * 60 * 1000,
  PROJECT_EXISTENCE: 5 * 60 * 1000,
  PROFILE: 2 * 60 * 1000
} as const
```

#### Agent Prompt:
```
You are a refactoring-expert. Extract hardcoded constants to centralized config.

TASK: Create src/lib/config.ts and replace all hardcoded values

CONSTANTS TO EXTRACT:
1. SUPABASE_STORAGE_KEY (4 locations)
2. TIMEOUTS (6+ locations)
3. CACHE_DURATIONS (4 locations)

FILES TO MODIFY:
- CREATE: src/lib/config.ts
- UPDATE: src/hooks/useAuth.ts (multiple replacements)
- UPDATE: src/contexts/ProjectContext.tsx (2 replacements)
- UPDATE: src/lib/supabase.ts (2 replacements)

STEPS:
1. Create src/lib/config.ts with constants
2. Add JSDoc comments explaining each constant
3. Import config in each file: import { SUPABASE_STORAGE_KEY, TIMEOUTS, CACHE_DURATIONS } from '../lib/config'
4. Replace all hardcoded values with config references
5. Ensure TypeScript types are correct (use 'as const' for type safety)

VALIDATION:
- npm run type-check → MUST pass
- npm run test:run → MUST pass
- Search codebase for remaining hardcoded values
- Commit: "refactor: extract hardcoded constants to config"

CRITICAL: Do NOT change any logic, only replace hardcoded values with config references
```

#### Success Criteria:
- [ ] `src/lib/config.ts` created with all constants
- [ ] All hardcoded values replaced
- [ ] All tests pass
- [ ] Type check passes
- [ ] Manual validation: Project refresh still works
- [ ] Git commit created

---

### **STEP 1.3: Extract Timeout Utility**
**Priority**: HIGH
**Effort**: 2 hours
**Risk**: LOW
**Agent**: `refactoring-expert`

#### Why This Next?
- Eliminates duplication (6+ locations)
- Testable utility function
- No behavior changes, just extraction
- Sets foundation for future refactoring

#### Current Pattern (duplicated 6+ times):
```typescript
const timeoutPromise = new Promise<null>((_, reject) =>
  setTimeout(() => reject(new Error('timeout')), 2000)
)
const result = await Promise.race([dataPromise, timeoutPromise])
```

#### Target Pattern:
```typescript
// src/utils/promiseUtils.ts
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage || `Timeout after ${timeoutMs}ms`)), timeoutMs)
  )
  return Promise.race([promise, timeout])
}

// Usage
const session = await withTimeout(
  supabase.auth.getSession(),
  TIMEOUTS.AUTH_GET_SESSION,
  'getSession() timeout'
)
```

#### Agent Prompt:
```
You are a refactoring-expert. Extract timeout utility to eliminate duplication.

TASK: Create reusable timeout utility and replace all Promise.race timeout patterns

FILES:
- CREATE: src/utils/promiseUtils.ts
- UPDATE: src/hooks/useAuth.ts (3 occurrences)
- UPDATE: src/contexts/ProjectContext.tsx (2 occurrences)
- UPDATE: src/lib/supabase.ts (2 occurrences)

STEPS:
1. Create src/utils/promiseUtils.ts with:
   - withTimeout<T>() function with generic type
   - withFallback<T>() function for fallback values
   - Full TypeScript types and JSDoc comments
   - Unit tests in src/utils/__tests__/promiseUtils.test.ts

2. Replace all Promise.race patterns:
   - Find: Promise.race([promise, new Promise((_, reject) => setTimeout...])
   - Replace: withTimeout(promise, duration, message)
   - Use TIMEOUTS config constants

3. Write unit tests:
   - Test successful promise completion
   - Test timeout triggers correctly
   - Test error message formatting

VALIDATION:
- npm run test:run → NEW tests must pass
- npm run type-check → MUST pass
- Manual test: Login → Project refresh
- Commit: "refactor: extract timeout utility"

DELIVERABLE: DRY code with tested utility function
```

#### Success Criteria:
- [ ] `src/utils/promiseUtils.ts` created with tests
- [ ] All timeout patterns replaced
- [ ] New unit tests passing
- [ ] All existing tests pass
- [ ] Manual validation: Everything still works
- [ ] Git commit created

---

## 📋 PHASE 2: Structural Improvements (Week 2)
**Goal**: Extract services without breaking functionality
**Risk**: MEDIUM
**Value**: HIGH (major complexity reduction)

---

### **STEP 2.1: Extract CacheManager Service**
**Priority**: HIGH
**Effort**: 6 hours
**Risk**: MEDIUM
**Agent**: `refactoring-expert`

#### Why This?
- Eliminates 3 duplicate cache implementations
- Testable, reusable service
- Fixes memory leak (module-level setInterval)
- Significant complexity reduction

#### Current State (3 implementations):
```typescript
// useAuth.ts line 28-59
const userProfileCache = new Map<string, { user: User; timestamp: number; expires: number }>()
setInterval(() => { /* cleanup */ }, 30000)

// useAuth.ts line 32
const sessionCache = new Map<string, { session: any; timestamp: number; expires: number }>()

// supabase.ts line 227
const profileCache = new Map<string, { profile: any; timestamp: number; expires: number }>()
```

#### Target Architecture:
```typescript
// src/services/CacheManager.ts
export class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private cleanupInterval?: NodeJS.Timeout

  constructor(
    private ttl: number,
    private options: CacheOptions = {}
  ) {
    if (options.autoCleanup !== false) {
      this.startCleanup()
    }
  }

  get(key: string): T | null
  set(key: string, value: T): void
  delete(key: string): void
  clear(): void
  cleanup(): void
  destroy(): void  // Clean up interval
}

// Usage
const profileCache = new CacheManager<User>(CACHE_DURATIONS.USER_PROFILE)
const sessionCache = new CacheManager<Session>(CACHE_DURATIONS.SESSION)
```

#### Agent Prompt:
```
You are a refactoring-expert. Extract generic CacheManager to replace 3 duplicate implementations.

TASK: Create reusable CacheManager service with proper lifecycle management

FILES:
- CREATE: src/services/CacheManager.ts
- CREATE: src/services/__tests__/CacheManager.test.ts
- UPDATE: src/hooks/useAuth.ts (replace 2 cache implementations)
- UPDATE: src/lib/supabase.ts (replace 1 cache implementation)

ARCHITECTURE:
1. Generic CacheManager<T> class with:
   - get(key: string): T | null
   - set(key: string, value: T): void
   - delete(key: string): void
   - clear(): void
   - cleanup(): void (manual cleanup for testing)
   - destroy(): void (cleanup interval)

2. Options:
   - ttl: number (cache duration)
   - autoCleanup?: boolean (default true)
   - cleanupInterval?: number (default 30000ms)

3. Memory leak fix:
   - Move setInterval INSIDE class (not module level)
   - Proper cleanup on destroy()

STEPS:
1. Create CacheManager with comprehensive tests
2. Replace userProfileCache in useAuth.ts
3. Replace sessionCache in useAuth.ts
4. Replace profileCache in supabase.ts
5. Remove module-level setInterval
6. Ensure cleanup on component unmount

CRITICAL VALIDATION:
- ALL existing cache behavior preserved
- npm run test:run → MUST pass
- Manual test: Login → Logout → Login (cache should work)
- Manual test: Wait 30 seconds → Cache should expire
- Manual test: Project refresh → Should use cached data

DELIVERABLE: Single CacheManager implementation, all caches migrated, tests passing
```

#### Success Criteria:
- [ ] CacheManager service created with tests
- [ ] All 3 cache implementations replaced
- [ ] Module-level setInterval removed
- [ ] All tests pass (including new CacheManager tests)
- [ ] Manual validation: Caching still works correctly
- [ ] No memory leaks (cleanup properly)
- [ ] Git commit created

---

### **STEP 2.2: Extract ProfileService**
**Priority**: HIGH
**Effort**: 8 hours
**Risk**: MEDIUM
**Agent**: `refactoring-expert`

#### Why This?
- Reduces useAuth.ts by ~170 lines (20%)
- Separates concerns (profile management vs auth)
- Testable business logic
- Major step toward breaking up God hook

#### Current: Profile logic in useAuth.ts
```typescript
// Lines 176-338: getCachedUserProfile() - 163 lines
// Lines 344-473: handleAuthUser() - 129 lines (uses profile fetching)
```

#### Target Architecture:
```typescript
// src/services/ProfileService.ts
export class ProfileService {
  constructor(
    private cache: CacheManager<User>,
    private supabaseClient: SupabaseClient
  ) {}

  async getProfile(userId: string, userEmail: string): Promise<User>
  async createProfile(userId: string, email?: string): Promise<User>
  async updateProfile(userId: string, updates: Partial<User>): Promise<User>

  private async fetchFromAPI(userId: string): Promise<User>
  private handleTokenRefresh(): Promise<void>
}

// src/hooks/useAuth.ts (simplified)
const profileService = new ProfileService(profileCache, supabase)
const userProfile = await profileService.getProfile(authUser.id, authUser.email)
```

#### Agent Prompt:
```
You are a refactoring-expert. Extract ProfileService from useAuth hook.

TASK: Create ProfileService to handle all user profile operations

FILES:
- CREATE: src/services/ProfileService.ts
- CREATE: src/services/__tests__/ProfileService.test.ts
- UPDATE: src/hooks/useAuth.ts (remove 163 lines, use ProfileService)
- UPDATE: src/lib/supabase.ts (integrate with ProfileService if needed)

ARCHITECTURE:
1. ProfileService class with:
   - getProfile(userId, email) → User
   - createProfile(userId, email?) → User
   - updateProfile(userId, updates) → User
   - Private methods for API calls, token refresh, fallback handling

2. Dependencies:
   - CacheManager<User> for caching
   - SupabaseClient for API calls
   - Configuration constants

3. Behavior to preserve:
   - Cache lookup before API call
   - Request deduplication (pending requests map)
   - Token refresh on 401/403
   - Fallback user creation on errors
   - Timeout handling (10s)
   - Triple cache duration on success

CRITICAL STEPS:
1. Extract getCachedUserProfile() logic → ProfileService
2. Keep exact same behavior (caching, timeouts, token refresh)
3. Update handleAuthUser() to use ProfileService
4. Write comprehensive tests mocking Supabase client
5. Ensure no behavior changes

VALIDATION:
- npm run test:run → MUST pass
- npm run type-check → MUST pass
- Manual: Login with new user → Profile created
- Manual: Login with existing user → Profile cached
- Manual: Token expires → Refresh works
- Manual: API timeout → Fallback user works

DELIVERABLE: ProfileService extracted, useAuth.ts reduced by 170 lines, all tests passing
```

#### Success Criteria:
- [ ] ProfileService created with comprehensive tests
- [ ] useAuth.ts reduced from 817 to ~650 lines
- [ ] All profile operations use ProfileService
- [ ] Token refresh still works
- [ ] Fallback users still work
- [ ] Caching behavior unchanged
- [ ] All tests pass
- [ ] Manual validation: Login/logout cycles work
- [ ] Git commit created

---

### **STEP 2.3: Extract SupabaseRestClient**
**Priority**: HIGH
**Effort**: 6 hours
**Risk**: MEDIUM
**Agent**: `backend-architect`

#### Why This?
- Abstracts direct REST API calls
- Type-safe PostgREST query building
- DRY (currently duplicated in ProjectContext)
- Foundation for fixing "ideas not loading" issue

#### Current: Direct fetch() calls in ProjectContext
```typescript
// Lines 85-108: Direct REST API call with manual PostgREST syntax
const response = await fetch(
  `${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=*`,
  {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
)
```

#### Target Architecture:
```typescript
// src/lib/SupabaseRestClient.ts
export class SupabaseRestClient {
  constructor(
    private supabaseUrl: string,
    private anonKey: string,
    private getAccessToken: () => string | null
  ) {}

  async query<T>(table: string, options: QueryOptions): Promise<T[]>
  async queryOne<T>(table: string, filter: Record<string, any>): Promise<T | null>
  async insert<T>(table: string, data: Partial<T>): Promise<T>
  async update<T>(table: string, filter: Record<string, any>, data: Partial<T>): Promise<T>
  async delete(table: string, filter: Record<string, any>): Promise<void>

  private buildUrl(table: string, options: QueryOptions): string
  private buildHeaders(): HeadersInit
  private async handleResponse<T>(response: Response): Promise<T>
}

// Usage in ProjectContext
const restClient = new SupabaseRestClient(
  supabaseUrl,
  supabaseAnonKey,
  () => getTokenFromLocalStorage()
)

const project = await restClient.queryOne<Project>('projects', { id: projectId })
```

#### Agent Prompt:
```
You are a backend-architect. Create SupabaseRestClient abstraction for direct REST API calls.

TASK: Abstract direct REST API pattern into type-safe client

FILES:
- CREATE: src/lib/SupabaseRestClient.ts
- CREATE: src/lib/__tests__/SupabaseRestClient.test.ts
- UPDATE: src/contexts/ProjectContext.tsx (use SupabaseRestClient)
- UPDATE: src/contexts/UserContext.tsx (expose SupabaseRestClient via context)

ARCHITECTURE:
1. SupabaseRestClient class with full CRUD operations:
   - query<T>(table, options) → T[]
   - queryOne<T>(table, filter) → T | null
   - insert<T>(table, data) → T
   - update<T>(table, filter, data) → T
   - delete(table, filter) → void

2. PostgREST query building:
   - Support filter operators: eq, neq, gt, lt, in, is, like
   - Support select with nested relations
   - Support order, limit, offset
   - URL encode properly

3. Error handling:
   - Parse PostgREST error responses
   - Handle 401 (token expired)
   - Handle 404 (not found)
   - Handle timeout

4. Type safety:
   - Generic types for all operations
   - Type-safe filter building
   - Return types match table types

CRITICAL REQUIREMENTS:
- Preserve exact same behavior as current direct fetch()
- Must work with localStorage token approach
- Must handle PostgREST array responses (queryOne returns first element)
- Must include timeout handling

VALIDATION:
- npm run test:run → MUST pass
- Type check with strict mode
- Manual: Project refresh → Project loads in <200ms
- Manual: Ideas query → Should work once integrated
- Commit: "feat: add SupabaseRestClient abstraction"

DELIVERABLE: Type-safe REST client, ProjectContext refactored, tests passing
```

#### Success Criteria:
- [ ] SupabaseRestClient created with tests
- [ ] ProjectContext uses SupabaseRestClient
- [ ] Type safety enforced
- [ ] Project refresh still works (192ms)
- [ ] All tests pass
- [ ] Manual validation: Project loads correctly
- [ ] Git commit created

---

## 📋 PHASE 3: Authentication Service Extraction (Week 3)
**Goal**: Break up God hook into testable services
**Risk**: HIGH
**Value**: VERY HIGH (major architecture improvement)

---

### **STEP 3.1: Extract SessionManager**
**Priority**: CRITICAL
**Effort**: 12 hours
**Risk**: HIGH
**Agent**: `system-architect`

#### Why This?
- Isolates session management logic
- Makes localStorage fallback testable
- Reduces useAuth complexity by 30%
- Critical for maintainability

#### Current: Session logic scattered in useAuth
```typescript
// Lines 624-756: initAuth() - 132 lines
// Handles: getSession(), timeout, localStorage fallback, authenticated client creation
```

#### Target Architecture:
```typescript
// src/services/SessionManager.ts
export class SessionManager {
  constructor(
    private supabaseClient: SupabaseClient,
    private options: SessionManagerOptions
  ) {}

  async initializeSession(): Promise<SessionResult>
  async refreshSession(): Promise<Session>
  createAuthenticatedClient(token: string): SupabaseClient

  private async getSessionWithTimeout(): Promise<Session | null>
  private async getSessionFromLocalStorage(): Promise<Session | null>
  private async propagateSession(session: Session): Promise<void>
}

// src/hooks/useAuth.ts (simplified)
const sessionManager = new SessionManager(supabase, { timeout: 2000 })
const sessionResult = await sessionManager.initializeSession()
```

#### Agent Prompt:
```
You are a system-architect. Extract SessionManager from useAuth hook.

TASK: Create SessionManager to handle all session operations including localStorage fallback

FILES:
- CREATE: src/services/SessionManager.ts
- CREATE: src/services/__tests__/SessionManager.test.ts
- UPDATE: src/hooks/useAuth.ts (replace initAuth logic with SessionManager)
- UPDATE: src/lib/supabase.ts (integrate createAuthenticatedClientFromLocalStorage)

ARCHITECTURE:
1. SessionManager class managing:
   - Session initialization with timeout
   - localStorage fallback mechanism
   - Authenticated client creation
   - Session propagation (150ms delay)

2. SessionResult type:
   - success: boolean
   - session: Session | null
   - user: User | null
   - authenticatedClient: SupabaseClient | null
   - method: 'supabase' | 'localStorage'

3. Methods:
   - initializeSession() → SessionResult
     - Try getSession() with timeout
     - Fall back to localStorage
     - Create authenticated client if needed
   - refreshSession() → Session
   - createAuthenticatedClient(token) → SupabaseClient

CRITICAL BEHAVIOR TO PRESERVE:
- getSession() timeout after 2 seconds
- localStorage fallback on timeout
- Create authenticated client from localStorage tokens
- 150ms session propagation delay
- Verify session propagation with second getSession() call
- Set authenticatedClientRef for ProjectContext

TESTING REQUIREMENTS:
- Mock Supabase client
- Test successful session initialization
- Test timeout → localStorage fallback
- Test authenticated client creation
- Test session propagation
- Integration test with useAuth

VALIDATION:
- npm run test:run → ALL tests pass
- npm run type-check → MUST pass
- Manual: Fresh login → Works
- Manual: Project URL refresh → Works (CRITICAL)
- Manual: Token in localStorage → Fallback works
- Commit: "feat: extract SessionManager service"

DELIVERABLE: SessionManager service, useAuth simplified, all auth flows working
```

#### Success Criteria:
- [ ] SessionManager created with comprehensive tests
- [ ] useAuth.ts uses SessionManager for all session operations
- [ ] localStorage fallback still works
- [ ] Project refresh still works (CRITICAL)
- [ ] All tests pass (including SessionManager tests)
- [ ] Type safety maintained
- [ ] Manual validation: All auth scenarios work
- [ ] Git commit created

---

### **STEP 3.2: Extract AuthenticationService**
**Priority**: HIGH
**Effort**: 12 hours
**Risk**: HIGH
**Agent**: `system-architect`

#### Why This?
- Final consolidation of auth logic
- useAuth becomes thin orchestration layer
- Testable business logic
- Achieves target architecture

#### Current: Auth logic in useAuth
```typescript
// Lines 344-473: handleAuthUser() - 129 lines
// Lines 475-528: handleAuthSuccess() - 53 lines
// Lines 536-598: handleLogout() - 62 lines
```

#### Target Architecture:
```typescript
// src/services/AuthenticationService.ts
export class AuthenticationService {
  constructor(
    private sessionManager: SessionManager,
    private profileService: ProfileService,
    private options: AuthServiceOptions
  ) {}

  async initialize(): Promise<AuthState>
  async handleAuthUser(authUser: AuthUser): Promise<User>
  async login(authUser: AuthUser): Promise<User>
  async logout(): Promise<void>

  private async handleDemoUser(authUser: AuthUser): Promise<User>
  private async handleRealUser(authUser: AuthUser): Promise<User>
  private async clearCaches(): Promise<void>
}

// src/hooks/useAuth.ts (final simplified version ~100 lines)
const authService = new AuthenticationService(sessionManager, profileService, options)

useEffect(() => {
  const initAuth = async () => {
    const authState = await authService.initialize()
    if (authState.user) {
      setCurrentUser(authState.user)
      setAuthUser(authState.authUser)
    }
    setIsLoading(false)
  }
  initAuth()
}, [])
```

#### Agent Prompt:
```
You are a system-architect. Extract AuthenticationService as final auth consolidation.

TASK: Create AuthenticationService orchestrating SessionManager and ProfileService

FILES:
- CREATE: src/services/AuthenticationService.ts
- CREATE: src/services/__tests__/AuthenticationService.test.ts
- UPDATE: src/hooks/useAuth.ts (reduce to ~100 lines, orchestration only)

ARCHITECTURE:
1. AuthenticationService class:
   - Dependencies: SessionManager, ProfileService, CacheManager
   - Methods:
     - initialize() → AuthState
     - handleAuthUser(authUser) → User
     - login(authUser) → User
     - logout() → void
     - clearCaches() → void

2. Auth flow consolidation:
   - Demo user handling
   - Real user profile fetching
   - Parallel project check coordination
   - Cache clearing on login/logout
   - Server-side cache clearing API call

3. useAuth hook becomes thin layer:
   - React state management only
   - Service orchestration
   - Auth listener setup
   - ~100 lines total

CRITICAL BEHAVIOR TO PRESERVE:
- Demo user detection and handling
- Parallel profile fetch + project check
- Generous timeouts (10s)
- Fallback user creation on errors
- Cache clearing on auth events
- Server-side cache clearing
- Auth state change listener

TESTING STRATEGY:
- Unit tests for AuthenticationService
- Mock SessionManager and ProfileService
- Test all auth flows (demo, real, error)
- Integration test with useAuth hook
- E2E test with actual Supabase

VALIDATION:
- npm run test:run → ALL tests pass
- npm run type-check → MUST pass
- Manual: Demo user login → Works
- Manual: Real user login → Works
- Manual: Project refresh → Works (CRITICAL)
- Manual: Logout → Caches cleared
- Manual: Login again → Fresh state
- Commit: "feat: extract AuthenticationService"

DELIVERABLE: AuthenticationService created, useAuth reduced to ~100 lines, all tests passing
```

#### Success Criteria:
- [ ] AuthenticationService created with tests
- [ ] useAuth.ts reduced from 817 to ~100 lines
- [ ] All auth flows work (demo, real, fallback)
- [ ] Project refresh still works (CRITICAL)
- [ ] Caching behavior preserved
- [ ] All tests pass
- [ ] Manual validation: Complete auth journey works
- [ ] Git commit created

---

### **STEP 3.3: Final Integration & Validation**
**Priority**: CRITICAL
**Effort**: 8 hours
**Risk**: MEDIUM
**Agent**: `quality-engineer`

#### Final Validation Checklist

##### Unit Tests
```bash
npm run test:run
# Expected: ALL tests pass (0 failures)
```

##### Type Safety
```bash
npm run type-check
# Expected: 0 errors
```

##### Build
```bash
npm run build
# Expected: Build succeeds, no errors
```

##### Lint
```bash
npm run lint
# Expected: 0 warnings, 0 errors
```

##### E2E Tests
```bash
npm run e2e:auth
# Expected: All auth journey tests pass
```

##### Manual Testing
1. **Fresh Login**
   - [ ] Navigate to app
   - [ ] Login with email/password
   - [ ] Profile loads correctly
   - [ ] Projects list displays
   - [ ] No console errors

2. **Project URL Refresh (CRITICAL)**
   - [ ] Login
   - [ ] Navigate to project
   - [ ] Copy URL with project ID
   - [ ] Refresh page
   - [ ] **Project loads in <200ms** ✅
   - [ ] Matrix displays
   - [ ] No console errors

3. **Demo User**
   - [ ] Select demo user
   - [ ] Demo project loads
   - [ ] Matrix displays
   - [ ] No console errors

4. **Logout/Login Cycle**
   - [ ] Login
   - [ ] Logout
   - [ ] Login again
   - [ ] Fresh state (no stale cache)
   - [ ] No console errors

5. **Token Refresh**
   - [ ] Login
   - [ ] Wait for token to expire (or force expire)
   - [ ] Make authenticated request
   - [ ] Token auto-refreshes
   - [ ] Request succeeds

##### Performance Validation
- [ ] Project refresh: <200ms (current: 192ms)
- [ ] Login: <2s
- [ ] Profile fetch: <1s (cached: <10ms)

##### Agent Prompt for Final Validation:
```
You are a quality-engineer. Perform comprehensive validation of refactored codebase.

TASK: Validate ALL functionality works after refactoring

VALIDATION STEPS:
1. Run all automated tests
2. Perform manual testing checklist
3. Verify performance metrics
4. Review code quality metrics
5. Document any issues found

CRITICAL CHECKS:
- Project URL refresh works (MUST be <200ms)
- All auth flows work (login, logout, demo, token refresh)
- No console errors in production
- No memory leaks
- Type safety maintained

DELIVERABLES:
1. Validation report with:
   - Test results (all suites)
   - Manual testing results (checklist)
   - Performance metrics comparison
   - Code quality metrics
   - Any issues found with severity

2. If any issues found:
   - Create bug report
   - Suggest rollback if critical
   - Provide fix recommendations

3. Final sign-off:
   - ✅ or ❌ for production readiness
   - Risk assessment
   - Recommendations

Create comprehensive validation report in claudedocs/REFACTORING_VALIDATION_REPORT.md
```

---

## 📊 Success Metrics

### Code Quality Metrics

| Metric | Before | Target | Measured |
|--------|--------|--------|----------|
| **useAuth.ts lines** | 817 | <150 | _TBD_ |
| **Console statements** | 130+ | <20 | _TBD_ |
| **Cache implementations** | 3 | 1 | _TBD_ |
| **Timeout patterns** | 6+ | 1 | _TBD_ |
| **Hardcoded constants** | 10+ | 0 | _TBD_ |
| **Cyclomatic complexity** | ~35 | <15 | _TBD_ |
| **Technical debt ratio** | 25% | <15% | _TBD_ |

### Functionality Metrics

| Test | Before | After | Status |
|------|--------|-------|--------|
| **Unit tests passing** | ✅ | ✅ | _TBD_ |
| **Type check** | ✅ | ✅ | _TBD_ |
| **Build succeeds** | ✅ | ✅ | _TBD_ |
| **Login works** | ✅ | ✅ | _TBD_ |
| **Project refresh** | ✅ 192ms | ✅ <200ms | _TBD_ |
| **Demo user** | ✅ | ✅ | _TBD_ |
| **Token refresh** | ✅ | ✅ | _TBD_ |
| **Logout** | ✅ | ✅ | _TBD_ |

### Performance Metrics

| Operation | Before | Target | Measured |
|-----------|--------|--------|----------|
| **Project refresh** | 192ms | <200ms | _TBD_ |
| **Login (first time)** | ~2s | <2s | _TBD_ |
| **Login (cached)** | ~500ms | <500ms | _TBD_ |
| **Profile fetch** | ~300ms | <1s | _TBD_ |
| **Profile fetch (cached)** | ~5ms | <10ms | _TBD_ |

---

## 🚨 Rollback Plan

### If ANY Step Fails:

1. **Immediate Rollback**:
```bash
# Rollback last commit
git reset --hard HEAD~1

# Or full rollback to start
git checkout backup/pre-refactoring
git checkout -b main-rollback
git push origin main-rollback --force
```

2. **Identify Issue**:
   - Review commit diff
   - Check test failures
   - Review console errors
   - Check performance metrics

3. **Decision Tree**:
   - **Minor issue** (tests fail, easy fix) → Fix and retry
   - **Major issue** (functionality broken) → Rollback, reassess
   - **Critical issue** (project refresh broken) → IMMEDIATE ROLLBACK

4. **Document**:
   - Add to `claudedocs/REFACTORING_ISSUES.md`
   - Note what failed
   - Note rollback commit
   - Plan remediation

---

## 📝 Documentation Updates

After each phase, update:

1. **Architecture Docs**
   - `claudedocs/ARCHITECTURE.md` - Service layer documentation
   - `claudedocs/AUTH_FLOW.md` - Updated auth flow diagrams

2. **Developer Docs**
   - `README.md` - Updated setup instructions if needed
   - Code comments - JSDoc on all new services

3. **Refactoring Log**
   - `claudedocs/REFACTORING_LOG.md` - Track all changes, metrics

---

## 🎯 Final Checklist

### Phase 1 Complete
- [ ] Diagnostic logging cleaned
- [ ] Constants extracted
- [ ] Timeout utility created
- [ ] All tests passing
- [ ] Git commits created
- [ ] Documentation updated

### Phase 2 Complete
- [ ] CacheManager extracted
- [ ] ProfileService extracted
- [ ] SupabaseRestClient created
- [ ] All tests passing
- [ ] Git commits created
- [ ] Documentation updated

### Phase 3 Complete
- [ ] SessionManager extracted
- [ ] AuthenticationService extracted
- [ ] useAuth reduced to ~100 lines
- [ ] All tests passing
- [ ] Final validation complete
- [ ] Git commits created
- [ ] Documentation updated

### Production Ready
- [ ] All automated tests pass
- [ ] All manual tests pass
- [ ] Performance metrics met
- [ ] No console errors
- [ ] Code review complete
- [ ] Documentation complete
- [ ] Backup branch created
- [ ] Rollback plan documented
- [ ] ✅ **APPROVED FOR MERGE**

---

## 📞 Emergency Contacts

If critical issues arise:

1. **Code Owner**: Check git blame for recent changes
2. **Documentation**: See `claudedocs/PROJECT_REFRESH_FIX_COMPLETE.md`
3. **Rollback**: See "Rollback Plan" section above
4. **Last Known Good**: `backup/pre-refactoring` branch

---

**END OF PLAN**

**Remember**: Any functionality break = immediate rollback. Project refresh MUST work.
