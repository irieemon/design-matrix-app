# Admin Panel Deployment Fix Instructions

## 🔴 Critical Issues Identified

The admin panel on Vercel deployment has three critical database schema issues:

1. **404 Error**: `ai_token_usage` table does not exist → Token spend tracking fails
2. **400 Error**: `users.last_login` column missing → Active users query fails
3. **500 Errors**: Admin API endpoints fail due to missing database objects

## ✅ Root Cause Analysis

- **Environment Variables**: ✅ All correctly configured on Vercel
- **Build Configuration**: ✅ No blocking build errors
- **Database Schema**: ❌ Missing critical tables and columns
- **RLS Policies**: ⚠️ Need to be created after table creation

## 🔧 Fix Steps

### Step 1: Execute Database Schema Fix

**CRITICAL**: This must be done first before any redeployment.

**⚠️ IMPORTANT: Use FIX_ADMIN_DEPLOYMENT_V2.sql (NOT V1)**

V2 fixes a foreign key reference error that occurred in V1.

1. Open the Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/vfovtgtjailvrphsgafv/sql/new
   ```

2. Copy and paste the contents of `FIX_ADMIN_DEPLOYMENT_V2.sql` (located in project root)

3. Click "Run" to execute all SQL statements

4. Verify success by checking the output messages:
   - ✓ ai_token_usage table created
   - ✓ 6 performance indexes added
   - ✓ RLS policies for admin access
   - ✓ last_login column added to users table

### Step 2: Verify Database Changes

Run these verification queries in Supabase SQL Editor:

```sql
-- Check ai_token_usage table exists
SELECT tablename FROM pg_tables
WHERE tablename = 'ai_token_usage';

-- Check last_login column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'last_login';

-- Test a simple insert (should work)
INSERT INTO ai_token_usage (user_id, endpoint, model, total_tokens, total_cost)
SELECT id, 'test', 'test-model', 0, 0.0
FROM auth.users LIMIT 1;

-- Clean up test data
DELETE FROM ai_token_usage WHERE endpoint = 'test';
```

### Step 3: Redeploy to Vercel

Once database changes are applied:

```bash
# Option 1: Trigger redeploy via Vercel CLI
vercel --prod

# Option 2: Trigger redeploy via Git
git add .
git commit -m "fix: prepare for admin panel database schema deployment"
git push origin main
```

### Step 4: Verify Admin Panel Works

After redeployment completes:

1. Navigate to your Vercel deployment URL
2. Go to `/admin` route
3. Verify all panels load without errors:
   - ✅ Projects list shows data
   - ✅ Analytics dashboard displays metrics
   - ✅ Token spend tracking shows (empty initially, data will populate with usage)
   - ✅ No 404, 400, or 500 errors in browser console

## 🧪 Testing Checklist

- [ ] Supabase SQL executed successfully
- [ ] Verification queries return expected results
- [ ] Vercel redeployment triggered
- [ ] Deployment completed without errors
- [ ] Admin dashboard accessible at `/admin`
- [ ] Projects panel loads projects list
- [ ] Analytics panel shows overview metrics
- [ ] Token spend panel displays (empty or with data)
- [ ] Browser console shows no API errors
- [ ] Network tab shows 200 responses for admin API calls

## 📊 Expected Behavior After Fix

### Admin Dashboard - Projects Panel
- **Before**: 500 error "Server configuration error"
- **After**: List of all projects with metrics (idea count, file count, collaborators)

### Admin Dashboard - Analytics Panel
- **Before**: 500 error "Server configuration error"
- **After**: Overview metrics, time series charts, top users/projects

### Admin Dashboard - Token Spend Panel
- **Before**: 404 error on ai_token_usage table
- **After**: Empty initially, will populate as AI endpoints are called

### Browser Console
- **Before**: Multiple 400/404/500 errors
- **After**: Clean, no error messages

## 🔍 Troubleshooting

### If admin panel still shows errors after fix:

1. **Check Supabase logs**:
   - Go to: https://supabase.com/dashboard/project/vfovtgtjailvrphsgafv/logs/explorer
   - Filter for errors in last 1 hour
   - Look for RLS policy violations or SQL errors

2. **Verify environment variables**:
   ```bash
   vercel env ls
   ```
   - Ensure VITE_SUPABASE_URL is set
   - Ensure SUPABASE_SERVICE_ROLE_KEY is set

3. **Check Vercel deployment logs**:
   ```bash
   vercel logs <deployment-url>
   ```
   - Look for runtime errors
   - Check for environment variable access issues

4. **Test API endpoints directly**:
   ```bash
   curl https://your-vercel-url.vercel.app/api/admin/projects
   ```
   - Should return JSON with projects array
   - Should NOT return 500 error

### If database query still fails:

1. **Verify RLS bypass for service role**:
   ```sql
   -- Service role should bypass RLS
   SELECT * FROM ai_token_usage LIMIT 1;
   ```

2. **Check policy existence**:
   ```sql
   SELECT policyname, cmd FROM pg_policies
   WHERE tablename = 'ai_token_usage';
   ```

## 📝 What Changed

### Database Schema Changes

1. **New Table**: `ai_token_usage`
   - Tracks OpenAI API token consumption
   - Stores user_id, project_id, endpoint, model
   - Records prompt/completion/total tokens
   - Calculates costs (input_cost, output_cost, total_cost)
   - Includes success status and error messages
   - Optimized with 6 performance indexes

2. **Column Addition**: `users.last_login`
   - Type: TIMESTAMPTZ (nullable)
   - Purpose: Track user activity for admin dashboard
   - Indexed for performance on date range queries

### RLS Policies

1. **ai_token_usage** policies:
   - Service role: Full access (bypass RLS)
   - Users: Can view their own usage only

2. **Admin queries**: Use service role key → bypass RLS → see all data

## 🎯 Success Criteria

✅ All API endpoints return 200 status codes
✅ Admin dashboard loads without errors
✅ Projects panel shows all platform projects
✅ Analytics panel displays platform metrics
✅ Token spend panel accessible (empty until AI usage occurs)
✅ Browser console clean (no errors)
✅ Playwright tests pass (after running test suite)

## 🚀 Next Steps After Fix

1. **Monitor token usage**: AI endpoints will start populating ai_token_usage table
2. **Set up admin users**: Use admin RLS policies to grant admin role to specific users
3. **Enable analytics refresh**: admin_user_stats materialized view can be periodically refreshed
4. **Implement admin auth**: Add admin authentication checks to API endpoints (currently TODO)

## 📞 Support

If issues persist after following all steps:

1. Check Supabase project health: https://supabase.com/dashboard/project/vfovtgtjailvrphsgafv
2. Review Vercel deployment status: https://vercel.com/seans-projects-42527963/design-matrix-app
3. Examine browser network tab for specific API errors
4. Check this project's GitHub issues for similar reports
