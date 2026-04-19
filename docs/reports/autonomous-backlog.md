# Autonomous Backlog — Work Eva Can Do Without Sean

This file holds items that accumulated in `sean-action-queue.md` but do not actually require Sean's hands. Eva can work through these in autonomous sessions. Split created 2026-04-19 (Session 6) per the queue-hygiene meta-rule.

**Rule of thumb:** If an item needs a credential, a dashboard login, a deploy approval, or a decision only Sean can make, it belongs in `sean-action-queue.md`. Everything else belongs here.

---

## Scheduled for near-term autonomous sessions

| ID | Item | Origin | Effort | Target session |
|---|---|---|---|---|
| AB-01 | CSP nonce migration (`vite-plugin-csp-guard` + per-request nonces to replace `'unsafe-inline'` in `script-src` and `style-src`) | Session 2 CSP rollout follow-up #3. Poirot originally BLOCKER, Eva downgraded for v1.4 scope. | Medium — Vite plugin integration + CSP rewrite + prod verify | v1.4 planning (not this session per Sean's explicit do-not list) |
| AB-02 | Platform audit Part 2 — resolve 68+ pre-existing unit test failures | Session 2 baseline. `useBrowserHistory`, `useAccessibility`, `useComponentState`, `useAIGeneration`, `useAIQuota`, `useOptimisticUpdates`, `AuthScreen.test.tsx`. Pre-existing per git stash baseline. | Large — scoped platform-audit session | Its own session; do not fold into other work |
| AB-03 | Supabase dashboard settings verification via Supabase MCP read | Session 2 informational note. Check Site URL, Redirect URLs, email templates against ADR-0017 spec. Read-only is autonomous; change-if-needed is Sean's. | Small — read + diff report | Can run alongside other work |
| AB-04 | File upstream PR against `atelier-pipeline` plugin adding `restart: unless-stopped` to `brain/docker-compose.yml` | Session 6 discovery — the brain compose file lives in the plugin cache (`~/.claude/plugins/cache/atelier-pipeline/.../brain/docker-compose.yml`), not this repo. Local cache edit + live `docker update` both applied this session, but plugin-upstream fix is the durable solution. | Small — upstream plugin PR | Whenever Sean next updates the plugin version |

---

## Completed this session (Session 6, 2026-04-19)

These moved off the queue because they shipped or were addressed.

| ID | Item | Resolution |
|---|---|---|
| AB-COMPLETED-1 | CSP follow-up #1 — rate-limit `/api/csp-report` | Shipped Session 6 |
| AB-COMPLETED-2 | CSP follow-up #2 — `report-to` + `Reporting-Endpoints` | Shipped Session 6 |
| AB-COMPLETED-3 | Brain container `restart: unless-stopped` | Shipped Session 6 |
| AB-COMPLETED-4 | MAX_AUTH_INIT_TIME reconciliation | Shipped Session 6 |
| AB-COMPLETED-5 | Wave A review brief | Shipped Session 6 |
| AB-COMPLETED-6 | Phase 11.7 closeout — tsconfig NodeNext, PROD-BUG-01 post-mortem, supersede `ROOT_CAUSE_IDEAS_NOT_LOADING_CRITICAL.md` | Shipped Session 6 |
| AB-COMPLETED-7 | Session 5 integration test gap — Sentinel #2 RPC email-match assertion | Shipped Session 6 |

---

## Informational (not backlog, not blockers)

- `autoCompactWindow = 1000000` in `~/.claude/settings.json` — noted as prior-session convention, not revisited here.
- `"model": "opus[1m]"` override in `~/.claude/settings.json` — active convention.
- Brain container `brain-brain-db-1` now has `restart: unless-stopped` after AB-COMPLETED-3.
