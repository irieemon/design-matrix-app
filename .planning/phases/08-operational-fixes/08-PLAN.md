# ADR-08: Operational Fixes (Phase 08)

## Status

Proposed -- 2026-04-09

## DoR -- Definition of Ready

### Requirements Table

| ID | Requirement | Source | Verified |
|----|-------------|--------|----------|
| OPS-01 | Invitation emails send from a verified domain (not `onboarding@resend.dev`) and deliver to external recipients | REQUIREMENTS.md, ROADMAP.md | Yes |
| OPS-02 | File analysis requests do not intermittently 403 due to CSRF token timing | REQUIREMENTS.md, ROADMAP.md, csrf-403-transcribe-audio.resolved.md | Yes |
| OPS-03 | All AI handlers route through Vercel AI Gateway with no regression in existing AI features | REQUIREMENTS.md, ROADMAP.md | Yes |

### Retro Risks

| Lesson | Risk to this work | Mitigation |
|--------|-------------------|------------|
| L-001 (Sensitive data in return shapes) | Low -- no new data access methods | N/A |
| L-005 (Frontend wiring omission) | Medium -- OPS-02 touches frontend CSRF hook + backend callers | Vertical slice: fix + consumer in same unit |

### Upstream Artifacts Read

- `.planning/REQUIREMENTS.md` -- OPS-01/02/03 descriptions
- `.planning/ROADMAP.md` -- Phase 08 success criteria (3 items)
- `.planning/debug/csrf-403-transcribe-audio.resolved.md` -- 5 rounds of prior debugging
- `api/_lib/sendInviteEmail.ts` (43 lines) -- Resend wrapper
- `api/_lib/inviteEmailTemplate.ts` (115 lines) -- email template builder
- `api/email-link.ts` (101 lines) -- second Resend consumer
- `src/hooks/useCsrfToken.ts` (106 lines) -- CSRF hook with race condition
- `src/utils/cookieUtils.ts` (111 lines) -- cookie read/poll utilities
- `src/lib/fileService.ts` -- triggerFileAnalysis (calls getCsrfToken synchronously)
- `api/_lib/ai/providers.ts` (53 lines) -- AI Gateway singleton
- `api/_lib/ai/modelRouter.ts` (124 lines) -- capability-based model router
- `api/_lib/ai/generateIdeas.ts` -- uses `getModel()` from providers.ts
- `api/_lib/ai/generateInsights.ts` -- uses `getModel()` from providers.ts
- `api/_lib/ai/generateRoadmap.ts` -- uses `getModel()` from providers.ts
- `api/_lib/ai/analyzeFile.ts` -- uses `getModel()` from providers.ts (text+vision), `@ai-sdk/openai` directly for Whisper
- `api/_lib/ai/analyzeImage.ts` -- uses `getModel()` from providers.ts
- `api/_lib/ai/analyzeVideo.ts` -- uses `getModel()` from providers.ts
- `api/_lib/ai/transcribeAudio.ts` -- uses `@ai-sdk/openai` directly for BOTH Whisper AND summary (bypasses gateway)
- `api/ai.ts` (79 lines) -- thin router
- `package.json` -- confirms `ai@^6.0.149` and `@ai-sdk/openai@^3.0.51`

---

## Context

Phase 08 is the first phase of v1.2 (Production Hardening). It contains three independent operational fixes carried forward from v1.0/v1.1. No new user-facing features.

---

## Decisions

### OPS-01: Resend Domain Verification

**Finding:** This is a configuration task, not a code change. The code is already correct.

`api/_lib/sendInviteEmail.ts` (line 22) reads `process.env.RESEND_FROM_EMAIL` and falls back to `onboarding@resend.dev`. `api/email-link.ts` (line 69) does the same. Both files are identical in structure -- set the env var and emails send from the verified domain.

**What needs to happen (config, not code):**

1. Register and verify a custom domain (e.g., `notifications.prioritas.ai` or `prioritas.ai`) in the Resend Dashboard.
2. Add the required DNS records (SPF, DKIM, DMARC) to the domain registrar.
3. Set `RESEND_FROM_EMAIL=noreply@notifications.prioritas.ai` in Vercel Environment Variables (Production).
4. Verify delivery by sending a test invitation to an external email address.

**Code change:** Zero lines. The env var override is already wired. No ADR step needed for code -- this is a runbook item.

**Decision:** Document the verification steps as a runbook in the plan. Colby does not touch any files. The success criterion ("emails deliver to external recipients") is verified manually after DNS propagation.

### OPS-02: analyze-file CSRF Race Condition

**Root cause analysis (from code reading + debug history):**

The CSRF cookie minting was fixed in a prior round (csrf-token is now minted in `handleGetUser` during app hydration -- `api/auth.ts` lines 382-397). The debug file status is `awaiting_human_verify`.

However, there is a **remaining race condition** in `src/lib/fileService.ts::triggerFileAnalysis`:

1. User uploads a file. `FileService.uploadFile()` completes the storage upload + DB insert.
2. Immediately (fire-and-forget), `triggerFileAnalysis()` is called (line 149).
3. Inside `triggerFileAnalysis` (line 386), `getCsrfToken()` reads `document.cookie` synchronously.
4. If the CSRF cookie has not yet been set (because `handleGetUser` hasn't returned yet, or the cookie watcher hasn't polled yet), `getCsrfToken()` returns `null`.
5. The conditional spread `...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})` sends NO header.
6. `withCSRF()` middleware rejects with 403 `CSRF_HEADER_MISSING`.

This race is timing-dependent: if `handleGetUser` completed during initial hydration (the common case for returning users), the cookie exists and the request succeeds. If the user uploads a file very quickly after page load, or if the hydration GET hasn't completed yet, it fails.

**The same pattern exists in `src/components/AIIdeaModal.tsx`** (line 190) for transcribe-audio and analyze-image, but those are gated behind user interaction (clicking buttons in a modal), so the timing window is much wider and the race rarely manifests there.

**Proposed fix:** Make `triggerFileAnalysis` resilient to the CSRF cookie not being ready yet.

Two options considered:

- **Option A: Await CSRF readiness before firing.** Add a `waitForCsrfToken()` utility that polls `getCsrfToken()` with a short timeout (e.g., 3s, 100ms interval). If timeout expires, log a warning and proceed without the header (the request will 403, but that's the existing behavior -- no worse). This is the minimal fix.

- **Option B: Read CSRF token from the cookie at request time, with retry on 403.** If the first request gets 403 with `CSRF_HEADER_MISSING` or `CSRF_COOKIE_MISSING`, wait 1s, re-read the cookie, and retry once. More resilient but adds retry complexity to a fire-and-forget path.

**Decision:** Option A. A small `waitForCsrfToken(timeoutMs, intervalMs)` utility function in `src/utils/cookieUtils.ts` that returns a Promise<string | null>. `triggerFileAnalysis` awaits it before making the fetch. If the token appears within the timeout, the request succeeds on the first try. If not, it proceeds and fails as before (existing behavior, no regression).

This is the right fix because:
- The cookie IS being minted server-side (handleGetUser fix is already deployed).
- The race window is small (typically <500ms between page load and file upload).
- The fix is localized to the caller, not the middleware (we don't weaken CSRF protection).
- No retry logic needed -- we just wait for the cookie that we know is coming.

**Spec assumption challenge:** "The spec assumes the CSRF cookie minting in handleGetUser is deployed and working. If wrong, the design fails because no amount of client-side waiting will produce a cookie that was never set." Evidence it IS working: the handleGetUser CSRF mint code is present in `api/auth.ts` lines 382-397 and was committed. The debug file lists it as `fix_applied_v2`. The status is `awaiting_human_verify` -- the fix exists in code but may not have been UAT-tested.

**SPOF:** The `handleGetUser` CSRF mint. Failure mode: if this endpoint returns before minting (e.g., an early return path skips the mint), the client waits until timeout and proceeds without CSRF. Graceful degradation: the file upload itself succeeds (it uses Supabase SDK, not the API); only the background AI analysis fails. The user can re-trigger analysis later.

### OPS-03: AI Gateway Migration -- STATUS: ALREADY COMPLETE (6/7 handlers)

**Finding from code reading:**

All 7 AI handlers were read. Here is the gateway routing status:

| Handler | File | Gateway? | Evidence |
|---------|------|----------|----------|
| generateIdeas | `api/_lib/ai/generateIdeas.ts` | YES | Line 69: `getModel(selection.gatewayModelId)` |
| generateInsights | `api/_lib/ai/generateInsights.ts` | YES | Lines 420, 452: `getModel(selection.gatewayModelId)`, `getModel('anthropic/claude-3-5-sonnet-20241022')` |
| generateRoadmap | `api/_lib/ai/generateRoadmap.ts` | YES | Line 264: `getModel(selection.gatewayModelId)` |
| analyzeFile | `api/_lib/ai/analyzeFile.ts` | PARTIAL | Vision+text: YES via `getModel()` (lines 262, 357, 417). Whisper: NO -- uses `createOpenAI()` directly (line 342) |
| analyzeImage | `api/_lib/ai/analyzeImage.ts` | YES | Line 103: `getModel(selection.gatewayModelId)` |
| analyzeVideo | `api/_lib/ai/analyzeVideo.ts` | YES | Line 69: `getModel(selection.gatewayModelId)` |
| transcribeAudio | `api/_lib/ai/transcribeAudio.ts` | PARTIAL | Whisper: NO -- uses `createOpenAI()` directly (line 96). Summary: NO -- uses `openai('gpt-4o-mini')` directly (line 124), explicitly bypasses gateway per inline comment |

**Analysis of the two "PARTIAL" cases:**

1. **Whisper transcription** (in both `analyzeFile.ts` line 342 and `transcribeAudio.ts` line 96): These use `createOpenAI()` from `@ai-sdk/openai` directly because the Vercel AI Gateway does not support transcription models. The inline comments in both files explicitly state this: "Targeted exception: @ai-sdk/openai used because gateway does not support transcription models." This is a **known, documented, intentional** bypass -- not a migration gap.

2. **transcribeAudio.ts summary step** (line 124): The summary uses `openai('gpt-4o-mini')` from the `@ai-sdk/openai` provider created for Whisper, bypassing the gateway. The inline comment says "Bypasses the Vercel AI Gateway and reuses the @ai-sdk/openai provider created above for Whisper, calling OpenAI directly with OPENAI_API_KEY. Avoids the AI_GATEWAY_API_KEY requirement for this endpoint." This is the **one actual gap** -- the summary step could and should route through the gateway via `getModel('openai/gpt-4o-mini')` from `providers.ts`.

**Decision:** OPS-03 is 95% complete. The only remaining work is a 2-line change in `transcribeAudio.ts`:
- Replace `const summaryModel = openai('gpt-4o-mini');` with `import { getModel } from './providers.js';` + `const summaryModel = getModel('openai/gpt-4o-mini');`
- The Whisper transcription calls CANNOT be migrated (gateway limitation) and should remain as-is.

This is a trivially small change. It does not warrant its own step -- it can be combined with OPS-02.

---

## Anti-Goals

1. **Anti-goal: Migrating Whisper transcription to the AI Gateway.** Reason: The Vercel AI Gateway does not support transcription models (`experimental_transcribe`). The `@ai-sdk/openai` direct usage is a documented, intentional exception. Revisit: When Vercel AI Gateway adds transcription model support.

2. **Anti-goal: Refactoring the CSRF middleware or auth cookie system.** Reason: The CSRF system works correctly -- the issue is purely a client-side timing race in the caller. Changing the middleware or cookie architecture is out of scope for an ops fix. Revisit: When the `VITE_FEATURE_HTTPONLY_AUTH` flag is flipped to true (full httpOnly cookie auth), at which point the CSRF flow should be re-evaluated end-to-end.

3. **Anti-goal: Automating Resend domain verification via code or CI.** Reason: DNS verification is a one-time manual task done in the Resend Dashboard + domain registrar. Automating it adds complexity for zero recurring value. Revisit: If Prioritas becomes multi-tenant with per-tenant email domains.

---

## Alternatives Considered

### OPS-02 Alternatives

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| A: `waitForCsrfToken()` utility | Minimal, localized, no retry complexity | Adds ~500ms worst-case delay to file analysis start | **Chosen** |
| B: Retry on 403 | Most resilient | Retry logic in fire-and-forget path is over-engineering; masks bugs | Rejected |
| C: Remove CSRF from analyze-file | Eliminates the race entirely | Weakens security posture; inconsistent with other AI endpoints | Rejected |
| D: Move analysis to server-triggered | Server doesn't need CSRF | Major refactor; changes the upload architecture | Rejected (scope) |

### OPS-03 Alternatives

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| A: Fix only transcribeAudio summary | 2-line change, matches existing pattern | Does not address Whisper (but that's a gateway limitation) | **Chosen** |
| B: Full handler rewrite to abstract provider | Cleaner architecture | Over-engineering for a solved problem; all handlers already use the gateway | Rejected |

---

## Consequences

- Invitation emails will deliver to external recipients once DNS is verified (OPS-01).
- File analysis will no longer intermittently 403 due to CSRF timing (OPS-02).
- All AI handlers that CAN route through the gateway DO route through the gateway (OPS-03).
- `transcribeAudio.ts` will require `AI_GATEWAY_API_KEY` env var for the summary step (it currently works with only `OPENAI_API_KEY`). This is consistent with all other handlers.
- No schema changes, no migration, no rollback needed.

---

## Implementation Plan

### Unit 08-01: OPS-01 -- Resend Domain Verification Runbook

**This is a documentation + manual config unit, not a code unit.**

**Tasks:**
1. Verify custom domain in Resend Dashboard
2. Add DNS records (SPF, DKIM, DMARC) to domain registrar
3. Set `RESEND_FROM_EMAIL` env var in Vercel (Production)
4. Test: send invitation to external email, verify delivery

**Files to modify:** 0 (env var change in Vercel Dashboard only)

**Acceptance criteria:**
- Invitation email arrives in an external recipient's inbox
- Email shows the verified domain as sender (not `onboarding@resend.dev`)
- `email-link.ts` also sends from verified domain (same env var)

**Complexity:** Trivial (config only)
**Verification:** Manual -- send test invitation, check recipient inbox

### Unit 08-02: OPS-02 + OPS-03 -- CSRF Race Fix + Gateway Summary Migration

**Files to create:** 0
**Files to modify:** 3

| File | Change | LOC |
|------|--------|-----|
| `src/utils/cookieUtils.ts` | Add `waitForCsrfToken(timeoutMs?, intervalMs?): Promise<string \| null>` utility | ~20 |
| `src/lib/fileService.ts` | Replace `getCsrfToken()` with `await waitForCsrfToken()` in `triggerFileAnalysis` | ~5 |
| `api/_lib/ai/transcribeAudio.ts` | Replace `openai('gpt-4o-mini')` summary model with `getModel('openai/gpt-4o-mini')` from providers.ts | ~5 |

**Acceptance criteria:**
- `triggerFileAnalysis` waits up to 3s for CSRF token before proceeding
- If CSRF token appears within timeout, the analyze-file request includes `X-CSRF-Token` header
- If CSRF token does not appear (timeout), the request proceeds without header (existing failure behavior, logged as warning)
- `transcribeAudio.ts` summary step routes through AI Gateway via `getModel()`
- `transcribeAudio.ts` Whisper step remains on `@ai-sdk/openai` directly (unchanged, documented exception)
- All existing tests pass (no regressions)

**Complexity:** Small

**Step sizing gate:**

| # | Test | Pass? |
|---|------|-------|
| S1 | Demoable: "After this step, file analysis no longer 403s on upload, and all AI summary calls route through the gateway" | Yes |
| S2 | Context-bounded: 3 files to modify | Yes |
| S3 | Independently verifiable: Roz can test CSRF wait + gateway routing independently | Yes |
| S4 | Revert-cheap: 3 files, ~30 LOC total | Yes |
| S5 | Already small: 3 files, one clear behavior | Yes -- do not split |

---

## Test Specification

### OPS-02 Tests (CSRF Race Fix)

| ID | Category | Description |
|----|----------|-------------|
| T-0802-001 | Unit | `waitForCsrfToken` returns token immediately when cookie already exists |
| T-0802-002 | Unit | `waitForCsrfToken` polls and returns token when cookie appears after delay |
| T-0802-003 | Unit | `waitForCsrfToken` returns null after timeout when cookie never appears |
| T-0802-004 | Unit | `waitForCsrfToken` respects custom timeoutMs and intervalMs parameters |
| T-0802-005 | Unit | `waitForCsrfToken` cleans up interval on resolution (no leaked timers) |
| T-0802-006 | Integration | `triggerFileAnalysis` sends X-CSRF-Token header when token is available |
| T-0802-007 | Integration | `triggerFileAnalysis` logs warning and proceeds when CSRF token times out |

### OPS-03 Tests (Gateway Summary Migration)

| ID | Category | Description |
|----|----------|-------------|
| T-0803-001 | Unit | `transcribeAudio` summary step calls `getModel('openai/gpt-4o-mini')` from providers.ts |
| T-0803-002 | Unit | `transcribeAudio` Whisper step still uses `createOpenAI()` directly (not gateway) |
| T-0803-003 | Regression | All 7 AI handlers import from `./providers.js` for non-transcription models |

### Failure Path Tests (>= happy path per contract)

| ID | Category | Description |
|----|----------|-------------|
| T-0802-F01 | Failure | `waitForCsrfToken` with 0ms timeout returns null immediately |
| T-0802-F02 | Failure | `triggerFileAnalysis` with no CSRF token proceeds and logs, does not throw |
| T-0803-F01 | Failure | `transcribeAudio` with `AI_GATEWAY_API_KEY` unset throws descriptive error on summary step |

---

## Contract Boundaries

| Producer | Shape | Consumer |
|----------|-------|----------|
| `waitForCsrfToken()` | `Promise<string \| null>` | `FileService.triggerFileAnalysis()` |
| `getModel(gatewayModelId)` | AI SDK model instance | `transcribeAudio.ts` summary step |
| `getCsrfToken()` | `string \| null` (sync) | `waitForCsrfToken()` (polls it) |

---

## Wiring Coverage

| Producer | Shape | Consumer | Unit |
|----------|-------|----------|------|
| `waitForCsrfToken()` in `cookieUtils.ts` | `Promise<string \| null>` | `FileService.triggerFileAnalysis()` in `fileService.ts` | 08-02 |
| `getModel()` in `providers.ts` | AI SDK model | `transcribeAudio.ts` summary step | 08-02 |

No orphan producers. Both new/modified producers have consumers in the same unit.

---

## Data Sensitivity

| Method | Classification | Notes |
|--------|---------------|-------|
| `waitForCsrfToken()` | auth-only | Reads CSRF token from cookie; only meaningful in authenticated context |
| `getCsrfToken()` | auth-only | Existing; reads CSRF cookie value |
| `getModel()` | auth-only | Server-side; requires `AI_GATEWAY_API_KEY` env var |
| `triggerFileAnalysis()` | auth-only | Sends Bearer token + CSRF token to API |

---

## Notes for Colby

### OPS-01 is NOT a Colby task.
It is a manual configuration task (Resend Dashboard + DNS + Vercel env var). No code changes. The user performs this themselves.

### OPS-02: `waitForCsrfToken` implementation guidance

```
// Signature
export function waitForCsrfToken(
  timeoutMs: number = 3000,
  intervalMs: number = 100
): Promise<string | null>
```

Implementation pattern: Create a Promise that starts an interval polling `getCsrfToken()`. If the token is found, resolve with the token and clear the interval. Set a timeout that clears the interval and resolves with `null`. Clear both the interval and timeout on resolution to prevent leaks.

The existing `watchCsrfToken()` in `cookieUtils.ts` (line 106) uses a similar polling pattern but is callback-based and runs indefinitely. `waitForCsrfToken` is promise-based with a bounded timeout -- do not reuse `watchCsrfToken`.

### OPS-03: Exact change in `transcribeAudio.ts`

- Add `import { getModel } from './providers.js';` to imports
- Replace line 124: `const summaryModel = openai('gpt-4o-mini');` with `const summaryModel = getModel('openai/gpt-4o-mini');`
- The `openai` variable (from `createOpenAI()`) is still needed for the Whisper step (line 96-97). Do not remove the `@ai-sdk/openai` import.
- The `OPENAI_API_KEY` env var is still needed for Whisper. `AI_GATEWAY_API_KEY` is additionally needed for the summary step.

### Brain context (proven patterns)

- Lock-free localStorage reads: The project has an established pattern of reading tokens from localStorage synchronously to avoid supabase-js auth lock deadlocks. `waitForCsrfToken` follows this pattern -- it reads cookies (not supabase auth state), so there is no deadlock risk, but the pattern of "read from a known synchronous source instead of awaiting an async auth method" is consistent.
- Fire-and-forget with best-effort: `triggerFileAnalysis` is already fire-and-forget (line 149). The CSRF wait adds a bounded delay to the "fire" part but does not change the "forget" semantics -- failures are logged and swallowed.

---

## DoD -- Definition of Done

| DoR Item | Status | Evidence |
|----------|--------|----------|
| OPS-01: Emails from verified domain | Documented as runbook | Unit 08-01 documents exact config steps; no code change needed |
| OPS-02: No CSRF 403 on file analysis | Covered by Unit 08-02 | `waitForCsrfToken` utility + `triggerFileAnalysis` integration; 9 tests specified |
| OPS-03: All AI handlers through gateway | ALREADY DONE (6/7) + Unit 08-02 closes gap | Evidence table shows 6/7 complete; Unit 08-02 migrates `transcribeAudio` summary; Whisper exception documented with reason |

### Verification Checklist

- [ ] `waitForCsrfToken()` added to `src/utils/cookieUtils.ts`
- [ ] `triggerFileAnalysis()` uses `await waitForCsrfToken()` instead of sync `getCsrfToken()`
- [ ] `transcribeAudio.ts` summary step uses `getModel('openai/gpt-4o-mini')` from providers.ts
- [ ] All 10 tests pass (T-0802-001 through T-0802-F02, T-0803-001 through T-0803-F01)
- [ ] Existing test suite shows no regressions
- [ ] Manual: Resend domain verified, `RESEND_FROM_EMAIL` set, external email delivery confirmed

### Silent Drop Check

No requirements dropped. All 3 OPS items addressed:
- OPS-01: Runbook (config, not code)
- OPS-02: Code fix (Unit 08-02)
- OPS-03: Closed as 95% complete with evidence; remaining 5% addressed in Unit 08-02
