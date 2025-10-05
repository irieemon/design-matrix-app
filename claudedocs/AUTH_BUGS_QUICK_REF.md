# Auth Bugs Quick Reference

**Session**: 2025-10-01 Authentication Investigation
**Status**: ✅ FIXED (with security caveat)

---

## The 6 Critical Bugs

### 1. Dual Auth Systems
**File**: `.env.local`
**Fix**: Set `VITE_FEATURE_HTTPONLY_AUTH=false`
**Why**: New system doesn't support demo users

### 2. Stale Closure
**File**: `src/hooks/useAuth.ts:547`
**Fix**: Added `[handleAuthUser]` to dependencies
**Why**: Empty array caused stale reference to handleAuthUser

### 3. Auth Bypass
**File**: `src/hooks/useAuth.ts:808,821,830`
**Fix**: Call `handleAuthSuccess()` not `handleAuthUser()`
**Why**: Bypassed cache clearing logic

### 4. Server-Side Crash
**File**: `src/lib/logging/LoggingService.ts`
**Fix**: Added `typeof window !== 'undefined'` checks
**Why**: Used browser APIs in Node.js environment

### 5. No Session Persistence
**File**: `src/lib/supabase.ts:33`
**Fix**: Changed `persistSession: false` → `true`
**Why**: Sessions weren't being saved
**SECURITY**: Re-introduced XSS vulnerability (PRIO-SEC-001)

### 6. Middleware Mismatch
**File**: `api/middleware/withAuth.ts`
**Fix**: Check both cookies AND Authorization header
**Why**: Backend only checked cookies, frontend sent headers

---

## Critical Security Issue

**PRIO-SEC-001**: Session stored in localStorage (vulnerable to XSS)
**File**: `src/lib/supabase.ts:33`
**Impact**: HIGH
**Status**: ACTIVE VULNERABILITY
**Fix Required**: Implement httpOnly cookie storage properly

---

## Quick Validation

```bash
# Test auth works
npm run dev
# → Open http://localhost:3000
# → Sign in as demo user
# → Should see main app (not infinite loading)
# → Ideas page should show "no projects" (expected for new users)

# Rollback if needed
git diff HEAD~6                    # view changes
git reset --hard HEAD~6            # rollback all
```

---

## Architecture Notes

**Two Auth Systems Exist**:
- httpOnly cookies (secure, incomplete) - DISABLED
- localStorage (insecure, complete) - ACTIVE

**Auth Flow Must**:
1. Go through `handleAuthSuccess()` (clears cache)
2. Then call `handleAuthUser()` (loads user data)
3. Never bypass the cache clearing step

**Middleware Must**:
- Support both cookie and header auth during migration
- Eventually remove header auth when httpOnly is complete

---

## Next Session Focus

**Primary Goal**: Fix PRIO-SEC-001
**Required**:
1. Add demo user support to httpOnly auth
2. Migrate all auth to httpOnly cookies
3. Remove localStorage auth code
4. Test thoroughly before enabling

**Full Details**: [SESSION_CHECKPOINT_AUTH_BUGS_FIX.md](./SESSION_CHECKPOINT_AUTH_BUGS_FIX.md)

---

*Quick Reference - Full details in session checkpoint*
