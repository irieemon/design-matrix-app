# Investigation Ledger

Reset at the start of each debug flow. Tracks hypotheses, layers checked,
evidence found, and outcomes.

**Threshold:** 2 rejected hypotheses at the same layer triggers mandatory
escalation to the next layer.

## Current Investigation
**Symptom:** Two failures on CI run 24271496497 (commit 336c8d8, post schema drift fix):
1. T-055-101: POST /api/invitations/create returns 401 UNAUTHORIZED
2. T-054B-300..305: validateProjectAccess throws "Access denied - not owner, collaborator, or admin"

**Started:** 2026-04-11

## Layers
- [x] Application — handlers, middleware, auth chain
- [x] Transport — HTTP headers, auth tokens, Bearer format
- [ ] Infrastructure — containers, networking
- [x] Environment — env vars, CI webServer subprocess inheritance
- [x] Data / Schema — seed data, GoTrue UUID behavior

## Hypothesis Table

| # | Hypothesis | Layer | Evidence | Outcome |
|---|-----------|-------|----------|---------|
| H1 | T-055-101: `withQuotaCheck` is the outermost middleware for `api/invitations/create.ts` (not `withAuth`). It has its own token extraction. The test sends `Authorization: Bearer ` (empty string) because `getAuthHeadersFromPage` returns `''` when the Supabase JS v2 localStorage session is stored under the `sb-` key but `access_token` is undefined or the wrong key is selected. `!''` is true in `withQuotaCheck` line 62, returning 401 before the handler runs. | TRANSPORT | Full read of `api/invitations/create.ts:215-225` — export default wraps with `withQuotaCheck('users', createInviteHandler)`, NO `withAuth` in chain. Full read of `withQuotaCheck.ts:37-48, 60-63` — empty string is falsy, 401 fires immediately. CI log body `{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}` is produced by exactly one code path: `withQuotaCheck.ts:62`. Test `getAuthHeadersFromPage` returns `''` if `parsed?.access_token` is undefined. | CONFIRMED — High confidence |
| H2 | T-054B-300..305: GoTrue Admin API does NOT honor the requested `id` field in user creation. The created users get GoTrue-assigned UUIDs. The seed data uses hardcoded UUIDs (`11111111-...`, `22222222-...`). When user B (collaborator) authenticates via UI sign-in, their JWT `sub` is the GoTrue-assigned UUID, not `22222222-...`. `validateProjectAccess` queries `project_collaborators` with the GoTrue-assigned UUID — finds no row — throws "Access denied". | DATA | Full read of `integration-tests.yml:126-148` — create_user sends `"id": "22222222-..."` in payload. Read `api/ideas.ts:124-179` — service-role client used for collaborator lookup (bypasses RLS). Seed confirmed at lines 195-201. The ONLY way the service-role query finds no row is if user.id from JWT ≠ seeded user_id `22222222-...`. Cannot confirm GoTrue UUID behavior statically. | PROBABLE — Cannot confirm without CI log evidence of actual created IDs |
| H3 | T-055-101 secondary: `withAuth` also fails independently (separate from H1). | APPLICATION | Full read of `withAuth.ts` — withAuth is NOT in the `api/invitations/create.ts` middleware chain. `compose(withUserRateLimit(), withCSRF(), withAuth)` is used by `api/ideas.ts`, not `api/invitations/create.ts`. T-055-101 never reaches withAuth. | REJECTED — withAuth not in the invitations middleware chain |
| H4 | T-054B: Playwright webServer.env replaces (not merges) the parent env, stripping SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL from the webServer subprocess. All API calls fail with 500 (config error). | ENVIRONMENT | T-054B stack trace shows withAuth SUCCEEDED (not in throw path). If env vars were missing, withAuth would return 500 (config error) before ideas.ts is reached. The throw is at validateProjectAccess inside ideas.ts — meaning auth succeeded and ideas.ts executed. Therefore env vars ARE reaching the webServer. | REJECTED — withAuth success disproves missing env vars |
| H5 | T-054B: Owner user (11111111) also fails validateProjectAccess because GoTrue didn't honor their UUID either. Tests use both users — if both fail, GoTrue UUID mismatch is definitively the cause. | DATA | Cannot confirm without CI log showing which test IDs (user A vs user B) triggered which failures. T-054B-300..305 encompasses 6 tests. If any involve user A (owner) navigating their own project and still getting Access denied, H2 is confirmed (owner.id ≠ 11111111). | UNRESOLVED — Needs CI log detail |

## Root Cause Summary

**T-055-101:** `withQuotaCheck` receives empty-string token from the test's `getAuthHeadersFromPage` helper. The Supabase JS v2 localStorage session structure may not have `access_token` at the top level of the stored JSON, or a wrong `sb-*` key is selected. `withQuotaCheck` finds `!''` is true and returns 401 immediately. The 401 body matches the exact string at `withQuotaCheck.ts:62`.

**T-054B-300..305:** GoTrue Admin API likely does not honor the requested `id` in user creation payloads. Seeded `project_collaborators` rows use hardcoded UUIDs. When users sign in via UI, their JWT `sub` is the GoTrue-assigned UUID (different from hardcoded). Service-role collaborator lookup finds no matching row. Access denied.

**Shared factor:** Both failures stem from the CI test infrastructure assuming specific UUID values that GoTrue may not guarantee. They are structurally independent failures.

**Recommended fixes:**
1. Option C (2 min, zero risk): Add explicit env vars to playwright.ci.config.ts webServer.env to eliminate ambiguity
2. Option A: Fix `getAuthHeadersFromPage` in `invite-flow.spec.ts` — stop injecting Authorization header manually, rely on `credentials: 'include'` + cookies
3. Option B: Add GoTrue UUID verification step to CI workflow; refactor seed to use GoTrue-returned IDs if needed

**Sizing:** Small

## Prior Investigation (archived)
**Symptom:** 36 instances of `code: '42703', message: 'column user_profiles.email does not exist'` during E2E test run on commit a10357a (CI run 24270633358). Root cause: baseline migration defines user_profiles with only `id` + `role`; 5 columns missing. Fixed by Colby (commit 336c8d8): new migration `20260410000000_add_user_profiles_columns.sql` + seed amendment + `validate-token.ts` typo fix. Roz verified PASS.

## Prior Investigation (T-054B fullscreen, archived)
**Symptom:** T-054B-300..305 fullscreen button never mounts.
**Root cause:** E2E_PROJECT_URL used path-style URL (`/project/<id>`) incompatible with useBrowserHistory query-param restoration. Fixed by Colby on 2026-04-10, verified by Roz (PASS), committed as 2d362b9.
