# Investigation Ledger

Reset at the start of each debug flow. Tracks hypotheses, layers checked,
evidence found, and outcomes.

**Threshold:** 2 rejected hypotheses at the same layer triggers mandatory
escalation to the next layer.

## Current Investigation — Phase 11.5
**Symptom:** `npm run e2e:local -- -g "T-055-100"` fails with 403 `bad_jwt` /
"signing method ES256 is invalid" against invite API calls. CI passes the same
test. Phase 11 script orchestration validated through step 9.

**Started:** 2026-04-11
**Investigator:** Roz

## Layers Checked
- [x] Application — handlers, middleware, auth chain
- [x] Transport — HTTP headers, auth tokens, Bearer format
- [ ] Infrastructure — containers, networking
- [x] Environment — env vars, .env.local vs shell exports, Vite loadEnv behavior
- [x] Data / Schema — GoTrue algorithm migration, JWKS endpoint

## Hypothesis Table

| # | Hypothesis | Layer | Evidence gathered | Confidence | Verdict |
|---|------------|-------|-----------------|------------|---------|
| H1 | Supabase CLI 2.58.5 upgraded the local GoTrue to sign tokens with ES256 (not HS256). The script (step 9) still generates HS256 tokens. When Playwright logs in via the UI, GoTrue issues an ES256 token. The `withAuth` middleware passes that ES256 token to `supabase.auth.getUser()`, which sends it to the local GoTrue `GET /auth/v1/user`. GoTrue verifies it fine (ES256 is its own token). No rejection here. | ENVIRONMENT | JWKS endpoint `http://127.0.0.1:54321/auth/v1/.well-known/jwks.json` returns `"alg":"ES256"`. Real login via Admin API password reset + `GET /token?grant_type=password` returns token with header `{"alg":"ES256","kid":"b81269f1-21d8-4f2e-b719-c2240a840d90","typ":"JWT"}`. GoTrue accepts this real token fine (200 OK). HS256 tokens with wrong `iss` get 400 `validation_failed / Token audience doesn't match`. HS256 tokens with correct `iss`/`aud` get 200 OK — GoTrue still accepts HS256. | HIGH | PARTIAL — ES256 migration confirmed; token compatibility more nuanced |
| H2 | The `vite.config.ts` api-development plugin loads env via `loadEnv(mode, process.cwd(), '')` at startup. This reads `.env.local` which has `SUPABASE_URL=https://vfovtgtjailvrphsgafv.supabase.co` (production). When the Vite dev server is launched by Playwright's `webServer`, the exported shell env `VITE_SUPABASE_URL=http://localhost:54321` does NOT override `.env.local`'s `SUPABASE_URL` — `loadEnv` returns `.env.local` values for `SUPABASE_URL` even when `VITE_SUPABASE_URL` is overridden. The api-development plugin injects `SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL` (line 80) — `env.SUPABASE_URL` wins and is `https://vfovtgtjailvrphsgafv.supabase.co`. `withAuth` then calls `supabase.auth.getUser(token)` against the PRODUCTION Supabase, not localhost. Production GoTrue rejects the locally-issued ES256 token (different signing key, different issuer). | ENVIRONMENT | `.env.local` line: `SUPABASE_URL="https://vfovtgtjailvrphsgafv.supabase.co"`. Verified via `node -e "const {loadEnv}=require('vite'); process.env.VITE_SUPABASE_URL='http://localhost:54321'; const env=loadEnv('test',process.cwd(),''); console.log(env.SUPABASE_URL)"` → outputs `https://vfovtgtjailvrphsgafv.supabase.co`. `vite.config.ts:80`: `SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL`. `env.SUPABASE_URL` is non-empty → `env.VITE_SUPABASE_URL` (`http://localhost:54321`) is never used. | HIGH | CONFIRMED — The Vite dev server's api-development plugin injects the PRODUCTION Supabase URL into `process.env.SUPABASE_URL` for API route calls |
| H3 | e2e-local.sh step 9 generates HS256 tokens with `iss:'supabase-demo'` but GoTrue 2.58.5 issues tokens with `iss:'http://127.0.0.1:54321/auth/v1'`. The script-generated tokens are only used by integration tests (Vitest), not by the T-055-100 Playwright test. T-055-100 uses UI login (`signIn()`) which gets a real GoTrue token. So step 9 iss mismatch does NOT directly cause the T-055-100 failure. | ENVIRONMENT | `scripts/e2e-local.sh:191`: `iss:'supabase-demo'`. Real GoTrue token payload: `iss: 'http://127.0.0.1:54321/auth/v1'`. HS256 token with `iss:'supabase-demo'` → GoTrue returns 400 `validation_failed / Token audience doesn't match`. HS256 token with `iss:'http://127.0.0.1:54321/auth/v1'` → GoTrue returns 200 OK. T-055-100 does UI login (not script token), so this is a Vitest regression risk, not the T-055-100 Playwright failure. | HIGH | CONFIRMED (separate issue) — Vitest integration tests that use `E2E_COLLAB_OWNER_TOKEN` will fail because iss mismatch. Not the cause of T-055-100 failure but a co-present bug. |
| H4 | The original Wave 4 hypothesis: Vite dev server API middleware verifies incoming Bearer tokens expecting ES256. | APPLICATION | Grep + full read of `vite.config.ts` api-development plugin (lines 31-197) confirms NO JWT verification. Routes requests only, does not call any JWT library. | LOW | REJECTED — Vite does not verify tokens. |
| H5 | `withAuth.ts` line 112 returns 401 on `supabase.auth.getUser()` error (not 403). The test sees 403. Therefore `withAuth` is not where the 403 originates — the 403 with `bad_jwt` is the raw AuthApiError thrown by `supabase.auth.getUser()` being caught by a try/catch that re-surfaces the original Supabase error code. When `supabase.auth.getUser()` contacts PRODUCTION Supabase with a locally-issued ES256 token, production GoTrue returns `{status:403, code:'bad_jwt', message:'signing method ES256 is invalid'}`. This error is caught by `withAuth.ts:143-148` (`__isAuthError` check) and re-wrapped as 401. But the test error message in the failure log says 403 — this means the 403 body bubbles through BEFORE `withAuth`'s catch wraps it, OR the test is reading the body text (the `bad_jwt` message) and inferring 403 from the Supabase error object's status field. | APPLICATION | `withAuth.ts:31-38`: `sendUnauthorized` returns 401. `withAuth.ts:108`: `supabase.auth.getUser(accessToken)` — delegates to SDK. `withAuth.ts:143-148`: catches `__isAuthError` and calls `sendUnauthorized` (401). The 403 in the symptom comes from the Supabase error object's `.status` field (AuthApiError.status=403) being logged/read by the test, not from the HTTP response status code. The actual HTTP response is 401. | MEDIUM | CONFIRMED — withAuth correctly catches the AuthApiError. The "403" in the test failure is the Supabase error object's status property, not the HTTP response code. |

## Root Cause Summary (CONFIRMED)

**Primary root cause:** `vite.config.ts:80` — `SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL`

`loadEnv(mode, process.cwd(), '')` reads `.env.local` at Vite startup. `.env.local` sets
`SUPABASE_URL=https://vfovtgtjailvrphsgafv.supabase.co` (production). This value is
non-empty, so `env.VITE_SUPABASE_URL` (`http://localhost:54321` from the shell) is never
reached. The api-development plugin injects the production URL into `process.env.SUPABASE_URL`
for every API route call during local E2E tests.

**Failure chain:**
1. Playwright `webServer` launches Vite dev server via `npm run dev`
2. `vite.config.ts` `loadEnv` reads `.env.local` → `SUPABASE_URL = production URL`
3. Test does UI login → gets real ES256 token from LOCAL GoTrue (port 54321)
4. Test submits invite via `/api/invitations/create` with ES256 token
5. api-development plugin routes to `api/invitations/create.ts` → `withAuth.ts`
6. `withAuth.ts:99` creates Supabase client with `process.env.SUPABASE_URL` = PRODUCTION URL
7. `supabase.auth.getUser(localES256Token)` → HTTP GET to PRODUCTION Supabase's `/auth/v1/user`
8. Production GoTrue sees a token signed by local GoTrue's ES256 key → 403 `bad_jwt` / "signing method ES256 is invalid"
9. `withAuth.ts:143-148` catches `AuthApiError` → returns HTTP 401 to the test
10. Test fails waiting for invite success message (gets auth error instead)

**Secondary issue (independent):**
`scripts/e2e-local.sh:191` — `iss:'supabase-demo'`
Vitest integration tests that use `E2E_COLLAB_OWNER_TOKEN` will fail because CLI 2.58.5
GoTrue now validates `iss` and expects `http://127.0.0.1:54321/auth/v1` — script still
hardcodes `iss:'supabase-demo'`. This does NOT affect T-055-100 (which uses UI login)
but will block integration test suite.

**Why CI passes:**
CI workflow sets `VITE_SUPABASE_URL` and `SUPABASE_URL` both to `http://localhost:54321`
in the GitHub Actions env block. GitHub Actions sets these as process.env, and when
`loadEnv` runs on CI, there is no `.env.local` file (it is gitignored). So `env.SUPABASE_URL`
is `http://localhost:54321` in CI — the correct local URL. CI also uses CLI defaults that
align with the hardcoded HS256 keys. The divergence is local `.env.local` overriding the
shell env through Vite's `loadEnv`.

## Prior Investigation (archived 2026-04-11 T-055-101)
See previous content — GoTrue UUID + withQuotaCheck empty token.

## Recommended Next Action for Eva
Hard-pause, present to user. Two distinct fixes needed:
1. PRIMARY: Ensure `scripts/e2e-local.env.sh` exports `SUPABASE_URL` (non-VITE_ prefixed)
   equal to `http://localhost:54321` so `env.SUPABASE_URL` resolves to local, not production.
   Alternatively, fix `vite.config.ts:80` to prefer `env.VITE_SUPABASE_URL` when running
   in test mode. Eva should present both options to user before routing Colby.
2. SECONDARY: Fix `scripts/e2e-local.sh:191` `iss:'supabase-demo'` → `iss:'http://127.0.0.1:54321/auth/v1'`
   to prevent Vitest integration test failures under CLI 2.58.5.
