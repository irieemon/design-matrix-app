# Session Loss Diagnostics - Production Issue

**Date**: 2025-10-10
**Issue**: Session lost on page refresh with project URL
**Status**: 🔍 **INVESTIGATING PRODUCTION**

---

## 🚨 User Report - Production Environment

**URL**: `https://prioritas.ai/?project=deade958-e26c-4c4b-99d6-8476c326427b`
**Behavior**: Refresh redirects to login screen instead of loading project
**Evidence**: Screenshot shows login page with project URL in address bar

---

## 🔍 Diagnostic Steps

### Step 1: Check Browser Console Errors

**How to Check**:
1. Press F12 to open DevTools
2. Click "Console" tab
3. Look for red error messages
4. Screenshot shows "5 issues" - expand to see details

**What to Look For**:
- ❌ **Supabase authentication errors** (401, 403)
- ❌ **Cookie errors** ("SameSite" warnings)
- ❌ **CORS errors** (cross-origin issues)
- ❌ **Token expired** messages

**Expected if Working**:
```
✅ "Session check result: session found"
✅ "User already signed in: <email>"
✅ No authentication errors
```

---

### Step 2: Check Cookies (Application Tab)

**How to Check**:
1. Press F12 → Application tab
2. Left sidebar → Cookies → `https://prioritas.ai`
3. Look for cookies starting with `sb-`

**What to Look For**:

| Cookie Name | Should Exist | Settings |
|-------------|--------------|----------|
| `sb-<project>-auth-token` | ✅ Yes | HttpOnly, Secure, SameSite=Lax |
| `sb-<project>-auth-token-code-verifier` | ✅ Yes | HttpOnly, Secure |

**If Cookies Missing**:
→ Session is being cleared on refresh (cookie configuration issue)

**If Cookies Present but Login Required**:
→ Token validation failing (Supabase key mismatch or expired token)

---

### Step 3: Check Network Tab - Auth Requests

**How to Check**:
1. Press F12 → Network tab
2. Refresh page
3. Filter by: `auth`
4. Look for requests to Supabase

**What to Look For**:

| Request | Expected Status | If Fails |
|---------|----------------|----------|
| `GET /auth/v1/token?grant_type=refresh_token` | 200 OK | Token refresh failed |
| `GET /rest/v1/` (with auth header) | 200 OK | Invalid token |
| `POST /auth/v1/logout` | Should NOT appear | Session being cleared |

**Red Flags**:
- ❌ 401 Unauthorized responses
- ❌ 403 Forbidden responses
- ❌ Multiple redirect loops
- ❌ CORS errors

---

### Step 4: Verify Vercel Deployment

**How to Check**:
1. Go to: https://vercel.com/dashboard
2. Select project: `design-matrix-app` (or your project name)
3. Click "Deployments" tab
4. Check latest deployment

**What to Look For**:

| Check | Expected | Current Status |
|-------|----------|----------------|
| Latest commit | `bb4a724` | ❓ Check deployment |
| Build status | ✅ Ready | ❓ May still be building |
| Domain | prioritas.ai | ✅ Should match |
| Build time | < 3 min | ❓ Recent push |

**If Deployment is Old**:
→ Phase 1 fixes not deployed yet (wait 3-4 minutes from push time)

**If Deployment Failed**:
→ Check build logs for errors

---

### Step 5: Check Environment Variables in Vercel

**How to Check**:
1. Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Verify Supabase keys are set

**Required Variables**:

| Variable | Value Format | Environment |
|----------|--------------|-------------|
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` | Production |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` | Production |

**Common Mistakes**:
- ❌ Using old JWT format keys (should start with `sb_publishable_` / `sb_secret_`)
- ❌ Missing `VITE_` prefix on frontend variables
- ❌ Keys not enabled for Production environment
- ❌ Typos in Supabase URL

---

## 🐛 Potential Root Causes

### Cause 1: Cookie Domain Configuration ⭐ **MOST LIKELY**

**Problem**: Cookies set for wrong domain or with wrong SameSite policy

**Check**:
```javascript
// In browser console, run:
document.cookie
```

**Expected**:
```
sb-xxxxx-auth-token=...; domain=.prioritas.ai; secure; httponly; samesite=lax
```

**If Wrong**:
- Domain is `prioritas.ai` without leading dot → cookies not shared across subdomains
- SameSite is `Strict` → cookies blocked on navigation
- Missing `Secure` → cookies blocked on HTTPS

**Fix Required**: Update Supabase cookie configuration in project settings

---

### Cause 2: Supabase JWT Secret Mismatch

**Problem**: Vercel has old/wrong Supabase keys

**Symptoms**:
- Cookies exist but login still required
- 401 errors in console
- "Invalid JWT" messages

**Check**:
1. Copy `VITE_SUPABASE_ANON_KEY` from Vercel environment variables
2. Compare to `.env` file locally
3. Check Supabase Dashboard → Settings → API

**If Mismatch**:
→ Update Vercel environment variables with correct keys

---

### Cause 3: Session Storage vs Cookie Mismatch

**Problem**: App using localStorage for auth instead of cookies

**Check**:
```javascript
// In browser console:
localStorage.getItem('supabase.auth.token')
```

**If Returns Value**:
→ App incorrectly using localStorage (should be empty with httpOnly cookies)

**Fix**: Clear localStorage and rely on httpOnly cookies only

---

### Cause 4: CORS Configuration Issue

**Problem**: Vercel domain not whitelisted in Supabase

**Symptoms**:
- CORS errors in console
- "Access-Control-Allow-Origin" errors
- Preflight OPTIONS requests failing

**Fix**:
1. Supabase Dashboard → Authentication → URL Configuration
2. Add: `https://prioritas.ai` to allowed redirect URLs
3. Add: `https://prioritas.ai` to site URL

---

### Cause 5: Token Refresh Failing

**Problem**: Refresh token expired or invalid

**Symptoms**:
- Initial login works
- Refresh causes logout
- No errors in console (silent failure)

**Check Network Tab**:
```
GET /auth/v1/token?grant_type=refresh_token
Response: 401 Unauthorized
```

**Fix**: User needs to log in again (tokens have 1-hour expiry by default)

---

## 📊 Quick Diagnosis Decision Tree

```
Session lost on refresh?
│
├─> Cookies missing in Application tab?
│   ├─> YES → Cookie configuration issue
│   │   └─> Fix: Update Supabase cookie settings
│   │
│   └─> NO (cookies present)
│       ├─> 401 errors in console?
│       │   ├─> YES → Token validation failing
│       │   │   └─> Fix: Verify Supabase keys in Vercel
│       │   │
│       │   └─> NO errors
│       │       ├─> Logout request in Network tab?
│       │       │   ├─> YES → Session being cleared
│       │       │   │   └─> Fix: Check useAuth logout logic
│       │       │   │
│       │       │   └─> NO logout
│       │       │       └─> Token refresh failing
│       │       │           └─> Fix: Check refresh token endpoint
│       │
│       └─> CORS errors in console?
│           └─> YES → Domain whitelist issue
│               └─> Fix: Add domain to Supabase allowed URLs
```

---

## 🔧 Immediate Action Items

### Priority 1: Verify Latest Deployment (5 min)
1. Check Vercel dashboard for commit `bb4a724`
2. Ensure deployment status is "Ready"
3. If still building, wait for completion

### Priority 2: Check Console Errors (2 min)
1. Press F12 → Console tab
2. Expand the "5 issues" shown in screenshot
3. Look for authentication-related errors
4. Screenshot any error messages

### Priority 3: Inspect Cookies (3 min)
1. Press F12 → Application → Cookies
2. Look for `sb-` prefixed cookies
3. Check `Domain`, `Secure`, `HttpOnly`, `SameSite` settings
4. Screenshot cookie configuration

### Priority 4: Check Network Requests (5 min)
1. Press F12 → Network tab
2. Clear (🚫 icon)
3. Refresh page
4. Filter by "auth"
5. Look for 401/403 responses
6. Screenshot any failed requests

---

## 🎯 Expected Behavior vs Actual

### Expected (After Phase 1 Fix)
```
1. User visits: /?project=xxx
2. Page loads with loading screen: "Loading your project..."
3. Auth check: Session found in cookies ✅
4. Project loads: Within 8 seconds
5. User sees: Project matrix with data
```

### Actual (Current Issue)
```
1. User visits: /?project=xxx
2. Page loads with loading screen
3. Auth check: Session NOT found ❌
4. Redirect to: Login screen
5. User sees: "Welcome Back" login form
```

**Gap**: Session is not persisting between page loads

---

## 📝 Information Needed from User

Please provide the following screenshots/information:

1. **Console Tab Errors**:
   - Expand the "5 issues" in console
   - Screenshot any red errors

2. **Application → Cookies**:
   - Show all cookies for prioritas.ai
   - Especially those starting with `sb-`

3. **Network Tab**:
   - Filter by "auth"
   - Show any failed requests (red)

4. **Vercel Deployment**:
   - Latest deployment commit hash
   - Deployment status (Building/Ready)

5. **Test Scenario**:
   - Were you logged in before refreshing?
   - Or is this a fresh browser session?

---

## 🔗 Related Files

- `src/hooks/useAuth.ts` - Session checking logic
- `src/lib/supabase.ts` - Supabase client configuration
- `src/components/app/AuthenticationFlow.tsx` - Login/loading screen
- Vercel environment variables - Supabase keys

---

**Next Step**: User provides console errors and cookie information for precise diagnosis
