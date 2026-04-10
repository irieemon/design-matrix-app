# Roadmap: Prioritas

## Shipped Milestones

- **v1.0** — Launch Readiness (2026-04-06 → 2026-04-09) — 36/43 requirements, 5 deferred to v1.1. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).
- **v1.1** — Advanced Collaboration & Quality (2026-04-09 → 2026-04-10) — 10/10 requirements. Realtime voting, live cursors, drag lock, presence, quality debt closed. See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

## Current Milestone

*No active milestone. Run `/gsd-new-milestone` to plan v1.2.*

## Proposed v1.2 Scope (carried from v1.1)

- **OPS-01**: Resend domain verification for production external email delivery
- **OPS-02**: analyze-file 403 CSRF race (`src/hooks/useCsrfToken.ts`)
- **OPS-03**: AI Gateway project-wide migration
- **BUG-01**: RealtimeSubscriptionManager.subscribeToIdeas clearing bug (D-34 workaround in place)
- **Test infrastructure**: 5 test.todo (DndKit sensor simulation), 6 test.skip E2E (live Supabase CI), QA-02/03 test.skip enablement
- **Mobile video**: revisit iOS frame extraction when WebCodecs API matures
- **Advanced features** from v2 backlog (COLLAB-V2-*, AI-V2-*, PLAT-V2-*)

---
*Last updated: 2026-04-10 — v1.1 archived*
