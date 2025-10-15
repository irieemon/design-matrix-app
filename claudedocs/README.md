# Supabase Authentication Documentation

**Problem:** Current implementation has "fast path" optimization that breaks database queries.
**Solution:** Use standard Supabase authentication pattern.

## Quick Start

Read these documents in order:

1. **[answers-to-your-questions.md](./answers-to-your-questions.md)** - START HERE
   - Direct answers to your 5 questions
   - Quick implementation guide
   - What's broken and how to fix it

2. **[auth-flow-diagram.txt](./auth-flow-diagram.txt)** - Visual Reference
   - ASCII diagrams of auth flows
   - Comparison tables
   - Performance characteristics

3. **[auth-quick-reference.md](./auth-quick-reference.md)** - Quick Reference Card
   - 80-line complete useAuth hook
   - Common tasks and patterns
   - Debugging checklist

4. **[supabase-auth-architecture.md](./supabase-auth-architecture.md)** - Deep Dive
   - Complete technical architecture
   - Migration plan
   - Testing strategy
   - Production deployment guide

## The Problem in One Sentence

Your code reads localStorage and sets React state BUT never loads the session into the Supabase client, so database queries fail with "JWT expired" errors.

## The Solution in One Code Block

```typescript
useEffect(() => {
  let mounted = true

  const initAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (mounted) {
      setUser(session?.user ?? null)
      setIsLoading(false)
    }
  }

  initAuth()

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (mounted) setUser(session?.user ?? null)
    }
  )

  return () => {
    mounted = false
    subscription.unsubscribe()
  }
}, [])
```

## What to Do

1. Read [answers-to-your-questions.md](./answers-to-your-questions.md)
2. Remove lines 651-758 in `/src/hooks/useAuth.ts` (the "fast path")
3. Remove lines 629-637 in `/src/hooks/useAuth.ts` (the timeout)
4. Implement standard pattern (50 lines total)
5. Test: Login → Refresh → Database query works

## Expected Outcome

**Before:**
- Login: 8-15 seconds (timeout)
- Database queries: "JWT expired" errors
- Code: ~1000 lines

**After:**
- Login: < 500ms
- Database queries: Work immediately
- Code: ~50 lines

## Key Files

- `/src/hooks/useAuth.ts` - Main auth hook (needs simplification)
- `/src/lib/supabase.ts` - Supabase client (review storage cleanup)
- `/src/components/auth/AuthScreen.tsx` - Login UI (works correctly)

## Architecture Overview

```
localStorage (persistent storage)
    ↓
getSession() reads and loads into client
    ↓
Supabase Client (has session for database queries)
    ↓
React State (has user for UI rendering)
```

**Your broken flow:**
```
localStorage
    ↓
Direct JSON.parse() (bypasses Supabase)
    ↓
React State (UI works)
    ✗
Supabase Client (NO session, queries fail)
```

## Performance Reality

| Operation | Time | User Perception |
|-----------|------|-----------------|
| < 100ms | Instant | Imperceptible |
| 100-200ms | Fast | Barely noticeable |
| 200-500ms | Acceptable | Slight delay |
| > 1000ms | Slow | Noticeable wait |

**Standard pattern: 100-200ms (INSTANT)**
**Your fast path: Broken (INFINITE hang)**

## Key Principles

1. **Trust Supabase** - It already optimizes session management
2. **Use getSession()** - Required to load session into client
3. **Don't skip it** - Reading localStorage ≠ Loading client
4. **Keep it simple** - Standard pattern is 50 lines, not 1000
5. **Test correctness first** - Performance second

## Support

If you still have issues after implementing the standard pattern:

1. Check Supabase Dashboard (user exists, logs)
2. Check Browser Console (errors, localStorage)
3. Check Network Tab (API calls, 401/403 errors)
4. Verify environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

**The standard pattern works for thousands of production apps. If it doesn't work for you, the issue is NOT the auth pattern.**

## Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [getSession API](https://supabase.com/docs/reference/javascript/auth-getsession)
- [onAuthStateChange API](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Official React Example](https://github.com/supabase/supabase/tree/master/examples/auth/react-auth)

---

**Created:** 2025-10-15
**Author:** Backend Architect (Claude Code)
**Status:** Ready for Implementation
**Estimated Time to Fix:** 30 minutes
