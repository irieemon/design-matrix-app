# Quadrant Color Detection Visual Testing Guide

## Overview

This guide provides comprehensive instructions for executing and validating the quadrant color detection fix using Playwright visual tests.

## Problem Statement

**Issue**: Quadrant colors were not updating correctly during X-axis drag operations due to a bug in the `calculateQuadrant()` function in `OptimizedIdeaCard.tsx`.

**Root Cause**: The function was using pixel coordinates (x, y) directly instead of using normalized coordinates (0-1 range) for quadrant detection.

**Fix Applied**: Updated `calculateQuadrant()` to use normalized matrix coordinates with proper boundary detection:
- X-axis boundary: x < 0.5 (left) vs x >= 0.5 (right)
- Y-axis boundary: y < 0.5 (top) vs y >= 0.5 (bottom)

## Expected Behavior

### Quadrant Color Mapping

| Quadrant | Position | Color | Hex Code | RGB |
|----------|----------|-------|----------|-----|
| Quick Wins | Top-Left (x<0.5, y<0.5) | Green | `#10B981` | rgb(16, 185, 129) |
| Strategic | Top-Right (x≥0.5, y<0.5) | Blue | `#3B82F6` | rgb(59, 130, 246) |
| Reconsider | Bottom-Left (x<0.5, y≥0.5) | Amber | `#F59E0B` | rgb(245, 158, 11) |
| Avoid | Bottom-Right (x≥0.5, y≥0.5) | Red | `#EF4444` | rgb(239, 68, 68) |

### Visual Indicators

1. **Border Color**: 2.5px solid border around card in quadrant color
2. **Data Attribute**: `data-quadrant` attribute on card element matches quadrant name
3. **Smooth Transitions**: Color changes smoothly during drag operations

## Test Suite Structure

### 1. Static Position Validation
Tests cards at fixed positions in all quadrants to validate basic color detection.

**Coverage**:
- Quadrant centers (25%, 25%), (75%, 25%), (25%, 75%), (75%, 75%)
- Near-boundary positions (45%, 55% from center)
- Exact boundary positions (50% on one or both axes)

### 2. X-Axis Boundary Crossing
Tests horizontal drag operations across the vertical centerline.

**Coverage**:
- Quick Wins → Strategic (left to right, top half)
- Strategic → Quick Wins (right to left, top half)
- Reconsider → Avoid (left to right, bottom half)
- Avoid → Reconsider (right to left, bottom half)

### 3. Y-Axis Boundary Crossing
Tests vertical drag operations across the horizontal centerline.

**Coverage**:
- Quick Wins → Reconsider (top to bottom, left half)
- Strategic → Avoid (top to bottom, right half)

### 4. Diagonal Boundary Crossing
Tests drag operations across both axes simultaneously.

**Coverage**:
- Quick Wins → Avoid (top-left to bottom-right)
- Avoid → Quick Wins (bottom-right to top-left)

### 5. Edge Cases
Tests critical boundary conditions.

**Coverage**:
- Exact center (0.5, 0.5)
- Exact X boundary (0.5, y)
- Exact Y boundary (x, 0.5)

### 6. Multi-Step Drag Path
Tests a complete tour through all quadrants to validate state persistence.

**Coverage**:
- Sequential movement through all four quadrants
- Return to starting position

## Test Execution

### Prerequisites

1. **Development Server**: Ensure app is running on `http://localhost:5173`
2. **Test Data**: At least one idea card must exist in the matrix
3. **Authentication**: If auth is enabled, ensure test credentials are available

### Running Tests

```bash
# Run all quadrant color detection tests
npx playwright test tests/visual/quadrant-color-detection.spec.ts

# Run with headed browser (watch tests execute)
npx playwright test tests/visual/quadrant-color-detection.spec.ts --headed

# Run specific test
npx playwright test tests/visual/quadrant-color-detection.spec.ts -g "Static Position Validation"

# Run with debug mode
npx playwright test tests/visual/quadrant-color-detection.spec.ts --debug

# Generate HTML report
npx playwright test tests/visual/quadrant-color-detection.spec.ts --reporter=html
```

### Screenshot Output

All test screenshots are saved to:
```
tests/visual/screenshots/
├── quadrant-static-{position-name}.png
├── quadrant-drag-{scenario-name}-before.png
├── quadrant-drag-{scenario-name}-after.png
├── quadrant-edge-{edge-case-name}.png
└── quadrant-tour-step-{n}-{quadrant}.png
```

## Validation Criteria

### Automated Validation

Each test performs automatic validation:

1. **Border Color Validation**
   - Extracts computed border color from card element
   - Parses RGB values from CSS color string
   - Compares with expected quadrant color (15px tolerance)
   - Reports pass/fail with actual vs expected colors

2. **Attribute Validation**
   - Checks `data-quadrant` attribute on card element
   - Verifies attribute matches expected quadrant name
   - Reports pass/fail with actual vs expected values

### Manual Validation

Review screenshots for visual consistency:

1. **Color Accuracy**
   - Border color matches quadrant
   - No color artifacts or bleeding
   - Consistent saturation and brightness

2. **Transition Smoothness**
   - Before/after screenshots show clean transitions
   - No intermediate incorrect colors
   - No visual glitches during drag

3. **Edge Case Handling**
   - Boundary positions resolve to correct quadrant
   - No ambiguous color states
   - Center point follows expected default behavior

## Success Criteria

### All Tests Must Pass

- ✅ Static position validation: 16/16 positions correct
- ✅ X-axis boundary crossing: 4/4 scenarios correct
- ✅ Y-axis boundary crossing: 2/2 scenarios correct
- ✅ Diagonal boundary crossing: 2/2 scenarios correct
- ✅ Edge cases: 3/3 boundary positions correct
- ✅ Multi-step drag path: 5/5 steps correct

### Visual Quality Standards

- No color artifacts or visual glitches
- Smooth transitions between quadrants
- Consistent border rendering
- No layout shifts during drag

## Troubleshooting

### Test Failures

**Border color mismatch**:
- Check if `calculateQuadrant()` uses normalized coordinates
- Verify `QUADRANT_COLORS` mapping in `OptimizedIdeaCard.tsx`
- Confirm CSS border styles are applied correctly

**Attribute validation fails**:
- Ensure `data-quadrant` attribute is set in card component
- Check if attribute updates on position change
- Verify quadrant calculation logic

**Card not found**:
- Ensure test data exists (at least one card)
- Check matrix selector (`.design-matrix` or `[data-testid="design-matrix"]`)
- Verify authentication if required

**Drag operations fail**:
- Confirm drag-and-drop is enabled
- Check for modal overlays blocking interaction
- Verify matrix dimensions calculation

### Color Tolerance Issues

If color validation fails due to slight RGB differences:

1. Check browser rendering differences
2. Verify CSS color interpolation
3. Adjust tolerance in `colorsAreSimilar()` function (currently 10px per channel)

### Screenshot Comparison

Manual screenshot review checklist:

```bash
# View before/after screenshots side-by-side
open tests/visual/screenshots/quadrant-drag-quick-wins-to-strategic-before.png
open tests/visual/screenshots/quadrant-drag-quick-wins-to-strategic-after.png

# Expected: Green border (before) → Blue border (after)
```

## Test Maintenance

### When to Update Tests

1. **Color Scheme Changes**: Update `QUADRANT_COLORS` and `QUADRANT_COLORS_RGB`
2. **Matrix Dimensions Change**: Update `normalizedToPixel()` padding calculation
3. **Coordinate System Changes**: Update quadrant boundary logic
4. **New Quadrant Types**: Add new test positions and scenarios

### Adding New Test Cases

```typescript
// Add to TEST_POSITIONS array
{
  name: 'custom-position',
  quadrant: 'quick-wins',
  x: 0.3,
  y: 0.2,
  description: 'Custom test position'
}

// Add to DRAG_SCENARIOS array
{
  name: 'custom-drag',
  from: 'quick-wins',
  to: 'strategic',
  description: 'Custom drag scenario'
}
```

## Performance Considerations

### Test Execution Time

- **Total suite**: ~3-5 minutes (depends on card count)
- **Static validation**: ~1 minute (16 positions)
- **Drag scenarios**: ~2-3 minutes (8 scenarios)
- **Edge cases**: ~30 seconds (3 cases)

### Optimization Tips

1. **Reduce wait times**: Lower `page.waitForTimeout()` if animations are fast
2. **Parallel execution**: Run tests in parallel with `--workers=4`
3. **Skip screenshots**: Remove screenshot calls for faster execution
4. **Target specific tests**: Use `-g` flag to run subset

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Quadrant Color Detection Tests

on: [push, pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run dev &
      - run: npx wait-on http://localhost:5173
      - run: npx playwright test tests/visual/quadrant-color-detection.spec.ts
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: quadrant-test-screenshots
          path: tests/visual/screenshots/
```

## Expected Results

### Baseline Expectations

After running the complete test suite, you should see:

```
✅ Static Position Validation: All Quadrants (16 assertions)
✅ X-Axis Boundary Crossing Validation (4 scenarios, 8 assertions)
✅ Y-Axis Boundary Crossing Validation (2 scenarios, 4 assertions)
✅ Diagonal Boundary Crossing Validation (2 scenarios, 4 assertions)
✅ Edge Case: Exact Boundary Positions (3 assertions)
✅ Multi-Step Drag Path: Quadrant Tour (5 assertions)

Total: 6 test groups, 39 assertions, 0 failures
```

### Sample Console Output

```
🎯 Testing static color detection at all quadrant positions

📍 Testing position: quick-wins-center
   Position: (0.25, 0.25)
   Expected quadrant: quick-wins
   Border: Border color matches expected quadrant
   Expected: #10B981 / rgb(16, 185, 129)
   Actual: rgb(16, 185, 129)
   Attribute: Quadrant attribute matches expected
   ✅ PASS

🔄 Testing X-axis boundary crossings

🔀 quick-wins-to-strategic: Drag across X-axis boundary (left to right, top)
   Final: Border color matches expected quadrant
   Expected: #3B82F6 / rgb(59, 130, 246)
   Actual: rgb(59, 130, 246)
   ✅ PASS
```

## Validation Checklist

Before marking the fix as complete:

- [ ] All 6 test groups pass
- [ ] No console errors during test execution
- [ ] Screenshots show correct colors at all positions
- [ ] Border colors match expected quadrant colors
- [ ] No visual artifacts or glitches
- [ ] Smooth transitions during drag operations
- [ ] Edge cases (exact boundaries) handled correctly
- [ ] Multi-step drag path maintains correct colors
- [ ] Data attributes update correctly
- [ ] Tests run consistently across multiple executions

## Contact and Support

For issues or questions about these tests:

1. Review this guide thoroughly
2. Check test console output for specific error messages
3. Examine screenshot artifacts for visual verification
4. Verify fix implementation in `OptimizedIdeaCard.tsx`
5. Consult Playwright documentation for framework-specific issues

## Appendix: Color Reference Chart

### Quick Visual Reference

```
┌─────────────────┬─────────────────┐
│   Quick Wins    │    Strategic    │
│   🟢 GREEN      │    🔵 BLUE      │
│   #10B981       │    #3B82F6      │
│   (0-0.5, 0-0.5)│   (0.5-1, 0-0.5)│
├─────────────────┼─────────────────┤
│   Reconsider    │     Avoid       │
│   🟠 AMBER      │    🔴 RED       │
│   #F59E0B       │    #EF4444      │
│  (0-0.5, 0.5-1) │   (0.5-1, 0.5-1)│
└─────────────────┴─────────────────┘
```

### RGB Color Values

```typescript
const QUADRANT_COLORS_RGB = {
  'quick-wins':  { r: 16,  g: 185, b: 129 }, // Green
  'strategic':   { r: 59,  g: 130, b: 246 }, // Blue
  'reconsider':  { r: 245, g: 158, b: 11  }, // Amber
  'avoid':       { r: 239, g: 68,  b: 68  }  // Red
};
```

### Normalized Coordinate System

```
(0,0) ────────────────────── (1,0)
  │     Quick Wins  │  Strategic    │
  │                 │               │
  │     x < 0.5     │   x >= 0.5    │
(0,0.5) ────────────┼─────────── (1,0.5)
  │                 │               │
  │    Reconsider   │    Avoid      │
  │                 │               │
(0,1) ────────────────────── (1,1)
        y < 0.5 (top)
        y >= 0.5 (bottom)
```