---
phase: 05-real-time-collaboration
plan: 01-schema-and-fixtures
subsystem: data-layer
tags: [supabase, rls, realtime, voting, invitations, collaborators, wave-0]
requires: []
provides:
  - idea_votes table with 5-dot RLS budget
  - project_collaborators table with viewer/editor roles
  - project_invitations table with hashed-token + accept_invitation() RPC
  - voteRepository, collaboratorRepository, invitationRepository
  - mockRealtimeChannel fixture
  - 7 wave-0 test stubs
affects:
  - supabase_realtime publication
tech-stack:
  added: []
  patterns: [repository, RLS-with-check, security-definer-rpc, multiplexed-realtime-channel]
key-files:
  created:
    - supabase/migrations/20260408_phase5_collab_schema.sql
    - src/lib/repositories/voteRepository.ts
    - src/lib/repositories/collaboratorRepository.ts
    - src/lib/repositories/invitationRepository.ts
    - src/lib/repositories/__tests__/voteRepository.test.ts
    - src/test/fixtures/mockRealtimeChannel.ts
    - src/hooks/__tests__/useProjectRealtime.test.ts
    - src/lib/realtime/__tests__/multiClient.test.ts
    - api/__tests__/invitations.create.test.ts
    - api/__tests__/invitations.accept.test.ts
    - src/hooks/__tests__/useDotVoting.test.ts
    - tests/e2e/matrix-drag-sync.spec.ts
  modified:
    - .planning/phases/05-real-time-collaboration/05-VALIDATION.md
decisions:
  - Token storage uses SHA-256 hash; raw token only in invite URL fragment
  - accept_invitation() runs SECURITY DEFINER as the only path to insert collaborators from invitations
  - 5-dot budget enforced exclusively by RLS with check count subquery (client-side checks are advisory only)
  - Repositories use functional exports (not classes) since each is small and stateless
metrics:
  duration: ~25min
  completed: 2026-04-07
requirements: [COLLAB-03, COLLAB-04, COLLAB-05]
---

# Phase 05 Plan 01: Schema and Fixtures Summary

Phase 5 data foundation: three RLS-enforced tables (idea_votes with 5-dot budget, project_collaborators viewer/editor, project_invitations with hashed tokens + accept_invitation SECURITY DEFINER), three matching repositories, and the Wave 0 test scaffolding (mockRealtimeChannel fixture + 7 skip-stubs) downstream Phase 5 plans turn green.

## What Shipped

**Migration `20260408_phase5_collab_schema.sql`**
- `idea_votes (id, user_id, idea_id, session_id, created_at)` with unique `(user_id, idea_id, session_id)` and indexes on session_id, idea_id, user_id.
- `project_collaborators (project_id, user_id, role check viewer|editor, invited_by, joined_at)` PK on `(project_id, user_id)`.
- `project_invitations (id, project_id, email, token_hash unique, role, invited_by, expires_at, accepted_at, created_at)`.
- RLS enabled on all three. Vote SELECT requires session_participants membership; INSERT enforces `count(*) ... < 5`; DELETE allows only own. Collaborator/invitation writes are owner-gated via `exists (select 1 from projects p where p.user_id = auth.uid())`.
- `accept_invitation(p_token)` SECURITY DEFINER function: SHA-256 hashes token, validates not expired/accepted, inserts collaborator, marks accepted, returns `(project_id, role)`. `revoke all` then `grant execute to authenticated`.
- All three tables added to `supabase_realtime` publication.

**Repositories (src/lib/repositories/)**
- `voteRepository.ts` — `castVote, removeVote, listVotesForSession, countForUser, reconcileTallies`. `castVote` maps Postgres `42501` (RLS reject) to `{ ok: false, reason: 'budget_exceeded' }`.
- `collaboratorRepository.ts` — `listForProject, removeCollaborator, getRoleForUser` (owner check first, then collaborator row).
- `invitationRepository.ts` — `createInvitation, listPendingForProject, revokeInvitation`.
- 4/4 voteRepository unit tests pass: success insert, budget_exceeded mapping, countForUser, reconcileTallies aggregation.

**Wave 0 fixtures and stubs**
- `src/test/fixtures/mockRealtimeChannel.ts` — typed Supabase Realtime emulator. Supports `.on(postgres_changes|broadcast|presence, ...)` chain, `.subscribe(cb)`, `.send`, `.track`, `.presenceState`, plus test-only `.emitPostgresChange({...})`.
- 6 vitest skip-stubs (COLLAB-01..06) and 1 playwright skip-stub (COLLAB-07). All discoverable; none failing.
- `05-VALIDATION.md` Per-Task Verification Map populated with 11 rows (plans 01–04, T1..Tn). `wave_0_complete: true`.

## Verification

- `npx vitest run src/lib/repositories/__tests__/voteRepository.test.ts` → 4/4 green.
- `npx vitest run src/hooks/__tests__/useProjectRealtime.test.ts src/lib/realtime/__tests__/multiClient.test.ts api/__tests__/invitations.create.test.ts api/__tests__/invitations.accept.test.ts src/hooks/__tests__/useDotVoting.test.ts` → 5 files / 5 todo, all skipped, zero failures.
- Migration grep: 3 `create table`, count subquery present (split across two lines), `accept_invitation`, all three `alter publication` lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Force-add migration file under `*.sql` gitignore**
- **Found during:** Task 1 commit
- **Issue:** `.gitignore` line 110 blanket-ignores `*.sql`, blocking the migration commit.
- **Fix:** Used `git add -f` since the file is an intentional plan deliverable. No `.gitignore` rewrite (out of scope).
- **Files modified:** none additional
- **Commit:** 7378b8a

**2. [Rule 2 - Critical hardening] `revoke all` + `grant execute to authenticated` on accept_invitation()**
- **Found during:** Task 1
- **Issue:** SECURITY DEFINER functions default to `PUBLIC` execute, which would let unauthenticated requests probe the function.
- **Fix:** Added explicit `revoke all on function ... from public; grant execute ... to authenticated;` after the function definition.
- **Commit:** 7378b8a

## Auth Gates

None.

## Threat Model Coverage

| Threat | Mitigation Landed |
|--------|-------------------|
| T-05-01 vote stuffing | RLS `with check (count(*) < 5)` on idea_votes INSERT |
| T-05-02 collaborator escalation | Owner-only RLS on project_collaborators writes + role check constraint |
| T-05-03 token disclosure | Only `token_hash` (sha256 hex) stored; no raw token column |
| T-05-04 accept tampering | No UPDATE policy on project_invitations; accept_invitation() is the only mutation path |
| T-05-05 vote deletion of others | RLS `using (user_id = auth.uid())` on DELETE |
| T-05-06 vote tally disclosure | SELECT requires session_participants membership |

## Known Stubs

The 7 Wave 0 test files are intentional skip-stubs (`describe.skip` / `test.skip`). Each is documented to be filled by a specific downstream plan. They are tracked in `05-VALIDATION.md`. Not premature completion — they exist so downstream plans have stable `<automated>` paths.

## Self-Check: PASSED

- supabase/migrations/20260408_phase5_collab_schema.sql — FOUND
- src/lib/repositories/voteRepository.ts — FOUND
- src/lib/repositories/collaboratorRepository.ts — FOUND
- src/lib/repositories/invitationRepository.ts — FOUND
- src/lib/repositories/__tests__/voteRepository.test.ts — FOUND
- src/test/fixtures/mockRealtimeChannel.ts — FOUND
- 6 stub test files + 1 playwright stub — FOUND
- Commits 7378b8a, 8404307, ca4aceb — FOUND in git log
