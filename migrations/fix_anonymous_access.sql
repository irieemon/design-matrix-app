-- Fix Anonymous Access Security Warnings
-- Ensures policies only allow authenticated users with valid UIDs
-- Date: 2025-10-02

-- ============================================================================
-- PART 1: Remove overly permissive development policies
-- ============================================================================

-- Remove development policy from project_files
DROP POLICY IF EXISTS "Allow all for development" ON public.project_files;

-- Remove open access from user_profiles
DROP POLICY IF EXISTS "open_profiles_access_v2" ON public.user_profiles;

-- ============================================================================
-- PART 2: Update existing policies to exclude anonymous users
-- All policies now check: auth.uid() IS NOT NULL
-- This ensures only truly authenticated users (not anonymous) can access
-- ============================================================================

-- ==================== PROJECTS ====================

DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND owner_id::text = (select auth.uid())::text
);

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND owner_id::text = (select auth.uid())::text
);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND owner_id::text = (select auth.uid())::text
);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND owner_id::text = (select auth.uid())::text
);

-- ==================== IDEAS ====================

DROP POLICY IF EXISTS "Users can view ideas in accessible projects" ON public.ideas;
CREATE POLICY "Users can view ideas in accessible projects"
ON public.ideas
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = ideas.project_id::text
    AND (
      projects.owner_id::text = (select auth.uid())::text
      OR projects.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators
        WHERE project_collaborators.project_id::text = projects.id::text
        AND project_collaborators.user_id::text = (select auth.uid())::text
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can create ideas" ON public.ideas;
CREATE POLICY "Users can create ideas"
ON public.ideas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by::text = (select auth.uid())::text
);

DROP POLICY IF EXISTS "Users can update ideas" ON public.ideas;
CREATE POLICY "Users can update ideas"
ON public.ideas
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = ideas.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Users can delete ideas" ON public.ideas;
CREATE POLICY "Users can delete ideas"
ON public.ideas
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = ideas.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

-- ==================== PROJECT_ROADMAPS ====================

DROP POLICY IF EXISTS "Users can view roadmaps for accessible projects" ON public.project_roadmaps;
CREATE POLICY "Users can view roadmaps for accessible projects"
ON public.project_roadmaps
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_roadmaps.project_id::text
    AND (
      projects.owner_id::text = (select auth.uid())::text
      OR projects.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators
        WHERE project_collaborators.project_id::text = projects.id::text
        AND project_collaborators.user_id::text = (select auth.uid())::text
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can create roadmaps for owned projects" ON public.project_roadmaps;
CREATE POLICY "Users can create roadmaps for owned projects"
ON public.project_roadmaps
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_roadmaps.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Users can update roadmaps for owned projects" ON public.project_roadmaps;
CREATE POLICY "Users can update roadmaps for owned projects"
ON public.project_roadmaps
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_roadmaps.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Users can delete roadmaps for owned projects" ON public.project_roadmaps;
CREATE POLICY "Users can delete roadmaps for owned projects"
ON public.project_roadmaps
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_roadmaps.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

-- ==================== PROJECT_INSIGHTS ====================

DROP POLICY IF EXISTS "Users can view insights for accessible projects" ON public.project_insights;
CREATE POLICY "Users can view insights for accessible projects"
ON public.project_insights
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_insights.project_id::text
    AND (
      projects.owner_id::text = (select auth.uid())::text
      OR projects.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators
        WHERE project_collaborators.project_id::text = projects.id::text
        AND project_collaborators.user_id::text = (select auth.uid())::text
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can create insights for owned projects" ON public.project_insights;
CREATE POLICY "Users can create insights for owned projects"
ON public.project_insights
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_insights.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Users can update insights for owned projects" ON public.project_insights;
CREATE POLICY "Users can update insights for owned projects"
ON public.project_insights
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_insights.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Users can delete insights for owned projects" ON public.project_insights;
CREATE POLICY "Users can delete insights for owned projects"
ON public.project_insights
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_insights.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

-- ==================== TEAMS ====================

DROP POLICY IF EXISTS "Team owners can update teams" ON public.teams;
CREATE POLICY "Team owners can update teams"
ON public.teams
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND owner_id::text = (select auth.uid())::text
);

-- ==================== PROJECT_COLLABORATORS ====================

DROP POLICY IF EXISTS "authenticated_users_collaborators" ON public.project_collaborators;
CREATE POLICY "Users can view collaborators of accessible projects"
ON public.project_collaborators
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_collaborators.project_id::text
    AND (
      projects.owner_id::text = (select auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators pc
        WHERE pc.project_id::text = projects.id::text
        AND pc.user_id::text = (select auth.uid())::text
      )
    )
  )
);

-- ==================== PROJECT_FILES ====================

-- Create proper RLS policies for project_files
CREATE POLICY "Users can view files in accessible projects"
ON public.project_files
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_files.project_id::text
    AND (
      projects.owner_id::text = (select auth.uid())::text
      OR projects.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators
        WHERE project_collaborators.project_id::text = projects.id::text
        AND project_collaborators.user_id::text = (select auth.uid())::text
      )
    )
  )
);

CREATE POLICY "Users can upload files to owned projects"
ON public.project_files
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_files.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

CREATE POLICY "Users can delete files from owned projects"
ON public.project_files
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_files.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

-- ==================== USER_PROFILES ====================

-- Create proper RLS policies for user_profiles
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND id::text = (select auth.uid())::text
);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND id::text = (select auth.uid())::text
);

-- Allow viewing profiles of project collaborators
CREATE POLICY "Users can view collaborator profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    JOIN public.projects p ON p.id::text = pc.project_id::text
    WHERE pc.user_id::text = user_profiles.id::text
    AND p.owner_id::text = (select auth.uid())::text
  )
);

-- ==================== STORAGE.OBJECTS ====================

-- Note: Storage policies are in storage schema, handle separately if needed
-- These warnings are expected if you allow authenticated downloads
-- Consider if anonymous access is truly needed for your use case

-- ============================================================================
-- PART 3: Add security comments
-- ============================================================================

COMMENT ON POLICY "Users can view own projects" ON public.projects
IS 'Secured: Explicitly checks auth.uid() IS NOT NULL to exclude anonymous users';

COMMENT ON POLICY "Users can view ideas in accessible projects" ON public.ideas
IS 'Secured: Explicitly checks auth.uid() IS NOT NULL to exclude anonymous users';

COMMENT ON POLICY "Users can view roadmaps for accessible projects" ON public.project_roadmaps
IS 'Secured: Explicitly checks auth.uid() IS NOT NULL to exclude anonymous users';

COMMENT ON POLICY "Users can view insights for accessible projects" ON public.project_insights
IS 'Secured: Explicitly checks auth.uid() IS NOT NULL to exclude anonymous users';
