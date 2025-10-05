# Rate Limit Quick Reference

**Last Updated**: 2025-10-01

---

## Quick Problem Resolution

### Problem: "Too many requests" 429 error during development

**Solution 1: Use lenient development mode** (Recommended)
```bash
# In .env file
NODE_ENV=development
BYPASS_RATE_LIMIT=false
```
**Result**: 20x more lenient (100 login attempts per 15min instead of 5)

**Solution 2: Emergency bypass** (Use only when Solution 1 insufficient)
```bash
# In .env file
NODE_ENV=development
BYPASS_RATE_LIMIT=true  # ⚠️ Disables all rate limiting
```
**Result**: Complete bypass, no rate limiting

**Solution 3: Wait for rate limit reset**
- Check `Retry-After` header in 429 response
- Wait specified seconds, then retry
- Default: 15 minutes maximum wait

**Solution 4: Restart dev server**
- Stop development server (Ctrl+C)
- Restart: `npm run dev`
- In-memory rate limit state cleared

---

## Rate Limit Levels by Environment

### Development Mode (`NODE_ENV=development`)

| Endpoint | Limit | Window | Notes |
|----------|-------|--------|-------|
| Login (failed) | 100 | 15 min | 20x more than prod |
| Login (success) | Unlimited | - | Never counted |
| Token refresh | 5000 | 15 min | ~333/min |
| General endpoints | 1000 | 15 min | ~66/min |

### Production Mode (`NODE_ENV=production` or unset)

| Endpoint | Limit | Window | Notes |
|----------|-------|--------|-------|
| Login (failed) | 5 | 15 min | Brute-force protection |
| Login (success) | Unlimited | - | Never counted |
| Token refresh | 50 | 15 min | ~3/min |
| General endpoints | 100 | 15 min | ~6/min |

---

## Environment Variables

```bash
# Environment mode (affects all rate limits)
NODE_ENV=development        # Lenient (dev/test)
NODE_ENV=production         # Strict (default)
NODE_ENV=test              # Strict (same as production)

# Vercel auto-sets this (overrides NODE_ENV)
VERCEL_ENV=development     # Vercel preview/dev
VERCEL_ENV=production      # Vercel production

# Emergency bypass (dev only)
BYPASS_RATE_LIMIT=false    # Normal (rate limited)
BYPASS_RATE_LIMIT=true     # Bypass (⚠️ dev only, logs warnings)
```

---

## Configuration Examples

### Local Development (Recommended)
```bash
# .env
NODE_ENV=development
BYPASS_RATE_LIMIT=false
```
**Effect**: Lenient but still protected

### Testing with Mock Data
```bash
# .env
NODE_ENV=development
BYPASS_RATE_LIMIT=true
```
**Effect**: No rate limiting, can test at high volume

### Staging Environment
```bash
# Vercel Environment Variables
NODE_ENV=production
# DO NOT set BYPASS_RATE_LIMIT
```
**Effect**: Production-level security

### Production Deployment
```bash
# Vercel automatically sets
VERCEL_ENV=production
# DO NOT override with NODE_ENV or BYPASS_RATE_LIMIT
```
**Effect**: Strict security (5 login attempts per 15min)

---

## Response Headers

All rate-limited endpoints return these headers:

```http
X-RateLimit-Limit: 100           # Max requests in window
X-RateLimit-Remaining: 95        # Remaining requests
X-RateLimit-Reset: 1696118400000 # Unix timestamp when limit resets
```

When rate limit exceeded (429 error):
```http
Retry-After: 847                 # Seconds until reset
```

**Usage**:
```javascript
const response = await fetch('/api/auth/session', { method: 'POST' })

if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  console.log(`Rate limited. Retry in ${retryAfter} seconds`)
}
```

---

## Error Response Format

```json
{
  "error": {
    "message": "Too many requests. Please try again later.",
    "code": "RATE_LIMIT_EXCEEDED",
    "details": {
      "limit": 5,
      "retryAfter": 847
    }
  },
  "timestamp": "2025-10-01T12:34:56.789Z"
}
```

---

## Common Scenarios

### Scenario: Testing login with wrong password repeatedly

**Development**:
- Limit: 100 failed attempts per 15 minutes
- Behavior: Can test typos/edge cases freely
- Security: Still protected against runaway scripts

**Production**:
- Limit: 5 failed attempts per 15 minutes
- Behavior: After 5 wrong passwords, wait 15 minutes
- Security: Strong brute-force protection

---

### Scenario: Hot reload during development

**Development** (lenient mode):
- Token refresh: 5000/15min (~333/min)
- Effect: Hot reload doesn't trigger rate limits

**Development** (bypass mode):
- No rate limiting
- Effect: Unlimited hot reloads

**Production**:
- Token refresh: 50/15min (~3/min)
- Effect: Normal usage unaffected, abuse prevented

---

### Scenario: CI/CD automated testing

**Recommendation**: Use bypass mode in test environment

```bash
# CI environment variables
NODE_ENV=test              # or 'development'
BYPASS_RATE_LIMIT=true     # Disable rate limiting for test speed
```

**Alternative**: Use lenient mode if tests verify rate limiting

```bash
NODE_ENV=development       # 100 attempts per test run
BYPASS_RATE_LIMIT=false    # Test rate limiting behavior
```

---

## Security Checklist

Before deploying to production:

- [ ] `NODE_ENV=production` (or let Vercel set `VERCEL_ENV=production`)
- [ ] `BYPASS_RATE_LIMIT` is NOT set (or set to `false`)
- [ ] Test login failures return 429 after 5 attempts
- [ ] Verify `X-RateLimit-Limit: 5` header on auth endpoint
- [ ] No bypass warnings in production logs

Before local development:

- [ ] `NODE_ENV=development` in `.env`
- [ ] `BYPASS_RATE_LIMIT=false` for normal testing
- [ ] `BYPASS_RATE_LIMIT=true` only for high-volume testing
- [ ] Restart server after changing environment variables

---

## Monitoring

### Development Console Logs

**Normal rate limiting**:
```
[Rate Limit] Remaining: 95/100 for 127.0.0.1
```

**Bypass mode active** (warning):
```
⚠️  [SECURITY] Rate limiting bypassed in development mode
⚠️  [SECURITY] This should NEVER be enabled in production
[DEV] Rate limiting bypassed for /api/auth/session
```

**Rate limit exceeded**:
```
[Rate Limit] 429 returned for IP: 127.0.0.1
Endpoint: /api/auth/session, Count: 101/100, Retry-After: 234s
```

---

### Production Monitoring

**Normal traffic** (no logs, silent success)

**Potential attack**:
```
[Rate Limit] 429 returned for IP: 203.0.113.42
Endpoint: /api/auth/session
Count: 6, Limit: 5, Retry-After: 847s
```

**Action**: If high frequency:
1. Check IP reputation
2. Review access logs for patterns
3. Consider IP blocking if distributed attack

---

## Troubleshooting

### Issue: Rate limit not changing in development

**Cause**: Environment variable not set or server not restarted

**Solution**:
```bash
# 1. Verify .env file
cat .env | grep NODE_ENV
# Should show: NODE_ENV=development

# 2. Restart server
# Stop: Ctrl+C
npm run dev

# 3. Verify in logs (should NOT see bypass warnings if BYPASS_RATE_LIMIT=false)
```

---

### Issue: Bypass not working

**Cause**: Production mode or environment variable typo

**Checklist**:
```bash
# Must be EXACTLY 'true' (not 'True' or '1')
BYPASS_RATE_LIMIT=true

# Must be development mode
NODE_ENV=development  # OR VERCEL_ENV=development

# Restart required after changing .env
npm run dev
```

**Verify**:
Look for console warnings:
```
⚠️  [SECURITY] Rate limiting bypassed in development mode
```

---

### Issue: Production still shows lenient limits

**Cause**: `NODE_ENV=development` set in production

**Fix in Vercel**:
1. Go to Project Settings > Environment Variables
2. Remove `NODE_ENV` variable (let Vercel set `VERCEL_ENV`)
3. OR set `NODE_ENV=production` explicitly
4. Redeploy

**Verify**:
```bash
curl -I https://your-app.vercel.app/api/auth/session
# Should show: X-RateLimit-Limit: 5
```

---

### Issue: Shared IP users getting locked out

**Cause**: Corporate NAT/proxy shares IP for many users

**Short-term fix**: Increase production limits
```typescript
// api/middleware/withRateLimit.ts
export function withStrictRateLimit(): MiddlewareWrapper {
  return withRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: isDevelopment ? 100 : 10,  // Increased from 5 to 10
    skipSuccessfulRequests: true,
  })
}
```

**Long-term fix**: Implement per-email rate limiting
```typescript
keyGenerator: (req) => {
  const email = req.body?.email
  return email ? `login:${email}` : `ip:${getIP(req)}`
}
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `api/middleware/withRateLimit.ts` | Rate limiting implementation |
| `api/auth/session.ts` | Login endpoint (strict rate limiting) |
| `api/auth/refresh.ts` | Token refresh (moderate rate limiting) |
| `.env.example` | Configuration documentation |
| `claudedocs/RATE_LIMIT_SECURITY_ANALYSIS.md` | Complete security analysis |
| `claudedocs/RATE_LIMIT_IMPLEMENTATION_SUMMARY.md` | Implementation details |

---

## Support

For issues not covered here:
1. Check full security analysis: `/claudedocs/RATE_LIMIT_SECURITY_ANALYSIS.md`
2. Review implementation summary: `/claudedocs/RATE_LIMIT_IMPLEMENTATION_SUMMARY.md`
3. Inspect rate limiting code: `/api/middleware/withRateLimit.ts`
