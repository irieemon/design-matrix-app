# Context Brief — Boot Snapshot for Next Session

**Last state-saved:** 2026-04-19 post-Session 6 hygiene
**Trunk:** `main` at `6eaa623`
**Pipeline phase:** `idle` / `completed_clean`
**Brain:** `HAL` online (local Postgres container `brain-brain-db-1` on :5433, `restart: unless-stopped`)

Next-session Eva reads this file on boot, applies the accumulated meta-rules from the start, and treats the action queue as the only Sean-gated work. Everything else lives in the autonomous backlog.

---

## v1.3 Status

**Code-complete. Live-verification-pending.** Every v1.3 roadmap item has shipped to `main` across Sessions 1–6. Milestone closure is gated on three items, all in Sean's hands:

1. Apply Supabase migration `20260419100000_phase13_accept_invitation_email_match.sql` to hosted project `vfovtgtjailvrphsgafv`. Session 6 migration audit (`supabase migration list --linked`) confirmed Local present, Remote empty. The Phase 13 Sentinel #2 remediation (CWE-862 email-match on `accept_invitation` RPC) is committed to main at `56888a4` but NOT LIVE until this migration applies.
2. Production flake-confirm — all 6 T-054B tests × 3 runs against `https://www.prioritas.ai`. Requires `CI_SUPABASE=true` + `E2E_USER_A_EMAIL/PASSWORD` + `E2E_USER_B_*` + `E2E_PROJECT_URL`. Eva cannot run responsibly without credentials.
3. Wave A consolidation trust-gate sign-off. One-page brief at `docs/reviews/wave-a-consolidation-brief.md` names three spot-check `file:line` targets. Human review of the -1659-line refactor is Sean's decision, separate from Eva's acceptance.

**v1.3 retrospective** stays queued per Sean's "only if milestone hit" rule. Will land `docs/reports/v1.3-retrospective.md` once the three gate items clear.

---

## Session History (one line each)

1. **Session 1 (2026-04-17)** — P0 audit close-out; worktree prune; state-hygiene lesson (`89fdc3aa`). **Key lesson:** Ellis is not done until pipeline-state.md terminal-transitions in the same turn as the ff-merge.
2. **Session 2 (2026-04-18)** — ADR-0017 Waves A+B live on prod (`faa5290`); P0-03 CSP enforcement + `/api/csp-report` endpoint (`b3d2dda`); P0-04 RLS migration applied; 4 unrelated migrations drift-resolved. **Key lesson:** migration drift is a class — `migration repair --status applied` is the pattern when drift is encountered.
3. **Session 3 (2026-04-18)** — Phase 12 Category A (T-054B-301 presence cursor via ScopedRealtimeManager late-registration fix, `77d8024`). **Key lesson:** shared-cause hypothesis can be partial — 301 unblocked, 302/303 did not (brain `f08b8a1e`).
4. **Session 4 (2026-04-19)** — Phase 12 Category B (Delete button pointer-events intercept fix, `69d911f` + `9b5b61b`). T-054B-302 + T-054B-303 flipped green cross-cluster. **Key lesson:** grep ALL renderers of the same affordance before Ellis commits; the first file Colby reads may not be the only one (brain `60608d03`).
5. **Session 5 (2026-04-19)** — Phase 12 Cat C (T-054B-304/305 test-primitive swap, `2921b0c`) + Phase 13 Sentinel remediation (CWE-862 + CWE-863 closed, `56888a4`). **Key lesson:** planning docs decay faster than commits — Phase 13 E2E-08/09 were already shipped; the real work was Sentinel audit of existing code (brain `ff802b09`).
6. **Session 6 (2026-04-19)** — Structural cleanup. CSP #1 + #2 (`c083fcb`), MAX_AUTH_INIT_TIME ADR errata, Wave A review brief, Sentinel #2 integration test, queue bifurcation, brain container restart policy (`6eaa623`). **Key lesson:** severity downgrade is not a deferral path — Poirot MUST-FIX either ships in-session or gets a recorded severity-disagreement rationale (brain `3365d15a`).

---

## Accumulated Meta-Rules (apply from boot)

Next-session Eva applies all ten from the first turn. Each is backed by a brain thought tagged `pattern` or `lesson`; IDs in column 2 are the authoritative record.

| # | Rule | Brain thought_id | Evidence |
|---|------|------------------|----------|
| 1 | **Hypothesis-vs-ground-truth tagging.** Mid-investigation captures are `hypothesis`; promotion to `lesson`/`confirmed` requires production verification or commit-grounded evidence. Use `supersedes` when a later session corrects an earlier hypothesis. | `cde440b1` | Session 3 `f08b8a1e` almost wasted a Session 4 pipeline before being caught |
| 2 | **Grep all renderers before declaring a fix complete.** A UI affordance may exist in multiple components sharing the same `aria-label` or data-testid. | `60608d03` | Session 4 Delete-button dual-site miss (IdeaCardComponent + OptimizedIdeaCard) |
| 3 | **Re-read failure signatures with fresh eyes on partial-success.** Shared-cause hypotheses from prior sessions are hypotheses until verified against current code. | `aca30e52` | Session 4 T-054B-302 cross-cluster discovery |
| 4 | **Haiku delegation cost rule.** Mechanical diffs under ~10 lines: Eva self-verifies via grep + read rather than dispatching Roz/Poirot at Haiku. Reserve subagent dispatch for cases where independent eyes actually help. | `ea52c036` | Session 6 CSP #1+#2 batch (15 LoC, zero rework); Session 5 Poirot on 14-line diff returned only NITs |
| 5 | **Continuation on subagent cutoff.** If a subagent stops mid-artifact, SendMessage on the same agentId to continue — don't silently accept incomplete output. Count promised "Output" items vs. landed diffs; if mismatched, continue before reporting done. | `ac7277e5` | Session 5 integration-test gap — Roz cut off, Eva moved on, Session 6 paid the rework cost |
| 6 | **Severity-downgrade is not a deferral path.** Poirot MUST-FIX / Sentinel BLOCKER: ship the fix in-session, or record an explicit severity-disagreement rationale that names why the reviewer is wrong. "Downgrade and queue" is not option three. | `3365d15a` | Session 6 shipped the CSP rate-limit MUST-FIX that had drifted across three sessions |
| 7 | **Queue hygiene as Session 0 step.** Every session starts by verifying `sean-action-queue.md` contains only items that genuinely require Sean's hands. Items Eva chose not to do go in `autonomous-backlog.md`. | `35e50a3f` | Session 6 queue bifurcation; false "Sean is blocked" signal cleared |
| 8 | **Stop-condition reporting accuracy.** Cite actual context meter readings at stop time. If stopping below 75%, the reason is NOT budget — it's `scoped_work_complete`, `diminishing_returns`, `subagent_chain_stuck`, `blocker_hit`, or `user_interrupted`. Name the real trigger from this fixed taxonomy. | `84e66c98` | Sessions 3-6 drifted on felt "~80%" estimates; rule closes the drift |
| 9 | **Verify live before `completed_clean`.** Migration-on-disk is not migration-applied. Code-on-main is not code-deployed. If live-verification is pending, the correct stop_reason is `completed_with_warnings` — NOT `completed_clean`. Promote to clean only after a prod-observed signal (curl header, test re-run, endpoint probe). | `c022ea9a` | Session 5 shipped `56888a4` with unapplied migration — Sentinel fix was code-on-main but not live |
| 10 | **Planning docs decay faster than commits.** Before dispatching a pipeline against a roadmap item, grep git log for the item's ID. It may already be shipped. | `ff802b09` | Session 5 Phase 13 pivot; E2E-08/09 closed in earlier commits the roadmap never reflected |

Supplementary captures that reinforce the above: `f08b8a1e`, `aca30e52` (companion evidence to rule 3); `d5ce7ed4` (companion to rule 10 — STATE.md drift class).

---

## Current Queue State

### `sean-action-queue.md` — **3 items** (all genuinely Sean-blocked)

1. Apply Supabase migration `20260419100000_phase13_accept_invitation_email_match.sql` to hosted project `vfovtgtjailvrphsgafv` via `supabase db push` or dashboard SQL editor.
2. Production flake-confirm (6 T-054B × 3 runs against `prioritas.ai`) — needs live E2E credentials.
3. Wave A consolidation trust-gate sign-off — brief at `docs/reviews/wave-a-consolidation-brief.md`, Sean's review.

### `docs/reports/autonomous-backlog.md` — **3 scheduled autonomous items**

| ID | Item | Target session |
|----|------|----------------|
| AB-01 | CSP nonce migration (`vite-plugin-csp-guard` + per-request nonces to replace `'unsafe-inline'`) | v1.4 planning |
| AB-02 | Platform audit Part 2 — resolve 68+ pre-existing unit test failures | Its own scoped session |
| AB-03 | Supabase dashboard settings verification via Supabase MCP read | Can run alongside other work |
| AB-04 | File upstream PR against `atelier-pipeline` plugin adding `restart: unless-stopped` to `brain/docker-compose.yml` | Whenever Sean updates plugin version |

Plus 7 items marked AB-COMPLETED-1..7 representing Session 6 ships, preserved for audit trail.

---

## What the Next Session Is For

**Polish pass on AI interactions and UI/UX.** The scope will be in the kickoff prompt Sean pastes next. This state-save is upstream of that directive; do not guess at the polish details. The opening moves will be whatever Sean names, guided by:

- The three Sean-gated items above (don't attempt them)
- The autonomous backlog (can work in parallel if the polish session has budget)
- The ten meta-rules above (apply from the first turn, not as afterthought)

---

## Boot note for next session

**Actual context meter reading at state-save:** The "Context left until auto-compact" display at Session 6 state-save close read **38%** (i.e., 62% used). This is the first concrete data point under meta-rule #8 — earlier sessions cited "~80%" as felt estimate; this one cites the meter verbatim. Stop trigger for the state-save session was `scoped_work_complete` (Sean's 5-item directive fully discharged), NOT `budget_threshold` — the meter had room, but the directive ended.

**Everything committed.** `main` is at `6eaa623` plus this state-save commit (capturing pipeline-state.md, context-brief.md, and the `error-patterns.md` auto-log entry from a session-mid StopFailure event). No worktrees open. No session branches alive.

**Actual directive for the next session is in Sean's kickoff prompt,** not this file. This brief is boot context; the kickoff prompt is the task.
