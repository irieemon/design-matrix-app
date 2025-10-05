# Quick Migration Guide

## One-Time Setup (30 seconds)

### 1. Open SQL Editor
```
https://supabase.com/dashboard/project/vfovtgtjailvrphsgafv/sql
```

### 2. Run This Command (It's Ready!)
```bash
node scripts/final-migration-attempt.mjs
```
This will:
- Open the SQL Editor in your browser
- Copy the SQL to your clipboard

### 3. In SQL Editor
1. Click "New Query"
2. Paste (Cmd+V or Ctrl+V)
3. Click "Run"

### 4. Verify
```bash
node scripts/verify-migration.mjs
```

## Expected Output

### Success Looks Like:
```
✅ MIGRATION VERIFIED SUCCESSFULLY!
✓ updated_at column exists
✓ Trigger is functional
✓ Ready for production use
```

### Then Test:
- Open your app
- Go to roadmap view
- Drag/drop a roadmap item
- Should work without errors!

## Need Help?

See full details: `MIGRATION_REPORT.md`

## The SQL (if you need it manually)

Location: `migrations/add_updated_at_to_project_roadmaps.sql`

Or run: `node scripts/final-migration-attempt.mjs`
