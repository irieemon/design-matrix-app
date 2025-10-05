-- Fix Infinite Recursion in project_collaborators RLS Policy
-- Date: 2025-10-03
-- Issue: Policy recursively queries itself, causing PostgreSQL error 42P17
-- Error: "infinite recursion detected in policy for relation 'project_collaborators'"
--
-- Root Cause:
-- The policy checked if user is a collaborator by querying project_collaborators,
-- which triggered the same policy again, creating an infinite loop.
--
-- Fix:
-- Remove the recursive collaborator check. Only project owners need to see
-- the collaborator list. Collaborators can still access project resources
-- through other policies (project_files, ideas, etc.)

-- ============================================================================
-- FIX: Remove Recursive Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can view collaborators of accessible projects"
  ON public.project_collaborators;

CREATE POLICY "Users can view collaborators of accessible projects"
ON public.project_collaborators
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_collaborators.project_id::text
    -- Only check if user is the project owner
    -- This prevents recursion by NOT querying project_collaborators again
    AND projects.owner_id::text = (select auth.uid())::text
  )
);

-- Add documentation
COMMENT ON POLICY "Users can view collaborators of accessible projects"
  ON public.project_collaborators
IS 'Fixed (2025-10-03): Removed recursive collaborator check to prevent infinite recursion (error 42P17). Only project owners can view the collaborator list. Collaborators still have access to project resources through other policies.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these after applying the migration to verify the fix:

-- 1. Check policy exists and is not recursive
-- SELECT policyname, qual::text
-- FROM pg_policies
-- WHERE tablename = 'project_collaborators'
-- AND policyname = 'Users can view collaborators of accessible projects';

-- 2. Test project_files query (should now work)
-- SELECT * FROM project_files WHERE project_id = '{your-project-id}' LIMIT 1;

-- 3. Verify RLS is still enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('project_collaborators', 'project_files');
