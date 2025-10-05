# Root Cause Analysis: Infinite Recursion in project_collaborators Policy

**Date**: 2025-10-03
**Status**: 🔴 CRITICAL - System Breaking
**Error Code**: 42P17
**Impact**: Cannot fetch project_files, blocks core functionality

---

## Error Details

### Symptom
```
GET /rest/v1/project_files?select=*&project_id=eq.{id}&order=created_at.desc
→ HTTP 500
→ {code: '42P17', message: 'infinite recursion detected in policy for relation "project_collaborators"'}
```

### Affected Operations
- Fetching project_files (primary failure)
- Any query that checks collaborator access
- All related resources using the collaborator check

---

## Root Cause Identified

### The Problematic Policy

**File**: `/migrations/fix_anonymous_access.sql` (lines 269-290)

```sql
CREATE POLICY "Users can view collaborators of accessible projects"
ON public.project_collaborators
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_collaborators.project_id::text
    AND (
      projects.owner_id::text = (select auth.uid())::text
      OR EXISTS (
        -- 🔴 RECURSION HERE 🔴
        SELECT 1 FROM public.project_collaborators pc
        WHERE pc.project_id::text = projects.id::text
        AND pc.user_id::text = (select auth.uid())::text
      )
    )
  )
);
```

### Why It's Recursive

**The Circular Logic**:
1. User queries `project_files` table
2. `project_files` policy checks if user has access via `project_collaborators` table
3. Accessing `project_collaborators` triggers its RLS policy
4. `project_collaborators` policy checks access by... querying `project_collaborators` again
5. **Infinite loop** → PostgreSQL detects recursion → Error 42P17

**Visual Representation**:
```
project_files query
    ↓
Check: EXISTS (SELECT FROM project_collaborators WHERE ...)
    ↓
project_collaborators RLS policy activated
    ↓
Check: EXISTS (SELECT FROM project_collaborators pc WHERE ...)
    ↓
project_collaborators RLS policy activated AGAIN
    ↓
Check: EXISTS (SELECT FROM project_collaborators pc WHERE ...)
    ↓
♾️ INFINITE RECURSION DETECTED
```

---

## Table Relationship Analysis

### project_files Table Policy
**File**: `/migrations/fix_anonymous_access.sql` (lines 292-314)

```sql
CREATE POLICY "Users can view files in accessible projects"
ON public.project_files
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_files.project_id::text
    AND (
      projects.owner_id::text = (select auth.uid())::text
      OR projects.visibility = 'public'
      OR EXISTS (
        -- This references project_collaborators
        SELECT 1 FROM public.project_collaborators
        WHERE project_collaborators.project_id::text = projects.id::text
        AND project_collaborators.user_id::text = (select auth.uid())::text
      )
    )
  )
);
```

### The Recursion Chain

```
Query: SELECT * FROM project_files WHERE project_id = 'abc123'
    ↓
RLS Check: Is user allowed to view these files?
    ↓
Check 1: projects.owner_id = auth.uid() [✅ OK]
Check 2: projects.visibility = 'public' [✅ OK]
Check 3: EXISTS (SELECT FROM project_collaborators WHERE ...) [🔴 TRIGGERS RECURSION]
    ↓
project_collaborators RLS Check: Is user allowed to view collaborators?
    ↓
Check: EXISTS (SELECT FROM project_collaborators pc WHERE ...) [♾️ RECURSION]
```

---

## Why This Policy Logic Is Flawed

### The Intent (What It Tried To Do)
The policy wanted to say: "Users can view collaborators if they either:
1. Own the project, OR
2. Are themselves a collaborator on that project"

### The Implementation Problem
The policy checks "are they a collaborator" by **querying the same table it's protecting**, creating a chicken-and-egg problem:
- To know if you can read `project_collaborators`, you must check `project_collaborators`
- To check `project_collaborators`, you must be able to read `project_collaborators`
- **Circular dependency → Infinite recursion**

---

## Correct Policy Logic

### The Fix
**Remove the recursive collaborator check** - it's unnecessary and logically flawed.

#### Option 1: Owner-Only Access (Simplest, Most Secure)
```sql
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
    AND projects.owner_id::text = (select auth.uid())::text
  )
);
```

**Why This Works**:
- Only project owners can view the collaborator list
- No recursion (only checks `projects` table)
- Collaborators can still access project resources through other policies
- Clean separation of concerns

#### Option 2: SECURITY DEFINER Function (Advanced)
Create a helper function that bypasses RLS:

```sql
-- Helper function to check if user is a collaborator (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_project_collaborator(
  project_uuid TEXT,
  user_uuid TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id::text = project_uuid
    AND user_id::text = user_uuid
  );
$$;

-- Updated policy using the helper function
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
    AND (
      projects.owner_id::text = (select auth.uid())::text
      OR public.is_project_collaborator(
        projects.id::text,
        (select auth.uid())::text
      )
    )
  )
);
```

**Why This Works**:
- `SECURITY DEFINER` allows the function to bypass RLS policies
- Function executes with creator's privileges, not caller's
- Breaks the recursion cycle by providing a non-RLS path to check collaborator status
- More permissive: collaborators can see other collaborators

---

## Recommended Fix (Step-by-Step)

### Step 1: Create Migration File
Create: `/migrations/fix_collaborators_infinite_recursion.sql`

```sql
-- Fix Infinite Recursion in project_collaborators RLS Policy
-- Date: 2025-10-03
-- Issue: Policy recursively queries itself, causing PostgreSQL error 42P17

-- ============================================================================
-- OPTION 1: Simplest Fix - Owner-Only Access (RECOMMENDED)
-- ============================================================================

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
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

COMMENT ON POLICY "Users can view collaborators of accessible projects"
  ON public.project_collaborators
IS 'Fixed: Removed recursive collaborator check to prevent infinite recursion. Only project owners can view collaborator list.';

-- ============================================================================
-- If you need collaborators to see each other, use OPTION 2 below instead
-- ============================================================================

/*
-- OPTION 2: Collaborators Can See Each Other (More Complex)

-- Create helper function to check collaborator status without RLS
CREATE OR REPLACE FUNCTION public.is_project_collaborator(
  project_uuid TEXT,
  user_uuid TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id::text = project_uuid
    AND user_id::text = user_uuid
  );
$$;

COMMENT ON FUNCTION public.is_project_collaborator
IS 'Helper function to check collaborator status without triggering RLS recursion. Uses SECURITY DEFINER to bypass RLS.';

-- Updated policy using helper function
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
    AND (
      projects.owner_id::text = (select auth.uid())::text
      OR public.is_project_collaborator(
        projects.id::text,
        (select auth.uid())::text
      )
    )
  )
);

COMMENT ON POLICY "Users can view collaborators of accessible projects"
  ON public.project_collaborators
IS 'Fixed: Uses SECURITY DEFINER function to prevent infinite recursion. Project owners and collaborators can view collaborator list.';
*/
```

### Step 2: Apply Migration
1. Open Supabase Dashboard → SQL Editor
2. Copy the migration content
3. Choose **Option 1** (recommended) or uncomment **Option 2** if needed
4. Execute the migration
5. Verify no errors

### Step 3: Test
```bash
# Test project_files query
curl -X GET 'https://your-project.supabase.co/rest/v1/project_files?select=*&project_id=eq.{id}' \
  -H "apikey: {your-key}" \
  -H "Authorization: Bearer {user-token}"

# Should return 200 OK with file list
```

### Step 4: Verify Policy
```sql
-- Check that policy exists and is not recursive
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'project_collaborators';
```

---

## Prevention Guidelines

### Rule 1: Never Query The Same Table In Its Own RLS Policy
❌ **Bad**:
```sql
CREATE POLICY on table_a USING (
  EXISTS (SELECT FROM table_a WHERE ...)  -- Recursion!
);
```

✅ **Good**:
```sql
CREATE POLICY on table_a USING (
  EXISTS (SELECT FROM table_b WHERE ...)  -- Different table
);
```

### Rule 2: Use SECURITY DEFINER Functions For Complex Checks
When you need to reference the same table:
```sql
CREATE FUNCTION check_access()
SECURITY DEFINER  -- Bypasses RLS
AS $$ ... $$;

CREATE POLICY USING (check_access());
```

### Rule 3: Keep Policies Simple
- Each policy should check **external conditions**
- Avoid nested `EXISTS` queries on the same table
- Prefer function-based access checks for complex logic

### Rule 4: Test Policies In Isolation
```sql
-- Test policy logic without RLS first
SET row_security = OFF;
-- Run your query
-- Verify logic is correct
SET row_security = ON;
-- Now test with RLS enabled
```

---

## Impact Assessment

### Before Fix
- ❌ Cannot fetch `project_files`
- ❌ All collaborator-based access checks fail
- ❌ Multiple API endpoints broken
- ❌ User experience severely degraded

### After Fix (Option 1)
- ✅ `project_files` queries work
- ✅ Project owners can manage collaborators
- ✅ Collaborators can access project resources
- ⚠️ Collaborators cannot see other collaborators (acceptable trade-off)

### After Fix (Option 2)
- ✅ `project_files` queries work
- ✅ Project owners can manage collaborators
- ✅ Collaborators can access project resources
- ✅ Collaborators can see other collaborators
- ⚠️ Slightly more complex (SECURITY DEFINER function)

---

## Related Files

### Files Modified
- `/migrations/fix_anonymous_access.sql` (contains the bug)

### Files To Create
- `/migrations/fix_collaborators_infinite_recursion.sql` (the fix)

### Files Referencing This Pattern
Search for other recursive patterns:
```bash
grep -r "FROM public.project_collaborators" migrations/*.sql | \
  grep -v "-- "
```

---

## Verification Checklist

After applying the fix:

- [ ] Migration runs without errors
- [ ] `project_files` query returns 200 OK
- [ ] Project owners can view collaborators
- [ ] Collaborators can access project resources
- [ ] No PostgreSQL error 42P17 in logs
- [ ] All related policies work correctly

---

## Additional Notes

### Why PostgreSQL Detects This
PostgreSQL's query planner detects circular dependencies during policy evaluation. When evaluating RLS policies:
1. It builds a dependency graph of table accesses
2. Detects cycles in the graph
3. Raises error 42P17 to prevent infinite loops

### Performance Considerations
- **Option 1** is fastest (simple EXISTS check)
- **Option 2** adds function call overhead (minimal, ~0.1ms)
- Both are better than the broken policy (which never completes)

### Security Implications
- **Option 1**: More restrictive, only owners see collaborators
- **Option 2**: More permissive, collaborators see each other
- Choose based on your application's privacy requirements

---

## Summary

**Root Cause**: `project_collaborators` RLS policy recursively queries itself

**Fix**: Remove recursive check or use SECURITY DEFINER function

**Recommended**: Option 1 (owner-only access) for simplicity and security

**Priority**: 🔴 CRITICAL - Apply immediately to restore functionality
