# Playwright Quick Reference

## Which Config Should I Use?

```
┌─────────────────────────────────────────────────────────────┐
│  DECISION TREE: Choose the Right Config                    │
└─────────────────────────────────────────────────────────────┘

Are you testing...

📊 Performance/Benchmarks?
  → Use: playwright.performance.config.ts
  → Command: npm run test:performance
  → Features: Sequential execution, accurate measurement

🎨 Visual appearance/Screenshots?
  → Use: playwright.visual-regression.config.ts
  → Command: npm run test:visual
  → Features: Consistent rendering, cross-browser

⚡ Features/Integration/E2E?
  → Use: playwright.functional.config.ts
  → Command: npm run test:functional
  → Features: Fast parallel execution

🤖 Running in CI/GitHub Actions?
  → Use: playwright.ci.config.ts
  → Command: npm run test:ci
  → Features: Sharding, optimized for CI runners
```

---

## Common Commands

### Local Development

```bash
# Run all functional tests (FAST)
npm run test:functional

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run with UI mode (RECOMMENDED for development)
npm run test:functional:ui

# Run specific browser
npx playwright test --project=firefox

# Debug mode (pause execution)
npm run test:functional:debug

# Headed mode (see browser)
npx playwright test --headed
```

### Performance Testing

```bash
# Run all performance tests
npm run test:performance

# Run specific performance test
npx playwright test tests/performance/core-web-vitals.spec.ts

# View performance report
npm run test:performance:report
```

### Visual Regression

```bash
# Run visual tests
npm run test:visual

# Update baselines (after intentional visual changes)
npm run test:visual:update

# Run visual tests for single browser
npx playwright test --config playwright.visual-regression.config.ts --project=chromium
```

### Cross-Browser Testing

```bash
# Test on all browsers
npx playwright test --project=chromium --project=firefox --project=webkit

# Test on mobile browsers
npx playwright test --project=mobile-chrome --project=mobile-safari

# Test specific file across browsers
npx playwright test tests/e2e/login.spec.ts --project=chromium --project=firefox
```

---

## Configuration Cheat Sheet

| Config | Speed | Workers | Parallel | Use For |
|--------|-------|---------|----------|---------|
| **functional** | ⚡⚡⚡ Fast | 4+ | Yes | Features, E2E, Integration |
| **performance** | 🐌 Slow | 1 | No | Benchmarks, Core Web Vitals |
| **visual** | 🐌 Slow | 1 | No | Screenshots, Visual regression |
| **ci** | ⚡⚡ Fast | 2-4 | Yes | GitHub Actions, CI/CD |

---

## Test Organization Best Practices

### Directory Structure

```
tests/
├── e2e/              # End-to-end user journeys (functional config)
│   ├── auth-flow.spec.ts
│   ├── checkout.spec.ts
│   └── user-profile.spec.ts
│
├── integration/      # Integration tests (functional config)
│   ├── api-integration.spec.ts
│   └── database-integration.spec.ts
│
├── performance/      # Performance tests (performance config)
│   ├── core-web-vitals.spec.ts
│   ├── load-time.spec.ts
│   └── memory-leaks.spec.ts
│
├── visual/           # Visual regression (visual config)
│   ├── homepage-visual.spec.ts
│   ├── components-visual.spec.ts
│   └── responsive-visual.spec.ts
│
└── accessibility/    # A11y tests (functional config)
    ├── wcag-aa.spec.ts
    └── keyboard-navigation.spec.ts
```

### Test Naming

```typescript
// ✅ GOOD: Descriptive test names
test.describe('User Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    // ...
  });

  test('should show error for invalid password', async ({ page }) => {
    // ...
  });
});

// ❌ BAD: Generic test names
test.describe('Tests', () => {
  test('test1', async ({ page }) => {
    // ...
  });
});
```

### Test Tags

```typescript
// Tag tests for selective execution
test.describe('@accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    // Run with: npx playwright test --grep @accessibility
  });
});

test.describe('@critical', () => {
  test('should allow login', async ({ page }) => {
    // Run with: npx playwright test --grep @critical
  });
});

test.describe('@slow', () => {
  test('should handle large dataset', async ({ page }) => {
    test.slow(); // 3x timeout
    // ...
  });
});
```

---

## Performance Testing Patterns

### Core Web Vitals

```typescript
import { test, expect } from '@playwright/test';

test('should meet Core Web Vitals budgets', async ({ page }) => {
  // Navigate to page
  await page.goto('/');

  // Measure performance
  const performanceTimings = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    return {
      // Largest Contentful Paint
      LCP: navigation.loadEventEnd - navigation.fetchStart,
      // First Contentful Paint
      FCP: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
    };
  });

  // Assert budgets
  expect(performanceTimings.LCP).toBeLessThan(2500); // 2.5s
  expect(performanceTimings.FCP).toBeLessThan(1800); // 1.8s
});
```

### Memory Leak Detection

```typescript
test('should not leak memory on route changes', async ({ page }) => {
  await page.goto('/');

  // Get initial memory
  const initialMemory = await page.evaluate(() =>
    (performance as any).memory.usedJSHeapSize
  );

  // Perform operations
  for (let i = 0; i < 10; i++) {
    await page.goto('/dashboard');
    await page.goto('/profile');
  }

  // Get final memory
  const finalMemory = await page.evaluate(() =>
    (performance as any).memory.usedJSHeapSize
  );

  // Assert no significant memory growth
  const memoryGrowth = finalMemory - initialMemory;
  expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024); // 5MB
});
```

---

## Visual Testing Patterns

### Basic Screenshot Comparison

```typescript
test('should match homepage screenshot', async ({ page }) => {
  await page.goto('/');

  // Wait for stability
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Allow animations to complete

  // Take screenshot and compare
  await expect(page).toHaveScreenshot('homepage.png', {
    fullPage: true,
    threshold: 0.15, // 15% difference allowed
  });
});
```

### Hide Dynamic Content

```typescript
test('should match dashboard without timestamps', async ({ page }) => {
  await page.goto('/dashboard');

  // Hide dynamic elements
  await page.addStyleTag({
    content: `
      .timestamp { display: none !important; }
      .user-avatar { display: none !important; }
    `
  });

  await expect(page).toHaveScreenshot('dashboard.png');
});
```

### Responsive Testing

```typescript
test.describe('Responsive Design', () => {
  test('should render correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-mobile.png');
  });

  test('should render correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-tablet.png');
  });

  test('should render correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-desktop.png');
  });
});
```

---

## Debugging Tips

### 1. Use UI Mode (BEST for debugging)

```bash
npx playwright test --ui
```

Features:
- Visual test execution
- Step through tests
- Inspect DOM
- View network requests
- Time travel debugging

### 2. Use Debug Mode

```bash
npx playwright test --debug
```

Features:
- Pauses before each action
- Step through with debugger
- Inspect page state

### 3. Use Headed Mode

```bash
npx playwright test --headed
```

Features:
- See browser window
- Watch test execution
- Visual feedback

### 4. Playwright Inspector

```typescript
test('debug specific test', async ({ page }) => {
  await page.goto('/');

  // Add breakpoint
  await page.pause();

  // Continue with test...
});
```

### 5. Console Logs

```typescript
test('debug with console logs', async ({ page }) => {
  // Listen to console
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  // Listen to errors
  page.on('pageerror', err => console.log('ERROR:', err));

  await page.goto('/');
});
```

### 6. Screenshots on Specific Steps

```typescript
test('capture intermediate state', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: 'step1-initial.png' });

  await page.click('#login-button');
  await page.screenshot({ path: 'step2-after-click.png' });

  await page.fill('#password', 'secret');
  await page.screenshot({ path: 'step3-after-fill.png' });
});
```

---

## Environment Variables

```bash
# Local development
TEST_PORT=3003 npx playwright test

# CI environment
CI=true npx playwright test

# Update visual snapshots
UPDATE_SNAPSHOTS=true npx playwright test

# Debug mode
DEBUG=true npx playwright test

# Custom worker count
WORKERS=4 npx playwright test

# Test sharding (CI)
SHARD_INDEX=1 SHARD_TOTAL=4 npx playwright test
```

---

## Troubleshooting

### Test Timeout

```typescript
// Increase timeout for specific test
test('slow operation', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes
  // ...
});

// Increase timeout for all tests in describe block
test.describe('Slow Tests', () => {
  test.setTimeout(120000);

  test('test1', async ({ page }) => { /* ... */ });
  test('test2', async ({ page }) => { /* ... */ });
});
```

### Flaky Tests

```typescript
// Retry specific test
test('flaky test', async ({ page }) => {
  test.fixme(); // Skip for now
  // or
  test.skip(); // Skip entirely
});

// Mark test as slow (3x timeout)
test('slow test', async ({ page }) => {
  test.slow();
  // ...
});
```

### Visual Test Failures

```bash
# Update baseline if intentional change
UPDATE_SNAPSHOTS=true npx playwright test tests/visual/

# Increase threshold for specific test
await expect(page).toHaveScreenshot('name.png', {
  threshold: 0.3, // 30% difference allowed
});
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# Minimal example
- name: Run Playwright tests
  run: npx playwright test --config playwright.ci.config.ts

# With sharding
- name: Run Playwright tests (shard ${{ matrix.shard }})
  run: npx playwright test --shard=${{ matrix.shard }}/4

# Specific browser
- name: Run Playwright tests (Firefox)
  run: npx playwright test --project=firefox
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
npx playwright test --config playwright.functional.config.ts
```

---

## Performance Expectations

| Test Suite | Local (Parallel) | CI (Sharded) |
|------------|------------------|--------------|
| Functional (all) | 3-5 min | 5-10 min |
| Performance | 10-15 min | 15-20 min |
| Visual | 5-10 min | 10-15 min |
| Cross-Browser | 10-15 min | 10-15 min |

---

## Getting Help

1. **Playwright Documentation**: https://playwright.dev
2. **Playwright Discord**: https://discord.gg/playwright
3. **GitHub Issues**: https://github.com/microsoft/playwright/issues
4. **Stack Overflow**: Tag `playwright`

---

## Quick Wins

### Speed up tests
```bash
# Run only changed tests
npx playwright test --only-changed

# Run tests matching pattern
npx playwright test auth

# Run single test
npx playwright test -g "should login"
```

### Reduce flakiness
```typescript
// Use auto-waiting assertions
await expect(page.locator('button')).toBeVisible();

// Don't use fixed delays
// ❌ await page.waitForTimeout(1000);
// ✅ await page.waitForLoadState('networkidle');
```

### Better debugging
```bash
# Generate trace on all tests
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

---

**Remember**:
- Use **functional config** for daily development (fastest)
- Use **performance config** for benchmarks (accurate)
- Use **visual config** for design validation (consistent)
- Use **ci config** for automated pipelines (optimized)
