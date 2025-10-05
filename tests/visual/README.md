# Visual Testing Suite - Quick Reference

## 🚀 Quick Start

```bash
# Install Playwright browsers
npm run playwright:install

# Start dev server (in another terminal)
npm run dev

# Run all visual tests
npm run visual:test

# Run specific test suites
npm run visual:test:auth      # Authentication flow tests
npm run visual:test:flicker   # Flickering detection tests
npm run visual:test:responsive # Responsive design tests
npm run visual:test:regression # Visual regression tests
npm run test:redesign         # Card redesign validation tests
```

---

# Card Redesign Visual Regression Testing

Comprehensive test suite to validate the card redesign implementation.

## Redesign Goals

- **30-40% smaller dimensions**: Reduce card footprint for better matrix density
- **Colored borders**: Match quadrant colors for visual clarity
- **Smaller fonts**: Improve information density
- **Compact spacing**: Less padding for tighter design
- **Simplified states**: Cleaner collapsed/expanded transitions

## Test Coverage

### 1. Dimension Validation
- **Expanded state**: Verify 160-200px width, 115-145px height
- **Collapsed state**: Verify 55-85px height
- **Area reduction**: Confirm 30-40% total area reduction
- **Baseline comparison**: Compare against 280x200px baseline

### 2. Border Colors
- **Quick Wins**: Green (rgb(16, 185, 129))
- **Big Bets**: Blue (rgb(59, 130, 246))
- **Incremental**: Orange (rgb(249, 115, 22))
- **Thankless**: Red (rgb(239, 68, 68))

### 3. Typography
- **Title**: 14-16px (down from 18-20px)
- **Description**: 12-14px (down from 14-16px)
- **Metadata**: 10-12px (down from 12-14px)

### 4. Spacing
- **Padding**: 8-12px (down from 16-20px)
- **Gap**: Proportionally reduced
- **Compact layout**: Verified through measurements

### 5. Visual States
- **Hover**: Transform and shadow effects
- **Drag**: Opacity and cursor changes
- **Expanded/Collapsed**: Smooth transitions

### 6. Accessibility
- **Contrast ratio**: ≥4.5:1 (WCAG AA)
- **Visual hierarchy**: Maintained in compact design
- **Border visibility**: Sufficient contrast

## Running Redesign Tests

### Full Test Suite
```bash
npm run test:redesign
```

### Specific Test
```bash
npx playwright test tests/visual/card-redesign-validation.spec.ts --config playwright.redesign.config.ts
```

### With UI Mode
```bash
npx playwright test --ui --config playwright.redesign.config.ts
```

### Specific Browser
```bash
npx playwright test --project=chromium --config playwright.redesign.config.ts
```

## Test Output

### Screenshots
All screenshots are saved to: `tests/visual/card-redesign-screenshots/`

#### Comparison Images
- `card-{n}-expanded-after.png` - Individual expanded cards
- `card-{n}-collapsed-after.png` - Individual collapsed cards
- `matrix-expanded-cards-after.png` - Full matrix with expanded cards
- `matrix-collapsed-cards-after.png` - Full matrix with collapsed cards

#### Border Validation
- `border-quick-wins.png`
- `border-big-bets.png`
- `border-incremental.png`
- `border-thankless.png`

#### Interaction States
- `card-hover-before.png` / `card-hover-after.png`
- `card-drag-before.png` / `card-drag-during.png`

#### Analysis
- `typography-validation.png`
- `contrast-validation.png`
- `comparison-{state}-after.png`

### Reports
- HTML Report: `playwright-report/redesign/index.html`
- JSON Results: `test-results/redesign-results.json`

### Console Output
Each test logs detailed metrics:
```json
{
  "dimensions": {
    "width": 180,
    "height": 130,
    "area": 23400
  },
  "border": {
    "width": "2px",
    "color": "rgb(16, 185, 129)",
    "style": "solid"
  },
  "typography": {
    "titleFontSize": "15px",
    "descriptionFontSize": "13px",
    "metadataFontSize": "11px"
  }
}
```

## Validation Checklist

### Before Running Tests
- [ ] Dev server running on port 3005
- [ ] Test project data properly seeded
- [ ] Screenshot directory exists
- [ ] Baseline metrics documented

### After Running Tests
- [ ] All dimension tests pass (30-40% reduction)
- [ ] Border colors match quadrant colors
- [ ] Typography meets size targets
- [ ] Spacing meets compact targets
- [ ] Contrast ratios meet WCAG AA (≥4.5:1)
- [ ] Hover/drag states work correctly
- [ ] Screenshots captured successfully

## Debugging Redesign Tests

### View Test in Debug Mode
```bash
npx playwright test --debug tests/visual/card-redesign-validation.spec.ts
```

### Common Issues

**Cards not visible**
- Check authentication bypass is working
- Verify test project is created correctly
- Ensure dev server is running

**Incorrect dimensions**
- Clear browser cache
- Check CSS is loaded correctly
- Verify no conflicting styles

**Border colors don't match**
- Check quadrant assignment logic
- Verify CSS color variables
- Ensure computed styles are correct

---

## 📁 Directory Structure

```
tests/visual/
├── run-visual-tests.js       # Main test runner
├── setup/
│   ├── global-setup.ts       # Test environment setup
│   └── global-teardown.ts    # Cleanup and reporting
├── utils/
│   ├── visual-helpers.ts     # Core testing utilities
│   └── test-data.ts         # Test data and fixtures
├── auth-flow.test.ts         # Auth flow visual tests
├── flickering-detection.test.ts # Flickering detection
├── responsive-design.test.ts # Responsive testing
├── regression-testing.test.ts # Regression detection
└── README.md                # This file
```

## 🎯 Test Suites Overview

| Suite | Purpose | Key Features |
|-------|---------|--------------|
| **auth-flow** | Core authentication visual validation | Form states, mode transitions, loading states |
| **flickering** | Advanced flickering detection | Layout stability, performance impact analysis |
| **responsive** | Cross-viewport testing | Mobile/tablet/desktop layouts, touch targets |
| **regression** | Automated regression detection | Baseline management, cross-browser testing |

## 🔧 Common Commands

### Development
```bash
# Debug tests (see browser)
npm run visual:debug

# Update visual baselines after UI changes
npm run visual:update

# Test specific viewport
VIEWPORT=mobile npm run visual:test:responsive

# Test with different base URL
BASE_URL=http://localhost:3000 npm run visual:test
```

### CI/CD
```bash
# Run in headless mode with CI optimizations
CI=true HEADLESS=true npm run visual:test

# Generate CI-friendly reports
CI=true npm run visual:test > visual-test-results.log
```

## 📊 Understanding Results

### Success Indicators
- ✅ All screenshots match baselines
- 🎯 No flickering detected (< 10% variation)
- 📐 Layout shifts within limits (< 0.1 CLS)
- ⚡ Performance within thresholds

### Failure Investigation
1. **Check HTML Report**: `test-results/html-report/index.html`
2. **Compare Screenshots**: `test-results/screenshots/`
3. **Review Baselines**: `test-results/baselines/`
4. **Check Summary**: `test-results/visual-test-summary.json`

## 🚨 Key Thresholds

| Metric | Good | Warning | Poor |
|--------|------|---------|------|
| Visual Similarity | > 90% | 85-90% | < 85% |
| Flickering Variation | < 5% | 5-10% | > 10% |
| Layout Shift (CLS) | < 0.1 | 0.1-0.25 | > 0.25 |
| Load Time | < 3s | 3-5s | > 5s |

## 🔍 Troubleshooting

### Common Issues

**"Screenshot comparison failed"**
```bash
# Update baselines if changes are expected
npm run visual:update
```

**"Server not running"**
```bash
# Ensure dev server is running
npm run dev
# In another terminal, run tests
npm run visual:test
```

**"Flickering detected"**
```typescript
// Adjust threshold in test file
const flickerResult = await visualHelper.detectFlickering({
  threshold: 0.08, // Increase from 0.05
  samples: 3       // Reduce from 5
});
```

**"Browser not found"**
```bash
# Reinstall Playwright browsers
npm run playwright:install
```

## 📚 Additional Resources

- **Complete Guide**: `/VISUAL_TESTING_GUIDE.md`
- **Playwright Config**: `/playwright.visual.config.ts`
- **Test Results**: `/test-results/`
- **HTML Reports**: `/test-results/html-report/index.html`

## 🎯 Best Practices

1. **Always update baselines** after intentional UI changes
2. **Review visual diffs** before accepting baseline updates
3. **Run auth tests first** before other suites during development
4. **Use debug mode** (`npm run visual:debug`) for investigation
5. **Clean test results** regularly to manage disk space

## 📞 Quick Help

For immediate help:
```bash
# Show all available commands
npm run visual:test -- --help

# Run with verbose output for debugging
VERBOSE=true npm run visual:test

# Test single scenario
npx playwright test --config=playwright.visual.config.ts -g "login flow"
```