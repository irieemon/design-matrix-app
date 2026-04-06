# Testing Patterns

**Analysis Date:** 2025-04-06

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: `vitest.config.ts`
- Environment: jsdom (browser-like DOM simulation)
- Setup file: `src/test/setup.ts`

**Assertion Library:**
- Vitest built-in expect() API
- Testing Library assertions via `@testing-library/jest-dom` (~v6.8.0)
- Custom matchers loaded from `src/test/utils/custom-matchers`

**Run Commands:**
```bash
npm run test              # Watch mode (default Vitest)
npm run test:run         # Single run all tests
npm run test:coverage    # Generate coverage report
npm run test:components  # Run only component tests
npm run test:hooks       # Run only hook tests
npm run test:lib         # Run only lib tests
npm run test:api         # Run only API tests
```

## Test File Organization

**Location:**
- Co-located pattern: Tests live alongside source files in `__tests__` subdirectories
- Path pattern: `src/components/ui/__tests__/Button.test.tsx` (colocated with `src/components/ui/Button.tsx`)
- Alternative path pattern: `src/utils/__tests__/csvUtils.test.ts` (utilities in shared `__tests__` dir)

**Naming:**
- Test files: `*.test.ts` or `*.test.tsx`
- File name matches source: `Button.tsx` → `Button.test.tsx`
- Spec files: `*.spec.ts` (used for Playwright E2E tests, not unit tests)

**Structure:**
```
src/
├── components/
│   └── ui/
│       ├── Button.tsx
│       └── __tests__/
│           └── Button.test.tsx
├── utils/
│   ├── logger.ts
│   └── __tests__/
│       └── logger.test.ts
└── test/
    ├── setup.ts
    └── mocks/
        └── server.ts
```

## Test Structure

**Suite Organization:**

From `src/components/ui/__tests__/Button.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Button Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('Component Rendering', () => {
    it('should render with default props', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
    })
  })
})
```

**Patterns:**
- Setup: `userEvent.setup()` for simulating user interactions
- Setup/teardown: `beforeEach`/`afterEach` for mocks and timer management
- Assertions: `expect()` with Testing Library matchers (`.toBeInTheDocument()`, `.toHaveClass()`, etc.)
- Fake timers: `vi.useFakeTimers()` for async state testing

## Mocking

**Framework:** Vitest built-in mocking via `vi.mock()`

**Patterns:**

From `src/components/ui/__tests__/Button.test.tsx`:

```typescript
vi.mock('../../../hooks/useComponentState', () => ({
  useComponentState: (config: any) => ({
    state: config.initialConfig?.state || 'idle',
    variant: config.initialConfig?.variant || 'primary',
    className: `btn--${config.initialConfig?.variant || 'primary'}`,
    setState: vi.fn(),
    setSuccess: vi.fn(),
    setError: vi.fn(),
    reset: vi.fn(),
    executeAction: vi.fn(async (action: () => Promise<void>) => {
      try {
        await action()
      } catch (_error) {
        throw error
      }
    })
  })
}))

vi.mock('../LoadingSpinner', () => ({
  default: ({ size, variant }: { size: string; variant: string }) => (
    <div data-testid="loading-spinner" data-size={size} data-variant={variant}>
      Loading...
    </div>
  )
}))

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn()
  }
}))
```

**MSW (Mock Service Worker):**
- Server mock setup in `src/test/mocks/server.ts`
- Started before all tests: `beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))`
- Reset after each test: `afterEach(() => server.resetHandlers())`
- Used for API request interception (not shown in unit tests, used in integration tests)

**What to Mock:**
- External hooks that aren't being tested
- External components (LoadingSpinner when testing Button)
- logger and utilities
- Third-party libraries

**What NOT to Mock:**
- React hooks used in component (useState, useEffect, useContext)
- Testing Library utilities
- The actual component under test

## Fixtures and Factories

**Test Data:**

From `src/utils/__tests__/csvUtils.test.ts`:

```typescript
beforeEach(() => {
  mockIdeas = [
    {
      id: generateDemoUUID('1'),
      content: 'Test Idea 1',
      details: 'Details for test idea 1',
      x: 100,
      y: 200,
      priority: 'high',
      created_by: 'user-1',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      project_id: 'project-1'
    }
  ]
})
```

**Location:**
- Fixtures defined in `beforeEach` hooks within test files
- Shared test utilities: `src/test/utils/` directory
- Mock server setup: `src/test/mocks/server.ts`
- UUID utilities for test data: `generateDemoUUID()` from `src/utils/uuid.ts`

## Coverage

**Requirements:** 
- Global thresholds configured in `vitest.config.ts`:
  - branches: 70%
  - functions: 70%
  - lines: 70%
  - statements: 70%

**View Coverage:**
```bash
npm run test:coverage
# Generated in: coverage/ directory (HTML report)
```

**Excluded from coverage:**
- `node_modules/`
- `src/test/` (test setup files)
- `**/*.d.ts` (type definitions)
- `**/*.config.ts` (configuration files)
- `src/vite-env.d.ts` (Vite type definitions)

## Test Types

**Unit Tests:**
- Scope: Single component or utility function
- Approach: Mock external dependencies, test logic in isolation
- Example: `Button.test.tsx` tests button rendering, state changes, click handlers
- Run with: `npm run test:components` or `npm run test:hooks`

**Integration Tests:**
- Scope: Multiple components or services working together
- Approach: Minimal mocking, test real interactions
- Example: `useAuth.ts` integration with Supabase, ProfileService, caching
- Located alongside unit tests or in separate `tests/` directory

**E2E Tests:**
- Framework: Playwright (~1.55.0)
- Configuration: `playwright.e2e.config.ts`
- Browser support: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Run commands:
  ```bash
  npm run e2e:all              # Run all E2E tests
  npm run e2e:chromium         # Specific browser
  npm run e2e:mobile           # Mobile browsers
  npm run e2e:ui               # UI mode (interactive)
  npm run e2e:debug            # Debug mode
  ```
- Located in: `tests/e2e/` directory (separate from unit tests)

## Common Patterns

**Async Testing:**

```typescript
it('should handle async operations', async () => {
  const handleClick = vi.fn().mockResolvedValue(undefined)
  render(<Button onAsyncAction={handleClick}>Button</Button>)

  const button = screen.getByRole('button')
  fireEvent.click(button)

  await waitFor(() => {
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

**Error Testing:**

```typescript
it('should display error message when in error state', () => {
  render(
    <Button state="error" errorMessage="Something went wrong">
      Button
    </Button>
  )

  expect(screen.getByText('Something went wrong')).toBeInTheDocument()
})

// Testing error throwing
vi.mock('../../../hooks/useComponentState', () => ({
  useComponentState: () => {
    throw new Error('Hook initialization failed')
  }
}))
```

**Timer Testing:**

```typescript
it('should auto-dismiss success state after specified duration', () => {
  render(
    <Button state="success" successDismissAfter={1000}>
      Button
    </Button>
  )

  expect(screen.getByRole('button')).toHaveAttribute('data-state', 'success')

  vi.advanceTimersByTime(1000)  // Fast-forward timers

  // Assert state change (mocked behavior)
})
```

**Ref Testing:**

```typescript
it('should expose getState method via ref', () => {
  const TestComponent = () => {
    const buttonRef = useRef<ButtonRef>(null)

    useEffect(() => {
      if (buttonRef.current) {
        expect(buttonRef.current.getState()).toBe('idle')
      }
    }, [])

    return <Button ref={buttonRef}>Button</Button>
  }

  render(<TestComponent />)
})
```

## Test Setup

**Global Setup (`src/test/setup.ts`):**

```typescript
import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'

// MSW Server management
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})
afterAll(() => server.close())

// Global polyfills
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
```

## Component Test Checklist

For component tests like `Button.test.tsx` (707 lines, comprehensive):

- [ ] Rendering with default props
- [ ] Rendering with all variant/size combinations
- [ ] All state management (idle, loading, error, success, disabled, pending)
- [ ] Click handlers and event firing
- [ ] Async action handling
- [ ] Icon rendering (before/after)
- [ ] Full width mode
- [ ] Custom className merging
- [ ] Accessibility (ARIA attributes, semantic HTML)
- [ ] Loading spinner integration
- [ ] Error/success message display
- [ ] Auto-dismiss functionality with timers
- [ ] Imperative API via refs (getState, setState, setSuccess, etc.)
- [ ] State change callbacks
- [ ] Edge cases (undefined/null children, empty strings, long text)
- [ ] Memory leak prevention (cleanup on unmount)
- [ ] Form integration

---

*Testing analysis: 2025-04-06*
