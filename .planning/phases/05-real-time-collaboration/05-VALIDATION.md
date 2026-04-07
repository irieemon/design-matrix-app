---
phase: 5
slug: real-time-collaboration
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-07
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.4 + Playwright 1.55.0 |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `npm run test:run` |
| **Full suite command** | `npm run test:run && npm run e2e:chromium` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run`
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> Populated by planner. Each task in PLAN.md must map to a row here.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 05-01 | 1 | COLLAB-03/04/05 | T-05-01,02,03,04,05,06 | RLS-enforced 5-dot budget + owner-gated collaborator writes + hashed-token invites | sql/grep | `grep -q "count(\*)" supabase/migrations/20260408_phase5_collab_schema.sql` | yes | ⬜ pending |
| 05-01-T2 | 05-01 | 1 | COLLAB-05 | T-05-01,05 | castVote surfaces RLS budget rejection without trusting client | unit | `npx vitest run src/lib/repositories/__tests__/voteRepository.test.ts` | yes | ⬜ pending |
| 05-01-T3 | 05-01 | 1 | COLLAB-01..07 | n/a | Wave 0 stubs land so downstream plans have red→green targets | unit/e2e (skipped) | `npm run test:run` | yes | ⬜ pending |
| 05-02-T1 | 05-02 | 2 | COLLAB-03 | T-05-03 | Email validation, hashed-token persist, EmailJS dispatch | unit | `npx vitest run api/__tests__/invitations.create.test.ts` | yes | ⬜ pending |
| 05-02-T2 | 05-02 | 2 | COLLAB-04 | T-05-04 | accept_invitation() RPC creates collaborator atomically, expired tokens rejected | integration | `npx vitest run api/__tests__/invitations.accept.test.ts` | yes | ⬜ pending |
| 05-03-T1 | 05-03 | 3 | COLLAB-01,02 | n/a | Scoped channel multiplexes presence + postgres_changes + broadcast | unit | `npx vitest run src/lib/realtime/__tests__/multiClient.test.ts` | yes | ⬜ pending |
| 05-03-T2 | 05-03 | 3 | COLLAB-06 | T-05-01 | useDotVoting enforces optimistic budget + reconciles via RLS | unit | `npx vitest run src/hooks/__tests__/useDotVoting.test.ts` | yes | ⬜ pending |
| 05-03-T3 | 05-03 | 3 | COLLAB-05,06 | T-05-06 | Vote tally subscriber merges initial fetch + realtime delta | unit | `npx vitest run src/hooks/__tests__/useDotVoting.test.ts` | yes | ⬜ pending |
| 05-04-T1 | 05-04 | 4 | COLLAB-01,07 | n/a | useProjectRealtime presence + cursor + drag lock multiplex | unit | `npx vitest run src/hooks/__tests__/useProjectRealtime.test.ts` | yes | ⬜ pending |
| 05-04-T2 | 05-04 | 4 | COLLAB-02 | n/a | Multi-client fan-out via mockRealtimeChannel | unit | `npx vitest run src/lib/realtime/__tests__/multiClient.test.ts` | yes | ⬜ pending |
| 05-04-T3 | 05-04 | 4 | COLLAB-07 | T-05-07 | Two-browser drag persistence end-to-end | e2e | `npx playwright test tests/e2e/matrix-drag-sync.spec.ts` | yes | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Realtime test fixtures (multi-client Supabase channel harness)
- [ ] Presence/voting integration test stubs for COLLAB-01..07
- [ ] Playwright fixture for two-browser collaborative session

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-device live sync feel | COLLAB-02 | Subjective latency perception | Open session on desktop + phone, create ideas, observe |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
