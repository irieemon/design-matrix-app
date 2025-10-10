# Service Role Key Rotation Guide

## CRITICAL Security Procedure

The `SUPABASE_SERVICE_ROLE_KEY` was previously exposed to the frontend browser bundle (CVSS 9.8 vulnerability). After removing it from frontend code, the key **MUST** be rotated immediately to invalidate any compromised copies.

## Rotation Steps

### 1. Generate New Service Role Key

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to your project: `design-matrix-app`
3. Go to **Settings** → **API**
4. Under **Project API keys**, find the **service_role** key section
5. Click **"Regenerate key"** or **"Create new key"**
6. **Copy the new key immediately** - it will only be shown once

### 2. Update Backend Environment Variables

#### For Vercel Deployment:
```bash
# Update environment variable in Vercel dashboard
# Settings → Environment Variables → Edit SUPABASE_SERVICE_ROLE_KEY

# OR use Vercel CLI:
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste new key when prompted

# Redeploy to apply:
vercel --prod
```

#### For Local Development:
```bash
# Update .env file (NEVER commit this!)
# Replace the value of SUPABASE_SERVICE_ROLE_KEY with new key
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... (new key)
```

### 3. Verify Backend API Endpoints

Test that backend API endpoints still work with the new key:

```bash
# Test authenticated ideas endpoint
curl http://localhost:3003/api/ideas?projectId=YOUR_PROJECT_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Should return 200 with ideas data
```

### 4. Revoke Old Service Role Key

1. Return to **Supabase Dashboard** → **Settings** → **API**
2. Find the **old service_role key** (if still listed)
3. Click **"Revoke"** or **"Delete"** to invalidate it permanently
4. Confirm revocation

### 5. Verify RLS Enforcement

Check that Row-Level Security policies are being enforced:

```bash
# This should FAIL (no service key in frontend anymore):
# Open browser console on http://localhost:3003
# Try to access ideas directly via supabase client

# This should SUCCEED (authenticated client with RLS):
# Login to the application
# Navigate to a project
# Ideas should load correctly
```

Expected behavior:
- ✅ Frontend uses **anon key** with authenticated user session (RLS enforced)
- ✅ Backend APIs use **service key** for admin operations (RLS bypassed when needed)
- ❌ Frontend **NEVER** has access to service key

### 6. Security Validation Checklist

After rotation, verify:

- [ ] `VITE_SUPABASE_SERVICE_ROLE_KEY` is **NOT** in `.env` file
- [ ] `VITE_SUPABASE_SERVICE_ROLE_KEY` is **NOT** in `vite.config.ts`
- [ ] `supabaseAdmin` is **NOT** exported from `src/lib/supabase.ts`
- [ ] All frontend code uses `supabase` (authenticated anon client)
- [ ] All backend API routes use `SUPABASE_SERVICE_ROLE_KEY` from environment
- [ ] Browser DevTools Network tab shows **NO** service key in requests
- [ ] Browser DevTools Sources tab shows **NO** service key in bundle

### 7. Search for Exposed Keys

Run these commands to verify no service key remains in frontend code:

```bash
# Check for VITE_ prefixed service key
grep -r "VITE_SUPABASE_SERVICE_ROLE_KEY" src/
# Should return: NO MATCHES

# Check for supabaseAdmin client
grep -r "supabaseAdmin" src/
# Should return: Only deprecation comments in adminService.ts

# Check built bundle (if exists)
grep -r "service_role" dist/
# Should return: NO MATCHES (after rotation)
```

## Emergency Revocation

If you suspect the service key is compromised:

1. **Immediately** revoke the key in Supabase Dashboard
2. Generate a new service key
3. Update all backend deployments
4. Verify frontend has **NO** service key references
5. Monitor database logs for unauthorized access

## Why This Matters

**Before Fix (CRITICAL VULNERABILITY):**
- Service key was exposed in browser JavaScript bundle
- Any user could bypass ALL Row-Level Security policies
- Complete database access without authentication
- Read/write/delete ANY user's data

**After Fix (SECURE):**
- Service key is **backend-only** (never sent to browser)
- Frontend uses authenticated anon key with RLS enforcement
- Users can only access their own data via RLS policies
- Admin operations go through secure backend API routes

## Post-Rotation Testing

### Frontend Testing:
1. Login to application
2. Create a new idea
3. Edit an existing idea
4. Delete an idea
5. Drag/drop to reposition idea
6. Check that all operations work correctly

### Backend Testing:
1. Test `/api/ideas` endpoint (should work with auth token)
2. Test `/api/admin/*` endpoints (should work for admins only)
3. Verify RLS policies prevent cross-user data access
4. Check database logs for any unauthorized access attempts

## Additional Security Measures

After key rotation, consider:

1. **Enable Supabase audit logs** to monitor service key usage
2. **Rotate keys regularly** (every 90 days recommended)
3. **Use separate service keys** for dev/staging/production
4. **Monitor for exposed secrets** using GitHub secret scanning
5. **Review RLS policies** to ensure proper access control

## References

- [Supabase API Keys Documentation](https://supabase.com/docs/guides/api/api-keys)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10 - Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)

---

**Last Updated:** 2025-10-10
**Security Fix Version:** v1.0
**Completed By:** Claude Code (Security Audit)
