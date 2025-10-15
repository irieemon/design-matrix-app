# Supabase Auth Quick Reference Card

**For:** React applications using Supabase v2.57+
**Pattern:** Standard official Supabase authentication flow

---

## The Two Methods

### getSession() - READ session (fast)
```typescript
const { data: { session }, error } = await supabase.auth.getSession()
```
- ✅ Reads from localStorage (< 10ms)
- ✅ No network request
- ✅ Use for initial state
- ❌ Don't call repeatedly (once is enough)

### onAuthStateChange() - LISTEN for changes
```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    // Update UI
  }
)
```
- ✅ Automatic token refresh
- ✅ Multi-tab sync
- ✅ Real-time updates
- ❌ Don't use async callbacks

---

## Complete useAuth Hook (80 lines)

```typescript
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // STEP 1: Get initial session
    const init = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error(error)
        await supabase.auth.signOut()
      }
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    }
    init()

    // STEP 2: Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    // STEP 3: Cleanup
    return () => subscription.unsubscribe()
  }, [])

  return { user, session, isLoading, signOut: () => supabase.auth.signOut() }
}
```

**That's it. Nothing else needed.**

---

## Supabase Client Config

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,       // Enable localStorage
      autoRefreshToken: true,     // Auto-refresh before expiry
      detectSessionInUrl: false,  // OAuth handled server-side
      storage: undefined,         // Use default adapter
      flowType: 'pkce'           // Security standard
    }
  }
)
```

**Key Points:**
- `persistSession: true` is REQUIRED for persistence
- `storage: undefined` lets Supabase use optimized adapter
- Don't customize storage unless absolutely necessary

---

## Common Tasks

### Login
```typescript
const { error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})
// onAuthStateChange handles the rest automatically
```

### Logout
```typescript
await supabase.auth.signOut()
// onAuthStateChange(SIGNED_OUT) fires automatically
```

### Check Auth Status
```typescript
const { user, isLoading } = useAuth()

if (isLoading) return <Loading />
if (!user) return <Login />
return <Dashboard />
```

### Get User Metadata
```typescript
const { user } = useAuth()

const profile = {
  id: user.id,
  email: user.email,
  name: user.user_metadata?.full_name,
  avatar: user.user_metadata?.avatar_url
}
```

### Fetch Additional User Data
```typescript
const { user } = useAuth()

// Use React Query, SWR, or manual fetch
const { data: profile } = useQuery(
  ['profile', user?.id],
  () => fetchProfile(user.id),
  { enabled: !!user }
)
```

---

## Auth Events

| Event | When It Fires | What To Do |
|-------|---------------|------------|
| INITIAL_SESSION | Client initialized | Set initial state |
| SIGNED_IN | User logs in | Update UI with user |
| SIGNED_OUT | User logs out | Clear user state |
| TOKEN_REFRESHED | Every ~55 min | Nothing (automatic) |
| USER_UPDATED | Profile changes | Update user display |
| PASSWORD_RECOVERY | Password reset | Show recovery UI |

**Handle All Events the Same:**
```typescript
onAuthStateChange((event, session) => {
  setSession(session)
  setUser(session?.user ?? null)
})
```

---

## Don'ts (Anti-Patterns)

### ❌ Don't Access localStorage Directly
```typescript
// BAD
const session = JSON.parse(localStorage.getItem('sb-...-auth-token'))
```
**Why:** Bypasses Supabase internal state management

### ❌ Don't Use setSession() for Loading
```typescript
// BAD
await supabase.auth.setSession({ access_token, refresh_token })
```
**Why:** Makes network request, causes hang

### ❌ Don't Call getSession() Repeatedly
```typescript
// BAD
useEffect(() => {
  const interval = setInterval(async () => {
    await supabase.auth.getSession()
  }, 1000)
}, [])
```
**Why:** Unnecessary, listener handles updates

### ❌ Don't Create Custom Caches
```typescript
// BAD
const sessionCache = new Map()
const userCache = new Map()
```
**Why:** Supabase already caches internally

### ❌ Don't Clear Supabase Storage Keys
```typescript
// BAD
localStorage.removeItem('sb-{project}-auth-token')
```
**Why:** Breaks session persistence

---

## Performance Targets

| Operation | Target | Typical |
|-----------|--------|---------|
| Page refresh (with session) | < 200ms | 50-150ms |
| Fresh login | < 500ms | 200-400ms |
| Logout | < 100ms | 20-50ms |
| Token refresh | < 300ms | 100-200ms |

**If you're not hitting these targets, the problem is NOT the auth pattern.**

Investigate:
- Database query performance
- Network latency
- Component render performance
- Bundle size

---

## Debugging Checklist

### Session Not Persisting?
1. Check `persistSession: true` in client config
2. Check `storage: undefined` (use default)
3. Open DevTools → Application → Local Storage
4. Look for `sb-{project}-auth-token` key
5. Verify browser allows localStorage

### "Flash of Login Screen"?
1. Verify `getSession()` called before render
2. Check `isLoading` state is shown
3. Ensure no race conditions clearing user state

### Multi-Tab Not Syncing?
1. Verify `onAuthStateChange` listener set up
2. Check listener is not inside a condition
3. Ensure subscription.unsubscribe() on unmount

### Token Refresh Failing?
1. Check network connectivity
2. Verify `autoRefreshToken: true` in config
3. Check Supabase logs for errors
4. Verify refresh_token is valid

---

## Migration from Complex Implementation

### Current Problem
- Direct localStorage → setSession() causes hang
- Custom caching causes stale data
- Multiple timeouts mask performance issues
- 1000+ lines of complex code

### Solution
- Use getSession() only (no setSession())
- Remove all custom caching
- Remove all timeouts
- Use 80-line standard pattern

### Expected Results
- 40-75x faster page loads
- 92% less code
- No more "Initializing workspace" hang
- Simpler debugging

---

## Resources

**Official Docs:**
- [Sessions Guide](https://supabase.com/docs/guides/auth/sessions)
- [getSession API](https://supabase.com/docs/reference/javascript/auth-getsession)
- [onAuthStateChange API](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)

**This Project:**
- [Architecture Document](./supabase-auth-architecture.md)
- [Comparison Document](./current-vs-standard-comparison.md)
- [Implementation Guide](./implementation-guide.md)
- [Reference Implementation](./useAuth-simplified-reference.ts)

---

## One-Line Summary

**Use `getSession()` for initial state, `onAuthStateChange()` for updates, trust Supabase for everything else.**

---

**Last Updated:** 2025-10-15
**Supabase Version:** v2.57.2+
**Pattern:** Standard Official
