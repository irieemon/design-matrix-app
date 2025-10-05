# httpOnly Cookie Auth - Quick Start Guide

**Quick reference for implementing the httpOnly cookie authentication system**

See [HTTPONLY_COOKIE_AUTH_ARCHITECTURE.md](./HTTPONLY_COOKIE_AUTH_ARCHITECTURE.md) for complete specifications.

---

## Implementation Order

### Phase 1: Database Setup (1 hour)

```bash
# 1. Run migration in Supabase SQL Editor
cat database/migrations/001_httponly_cookie_auth.sql | pbcopy
# Paste and run in Supabase dashboard

# 2. Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('user_component_states', 'admin_audit_log');
```

### Phase 2: Environment Variables (15 minutes)

```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to Vercel
vercel env add STATE_ENCRYPTION_KEY production
# Paste the generated key

# Verify all required vars
vercel env ls
```

### Phase 3: Core Files (2-3 hours)

Create these files in order:

1. `api/auth/utils/cookie-config.ts` - Cookie configuration
2. `api/auth/utils/cookie-helpers.ts` - Cookie utilities
3. `api/auth/utils/csrf.ts` - CSRF token generation/validation
4. `api/middleware/withAuth.ts` - Auth verification middleware
5. `api/middleware/withCSRF.ts` - CSRF validation middleware
6. `api/middleware/withRateLimit.ts` - Rate limiting middleware
7. `api/auth/session.ts` - Login/logout endpoint
8. `api/auth/refresh.ts` - Token refresh endpoint
9. `api/auth/verify.ts` - Session verification endpoint

### Phase 4: Frontend Integration (2-3 hours)

Update these files:

1. `src/lib/api-client.ts` - Create new API client with cookie support
2. `src/hooks/useAuth.ts` - Add httpOnly auth mode
3. `src/hooks/useTokenRefresh.ts` - Proactive token refresh

### Phase 5: Testing & Deployment (2-3 hours)

```bash
# Run tests
npm run test:api

# Deploy with feature flag OFF
vercel --prod

# Enable for 10% of users
vercel env add VITE_USE_HTTPONLY_AUTH true

# Monitor and gradually increase
```

---

## Essential Code Snippets

### Cookie Configuration

```typescript
// api/auth/utils/cookie-config.ts
export const COOKIE_CONFIG = {
  accessToken: {
    name: 'sb-access-token',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60  // 1 hour
  },
  refreshToken: {
    name: 'sb-refresh-token',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60  // 7 days
  },
  csrf: {
    name: 'csrf-token',
    httpOnly: false,  // Readable by JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60  // 1 hour
  }
}
```

### Set Cookie Helper

```typescript
// api/auth/utils/cookie-helpers.ts
import { VercelResponse } from '@vercel/node'

export function setCookie(
  res: VercelResponse,
  name: string,
  value: string,
  options: any
) {
  const parts = [
    `${name}=${value}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    options.httpOnly && 'HttpOnly',
    options.secure && 'Secure',
    `SameSite=${options.sameSite}`
  ].filter(Boolean)

  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearAuthCookies(res: VercelResponse) {
  const clearCookie = (name: string, path: string = '/') => {
    res.setHeader('Set-Cookie', `${name}=; Path=${path}; Max-Age=0`)
  }

  clearCookie('sb-access-token')
  clearCookie('sb-refresh-token', '/api/auth')
  clearCookie('csrf-token')
}
```

### CSRF Generation & Validation

```typescript
// api/auth/utils/csrf.ts
import crypto from 'crypto'

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function validateCSRFToken(
  headerToken: string,
  cookieToken: string
): boolean {
  if (!headerToken || !cookieToken) return false

  return crypto.timingSafeEqual(
    Buffer.from(headerToken),
    Buffer.from(cookieToken)
  )
}
```

### Login Endpoint

```typescript
// api/auth/session.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { COOKIE_CONFIG } from './utils/cookie-config'
import { setCookie, clearAuthCookies } from './utils/cookie-helpers'
import { generateCSRFToken } from './utils/csrf'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const { email, password } = req.body

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error || !data.session) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const csrfToken = generateCSRFToken()

    setCookie(res, 'sb-access-token', data.session.access_token, COOKIE_CONFIG.accessToken)
    setCookie(res, 'sb-refresh-token', data.session.refresh_token, COOKIE_CONFIG.refreshToken)
    setCookie(res, 'csrf-token', csrfToken, COOKIE_CONFIG.csrf)

    return res.status(200).json({
      user: data.user,
      csrfToken
    })
  } else if (req.method === 'DELETE') {
    clearAuthCookies(res)
    return res.status(200).json({ success: true })
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}
```

### withAuth Middleware

```typescript
// api/middleware/withAuth.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export function withAuth(handler: any) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const accessToken = req.cookies['sb-access-token']

    if (!accessToken) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    ;(req as any).user = { id: user.id, email: user.email }

    return handler(req, res)
  }
}
```

### Frontend API Client

```typescript
// src/lib/api-client.ts
class ApiClient {
  private getCsrfToken(): string | null {
    const match = document.cookie.match(/csrf-token=([^;]+)/)
    return match ? match[1] : null
  }

  async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': this.getCsrfToken() || '',
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'  // Send cookies
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`)
    }

    return response.json()
  }

  async get<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'GET' })
  }

  async post<T>(url: string, data: any): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}

export const apiClient = new ApiClient()
```

---

## Testing Checklist

```bash
# Unit tests
npm run test:api

# Integration tests
npm run test:e2e:auth

# Manual testing
curl -X POST http://localhost:3000/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt

curl http://localhost:3000/api/auth/verify \
  -b cookies.txt \
  -H "X-CSRF-Token: [TOKEN_FROM_RESPONSE]"
```

---

## Deployment Commands

```bash
# 1. Set environment variables
vercel env add STATE_ENCRYPTION_KEY production

# 2. Deploy
vercel --prod

# 3. Verify health
curl https://your-app.vercel.app/api/health

# 4. Enable feature flag (gradual)
vercel env add VITE_USE_HTTPONLY_AUTH true
```

---

## Troubleshooting Quick Fixes

### Cookies not being set
```typescript
// Add debug logging
console.log('Cookie set:', {
  name: 'sb-access-token',
  secure: process.env.NODE_ENV === 'production',
  domain: undefined  // Auto-detect for Vercel
})
```

### CSRF token mismatch
```typescript
// Frontend: Ensure reading correct cookie
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf-token='))
  ?.split('=')[1]

console.log('CSRF token:', csrfToken)
```

### Token refresh loop
```typescript
// Add retry limit
let refreshAttempts = 0
const MAX_ATTEMPTS = 3

if (refreshAttempts >= MAX_ATTEMPTS) {
  // Force logout
  await logout()
}
```

---

## Security Verification

After deployment, verify:

```bash
# 1. Cookies are httpOnly
# Open browser dev tools > Application > Cookies
# Verify "HttpOnly" column is checked

# 2. CSRF protection working
curl -X POST https://your-app.vercel.app/api/auth/verify \
  -b "sb-access-token=..." \
  -H "X-CSRF-Token: wrong-token"
# Should return 403

# 3. XSS prevention
# In browser console:
document.cookie
# Should NOT show sb-access-token or sb-refresh-token

# 4. Token rotation
# Login, note tokens, refresh, verify new tokens different
```

---

## Performance Targets

| Metric | Target | Command to Test |
|--------|--------|----------------|
| Login latency | < 300ms | `time curl -X POST .../api/auth/session` |
| Token verify | < 100ms | `time curl .../api/auth/verify` |
| Cookie overhead | < 2KB | Check browser Network tab |
| Refresh time | < 200ms | `time curl -X POST .../api/auth/refresh` |

---

## Next Steps After Implementation

1. **Monitor for 1 week** - Track error rates, latency, user feedback
2. **Security audit** - Have security team review implementation
3. **Performance baseline** - Establish baseline metrics for monitoring
4. **Documentation** - Update team documentation and runbooks
5. **Training** - Brief team on new auth system

---

## Support

- Full specification: [HTTPONLY_COOKIE_AUTH_ARCHITECTURE.md](./HTTPONLY_COOKIE_AUTH_ARCHITECTURE.md)
- Troubleshooting: See section 12 of main architecture doc
- Questions: Contact backend architecture team

---

**Last Updated**: 2025-10-01
**Status**: Ready for Implementation
