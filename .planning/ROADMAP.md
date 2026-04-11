# Roadmap: Prioritas

## Shipped Milestones

- **v1.0** — Launch Readiness (2026-04-06 → 2026-04-09) — 36/43 requirements, 5 deferred to v1.1. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).
- **v1.1** — Advanced Collaboration & Quality (2026-04-09 → 2026-04-10) — 10/10 requirements. Realtime voting, live cursors, drag lock, presence, quality debt closed. See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).
- **v1.2** — Production Hardening (2026-04-10 → 2026-04-11) — 7/7 requirements. Operational gaps closed, BUG-01 root-cause fixed (ADR-0009), ephemeral Supabase CI workflow shipped, access-control chain fully resolved via 6-pipeline E2E triage arc. CI Integration Tests closed at 3/10 with remaining failures re-scoped into v1.3. See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

## Current Milestone: v1.3 — E2E Realtime Hardening

**Goal:** Take the CI Integration Tests workflow from 3/10 green to 10/10 green. Fix the React realtime rendering cluster (T-054B-300..305), the invite-flow post-accept navigation (T-055-101), and the pre-existing `accept_invitation` RPC bug. Establish a local CI-equivalent debug environment as prerequisite.

**Scope principle:** E2E and integration test stabilization only. No new features. No refactors beyond what a failing test forces.

**Filed:** 2026-04-11. See [milestones/v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md) and [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

### v1.3 Phases (filed, not started)

- **Phase 11: Local CI Reproduction Environment** — Prerequisite. `supabase start` + GoTrue Admin seeding + Playwright against localhost so iteration is seconds, not pipelines.
- **Phase 12: E2E Realtime Rendering Fix** — Fix the `strict mode: 2 design-matrix elements` root cause. Unblocks T-054B-300..305 (6 tests).
- **Phase 13: Invite Flow + RPC + Pattern Hygiene** — T-055-101 post-accept navigation, `accept_invitation` RPC P0001 bug, `CollaborationService.ts:97` pattern fix, silent-error-swallowing ADR.

To open v1.3 and begin planning: `/gsd-plan-phase 11`.

### Phase 11: Local CI Reproduction Environment

**Goal:** A developer can execute the CI Integration Tests Playwright suite against a local Supabase instance via a single command (`npm run e2e:local`) with the same env var surface and seed data as CI. Debug iterations complete in seconds-to-tens-of-seconds, not 5-minute CI pipelines.

**Requirements satisfied:** E2E-00
**Depends on:** Nothing
**ADR:** [ADR-0010](../docs/architecture/ADR-0010-phase-11-local-ci-repro.md)

**Success Criteria**:
1. `scripts/e2e-local.sh` + `scripts/e2e-local.env.sh` exist and are wired via `"e2e:local"` in `package.json`. No new Playwright config file — the script invokes `playwright.ci.config.ts` verbatim.
2. The script defends against both port 3003 holders (kill before start) and orphaned Supabase processes (`supabase status` exit-code check, stop/restart if unhealthy).
3. **Plumbing smoke test: `npm run e2e:local -- -g "T-055-100"` executes end-to-end and returns Playwright exit code 0** with T-055-100 reporting pass. This is the acceptance bar. No parity assertion for failing tests — Phase 12/13 discover parity gaps as a byproduct of their own debugging.
4. `.planning/phases/11-local-ci-repro/11-RUNBOOK.md` documents: prereqs (Docker Desktop, Supabase CLI — first place in the repo where Docker is declared as a dev prereq), one-shot usage, pass-through args (`-- -g "<pattern>"`), troubleshooting stubs for 3 flagged risks, known divergence risks appendix.
5. JWT generation is inline via `node -e` heredoc mirroring the CI workflow's `makeJwt` function verbatim (no separate helper module).

**Deliberate relaxation from initial filing:** The original roadmap criterion #3 required reproducing one of the 8 failing tests with a matching CI error signature. That bar was relaxed during `/architect` clarification to "plumbing smoke only" — the ADR explains why (coupling-to-CI-failure-signature was rejected as acceptance criterion B). Phase 11 does NOT verify parity for failing tests; it verifies the loop executes.

**Estimated plans:** 1

*Full detail and sibling phases in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).*

## Deferred to v1.4+

- Advanced features from v2 backlog (COLLAB-V2-*, AI-V2-*, PLAT-V2-*)
- Mobile video re-enablement (WebCodecs API)
- 5 test.todo DndKit sensor integration tests
- OAuth login

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 08. Operational Fixes | v1.2 | 3/3 | Complete | 2026-04-10 |
| 09. RealtimeSubscriptionManager Bug Fix | v1.2 | 1/1 | Complete | 2026-04-10 |
| 10. CI Test Infrastructure | v1.2 | 2/2 | Complete | 2026-04-11 |
| 11. Local CI Reproduction Environment | v1.3 | 0/? | Filed | — |
| 12. E2E Realtime Rendering Fix | v1.3 | 0/? | Filed | — |
| 13. Invite Flow + RPC + Pattern Hygiene | v1.3 | 0/? | Filed | — |

---
*Last updated: 2026-04-11 — v1.2 archived via `/gsd-complete-milestone 1.2`; v1.3 (E2E Realtime Hardening) is the current milestone.*
