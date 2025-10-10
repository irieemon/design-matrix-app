# Phase 2 Migration - Quick Start Guide

**⏱️ Total Time**: 30-45 minutes
**🎯 Goal**: Migrate to new Supabase API key format
**📋 Status**: Ready to execute

---

## ⚡ Quick Execution Steps

### 🔑 Step 1: Generate New Keys (5 min)

1. Go to: https://supabase.com/dashboard
2. Select project: **design-matrix-app**
3. Navigate to: **Settings → API**
4. Generate **publishable key** (`sb_publishable_*`)
5. Generate **secret key** (`sb_secret_*`)
6. Save both keys securely

---

### 💻 Step 2: Update Local .env (5 min)

```bash
# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Edit .env and replace:
VITE_SUPABASE_ANON_KEY=sb_publishable_YOUR_NEW_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=sb_secret_YOUR_NEW_KEY_HERE

# Restart dev server
npm run dev
```

---

### ✅ Step 3: Test Locally (10 min)

```bash
# Run automated tests
node claudedocs/test-migration-keys.mjs

# Manual testing:
# 1. Open http://localhost:3003
# 2. Login
# 3. Load projects
# 4. Create/edit idea
# 5. Check for errors in console
```

**✅ Pass Criteria**: All tests pass, no console errors

---

### 🚀 Step 4: Deploy to Production (10 min)

**Vercel Dashboard**:
1. Go to https://vercel.com/dashboard
2. Select project → Settings → Environment Variables
3. Update `VITE_SUPABASE_ANON_KEY` to new publishable key
4. Update `SUPABASE_SERVICE_ROLE_KEY` to new secret key
5. Select all environments (Production, Preview, Development)

**Or CLI**:
```bash
vercel env add VITE_SUPABASE_ANON_KEY production
# Paste: sb_publishable_...

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste: sb_secret_...

vercel --prod
```

---

### 🔍 Step 5: Verify Production (5 min)

1. Wait for deployment to complete
2. Open production URL
3. Test authentication and features
4. Check logs: `vercel logs --prod`

**✅ Pass Criteria**: App works, no errors in logs

---

### ⏰ Step 6: Monitor Stability (48 hours)

- [ ] 24-hour checkpoint: No errors reported
- [ ] 48-hour checkpoint: All systems stable
- [ ] Clean up: Remove commented legacy keys from .env

---

## 🆘 Emergency Rollback

If something breaks:

```bash
# Local:
cp .env.backup.YYYYMMDD_HHMMSS .env
npm run dev

# Production (Vercel):
# Revert environment variables to old JWT keys
vercel --prod
```

---

## 📊 Validation Checklist

- [ ] New keys generated from Supabase
- [ ] Local .env updated
- [ ] Dev server runs without errors
- [ ] Automated tests pass
- [ ] Manual testing successful
- [ ] Vercel environment variables updated
- [ ] Production deployment successful
- [ ] Production app working
- [ ] 48-hour stability confirmed

---

## 📚 Full Documentation

See `PHASE2_MIGRATION_IMPLEMENTATION_GUIDE.md` for detailed instructions.

---

**Ready?** Start with Step 1! ⬆️
