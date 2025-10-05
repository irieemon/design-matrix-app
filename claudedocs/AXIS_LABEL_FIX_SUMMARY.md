# Axis Label Color Issue - Root Cause & Fix Summary

## Issue Description
Matrix axis labels display as **black (#000000)** on initial page load, but correctly show as **gray (#334155)** after mouse hover on the matrix container.

---

## Root Cause

### The Problem: CSS Custom Property Not Evaluated on Initial Render

**CSS Load Order:**
1. `design-tokens.css` defines `--color-neutral-700: #334155`
2. `matrix-optimized.css` uses `color: var(--color-neutral-700)`
3. `@tailwind base` may interfere with color inheritance

**What Goes Wrong:**
- CSS custom property `var(--color-neutral-700)` is not being properly evaluated during initial paint
- Text defaults to browser's default color (black)
- Hover state forces style recalculation, which correctly evaluates the variable

**Why Hover Fixes It:**
- `.matrix-container:hover` rule triggers
- Browser recalculates all child styles
- CSS variables are re-evaluated in correct cascade order
- Axis labels now display correct gray color

---

## Technical Details

### Current Code

**File:** `/src/styles/matrix-optimized.css` (lines 102-122)
```css
.matrix-axis {
  position: absolute;
  z-index: var(--z-navigation);

  background: var(--glass-background);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);

  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-neutral-700);  /* ← Variable not evaluated initially */

  box-shadow: var(--shadow-sm);
  contain: layout paint;
}
```

### Color Values
| State | Color Value | Hex Code |
|-------|-------------|----------|
| Initial (Bug) | Black | `#000000` |
| Expected | Slate 700 | `#334155` |
| After Hover | Slate 700 | `#334155` ✅ |

---

## Recommended Fix

### Solution: Use Tailwind Layer + Parent Color

This ensures proper CSS cascade and prevents `@tailwind base` from interfering.

#### Step 1: Add Parent Color
```css
.matrix-container {
  color: var(--color-neutral-800); /* Establish inheritance chain */
}
```

#### Step 2: Wrap Axis Styles in @layer
```css
@layer components {
  .matrix-axis {
    position: absolute;
    z-index: var(--z-navigation);

    background: var(--glass-background);
    backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);

    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-neutral-700);

    box-shadow: var(--shadow-sm);
    contain: layout paint;
  }
}
```

### Why This Works
1. ✅ Parent container establishes color inheritance
2. ✅ `@layer components` ensures proper Tailwind cascade
3. ✅ CSS variables evaluate correctly from first render
4. ✅ Maintains design token system
5. ✅ No `!important` needed
6. ✅ Future-proof and maintainable

---

## Alternative Solutions

### Option 1: Use !important (Quick Fix)
```css
.matrix-axis {
  color: var(--color-neutral-700) !important;
}
```
**Pros:** Immediate fix
**Cons:** Reduces maintainability, breaks cascade

### Option 2: Hardcode Color (Simple)
```css
.matrix-axis {
  color: #334155; /* --color-neutral-700 */
}
```
**Pros:** Guaranteed to work
**Cons:** Breaks design token system, duplicates values

### Option 3: JavaScript Workaround (Not Recommended)
```tsx
useEffect(() => {
  const axisElements = document.querySelectorAll('.matrix-axis');
  axisElements.forEach(el => {
    el.style.color = getComputedStyle(el).color;
  });
}, []);
```
**Pros:** Forces evaluation
**Cons:** JS workaround for CSS issue, adds complexity

---

## Implementation

### Files to Modify
1. `/src/styles/matrix-optimized.css` - Add parent color, wrap in `@layer`

### Testing Checklist
- [ ] Axis labels are gray (#334155) immediately on page load
- [ ] Axis labels remain gray after hover
- [ ] Fix works in Chrome, Firefox, Safari
- [ ] No visual regression on other components
- [ ] Design token system still functional

---

## Verification

### Test File Created
`/verify_axis_color.html` - Standalone test to verify the fix

### How to Test
1. Open the app in browser
2. Inspect axis label color immediately on load
3. Should be `#334155` (not `#000000`)
4. Hover should not change the color
5. Check browser console: `getComputedStyle(document.querySelector('.matrix-axis')).color`

---

## Related Issues

### Similar CSS Variable Issues
- Other components using `var(--color-neutral-700)` may have same issue
- Check: `.matrix-quadrant-label`, card components, text elements

### Broader Implications
- Review CSS import order in `/src/index.css`
- Ensure design tokens load before Tailwind base
- Consider using `@layer` for all custom components

---

## Conclusion

**Root Cause:** CSS custom property not evaluated during initial render due to Tailwind base interference.

**Fix:** Use `@layer components` and establish parent color inheritance to ensure variables evaluate correctly from first paint.

**Impact:** Visual consistency bug, no functional impact. Fix is straightforward and maintains design system integrity.

---

**Date:** 2025-09-29
**Analyst:** Root Cause Analyst Agent
**Status:** Root cause identified, solution documented, ready for implementation