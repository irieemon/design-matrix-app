---
phase: 1
slug: security-hardening-production-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npm run test:run && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SEC-02 | T-1-01 CSRF Tampering | All POST/PUT/DELETE/PATCH requests rejected without valid CSRF token | unit | `npx vitest run api/__tests__/csrf-enforcement.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | SEC-03 | T-1-02 Brute-force Login | Auth endpoints return 429 after 5 attempts per IP per 15min | unit | `npx vitest run api/__tests__/rate-limit-auth.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | SEC-04 | T-1-03 AI Cost Exploitation | AI endpoints return 429 after 20 per-user requests per hour | unit | `npx vitest run api/__tests__/rate-limit-ai.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | SEC-05 | T-1-04 Admin/Webhook DoS | Admin and webhook endpoints rate limited | unit | `npx vitest run api/__tests__/rate-limit-admin.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | SEC-06 | T-1-05 Fail-open Bypass | Subscription denies access when check errors | unit | `npx vitest run api/__tests__/subscription-fail-closed.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | SEC-07 | — | No undefined error variable crash in multiModalProcessor | unit | `npx vitest run src/lib/__tests__/multiModalProcessor.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | SEC-08 | T-1-06 Cookie Path | Refresh token cookie path allows all /api/* endpoints | unit | `npx vitest run api/__tests__/cookie-path.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | SEC-09 | T-1-07 Hardcoded Tier | userTier read from user context, never hardcoded 'pro' | unit | `npx vitest run src/lib/ai/__tests__/aiInsightsService.test.ts` | ✅ (needs update) | ⬜ pending |
| 01-02-05 | 02 | 1 | SEC-10 | — | No placeholder/fake data returned from multiModalProcessor | unit | `npx vitest run src/lib/__tests__/multiModalProcessor.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | SEC-01 | — | Password reset email sent and new password set via Supabase flow | E2E (manual) | Manual verification | N/A | ⬜ pending |
| 01-03-02 | 03 | 2 | ADMIN-01 | — | Admin dashboard shows real aggregate counts | unit + component | `npx vitest run api/__tests__/admin-stats.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 2 | ADMIN-02 | — | Per-user stats visible in admin dashboard | component | `npx vitest run src/components/admin/__tests__/AdminStats.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/__tests__/csrf-enforcement.test.ts` — stubs for SEC-02
- [ ] `api/__tests__/rate-limit-auth.test.ts` — stubs for SEC-03
- [ ] `api/__tests__/rate-limit-ai.test.ts` — stubs for SEC-04
- [ ] `api/__tests__/rate-limit-admin.test.ts` — stubs for SEC-05
- [ ] `api/__tests__/subscription-fail-closed.test.ts` — stubs for SEC-06
- [ ] `src/lib/__tests__/multiModalProcessor.test.ts` — stubs for SEC-07, SEC-10
- [ ] `api/__tests__/cookie-path.test.ts` — stubs for SEC-08
- [ ] `api/__tests__/admin-stats.test.ts` — stubs for ADMIN-01, ADMIN-02
- [ ] `src/components/admin/__tests__/AdminStats.test.tsx` — stubs for ADMIN-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Password reset full flow | SEC-01 | Requires real Supabase email delivery and user click | 1. Click "Forgot password?" 2. Enter email 3. Check inbox 4. Click reset link 5. Enter new password 6. Verify login with new password |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
