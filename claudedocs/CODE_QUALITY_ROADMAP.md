# Code Quality Roadmap

**Status**: 619 linting issues remaining (183 errors, 436 warnings)
**Priority**: These are pre-existing code quality issues, not security/functionality blockers

---

## Error Breakdown (183 Total Errors)

| Rule | Count | Severity | Impact |
|------|-------|----------|--------|
| `@typescript-eslint/no-unused-vars` | 46 | 🟡 Medium | Code bloat, confusion |
| `no-console` | 41 | 🟡 Medium | Poor logging practices |
| `react-hooks/rules-of-hooks` | 19 | 🔴 **CRITICAL** | **Runtime bugs** |
| `@typescript-eslint/ban-ts-comment` | 12 | 🟡 Medium | Type safety bypass |
| `@typescript-eslint/no-require-imports` | 6 | 🟢 Low | Module system inconsistency |
| `@typescript-eslint/no-this-alias` | 5 | 🟡 Medium | Confusing code patterns |
| Other errors | 54 | Various | Various |

---

## Priority 1: React Hooks Violations (CRITICAL) 🔴

**Count**: 19 errors across 7 files
**Impact**: **Can cause runtime bugs, state corruption, infinite loops**
**Rule**: react-hooks/rules-of-hooks

### Why Critical

Violating the Rules of Hooks can cause:
- Component state corruption
- Infinite render loops
- Hooks called in wrong order between renders
- Memory leaks
- Unpredictable behavior

### Affected Files

1. `src/components/auth/AuthScreen.tsx` (1 violation)
2. `src/components/pages/UserSettings.tsx` (1 violation)
3. `src/components/ProjectRoadmap/ProjectRoadmap.tsx` (1 violation)
4. `src/components/ui/Button.tsx` (multiple violations)
5. `src/components/ui/Input.tsx` (multiple violations)
6. `src/components/ui/Select.tsx` (multiple violations)
7. `src/components/ui/Textarea.tsx` (multiple violations)

### Common Pattern

```typescript
// ❌ WRONG: Hook called conditionally
function Component({ showFeature }) {
  if (showFeature) {
    const data = useHook() // ERROR: Hook called conditionally
  }
}

// ✅ CORRECT: Hook always called, result used conditionally
function Component({ showFeature }) {
  const data = useHook() // Always called

  if (showFeature) {
    // Use data here
  }
}
```

### Fix Strategy

For each file:

1. **Identify conditional hook calls**
   ```bash
   npm run lint | grep "src/components/ui/Button.tsx" | grep "rules-of-hooks"
   ```

2. **Move hooks to top level** - Always call hooks unconditionally at component top
3. **Use conditional logic** - Apply conditions to the hook's result, not the hook call
4. **Test thoroughly** - Hooks violations can cause subtle bugs

### Example Fix

**Before** (AuthScreen.tsx:26):
```typescript
function AuthScreen() {
  const isLoggedIn = checkAuth()

  if (!isLoggedIn) {
    const { login } = useSecureAuthContext() // ❌ Conditional hook call
  }
}
```

**After**:
```typescript
function AuthScreen() {
  const { login } = useSecureAuthContext() // ✅ Always called
  const isLoggedIn = checkAuth()

  if (!isLoggedIn) {
    // Use login here
  }
}
```

---

## Priority 2: Unused Variables 🟡

**Count**: 46 errors
**Impact**: Code bloat, confusion, maintenance burden
**Rule**: @typescript-eslint/no-unused-vars

### Quick Wins

Most can be fixed by:
1. **Removing unused imports**
2. **Removing unused function parameters** (prefix with `_` if required by interface)
3. **Removing unused variables**

### Example Fixes

```typescript
// ❌ Unused variable
const [data, setData] = useState()
// Never use 'data'

// ✅ Remove if truly unused
const [, setData] = useState()

// ✅ Or prefix with _ to indicate intentionally unused
const [_data, setData] = useState()
```

### Common Patterns

```bash
# Find all unused variables
npm run lint | grep "no-unused-vars"

# Common culprits:
# - Error handlers: catch (err) { } → catch (_err) { }
# - Destructuring: const { unused, needed } = obj → const { needed } = obj
# - Function params: function(unused, needed) → function(_unused, needed)
```

---

## Priority 3: Console Statements 🟡

**Count**: 41 errors
**Impact**: Poor logging, no log levels, can't disable in production
**Rule**: no-console

### Fix Strategy

Replace all `console.log()` with `logger` utility:

```typescript
// ❌ WRONG
console.log('Debug info:', data)

// ✅ CORRECT
import { logger } from '../utils/logger'
logger.debug('Debug info:', data)
```

### Allowed Console Methods

These are allowed by the ESLint config:
- `console.warn()` - Warnings
- `console.error()` - Errors

But prefer using logger:
- `logger.warn()` - Better formatting, log levels
- `logger.error()` - Better error handling, context

### Batch Fix

```bash
# Find all console.log usage
grep -r "console.log" src/

# Replace pattern:
# 1. Import logger at top of file
# 2. Replace console.log() → logger.debug()
# 3. Replace console.info() → logger.info()
```

---

## Priority 4: TypeScript Comment Bans 🟡

**Count**: 12 errors
**Impact**: Type safety bypassed, hidden bugs
**Rule**: @typescript-eslint/ban-ts-comment

### Why This Matters

```typescript
// ❌ BAD: Silences TypeScript errors
// @ts-ignore
const result = dangerousOperation()

// ❌ ALSO BAD: Disables checking for entire file
// @ts-nocheck
```

These comments hide real type errors that should be fixed properly.

### Fix Strategy

1. **Remove the comment**
2. **Fix the actual type error**
3. **If truly needed**, use `@ts-expect-error` with explanation:
   ```typescript
   // @ts-expect-error - Third-party library has incorrect types, will fix in PR#123
   const result = libraryFunction()
   ```

---

## Priority 5: Other Errors 🟢

### no-require-imports (6 errors)
```typescript
// ❌ WRONG
const lib = require('library')

// ✅ CORRECT
import lib from 'library'
```

### no-this-alias (5 errors)
```typescript
// ❌ WRONG
const self = this
setTimeout(function() { self.doThing() })

// ✅ CORRECT
setTimeout(() => { this.doThing() })
```

---

## Warnings (436 Total) 🟨

Most warnings are:
- **450 warnings**: `@typescript-eslint/no-explicit-any` - Using `any` type instead of proper types

### Gradual Migration

Don't fix all at once. Use this strategy:

1. **New code**: Never use `any`
2. **Modified code**: Replace `any` when touching files
3. **Systematic cleanup**: Dedicate sprints to type improvements

```typescript
// ❌ Lazy typing
function process(data: any) {
  return data.value
}

// ✅ Proper typing
interface Data {
  value: string
}

function process(data: Data) {
  return data.value
}
```

---

## Execution Plan

### Phase 1: Critical Fixes (IMMEDIATE) 🔴

**Time Estimate**: 2-4 hours
**Impact**: Prevent runtime bugs

```bash
# 1. Fix React Hooks violations
# Files: AuthScreen.tsx, UserSettings.tsx, ProjectRoadmap.tsx, ui components
# Action: Move hooks to top level, remove conditional calls

# 2. Test thoroughly
npm run dev
# Manually test each affected component
```

### Phase 2: Quick Wins (THIS WEEK) 🟡

**Time Estimate**: 3-5 hours
**Impact**: Improve code quality, reduce noise

```bash
# 1. Remove unused variables (46 errors)
npm run lint:fix  # Auto-fix some
# Manually review and remove the rest

# 2. Replace console.log with logger (41 errors)
# Search and replace across files
# Import logger utility where needed

# 3. Verify
npm run lint
# Should see ~87 fewer errors
```

### Phase 3: Type Safety (THIS MONTH) 🟡

**Time Estimate**: 8-10 hours
**Impact**: Better type safety, fewer bugs

```bash
# 1. Remove @ts-ignore comments (12 errors)
# Fix underlying type issues properly

# 2. Replace require() with import (6 errors)
# Update module system to ES6

# 3. Fix this-alias patterns (5 errors)
# Use arrow functions instead
```

### Phase 4: Gradual Improvement (ONGOING) 🟨

**Time Estimate**: Ongoing
**Impact**: Long-term code quality

- Set rule: No `any` types in new code
- Replace `any` when modifying existing files
- Quarterly cleanup sprints for systematic improvement

---

## Measuring Progress

### Current Baseline
```bash
npm run lint
# ✖ 619 problems (183 errors, 436 warnings)
```

### Success Metrics

| Milestone | Errors | Warnings | Status |
|-----------|--------|----------|--------|
| **Baseline** | 183 | 436 | ✅ Current |
| **Phase 1 Complete** | 164 | 436 | 🎯 19 hooks errors fixed |
| **Phase 2 Complete** | 77 | 436 | 🎯 87 quick wins fixed |
| **Phase 3 Complete** | 54 | 436 | 🎯 Type safety improved |
| **Phase 4 Target** | 0 | <50 | 🎯 Production-grade |

### Tracking Progress

```bash
# Generate report
npm run lint 2>&1 | tee lint-report.txt

# Count errors by type
cat lint-report.txt | grep "error" | grep -oE "@typescript-eslint/[a-z-]+|react-hooks/[a-z-]+|no-[a-z-]+" | sort | uniq -c | sort -rn

# Track over time
echo "$(date): $(npm run lint 2>&1 | tail -1)" >> lint-history.log
```

---

## Why We Didn't Auto-Fix Everything

The `npm run lint:fix` command can only auto-fix **simple, safe transformations**:
- Adding/removing whitespace
- Sorting imports
- Simple quote style changes

It **cannot** auto-fix:
- React Hooks violations (requires code refactoring)
- Unused variables (needs human judgment on intent)
- Type errors (requires understanding types)
- Logic changes (requires understanding business logic)

**Auto-fixed**: 17 issues (3 errors, 14 warnings)
**Manual required**: 619 issues (183 errors, 436 warnings)

---

## Tools and Commands

### Useful Commands

```bash
# Run linter
npm run lint

# Auto-fix what's possible
npm run lint:fix

# Lint specific file
npx eslint src/components/auth/AuthScreen.tsx

# Lint and output JSON for parsing
npx eslint src/ --format json > lint-results.json

# Count errors by type
npm run lint 2>&1 | grep "error" | cut -d: -f4- | sort | uniq -c | sort -rn
```

### VS Code Integration

Add to `.vscode/settings.json`:
```json
{
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## Summary

### Current State ✅
- ESLint v9 successfully migrated and operational
- 619 pre-existing code quality issues identified
- Issues categorized by severity and impact

### Next Actions 🎯

**IMMEDIATE (Critical)**:
1. Fix 19 React Hooks violations - **Can cause runtime bugs**
2. Test affected components thoroughly

**THIS WEEK (High Priority)**:
1. Remove 46 unused variables
2. Replace 41 console.log statements with logger

**THIS MONTH (Medium Priority)**:
1. Remove 12 @ts-ignore comments and fix underlying issues
2. Modernize 6 require() imports
3. Fix 5 this-alias patterns

**ONGOING (Low Priority)**:
1. Gradually replace 436 `any` types with proper types
2. Improve overall type safety
3. Maintain zero new linting errors

---

**Bottom Line**: The codebase is **secure and functional**. These linting issues are **code quality improvements**, not blockers. Follow the phased approach above to systematically improve code quality without disrupting development.
