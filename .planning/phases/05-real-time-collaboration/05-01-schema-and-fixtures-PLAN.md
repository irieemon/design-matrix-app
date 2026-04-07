---
phase: 05-real-time-collaboration
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements: [COLLAB-03, COLLAB-04, COLLAB-05]
must_haves:
  truths:
    - "idea_votes, project_collaborators, project_invitations tables exist with RLS"
    - "6th vote in same session by same user is rejected by RLS with_check"
    - "New tables are in supabase_realtime publication"
    - "Wave 0 test fixtures exist and fail with MISSING implementation messages"
  artifacts:
    - path: supabase/migrations/20260408_phase5_collab_schema.sql
      contains: "create table public.idea_votes"
    - path: src/lib/repositories/voteRepository.ts
      exports: [castVote, removeVote, listVotesForSession, countForUser]
    - path: src/test/fixtures/mockRealtimeChannel.ts
      provides: "Shared mock Supabase channel with broadcast/presence/postgres_changes emulation"
  key_links:
    - from: idea_votes RLS
      to: "auth.uid() count < 5"
      pattern: "count\\(\\*\\).*< 5"
    - from: "alter publication supabase_realtime"
      to: "idea_votes, project_collaborators, project_invitations"
      pattern: "add table public\\.(idea_votes|project_collaborators|project_invitations)"
---

<objective>
Land the Phase 5 database foundation, repositories, and Wave 0 test scaffolding. This plan is the hard prerequisite for every other Phase 5 plan — nothing else can merge until RLS and fixtures exist. It covers the data layer for voting (COLLAB-05), invitations (COLLAB-03), and collaborator roles (COLLAB-04).

Purpose: No realtime wiring or API code can be trusted without RLS in place. Shipping schema + Wave 0 tests first means every downstream task has a red-to-green target.
Output: Three new tables with RLS + realtime publication entries, three repositories following the existing `src/lib/repositories/` pattern, and seven failing test files that downstream plans turn green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/05-real-time-collaboration/05-CONTEXT.md
@.planning/phases/05-real-time-collaboration/05-RESEARCH.md
@.planning/phases/05-real-time-collaboration/05-VALIDATION.md
@design-matrix-app/CLAUDE.md
@src/lib/repositories/ideaRepository.ts
@src/lib/repositories/sessionParticipantRepository.ts

<interfaces>
Repository pattern (extract from src/lib/repositories/ideaRepository.ts before coding):
- async functions take a Supabase client as first arg OR use the singleton from `src/lib/supabase.ts`
- return `{ data, error }` shapes OR throw — follow whichever ideaRepository uses
- use `logger` from `src/utils/logger.ts`, never console.*

Existing types to reuse (from src/types/index.ts):
- IdeaCard, Project, User

New types introduced by this plan (add to src/types/index.ts in later plan, not this one):
- VoteRow, CollaboratorRow, InvitationRow (plan 02 adds these; this plan keeps local types in repo files)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create Phase 5 SQL migration with RLS and realtime publication</name>
  <read_first>
    - supabase/migrations/ (list existing migrations to match naming convention and style)
    - src/lib/repositories/sessionParticipantRepository.ts (understand session_participants join used in vote-read RLS)
    - .planning/phases/05-real-time-collaboration/05-RESEARCH.md §"Dot-vote RLS policies" and §"Invitation accept"
    - .planning/phases/05-real-time-collaboration/05-CONTEXT.md §"Schema additions required"
  </read_first>
  <files>supabase/migrations/20260408_phase5_collab_schema.sql</files>
  <behavior>
    - Creates idea_votes (id uuid default gen_random_uuid(), user_id uuid not null references auth.users, idea_id uuid not null references ideas(id) on delete cascade, session_id uuid not null references brainstorm_sessions(id) on delete cascade, created_at timestamptz default now(), unique(user_id, idea_id, session_id))
    - Creates project_collaborators (project_id uuid references projects(id) on delete cascade, user_id uuid references auth.users, role text not null check (role in ('viewer','editor')), invited_by uuid references auth.users, joined_at timestamptz default now(), primary key(project_id, user_id))
    - Creates project_invitations (id uuid default gen_random_uuid() primary key, project_id uuid references projects(id) on delete cascade, email text not null, token_hash text not null unique, role text not null check (role in ('viewer','editor')), invited_by uuid references auth.users, expires_at timestamptz not null, accepted_at timestamptz, created_at timestamptz default now())
    - Enables RLS on all three
    - idea_votes policies: SELECT requires session_participants join (user is in the session); INSERT `with check` enforces user_id = auth.uid() AND `(select count(*) from idea_votes v where v.user_id = auth.uid() and v.session_id = idea_votes.session_id) < 5`; DELETE allows user_id = auth.uid()
    - project_collaborators policies: SELECT allows rows where user_id = auth.uid() OR project.user_id = auth.uid(); INSERT/UPDATE/DELETE only by project owner (exists projects p where p.id = project_id and p.user_id = auth.uid())
    - project_invitations policies: SELECT only by invited_by = auth.uid() or project owner; INSERT only by project owner; UPDATE (accept) only via accept_invitation() function
    - Creates `accept_invitation(p_token text) returns table (project_id uuid, role text)` security definer function per RESEARCH.md §"Invitation accept" example (hashes p_token with sha256, validates not expired and not accepted, inserts collaborator, marks accepted, returns project_id/role)
    - `alter publication supabase_realtime add table public.idea_votes, public.project_collaborators, public.project_invitations;`
  </behavior>
  <action>
    Write the migration file at supabase/migrations/20260408_phase5_collab_schema.sql containing EXACTLY the SQL described in <behavior>. Use the exact RLS patterns from 05-RESEARCH.md §"Dot-vote RLS policies" and §"Invitation accept (atomic via SECURITY DEFINER function)" — copy them directly, do not paraphrase. The count subquery in the insert with-check MUST read `(select count(*) from idea_votes v where v.user_id = auth.uid() and v.session_id = idea_votes.session_id) < 5` — this is the authoritative budget enforcement; the frontend cannot be trusted (per RESEARCH Pitfall 5).

    Use `pgcrypto` extension if not already enabled (`create extension if not exists pgcrypto;`) so `digest()` is available for token hashing.

    Verify the migration is idempotent-friendly by using `create table if not exists` and `drop policy if exists` guards only where safe. Include a header comment block with: phase=05, date=2026-04-08, requirements=COLLAB-03/04/05, author=gsd-planner.
  </action>
  <verify>
    <automated>test -f supabase/migrations/20260408_phase5_collab_schema.sql &amp;&amp; grep -q "create table.*idea_votes" supabase/migrations/20260408_phase5_collab_schema.sql &amp;&amp; grep -q "count(\*).*&lt; 5" supabase/migrations/20260408_phase5_collab_schema.sql &amp;&amp; grep -q "alter publication supabase_realtime add table public.idea_votes" supabase/migrations/20260408_phase5_collab_schema.sql &amp;&amp; grep -q "accept_invitation" supabase/migrations/20260408_phase5_collab_schema.sql</automated>
  </verify>
  <done>Migration file exists. Grep confirms: three CREATE TABLE statements, the 5-dot count constraint, realtime publication ALTER, and accept_invitation() function. File has header comment with phase/date/requirements metadata.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement voteRepository, collaboratorRepository, invitationRepository</name>
  <read_first>
    - src/lib/repositories/ideaRepository.ts (copy function signature and error-handling style)
    - src/lib/repositories/sessionParticipantRepository.ts
    - src/lib/supabase.ts (confirm singleton client export name)
    - src/utils/logger.ts (logger import path)
    - .planning/phases/05-real-time-collaboration/05-RESEARCH.md §"Vote tally with initial fetch + realtime delta"
  </read_first>
  <files>
    src/lib/repositories/voteRepository.ts,
    src/lib/repositories/collaboratorRepository.ts,
    src/lib/repositories/invitationRepository.ts,
    src/lib/repositories/__tests__/voteRepository.test.ts
  </files>
  <behavior>
    voteRepository exports:
    - `castVote(sessionId: string, ideaId: string): Promise<{ ok: true } | { ok: false; reason: 'budget_exceeded' | 'unauthorized' | 'unknown' }>`
    - `removeVote(sessionId: string, ideaId: string): Promise<void>`
    - `listVotesForSession(sessionId: string): Promise<Array<{ user_id: string; idea_id: string }>>`
    - `countForUser(sessionId: string, userId: string): Promise<number>`
    - `reconcileTallies(sessionId: string): Promise<Map<string, number>>` (idea_id -> count, used on reconnect per D-16)

    collaboratorRepository exports:
    - `listForProject(projectId: string): Promise<Array<{ user_id: string; role: 'viewer' | 'editor' }>>`
    - `removeCollaborator(projectId: string, userId: string): Promise<void>`
    - `getRoleForUser(projectId: string, userId: string): Promise<'owner' | 'viewer' | 'editor' | null>` (checks projects.user_id first, then project_collaborators)

    invitationRepository exports (data access only — HTTP endpoints live in plan 02):
    - `createInvitation(input: { projectId: string; email: string; role: 'viewer' | 'editor'; tokenHash: string; expiresAt: Date; invitedBy: string }): Promise<{ id: string }>`
    - `listPendingForProject(projectId: string): Promise<Array<{ id: string; email: string; role: string; expires_at: string }>>`
    - `revokeInvitation(invitationId: string): Promise<void>`

    voteRepository.test.ts unit tests (vitest, mocked supabase client):
    - `castVote returns { ok: true } on successful insert`
    - `castVote returns { ok: false, reason: 'budget_exceeded' } when supabase returns RLS violation (error code 42501)`
    - `countForUser returns number of rows`
    - `reconcileTallies returns Map keyed by idea_id with correct counts`
  </behavior>
  <action>
    Create the three repository files following the exact import style and error-return shape of `src/lib/repositories/ideaRepository.ts`. Use `supabase` singleton from `src/lib/supabase.ts`. Use `logger.debug/warn/error` from `src/utils/logger.ts`.

    For `castVote`, detect RLS budget rejection by checking Supabase error `code === '42501'` OR error message includes "with check"; map to `{ ok: false, reason: 'budget_exceeded' }`. This matches the RLS policy written in Task 1.

    For `reconcileTallies`, implement the exact pattern from RESEARCH.md §"Vote tally with initial fetch + realtime delta" initial fetch step: select idea_id from idea_votes where session_id=eq, reduce to Map.

    Write voteRepository.test.ts with vitest `describe/it`, mocking the supabase client via `vi.mock('../../supabase', () => ({ supabase: { from: vi.fn() } }))`. Set up mock chains for `.from('idea_votes').insert(...).select()` and `.from('idea_votes').select('idea_id').eq(...)`. Test cases per <behavior>. Tests must FAIL initially (RED) because this is first creation — that's fine, GREEN is in the same task once implementation lands.
  </action>
  <verify>
    <automated>npx vitest run src/lib/repositories/__tests__/voteRepository.test.ts</automated>
  </verify>
  <done>All four voteRepository tests pass. Three repository files exist with documented exports. No console.* calls (grep clean). No direct access to Supabase service role.</done>
</task>

<task type="auto">
  <name>Task 3: Create Wave 0 test fixtures and failing stubs for downstream plans</name>
  <read_first>
    - src/test/setup.ts (if exists) or vitest.config.ts to understand test env
    - tests/e2e/ (list existing specs to match naming + fixture style)
    - .planning/phases/05-real-time-collaboration/05-RESEARCH.md §"Wave 0 Gaps"
    - .planning/phases/05-real-time-collaboration/05-VALIDATION.md §"Per-Task Verification Map"
  </read_first>
  <files>
    src/test/fixtures/mockRealtimeChannel.ts,
    src/hooks/__tests__/useProjectRealtime.test.ts,
    src/lib/realtime/__tests__/multiClient.test.ts,
    api/__tests__/invitations.create.test.ts,
    api/__tests__/invitations.accept.test.ts,
    src/hooks/__tests__/useDotVoting.test.ts,
    tests/e2e/matrix-drag-sync.spec.ts,
    .planning/phases/05-real-time-collaboration/05-VALIDATION.md
  </files>
  <behavior>
    mockRealtimeChannel.ts exports `createMockChannel()` returning an object with:
    - `.on(event, filter, handler)` chainable, records handlers
    - `.send({ type, event, payload })` which invokes matching broadcast handlers synchronously
    - `.subscribe(cb)` immediately calls cb('SUBSCRIBED')
    - `.track(state)` records presence and fires presence sync handlers
    - `.emitPostgresChange({ table, event, new, old })` test helper to simulate DB events
    - `.presenceState()` returns tracked state
    - `.removeAllChannels()` cleanup

    Each `*.test.ts` stub file contains `describe.skip('<req>', () => { it.todo('MISSING — implemented in plan NN'); })` with a leading comment block: `// Wave 0 stub for COLLAB-XX. Implemented by plan 0N, task M.`

    matrix-drag-sync.spec.ts contains a single `test.skip('two-browser drag sync', ...)` placeholder with a TODO comment pointing at plan 04.

    05-VALIDATION.md Per-Task Verification Map table replaced with rows mapping every task in plans 01-04 to its `<automated>` command and requirement ID.
  </behavior>
  <action>
    Write `mockRealtimeChannel.ts` as a factory. Use TypeScript interfaces — no `any`. The mock must support the `.on('postgres_changes', filter, handler).on('broadcast', {event}, handler).on('presence', {event}, handler).subscribe()` chain shape seen in `src/lib/realtime/BrainstormRealtimeManager.ts` (read that file first, imitate its usage signature).

    For each test stub file, use `describe.skip` (vitest) with `it.todo('MISSING — implemented in plan 0N')` so `npm run test:run` passes (skipped tests don't fail). This satisfies the Nyquist rule: every downstream task can reference `<automated>` commands even though the implementations haven't landed.

    For the Playwright spec, use `test.skip('two-browser drag sync (plan 04)', async () => {})`.

    Update 05-VALIDATION.md Per-Task Verification Map: replace the TBD row with one row per planned task (plan 01 tasks 1-3; plan 02 tasks 1-2; plan 03 tasks 1-3; plan 04 tasks 1-3 — 11 rows total, using TBD task IDs as `05-0N-T{M}`). Columns: Task ID, Plan, Wave, Requirement, Threat Ref, Secure Behavior (short), Test Type, Automated Command, File Exists (yes after this task), Status (⬜).

    Set `wave_0_complete: true` in 05-VALIDATION.md frontmatter after updating the table.
  </action>
  <verify>
    <automated>npm run test:run -- --run src/hooks/__tests__/useProjectRealtime.test.ts src/lib/realtime/__tests__/multiClient.test.ts api/__tests__/invitations.create.test.ts api/__tests__/invitations.accept.test.ts src/hooks/__tests__/useDotVoting.test.ts</automated>
  </verify>
  <done>All 7 stub files exist. `npm run test:run` does not fail on these files (skipped tests count as pass). 05-VALIDATION.md Per-Task Verification Map has rows for all Phase 5 tasks. `wave_0_complete: true` in frontmatter.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Supabase | Browser submits votes/invites; must not bypass RLS |
| Supabase RLS → DB write | Enforcement of 5-dot budget and role checks happens here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Tampering | idea_votes INSERT | mitigate | RLS `with check` enforces count < 5 per (user, session) — implemented in Task 1 migration |
| T-05-02 | Elevation | project_collaborators | mitigate | RLS restricts INSERT/UPDATE/DELETE to project owner; role column check constraint limits to viewer/editor |
| T-05-03 | Information Disclosure | project_invitations.token | mitigate | Store only SHA-256 hash in token_hash column; raw token lives only in invite URL fragment (handled in plan 02) |
| T-05-04 | Tampering | accept_invitation() | mitigate | SECURITY DEFINER function is the only path that writes project_collaborators from invitation; UPDATE policy on project_invitations denies direct writes |
| T-05-05 | Elevation | idea_votes DELETE | mitigate | RLS `using (user_id = auth.uid())` prevents deleting others' votes |
| T-05-06 | Information Disclosure | idea_votes SELECT | mitigate | SELECT policy requires session_participants membership — non-participants cannot read tallies |
| T-05-07 | DoS | realtime publication flood | accept | Supabase Realtime has per-channel rate limits; downstream plans add client throttling |
</threat_model>

<verification>
- Migration file syntactically valid SQL (if supabase CLI available: `supabase db lint`, else grep checks)
- `npx vitest run src/lib/repositories/__tests__/voteRepository.test.ts` green
- All Wave 0 stub files parse (vitest discovers them as skipped)
- 05-VALIDATION.md table populated
</verification>

<success_criteria>
- Three new tables with RLS policies match RESEARCH.md examples byte-for-byte where specified
- voteRepository test suite passes 4/4
- Seven Wave 0 test files exist and are skipped (not failing)
- No console.* in new source files
- VALIDATION.md Per-Task Verification Map is no longer TBD
</success_criteria>

<output>
After completion, create `.planning/phases/05-real-time-collaboration/05-01-SUMMARY.md` summarizing migration contents, repository exports, and the list of Wave 0 stubs ready for downstream plans.
</output>
