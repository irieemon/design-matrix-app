# Pipeline State

## RESUME HERE — 2026-04-11 (arc closed, v1.3 filed)

**Resume command:** `/pipeline`

**One-line status:** E2E triage arc officially closed. Remaining work is re-scoped into **v1.3 — E2E Realtime Hardening** (`.planning/milestones/v1.3-REQUIREMENTS.md`). Next action is NOT another /pipeline run — it is `/gsd-plan-phase 11` to plan the local CI reproduction environment that unblocks everything else.

**Why the arc closed instead of continuing:** Retro lesson from this session — 3+ consecutive pipelines with unchanged pass count is the signal to change strategy, not keep iterating. The remaining failures are in React realtime code (presence, cursor broadcasting, fullscreen rendering) and CI-log-based debugging is the wrong tool for that layer. v1.3 establishes local repro as prerequisite.

## Active Pipeline
**Phase:** idle
**Stop Reason:** completed_with_warnings

<!-- PIPELINE_STATUS: {"phase": "idle", "sizing": null, "roz_qa": null, "poirot_reviewed": null, "telemetry_captured": false, "stop_reason": "completed_with_warnings"} -->

## Milestone Status (updated 2026-04-11)

- **v1.2 — Production Hardening:** shipped de-facto (Phases 08/09/10 all complete); formal archive pending via `/gsd-complete-milestone 1.2`
- **v1.3 — E2E Realtime Hardening:** filed 2026-04-11. See `.planning/milestones/v1.3-REQUIREMENTS.md` and `.planning/milestones/v1.3-ROADMAP.md`.

### v1.3 phases (filed, not planned)

| Phase | Goal | Unblocks |
|-------|------|----------|
| **11. Local CI Reproduction Environment** | `supabase start` + GoTrue Admin seeding + Playwright against localhost so iteration is seconds, not pipelines | Phase 12, Phase 13 |
| **12. E2E Realtime Rendering Fix** | Fix `strict mode: 2 design-matrix elements` root cause; unblock T-054B-300..305 | CI Integration 6 tests |
| **13. Invite Flow + RPC + Pattern Hygiene** | T-055-101 post-accept navigation, `accept_invitation` RPC P0001, `CollaborationService.ts:97`, silent-error ADR | CI Integration 2 tests + Vitest 1 test + 2 tech-debt items |

Start v1.3 with: `/gsd-plan-phase 11`

## Session 2026-04-11: The E2E Triage Arc — 6 Pipelines Shipped

All commits landed on `origin/main`. Every pipeline achieved its scope goal. Test pass count stayed at 3/10 across the entire arc because each fix revealed the next layer (iterative onion peeling).

| # | Pipeline | Commit | What it fixed | Layer | CI pass count |
|---|---|---|---|---|---|
| 1 | Fullscreen URL routing | `a10357a` | `E2E_PROJECT_URL` path-style → query-param; logger import in MatrixPage | URL routing | 3/10 → 3/10 |
| 2 | user_profiles schema drift | `336c8d8` | Migration adding 5 missing columns; CI seed extended; validate-token `name`→`full_name` typo | Schema (user_profiles) | 3/10 → 3/10 |
| 3 | T-055-101 token helper + T-054B diagnostic probe | `acaf089` | Hardened `getAuthHeadersFromPage` localStorage extraction; 6 diagnostic probes in `validateProjectAccess` (gated CI-only) | Test helper + instrumentation | 3/10 → 3/10 |
| 4 | Probe channel fix | `8b19c41` | Probes `console.log` → `console.error` so Playwright CI captures stderr output | Diagnostic plumbing | 3/10 → 3/10 (but probe output now visible) |
| 5 | (No commit — probe revealed root cause in CI run 24284210964) | — | Probe output pinpointed `column project_collaborators.id does not exist` as the T-054B root cause | Investigation | — |
| 6 | T-054B query fix + probe cleanup | `568a72e` | `.select('id')` → `.select('project_id')` in `api/ideas.ts:157`; removed all probe code | Schema (project_collaborators) | 3/10 → 3/10 |

**Net effect:** Access-control chain (URL routing → profile fetch → token extraction → collaborator validation) is now entirely resolved. Zero `42703` errors. Zero "Access denied" errors. validateProjectAccess works correctly for all user types.

## Current CI state — commit `568a72e` (run 24286409806)

**Integration Tests (Supabase) workflow:** `failure` (3 passed / 7 failed)

- ✅ **T-055-100** — owner sends invitation (passing)
- ❌ **T-055-101** — invitee accepts invitation — fails at `invite-flow.spec.ts:228` `waitForURL('project=<id>')` — **NEW independent failure mode** — post-accept navigation doesn't land on project URL. Shared-root-cause with access-control was falsified by empirical evidence.
- ✅ **T-055-102** — expired invite state
- ✅ **T-055-103** — 401 without auth
- ❌ **T-054B-300** — `two browsers see each other in presence stack` — fails on `expect(locator).toHaveCount(2)` at `spec.ts:84` — **NEW error class: UI realtime behavior**
- ❌ **T-054B-301** — `cursor appears in browser B when A moves mouse` — fails at `spec.ts:114:31`, `locator.getAttribute: Timeout 10000ms`
- ❌ **T-054B-302** — `drag starts lock overlay in browser B` — fails at `spec.ts:150:37`
- ❌ **T-054B-303** — `drop propagates position in browser B within 2s` — fails at `spec.ts:199:37`
- ❌ **T-054B-304** — `disconnect shows reconnecting badge (Playwright route block)`
- ❌ **T-054B-305** — `reconnect shows recovery toast`

**Vitest migration tests:** 6 pass / 1 fail — `phase05.3-migrations.integration.test.ts:233` fails with `{ code: 'P0001', message: 'invalid_or_expired' }` from `accept_invitation` RPC. Pre-existing, separate bug, unrelated to this arc.

**Key new error types in CI logs** (observe these for the next investigation):
- `strict mode violation: locator('[data-testid="design-matrix"]') resolved to 2 elements` — **strong signal**: the page is rendering the matrix TWICE. Fullscreen overlay + base view both mounting simultaneously? This one finding might unblock multiple T-054B tests.
- `expect(locator).toBeVisible() failed` — UI element not rendering when expected
- `expect(locator).toHaveCount(expected) failed` — presence stack count mismatch
- `locator.getAttribute: Timeout 10000ms exceeded` — cursor/attribute lookup timing out
- `page.waitForURL: Timeout 15000ms exceeded` — T-055-101 line 228 navigation never fires

## Remaining Work — Punch List

### (A) UI realtime cluster — T-054B-300..305 (6 tests)
**Highest-leverage first target:** the `strict mode violation: 2 design-matrix elements` finding. Grep `data-testid="design-matrix"` — likely the fullscreen view and the base matrix render simultaneously after our URL fix. If true, one render-lifecycle fix could unblock several T-054B tests at once.

Start with:
```bash
grep -rn 'data-testid="design-matrix"' src/
```
Then check `MatrixFullScreenView.tsx` vs `DesignMatrix.tsx` for lifecycle overlap.

### (B) T-055-101 line 228 — post-accept navigation timeout (1 test)
`tests/e2e/invite-flow.spec.ts:228` → `await inviteePage.waitForURL(new RegExp('project=' + PROJECT_ID))`. Invitee accepts invitation but the redirect to `/?project=<id>` doesn't fire (or doesn't land). Check `src/pages/InvitationAcceptPage.tsx` — the redirect logic after `POST /api/invitations/accept` returns success.

### (C) Vitest `accept_invitation` RPC — `P0001 invalid_or_expired` (1 test)
`src/lib/__tests__/phase05.3-migrations.integration.test.ts:233`. Separate bug in the `accept_invitation` RPC (likely token hashing or expiry). Check the Phase 05.2 migration that defines the RPC (`supabase/migrations/20260408140000_phase5_accept_invitation_digest_fix.sql`).

### (D) Pre-existing hygiene (not blockers)
- `src/lib/services/CollaborationService.ts:97` — same `project_collaborators.select('id')` bug pattern as fixed in `api/ideas.ts`. Roz flagged during wave QA. Fix identical to commit `568a72e`.
- Access-control error handling ADR — Poirot's blind review flagged silent error swallowing in `validateProjectAccess` collab/admin queries. Follow-up ADR: re-introduce `error:` destructuring and `console.error` non-PGRST116 codes for operational visibility.
- Orphan working-tree files: `.claude/` 3.27.5 update, `CLAUDE.md` pipeline section, `.planning/STATE.md` correction, `test-results/artifacts/*`. Hygiene pass.

## Strategic Options for Next Session

**Option 1 — Local reproduction setup (RECOMMENDED for remaining work)**
The remaining failures are in React realtime code (presence API, cursor broadcasting, fullscreen rendering). CI-log-based debugging is the wrong tool for this layer. Set up a local CI-equivalent environment (`supabase start`, GoTrue seeding, Playwright against localhost) so debug loops are seconds rather than 5-pipeline CI iterations. Upfront cost pays off exponentially. Est. 1-2 hours of setup work.

**Option 2 — Structural review of realtime code**
Focused review of `MatrixFullScreenView.tsx` + `DesignMatrix.tsx` lifecycle with fresh eyes. The `strict mode: 2 design-matrix elements` finding is a strong hint that both views are rendering. One render-lifecycle fix could unblock multiple tests. Cheaper than option 1 if the bug is straightforward.

**Option 3 — Accept current state, file as v1.3 milestone**
The access-control layer is production-ready. File the remaining 7 failures as a "v1.3 E2E realtime hardening" milestone. Close the arc. Move on. Perfectly reasonable — the value-delivery from this arc (fixing 4 layers of production-blocking bugs) already justifies the investment.

**Option 4 — Continue incremental pipelines**
More of the same. Tackle option B (strict-mode-violation) first as highest-leverage. NOT RECOMMENDED given the meta-pattern (6 pipelines, 0 pass-count movement) — the remaining bug class is mismatched with per-test Eva orchestration.

**My strongest recommendation: Option 3 (file v1.3 milestone + close arc), with Option 1 as prerequisite for whoever picks up the v1.3 work.**

## T3 Telemetry Captures (this session)
- `4bf54661-7f0b-41c1-8fab-7d64fbf24af8` — Pipeline 1 (fullscreen URL)
- `b28f0ac6-4db5-43b7-88b9-6f855e18e77a`, `98a52895-0982-4da5-96c1-3255fc838ec8`, `6f6720af-5b2e-43e6-9d45-95f2045d1213` — Lessons after pipeline 1
- `04ded8d4-ae56-43a9-9ef4-0370f245e229` — Pipeline 2 (user_profiles schema)
- `c84c4e4e-eb1f-476a-8e5c-a7317ece66cf` — Pipeline 3+4 (helper fix + probe + channel fix)
- `51921500-5f22-4d41-ab15-60cfb32ad4c8` — Pipeline 6 (T-054B query fix)

## Session Retro (2026-04-11)

**What worked:**
- Diagnostic probe strategy (pipeline 3 → 4) broke the layer-peel pattern temporarily by producing conclusive evidence that led to a clean fix in pipeline 6. Probes should be used earlier when static analysis exhausts itself.
- Grep-based Eva triage falsified Poirot's hypotheses in 4/4 cases without full re-runs — saved cycles while preserving audit trail.
- Roz PASS + Poirot FAIL → Eva triage PASS pattern occurred 3 times. Triage discipline worked.
- `git add -f` is NOT needed for supabase/migrations in this repo (`.gitignore:111` has `!supabase/migrations/*.sql` negation) — brain correction vs Phase 06 lesson.

**What to improve:**
- 3-strike hook pattern when setting Ellis gate fields one at a time — always update `roz_qa`, `poirot_reviewed`, `telemetry_captured` in a single state edit.
- Playwright `webServer.stdout: 'ignore'` made the first probe run invisible. Probes should use `console.error` for CI visibility OR flip the config to `pipe`.
- Onion-peel pattern: at 3+ consecutive pipelines with unchanged pass count, change strategy (local repro / structural review / file as milestone). Don't keep iterating.
- Eva should have specified env-gate on probes in the initial Colby context. Poirot caught it (worked as designed) but an extra fix-cycle was avoidable.

## History — Completed Pipelines (chronological, oldest → newest)

### Completed: Fullscreen Cluster URL Fix (2026-04-10) → `a10357a`
Changed `E2E_PROJECT_URL` from path-style to query-param; fixed MatrixPage logger import. T-054B tests progressed past the helper but revealed schema drift in the next layer.

### Completed: user_profiles Schema Drift Fix (2026-04-10) → `336c8d8`
New migration adding email/full_name/avatar_url/created_at/updated_at to user_profiles (ADD COLUMN IF NOT EXISTS). CI seed amended. validate-token.ts typo fix. 42703 errors eliminated. Revealed next layer (access control / T-055-101 still failing).

### Completed: T-055-101 Helper Fix + T-054B Diagnostic Probe (2026-04-11) → `acaf089` + `8b19c41`
Hardened `getAuthHeadersFromPage` to handle Supabase session shape variations (fixed T-055-101 old failure). Added env-gated diagnostic probes to validateProjectAccess with Poirot rework cycle for PII/secret safety. Probe channel fixed (console.log → console.error). Produced the conclusive evidence for the next pipeline.

### Completed: T-054B Query Fix + Probe Cleanup (2026-04-11) → `568a72e`
`.select('id')` → `.select('project_id')` in api/ideas.ts:157 collaborator query. All probe code removed. Access-control layer fully resolved. Revealed UI/realtime layer as the next class of failures.

---

## Configuration
**Branching Strategy:** trunk-based
**Platform:** GitHub
**Integration Branch:** main
