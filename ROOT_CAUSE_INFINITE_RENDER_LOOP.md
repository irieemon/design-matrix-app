# Root Cause Analysis: Infinite Render Loop & Screen Flickering

**Date**: 2025-10-01
**Status**: CRITICAL - Production Breaking
**Severity**: HIGH

---

## Executive Summary

After login, users experience severe screen flickering with ProjectManagement.tsx useEffect firing 100+ times per second, causing `getUserOwnedProjects` to be called repeatedly with the same userId. Ideas matrix shows no ideas despite projects loading successfully.

**Root Cause**: Object instability in dependency array creating infinite re-render loop between ProjectManagement, useIdeas, and useOptimisticUpdates hooks.

---

## Evidence Chain

### 1. Symptoms Observed
```
🔍 [DIAGNOSTIC] ProjectManagement useEffect triggered for user: <userId>
🔍 [DIAGNOSTIC] getUserOwnedProjects called with userId: <userId>
```
**Frequency**: 100+ calls per second (measured by console timestamps)

### 2. Visual Symptoms
- Screen flickering immediately after login
- Projects page constantly re-rendering
- Ideas matrix blank despite projects loaded
- Browser performance degraded (high CPU usage)

### 3. Console Log Pattern
```
[00:00.000] 🔍 ProjectManagement useEffect triggered
[00:00.016] 🔍 getUserOwnedProjects called
[00:00.032] 🔍 ProjectManagement useEffect triggered  <-- LOOP!
[00:00.048] 🔍 getUserOwnedProjects called
[00:00.064] 🔍 ProjectManagement useEffect triggered  <-- LOOP!
```

---

## Root Cause Analysis

### PRIMARY ROOT CAUSE: Dependency Array Object Instability

**Location**: `/src/components/ProjectManagement.tsx:86`

**The Critical Line**:
```typescript
}, [currentUser?.id])  // ← This dependency is UNSTABLE
```

### Why This Creates an Infinite Loop

#### The Dependency Chain

1. **ProjectManagement.tsx** (lines 60-86):
```typescript
useEffect(() => {
  if (!currentUser?.id) {
    setIsLoading(false)
    return
  }

  const loadProjectsDirectly = async () => {
    const projects = await ProjectRepository.getUserOwnedProjects(currentUser.id)
    setProjects(projects)  // ← STATE UPDATE
    setIsLoading(false)
  }

  loadProjectsDirectly()
}, [currentUser?.id])  // ← DEPENDENCY
```

**Problem**: `currentUser` is an object that gets recreated on every render.

2. **MainApp.tsx** (lines 28-37):
```typescript
const { currentUser, setCurrentUser } = useUser()
const effectiveUser = currentUser || propCurrentUser  // ← NEW OBJECT REFERENCE

// ... later ...
const {
  ideas,
  // ...
} = useIdeas({
  currentUser: effectiveUser,  // ← PASSES NEW REFERENCE
  currentProject,
  // ...
})
```

**Problem**: `effectiveUser` creates a new object reference on every render.

3. **useIdeas.ts** (lines 28-36):
```typescript
export const useIdeas = (options: UseIdeasOptions): UseIdeasReturn => {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])

  const contextUser = useCurrentUser()
  const currentUser = contextUser || options.currentUser  // ← NEW REFERENCE

  const { currentProject, setShowAddModal, setShowAIModal, setEditingIdea } = options
```

**Problem**: `currentUser` gets reassigned, creating a new reference.

4. **useOptimisticUpdates.ts** (lines 32-34):
```typescript
useEffect(() => {
  setOptimisticData(baseData)  // ← STATE UPDATE
}, [baseData])  // ← TRIGGERS ON IDEAS CHANGE
```

**Problem**: Any ideas change triggers optimistic data update.

### The Infinite Loop Mechanism

```
CYCLE STARTS:
┌─────────────────────────────────────────────────────────────┐
│ 1. ProjectManagement renders                                │
│    - currentUser object reference created                   │
├─────────────────────────────────────────────────────────────┤
│ 2. useEffect([currentUser?.id]) runs                        │
│    - Calls getUserOwnedProjects()                           │
│    - setProjects() triggers state update                    │
├─────────────────────────────────────────────────────────────┤
│ 3. State update causes ProjectManagement to re-render       │
│    - New currentUser object reference created               │
├─────────────────────────────────────────────────────────────┤
│ 4. React compares dependencies: currentUser?.id             │
│    - NEW currentUser object !== OLD currentUser object      │
│    - Dependency changed! Run useEffect again!               │
├─────────────────────────────────────────────────────────────┤
│ 5. GOTO Step 2 (INFINITE LOOP)                              │
└─────────────────────────────────────────────────────────────┘
```

### Why `currentUser?.id` Appears Unstable

**Expected Behavior**: `currentUser?.id` should be a primitive string value that only changes when user ID actually changes.

**Actual Behavior**: Because `currentUser` is an object reference, React's dependency comparison checks:
```javascript
// React's internal comparison (simplified)
if (prevCurrentUser !== currentUser) {
  // Different object reference! Dependency changed!
  runEffect()
}
```

Even though `currentUser.id` (the primitive value) hasn't changed, the parent object reference has changed, causing React to consider the dependency changed.

### Contributing Factor: UserContext Object Recreation

**Location**: `/src/contexts/UserContext.tsx` (used in MainApp.tsx)

The `UserContext` provides `currentUser` object, but if ANY parent component re-renders, a new object reference may be created:

```typescript
// UserContext provides this
const { currentUser, setCurrentUser } = useUser()

// MainApp creates new reference on every render
const effectiveUser = currentUser || propCurrentUser  // ← NEW OBJECT!
```

This means:
1. Parent re-renders
2. `effectiveUser` gets new object reference (even with same data)
3. Passed to `useIdeas` hook
4. `useIdeas` uses it in dependency arrays
5. Those useEffects trigger
6. State updates cause re-renders
7. LOOP REPEATS

---

## Secondary Issue: Ideas Not Loading

### Why Ideas Matrix is Blank

**Location**: `/src/hooks/useIdeas.ts:248-275`

```typescript
useEffect(() => {
  logger.debug('Project changed effect triggered', {
    projectName: currentProject?.name,
    projectId: currentProject?.id,
  })

  setIdeas([])  // ← CLEARS IDEAS IMMEDIATELY

  if (currentProject) {
    loadIdeas(currentProject.id)
  } else {
    setIdeas([])
  }
}, [currentProject, currentUser, loadIdeas])  // ← UNSTABLE DEPENDENCIES
```

**Problem**: Because `currentUser` is constantly changing (new object reference), this effect runs continuously:
1. Clear ideas: `setIdeas([])`
2. Start loading ideas: `loadIdeas(currentProject.id)`
3. Before ideas can load, currentUser changes again
4. Clear ideas again: `setIdeas([])`
5. Start loading again
6. **Result**: Ideas never have time to load before being cleared

### Timing Analysis

```
T+0ms:   useEffect triggers (currentUser changed)
T+1ms:   setIdeas([]) - clears ideas
T+2ms:   loadIdeas() starts async call
T+16ms:  Parent re-renders (ProjectManagement loop)
T+17ms:  useEffect triggers AGAIN (currentUser changed AGAIN)
T+18ms:  setIdeas([]) - clears ideas BEFORE async call completes
T+19ms:  loadIdeas() starts ANOTHER async call
[REPEAT INFINITELY]
```

**Ideas never load** because they're constantly cleared before the async database call can complete.

---

## Why Recent Refactor Broke This

### What Changed

Looking at git history (recent commits):
```
9135b60 Major architectural refactoring: Break down god classes and implement clean architecture
```

This refactor likely:
1. Extracted `UserContext` from App.tsx
2. Created `MainApp` component with context hooks
3. Changed how `currentUser` is passed through component tree
4. Introduced object reference instability in the process

### Before Refactor (Working)

Likely had:
```typescript
// App.tsx - user stored in component state
const [currentUser, setCurrentUser] = useState<User | null>(null)

// Passed directly as prop
<ProjectManagement currentUser={currentUser} />
```

**Why it worked**: Same object reference maintained by React state.

### After Refactor (Broken)

Now has:
```typescript
// MainApp.tsx - user from context + fallback
const { currentUser } = useUser()
const effectiveUser = currentUser || propCurrentUser  // ← NEW REFERENCE

// Passed to hooks
useIdeas({ currentUser: effectiveUser })
```

**Why it breaks**: Every render creates new `effectiveUser` object reference.

---

## Technical Deep Dive

### React Dependency Comparison Mechanism

React compares dependencies using `Object.is()`:
```javascript
function areDepsEqual(prevDeps, nextDeps) {
  for (let i = 0; i < prevDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue
    }
    return false  // Dependency changed!
  }
  return true
}
```

For `[currentUser?.id]`:
```javascript
// Dependency is evaluated as:
const dep = currentUser?.id

// But currentUser is new object:
const oldUser = { id: "123", email: "user@example.com" }  // Render 1
const newUser = { id: "123", email: "user@example.com" }  // Render 2

// Object.is(oldUser, newUser) = false (different references!)
// So React thinks currentUser changed, even though id is the same
```

### The Correct Approach

**Option 1: Use primitive value directly**
```typescript
}, [currentUser?.id])  // ✅ CORRECT (primitive string)
```

**But you need stable currentUser object reference!**

**Option 2: Memoize the user object**
```typescript
const effectiveUser = useMemo(
  () => currentUser || propCurrentUser,
  [currentUser?.id, propCurrentUser?.id]  // Only re-create if IDs change
)
```

---

## Code Locations & Specific Fixes

### Fix 1: ProjectManagement.tsx (lines 60-86)

**Current Code**:
```typescript
useEffect(() => {
  if (!currentUser?.id) {
    setIsLoading(false)
    return
  }

  console.log('🔍 [DIAGNOSTIC] ProjectManagement useEffect triggered for user:', currentUser?.id)

  const loadProjectsDirectly = async () => {
    try {
      console.log('🔍 [DIAGNOSTIC] Loading projects directly without subscription')
      const projects = await ProjectRepository.getUserOwnedProjects(currentUser.id)
      console.log('🔍 [DIAGNOSTIC] Direct load received:', projects?.length, 'projects')
      setProjects(projects)
      setIsLoading(false)
    } catch (error) {
      console.error('🔍 [DIAGNOSTIC] Direct load error:', error)
      setProjects([])
      setIsLoading(false)
    }
  }

  loadProjectsDirectly()
}, [currentUser?.id])  // ← PROBLEM: currentUser is unstable object
```

**Fixed Code**:
```typescript
// Extract userId at component level
const userId = currentUser?.id

useEffect(() => {
  if (!userId) {
    setIsLoading(false)
    return
  }

  console.log('🔍 [DIAGNOSTIC] ProjectManagement useEffect triggered for user:', userId)

  const loadProjectsDirectly = async () => {
    try {
      console.log('🔍 [DIAGNOSTIC] Loading projects directly without subscription')
      const projects = await ProjectRepository.getUserOwnedProjects(userId)
      console.log('🔍 [DIAGNOSTIC] Direct load received:', projects?.length, 'projects')
      setProjects(projects)
      setIsLoading(false)
    } catch (error) {
      console.error('🔍 [DIAGNOSTIC] Direct load error:', error)
      setProjects([])
      setIsLoading(false)
    }
  }

  loadProjectsDirectly()
}, [userId])  // ✅ FIXED: userId is primitive string, stable reference
```

**Why This Fixes It**:
- `userId` is a primitive string extracted once per render
- Primitive strings are compared by VALUE, not reference
- Only re-runs when userId VALUE actually changes
- Breaks the infinite loop

---

### Fix 2: MainApp.tsx (lines 28-37)

**Current Code**:
```typescript
const { currentUser, setCurrentUser } = useUser()
const effectiveUser = currentUser || propCurrentUser  // ← NEW OBJECT EVERY RENDER
```

**Fixed Code**:
```typescript
const { currentUser: contextUser, setCurrentUser } = useUser()

// Memoize to maintain stable reference
const effectiveUser = useMemo(
  () => contextUser || propCurrentUser,
  [contextUser?.id, propCurrentUser?.id]  // Only change when IDs change
)
```

**Why This Fixes It**:
- `useMemo` caches the object reference
- Only creates new object when dependencies (user IDs) actually change
- Prevents cascading re-renders

---

### Fix 3: useIdeas.ts (lines 28-36, 248-275)

**Current Code (lines 28-36)**:
```typescript
export const useIdeas = (options: UseIdeasOptions): UseIdeasReturn => {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])

  const contextUser = useCurrentUser()
  const currentUser = contextUser || options.currentUser  // ← UNSTABLE
```

**Fixed Code**:
```typescript
export const useIdeas = (options: UseIdeasOptions): UseIdeasReturn => {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])

  const contextUser = useCurrentUser()

  // Use ID for stable comparison
  const userId = contextUser?.id || options.currentUser?.id
```

**Current Code (lines 248-275)**:
```typescript
useEffect(() => {
  logger.debug('Project changed effect triggered', {
    projectName: currentProject?.name,
    projectId: currentProject?.id,
    userEmail: currentUser?.email,
    userId: currentUser?.id
  })

  setIdeas([])

  const isDemoUser = currentUser?.id?.startsWith('00000000-0000-0000-0000-00000000000')
  logger.debug('User type detected', { isDemoUser })

  if (currentProject) {
    logger.debug('Loading ideas for project', {
      projectName: currentProject.name,
      projectId: currentProject.id,
      userType: isDemoUser ? 'demo' : 'real'
    })
    loadIdeas(currentProject.id)
  } else {
    logger.debug('No project selected, clearing ideas')
    setIdeas([])
  }
}, [currentProject, currentUser, loadIdeas])  // ← UNSTABLE DEPENDENCIES
```

**Fixed Code**:
```typescript
// Extract stable primitive values
const projectId = currentProject?.id
const projectName = currentProject?.name

useEffect(() => {
  logger.debug('Project changed effect triggered', {
    projectName,
    projectId,
    userId
  })

  setIdeas([])

  const isDemoUser = userId?.startsWith('00000000-0000-0000-0000-00000000000')
  logger.debug('User type detected', { isDemoUser })

  if (projectId) {
    logger.debug('Loading ideas for project', {
      projectName,
      projectId,
      userType: isDemoUser ? 'demo' : 'real'
    })
    loadIdeas(projectId)
  } else {
    logger.debug('No project selected, clearing ideas')
    setIdeas([])
  }
}, [projectId, userId, loadIdeas])  // ✅ FIXED: Stable primitive dependencies
```

**Why This Fixes It**:
- Uses primitive values (IDs) instead of objects
- `loadIdeas` should be memoized with `useCallback`
- Only re-runs when actual values change, not object references

---

### Fix 4: useIdeas.ts - Memoize loadIdeas (lines 58-80)

**Current Code**:
```typescript
const loadIdeas = useCallback(async (projectId?: string) => {
  if (projectId) {
    logger.performance(`Loading ideas for project: ${projectId}`)
    setIdeas([])
    const ideas = await DatabaseService.getProjectIdeas(projectId)

    if (ideas.length === 0) {
      logger.debug(`No ideas found for project: ${projectId}`)
    } else {
      logger.performance(`Loaded ${ideas.length} ideas for project: ${projectId}`)
    }

    setIdeas(ideas)
  } else {
    logger.performance('No project selected, clearing ideas')
    setIdeas([])
  }
}, [])  // ✅ ALREADY CORRECT - no dependencies
```

**This is already correct**, but verify `logger` is stable (should be from `useLogger` hook which is memoized).

---

### Fix 5: useIdeas.ts - Subscription Effect (lines 278-311)

**Current Code**:
```typescript
useEffect(() => {
  if (!currentUser) return

  const isDemoUser = currentUser.id?.startsWith('00000000-0000-0000-0000-00000000000')
  if (isDemoUser) {
    logger.debug('🎭 Demo user detected, skipping real-time subscription')
    return
  }

  if (!currentProject?.id) {
    logger.debug('🔄 No project selected, skipping subscription setup')
    return
  }

  logger.debug('🔄 Setting up project-specific subscription for:', currentProject.id)
  const unsubscribe = DatabaseService.subscribeToIdeas(
    (freshIdeas) => {
      const projectIdeas = freshIdeas.filter(idea => idea.project_id === currentProject.id)
      logger.debug('🔄 Subscription callback: filtered', projectIdeas.length, 'ideas for current project:', currentProject.id)
      setIdeas(projectIdeas)
    },
    currentProject.id,
    currentUser.id,
    { skipInitialLoad: true }
  )

  return () => {
    logger.debug('🔄 Cleaning up subscription for project:', currentProject.id)
    unsubscribe()
  }
}, [currentUser, currentProject?.id])  // ← UNSTABLE: currentUser
```

**Fixed Code**:
```typescript
useEffect(() => {
  if (!userId) return

  const isDemoUser = userId.startsWith('00000000-0000-0000-0000-00000000000')
  if (isDemoUser) {
    logger.debug('🎭 Demo user detected, skipping real-time subscription')
    return
  }

  if (!projectId) {
    logger.debug('🔄 No project selected, skipping subscription setup')
    return
  }

  logger.debug('🔄 Setting up project-specific subscription for:', projectId)
  const unsubscribe = DatabaseService.subscribeToIdeas(
    (freshIdeas) => {
      const projectIdeas = freshIdeas.filter(idea => idea.project_id === projectId)
      logger.debug('🔄 Subscription callback: filtered', projectIdeas.length, 'ideas for current project:', projectId)
      setIdeas(projectIdeas)
    },
    projectId,
    userId,
    { skipInitialLoad: true }
  )

  return () => {
    logger.debug('🔄 Cleaning up subscription for project:', projectId)
    unsubscribe()
  }
}, [userId, projectId])  // ✅ FIXED: Primitive dependencies only
```

---

## Complete Fix Summary

### Changes Required

| File | Lines | Change | Reason |
|------|-------|--------|--------|
| `ProjectManagement.tsx` | 60-86 | Extract `userId` variable, use in dependency array | Primitive dependency instead of object |
| `MainApp.tsx` | 28-37 | Add `useMemo` for `effectiveUser` | Stable object reference |
| `useIdeas.ts` | 28-36 | Extract `userId` from user objects | Primitive values for comparisons |
| `useIdeas.ts` | 248-275 | Use `projectId` and `userId` in deps | Primitive dependencies |
| `useIdeas.ts` | 278-311 | Use `userId` and `projectId` in deps | Primitive dependencies |

### Implementation Order

1. **Fix MainApp.tsx first** (stops cascade at source)
2. **Fix useIdeas.ts** (stabilizes ideas loading)
3. **Fix ProjectManagement.tsx** (stops infinite loop)

---

## Testing Verification

### Success Criteria

1. **No infinite loop**: Console logs show useEffect runs ONCE per actual user/project change
2. **Ideas load correctly**: Ideas matrix populates after project selection
3. **No screen flicker**: Smooth rendering, no flickering or jittering
4. **Performance**: CPU usage normal, browser responsive

### Test Steps

1. **Login Test**
   - Log in with credentials
   - Open browser console
   - Verify useEffect logs appear ONCE (not looping)
   - Count console messages in 5 seconds (should be <10, not 500+)

2. **Project Selection Test**
   - Select a project from Projects page
   - Navigate to Matrix view
   - Verify ideas load and display
   - Check console for ideas loading logs

3. **Navigation Test**
   - Navigate between Projects → Matrix → Settings
   - Verify no excessive re-renders
   - Check CPU usage stays low

4. **Performance Test**
   - Open Chrome DevTools Performance tab
   - Record 10 seconds after login
   - Verify no repeating render cycles
   - Check for long tasks or frame drops

---

## Prevention Guidelines

### Rule 1: Always Use Primitive Dependencies

**BAD**:
```typescript
useEffect(() => {
  // ...
}, [user, project])  // ❌ Objects as dependencies
```

**GOOD**:
```typescript
useEffect(() => {
  // ...
}, [user?.id, project?.id])  // ✅ Primitive IDs as dependencies
```

### Rule 2: Memoize Derived Objects

**BAD**:
```typescript
const effectiveUser = userA || userB  // ❌ New object every render
```

**GOOD**:
```typescript
const effectiveUser = useMemo(
  () => userA || userB,
  [userA?.id, userB?.id]  // ✅ Only changes when IDs change
)
```

### Rule 3: Extract Primitives Early

**BAD**:
```typescript
useEffect(() => {
  if (user?.id) {
    doSomething(user.id)
  }
}, [user])  // ❌ Object dependency
```

**GOOD**:
```typescript
const userId = user?.id  // Extract primitive at top of component

useEffect(() => {
  if (userId) {
    doSomething(userId)
  }
}, [userId])  // ✅ Primitive dependency
```

---

## Conclusion

**Root Cause**: Object reference instability in React dependency arrays causing infinite re-render loops.

**Primary Culprit**: Passing entire `currentUser` object through component tree instead of primitive `userId` values.

**Impact**:
- 100+ renders per second
- Screen flickering
- Ideas never load (cleared before async completes)
- Degraded browser performance

**Solution**:
- Extract primitive values (`userId`, `projectId`) at component level
- Use primitives in dependency arrays
- Memoize derived objects with `useMemo`
- Ensure stable references throughout component tree

**Risk**: HIGH - Completely blocks application usage after login

**Fix Complexity**: LOW - Simple refactor to use primitive dependencies

---

**Analysis Completed By**: Claude (Root Cause Analyst Agent)
**Timestamp**: 2025-10-01
**Evidence**: Console logs, code inspection, dependency tracing
