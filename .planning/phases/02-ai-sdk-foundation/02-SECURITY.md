---
phase: 02-ai-sdk-foundation
audit_date: 2026-04-06
asvs_level: L1
threats_total: 13
threats_accepted: 3
threats_mitigate: 10
threats_closed: 6
threats_open: 4
status: BLOCKED
---

# Phase 02 — AI SDK Foundation: Security Threat Verification

**Audit Date:** 2026-04-06
**Phase:** 02-ai-sdk-foundation (Plans 02-01, 02-02, 02-03)
**ASVS Level:** L1
**Auditor:** gsd-security-auditor (automated)

---

## Threat Register

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-02-01 | Information Disclosure | providers.ts | mitigate | CLOSED | `api/_lib/ai/providers.ts:20` — key read from `process.env` inside `getGateway()` at call time; error message is generic; no key in logs |
| T-02-02 | Information Disclosure | modelRouter.ts | accept | ACCEPTED | Router is server-side only; model IDs are not secrets; no user data passes through |
| T-02-03 | Elevation of Privilege | providers.ts | mitigate | CLOSED | `api/ai.ts:70-74` — `compose(withUserRateLimit, withCSRF, withAuth)(aiRouter)` wraps all dispatch; `getModel()` unreachable without this chain |
| T-02-04 | Denial of Service | providers.ts | accept | ACCEPTED | Rate limiting preserved via `withUserRateLimit`; AI Gateway has own limits |
| T-02-05 | Tampering | generateIdeas/Insights.ts | mitigate | CLOSED | `api/_lib/ai/generateIdeas.ts:29-45` — `InputValidator.validate(req.body, ...)` before any AI call; `generateInsights.ts:354-356` — array check enforced |
| T-02-06 | Information Disclosure | All handlers error paths | mitigate | **OPEN** | `generateInsights.ts:393-397` exposes `error.message` unconditionally in production — no `NODE_ENV` guard |
| T-02-07 | Denial of Service | All handlers | mitigate | **OPEN** | `checkLimit()` present only in `generateIdeas.ts:48-59`; absent in 5 of 6 handlers |
| T-02-08 | Spoofing | Handler auth | accept | ACCEPTED | `withAuth` middleware unchanged per D-03; handlers receive pre-authenticated requests |
| T-02-09 | Tampering | api/ai.ts thin router | mitigate | CLOSED | `api/ai.ts:41-66` — `switch(action)` allowlist with `default: 404 + validActions`; unknown actions rejected |
| T-02-10 | Information Disclosure | analyzeImage/File.ts | mitigate | CLOSED | `analyzeImage.ts:44-46` and `analyzeFile.ts:187` — generic 500 responses; no API keys or internal paths in prompts |
| T-02-11 | Tampering | transcribeAudio.ts | mitigate | **OPEN** | `transcribeAudio.ts:44-59` — no Content-Type validation, no MIME allowlist, no file size limit before Whisper |
| T-02-12 | Denial of Service | transcribeAudio.ts, analyzeFile.ts | mitigate | **OPEN** | Overlaps with T-02-07: `checkLimit()` absent in both 2-call-per-request handlers; highest cost-amplification risk |
| T-02-13 | Information Disclosure | api/ai.ts error responses | mitigate | CLOSED | `api/ai.ts:55-66` — default returns `{ error: 'Invalid action', validActions: [...] }`; no stack traces |

---

## Open Threats (4)

### T-02-06 — Information Disclosure in generateInsights.ts error path

**File:** `api/_lib/ai/generateInsights.ts`
**Lines:** 388–397
**Severity:** MEDIUM

The outer `catch` block exposes `error.message` unconditionally:
```typescript
error: `Failed to generate insights: ${errorMessage}`
```
where `errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'`.

This leaks raw AI SDK error messages (model names, token counts, rate limit details, upstream provider strings) to callers in production. `generateIdeas.ts:161-165` correctly guards behind `NODE_ENV === 'development'`. The other four handlers (generateRoadmap, analyzeFile, analyzeImage, transcribeAudio) all use generic messages and are not affected.

**Required fix:** Wrap the error detail in `generateInsights.ts` behind `NODE_ENV === 'development'`, matching the pattern in `generateIdeas.ts`.

---

### T-02-07 — checkLimit() missing from 5 of 6 AI handlers

**Files:** `generateInsights.ts`, `generateRoadmap.ts`, `analyzeFile.ts`, `analyzeImage.ts`, `transcribeAudio.ts`
**Severity:** HIGH

`checkLimit()` is correctly implemented only in `generateIdeas.ts:48-59`. The other five handlers proceed directly to AI model calls with no per-feature subscription limit check. An authenticated user can invoke these actions without restriction beyond `withUserRateLimit` (20 req/hour global). `transcribeAudio` and `analyzeFile` each make two AI API calls per request — highest cost-amplification risk.

**Required fix:** Add `checkLimit(userId, '<feature>')` as the first operation after auth in each of the five affected handlers, mirroring `generateIdeas.ts:48-59`.

---

### T-02-11 — No content-type validation in transcribeAudio.ts

**File:** `api/_lib/ai/transcribeAudio.ts`
**Lines:** 44–59
**Severity:** MEDIUM

The handler downloads any URL (`fetch(audioUrl)`) with no validation of:
- HTTP response `Content-Type` header
- MIME type allowlist
- File size limit

An attacker can submit large non-audio payloads to exhaust resources or trigger unexpected Whisper behavior. `analyzeFile.ts` enforces type at upload time via Supabase DB record; `transcribeAudio.ts` has no equivalent protection.

**Required fix:** Validate `Content-Type` against an allowlist (`audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/webm`, `audio/mp4`) and enforce a maximum byte size before calling `experimental_transcribe`.

---

### T-02-12 — Rate limiting insufficient for 2-call handlers

**Files:** `api/_lib/ai/transcribeAudio.ts`, `api/_lib/ai/analyzeFile.ts`
**Severity:** HIGH (subsumes T-02-07 for these two files)

Same root cause as T-02-07 with higher impact: both handlers issue **two** AI API calls per request (transcription + summary; image-vision + text-analysis). The global `withUserRateLimit` (20 req/hour) permits up to 40 upstream API calls per hour from a single user through these handlers alone. `checkLimit()` per-feature throttling is the required second line of defence.

**Required fix:** Same fix as T-02-07 — add `checkLimit()` call. Covered by implementing T-02-07 across all affected handlers.

---

## Accepted Risks

| Threat ID | Category | Rationale |
|-----------|----------|-----------|
| T-02-02 | Information Disclosure | Server-side only; model IDs not secret; no user data in router |
| T-02-04 | Denial of Service | `withUserRateLimit` preserved; AI Gateway has own rate limits |
| T-02-08 | Spoofing | `withAuth` middleware unchanged per D-03 |

---

## Security Architecture (as-built)

### API Key Isolation
All AI keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY`) stored as Vercel env vars. Never exposed to frontend. `providers.ts` reads at call time, not module load.

### Middleware Chain
`compose(withUserRateLimit, withCSRF, withAuth)(aiRouter)` — all 6 action endpoints require authenticated session and CSRF token.

### Action Allowlist
`api/ai.ts` switch/case dispatches only to known actions; default returns 404 with valid action list, no internal details.

### Partial checkLimit Coverage
`checkLimit()` implemented in `generateIdeas.ts` only. Gap documented in T-02-07 / T-02-12.

---

## Audit Trail

### Security Audit 2026-04-06
| Metric | Count |
|--------|-------|
| Threats total | 13 |
| Accepted risks | 3 |
| Mitigate-total | 10 |
| Closed (mitigate) | 6 |
| Open | **4** |

Open: T-02-06, T-02-07, T-02-11, T-02-12

**Status: BLOCKED** — Phase advancement blocked until `threats_open: 0`.
Fix mitigations and re-run `/gsd-secure-phase 2`.
