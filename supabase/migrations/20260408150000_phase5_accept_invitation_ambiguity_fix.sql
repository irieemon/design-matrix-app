-- migration:    20260408150000_phase5_accept_invitation_ambiguity_fix
-- phase:        05.1 (extension - hotfix)
-- summary:      The accept_invitation() OUT parameters (project_id, role) shadow
--               column names referenced inside the function body, producing
--                  column reference "project_id" is ambiguous   (SQLSTATE 42702)
--               at the INSERT into project_collaborators. Phase 5 caught the
--               digest() schema bug but not this one because no end-to-end test
--               actually invoked the RPC under the SECURITY DEFINER path until
--               Phase 05.1's caller migration exposed it.
--
--               Fix: declare `#variable_conflict use_column` so unqualified
--               identifiers inside the function resolve to columns first, with
--               OUT parameters only used in the final RETURN QUERY.
--
-- forward:
create or replace function public.accept_invitation(p_token text)
returns table (project_id uuid, role text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
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

  project_id := v_inv.project_id;
  role       := v_inv.role;
  return next;
end $$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

-- rollback: prior buggy version (kept for reference, do not actually use)
