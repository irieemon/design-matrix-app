# Sean Action Queue — Blockers Only Sean Can Resolve

## Blocked on Sean

**None as of 2026-04-17 session end.**

Everything currently needed is within Eva's autonomous scope.

## Flagged but not blocking

- **Supabase dashboard settings verification** — Next session's Chrome MCP walkthrough should check Site URL, Redirect URLs, and email templates match ADR-0017 spec. Eva will read via Supabase MCP / dashboard and report; only flagged here if a change requires Sean's login.
- **Wave A bundled fix review** — The -1659 line consolidation is the single biggest diff. Sean may want to eyeball `git diff main..feature/auth-hardening-d92383e0 -- src/hooks/useAuth.ts src/components/auth/AuthScreen.tsx` before merging.
- **MAX_AUTH_INIT_TIME reconciliation** — Code says 5000ms, ADR says 15000ms. Eva left production value alone; Cal reconciliation deferred to review juncture.
- **Pre-existing test debt** — 68+ unrelated test failures in useBrowserHistory, useAccessibility, useComponentState, useAIGeneration, useAIQuota, useOptimisticUpdates, AuthScreen.test.tsx. Verified pre-existing via git stash baseline. Queue for platform audit Part 2.

## Informational

- Brain container `brain-brain-db-1` (pgvector:pg17 on port 5433) should get `restart: unless-stopped` in its docker-compose. It was stopped at session start; one `docker start` restored it, but a restart policy would prevent future "brain disabled at session boot" surprises.
- autoCompactWindow was updated to 1000000 in ~/.claude/settings.json this session.
- Model override persisted: `"model": "opus[1m]"` in ~/.claude/settings.json.
