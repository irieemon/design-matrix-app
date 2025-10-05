# Vercel Function Limit Solution

## Problem
Vercel Hobby plan limits deployments to **12 serverless functions** maximum.
Current project has **23 API route files**, exceeding the limit by 11 functions.

## Current API Routes (23 total)

### Auth Routes (7)
- api/auth/performance.ts
- api/auth/refresh.ts
- api/auth/admin/verify.ts
- api/auth/clear-cache.ts
- api/auth/session.ts
- api/auth/roles.ts
- api/auth/user.ts

### Admin Routes (5)
- api/admin/enable-realtime-sql.ts
- api/admin/apply-migration.ts
- api/admin/run-migration.ts
- api/admin/enable-realtime.ts
- api/admin/migrate-database.ts

### AI Routes (6)
- api/ai/generate-roadmap-v2.ts
- api/ai/analyze-file.ts
- api/ai/generate-insights.ts
- api/ai/generate-ideas.ts
- api/ai/analyze-image.ts
- api/ai/transcribe-audio.ts

### User Routes (1)
- api/user/component-state.ts

### Ideas Routes (2)
- api/ideas.ts
- api/ideas/index.ts

### Debug Routes (2)
- api/debug/reset-project-files.ts
- api/debug/check-storage-sync.ts

## Solution Options

### Option 1: Consolidate into 12 Functions (RECOMMENDED)
Merge related routes into single files with method/path routing:

```
api/auth.ts          (7 auth routes → 1 function)
api/admin.ts         (5 admin routes → 1 function)
api/ai.ts            (6 AI routes → 1 function)
api/ideas.ts         (already consolidated)
api/user.ts          (already consolidated)
api/debug.ts         (2 debug routes → 1 function)
```

**Result**: 6 functions (well under 12 limit)

### Option 2: Remove Unused Routes
Identify and remove routes that aren't actively used:

**Candidates for removal:**
- api/debug/* (2 routes) - only needed for development
- api/auth/performance.ts - can be merged into auth.ts
- api/auth/clear-cache.ts - can be merged into auth.ts
- api/admin/enable-realtime*.ts (3 routes) - can be consolidated

**Result**: ~16-18 functions (still over limit)

### Option 3: Upgrade to Vercel Pro Plan
- Cost: $20/month
- Allows up to 100 serverless functions
- Provides additional benefits (analytics, password protection, etc.)

## Recommended Implementation (Option 1)

### 1. Create Consolidated Auth Route (`api/auth.ts`)
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.split('/auth/')[1]?.split('?')[0]

  switch (path) {
    case 'session': return sessionHandler(req, res)
    case 'refresh': return refreshHandler(req, res)
    case 'user': return userHandler(req, res)
    case 'clear-cache': return clearCacheHandler(req, res)
    case 'performance': return performanceHandler(req, res)
    case 'admin/verify': return adminVerifyHandler(req, res)
    default: return res.status(404).json({ error: 'Not found' })
  }
}
```

### 2. Create Consolidated Admin Route (`api/admin.ts`)
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.split('/admin/')[1]?.split('?')[0]

  switch (path) {
    case 'migrate-database': return migrateDatabaseHandler(req, res)
    case 'apply-migration': return applyMigrationHandler(req, res)
    case 'run-migration': return runMigrationHandler(req, res)
    case 'enable-realtime': return enableRealtimeHandler(req, res)
    case 'enable-realtime-sql': return enableRealtimeSqlHandler(req, res)
    default: return res.status(404).json({ error: 'Not found' })
  }
}
```

### 3. Create Consolidated AI Route (`api/ai.ts`)
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.split('/ai/')[1]?.split('?')[0]

  switch (path) {
    case 'generate-ideas': return generateIdeasHandler(req, res)
    case 'generate-roadmap-v2': return generateRoadmapHandler(req, res)
    case 'generate-insights': return generateInsightsHandler(req, res)
    case 'analyze-file': return analyzeFileHandler(req, res)
    case 'analyze-image': return analyzeImageHandler(req, res)
    case 'transcribe-audio': return transcribeAudioHandler(req, res)
    default: return res.status(404).json({ error: 'Not found' })
  }
}
```

### 4. Remove Debug Routes (Development Only)
Move debug functionality to local development scripts instead of deployed functions.

## Migration Steps

1. **Create consolidated route files** (auth.ts, admin.ts, ai.ts)
2. **Extract handler logic** from existing route files into separate functions
3. **Add path-based routing** in consolidated files
4. **Test locally** to ensure all routes still work
5. **Delete original route files** after verification
6. **Deploy to Vercel** and verify function count

## Expected Result
- **Before**: 23 functions (deployment fails)
- **After**: 6 functions (well under 12 limit)
- **Benefit**: Room for 6 more functions if needed

## Status
- ✅ TypeScript errors fixed
- ⚠️ Awaiting decision on consolidation approach
- ⏳ Ready to implement Option 1 when approved
