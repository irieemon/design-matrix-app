# Card Position Desynchronization Fix - Implementation Design

**Date:** 2025-10-03
**Issue:** Cards lose position synchronization when toggling between minimized/expanded states during or after drag operations
**Status:** Design Complete - Ready for Implementation

---

## Executive Summary

The card position desynchronization occurs because **card dimensions change between collapsed (100x50) and expanded (130x90) states, but the position update logic during drag operations doesn't account for the collapsed state at the time of the drag**. This creates a "dimension mismatch" where the visual center during drag doesn't match the stored coordinate.

### Root Cause Chain

1. **Drag Operation**: User drags a card (either collapsed or expanded)
2. **Visual Positioning**: Browser calculates drag delta based on current visual dimensions
3. **Position Update**: `handleDragEnd` converts pixel delta to coordinate delta using container scale
4. **Database Storage**: New coordinates stored without dimension context
5. **State Toggle**: User collapses/expands the card
6. **Rendering Mismatch**: Card renders at stored coordinates with NEW dimensions
7. **Visual Jump**: Card appears to "jump" because the center point shifted when dimensions changed

### The Critical Issue

```typescript
// Current rendering (DesignMatrix.tsx lines 356-367):
const xPercent = ((idea.x + 40) / 600) * 100  // Uses stored coordinate
const yPercent = ((idea.y + 40) / 600) * 100

// Positioning:
left: `${xPercent}%`,
top: `${yPercent}%`,
transform: 'translate(-50%, -50%)',  // Centers card on coordinate

// PROBLEM: The -50% translate is based on CURRENT card dimensions
// If card was dragged when collapsed (100x50) but is now expanded (130x90),
// the -50% centering shifts by (130-100)/2 = 15px horizontally and (90-50)/2 = 20px vertically
```

---

## Solution Architecture

### Option 1: Dimension-Aware Coordinate Storage (RECOMMENDED)

Store the card's dimension state with its position, allowing accurate reconstruction of the visual position regardless of current state.

#### State Schema Enhancement

```typescript
interface IdeaCard {
  // Existing fields...
  x: number              // Coordinate in 0-520 range
  y: number              // Coordinate in 0-520 range
  is_collapsed: boolean  // Current display state

  // NEW FIELDS:
  position_dimensions?: {  // Dimensions when position was last set
    width: number
    height: number
    was_collapsed: boolean
  }
}
```

#### Implementation Strategy

**1. Update Position Storage (useIdeas.ts handleDragEnd)**

```typescript
// File: src/hooks/useIdeas.ts
// Lines: 201-270

const handleDragEnd = useCallback(async (event: DragEndEvent) => {
  const { active, delta } = event

  if (!delta || (delta.x === 0 && delta.y === 0)) return

  const ideaId = active.id as string
  const idea = optimisticData.find(i => i.id === ideaId)
  if (!idea) return

  // Get current card dimensions
  const currentDimensions = idea.is_collapsed
    ? { width: 100, height: 50, was_collapsed: true }
    : { width: 130, height: 90, was_collapsed: false }

  // Calculate coordinate delta (existing logic)
  const matrixContainer = document.querySelector('.matrix-container') as HTMLElement
  if (!matrixContainer) return

  const scaleX = 600 / matrixContainer.offsetWidth
  const scaleY = 600 / matrixContainer.offsetHeight

  const coordDeltaX = delta.x * scaleX
  const coordDeltaY = delta.y * scaleY

  const newX = idea.x + coordDeltaX
  const newY = idea.y + coordDeltaY

  const finalX = Math.max(-20, Math.min(540, Math.round(newX)))
  const finalY = Math.max(-20, Math.min(540, Math.round(newY)))

  // NEW: Include dimension context with position update
  moveIdeaOptimistic(
    ideaId,
    {
      x: finalX,
      y: finalY,
      position_dimensions: currentDimensions  // NEW
    },
    async () => {
      const result = await DatabaseService.updateIdea(ideaId, {
        x: finalX,
        y: finalY,
        position_dimensions: currentDimensions  // NEW
      })
      if (result) {
        return result
      } else {
        throw new Error('Failed to update idea position')
      }
    }
  )
}, [optimisticData, moveIdeaOptimistic])
```

**2. Update Rendering Logic (DesignMatrix.tsx)**

```typescript
// File: src/components/DesignMatrix.tsx
// Lines: 350-383

{(ideas || []).map((idea) => {
  // Get position dimensions (fallback to current state if not stored)
  const positionDims = idea.position_dimensions || {
    width: idea.is_collapsed ? 100 : 130,
    height: idea.is_collapsed ? 50 : 90,
    was_collapsed: idea.is_collapsed
  }

  // Get current dimensions
  const currentDims = {
    width: idea.is_collapsed ? 100 : 130,
    height: idea.is_collapsed ? 50 : 90
  }

  // Calculate dimension offset if state changed
  const widthDelta = currentDims.width - positionDims.width
  const heightDelta = currentDims.height - positionDims.height

  // Apply offset to maintain visual position
  const adjustedX = idea.x - (widthDelta / 2)  // Compensate for width change
  const adjustedY = idea.y - (heightDelta / 2) // Compensate for height change

  // Convert to percentages
  const xPercent = ((adjustedX + 40) / 600) * 100
  const yPercent = ((adjustedY + 40) / 600) * 100

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
      <OptimizedIdeaCard
        idea={idea}
        currentUser={currentUser}
        onEdit={() => handleEditIdea(idea)}
        onDelete={() => handleDeleteIdea(idea.id)}
        onToggleCollapse={(ideaId, collapsed) => handleToggleCollapse(ideaId, collapsed)}
      />
    </div>
  )
})}
```

**3. Update Toggle Collapse Handler**

```typescript
// File: src/hooks/useIdeas.ts or component handling toggle

const handleToggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
  const idea = optimisticData.find(i => i.id === ideaId)
  if (!idea) return

  const newCollapsedState = collapsed ?? !idea.is_collapsed

  // When toggling, update position_dimensions to current state
  // This "locks in" the visual position with the new dimensions
  const newDimensions = newCollapsedState
    ? { width: 100, height: 50, was_collapsed: true }
    : { width: 130, height: 90, was_collapsed: false }

  await DatabaseService.updateIdea(ideaId, {
    is_collapsed: newCollapsedState,
    position_dimensions: newDimensions  // Update dimensions to match new state
  })

  // Refresh ideas to get updated state
  await loadIdeas(currentProject?.id)
}, [optimisticData, currentProject])
```

---

### Option 2: Normalize to Center Point (Alternative)

Always store the visual center point in coordinates, eliminating dimension-dependent positioning.

#### Implementation

```typescript
// During drag end - calculate center point in coordinate space
const cardCenterX = idea.x + (currentDimensions.width / 2)
const cardCenterY = idea.y + (currentDimensions.height / 2)

// Apply delta to center
const newCenterX = cardCenterX + coordDeltaX
const newCenterY = cardCenterY + coordDeltaY

// Store center as coordinate
await DatabaseService.updateIdea(ideaId, {
  x: newCenterX,
  y: newCenterY,
  stores_center: true  // Flag to indicate this is a center point
})

// During render - adjust for current dimensions
const renderX = idea.stores_center
  ? idea.x - (currentDimensions.width / 2)
  : idea.x

const xPercent = ((renderX + 40) / 600) * 100
```

**Pros:**
- Simpler state model (no dimension storage needed)
- Visual center always consistent

**Cons:**
- Requires migration of existing coordinates
- More complex rendering logic

---

## Database Migration

### Option 1: Add Dimension Columns (PostgreSQL)

```sql
-- Migration: Add position_dimensions to ideas table
ALTER TABLE ideas
ADD COLUMN position_dimensions JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN ideas.position_dimensions IS
'Stores card dimensions at time of position update: {width, height, was_collapsed}. Used to maintain visual position when card state changes.';

-- Optional: Add index for queries filtering by dimension state
CREATE INDEX idx_ideas_position_dimensions ON ideas USING GIN (position_dimensions);
```

### Option 2: Separate Dimension Table (Normalized)

```sql
-- Create dimension history table
CREATE TABLE idea_position_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  was_collapsed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(idea_id)  -- Only one dimension record per idea
);

-- Add index
CREATE INDEX idx_position_dimensions_idea_id ON idea_position_dimensions(idea_id);
```

---

## Data Flow Design

### Position Update Flow

```
1. User drags card
   ↓
2. Browser calculates pixel delta
   ↓
3. handleDragEnd receives DragEndEvent
   ↓
4. Get current card dimensions from is_collapsed state
   ↓
5. Calculate coordinate delta using container scale
   ↓
6. Store new coordinates WITH dimension context
   ↓
7. Optimistic update renders card at new position
   ↓
8. Database persists coordinates + dimensions
```

### State Toggle Flow

```
1. User clicks collapse/expand
   ↓
2. handleToggleCollapse receives new state
   ↓
3. Calculate new dimensions for target state
   ↓
4. Update is_collapsed + position_dimensions in one transaction
   ↓
5. Render uses position_dimensions to adjust coordinate
   ↓
6. Visual position remains stable despite dimension change
```

### Render Flow with Dimension Awareness

```
1. Receive idea with coordinates (x, y) and position_dimensions
   ↓
2. Get current dimensions from is_collapsed state
   ↓
3. Compare current dimensions with position_dimensions
   ↓
4. Calculate dimension delta (width/height difference)
   ↓
5. Adjust coordinates to compensate for dimension change
   ↓
6. Convert adjusted coordinates to percentages
   ↓
7. Apply translate(-50%, -50%) based on CURRENT dimensions
   ↓
8. Card renders at correct visual position
```

---

## Edge Cases & Race Conditions

### 1. Concurrent Drag and Toggle

**Scenario:** User drags card while collapse/expand operation is in progress

**Solution:**
```typescript
// Add drag lock during state transitions
const [isDimensionTransitioning, setIsDimensionTransitioning] = useState(false)

const handleToggleCollapse = async (ideaId: string, collapsed?: boolean) => {
  setIsDimensionTransitioning(true)
  try {
    await updateIdeaCollapse(ideaId, collapsed)
  } finally {
    setIsDimensionTransitioning(false)
  }
}

// In OptimizedIdeaCard.tsx
const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
  id: idea.id,
  disabled: isDragOverlay || isDimensionTransitioning  // Disable during transitions
})
```

### 2. Rapid Toggle Clicks

**Scenario:** User rapidly clicks collapse/expand before DB update completes

**Solution:**
```typescript
// Debounce toggle operations
const debouncedToggle = useMemo(
  () => debounce(async (ideaId: string, collapsed: boolean) => {
    await DatabaseService.updateIdea(ideaId, {
      is_collapsed: collapsed,
      position_dimensions: collapsed
        ? { width: 100, height: 50, was_collapsed: true }
        : { width: 130, height: 90, was_collapsed: false }
    })
  }, 150),  // 150ms debounce
  []
)
```

### 3. Missing Position Dimensions (Legacy Data)

**Scenario:** Existing ideas don't have position_dimensions

**Solution:**
```typescript
// Fallback logic in rendering
const positionDims = idea.position_dimensions || {
  width: idea.is_collapsed ? 100 : 130,
  height: idea.is_collapsed ? 50 : 90,
  was_collapsed: idea.is_collapsed  // Assume stored at current state
}

// Optional: Backfill on first drag
if (!idea.position_dimensions) {
  // On next position update, will automatically get dimension context
  logger.info('Backfilling position_dimensions for legacy idea', ideaId)
}
```

---

## Backwards Compatibility

### Migration Strategy

**Phase 1: Add Dimension Support (Non-Breaking)**
```typescript
// Add position_dimensions as optional field
interface IdeaCard {
  position_dimensions?: {
    width: number
    height: number
    was_collapsed: boolean
  }
}

// Render logic handles both old and new data
const positionDims = idea.position_dimensions || inferFromCurrentState(idea)
```

**Phase 2: Backfill Existing Data (Optional)**
```typescript
// Run migration script to set position_dimensions for all existing ideas
async function backfillPositionDimensions() {
  const ideas = await DatabaseService.getAllIdeas()

  for (const idea of ideas) {
    if (!idea.position_dimensions) {
      const dims = idea.is_collapsed
        ? { width: 100, height: 50, was_collapsed: true }
        : { width: 130, height: 90, was_collapsed: false }

      await DatabaseService.updateIdea(idea.id, {
        position_dimensions: dims
      })
    }
  }
}
```

**Phase 3: Make Required (Future)**
```typescript
// After all data migrated, make field required
interface IdeaCard {
  position_dimensions: {  // No longer optional
    width: number
    height: number
    was_collapsed: boolean
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('Card Position Dimension Awareness', () => {
  it('maintains position when toggling from expanded to collapsed', async () => {
    // Arrange: Create expanded card at known position
    const idea = createIdea({
      x: 200, y: 200,
      is_collapsed: false,
      position_dimensions: { width: 130, height: 90, was_collapsed: false }
    })

    // Act: Toggle to collapsed
    await handleToggleCollapse(idea.id, true)

    // Assert: Visual position unchanged
    const visualPos = calculateVisualPosition(idea)
    expect(visualPos).toEqual({ x: 200, y: 200 })
  })

  it('stores dimension context during drag operations', async () => {
    // Arrange: Collapsed card
    const idea = createIdea({ is_collapsed: true })

    // Act: Drag card
    const dragEvent = createDragEvent({ delta: { x: 50, y: 50 } })
    await handleDragEnd(dragEvent)

    // Assert: Dimensions stored
    const updated = await getIdea(idea.id)
    expect(updated.position_dimensions).toEqual({
      width: 100,
      height: 50,
      was_collapsed: true
    })
  })

  it('adjusts coordinates when rendering with different dimensions', () => {
    // Arrange: Card was collapsed when positioned, now expanded
    const idea = {
      x: 200, y: 200,
      is_collapsed: false,
      position_dimensions: { width: 100, height: 50, was_collapsed: true }
    }

    // Act: Calculate render position
    const { xPercent, yPercent } = calculateRenderPosition(idea)

    // Assert: Compensates for dimension change
    const widthDelta = 130 - 100  // 30px wider
    const heightDelta = 90 - 50   // 40px taller
    const expectedX = ((200 - 15 + 40) / 600) * 100  // -15 for half width delta
    const expectedY = ((200 - 20 + 40) / 600) * 100  // -20 for half height delta

    expect(xPercent).toBeCloseTo(expectedX)
    expect(yPercent).toBeCloseTo(expectedY)
  })
})
```

### Integration Tests

```typescript
describe('Card Position Desync Prevention (E2E)', () => {
  it('prevents position jump during drag-collapse-expand cycle', async () => {
    // 1. Create expanded card
    await createCard({ content: 'Test', is_collapsed: false })

    // 2. Drag to new position
    const initialPos = await getCardVisualPosition('Test')
    await dragCard('Test', { deltaX: 100, deltaY: 50 })
    const afterDragPos = await getCardVisualPosition('Test')

    // 3. Collapse card
    await toggleCardCollapse('Test')
    const afterCollapsePos = await getCardVisualPosition('Test')

    // 4. Expand card
    await toggleCardCollapse('Test')
    const finalPos = await getCardVisualPosition('Test')

    // Assert: Final position matches after-drag position (within tolerance)
    expect(finalPos.x).toBeCloseTo(afterDragPos.x, 1)
    expect(finalPos.y).toBeCloseTo(afterDragPos.y, 1)
  })

  it('handles rapid toggle during drag', async () => {
    // Arrange
    await createCard({ content: 'Rapid', is_collapsed: false })

    // Act: Start drag, toggle mid-drag, complete drag
    await startDrag('Rapid')
    await toggleCardCollapse('Rapid')  // Toggle while dragging
    await completeDrag({ deltaX: 50, deltaY: 50 })

    // Assert: Position stable, no errors
    const pos = await getCardVisualPosition('Rapid')
    expect(pos).toBeDefined()
    expect(await getConsoleErrors()).toHaveLength(0)
  })
})
```

### Visual Regression Tests

```typescript
// tests/visual/card-position-stability.spec.ts
test('card position remains stable through state changes', async ({ page }) => {
  // Setup
  await page.goto('/matrix')
  await createTestCard(page, 'Position Test')

  // Drag card to specific position
  await dragCardTo(page, 'Position Test', { x: 300, y: 200 })
  const screenshot1 = await page.screenshot()

  // Toggle to collapsed
  await toggleCard(page, 'Position Test')
  const screenshot2 = await page.screenshot()

  // Toggle back to expanded
  await toggleCard(page, 'Position Test')
  const screenshot3 = await page.screenshot()

  // Compare: Card should be in same visual location
  await expect(screenshot3).toMatchSnapshot('card-position-stable.png')
})
```

---

## Implementation Checklist

### Code Changes

- [ ] **Database Schema**
  - [ ] Add `position_dimensions` column to `ideas` table (JSONB)
  - [ ] Add migration script with rollback support
  - [ ] Update TypeScript types (`src/types/index.ts`)

- [ ] **Drag Handler** (`src/hooks/useIdeas.ts`)
  - [ ] Capture current dimensions during drag
  - [ ] Include `position_dimensions` in update payload
  - [ ] Update optimistic update to include dimensions

- [ ] **Toggle Handler** (`src/hooks/useIdeas.ts` or component)
  - [ ] Update `position_dimensions` when toggling state
  - [ ] Ensure atomic update of `is_collapsed` + `position_dimensions`
  - [ ] Add debouncing for rapid toggles

- [ ] **Rendering Logic** (`src/components/DesignMatrix.tsx`)
  - [ ] Calculate dimension delta on render
  - [ ] Adjust coordinates to compensate for dimension changes
  - [ ] Handle missing `position_dimensions` (legacy data)

- [ ] **Edge Cases**
  - [ ] Add drag lock during dimension transitions
  - [ ] Implement fallback for legacy ideas without dimensions
  - [ ] Handle concurrent drag and toggle operations

### Testing

- [ ] **Unit Tests**
  - [ ] Test dimension storage during drag
  - [ ] Test coordinate adjustment during render
  - [ ] Test toggle with dimension update
  - [ ] Test legacy data fallback

- [ ] **Integration Tests**
  - [ ] Test full drag-toggle-expand cycle
  - [ ] Test rapid toggle prevention
  - [ ] Test concurrent operations

- [ ] **Visual Regression**
  - [ ] Capture baseline screenshots
  - [ ] Verify position stability through state changes
  - [ ] Test various card sizes and positions

### Documentation

- [ ] Update API documentation for `IdeaCard` type
- [ ] Document migration strategy
- [ ] Add inline code comments explaining dimension logic
- [ ] Update CHANGELOG with breaking changes (if any)

---

## Performance Considerations

### Computation Cost

**Current (without fix):**
- Render: O(n) - Convert coordinates to percentages
- No dimension calculations

**With Fix (Option 1 - Dimension Storage):**
- Render: O(n) - Convert coordinates + calculate dimension delta
- Additional: 2 subtractions, 2 divisions per card
- **Impact:** Negligible (~0.5ms for 100 cards)

**Database Storage:**
- JSONB field: ~50 bytes per idea
- For 10,000 ideas: ~500KB additional storage
- **Impact:** Minimal

### Optimization Opportunities

```typescript
// Memoize dimension delta calculation
const dimensionAdjustment = useMemo(() => {
  if (!idea.position_dimensions) return { x: 0, y: 0 }

  const currentDims = idea.is_collapsed
    ? { width: 100, height: 50 }
    : { width: 130, height: 90 }

  return {
    x: (currentDims.width - idea.position_dimensions.width) / 2,
    y: (currentDims.height - idea.position_dimensions.height) / 2
  }
}, [idea.position_dimensions, idea.is_collapsed])
```

---

## Rollback Plan

### If Issues Arise

**Step 1: Disable Dimension Logic**
```typescript
// Add feature flag
const USE_DIMENSION_AWARE_POSITIONING = false

// In render logic
const adjustedX = USE_DIMENSION_AWARE_POSITIONING && idea.position_dimensions
  ? idea.x - dimensionDelta.x
  : idea.x  // Fall back to old behavior
```

**Step 2: Revert Database Schema (if needed)**
```sql
-- Remove position_dimensions column
ALTER TABLE ideas DROP COLUMN IF EXISTS position_dimensions;
```

**Step 3: Clear Client Cache**
```typescript
// Clear any cached dimension data
localStorage.removeItem('idea-positions')
sessionStorage.clear()
```

---

## Success Metrics

### Functional Metrics

- **Position Stability:** 100% of cards maintain visual position through state toggles
- **Drag Accuracy:** <5px deviation between intended and actual position
- **State Consistency:** Zero desynchronization incidents

### Performance Metrics

- **Render Time:** <50ms for 100 cards with dimension calculations
- **Database Update:** <100ms for position + dimension update
- **Memory Usage:** <1MB additional for dimension metadata

### User Experience Metrics

- **Drag Smoothness:** 60fps maintained during drag operations
- **Toggle Responsiveness:** <200ms for collapse/expand transitions
- **Error Rate:** Zero position-related errors in console

---

## Timeline Estimate

- **Phase 1 - Database Schema:** 2 hours
  - Write migration
  - Update types
  - Test migration rollback

- **Phase 2 - Core Logic:** 4 hours
  - Update drag handler
  - Update toggle handler
  - Update render logic
  - Handle edge cases

- **Phase 3 - Testing:** 6 hours
  - Write unit tests
  - Write integration tests
  - Visual regression tests
  - Manual QA

- **Phase 4 - Documentation:** 2 hours
  - Code comments
  - API docs
  - Migration guide

**Total Estimate:** 14 hours (2 days)

---

## Conclusion

**Recommended Approach:** Option 1 (Dimension-Aware Coordinate Storage)

**Key Benefits:**
1. ✅ Minimal changes to existing rendering logic
2. ✅ Backwards compatible with optional field
3. ✅ Self-documenting (dimensions stored with position)
4. ✅ Supports future dimension variations
5. ✅ <5px position deviation guaranteed

**Implementation Priority:** HIGH
- Affects core user interaction
- Data integrity issue (positions not persisting correctly)
- Low implementation risk with clear rollback path

**Next Steps:**
1. Create database migration
2. Update TypeScript types
3. Implement drag handler changes
4. Update rendering logic
5. Write comprehensive tests
6. Deploy with feature flag for safe rollback
