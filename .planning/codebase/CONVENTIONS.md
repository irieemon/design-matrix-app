# Coding Conventions

**Analysis Date:** 2025-04-06

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `Button.tsx`, `AuthScreen.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useAuth.ts`, `useComponentState.ts`)
- Utilities: camelCase (e.g., `logger.ts`, `promiseUtils.ts`)
- Tests: match source file with `.test.ts` or `.test.tsx` suffix (e.g., `Button.test.tsx`)
- Types/Interfaces: PascalCase with descriptive names (e.g., `ButtonProps`, `UseAuthReturn`)
- Constants: UPPER_SNAKE_CASE (e.g., `SUPABASE_STORAGE_KEY`, `TIMEOUTS`)

**Functions:**
- camelCase with action verb prefixes: `handle*`, `check*`, `get*`, `set*`, `export*`
- Example: `handleAuthSuccess`, `checkUserProjectsAndRedirect`, `getCachedUserProfile`
- Custom hooks always start with `use`: `useAuth`, `useComponentState`, `useOptionalComponentStateContext`
- Callback functions use `on*` pattern: `onStateChange`, `onAsyncAction`, `onClick`

**Variables:**
- camelCase for local/component state: `currentUser`, `isLoading`, `hasError`
- Private refs and state use naming convention to indicate intent: `ref`, `Ref` suffix for useRef holders
- Unused variables prefixed with underscore: `_error`, `_response` (documented in ESLint config)

**Types:**
- Interfaces: PascalCase with `I` prefix or descriptive name (e.g., `ButtonProps`, `UseAuthReturn`)
- Type aliases: PascalCase (e.g., `ButtonVariant`, `ButtonState`)
- Union types named with `*Type` or `*Union` (e.g., `UserRole = 'user' | 'admin' | 'super_admin'`)
- Generic types use single capital letters or descriptive names (e.g., `<T>`, `<T extends object>`)

## Code Style

**Formatting:**
- No dedicated .prettierrc found - style follows ESLint enforcement
- Indentation: 2 spaces (standard React convention)
- Line length: Not explicitly configured
- String quotes: Single quotes enforced by convention (seen in codebase)
- Semicolons: Required (TypeScript strict mode enabled)

**Linting:**
- Tool: ESLint v9 with flat config format (`eslint.config.js`)
- Configuration approach: Modern flat config (migrated from `.eslintrc.json`)
- Parser: `typescript-eslint` (unified package replacing separate parser + plugin)
- Key rules enforced:
  - `no-console: ['error', { allow: ['warn', 'error'] }]` - Only warnings and errors can be logged
  - `@typescript-eslint/no-explicit-any: 'warn'` - Use types instead of `any`
  - `@typescript-eslint/no-unused-vars` - Unused vars error unless prefixed with `_`
  - `react/react-in-jsx-scope: 'off'` - Modern React JSX transform
  - React Hooks rules enforced via `eslint-plugin-react-hooks`

**Ignored files in linting:**
- Test files: `**/__tests__/**`, `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx`
- Config files: `*.config.js`, `*.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- Build output: `dist/`, `coverage/`
- Backend: `api/` directory (separate TypeScript project)

## Import Organization

**Order:**
1. React and external libraries: `import React, { useState } from 'react'`
2. Component/utility imports from relative paths: `import { Button } from '../../components/ui/Button'`
3. Type imports: `import type { ButtonProps } from '../types'`
4. Internal services/hooks: `import { useAuth } from '../hooks/useAuth'`

**Path Aliases:**
- Alias configured: `@` → `./src` (in `vitest.config.ts` and `tsconfig.json`)
- Usage: `import { Button } from '@/components/ui/Button'` (recommended for non-test files)
- Tests commonly use relative paths: `import { Button } from '../Button'`

**Example from codebase (`src/hooks/useAuth.ts`):**
```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getProfileService } from '../lib/supabase'
import { DatabaseService } from '../lib/database'
import { User, AuthUser, Project, IdeaCard } from '../types'
import { logger } from '../utils/logger'
import { authPerformanceMonitor } from '../utils/authPerformanceMonitor'
import { ensureUUID, isDemoUUID } from '../utils/uuid'
import { SUPABASE_STORAGE_KEY, TIMEOUTS, CACHE_DURATIONS } from '../lib/config'
import { withTimeout } from '../utils/promiseUtils'
import { CacheManager } from '../services/CacheManager'
```

## Error Handling

**Patterns:**
- Try/catch blocks with nested try/catch for different failure modes
- Error discrimination via `instanceof Error` and error message matching
- Unused error variables prefixed with underscore: `catch (_error)` then reference as `error` if needed
- Example from `src/hooks/useAuth.ts`:
  ```typescript
  try {
    const result = await fetch('/api/data')
  } catch (_error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug('⏰ Request timeout')
    } else {
      throw error
    }
  }
  ```

**Fallback patterns:**
- Promise.allSettled for non-blocking parallel operations (handles some failures without blocking)
- Timeout wrappers using `withTimeout()` utility for API calls
- Graceful degradation: Services fallback to basic user data when full profile fetch fails
- Storage fallback: If Supabase call fails, fallback to localStorage data

**Logging on errors:**
- Use `logger.error()` for exceptions that need investigation
- Use `logger.warn()` for expected failures (timeouts, missing cache)
- Use `logger.debug()` for contextual information during error recovery

## Logging

**Framework:** Custom `Logger` class in `src/utils/logger.ts` (wraps console methods)

**Patterns:**
- Debug mode controlled via URL parameter: `?debug=true`
- Production mode: only `warn` and `error` levels shown
- Debug mode: all levels shown (`debug`, `info`, `warn`, `error`)
- Throttling: debug logs throttled at 10-second intervals to prevent spam
- Rate limiting: per-level limits (debug: 5/sec, info: 8/sec, warn: 20/sec, error: 50/sec)

**Usage:**
```typescript
import { logger } from '../utils/logger'

logger.debug('🔐 Session found, skipping redundant verification')
logger.warn('⚠️ No auth token available for server cache clearing')
logger.error('❌ Error checking user projects:', error)
```

## Comments

**When to Comment:**
- Complex logic requiring explanation (e.g., performance optimizations, auth timeout handling)
- Security-related decisions (marked with `// ✅ SECURITY FIX:` or `// ❌ Risk:`)
- Non-obvious workarounds (marked with `// CRITICAL FIX:` or `// HACK:`)
- Performance notes (marked with `// PERFORMANCE OPTIMIZED:`)

**JSDoc/TSDoc:**
- Used for utility functions and exported functions
- Documents parameters, return types, and examples
- Example from `src/utils/promiseUtils.ts`:
  ```typescript
  /**
   * Wraps a promise with a timeout
   *
   * @param promise - The promise to wrap
   * @param timeoutMs - Timeout in milliseconds
   * @param errorMessage - Custom error message (optional)
   * @returns Promise that rejects if timeout is reached
   *
   * @example
   * const result = await withTimeout(fetch('/api/data'), 5000)
   */
  ```

## Function Design

**Size:** Generally 30-100 lines for complex hooks and components
- Example: `useAuth` hook is ~630 lines due to nested error handling and multiple fallback scenarios

**Parameters:**
- Prefer object destructuring: `function myFunc({ param1, param2 } = {})`
- Generic constraints for reusable utilities: `function getSessionCache<T>()`
- Options objects for many parameters: `interface UseAuthOptions { ... }`

**Return Values:**
- Always specify return types in TypeScript (no implicit `any`)
- Return objects with descriptive property names: `{ currentUser, isLoading, handleAuthSuccess }`
- Custom hooks return interface: `interface UseAuthReturn { ... }`

## Module Design

**Exports:**
- Named exports preferred: `export const Button = ...` or `export function useAuth() { ... }`
- Default exports used for components: `export default Button`
- Barrel files (index.ts) used to aggregate related exports

**Barrel Files:**
- Located at directory level: `src/components/ui/index.ts`, `src/utils/index.ts`
- Import from barrel files in parent directories: `import { Button, Input } from '@/components/ui'`
- Individual imports preferred in test files for clarity

## Special Patterns Observed

**Ref handling in hooks:**
- useRef used for mutable values that don't trigger re-renders
- useRef used for callback function stability: `handleAuthSuccessRef.current = handleAuthSuccess`
- Example: `const buttonRef = useRef<HTMLButtonElement>(null)`

**Conditional Hook Calls:**
- Custom wrapper pattern to safely call hooks conditionally:
  ```typescript
  function useOptionalComponentStateContext() {
    try {
      return useComponentStateContext()
    } catch {
      return null
    }
  }
  ```

**Performance Optimization:**
- useCallback with explicit dependency arrays to memoize functions
- useEffect cleanup functions to prevent memory leaks
- Cache management (ProfileService cache, session cache)

**Demo User Pattern:**
- Demo users identified via `isDemoUUID()` or `isDemoUser` flag
- Demo UUIDs follow pattern: `00000000-0000-0000-0000-0000000000XX`
- Skip database calls and use client-side fallback data for demo users

---

*Convention analysis: 2025-04-06*
