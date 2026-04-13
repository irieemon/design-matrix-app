# Investigation Ledger — PROD-BUG-01 Ideas Empty Matrix

**Opened:** 2026-04-11
**Updated:** 2026-04-11 (Roz investigation complete — awaiting runtime data)
**Bug class:** User-reported production bug
**Environment:** prioritas.ai on Vercel (production)
**Reporter:** User (sean@lakehouse.net) with screenshot
**Acceptance criterion:** Ideas populate on matrix for existing projects when logged in as sean@lakehouse.net

## Symptom

### Reproduction context
- Navigate to https://prioritas.ai
- Log in (user: sean@lakehouse.net)
- Open project "Solr App" (visible in sidebar, project loads)
- Matrix renders empty state with "Ready to prioritize?" prompt
- User reports same behavior on ALL their projects (not single-project)

### Screenshot evidence
- Project sidebar shows "Solr App" as active
- Matrix shows the 4-quadrant grid (Quick Wins / Strategic / Reconsider / Avoid)
- Center of matrix shows lightbulb illustration + "Ready to prioritize?" empty-state copy
- Header shows "Full Screen", "AI Idea", "+ Create New Idea" buttons — write path available
- User email in footer confirms authenticated session

### What is NOT happening
- NOT a component crash (UI renders cleanly, no white-screen / error boundary)
- NOT a stuck loading spinner (empty state only appears after loading resolves)
- NOT a 4xx/5xx error surfaced in UI (no error toast, no error boundary)
- NOT a routing issue (project opens, URL updates, layout correct)
- NOT a single-project corruption (user says "any projects")

### What IS happening (hypothesis space)
The UI's `ideas.length === 0` branch is rendering, meaning the ideas state is populated as an empty array. Possible upstream causes:
1. Query fired, returned 200 OK with `[]` (RLS filtered, filter mismatch, or actual empty)
2. Query fired, returned error, got swallowed by silent-error path, fell back to `[]`
3. Query never fired (hook state bug, race condition, stale closure)
4. Data was actually wiped (extremely unlikely but possible — DB migration, bug in delete flow)
5. Auth session drift — JWT valid for project-reads but not for idea-reads (RLS policy difference)
6. Recent production deploy regressed the idea fetch path

### Ruled out (scoping before investigation)
- Session's 6 pushed commits (`dba9f42..15f9f70`) — verified via `git diff --stat` — all scripts/test/docs, zero src/ or api/ changes
- Supabase CLI 2.58.5 → 2.84.2 upgrade — LOCAL only, production runs Supabase Cloud
- The bug is **pre-existing** relative to this session's work

### Prior memories relevant (from session memory)
- **`feedback_optimistic_updates_stale_closure.md`** — useOptimisticUpdates had a stale closure bug in `confirmUpdate` / `moveIdeaOptimistic` where pendingUpdates and baseData had to be read from refs, never closures. Retro flagged this as a recurring bug class.
- **`feedback_rls_insert_returning_requires_select.md`** — `INSERT ... RETURNING` (`.insert().select()`) on `project_files` needed SELECT RLS on the new row or fails with 42501. Same pattern could apply to other tables if a RLS migration rolled back read policies.
- **`feedback_supabase_auth_deadlock.md`** — `supabase.auth.getSession()` hangs after storage ops; retro says use lock-free localStorage read. Auth hydration failures could cause downstream data-fetch issues.

## Hypothesis Table

| # | Hypothesis | Layer | Evidence (file:line) | Confidence | Verdict |
|---|------------|-------|---------------------|------------|---------|
| 1 | `useOptimizedMatrix.ts` catch blocks reference undeclared `err` (parameter is `_err`) — ReferenceError thrown INSIDE the catch block causes a secondary uncaught exception, silently breaking data flow | Application | `src/hooks/useOptimizedMatrix.ts:126`, `189`, `236`, `276`, `302`, `351` — all 6 catch blocks use `catch (_err)` but reference `err` in the body. Line 302 and 351 are in toggle/drag which are user-action paths; lines 126/189/236/276 are in load/add/update/delete | HIGH | CONFIRMED (static) — **BUT** `NewDesignMatrix.tsx` is the only consumer of this hook, and `MainApp.tsx` does NOT import or render `NewDesignMatrix`. This hook is NOT on the production data path. |
| 2 | Same `_err`/`err` pattern in the batched position update block of `useOptimizedMatrix.ts` | Application | `src/hooks/useOptimizedMatrix.ts:82-83` — `catch (_error)` with body `logger.error('...', error)` — `error` refers to outer React state setter variable, not the caught exception | HIGH | CONFIRMED (static) — same non-production scope caveat as H1 |
| 3 | `useIdeas.ts` `loadIdeas` useCallback has empty dependency array `[]` — ROOT_CAUSE_IDEAS_NOT_LOADING_CRITICAL.md documents this as a stale-closure bug causing `loadIdeas` to never re-create when project changes | Application | `src/hooks/useIdeas.ts:169` — `}, [])` with empty deps; `loadIdeas` uses `logger` (line 66, 74, 88, 90, 97) but logger not in deps. useEffect at line 418 has `[projectId, loadIdeas]` — since `loadIdeas` reference never changes, the effect only fires on `projectId` change, which IS the expected trigger. | MEDIUM | PARTIALLY CONFIRMED — the empty dep array is real at line 169. The ROOT_CAUSE doc's claim that this prevents the effect from firing is **mechanically weak**: `loadIdeas` being stale only matters if the effect re-runs for `loadIdeas` changes. The `projectId` dependency alone triggers the effect on project switch. The actual fetch at line 93 runs unconditionally inside the callback regardless of logger staleness. Logger staleness degrades logging only, not the fetch itself. This hypothesis is REJECTED as the primary cause but logged as a code quality issue. |
| 4 | `loadIdeas` catch block (line 160-163) swallows ALL errors with `setIdeas([])` — if the API call returns non-OK status, or throws for any reason (auth, network, CORS), the user sees empty state with no UI indicator | Application | `src/hooks/useIdeas.ts:99-101` — `if (!response.ok) { throw new Error(...) }` then `catch (error) { logger.error(...); setIdeas([]) }` — error is swallowed and empty array is shown | HIGH | CONFIRMED (static) — this IS on the production path. Any upstream failure (auth, RLS, network) produces the exact observed symptom. **Cannot confirm which upstream failure is occurring without runtime data.** |
| 5 | `getCachedAuthToken()` (line 79) returns null/undefined in production — the token cache may be empty on cold load, causing the API call to proceed with no Authorization header. The `withAuth.ts` middleware at line 84-92 tries cookie first then Authorization header — if neither is present, returns 401, which throws at line 100 and routes to `setIdeas([])` | Transport | `src/hooks/useIdeas.ts:79-96` + `api/_lib/middleware/withAuth.ts:84-96` — no access token = 401 from API = throw in catch = `setIdeas([])`. The warn log at line 90 would appear in browser console if this is the path. | HIGH | PENDING-RUNTIME — needs browser console check for "No access token found in localStorage" warning |
| 6 | `validateProjectAccess` in `api/ideas.ts` calls `authClient.auth.getUser()` (line 129) — if the httpOnly cookie auth token is expired/missing AND the Authorization header token is missing, `getUser()` fails, throwing "User not authenticated" which returns 500/401 and triggers the `setIdeas([])` path | Transport | `api/ideas.ts:129-133` + `api/_lib/middleware/withAuth.ts:108` — double auth check; either layer can reject | MEDIUM | PENDING-RUNTIME — needs Vercel function logs |
| 7 | RLS policy on `ideas` table does not exist in migrations — scout found NO matches for `CREATE POLICY.*ON\s+ideas` in `supabase/migrations/` — if the service role client bypass in `api/ideas.ts:205-211` was recently broken (env var missing), the fallback would use restricted client that RLS-filters to empty | Infrastructure | `api/ideas.ts:104-117` — `getServiceRoleClient()` throws if `SUPABASE_SERVICE_ROLE_KEY` is empty. If the env var is unset on Vercel production, this throws inside `validateProjectAccess` (line 136) before ideas are even fetched | MEDIUM | PENDING-RUNTIME — needs Vercel env var verification |
| 8 | ROOT_CAUSE_IDEAS_NOT_LOADING_CRITICAL.md documents a prior investigation (dated 2025-10-01) identifying the exact empty-state symptom with the same code path — the document was written but the fix (add `logger` to deps) was apparently never applied, suggesting this is a **chronic unfixed bug** that has existed since October 2025 | Application | File exists at repo root, dated 2025-10-01; current `src/hooks/useIdeas.ts:169` still has `}, [])` | MEDIUM | CONFIRMED (stale doc, live bug) — but logger-staleness is rejected as the actual mechanism (see H3). The doc's diagnosis of the mechanism is incorrect; the actual risk is H4+H5. |

## Layer-escalation budget

Per investigation discipline: 2 rejected hypotheses at same layer → escalate. Four system layers:
1. **Application** — useIdeas hook, ideaRepository, api/ideas.ts, withAuth middleware
2. **Transport** — HTTP headers, JWT handling, cookie flow, Supabase SDK client config
3. **Infrastructure** — Supabase Cloud RLS policies, database state, column rename
4. **Environment** — Vercel env vars, production-specific config, feature flags

Start at application layer. Escalate only if application-layer evidence rules out causes.

**Current status:** Application layer investigation yielded 2 confirmed findings (H1/H2 out of scope, H4 on-path) and 1 confirmed code quality issue (H3). Runtime data needed to distinguish H4 sub-causes (transport vs. environment vs. infrastructure layer).

## Runtime Data Requested

See Roz return message to Eva for full list.

## Notes for investigator

- Do NOT propose a fix in this ledger. Only hypotheses + evidence + verdicts.
- This is a PRODUCTION bug — no local reproduction available until we can tell if the bug is environment-specific or code-specific.
- User runtime data (browser devtools network tab, console errors, Vercel deploy history) is ESSENTIAL — investigation should not fully commit to a hypothesis without it.
- Roz can investigate the codebase side independently of user data; combine both streams at triage.
