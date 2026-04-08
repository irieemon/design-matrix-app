-- migration:    20260408140000_phase5_accept_invitation_digest_fix
-- phase:        05.1 (extension - hotfix)
-- summary:      Phase 5's accept_invitation() function used unqualified digest()
--               from pgcrypto, but Supabase installs pgcrypto into the
--               `extensions` schema. With the function's search_path locked to
--               `public`, the call fails at runtime with
--                  function digest(text, unknown) does not exist  (SQLSTATE 42883)
--               and every accept attempt 400s.
--
--               Fix: redefine the function to qualify the call as
--               extensions.digest() and explicit-cast 'sha256' to text so the
--               correct overload resolves.
--
-- forward:
create or replace function public.accept_invitation(p_token text)
returns table (project_id uuid, role text)
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.project_invitations%rowtype;
begin
  select * into v_inv from public.project_invitations
   where token_hash = encode(extensions.digest(p_token::text, 'sha256'::text), 'hex')
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

-- rollback:
-- Restore the unqualified call (will be broken on Supabase but matches
-- the original Phase 5 schema migration verbatim).
-- create or replace function public.accept_invitation(p_token text)
-- returns table (project_id uuid, role text)
-- language plpgsql security definer set search_path = public as $$
-- declare v_inv public.project_invitations%rowtype;
-- begin
--   select * into v_inv from public.project_invitations
--    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
--      and accepted_at is null and expires_at > now() for update;
--   if not found then raise exception 'invalid_or_expired'; end if;
--   insert into public.project_collaborators (project_id, user_id, role, invited_by, joined_at)
--   values (v_inv.project_id, auth.uid(), v_inv.role, v_inv.invited_by, now())
--   on conflict (project_id, user_id) do update set role = excluded.role;
--   update public.project_invitations set accepted_at = now() where id = v_inv.id;
--   return query select v_inv.project_id, v_inv.role;
-- end $$;
