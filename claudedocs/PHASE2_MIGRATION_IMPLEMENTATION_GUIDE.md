# Phase 2: New Supabase API Key Format Migration - Implementation Guide

**Migration Date**: 2025-10-10
**Status**: 🟢 Ready to Execute (New keys available as of September 2025)
**Estimated Duration**: 30-45 minutes
**Risk Level**: Low (backward compatible migration)

---

## 📋 Executive Summary

This guide provides step-by-step instructions for migrating from legacy Supabase API keys to the new format:

**Legacy Keys** → **New Keys**
- `anon` key → `sb_publishable_*`
- `service_role` key → `sb_secret_*`

**Key Benefits:**
- ✅ Improved security with better rotation capabilities
- ✅ Clearer naming convention (less confusion)
- ✅ Foundation for future asymmetric JWT support
- ✅ Better secret scanning by security tools

**Important**: This is a **drop-in replacement**. No code changes required - just environment variable updates!

---

## ⏰ Timeline & Deadlines

| Date | Milestone | Status |
|------|-----------|--------|
| June 2025 | Early preview launched | ✅ Complete |
| July 2025 | Full feature launch | ✅ Complete |
| **October 2025** | **Today - Recommended migration window** | 🟢 **Current** |
| November 2025 | Monthly migration reminders begin | ⏳ Upcoming |
| November 2025 | New projects won't get legacy keys | ⏳ Upcoming |
| Late 2026 (TBD) | Legacy keys deleted | ⚠️ Deadline |

**Recommendation**: Migrate now to stay ahead of the deprecation timeline.

---

## 🎯 Migration Stages

### Stage 1: Key Generation (15 minutes)

#### Step 1.1: Access Supabase Dashboard

1. Open browser and navigate to: https://supabase.com/dashboard
2. Sign in with your account credentials
3. Select project: **design-matrix-app**

#### Step 1.2: Navigate to API Settings

1. Click on **Settings** (gear icon) in the left sidebar
2. Click on **API** in the settings menu
3. You should see a section titled "Project API keys"

#### Step 1.3: Generate New Publishable Key

1. Look for the **"Generate new publishable key"** button or section
2. Click to generate a new `sb_publishable_*` key
3. **CRITICAL**: Copy the key immediately - it may only be shown once
4. Temporarily save it in a secure location (password manager or secure note)

**Expected Format**: `sb_publishable_<project_ref>_<random_string>`

**Example** (not real):
```
sb_publishable_vfovtgtjailvrphsgafv_a1b2c3d4e5f6g7h8i9j0
```

#### Step 1.4: Generate New Secret Key

1. Look for the **"Generate new secret key"** button or section
2. Click to generate a new `sb_secret_*` key
3. **CRITICAL**: Copy the key immediately - it will only be shown once
4. Temporarily save it in a secure location

**Expected Format**: `sb_secret_<project_ref>_<random_string>`

**Example** (not real):
```
sb_secret_vfovtgtjailvrphsgafv_x9y8z7w6v5u4t3s2r1q0
```

#### Step 1.5: Verify Key Generation

**Checklist**:
- [ ] New publishable key starts with `sb_publishable_`
- [ ] New secret key starts with `sb_secret_`
- [ ] Both keys are saved securely
- [ ] Legacy keys are still visible (for rollback if needed)

---

### Stage 2: Local Development Update (10 minutes)

#### Step 2.1: Backup Current .env File

```bash
# Create backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Verify backup
ls -la .env.backup.*
```

#### Step 2.2: Update .env File

Open `.env` in your editor and update the following variables:

**Before:**
```bash
VITE_SUPABASE_URL=https://vfovtgtjailvrphsgafv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**After:**
```bash
VITE_SUPABASE_URL=https://vfovtgtjailvrphsgafv.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_vfovtgtjailvrphsgafv_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_vfovtgtjailvrphsgafv_...

# Legacy keys (keep for rollback)
# LEGACY_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# LEGACY_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**:
- Replace the old JWT keys with the new `sb_publishable_*` and `sb_secret_*` keys
- Comment out (don't delete) the old keys for emergency rollback
- Keep `VITE_SUPABASE_URL` unchanged

#### Step 2.3: Verify .env File

```bash
# Check new keys are present
grep "^VITE_SUPABASE_ANON_KEY=sb_publishable_" .env
grep "^SUPABASE_SERVICE_ROLE_KEY=sb_secret_" .env

# Should see both keys with new prefixes
```

#### Step 2.4: Restart Development Server

```bash
# Stop current dev server (Ctrl+C if running)

# Start dev server with new keys
npm run dev
```

**Expected Output**:
```
VITE v5.4.20  ready in 350 ms
➜  Local:   http://localhost:3003/
```

No errors about invalid keys or authentication failures.

---

### Stage 3: Local Testing (10 minutes)

#### Step 3.1: Run Migration Validation Tests

```bash
# Run the test suite we created earlier
node claudedocs/test-migration-keys.mjs
```

**Expected Results**:
- ✅ All environment variable tests pass
- ✅ Anon client initializes with new publishable key
- ✅ Service client initializes with new secret key
- ✅ RLS enforcement working
- ✅ Service key can bypass RLS
- ✅ Database connectivity healthy

**Target Pass Rate**: ≥ 90%

#### Step 3.2: Manual Application Testing

Open browser to http://localhost:3003 and test:

1. **Authentication Flow**:
   - [ ] Login with existing account
   - [ ] User profile loads correctly
   - [ ] Session persists after page refresh

2. **Project Operations**:
   - [ ] Projects list loads
   - [ ] Can select a project
   - [ ] Project details display

3. **Ideas Management**:
   - [ ] Ideas load for selected project
   - [ ] Can create new idea
   - [ ] Can edit existing idea
   - [ ] Can delete idea
   - [ ] Drag and drop positioning works

4. **Data Management**:
   - [ ] CSV export works
   - [ ] CSV import works
   - [ ] Bulk operations function

**Critical**: If ANY of these tests fail, STOP and rollback immediately.

#### Step 3.3: Check Browser Console

Open browser DevTools → Console tab:

**Should NOT see**:
- ❌ Authentication errors
- ❌ "Invalid API key" errors
- ❌ RLS policy violations
- ❌ Network errors (401, 403)

**Should see**:
- ✅ Successful API requests (200 status codes)
- ✅ Ideas loaded messages
- ✅ User authenticated messages

---

### Stage 4: Production Deployment (15 minutes)

⚠️ **IMPORTANT**: Only proceed if Stage 3 tests passed 100%

#### Step 4.1: Update Vercel Environment Variables

**Option A: Vercel Dashboard** (Recommended for first-time)

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Click **Settings** tab
4. Click **Environment Variables** in sidebar
5. Add new variables:

```
Name: VITE_SUPABASE_ANON_KEY
Value: sb_publishable_vfovtgtjailvrphsgafv_... (paste your new key)
Environments: ✓ Production ✓ Preview ✓ Development

Name: SUPABASE_SERVICE_ROLE_KEY
Value: sb_secret_vfovtgtjailvrphsgafv_... (paste your new key)
Environments: ✓ Production ✓ Preview ✓ Development
```

6. Keep the old variables for 24-48 hours (for emergency rollback)

**Option B: Vercel CLI**

```bash
# Update production environment
vercel env add VITE_SUPABASE_ANON_KEY production
# Paste: sb_publishable_vfovtgtjailvrphsgafv_...

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste: sb_secret_vfovtgtjailvrphsgafv_...

# Update preview environment
vercel env add VITE_SUPABASE_ANON_KEY preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview

# Update development environment
vercel env add VITE_SUPABASE_ANON_KEY development
vercel env add SUPABASE_SERVICE_ROLE_KEY development
```

#### Step 4.2: Deploy to Production

```bash
# Trigger production deployment
vercel --prod

# Expected output:
# 🔍  Inspect: https://vercel.com/...
# ✅  Production: https://your-app.vercel.app [...]
```

**Wait for deployment to complete** (~2-3 minutes)

#### Step 4.3: Verify Production Deployment

1. **Check Deployment Status**:
   ```bash
   # Watch deployment logs
   vercel logs --prod --follow
   ```

2. **Verify Application**:
   - Open production URL: https://your-app.vercel.app
   - Login with test account
   - Perform same tests as Step 3.2

3. **Monitor Error Logs**:
   ```bash
   # Check for errors in last 10 minutes
   vercel logs --prod --since=10m
   ```

**Success Criteria**:
- ✅ Deployment completed without errors
- ✅ Application loads in production
- ✅ Authentication works
- ✅ No errors in production logs

---

### Stage 5: Legacy Key Cleanup (Post-Migration)

⚠️ **WAIT 24-48 hours** after successful production deployment before this stage.

#### Step 5.1: Verify Stability

Monitor production for 24-48 hours:

**Checklist**:
- [ ] No authentication errors reported
- [ ] No API errors in logs
- [ ] User activity normal
- [ ] All features functioning

**If any issues arise**: Rollback immediately using legacy keys.

#### Step 5.2: Remove Legacy Environment Variables (Vercel)

Once stable, remove old variables:

```bash
# OPTIONAL: Only if you kept old variables
# Remove legacy variables from Vercel
# vercel env rm OLD_VARIABLE_NAME production
# vercel env rm OLD_VARIABLE_NAME preview
```

**Note**: If you directly updated the existing variables (didn't create new ones), skip this step.

#### Step 5.3: Update Local .env

Remove commented legacy keys from `.env`:

```bash
# Remove these lines after 48 hours of stable operation:
# LEGACY_ANON_KEY=...
# LEGACY_SERVICE_ROLE_KEY=...
```

#### Step 5.4: Revoke Legacy Keys in Supabase (Optional)

**ONLY do this if you're 100% confident**:

1. Go to Supabase Dashboard → Settings → API
2. Find legacy keys section
3. Click "Revoke" on old `anon` and `service_role` keys

⚠️ **WARNING**: This is irreversible. Only do this after confirmed stability.

**Recommended**: Wait until November 2025 when Supabase starts deprecation reminders.

---

## 🔄 Rollback Procedure

If issues arise at ANY stage:

### Immediate Rollback (< 5 minutes)

#### Local Development:
```bash
# Restore backup
cp .env.backup.YYYYMMDD_HHMMSS .env

# Restart dev server
npm run dev
```

#### Production (Vercel Dashboard):
1. Go to Vercel → Settings → Environment Variables
2. Update variables back to legacy JWT keys
3. Redeploy: `vercel --prod`

#### Production (Vercel CLI):
```bash
# Restore legacy keys
vercel env add VITE_SUPABASE_ANON_KEY production
# Paste OLD JWT anon key

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste OLD JWT service_role key

# Redeploy
vercel --prod
```

**Recovery Time**: < 10 minutes

---

## ✅ Post-Migration Validation Checklist

### Environment Configuration
- [ ] New `sb_publishable_*` key in VITE_SUPABASE_ANON_KEY
- [ ] New `sb_secret_*` key in SUPABASE_SERVICE_ROLE_KEY
- [ ] Keys updated in local .env
- [ ] Keys updated in Vercel (all environments)
- [ ] Backup .env file created

### Functional Testing
- [ ] Local dev server starts without errors
- [ ] Automated tests pass (≥90% pass rate)
- [ ] Authentication works (login/logout)
- [ ] User profile loads
- [ ] Projects list loads
- [ ] Ideas CRUD operations work
- [ ] CSV import/export works
- [ ] Production deployment successful
- [ ] Production application functional

### Security Validation
- [ ] RLS enforcement working
- [ ] Service key can bypass RLS (admin ops)
- [ ] Anon key cannot bypass RLS
- [ ] No keys exposed in browser DevTools
- [ ] No authentication errors in logs

### Monitoring
- [ ] 24-hour stability monitoring complete
- [ ] 48-hour stability monitoring complete
- [ ] No user-reported issues
- [ ] Error rates normal
- [ ] Performance metrics stable

---

## 📊 Expected Outcomes

### Technical Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Key Format** | JWT tokens | Dedicated API keys |
| **Naming Clarity** | Generic (anon/service_role) | Descriptive (publishable/secret) |
| **Rotation** | Complex (re-sign JWTs) | Simple (generate new key) |
| **Secret Scanning** | Limited detection | Better tooling support |
| **Future-Proof** | Legacy system | Modern foundation |

### Security Benefits

- ✅ **Improved Key Rotation**: Easier to rotate without JWT signing complexity
- ✅ **Better Secret Detection**: Security scanners recognize `sb_secret_*` pattern
- ✅ **Clear Separation**: Obvious distinction between publishable and secret keys
- ✅ **Future-Ready**: Foundation for asymmetric JWT support

### Developer Experience

- ✅ **Clearer Naming**: `sb_publishable_*` and `sb_secret_*` are self-documenting
- ✅ **Less Confusion**: No more "which JWT should I use?"
- ✅ **Better Documentation**: Official docs aligned with new format
- ✅ **Industry Standard**: Follows API key best practices

---

## 🐛 Troubleshooting Guide

### Issue 1: "Invalid API key" Error

**Symptoms**: Authentication fails with "Invalid API key" message

**Causes**:
1. Key not copied correctly (missing characters)
2. Using wrong key type (publishable vs secret)
3. Keys not updated in all environments

**Solutions**:
```bash
# Verify key format
echo $VITE_SUPABASE_ANON_KEY | grep "^sb_publishable_"
echo $SUPABASE_SERVICE_ROLE_KEY | grep "^sb_secret_"

# Re-copy keys from Supabase Dashboard
# Make sure there are no extra spaces or line breaks
```

---

### Issue 2: RLS Policies Not Working

**Symptoms**: Users can access data they shouldn't

**Causes**:
1. Using secret key on frontend (bypasses RLS)
2. RLS policies not properly configured

**Solutions**:
```bash
# Verify frontend uses publishable key
grep "VITE_SUPABASE_ANON_KEY" src/lib/supabase.ts

# Should show: const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

# Verify it starts with sb_publishable_
```

---

### Issue 3: Production Deployment Fails

**Symptoms**: Vercel deployment fails or app doesn't load

**Causes**:
1. Environment variables not set in Vercel
2. Deployment using cached old keys

**Solutions**:
```bash
# Check Vercel environment variables
vercel env ls

# Verify new keys are present
# Should see VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY

# Force new deployment (clears cache)
vercel --prod --force
```

---

### Issue 4: Database Connection Errors

**Symptoms**: "Connection failed" or timeout errors

**Causes**:
1. New keys not activated in Supabase
2. Project reference mismatch

**Solutions**:
1. Verify keys in Supabase Dashboard → Settings → API
2. Check that keys match your project reference
3. Wait a few minutes for key propagation

---

## 📚 Additional Resources

### Official Documentation
- [Supabase API Keys Guide](https://supabase.com/docs/guides/api/api-keys)
- [GitHub Discussion #29260](https://github.com/orgs/supabase/discussions/29260)
- [Supabase Changelog](https://supabase.com/changelog)

### Internal Documentation
- Phase 1 Migration: `SUPABASE_KEY_MIGRATION_STRATEGY.md`
- Phase 1 Report: `MIGRATION_IMPLEMENTATION_COMPLETE.md`
- Test Report: `MIGRATION_TEST_REPORT.md`
- Service Key Rotation: `SERVICE_KEY_ROTATION_GUIDE.md`

### Support
- Supabase Discord: https://discord.supabase.com
- Supabase Support: https://supabase.com/support
- GitHub Issues: https://github.com/supabase/supabase/issues

---

## 🎯 Success Metrics

Migration is considered successful when:

| Metric | Target | Actual |
|--------|--------|--------|
| **Automated Test Pass Rate** | ≥ 90% | ___% |
| **Production Uptime** | 99.9% | ___% |
| **Authentication Success Rate** | ≥ 99% | ___% |
| **API Error Rate** | < 0.1% | ___% |
| **User-Reported Issues** | 0 | ___ |
| **Rollback Required** | No | ___ |

---

**Migration Version**: 2.0 (Phase 2)
**Created By**: /sc:implement
**Status**: Ready for Execution
**Next Review**: After 48-hour stability period
