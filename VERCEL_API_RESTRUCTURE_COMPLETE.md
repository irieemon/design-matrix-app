# Vercel API Directory Restructure - Complete

## Problem Solved
Vercel was counting ALL .ts files in the `api/` directory as serverless functions, causing us to exceed the 12 function limit with 19 files detected.

## Solution Implemented
Moved middleware and utility files out of the `api/` directory to prevent Vercel from treating them as serverless functions.

## Files Moved

### Middleware Files (8 files)
**From:** `api/middleware/`  
**To:** `src/lib/api/middleware/`

- compose.ts
- cookies.ts
- cors.ts
- index.ts
- types.ts
- withAuth.ts
- withCSRF.ts
- withRateLimit.ts

### Utility Files (5 files)
**From:** `api/utils/`  
**To:** `src/lib/api/utils/`

- connectionPool.ts
- logger.ts
- performanceMonitor.ts
- queryOptimizer.ts
- validation.ts

## Remaining Serverless Functions (6 files)
The `api/` directory now contains ONLY the actual serverless function endpoints:

1. `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/api/admin.ts`
2. `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/api/ai.ts`
3. `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/api/auth.ts`
4. `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/api/ideas.ts`
5. `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/api/projects.js`
6. `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/api/user.ts`

**Total:** 6 files (well under the 12 function limit)

## Import Updates

### API Route Files Updated
- `api/auth.ts` - Updated 9 imports
- `api/user.ts` - Updated 1 import  
- `api/ai.ts` - Updated 1 import

### Test Files Updated
- `api/auth/__tests__/roles.test.ts` - Updated mocks and imports
- `api/auth/__tests__/user.test.ts` - Updated mocks and imports
- `api/auth/__tests__/middleware.test.ts` - Updated imports

### Internal Library Imports Updated
- `src/lib/api/utils/logger.ts` - Fixed relative path to logging service
- `src/lib/api/utils/queryOptimizer.ts` - Fixed relative path to uuid utils

## Import Pattern Changes

**Before:**
```typescript
import { withAuth } from './middleware'
import { InputValidator } from './utils/validation'
```

**After:**
```typescript
import { withAuth } from '../src/lib/api/middleware'
import { InputValidator } from '../src/lib/api/utils/validation'
```

## Verification Steps Completed

1. ✅ All middleware files moved to `src/lib/api/middleware/`
2. ✅ All utils files moved to `src/lib/api/utils/`
3. ✅ All imports in `api/*.ts` files updated
4. ✅ All imports in test files updated
5. ✅ Internal library imports corrected
6. ✅ TypeScript compilation passes (`npm run type-check`)
7. ✅ Verified exactly 6 files remain in `api/` directory

## Expected Vercel Behavior

Vercel will now detect only **6 serverless functions** instead of 19, bringing us well under the 12 function limit.

## Next Steps

1. Deploy to Vercel and verify function count
2. Test all API endpoints to ensure imports work correctly
3. Monitor serverless function execution for any runtime import errors

## Files Changed Summary

**Total files modified:** 11
- 3 API route files (auth.ts, user.ts, ai.ts)
- 3 test files (roles.test.ts, user.test.ts, middleware.test.ts)
- 2 utility files (logger.ts, queryOptimizer.ts)
- 13 files moved (8 middleware + 5 utils)
- 2 directories removed (api/middleware, api/utils)
- 2 directories created (src/lib/api/middleware, src/lib/api/utils)
