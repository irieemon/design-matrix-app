# Admin Panel Troubleshooting Summary

## 🔍 Investigation Results

### Errors Identified

```
ERROR 1: 404 Not Found
- Endpoint: /rest/v1/ai_token_usage
- Cause: Table does not exist in database
- Impact: Token spend analytics panel fails to load

ERROR 2: 400 Bad Request
- Endpoint: /rest/v1/users?last_login=gte.2025-10-15...
- Cause: Column "last_login" does not exist in users table
- Impact: Active users query fails

ERROR 3: 500 Internal Server Error
- Endpoints: /api/admin/projects, /api/admin/analytics
- Cause: Queries reference non-existent ai_token_usage table
- Impact: Admin dashboard panels fail to load

WARNING: Multiple GoTrueClient instances
- Type: Warning (not critical)
- Cause: Multiple Supabase client initializations
- Impact: Potential undefined behavior, but not blocking
```

### Root Cause Analysis

**✅ What Works:**
- Environment variables correctly configured on Vercel
- Code has no critical TypeScript errors
- Build process completes successfully
- Application works locally (local database has tables)

**❌ What's Broken:**
- Production Supabase database missing `ai_token_usage` table
- Production Supabase database missing `users.last_login` column
- RLS policies don't exist for admin access patterns

**Why It Works Locally:**
- Local database likely has migration files applied
- Development environment may bypass some RLS checks
- Test data includes necessary columns

## 🔧 Fix Implementation

### Files Created

1. **FIX_ADMIN_DEPLOYMENT_V2.sql** (USE THIS VERSION)
   - Creates `ai_token_usage` table with proper schema
   - Fixes foreign key references to avoid "relation not found" errors
   - Adds foreign keys AFTER table creation to handle dependencies
   - Adds 6 performance indexes for query optimization
   - Adds `last_login` column to `users` table
   - Creates RLS policies for service role and users
   - Includes comprehensive verification queries
   - Can be safely re-run (idempotent)

2. **ADMIN_PANEL_FIX_INSTRUCTIONS.md**
   - Comprehensive step-by-step fix guide
   - Troubleshooting section
   - Verification procedures
   - Expected behavior after fix

3. **tests/admin-panel.spec.ts**
   - Playwright E2E tests for admin panel
   - Verifies all error conditions are resolved
   - Tests API endpoint responses
   - Validates console log cleanliness

### Database Changes Required

**New Table: ai_token_usage**
```sql
Columns:
  - id (UUID primary key)
  - user_id (UUID references auth.users)
  - project_id (UUID references projects)
  - endpoint (VARCHAR 100)
  - model (VARCHAR 50)
  - prompt_tokens, completion_tokens, total_tokens (INTEGER)
  - input_cost, output_cost, total_cost (DECIMAL)
  - success (BOOLEAN)
  - error_message (TEXT)
  - response_time_ms (INTEGER)
  - created_at (TIMESTAMPTZ)

Indexes:
  - idx_ai_token_usage_user_id
  - idx_ai_token_usage_created_at
  - idx_ai_token_usage_user_date
  - idx_ai_token_usage_project
  - idx_ai_token_usage_endpoint
  - idx_ai_token_usage_model

RLS Policies:
  - Service role: Full access
  - Users: Can view own usage
```

**Column Addition: users.last_login**
```sql
Type: TIMESTAMPTZ (nullable)
Purpose: Track user activity for analytics
Index: idx_users_last_login
```

## 📋 Fix Checklist

### Pre-Deployment
- [x] Identified all error sources
- [x] Created database schema fix SQL
- [x] Created comprehensive documentation
- [x] Created Playwright test suite
- [x] Verified build configuration
- [x] Confirmed environment variables

### Database Fix (MANUAL STEP REQUIRED)
- [ ] Open Supabase SQL Editor
- [ ] Execute FIX_ADMIN_DEPLOYMENT.sql
- [ ] Verify success messages
- [ ] Confirm tables and columns exist

### Deployment
- [ ] Trigger Vercel deployment: `vercel --prod`
- [ ] Monitor deployment logs
- [ ] Verify deployment completes without errors

### Post-Deployment Verification
- [ ] Navigate to deployed admin panel
- [ ] Verify projects panel loads
- [ ] Verify analytics panel loads
- [ ] Verify token spend panel accessible
- [ ] Check browser console (should be clean)
- [ ] Run Playwright tests: `npx playwright test tests/admin-panel.spec.ts`

## 🧪 Testing Instructions

### Manual Testing
1. Open deployed URL: `https://your-app.vercel.app/admin`
2. Open browser DevTools (F12)
3. Check Console tab - should have no 400/404/500 errors
4. Check Network tab - all `/api/admin/*` calls should return 200
5. Verify all dashboard panels display data or empty states

### Automated Testing
```bash
# Run Playwright tests
npx playwright test tests/admin-panel.spec.ts

# Run with UI
npx playwright test tests/admin-panel.spec.ts --ui

# Run specific test
npx playwright test tests/admin-panel.spec.ts -g "should load admin panel"
```

## 📊 Success Criteria

### API Responses
```
✅ GET /api/admin/projects → 200 OK
✅ GET /api/admin/analytics → 200 OK
✅ GET /rest/v1/ai_token_usage → 200 OK (empty array initially)
✅ GET /rest/v1/users?last_login=gte... → 200 OK
```

### Browser Console
```
✅ No 400 errors (bad request)
✅ No 404 errors (not found)
✅ No 500 errors (server error)
⚠️  Warning about Multiple GoTrueClient (acceptable)
```

### UI State
```
✅ Admin dashboard loads
✅ Projects panel shows list or empty state
✅ Analytics panel shows metrics or zeros
✅ Token spend panel accessible (will be empty initially)
✅ No "Server configuration error" messages
```

## 🔄 Next Steps After Fix

### Immediate
1. Execute database fix in Supabase SQL Editor
2. Deploy to Vercel
3. Verify all panels work
4. Run Playwright tests to confirm

### Future Improvements
1. **Add admin authentication**: API endpoints currently have TODO for auth checks
2. **Populate token usage**: Integrate token tracking in AI endpoints
3. **Create admin users**: Set up proper admin role assignments
4. **Materialized view refresh**: Schedule periodic refresh of admin_user_stats
5. **Fix GoTrueClient warning**: Refactor Supabase client initialization

### Monitoring
1. Watch ai_token_usage table populate as AI features are used
2. Monitor admin dashboard performance
3. Set up alerts for failed admin API calls
4. Track database query performance

## 📞 Troubleshooting Reference

### If admin panel still shows errors:

1. **Verify database fix applied**:
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM pg_tables WHERE tablename = 'ai_token_usage';
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'last_login';
   ```

2. **Check Vercel logs**:
   ```bash
   vercel logs <deployment-url>
   ```

3. **Test API directly**:
   ```bash
   curl https://your-app.vercel.app/api/admin/projects
   ```

4. **Check RLS policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'ai_token_usage';
   ```

### Common Issues

**Issue**: "Server configuration error"
**Cause**: Missing environment variables
**Fix**: Verify `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set on Vercel

**Issue**: 404 on ai_token_usage
**Cause**: SQL not executed or failed
**Fix**: Re-run FIX_ADMIN_DEPLOYMENT.sql

**Issue**: 400 on users query
**Cause**: last_login column not added
**Fix**: Check PART 3 of SQL was executed successfully

## 🎯 Summary

**Problem**: Admin panel fails on Vercel deployment due to missing database schema
**Root Cause**: Migration files not applied to production database
**Solution**: Execute FIX_ADMIN_DEPLOYMENT.sql in Supabase SQL Editor
**Status**: Fix prepared, awaiting manual database update
**Next**: Execute SQL → Deploy → Test → Done ✅
