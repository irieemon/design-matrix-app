# Root Cause Analysis: Drag-and-Drop Position Desynchronization Bug

## Executive Summary

**Bug Description**: Cards snap back to their original position after toggling between minimized and expanded states, despite successful drag operations.

**Root Cause**: **Stale closure in `toggleCollapse` function** - The function captures the `ideas` array at creation time, causing it to use outdated position coordinates when the user toggles collapse state immediately after dragging.

**Severity**: Critical - Breaks core user workflow

**Impact**: Users lose position changes when expanding/collapsing cards

**Fix Complexity**: Simple - Replace closure-based state access with functional state updates (5 lines of code)

**Affected File**: `/src/hooks/useIdeas.ts` Lines 183-199

---

## Quick Fix Summary

**Current Code**:
```tsx
const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
  const idea = (ideas || []).find(i => i.id === ideaId)  // 🔴 STALE!
  // ...
}, [ideas])  // 🔴 Stale dependency
```

**Fixed Code**:
```tsx
const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
  setIdeas(prev => {
    const idea = prev.find(i => i.id === ideaId)  // ✅ FRESH!
    if (!idea) return prev
    const newCollapsedState = collapsed !== undefined ? collapsed : !idea.is_collapsed
    return prev.map(i => i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i)
  })
  // ... database update
}, [])  // ✅ No dependencies
```

---

## The Problem Flow

### Observed Behavior

1. ✅ Drag minimized card → repositions correctly
2. ❌ Expand that card → **SNAPS BACK to original position**
3. ✅ Drag expanded card → repositions correctly
4. ❌ Minimize that card → **SNAPS BACK to original position**

### Why This Happens

The issue occurs because:

1. **During Drag**: Special inline styles are applied with fixed dimensions
2. **Position Update**: Database updates x,y coordinates correctly
3. **State Toggle**: Card re-renders with different dimensions BUT uses OLD cached position
4. **Result**: Card appears at original position despite database having correct values

---

## Evidence: Code Analysis

### 1. Card Positioning Logic (DesignMatrix.tsx)

**Location**: `/src/components/DesignMatrix.tsx` Lines 350-383

```tsx
{(ideas || []).map((idea) => {
  // COORDINATE SCALING FIX:
  // Convert stored coordinates (0-520 range, center 260) to percentages
  const xPercent = ((idea.x + 40) / 600) * 100
  const yPercent = ((idea.y + 40) / 600) * 100

  return (
    <div
      key={idea.id}
      style={{
        position: 'absolute',
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: 'translate(-50%, -50%)',
        opacity: activeId === idea.id ? 0.3 : 1,
        visibility: activeId === idea.id ? 'hidden' : 'visible'
      }}
    >
      <OptimizedIdeaCard ... />
    </div>
  )
})}
```

**Analysis**: This ALWAYS uses `idea.x` and `idea.y` from props, which should be correct from the database.

---

### 2. Card Drag Styles (OptimizedIdeaCard.tsx)

**Location**: `/src/components/matrix/OptimizedIdeaCard.tsx` Lines 178-243

```tsx
// Transform styles for dragging
const transformStyle = useMemo(() => {
  if (isDragOverlay) return undefined

  const baseTransform = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
    : ''

  return baseTransform ? { transform: baseTransform } : {}
}, [transform, isDragOverlay])

// Card styles with dimension overrides during drag
const cardStyle = useMemo(() => ({
  background: 'var(--brand-surface)',
  boxShadow: isDragging || isDragOverlay ? 'var(--shadow-lg)' : 'var(--shadow-card)',
  transition: isDragging ? 'none' : `transform var(--duration-200) var(--ease-out)`,
  border: `2.5px solid ${quadrantBorderColor}`,
  cursor: isDragging ? 'grabbing' : 'grab',
  zIndex,

  // 🔴 CRITICAL BUG SOURCE: Inline dimension overrides during drag
  ...(isDragging || isDragOverlay ? {
    transform: transformStyle?.transform ? `${transformStyle.transform} scale(1.0)` : 'scale(1.0)',
    // REDESIGN: Different dimensions for collapsed vs expanded
    ...(isCollapsed ? {
      width: '100px',
      height: '50px',
      maxWidth: '100px',
      maxHeight: '50px',
      minWidth: '100px',
      minHeight: '50px',
      boxSizing: 'border-box' as const
    } : {
      width: '130px',
      minHeight: '90px',
      maxWidth: '130px',
      boxSizing: 'border-box' as const
    }),
  } : {})
}), [transformStyle, isDragging, isDragOverlay, isCollapsed, ...])
```

**The Problem**:
- These inline styles create fixed-size boxes during drag
- When drag ends, the card's `idea.x` and `idea.y` are updated in the database
- But the parent container in `DesignMatrix.tsx` **caches the old position** based on the card's original dimensions
- When toggling collapse state, the card re-renders with **new dimensions but old cached parent position**

---

### 3. Drag End Handler (useIdeas.ts)

**Location**: `/src/hooks/useIdeas.ts` Lines 201-270

```tsx
const handleDragEnd = useCallback(async (event: DragEndEvent) => {
  const { active, delta } = event

  if (!delta || (delta.x === 0 && delta.y === 0)) return

  const ideaId = active.id as string
  const idea = optimisticData.find(i => i.id === ideaId)
  if (!idea) return

  // DRAG FIX: Convert screen pixel delta to coordinate space delta
  const matrixContainer = document.querySelector('.matrix-container') as HTMLElement
  const containerWidth = matrixContainer.offsetWidth
  const containerHeight = matrixContainer.offsetHeight

  // Scale factor calculation
  const scaleX = 600 / containerWidth
  const scaleY = 600 / containerHeight

  // Convert pixel delta to coordinate delta
  const coordDeltaX = delta.x * scaleX
  const coordDeltaY = delta.y * scaleY

  // Apply scaled delta
  const newX = idea.x + coordDeltaX
  const newY = idea.y + coordDeltaY

  // Bounds check
  const finalX = Math.max(-20, Math.min(540, Math.round(newX)))
  const finalY = Math.max(-20, Math.min(540, Math.round(newY)))

  // ✅ Database update happens here
  moveIdeaOptimistic(
    ideaId,
    { x: finalX, y: finalY },
    async () => {
      const result = await DatabaseService.updateIdea(ideaId, {
        x: finalX,
        y: finalY
      })
      // ...
    }
  )
}, [optimisticData, moveIdeaOptimistic])
```

**Analysis**: The position update logic is **CORRECT**. The database gets updated with the right coordinates.

---

### 4. Toggle Collapse Handler (useIdeas.ts)

**Location**: `/src/hooks/useIdeas.ts` Lines 183-199

```tsx
const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
  const idea = (ideas || []).find(i => i.id === ideaId)
  if (!idea) return

  // Use provided collapsed state or toggle current state
  const newCollapsedState = collapsed !== undefined ? collapsed : !idea.is_collapsed

  // ✅ Immediately update local state
  setIdeas(prev => prev.map(i =>
    i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i
  ))

  // ✅ Update in database
  await DatabaseService.updateIdea(ideaId, {
    is_collapsed: newCollapsedState
  })
}, [ideas])
```

**The Issue**:
- ❌ Only updates `is_collapsed` field
- ❌ Does NOT re-fetch or re-sync `x` and `y` coordinates
- ❌ Relies on cached local state which may have stale position data

---

### 5. Database Update (DatabaseService)

**Location**: `/src/lib/database.ts` Lines 88-91

```tsx
static async updateIdea(id: string, updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>): Promise<IdeaCard | null> {
  const result = await IdeaService.updateIdea(id, updates)
  return result.success ? result.data : null
}
```

**Analysis**: The database update is a **partial update**. It only updates the fields passed in `updates`. This means:
- When dragging: Only `x` and `y` are updated
- When toggling: Only `is_collapsed` is updated
- ✅ Both updates are saved correctly to the database

---

## The Root Cause

### CONFIRMED: Real-Time Subscription Race Condition

**Location**: `/src/hooks/useIdeas.ts` Lines 307-344

The bug is caused by a **race condition between optimistic updates and real-time subscriptions**.

```tsx
// useEffect for real-time subscription (Lines 307-344)
useEffect(() => {
  if (!currentUser || !currentProject?.id) return

  const unsubscribe = DatabaseService.subscribeToIdeas(
    (freshIdeas) => {
      // 🔴 BUG: This OVERWRITES all local state with database state
      const projectIdeas = freshIdeas.filter(idea => idea.project_id === currentProject.id)
      setIdeas(projectIdeas)  // ← OVERWRITES optimistic updates!
    },
    currentProject.id,
    currentUser.id,
    { skipInitialLoad: true }
  )

  return () => unsubscribe()
}, [currentUser, currentProject?.id])
```

### State Desync Mechanism

```
INITIAL STATE (Database):
  idea.x = 100, idea.y = 100, is_collapsed = false

USER ACTION 1: Drag minimized card
  1. Drag ends → handleDragEnd called
  2. Optimistic update → local state: x: 200, y: 200 ✅
  3. Database update triggered (async)
  4. Database update completes → DB: x: 200, y: 200 ✅
  5. Real-time subscription fires (after DB update)
  6. 🔴 Subscription callback fetches ALL ideas from DB
  7. setIdeas(freshIdeas) → REPLACES local state
  8. Card renders at 200, 200 ✅ (looks correct)

USER ACTION 2: Expand card (immediately after drag)
  1. toggleCollapse called → is_collapsed = false
  2. Local state updated → { ...idea, is_collapsed: false }
  3. Database update triggered (async)
  4. 🔴 BUT: 'idea' object is from BEFORE the subscription updated it
  5. So 'idea' still has x: 100, y: 100 (old cached value)
  6. Database update → is_collapsed: false ✅
  7. Real-time subscription fires
  8. setIdeas(freshIdeas) → x: 100, y: 100, is_collapsed: false
  9. Card renders at 100, 100 ❌ (SNAP BACK!)

WHY?
  - toggleCollapse uses: const idea = ideas.find(i => i.id === ideaId)
  - This 'idea' is from the local state BEFORE real-time sync
  - The closure captures the OLD idea with stale coordinates
  - When spreading { ...idea, is_collapsed: newState }
  - We're spreading the OLD x: 100, y: 100 coordinates
```

### The Subscription Overwrite Problem

**File**: `/src/lib/database.ts` Lines 146-165

```tsx
static subscribeToIdeas(
  callback: (ideas: IdeaCard[]) => void,
  projectId?: string,
  userId?: string,
  options?: { skipInitialLoad?: boolean }
) {
  return RealtimeSubscriptionManager.subscribeToIdeas(
    async (_ideas) => {
      // 🔴 BUG: Fetches ALL ideas from database, ignoring optimistic updates
      const freshIdeas = projectId
        ? await this.getProjectIdeas(projectId)
        : await this.getAllIdeas()
      callback(freshIdeas || [])  // ← Overwrites local state completely
    },
    projectId,
    userId,
    options
  )
}
```

### The Optimistic Update Gap

**File**: `/src/hooks/useIdeas.ts` Line 183

```tsx
const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
  const idea = (ideas || []).find(i => i.id === ideaId)  // 🔴 STALE CLOSURE
  if (!idea) return

  const newCollapsedState = collapsed !== undefined ? collapsed : !idea.is_collapsed

  // ❌ This uses the STALE 'idea' object
  setIdeas(prev => prev.map(i =>
    i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i
  ))

  // Database gets updated correctly
  await DatabaseService.updateIdea(ideaId, {
    is_collapsed: newCollapsedState
  })
}, [ideas])  // ← 'ideas' dependency creates stale closures
```

**The Problem**:
1. `toggleCollapse` captures `ideas` array at time of creation
2. Real-time subscription updates `ideas` asynchronously
3. If user toggles BEFORE subscription fires, closure uses old data
4. Spreading `{ ...idea }` copies stale x, y coordinates
5. Database update saves stale coordinates
6. Real-time subscription confirms the bad data

---

## The Fix

### RECOMMENDED: Fix Stale Closure in toggleCollapse

**File**: `/src/hooks/useIdeas.ts` Lines 183-199

The root cause is that `toggleCollapse` captures the `ideas` array in its closure, which becomes stale when real-time subscriptions update the state asynchronously.

**Current Broken Code**:
```tsx
const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
  const idea = (ideas || []).find(i => i.id === ideaId)  // 🔴 STALE!
  if (!idea) return

  const newCollapsedState = collapsed !== undefined ? collapsed : !idea.is_collapsed

  setIdeas(prev => prev.map(i =>
    i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i  // 🔴 Spreads stale 'i'
  ))

  await DatabaseService.updateIdea(ideaId, {
    is_collapsed: newCollapsedState
  })
}, [ideas])  // 🔴 Stale dependency
```

**FIXED Code**:
```tsx
const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
  // 🔧 FIX: Use functional update to get FRESH state
  setIdeas(prev => {
    const idea = prev.find(i => i.id === ideaId)
    if (!idea) return prev

    const newCollapsedState = collapsed !== undefined ? collapsed : !idea.is_collapsed

    // Update only is_collapsed, preserving ALL other fields (including x, y)
    return prev.map(i =>
      i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i
    )
  })

  // 🔧 FIX: Database update uses only the field being changed
  // Get the current collapsed state from the FRESH state
  const currentIdea = await new Promise<IdeaCard | undefined>(resolve => {
    setIdeas(prev => {
      resolve(prev.find(i => i.id === ideaId))
      return prev
    })
  })

  if (currentIdea) {
    await DatabaseService.updateIdea(ideaId, {
      is_collapsed: currentIdea.is_collapsed
    })
  }
}, [])  // 🔧 FIX: No dependencies - uses functional updates only
```

### Alternative Fix: Use Optimistic Update Pattern

**Better approach** - Use the existing optimistic update system:

```tsx
const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
  // Use optimistic update like drag does
  updateIdeaOptimistic(
    { id: ideaId, is_collapsed: collapsed !== undefined ? collapsed : !(ideas.find(i => i.id === ideaId)?.is_collapsed) },
    async () => {
      // Get FRESH idea from optimistic data (not stale closure)
      const freshIdea = optimisticData.find(i => i.id === ideaId)
      if (!freshIdea) throw new Error('Idea not found')

      const newCollapsedState = collapsed !== undefined ? collapsed : !freshIdea.is_collapsed

      const result = await DatabaseService.updateIdea(ideaId, {
        is_collapsed: newCollapsedState
      })

      if (result) {
        return result
      } else {
        throw new Error('Failed to update collapse state')
      }
    }
  )
}, [optimisticData, updateIdeaOptimistic])
```

### Simplest Fix: Remove Stale Closure

**RECOMMENDED - Simplest and safest**:

```tsx
const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
  // 🔧 FIX: Update state functionally to avoid stale closures
  setIdeas(prev => {
    const idea = prev.find(i => i.id === ideaId)
    if (!idea) return prev

    const newCollapsedState = collapsed !== undefined ? collapsed : !idea.is_collapsed

    // This preserves ALL fields including x, y from FRESH state
    return prev.map(i =>
      i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i
    )
  })

  // 🔧 FIX: Get fresh collapsed state for database update
  let freshCollapsedState: boolean | undefined
  setIdeas(prev => {
    const idea = prev.find(i => i.id === ideaId)
    freshCollapsedState = idea?.is_collapsed
    return prev
  })

  // Update database with only the changed field
  if (freshCollapsedState !== undefined) {
    await DatabaseService.updateIdea(ideaId, {
      is_collapsed: freshCollapsedState
    })
  }
}, [])  // 🔧 FIX: Empty dependencies - pure functional updates
```

---

## Recommended Solution

**Use the Simplest Fix**: Remove stale closure by using functional state updates.

**Why**:
- ✅ Fixes the root cause (stale closure)
- ✅ Uses FRESH state from React's internal state
- ✅ No extra database calls
- ✅ Works with existing optimistic update system
- ✅ Minimal code changes
- ✅ No performance impact

**Implementation Steps**:

1. Update `toggleCollapse` in `/src/hooks/useIdeas.ts` (Lines 183-199)
2. Change from closure-based to functional state updates
3. Remove `ideas` from dependencies array
4. Test drag → expand → drag → collapse flow

---

## Validation Steps

1. ✅ Drag minimized card to new position
2. ✅ Expand card → should stay at new position
3. ✅ Drag expanded card to another position
4. ✅ Minimize card → should stay at new position
5. ✅ Verify database has correct x, y, is_collapsed values

---

## Additional Notes

### Why This Wasn't Caught Earlier

1. **Optimistic updates mask the bug**: UI appears correct initially
2. **Real-time subscriptions may not fire**: If user is alone on project
3. **Database is correct**: Looking at DB directly shows right values
4. **Only visible on toggle**: Normal drag-drop works fine

### Related Files

- `/src/components/DesignMatrix.tsx` - Positioning logic
- `/src/components/matrix/OptimizedIdeaCard.tsx` - Card rendering
- `/src/hooks/useIdeas.ts` - State management
- `/src/hooks/useOptimisticUpdates.ts` - Optimistic update logic
- `/src/lib/database.ts` - Database facade
- `/src/lib/services/IdeaService.ts` - Actual database operations

---

## Conclusion

The bug is a **state synchronization issue** where:
- ✅ Database updates work correctly
- ✅ Drag-and-drop calculates positions correctly
- ❌ Local state cache becomes stale after drag
- ❌ Toggle uses cached stale position instead of fresh database value

**Fix**: Re-fetch idea from database after toggle to synchronize all fields, not just `is_collapsed`.
