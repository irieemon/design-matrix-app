-- Enable RLS on project_insights table
ALTER TABLE project_insights ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view insights for their projects" ON project_insights;
DROP POLICY IF EXISTS "Users can insert insights for their projects" ON project_insights;
DROP POLICY IF EXISTS "Users can update their own insights" ON project_insights;
DROP POLICY IF EXISTS "Admins have full access to insights" ON project_insights;

-- Policy: Users can view insights for projects they own
CREATE POLICY "Users can view insights for their projects"
ON project_insights
FOR SELECT
USING (
  (SELECT auth.uid()) IN (
    SELECT owner_id FROM projects WHERE id = project_insights.project_id
  )
  OR is_admin()
);

-- Policy: Users can insert insights for projects they own
CREATE POLICY "Users can insert insights for their projects"
ON project_insights
FOR INSERT
WITH CHECK (
  (SELECT auth.uid()) IN (
    SELECT owner_id FROM projects WHERE id = project_insights.project_id
  )
  OR is_admin()
);

-- Policy: Users can update insights for projects they own
CREATE POLICY "Users can update their own insights"
ON project_insights
FOR UPDATE
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

-- Policy: Users can delete insights for projects they own
CREATE POLICY "Users can delete their own insights"
ON project_insights
FOR DELETE
USING (
  (SELECT auth.uid()) IN (
    SELECT owner_id FROM projects WHERE id = project_insights.project_id
  )
  OR is_admin()
);

-- Verify policies were created
DO $$
BEGIN
  RAISE NOTICE 'RLS policies for project_insights created successfully';
END $$;
