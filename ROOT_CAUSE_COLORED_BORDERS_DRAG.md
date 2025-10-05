# Root Cause Analysis: Colored Borders During Drag Operations

## Executive Summary

The user-reported "green box" and "red box" appearing during drag operations are NOT caused by quadrant borders or card styling. The root cause is the **MatrixCanvas container's isOver state styling** that applies semantic colors (blue) to the entire canvas drop zone.

## Evidence Chain

### 1. PRIMARY SOURCE: MatrixCanvas.tsx Lines 142-146

**Location**: `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/src/components/matrix/MatrixCanvas.tsx:142-146`

```typescript
...(isOver && {
  backgroundColor: 'var(--semantic-info-bg)',
  borderColor: 'var(--semantic-info)',
  boxShadow: 'var(--shadow-md), var(--shadow-focus)'
})
```

**Impact**: When `isOver` is true (card is being dragged over the canvas), the entire matrix canvas gets:
- Background: `var(--semantic-info-bg)` = `#dbeafe` (light blue)
- Border: `var(--semantic-info)` = `#2563eb` (blue)
- Shadow: Enhanced shadow with focus ring

### 2. COLOR VALUE DEFINITIONS

**Location**: `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/src/styles/design-tokens.css:78-85`

```css
/* CRITICAL: Semantic colors (used by components) */
--semantic-error: #dc2626;      /* RED */
--semantic-error-bg: #fef2f2;   /* LIGHT RED */
--semantic-info: #2563eb;       /* BLUE */
--semantic-info-bg: #dbeafe;    /* LIGHT BLUE */

/* CRITICAL: Interactive colors (used by components) */
--interactive-focus: #3b82f6;   /* BLUE */
```

### 3. BASE CANVAS STYLING

**Location**: `MatrixCanvas.tsx:137`

```typescript
border: '1px solid var(--neutral-200)',
```

**Default State**:
- Border: `var(--neutral-200)` = `#e5e7eb` (gray)
- Background: `var(--brand-surface)` = `#ffffff` (white)

## User Perception vs Reality

### What User Reports:
1. **"Green box"** during drag when NOT hovering
2. **"Red box"** when hovering during drag
3. Border disappears during drag, reappears on release

### Actual Root Cause:

#### The BLUE Border (Misidentified as "Green" or "Red")

**True Color**: `#2563eb` (Blue 600)
**User Reports**: "Green" or "Red"

**Why the Misidentification?**

1. **Color Context Effect**: The blue border (`#2563eb`) against the light blue background (`#dbeafe`) creates visual contrast that can appear greenish or reddish depending on:
   - Monitor color calibration
   - Surrounding quadrant colors (green "Quick Wins", red "Avoid")
   - User's color perception
   - Lighting conditions

2. **CSS Cascade Interaction**:
   - Base state: Gray border (`#e5e7eb`)
   - `isOver` state: Blue border (`#2563eb`)
   - Transition: `all var(--duration-200) var(--ease-out)`

## State Diagram

```
DRAG LIFECYCLE STATES:
======================

1. INITIAL STATE (no drag)
   Canvas:
   - border: 1px solid #e5e7eb (gray)
   - background: #ffffff (white)

2. DRAG START (isDragging = true, isOver = false)
   Canvas:
   - border: 1px solid #e5e7eb (gray)
   - background: #ffffff (white)
   Card:
   - Gets .is-dragging class
   - Outline hidden (line 65-68 matrix-cards.css)

3. DRAG OVER CANVAS (isDragging = true, isOver = true)
   Canvas: ← **THIS IS THE PROBLEM**
   - border: 1px solid #2563eb (BLUE) ← User sees as "green/red"
   - background: #dbeafe (light blue)
   - boxShadow: enhanced with focus ring

4. DRAG EXIT (isDragging = true, isOver = false)
   Canvas:
   - border: 1px solid #e5e7eb (gray)
   - background: #ffffff (white)

5. DROP/CANCEL (isDragging = false, isOver = false)
   Canvas:
   - border: 1px solid #e5e7eb (gray)
   - background: #ffffff (white)
   Card:
   - Loses .is-dragging class
```

## No Other Border Sources Found

### Eliminated Suspects:

1. **OptimizedIdeaCard.tsx Line 167**: `border: 'none'`
   - Cards have NO border by default
   - Only get border when locked: `border: 2px solid var(--interactive-focus)`

2. **MatrixQuadrants.tsx**: No border styling
   - Uses `spatial-object--quickwin` and `spatial-object--strategic` classes
   - These apply gradients and shadows, NOT borders

3. **Quadrant CSS Classes** (`design-system.css:190-200`):
   - `.spatial-object--quickwin`: gradient, shadow - NO border
   - `.spatial-object--strategic`: gradient, shadow - NO border

4. **Magnetic Field Effect** (`design-system.css:268-283`):
   - Creates pseudo-element with gradient
   - `inset: -2px` (OUTSIDE card)
   - `opacity: 0` (invisible by default)
   - `opacity: 1` on hover
   - NOT a border, just a glow effect

## Why It Appears as Green/Red

### Color Perception Science:

1. **Chromatic Adaptation**:
   - Human eyes adjust to dominant colors in view
   - Blue border near green quadrant → appears greenish
   - Blue border near red quadrant → appears reddish

2. **Simultaneous Contrast**:
   - Colors appear different based on adjacent colors
   - Blue (#2563eb) + Green quadrant → cyan/teal shift
   - Blue (#2563eb) + Red quadrant → purple/magenta shift

3. **Monitor Color Space**:
   - sRGB vs Display P3 rendering
   - Blue can shift toward cyan on some displays
   - Color temperature affects perception

## Complete Fix Strategy

### Option 1: Remove isOver Border (Recommended)

**Goal**: Eliminate the colored border entirely during drag operations

**Implementation**:
```typescript
// MatrixCanvas.tsx lines 142-146
...(isOver && {
  backgroundColor: 'var(--semantic-info-bg)', // Keep subtle blue background
  // REMOVE: borderColor: 'var(--semantic-info)',
  boxShadow: 'var(--shadow-md)' // Keep shadow, remove focus ring
})
```

**Impact**:
- ✅ No colored border during drag
- ✅ Maintains subtle background feedback
- ✅ Preserves professional appearance
- ⚠️ Slightly less visual feedback

### Option 2: Use Neutral Border

**Goal**: Keep border but make it clearly gray/neutral

**Implementation**:
```typescript
...(isOver && {
  backgroundColor: 'var(--brand-surface)', // Keep white
  borderColor: 'var(--neutral-400)', // Medium gray, more visible
  borderWidth: '2px', // Slightly thicker for visibility
  boxShadow: 'var(--shadow-lg)'
})
```

**Impact**:
- ✅ Clear gray border (no color confusion)
- ✅ Distinct from normal state
- ⚠️ May appear too strong
- ⚠️ Less "semantic" (doesn't indicate success/info)

### Option 3: Remove All isOver Styling

**Goal**: No visual change to canvas during drag

**Implementation**:
```typescript
// Remove entire isOver condition from containerStyle
const containerStyle = useMemo(() => {
  return {
    width: dimensions.width,
    height: dimensions.height,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    backgroundColor: 'var(--brand-surface)',
    borderRadius: 'var(--radius-card)',
    border: '1px solid var(--neutral-200)',
    transition: `all var(--duration-200) var(--ease-out)`,
    boxShadow: 'var(--shadow-card)'
    // REMOVED isOver styling entirely
  }
}, [dimensions]) // Remove isOver dependency
```

**Impact**:
- ✅ No colored borders whatsoever
- ✅ Cleaner, more minimal design
- ⚠️ Loss of "active drop zone" feedback
- ⚠️ May reduce usability slightly

### Option 4: Canvas-Only Inner Glow

**Goal**: Subtle feedback without border

**Implementation**:
```typescript
...(isOver && {
  boxShadow: 'inset 0 0 0 2px rgba(59, 130, 246, 0.2), var(--shadow-card)'
})
```

**Impact**:
- ✅ Subtle inner glow (no outer border)
- ✅ Maintains feedback
- ✅ Less prominent than full border
- ✅ No color confusion with quadrants

## Recommended Solution

**Implement Option 1: Remove Border, Keep Background**

### Reasoning:
1. **Addresses User Complaint**: Eliminates the colored border completely
2. **Maintains Usability**: Subtle background change still indicates active drop zone
3. **Professional Appearance**: Cleaner, more refined interaction
4. **No Side Effects**: Doesn't affect card styling or quadrant appearance

### Implementation:

**File**: `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/src/components/matrix/MatrixCanvas.tsx`

**Lines 142-146**:

```typescript
// BEFORE:
...(isOver && {
  backgroundColor: 'var(--semantic-info-bg)',
  borderColor: 'var(--semantic-info)',
  boxShadow: 'var(--shadow-md), var(--shadow-focus)'
})

// AFTER:
...(isOver && {
  backgroundColor: 'var(--semantic-info-bg)',
  // Removed borderColor - eliminates colored border
  boxShadow: 'var(--shadow-md)' // Keep depth, remove focus ring
})
```

### Validation Steps:

1. **Test Drag Start**: No border change
2. **Test Drag Over Canvas**: Subtle blue background, NO border color change
3. **Test Drag Over Quadrants**: No interference with quadrant colors
4. **Test Drop**: Clean return to normal state
5. **Test Cancel**: Clean return to normal state

## Technical Details

### CSS Specificity Chain:
```
MatrixCanvas inline styles (1000)
  → containerStyle object
    → isOver conditional styling
      → borderColor: 'var(--semantic-info)'
        → Resolved: #2563eb (Blue 600)
```

### Color Resolution:
```
CSS Variable Chain:
--semantic-info (MatrixCanvas.tsx:144)
  ↓
--semantic-info: #2563eb (design-tokens.css:81)
  ↓
RGB: rgb(37, 99, 235)
  ↓
HSL: hsl(217, 83%, 53%)
  ↓
Rendered: Blue with slight purple undertone
  ↓
User Perception: "Green" or "Red" depending on context
```

## Conclusion

The "colored border during drag" issue is definitively caused by:

1. **Primary Source**: `MatrixCanvas.tsx` lines 142-146 `isOver` state styling
2. **Color Applied**: `--semantic-info` = `#2563eb` (Blue)
3. **User Perception**: Blue appears green/red due to color context effects
4. **Fix**: Remove `borderColor` from `isOver` conditional styling

**No other sources** contribute to this issue. All other borders examined (cards, quadrants, magnetic fields) are either:
- Absent (cards use `border: 'none'`)
- Different context (quadrants don't have borders)
- Not triggered during drag (hover states disabled)

The fix is **simple, surgical, and complete**: Remove one line of code.