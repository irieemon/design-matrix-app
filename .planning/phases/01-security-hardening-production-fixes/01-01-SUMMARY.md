---
phase: 01-security-hardening-production-fixes
plan: 01
status: completed
started: 2026-04-06
completed: 2026-04-06
---

## Summary

Applied CSRF middleware and rate limiting to all 5 API endpoints. auth.ts was refactored to use shared middleware imports (removed ~100 lines of inline cookie utilities). All state-changing endpoints (auth, ai, ideas, admin) now enforce CSRF via `withCSRF()`. Stripe webhooks are intentionally excluded from CSRF since they use Stripe's own signature verification.

## What Was Built

- **auth.ts**: `compose(withStrictRateLimit(), withCSRF())` — 5 req/15min per IP
- **ai.ts**: `compose(withUserRateLimit({windowMs: 3600000, maxRequests: 20}), withCSRF(), withAuth)` — 20 req/hour per user
- **ideas.ts**: `compose(withUserRateLimit(), withCSRF(), withAuth)` — default user rate limit
- **admin.ts**: `compose(withRateLimit({windowMs: 900000, maxRequests: 50}), withCSRF(), withAdmin)` — 50 req/15min
- **stripe.ts**: `compose(withRateLimit({windowMs: 900000, maxRequests: 100}), withAuth)` — no CSRF (webhook signature)

## Key Files

### key-files.created
(none — all modifications to existing files)

### key-files.modified
- `api/auth.ts` — Refactored to shared middleware, added CSRF + strict rate limit
- `api/ai.ts` — Added CSRF + per-user rate limit (20/hour)
- `api/ideas.ts` — Added CSRF + user rate limit + auth
- `api/admin.ts` — Added CSRF + rate limit + admin auth via compose
- `api/stripe.ts` — Added rate limit (no CSRF for webhooks)

## Requirements Addressed

- SEC-02: CSRF protection on all state-changing endpoints
- SEC-03: Strict rate limiting on auth endpoints
- SEC-04: Per-user rate limiting on AI endpoints
- SEC-05: Rate limiting on admin and webhook endpoints

## Deviations

None. All middleware was wired exactly as specified in the plan.

## Self-Check: PASSED
