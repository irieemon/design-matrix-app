# Roadmap: Prioritas

## Shipped Milestones

- **v1.0** — Launch Readiness (2026-04-06 → 2026-04-09) — 36/43 requirements complete, 2 partial, 5 deferred to v1.1. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

## Current Milestone

*No active milestone. Run `/gsd-new-milestone` to plan v1.1.*

## Proposed v1.1 Scope (carried from v1.0 audit)

The following items were deferred from v1.0 and should be considered for v1.1 planning:

### Advanced Collaboration (was Phase 05.4)

- COLLAB-01 — Real-time presence indicators in brainstorm sessions
- COLLAB-02 — Real-time idea sync across participants
- COLLAB-05 (UI half) — useDotVoting hook + DotVoteControls UI (data layer already shipped in v1.0)
- COLLAB-06 — Vote tally realtime broadcast
- COLLAB-07 — Matrix drag position realtime broadcast

### Quality Debt

- MOB-02 — iOS Safari real-device verification for voice-to-idea
- Phase 07 Playwright mobile spec drift — 3 failing E2E tests (selectors lag UI refactors)
- Phase 05.3 invite flow — automated Playwright E2E regression (currently manual only)
- Phase 06 — integration test coverage (significant hotfix series during v1.0 UAT)
- Phase 05.3 SQL migrations — pgTAP coverage for RLS recursion / digest / OUT-param fixes

### Known Limitations

- Resend sender domain verification (production external email delivery)
- analyze-file 403 CSRF race (separate /gsd-debug session)
- ai-gateway-project-wide migration (user-confirmed direction 2026-04-07)

---
*Last updated: 2026-04-09 — v1.0 archived*
