# Phase 05 Plan 02 — Invitations backend (retroactive summary)

**Status:** ✅ Complete
**Completed via:** Phase 05.1 + 05.2 + 05.3 commits during UAT
**Summary written:** 2026-04-08 retroactively

## What shipped

The invitations backend landed in Phase 5 but was only verified end-to-end after Phases 05.1/05.2/05.3 surfaced and fixed 13 latent bugs. By the time Phase 06 shipped, this plan's scope was fully delivered and user-verified.

### Delivered artifacts

- `api/invitations/create.ts` — POST handler that creates `project_invitations` row with hashed token, returns `inviteUrl`
- `api/invitations/lookup.ts` — GET handler that previews an invitation (project name, role, inviter) without auth, used by the accept landing page
- `api/invitations/accept.ts` — POST handler that atomically calls the `accept_invitation()` SECURITY DEFINER RPC, with idempotent fallback via service-role lookup and self-heal insert if the collaborator row was manually removed
- `api/_lib/invitationTokens.ts` — UUID generator + SHA-256 hash helper (matches Postgres `extensions.digest(p_token::text, 'sha256'::text)`)
- `src/pages/InvitationAcceptPage.tsx` — landing page at `/invite#token=…` that performs lookup, renders auth screen if needed, then POSTs to accept, then redirects into the project
- `supabase/migrations/20260408000000_phase5_collab_schema.sql` — `project_invitations` table with RLS, unique token_hash constraint, `accept_invitation(p_token text)` PLPGSQL function
- `supabase/migrations/20260408120000_phase5_collab_projects_select.sql` + `20260408130000_phase5_collab_projects_select_fix.sql` — widened `projects` SELECT policy to include collaborators via `is_project_collaborator` SECURITY DEFINER helper
- `supabase/migrations/20260408140000_phase5_accept_invitation_digest_fix.sql` — qualified `extensions.digest()` call
- `supabase/migrations/20260408150000_phase5_accept_invitation_ambiguity_fix.sql` — `#variable_conflict use_column` directive

### Phase 5.2 integration

`POST /api/invitations/create` also fires a Resend email via `sendInviteEmail` (best-effort, after the row insert). Email template lives in `api/_lib/inviteEmailTemplate.ts`. Covered in detail by Phase 05.2.

## Verification

Verified end-to-end by the user via real browser testing:
1. Sean (owner) invites bobby@lakehouse.net via the modal
2. Resend email arrives from `noreply@prioritas.ai`
3. Bobby clicks the CTA → lands on `/invite#token=…`
4. Bobby signs up, accept runs, redirected into the shared Rivr project
5. Bobby sees Rivr in their project list (powered by the `getUserProjects` collaborator-join fix from 05.3)

## Canonical reference

All 12 bugs found between initial ship and final verification are catalogued in `.planning/phases/05.3-phase5-hardening-bugs-from-05.1-caller-migration/05.3-SUMMARY.md`. That document is the honest record of what was needed to actually make this plan's deliverables user-visible.
