# httpOnly Cookie-Based Authentication Architecture

**Version**: 1.0
**Date**: 2025-10-01
**Author**: Backend Architect Agent
**Status**: Design Specification - Ready for Implementation

---

## Executive Summary

This document specifies a production-ready httpOnly cookie-based authentication architecture to replace the current localStorage-based token storage, eliminating the **CVSS 9.1 XSS vulnerability** (PRIO-SEC-001).

### Key Security Improvements

| Current State | New Architecture | Security Benefit |
|--------------|------------------|------------------|
| JWT tokens in localStorage | JWT in httpOnly cookies | XSS cannot access tokens |
| Client-side auth state | Server-side session verification | Eliminates client-side token manipulation |
| No CSRF protection | Double-submit cookie pattern | Prevents cross-site request forgery |
| Client-side admin verification | Server-side role verification | Eliminates privilege escalation via client manipulation |
| Component state in localStorage | Server-side encrypted storage | Prevents XSS via stored state injection |

### Implementation Timeline

- **Phase 1** (Core Auth): 4-6 hours
- **Phase 2** (Admin Verification): 2-3 hours
- **Phase 3** (Component State): 3-4 hours
- **Phase 4** (Security Middleware): 4-6 hours
- **Phase 5** (Migration): 3-5 hours
- **Total**: 16-24 hours

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication Flow](#authentication-flow)
3. [Cookie Strategy](#cookie-strategy)
4. [API Specifications](#api-specifications)
5. [Security Measures](#security-measures)
6. [Database Schema](#database-schema)
7. [Middleware Design](#middleware-design)
8. [Migration Strategy](#migration-strategy)
9. [Performance Considerations](#performance-considerations)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Guide](#deployment-guide)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      React SPA (Frontend)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   useAuth    │  │  API Client  │  │  Components  │          │
│  │   Hook       │─▶│  (fetch)     │─▶│              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS Only
┌─────────────────────────────────────────────────────────────────┐
│              Vercel Edge Network (CDN + Edge Functions)          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Security Headers                        │   │
│  │  • Strict-Transport-Security                             │   │
│  │  • X-Content-Type-Options: nosniff                       │   │
│  │  • X-Frame-Options: DENY                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           Vercel Serverless Functions (/api)                     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Auth Endpoints                             │     │
│  │  POST   /api/auth/session      (Login)                 │     │
│  │  POST   /api/auth/refresh      (Token Refresh)         │     │
│  │  DELETE /api/auth/session      (Logout)                │     │
│  │  GET    /api/auth/verify       (Session Verify)        │     │
│  │  GET    /api/auth/user         (User Profile)          │     │
│  │  POST   /api/auth/admin/verify (Admin Verify)          │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │          Security Middleware (Composable)               │     │
│  │  • withAuth          - Cookie-based auth verification  │     │
│  │  • withAdmin         - Server-side role verification   │     │
│  │  • withCSRF          - CSRF token validation           │     │
│  │  • withRateLimit     - Request rate limiting           │     │
│  │  • withSanitization  - Input sanitization              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Protected Endpoints                        │     │
│  │  POST /api/user/component-state (Component Storage)    │     │
│  │  GET  /api/projects             (User Projects)        │     │
│  │  POST /api/ideas                (Create Idea)          │     │
│  │  etc.                                                   │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Backend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Auth API    │  │  PostgreSQL  │  │  RLS Policies│          │
│  │  (PKCE)      │  │  Database    │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
│ Browser │────────▶│ Vercel  │────────▶│Supabase │────────▶│Database │
│         │  HTTPS  │   API   │  Auth   │  Auth   │  Query  │         │
└─────────┘         └─────────┘         └─────────┘         └─────────┘
     │                   │                    │                   │
     │ httpOnly Cookies  │ Token Verification │ User/Role Lookup  │
     │◀──────────────────│◀───────────────────│◀──────────────────│
     │                   │                    │                   │
     │ Set-Cookie        │ Session Data       │ User Profile      │
     │ sb-access-token   │ + User Info        │ + Role Info       │
     │ sb-refresh-token  │                    │                   │
     │ csrf-token        │                    │                   │
     └───────────────────┘                    │                   │
```

---

## Authentication Flow

### 1. Initial Login Flow

```
┌──────────┐                 ┌──────────┐                 ┌──────────┐
│  Client  │                 │   API    │                 │ Supabase │
└────┬─────┘                 └────┬─────┘                 └────┬─────┘
     │                            │                            │
     │ 1. Login (email/password)  │                            │
     ├───────────────────────────▶│                            │
     │    POST /api/auth/session  │                            │
     │                            │                            │
     │                            │ 2. Authenticate with PKCE  │
     │                            ├──────────────────────────▶ │
     │                            │    supabase.auth.signIn   │
     │                            │                            │
     │                            │ 3. Access + Refresh tokens │
     │                            │◀────────────────────────── │
     │                            │                            │
     │                            │ 4. Generate CSRF token     │
     │                            │    (crypto.randomBytes)    │
     │                            │                            │
     │                            │ 5. Set httpOnly cookies    │
     │ 6. Cookies + user profile  │    - sb-access-token       │
     │◀───────────────────────────│    - sb-refresh-token      │
     │    Set-Cookie headers:     │    - csrf-token (readable) │
     │    • sb-access-token       │                            │
     │    • sb-refresh-token      │                            │
     │    • csrf-token            │                            │
     │                            │                            │
     │ 7. Store CSRF in memory    │                            │
     │    (React state)           │                            │
     │                            │                            │
     │ 8. Subsequent API requests │                            │
     ├───────────────────────────▶│                            │
     │    Headers:                │                            │
     │    • X-CSRF-Token          │ 9. Verify CSRF             │
     │    Cookies (auto-sent):    │    - Check header matches  │
     │    • sb-access-token       │    - cookie value          │
     │    • sb-refresh-token      │                            │
     │    • csrf-token            │ 10. Decode JWT from cookie │
     │                            │     - Verify with Supabase │
     │                            ├──────────────────────────▶ │
     │                            │     supabase.auth.getUser()│
     │                            │                            │
     │                            │ 11. User data              │
     │                            │◀────────────────────────── │
     │                            │                            │
     │ 12. Protected resource     │                            │
     │◀───────────────────────────│                            │
     │                            │                            │
```

### 2. Token Refresh Flow

```
┌──────────┐                 ┌──────────┐                 ┌──────────┐
│  Client  │                 │   API    │                 │ Supabase │
└────┬─────┘                 └────┬─────┘                 └────┬─────┘
     │                            │                            │
     │ 1. API request with        │                            │
     │    expired access token    │                            │
     ├───────────────────────────▶│                            │
     │                            │                            │
     │                            │ 2. Verify token            │
     │                            ├──────────────────────────▶ │
     │                            │                            │
     │                            │ 3. Token expired error     │
     │                            │◀────────────────────────── │
     │                            │                            │
     │                            │ 4. Extract refresh token   │
     │                            │    from httpOnly cookie    │
     │                            │                            │
     │                            │ 5. Request new tokens      │
     │                            ├──────────────────────────▶ │
     │                            │    refresh_token           │
     │                            │                            │
     │                            │ 6. New access + refresh    │
     │                            │◀────────────────────────── │
     │                            │                            │
     │                            │ 7. Generate new CSRF token │
     │                            │                            │
     │                            │ 8. Update httpOnly cookies │
     │ 9. New cookies + response  │    - New sb-access-token   │
     │◀───────────────────────────│    - New sb-refresh-token  │
     │    Set-Cookie headers      │    - New csrf-token        │
     │                            │                            │
     │ 10. Update CSRF in memory  │                            │
     │     (from readable cookie) │                            │
     │                            │                            │
     │ 11. Retry original request │                            │
     ├───────────────────────────▶│                            │
     │    (with new cookies)      │                            │
     │                            │                            │
```

### 3. Logout Flow

```
┌──────────┐                 ┌──────────┐                 ┌──────────┐
│  Client  │                 │   API    │                 │ Supabase │
└────┬─────┘                 └────┬─────┘                 └────┬─────┘
     │                            │                            │
     │ 1. Logout request          │                            │
     ├───────────────────────────▶│                            │
     │    DELETE /api/auth/session│                            │
     │                            │                            │
     │                            │ 2. Extract access token    │
     │                            │    from httpOnly cookie    │
     │                            │                            │
     │                            │ 3. Revoke session          │
     │                            ├──────────────────────────▶ │
     │                            │    supabase.auth.signOut() │
     │                            │                            │
     │                            │ 4. Session revoked         │
     │                            │◀────────────────────────── │
     │                            │                            │
     │                            │ 5. Clear httpOnly cookies  │
     │ 6. Clear cookie response   │    - Max-Age=0             │
     │◀───────────────────────────│    - Expires=past date     │
     │    Set-Cookie headers:     │                            │
     │    • sb-access-token=""    │                            │
     │    • sb-refresh-token=""   │                            │
     │    • csrf-token=""         │                            │
     │                            │                            │
     │ 7. Clear CSRF from memory  │                            │
     │    (React state)           │                            │
     │                            │                            │
     │ 8. Redirect to login       │                            │
     │                            │                            │
```

---

## Cookie Strategy

### Cookie Configuration

#### 1. Access Token Cookie

```typescript
{
  name: 'sb-access-token',
  value: '[Supabase JWT access token]',
  httpOnly: true,              // JavaScript cannot access
  secure: true,                // HTTPS only (disabled in dev)
  sameSite: 'lax',            // Balance between security and usability
  path: '/',                   // Available for all paths
  maxAge: 3600,               // 1 hour (60 * 60 seconds)
  domain: undefined           // Auto-detect (works for Vercel)
}
```

**Security Rationale**:
- `httpOnly: true` - Prevents XSS attacks from stealing tokens
- `secure: true` - Ensures transmission only over HTTPS
- `sameSite: 'lax'` - Protects against CSRF while allowing top-level navigation
- `maxAge: 3600` - Short-lived token requires regular refresh
- No explicit domain - Allows Vercel's deployment model to work correctly

#### 2. Refresh Token Cookie

```typescript
{
  name: 'sb-refresh-token',
  value: '[Supabase refresh token]',
  httpOnly: true,              // JavaScript cannot access
  secure: true,                // HTTPS only (disabled in dev)
  sameSite: 'strict',         // Stricter security for sensitive token
  path: '/api/auth',          // Only sent to auth endpoints
  maxAge: 604800,             // 7 days (7 * 24 * 60 * 60 seconds)
  domain: undefined           // Auto-detect
}
```

**Security Rationale**:
- `sameSite: 'strict'` - Maximum CSRF protection for refresh tokens
- `path: '/api/auth'` - Minimizes exposure surface (only auth endpoints)
- `maxAge: 604800` - Longer lifetime for better UX, still reasonable security
- More restrictive than access token due to higher sensitivity

#### 3. CSRF Token Cookie

```typescript
{
  name: 'csrf-token',
  value: '[Random 32-byte hex string]',
  httpOnly: false,             // Readable by JavaScript (by design)
  secure: true,                // HTTPS only
  sameSite: 'lax',            // Match access token strategy
  path: '/',                   // Available for all paths
  maxAge: 3600,               // Match access token lifetime
  domain: undefined           // Auto-detect
}
```

**Security Rationale**:
- `httpOnly: false` - Client must read and send in X-CSRF-Token header
- Double-submit cookie pattern: Cookie + Header must match
- Re-generated on each token refresh
- Cannot be set by attacker's site due to Same-Origin Policy

### Cookie Size Considerations

| Cookie | Typical Size | Max Browser Limit | Optimization |
|--------|-------------|-------------------|--------------|
| sb-access-token | 500-1200 bytes | 4KB | Minimize Supabase JWT claims |
| sb-refresh-token | 40-80 bytes | 4KB | Already optimal |
| csrf-token | 64 bytes | 4KB | Already optimal |
| **Total** | ~600-1400 bytes | 4KB per cookie | Well under limit |

**Total Cookie Overhead**: < 1.5KB per request (acceptable)

### Development vs Production Configuration

```typescript
// api/auth/utils/cookie-config.ts

const isDevelopment = process.env.NODE_ENV === 'development'
const isLocalhost = process.env.VERCEL_ENV === undefined

export const COOKIE_CONFIG = {
  accessToken: {
    name: 'sb-access-token',
    httpOnly: true,
    secure: !isDevelopment,  // Allow HTTP in development
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60,  // 1 hour
    domain: isLocalhost ? 'localhost' : undefined
  },
  refreshToken: {
    name: 'sb-refresh-token',
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60,  // 7 days
    domain: isLocalhost ? 'localhost' : undefined
  },
  csrf: {
    name: 'csrf-token',
    httpOnly: false,
    secure: !isDevelopment,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60,  // 1 hour
    domain: isLocalhost ? 'localhost' : undefined
  }
}
```

---

## API Specifications

### 1. POST /api/auth/session (Login)

**Purpose**: Create authenticated session and set httpOnly cookies

#### Request

```typescript
POST /api/auth/session
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Response (Success)

```typescript
HTTP/1.1 200 OK
Set-Cookie: sb-access-token=[JWT]; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/
Set-Cookie: sb-refresh-token=[TOKEN]; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/api/auth
Set-Cookie: csrf-token=[RANDOM]; Secure; SameSite=Lax; Max-Age=3600; Path=/
Content-Type: application/json

{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "avatar_url": "https://...",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  "session": {
    "expiresAt": "2025-01-01T01:00:00Z",
    "expiresIn": 3600
  },
  "csrfToken": "[RANDOM]"  // Also available in readable cookie
}
```

#### Response (Error)

```typescript
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

#### Implementation

```typescript
// api/auth/session.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { COOKIE_CONFIG } from './utils/cookie-config'
import { setCookie, clearAuthCookies } from './utils/cookie-helpers'
import { withSanitization, withRateLimit } from '../middleware/security'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    return await handleLogin(req, res)
  } else if (req.method === 'DELETE') {
    return await handleLogout(req, res)
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required',
        code: 'MISSING_CREDENTIALS'
      })
    }

    // Authenticate with Supabase using PKCE flow
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error || !data.session) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      })
    }

    // Generate CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex')

    // Set httpOnly cookies
    setCookie(res, COOKIE_CONFIG.accessToken.name, data.session.access_token, {
      ...COOKIE_CONFIG.accessToken
    })

    setCookie(res, COOKIE_CONFIG.refreshToken.name, data.session.refresh_token, {
      ...COOKIE_CONFIG.refreshToken
    })

    setCookie(res, COOKIE_CONFIG.csrf.name, csrfToken, {
      ...COOKIE_CONFIG.csrf
    })

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    // Return user data and CSRF token
    return res.status(200).json({
      user: profile || {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || data.user.email,
        role: 'user',
        created_at: data.user.created_at,
        updated_at: data.user.updated_at
      },
      session: {
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        expiresIn: 3600
      },
      csrfToken
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    })
  }
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  try {
    // Extract access token from cookie
    const accessToken = req.cookies['sb-access-token']

    if (accessToken) {
      // Revoke session in Supabase
      await supabase.auth.admin.signOut(accessToken)
    }

    // Clear all auth cookies
    clearAuthCookies(res)

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    // Still clear cookies even if Supabase fails
    clearAuthCookies(res)
    return res.status(200).json({ success: true })
  }
}

// Apply security middleware
export default withSanitization(
  withRateLimit(handler, { maxRequests: 5, windowMs: 60000 })
)
```

### 2. POST /api/auth/refresh (Token Refresh)

**Purpose**: Refresh expired access token using refresh token from cookie

#### Request

```typescript
POST /api/auth/refresh
Cookie: sb-refresh-token=[TOKEN]
X-CSRF-Token: [CSRF_TOKEN]
```

#### Response (Success)

```typescript
HTTP/1.1 200 OK
Set-Cookie: sb-access-token=[NEW_JWT]; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/
Set-Cookie: sb-refresh-token=[NEW_TOKEN]; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/api/auth
Set-Cookie: csrf-token=[NEW_RANDOM]; Secure; SameSite=Lax; Max-Age=3600; Path=/
Content-Type: application/json

{
  "session": {
    "expiresAt": "2025-01-01T02:00:00Z",
    "expiresIn": 3600
  },
  "csrfToken": "[NEW_RANDOM]"
}
```

#### Response (Error)

```typescript
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Invalid or expired refresh token",
  "code": "INVALID_REFRESH_TOKEN"
}
```

#### Implementation

```typescript
// api/auth/refresh.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { COOKIE_CONFIG } from './utils/cookie-config'
import { setCookie, clearAuthCookies } from './utils/cookie-helpers'
import { withCSRF, withRateLimit } from '../middleware/security'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Extract refresh token from httpOnly cookie
    const refreshToken = req.cookies['sb-refresh-token']

    if (!refreshToken) {
      return res.status(401).json({
        error: 'No refresh token provided',
        code: 'MISSING_REFRESH_TOKEN'
      })
    }

    // Refresh session with Supabase
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    })

    if (error || !data.session) {
      // Clear invalid cookies
      clearAuthCookies(res)
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      })
    }

    // Generate new CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex')

    // Set new httpOnly cookies
    setCookie(res, COOKIE_CONFIG.accessToken.name, data.session.access_token, {
      ...COOKIE_CONFIG.accessToken
    })

    setCookie(res, COOKIE_CONFIG.refreshToken.name, data.session.refresh_token, {
      ...COOKIE_CONFIG.refreshToken
    })

    setCookie(res, COOKIE_CONFIG.csrf.name, csrfToken, {
      ...COOKIE_CONFIG.csrf
    })

    return res.status(200).json({
      session: {
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        expiresIn: 3600
      },
      csrfToken
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    clearAuthCookies(res)
    return res.status(500).json({
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    })
  }
}

// Apply security middleware
export default withCSRF(
  withRateLimit(handler, { maxRequests: 10, windowMs: 60000 })
)
```

### 3. GET /api/auth/verify (Session Verification)

**Purpose**: Verify current session validity

#### Request

```typescript
GET /api/auth/verify
Cookie: sb-access-token=[JWT]
X-CSRF-Token: [CSRF_TOKEN]
```

#### Response (Success)

```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "valid": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "expiresAt": "2025-01-01T01:00:00Z"
}
```

#### Response (Error)

```typescript
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "valid": false,
  "error": "Invalid or expired session",
  "code": "INVALID_SESSION"
}
```

#### Implementation

```typescript
// api/auth/verify.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth, withCSRF } from '../middleware/security'

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // User is already verified by withAuth middleware
  const user = (req as any).user

  return res.status(200).json({
    valid: true,
    user: {
      id: user.id,
      email: user.email
    },
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
  })
}

// Apply auth and CSRF middleware
export default withAuth(withCSRF(handler))
```

### 4. POST /api/auth/admin/verify (Admin Verification)

**Purpose**: Server-side admin role verification with audit logging

#### Request

```typescript
POST /api/auth/admin/verify
Cookie: sb-access-token=[JWT]
X-CSRF-Token: [CSRF_TOKEN]
Content-Type: application/json

{
  "action": "view_users",  // Optional: for audit logging
  "resource": "user_list"  // Optional: for audit logging
}
```

#### Response (Success - Admin User)

```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "isAdmin": true,
  "isSuperAdmin": true,
  "capabilities": [
    "view_users",
    "edit_users",
    "delete_users",
    "view_projects",
    "edit_projects",
    "delete_projects",
    "manage_roles",
    "view_audit_logs"
  ],
  "expiresAt": "2025-01-01T01:00:00Z"
}
```

#### Response (Success - Regular User)

```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "isAdmin": false,
  "isSuperAdmin": false,
  "capabilities": [],
  "expiresAt": "2025-01-01T01:00:00Z"
}
```

#### Response (Error)

```typescript
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

#### Implementation

```typescript
// api/auth/admin/verify.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withAuth, withCSRF, withRateLimit } from '../../middleware/security'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Use service role for admin operations
)

// Admin capability mappings
const ADMIN_CAPABILITIES = [
  'view_users',
  'edit_users',
  'view_projects',
  'edit_projects',
  'view_audit_logs'
]

const SUPER_ADMIN_CAPABILITIES = [
  ...ADMIN_CAPABILITIES,
  'delete_users',
  'delete_projects',
  'manage_roles'
]

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = (req as any).user
    const { action, resource } = req.body

    // Get user role from database
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      return res.status(500).json({
        error: 'Failed to fetch user role',
        code: 'ROLE_FETCH_ERROR'
      })
    }

    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
    const isSuperAdmin = profile.role === 'super_admin'

    // Audit logging for admin actions
    if (action && resource) {
      await supabase.from('admin_audit_log').insert({
        user_id: user.id,
        action,
        resource,
        is_admin: isAdmin,
        timestamp: new Date().toISOString(),
        ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        user_agent: req.headers['user-agent']
      })
    }

    return res.status(200).json({
      isAdmin,
      isSuperAdmin,
      capabilities: isSuperAdmin ? SUPER_ADMIN_CAPABILITIES : (isAdmin ? ADMIN_CAPABILITIES : []),
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    })
  } catch (error) {
    console.error('Admin verification error:', error)
    return res.status(500).json({
      error: 'Admin verification failed',
      code: 'ADMIN_VERIFY_ERROR'
    })
  }
}

// Apply security middleware
export default withAuth(
  withCSRF(
    withRateLimit(handler, { maxRequests: 20, windowMs: 60000 })
  )
)
```

### 5. POST /api/user/component-state (Component State Storage)

**Purpose**: Server-side component state persistence with encryption

#### Request

```typescript
POST /api/user/component-state
Cookie: sb-access-token=[JWT]
X-CSRF-Token: [CSRF_TOKEN]
Content-Type: application/json

{
  "componentKey": "sidebar_collapsed",
  "state": {
    "isCollapsed": true,
    "width": 240
  },
  "encrypt": false  // Optional: encrypt sensitive state
}
```

#### Response (Success)

```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "componentKey": "sidebar_collapsed",
  "expiresAt": "2025-01-08T00:00:00Z"  // 7 days from now
}
```

#### Response (Error - Size Limit)

```typescript
HTTP/1.1 413 Payload Too Large
Content-Type: application/json

{
  "error": "State data exceeds 100KB limit",
  "code": "STATE_TOO_LARGE",
  "currentSize": 150000,
  "maxSize": 102400
}
```

#### Implementation

```typescript
// api/user/component-state.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { withAuth, withCSRF, withRateLimit, withSanitization } from '../middleware/security'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

const MAX_STATE_SIZE = 100 * 1024  // 100KB limit
const STATE_TTL_DAYS = 7

// Encryption helper
function encryptState(data: any, userId: string): string {
  const key = crypto.scryptSync(
    process.env.STATE_ENCRYPTION_KEY || 'default-key',
    userId,
    32
  )
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return iv.toString('hex') + ':' + encrypted
}

function decryptState(encrypted: string, userId: string): any {
  const [ivHex, encryptedData] = encrypted.split(':')
  const key = crypto.scryptSync(
    process.env.STATE_ENCRYPTION_KEY || 'default-key',
    userId,
    32
  )
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return JSON.parse(decrypted)
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const user = (req as any).user

  if (req.method === 'POST') {
    return await saveComponentState(req, res, user)
  } else if (req.method === 'GET') {
    return await getComponentState(req, res, user)
  } else if (req.method === 'DELETE') {
    return await deleteComponentState(req, res, user)
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function saveComponentState(
  req: VercelRequest,
  res: VercelResponse,
  user: { id: string; email?: string }
) {
  try {
    const { componentKey, state, encrypt = false } = req.body

    // Validate input
    if (!componentKey || typeof componentKey !== 'string') {
      return res.status(400).json({
        error: 'componentKey is required',
        code: 'MISSING_COMPONENT_KEY'
      })
    }

    if (!state || typeof state !== 'object') {
      return res.status(400).json({
        error: 'state must be an object',
        code: 'INVALID_STATE'
      })
    }

    // Check size limit
    const stateJson = JSON.stringify(state)
    const stateSize = Buffer.byteLength(stateJson, 'utf8')

    if (stateSize > MAX_STATE_SIZE) {
      return res.status(413).json({
        error: 'State data exceeds 100KB limit',
        code: 'STATE_TOO_LARGE',
        currentSize: stateSize,
        maxSize: MAX_STATE_SIZE
      })
    }

    // Prepare state data (encrypt if requested)
    const stateData = encrypt ? encryptState(state, user.id) : state
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + STATE_TTL_DAYS)

    // Upsert component state
    const { error } = await supabase
      .from('user_component_states')
      .upsert({
        user_id: user.id,
        component_key: componentKey,
        state_data: stateData,
        encrypted: encrypt,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'user_id,component_key'
      })

    if (error) {
      console.error('Failed to save component state:', error)
      return res.status(500).json({
        error: 'Failed to save component state',
        code: 'STATE_SAVE_ERROR'
      })
    }

    return res.status(200).json({
      success: true,
      componentKey,
      expiresAt: expiresAt.toISOString()
    })
  } catch (error) {
    console.error('Component state save error:', error)
    return res.status(500).json({
      error: 'Failed to save component state',
      code: 'STATE_SAVE_ERROR'
    })
  }
}

async function getComponentState(
  req: VercelRequest,
  res: VercelResponse,
  user: { id: string; email?: string }
) {
  try {
    const componentKey = req.query.componentKey as string

    if (!componentKey) {
      return res.status(400).json({
        error: 'componentKey query parameter required',
        code: 'MISSING_COMPONENT_KEY'
      })
    }

    const { data, error } = await supabase
      .from('user_component_states')
      .select('*')
      .eq('user_id', user.id)
      .eq('component_key', componentKey)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      return res.status(404).json({
        error: 'Component state not found',
        code: 'STATE_NOT_FOUND'
      })
    }

    // Decrypt if necessary
    const state = data.encrypted
      ? decryptState(data.state_data as string, user.id)
      : data.state_data

    return res.status(200).json({
      componentKey: data.component_key,
      state,
      encrypted: data.encrypted,
      updatedAt: data.updated_at,
      expiresAt: data.expires_at
    })
  } catch (error) {
    console.error('Component state get error:', error)
    return res.status(500).json({
      error: 'Failed to get component state',
      code: 'STATE_GET_ERROR'
    })
  }
}

async function deleteComponentState(
  req: VercelRequest,
  res: VercelResponse,
  user: { id: string; email?: string }
) {
  try {
    const componentKey = req.query.componentKey as string

    if (!componentKey) {
      return res.status(400).json({
        error: 'componentKey query parameter required',
        code: 'MISSING_COMPONENT_KEY'
      })
    }

    const { error } = await supabase
      .from('user_component_states')
      .delete()
      .eq('user_id', user.id)
      .eq('component_key', componentKey)

    if (error) {
      return res.status(500).json({
        error: 'Failed to delete component state',
        code: 'STATE_DELETE_ERROR'
      })
    }

    return res.status(200).json({
      success: true,
      componentKey
    })
  } catch (error) {
    console.error('Component state delete error:', error)
    return res.status(500).json({
      error: 'Failed to delete component state',
      code: 'STATE_DELETE_ERROR'
    })
  }
}

// Apply security middleware
export default withAuth(
  withCSRF(
    withSanitization(
      withRateLimit(handler, { maxRequests: 30, windowMs: 60000 })
    )
  )
)
```

---

## Security Measures

### 1. CSRF Protection (Double-Submit Cookie Pattern)

#### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    CSRF Protection Flow                          │
└─────────────────────────────────────────────────────────────────┘

1. Server generates random CSRF token on login
2. Server sets token in TWO places:
   a) httpOnly=false cookie (browser can read)
   b) Response body (client stores in memory)

3. Client reads CSRF token from cookie
4. Client sends CSRF token in X-CSRF-Token header with each request

5. Server validates:
   a) Token exists in cookie
   b) Token exists in header
   c) Both tokens match exactly

6. Attack scenario (why this works):
   - Attacker creates malicious site: evil.com
   - Attacker tricks user to visit evil.com
   - evil.com tries to make request to our-app.com/api/protected
   - Browser WILL send cookies (including CSRF cookie)
   - Browser WILL NOT allow evil.com to read our-app.com cookies
   - evil.com CANNOT set X-CSRF-Token header with correct value
   - Server rejects request (missing or mismatched header)
```

#### Implementation

```typescript
// api/auth/utils/csrf.ts
import crypto from 'crypto'
import { VercelRequest, VercelResponse } from '@vercel/node'

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function validateCSRFToken(req: VercelRequest): boolean {
  // Extract CSRF token from header
  const headerToken = req.headers['x-csrf-token'] as string

  // Extract CSRF token from cookie
  const cookieToken = req.cookies['csrf-token']

  // Both must exist and match
  if (!headerToken || !cookieToken) {
    return false
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(headerToken),
    Buffer.from(cookieToken)
  )
}

// Middleware wrapper
export function withCSRF(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<any>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Skip CSRF check for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
      return handler(req, res)
    }

    // Validate CSRF token
    if (!validateCSRFToken(req)) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        code: 'CSRF_VALIDATION_FAILED'
      })
    }

    return handler(req, res)
  }
}
```

### 2. XSS Prevention

#### Strategies

1. **httpOnly Cookies**: Tokens not accessible to JavaScript
2. **Input Sanitization**: Strip dangerous HTML/JavaScript from user input
3. **Content Security Policy**: Restrict script sources
4. **Output Encoding**: Encode user data in HTML context

#### Implementation

```typescript
// api/middleware/security.ts
import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potential XSS vectors
    let sanitized = input.replace(/<script[^>]*>.*?<\/script>/gi, '')
    sanitized = sanitized.replace(/javascript:/gi, '')
    sanitized = sanitized.replace(/on\w+=/gi, '')

    // Optional: Use DOMPurify for HTML sanitization
    // sanitized = DOMPurify.sanitize(sanitized)

    return validator.trim(sanitized)
  } else if (Array.isArray(input)) {
    return input.map(sanitizeInput)
  } else if (typeof input === 'object' && input !== null) {
    const sanitized: any = {}
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key])
    }
    return sanitized
  }

  return input
}

export function withSanitization(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<any>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeInput(req.body)
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeInput(req.query)
    }

    return handler(req, res)
  }
}
```

### 3. Session Fixation Prevention

#### Strategy

- Generate new session tokens on authentication
- Rotate tokens on privilege escalation
- Invalidate old sessions on password change

#### Implementation

```typescript
// Automatically handled by Supabase auth flow
// Each login creates new tokens
// Refresh endpoint rotates both access and refresh tokens
```

### 4. Token Rotation

#### Strategy

- Access token: 1 hour lifetime
- Refresh token: 7 days lifetime
- Both rotate on each refresh
- Old tokens immediately invalidated

#### Implementation

```typescript
// api/auth/refresh.ts (excerpt)
const { data, error } = await supabase.auth.refreshSession({
  refresh_token: refreshToken
})

// data.session contains:
// - NEW access_token (replaces old)
// - NEW refresh_token (replaces old)
// Old tokens are now invalid
```

### 5. Secure Cookie Defaults

#### Configuration

```typescript
// api/auth/utils/cookie-config.ts
export const SECURE_DEFAULTS = {
  httpOnly: true,           // Prevent JavaScript access
  secure: true,             // HTTPS only (except dev)
  sameSite: 'lax',         // CSRF protection
  path: '/',                // Cookie scope
  domain: undefined,        // Auto-detect for Vercel

  // Development overrides
  ...(process.env.NODE_ENV === 'development' && {
    secure: false,          // Allow HTTP in dev
    sameSite: 'lax'        // More permissive for localhost
  })
}
```

---

## Database Schema

### 1. User Component States Table

```sql
-- Create user_component_states table for server-side state persistence
CREATE TABLE IF NOT EXISTS user_component_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  component_key VARCHAR(255) NOT NULL,
  state_data JSONB NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ,

  -- Unique constraint: one state per user per component
  CONSTRAINT unique_user_component UNIQUE(user_id, component_key),

  -- Size limit constraint (PostgreSQL JSONB)
  CONSTRAINT state_size_check CHECK (
    pg_column_size(state_data) <= 102400  -- 100KB limit
  )
);

-- Indexes for performance
CREATE INDEX idx_user_component_states_user_id
  ON user_component_states(user_id);

CREATE INDEX idx_user_component_states_component_key
  ON user_component_states(component_key);

CREATE INDEX idx_user_component_states_expires_at
  ON user_component_states(expires_at)
  WHERE expires_at IS NOT NULL;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_component_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_component_states_updated_at
  BEFORE UPDATE ON user_component_states
  FOR EACH ROW
  EXECUTE FUNCTION update_user_component_states_updated_at();

-- RLS Policies
ALTER TABLE user_component_states ENABLE ROW LEVEL SECURITY;

-- Users can only access their own component states
CREATE POLICY user_component_states_select_own
  ON user_component_states
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_component_states_insert_own
  ON user_component_states
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_component_states_update_own
  ON user_component_states
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY user_component_states_delete_own
  ON user_component_states
  FOR DELETE
  USING (auth.uid() = user_id);

-- Cleanup function for expired states
CREATE OR REPLACE FUNCTION cleanup_expired_component_states()
RETURNS void AS $$
BEGIN
  DELETE FROM user_component_states
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-component-states', '0 0 * * *',
--   'SELECT cleanup_expired_component_states();');
```

### 2. Admin Audit Log Table

```sql
-- Create admin_audit_log table for admin action tracking
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  is_admin BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address VARCHAR(45),  -- IPv4 or IPv6
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Index for querying by user and timestamp
  CONSTRAINT audit_log_timestamp_check CHECK (timestamp <= NOW())
);

-- Indexes for performance
CREATE INDEX idx_admin_audit_log_user_id
  ON admin_audit_log(user_id);

CREATE INDEX idx_admin_audit_log_timestamp
  ON admin_audit_log(timestamp DESC);

CREATE INDEX idx_admin_audit_log_action
  ON admin_audit_log(action);

-- Composite index for common queries
CREATE INDEX idx_admin_audit_log_user_timestamp
  ON admin_audit_log(user_id, timestamp DESC);

-- RLS Policies
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY admin_audit_log_select_admin
  ON admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR role = 'super_admin')
    )
  );

-- System can insert (no direct user access)
CREATE POLICY admin_audit_log_insert_system
  ON admin_audit_log
  FOR INSERT
  WITH CHECK (true);  -- Service role will insert

-- No updates or deletes (immutable audit log)
-- (Policies not needed - default DENY)
```

### 3. Update User Profiles Table

```sql
-- Ensure user_profiles table has role column
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role
  ON user_profiles(role)
  WHERE role IN ('admin', 'super_admin');

-- Update existing users to have default role
UPDATE user_profiles
SET role = 'user'
WHERE role IS NULL;
```

### Database Migration Script

```sql
-- migrations/001_httponly_cookie_auth.sql
-- Run this script to set up httpOnly cookie auth infrastructure

-- ============================================
-- Component States Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_component_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  component_key VARCHAR(255) NOT NULL,
  state_data JSONB NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ,
  CONSTRAINT unique_user_component UNIQUE(user_id, component_key),
  CONSTRAINT state_size_check CHECK (pg_column_size(state_data) <= 102400)
);

CREATE INDEX idx_user_component_states_user_id ON user_component_states(user_id);
CREATE INDEX idx_user_component_states_component_key ON user_component_states(component_key);
CREATE INDEX idx_user_component_states_expires_at ON user_component_states(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION update_user_component_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_component_states_updated_at
  BEFORE UPDATE ON user_component_states
  FOR EACH ROW
  EXECUTE FUNCTION update_user_component_states_updated_at();

ALTER TABLE user_component_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_component_states_select_own ON user_component_states
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_component_states_insert_own ON user_component_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_component_states_update_own ON user_component_states
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY user_component_states_delete_own ON user_component_states
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Admin Audit Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  is_admin BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  CONSTRAINT audit_log_timestamp_check CHECK (timestamp <= NOW())
);

CREATE INDEX idx_admin_audit_log_user_id ON admin_audit_log(user_id);
CREATE INDEX idx_admin_audit_log_timestamp ON admin_audit_log(timestamp DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_user_timestamp ON admin_audit_log(user_id, timestamp DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_select_admin ON admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
    )
  );

CREATE POLICY admin_audit_log_insert_system ON admin_audit_log
  FOR INSERT WITH CHECK (true);

-- ============================================
-- User Profiles Role Column
-- ============================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role)
  WHERE role IN ('admin', 'super_admin');

UPDATE user_profiles SET role = 'user' WHERE role IS NULL;

-- ============================================
-- Cleanup Function
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_component_states()
RETURNS void AS $$
BEGIN
  DELETE FROM user_component_states
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Note: Uncomment if pg_cron is available
-- SELECT cron.schedule('cleanup-component-states', '0 0 * * *',
--   'SELECT cleanup_expired_component_states();');
```

---

## Middleware Design

### 1. Composable Security Middleware

#### Architecture

```typescript
// api/middleware/security.ts
import { VercelRequest, VercelResponse } from '@vercel/node'

export type MiddlewareHandler = (
  req: VercelRequest,
  res: VercelResponse
) => Promise<any>

export type Middleware = (
  handler: MiddlewareHandler
) => MiddlewareHandler

// Compose multiple middleware functions
export function compose(...middleware: Middleware[]): Middleware {
  return (handler: MiddlewareHandler) => {
    return middleware.reduceRight(
      (nextHandler, currentMiddleware) => currentMiddleware(nextHandler),
      handler
    )
  }
}
```

### 2. withAuth Middleware

```typescript
// api/middleware/withAuth.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Middleware } from './security'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Token cache to reduce Supabase calls
const tokenCache = new Map<string, {
  user: any
  timestamp: number
  expires: number
}>()
const TOKEN_CACHE_DURATION = 60 * 1000  // 1 minute

export const withAuth: Middleware = (handler) => {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      // Extract access token from httpOnly cookie
      const accessToken = req.cookies['sb-access-token']

      if (!accessToken) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'MISSING_AUTH_TOKEN'
        })
      }

      // Check cache first
      const cached = tokenCache.get(accessToken)
      if (cached && Date.now() < cached.expires) {
        ;(req as any).user = cached.user
        return handler(req, res)
      }

      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(accessToken)

      if (error || !user) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          code: 'INVALID_AUTH_TOKEN'
        })
      }

      // Cache the result
      tokenCache.set(accessToken, {
        user: { id: user.id, email: user.email },
        timestamp: Date.now(),
        expires: Date.now() + TOKEN_CACHE_DURATION
      })

      // Attach user to request
      ;(req as any).user = {
        id: user.id,
        email: user.email
      }

      return handler(req, res)
    } catch (error) {
      console.error('Auth middleware error:', error)
      return res.status(500).json({
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      })
    }
  }
}

// Clean up expired cache entries
setInterval(() => {
  const now = Date.now()
  for (const [token, cached] of tokenCache.entries()) {
    if (now > cached.expires) {
      tokenCache.delete(token)
    }
  }
}, 60000)  // Every minute
```

### 3. withAdmin Middleware

```typescript
// api/middleware/withAdmin.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Middleware } from './security'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Role cache to reduce database calls
const roleCache = new Map<string, {
  role: string
  timestamp: number
  expires: number
}>()
const ROLE_CACHE_DURATION = 5 * 60 * 1000  // 5 minutes

export const withAdmin: Middleware = (handler) => {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      const user = (req as any).user

      if (!user || !user.id) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'MISSING_AUTH'
        })
      }

      // Check cache first
      const cached = roleCache.get(user.id)
      if (cached && Date.now() < cached.expires) {
        if (cached.role !== 'admin' && cached.role !== 'super_admin') {
          return res.status(403).json({
            error: 'Admin access required',
            code: 'FORBIDDEN'
          })
        }
        ;(req as any).userRole = cached.role
        return handler(req, res)
      }

      // Fetch role from database
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error || !profile) {
        return res.status(500).json({
          error: 'Failed to verify admin status',
          code: 'ROLE_FETCH_ERROR'
        })
      }

      // Cache the role
      roleCache.set(user.id, {
        role: profile.role,
        timestamp: Date.now(),
        expires: Date.now() + ROLE_CACHE_DURATION
      })

      // Check if user is admin
      if (profile.role !== 'admin' && profile.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'FORBIDDEN'
        })
      }

      ;(req as any).userRole = profile.role

      return handler(req, res)
    } catch (error) {
      console.error('Admin middleware error:', error)
      return res.status(500).json({
        error: 'Admin verification failed',
        code: 'ADMIN_ERROR'
      })
    }
  }
}

// Clean up expired cache entries
setInterval(() => {
  const now = Date.now()
  for (const [userId, cached] of roleCache.entries()) {
    if (now > cached.expires) {
      roleCache.delete(userId)
    }
  }
}, 60000)  // Every minute
```

### 4. withCSRF Middleware

(See [CSRF Protection](#1-csrf-protection-double-submit-cookie-pattern) section above)

### 5. withRateLimit Middleware

```typescript
// api/middleware/withRateLimit.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { Middleware } from './security'

interface RateLimitOptions {
  maxRequests: number
  windowMs: number
  keyGenerator?: (req: VercelRequest) => string
}

// In-memory rate limit store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, {
  count: number
  resetTime: number
}>()

export function withRateLimit(
  handler: any,
  options: RateLimitOptions
): Middleware {
  const {
    maxRequests,
    windowMs,
    keyGenerator = (req) => {
      // Default: rate limit by IP
      return (req.headers['x-forwarded-for'] as string) ||
             req.socket.remoteAddress ||
             'unknown'
    }
  } = options

  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      const key = keyGenerator(req)
      const now = Date.now()
      const limit = rateLimitStore.get(key)

      if (!limit || now > limit.resetTime) {
        // Create or reset limit
        rateLimitStore.set(key, {
          count: 1,
          resetTime: now + windowMs
        })
        return handler(req, res)
      }

      if (limit.count >= maxRequests) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((limit.resetTime - now) / 1000)
        res.setHeader('Retry-After', retryAfter.toString())
        res.setHeader('X-RateLimit-Limit', maxRequests.toString())
        res.setHeader('X-RateLimit-Remaining', '0')
        res.setHeader('X-RateLimit-Reset', limit.resetTime.toString())

        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter
        })
      }

      // Increment counter
      limit.count++

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', (maxRequests - limit.count).toString())
      res.setHeader('X-RateLimit-Reset', limit.resetTime.toString())

      return handler(req, res)
    } catch (error) {
      console.error('Rate limit middleware error:', error)
      // On error, allow request but log
      return handler(req, res)
    }
  }
}

// Clean up expired rate limit entries
setInterval(() => {
  const now = Date.now()
  for (const [key, limit] of rateLimitStore.entries()) {
    if (now > limit.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000)  // Every minute
```

### 6. withSanitization Middleware

(See [XSS Prevention](#2-xss-prevention) section above)

### 7. Usage Example

```typescript
// api/protected-endpoint.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import {
  withAuth,
  withAdmin,
  withCSRF,
  withRateLimit,
  withSanitization,
  compose
} from './middleware/security'

async function handler(req: VercelRequest, res: VercelResponse) {
  // User is guaranteed to be authenticated and authorized
  const user = (req as any).user
  const role = (req as any).userRole

  // Your business logic here
  return res.status(200).json({
    message: 'Success',
    user,
    role
  })
}

// Compose multiple middleware layers
export default compose(
  withSanitization,
  withRateLimit({ maxRequests: 10, windowMs: 60000 }),
  withCSRF,
  withAuth,
  withAdmin
)(handler)
```

---

## Migration Strategy

### Phase-by-Phase Migration Plan

#### Phase 1: Infrastructure Setup (No User Impact)

**Duration**: 4-6 hours

**Tasks**:
1. Create database tables (component states, audit log)
2. Implement cookie utility functions
3. Implement security middleware
4. Set up environment variables

**Validation**:
- Run database migrations
- Test middleware in isolation
- Verify cookie configuration

**Rollback**: None needed (additive changes only)

#### Phase 2: Parallel Authentication System (Backward Compatible)

**Duration**: 6-8 hours

**Tasks**:
1. Implement new auth endpoints (POST /api/auth/session, etc.)
2. Keep existing auth flow working
3. Add feature flag: `ENABLE_HTTPONLY_AUTH=false`
4. Test new endpoints in development

**Validation**:
- Both auth systems work simultaneously
- Existing users not affected
- New endpoints return correct cookies

**Rollback**: Set feature flag to `false`

#### Phase 3: Frontend Migration (Feature Flag Controlled)

**Duration**: 4-6 hours

**Tasks**:
1. Update `useAuth` hook to support both modes
2. Implement cookie-based API client
3. Add CSRF token handling
4. Test with feature flag enabled in development

**Code Example**:

```typescript
// src/hooks/useAuth.ts (updated)
const USE_HTTPONLY_AUTH = import.meta.env.VITE_USE_HTTPONLY_AUTH === 'true'

export const useAuth = () => {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  const login = async (email: string, password: string) => {
    if (USE_HTTPONLY_AUTH) {
      // New cookie-based auth
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',  // Send cookies
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      const data = await response.json()
      setCsrfToken(data.csrfToken)
      return data.user
    } else {
      // Existing localStorage auth (fallback)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      return data.user
    }
  }

  // Similar updates for other auth methods...
}

// src/lib/api-client.ts (new)
export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getCsrfToken()  // From cookie or state

  const headers = {
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...options.headers
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'  // Always send cookies
  })
}

function getCsrfToken(): string | null {
  // Read from readable cookie
  const match = document.cookie.match(/csrf-token=([^;]+)/)
  return match ? match[1] : null
}
```

**Validation**:
- Login works with cookies
- API requests include CSRF token
- Tokens refresh automatically
- Logout clears cookies

**Rollback**: Set `VITE_USE_HTTPONLY_AUTH=false`

#### Phase 4: Gradual User Migration (A/B Testing)

**Duration**: 1-2 weeks

**Tasks**:
1. Enable httpOnly auth for 10% of users
2. Monitor error rates and metrics
3. Gradually increase to 50%, then 100%
4. Fix any edge cases discovered

**Monitoring**:
- Track auth success/failure rates
- Monitor API error rates
- Collect user feedback

**Rollback**: Decrease rollout percentage

#### Phase 5: Cleanup (Finalization)

**Duration**: 2-3 hours

**Tasks**:
1. Remove old localStorage auth code
2. Remove feature flags
3. Update documentation
4. Clean up unused code

**Validation**:
- All users on new system
- No localStorage auth remnants
- Documentation updated

**Rollback**: Not applicable (requires full rollback to Phase 3)

### Migration Checklist

```markdown
## Pre-Migration

- [ ] Database migrations tested in staging
- [ ] Cookie configuration verified for Vercel
- [ ] HTTPS certificates valid
- [ ] Environment variables set in Vercel
- [ ] STATE_ENCRYPTION_KEY generated and stored securely
- [ ] Backup plan documented
- [ ] Rollback procedure tested

## During Migration

- [ ] Feature flags deployed
- [ ] Monitoring dashboards active
- [ ] Support team briefed
- [ ] Communication sent to users (if needed)
- [ ] Phase 1: Infrastructure deployed
- [ ] Phase 2: Parallel auth tested
- [ ] Phase 3: Frontend updated
- [ ] Phase 4: Gradual rollout started
- [ ] Phase 5: Cleanup completed

## Post-Migration

- [ ] All users migrated successfully
- [ ] Error rates normal
- [ ] Performance metrics stable
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Old code removed
- [ ] Post-mortem conducted
```

### Rollback Procedures

#### Immediate Rollback (< 1 hour into migration)

```bash
# 1. Set feature flag to disable new auth
vercel env add VITE_USE_HTTPONLY_AUTH false

# 2. Redeploy previous version
vercel --prod --force

# 3. Verify old auth working
curl -X POST https://app.com/api/auth/user \
  -H "Authorization: Bearer [OLD_TOKEN]"
```

#### Partial Rollback (some users migrated)

```typescript
// Keep both systems running
// Detect which auth system user is on

function detectAuthSystem(req: VercelRequest): 'cookie' | 'bearer' {
  const hasCookie = !!req.cookies['sb-access-token']
  const hasBearer = !!req.headers.authorization

  if (hasCookie) return 'cookie'
  if (hasBearer) return 'bearer'

  throw new Error('No auth detected')
}

// In auth middleware
const authSystem = detectAuthSystem(req)
if (authSystem === 'cookie') {
  // Use cookie-based auth
} else {
  // Use bearer token auth
}
```

#### Full Rollback (complete system rollback)

1. Disable new auth endpoints
2. Revert frontend to use localStorage
3. Clear httpOnly cookies for all users
4. Monitor for auth failures
5. Investigate root cause before retry

---

## Performance Considerations

### 1. Cookie Size Optimization

**Current Cookie Overhead**: ~1.5KB per request

**Optimization Strategies**:

1. **Minimize Supabase JWT Claims**:
   ```typescript
   // In Supabase dashboard: Auth > JWT Settings
   // Remove unnecessary claims from JWT payload
   // Keep only: sub, email, role, exp, iat
   ```

2. **Use Separate Domains** (if needed):
   ```typescript
   // API on api.app.com
   // Frontend on app.com
   // Cookies only sent to api.app.com
   ```

3. **Compress Cookies** (if > 2KB):
   ```typescript
   import zlib from 'zlib'

   function compressCookie(value: string): string {
     return zlib.deflateSync(Buffer.from(value)).toString('base64')
   }

   function decompressCookie(compressed: string): string {
     return zlib.inflateSync(Buffer.from(compressed, 'base64')).toString()
   }
   ```

### 2. Caching Strategy

**Multi-Layer Caching**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Caching Layers                          │
└─────────────────────────────────────────────────────────────┘

Level 1: In-Memory Cache (Serverless Function)
- Token validation results: 1 minute TTL
- User roles: 5 minute TTL
- Component states: Not cached (user-specific)

Level 2: Vercel Edge Cache (CDN)
- Public static assets: 1 year
- API responses: No caching (dynamic content)

Level 3: Supabase Connection Pool
- Database connections: Automatic
- Query results: Managed by PostgreSQL
```

**Implementation**:

```typescript
// api/middleware/cache.ts
const cache = new Map<string, {
  data: any
  expires: number
}>()

export function withCache(
  handler: any,
  keyFn: (req: VercelRequest) => string,
  ttlMs: number
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const key = keyFn(req)
    const cached = cache.get(key)

    if (cached && Date.now() < cached.expires) {
      return res.status(200).json(cached.data)
    }

    const response = await handler(req, res)

    // Cache successful responses
    if (res.statusCode === 200) {
      cache.set(key, {
        data: response,
        expires: Date.now() + ttlMs
      })
    }

    return response
  }
}
```

### 3. Database Query Optimization

**Indexed Queries**:

```sql
-- All queries should use indexes

-- Fast user lookup by ID
SELECT role FROM user_profiles WHERE id = $1;
-- Uses PRIMARY KEY index

-- Fast component state lookup
SELECT * FROM user_component_states
WHERE user_id = $1 AND component_key = $2;
-- Uses idx_user_component_states_user_id

-- Fast audit log queries
SELECT * FROM admin_audit_log
WHERE user_id = $1
ORDER BY timestamp DESC
LIMIT 100;
-- Uses idx_admin_audit_log_user_timestamp
```

**Connection Pooling**:

```typescript
// api/lib/supabase-pool.ts
import { createClient } from '@supabase/supabase-js'

// Reuse Supabase client across invocations
let supabaseClient: any = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'Connection': 'keep-alive'
          }
        }
      }
    )
  }
  return supabaseClient
}
```

### 4. Token Refresh Strategy

**Proactive Refresh** (before expiration):

```typescript
// src/hooks/useTokenRefresh.ts
import { useEffect, useRef } from 'react'

export function useTokenRefresh() {
  const refreshTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Schedule refresh 5 minutes before expiration
    const scheduleRefresh = (expiresIn: number) => {
      const refreshIn = Math.max(0, (expiresIn - 300) * 1000)  // 5 min buffer

      refreshTimerRef.current = setTimeout(async () => {
        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'X-CSRF-Token': getCsrfToken()
            }
          })

          if (response.ok) {
            const data = await response.json()
            setCsrfToken(data.csrfToken)
            scheduleRefresh(data.session.expiresIn)
          }
        } catch (error) {
          console.error('Token refresh failed:', error)
        }
      }, refreshIn)
    }

    // Start refresh cycle
    scheduleRefresh(3600)  // 1 hour

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])
}
```

### 5. CDN Optimization

**Vercel Edge Functions**:

```typescript
// api/auth/_middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: '/api/auth/:path*'
}

export function middleware(request: NextRequest) {
  // Run at edge for faster response
  const response = NextResponse.next()

  // Add security headers at edge
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  return response
}
```

### Performance Metrics

| Metric | Target | Current (localStorage) | Expected (httpOnly) |
|--------|--------|------------------------|---------------------|
| Auth check latency | < 100ms | 80ms | 90ms (+10ms cookie overhead) |
| Token refresh | < 200ms | 150ms | 180ms (+30ms server-side) |
| First paint | < 1.5s | 1.2s | 1.3s (+100ms auth check) |
| Cookie overhead | < 2KB | 0 KB | 1.5KB |
| API request overhead | < 50ms | 0ms | 30ms (CSRF validation) |

**Acceptable Trade-offs**:
- +10-30ms latency for significantly improved security
- +1.5KB request size (< 1% of typical page size)
- +100ms initial load (one-time cost per session)

---

## Testing Strategy

### 1. Unit Tests

```typescript
// api/__tests__/auth/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../auth/session'
import { createMocks } from 'node-mocks-http'

describe('POST /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should set httpOnly cookies on successful login', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'password123'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)

    const cookies = res._getHeaders()['set-cookie']
    expect(cookies).toContain('sb-access-token')
    expect(cookies).toContain('HttpOnly')
    expect(cookies).toContain('Secure')
    expect(cookies).toContain('SameSite=Lax')
  })

  it('should return 401 for invalid credentials', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'wrong-password'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
    expect(res._getJSONData()).toEqual({
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    })
  })

  it('should validate CSRF token on protected requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'x-csrf-token': 'invalid-token'
      },
      cookies: {
        'csrf-token': 'valid-token'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(403)
    expect(res._getJSONData()).toEqual({
      error: 'Invalid CSRF token',
      code: 'CSRF_VALIDATION_FAILED'
    })
  })
})
```

### 2. Integration Tests

```typescript
// tests/integration/auth-flow.test.ts
import { describe, it, expect } from 'vitest'
import { createTestUser, cleanupTestUser } from '../helpers/test-users'

describe('Complete Auth Flow', () => {
  it('should complete full authentication cycle', async () => {
    const testUser = await createTestUser()

    try {
      // 1. Login
      const loginResponse = await fetch('http://localhost:3000/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password
        }),
        credentials: 'include'
      })

      expect(loginResponse.ok).toBe(true)
      const loginData = await loginResponse.json()
      expect(loginData.user).toBeDefined()
      expect(loginData.csrfToken).toBeDefined()

      const csrfToken = loginData.csrfToken

      // 2. Access protected resource
      const protectedResponse = await fetch('http://localhost:3000/api/auth/verify', {
        method: 'GET',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      })

      expect(protectedResponse.ok).toBe(true)
      const verifyData = await protectedResponse.json()
      expect(verifyData.valid).toBe(true)

      // 3. Refresh token
      const refreshResponse = await fetch('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      })

      expect(refreshResponse.ok).toBe(true)
      const refreshData = await refreshResponse.json()
      expect(refreshData.csrfToken).toBeDefined()

      // 4. Logout
      const logoutResponse = await fetch('http://localhost:3000/api/auth/session', {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': refreshData.csrfToken
        },
        credentials: 'include'
      })

      expect(logoutResponse.ok).toBe(true)

      // 5. Verify logout (should fail)
      const verifyAfterLogout = await fetch('http://localhost:3000/api/auth/verify', {
        method: 'GET',
        credentials: 'include'
      })

      expect(verifyAfterLogout.ok).toBe(false)
    } finally {
      await cleanupTestUser(testUser.id)
    }
  })
})
```

### 3. E2E Tests (Playwright)

```typescript
// tests/e2e/auth-cookie-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('httpOnly Cookie Authentication', () => {
  test('should login and access protected pages', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000')

    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for redirect
    await page.waitForURL('http://localhost:3000/dashboard')

    // Verify cookies are set
    const cookies = await page.context().cookies()
    const accessTokenCookie = cookies.find(c => c.name === 'sb-access-token')
    const csrfTokenCookie = cookies.find(c => c.name === 'csrf-token')

    expect(accessTokenCookie).toBeDefined()
    expect(accessTokenCookie?.httpOnly).toBe(true)
    expect(accessTokenCookie?.secure).toBe(true)

    expect(csrfTokenCookie).toBeDefined()
    expect(csrfTokenCookie?.httpOnly).toBe(false)  // Readable by JS

    // Access protected API
    const response = await page.evaluate(async () => {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf-token='))
        ?.split('=')[1]

      return fetch('/api/auth/verify', {
        method: 'GET',
        headers: {
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include'
      }).then(r => r.json())
    })

    expect(response.valid).toBe(true)
  })

  test('should prevent XSS token theft', async ({ page }) => {
    await page.goto('http://localhost:3000')

    // Login first
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/dashboard')

    // Try to access httpOnly cookie via JavaScript
    const canAccessToken = await page.evaluate(() => {
      const cookies = document.cookie
      return cookies.includes('sb-access-token')
    })

    expect(canAccessToken).toBe(false)
  })

  test('should handle token refresh automatically', async ({ page }) => {
    // Mock expired token scenario
    await page.goto('http://localhost:3000')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/dashboard')

    // Wait for token to approach expiration (or mock it)
    // ... implementation depends on test setup

    // Make API request that triggers refresh
    const response = await page.evaluate(async () => {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf-token='))
        ?.split('=')[1]

      return fetch('/api/projects', {
        headers: { 'X-CSRF-Token': csrfToken || '' },
        credentials: 'include'
      }).then(r => r.status)
    })

    expect(response).toBe(200)
  })
})
```

### 4. Security Tests

```typescript
// tests/security/csrf-protection.test.ts
import { describe, it, expect } from 'vitest'

describe('CSRF Protection', () => {
  it('should reject requests without CSRF token', async () => {
    const response = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'GET',
      credentials: 'include'
      // No X-CSRF-Token header
    })

    expect(response.status).toBe(403)
  })

  it('should reject requests with mismatched CSRF tokens', async () => {
    const response = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'GET',
      headers: {
        'X-CSRF-Token': 'malicious-token'
      },
      credentials: 'include'
    })

    expect(response.status).toBe(403)
  })

  it('should prevent CSRF via cross-origin requests', async () => {
    // Simulate request from attacker's site
    const response = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'GET',
      headers: {
        'Origin': 'https://evil.com',
        'X-CSRF-Token': 'stolen-token'
      },
      credentials: 'include'
    })

    // Browser will block due to CORS
    expect(response.ok).toBe(false)
  })
})
```

### Test Coverage Goals

| Category | Target Coverage | Priority |
|----------|----------------|----------|
| Auth endpoints | 95% | Critical |
| Middleware | 90% | Critical |
| Cookie utilities | 95% | Critical |
| Component state API | 85% | High |
| Admin endpoints | 90% | High |
| Error handling | 80% | Medium |

---

## Deployment Guide

### 1. Environment Variables

```bash
# Required for all environments
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for component state encryption
STATE_ENCRYPTION_KEY=your-32-byte-random-key

# Optional: Feature flags
VITE_USE_HTTPONLY_AUTH=true
ENABLE_ADMIN_AUDIT=true

# Optional: Rate limiting (if using Redis)
REDIS_URL=redis://your-redis-url
```

**Generate STATE_ENCRYPTION_KEY**:

```bash
# Generate secure 32-byte key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Vercel Configuration

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Set environment variables
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add STATE_ENCRYPTION_KEY production

# Deploy
vercel --prod
```

### 3. Supabase Configuration

```sql
-- Run in Supabase SQL Editor
-- 1. Create tables
\i database/migrations/001_httponly_cookie_auth.sql

-- 2. Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_component_states', 'admin_audit_log');

-- 3. Verify RLS policies
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_component_states', 'admin_audit_log');

-- 4. Create indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_component_states_user_id
  ON user_component_states(user_id);

-- 5. Verify indexes
SELECT indexname FROM pg_indexes
WHERE tablename IN ('user_component_states', 'admin_audit_log');
```

### 4. Deployment Checklist

```markdown
## Pre-Deployment

- [ ] All environment variables set in Vercel
- [ ] Database migrations run in production Supabase
- [ ] STATE_ENCRYPTION_KEY generated and stored securely
- [ ] SSL/TLS certificates valid
- [ ] CORS configuration verified
- [ ] Rate limits configured appropriately
- [ ] Monitoring dashboards set up
- [ ] Backup procedures tested

## Deployment

- [ ] Deploy API endpoints first (backward compatible)
- [ ] Verify API endpoints working in production
- [ ] Deploy frontend with feature flag OFF
- [ ] Verify existing auth still working
- [ ] Enable feature flag for 10% of users
- [ ] Monitor for errors
- [ ] Gradually increase rollout
- [ ] 100% rollout completed

## Post-Deployment

- [ ] All users migrated successfully
- [ ] Error rates within normal range
- [ ] Performance metrics acceptable
- [ ] Security headers verified
- [ ] Cookie configuration verified
- [ ] CSRF protection working
- [ ] Admin audit logging working
- [ ] Component state storage working
- [ ] Documentation updated
- [ ] Team trained on new system
```

### 5. Monitoring Setup

```typescript
// api/lib/monitoring.ts
import { VercelRequest } from '@vercel/node'

// Log auth events for monitoring
export function logAuthEvent(
  event: 'login' | 'logout' | 'refresh' | 'verify',
  userId: string | null,
  success: boolean,
  req: VercelRequest
) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    userId,
    success,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    // Add more fields as needed
  }))
}

// Usage in auth endpoints
logAuthEvent('login', user.id, true, req)
```

**Set up Vercel Log Drains**:

```bash
# Send logs to monitoring service
vercel integrations add datadog
# or
vercel integrations add sentry
```

### 6. Health Checks

```typescript
// api/health.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      supabase: 'unknown',
      database: 'unknown',
      cookies: 'unknown'
    }
  }

  try {
    // Check Supabase connection
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.from('user_profiles').select('count', { count: 'exact', head: true })
    checks.checks.supabase = error ? 'unhealthy' : 'healthy'
    checks.checks.database = error ? 'unhealthy' : 'healthy'

    // Check cookie configuration
    checks.checks.cookies = process.env.STATE_ENCRYPTION_KEY ? 'healthy' : 'unhealthy'

    // Overall status
    const allHealthy = Object.values(checks.checks).every(c => c === 'healthy')
    checks.status = allHealthy ? 'healthy' : 'degraded'

    res.status(allHealthy ? 200 : 503).json(checks)
  } catch (error) {
    checks.status = 'unhealthy'
    res.status(503).json(checks)
  }
}
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Cookies Not Being Set

**Symptoms**:
- Login appears successful but subsequent requests fail with 401
- Browser dev tools show no cookies in Storage tab

**Causes**:
- Incorrect domain configuration
- HTTPS not enabled in production
- SameSite attribute too restrictive

**Solutions**:

```typescript
// Debug: Log cookie settings
console.log('Cookie config:', {
  domain: process.env.VERCEL_URL || 'localhost',
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax'
})

// Fix: Remove explicit domain in Vercel
const COOKIE_CONFIG = {
  // ...other config
  domain: undefined  // Let Vercel auto-detect
}

// Fix: Ensure HTTPS in production
if (process.env.NODE_ENV === 'production' && !req.headers['x-forwarded-proto']?.includes('https')) {
  return res.status(400).json({ error: 'HTTPS required' })
}
```

#### 2. CSRF Token Mismatch

**Symptoms**:
- All API requests fail with 403 CSRF error
- CSRF token in header doesn't match cookie

**Causes**:
- Token not being read correctly from cookie
- Token being read from wrong cookie
- Multiple tabs/windows with different tokens

**Solutions**:

```typescript
// Debug: Log token comparison
console.log('CSRF Debug:', {
  headerToken: req.headers['x-csrf-token'],
  cookieToken: req.cookies['csrf-token'],
  match: req.headers['x-csrf-token'] === req.cookies['csrf-token']
})

// Fix: Ensure correct cookie name
function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf-token=([^;]+)/)
  if (!match) {
    console.error('CSRF token cookie not found')
    return null
  }
  return match[1]
}

// Fix: Refresh CSRF token on mismatch
if (response.status === 403 && response.error === 'CSRF_VALIDATION_FAILED') {
  // Trigger token refresh
  await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
  // Retry original request
}
```

#### 3. Token Refresh Loop

**Symptoms**:
- Infinite loop of token refresh requests
- Network tab shows continuous /api/auth/refresh calls

**Causes**:
- Refresh token expired but not handling error
- Refresh logic triggering on every 401

**Solutions**:

```typescript
// Add refresh attempt tracking
let refreshAttempts = 0
const MAX_REFRESH_ATTEMPTS = 3

async function refreshToken(): Promise<boolean> {
  if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
    console.error('Max refresh attempts reached, logging out')
    await logout()
    return false
  }

  refreshAttempts++

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': getCsrfToken() }
    })

    if (response.ok) {
      refreshAttempts = 0  // Reset on success
      return true
    } else {
      console.error('Refresh failed:', response.status)
      if (response.status === 401) {
        // Refresh token expired, logout
        await logout()
      }
      return false
    }
  } catch (error) {
    console.error('Refresh error:', error)
    return false
  }
}
```

#### 4. Cookies Not Sent in Cross-Origin Requests

**Symptoms**:
- API requests from frontend fail with 401
- Cookies visible in dev tools but not sent in requests

**Causes**:
- Missing `credentials: 'include'` in fetch
- CORS configuration not allowing credentials

**Solutions**:

```typescript
// Frontend: Always include credentials
fetch('/api/protected', {
  credentials: 'include',  // REQUIRED for cookies
  headers: {
    'X-CSRF-Token': getCsrfToken()
  }
})

// Backend: Allow credentials in CORS
res.setHeader('Access-Control-Allow-Credentials', 'true')
res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
```

#### 5. Session Expired After Page Refresh

**Symptoms**:
- Users logged out after refreshing page
- Session appears lost despite valid cookies

**Causes**:
- Cookies not persisting across page loads
- Session check failing silently

**Solutions**:

```typescript
// Add session restoration on page load
useEffect(() => {
  const restoreSession = async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        credentials: 'include',
        headers: { 'X-CSRF-Token': getCsrfToken() }
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        // Session invalid, clear state
        setUser(null)
      }
    } catch (error) {
      console.error('Session restoration failed:', error)
      setUser(null)
    }
  }

  restoreSession()
}, [])
```

#### 6. Admin Verification Fails

**Symptoms**:
- Admin users cannot access admin features
- Server returns 403 despite correct role in database

**Causes**:
- Role cache out of sync
- RLS policies blocking service role queries

**Solutions**:

```typescript
// Clear role cache on permission denial
if (response.status === 403) {
  // Clear server-side cache
  await fetch('/api/auth/clear-cache', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': getCsrfToken() }
  })

  // Retry request
  // ...
}

// Verify RLS policies allow service role
-- In Supabase SQL Editor
SELECT * FROM user_profiles WHERE id = '[user-id]';
-- Should return row with role='admin'
```

### Debug Mode

```typescript
// Enable debug logging
if (process.env.NODE_ENV === 'development') {
  console.log('Auth Debug:', {
    cookies: Object.keys(req.cookies),
    headers: Object.keys(req.headers),
    hasCsrf: !!req.headers['x-csrf-token'],
    hasAccessToken: !!req.cookies['sb-access-token']
  })
}
```

### Support Resources

- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **Vercel Serverless Docs**: https://vercel.com/docs/functions
- **OWASP Cookie Security**: https://owasp.org/www-community/controls/SecureCookieAttribute
- **MDN Set-Cookie**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie

---

## Appendix

### A. Code Examples

#### Complete Middleware Stack

```typescript
// api/protected-endpoint.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import {
  withAuth,
  withCSRF,
  withRateLimit,
  withSanitization,
  compose
} from './middleware/security'

async function handler(req: VercelRequest, res: VercelResponse) {
  const user = (req as any).user

  // Your business logic here
  return res.status(200).json({
    message: 'Protected resource',
    user
  })
}

export default compose(
  withSanitization,
  withRateLimit({ maxRequests: 10, windowMs: 60000 }),
  withCSRF,
  withAuth
)(handler)
```

#### Frontend API Client

```typescript
// src/lib/api-client.ts
class ApiClient {
  private csrfToken: string | null = null

  constructor() {
    this.updateCsrfToken()
  }

  private updateCsrfToken() {
    const match = document.cookie.match(/csrf-token=([^;]+)/)
    this.csrfToken = match ? match[1] : null
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': this.csrfToken || ''
        }
      })

      if (response.ok) {
        const data = await response.json()
        this.csrfToken = data.csrfToken
        return true
      }
      return false
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.csrfToken && { 'X-CSRF-Token': this.csrfToken }),
      ...options.headers
    }

    let response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    })

    // Auto-refresh on 401
    if (response.status === 401) {
      const refreshed = await this.refreshToken()
      if (refreshed) {
        // Retry with new token
        response = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            'X-CSRF-Token': this.csrfToken || ''
          },
          credentials: 'include'
        })
      }
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
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

  async put<T>(url: string, data: any): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async delete<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' })
  }
}

export const apiClient = new ApiClient()
```

### B. Security Audit Checklist

```markdown
## httpOnly Cookie Authentication Security Audit

### Authentication
- [ ] Tokens stored in httpOnly cookies only
- [ ] No tokens in localStorage or sessionStorage
- [ ] CSRF protection implemented and tested
- [ ] Token rotation on refresh
- [ ] Old tokens invalidated immediately
- [ ] Session timeout configured appropriately

### Authorization
- [ ] Server-side role verification
- [ ] Admin capabilities properly scoped
- [ ] Audit logging for admin actions
- [ ] No client-side trust for authorization

### Cookie Security
- [ ] httpOnly flag set on sensitive cookies
- [ ] Secure flag set (HTTPS only)
- [ ] SameSite attribute configured
- [ ] Appropriate Max-Age/Expires
- [ ] Path restriction where appropriate
- [ ] No sensitive data in cookie values

### CSRF Protection
- [ ] Double-submit cookie pattern implemented
- [ ] Tokens generated securely (crypto.randomBytes)
- [ ] Tokens validated on all state-changing requests
- [ ] GET requests don't require CSRF token
- [ ] CORS configured correctly

### XSS Prevention
- [ ] Input sanitization on all user input
- [ ] Output encoding in templates
- [ ] Content Security Policy headers
- [ ] No eval() or innerHTML with user data
- [ ] DOMPurify for HTML sanitization

### Session Management
- [ ] Session fixation prevented
- [ ] Sessions invalidated on logout
- [ ] Absolute session timeout
- [ ] Idle session timeout
- [ ] Multi-device session management

### Rate Limiting
- [ ] Auth endpoints rate limited
- [ ] Admin endpoints rate limited
- [ ] Rate limit bypass prevented
- [ ] Rate limit headers sent

### Transport Security
- [ ] HTTPS enforced in production
- [ ] HSTS headers set
- [ ] TLS 1.2+ only
- [ ] Strong cipher suites

### Error Handling
- [ ] No sensitive data in error messages
- [ ] Generic error messages to client
- [ ] Detailed errors logged server-side
- [ ] No stack traces to client

### Monitoring & Logging
- [ ] Auth events logged
- [ ] Admin actions audited
- [ ] Suspicious activity detected
- [ ] Alerts configured

### Compliance
- [ ] GDPR compliance reviewed
- [ ] Data retention policies
- [ ] User data encrypted at rest
- [ ] Right to be forgotten implemented
```

### C. Performance Benchmarks

```typescript
// scripts/benchmark-auth.ts
import { performance } from 'perf_hooks'

async function benchmarkAuth() {
  const results = {
    login: [],
    verify: [],
    refresh: [],
    logout: []
  }

  // Run 100 iterations
  for (let i = 0; i < 100; i++) {
    // Login
    const loginStart = performance.now()
    await fetch('http://localhost:3000/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      }),
      credentials: 'include'
    })
    results.login.push(performance.now() - loginStart)

    // Verify
    const verifyStart = performance.now()
    await fetch('http://localhost:3000/api/auth/verify', {
      credentials: 'include'
    })
    results.verify.push(performance.now() - verifyStart)

    // Refresh
    const refreshStart = performance.now()
    await fetch('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    })
    results.refresh.push(performance.now() - refreshStart)

    // Logout
    const logoutStart = performance.now()
    await fetch('http://localhost:3000/api/auth/session', {
      method: 'DELETE',
      credentials: 'include'
    })
    results.logout.push(performance.now() - logoutStart)
  }

  // Calculate statistics
  const stats = {}
  for (const [operation, times] of Object.entries(results)) {
    const sorted = times.sort((a, b) => a - b)
    stats[operation] = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      avg: times.reduce((a, b) => a + b, 0) / times.length
    }
  }

  console.log('Performance Benchmarks:', JSON.stringify(stats, null, 2))
}

benchmarkAuth()
```

---

## Summary

This architecture specification provides a complete, production-ready design for migrating from localStorage-based authentication to httpOnly cookie-based authentication. The design eliminates the CVSS 9.1 XSS vulnerability while maintaining excellent performance and user experience.

**Key Benefits**:
- XSS-proof token storage
- Server-side authorization verification
- CSRF protection via double-submit cookies
- Encrypted component state storage
- Comprehensive audit logging
- Minimal performance impact (+10-30ms)
- Backward compatible migration path

**Next Steps**:
1. Review this specification with the team
2. Set up development environment
3. Begin Phase 1 implementation (infrastructure)
4. Follow the migration strategy incrementally
5. Monitor metrics throughout rollout

**Questions or Concerns**:
Contact the backend architect team or refer to the troubleshooting section for common issues.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Status**: Ready for Implementation
