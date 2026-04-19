# Sean Action Queue — Blockers Only Sean Can Resolve

**Philosophy:** This file is short on purpose. Anything Eva can do autonomously lives in `docs/reports/autonomous-backlog.md`. Items here genuinely require Sean's hands: credentials, dashboards, deploy approvals, human sign-off.

## Blocked on Sean (must-do)

1. **Apply Supabase migration `20260419100000_phase13_accept_invitation_email_match.sql` to hosted project `Design Thinking Tools` (`vfovtgtjailvrphsgafv`).** Session 6 migration audit confirmed the migration is present locally but NOT on remote (`supabase migration list --linked` shows the Remote column empty for this timestamp). The Phase 13 Sentinel #2 BLOCKER remediation (CWE-862 email-match on `accept_invitation` RPC) is NOT live until this is applied. Apply via `supabase db push` or Supabase dashboard SQL editor. Session 5 boundary prevents Eva from applying migrations; this is yours.

2. **Production flake-confirm — all 6 T-054B tests × 3 runs against `https://www.prioritas.ai`.** Requires `CI_SUPABASE=true`, `E2E_USER_A_EMAIL`/`E2E_USER_A_PASSWORD`, `E2E_USER_B_*`, and `E2E_PROJECT_URL` pointing to a live test project. Eva cannot run this responsibly in unattended session because credentials live in env Eva must not read. If all 6 × 3 pass cleanly, v1.3 closes and the retrospective gets written. If any fail on prod, file via `/debug` with the specific flake signature.

3. **Wave A consolidation sign-off.** The -1659 line consolidation (Wave A auth-hardening) is the single biggest refactor in recent history. Shipped at `1e50fed`. Eva ships review briefs (see AB-COMPLETED-5 below for the one-page Wave A brief) but final trust-gate sign-off is Sean's. Spot-checks in the brief name three file:line locations worth human eyeballs.

## Dashboard-only changes (only if a diff audit flags drift)

- **Supabase dashboard settings.** Autonomous MCP read queued in backlog (AB-03). If that read flags drift from ADR-0017 spec (Site URL, Redirect URLs, email templates), a Sean task will be added here. Currently not known to be drifted — flagged as "verify" not "change."

- **Vercel deployment protection bypass token.** Only needed if Eva wants to verify CSP changes on a preview deployment instead of production. Currently verification works against `prioritas.ai` (custom domain bypasses protection). Non-blocking.

## Recently completed (Sean actions, 2026-04-18 through 2026-04-19)

- ✅ **P0-04 RLS migration** (`20260418000000`) applied to linked project (Session 2)
- ✅ **P0-03 CSP enforcement** added to `vercel.json` + `/api/csp-report` live on prod (Session 2, `b3d2dda`)
- ✅ **4 migration drift resolved** via `db push` + `migration repair` (Session 2)

---

## See also

- `docs/reports/autonomous-backlog.md` — work Eva will do in upcoming sessions without needing Sean.
- `docs/reports/autonomous-run-report.md` — per-session accounts of what shipped and why.
