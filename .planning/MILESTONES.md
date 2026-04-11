# Milestones

## v1.2 Production Hardening (Shipped: 2026-04-11)

**Phases:** 3 (08, 09, 10) | **Plans:** 4 | **Requirements:** 7/7

**Delivered:** Prioritas went from "feature-complete but brittle in CI" to "production-hardened with a working CI test matrix against live Supabase." Three phases closed deferred operational gaps (Resend, CSRF, AI Gateway), fixed the BUG-01 realtime dual-subscription race, and stood up an ephemeral-Supabase GitHub Actions workflow. A 6-pipeline E2E triage arc then resolved four layers of access-control bugs revealed once the suite started actually running.

**Key accomplishments:**

- **All three operational gaps closed** — Resend domain runbook, `waitForCsrfToken` polling utility eliminating analyze-file 403 race, `transcribeAudio` summary step migrated through Vercel AI Gateway (last raw fetch).
- **BUG-01 root-cause fixed with ADR-0009** — `RealtimeSubscriptionManager.subscribeToIdeas` event-merge pattern replaces `callback([])` placeholder; D-34 workaround removed; BRM 43/43 tests unchanged.
- **Ephemeral Supabase CI workflow shipped** — `.github/workflows/integration-tests.yml` uses `supabase start`, applies migrations, seeds via GoTrue Admin API, runs Playwright + Vitest against `localhost:54321`. 3 previously-`test.skip` files now execute in CI.
- **Access-control chain fully resolved via 6-pipeline triage arc** — URL routing (query-param), `user_profiles` schema drift (5 missing columns), token extraction hardening, `project_collaborators.select('project_id')` column fix. Zero `42703` errors.
- **Baseline migration for dashboard-created tables** — 17 SQL files previously not in git were caught and un-ignored; `subscriptions`/`usage_tracking` stubs added to baseline.
- **CSP bypass mechanism for CI** — `VITE_CSP_DISABLED` env-var lets the development-csp middleware skip header injection so Supabase client can reach `localhost:54321`.

**Known gaps carried to v1.3:** CI Integration Tests closed at 3/10. Remaining 7 failures are a different error class (React realtime UI rendering, invite-flow post-accept navigation, pre-existing `accept_invitation` RPC bug) and are re-scoped into v1.3 — E2E Realtime Hardening with local CI reproduction as prerequisite.

**Archive:** `.planning/milestones/v1.2-ROADMAP.md`, `.planning/milestones/v1.2-REQUIREMENTS.md`
**Tag:** v1.2
**Closed at commit:** `568a72e`

---
