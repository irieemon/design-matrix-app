-- Add missing SELECT and UPDATE RLS policies on project_files.
--
-- Context: project_files had only INSERT and DELETE policies. When
-- supabase-js runs `.insert([...]).select()`, PostgREST issues an
-- INSERT ... RETURNING * which requires SELECT permission on the returned
-- row. Without a SELECT policy, PostgreSQL raises 42501 "new row violates
-- row-level security policy" — misleading because the INSERT WITH CHECK
-- actually passed; it's the RETURNING that was denied.
--
-- This blocked the entire image analysis pipeline (AIIdeaModal →
-- FileService.uploadFile → `.select().single()`) and any other feature
-- that reads project files back.
--
-- Policies mirror the existing INSERT policy: user must own the parent
-- project (projects.owner_id = auth.uid()).

CREATE POLICY "Users can view files in owned projects"
ON public.project_files
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_files.project_id::text
    AND projects.owner_id::text = ((SELECT auth.uid()))::text
  )
);

CREATE POLICY "Users can update files in owned projects"
ON public.project_files
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_files.project_id::text
    AND projects.owner_id::text = ((SELECT auth.uid()))::text
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = project_files.project_id::text
    AND projects.owner_id::text = ((SELECT auth.uid()))::text
  )
);
