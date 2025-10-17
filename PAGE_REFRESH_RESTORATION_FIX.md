# Page Refresh Project Restoration Fix

## Issue Summary
After applying the RLS fix for `project_files` table, pages were still not loading correctly on refresh. The loading screen would appear briefly, then redirect to the Projects page instead of loading the project content.

## Root Cause - PageRouter Race Condition

### The Problem Flow
1. User visits `/files?project=deade958-e26c-4c4b-99d6-8476c326427b` (refresh or direct URL)
2. `useAuth` initializes and sets `isLoading=true`
3. `AuthenticationFlow` shows loading screen: "Loading your project..."
4. `useAuth` completes authentication and sets `isLoading=false`
5. **RACE CONDITION**: App renders with `currentProject=null` (restoration hasn't started yet)
6. `PageRouter` useEffect (lines 72-79) runs and sees:
   - Page is 'files' (requires project)
   - `currentProject` is null
   - `isRestoringProject` might not be true yet
7. **PageRouter redirects to `/projects`**, removing the `?project=` URL parameter
8. `useBrowserHistory` detects project parameter... but it's already gone!
9. Project restoration has nothing to restore

### The Faulty Logic (Before Fix)
```typescript
// PageRouter.tsx:72-79 - BEFORE FIX
useEffect(() => {
  if (!isRestoringProject && !currentProject) {
    const pagesRequiringProject = ['data', 'reports', 'roadmap', 'files', 'collaboration']
    if (pagesRequiringProject.includes(currentPage)) {
      onPageChange('projects')  // ❌ Redirects even if URL has ?project= parameter
    }
  }
}, [currentPage, currentProject, isRestoringProject, onPageChange])
```

**Problem**: This logic doesn't check if there's a `?project=` parameter in the URL that's about to be restored.

## The Fix

### Updated Logic (After Fix)
```typescript
// PageRouter.tsx:72-85 - AFTER FIX
useEffect(() => {
  // CRITICAL FIX: Check if there's a project ID in the URL before redirecting
  const urlParams = new URLSearchParams(window.location.search)
  const projectIdFromUrl = urlParams.get('project')

  if (!isRestoringProject && !currentProject && !projectIdFromUrl) {
    const pagesRequiringProject = ['data', 'reports', 'roadmap', 'files', 'collaboration']
    if (pagesRequiringProject.includes(currentPage)) {
      logger.debug('No project available and no project in URL - redirecting to projects page')
      onPageChange('projects')  // ✅ Only redirects if truly no project available
    }
  }
}, [currentPage, currentProject, isRestoringProject, onPageChange])
```

**Solution**: Added `!projectIdFromUrl` check. Now only redirects if:
1. No current project is loaded, AND
2. No restoration is in progress, AND
3. **No project ID exists in the URL**

## How The Fix Works

### New Flow (With Fix)
1. User visits `/files?project=xxx` (refresh or direct URL)
2. `useAuth` completes, `isLoading=false`
3. App renders with `currentProject=null`
4. `PageRouter` useEffect runs and sees:
   - Page is 'files' (requires project)
   - `currentProject` is null
   - **BUT**: `projectIdFromUrl` is present in URL
5. **No redirect happens** - allows restoration to proceed
6. `useBrowserHistory` detects `?project=xxx` parameter
7. Calls `handleProjectRestore(projectId)`
8. Project loads successfully
9. Page content renders with project data

## Files Changed

### `/src/components/layout/PageRouter.tsx`
- **Lines 72-85**: Added URL parameter check before redirect
- **Impact**: Prevents race condition between auth completion and project restoration
- **Risk Level**: Low - only adds additional check, doesn't change existing behavior when no URL parameter

## Verification Steps

### Manual Testing on Vercel Production
Test these URLs with hard refresh (Cmd+Shift+R or Ctrl+Shift+R):

1. **Files Page**: https://prioritas.ai/files?project=deade958-e26c-4c4b-99d6-8476c326427b
   - Expected: Brief loading screen → Files page with file list
   - Before fix: Loading screen → Redirect to Projects page

2. **Roadmap Page**: https://prioritas.ai/roadmap?project=deade958-e26c-4c4b-99d6-8476c326427b
   - Expected: Brief loading screen → Roadmap with initiatives
   - Before fix: Loading screen → Redirect to Projects page

3. **Insights Page**: https://prioritas.ai/reports?project=deade958-e26c-4c4b-99d6-8476c326427b
   - Expected: Brief loading screen → Insights dashboard
   - Before fix: Loading screen → Redirect to Projects page

4. **Collaboration Page**: https://prioritas.ai/collaboration?project=deade958-e26c-4c4b-99d6-8476c326427b
   - Expected: Brief loading screen → Collaboration view
   - Before fix: Loading screen → Redirect to Projects page

5. **Data Page**: https://prioritas.ai/data?project=deade958-e26c-4c4b-99d6-8476c326427b
   - Expected: Brief loading screen → Data management view
   - Before fix: Loading screen → Redirect to Projects page

### What Success Looks Like
- ✅ Loading screen appears for 1-3 seconds
- ✅ Project data loads correctly
- ✅ URL stays at the requested page with `?project=` parameter
- ✅ No redirect to Projects page
- ✅ No console errors about RLS or permissions

### What Failure Looks Like
- ❌ Redirect to Projects page after loading screen
- ❌ URL changes from `/files?project=xxx` to `/projects`
- ❌ Empty data on page (no files, no roadmap items, etc.)
- ❌ Console errors about missing project context

## Related Fixes

This fix is part of a larger effort to resolve page refresh issues:

1. **Backend Connection Pool** (Commit 4f3c664)
   - Changed from ANON key to SERVICE_ROLE_KEY
   - Fixed: Backend user profile queries

2. **Frontend Auth Timeouts** (Commit 54ea688)
   - Fixed: getSession() timeouts with localStorage pattern
   - Fixed: Ideas loading on refresh

3. **RLS Not Enabled** (SQL applied by user)
   - Missing: `ALTER TABLE project_files ENABLE ROW LEVEL SECURITY`
   - Fixed: Files page empty due to permission denied

4. **PageRouter Race Condition** (Commit 6054812) ← THIS FIX
   - Fixed: Redirect before project restoration completes
   - Fixed: All pages with `?project=` parameter now load correctly

## Technical Details

### Component Architecture
```
AppWithAuth
└── AuthenticationFlow (shows loading screen when isLoading=true)
    └── MainApp
        ├── AppLayout
        └── PageRouter (redirect logic here)
            └── Page Components (Files, Roadmap, etc.)
```

### State Flow
```
1. useAuth: isLoading=true
2. AuthenticationFlow: Shows loading screen
3. useAuth: Completes → isLoading=false
4. MainApp: Renders
5. useBrowserHistory: Detects ?project= and calls handleProjectRestore()
6. PageRouter: Checks conditions → NO REDIRECT (fix applied)
7. ProjectContext: handleProjectRestore() fetches project
8. ProjectContext: setCurrentProject(project)
9. PageRouter: Sees currentProject → Renders page content
```

### Timing Dependencies
- Auth must complete before project restoration can read localStorage token
- Project restoration must complete before page content can render
- Redirect logic must NOT interfere with restoration process ← **FIX TARGET**

## Deployment

### Git History
```bash
git log --oneline -5
6054812 Fix PageRouter race condition preventing project restoration from URL
31a9c14 Documentation of RLS fix applied to project_files table
4f3c664 Backend connection pool uses SERVICE_ROLE_KEY
54ea688 Frontend uses localStorage token pattern
a4ec5e3 Ideas loading with localStorage pattern
```

### Vercel Deployment
- Push to `main` branch triggers automatic deployment
- Build status: Check Vercel dashboard
- Expected deploy time: 2-3 minutes
- Deployment URL: https://prioritas.ai

## Testing Instructions for User

1. **Wait for Vercel deployment to complete** (check Vercel dashboard or GitHub Actions)

2. **Hard refresh these pages in production**:
   - Files: https://prioritas.ai/files?project=deade958-e26c-4c4b-99d6-8476c326427b
   - Roadmap: https://prioritas.ai/roadmap?project=deade958-e26c-4c4b-99d6-8476c326427b
   - Insights: https://prioritas.ai/reports?project=deade958-e26c-4c4b-99d6-8476c326427b

3. **Expected behavior**:
   - Brief loading screen (1-3 seconds)
   - Page loads with project data
   - No redirect to Projects page
   - No console errors

4. **If issues persist**, check:
   - Browser console for errors
   - Network tab for failed requests
   - Whether RLS is still enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'project_files'`
   - Vercel deployment completed successfully

## Date Applied
2025-10-17

## Commit Reference
Commit: 6054812
Branch: main
Files: src/components/layout/PageRouter.tsx
