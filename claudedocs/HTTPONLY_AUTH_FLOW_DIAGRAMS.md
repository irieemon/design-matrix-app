# Frontend httpOnly Cookie Authentication - Flow Diagrams

**Visual Reference for Authentication Flows**

## 1. Login Flow (Complete)

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Enter credentials
     ↓
┌────────────────┐
│  LoginForm     │
│  Component     │
└────┬───────────┘
     │ 2. login(email, password)
     ↓
┌────────────────┐
│ useSecureAuth  │
│  Hook          │
└────┬───────────┘
     │ 3. POST /api/auth/session
     │    { email, password }
     ↓
┌────────────────┐
│  Backend API   │
│  /auth/session │
└────┬───────────┘
     │ 4. Verify credentials (Supabase)
     │
     │ 5. Generate CSRF token
     │
     │ 6. Set cookies:
     │    - access_token (httpOnly, 1h)
     │    - refresh_token (httpOnly, 7d)
     │    - csrf-token (readable, 1h)
     │
     │ 7. Return { user, expiresAt }
     ↓
┌────────────────┐
│ useSecureAuth  │
│  Hook          │
└────┬───────────┘
     │ 8. setState({ user, isAuthenticated: true })
     │
     │ 9. Schedule auto-refresh (5 min before expiry)
     ↓
┌────────────────┐
│  App UI        │
│  (logged in)   │
└────────────────┘
```

## 2. Session Detection on Page Load

```
┌──────────┐
│  Browser │
│  Loads   │
│  App     │
└────┬─────┘
     │ 1. React mount
     ↓
┌────────────────┐
│ useSecureAuth  │
│  useEffect     │
└────┬───────────┘
     │ 2. GET /api/auth/user
     │    Cookies: access_token (sent automatically)
     ↓
┌────────────────┐
│  Backend API   │
│  /auth/user    │
└────┬───────────┘
     │ 3. Verify access_token
     │
     │ 4a. Valid token → Return { user, expiresAt }
     │ 4b. Invalid/missing → Return 401
     ↓
┌────────────────┐
│ useSecureAuth  │
│  Hook          │
└────┬───────────┘
     │ 5a. Valid: setState({ user, isAuthenticated: true })
     │ 5b. Invalid: setState({ isAuthenticated: false })
     │
     │ 6. setIsLoading(false)
     ↓
┌────────────────┐
│  App UI        │
│  Rendered      │
└────────────────┘
```

## 3. Protected API Call with CSRF

```
┌──────────────┐
│  Component   │
│  (mutation)  │
└──────┬───────┘
       │ 1. apiClient.post('/api/endpoint', data)
       ↓
┌──────────────┐
│  apiClient   │
│  request()   │
└──────┬───────┘
       │ 2. Read CSRF token from cookie
       │    document.cookie → csrf-token=xxx
       │
       │ 3. Build request:
       │    Headers:
       │      X-CSRF-Token: xxx
       │      Content-Type: application/json
       │    Cookies: (sent automatically by browser)
       │      access_token, csrf-token
       │
       │ 4. POST /api/endpoint
       ↓
┌──────────────┐
│  Backend API │
│  /endpoint   │
└──────┬───────┘
       │ 5. withCSRF middleware:
       │    - Read cookie: csrf-token=xxx
       │    - Read header: X-CSRF-Token=xxx
       │    - Compare using crypto.timingSafeEqual
       │
       │ 6a. Match → Continue
       │ 6b. Mismatch → Return 403
       │
       │ 7. withAuth middleware:
       │    - Read cookie: access_token
       │    - Verify with Supabase
       │
       │ 8a. Valid → Continue
       │ 8b. Invalid → Return 401
       │
       │ 9. Execute business logic
       │
       │ 10. Return response
       ↓
┌──────────────┐
│  apiClient   │
│  request()   │
└──────┬───────┘
       │ 11. Parse response
       │
       │ 12. Return data to component
       ↓
┌──────────────┐
│  Component   │
│  (updated)   │
└──────────────┘
```

## 4. Automatic Token Refresh (401 Response)

```
┌──────────────┐
│  Component   │
└──────┬───────┘
       │ 1. apiClient.get('/api/endpoint')
       ↓
┌──────────────┐
│  apiClient   │
│  request()   │
└──────┬───────┘
       │ 2. GET /api/endpoint
       │    Cookies: access_token (expired)
       ↓
┌──────────────┐
│  Backend API │
└──────┬───────┘
       │ 3. Verify access_token → EXPIRED
       │
       │ 4. Return 401 Unauthorized
       ↓
┌──────────────┐
│  apiClient   │
│  request()   │
└──────┬───────┘
       │ 5. Detect 401 response
       │
       │ 6. Check: retryOn401=true?
       │    Yes → Continue
       │
       │ 7. Call refreshAccessToken()
       ↓
┌──────────────────────┐
│  refreshAccessToken  │
└──────┬───────────────┘
       │ 8. Check: Already refreshing?
       │    Yes → Wait for existing refresh
       │    No → Start refresh
       │
       │ 9. POST /api/auth/refresh
       │    Cookies: refresh_token
       ↓
┌──────────────┐
│  Backend API │
│  /auth/      │
│  refresh     │
└──────┬───────┘
       │ 10. Verify refresh_token
       │
       │ 11. Generate new access_token
       │
       │ 12. Set cookie: access_token (new)
       │
       │ 13. Return { expiresAt }
       ↓
┌──────────────────────┐
│  refreshAccessToken  │
└──────┬───────────────┘
       │ 14. Success
       ↓
┌──────────────┐
│  apiClient   │
│  request()   │
└──────┬───────┘
       │ 15. Retry original request
       │    GET /api/endpoint
       │    Cookies: access_token (new)
       ↓
┌──────────────┐
│  Backend API │
└──────┬───────┘
       │ 16. Verify access_token → VALID
       │
       │ 17. Return data
       ↓
┌──────────────┐
│  Component   │
│  (data       │
│  received)   │
└──────────────┘
```

## 5. Proactive Token Refresh (Before Expiry)

```
┌──────────────┐
│  Login       │
│  Success     │
└──────┬───────┘
       │ 1. setState({ user, expiresAt })
       ↓
┌──────────────┐
│ useSecureAuth│
│  Hook        │
└──────┬───────┏━━━━━━━━━━━━━━━━━━━━━━━━━┓
       │       ┃ scheduleTokenRefresh()   ┃
       │       ┗━━━━━━━━━━━━━┯━━━━━━━━━━━┛
       │ 2. Calculate:              │
       │    refreshAt = expiresAt - 5min
       │    timeUntilRefresh = refreshAt - now
       │                            │
       │ 3. setTimeout(refreshAt)   │
       │                            │
       └────────────────────────────┘
                    │
                    │ (5 minutes before expiry)
                    ↓
       ┌────────────────────────┐
       │  refreshSession()      │
       └────────┬───────────────┘
                │ 4. POST /api/auth/refresh
                │    Cookies: refresh_token
                ↓
       ┌────────────────┐
       │  Backend API   │
       │  /auth/refresh │
       └────────┬───────┘
                │ 5. Generate new access_token
                │
                │ 6. Set cookie: access_token (new)
                │
                │ 7. Return { expiresAt }
                ↓
       ┌────────────────┐
       │  refreshSession│
       └────────┬───────┘
                │ 8. setState({ expiresAt })
                │
                │ 9. Schedule next refresh
                ↓
       ┌────────────────┐
       │  User continues│
       │  working       │
       │  (seamless)    │
       └────────────────┘
```

## 6. Server Component State Sync

```
┌──────────────┐
│  Component   │
│  Mount       │
└──────┬───────┘
       │ 1. useServerComponentState('my-key', defaultValue)
       ↓
┌──────────────────────┐
│ useServerComponent   │
│ State Hook           │
└──────┬───────────────┘
       │ 2. useEffect (mount)
       │
       │ 3. GET /api/user/component-state?componentKey=my-key
       │    Cookies: access_token
       ↓
┌──────────────┐
│  Backend API │
│  /user/      │
│  component-  │
│  state       │
└──────┬───────┘
       │ 4. Verify auth (access_token)
       │
       │ 5. Query database:
       │    SELECT state FROM user_component_states
       │    WHERE user_id = ? AND component_key = ?
       │
       │ 6a. Found → Return { state, updatedAt }
       │ 6b. Not found → Return 404
       ↓
┌──────────────────────┐
│ useServerComponent   │
│ State Hook           │
└──────┬───────────────┘
       │ 7. setState(serverState || defaultValue)
       │
       │ 8. setIsLoading(false)
       ↓
┌──────────────┐
│  Component   │
│  Rendered    │
│  with state  │
└──────┬───────┘
       │
       │ ... user interacts ...
       │
       │ 9. setState(newValue)
       ↓
┌──────────────────────┐
│ useServerComponent   │
│ State Hook           │
└──────┬───────────────┘
       │ 10. Debounce timer starts (500ms default)
       │
       │ ... wait 500ms ...
       │
       │ 11. POST /api/user/component-state
       │     { componentKey, state, expiresIn }
       │     Cookies: access_token, csrf-token
       │     Headers: X-CSRF-Token
       ↓
┌──────────────┐
│  Backend API │
└──────┬───────┘
       │ 12. Verify auth + CSRF
       │
       │ 13. Validate state size (<100KB)
       │
       │ 14. UPSERT database:
       │     INSERT INTO user_component_states
       │     ON CONFLICT (user_id, component_key)
       │     DO UPDATE SET state = ?, updated_at = NOW()
       │
       │ 15. Return { success, updatedAt }
       ↓
┌──────────────────────┐
│ useServerComponent   │
│ State Hook           │
└──────┬───────────────┘
       │ 16. setLastSyncedAt(updatedAt)
       │
       │ 17. setIsSyncing(false)
       ↓
┌──────────────┐
│  Component   │
│  (state      │
│  saved)      │
└──────────────┘

       ... periodic sync (every 5s default) ...

       │ 18. setInterval → repeat steps 11-17
       └─────────────────────────────────────
```

## 7. Admin Verification Flow

```
┌──────────────┐
│  Admin       │
│  Component   │
└──────┬───────┘
       │ 1. switchToAdminMode()
       ↓
┌──────────────┐
│  useAdmin    │
│  Hook        │
└──────┬───────┘
       │ 2. Check: isAdmin (client-side role)?
       │    No → Reject immediately
       │    Yes → Continue
       │
       │ 3. POST /api/auth/admin/verify
       │    Cookies: access_token, csrf-token
       │    Headers: X-CSRF-Token
       ↓
┌──────────────┐
│  Backend API │
│  /auth/admin/│
│  verify      │
└──────┬───────┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
       │       ┃ withAuth middleware        ┃
       │       ┗━━━━━━━━━━━━┯━━━━━━━━━━━━━━┛
       │ 4. Verify access_token     │
       │                             │
       │ 5. Extract user.id          │
       │                             │
       └─────────────────────────────┘
                    │
                    ↓
       ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
       ┃ Admin verification logic   ┃
       ┗━━━━━━━━━━━━┯━━━━━━━━━━━━━━┛
       │ 6. Query database:         │
       │    SELECT role FROM users  │
       │    WHERE id = ?            │
       │                             │
       │ 7. Check role:              │
       │    - 'super_admin' → Full   │
       │    - 'admin' → Limited      │
       │    - 'user' → Reject        │
       │                             │
       │ 8. Get capabilities:        │
       │    - view_all_users         │
       │    - update_user_status     │
       │    - etc.                   │
       │                             │
       │ 9. Log audit entry:         │
       │    INSERT INTO admin_audit_log
       │    (user_id, action, ip)   │
       │                             │
       │ 10. Return:                 │
       │     { isAdmin, isSuperAdmin,│
       │       capabilities[] }      │
       └─────────────────────────────┘
                    │
                    ↓
┌──────────────┐
│  useAdmin    │
│  Hook        │
└──────┬───────┘
       │ 11. if (isAdmin):
       │       setIsAdminMode(true)
       │       setCapabilities(capabilities)
       │     else:
       │       throw Error('Not authorized')
       ↓
┌──────────────┐
│  Admin UI    │
│  Enabled     │
└──────────────┘
```

## 8. Logout Flow

```
┌──────────────┐
│  User clicks │
│  Logout      │
└──────┬───────┘
       │ 1. logout()
       ↓
┌──────────────┐
│ useSecureAuth│
│  Hook        │
└──────┬───────┘
       │ 2. DELETE /api/auth/session
       │    Cookies: access_token, refresh_token
       ↓
┌──────────────┐
│  Backend API │
│  /auth/      │
│  session     │
└──────┬───────┘
       │ 3. Revoke refresh_token (Supabase)
       │
       │ 4. Clear cookies:
       │    Set-Cookie: access_token=; Max-Age=0
       │    Set-Cookie: refresh_token=; Max-Age=0
       │    Set-Cookie: csrf-token=; Max-Age=0
       │
       │ 5. Return { success: true }
       ↓
┌──────────────┐
│ useSecureAuth│
│  Hook        │
└──────┬───────┘
       │ 6. setState({
       │      user: null,
       │      isAuthenticated: false
       │    })
       │
       │ 7. Clear scheduled refresh
       │
       │ 8. Trigger event: 'auth:logged-out'
       ↓
┌──────────────┐
│  App UI      │
│  (login      │
│  screen)     │
└──────────────┘
```

## 9. Error Handling: Token Refresh Failure

```
┌──────────────┐
│  apiClient   │
│  request()   │
└──────┬───────┘
       │ 1. GET /api/endpoint
       │    Response: 401
       ↓
┌──────────────────────┐
│  refreshAccessToken  │
└──────┬───────────────┘
       │ 2. POST /api/auth/refresh
       │    Cookies: refresh_token (expired/invalid)
       ↓
┌──────────────┐
│  Backend API │
└──────┬───────┘
       │ 3. Verify refresh_token → INVALID
       │
       │ 4. Return 401 Unauthorized
       ↓
┌──────────────────────┐
│  refreshAccessToken  │
└──────┬───────────────┘
       │ 5. Catch error
       │
       │ 6. Dispatch event:
       │    window.dispatchEvent('auth:session-expired')
       │
       │ 7. Throw ApiError('SESSION_EXPIRED')
       ↓
┌──────────────┐
│ Event        │
│ Listener     │
│ (useEffect)  │
└──────┬───────┘
       │ 8. Catch 'auth:session-expired'
       │
       │ 9. Call logout()
       ↓
┌──────────────┐
│ useSecureAuth│
└──────┬───────┘
       │ 10. Clear all state
       │
       │ 11. Show notification:
       │     "Session expired, please login again"
       ↓
┌──────────────┐
│  Login       │
│  Screen      │
└──────────────┘
```

## 10. Concurrent Request Deduplication

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│Request 1│  │Request 2│  │Request 3│
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     │ 1. Simultaneous 401 responses
     ↓            ↓            ↓
┌──────────────────────────────────────┐
│  refreshAccessToken()                │
└────┬─────────────────────────────────┘
     │ 2. Check: isRefreshing?
     │    No → Set isRefreshing=true
     │         Create refreshPromise
     │
     │ 3. POST /api/auth/refresh
     ↓
┌──────────────┐
│  Backend API │
└──────┬───────┘
       │ 4. New access_token
       ↓
┌──────────────────────────────────────┐
│  refreshPromise resolves             │
└────┬─────────────────────────────────┘
     │ 5. isRefreshing = false
     │
     ↓            ↓            ↓
┌─────────┐  ┌─────────┐  ┌─────────┐
│Request 1│  │Request 2│  │Request 3│
│ Retry   │  │ Retry   │  │ Retry   │
└─────────┘  └─────────┘  └─────────┘

Key: All 3 requests waited for single refresh!
```

---

**Document**: Part of [FRONTEND_HTTPONLY_INTEGRATION_DESIGN.md](./FRONTEND_HTTPONLY_INTEGRATION_DESIGN.md)
**Purpose**: Visual reference for understanding authentication flows
**Last Updated**: 2025-10-01
