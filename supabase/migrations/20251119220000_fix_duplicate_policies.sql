-- Fix duplicate RLS policies on project_insights table
-- This resolves Supabase linter warnings about multiple permissive policies
-- for the same role and action, which degrades query performance

-- Drop ALL existing policies first to ensure clean state
DROP POLICY IF EXISTS "Users can delete insights for owned projects" ON project_insights;
DROP POLICY IF EXISTS "Users can delete their own insights" ON project_insights;
DROP POLICY IF EXISTS "Users can create insights for owned projects" ON project_insights;
DROP POLICY IF EXISTS "Users can insert insights for their projects" ON project_insights;
DROP POLICY IF EXISTS "Users can view insights for accessible projects" ON project_insights;
DROP POLICY IF EXISTS "Users can view insights for their projects" ON project_insights;
DROP POLICY IF EXISTS "Users can update insights for owned projects" ON project_insights;
DROP POLICY IF EXISTS "Users can update their own insights" ON project_insights;

-- Create single, optimized policy for each action
-- Each policy checks project ownership through the projects table

-- SELECT Policy: Users can view insights for projects they own
CREATE POLICY "project_insights_select_policy"
ON project_insights
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IN (
    SELECT owner_id FROM projects WHERE id = project_insights.project_id
  )
  OR is_admin()
);

-- INSERT Policy: Users can create insights for projects they own
CREATE POLICY "project_insights_insert_policy"
ON project_insights
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) IN (
    SELECT owner_id FROM projects WHERE id = project_insights.project_id
  )
  OR is_admin()
);

-- UPDATE Policy: Users can update insights for projects they own
CREATE POLICY "project_insights_update_policy"
ON project_insights
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) IN (
    SELECT owner_id FROM projects WHERE id = project_insights.project_id
  )
  OR is_admin()
)
WITH CHECK (
  (SELECT auth.uid()) IN (
    SELECT owner_id FROM projects WHERE id = project_insights.project_id
  )
  OR is_admin()
);

-- DELETE Policy: Users can delete insights for projects they own
CREATE POLICY "project_insights_delete_policy"
ON project_insights
FOR DELETE
TO authenticated
USING (
  (SELECT auth.uid()) IN (
    SELECT owner_id FROM projects WHERE id = project_insights.project_id
  )
  OR is_admin()
);

-- Verify policies were created
DO $$
BEGIN
  RAISE NOTICE 'RLS policies for project_insights optimized successfully';
  RAISE NOTICE 'Removed duplicate policies to improve query performance';
END $$;
