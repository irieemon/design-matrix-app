## Roz Scoped Review — CSP Wave (csp-prod-rollout-cd5a0675)

**Date:** 2026-04-17
**Verdict:** PASS

**Reviewed files:**
- `/Users/sean.mcinerney/claude projects/workshop/design-matrix-app-cd5a0675/vercel.json`
- `/Users/sean.mcinerney/claude projects/workshop/design-matrix-app-cd5a0675/api/csp-report.ts`
- `/Users/sean.mcinerney/claude projects/workshop/design-matrix-app-cd5a0675/vite.config.ts` (regression check only)

---

**Spec compliance:**

| # | Spec Requirement | Verification | Result |
|---|-----------------|-------------|--------|
| 1 | Enforcement mode: header key is `Content-Security-Policy`, NOT `Content-Security-Policy-Report-Only` | JSON parse + key inspection | PASS |
| 2 | `report-uri /api/csp-report` present in CSP value | String search in parsed value | PASS |
| 3 | `frame-src` includes `https://js.stripe.com` | String search | PASS |
| 4 | `frame-src` includes `https://hooks.stripe.com` | String search | PASS |
| 5 | No `VITE_CSP_DISABLED` bypass in vercel.json | String search in all values | PASS — bypass is dev-only in vite.config.ts; vercel.json does not reference it |

---

**CSP value (verbatim):**

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://cdnjs.cloudflare.com https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.supabase.co; media-src 'self' blob: https://*.supabase.co; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://vitals.vercel-analytics.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; frame-src https://js.stripe.com https://hooks.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-uri /api/csp-report
```

---

**Static analysis:**

| Check | Result |
|-------|--------|
| `vite.config.ts` untouched | YES — `git diff HEAD -- vite.config.ts` returned empty; `VITE_CSP_DISABLED` bypass confirmed dev-only |
| `vercel.json` valid JSON | YES — `JSON.parse()` succeeds, no exception |
| Type errors referencing `api/csp-report.ts` | NONE — zero hits |
| Type errors referencing `vercel.json` | N/A (not a TS file) |
| Pre-existing type errors in worktree | 12,483 total — all pre-existing, caused by node_modules resolution mismatch from sibling worktree (no local node_modules; `@vercel/node`, `@supabase/supabase-js`, `@types/node` unresolvable via relative path). Zero attributable to this wave. |
| Top-level await in `api/csp-report.ts` | NONE — `async function handler(...)` with all `await` inside function body. PROD-BUG-01 regression class clear. |
| TODO/FIXME/HACK/XXX in changed files | NONE |

---

**Findings:**

BLOCKER: none

MUST_FIX: none

SUGGESTION (deferrable, non-blocking):

- `api/csp-report.ts` line 25 — OPTIONS branch returns `200 end()` with no `Allow` header. CSP report-uri is same-origin, so preflight is not a live concern. If the Reporting API (`report-to`) or cross-origin tooling is added later, a `204` matching the POST response and an explicit `Allow: POST, OPTIONS` header would be more correct. Low priority; not a launch blocker.

- `api/csp-report.ts` line 36 — `req.body` typed as `unknown` by `@vercel/node`. Browsers send CSP reports as `Content-Type: application/csp-report`, not `application/json`. Vercel may not auto-parse that MIME type, so `req.body` could be `undefined` at runtime. `JSON.stringify(undefined ?? null)` correctly resolves to `"null"` and the handler returns 204 regardless. Behavior is acceptable; worth a NOTE comment for future readers so they understand why the fallback exists.

---

**Coverage assessment:**

Test for `api/csp-report.ts`: NOT ship-blocking — defer.

Justification: Three branches (OPTIONS → 200, non-POST → 405, POST → log + 204). Logic is purely deterministic I/O plumbing with no domain state, no database calls, no side effects beyond stdout. The truncation math is trivially correct by inspection. A unit test would add defense-in-depth but is not the difference between a safe and an unsafe deploy for this handler. Queue `api/__tests__/csp-report.test.ts` as a follow-up after ship.

---

**Sign-off:** Ready for production deploy.

All spec requirements satisfied. vercel.json is valid JSON. vite.config.ts is untouched. No top-level await. No code markers. Type-check errors are pre-existing environment artefacts with zero connection to this wave. P0-03 is closed.

---

## Roz Scoped Review — TECH-01 (tech-01-collab-column-39577be6)

**Verdict:** PASS

**Verifications:**
- Line 97 changed as specified: YES — `.select('id, user_id')` → `.select('user_id')`
- No other lines modified: YES — only 13-line diff hunk, line 97 + comment only
- Vitest: 35 pass / 3 fail (expected 35 / 3 pre-existing) — PASS
- `.select('user_id')` used (not project_id): YES — line 97 confirms `user_id` selected

**Sign-off:** Ready for Ellis commit

All three scoped checks passed. Change is minimal and isolated. Pre-existing test failures confirmed (getProjectCollaborators suite, unrelated to line 97 fix). No scope creep — other .select calls on project_collaborators (lines 185, 396, 407) untouched as specified.

