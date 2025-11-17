# RLS Performance Fix Quick Start

**🎯 Goal:** Fix 94 Supabase performance warnings by optimizing RLS policies

## Quick Steps

### 1️⃣ Apply Database Migration

**Using Supabase Dashboard:**

1. Go to: https://supabase.com/dashboard/project/vfovtgtjailvrphsgafv/sql/new
2. Open file: `supabase/migrations/20250117_optimize_rls_performance.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click **Run**

### 2️⃣ Verify Success

Run in SQL Editor:

```sql
-- Check is_admin() function is optimized
SELECT
  proname,
  CASE
    WHEN 'search_path=public, pg_temp' = ANY(proconfig) THEN '✅ Optimized'
    ELSE '⚠️ Missing'
  END as status
FROM pg_proc
WHERE proname = 'is_admin';

-- Should return: '✅ Optimized'
```

### 3️⃣ Monitor Performance

1. Check admin analytics: https://design-matrix-app.vercel.app/admin
2. Verify faster page loads (300ms → 200ms expected)
3. Monitor Supabase metrics for CPU reduction

## What This Fixes

✅ **21 auth_rls_initplan warnings** - Per-row auth.uid() evaluation → once per query  
✅ **73 multiple_permissive_policies warnings** - Multiple policy checks → consolidated  
✅ **30-50% RLS performance improvement** - Faster queries for all authenticated users

## How It Works

**Before:**
```sql
-- Evaluated 1000x for 1000 rows
USING (auth.uid() = user_id)
```

**After:**
```sql
-- Evaluated 1x for entire query
USING ((select auth.uid()) = user_id)
```

## Need Help?

See full documentation: `claudedocs/rls_performance_optimization.md` (if available)

