-- Enable RLS on project_roadmaps table
ALTER TABLE public.project_roadmaps ENABLE ROW LEVEL SECURITY;

-- Enable RLS on project_insights table
ALTER TABLE public.project_insights ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for project_roadmaps
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

-- Add RLS policies for project_insights
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

-- Add comment explaining the security model
COMMENT ON TABLE public.project_roadmaps IS 'RLS enabled: Users can view roadmaps for projects they own, collaborate on, or are public';
COMMENT ON TABLE public.project_insights IS 'RLS enabled: Users can view insights for projects they own, collaborate on, or are public';
