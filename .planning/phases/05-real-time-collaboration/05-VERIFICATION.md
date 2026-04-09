---
phase: 05-real-time-collaboration
verified: 2026-04-09T18:30:00Z
status: gaps_found
score: 3/7 must-haves verified (COLLAB-03/04/05-data); 4 deferred
overrides_applied: 0
audit_type: retroactive
note: "Generated retroactively during v1.0 milestone audit. Phase 5 partially shipped: schema + invitations flow delivered end-to-end (via 05.1/05.2/05.3 hardening); voting UI and realtime matrix sync deferred to Phase 05.4. Reflects honest ship state, not ROADMAP checkbox state."
requirements_satisfied:
  - id: COLLAB-03
    description: "User can invite collaborators to a project via email"
    evidence: "api/invitations/create.ts + Resend email via sendInviteEmail; InviteCollaboratorModal wired; real email delivery verified end-to-end in Phase 05.2."
    source_plan: "05-02-invitations-backend-SUMMARY.md, Phase 05.2"
  - id: COLLAB-04
    description: "Invited collaborator joins project with appropriate role"
    evidence: "project_invitations table + accept_invitation() SECURITY DEFINER RPC with SHA-256 token hash; InvitationAcceptPage.tsx handles lookup→auth→accept→redirect; verified end-to-end (Sean→Bobby on Rivr project) after Phase 05.3 hardening closed 12 latent bugs."
    source_plan: "05-01-schema-and-fixtures-SUMMARY.md, 05-02-invitations-backend-SUMMARY.md, Phase 05.3"
  - id: COLLAB-05-data
    description: "Dot-voting data layer + RLS budget enforcement"
    evidence: "idea_votes table with 5-dot RLS budget (count subquery); voteRepository.ts with castVote/removeVote/listVotesForSession; 4/4 repo tests green. NOTE: persistence layer only — no UI hook/controls yet; see gaps."
    source_plan: "05-01-schema-and-fixtures-SUMMARY.md"
gaps:
  - id: COLLAB-01
    reason: "Presence indicators on brainstorm/project views — not delivered; ScopedRealtimeManager refactor deferred."
    source_plan: "05-03 (deferred to 05.4), 05-04 (deferred to 05.4)"
  - id: COLLAB-02
    reason: "Project-matrix real-time idea sync — ProjectRealtimeManager not built; brainstorm realtime manager not refactored."
    source_plan: "05-04 (deferred to 05.4)"
  - id: COLLAB-05-ui
    reason: "Dot voting USER-FACING experience: useDotVoting hook (test file exists, implementation missing) and DotVoteControls component not built. Data layer + RLS shipped; UI deferred to Phase 05.4."
    source_plan: "05-03 (deferred to 05.4)"
  - id: COLLAB-06
    reason: "Real-time vote tally broadcast UI — votes persist, but no realtime subscription surface consumes the channel. Deferred to Phase 05.4."
    source_plan: "05-03 (deferred to 05.4)"
  - id: COLLAB-07
    reason: "Matrix drag/position realtime sync, live cursors, soft drag lock, presence avatar stack on matrix — none delivered. Entire plan 05-04 rolled forward to Phase 05.4."
    source_plan: "05-04 (deferred to 05.4)"
---

# Phase 5: Real-Time Collaboration — Retroactive Verification

## Requirements Coverage

| REQ-ID | Description | Status | Evidence |
|---|---|---|---|
| COLLAB-01 | Presence indicators in brainstorm sessions | GAP | ScopedRealtimeManager refactor deferred → 05.4 |
| COLLAB-02 | Real-time idea sync across participants | GAP | ProjectRealtimeManager not built → 05.4 |
| COLLAB-03 | Invite collaborators via email | Satisfied | /api/invitations/create + Resend email; verified end-to-end |
| COLLAB-04 | Invitee joins with role (viewer/editor) | Satisfied | accept_invitation() RPC + InvitationAcceptPage; verified Sean→Bobby on Rivr |
| COLLAB-05 | Dot voting (5-dot budget) | Partial | DB schema + RLS budget enforcement + voteRepository shipped and tested; useDotVoting hook + DotVoteControls UI NOT built → 05.4 |
| COLLAB-06 | Vote tallies broadcast in realtime | GAP | No realtime vote channel consumer → 05.4 |
| COLLAB-07 | Matrix drag position broadcast | GAP | Plan 05-04 entirely deferred → 05.4 |

## Success Criteria (from ROADMAP Phase 5)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | 05-01: Schema + RLS + repositories + Wave 0 fixtures | Satisfied | Migration 20260408_phase5_collab_schema.sql; 3 repos; accept_invitation() SECURITY DEFINER; voteRepository 4/4 tests |
| 2 | 05-02: /api/invitations create/lookup/accept + wiring | Satisfied | All three endpoints + InvitationAcceptPage shipped; verified E2E only after Phase 05.3 hardening fixed 12 latent bugs; Phase 05.2 added Resend email |
| 3 | 05-03: Scoped realtime + voting | Partial | voteRepository + useDotVoting test file only; hook, controls, ScopedRealtimeManager refactor, realtime tally UI all deferred to 05.4 |
| 4 | 05-04: Project realtime matrix | Not started | Nothing delivered; entire plan rolled to 05.4 |

**Score: 2/4 plans fully delivered, 1 partial, 1 not started. Requirements: 3/7 satisfied (COLLAB-03/04/05-data), 4 deferred (COLLAB-01, 02, 06, 07) plus COLLAB-05 UI half.**

## Threat Mitigations Applied (Phase 05-01)

- T-05-01 vote stuffing — RLS `with check (count(*) < 5)` on idea_votes INSERT
- T-05-02 collaborator escalation — owner-only RLS writes + role CHECK constraint
- T-05-03 token disclosure — only SHA-256 token_hash stored
- T-05-04 accept tampering — no UPDATE policy; accept_invitation() SECURITY DEFINER is only mutation path
- T-05-05 vote deletion of others — RLS `using (user_id = auth.uid())` on DELETE
- T-05-06 vote tally disclosure — SELECT gated on session_participants membership

## Notes

Retroactive verification based on all four plan summaries, Phase 05.1/05.2/05.3 inserted-phase entries in ROADMAP, REQUIREMENTS.md status table, and file existence spot-checks (voteRepository.ts, api/invitations/create.ts, InvitationAcceptPage.tsx confirmed present).

This phase ships honestly as **"schema + invitations fully delivered; realtime + voting UI deferred."** The invitation flow only became user-visible after Phase 05.3's 12-bug hardening pass — summaries record this faithfully. Plans 05-03 and 05-04's deferred work is consolidated into Phase 05.4 which is explicitly scheduled in ROADMAP.

REQUIREMENTS.md status table is consistent with this verification (COLLAB-03/04/05 Complete, 01/02/06/07 Pending). ROADMAP phase status marker `🟡 Partial (2026-04-08)` is accurate.
