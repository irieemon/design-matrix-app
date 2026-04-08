-- migration:    20260408_phase5_collab_projects_select
-- phase:        05.1 (extension)
-- summary:      Allow Phase-5 collaborators to SELECT projects shared with them.
--               Phase 5 introduced project_collaborators rows but the projects RLS
--               SELECT policy from 20251117190000_fix_all_rls_warnings still only
--               allowed owner_id = auth.uid() OR is_admin(), so accepted invitees
--               saw an empty project list. This patch widens the SELECT policy to
--               also include rows where the caller has a project_collaborators row.
--
-- forward:
drop policy if exists "Users can view projects" on public.projects;
create policy "Users can view projects"
on public.projects
for select
using (
  (select auth.uid()) = owner_id
  or is_admin()
  or exists (
    select 1
    from public.project_collaborators pc
    where pc.project_id = projects.id
      and pc.user_id = (select auth.uid())
  )
);

-- rollback:
-- drop policy if exists "Users can view projects" on public.projects;
-- create policy "Users can view projects"
-- on public.projects
-- for select
-- using (
--   (select auth.uid()) = owner_id
--   or is_admin()
-- );
