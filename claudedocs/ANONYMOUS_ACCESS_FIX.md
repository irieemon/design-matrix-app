# Anonymous Access Security Fix

**Date**: 2025-10-02
**Priority**: Medium-High (Security Hardening)
**Risk**: Anonymous users can access data if anonymous sign-ins are enabled

---

## Overview

Supabase detected 10 security warnings about anonymous access. This occurs when:
1. Anonymous sign-ins are enabled in Supabase
2. Policies use `TO authenticated` which includes anonymous users
3. Development policies allow unrestricted access

---

## Issue: Anonymous Access (9 warnings)

### Problem

**In Supabase**, when anonymous sign-ins are enabled:
```
authenticated role = logged-in users + anonymous users
```

Current policies:
```sql
-- ❌ Allows anonymous users!
CREATE POLICY "Users can view own projects"
ON projects
FOR SELECT
TO authenticated  -- Includes anonymous users
USING (owner_id = auth.uid());
```

**Risk**: Anonymous users can:
- View data they shouldn't access
- Create/modify records if policies allow
- Bypass intended access controls

### Root Cause

**Development Policies Left Behind**:
1. `project_files`: "Allow all for development" - Allows ANYONE
2. `user_profiles`: `open_profiles_access_v2` - Temporary dev policy
3. Other tables: Use `TO authenticated` without anonymous check

**Anonymous Sign-Ins**:
- When enabled, `auth.uid()` can return a temporary anonymous UUID
- Policies treat anonymous users same as logged-in users
- Need explicit check: `auth.uid() IS NOT NULL`

---

## Solution

### Part 1: Remove Development Policies

```sql
-- Remove overly permissive policies
DROP POLICY "Allow all for development" ON project_files;
DROP POLICY "open_profiles_access_v2" ON user_profiles;
```

### Part 2: Add Anonymous Check to All Policies

**Pattern**:
```sql
-- ❌ Before (allows anonymous)
CREATE POLICY "policy_name"
ON table_name
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- ✅ After (blocks anonymous)
CREATE POLICY "policy_name"
ON table_name
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL  -- Explicit anonymous check
  AND owner_id::text = (select auth.uid())::text
);
```

### Part 3: Create Proper Policies

For tables missing proper RLS:

**project_files**:
- View: Projects you own or collaborate on
- Upload: Projects you own
- Delete: Projects you own

**user_profiles**:
- View: Your own profile + collaborator profiles
- Update: Your own profile only

---

## Tables Fixed (9 tables)

1. **projects** (4 policies)
   - ✅ Added `auth.uid() IS NOT NULL` check
   - Owner-only access for create/update/delete

2. **ideas** (4 policies)
   - ✅ Added `auth.uid() IS NOT NULL` check
   - Project-based access control

3. **project_roadmaps** (4 policies)
   - ✅ Added `auth.uid() IS NOT NULL` check
   - Owner-only for create/update/delete

4. **project_insights** (4 policies)
   - ✅ Added `auth.uid() IS NOT NULL` check
   - Owner-only for create/update/delete

5. **teams** (1 policy)
   - ✅ Added `auth.uid() IS NOT NULL` check
   - Owner-only updates

6. **project_collaborators** (1 policy)
   - ✅ Replaced generic policy with proper access control
   - View collaborators of accessible projects

7. **project_files** (3 NEW policies)
   - ✅ Created proper RLS policies
   - Removed "Allow all for development"

8. **user_profiles** (3 NEW policies)
   - ✅ Created proper RLS policies
   - Removed `open_profiles_access_v2`

9. **storage.objects** (2 policies) ⚠️
   - Listed in warnings but requires separate decision
   - See "Storage Policy Decision" section below

---

## Storage Policy Decision

**Warnings**:
- "Allow authenticated deletes"
- "Allow authenticated downloads"

**Options**:

### Option A: Keep Current (Recommended for most apps)
If you need authenticated users to upload/download files:
```sql
-- Leave storage policies as-is
-- Anonymous users won't have auth.uid() to access anyway
```

### Option B: Tighten Further
If you want explicit non-anonymous check:
```sql
-- Update storage policies to add IS NOT NULL check
-- May require updating storage policy definitions
```

**Recommendation**: Storage policies are usually fine as-is. The `authenticated` role in storage context typically means truly authenticated, not anonymous.

---

## Issue: Vulnerable Postgres Version (1 warning)

### Problem
```
Current version: supabase-postgres-17.4.1.075
Status: Has security patches available
```

### Solution

**Manual Upgrade Required** (Supabase Dashboard):
1. Go to Supabase Dashboard → Settings → General
2. Find "Postgres Version" section
3. Click "Upgrade"
4. Follow prompts (may require brief downtime)

**Important**:
- Backup database before upgrading
- Test in development first if possible
- Upgrade during low-traffic period
- Read [Supabase upgrade guide](https://supabase.com/docs/guides/platform/upgrading)

---

## Migration Application

### Prerequisites
1. Backup your database (Supabase Dashboard → Database → Backups)
2. Test in development environment first
3. Understand your anonymous sign-in requirements

### Apply Migration

```sql
-- Copy contents of migrations/fix_anonymous_access.sql
-- Paste into Supabase SQL Editor
-- Execute
```

### Verify

Check policies were updated:
```sql
-- Should show auth.uid() IS NOT NULL in all policies
SELECT
  schemaname,
  tablename,
  policyname,
  pg_get_expr(qual, 'pg_policy'::regclass::oid) as policy_definition
FROM pg_policies
WHERE schemaname = 'public'
AND policyname LIKE '%Users can%'
ORDER BY tablename, policyname;
```

Expected: All policies should include `auth.uid() IS NOT NULL`

### Test Application

After applying:
1. Test with logged-in user (should work normally)
2. Test with anonymous user if enabled (should be blocked)
3. Verify file uploads/downloads work
4. Check user profile access

---

## Alternative: Disable Anonymous Sign-Ins

If you don't need anonymous users:

### Option 1: Disable in Supabase Dashboard
1. Go to Authentication → Settings
2. Find "Anonymous sign-ins"
3. Toggle OFF
4. Save

**Pros**:
- Simpler security model
- Fewer policy checks needed
- Clearer user tracking

**Cons**:
- Users must sign up/login immediately
- Can't try app anonymously

### Option 2: Keep Anonymous + Apply Migration
1. Keep anonymous sign-ins enabled
2. Apply `fix_anonymous_access.sql`
3. Anonymous users blocked from data access

**Pros**:
- Allow anonymous browsing (custom logic)
- Secure data access
- Flexible architecture

**Cons**:
- More complex policies
- Need explicit anonymous checks

---

## Security Best Practices

### 1. Always Check auth.uid() IS NOT NULL
```sql
-- ✅ Secure pattern
USING (
  auth.uid() IS NOT NULL
  AND owner_id::text = (select auth.uid())::text
)
```

### 2. Remove Development Policies in Production
```sql
-- ❌ Never in production
CREATE POLICY "Allow all for development"
  USING (true);

-- ✅ Always use specific policies
CREATE POLICY "Users can view own data"
  USING (auth.uid() IS NOT NULL AND ...);
```

### 3. Use Principle of Least Privilege
```sql
-- ❌ Too permissive
FOR ALL TO authenticated USING (true);

-- ✅ Specific access
FOR SELECT TO authenticated USING (owner_id = auth.uid());
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
```

### 4. Regular Security Audits
```sql
-- Check for open policies
SELECT * FROM pg_policies
WHERE schemaname = 'public'
AND pg_get_expr(qual, 'pg_policy'::regclass::oid) LIKE '%true%';
```

---

## Expected Results

### Before Migration
- ⚠️ 9 anonymous access warnings
- ⚠️ 1 postgres version warning
- Anonymous users can access data
- Development policies still active

### After Migration
- ✅ 0 anonymous access warnings (or 1 for storage.objects - acceptable)
- ✅ Proper RLS on all tables
- ✅ Anonymous users blocked from data
- ✅ Clean, production-ready security

### After Postgres Upgrade
- ✅ All security warnings resolved
- ✅ Latest security patches applied
- ✅ Production-ready database

---

## Rollback Plan

If issues occur:

```sql
-- Temporarily re-enable open access (EMERGENCY ONLY)
CREATE POLICY "temp_emergency_access" ON public.projects
  FOR ALL TO authenticated USING (true);

-- Then investigate specific policy issues
-- Remove temporary policy once fixed
```

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Postgres Upgrade Guide](https://supabase.com/docs/guides/platform/upgrading)
- Main security guide: [SUPABASE_SECURITY_FIXES.md](SUPABASE_SECURITY_FIXES.md)
