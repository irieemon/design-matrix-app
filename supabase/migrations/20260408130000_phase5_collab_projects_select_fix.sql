-- migration:    20260408130000_phase5_collab_projects_select_fix
-- phase:        05.1 (extension - hotfix)
-- summary:      Fix infinite recursion in projects SELECT policy.
--               20260408120000 widened the projects SELECT policy to look up
--               project_collaborators, but project_collaborators has its own RLS
--               policy that looks up projects, producing a cycle:
--                 projects.SELECT  -> project_collaborators.SELECT
--                 project_collaborators.SELECT -> projects (via owner check)
--               Postgres aborts with "infinite recursion detected in policy".
--
--               Fix: introduce a SECURITY DEFINER helper that checks membership
--               directly against project_collaborators with RLS suspended for
--               that single query, then have the projects policy call the helper.
--
-- forward:
create or replace function public.is_project_collaborator(_project_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.project_collaborators
    where project_id = _project_id
      and user_id    = _user_id
  );
$$;

revoke all on function public.is_project_collaborator(uuid, uuid) from public;
grant execute on function public.is_project_collaborator(uuid, uuid) to authenticated;

drop policy if exists "Users can view projects" on public.projects;
create policy "Users can view projects"
on public.projects
for select
using (
  (select auth.uid()) = owner_id
  or is_admin()
  or public.is_project_collaborator(id, (select auth.uid()))
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
-- drop function if exists public.is_project_collaborator(uuid, uuid);
