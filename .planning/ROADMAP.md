# Roadmap: Prioritas

## Shipped Milestones

- **v1.0** — Launch Readiness (2026-04-06 → 2026-04-09) — 36/43 requirements, 5 deferred to v1.1. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).
- **v1.1** — Advanced Collaboration & Quality (2026-04-09 → 2026-04-10) — 10/10 requirements. Realtime voting, live cursors, drag lock, presence, quality debt closed. See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).
- **v1.2** — Production Hardening (2026-04-10 → 2026-04-11) — 7/7 requirements. Operational gaps closed, BUG-01 root-cause fixed (ADR-0009), ephemeral Supabase CI workflow shipped, access-control chain fully resolved via 6-pipeline E2E triage arc. CI Integration Tests closed at 3/10 with remaining failures re-scoped into v1.3. See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

## Current Milestone: v1.3 — E2E Realtime Hardening

**Goal:** Take the CI Integration Tests workflow from 3/10 green to 10/10 green. Fix the React realtime rendering cluster (T-054B-300..305), the invite-flow post-accept navigation (T-055-101), and the pre-existing `accept_invitation` RPC bug. Establish a local CI-equivalent debug environment as prerequisite.

**Scope principle:** E2E and integration test stabilization only. No new features. No refactors beyond what a failing test forces.

**Filed:** 2026-04-11. See [milestones/v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md) and [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

### v1.3 Phases

- **Phase 11: Local CI Reproduction Environment** — SHIPPED 2026-04-11. `supabase start` + GoTrue Admin seeding + Playwright against localhost. Acceptance bar deferred to 11.5.
- **Phase 11.5: Local Test Auth Reconciliation** — SHIPPED 2026-04-11 (pass-through stub — proper fix in 11.6).
- **Phase 11.6: withQuotaCheck Architectural Fix** — HIGHEST PRIORITY unshipped. Post PROD-BUG-01. Must land before public launch (billing quota enforcement currently OFF).
- **Phase 11.7: API Backend Hardening** — Cross-import audit, api/tsconfig.json NodeNext, latent bomb fixes, PROD-BUG-01 post-mortem. Depends on 11.6.
- **Phase 12: E2E Realtime Rendering Fix** — Fix the `strict mode: 2 design-matrix elements` root cause. Unblocks T-054B-300..305 (6 tests).
- **Phase 13: Invite Flow + RPC + Pattern Hygiene** — T-055-101 post-accept navigation, `accept_invitation` RPC P0001 bug, `CollaborationService.ts:97` pattern fix, silent-error-swallowing ADR.

To plan next: `/gsd-plan-phase 11.6`.

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

**Plans:** 1 plan
- [x] 11-01-PLAN.md — Ship four-file local CI reproduction environment (env file + orchestration script + npm entry + runbook) per ADR-0010

*Full detail and sibling phases in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).*

### Phase 11.6: withQuotaCheck Architectural Fix

**Goal:** Restore production quota enforcement after the PROD-BUG-01 emergency stub. Create a Node-safe backend subscription service at `api/_lib/subscriptionBackend.ts` that re-implements `getSubscription`, `checkLimit`, `incrementAiUsage`, and `SubscriptionCheckError` using only `@supabase/supabase-js` and zero `src/` imports. Switch `api/_lib/middleware/withQuotaCheck.ts` from the pass-through stub back to a real quota-enforcing middleware using the new backend service. Re-enable `api/_lib/middleware/__tests__/withQuotaCheck.test.ts` against the new implementation.

**Requirements satisfied:** BILLING-01 (new — quota enforcement restoration before public launch)
**Depends on:** Phase 11.5 (closed)
**Priority:** HIGHEST — blocks public launch. Billing quota enforcement currently OFF in production.

**Discovered:** 2026-04-11 during PROD-BUG-01 emergency investigation (see commit `233408e` and `docs/pipeline/investigation-ledger.md`). Root cause: `withQuotaCheck.ts` imported `src/lib/services/subscriptionService.ts` which transitively imported `src/lib/supabase.ts` using `import.meta.env.VITE_SUPABASE_URL` at module top — a Vite-only construct that crashes Node ESM runtime. Every Vercel function loading the middleware barrel crashed at module-load with `FUNCTION_INVOCATION_FAILED`.

**Current state:** `withQuotaCheck.ts` is a pass-through stub (zero quota enforcement) with a runtime `console.warn('[withQuotaCheck:STUB] quota enforcement disabled — see Phase 11.6')` flag so we cannot silently forget the stub is live. Production functional, billing quota enforcement OFF.

**Success Criteria:**
1. New file `api/_lib/subscriptionBackend.ts` exists with zero `src/` imports and passes `tsc --noEmit`
2. `withQuotaCheck.ts` restored to real quota-enforcing middleware using the new backend service
3. `SubscriptionTier` type inlined or imported from a Node-safe location (the original `src/lib/config/tierLimits.ts` has no browser dependencies — it MAY be safe to import with a `.js` suffix, verify empirically)
4. `api/_lib/middleware/__tests__/withQuotaCheck.test.ts` re-enabled and passing against the new implementation
5. Production deploy verified: `/api/projects` and `/api/invitations/create` still work AND correctly reject over-quota requests with 402
6. The runtime `[withQuotaCheck:STUB]` warning is no longer printed (stub is gone)
7. `SubscriptionCheckError` class unified — the stub's local copy is replaced by the backend service's real class
8. **Acceptance bar:** Deploy to production, send a curl request to `/api/projects` as a free-tier user who has exceeded their project limit, confirm 402 Payment Required response

**Out of scope (defer to Phase 11.7):** Audit of OTHER `api/ → src/` cross-imports. This phase only fixes `withQuotaCheck`.

**Plans:** 2 (estimated — investigate + implement backend service, migrate + re-test middleware)

*Full detail in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md#phase-116-withquotacheck-architectural-fix-backend-quota-service).*

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
| 11. Local CI Reproduction Environment | v1.3 | 1/1 | Shipped | 2026-04-11 |
| 11.5. Local Test Auth Reconciliation | v1.3 | —/— | Shipped (stub — proper fix in 11.6) | 2026-04-11 |
| 11.6. withQuotaCheck Architectural Fix | v1.3 | 0/? | Filed (HIGHEST priority — blocks launch) | — |
| 11.7. API Backend Hardening | v1.3 | 0/? | Filed | — |
| 12. E2E Realtime Rendering Fix | v1.3 | 0/? | Filed | — |
| 13. Invite Flow + RPC + Pattern Hygiene | v1.3 | 0/? | Filed | — |

---
*Last updated: 2026-04-11 — v1.2 archived via `/gsd-complete-milestone 1.2`; v1.3 (E2E Realtime Hardening) is the current milestone.*
