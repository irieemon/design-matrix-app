-- migration:    20260419100000_phase13_accept_invitation_email_match
-- phase:        13 (sentinel remediation)
-- summary:      Phase 13 Sentinel BLOCKER #2 (CWE-862: Missing Authorization).
--
--               The accept_invitation() RPC selected invitations by token_hash
--               only, omitting an email-match check. Any authenticated user in
--               possession of a valid raw token could accept an invitation that
--               was addressed to someone else, silently joining a project they
--               were never invited to.
--
--               Fix: add `lower(email) = lower(auth.email())` to the SELECT
--               WHERE clause so the SECURITY DEFINER path only resolves an
--               invitation when the caller's authenticated email matches the
--               invitation's addressee. The raw token alone is no longer a
--               sufficient capability; the token AND the mailbox are both
--               required.
--
--               Reference: auth.email() is a Supabase-provided helper exposing
--               the JWT `email` claim on the Postgres side — available in any
--               function that runs under a Supabase authenticated session.
--               See https://supabase.com/docs/guides/database/functions#auth.email
--
--               All previously-established guards are preserved verbatim:
--                 - token_hash match (sha256 via extensions.digest)
--                 - accepted_at is null
--                 - expires_at > now()
--                 - `for update` row lock
--                 - `#variable_conflict use_column` for OUT-parameter shadowing
--                 - insert into project_collaborators with auth.uid()
--                 - update project_invitations.accepted_at = now()
--                 - return shape (project_id, role)
--                 - grants (revoke from public, grant execute to authenticated)
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
     and lower(email) = lower(auth.email())
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

-- rollback: restore the pre-Phase-13 ambiguity-fix version (no email match).
-- Kept for reference; applying the rollback reintroduces CWE-862.
