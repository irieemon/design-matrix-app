# Phase 1: Security Hardening & Production Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 01-Security Hardening & Production Fixes
**Areas discussed:** Password Reset Flow, Rate Limiting Strategy, Admin Dashboard Metrics, Bug Fix Prioritization

---

## Password Reset Flow

### Implementation Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase built-in | Use resetPasswordForEmail() — Supabase handles token generation, email delivery, and expiry. Fastest to ship, proven secure. | ✓ |
| Custom token + API endpoint | Build /api/auth?action=reset-password with custom token generation, email via EmailJS, and expiry logic. More control over email branding. | |
| You decide | Let Claude pick based on codebase. | |

**User's choice:** Supabase built-in
**Notes:** None

### UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on AuthScreen | Add 'Forgot password?' link below login form that toggles to reset email input. Same page. | ✓ |
| Separate /reset-password route | New page at dedicated route. Cleaner URL but adds new route/page. | |
| Modal overlay on AuthScreen | Open modal dialog over login form. Quick but awkward on mobile. | |

**User's choice:** Inline on AuthScreen
**Notes:** None

### Password Update Landing

| Option | Description | Selected |
|--------|-------------|----------|
| Same AuthScreen with update mode | Supabase redirects back with token in URL hash. AuthScreen detects and shows 'Set new password' form. | ✓ |
| Dedicated password update page | New route/component for password update step. | |
| You decide | Let Claude handle redirect landing. | |

**User's choice:** Same AuthScreen with update mode
**Notes:** None

---

## Rate Limiting Strategy

### Auth Endpoint Limits

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: 5 attempts / 15 min | Standard brute-force protection. Blocks automated attacks while allowing real user typos. | ✓ |
| Moderate: 10 attempts / 15 min | More lenient. Slightly weaker against automated attacks. | |
| Very strict: 3 attempts / 30 min | Maximum protection. May frustrate legitimate users. | |
| You decide | Let Claude pick sensible defaults. | |

**User's choice:** Strict: 5 attempts / 15 min
**Notes:** None

### AI Endpoint Limits

| Option | Description | Selected |
|--------|-------------|----------|
| Per-user: 20 requests / hour | Requires withAuth. Generous for active brainstorming, prevents runaway costs. Tier differentiation in Phase 6. | ✓ |
| Per-user: 10 requests / hour | More conservative. Better cost control. | |
| Per-IP: 30 requests / hour | Simpler, no auth needed. Less precise. | |
| You decide | Let Claude pick based on AI API cost patterns. | |

**User's choice:** Per-user: 20 requests / hour
**Notes:** None

### 429 Response Format

| Option | Description | Selected |
|--------|-------------|----------|
| JSON with retry-after header | Return { error, retryAfter } with Retry-After header. Standard REST. Frontend can show countdown toast. | ✓ |
| Simple error message only | Return error message with no retry timing. Simpler. | |
| You decide | Let Claude implement standard pattern. | |

**User's choice:** JSON with retry-after header
**Notes:** None

---

## Admin Dashboard Metrics

### Stats to Display

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregate counts + per-user table | Top-level cards (users, projects, ideas, sessions) plus user table with project/idea counts and tier. | ✓ |
| Aggregate counts only | Just top-level numbers. Doesn't satisfy ADMIN-02. | |
| Full analytics dashboard | Aggregates + user table + time-series charts. Significantly more work. | |

**User's choice:** Aggregate counts + per-user table
**Notes:** None

### Data Freshness

| Option | Description | Selected |
|--------|-------------|----------|
| Live query on load | Query Supabase each time admin opens dashboard. Fast enough for modest data, always accurate. | ✓ |
| Cached with manual refresh | Cache 5 min with refresh button. Faster repeated loads. | |
| You decide | Let Claude pick. | |

**User's choice:** Live query on load
**Notes:** None

---

## Bug Fix Prioritization

### Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Claude handles all, crash-first order | SEC-07→SEC-08→SEC-06→SEC-09→SEC-10. Standard severity triage. | ✓ |
| Fix all but discuss SEC-10 approach | Discuss what users see when multi-modal isn't ready. | |
| Discuss each fix individually | Walk through each approach one by one. | |

**User's choice:** Claude handles all, crash-first order
**Notes:** None

---

## Claude's Discretion

- Exact rate limit numbers for admin and webhook endpoints
- Toast/notification UI for rate limit feedback on the frontend
- How multi-modal placeholder removal is handled
- CSRF token delivery mechanism details

## Deferred Ideas

None — discussion stayed within phase scope.
