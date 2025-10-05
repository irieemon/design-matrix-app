# Card Redesign Visual Tests - Quick Start

Get started testing the card redesign in under 2 minutes.

## Prerequisites (One-Time Setup)

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run playwright:install
```

## Running Tests (Every Time)

### Terminal 1: Start Dev Server
```bash
npm run dev
```

### Terminal 2: Run Tests
```bash
# Option 1: Run all tests (recommended)
npm run test:redesign

# Option 2: Run with UI (see browser)
npm run test:redesign:ui

# Option 3: Run with debug (step-by-step)
npm run test:redesign:debug
```

## View Results

```bash
# Automatic: HTML report opens after tests
# Manual: Open the report
open playwright-report/redesign/index.html

# View screenshots
open tests/visual/card-redesign-screenshots/
```

## Understanding Results

### All Tests Pass ✅
```
✅ 10/10 tests passed
✅ Dimensions within 30-40% reduction target
✅ Border colors match quadrants
✅ Typography optimized for density
✅ Spacing compact yet usable
✅ Contrast ratios pass WCAG AA
```

**Action**: Review screenshots for visual approval, proceed with deployment.

### Some Tests Fail ❌
```
❌ 2/10 tests failed
   - Card Dimensions - Expanded State
   - Border Colors Match Quadrants
```

**Action**:
1. Open HTML report: `playwright-report/redesign/index.html`
2. Click on failed test to see details
3. Review screenshot comparisons
4. Fix issues and re-run tests

## Common Commands

```bash
# Run all tests
npm run test:redesign

# Run with UI mode (best for development)
npm run test:redesign:ui

# Run in debug mode (step through tests)
npm run test:redesign:debug

# Run specific test
npx playwright test tests/visual/card-redesign-validation.spec.ts \
  --config playwright.redesign.config.ts \
  -g "Card Dimensions"

# Run on specific browser
npx playwright test tests/visual/card-redesign-validation.spec.ts \
  --config playwright.redesign.config.ts \
  --project=chromium
```

## What Gets Tested

1. **Card Dimensions**: 30-40% size reduction
2. **Border Colors**: Match quadrant colors
3. **Typography**: Font sizes for information density
4. **Spacing**: Compact padding without cramping
5. **Visual Hierarchy**: Contrast ratios (WCAG AA)
6. **Hover State**: Interactive feedback
7. **Drag State**: Drag-and-drop functionality
8. **Comparisons**: Before/after visual validation
9. **Reduction Validation**: Mathematical verification

## Test Output Locations

- **HTML Report**: `playwright-report/redesign/index.html`
- **Screenshots**: `tests/visual/card-redesign-screenshots/*.png`
- **JSON Results**: `test-results/redesign-results.json`
- **Console**: Detailed metrics during test run

## Troubleshooting

### "Server not running" error
```bash
# Make sure dev server is running in another terminal
npm run dev
```

### "Element not found" errors
```bash
# Clear cache and restart
rm -rf node_modules/.vite
npm run dev
npm run test:redesign
```

### Tests take too long
```bash
# Run on single browser only
npx playwright test tests/visual/card-redesign-validation.spec.ts \
  --config playwright.redesign.config.ts \
  --project=chromium
```

### Screenshots don't look right
```bash
# Run in UI mode to see live browser
npm run test:redesign:ui
```

## Next Steps

- **Full Documentation**: See `CARD_REDESIGN_TEST_GUIDE.md`
- **Detailed Guide**: See `tests/visual/README.md`
- **Test Suite Overview**: See `CARD_REDESIGN_TEST_SUITE.md`

## Need Help?

1. Check the HTML report for detailed error information
2. Review screenshots for visual discrepancies
3. Read the comprehensive guide: `CARD_REDESIGN_TEST_GUIDE.md`
4. Run in debug mode: `npm run test:redesign:debug`