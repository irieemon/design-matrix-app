# Migration Quick Start

## Fix Infinite Recursion in RLS Policy - 3 Simple Steps

### Step 1: Choose Your Method

#### 🔥 **EASIEST** - Automated Setup (Recommended First-Time)
```bash
node scripts/setup-and-run-migration.mjs
```

**Result**: Either executes automatically OR provides copy-paste SQL with instructions

---

#### ⚡ **FASTEST** - Direct Execution (After RPC Setup)
```bash
node scripts/run-migration.mjs
```

**Requires**: One-time RPC setup (provided by easiest method)

---

#### 🌐 **API METHOD** - Remote Execution
```bash
node scripts/run-migration-via-api.mjs
```

**Best for**: Production deployments, CI/CD pipelines

---

#### 📋 **MANUAL** - Copy and Paste
1. Open [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
2. Copy SQL from `/migrations/fix_collaborators_infinite_recursion.sql`
3. Paste and click Run

**Best for**: When automation fails or troubleshooting

---

### Step 2: Verify Success

Run this query in Supabase SQL Editor:

```sql
-- Should return without errors
SELECT * FROM project_files WHERE project_id = 'your-project-id' LIMIT 1;
```

**Success indicators**:
- ✅ No "infinite recursion" error (42P17)
- ✅ Query completes successfully
- ✅ Data returns correctly

---

### Step 3: Enable Future Automation (Optional)

To make future migrations fully automated, run this **once** in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
```

**After this**: All migration scripts work automatically.

---

## Troubleshooting

### Problem: "Missing SUPABASE_SERVICE_ROLE_KEY"

**Fix**: Add to `.env`:
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get from: Supabase Dashboard → Settings → API → service_role key

---

### Problem: "Could not find function exec_sql"

**Fix**: Use the **EASIEST** method - it provides manual instructions

---

### Problem: Migration runs but issue persists

**Fix**:
1. Check Supabase logs for errors
2. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'project_collaborators';`
3. Try manual execution method

---

## What This Migration Does

**Problem**: Infinite recursion error when querying `project_files`

**Root Cause**: RLS policy on `project_collaborators` checks if user is a collaborator by querying `project_collaborators`, creating infinite loop

**Fix**: Updated policy to only check if user is the project owner (no recursive query)

**Impact**:
- ✅ Fixes infinite recursion
- ✅ Project owners can still see collaborators
- ✅ Collaborators can still access project resources via other policies
- ✅ No security degradation

---

## Full Documentation

- **Quick Start**: `/migrations/README.md`
- **Detailed Guide**: `/MIGRATION_RUNNER_GUIDE.md`
- **Implementation Details**: `/MIGRATION_IMPLEMENTATION_SUMMARY.md`

---

## TL;DR

```bash
# Just run this:
node scripts/setup-and-run-migration.mjs

# Follow the instructions it provides
# Verify with test query in Supabase
# Done! ✅
```

That's it. The script handles everything else.
