-- RLS Performance Optimization Migration
-- Fixes auth_rls_initplan and multiple_permissive_policies warnings
-- Date: 2025-10-02

-- ============================================================================
-- PART 1: Fix auth.uid() to use subquery pattern for better performance
-- ============================================================================

-- Fix project_roadmaps policies (created in enable_rls_roadmaps_insights.sql)
DROP POLICY IF EXISTS "Users can view roadmaps for accessible projects" ON public.project_roadmaps;
CREATE POLICY "Users can view roadmaps for accessible projects"
ON public.project_roadmaps
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
  EXISTS (
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
  EXISTS (
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
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_roadmaps.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

-- Fix project_insights policies
DROP POLICY IF EXISTS "Users can view insights for accessible projects" ON public.project_insights;
CREATE POLICY "Users can view insights for accessible projects"
ON public.project_insights
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
  EXISTS (
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
  EXISTS (
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
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_insights.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

-- Fix existing projects policies
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects"
ON public.projects
FOR SELECT
TO authenticated
USING (owner_id::text = (select auth.uid())::text);

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (owner_id::text = (select auth.uid())::text);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (owner_id::text = (select auth.uid())::text);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
ON public.projects
FOR DELETE
TO authenticated
USING (owner_id::text = (select auth.uid())::text);

-- Fix existing ideas policies
DROP POLICY IF EXISTS "Users can view ideas in accessible projects" ON public.ideas;
CREATE POLICY "Users can view ideas in accessible projects"
ON public.ideas
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
WITH CHECK (created_by::text = (select auth.uid())::text);

DROP POLICY IF EXISTS "Users can update ideas" ON public.ideas;
CREATE POLICY "Users can update ideas"
ON public.ideas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
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
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = ideas.project_id::text
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

-- Fix teams policy
DROP POLICY IF EXISTS "Team owners can update teams" ON public.teams;
CREATE POLICY "Team owners can update teams"
ON public.teams
FOR UPDATE
TO authenticated
USING (owner_id::text = (select auth.uid())::text);

-- ============================================================================
-- PART 2: Remove duplicate/redundant policies
-- ============================================================================

-- Remove open access policies (these were temporary development policies)
-- We now have proper RLS policies in place
DROP POLICY IF EXISTS "open_projects_access_v2" ON public.projects;
DROP POLICY IF EXISTS "open_teams_access_v2" ON public.teams;
DROP POLICY IF EXISTS "open_ideas_access_v2" ON public.ideas;

-- Remove duplicate realtime policies (realtime works with regular policies)
DROP POLICY IF EXISTS "ideas_realtime_policy" ON public.ideas;
DROP POLICY IF EXISTS "Enable realtime for authenticated users" ON public.projects;
DROP POLICY IF EXISTS "Projects are viewable by authenticated users" ON public.projects;

-- ============================================================================
-- PART 3: Add performance comments
-- ============================================================================

COMMENT ON POLICY "Users can view roadmaps for accessible projects" ON public.project_roadmaps
IS 'Performance optimized: auth.uid() wrapped in subquery';

COMMENT ON POLICY "Users can view insights for accessible projects" ON public.project_insights
IS 'Performance optimized: auth.uid() wrapped in subquery';

COMMENT ON POLICY "Users can view own projects" ON public.projects
IS 'Performance optimized: auth.uid() wrapped in subquery';

COMMENT ON POLICY "Users can view ideas in accessible projects" ON public.ideas
IS 'Performance optimized: auth.uid() wrapped in subquery';
