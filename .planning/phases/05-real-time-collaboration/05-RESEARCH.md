# Phase 5: Real-Time Collaboration - Research

**Researched:** 2026-04-07
**Domain:** Supabase Realtime (Postgres Changes + Broadcast + Presence), invitation flows, soft-locking, dot voting
**Confidence:** HIGH for Supabase APIs and existing-code reuse; MEDIUM for cursor throttle target and lock grace tuning.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Voting**
- D-01: Dot voting — fixed budget of **5 dots per user per brainstorm session**
- D-02: Budget hard-coded at 5 for MVP (no per-session config, no tier coupling)
- D-03: Vote tallies broadcast in real-time (COLLAB-06)
- D-04: New `idea_votes` table (`user_id, idea_id, session_id, created_at`) with RLS; tallies derived by counting rows

**Invitations & Permissions**
- D-05: Email link → Supabase Auth signup → attach to project with pre-assigned role
- D-06: Roles: **Viewer** (read-only) and **Editor** (full edit). Owner is implicit via `project.user_id`. No separate owner tier.
- D-07: Invitation tokens single-use, server-side, expire after 7 days
- D-08: Reuse existing `InviteCollaboratorModal.tsx` (310 lines) — wire to real backend

**Real-Time Scope**
- D-09: Realtime extends to **brainstorm sessions AND project matrix view**
- D-10: Architecture: extend/parallel `BrainstormRealtimeManager` with project-scoped manager (or generalize). Decision deferred to planning.

**Matrix Drag Conflict**
- D-11: **Soft lock while dragging** — others see card grayed/non-interactive. Reuse `ideaLockingService` pattern.
- D-12: Lock broadcast via realtime; auto-release on drop, disconnect, or timeout (~10s grace)

**Presence**
- D-13: Indicators in three places: brainstorm session, project matrix avatar stack (new), live cursors on matrix (Figma-style)
- D-14: Cursor broadcast throttled (~20Hz max target)

**Connection Resilience**
- D-15: Auto-reconnect with polling fallback (existing pattern), subtle "reconnecting" indicator, optimistic updates preserved
- D-16: On reconnect, fetch authoritative state to reconcile

### Claude's Discretion
- Channel naming scheme and subscription lifecycle
- Cursor throttle rate (within ~20Hz target)
- UI styling for locked cards, reconnecting indicator, cursor colors/labels
- Dot vote display (counter vs cluster)
- Invitation email copy and template
- Lock grace timeout exact value

### Deferred Ideas (OUT OF SCOPE)
- Per-session configurable dot budget
- Commenter tier
- Public shareable invite links (no email)
- CRDT-based position merging (explicitly rejected)
- Tier-based vote budgets (Phase 6)
- Explicit owner permission tier
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLLAB-01 | Real-time presence indicators in brainstorm sessions | Supabase Presence API on session channel; reuse `PresenceIndicators.tsx` |
| COLLAB-02 | Ideas created by any participant appear live without refresh | Postgres Changes on `ideas` table OR broadcast on session/project channel; existing `useBrainstormRealtime` pattern |
| COLLAB-03 | User can invite collaborators via email | New `/api/invitations` endpoint + EmailJS (existing) or Supabase email; new `project_invitations` table |
| COLLAB-04 | Invited collaborator joins with viewer/editor permissions | Token-based accept flow → `project_collaborators` row → RLS reads role |
| COLLAB-05 | Dot voting during brainstorm | New `idea_votes` table + `voteRepository`; 5-dot budget enforced via row count + RLS |
| COLLAB-06 | Vote tallies update in real-time | Postgres Changes on `idea_votes` filtered by `session_id`, OR broadcast event |
| COLLAB-07 | Idea position changes broadcast on matrix | Postgres Changes on `ideas.x/y` OR broadcast for low-latency drag, plus DB persistence on drop |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Smart Mode = SAFE MODE** — this phase touches Supabase Realtime, auth, and idea pipeline. Sequential agent execution required. No parallel MCP ops on these subsystems.
- **No duplicate Supabase clients** — reuse existing client factory; do not create a new client per channel manager.
- **Never bypass RLS** — all new tables (`idea_votes`, `project_collaborators`, `project_invitations`) must have RLS policies before any write code lands.
- **Service role key is backend-only** — invitation token validation runs in `/api/*` routes, not the frontend.
- **`supabase.auth.getSession()` deadlock risk** — use lock-free localStorage read for token (per `feedback_supabase_auth_deadlock.md` memory). Affects any new authenticated client construction in invitation accept flow.
- **Repository pattern is mandatory** — new data access goes through `voteRepository`, `collaboratorRepository`, `invitationRepository` in `src/lib/repositories/`.
- **Mobile + desktop sync must remain consistent** — presence and vote state must reconcile after mobile background → foreground.
- Use `logger.debug/info/warn/error` from `src/utils/logger.ts`, never `console.*`.

## Summary

Phase 5 is largely a **wiring and extension** phase rather than greenfield. The codebase already has a 521-line `BrainstormRealtimeManager` with reconnect + polling fallback, a `PresenceIndicators` component, and a 310-line `InviteCollaboratorModal` UI. The work is: (1) generalize the realtime manager to also handle a project-scoped channel, (2) add three new tables with RLS, (3) build invitation backend endpoints, (4) wire dot voting through a new repository, and (5) add live cursors and soft-drag-lock broadcasts.

Supabase Realtime has three primitives — **Postgres Changes** (DB-driven, durable, RLS-aware), **Broadcast** (low-latency, ephemeral, ideal for cursors and drag positions in flight), and **Presence** (auto-tracked online state with join/leave events). This phase uses **all three**: Postgres Changes for ideas + votes (so reconnect reconciliation is automatic), Broadcast for cursors and in-flight drag positions and lock acquire/release, and Presence for online indicators.

**Primary recommendation:** Generalize `BrainstormRealtimeManager` into a `ScopedRealtimeManager` that takes a `scope: { type: 'session' | 'project'; id: string }` and exposes the same reconnect/polling/diagnostic surface. Layer Presence and Broadcast on top of the same channel rather than opening multiple channels per scope — Supabase channels multiplex all three primitives.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.57.2 (installed) → 2.102.1 latest [VERIFIED: npm view] | Realtime channels, Postgres Changes, Presence, Broadcast | Already the project's data + auth + realtime layer |
| @dnd-kit/core | 6.1.0 (installed) | Drag handlers — hook into for soft-lock broadcast | Already used for matrix drag |
| EmailJS (@emailjs/browser) | 4.4.1 (installed) | Invitation email send (client-side) | Already wired in project for collaboration emails |

**Version note:** The installed `@supabase/supabase-js` is 2.57.2 but latest is 2.102.1. **No upgrade required for this phase** — Realtime Presence/Broadcast/Postgres Changes APIs have been stable since 2.4x. Plan should NOT bundle a Supabase upgrade with Phase 5; treat that as a separate concern. [VERIFIED: npm view @supabase/supabase-js version → 2.102.1]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | 9.0.1 (installed) | Generate invitation tokens | Server-side in `/api/invitations` (use crypto.randomUUID() instead — no extra dep needed) |
| validator | 13.15.23 (installed) | Email validation in invite endpoint | Reuse existing util |
| DOMPurify | 3.2.7 (installed) | Sanitize cursor labels / display names | If rendering user-provided names in cursor labels |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Broadcast for cursors | Postgres Changes on a `cursor_positions` table | DB writes at 20Hz × N users would melt the DB. Broadcast is correct. |
| Supabase Presence for online status | Custom heartbeat table | Presence is built-in, auto-cleans on disconnect, free with the channel. |
| EmailJS for invitation send | Supabase Auth `inviteUserByEmail` admin call | EmailJS is already wired. Supabase invite is admin-only and would require service role + custom template. EmailJS is the lower-friction path consistent with D-05 + D-08. |
| Sending raw token in URL | Hashed token in DB, raw in URL | Hash in DB is best practice; raw lookup is acceptable for 7-day single-use MVP. **Recommend hashed.** |

**Installation:** No new packages required. All dependencies are already in `package.json`.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── realtime/
│   │   ├── BrainstormRealtimeManager.ts   # existing — keep
│   │   ├── ScopedRealtimeManager.ts       # NEW — generalized base, or refactor target
│   │   ├── ProjectRealtimeManager.ts      # NEW — project-scope channel (presence + cursors + drag locks + idea sync)
│   │   └── cursorThrottle.ts              # NEW — rAF-based cursor batcher
│   ├── repositories/
│   │   ├── voteRepository.ts              # NEW — idea_votes CRUD + tally
│   │   ├── collaboratorRepository.ts      # NEW — project_collaborators
│   │   └── invitationRepository.ts        # NEW — project_invitations
│   └── services/
│       └── dragLockService.ts             # NEW — broadcasts lock/unlock, mirrors ideaLockingService API
├── hooks/
│   ├── useBrainstormRealtime.ts           # existing — extend with vote events
│   ├── useProjectRealtime.ts              # NEW — project-scope hook (presence, cursors, drag sync)
│   ├── useDotVoting.ts                    # NEW — 5-dot budget + optimistic
│   ├── useDragLock.ts                     # NEW — wraps dragLockService for matrix
│   └── useLiveCursors.ts                  # NEW — cursor send + render state
├── components/
│   ├── matrix/
│   │   ├── LiveCursorsLayer.tsx           # NEW — Figma-style cursor overlay
│   │   └── ProjectPresenceStack.tsx       # NEW — avatar stack
│   └── brainstorm/
│       ├── DotVoteControls.tsx            # NEW — 5-dot budget UI on idea card
│       └── PresenceIndicators.tsx         # existing — wire scope prop
api/
├── invitations/
│   ├── create.ts                          # NEW — POST /api/invitations
│   ├── accept.ts                          # NEW — POST /api/invitations/accept
│   └── lookup.ts                          # NEW — GET /api/invitations/[token] (preview)
```

### Pattern 1: Multiplexed Channel (Postgres Changes + Presence + Broadcast on one channel)

**What:** A single Supabase Realtime channel can carry all three primitives. Don't open three channels per scope.

**When to use:** Always. One channel per `(scope, scope_id)` keeps subscription count linear in users × scopes, not 3×.

**Example:**
```typescript
// Source: supabase.com/docs/guides/realtime (verified pattern)
const channel = supabase.channel(`project:${projectId}`, {
  config: { presence: { key: userId } }
})

channel
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'ideas', filter: `project_id=eq.${projectId}` },
      handleIdeaChange)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'idea_votes', filter: `session_id=eq.${sessionId}` },
      handleVoteChange)
  .on('broadcast', { event: 'cursor' }, handleCursor)
  .on('broadcast', { event: 'drag_lock' }, handleDragLock)
  .on('broadcast', { event: 'drag_position' }, handleDragPosition)
  .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
  .on('presence', { event: 'join' }, ({ newPresences }) => /* ... */)
  .on('presence', { event: 'leave' }, ({ leftPresences }) => /* ... */)
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ user_id: userId, name, color, online_at: new Date().toISOString() })
    }
  })
```

### Pattern 2: Postgres Changes for Durable State, Broadcast for Ephemeral

| Data | Mechanism | Why |
|------|-----------|-----|
| New idea created | Postgres Changes on `ideas` | Survives reconnect; RLS enforced; reconciliation automatic |
| Vote cast/removed | Postgres Changes on `idea_votes` | Same as above; tally is `count(*)` per idea |
| Final drag position (on drop) | Postgres Changes on `ideas.x,y` | Persisted authoritative state |
| In-flight drag position (during drag) | Broadcast `drag_position` | High frequency, ephemeral, never hits DB |
| Drag lock acquire/release | Broadcast `drag_lock` | Ephemeral; auto-cleared on disconnect via Presence leave |
| Cursor positions | Broadcast `cursor` | 20Hz, ephemeral, would destroy DB if persisted |
| Online status | Presence | Built-in, auto-cleanup on disconnect |

### Pattern 3: Soft-Lock via Presence + Broadcast

The lock state lives in **Broadcast** (for explicit acquire/release) AND is implicitly cleared when the holder disappears from **Presence** (disconnect). This gives the 10s grace timeout for free if you piggyback on Presence's heartbeat (default ~30s) — but for the D-12 10s grace, prefer an explicit client-side `setTimeout` on lock receipt that auto-releases if no heartbeat.

**Pseudo:**
```typescript
// On drag start
channel.send({ type: 'broadcast', event: 'drag_lock',
  payload: { ideaId, userId, action: 'acquire', expiresAt: Date.now() + 10000 } })

// On drag end (or timeout)
channel.send({ type: 'broadcast', event: 'drag_lock',
  payload: { ideaId, userId, action: 'release' } })

// Also: when Presence 'leave' fires, sweep all locks held by that userId
```

### Pattern 4: Cursor Throttle via requestAnimationFrame

20Hz target = ~50ms interval. **Don't use `setInterval`** — coalesce on `requestAnimationFrame` and skip frames if the position hasn't changed since the last send.

```typescript
let pending: { x: number; y: number } | null = null
let lastSent = 0
function onMouseMove(e) {
  pending = { x: e.clientX, y: e.clientY }
  requestAnimationFrame(flush)
}
function flush() {
  const now = performance.now()
  if (now - lastSent < 50 || !pending) return
  channel.send({ type: 'broadcast', event: 'cursor', payload: { ...pending, userId } })
  lastSent = now
  pending = null
}
```

### Anti-Patterns to Avoid

- **One channel per primitive (cursors / votes / presence each on its own channel):** Multiplies subscription count. Use one channel per scope.
- **Persisting cursor positions to a DB table:** DB write storm. Use Broadcast.
- **Computing tallies in the client by listening to vote inserts only:** Misses initial state on join. Always do an initial `count` query on subscribe, then increment/decrement from realtime events.
- **Trusting client-sent vote count:** Enforce 5-dot budget via RLS policy that checks `(select count(*) from idea_votes where user_id = auth.uid() and session_id = new.session_id) < 5`. Never rely on the frontend.
- **Sending invitation token in URL query string only:** Logs leak tokens. Use URL fragment (`#token=…`) OR POST after click. Recommend fragment + immediate exchange.
- **Creating a second Supabase client for the realtime manager:** Project rule. Reuse the singleton.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Online presence | Custom heartbeat table + cleanup cron | Supabase Presence API | Built-in; auto-cleanup on disconnect; free with channel |
| Vote tally fan-out | Custom WebSocket pubsub | Postgres Changes on `idea_votes` | Durable, RLS-enforced, reconnect-safe |
| Cursor delivery | Custom WebSocket server | Supabase Broadcast | Reuses existing channel; no new infra |
| Channel reconnect logic | New reconnect loop | Existing `BrainstormRealtimeManager` | 521 lines already, battle-tested, has polling fallback |
| Invitation email send | Custom SMTP | EmailJS (already integrated) | Already in project; D-08 says reuse |
| Token generation | bcrypt of timestamp etc. | `crypto.randomUUID()` server-side | Cryptographically random, no dep |
| Drag-and-drop | Custom mouse handlers | @dnd-kit (already used) | Established in project |
| Permission enforcement | App-layer if/else only | Supabase RLS policies | Defense in depth; SECURITY rule from CLAUDE.md |

**Key insight:** Almost every primitive needed for Phase 5 is either already in the codebase or built into Supabase. The risk in this phase is **rebuilding instead of extending**.

## Runtime State Inventory

This is not a rename phase, but it touches realtime channels and adds DB schema, so a partial inventory applies:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — all new tables (`idea_votes`, `project_collaborators`, `project_invitations`) are greenfield. Existing `ideas` table x/y columns already exist. | Migration only (CREATE TABLE) |
| Live service config | Supabase Realtime is enabled at the project level — verify `realtime` is enabled on new tables in the dashboard (or via migration `alter publication supabase_realtime add table idea_votes;`) | Migration must add new tables to the realtime publication |
| OS-registered state | None | None |
| Secrets/env vars | EmailJS keys already in `VITE_EMAILJS_*`. No new secrets required. Invitation accept flow uses existing `SUPABASE_SERVICE_ROLE_KEY` server-side. | None |
| Build artifacts | None | None |

**Critical:** Don't forget `alter publication supabase_realtime add table <newtable>;` for `ideas` (already there?), `idea_votes`, and any other table you want Postgres Changes events from. Tables not in the publication silently emit zero events.

## Common Pitfalls

### Pitfall 1: Postgres Changes RLS filter mismatch
**What goes wrong:** Subscribing to `postgres_changes` with `filter: 'project_id=eq.X'` returns no events even though rows are being inserted.
**Why:** RLS must allow the subscribing user to SELECT the row, OR the publication must be configured for replica identity FULL. Realtime evaluates RLS for each event.
**How to avoid:** Ensure your SELECT RLS policy on `idea_votes` lets session participants read all votes in their session. Test by running a `select` as the same user before subscribing.
**Warning signs:** Events fire for the inserter but not for other users.

### Pitfall 2: Presence key collisions across tabs
**What goes wrong:** Same user open in two tabs shows up as one presence, or join/leave events flap.
**Why:** Presence key defaults to a random string per channel; if you set it to `userId`, second tab overwrites first.
**How to avoid:** Use `${userId}:${tabId}` as the presence key, then dedupe by `userId` in the UI.
**Warning signs:** Avatar stack flickers when user opens a second tab.

### Pitfall 3: Reconnect loses in-flight votes
**What goes wrong:** User casts a vote, network blips, vote is lost.
**Why:** Optimistic update happened locally but the INSERT never reached the server.
**How to avoid:** Existing optimistic update pattern + on reconnect, fetch authoritative tally and reconcile (matches D-16). The repository should expose a `reconcile(sessionId)` method.
**Warning signs:** "5 votes shown locally, 4 in DB" after a flaky connection.

### Pitfall 4: Drag lock orphaned on tab close
**What goes wrong:** User closes tab mid-drag, lock never released, others see card locked forever.
**Why:** No explicit `release` broadcast on unmount; reliance on Presence leave is ~30s late.
**How to avoid:** (a) Send release on `beforeunload`, (b) Lock includes `expiresAt`, peers auto-release on timeout, (c) Sweep locks on Presence leave event.
**Warning signs:** Locked cards persist after a user disconnects.

### Pitfall 5: Vote budget enforced client-side only
**What goes wrong:** Malicious client sends 100 votes.
**Why:** Frontend trusted with limit logic.
**How to avoid:** RLS policy on INSERT into `idea_votes`: `with check ((select count(*) from idea_votes v where v.user_id = auth.uid() and v.session_id = new.session_id) < 5)`. **Required.**
**Warning signs:** Tests that bypass the UI succeed in inserting >5 rows.

### Pitfall 6: Invitation accept races signup
**What goes wrong:** User clicks invite link, signs up, but `project_collaborators` row is created before the user row exists, or vice versa.
**Why:** Two-step async without a transaction.
**How to avoid:** Defer the collaborator row creation until after Supabase Auth signup completes — the accept endpoint should run as the **newly authenticated user** with their JWT, not the service role. Use a Postgres function `accept_invitation(token text)` that runs `security definer` and atomically validates token + creates collaborator + marks invitation accepted.
**Warning signs:** Orphaned `project_collaborators` rows or invitations marked accepted with no collaborator.

### Pitfall 7: `supabase.auth.getSession()` deadlock in invitation accept
**What goes wrong:** Invitation accept page calls `getSession()`, which deadlocks under storage contention (per project memory).
**Why:** Documented in `feedback_supabase_auth_deadlock.md`.
**How to avoid:** Use lock-free localStorage read for the access token, mirror what `useAuth.ts` already does post-fix.
**Warning signs:** Accept page hangs forever after click.

### Pitfall 8: Channel not added to publication
**What goes wrong:** Postgres Changes events never fire for `idea_votes`.
**Why:** New table not in `supabase_realtime` publication.
**How to avoid:** Migration includes `alter publication supabase_realtime add table public.idea_votes;`.
**Warning signs:** Subscribe succeeds, but inserts produce no client events.

## Code Examples

### Vote tally with initial fetch + realtime delta
```typescript
// Source: pattern derived from supabase.com/docs/guides/realtime/postgres-changes
async function subscribeToVotes(sessionId: string, onTallyChange: (tallies: Map<string, number>) => void) {
  const tallies = new Map<string, number>()
  // 1. Initial fetch
  const { data } = await supabase
    .from('idea_votes')
    .select('idea_id')
    .eq('session_id', sessionId)
  data?.forEach(r => tallies.set(r.idea_id, (tallies.get(r.idea_id) ?? 0) + 1))
  onTallyChange(new Map(tallies))

  // 2. Live deltas on the same channel as ideas/presence
  const channel = supabase.channel(`session:${sessionId}`)
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'idea_votes', filter: `session_id=eq.${sessionId}` },
        ({ new: row }) => {
          tallies.set(row.idea_id, (tallies.get(row.idea_id) ?? 0) + 1)
          onTallyChange(new Map(tallies))
        })
    .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'idea_votes', filter: `session_id=eq.${sessionId}` },
        ({ old: row }) => {
          const next = (tallies.get(row.idea_id) ?? 1) - 1
          if (next <= 0) tallies.delete(row.idea_id)
          else tallies.set(row.idea_id, next)
          onTallyChange(new Map(tallies))
        })
    .subscribe()
  return () => supabase.removeChannel(channel)
}
```

### Dot-vote RLS policies (idea_votes)
```sql
-- Source: supabase.com/docs/guides/auth/row-level-security (pattern)
alter table idea_votes enable row level security;

-- Anyone in the session can read tallies
create policy "session participants read votes" on idea_votes
for select using (
  exists (
    select 1 from session_participants sp
    where sp.session_id = idea_votes.session_id
      and sp.user_id = auth.uid()
  )
);

-- Insert only own votes, max 5 per session
create policy "cast vote within budget" on idea_votes
for insert with check (
  user_id = auth.uid()
  and (select count(*) from idea_votes v
       where v.user_id = auth.uid()
         and v.session_id = idea_votes.session_id) < 5
);

-- Delete only own votes
create policy "remove own vote" on idea_votes
for delete using (user_id = auth.uid());

-- Add to realtime publication
alter publication supabase_realtime add table idea_votes;
```

### Invitation accept (atomic via SECURITY DEFINER function)
```sql
create or replace function accept_invitation(p_token text)
returns table (project_id uuid, role text)
language plpgsql security definer set search_path = public as $$
declare
  v_inv project_invitations%rowtype;
begin
  select * into v_inv from project_invitations
   where token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and accepted_at is null
     and expires_at > now()
   for update;
  if not found then raise exception 'invalid_or_expired'; end if;

  insert into project_collaborators (project_id, user_id, role, invited_by, joined_at)
  values (v_inv.project_id, auth.uid(), v_inv.role, v_inv.invited_by, now())
  on conflict (project_id, user_id) do update set role = excluded.role;

  update project_invitations set accepted_at = now() where id = v_inv.id;
  return query select v_inv.project_id, v_inv.role;
end $$;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate WebSocket server for cursors | Supabase Broadcast on existing channel | 2022+ | No new infra |
| Custom presence heartbeats | Supabase Presence | 2022+ | Auto-cleanup |
| Polling for vote tallies | Postgres Changes filtered by session | 2022+ | Sub-second sync |

**Deprecated/outdated:**
- Supabase Realtime v1 (pre-2.0 client) — current client uses channels API; existing code already uses this.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 + Playwright 1.55.0 |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `npx vitest run src/lib/realtime src/lib/repositories src/hooks/__tests__` |
| Full suite command | `npm run test:run && npm run e2e:all` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLLAB-01 | Presence join/leave updates indicator | unit (mock channel) | `npx vitest run src/hooks/__tests__/useProjectRealtime.test.ts` | ❌ Wave 0 |
| COLLAB-02 | Idea insert broadcasts to second client | integration | `npx vitest run src/lib/realtime/__tests__/multiClient.test.ts` | ❌ Wave 0 |
| COLLAB-03 | POST /api/invitations creates row + sends email | unit (mock EmailJS) | `npx vitest run api/__tests__/invitations.create.test.ts` | ❌ Wave 0 |
| COLLAB-04 | Accept token attaches user with role | integration | `npx vitest run api/__tests__/invitations.accept.test.ts` | ❌ Wave 0 |
| COLLAB-05 | 6th vote rejected by RLS | integration (test DB) | `npx vitest run src/lib/repositories/__tests__/voteRepository.test.ts` | ❌ Wave 0 |
| COLLAB-06 | Vote insert triggers tally update on subscriber | integration | `npx vitest run src/hooks/__tests__/useDotVoting.test.ts` | ❌ Wave 0 |
| COLLAB-07 | Drag broadcast received by second client; persisted on drop | e2e | `npx playwright test tests/e2e/matrix-drag-sync.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched files>`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green + manual two-browser smoke test of presence/vote/drag

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useProjectRealtime.test.ts` — covers COLLAB-01, COLLAB-07
- [ ] `src/lib/realtime/__tests__/multiClient.test.ts` — covers COLLAB-02
- [ ] `api/__tests__/invitations.create.test.ts` — covers COLLAB-03
- [ ] `api/__tests__/invitations.accept.test.ts` — covers COLLAB-04
- [ ] `src/lib/repositories/__tests__/voteRepository.test.ts` — covers COLLAB-05
- [ ] `src/hooks/__tests__/useDotVoting.test.ts` — covers COLLAB-06
- [ ] `tests/e2e/matrix-drag-sync.spec.ts` — covers COLLAB-07
- [ ] Test fixture: shared mock Supabase Realtime channel (broadcast/presence/postgres_changes emulator)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Supabase Auth + httpOnly cookie + lock-free token read |
| V3 Session Management | yes | Existing pattern; invitation accept must not deadlock on getSession |
| V4 Access Control | **yes (critical)** | RLS on `idea_votes`, `project_collaborators`, `project_invitations`; viewer vs editor enforced at RLS, not just UI |
| V5 Input Validation | yes | `validator` for emails, DOMPurify for cursor display names, server-side token validation |
| V6 Cryptography | yes | `crypto.randomUUID()` for tokens; SHA-256 hash before storing in DB; never compare raw tokens |
| V13 API & Web Service | yes | CSRF middleware (already in Phase 1) on all new POST endpoints (`/api/invitations/*`) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vote stuffing past 5-dot budget | Tampering / Elevation | RLS `with check` count subquery; **never trust client** |
| Invitation token enumeration | Information Disclosure | Hash tokens at rest; constant-time compare; no "user not found" vs "wrong token" leak |
| Project existence leak via invite | Information Disclosure | Per D specifics: invite endpoint returns 200 even for non-invited emails on lookup |
| Cursor message injection (XSS via display name) | Tampering | Sanitize display names with DOMPurify before render |
| Editor escalating to owner via API | Elevation | RLS update policy on `projects` checks `user_id = auth.uid()`, not collaborator role |
| Viewer making writes | Elevation | RLS write policies require `role = 'editor'` in `project_collaborators` |
| Realtime message flood (cursor spam) | DoS | Throttle on send (rAF 50ms); Supabase Realtime has built-in rate limits per channel |
| Locked card never released | DoS | `expiresAt` in lock payload + Presence leave sweep + beforeunload release |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ideas` table is already in `supabase_realtime` publication (existing brainstorm sync works, so likely yes) | Runtime State Inventory | Low — easy to verify; if missing, COLLAB-02 silently fails |
| A2 | Existing `BrainstormRealtimeManager` uses Postgres Changes (not just Broadcast) | Architecture | Low — even if it's Broadcast-only, the multiplexed-channel pattern still applies |
| A3 | `session_participants` table exists with `(session_id, user_id)` and is the right join for vote-read RLS | Code Examples (RLS) | Medium — verify schema during planning; may need adjustment |
| A4 | EmailJS templates can be created/updated without code changes | Don't Hand-Roll | Low — EmailJS console-based, but coordinate with whoever owns the account |
| A5 | 20Hz cursor rate is acceptable for Supabase Realtime free/pro tier rate limits | Cursor throttle | Medium — Supabase Realtime has per-channel message limits; verify against current plan during planning. If exceeded, drop to 10Hz. |
| A6 | Soft-lock 10s grace is long enough for slow drags but short enough to recover from disconnects | D-12 | Low — tunable post-launch |
| A7 | Hashed-token-in-DB approach is acceptable to user (CONTEXT.md doesn't specify) | Invitation security | Low — strictly more secure than raw, no UX impact |

## Open Questions

1. **Should Postgres Changes or Broadcast be used for in-flight drag positions?**
   - What we know: D-11/D-12 specify soft lock; doesn't specify the position broadcast mechanism
   - What's unclear: Is sub-100ms position sync required, or is "settles within 1s" acceptable?
   - Recommendation: **Broadcast** for in-flight position (every Nth dnd-kit `onDragMove`), Postgres Changes only on `onDragEnd` for persistence. Resolves to a single authoritative state on drop.

2. **Should `BrainstormRealtimeManager` be refactored or paralleled?**
   - What we know: D-10 explicitly defers this to research/planning
   - What's unclear: Refactor risk vs. duplication cost
   - Recommendation: **Refactor into a generic `ScopedRealtimeManager` base class** with `BrainstormRealtimeManager` and `ProjectRealtimeManager` as thin subclasses. Existing tests must stay green. If refactor risk is too high during planning, fall back to a parallel `ProjectRealtimeManager` that copies the patterns.

3. **Does the existing `sessionParticipantRepository` cover project-level collaborators?**
   - What we know: Context says "extend for project-level collaborators"
   - What's unclear: Whether to extend or create a new `collaboratorRepository`
   - Recommendation: Create a new `collaboratorRepository` for `project_collaborators`. Different table, different lifecycle, different permission semantics. Cleaner than overloading session repo.

4. **Cursor color assignment — deterministic or random?**
   - Recommendation: Deterministic hash of `user_id` → HSL hue. No state to sync, consistent across reconnects.

## Sources

### Primary (HIGH confidence)
- Supabase Realtime docs — channels, Presence, Broadcast, Postgres Changes (supabase.com/docs/guides/realtime) [CITED]
- Supabase RLS docs — policy patterns for `with check` count constraints (supabase.com/docs/guides/auth/row-level-security) [CITED]
- Existing codebase — `BrainstormRealtimeManager.ts` (521 lines), `useBrainstormRealtime.ts` (229 lines), `PresenceIndicators.tsx` (154 lines), `InviteCollaboratorModal.tsx` (310 lines) [VERIFIED via wc + ls]
- `npm view @supabase/supabase-js version` → 2.102.1 (installed: 2.57.2) [VERIFIED]
- Project memory: `feedback_supabase_auth_deadlock.md` — getSession deadlock; use lock-free localStorage read [VERIFIED via MEMORY.md]

### Secondary (MEDIUM confidence)
- Figma cursor UX patterns — general industry knowledge [ASSUMED]
- 20Hz cursor rate as "feels live" threshold [ASSUMED — A5]

### Tertiary (LOW confidence)
- Exact Supabase Realtime per-channel rate limits on the project's plan [ASSUMED — verify in dashboard during planning]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified
- Architecture: HIGH — patterns are documented Supabase primitives
- Pitfalls: HIGH for RLS/realtime/auth, MEDIUM for tuning values
- Security: HIGH — RLS-enforced model is well-understood

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (30 days; Supabase Realtime APIs are stable)
