# ESLint Quick Start Guide

## Installation (ONE-TIME SETUP)

### Fix npm Cache First
```bash
sudo chown -R $(whoami):$(id -gn) ~/.npm
```

### Install ESLint
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks
```

## Usage

### Check for Issues
```bash
npm run lint
```

### Auto-Fix Issues
```bash
npm run lint:fix
```

## Console Logging Rules

### ❌ DO NOT USE (Will fail lint)
```typescript
console.log('debug message')
console.debug('debug message')
console.info('info message')
console.trace('trace message')
```

### ✅ USE INSTEAD
```typescript
import { logger } from '@/utils/logger';

// For debugging
logger.debug('debug message', { context: data });

// For general info
logger.info('info message', { userId: '123' });

// For warnings
logger.warn('warning message', { reason: 'xyz' });
console.warn('warning message'); // Also allowed

// For errors
logger.error('error message', { error });
console.error('error message', error); // Also allowed
```

## Before Committing

```bash
# Run lint check
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Build and type check
npm run build:check
```

## Common Issues

### "console.log is not allowed"
**Fix**: Replace with `logger.debug()` or `logger.info()`

### "any is not allowed"
**Fix**: Add proper TypeScript types

### "React Hook has a missing dependency"
**Fix**: Add dependency to useEffect/useCallback/useMemo array

## Configuration Location

- Config file: `.eslintrc.json`
- Ignore patterns: In `.eslintrc.json` under `ignorePatterns`

## Help

See `ESLINT_SETUP_REPORT.md` for detailed documentation.
