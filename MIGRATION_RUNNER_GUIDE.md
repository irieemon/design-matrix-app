# Migration Runner Guide

## Overview

The migration runner script allows you to programmatically execute SQL migrations against your Supabase database without requiring manual access to the Supabase Dashboard.

## Prerequisites

1. **Environment Variables**: Ensure your `.env` file contains:
   ```bash
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Service Role Key**: The service role key must have admin privileges to execute DDL statements (CREATE, ALTER, DROP).

3. **Node.js**: Node.js 14+ with ES modules support.

## Usage

### Basic Usage

Run a migration file:

```bash
node scripts/run-migration.mjs migrations/fix_collaborators_infinite_recursion.sql
```

### Default Migration

If no argument is provided, it defaults to the infinite recursion fix:

```bash
node scripts/run-migration.mjs
```

### Custom Migration

Run any SQL file:

```bash
node scripts/run-migration.mjs path/to/your/migration.sql
```

## How It Works

The script attempts multiple execution methods in order:

1. **`exec_sql` RPC**: Tries the `exec_sql` remote procedure call (used by `api/admin/migrate-database.ts`)
2. **`sql` RPC**: Falls back to the `sql` RPC method (used by `api/admin/enable-realtime-sql.ts`)
3. **Direct Execution**: Last resort, splits SQL into statements and executes individually

## Example Output

```
============================================================
SQL MIGRATION RUNNER
============================================================

============================================================
STEP 1: Load Environment Variables
============================================================

✅ .env file loaded successfully

============================================================
STEP 2: Read Migration File
============================================================

✅ Migration file read: /path/to/migration.sql
[INFO] SQL content (1234 bytes)
{
  "preview": "-- Fix Infinite Recursion in project_collaborators RLS Policy...",
  "fullLength": 1234
}

============================================================
STEP 3: Initialize Supabase Admin Client
============================================================

[INFO] Environment check:
{
  "supabaseUrl": "https://xxx.supabase.co...",
  "serviceRoleKeyLength": 200,
  "keyPrefix": "eyJhbGciOiJIUzI1NiI..."
}
✅ Supabase admin client initialized with service role

============================================================
STEP 4: Execute Migration
============================================================

[INFO] Attempting to execute migration...
[INFO] Trying RPC method: exec_sql
✅ Migration executed successfully via exec_sql

============================================================
STEP 5: Verify Migration
============================================================

✅ Migration verified: Policy exists and was updated

============================================================
MIGRATION COMPLETE
============================================================

✅ Migration applied successfully: /path/to/migration.sql
✅ Execution method: exec_sql

✅ Migration completed successfully!
```

## Troubleshooting

### Error: Missing Environment Variables

**Issue**: `VITE_SUPABASE_URL or SUPABASE_URL environment variable is required`

**Solution**:
1. Create or update `.env` file in project root
2. Add required variables from `.env.example`
3. Ensure variables are not prefixed incorrectly

### Error: RPC Functions Not Available

**Issue**: `No available method to execute SQL migration`

**Solution**:
1. **Enable RPC Functions in Supabase**:
   - Go to Supabase Dashboard → SQL Editor
   - Create the `exec_sql` or `sql` RPC function:

   ```sql
   -- Create exec_sql function for migrations
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

2. **Alternative**: Run SQL manually in Supabase SQL Editor
   - Copy the SQL from the migration file
   - Paste into Supabase Dashboard → SQL Editor
   - Execute manually

### Error: Insufficient Privileges

**Issue**: `permission denied for table project_collaborators`

**Solution**:
1. Verify you're using the **service role key**, not the anon key
2. Check that the service role key is correct and not expired
3. Ensure the service role has admin privileges in Supabase

### Error: Migration File Not Found

**Issue**: `Migration file not found`

**Solution**:
1. Verify the file path is correct
2. Use paths relative to project root: `migrations/file.sql`
3. Or use absolute paths: `/full/path/to/migration.sql`

## Migration File Format

The script expects standard SQL files with:

- **SQL Statements**: Standard DDL/DML SQL
- **Comments**: Lines starting with `--` are stripped
- **Multiple Statements**: Separated by semicolons (`;`)

Example:

```sql
-- Fix Infinite Recursion in RLS Policy
-- Date: 2025-10-03

DROP POLICY IF EXISTS "old_policy" ON public.project_collaborators;

CREATE POLICY "new_policy"
ON public.project_collaborators
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_collaborators.project_id
    AND projects.owner_id = auth.uid()
  )
);

COMMENT ON POLICY "new_policy" ON public.project_collaborators
IS 'Fixed policy description';
```

## Security Notes

1. **Service Role Key**: Never commit the service role key to version control
2. **Environment Files**: Keep `.env` in `.gitignore`
3. **Migration Files**: Review SQL carefully before execution
4. **Backup**: Consider backing up data before running migrations
5. **Testing**: Test migrations on development database first

## Integration with Existing API

The script uses the same patterns as existing admin endpoints:

- **`api/admin/migrate-database.ts`**: Uses `exec_sql` RPC
- **`api/admin/enable-realtime-sql.ts`**: Uses `sql` RPC
- **`src/lib/supabase.ts`**: Admin client configuration

## Advanced Usage

### Programmatic Execution

You can also import and use the functions in Node.js:

```javascript
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, serviceRoleKey);
const sql = readFileSync('migration.sql', 'utf8');

const { data, error } = await supabase.rpc('exec_sql', { sql });
```

### Vercel Deployment

Deploy as an API endpoint for remote execution:

```typescript
// api/admin/run-migration.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { migrationSql, confirm } = req.body;

  if (!confirm) {
    return res.status(400).json({ error: 'Confirmation required' });
  }

  const supabase = createClient(url, serviceRoleKey);
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSql });

  return res.status(200).json({ success: !error, data, error });
}
```

## Next Steps

1. **Run the Migration**: Execute the script to fix the infinite recursion issue
2. **Verify Results**: Check that project_collaborators queries work
3. **Test Application**: Verify the fix resolves the original issue
4. **Document Changes**: Update schema documentation

## Related Files

- **Migration File**: `/migrations/fix_collaborators_infinite_recursion.sql`
- **Runner Script**: `/scripts/run-migration.mjs`
- **Admin API**: `/api/admin/migrate-database.ts`
- **Supabase Client**: `/src/lib/supabase.ts`

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Supabase logs in the Dashboard
3. Verify environment variables are set correctly
4. Test with a simple SELECT query first
5. Try manual execution in Supabase SQL Editor

## References

- [Supabase RPC Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Service Role](https://supabase.com/docs/guides/auth/auth-policies#service-role-key)
- [PostgreSQL RLS Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
