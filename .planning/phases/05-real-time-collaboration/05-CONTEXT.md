# Phase 5: Real-Time Collaboration - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-user real-time collaboration: presence, live idea sync, dot voting, project invitations with role-based permissions, and synchronized matrix drag/drop. Scope covers both active brainstorm sessions AND the main project matrix view. Billing enforcement of collaborator quotas is Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Voting
- **D-01:** Dot voting model — each user gets a fixed budget of **5 dots** per brainstorm session to distribute across ideas
- **D-02:** Budget is hard-coded at 5 for MVP (no per-session config, no tier coupling). Revisit in Phase 6 if billing needs it.
- **D-03:** Vote tallies broadcast in real-time to all session participants (COLLAB-06)
- **D-04:** New persistence: `idea_votes` table (user_id, idea_id, session_id, created_at) with RLS; dot count derived by counting rows per (user, session)

### Invitations & Permissions
- **D-05:** Project invitations go via **email link → Supabase Auth signup** flow. Invitee clicks link, signs up (or logs in if existing user), then gets attached to project with pre-assigned role.
- **D-06:** Permission levels: **Viewer** (read-only) and **Editor** (full edit: create ideas, drag matrix, vote). No separate owner tier — owner is implicit via `project.user_id`.
- **D-07:** Invitation tokens are single-use, stored server-side, expire after 7 days
- **D-08:** Reuse existing `InviteCollaboratorModal.tsx` (310 lines already scaffolded) — wire up to real backend

### Real-Time Scope
- **D-09:** Realtime sync extends to **both brainstorm sessions AND the project matrix view**. COLLAB-07 (matrix drag sync) requires project-level channels.
- **D-10:** Architecture: extend/parallel the existing `BrainstormRealtimeManager` with a project-scoped manager (or generalize to accept scope parameter). Decision deferred to research/planning.

### Matrix Drag Sync (Conflict Resolution)
- **D-11:** **Soft lock while dragging** — when a user grabs an idea card, other users see it visually locked (grayed out / non-interactive) until drop. Reuses existing `ideaLockingService` pattern.
- **D-12:** Lock broadcast via the realtime channel; auto-release on drop, disconnect, or timeout (e.g. 10s grace)

### Presence
- **D-13:** Presence indicators shown in **three places**:
  - Brainstorm session (existing `PresenceIndicators.tsx` — wire up if not already)
  - Project matrix view (new: avatar stack of users currently viewing the project)
  - **Live cursors on matrix** (Figma-style) — show other users' cursor positions when they're on the project matrix
- **D-14:** Cursor broadcast throttled to keep realtime cost reasonable (research to determine rate — target ~20Hz max)

### Connection Resilience
- **D-15:** Auto-reconnect with polling fallback — follows existing `useBrainstormRealtime` pattern. Subtle "reconnecting" UI indicator. Optimistic updates preserved through reconnect.
- **D-16:** On reconnect, fetch authoritative state (ideas, votes, positions) to reconcile any missed broadcasts

### Claude's Discretion
- Exact channel naming scheme and subscription lifecycle
- Cursor broadcast throttle rate (within ~20Hz target)
- UI styling for locked cards, reconnecting indicator, cursor colors/labels
- Dot vote display (inline counter vs dot cluster visualization)
- Invitation email copy and template design
- Lock grace timeout exact value

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — COLLAB-01 through COLLAB-07 (presence, sync, invite, permissions, voting, vote tally, matrix sync)
- `.planning/ROADMAP.md` §"Phase 5: Real-Time Collaboration" — goal and success criteria

### Existing realtime infrastructure (reuse, don't rebuild)
- `src/lib/realtime/BrainstormRealtimeManager.ts` — existing 521-line channel manager, auto-reconnect, fallback polling
- `src/hooks/useBrainstormRealtime.ts` — existing hook pattern for realtime + polling fallback
- `src/lib/database/services/RealtimeSubscriptionManager.ts` — subscription lifecycle utilities
- `src/utils/realtimeDiagnostic.ts` — diagnostic helpers for channel troubleshooting

### Existing UI scaffolding
- `src/components/brainstorm/PresenceIndicators.tsx` — presence avatar component (154 lines)
- `src/components/InviteCollaboratorModal.tsx` — invite UI (310 lines, needs backend wiring)

### Locking pattern (reuse for soft-lock drag)
- Existing `ideaLockingService` (referenced in project overview) — pattern to extend for matrix drag locks

### Project-level CLAUDE.md
- `design-matrix-app/CLAUDE.md` §"Supabase Debugging Requirements" — auth, realtime, RLS validation rules all plans must honor

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BrainstormRealtimeManager` — full channel management, reconnect, polling fallback. Extend for project scope.
- `PresenceIndicators.tsx` — already built. Reuse for matrix view (may need prop for scope).
- `InviteCollaboratorModal.tsx` — 310 lines of UI already done. Needs `/api/invitations` backend.
- `ideaLockingService` — lock/unlock pattern directly applicable to drag soft-locks.
- `sessionParticipantRepository` — already tracks session membership; extend for project-level collaborators.

### Established Patterns
- Supabase Realtime with polling fallback (4s interval) — matches D-15 decision
- Repository pattern in `src/lib/repositories/` — new `voteRepository`, `collaboratorRepository`, `invitationRepository` should follow this
- httpOnly cookie auth + RLS for all tables — `idea_votes`, `project_collaborators`, `invitations` tables must have RLS policies

### Integration Points
- Brainstorm session lifecycle (`useBrainstormRealtime`) — add voting channel events
- Matrix drag handlers (`@dnd-kit` usage in matrix components) — hook into soft-lock broadcast
- `AuthMigrationProvider` → invitation accept flow must work in signup path
- Supabase auth signup → post-signup hook attaches invited user to project with role

### Schema additions required
- `idea_votes` (user_id, idea_id, session_id, created_at) + RLS
- `project_collaborators` (project_id, user_id, role, invited_by, joined_at) + RLS
- `project_invitations` (token, project_id, email, role, invited_by, expires_at, accepted_at) + RLS

</code_context>

<specifics>
## Specific Ideas

- Live cursors should feel like Figma — smooth, labeled with user name, color-coded per user
- Dot voting UX should feel like a physical workshop — users can "stick" dots and pull them back before session ends
- Reconnecting indicator should be subtle, not alarming (lessons from existing realtime work)
- Invitation flow must not leak project existence to non-invited emails

</specifics>

<deferred>
## Deferred Ideas

- Per-session configurable dot budget — revisit if Phase 6 billing needs it
- Commenter tier (vote + add ideas but no move/delete) — not in MVP, add to backlog
- Shareable public invite links (no email required) — out of scope, backlog
- CRDT-based position merging — explicitly rejected as overkill for 2D coords
- Tier-based vote budgets — coupled to Phase 6, deferred
- Owner permission tier (explicit) — owner stays implicit via `project.user_id`

</deferred>

---

*Phase: 05-real-time-collaboration*
*Context gathered: 2026-04-07*
