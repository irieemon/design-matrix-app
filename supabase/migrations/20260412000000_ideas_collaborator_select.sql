-- Phase 12 (ADR-0012 Step 2a): Allow project collaborators to SELECT ideas
--
-- The existing "Users and admins can view ideas" policy (20251117193000) only
-- allows the project owner or admin. Collaborators with project_collaborators
-- rows cannot see idea cards, which breaks T-054B-302 and T-054B-303 E2E tests
-- and is also a production bug (collaborators should see project ideas).
--
-- This migration drops the old owner-only SELECT policy and re-creates it with
-- a collaborator EXISTS clause. The INSERT/UPDATE/DELETE policies are left
-- unchanged — collaborator write access is a separate concern.
--
-- NOTE: The policy was renamed from "Users can view ideas" (20251117190000) to
-- "Users and admins can view ideas" (20251117193000). Both DROP targets are
-- listed with IF EXISTS for safety across environments that may differ.

DROP POLICY IF EXISTS "Users and admins can view ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can view ideas" ON public.ideas;

CREATE POLICY "Users and collaborators can view ideas"
ON public.ideas
FOR SELECT
USING (
  (select auth.uid()) = (SELECT owner_id FROM public.projects WHERE id = ideas.project_id)
  OR is_admin()
  OR public.is_project_collaborator(ideas.project_id, (select auth.uid()))
);
