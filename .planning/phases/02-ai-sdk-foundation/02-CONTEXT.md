# Phase 2: AI SDK Foundation - Context

**Gathered:** 2026-04-06 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild the AI calling layer on AI SDK v6 with multi-provider routing (OpenAI, Anthropic, MiniMax) and no regressions in existing functionality. The monolithic `api/ai.ts` (2550 lines) is decomposed into modular handlers under `api/_lib/ai/`. All existing features (idea generation, insights, roadmap) continue working through the new layer. The `?action=X` URL contract is preserved — no frontend URL changes.

</domain>

<decisions>
## Implementation Decisions

### AI SDK Package Integration
- **D-01:** Install `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, and a MiniMax provider package (first-party or community — confirm package name before planning) as new `dependencies`.
- **D-02:** Replace all raw `fetch('https://api.openai.com/v1/chat/completions')` and `fetch('https://api.anthropic.com/v1/messages')` calls in `api/ai.ts` with AI SDK `generateText()` calls using provider instances.
- **D-03:** Existing middleware chain (`withCSRF`, `withAuth`, `withUserRateLimit`, `compose`) is untouched — this migration is entirely within the AI calling layer.

### Handler Decomposition
- **D-04:** Extract the 6 handlers from `api/ai.ts` into individual files under `api/_lib/ai/`:
  - `api/_lib/ai/generateIdeas.ts`
  - `api/_lib/ai/generateInsights.ts`
  - `api/_lib/ai/generateRoadmap.ts`
  - `api/_lib/ai/analyzeFile.ts`
  - `api/_lib/ai/analyzeImage.ts`
  - `api/_lib/ai/transcribeAudio.ts`
- **D-05:** `api/ai.ts` is reduced to a thin router (~50 lines): imports middleware chain, imports handlers, dispatches by `?action=` query param. The `POST /api/ai?action=X` URL contract is preserved unchanged.
- **D-06:** Helper functions currently inline in `api/ai.ts` (persona builders, prompt builders, confidence calculators) move into the relevant handler file or into `api/_lib/ai/utils/` if shared.

### Model Router Design
- **D-07:** Create a new server-side `api/_lib/ai/modelRouter.ts` that replaces (not extends) the existing `OpenAIModelRouter` from `src/lib/ai/openaiModelRouter.ts`. New router maps `{ task, hasVision, hasAudio, userTier }` → `{ provider: 'openai' | 'anthropic' | 'minimax', modelId: string }` using real, confirmed model IDs.
- **D-08:** Capability-based routing enforced at the router level: tasks with `hasVision: true` or `hasAudio: true` route only to vision/audio-capable models. Text-only tasks can route to any provider.
- **D-09:** The existing `src/lib/ai/openaiModelRouter.ts` is left in place for now (it's a frontend file, not imported by `api/`). It can be cleaned up in a future phase once the server-side router is proven.

### Streaming Scope
- **D-10:** All 6 actions remain non-streaming — AI SDK `generateText()` used, not `streamText()`. Frontend `BaseAiService.fetchWithErrorHandling` calls `response.json()` and must not change.
- **D-11:** Streaming is explicitly deferred. It requires rewriting frontend hook consumption (ReadableStream handling) which is out of scope for this phase.

### Claude's Discretion
- Exact real model IDs for each provider (researcher should confirm gpt-4o, claude-3-5-sonnet, minimax model IDs)
- Whether MiniMax requires a community adapter or has a first-party AI SDK provider package
- Internal module naming and barrel export structure within `api/_lib/ai/`
- Error response format when a specific provider is unavailable (fallback vs fail-fast)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Monolithic file to decompose
- `api/ai.ts` — 2550-line monolith; router at line ~2496, 6 handlers starting at lines 36, 460, 1096, 1504, 1979, 2221
- Key raw fetch calls to replace: lines 188, 377, 810, 881, 1204, 1724, 1826, 1919, 2023, 2292, 2425

### Existing model router (to be replaced server-side)
- `src/lib/ai/openaiModelRouter.ts` — Current OpenAI-only router; `TaskContext` interface (lines 45–50) has `hasImages`/`hasAudio` flags that map to AI-03 capability routing. Note: references fictional model IDs (`gpt-5`, `gpt-5-mini`) — NOT valid API IDs. Actual production code uses `gpt-4o`.

### Frontend AI service layer (must not break)
- `src/lib/ai/services/BaseAiService.ts` — `fetchWithErrorHandling()` calls `response.json()` at line ~111; all AI services extend this
- `src/lib/ai/services/IdeaGenerationService.ts` — Calls `POST /api/ai?action=generate-ideas`
- `src/lib/ai/services/InsightsService.ts` — Calls `POST /api/ai?action=generate-insights`
- `src/lib/ai/services/RoadmapService.ts` — Calls `POST /api/ai?action=generate-roadmap`
- `src/lib/ai/utils/AiConstants.ts` — All 6 URL constants; must remain unchanged

### Middleware (do not change)
- `api/_lib/middleware/compose.ts` — `protectedEndpoint()`, `adminEndpoint()` chains
- `api/_lib/middleware/withAuth.ts`, `withCSRF.ts`, `withUserRateLimit.ts`

### Tests
- `api/__tests__/ai-generate-ideas.test.ts` — Existing test; must pass after migration (no regressions)

### Requirements
- `.planning/REQUIREMENTS.md` §AI Foundation (AI-01 through AI-05)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/_lib/middleware/compose.ts`: Pre-built `protectedEndpoint()` chain already used in `api/ai.ts` — keep using it in the thin router
- `src/lib/ai/openaiModelRouter.ts`: `TaskContext` interface (capability flags) is a good starting point for the new server-side router's input shape
- `api/_lib/services/subscriptionService.ts`: `checkLimit()` and `trackAIUsage()` already imported by `api/ai.ts` and must be preserved in extracted handlers
- `api/_lib/utils/supabaseAdmin.ts`: `trackTokenUsage()` used for admin token tracking — must remain in extracted handlers

### Established Patterns
- `api/_lib/` convention: middleware, services, utils all live here — new `api/_lib/ai/` handlers follow the same structure
- Handler signature: every handler takes `(req: AuthenticatedRequest, res: VercelResponse)` — extracting them preserves this signature exactly
- Provider fallback pattern: `api/ai.ts` already has `if (openaiKey) { ... } else if (anthropicKey) { ... }` — AI SDK migration should formalize this as the router's fallback chain
- JSON-only responses: every handler returns `res.status(2xx).json(...)` — no streaming infrastructure to add

### Integration Points
- `api/ai.ts` router function (line ~2496) dispatches by `req.query.action` — this thin router stays; handlers become imports
- All 6 handler functions currently take `(req, res)` and are self-contained — minimal refactoring needed to extract
- `checkLimit()` + `trackAIUsage()` calls are at the top of each handler — must be the first thing called after auth (preserve order)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- **Streaming responses** — Requires frontend hook rewrites; explicitly out of scope for Phase 2. Could be a Phase 7+ enhancement.
- **Remove/deprecate `src/lib/ai/openaiModelRouter.ts`** — Frontend router is unused by the backend after migration; cleanup can happen in a later phase.
- **MiniMax integration complexity** — If MiniMax requires significant adapter work, it may be scoped as a fast-follow after the OpenAI + Anthropic routing is verified.

</deferred>

---

*Phase: 02-ai-sdk-foundation*
*Context gathered: 2026-04-06*
