# Phase 5: Real-Time Collaboration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 05-CONTEXT.md — this log preserves the conversation.

**Date:** 2026-04-07
**Phase:** 05-real-time-collaboration
**Mode:** discuss

## Gray Areas Presented

1. Voting model (dot vs thumbs vs both)
2. Invite flow (email+signup vs magic link vs shareable link)
3. Matrix drag conflict resolution (LWW vs soft lock vs CRDT)
4. Realtime scope (brainstorm only vs brainstorm + project matrix)
5. Dot budget config (fixed vs per-session vs tier-based)
6. Presence scope (brainstorm / project / cursors)
7. Permission levels (viewer-editor vs 3-tier vs owner tier)
8. Disconnect behavior (auto-reconnect vs manual)

## Decisions Made

| Area | Choice | Notes |
|------|--------|-------|
| Voting model | Dot voting (5 per user, fixed) | Recommended — classic workshop pattern |
| Invite flow | Email link → signup | Recommended — clean permission model |
| Matrix conflict | Soft lock while dragging | Reuses existing ideaLockingService |
| Realtime scope | Brainstorm + project matrix | Recommended — required by COLLAB-07 |
| Dot budget | Fixed 5 per user | Recommended — defer config to backlog |
| Presence | Brainstorm + project matrix + live cursors | User opted into live cursors |
| Permissions | Viewer / Editor | Recommended — owner implicit |
| Disconnect | Auto-reconnect + polling | Recommended — matches existing pattern |

## Notable Findings from Codebase Scout

- 1,214 lines of realtime infrastructure already exist (BrainstormRealtimeManager, useBrainstormRealtime, PresenceIndicators, InviteCollaboratorModal)
- Voting is green field — no types, components, or tables
- Project-level realtime scope is the new territory (existing code is session-scoped)
- `ideaLockingService` pattern directly applicable to drag soft-lock decision
