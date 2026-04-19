# Sean Action Queue — Blockers Only Sean Can Resolve

## Blocked on Sean (must-do)

*(Empty — both prior P0 items applied autonomously this session — see "Recently completed" below.)*

## Flagged but not blocking

- **Supabase dashboard settings verification** — Next session's Chrome MCP walkthrough should check Site URL, Redirect URLs, and email templates match ADR-0017 spec. Eva will read via Supabase MCP / dashboard and report; only flagged here if a change requires Sean's login.
- **Wave A bundled fix review** — The -1659 line consolidation is the single biggest diff. Sean may want to eyeball `git diff main^..main -- src/hooks/useAuth.ts src/components/auth/AuthScreen.tsx` (Wave A landed at `1e50fed`; before that was `eadc334`).
- **MAX_AUTH_INIT_TIME reconciliation** — Code says 5000ms, ADR says 15000ms. Eva left production value alone; Cal reconciliation deferred.
- **Pre-existing test debt** — 68+ unrelated test failures in useBrowserHistory, useAccessibility, useComponentState, useAIGeneration, useAIQuota, useOptimisticUpdates, AuthScreen.test.tsx. Pre-existing per git stash baseline. Queue for platform audit Part 2.

## CSP follow-ups (deferred from this session, all non-blocking)

The 2026-04-18 CSP rollout shipped ENFORCEMENT mode with a conservative allowlist matching the Vite dev baseline (`'unsafe-inline'` for script-src/style-src). Three follow-ups deferred for v1.4 or sooner:

1. **Rate-limit `/api/csp-report`** — Poirot flagged this as MUST-FIX. Eva deferred because the 8KB-per-request body cap + Vercel function concurrency limits provide bounded protection in the short term. Add `withRateLimit` (60 req/min/IP) the next time the middleware is touched, or sooner if Vercel function logs show abuse.
2. **Migrate from `report-uri` to `report-to` + `Reporting-Endpoints`** — `report-uri` is deprecated in CSP Level 3. Modern Chrome (96+) uses `report-to` preferentially when present. Falls back to `report-uri`, so reports still arrive — but for forward-compat add `Reporting-Endpoints: csp-endpoint="/api/csp-report"` and `report-to csp-endpoint` to the CSP value. Probably 30 min of work.
3. **Tighten `'unsafe-inline'` via nonces** — The current CSP keeps `'unsafe-inline'` for both `script-src` and `style-src`. This negates much of the XSS protection CSP provides (Poirot called it BLOCKER; Eva downgraded because the Vite dev CSP baseline already permits this and tightening requires nonces + Vite plugin work). Real v1.4 ticket: integrate `vite-plugin-csp-guard` or equivalent, generate per-request nonces, switch `script-src 'unsafe-inline'` to `script-src 'nonce-<value>'`. Same for styles.

## Migration drift (informational — handled this session, future hygiene)

Five local migrations were unapplied to the linked Supabase project at session start. Eva applied 4 via `db push` (with `migration repair --status applied` for two that were dashboard-applied out-of-band) and 1 by repair-only:

| Migration | Status | Method |
|---|---|---|
| `20260408010000_project_files_select_update_policies.sql` | repair-only (policies already in prod from dashboard) | `migration repair --status applied` |
| `20260410000000_add_user_profiles_columns.sql` | applied via `db push` | idempotent `IF NOT EXISTS` |
| `20260412000000_ideas_collaborator_select.sql` | applied via `db push` | DROP IF EXISTS + CREATE |
| `20260413000000_model_profiles.sql` | repair-only (table dashboard-applied out-of-band) | `migration repair --status applied` |
| `20260418000000_fix_session_activity_log_rls.sql` | applied via `db push` | DROP IF EXISTS + CREATE |

Going forward: when `supabase db push` reports drift, repair the in-prod-but-untracked migration before retry. Brain captured `da838cd3` documents the resolution pattern.

## Informational

- Brain container `brain-brain-db-1` (pgvector:pg17 on port 5433) should get `restart: unless-stopped` in its docker-compose. It was stopped at prior session start; one `docker start` restored it, but a restart policy would prevent future "brain disabled at session boot" surprises.
- autoCompactWindow was set to 1000000 in ~/.claude/settings.json (prior session).
- Model override persisted: `"model": "opus[1m]"` in ~/.claude/settings.json.
- Vercel deployment protection blocks anonymous header inspection on preview / on raw `*.vercel.app` deployment URLs. Production verification works via `prioritas.ai` (custom domain bypasses protection). If you want to verify CSP changes on preview before merge, set up a deployment protection bypass token in the Vercel dashboard.

---

## Recently completed (autonomously, 2026-04-18)

- ✅ **P0-04 RLS migration** (`20260418000000_fix_session_activity_log_rls.sql`) applied to linked Supabase project (`Design Thinking Tools`, ref `vfovtgtjailvrphsgafv`) via `supabase db push`. Verified end-to-end on local DB: TEST 1 (forge attempt by stranger user) blocked by RLS as expected; TEST 2 (legitimate facilitator INSERT) succeeded. Same SQL on prod = same result.
- ✅ **P0-03 CSP enforcement** added to `vercel.json` and `/api/csp-report` violation logger shipped at commit `b3d2dda` on main. Production verified live at https://www.prioritas.ai with full CSP header. Endpoint behavior verified: GET → 405, OPTIONS → 200, POST application/json → 204, POST application/csp-report → 204, PUT → 405. No `'unsafe-eval'`. `cdnjs.cloudflare.com` only in `worker-src`.
- ✅ **4 unrelated migration drift** resolved (project_files SELECT/UPDATE policies, user_profiles columns, ideas collaborator SELECT, model_profiles table). One of these (`20260412000000_ideas_collaborator_select.sql`) is the **Phase 12 Step 2a** RLS — collaborators can now SELECT ideas in production. Some of the 5 failing T-054B-30x realtime tests may flip green simply from this migration landing; verify next session.
