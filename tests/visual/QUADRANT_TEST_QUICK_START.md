# Quadrant Color Detection Test - Quick Start

## Quick Test Execution

```bash
# Run all quadrant color detection tests
npx playwright test tests/visual/quadrant-color-detection.spec.ts

# Run with visible browser
npx playwright test tests/visual/quadrant-color-detection.spec.ts --headed

# Run and generate report
npx playwright test tests/visual/quadrant-color-detection.spec.ts --reporter=html
```

## What This Tests

Visual validation that cards change colors correctly when dragged across quadrant boundaries.

## Expected Color Mappings

| Quadrant | Position | Color | Hex |
|----------|----------|-------|-----|
| Quick Wins (Top-Left) | x<0.5, y<0.5 | 🟢 Green | `#10B981` |
| Strategic (Top-Right) | x≥0.5, y<0.5 | 🔵 Blue | `#3B82F6` |
| Reconsider (Bottom-Left) | x<0.5, y≥0.5 | 🟠 Amber | `#F59E0B` |
| Avoid (Bottom-Right) | x≥0.5, y≥0.5 | 🔴 Red | `#EF4444` |

## Test Coverage

- ✅ **Static Positions**: 16 fixed positions across all quadrants
- ✅ **X-Axis Crossings**: 4 horizontal boundary crossings
- ✅ **Y-Axis Crossings**: 2 vertical boundary crossings
- ✅ **Diagonal Crossings**: 2 corner-to-corner drags
- ✅ **Edge Cases**: 3 exact boundary positions
- ✅ **Multi-Step Path**: Complete tour through all quadrants

## Success Criteria

All tests should pass with:
- Correct border colors at all positions
- Correct `data-quadrant` attributes
- No visual artifacts or glitches
- Smooth color transitions

## Screenshots

All test screenshots saved to: `tests/visual/screenshots/`

## Full Documentation

See `QUADRANT_COLOR_DETECTION_TEST_GUIDE.md` for complete details.

## Quick Validation

```bash
# 1. Start dev server
npm run dev

# 2. Run tests
npx playwright test tests/visual/quadrant-color-detection.spec.ts

# 3. Check results
# Expected: 6 test groups, 39 assertions, 0 failures

# 4. View screenshots
open tests/visual/screenshots/
```

## Troubleshooting

**Tests fail?**
1. Check dev server is running on `http://localhost:5173`
2. Ensure at least one card exists in matrix
3. Verify authentication is working
4. Check console for specific error messages

**Color mismatch?**
- Verify fix in `OptimizedIdeaCard.tsx` line 79-86
- Check `calculateQuadrant()` uses normalized coordinates
- Confirm `QUADRANT_COLORS` mapping is correct

## Quick Visual Reference

```
┌─────────────┬─────────────┐
│ Quick Wins  │  Strategic  │
│   GREEN     │    BLUE     │
├─────────────┼─────────────┤
│ Reconsider  │   Avoid     │
│   AMBER     │    RED      │
└─────────────┴─────────────┘
```