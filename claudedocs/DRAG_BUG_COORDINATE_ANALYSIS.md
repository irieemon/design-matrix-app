# Critical Drag Bug: Coordinate Space Mismatch Analysis

## Executive Summary

**Bug**: Cards jump far off the grid when dragged, appearing to move much farther than the cursor movement.

**Root Cause**: Coordinate space mismatch between DND Kit's pixel-based deltas and the application's abstract coordinate storage system (0-520 range).

**Impact**: CRITICAL - Drag and drop is completely broken, making the matrix unusable.

---

## System Architecture Analysis

### 1. DND Kit Configuration

**Version**: `@dnd-kit/core@6.3.1`

**Setup** (`DesignMatrix.tsx:76-78`):
```typescript
const { setNodeRef } = useDroppable({
  id: 'matrix'
})
```

**Card Setup** (`OptimizedIdeaCard.tsx:128-131`):
```typescript
const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
  id: idea.id,
  disabled: isDragOverlay
})
```

**Key Finding**: No custom sensors, modifiers, or collision detection configured. DND Kit uses default behavior.

### 2. DND Kit Coordinate System

**Documentation Analysis**:
- DND Kit reports drag deltas in **PIXELS** relative to the viewport
- `delta.x` and `delta.y` represent actual pixel movement
- Transform values are in pixels: `translate3d(${transform.x}px, ${transform.y}px, 0)`

**Evidence** (`OptimizedIdeaCard.tsx:181-182`):
```typescript
const baseTransform = transform
  ? `translate3d(${transform.x}px, ${transform.y}px, 0)`  // ← PIXELS
  : ''
```

### 3. Application Coordinate System

**Storage Space**: 0-520 abstract units
- X range: 0-520 (center at 260)
- Y range: 0-520 (center at 260)
- No direct relationship to physical pixels

**Rendering Space**: Percentages (0-100%)
- Cards positioned using percentages
- Formula: `((coordinate + 40) / 600) * 100 = percentage`
- Example: coordinate 260 → ((260 + 40) / 600) * 100 = 50%

**Visual Space**: Responsive container
- Container max-width: ~1200px (responsive)
- Container height: 600px
- Actual pixel dimensions vary by screen size

---

## The Coordinate Mismatch

### Rendering: Coordinate → Percentage

**Code** (`DesignMatrix.tsx:350-366`):
```typescript
// Convert stored coordinates (0-520 range, center 260) to percentages
const xPercent = ((idea.x + 40) / 600) * 100
const yPercent = ((idea.y + 40) / 600) * 100

<div
  style={{
    position: 'absolute',
    left: `${xPercent}%`,      // ← PERCENTAGE
    top: `${yPercent}%`,       // ← PERCENTAGE
    transform: 'translate(-50%, -50%)'  // Center on position
  }}
>
```

**Problem**: The `translate(-50%, -50%)` centers the card, but this offset is in PERCENTAGES OF CARD SIZE, not container size.

### Drag Handler: Wrong Math

**Current Implementation** (`useIdeas.ts:176-192`):
```typescript
const handleDragEnd = useCallback(async (event: DragEndEvent) => {
  const { active, delta } = event

  if (!delta || (delta.x === 0 && delta.y === 0)) return

  const ideaId = active.id as string
  const idea = optimisticData.find(i => i.id === ideaId)
  if (!idea) return

  // BUG: Adding pixel deltas directly to abstract coordinates
  const newX = idea.x + delta.x    // ❌ WRONG: pixels + abstract units
  const newY = idea.y + delta.y    // ❌ WRONG: pixels + abstract units

  // Bounds are also wrong (in pixels, not coordinate space)
  const finalX = Math.max(-100, Math.min(1400, Math.round(newX)))
  const finalY = Math.max(-50, Math.min(650, Math.round(newY)))

  await DatabaseService.updateIdea(ideaId, { x: finalX, y: finalY })
})
```

**What Goes Wrong**:
1. User drags card 50 pixels to the right
2. DND Kit reports `delta.x = 50` (pixels)
3. Code adds 50 to coordinate: `260 + 50 = 310`
4. Coordinate 310 renders at: `((310 + 40) / 600) * 100 = 58.3%`
5. On 1200px container: 58.3% = 700px from left
6. But should have moved only 50px!

**Amplification Factor**:
- On 1200px container: 1 coordinate unit ≈ 2.3 pixels
- So 50px drag → 50 coordinate units → ~115 pixels visual movement
- **2.3x amplification of movement!**

---

## Container Dimensions Investigation

### CSS Analysis

**No explicit container dimensions found in**:
- `src/index.css` - No `.matrix-container` width/height rules
- Matrix styles are mostly appearance-related

**Actual Container Rendering**:
```typescript
// DesignMatrix.tsx:254-273
<div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
  <div
    ref={matrixRef}
    className="matrix-container ..."
    // No inline width/height styles
  >
```

**Conclusion**: Container is **RESPONSIVE**
- Width: Determined by parent layout (up to ~1200px)
- Height: Likely CSS-defined at 600px
- **Varies by screen size and viewport**

---

## Correct Conversion Formula

### Required Information

To convert DND Kit pixel deltas to coordinate space, we need:
1. **Container width in pixels** (e.g., 1200px)
2. **Container height in pixels** (e.g., 600px)
3. **Coordinate range** (0-520)
4. **Rendering offset** (40px padding equivalent)

### Formula

```typescript
// Get container dimensions (must measure at runtime)
const containerRect = matrixRef.current?.getBoundingClientRect()
const containerWidth = containerRect?.width || 1200
const containerHeight = containerRect?.height || 600

// Constants
const COORD_RANGE = 520
const COORD_OFFSET = 40
const TOTAL_COORD_SPACE = COORD_RANGE + (COORD_OFFSET * 2) // 600

// Convert pixel delta to coordinate delta
const coordDeltaX = (delta.x / containerWidth) * TOTAL_COORD_SPACE
const coordDeltaY = (delta.y / containerHeight) * TOTAL_COORD_SPACE

// Apply to current position
const newX = idea.x + coordDeltaX
const newY = idea.y + coordDeltaY

// Bounds in coordinate space
const finalX = Math.max(0, Math.min(COORD_RANGE, Math.round(newX)))
const finalY = Math.max(0, Math.min(COORD_RANGE, Math.round(newY)))
```

### Example Calculation

**Scenario**: 1200px container, drag 100px right
```
delta.x = 100 (pixels)
containerWidth = 1200 (pixels)
TOTAL_COORD_SPACE = 600

coordDeltaX = (100 / 1200) * 600 = 50 coordinate units

idea.x = 260 (center)
newX = 260 + 50 = 310

Verification:
- Renders at: ((310 + 40) / 600) * 100 = 58.3%
- On 1200px: 58.3% * 1200 = 700px from left
- Original position: ((260 + 40) / 600) * 100 = 50% = 600px
- Movement: 700 - 600 = 100px ✅ CORRECT
```

---

## Implementation Requirements

### 1. Container Dimension Tracking

**Need**: Real-time container dimensions for accurate conversion

**Options**:
- **A. ResizeObserver**: Track container size changes
- **B. Context Provider**: Share dimensions across components
- **C. Ref measurement**: Measure on drag start

**Recommendation**: ResizeObserver in context for performance

### 2. Drag Handler Refactor

**File**: `src/hooks/useIdeas.ts:176-213`

**Changes Needed**:
1. Accept container dimensions as parameter
2. Convert pixel deltas to coordinate deltas
3. Fix bounds to coordinate space (0-520)
4. Remove pixel-based bounds (1400, 650, etc.)

### 3. Transform Interaction

**Current**:
```typescript
transform: 'translate(-50%, -50%)'  // Center card on position
```

**Concern**: Does this percentage-based centering affect calculations?

**Analysis**:
- `translate(-50%, -50%)` is relative to CARD size, not container
- This is AFTER positioning, so shouldn't affect drag delta calculation
- But verify during testing!

---

## Testing Strategy

### 1. Unit Tests

**Test Cases**:
```typescript
describe('Drag coordinate conversion', () => {
  it('converts 100px drag to correct coordinate delta', () => {
    const delta = { x: 100, y: 0 }
    const containerWidth = 1200
    const result = convertDeltaToCoordinates(delta, containerWidth, 600)
    expect(result.x).toBe(50) // (100/1200) * 600 = 50
  })

  it('handles different container sizes', () => {
    // Test 800px, 1000px, 1400px containers
  })

  it('respects coordinate bounds', () => {
    // Test edge cases near 0 and 520
  })
})
```

### 2. Visual Tests

**Scenarios**:
1. Drag card 100px right → should move exactly 100px visually
2. Drag to edges → should stop at boundaries
3. Resize window → drag should still work correctly
4. Multiple drags → no cumulative error

### 3. Integration Tests

**Playwright Tests**:
```typescript
test('drag accuracy', async ({ page }) => {
  const card = page.locator('.draggable').first()
  const startPos = await card.boundingBox()

  // Drag 100px right
  await card.dragTo(card, { targetPosition: { x: 100, y: 0 } })

  const endPos = await card.boundingBox()
  const actualMovement = endPos.x - startPos.x

  expect(actualMovement).toBeCloseTo(100, 5) // Within 5px tolerance
})
```

---

## Risk Assessment

### High Risk Areas

1. **Responsive Behavior**: Container size changes during drag
2. **Percentage Transform**: The `-50%` centering might interact unexpectedly
3. **Zoom Levels**: Browser zoom could affect calculations
4. **Touch Devices**: Different coordinate systems on mobile

### Migration Risk

**Current users have data stored in coordinate space (0-520)**
- ✅ No migration needed - coordinate storage stays the same
- ✅ Only drag conversion logic changes
- ⚠️ Test with existing production data

---

## Recommended Implementation Steps

### Phase 1: Container Dimension Context
1. Create `MatrixDimensionsContext`
2. Add ResizeObserver to track container size
3. Expose dimensions via context hook

### Phase 2: Drag Conversion Utility
1. Create `coordinateConversion.ts` utility
2. Implement pixel ↔ coordinate conversion functions
3. Add comprehensive unit tests

### Phase 3: Drag Handler Refactor
1. Update `useIdeas.ts` handleDragEnd
2. Use container dimensions from context
3. Apply correct conversion formula
4. Fix bounds to coordinate space

### Phase 4: Testing & Validation
1. Unit tests for conversion functions
2. Visual regression tests
3. Playwright E2E tests
4. Manual testing on various screen sizes

---

## Code References

**Key Files**:
- `src/components/DesignMatrix.tsx` - Matrix container and rendering
- `src/components/matrix/OptimizedIdeaCard.tsx` - Card dragging setup
- `src/hooks/useIdeas.ts` - Drag handler with bug
- `src/types/index.ts` - IdeaCard coordinate types

**Coordinate Conversion**:
- Render: `DesignMatrix.tsx:355-356`
- Drag: `useIdeas.ts:186-192`
- Transform: `OptimizedIdeaCard.tsx:181`, `DesignMatrix.tsx:366`

---

## Next Actions

1. ✅ Analysis complete
2. ⬜ Create container dimension tracking
3. ⬜ Implement conversion utilities
4. ⬜ Refactor drag handler
5. ⬜ Comprehensive testing
6. ⬜ Deploy and monitor

**Priority**: CRITICAL - Core functionality broken
**Estimated Effort**: 4-6 hours
**Testing Time**: 2-3 hours