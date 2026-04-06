---
phase: 2
slug: ai-sdk-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 2 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:run -- src/` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run -- src/`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AI-01 | T-02-01 | Provider keys not leaked to client | unit | `npm run test:run -- api/_lib/ai/utils/` | W0 | pending |
| 02-01-02 | 01 | 1 | AI-02, AI-03 | T-02-02 | Router selects vision model for vision tasks; never routes vision to MiniMax | unit | `npm run test:run -- api/_lib/ai/__tests__/router.test.ts` | W0 | pending |
| 02-02-01 | 02 | 2 | AI-01, AI-03 | T-02-05 | Idea generation returns same shape as before; validation preserved | unit | `npm run test:run -- api/_lib/ai/__tests__/handlers/ideas.test.ts` | W0 | pending |
| 02-02-02 | 02 | 2 | AI-01, AI-03 | T-02-06 | Insights handler returns same shape as before; Anthropic fallback works | unit | `npm run test:run -- api/_lib/ai/__tests__/handlers/insights.test.ts` | W0 | pending |
| 02-02-03 | 02 | 2 | AI-01, AI-03 | T-02-07 | Roadmap handler returns same shape as before; checkLimit called first | unit | `npm run test:run -- api/_lib/ai/__tests__/handlers/roadmap.test.ts` | W0 | pending |
| 02-03-01 | 03 | 3 | AI-04, AI-05 | T-02-10 | analyzeFile migrates all 4 fetch calls; vision routes to capable model | unit | `npm run test:run -- api/_lib/ai/__tests__/handlers/analyzeFile.test.ts` | W0 | pending |
| 02-03-02 | 03 | 3 | AI-04, AI-05 | T-02-10 | analyzeImage uses vision content parts; never routes to MiniMax | unit | `npm run test:run -- api/_lib/ai/__tests__/handlers/analyzeImage.test.ts` | W0 | pending |
| 02-03-03 | 03 | 3 | AI-04, AI-05 | T-02-11, T-02-12 | transcribeAudio two-step pipeline preserved; audio content validated | unit | `npm run test:run -- api/_lib/ai/__tests__/handlers/transcribeAudio.test.ts` | W0 | pending |
| 02-03-04 | 03 | 3 | AI-04 | T-02-09 | Thin router dispatches all 6 actions; unknown actions return 404 | integration | `npm run test:run && npm run type-check` | existing | pending |

*Status: pending -- W0 -- green -- red -- flaky*

---

## Wave 0 Requirements

### Plan 01 (Wave 1) -- Foundation stubs
- [ ] `api/_lib/ai/__tests__/router.test.ts` -- stubs for AI-02, AI-03 routing logic
- [ ] `api/_lib/ai/__tests__/handlers/ideas.test.ts` -- stubs for AI-01/AI-03 idea generation shape
- [ ] `api/_lib/ai/__tests__/handlers/insights.test.ts` -- stubs for AI-01/AI-03 insights shape
- [ ] `api/_lib/ai/__tests__/handlers/roadmap.test.ts` -- stubs for AI-01/AI-03 roadmap shape

### Plan 03 (Wave 3) -- Multi-modal handler stubs
- [ ] `api/_lib/ai/__tests__/handlers/analyzeFile.test.ts` -- stubs for AI-04/AI-05 file analysis (image, audio, text paths)
- [ ] `api/_lib/ai/__tests__/handlers/analyzeImage.test.ts` -- stubs for AI-04/AI-05 vision content parts, MiniMax exclusion
- [ ] `api/_lib/ai/__tests__/handlers/transcribeAudio.test.ts` -- stubs for AI-04/AI-05 two-step transcribe+summarize pipeline

### Already available
- [ ] Vitest already installed -- no framework install needed
- [ ] `api/__tests__/ai-generate-ideas.test.ts` -- existing regression test (AI-05)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end AI response quality matches before migration | AI-05 | Semantic comparison requires human judgment | Compare idea/insights/roadmap outputs before and after in dev environment |
| AI Gateway key provisioned on Vercel | AI-01 | Infrastructure check | Verify `AI_GATEWAY_API_KEY` set in Vercel dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
