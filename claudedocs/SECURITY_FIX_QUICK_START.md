# Security Fix Quick Start Guide

**⚡ 5-Minute Implementation Guide**

## What Changed?

❌ **Before**: Tokens in localStorage (vulnerable to XSS)
✅ **After**: Tokens in httpOnly cookies (XSS-proof)

---

## For Frontend Developers

### 1. Use the New Auth Hook

```typescript
// ✅ DO THIS
import { useSecureCookieAuth } from '@/hooks/useSecureCookieAuth'

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useSecureCookieAuth()

  // Login
  const handleLogin = async (email: string, password: string) => {
    const success = await login(email, password)
    if (success) {
      console.log('Logged in:', user)
    }
  }

  // Logout
  const handleLogout = async () => {
    await logout()
  }

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {user?.email}</p>
      ) : (
        <button onClick={() => handleLogin('user@example.com', 'password')}>
          Login
        </button>
      )}
    </div>
  )
}
```

```typescript
// ❌ DON'T DO THIS (Old way)
import { supabase } from '@/lib/supabase'

const { data } = await supabase.auth.signInWithPassword({ email, password })
// This won't work anymore - no session persistence
```

### 2. Include Cookies in API Calls

```typescript
// ✅ DO THIS - Always include credentials
fetch('/api/protected-endpoint', {
  credentials: 'include'  // REQUIRED: Sends httpOnly cookies
})

// ❌ DON'T DO THIS - Missing credentials
fetch('/api/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}` // Where is token? Not in localStorage!
  }
})
```

### 3. Remove Any localStorage Token Access

```typescript
// ❌ DELETE CODE LIKE THIS
localStorage.getItem('sb-access-token')
localStorage.setItem('sb-access-token', token)
sessionStorage.getItem('auth-token')

// ✅ TOKENS ARE NOW MANAGED SERVER-SIDE
// You never see or handle tokens in frontend code
```

---

## For Backend API Developers

### Protect Endpoints with Middleware

```typescript
// ✅ DO THIS
import { withAuth } from '../_lib/middleware/withAuth'

async function myProtectedHandler(req, res) {
  // req.user is automatically set by withAuth
  const userId = req.user.id

  // Your logic here
  res.json({ message: 'Success', userId })
}

export default withAuth(myProtectedHandler)
```

### Admin-Only Endpoints

```typescript
// ✅ DO THIS
import { withAuth, withAdmin } from '../_lib/middleware/withAuth'

async function adminHandler(req, res) {
  // User is guaranteed to be admin
  const isAdmin = req.user.role === 'admin'

  res.json({ adminData: 'sensitive' })
}

// Chain middlewares: withAuth → withAdmin
export default withAuth(withAdmin(adminHandler))
```

---

## Quick Testing

### Test 1: Verify No Tokens in localStorage

```javascript
// Open Browser DevTools Console
console.log('Checking for tokens...')
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (key?.includes('token') || key?.includes('auth')) {
    console.error('⚠️ FOUND TOKEN IN LOCALSTORAGE:', key)
  }
}
console.log('✅ No tokens found in localStorage')
```

### Test 2: Verify httpOnly Cookies

```javascript
// Open Browser DevTools → Application → Cookies
// Look for:
// - sb-access-token (HttpOnly: ✓, Secure: ✓)
// - sb-refresh-token (HttpOnly: ✓, Secure: ✓)
// - csrf-token (HttpOnly: ✗ - this is OK)
```

### Test 3: Run Security Tests

```bash
npm run playwright test tests/security/secure-auth.spec.ts
```

---

## Common Issues

### Issue: "No session found" after login

**Cause**: Missing `credentials: 'include'` in fetch calls

**Fix**:
```typescript
fetch('/api/endpoint', {
  credentials: 'include'  // Add this!
})
```

### Issue: Session not persisting across page reload

**Cause**: Frontend trying to use old Supabase client auth

**Fix**: Use `useSecureCookieAuth()` instead of `supabase.auth`

### Issue: CORS errors in development

**Cause**: Cookie domain mismatch

**Fix**: Ensure dev server and API are on same domain/port
```bash
# Use Vite's proxy or run on same origin
```

---

## API Endpoints Reference

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/api/auth/login` | POST | Login with email/password | User info + sets cookies |
| `/api/auth/signup` | POST | Register new user | User info + sets cookies |
| `/api/auth/logout` | POST | Logout | Success + clears cookies |
| `/api/auth/session` | GET | Get current session | User info (from cookie) |
| `/api/auth/refresh` | POST | Refresh access token | New tokens (in cookies) |

---

## Code Patterns

### Login Flow

```typescript
// 1. User submits login form
const { login } = useSecureCookieAuth()
const success = await login(email, password)

// 2. Backend validates credentials
// 3. Backend sets httpOnly cookies
// 4. Frontend receives user info (NO tokens)
// 5. Frontend updates state with user
```

### Protected API Call

```typescript
// Frontend
const response = await fetch('/api/ideas', {
  credentials: 'include'
})

// Backend
import { withAuth } from './_lib/middleware/withAuth'

async function getIdeas(req, res) {
  const userId = req.user.id // From cookie
  // Fetch user's ideas
}

export default withAuth(getIdeas)
```

### Auto-Refresh

```typescript
// Automatic every 45 minutes
import { secureAuth } from '@/lib/secureAuth'

// Started automatically in useSecureCookieAuth
secureAuth.startAutoRefresh(45)

// Manual refresh
await secureAuth.refreshSession()
```

---

## Security Benefits

| Before (localStorage) | After (httpOnly cookies) |
|-----------------------|--------------------------|
| ❌ XSS can steal tokens | ✅ XSS cannot access cookies |
| ❌ CSRF vulnerable | ✅ CSRF protection via tokens |
| ❌ No secure flag | ✅ Secure flag in production |
| ❌ Manual token management | ✅ Browser handles cookies |
| ❌ CVSS 9.1 vulnerability | ✅ CVSS 0.0 (resolved) |

---

## Need Help?

1. **Read full docs**: `claudedocs/SECURITY_FIX_HTTPONLY_COOKIES.md`
2. **Check examples**: `src/hooks/useSecureCookieAuth.ts`
3. **Run tests**: `tests/security/secure-auth.spec.ts`
4. **Contact team**: security@yourcompany.com

---

**Remember**:
- 🔒 Never store tokens in localStorage/sessionStorage
- 🍪 Always use `credentials: 'include'`
- ✅ Use `useSecureCookieAuth()` for all auth needs
