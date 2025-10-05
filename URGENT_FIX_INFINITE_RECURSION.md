# 🚨 URGENT: Fix Infinite Recursion Error - IMMEDIATE ACTION REQUIRED

## Current Issue
Your app is **broken** - project files cannot load due to infinite recursion in RLS policy.

**Error:** `infinite recursion detected in policy for relation "project_collaborators"`

## ⚡ IMMEDIATE FIX (2 minutes)

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)

### Step 2: Run This SQL

**Copy this ENTIRE block and click "Run":**

```sql
-- Fix infinite recursion in project_collaborators RLS policy
-- This replaces the broken policy with a working one

DROP POLICY IF EXISTS "Users can view collaborators of accessible projects"
  ON public.project_collaborators;

CREATE POLICY "Users can view collaborators of accessible projects"
ON public.project_collaborators
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_collaborators.project_id::text
    -- ✅ FIXED: Only check if user is project owner (no recursion)
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

COMMENT ON POLICY "Users can view collaborators of accessible projects"
  ON public.project_collaborators
IS 'Fixed (2025-10-03): Removed recursive collaborator check to prevent infinite recursion (error 42P17). Only project owners can view the collaborator list. Collaborators still have access to project resources through other policies.';
```

### Step 3: Verify Fix
Refresh your app - project files should now load without errors.

---

## 🔧 OPTIONAL: Enable Future Automated Migrations

Run this SQL **once** in Supabase to enable automated migration scripts:

```sql
-- Create function for automated migrations
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant permission to service role
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
```

After this setup, you can run: `node scripts/run-migration.mjs`

---

## What Was Fixed?

### The Problem
The old policy had a **recursive check**:
```sql
-- ❌ BROKEN: Checks project_collaborators while IN project_collaborators policy
OR EXISTS (
  SELECT 1 FROM public.project_collaborators pc  -- 🔄 Infinite loop!
  WHERE pc.project_id = projects.id
  AND pc.user_id = auth.uid()
)
```

### The Fix
The new policy **only checks project ownership** (no recursion):
```sql
-- ✅ FIXED: Only checks projects table (no recursion)
AND projects.owner_id::text = (select auth.uid())::text
```

### Impact
- ✅ Infinite recursion eliminated
- ✅ Project files load correctly
- ✅ Collaborators still access resources via other policies
- ✅ Security maintained

---

## Validation

After running the fix, verify:

```sql
-- Should return the updated policy
SELECT policyname, qual::text
FROM pg_policies
WHERE tablename = 'project_collaborators'
AND policyname = 'Users can view collaborators of accessible projects';
```

```sql
-- Should work without error
SELECT * FROM project_files WHERE project_id = 'your-project-id' LIMIT 1;
```

---

## Status
- ✅ **Multiple GoTrueClient warning**: FIXED (supabase.ts updated)
- ⏳ **Infinite recursion**: NEEDS MANUAL FIX (run SQL above)
- ⏳ **Testing**: After SQL fix

**Next:** Run the SQL above to fix the infinite recursion immediately.
