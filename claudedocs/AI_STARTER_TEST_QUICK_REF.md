# AI Starter Test - Quick Reference

## Run Commands (Copy & Paste)

### Basic Execution
```bash
# Run all AI Starter tests
npx playwright test tests/e2e/ai-starter-ideas.spec.ts

# Run with visible browser
npx playwright test tests/e2e/ai-starter-ideas.spec.ts --headed

# Run main test only
npx playwright test tests/e2e/ai-starter-ideas.spec.ts -g "AI-STARTER-001"
```

### Debug Mode
```bash
# Step-by-step debugging
npx playwright test tests/e2e/ai-starter-ideas.spec.ts --debug

# Keep browser open on failure
npx playwright test tests/e2e/ai-starter-ideas.spec.ts --headed --debug
```

### View Results
```bash
# Open HTML report
npx playwright show-report

# View trace file
npx playwright show-trace trace.zip
```

---

## What This Test Does

1. ✅ Opens "New Project" flow
2. ✅ Fills in project details
3. ✅ Enables AI idea generation
4. ✅ Creates project with 5 AI-generated ideas
5. ❌ **VERIFIES IDEAS APPEAR IN MATRIX** ← This is the failing part

---

## Expected Output (Bug Fixed)

```
📊 FINAL COUNT: 5 idea cards visible
📊 EXPECTED: 5 idea cards

✅ "User Authentication System"
✅ "Dashboard Analytics"
✅ "Email Notifications"
✅ "Mobile App"
✅ "Dark Mode"

Empty state visible: ✅ NO (GOOD)
✅ ALL ASSERTIONS PASSED
```

---

## Current Output (Bug Exists)

```
📊 FINAL COUNT: 0 idea cards visible
📊 EXPECTED: 5 idea cards

❌ "User Authentication System"
❌ "Dashboard Analytics"
❌ "Email Notifications"
❌ "Mobile App"
❌ "Dark Mode"

Empty state visible: ❌ YES (BAD)
❌ Test Failed: Expected 5 but received 0
```

---

## Screenshots Generated

All saved to `test-results/screenshots/`:

1. `ai-starter-step1-modal.png` - Initial modal
2. `ai-starter-step3-after-ai.png` - After AI generation (shows 5 ideas)
3. `ai-starter-matrix-page.png` - Matrix page (should show 5 cards)
4. `ai-starter-final-state.png` - Final state for debugging

---

## Key Test Scenarios

| Test ID | Scenario | Status |
|---------|----------|--------|
| AI-STARTER-001 | Complete flow with idea verification | 🔴 FAILING |
| AI-STARTER-002 | Quadrant positioning validation | 🔴 FAILING |
| AI-STARTER-003 | Idea count in guides | 🔴 FAILING |
| AI-STARTER-004 | Error handling | 🟢 PASSING |
| AI-STARTER-005 | Performance (< 30s) | 🟢 PASSING |

---

## Test Selectors Used

The test tries multiple selectors to find ideas:

1. `[data-testid^="idea-card-"]` - Data test IDs
2. `.idea-card-base` - Base class
3. `[class*="idea-card"]` - Any idea-card class
4. `text="User Authentication System"` - By content

**This reveals WHERE the breakdown occurs.**

---

## Success Criteria

Test passes when:
- ✅ 5 idea cards visible
- ✅ All idea content searchable
- ✅ Empty state NOT shown
- ✅ Quadrant guides show counts

Test fails when:
- ❌ 0 idea cards found
- ❌ Empty state shown
- ❌ No idea content in DOM

---

## Troubleshooting

### Test Hangs
```bash
# Increase timeout
npx playwright test --timeout=60000 tests/e2e/ai-starter-ideas.spec.ts
```

### Can't See What's Happening
```bash
# Show browser
npx playwright test --headed tests/e2e/ai-starter-ideas.spec.ts
```

### Need More Debug Info
```bash
# Enable trace
npx playwright test --trace on tests/e2e/ai-starter-ideas.spec.ts
```

---

## Files

- **Test**: `tests/e2e/ai-starter-ideas.spec.ts`
- **Guide**: `claudedocs/AI_STARTER_TEST_GUIDE.md`
- **Quick Ref**: `claudedocs/AI_STARTER_TEST_QUICK_REF.md`

---

## Next Action

Run the test and check if bug still exists:

```bash
npx playwright test tests/e2e/ai-starter-ideas.spec.ts --headed -g "AI-STARTER-001"
```

Then review the console output and screenshots to understand the failure.
