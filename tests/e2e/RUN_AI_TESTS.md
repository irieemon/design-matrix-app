# E2E Test Suite - Quick Start Guide

## AI Features E2E Tests

### Test Files
- **ai-generation-journey.spec.ts** (35 tests) - AI idea generation workflows
- **ai-file-analysis-journey.spec.ts** (30 tests) - AI file analysis workflows

### Quick Run Commands

```bash
# Run all AI E2E tests
npm run test:e2e:ai

# Or with Playwright directly
npx playwright test tests/e2e/ai-*.spec.ts

# Run specific test file
npx playwright test tests/e2e/ai-generation-journey.spec.ts
npx playwright test tests/e2e/ai-file-analysis-journey.spec.ts

# Run in headed mode (see browser)
npx playwright test tests/e2e/ai-*.spec.ts --headed

# Run in debug mode
npx playwright test tests/e2e/ai-*.spec.ts --debug

# Run specific test by name
npx playwright test tests/e2e/ai-generation-journey.spec.ts -g "should generate AI ideas"

# Generate HTML report
npx playwright test tests/e2e/ai-*.spec.ts --reporter=html
npx playwright show-report
```

### Test Coverage

**AI Generation (35 tests)**
- ✅ Generate AI ideas with loading states
- ✅ AI idea quality validation
- ✅ Accept/reject suggestions
- ✅ Regenerate ideas
- ✅ Quadrant distribution
- ✅ Custom prompts
- ✅ AI insights modal
- ✅ Roadmap generation
- ✅ Error handling
- ✅ Rate limiting

**File Analysis (30 tests)**
- ✅ Upload PDF/image/audio/video
- ✅ Analysis loading states
- ✅ View results with insights
- ✅ Analysis caching
- ✅ GPT-4V image analysis
- ✅ Whisper audio transcription
- ✅ Text document analysis
- ✅ Batch file processing
- ✅ Error recovery
- ✅ File validation

### API Mocking Strategy

All AI API calls are mocked for:
- **Deterministic results** - Tests produce consistent outcomes
- **Fast execution** - No real API latency
- **No API costs** - No OpenAI charges during testing
- **Offline testing** - Works without internet connection

### User Journeys Tested

1. **First-Time AI User**
   - Generate ideas → Review suggestions → Accept to matrix → View insights

2. **File Analysis Power User**
   - Upload documents → Analyze content → Review insights → Generate report

3. **Rate Limit Experience**
   - Generate ideas → Hit limit → See message → Retry after cooldown

4. **Error Recovery**
   - Upload fails → Retry → Analysis fails → Retry → Success

### Performance Benchmarks

- AI idea generation: < 3 seconds
- Image analysis (GPT-4V): < 5 seconds
- Audio transcription: < 10 seconds
- PDF analysis: < 3 seconds
- Batch analysis (5 files): < 15 seconds

### Troubleshooting

**Tests failing with "Cannot find element"**
- Check if app is running: `npm run dev`
- Verify baseURL in playwright.config.ts: `http://localhost:3007`

**Tests timing out**
- Increase timeout: `test.setTimeout(60000)`
- Check for actual network calls (should be mocked)

**Mock data not working**
- Verify route patterns match actual API endpoints
- Check browser DevTools Network tab during test run

**Authentication issues**
- Tests use demo mode by default
- Check authenticateUser() helper function

### Adding New Tests

1. Create new test file: `tests/e2e/ai-[feature].spec.ts`
2. Import test utilities and types
3. Setup API mocking in beforeEach
4. Write test scenarios using AAA pattern:
   - **Arrange**: Setup test data and mocks
   - **Act**: Perform user actions
   - **Assert**: Verify expected outcomes

Example:
```typescript
test('should generate AI ideas', async ({ page }) => {
  // Arrange
  await mockAIAPIs(page);
  await authenticateUser(page);

  // Act
  const aiButton = page.locator('button:has-text("Generate AI Ideas")');
  await aiButton.click();
  await page.waitForTimeout(3000);

  // Assert
  const ideaCards = page.locator('.idea-card');
  expect(await ideaCards.count()).toBeGreaterThan(0);
});
```

### CI/CD Integration

Add to GitHub Actions workflow:
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run AI E2E Tests
  run: npx playwright test tests/e2e/ai-*.spec.ts

- name: Upload Test Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

### Best Practices

✅ **DO**
- Mock all AI API calls
- Use data-testid attributes for stable selectors
- Test loading states and animations
- Verify error messages are user-friendly
- Test rate limiting scenarios
- Clean up test files created during tests

❌ **DON'T**
- Make real AI API calls in tests
- Use hardcoded waits (use waitFor instead)
- Skip error scenarios
- Ignore accessibility testing
- Commit test files to repo

### Resources

- [Playwright Documentation](https://playwright.dev)
- [AI E2E Tests Summary](./AI_E2E_TESTS_SUMMARY.md)
- [Test Report](http://localhost:9323) - After running with --reporter=html

---

**Total Coverage**: 65 E2E tests across 2 files
**Last Updated**: 2025-09-30
**Maintained By**: QA Engineering Team
