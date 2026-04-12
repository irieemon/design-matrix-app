# ADR-0012: Phase 12 -- E2E Realtime Rendering Fix

## Status

Proposed (2026-04-12), Revised (2026-04-12) -- Roz QA review: resolved 2 BLOCKERs (RLS gap, ws:// scheme)

**Phase:** 12
**Milestone:** v1.3 -- E2E Realtime Hardening
**Requirements satisfied:** E2E-01 through E2E-07
**Depends on:** Phase 11 (local CI reproduction environment -- shipped)

## DoR: Requirements Extracted

**Sources:**
- `.planning/milestones/v1.3-ROADMAP.md` (Phase 12 section, lines 111-125)
- `tests/e2e/project-realtime-matrix.spec.ts` (all 6 test definitions)
- Scout research brief (verified codebase evidence)
- `.claude/references/retro-lessons.md`
- Roz QA review (2 BLOCKERs: RLS collaborator gap confirmed across all 30 migrations; ws:// scheme mismatch confirmed)

| # | Requirement | Source | Citation |
|---|------------|--------|----------|
| R1 | T-054B-300: two browsers see each other in presence stack | spec.ts:66-93 | Needs `[data-testid="project-presence-stack"]` + `[data-testid^="presence-avatar-"]` |
| R2 | T-054B-301: cursor appears in browser B when A moves mouse | spec.ts:99-129 | Needs `[data-testid^="live-cursor-"]` -- already exists at LiveCursorsLayer.tsx:85 |
| R3 | T-054B-302: drag starts lock overlay in browser B | spec.ts:135-179 | Needs `[data-testid^="idea-card-"]` -- exists at DesignMatrix.tsx:436, but zero idea rows in CI seed |
| R4 | T-054B-303: drop propagates position in browser B within 2s | spec.ts:185-230 | Same as R3 -- needs seeded idea cards |
| R5 | T-054B-304: disconnect shows reconnecting badge | spec.ts:236-255 | Uses `getByRole('status', { name: /Reconnecting/i })` -- matches ReconnectingBadge.tsx:105 |
| R6 | T-054B-305: reconnect shows recovery toast | spec.ts:261-288 | Uses `getByRole('status', { name: /Back online/i })` -- matches ReconnectingBadge.tsx:143 |
| R7 | No strict mode violation (2 design-matrix elements) in any Playwright log | Roadmap:118 | Originally hypothesized; scout evidence DISPROVED -- `data-testid="design-matrix"` exists in exactly one place (DesignMatrix.tsx:292) |
| R8 | T-054B-300..305 all pass in CI on consecutive runs (flake threshold: 2 consecutive green) | Roadmap:120 | |
| R9 | Presence stack, cursor broadcast, drag lock, position propagation, reconnecting badge, recovery toast all functional in both local repro and CI | Roadmap:121 | |
| R10 | Collaborator user can SELECT ideas in shared projects via RLS policy | Roz QA review (Blocker 1) | Current policy `20251117190000:175-181` only allows owner_id or is_admin(); confirmed no later migration adds collaborator clause |
| R11 | WebSocket route interception in T-054B-304/305 must cover both `ws://` and `wss://` schemes | Roz QA review (Blocker 2) | Local Supabase serves Realtime on `ws://`, not `wss://`; Playwright route matching is scheme-sensitive |

**Retro risks:**
- Lesson 005 (Frontend Wiring Omission): relevant -- seed data is a "producer" that tests consume. If seed step is orphaned from test expectations, tests fail silently. This ADR pairs every seed row with the test that consumes it.
- Lesson 002 (Self-Reporting Bug Codification): relevant -- we must NOT weaken test assertions to match current broken state. The components must be fixed to match what the tests expect.

## Context

### Disproved Hypothesis

The v1.3-ROADMAP.md (line 118) hypothesized a `strict mode violation: 2 design-matrix elements` as root cause. Scout investigation **disproved** this:

```
grep -rn 'data-testid="design-matrix"' src/
```

Returns exactly one result: `src/components/DesignMatrix.tsx:292`. There is no duplicate. The original CI error was likely caused by a transient render race during fullscreen transition, not a permanent double-mount. This ADR does not address a phantom element bug because none exists.

### Four Verified Root Causes

**Root Cause 1: Missing `data-testid` attributes on ProjectPresenceStack (T-054B-300)**

The test at spec.ts:36 declares:
```ts
const PRESENCE_STACK_SELECTOR = '[data-testid="project-presence-stack"]'
```
And at spec.ts:83 queries:
```ts
pageA.locator(PRESENCE_STACK_SELECTOR).locator('[data-testid^="presence-avatar-"]')
```

But `ProjectPresenceStack.tsx` has:
- Root container (line 222-225): `role="group"` with `aria-label` -- **no `data-testid`**
- Avatar elements (line 87-88): `role="img"` with `aria-label` -- **no `data-testid`**

The test **always** fails because the selectors cannot resolve any elements.

**Root Cause 2: Missing CI seed data -- no idea rows (T-054B-302, T-054B-303)**

The test at spec.ts:149 requires:
```ts
const firstCard = pageA.locator('[data-testid^="idea-card-"]').first()
```

The CI workflow (`.github/workflows/integration-tests.yml`, step 7) seeds users, project, collaborators, and invitations. It seeds **zero idea rows**. The `ideas` table is empty in CI. These two tests will always fail because there are no idea cards to drag.

Evidence from CI screenshots: the matrix page loads successfully showing "Ready to prioritize?" empty state, confirming zero ideas.

The `ideas` table (baseline migration line 130) requires:
- `id` (text, PK, auto-generated)
- `content` (text, NOT NULL)
- `project_id` (uuid, FK to projects)
- `x`, `y` (numeric, default 0)
- `priority` (text, default 'moderate')
- `created_by` (text, nullable)

RLS policy (migration `20251117190000`, line 185-191): INSERT requires `auth.uid() = owner_id` OR `is_admin()`. The CI seed uses `PGPASSWORD=postgres psql` which connects as the postgres superuser, bypassing RLS. Seed insertion is safe.

Additionally, Roz's QA review confirmed a **compounding RLS gap**: even with seeded ideas, the collaborator user (user 2) cannot SELECT them. The SELECT policy (migration `20251117190000`, lines 175-181) only allows `owner_id` or `is_admin()`. Roz verified all 30 migration files -- no later migration adds collaborator-based SELECT for ideas. This means T-054B-302 fails because `LockedCardOverlay` renders inside the per-idea wrapper at DesignMatrix.tsx:450-452 (no ideas = no overlay DOM), and T-054B-303 fails because `pageB.locator('idea-card-${ideaId}')` at spec.ts:203 returns nothing.

**Root Cause 3: WebSocket scheme mismatch in disconnect/reconnect tests (T-054B-304, T-054B-305)**

Roz's QA review confirmed: local Supabase (`supabase start`) serves Realtime on `ws://localhost:54321/realtime/...`, NOT `wss://`. Playwright `route()` is scheme-sensitive. The tests at spec.ts:246 and spec.ts:271 use `pageA.route('wss://**', ...)` which silently does nothing against `ws://` connections. The `unroute` at spec.ts:279 has the same issue. These tests ALWAYS fail in local/CI environments because the route interception never matches.

**Root Cause 4: Potentially working but unverified test (T-054B-301)**

T-054B-301 uses `[data-testid^="live-cursor-"]` which matches LiveCursorsLayer.tsx:85. This test has never run successfully because earlier tests fail, but the selector is verified correct. It may have a latent timing issue (realtime channel not subscribed before mouse move events fire) that only surfaces once Root Causes 1-3 are fixed.

## Decision

Fix all three root causes plus two confirmed blockers with minimal, additive changes:

1. **Add `data-testid` attributes** to `ProjectPresenceStack.tsx` alongside existing `role`/`aria-*` attributes (no removal of accessibility attributes).
2. **Seed idea rows** in the CI workflow step 7 SQL block, using stable UUIDs that the test expectations can rely on.
2a. **Add collaborator SELECT RLS policy for ideas** via a new migration file. The current policy (migration `20251117190000`, lines 175-181) only allows `owner_id` or `is_admin()`. No later migration adds collaborator-based SELECT. Without this, pageB (collaborator) cannot load idea cards, causing T-054B-302 (lock overlay) and T-054B-303 (position propagation) to fail because `LockedCardOverlay` renders inside the per-idea wrapper in `DesignMatrix.tsx:450-452` -- if ideas don't render, overlays don't render.
3. **Fix WebSocket scheme mismatch in T-054B-304 and T-054B-305.** Local Supabase serves Realtime on `ws://`, not `wss://`. Playwright route matching is scheme-sensitive, so the current `pageA.route('wss://**', ...)` silently does nothing against `ws://` connections. Both tests must route/unroute both schemes.
4. **Verify** the remaining potentially-working test (T-054B-301) passes without modification after Steps 1-3 are fixed. If it fails, address the latent issue in the same pipeline.

### Anti-Goals

**Anti-goal: Refactoring the realtime subsystem.** Reason: scope discipline -- the realtime architecture (ScopedRealtimeManager, ProjectRealtimeContext) is working correctly; only test infrastructure is broken. Revisit: if Roz finds realtime connection failures after fixing selectors and seed data.

**Anti-goal: Modifying test assertions to match current component state.** Reason: per retro lesson 002, the tests define correct behavior -- the components must be fixed to match, not vice versa. Revisit: never for this class of issue.

**Anti-goal: Changing the CI workflow orchestration or Playwright config.** Reason: CI workflow structure (user creation, JWT generation, Playwright invocation) is working correctly -- T-055-100 passes. Only the seed data content is incomplete. Revisit: if a CI-specific timing or ordering issue is discovered after fixing seed data.

## Spec Challenge

**The spec assumes that the Supabase Realtime channel will initialize and propagate presence/cursor events within the test timeouts (3-5 seconds).** If wrong, the design fails because T-054B-300 (presence with 5s timeout), T-054B-301 (cursor with 3s timeout), and T-054B-302 (lock overlay with 3s timeout) will flake or fail even with correct selectors and seed data. The local Supabase Realtime service started by `supabase start` has different latency characteristics than production -- channel subscription, presence sync, and broadcast propagation may exceed the tight timeouts on cold CI runners.

**SPOF: Supabase Realtime channel initialization in CI.** Failure mode: channel subscription takes >3s on a cold GitHub Actions runner, causing all realtime-dependent tests to timeout intermittently. Graceful degradation: the existing `ScopedRealtimeManager` has a fallback polling path. However, the tests assert on realtime-specific UI (live cursors, lock overlays) that polling does not produce. Mitigation: if flakiness appears post-fix, increase timeouts to 10s for CI (Playwright's `timeout` parameter per assertion, not globally) and add a `page.waitForFunction` guard that checks the realtime channel state before asserting on presence/cursor elements.

## Alternatives Considered

### A. Modify tests to use `role`/`aria-*` selectors instead of `data-testid`

The presence stack test could use `[role="group"][aria-label*="Matrix viewers"]` and `[role="img"][aria-label*="viewing this matrix"]`. This would avoid changing the component.

**Rejected:** The `data-testid` pattern is established across the codebase (DesignMatrix.tsx:292, LiveCursorsLayer.tsx:85, LockedCardOverlay.tsx:101, MatrixFullScreenView.tsx:776). The presence stack is the outlier. Adding testids to the component (additive, non-breaking) is more consistent than rewriting test selectors. Furthermore, `aria-label` values are UX copy that may change; `data-testid` values are stable test contracts.

### B. Seed ideas via the application API (POST /api/ideas) instead of direct SQL

This would exercise the full creation pipeline and RLS policies.

**Rejected:** The test `signIn` helper authenticates via the UI (form fill + submit). Using the API would require either (a) extracting the session token from the page context, which is brittle, or (b) creating a separate auth flow for seed setup. Direct SQL via `psql` as the postgres superuser is how ALL existing CI seed data works (users, project, collaborators, invitations). Consistency with existing pattern wins.

### C. Create a separate seed SQL file instead of inline in the workflow

**Rejected for now:** The existing CI workflow inlines all seed SQL in step 7. Adding a separate file (e.g., `supabase/ci-seed.sql`) would be cleaner but breaks the pattern established by steps 6 and 7. Consistency with the existing approach is more important for a minimal fix. If Phase 13 or later adds more seed data, consolidating into a file becomes worthwhile.

## Consequences

**Positive:**
- All 6 realtime E2E tests (T-054B-300 through T-054B-305) will have the correct selectors, data, RLS access, and WebSocket interception to execute.
- `ProjectPresenceStack` gains `data-testid` attributes that are useful for future E2E tests and debugging.
- CI seed data becomes sufficient for testing idea card interactions.
- Collaborators can now SELECT ideas in projects they belong to -- this is a production-correct behavior that was missing, not just a test fix.
- WebSocket route interception now works against both `ws://` (local Supabase) and `wss://` (production), making disconnect/reconnect tests portable.

**Negative:**
- Two new stable IDs are added to the CI seed data that must stay synchronized with any future test changes.
- `ProjectPresenceStack.tsx` gains 3 `data-testid` attributes that are only used in tests (no production cost, but slight code growth).
- New migration file adds a broader SELECT policy for ideas; must be reviewed to ensure it does not over-expose data beyond project scope.

**Risks:**
- Realtime channel timing on CI runners may cause flakiness even after fixes (see Spec Challenge above).
- The new RLS policy for ideas SELECT includes a subquery against `project_collaborators`. On tables with many collaborator rows, this could add latency to idea queries. Mitigation: `project_collaborators` already has an index on `(user_id)` (created in phase 5 collab schema, line 76) and the primary key covers `(project_id, user_id)`, so the EXISTS subquery will use an index scan.

**Migration rollback:** The new RLS migration (Step 2a) is self-contained. Rollback: run `DROP POLICY "Users can view ideas" ON public.ideas;` then re-create the original owner-only policy from migration `20251117190000`. Rollback window: any time before a subsequent migration depends on the collaborator SELECT behavior.

## Implementation Plan

### Step 1: Add `data-testid` attributes to ProjectPresenceStack

**After this step, I can:** See `data-testid="project-presence-stack"` and `data-testid="presence-avatar-{userId}"` in the DOM when inspecting the presence stack in fullscreen matrix view.

**Files to modify:**
1. `src/components/project/ProjectPresenceStack.tsx` -- add `data-testid` to root group div (line 222) and each Avatar wrapper (line 86)

**Changes:**

In the Avatar component (line 86), add `data-testid` to the existing `div`:
```tsx
// BEFORE (line 86-88):
<div
  role="img"
  aria-label={label}

// AFTER:
<div
  role="img"
  aria-label={label}
  data-testid={`presence-avatar-${participant.userId}`}
```

In the main component root group div (line 222-225), add `data-testid`:
```tsx
// BEFORE (line 222-225):
<div
  role="group"
  aria-label={`Matrix viewers: ${sorted.length} online`}
  className="flex items-center"
>

// AFTER:
<div
  role="group"
  aria-label={`Matrix viewers: ${sorted.length} online`}
  data-testid="project-presence-stack"
  className="flex items-center"
>
```

**Acceptance criteria:**
- `grep -rn 'data-testid="project-presence-stack"' src/` returns exactly 1 match in ProjectPresenceStack.tsx
- `grep -rn 'presence-avatar-' src/` returns the `data-testid` pattern in ProjectPresenceStack.tsx
- Existing `role` and `aria-label` attributes are unchanged
- `npm run type-check` passes
- `npm run lint` passes

**Complexity:** Low (2 lines added, 1 file)

---

### Step 2: Seed idea rows in CI workflow

**After this step, I can:** See idea cards rendered on the matrix when running the E2E test suite in CI, enabling drag/drop test interactions.

**Files to modify:**
1. `.github/workflows/integration-tests.yml` -- add INSERT statements for ideas in step 7 (after line 233, inside the existing `EOSQL` heredoc)

**Changes:**

Add idea seed SQL inside the existing step 7 `EOSQL` block, after the `project_invitations` INSERT and before the `REFRESH MATERIALIZED VIEW`:

```sql
-- 5. Test ideas for realtime matrix E2E tests (T-054B-302, T-054B-303)
-- x/y as percentage positions (0-100 scale matching DesignMatrix coordinate system)
-- created_by is the owner so RLS allows SELECT from both owner and collaborator viewports
INSERT INTO public.ideas (id, content, details, x, y, priority, created_by, project_id, created_at, updated_at) VALUES
  (
    'idea-ci-001',
    'CI Test Idea Alpha',
    'First test idea for drag/drop E2E',
    25, 25,
    'high',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    NOW(), NOW()
  ),
  (
    'idea-ci-002',
    'CI Test Idea Beta',
    'Second test idea for position propagation',
    75, 75,
    'moderate',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    NOW(), NOW()
  );
```

**Key design decisions:**
- `id` is text (not UUID) per baseline schema (line 125-126: "CRITICAL: id is TEXT (not uuid) -- this is intentional and load-bearing")
- Stable IDs `idea-ci-001` and `idea-ci-002` so tests can reference them deterministically
- `created_by` set to user 1 (owner) so RLS SELECT policy allows access
- `project_id` matches the existing test project UUID
- x/y positions place ideas in different quadrants (25,25 = top-left; 75,75 = bottom-right) so drag tests have distinct start positions
- Two ideas is sufficient: T-054B-302 uses `.first()` (needs >= 1), T-054B-303 uses the same first card

**Acceptance criteria:**
- CI workflow step 7 includes idea INSERT statements
- Idea IDs are stable text values (not UUIDs)
- Ideas reference the existing test project (`aaaaaaaa-...`)
- Ideas are created by the owner user (`11111111-...`)
- `npm run e2e:local -- -g "T-054B-302"` reaches the drag step (may still fail on realtime, but should not fail on "No idea cards found")

**Complexity:** Low (1 file, ~15 lines of SQL added to existing heredoc)

---

### Step 2a: Add collaborator SELECT RLS policy for ideas

**After this step, I can:** Sign in as the collaborator user (user 2) and see the owner's seeded idea cards on the matrix -- confirming that the RLS policy allows collaborator SELECT.

**Files to create:**
1. `supabase/migrations/20260412000000_ideas_collaborator_select.sql` -- new migration file (timestamp follows latest existing migration `20260410000000`)

**Changes:**

Create a new migration file with the following content:

```sql
-- Migration: Allow project collaborators to SELECT ideas
-- Fixes: RLS gap where only owner_id and is_admin() could view ideas.
-- Collaborators could not load idea cards, breaking T-054B-302 (lock overlay)
-- and T-054B-303 (position propagation) because LockedCardOverlay renders
-- inside the per-idea wrapper -- if ideas don't render, overlays don't render.
--
-- Rollback: DROP POLICY "Users can view ideas" ON public.ideas;
--           then re-CREATE the original owner-only policy from 20251117190000.

-- Drop the existing owner-only SELECT policy
DROP POLICY IF EXISTS "Users can view ideas" ON public.ideas;

-- Re-create with collaborator clause
CREATE POLICY "Users can view ideas"
ON public.ideas FOR SELECT
USING (
  (select auth.uid()) = (SELECT owner_id FROM public.projects WHERE id = ideas.project_id)
  OR is_admin()
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = ideas.project_id AND pc.user_id = (select auth.uid())
  )
);
```

**Key design decisions:**
- New migration file, not a modification of `20251117190000` (immutable migration rule -- existing migrations may have already run)
- Timestamp `20260412000000` follows the latest migration (`20260410000000_add_user_profiles_columns.sql`)
- DROP + CREATE pattern (not ALTER) because PostgreSQL RLS policies are replaced, not altered
- The EXISTS subquery against `project_collaborators` uses the existing PK index `(project_id, user_id)` for efficient lookup
- Policy name stays "Users can view ideas" to maintain consistency with the original

**Acceptance criteria:**
- `supabase/migrations/20260412000000_ideas_collaborator_select.sql` exists
- SQL drops the old policy then creates the new one with the collaborator clause
- `supabase db reset` completes without errors (validates migration ordering and SQL syntax)
- Sign in as user 2 (collaborator), navigate to the test project matrix -- idea cards from user 1 are visible
- Sign in as a user who is NOT a collaborator and NOT the owner -- idea cards are NOT visible (policy does not over-expose)

**Complexity:** Low (1 new file, ~15 lines of SQL)

---

### Step 3: Fix WebSocket scheme mismatch in disconnect/reconnect tests (T-054B-304, T-054B-305)

**After this step, I can:** Run T-054B-304 and T-054B-305 against local Supabase and see the reconnecting badge and recovery toast appear, because WebSocket interception now covers both `ws://` and `wss://` schemes.

**Files to modify:**
1. `tests/e2e/project-realtime-matrix.spec.ts` -- lines 246 and 271 (route), line 279 (unroute)

**Changes:**

In T-054B-304 (line 246), add `ws://` route alongside `wss://`:
```ts
// BEFORE (line 246):
await pageA.route('wss://**', (route) => route.abort())

// AFTER:
await pageA.route('wss://**', (route) => route.abort())
await pageA.route('ws://**', (route) => route.abort())
```

In T-054B-305 (line 271), add `ws://` route alongside `wss://`:
```ts
// BEFORE (line 271):
await pageA.route('wss://**', (route) => route.abort())

// AFTER:
await pageA.route('wss://**', (route) => route.abort())
await pageA.route('ws://**', (route) => route.abort())
```

In T-054B-305 (line 279), add `ws://` unroute alongside `wss://`:
```ts
// BEFORE (line 279):
await pageA.unroute('wss://**')

// AFTER:
await pageA.unroute('wss://**')
await pageA.unroute('ws://**')
```

**Key design decisions:**
- Both schemes are routed/unrouted because: local Supabase (`supabase start`) uses `ws://localhost:54321/realtime/...`; production Supabase uses `wss://`. Tests must work in both environments.
- Playwright `route()` is scheme-sensitive -- `wss://**` silently does nothing against `ws://` connections and vice versa. This is not a bug in Playwright; it is correct behavior. We must match both.
- The `wss://` route is kept (not replaced by `ws://`) so the test also works if run against a production-like TLS endpoint.

**Acceptance criteria:**
- T-054B-304 at spec.ts:246 has both `wss://**` and `ws://**` route calls
- T-054B-305 at spec.ts:271 has both `wss://**` and `ws://**` route calls
- T-054B-305 at spec.ts:279 has both `wss://**` and `ws://**` unroute calls
- `npm run e2e:local -- -g "T-054B-304"` shows the reconnecting badge appearing (not timing out on route match)
- `npm run e2e:local -- -g "T-054B-305"` shows the recovery toast appearing after unroute restores connections
- `npm run lint` passes (no lint warnings on the new lines)

**Complexity:** Low (1 file, 3 lines added)

---

### Step 4: Verify T-054B-301 (cursor) passes after Steps 1-3

**After this step, I can:** Run all 6 realtime E2E tests and see them pass (or have a documented, specific failure reason for T-054B-301 if realtime channel timing is the cause).

**Scope:** T-054B-301 (cursor appears in browser B) is the only test that remains unaddressed by Steps 1-3. T-054B-304 and T-054B-305 are fixed by Step 3 (ws:// scheme). T-054B-302 and T-054B-303 are fixed by Steps 2 + 2a (seed data + RLS).

**Files to modify (conditional -- only if T-054B-301 fails):**
1. `tests/e2e/project-realtime-matrix.spec.ts` -- add a `waitForSelector` guard before the mouse move to ensure the realtime channel has subscribed

**Verification approach:**
- Run `npm run e2e:local -- -g "T-054B-301"` and observe whether the live cursor appears in browser B
- The selector `[data-testid^="live-cursor-"]` at LiveCursorsLayer.tsx:85 is verified correct
- If the test fails, the most likely cause is that the realtime channel has not finished subscribing before mouse move events fire
- Fix: add a wait guard before the mouse move:
  ```ts
  await page.waitForSelector('[data-testid="project-realtime-provider"]', { timeout: 10_000 })
  ```
  This element exists at MatrixFullScreenView.tsx:771 and is only rendered inside `ProjectRealtimeProvider`

**Full suite verification:**
- Run `npm run e2e:local -- tests/e2e/project-realtime-matrix.spec.ts` -- all 6 tests pass
- Run the full suite a second time to confirm no flakiness (2 consecutive green per Roadmap:120)

**Acceptance criteria:**
- All 6 tests (T-054B-300 through T-054B-305) pass locally via `npm run e2e:local`
- All 6 tests pass in CI on 2 consecutive runs (flake threshold per Roadmap:120)
- No `strict mode violation` errors in Playwright logs
- No changes to test assertion logic (only timeouts or wait guards if needed)

**Complexity:** Low-Medium (diagnostic; 0-1 files depending on whether T-054B-301 passes without changes)

## Test Specification

### Test-to-Fix Mapping

| Test ID | Test Name | Root Cause | Fix Step | Selectors Used | Status Pre-Fix |
|---------|-----------|-----------|----------|---------------|----------------|
| T-054B-300 | Two browsers see each other in presence stack | Missing `data-testid` on ProjectPresenceStack | Step 1 | `[data-testid="project-presence-stack"]`, `[data-testid^="presence-avatar-"]` | ALWAYS FAIL (selector mismatch) |
| T-054B-301 | Cursor appears in browser B when A moves mouse | Blocked by T-300 failures in CI; selectors exist | Step 4 (verify) | `[data-testid^="live-cursor-"]` | UNKNOWN (never ran successfully) |
| T-054B-302 | Drag starts lock overlay in browser B | No idea rows in CI seed + RLS blocks collaborator SELECT | Step 2 + Step 2a | `[data-testid^="idea-card-"]`, `[data-testid="locked-card-overlay-{id}"]` | ALWAYS FAIL (no ideas to drag; collaborator cannot see ideas even if seeded) |
| T-054B-303 | Drop propagates position in browser B within 2s | No idea rows in CI seed + RLS blocks collaborator SELECT | Step 2 + Step 2a | `[data-testid^="idea-card-"]`, `[data-testid="idea-card-{id}"]` | ALWAYS FAIL (no ideas to drag; collaborator cannot see ideas even if seeded) |
| T-054B-304 | Disconnect shows reconnecting badge | WebSocket scheme mismatch: `wss://` route does not match local `ws://` | Step 3 | `getByRole('status', { name: /Reconnecting/i })` | ALWAYS FAIL (route silently misses ws:// connections) |
| T-054B-305 | Reconnect shows recovery toast | WebSocket scheme mismatch: `wss://` route/unroute does not match local `ws://` | Step 3 | `getByRole('status', { name: /Back online/i })` | ALWAYS FAIL (route silently misses ws:// connections) |

### Test Contract Boundaries

| ID | Category | Description |
|----|----------|-------------|
| T-0012-001 | Contract | `data-testid="project-presence-stack"` is a stable contract between ProjectPresenceStack.tsx:222 (producer) and project-realtime-matrix.spec.ts:36 (consumer) |
| T-0012-002 | Contract | `data-testid="presence-avatar-{userId}"` is a stable contract between ProjectPresenceStack.tsx:86 (producer) and project-realtime-matrix.spec.ts:83 (consumer) |
| T-0012-003 | Contract | `data-testid="idea-card-{id}"` is a stable contract between DesignMatrix.tsx:436 (producer) and project-realtime-matrix.spec.ts:149,198 (consumer) |
| T-0012-004 | Contract | Idea seed IDs `idea-ci-001`, `idea-ci-002` are stable contracts between integration-tests.yml step 7 (producer) and the `[data-testid^="idea-card-"]` query (consumer) |
| T-0012-005 | Contract | `getByRole('status', { name: /Reconnecting/i })` relies on ReconnectingBadge.tsx:105 `aria-label` containing "Reconnecting" -- copy change would break test |
| T-0012-006 | Contract | `getByRole('status', { name: /Back online/i })` relies on ReconnectingBadge.tsx:143 `aria-label` containing "Back online" -- copy change would break test |
| T-0012-007 | Failure | If presence stack shows only 1 avatar (self) after 5s, realtime presence sync failed -- likely channel subscription delay |
| T-0012-008 | Failure | If drag does not produce lock overlay within 3s, either broadcast is not firing or `useDragLock` is not propagating to `lockedCards` Map |
| T-0012-009 | Failure | If position does not propagate within 2s, either optimistic update is not broadcasting or the remote listener is not updating local state |
| T-0012-010 | Failure | If reconnecting badge does not appear within 3s of WS block, either route blocking is not intercepting Supabase Realtime (check both ws:// and wss://), or the 1.5s delay timer is not triggering |
| T-0012-011 | Contract | RLS policy "Users can view ideas" on `public.ideas` must include collaborator clause via `project_collaborators` join -- migration `20260412000000` (producer) consumed by DesignMatrix.tsx idea query (consumer) |
| T-0012-012 | Contract | Playwright `pageA.route('ws://**', ...)` and `pageA.route('wss://**', ...)` in T-054B-304/305 must both be present -- local Supabase uses `ws://`, production uses `wss://` |

### Verification Tests (run by Roz)

| ID | Category | Description |
|----|----------|-------------|
| T-0012-V01 | Grep | `grep -rn 'data-testid="project-presence-stack"' src/` returns exactly 1 match |
| T-0012-V02 | Grep | `grep -rn 'data-testid=.*presence-avatar-' src/` returns match in ProjectPresenceStack.tsx |
| T-0012-V03 | Grep | `grep -c 'idea-ci-00' .github/workflows/integration-tests.yml` returns >= 2 |
| T-0012-V04 | Lint | `npm run lint` passes with no new warnings |
| T-0012-V05 | Type | `npm run type-check` passes |
| T-0012-V06 | A11y | `role="group"` and `role="img"` still present on ProjectPresenceStack elements (not replaced by data-testid) |
| T-0012-V07 | Migration | `supabase/migrations/20260412000000_ideas_collaborator_select.sql` exists and contains `project_collaborators` in the USING clause |
| T-0012-V08 | Migration | `supabase db reset` completes without errors (validates migration ordering and SQL syntax) |
| T-0012-V09 | Grep | `grep -c "ws://" tests/e2e/project-realtime-matrix.spec.ts` returns >= 3 (2 route + 1 unroute) |
| T-0012-V10 | E2E | `npm run e2e:local -- tests/e2e/project-realtime-matrix.spec.ts` -- 6 tests pass |

## Contract Boundaries

| Producer | Shape | Consumer |
|----------|-------|----------|
| ProjectPresenceStack.tsx root div | `data-testid="project-presence-stack"` | spec.ts:36 `PRESENCE_STACK_SELECTOR` |
| ProjectPresenceStack.tsx Avatar div | `data-testid="presence-avatar-{userId}"` | spec.ts:83 `[data-testid^="presence-avatar-"]` |
| DesignMatrix.tsx idea wrapper div | `data-testid="idea-card-{id}"` | spec.ts:149,198 `[data-testid^="idea-card-"]` |
| integration-tests.yml step 7 SQL | `id='idea-ci-001'`, `id='idea-ci-002'` in `public.ideas` | DesignMatrix renders them as `data-testid="idea-card-idea-ci-001"` |
| Migration `20260412000000` RLS policy | `SELECT` on `public.ideas` for collaborators via `project_collaborators` join | DesignMatrix.tsx idea query for collaborator user (pageB in T-054B-302/303) |
| LiveCursorsLayer.tsx cursor div | `data-testid="live-cursor-{userId}"` | spec.ts:123 `[data-testid^="live-cursor-"]` |
| LockedCardOverlay.tsx overlay div | `data-testid="locked-card-overlay-{ideaId}"` | spec.ts:170 `[data-testid="locked-card-overlay-{ideaId}"]` |
| ReconnectingBadge.tsx badge div | `role="status" aria-label="Reconnecting..."` | spec.ts:250 `getByRole('status', { name: /Reconnecting/i })` |
| ReconnectingBadge.tsx toast div | `role="status" aria-label="Back online. Synced."` | spec.ts:283 `getByRole('status', { name: /Back online/i })` |
| spec.ts T-054B-304/305 route calls | `pageA.route('ws://**', ...)` + `pageA.route('wss://**', ...)` | Supabase Realtime WebSocket (both schemes) |

## Wiring Coverage

| Producer | Shape | Consumer | Step |
|----------|-------|----------|------|
| `data-testid="project-presence-stack"` (ProjectPresenceStack.tsx) | DOM attribute | `PRESENCE_STACK_SELECTOR` (spec.ts:36) | Step 1 |
| `data-testid="presence-avatar-{userId}"` (ProjectPresenceStack.tsx) | DOM attribute | `[data-testid^="presence-avatar-"]` (spec.ts:83) | Step 1 |
| CI seed `INSERT INTO ideas` (integration-tests.yml) | DB rows | `[data-testid^="idea-card-"]` (spec.ts:149) via DesignMatrix.tsx:436 | Step 2 |
| RLS policy "Users can view ideas" with collaborator clause (migration `20260412000000`) | RLS policy | DesignMatrix.tsx idea query (collaborator user SELECT) | Step 2a |
| `pageA.route('ws://**', ...)` + `pageA.route('wss://**', ...)` (spec.ts T-054B-304) | Playwright route interception | ReconnectingBadge.tsx:105 (badge appears on WS disconnect) | Step 3 |
| `pageA.unroute('ws://**')` + `pageA.unroute('wss://**')` (spec.ts T-054B-305) | Playwright route release | ReconnectingBadge.tsx:143 (recovery toast on WS reconnect) | Step 3 |
| Existing `data-testid="live-cursor-{userId}"` (LiveCursorsLayer.tsx:85) | DOM attribute | `[data-testid^="live-cursor-"]` (spec.ts:123) | Step 4 (verify only) |

No orphan producers. No orphan consumers. Every test selector maps to a component attribute, RLS policy, or route interception that either already exists or is added in this ADR.

## Data Sensitivity

| Method/Data | Classification | Rationale |
|-------------|---------------|-----------|
| CI seed idea content ("CI Test Idea Alpha/Beta") | `public-safe` | Synthetic test data, no PII |
| CI seed user emails (owner@test.com, etc.) | `public-safe` | Already in CI workflow, ephemeral test data |
| `data-testid` attributes | `public-safe` | Visible in DOM, no security implication |
| Supabase service role key in CI | `auth-only` | Already handled by existing CI workflow; not changed by this ADR |
| RLS policy "Users can view ideas" (migration `20260412000000`) | `auth-only` | Scoped to authenticated users who are owner, admin, or project collaborator; no anonymous access |
| `project_collaborators` table join in RLS | `auth-only` | Only queried server-side by PostgreSQL during RLS evaluation; user_id compared against `auth.uid()` |

## Notes for Colby

### Step 1 Implementation Detail

The `data-testid` additions are purely additive. Do NOT remove or modify the existing `role="group"`, `role="img"`, `aria-label`, or `title` attributes. The test file uses `data-testid` selectors; accessibility tools use the `role`/`aria-*` attributes. Both must coexist.

The `presence-avatar-{userId}` pattern uses the participant's `userId` property which is already available in the Avatar component via `participant.userId`. The test queries with `[data-testid^="presence-avatar-"]` (prefix match), so the exact userId value does not matter to the selector -- it just needs the prefix.

### Step 2 Implementation Detail

Insert the idea SQL AFTER the `project_invitations` block and BEFORE the `REFRESH MATERIALIZED VIEW` block. The ideas table has no FK to `project_invitations`, so ordering between them does not matter, but the `project_id` FK requires the project to exist (it does -- inserted in block 2).

The `x` and `y` columns are `numeric` type in the schema. The values 25 and 75 place ideas at 25% and 75% of the matrix, corresponding to different quadrants. The `DesignMatrix.tsx` component reads these values and positions cards via `style.left` and `style.top` as percentages.

The `id` column is TEXT, not UUID. Use human-readable stable strings like `'idea-ci-001'`. Do NOT use `gen_random_uuid()` -- the tests need deterministic IDs.

### Step 3 Implementation Detail

The ws:// fix is straightforward: add one `route` line after each existing `route('wss://**', ...)` call, and one `unroute` line after the existing `unroute('wss://**')` call. Do NOT remove the `wss://` lines -- both schemes must be covered so the test works against both local Supabase (`ws://localhost:54321/realtime/...`) and production-like endpoints (`wss://`).

### Step 4 Diagnostic Approach

If T-054B-301 (cursor) fails after Steps 1-3 are applied, the most likely cause is that the realtime channel has not finished subscribing before the mouse move events fire. Add a wait guard before the mouse move:
```ts
// Wait for realtime channel to be subscribed (provider renders data-testid after subscription)
await page.waitForSelector('[data-testid="project-realtime-provider"]', { timeout: 10_000 })
```
This element exists at MatrixFullScreenView.tsx:771 and is only rendered inside the `ProjectRealtimeProvider`, which initializes the channel.

### RLS Consideration -- RESOLVED by Step 2a

The original analysis noted that the RLS policy for `ideas` SELECT only allows owner or admin. Roz's review confirmed this deterministically: all 30 migration files were checked, and no migration adds collaborator-based SELECT for ideas. The phase 5 collab migrations only touch `project_collaborators` and `projects` tables, not `ideas`.

This matters for two reasons:
1. **T-054B-302 (lock overlay):** `LockedCardOverlay` renders inside the per-idea `div` wrapper at DesignMatrix.tsx:450-452. If the collaborator cannot SELECT ideas, the ideas don't render, and the overlay `div` is never mounted. The lock overlay reads from `ProjectRealtimeContext.lockedCards` (realtime broadcast), but it can only render if its parent idea element exists in the DOM.
2. **T-054B-303 (position propagation):** The test explicitly queries `pageB.locator('idea-card-${ideaId}')` at spec.ts:203. If the collaborator cannot SELECT ideas, this locator returns nothing.

**Resolution:** Step 2a creates migration `20260412000000_ideas_collaborator_select.sql` that drops the existing owner-only SELECT policy and re-creates it with a collaborator clause. This is a production-correct fix (collaborators should be able to see ideas in shared projects), not just a test accommodation.

### Proven Patterns from This Codebase

- `data-testid` attribute pattern: see DesignMatrix.tsx:292, LiveCursorsLayer.tsx:85, LockedCardOverlay.tsx:101, MatrixFullScreenView.tsx:776
- CI seed SQL pattern: see integration-tests.yml step 7, lines 167-233
- Stable UUID pattern for CI: see existing UUIDs `11111111-...`, `22222222-...`, `aaaaaaaa-...`
- RLS policy DROP + CREATE pattern: see `20251117190000_fix_all_rls_warnings.sql` lines 170-181 (drops old policy, creates unified one). Step 2a follows the same pattern.
- Collaborator-aware RLS with EXISTS subquery: see `20260408000000_phase5_collab_schema.sql` lines 81-89 (`project_collaborators` join for visibility). Step 2a extends this to the `ideas` table.

## DoD: Verification

| # | Requirement | Status | Evidence |
|---|------------|--------|----------|
| R1 | T-054B-300 presence stack testids | Done | Step 1 adds `data-testid="project-presence-stack"` and `data-testid="presence-avatar-{userId}"` |
| R2 | T-054B-301 cursor selector exists | Done (pre-existing) | LiveCursorsLayer.tsx:85 already has `data-testid={live-cursor-${userId}}` |
| R3 | T-054B-302 idea cards in CI + collaborator can SELECT | Done | Step 2 seeds 2 idea rows; Step 2a adds collaborator RLS clause so pageB sees them |
| R4 | T-054B-303 idea cards in CI + collaborator can SELECT | Done | Same as R3 -- Step 2 seeds ideas, Step 2a enables collaborator SELECT |
| R5 | T-054B-304 reconnecting badge selector + ws:// interception | Done | ReconnectingBadge.tsx:105 has matching selector; Step 3 adds `ws://` route alongside `wss://` |
| R6 | T-054B-305 recovery toast selector + ws:// interception | Done | ReconnectingBadge.tsx:143 has matching selector; Step 3 adds `ws://` route/unroute alongside `wss://` |
| R7 | No strict mode violation | Done (disproved) | Scout evidence: `data-testid="design-matrix"` exists in exactly 1 place (DesignMatrix.tsx:292). Original hypothesis was wrong. |
| R8 | 2 consecutive green CI runs | Deferred to Step 4 execution | Cannot verify until implementation is applied and CI runs |
| R9 | All realtime features functional | Deferred to Step 4 execution | Step 4 is the verification step; latent issues addressed there |
| R10 | Collaborator can SELECT ideas via RLS | Done | Step 2a creates new migration with `project_collaborators` join in SELECT policy |
| R11 | WebSocket route interception covers both schemes | Done | Step 3 adds `ws://**` pattern alongside existing `wss://**` in T-054B-304/305 |

**Grep check:** No TODO/FIXME/HACK/XXX in this ADR.
**Template:** All sections filled -- no TBD, no placeholders.
