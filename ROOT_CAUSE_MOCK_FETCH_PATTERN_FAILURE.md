# Root Cause Analysis: Mock Fetch Pattern Failures

**Date**: 2025-10-05
**Analyst**: Claude (Root Cause Analyst Persona)
**Severity**: High (40+ tests failing)
**Status**: Analysis Complete - Fix Plan Ready

---

## Executive Summary

**Problem**: 40+ API tests failing with error "mockFetch.mockResolvedValue is not a function"

**Root Cause**: Fundamental mismatch between mock target (node-fetch module) and actual implementation (global fetch API)

**Impact**: 5 test suites completely broken, blocking CI/CD pipeline

**Resolution**: Replace vi.mock('node-fetch') pattern with global.fetch = vi.fn() pattern across 5 test files

---

## 1. ROOT CAUSE ANALYSIS

### The Core Problem

**Mismatch Between Mock and Implementation**

The failing tests mock the `node-fetch` module:
```typescript
// INCORRECT PATTERN (Failing Tests)
vi.mock('node-fetch', () => ({
  default: vi.fn()
}))
mockFetch = (require('node-fetch') as any).default
mockFetch.mockResolvedValue(...) // FAILS - not a Vitest mock function
```

However, the actual API handlers use the **global fetch API**:
```typescript
// From generate-roadmap-v2.ts line 130
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  // Uses GLOBAL fetch, not node-fetch module
})
```

### Why It Fails

1. **vi.mock('node-fetch')** creates a module mock of the node-fetch package
2. **require('node-fetch').default** returns the mocked module export
3. **The handler never imports or uses node-fetch** - it uses global fetch
4. **mockFetch.mockResolvedValue()** fails because mockFetch is not a Vitest mock function, just a plain vi.fn()
5. **Even if the syntax worked**, the mock would never intercept the actual fetch calls because they're targeting a different function (global.fetch vs node-fetch module)

### Why Global Fetch Pattern Works

```typescript
// CORRECT PATTERN (Working Tests)
global.fetch = vi.fn()

// Later in tests:
(global.fetch as any).mockResolvedValue({
  ok: true,
  json: async () => ({ ... })
})
```

This works because:
1. **Direct assignment** to global.fetch replaces the actual function the handlers call
2. **vi.fn()** creates a proper Vitest mock with mockResolvedValue, mockImplementation, etc.
3. **The mock intercepts** all fetch calls in the handler code
4. **Type assertion** (global.fetch as any) bypasses TypeScript limitations

---

## 2. EVIDENCE COLLECTED

### Failing Tests (5 files)
All use the **INCORRECT** vi.mock('node-fetch') pattern:

1. `/api/ai/__tests__/generate-roadmap-v2.test.ts` (Lines 8-10, 33, 95+)
2. `/api/ai/__tests__/generate-insights.test.ts`
3. `/api/ai/__tests__/analyze-image.test.ts`
4. `/api/ai/__tests__/transcribe-audio.test.ts`
5. `/api/ai/__tests__/analyze-file.test.ts`

### Working Tests (2 files)
All use the **CORRECT** global.fetch pattern:

1. `/api/__tests__/ai-generate-ideas.test.ts` (Line 15)
2. `/api/ai/__tests__/ai-endpoints-security.test.ts` (Line 35)

### API Handlers (6 files)
All use **global fetch**, none import node-fetch:

1. `/api/ai/analyze-file.ts`
2. `/api/ai/generate-ideas.ts`
3. `/api/ai/analyze-image.ts`
4. `/api/ai/generate-roadmap-v2.ts`
5. `/api/ai/transcribe-audio.ts`
6. `/api/ai/generate-insights.ts`

---

## 3. SYSTEMATIC FIX PLAN

### Step-by-Step Fix for Each Test File

**For ALL 5 failing test files**, apply this transformation:

#### BEFORE (Incorrect Pattern):
```typescript
// Mock dependencies
vi.mock('../../auth/middleware')
vi.mock('node-fetch', () => ({
  default: vi.fn()
}))

describe('API endpoint', () => {
  let mockFetch: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup fetch mock
    mockFetch = (require('node-fetch') as any).default

    // ... other setup
  })

  it('should do something', async () => {
    mockFetch.mockResolvedValue({  // FAILS HERE
      ok: true,
      json: async () => ({ ... })
    })

    // ... test code
  })
})
```

#### AFTER (Correct Pattern):
```typescript
// Mock dependencies
vi.mock('../../auth/middleware')

// Mock external APIs
global.fetch = vi.fn()

describe('API endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // ... other setup (remove mockFetch setup)
  })

  it('should do something', async () => {
    (global.fetch as any).mockResolvedValue({  // WORKS
      ok: true,
      json: async () => ({ ... })
    })

    // ... test code
  })
})
```

### Specific Changes for Each File

#### 1. generate-roadmap-v2.test.ts
- **Remove**: Lines 8-10 (vi.mock('node-fetch'))
- **Remove**: Line 17 (let mockFetch: any)
- **Remove**: Line 33 (mockFetch = require...)
- **Add**: After line 7, add: `global.fetch = vi.fn()`
- **Replace**: All `mockFetch.mockResolvedValue(...)` with `(global.fetch as any).mockResolvedValue(...)`
- **Estimated locations**: Lines 95, 130, 165, 200, 235, 270, 305, 340, etc.

#### 2. generate-insights.test.ts
- Same pattern as #1
- Search for all `mockFetch` references and replace

#### 3. analyze-image.test.ts
- Same pattern as #1
- Search for all `mockFetch` references and replace

#### 4. transcribe-audio.test.ts
- Same pattern as #1
- Search for all `mockFetch` references and replace

#### 5. analyze-file.test.ts
- Same pattern as #1
- Search for all `mockFetch` references and replace

---

## 4. VALIDATION STRATEGY

### Pre-Fix Validation
```bash
# Confirm current failure state
npm test -- generate-roadmap-v2.test.ts
# Expected: 40+ failures with "mockResolvedValue is not a function"
```

### Post-Fix Validation (Per File)
```bash
# Test each file individually after fix
npm test -- generate-roadmap-v2.test.ts
npm test -- generate-insights.test.ts
npm test -- analyze-image.test.ts
npm test -- transcribe-audio.test.ts
npm test -- analyze-file.test.ts

# Expected: All tests pass
```

### Full Suite Validation
```bash
# Run all API tests
npm test -- api/__tests__/
npm test -- api/ai/__tests__/

# Expected: 100% pass rate
```

### Quality Gates
- [ ] Zero "mockResolvedValue is not a function" errors
- [ ] All 5 test files pass individually
- [ ] Full test suite passes
- [ ] No new TypeScript errors introduced
- [ ] Mock implementation matches actual handler behavior

---

## 5. PATTERN DOCUMENTATION

### CORRECT Pattern for API Handler Tests in This Codebase

```typescript
/**
 * Standard Pattern for Testing API Handlers That Use Fetch
 *
 * Use this pattern for ALL API endpoint tests that need to mock
 * external fetch calls (OpenAI, Supabase, etc.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../your-handler'
import { authenticate, checkUserRateLimit } from '../../auth/middleware'

// 1. Mock auth middleware (standard)
vi.mock('../../auth/middleware')

// 2. Mock global fetch API (NOT node-fetch module)
global.fetch = vi.fn()

describe('Your API Endpoint', () => {
  let mockRequest: Partial<VercelRequest>
  let mockResponse: Partial<VercelResponse>
  let statusMock: ReturnType<typeof vi.fn>
  let jsonMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup response mocks
    statusMock = vi.fn().mockReturnThis()
    jsonMock = vi.fn().mockReturnThis()

    mockResponse = {
      status: statusMock,
      json: jsonMock
    }

    // Setup environment variables
    process.env.OPENAI_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle successful API call', async () => {
    // Arrange
    mockRequest = {
      method: 'POST',
      body: { /* test data */ },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' }
    }

    vi.mocked(authenticate).mockResolvedValue({ user: { id: 'test-user' } })
    vi.mocked(checkUserRateLimit).mockReturnValue(true)

    // 3. Mock fetch response using (global.fetch as any)
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        // Your expected API response
        choices: [{ message: { content: 'test' } }]
      })
    })

    // Act
    await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

    // Assert
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key'
        })
      })
    )
    expect(statusMock).toHaveBeenCalledWith(200)
  })

  it('should handle API errors', async () => {
    mockRequest = { /* ... */ }

    vi.mocked(authenticate).mockResolvedValue({ user: { id: 'test-user' } })
    vi.mocked(checkUserRateLimit).mockReturnValue(true)

    // Mock fetch failure
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

    expect(statusMock).toHaveBeenCalledWith(500)
  })
})
```

### Before/After Comparison

| Aspect | INCORRECT (node-fetch) | CORRECT (global.fetch) |
|--------|------------------------|------------------------|
| **Mock Setup** | `vi.mock('node-fetch', () => ({ default: vi.fn() }))` | `global.fetch = vi.fn()` |
| **Mock Reference** | `mockFetch = require('node-fetch').default` | Direct use of `global.fetch` |
| **Mock Usage** | `mockFetch.mockResolvedValue(...)` | `(global.fetch as any).mockResolvedValue(...)` |
| **Intercepted Calls** | None (module not imported) | All fetch calls |
| **Test Result** | FAILS | PASSES |
| **Why** | Mocks wrong target | Mocks actual target |

### Common Pitfalls to Avoid

1. **DON'T mock node-fetch module** - Handlers use global fetch, not node-fetch
2. **DON'T use require() to get mock** - Assign directly to global.fetch
3. **DON'T forget type assertion** - Use `(global.fetch as any)` for Vitest methods
4. **DON'T mix patterns** - Use global.fetch consistently across all API tests
5. **DO reset mocks** - Always call vi.clearAllMocks() in beforeEach
6. **DO restore mocks** - Always call vi.restoreAllMocks() in afterEach
7. **DO match handler behavior** - Mock responses should match actual API structure

---

## 6. SEARCH STRATEGIES

### Find All Incorrect Patterns

```bash
# Find all test files using node-fetch mock (INCORRECT)
grep -r "vi.mock('node-fetch" --include="*.test.ts" api/

# Find all references to mockFetch variable (needs replacement)
grep -r "mockFetch" --include="*.test.ts" api/

# Find all test files NOT using global.fetch (potential issues)
grep -rL "global.fetch" --include="*.test.ts" api/ai/__tests__/
```

### Verify All Handlers Use Global Fetch

```bash
# Confirm handlers use global fetch (should find matches)
grep -r "await fetch(" --include="*.ts" api/ai/

# Confirm handlers DON'T import node-fetch (should find nothing)
grep -r "from 'node-fetch'" --include="*.ts" api/ai/
grep -r "require('node-fetch')" --include="*.ts" api/ai/
```

### Verify Tests After Fix

```bash
# Should find NO instances after fix
grep -r "vi.mock('node-fetch" --include="*.test.ts" api/

# Should find 5+ instances after fix
grep -r "global.fetch = vi.fn()" --include="*.test.ts" api/
```

---

## 7. IMPLEMENTATION CHECKLIST

### Pre-Implementation
- [ ] Run full test suite to establish baseline failure count
- [ ] Document current test output for comparison
- [ ] Create git branch: `fix/api-test-mock-fetch-pattern`
- [ ] Backup current test files (git handles this)

### Implementation (Per File)
- [ ] generate-roadmap-v2.test.ts
  - [ ] Remove vi.mock('node-fetch')
  - [ ] Add global.fetch = vi.fn()
  - [ ] Remove mockFetch variable
  - [ ] Replace all mockFetch references
  - [ ] Run test file individually
  - [ ] Verify all tests pass
- [ ] generate-insights.test.ts (same steps)
- [ ] analyze-image.test.ts (same steps)
- [ ] transcribe-audio.test.ts (same steps)
- [ ] analyze-file.test.ts (same steps)

### Post-Implementation
- [ ] Run all API tests: `npm test -- api/`
- [ ] Verify zero "mockResolvedValue is not a function" errors
- [ ] Check for any TypeScript errors
- [ ] Run full test suite
- [ ] Update test documentation if needed
- [ ] Commit with message: "Fix API test mock fetch pattern - replace node-fetch with global.fetch"
- [ ] Create PR with this analysis document linked

---

## 8. EXPECTED OUTCOMES

### Immediate Results
- 40+ tests change from FAIL to PASS
- Zero mock-related runtime errors
- Clean test output with proper assertions

### Long-Term Benefits
- Consistent test patterns across codebase
- Easier test maintenance and debugging
- Clear documentation for future test development
- Reduced risk of similar issues in new tests

### Success Metrics
- **Before**: 40+ failures, "mockResolvedValue is not a function" errors
- **After**: 100% pass rate, zero mock-related errors
- **Test Coverage**: Maintained at current levels
- **CI/CD**: Pipeline unblocked, all checks passing

---

## 9. TECHNICAL DEEP DIVE

### Why Global Fetch vs Node-Fetch?

**Runtime Environment**: Vercel serverless functions run in Node.js v18+, which has native fetch API
**Handler Code**: Uses global fetch (no import required)
**Test Environment**: Vitest runs in Node.js with global fetch available
**Mock Target**: Must mock what the code actually calls (global.fetch, not node-fetch module)

### Vitest Mock Mechanics

```typescript
// vi.mock() - Module-level mock (static, early)
vi.mock('node-fetch', () => ({ default: vi.fn() }))
// Creates a mock module BEFORE any imports
// Replaces ALL imports of 'node-fetch' in test context
// Does NOT affect global.fetch

// global.fetch = vi.fn() - Direct assignment (runtime)
global.fetch = vi.fn()
// Replaces the global fetch function at runtime
// Affects ALL code that calls global fetch()
// Works with Vitest mock methods (.mockResolvedValue, etc.)
```

### Type Safety Considerations

```typescript
// Why (global.fetch as any)?
// 1. global.fetch has type: typeof fetch (DOM types)
// 2. vi.fn() returns Mock<any[], any>
// 3. Types are incompatible without assertion
// 4. (as any) bypasses TypeScript checking for test convenience
// 5. Alternative: proper typing with vi.mocked()

// More type-safe approach:
import { vi } from 'vitest'
global.fetch = vi.fn() as any
const mockFetch = vi.mocked(global.fetch)
mockFetch.mockResolvedValue({ ... })
```

---

## 10. CONCLUSION

**Root Cause**: Mocking node-fetch module when handlers use global fetch API

**Fix**: Replace vi.mock('node-fetch') with global.fetch = vi.fn() in 5 test files

**Confidence**: High - Pattern proven working in 2 existing test files

**Risk**: Low - Isolated test changes, no production code affected

**Effort**: 30-45 minutes for all 5 files + validation

**Impact**: Unblocks 40+ tests, restores CI/CD pipeline

---

## Files Referenced

### Test Files (Failing - Need Fix)
- `/api/ai/__tests__/generate-roadmap-v2.test.ts`
- `/api/ai/__tests__/generate-insights.test.ts`
- `/api/ai/__tests__/analyze-image.test.ts`
- `/api/ai/__tests__/transcribe-audio.test.ts`
- `/api/ai/__tests__/analyze-file.test.ts`

### Test Files (Working - Reference Pattern)
- `/api/__tests__/ai-generate-ideas.test.ts`
- `/api/ai/__tests__/ai-endpoints-security.test.ts`

### Handler Files (Verification)
- `/api/ai/analyze-file.ts`
- `/api/ai/generate-ideas.ts`
- `/api/ai/analyze-image.ts`
- `/api/ai/generate-roadmap-v2.ts`
- `/api/ai/transcribe-audio.ts`
- `/api/ai/generate-insights.ts`

---

**Analysis Completed**: 2025-10-05
**Status**: Ready for Implementation
**Next Action**: Apply fixes to 5 test files following systematic fix plan
