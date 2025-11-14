# CDN Cache Issue - Old JavaScript Bundle Persisting

**Date:** 2025-11-14
**Status:** 🔴 **ACTIVE ISSUE - Requires Immediate Action**

---

## 🚨 **Critical Finding**

The admin panel is failing in the browser **NOT** because of broken code or environment variables, but because **Vercel CDN is serving cached old JavaScript bundles**.

### Evidence

**✅ API Works Perfectly:**
```bash
curl "https://www.prioritas.ai/api/admin/projects" | jq '.success, .total'
# Result: true, 11 ✅
```

**❌ Browser Gets Old Bundle:**
```
Console shows: index-CMlOzYZ1.js:155  GET /api/admin/projects 500
This is the OLD bundle hash from BEFORE our fixes
```

**✅ Environment Variables Correct:**
```bash
vercel env pull .env.production.check
grep "VITE_SUPABASE_ANON_KEY" .env.production.check
# Result: Full JWT token present ✅
```

---

## 🔍 Root Cause Analysis

### The Problem

1. **New Deployment Created:** design-matrix-1n2rylied (21 minutes ago, commit 0a475d6)
2. **Domain Aliases Updated:** prioritas.ai → points to 1n2rylied deployment
3. **API Works:** curl confirms API returns correct data
4. **BUT:** Browser still loads `index-CMlOzYZ1.js` (old bundle from hours ago)

### Why This Happens

**Vercel CDN Caching Layers:**
1. **Edge Cache:** CDN caches static assets (JavaScript bundles) for performance
2. **Cache Duration:** Default cache headers set long TTL for immutable assets
3. **Cache Key:** Based on file path `/assets/index-CMlOzYZ1.js`
4. **Problem:** Even though deployment changed, CDN still serves cached bundle

### The Cache Flow

```
User Request
    ↓
Vercel Edge (CDN)
    ├─ Check cache for /assets/index-CMlOzYZ1.js
    ├─ Cache HIT → Serve old bundle (from hours ago)
    └─ Never reaches new deployment

vs

API Request
    ↓
Vercel Edge (CDN)
    ├─ API routes bypass asset cache
    ├─ Direct to serverless function
    └─ Executes with correct environment variables ✅
```

---

## ✅ What's Actually Working

| Component | Status | Verification |
|-----------|--------|--------------|
| **Latest Deployment** | ✅ Built | 1n2rylied (21 min ago) |
| **Domain Aliases** | ✅ Assigned | All domains → 1n2rylied |
| **Environment Variables** | ✅ Correct | Full JWT tokens in Vercel |
| **API Endpoints** | ✅ Working | curl returns 11 projects |
| **Source Code** | ✅ Fixed | Commits caca13e, aa0b45d applied |

---

## ❌ What's NOT Working

| Component | Status | Issue |
|-----------|--------|-------|
| **CDN Cache** | ❌ Stale | Serving old bundle |
| **Browser** | ❌ Old Code | Loads index-CMlOzYZ1.js |
| **Admin Panel** | ❌ Broken | 500 errors from old bundle |

---

## 🔧 Solutions

### Option 1: Wait for Cache Expiration (Slow)
- **Time:** 24-48 hours (Vercel default asset cache duration)
- **Action:** None required, just wait
- **Pros:** No manual intervention
- **Cons:** Users see broken site for extended period

### Option 2: Hard Refresh with Cache Bypass (User Action Required)
- **Time:** Immediate for individual user
- **Action:** User must press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- **Pros:** Works immediately for that user
- **Cons:** Every user must do this manually, doesn't fix CDN

### Option 3: Trigger New Deployment with Different Bundle Hash (RECOMMENDED)
- **Time:** 2-3 minutes (build + deploy)
- **Action:** Make trivial code change → commit → push
- **Pros:** Forces Vite to generate NEW bundle hash, bypasses cache
- **Cons:** Requires code change

### Option 4: Purge Vercel CDN Cache (Best but Requires Dashboard Access)
- **Time:** Immediate (seconds)
- **Action:** Vercel Dashboard → Deployments → 1n2rylied → "..." menu → "Redeploy"
- **Pros:** Instant fix, clears all CDN caches
- **Cons:** Requires manual dashboard access

---

## 🚀 Recommended Action Plan

### Immediate Fix (Option 3)

Make a trivial code change to force new build with different bundle hash:

```bash
# 1. Add a comment to trigger new build
echo "// Cache bust $(date)" >> src/main.tsx

# 2. Commit and push
git add src/main.tsx
git commit -m "chore: cache bust for CDN update"
git push

# 3. Wait for automatic Vercel deployment (2-3 min)

# 4. Verify new bundle hash
curl -sI https://www.prioritas.ai | grep x-vercel-id
```

This will:
- ✅ Trigger new Vite build with different hash (not CMlOzYZ1)
- ✅ Generate new bundle: `index-[NEW_HASH].js`
- ✅ CDN has no cache for new hash → serves fresh bundle
- ✅ Browser loads new bundle with correct environment variables
- ✅ Admin panel works immediately

---

## 📊 Timeline of Events

| Time | Event | Result |
|------|-------|--------|
| **15h ago** | Environment variables set in Vercel | ✅ Correct values |
| **3h ago** | Fixed API env vars (commit caca13e) | ✅ API code fixed |
| **2h ago** | Fixed vercel.json routing (commit aa0b45d) | ✅ Routing fixed |
| **1h ago** | Fixed .env locally + deployed (hdl049m44) | ✅ New deployment |
| **21m ago** | Auto-deployment from docs commit (1n2rylied) | ✅ Latest deployment |
| **Now** | Domain aliases point to latest | ✅ Aliases updated |
| **Now** | API works perfectly via curl | ✅ Backend working |
| **Now** | Browser shows 500 errors | ❌ Old bundle cached |

---

## 🎯 Verification Steps After Fix

After triggering new deployment:

1. **Check Bundle Hash Changes:**
   ```bash
   # Open browser console
   # Look for: index-[NEW_HASH].js
   # Should NOT be: index-CMlOzYZ1.js
   ```

2. **Verify No 500 Errors:**
   ```bash
   # Browser console should show
   # GET /api/admin/projects 200 ✅
   # NOT: 500 (Internal Server Error)
   ```

3. **Check Project Count:**
   ```
   # Project Management page should show
   # "Showing 11 of 11 projects" ✅
   # NOT: "Showing 0 of 0 projects"
   ```

---

## 📝 Key Learnings

1. **CDN Caching is Aggressive:** Vercel CDN caches assets for extended periods
2. **Bundle Hashes are Cache Keys:** Same hash = cached, new hash = fresh
3. **Domain Alias ≠ Cache Clear:** Changing aliases doesn't purge CDN cache
4. **APIs Bypass Asset Cache:** API routes work even with stale asset cache
5. **Hard Refresh Only Helps User:** Doesn't fix CDN for all users

---

## 🔍 How to Detect This Issue in Future

**Symptoms:**
- ✅ API works via curl
- ❌ API fails in browser with same request
- Console shows OLD bundle hash
- Hard refresh doesn't help
- New deployment doesn't fix issue

**Diagnosis:**
```bash
# 1. Check API directly
curl https://your-domain/api/admin/projects

# 2. Check bundle hash in browser console
# Look for: index-XXXXX.js

# 3. Compare deployment time vs bundle load time
# If bundle is older than latest deployment = CDN cache issue
```

---

## 🚨 **IMMEDIATE ACTION REQUIRED**

To fix this issue NOW, trigger a new deployment with cache-busting change.

**Status:** Waiting for trivial code change + new deployment to clear CDN cache.
