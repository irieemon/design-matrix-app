# Testing Guide

This project uses **Vitest** with **React Testing Library** for comprehensive testing coverage.

## Test Structure

```
src/
├── test/
│   ├── setup.ts              # Test configuration
│   ├── mocks/
│   │   ├── server.ts          # MSW server setup
│   │   ├── handlers.ts        # API mock handlers
│   │   └── supabase.ts        # Supabase client mocks
│   └── utils/
│       └── test-utils.tsx     # Custom render utilities
├── lib/__tests__/             # Database service tests
├── hooks/__tests__/           # React hooks tests
└── components/__tests__/      # Component tests
api/__tests__/                 # API endpoint tests
```

## Available Test Scripts

```bash
# Run all tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run tests with coverage report
npm run test:coverage

# Run tests with UI dashboard
npm run test:ui

# Run specific test suites
npm run test:api          # API endpoint tests
npm run test:components   # Component tests
npm run test:hooks        # Hook tests
npm run test:lib          # Library/service tests
```

## Test Categories

### 1. Unit Tests

**Database Service** (`src/lib/__tests__/database.test.ts`)
- CRUD operations for ideas/projects
- Real-time subscriptions
- Error handling and edge cases
- Collaboration features
- Rate limiting

**Authentication Hook** (`src/hooks/__tests__/useAuth.test.ts`)
- User authentication flow
- Session management
- Demo user handling
- Project checks and redirects

**Ideas Management Hook** (`src/hooks/__tests__/useIdeas.test.ts`)
- Optimistic updates
- Real-time synchronization
- Drag & drop handling
- CRUD operations

### 2. Component Tests

**DesignMatrix** (`src/components/__tests__/DesignMatrix.test.tsx`)
- Rendering quadrants and labels
- Idea positioning and styling
- User interactions (edit, delete, toggle)
- Drag & drop functionality
- Responsive design

### 3. Integration Tests

**API Endpoints** (`api/__tests__/ai-generate-ideas.test.ts`)
- HTTP method validation
- Authentication and rate limiting
- Input validation
- AI service integration
- Error handling

## Testing Best Practices

### Writing Tests

1. **Use descriptive test names**
   ```ts
   it('should create idea with optimistic update when user adds new idea', () => {
     // Test implementation
   })
   ```

2. **Follow AAA pattern** (Arrange, Act, Assert)
   ```ts
   it('should update idea successfully', async () => {
     // Arrange
     const updatedIdea = { ...mockIdea, content: 'Updated' }

     // Act
     await result.current.updateIdea(updatedIdea)

     // Assert
     expect(mockDatabaseService.updateIdea).toHaveBeenCalledWith(...)
   })
   ```

3. **Mock external dependencies**
   ```ts
   vi.mock('../lib/database', () => ({
     DatabaseService: mockDatabaseService
   }))
   ```

### Testing Patterns

#### Hook Testing
```ts
import { renderHook, act } from '@testing-library/react'

const { result } = renderHook(() => useIdeas(options))

await act(async () => {
  await result.current.addIdea(newIdea)
})

expect(result.current.ideas).toContain(newIdea)
```

#### Component Testing
```ts
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

render(<DesignMatrix {...props} />)

const button = screen.getByRole('button', { name: /edit/i })
await userEvent.click(button)

expect(mockOnEdit).toHaveBeenCalled()
```

#### API Testing
```ts
const req = createMockRequest('POST', { title: 'Test' })
const res = createMockResponse()

await handler(req, res)

expect(res.json).toHaveBeenCalledWith(expectedResponse)
```

## Coverage Targets

- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

## Running Tests in CI/CD

Add to your CI pipeline:

```yaml
- name: Run tests
  run: npm run test:run

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage reports
  uses: codecov/codecov-action@v3
```

## Debugging Tests

### Verbose Output
```bash
npm run test -- --reporter=verbose
```

### Test Debugging
```ts
import { screen } from '@testing-library/react'

// Debug rendered DOM
screen.debug()

// Debug specific element
screen.debug(screen.getByTestId('my-component'))
```

### MSW Debugging
```ts
// In test file
import { server } from '../test/mocks/server'

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'warn' })
})
```

## Mock Data

Pre-configured mock data available in `src/test/utils/test-utils.tsx`:

- `mockUser` - Test user object
- `mockAdminUser` - Admin user object
- `mockProject` - Test project object
- `mockIdea` - Single test idea
- `mockIdeas` - Array of test ideas

## Common Issues

### Module Resolution
If you encounter module resolution issues:
```ts
// Use path alias
import { DatabaseService } from '@/lib/database'

// Or relative paths
import { DatabaseService } from '../../lib/database'
```

### Async Testing
Always use `act()` for async operations:
```ts
await act(async () => {
  await result.current.someAsyncFunction()
})
```

### Component Cleanup
Tests automatically clean up between runs, but for manual cleanup:
```ts
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
```

## Future Testing Enhancements

1. **E2E Tests** - Add Playwright for end-to-end testing
2. **Visual Regression** - Add visual testing for UI components
3. **Performance Tests** - Add performance benchmarks
4. **Accessibility Tests** - Expand a11y testing coverage
5. **Mobile Testing** - Add mobile-specific test scenarios