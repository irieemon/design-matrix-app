-- ============================================================================
-- Phase 5: Real-Time Collaboration — Schema, RLS, and Realtime Publication
-- ----------------------------------------------------------------------------
-- phase:        05-real-time-collaboration
-- date:         2026-04-08
-- requirements: COLLAB-03, COLLAB-04, COLLAB-05
-- author:       gsd-planner
-- summary:      Adds idea_votes (5-dot budget enforced via RLS), project_collaborators
--               (viewer/editor roles), project_invitations (hashed token + accept_invitation()
--               SECURITY DEFINER function), and registers all three with the
--               supabase_realtime publication.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- idea_votes — dot voting (5-dot budget per user per session)
-- ----------------------------------------------------------------------------
create table if not exists public.idea_votes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  idea_id    uuid not null references public.ideas(id) on delete cascade,
  session_id uuid not null references public.brainstorm_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, idea_id, session_id)
);

create index if not exists idea_votes_session_idx on public.idea_votes (session_id);
create index if not exists idea_votes_idea_idx    on public.idea_votes (idea_id);
create index if not exists idea_votes_user_idx    on public.idea_votes (user_id);

alter table public.idea_votes enable row level security;

drop policy if exists "session participants read votes" on public.idea_votes;
create policy "session participants read votes" on public.idea_votes
for select using (
  exists (
    select 1 from public.session_participants sp
    where sp.session_id = idea_votes.session_id
      and sp.user_id = auth.uid()
  )
);

drop policy if exists "cast vote within budget" on public.idea_votes;
create policy "cast vote within budget" on public.idea_votes
for insert with check (
  user_id = auth.uid()
  and (select count(*) from public.idea_votes v
        where v.user_id = auth.uid()
          and v.session_id = idea_votes.session_id) < 5
);

drop policy if exists "remove own vote" on public.idea_votes;
create policy "remove own vote" on public.idea_votes
for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- project_collaborators — viewer/editor roles attached to a project
-- ----------------------------------------------------------------------------
create table if not exists public.project_collaborators (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('viewer','editor')),
  invited_by uuid references auth.users(id),
  joined_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_collaborators_user_idx on public.project_collaborators (user_id);

alter table public.project_collaborators enable row level security;

drop policy if exists "collaborators visible to self or owner" on public.project_collaborators;
create policy "collaborators visible to self or owner" on public.project_collaborators
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = project_collaborators.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "owner inserts collaborators" on public.project_collaborators;
create policy "owner inserts collaborators" on public.project_collaborators
for insert with check (
  exists (
    select 1 from public.projects p
    where p.id = project_collaborators.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "owner updates collaborators" on public.project_collaborators;
create policy "owner updates collaborators" on public.project_collaborators
for update using (
  exists (
    select 1 from public.projects p
    where p.id = project_collaborators.project_id
      and p.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.projects p
    where p.id = project_collaborators.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "owner deletes collaborators" on public.project_collaborators;
create policy "owner deletes collaborators" on public.project_collaborators
for delete using (
  exists (
    select 1 from public.projects p
    where p.id = project_collaborators.project_id
      and p.user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- project_invitations — hashed-token email invitations
-- ----------------------------------------------------------------------------
create table if not exists public.project_invitations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  email       text not null,
  token_hash  text not null unique,
  role        text not null check (role in ('viewer','editor')),
  invited_by  uuid references auth.users(id),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists project_invitations_project_idx on public.project_invitations (project_id);
create index if not exists project_invitations_email_idx   on public.project_invitations (email);

alter table public.project_invitations enable row level security;

drop policy if exists "invitations visible to inviter or owner" on public.project_invitations;
create policy "invitations visible to inviter or owner" on public.project_invitations
for select using (
  invited_by = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = project_invitations.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "owner creates invitations" on public.project_invitations;
create policy "owner creates invitations" on public.project_invitations
for insert with check (
  exists (
    select 1 from public.projects p
    where p.id = project_invitations.project_id
      and p.user_id = auth.uid()
  )
);

-- No direct UPDATE policy: accepts must go through accept_invitation() SECURITY DEFINER fn.
drop policy if exists "owner revokes invitations" on public.project_invitations;
create policy "owner revokes invitations" on public.project_invitations
for delete using (
  exists (
    select 1 from public.projects p
    where p.id = project_invitations.project_id
      and p.user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- accept_invitation() — atomic token validation + collaborator creation
-- ----------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token text)
returns table (project_id uuid, role text)
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.project_invitations%rowtype;
begin
  select * into v_inv from public.project_invitations
   where token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and accepted_at is null
     and expires_at > now()
   for update;
  if not found then
    raise exception 'invalid_or_expired';
  end if;

  insert into public.project_collaborators (project_id, user_id, role, invited_by, joined_at)
  values (v_inv.project_id, auth.uid(), v_inv.role, v_inv.invited_by, now())
  on conflict (project_id, user_id) do update set role = excluded.role;

  update public.project_invitations set accepted_at = now() where id = v_inv.id;

  return query select v_inv.project_id, v_inv.role;
end $$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Realtime publication — required so Postgres Changes events fire for new tables
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.idea_votes;
alter publication supabase_realtime add table public.project_collaborators;
alter publication supabase_realtime add table public.project_invitations;
