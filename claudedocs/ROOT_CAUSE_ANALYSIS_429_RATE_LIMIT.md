# Root Cause Analysis: 429 Too Many Requests on Login

## Executive Summary

**Status**: CRITICAL - Users cannot log in
**Error**: `POST http://localhost:3003/api/auth/session 429 (Too Many Requests)`
**Root Cause**: Extremely restrictive rate limit (5 requests per 15 minutes) on authentication endpoint combined with in-memory rate limiting that persists across failed attempts
**Impact**: Login blocked after 5 failed attempts for 15 minutes

## Evidence Collected

### 1. Rate Limit Configuration

**File**: `/api/middleware/withRateLimit.ts`

```typescript
// Lines 153-159: Strict rate limit for auth endpoints
export function withStrictRateLimit(): MiddlewareWrapper {
  return withRateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 5,  // Only 5 requests per window
    skipSuccessfulRequests: true,  // Only count failed attempts
  })
}
```

**Key Finding**: The `withStrictRateLimit()` function allows **only 5 requests per 15-minute window**.

### 2. Session Endpoint Implementation

**File**: `/api/auth/session.ts`

```typescript
// Lines 176-179: Session handler with strict rate limiting
export default compose(
  withStrictRateLimit(),  // 5 requests per 15 minutes (strict for auth)
  withOriginValidation()  // Verify Origin/Referer header
)(sessionHandler)
```

**Key Finding**: The `/api/auth/session` endpoint uses `withStrictRateLimit()`, which means:
- Maximum 5 login attempts per 15 minutes
- Counter increments BEFORE request is processed (line 99 in withRateLimit.ts)
- Failed attempts are counted (because `skipSuccessfulRequests: true` only skips successful ones)

### 3. Rate Limit Storage Mechanism

**File**: `/api/middleware/withRateLimit.ts`

```typescript
// Lines 16-21: In-memory storage
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()
```

**Key Finding**: Rate limit state is stored **in-memory** using a Map:
- **Serverless Concern**: In serverless (Vercel), this resets between cold starts
- **Development Concern**: In development (`npm run dev`), this persists across all requests until server restart
- **Production Concern**: Without Redis, rate limits are inconsistent across serverless instances

### 4. Counter Increment Logic

**File**: `/api/middleware/withRateLimit.ts`

```typescript
// Lines 87-111: Counter increments BEFORE checking limit
let entry = rateLimitStore.get(key)

if (!entry || now > entry.resetTime) {
  entry = {
    count: 0,
    resetTime: now + opts.windowMs,
  }
  rateLimitStore.set(key, entry)
}

// Increment counter IMMEDIATELY (before request processing)
entry.count++

// Check if rate limit exceeded
if (entry.count > opts.maxRequests) {
  return res.status(429).json({ ... })
}
```

**Critical Issue**: Counter increments **before** request validation, meaning:
1. Invalid credentials count toward rate limit
2. Malformed requests count toward rate limit
3. Network errors count toward rate limit
4. Testing attempts count toward rate limit

### 5. No Auto-Retry in Frontend

**File**: `/src/hooks/useSecureAuth.ts`

```typescript
// Lines 109-138: Single login attempt, no retry logic
const login = useCallback(async (email: string, password: string) => {
  if (loginInProgress.current) {
    logger.warn('Login already in progress')
    return
  }

  try {
    loginInProgress.current = true
    setIsLoading(true)
    setError(null)

    const response = await apiClient.post<{ user: User }>('/api/auth/session', {
      email,
      password,
    })

    setUser(response.user)
  } catch (err) {
    logger.error('Login failed:', err)
    setError(err instanceof Error ? err : new Error('Login failed'))
    throw err
  } finally {
    setIsLoading(false)
    loginInProgress.current = false
  }
}, [logger])
```

**Finding**: No auto-retry loops detected in frontend code. Login attempts are user-initiated only.

### 6. Session Verification Disabled

**File**: `/src/hooks/useSecureAuth.ts`

```typescript
// Lines 186-197: Session verification TEMPORARILY DISABLED
useEffect(() => {
  if (isInitialMount.current) {
    isInitialMount.current = false
    // TEMPORARY BYPASS: Skip session verification
    // verifySession()
    setIsLoading(false) // Ensure loading state is cleared
  }
}, [verifySession])
```

**Finding**: Session verification on mount is disabled, so no hidden auth loops on page load.

## Root Cause Analysis

### Primary Cause: Overly Restrictive Rate Limiting

The authentication endpoint uses **5 requests per 15 minutes**, which is too restrictive for:

1. **Development/Testing**: Developers testing login flows hit the limit quickly
2. **User Experience**: Users who mistype passwords 5 times must wait 15 minutes
3. **Integration Testing**: Automated tests that attempt multiple logins fail
4. **Password Recovery Flows**: Users trying multiple accounts hit the limit

### Secondary Cause: Counter Increments Before Validation

The rate limit counter increments **before** the request is validated:

```typescript
// Line 99: Counter increments IMMEDIATELY
entry.count++

// Lines 111-124: THEN check if exceeded
if (entry.count > opts.maxRequests) {
  return res.status(429).json({ ... })
}
```

This means:
- The 6th request gets counted → limit exceeded → returns 429
- Even though only 5 requests actually reached the handler
- Off-by-one effect makes the limit feel even more restrictive

### Tertiary Cause: In-Memory Storage Without Persistence

Rate limit state uses in-memory Map:
- **Development**: Persists across all requests until server restart
- **Serverless**: Resets between cold starts (inconsistent behavior)
- **Production**: Different instances have different counters (unreliable)

## Triggering Scenarios

### Scenario 1: Development Testing (Most Likely Current Issue)

```
1. Developer starts server: npm run dev
2. Tests login with wrong password → Count: 1
3. Tests login with wrong password → Count: 2
4. Tests login with wrong password → Count: 3
5. Tests login with correct password but typo → Count: 4
6. Tests login with correct password → Count: 5
7. Reloads page, tries again → Count: 6 → 429 ERROR
8. Server keeps running, counter persists for 15 minutes
```

### Scenario 2: User Password Recovery

```
1. User forgets password
2. Tries email@company.com → Count: 1 (wrong password)
3. Tries email@gmail.com → Count: 2 (wrong email)
4. Tries firstname@company.com → Count: 3 (wrong email)
5. Tries firstname.lastname@company.com → Count: 4 (wrong email)
6. Remembers correct email, tries wrong password → Count: 5
7. Tries correct credentials → Count: 6 → 429 ERROR
8. Locked out for 15 minutes
```

### Scenario 3: Automated Testing

```
1. Test suite runs login tests
2. Each test attempt counts toward rate limit
3. After 5 test cases, all subsequent tests fail with 429
4. Must restart server or wait 15 minutes between test runs
```

## Current State Verification

To verify the current rate limit state, check:

```bash
# Rate limit headers in response
curl -v http://localhost:3003/api/auth/session -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  2>&1 | grep -i "rate-limit"

# Expected headers:
# X-RateLimit-Limit: 5
# X-RateLimit-Remaining: 0 (if exceeded)
# X-RateLimit-Reset: <timestamp>
# Retry-After: <seconds> (if 429)
```

## Recommended Fixes

### Fix 1: Increase Rate Limit for Development (IMMEDIATE)

**File**: `/api/middleware/withRateLimit.ts`

```typescript
export function withStrictRateLimit(): MiddlewareWrapper {
  // Different limits for development vs production
  const isDevelopment = process.env.NODE_ENV === 'development'

  return withRateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: isDevelopment ? 100 : 10,  // More lenient in dev
    skipSuccessfulRequests: true,
  })
}
```

**Impact**: Allows more attempts during development while maintaining security in production.

### Fix 2: Only Count Failed Login Attempts (RECOMMENDED)

**File**: `/api/middleware/withRateLimit.ts`

```typescript
export function withStrictRateLimit(): MiddlewareWrapper {
  return withRateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 10,  // Increased to 10 attempts
    skipSuccessfulRequests: true,  // ✅ Already enabled
    skipFailedRequests: false,  // Count failed attempts (current)
  })
}
```

**Plus**: Decrement counter for non-401 errors in session handler:

```typescript
// In api/auth/session.ts
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  try {
    // ... existing validation ...

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      // Only 401/invalid credentials should count toward rate limit
      return res.status(401).json({ ... })
    }

    // Success - counter was already decremented by skipSuccessfulRequests
    return res.status(200).json({ ... })
  } catch (error) {
    // Server errors shouldn't count toward rate limit
    // But current implementation doesn't decrement on catch
    return res.status(500).json({ ... })
  }
}
```

### Fix 3: Add Rate Limit Reset Endpoint (DEVELOPMENT TOOL)

**File**: `/api/auth/clear-rate-limit.ts` (new)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * DEVELOPMENT ONLY: Clear rate limit for testing
 * Should be disabled in production
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Clear rate limit store (requires exporting rateLimitStore)
  const { clearRateLimitStore } = await import('./middleware/withRateLimit')
  clearRateLimitStore()

  return res.status(200).json({
    success: true,
    message: 'Rate limit cleared',
  })
}
```

### Fix 4: Implement Redis for Production (LONG-TERM)

Replace in-memory Map with Redis for consistent rate limiting across serverless instances:

```typescript
// Use @upstash/redis for Vercel serverless
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function getRateLimitEntry(key: string): Promise<RateLimitEntry | null> {
  const entry = await redis.get(key)
  return entry as RateLimitEntry | null
}

async function setRateLimitEntry(key: string, entry: RateLimitEntry): Promise<void> {
  await redis.set(key, entry, {
    ex: Math.ceil((entry.resetTime - Date.now()) / 1000)
  })
}
```

## Immediate Action Required

### For Current Session

**Option A: Restart Development Server**
```bash
# Kill existing server
pkill -f "vite"

# Restart
npm run dev
```

**Option B: Wait 15 Minutes**
```
Current time: <timestamp>
Rate limit resets: <timestamp + 15 minutes>
```

**Option C: Change IP Address** (if using IP-based limiting)
```bash
# Use different network or VPN
# Or modify keyGenerator to use different identifier
```

### For Long-Term Solution

1. **Immediate**: Apply Fix 1 (environment-based limits)
2. **Short-term**: Apply Fix 2 (better error handling)
3. **Development**: Apply Fix 3 (reset endpoint)
4. **Production**: Apply Fix 4 (Redis implementation)

## Configuration Changes

### Recommended Rate Limits by Environment

```typescript
const RATE_LIMIT_CONFIG = {
  development: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,  // Very lenient for testing
  },
  staging: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,  // Moderate for QA testing
  },
  production: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,  // Balanced security vs UX
  },
}
```

### Security Best Practices

While increasing rate limits, maintain security by:

1. **Log Failed Attempts**: Track patterns for brute force detection
2. **Alert on Anomalies**: Notify admins of suspicious activity
3. **Progressive Delays**: Increase delay after each failed attempt
4. **Account Lockout**: Lock accounts after persistent failures
5. **CAPTCHA**: Add CAPTCHA after N failed attempts

## Testing Recommendations

### Verify Fix Effectiveness

```typescript
// Test: Should allow 10 failed attempts before rate limiting
describe('Rate Limit - Authentication', () => {
  it('should allow 10 failed login attempts', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
      })
      expect(response.status).toBe(401) // Invalid credentials, not 429
    }
  })

  it('should rate limit on 11th attempt', async () => {
    // After 10 failed attempts above
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
    })
    expect(response.status).toBe(429) // Rate limited
  })
})
```

## Conclusion

The 429 error is caused by **extremely restrictive rate limiting** (5 requests/15min) combined with **in-memory storage** that persists across development sessions. The issue is exacerbated by **counter incrementing before validation**, making the effective limit feel even lower.

**Recommended Immediate Action**: Apply Fix 1 to allow 100 requests in development
**Recommended Short-Term**: Apply Fix 2 to increase production limit to 10
**Recommended Long-Term**: Apply Fix 4 to implement Redis for serverless consistency

---

**Document Created**: 2025-10-01
**Analysis Type**: Root Cause Analysis
**Severity**: CRITICAL
**Status**: UNRESOLVED (fixes pending)
