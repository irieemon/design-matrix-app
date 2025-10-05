# Enable Demo User Database Persistence

## Overview

This guide enables demo users to create and persist projects/ideas to the Supabase database using anonymous authentication.

**Status:** ✅ Code changes complete, ⚠️ Supabase configuration required

---

## What Was Implemented

### 1. Anonymous Authentication in AuthScreen ✅
**File:** `src/components/auth/AuthScreen.tsx` lines 408-454

Demo user button now:
- Calls `supabase.auth.signInAnonymously()`
- Creates a real Supabase authentication session
- Gets a valid `auth.uid()` for RLS policies
- Returns a user object with real Supabase user ID

**Before:**
```typescript
onClick={() => onAuthSuccess({
  id: 'demo-user-' + Date.now(), // Fake ID
  email: 'demo@example.com',
  ...
})}
```

**After:**
```typescript
onClick={async () => {
  const { data } = await supabase.auth.signInAnonymously()
  onAuthSuccess({
    id: data.user.id,  // Real Supabase user ID
    is_anonymous: true,
    ...
  })
}}
```

### 2. Database Fixes ✅
**Files:**
- `src/components/ProjectStartupFlow.tsx` - Removed local fallback logic
- `src/lib/database.ts` - Improved error messages with specific RLS error codes

### 3. RLS Policy SQL ✅
**File:** `database-enable-anonymous-users.sql`

Updated policies to allow authenticated users (including anonymous) to:
- Create projects with `owner_id = auth.uid()`
- Create ideas in their projects
- View/update/delete their own content

---

## Required Supabase Configuration

### Step 1: Enable Anonymous Authentication

1. **Go to Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/vfovtgtjailvrphsgafv/settings/auth
   ```

2. **Find "Anonymous sign-ins" section**
   - Scroll down to the authentication providers
   - Look for "Anonymous sign-ins" toggle

3. **Enable it:**
   - Toggle ON "Enable anonymous sign-ins"
   - Click "Save" button

4. **Verify:**
   ```bash
   node apply-anonymous-migration.mjs
   ```
   Should show: `✅ Anonymous sign-in SUCCESSFUL!`

---

### Step 2: Apply RLS Policy Changes

1. **Go to SQL Editor:**
   ```
   https://supabase.com/dashboard/project/vfovtgtjailvrphsgafv/sql/new
   ```

2. **Copy the SQL migration:**
   - Open: `database-enable-anonymous-users.sql`
   - Copy entire contents

3. **Paste and run:**
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for success confirmation

4. **Verify policies were created:**
   ```sql
   SELECT tablename, policyname, cmd
   FROM pg_policies
   WHERE tablename IN ('projects', 'ideas')
   ORDER BY tablename, policyname;
   ```

   Expected output:
   ```
   projects | Users can view own projects      | SELECT
   projects | Users can create projects        | INSERT
   projects | Users can update own projects    | UPDATE
   projects | Users can delete own projects    | DELETE
   ideas    | Users can view ideas...          | SELECT
   ideas    | Users can create ideas           | INSERT
   ideas    | Users can update ideas           | UPDATE
   ideas    | Users can delete ideas           | DELETE
   ```

---

## Testing

### Manual Test in Browser

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser:**
   ```
   http://localhost:3003
   ```

3. **Click "Continue as Demo User"**
   - Should see: "🔄 Signing in..."
   - Then load the app

4. **Check browser console:**
   ```
   ✅ Anonymous user signed in: { id: '...', isAnonymous: true }
   ✅ Demo user authenticated successfully with Supabase session
   ```

5. **Create a project with AI:**
   - Click "AI Starter"
   - Fill in project details
   - Generate ideas
   - Click "Create Project"

6. **Verify in database:**
   - Go to Supabase Dashboard > Database > Tables
   - Check `projects` table - should have new project with `owner_id` = anonymous user ID
   - Check `ideas` table - should have AI-generated ideas linked to project

---

### Automated Test with Playwright

```bash
# Restart server with fixes
npm run dev

# Run persistence validation test
npx playwright test tests/database-persistence-demo-user.spec.ts --headed

# Expected result: ✅ PASS
```

**Success criteria:**
- ✅ Demo user signs in successfully
- ✅ Creates project in UI
- ✅ Project found in database
- ✅ Ideas found in database

---

## Database Verification Script

```bash
# Run diagnostic to verify everything works
node database_comprehensive_diagnostic.mjs
```

**Expected output:**
```
STEP 6: TEST AUTHENTICATED USER PROJECT CREATION
✅ Authenticated as: demo@example.com (anonymous)
✅ Project created successfully as authenticated user!
```

---

## Troubleshooting

### Issue: "Anonymous sign-ins are disabled"
**Solution:** Enable anonymous auth in Supabase Dashboard (Step 1 above)

### Issue: "new row violates row-level security policy" (Error 42501)
**Solution:** Apply RLS policy SQL migration (Step 2 above)

### Issue: "Invalid user ID" (Error 23503)
**Solution:**
- User profile might not exist
- Anonymous users don't have profiles in `user_profiles` table
- This is OK - RLS policies work with `auth.uid()` directly

### Issue: Projects show in UI but not in database
**Solution:**
- This was the original bug (already fixed)
- Code no longer creates local fallback projects
- If you see this, restart dev server

---

## Rollback

If anonymous users cause issues, you can:

1. **Disable anonymous auth:**
   - Supabase Dashboard > Settings > Auth
   - Toggle OFF "Enable anonymous sign-ins"

2. **Restore original RLS policies:**
   ```bash
   # Run the original migration
   psql -f database-migration-clean-install-v2.sql
   ```

3. **Remove anonymous sign-in code:**
   ```bash
   git checkout src/components/auth/AuthScreen.tsx
   ```

---

## Security Considerations

### ✅ Safe
- Anonymous users get temporary Supabase sessions
- Each anonymous user gets a unique ID
- RLS policies ensure users only access their own data
- Anonymous sessions expire (default: 7 days)

### ⚠️ Consider
- Anonymous users create orphaned data (no email to contact)
- May want to implement data cleanup for old anonymous users
- Consider limits on anonymous user project creation

### 🔒 Recommended
- Monitor anonymous user activity
- Set up database triggers to clean up old anonymous user data
- Consider requiring email for project export/sharing

---

## Files Modified

| File | Status | Purpose |
|------|--------|---------|
| `src/components/auth/AuthScreen.tsx` | ✅ Modified | Anonymous auth implementation |
| `src/components/ProjectStartupFlow.tsx` | ✅ Modified | Removed fallback logic |
| `src/lib/database.ts` | ✅ Modified | Better error messages |
| `database-enable-anonymous-users.sql` | ✅ Created | RLS policy migration |
| `apply-anonymous-migration.mjs` | ✅ Created | Migration helper script |

---

## Next Steps

1. ✅ **Code changes:** Complete
2. ⏳ **Enable anonymous auth:** Go to Supabase Dashboard
3. ⏳ **Apply RLS policies:** Run SQL migration
4. ⏳ **Test:** Verify demo user can create projects
5. ⏳ **Validate:** Run Playwright tests

**Estimated time:** 10-15 minutes for Supabase configuration

---

## Summary

**What works now:**
- ✅ Real authenticated users can create projects
- ✅ Projects are saved to database (no more fallback)
- ✅ AI-generated ideas are persisted
- ✅ Error messages are helpful

**What's needed:**
- ⚠️ Enable anonymous auth in Supabase (5 minutes)
- ⚠️ Apply RLS policy SQL (5 minutes)

**Then demo users will:**
- ✅ Get real Supabase sessions
- ✅ Have valid `auth.uid()` for RLS
- ✅ Create projects that persist to database
- ✅ See their AI-generated ideas saved
