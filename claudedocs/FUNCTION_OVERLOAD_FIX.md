# Function Overload Fix

**Date**: 2025-10-02
**Issue**: "function name not unique" error when applying search path fix
**Status**: ✅ Fixed

---

## Problem

When running `migrations/fix_function_search_paths.sql`, encountered:

```
ERROR:  42725: function name "public.claim_ownerless_project" is not unique
HINT:  Specify the argument list to select the function unambiguously.
```

## Root Cause

The database has **multiple versions** of the same function with different signatures:
- `claim_ownerless_project(UUID)`
- `claim_ownerless_project(TEXT)`
- Or other signature variations

`CREATE OR REPLACE FUNCTION` cannot determine which one to replace when multiple versions exist.

## Solution

**Drop existing functions before recreating them:**

```sql
-- Drop all possible signature variations
DROP FUNCTION IF EXISTS public.claim_ownerless_project(UUID);
DROP FUNCTION IF EXISTS public.claim_ownerless_project(TEXT);
DROP FUNCTION IF EXISTS public.claim_ownerless_project;

-- Then create the new version
CREATE OR REPLACE FUNCTION public.claim_ownerless_project(project_uuid UUID)
...
```

## Migration Updates

Added `DROP FUNCTION IF EXISTS` statements for all 5 functions:

1. **can_user_access_project**
   - Drop: `(UUID, UUID)`, `(TEXT, TEXT)`, and no-args versions
   - Recreate: `(UUID, UUID)` with search_path fix

2. **get_user_project_role**
   - Drop: `(UUID, UUID)`, `(TEXT, TEXT)`, and no-args versions
   - Recreate: `(UUID, UUID)` with search_path fix

3. **claim_ownerless_project**
   - Drop: `(UUID)`, `(TEXT)`, and no-args versions
   - Recreate: `(UUID)` with search_path fix

4. **handle_new_user**
   - Drop: `()` version
   - Recreate: `()` trigger function with search_path fix

5. **update_updated_at_column**
   - Drop: `()` version
   - Recreate: `()` trigger function with search_path fix

## Safety

- `DROP FUNCTION IF EXISTS` is safe - only drops if function exists
- No data loss - functions are immediately recreated with same logic
- Trigger functions are recreated with identical behavior
- `search_path` security fix is applied during recreation

## Verification

After running the migration, verify functions were recreated:

```sql
-- List all fixed functions
SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments,
  prosecdef AS security_definer
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND proname IN (
  'can_user_access_project',
  'get_user_project_role',
  'claim_ownerless_project',
  'handle_new_user',
  'update_updated_at_column'
);
```

Expected results:
- All 5 functions should be listed
- `security_definer` should be `true` for the first 4
- Correct argument types should be shown

## Apply the Migration

The updated `migrations/fix_function_search_paths.sql` is now ready to run:

1. Open Supabase SQL Editor
2. Copy the complete migration file
3. Execute - should complete without errors ✅

## Reference

- Security overview: [SUPABASE_SECURITY_FIXES.md](SUPABASE_SECURITY_FIXES.md)

## CASCADE Fix Applied

### Issue
```
ERROR: cannot drop function handle_new_user() because other objects depend on it
DETAIL: trigger on_auth_user_created on table auth.users depends on function
HINT: Use DROP ... CASCADE to drop the dependent objects too.
```

### Solution
Updated migration to use `CASCADE` for trigger functions:

**handle_new_user()**:
- `DROP FUNCTION ... CASCADE` removes function + trigger
- Function recreated with search_path fix
- Trigger `on_auth_user_created` recreated on `auth.users`

**update_updated_at_column()**:
- `DROP FUNCTION ... CASCADE` removes function + all triggers
- Function recreated with search_path fix
- Triggers recreated on: `projects`, `ideas`, `project_roadmaps`, `project_insights`

### Migration Flow
1. Drop function with CASCADE (removes triggers)
2. Recreate function with security fix
3. Recreate all dependent triggers
4. Result: Same functionality + security hardening ✅

