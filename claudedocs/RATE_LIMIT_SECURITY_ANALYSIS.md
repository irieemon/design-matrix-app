# Rate Limit Security Analysis

**Analysis Date**: 2025-10-01
**Security Engineer**: Claude
**Severity**: MEDIUM (Development UX Impact) / HIGH (Production Security Concern)

---

## Executive Summary

The application implements rate limiting with security-first defaults that are **too aggressive for development** but **appropriate for production**. The strict rate limiting on authentication endpoints (5 requests per 15 minutes) is blocking legitimate development workflows while providing strong brute-force protection.

**Critical Finding**: No environment-based configuration exists to differentiate development from production rate limits.

---

## Current Rate Limit Configuration Analysis

### 1. Authentication Endpoints (`/api/auth/session`)

**File**: `/api/auth/session.ts:177`

```typescript
withStrictRateLimit()  // 5 requests per 15 minutes (strict for auth)
```

**Configuration** (from `withRateLimit.ts:153-159`):
```typescript
windowMs: 15 * 60 * 1000,  // 15 minutes
maxRequests: 5,  // Only 5 requests per window
skipSuccessfulRequests: true,  // Only count failed attempts
```

**Security Analysis**:
- ✅ **Excellent** for production brute-force protection
- ✅ Prevents credential stuffing attacks (5 failed attempts = 15min lockout)
- ✅ Only counts failed login attempts (`skipSuccessfulRequests: true`)
- ⚠️ **Too restrictive** for development (1 typo = wait 15 minutes after 5 attempts)
- ⚠️ Per-IP tracking means local development shares rate limit across sessions

**Threat Model Coverage**:
- ✅ Brute force attacks: MITIGATED
- ✅ Credential stuffing: MITIGATED
- ✅ Password spraying: MITIGATED
- ⚠️ Development workflow: IMPACTED

---

### 2. Token Refresh Endpoint (`/api/auth/refresh`)

**File**: `/api/auth/refresh.ts:129-133`

```typescript
withRateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  maxRequests: 50,  // Allow more refreshes than login
})
```

**Security Analysis**:
- ✅ **Appropriate** for legitimate refresh operations
- ✅ 50 requests per 15min = ~3 requests/min (reasonable for active sessions)
- ✅ Does NOT skip successful requests (tracks all refresh attempts)
- ⚠️ Could still impact rapid development iteration (hot reload scenarios)

**Threat Model Coverage**:
- ✅ Token enumeration: MITIGATED
- ✅ Refresh token abuse: MITIGATED
- ⚠️ Development hot reload: POTENTIALLY IMPACTED

---

### 3. Default Rate Limit (General Endpoints)

**File**: `/api/middleware/withRateLimit.ts:26-37`

```typescript
windowMs: 15 * 60 * 1000,  // 15 minutes
maxRequests: 100,  // 100 requests per window
skipSuccessfulRequests: false,
skipFailedRequests: false,
```

**Key Generator** (Per-IP tracking):
```typescript
keyGenerator: (req) => {
  return req.headers['x-forwarded-for'] as string ||
         req.socket?.remoteAddress ||
         'unknown'
}
```

**Security Analysis**:
- ✅ **Good** general DoS protection
- ✅ Per-IP tracking prevents single-source abuse
- ⚠️ In-memory storage resets on serverless cold starts
- ⚠️ `x-forwarded-for` header can be spoofed (but Vercel sets this correctly)

---

## Security Trade-offs Analysis

### Current Strategy: Per-IP Rate Limiting

**Strengths**:
1. Simple implementation, no external dependencies
2. Effective against single-source attacks
3. Transparent to legitimate users (headers expose limits)
4. Fails safe (restrictive by default)

**Weaknesses**:
1. **Shared IP Problem**: Users behind NAT/proxy share rate limit
2. **Development Impact**: Local testing counts against production limits
3. **Cold Start Reset**: Serverless functions lose state between deployments
4. **No Bypass Mechanism**: Cannot disable for trusted development environments

**Attack Vectors Mitigated**:
- ✅ Brute force authentication attacks
- ✅ Single-source DoS attempts
- ✅ Credential stuffing from single IP

**Attack Vectors NOT Mitigated**:
- ❌ Distributed brute force (botnet attacks)
- ❌ IP rotation attacks
- ❌ Shared IP legitimate user lockout

---

## Recommended Production-Safe Adjustments

### Strategy 1: Environment-Based Configuration (RECOMMENDED)

**Rationale**: Different security requirements for dev vs production.

**Implementation**:

```typescript
// api/middleware/withRateLimit.ts

const isDevelopment = process.env.NODE_ENV === 'development' ||
                      process.env.VERCEL_ENV === 'development'

const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
  windowMs: 15 * 60 * 1000,
  maxRequests: isDevelopment ? 1000 : 100,  // 10x more lenient in dev
  // ... rest of config
}

export function withStrictRateLimit(): MiddlewareWrapper {
  return withRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: isDevelopment ? 100 : 5,  // 20x more lenient in dev
    skipSuccessfulRequests: true,
  })
}
```

**Security Impact**:
- ✅ No impact on production security posture
- ✅ Development remains secure (still rate limited, just more lenient)
- ✅ Explicit environment check (must be intentionally set)
- ⚠️ Requires proper `NODE_ENV` configuration in deployment

---

### Strategy 2: Differentiated Endpoint Limits (PRODUCTION-READY)

**Rationale**: Different endpoints have different attack surfaces.

**Recommended Limits**:

| Endpoint Type | Window | Max Requests | Rationale |
|--------------|--------|--------------|-----------|
| **Login (failed)** | 15min | 5 | Brute force protection |
| **Login (successful)** | 15min | Unlimited | Legitimate use |
| **Token Refresh** | 15min | 50 | Session management |
| **Password Reset** | 1hr | 3 | Account takeover protection |
| **AI Endpoints** | 1min | 10 | Resource protection |
| **Read Operations** | 1min | 100 | DoS protection |
| **Write Operations** | 1min | 30 | Data integrity |

**Current Implementation Already Differentiates**:
- ✅ Auth: 5 req/15min (failed only)
- ✅ Refresh: 50 req/15min
- ✅ Default: 100 req/15min

---

### Strategy 3: Enhanced Key Generation (ADVANCED)

**Rationale**: More granular control prevents collateral damage.

**Options**:

**A. User-Based After Authentication**:
```typescript
keyGenerator: (req) => {
  const authReq = req as AuthenticatedRequest
  if (authReq.user?.id) {
    return `user:${authReq.user.id}`  // Per-user for authenticated
  }
  return `ip:${req.headers['x-forwarded-for'] || 'unknown'}`  // Per-IP for anonymous
}
```

**B. Email-Based for Login Attempts**:
```typescript
// For login endpoint specifically
keyGenerator: (req) => {
  const email = req.body?.email
  if (email) {
    return `login:${email}`  // Per-email address
  }
  return `ip:${req.headers['x-forwarded-for'] || 'unknown'}`
}
```

**Security Impact**:
- ✅ Prevents shared IP lockout
- ✅ Targets actual attack vector (email enumeration)
- ⚠️ Requires request body parsing (performance cost)
- ⚠️ Email can be randomized by attacker (less effective)

---

## Development Bypass Mechanisms

### Option 1: Environment Variable Bypass (SECURE)

**Implementation**:
```typescript
// api/middleware/withRateLimit.ts

const BYPASS_RATE_LIMIT = process.env.BYPASS_RATE_LIMIT === 'true' &&
                          process.env.NODE_ENV === 'development'

export function withRateLimit(config: Partial<RateLimitConfig> = {}): MiddlewareWrapper {
  return (handler: MiddlewareHandler) => {
    return async (req: VercelRequest, res: VercelResponse) => {
      // Bypass in local development only
      if (BYPASS_RATE_LIMIT) {
        console.warn('[DEV] Rate limiting bypassed')
        return handler(req as AuthenticatedRequest, res)
      }

      // Normal rate limiting logic...
    }
  }
}
```

**Add to `.env.example`**:
```bash
# Rate Limiting Configuration
# DANGER: Only set to 'true' in local development
# NEVER enable in production (will bypass all rate limits)
BYPASS_RATE_LIMIT=false
```

**Security Analysis**:
- ✅ Explicit opt-in (must be manually enabled)
- ✅ Environment-gated (requires `development` mode)
- ✅ Visible in logs (warning message)
- ⚠️ Could be accidentally deployed (use environment check)

---

### Option 2: IP Whitelist (TARGETED)

**Implementation**:
```typescript
const WHITELISTED_IPS = process.env.RATE_LIMIT_WHITELIST?.split(',') || []

const key = opts.keyGenerator(req)
if (WHITELISTED_IPS.includes(key)) {
  return handler(req as AuthenticatedRequest, res)
}
```

**Add to `.env.example`**:
```bash
# Whitelist specific IPs from rate limiting (comma-separated)
# Example: RATE_LIMIT_WHITELIST=127.0.0.1,::1
RATE_LIMIT_WHITELIST=
```

**Security Analysis**:
- ✅ Granular control (specific IPs only)
- ✅ Safe for CI/CD environments
- ⚠️ IP changes require config update
- ⚠️ VPN/proxy IPs could be shared

---

## Development Workflow Solutions

### Immediate Fix (No Code Changes)

**Clear Rate Limit State**:

The current implementation uses in-memory storage that resets on:
1. **Serverless cold start**: Wait ~5 minutes for function timeout
2. **Manual restart**: Restart local dev server
3. **Time-based expiry**: Wait 15 minutes for window reset

**Development Workaround**:
```bash
# Force serverless function restart (local dev)
npm run dev  # Stop and restart

# Wait for rate limit window expiry
# Check headers for exact timing:
# X-RateLimit-Reset: <timestamp>
# Retry-After: <seconds>
```

---

### Recommended Production Configuration

**For `.env.example` (add these variables)**:

```bash
# ═══════════════════════════════════════════════════════════
# Rate Limiting Configuration
# ═══════════════════════════════════════════════════════════

# Environment-based rate limiting
# Automatically adjusts limits based on NODE_ENV
# development: 10-20x more lenient limits for testing
# production: Strict limits for security
NODE_ENV=production

# DEVELOPMENT ONLY: Bypass rate limiting entirely
# ⚠️  DANGER: Do NOT enable in production
# ⚠️  This completely disables brute-force protection
# Set to 'true' only in local development environment
BYPASS_RATE_LIMIT=false

# OPTIONAL: Whitelist specific IPs from rate limiting
# Useful for CI/CD pipelines, monitoring systems, or trusted sources
# Format: Comma-separated IP addresses
# Example: 127.0.0.1,::1,192.168.1.100
RATE_LIMIT_WHITELIST=

# OPTIONAL: Custom rate limit configuration
# Override default limits for specific endpoints
# Format: <maxRequests>/<windowSeconds>
# Default auth: 5/900 (5 requests per 15 minutes)
# Default refresh: 50/900 (50 requests per 15 minutes)
# Default general: 100/900 (100 requests per 15 minutes)
# AUTH_RATE_LIMIT=5/900
# REFRESH_RATE_LIMIT=50/900
# GENERAL_RATE_LIMIT=100/900
```

---

## Recommended Code Changes

### File: `api/middleware/withRateLimit.ts`

**Changes to implement**:

1. **Add environment detection**:
```typescript
// Line 26-27 (after imports)
const isDevelopment = process.env.NODE_ENV === 'development' ||
                      process.env.VERCEL_ENV === 'development'
const bypassRateLimit = process.env.BYPASS_RATE_LIMIT === 'true' && isDevelopment
```

2. **Update default config**:
```typescript
// Line 26-37 (update DEFAULT_RATE_LIMIT_CONFIG)
const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
  windowMs: 15 * 60 * 1000,
  maxRequests: isDevelopment ? 1000 : 100,  // 10x more in dev
  // ... rest unchanged
}
```

3. **Update strict rate limit**:
```typescript
// Line 153-159 (update withStrictRateLimit)
export function withStrictRateLimit(): MiddlewareWrapper {
  return withRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: isDevelopment ? 100 : 5,  // 20x more in dev
    skipSuccessfulRequests: true,
  })
}
```

4. **Add bypass logic**:
```typescript
// Line 82 (inside withRateLimit function, before rate limit logic)
return async (req: VercelRequest, res: VercelResponse) => {
  // Development bypass
  if (bypassRateLimit) {
    console.warn('[DEV] Rate limiting bypassed for development')
    return handler(req as AuthenticatedRequest, res)
  }

  const key = opts.keyGenerator(req)
  // ... rest of logic
}
```

**Security Impact Assessment**:
- ✅ **Zero impact on production** (environment-gated)
- ✅ **Explicit configuration** (requires manual environment setup)
- ✅ **Maintains security defaults** (production remains strict)
- ✅ **Audit trail** (bypass logs warning message)

---

## Attack Scenario Analysis

### Scenario 1: Brute Force Attack (Production)

**Current Protection**:
- Attacker attempts password guessing on `/api/auth/session`
- After 5 failed attempts: 429 error, 15-minute lockout
- `skipSuccessfulRequests: true` means only failures count

**Effectiveness**: ✅ **EXCELLENT**
- 5 attempts / 15min = 0.33 attempts/min
- 480 attempts/day maximum per IP
- Renders brute force impractical

**Bypass Methods**:
- Distributed attack (multiple IPs): Partially effective
- IP rotation: Partially effective
- Slow password spray: Still rate-limited

**Recommendation**: Current implementation is strong. Consider adding:
- Email-based key generation (per-account lockout)
- Progressive delays (exponential backoff)
- Account-level lockout after threshold

---

### Scenario 2: Credential Stuffing (Production)

**Current Protection**:
- Large-scale credential testing from breach databases
- Rate limit applies per IP: 5 attempts / 15min

**Effectiveness**: ⚠️ **MODERATE**
- Single IP: Well protected
- Distributed botnet: Bypasses per-IP limits

**Recommendation**: Add per-email rate limiting:
```typescript
// For login endpoint
keyGenerator: (req) => {
  const email = req.body?.email
  return email ? `login:${email}` : `ip:${getIP(req)}`
}
```

This limits attempts **per account**, not per IP.

---

### Scenario 3: Development Iteration (Development)

**Current Problem**:
- Developer makes typo in password 5 times
- Locked out for 15 minutes
- Blocks legitimate development work

**Proposed Solution**: Environment-based limits
- Development: 100 attempts / 15min (20x more lenient)
- Still protects against runaway scripts
- Allows normal testing workflow

**Effectiveness**: ✅ **EXCELLENT**

---

## Security Compliance Assessment

### OWASP Top 10 Coverage

| Risk | Rate Limiting Impact | Status |
|------|---------------------|--------|
| **A07:2021 - Identification and Authentication Failures** | Prevents brute force | ✅ MITIGATED |
| **A04:2021 - Insecure Design** | Implements security control | ✅ ADDRESSED |
| **A01:2021 - Broken Access Control** | Limits unauthorized attempts | ✅ ADDRESSED |

### CWE Coverage

- **CWE-307**: Improper Restriction of Excessive Authentication Attempts → ✅ MITIGATED
- **CWE-799**: Improper Control of Interaction Frequency → ✅ MITIGATED
- **CWE-837**: Improper Enforcement of a Single, Unique Action → ✅ ADDRESSED

---

## Monitoring and Observability Recommendations

### Add Rate Limit Metrics

**Implementation**:
```typescript
// Track rate limit hits
if (entry.count > opts.maxRequests) {
  console.warn('[RATE_LIMIT]', {
    key,
    endpoint: req.url,
    count: entry.count,
    limit: opts.maxRequests,
    retryAfter: resetInSeconds,
  })

  // Optional: Send to monitoring service
  // await trackMetric('rate_limit.exceeded', { endpoint, key })
}
```

**Monitoring Goals**:
1. Detect actual attacks (high rate limit hits)
2. Identify false positives (legitimate users hitting limits)
3. Tune limits based on real usage patterns

---

## Conclusion and Recommendations

### Immediate Actions (Low Risk)

1. **Add environment-based configuration**
   - Risk: NONE (only affects development)
   - Effort: 15 minutes
   - Impact: HIGH (resolves development UX issue)

2. **Update `.env.example` with rate limit variables**
   - Risk: NONE (documentation only)
   - Effort: 5 minutes
   - Impact: MEDIUM (clarifies configuration)

3. **Add bypass option for local development**
   - Risk: LOW (environment-gated)
   - Effort: 10 minutes
   - Impact: HIGH (emergency escape hatch)

### Medium-Term Improvements (Production Enhancement)

1. **Implement per-email rate limiting for login**
   - Risk: LOW (more targeted protection)
   - Effort: 30 minutes
   - Impact: HIGH (better security, less collateral damage)

2. **Add rate limit monitoring and alerts**
   - Risk: NONE (observability)
   - Effort: 1 hour
   - Impact: HIGH (detect attacks, tune limits)

3. **Consider Redis-backed rate limiting for production**
   - Risk: MEDIUM (external dependency)
   - Effort: 2-4 hours
   - Impact: HIGH (persistent, distributed protection)

### Long-Term Considerations (Enterprise)

1. **Implement progressive delays (exponential backoff)**
2. **Add account-level lockout mechanism**
3. **Integrate with WAF/CDN rate limiting (Cloudflare, Vercel Edge)**
4. **Implement CAPTCHA for suspicious patterns**

---

## Summary Table

| Configuration | Current | Recommended (Dev) | Recommended (Prod) |
|--------------|---------|-------------------|-------------------|
| **Login (failed)** | 5/15min | 100/15min | 5/15min |
| **Login (successful)** | Unlimited | Unlimited | Unlimited |
| **Token Refresh** | 50/15min | 500/15min | 50/15min |
| **Default Endpoints** | 100/15min | 1000/15min | 100/15min |
| **Bypass Option** | ❌ None | ✅ ENV flag | ❌ None |
| **Key Strategy** | Per-IP | Per-IP | Per-Email + Per-IP |

---

**Security Posture**: ✅ STRONG (Production)
**Developer Experience**: ⚠️ NEEDS IMPROVEMENT (Development)
**Recommended Action**: Implement environment-based configuration (APPROVED)
