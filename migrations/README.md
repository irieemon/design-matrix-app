# Database Migrations

This directory contains SQL migration files for database schema and policy updates.

## Current Migration

**File**: `fix_collaborators_infinite_recursion.sql`

**Issue**: PostgreSQL error 42P17 - Infinite recursion in RLS policy for `project_collaborators` table

**Fix**: Removes recursive collaborator check from the policy to prevent infinite loop

## How to Run Migrations

You have **three options** for running migrations, from easiest to most control:

### Option 1: Automated Setup Script (Recommended for First-Time)

```bash
node scripts/setup-and-run-migration.mjs
```

**What it does**:
- Checks if RPC functions exist
- Attempts automated execution
- If automation fails, provides clear manual instructions with copy-paste SQL

**Best for**: First-time migration or when you don't have RPC functions set up

---

### Option 2: Direct Migration Script (After RPC Setup)

```bash
node scripts/run-migration.mjs migrations/fix_collaborators_infinite_recursion.sql
```

**What it does**:
- Requires `exec_sql` or `sql` RPC function to exist
- Executes migration directly via Supabase service role
- Provides detailed execution logs

**Best for**: After you've run the one-time RPC setup

---

### Option 3: API Endpoint (For Deployed Apps)

```bash
# Local development
node scripts/run-migration-via-api.mjs

# Dry run to preview SQL
node scripts/run-migration-via-api.mjs --dry-run

# Production (via HTTP)
curl -X POST https://your-app.vercel.app/api/admin/run-migration \
  -H "Content-Type: application/json" \
  -d '{"migrationFile": "fix_collaborators_infinite_recursion.sql", "confirm": true}'
```

**What it does**:
- Calls `/api/admin/run-migration` HTTP endpoint
- Executes via Vercel serverless function
- Good for remote deployment scenarios

**Best for**: Production deployments or CI/CD pipelines

---

### Option 4: Manual Execution (Failsafe)

If all automated methods fail, run the SQL manually:

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to: **SQL Editor**
3. Copy the SQL from `migrations/fix_collaborators_infinite_recursion.sql`
4. Paste and click **Run**

**Best for**: When automation isn't available or troubleshooting

---

## One-Time RPC Setup (Enables Automation)

To enable automated migrations, run this SQL **once** in Supabase SQL Editor:

```sql
-- Create exec_sql function for automated migrations
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
```

After running this setup, you can use automated scripts (Options 1, 2, and 3).

---

## Migration File Structure

All migration files should follow this structure:

```sql
-- Migration Description
-- Date: YYYY-MM-DD
-- Issue: Brief description of the problem
-- Fix: Brief description of the solution

-- SQL statements here
DROP POLICY IF EXISTS "policy_name" ON table_name;

CREATE POLICY "policy_name"
ON table_name
FOR SELECT
TO authenticated
USING (condition);

COMMENT ON POLICY "policy_name" ON table_name
IS 'Documentation of the fix';
```

---

## Verification

After running any migration, verify success:

```sql
-- Check if policy exists
SELECT policyname, cmd, qual::text as condition
FROM pg_policies
WHERE tablename = 'project_collaborators'
AND policyname = 'Users can view collaborators of accessible projects';

-- Test query (should work without infinite recursion error)
SELECT * FROM project_files WHERE project_id = 'your-project-id' LIMIT 1;

-- Verify RLS is still enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('project_collaborators', 'project_files');
```

---

## Troubleshooting

### Error: "Could not find the function exec_sql"

**Solution**: Run the one-time RPC setup SQL above, or use Option 1 (setup script) which provides instructions.

### Error: "Missing SUPABASE_SERVICE_ROLE_KEY"

**Solution**: Add `SUPABASE_SERVICE_ROLE_KEY` to your `.env` file. Get it from Supabase Dashboard → Settings → API → service_role key.

### Error: "Migration file not found"

**Solution**: Ensure you're running scripts from the project root directory, or use absolute paths.

### Migration Executes But Doesn't Fix Issue

**Solution**:
1. Check Supabase logs for errors
2. Verify RLS is enabled on the table
3. Test queries with service role vs. authenticated role
4. Review policy conditions for correctness

---

## Security Notes

- **Service Role Key**: Never commit to version control
- **Environment Variables**: Keep `.env` in `.gitignore`
- **Migration Review**: Always review SQL before execution
- **Backup**: Consider backing up before running migrations
- **Testing**: Test on development database first

---

## Related Files

- **Migration Scripts**:
  - `/scripts/run-migration.mjs` - Direct execution
  - `/scripts/setup-and-run-migration.mjs` - Automated setup
  - `/scripts/run-migration-via-api.mjs` - API client

- **API Endpoints**:
  - `/api/admin/run-migration.ts` - Migration API
  - `/api/admin/migrate-database.ts` - Legacy migration endpoint

- **Documentation**:
  - `/MIGRATION_RUNNER_GUIDE.md` - Detailed guide

- **Supabase Client**:
  - `/src/lib/supabase.ts` - Admin client setup

---

## Quick Start (TL;DR)

For the infinite recursion fix:

```bash
# 1. Easiest - automated with fallback to manual instructions
node scripts/setup-and-run-migration.mjs

# 2. After one-time setup - direct execution
node scripts/run-migration.mjs

# 3. Manual fallback - copy SQL and run in Supabase Dashboard
```

Choose Option 1 if you're not sure which to use.
