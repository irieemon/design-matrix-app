# Phase 2: AI SDK Foundation - Research

**Researched:** 2026-04-06
**Domain:** AI SDK v6 integration, multi-provider routing, serverless API refactoring
**Confidence:** HIGH

## Summary

This phase replaces all raw `fetch()` calls to OpenAI and Anthropic APIs in the monolithic `api/ai.ts` (2550 lines) with AI SDK v6 `generateText()` calls, adds a server-side model router supporting three providers (OpenAI, Anthropic, MiniMax), and decomposes the monolith into six modular handler files under `api/_lib/ai/`. The AI SDK v6 package (`ai@6.0.148`) provides a unified `generateText()` function that abstracts provider differences behind a consistent interface, making this migration straightforward for the text/JSON generation use cases in this project.

**Critical finding: Vercel AI Gateway.** The `ai` package (v5.0.36+) includes a built-in `gateway()` provider that routes to OpenAI, Anthropic, AND MiniMax via `ai-gateway.vercel.sh` -- all three providers needed for this phase, with zero additional package installs beyond `ai` itself. This eliminates the need for `@ai-sdk/openai`, `@ai-sdk/anthropic`, and the community `vercel-minimax-ai-provider` package. Model IDs use the `provider/model` format (e.g., `openai/gpt-4o`, `anthropic/claude-sonnet-4.5`, `minimax/minimax-m2`). The gateway is free with zero markup on token costs and supports BYOK (Bring Your Own Key) for using existing API keys. [VERIFIED: ai-gateway.vercel.sh/v1/models endpoint returns all three providers; CITED: ai-sdk.dev/providers/ai-sdk-providers/ai-gateway]

The existing codebase has 11 raw `fetch()` calls across 6 handlers, all returning JSON (no streaming). The frontend calls `response.json()` via `BaseAiService.fetchWithErrorHandling()` and must not change. The Whisper transcription handler uses FormData/multipart upload, which AI SDK v6 supports via `experimental_transcribe`. MiniMax models do NOT support image input, so vision tasks must route exclusively to OpenAI or Anthropic.

**Primary recommendation:** Install `ai@6.0.148` as the sole new dependency. Use the built-in `gateway()` provider for all three providers (OpenAI, Anthropic, MiniMax) via the Vercel AI Gateway. This satisfies D-01 (AI SDK + multi-provider) with fewer packages and eliminates the MiniMax community package risk. If the gateway approach is rejected, fall back to installing `@ai-sdk/openai`, `@ai-sdk/anthropic`, and `vercel-minimax-ai-provider` as separate packages per the original D-01.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Install `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, and a MiniMax provider package as new `dependencies`.
- **D-02:** Replace all raw `fetch('https://api.openai.com/v1/chat/completions')` and `fetch('https://api.anthropic.com/v1/messages')` calls in `api/ai.ts` with AI SDK `generateText()` calls using provider instances.
- **D-03:** Existing middleware chain (`withCSRF`, `withAuth`, `withUserRateLimit`, `compose`) is untouched.
- **D-04:** Extract the 6 handlers into individual files under `api/_lib/ai/`: `generateIdeas.ts`, `generateInsights.ts`, `generateRoadmap.ts`, `analyzeFile.ts`, `analyzeImage.ts`, `transcribeAudio.ts`.
- **D-05:** `api/ai.ts` is reduced to a thin router (~50 lines) dispatching by `?action=` query param. The `POST /api/ai?action=X` URL contract is preserved.
- **D-06:** Helper functions move into the relevant handler file or into `api/_lib/ai/utils/` if shared.
- **D-07:** Create `api/_lib/ai/modelRouter.ts` that maps `{ task, hasVision, hasAudio, userTier }` to `{ provider, modelId }`.
- **D-08:** Capability-based routing: vision/audio tasks route only to capable models.
- **D-09:** Existing `src/lib/ai/openaiModelRouter.ts` is left in place (cleanup deferred).
- **D-10:** All 6 actions remain non-streaming (generateText only, not streamText).
- **D-11:** Streaming explicitly deferred.

### Claude's Discretion
- Exact real model IDs for each provider
- Whether MiniMax requires community adapter or first-party package
- Internal module naming and barrel export structure within `api/_lib/ai/`
- Error response format when a specific provider is unavailable (fallback vs fail-fast)

### Deferred Ideas (OUT OF SCOPE)
- Streaming responses (requires frontend hook rewrites)
- Remove/deprecate `src/lib/ai/openaiModelRouter.ts` (frontend router cleanup)
- MiniMax integration complexity (may be scoped as fast-follow if adapter work is significant)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | AI SDK v6 integrated as unified provider layer | `ai@6.0.148` with `generateText()` replaces all raw fetch calls; gateway or individual provider packages handle auth/formatting |
| AI-02 | Multi-provider model router supporting OpenAI, Anthropic, MiniMax | New `modelRouter.ts` with confirmed model IDs; AI Gateway has all three providers built in [VERIFIED: ai-gateway.vercel.sh/v1/models] |
| AI-03 | Capability-based routing (vision only to vision-capable, text to any) | MiniMax has NO image support; OpenAI gpt-4o and Anthropic claude-sonnet-4.5 both support vision; router enforces this |
| AI-04 | Refactor monolithic api/ai.ts into modular handlers under api/_lib/ai/ | 6 handlers extracted per D-04; thin router per D-05; shared utils per D-06 |
| AI-05 | Existing AI features work through new SDK layer without regression | Same prompts, same JSON response shapes, same middleware chain; existing test must pass |
</phase_requirements>

## Standard Stack

### Core

**Recommended approach: AI Gateway (built into `ai` package)**

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai | 6.0.148 | Unified AI SDK core -- `generateText()`, `experimental_transcribe()`, built-in `gateway()` provider | Official Vercel AI SDK; gateway provides all three providers with one package [VERIFIED: npm registry] |

The `ai` package includes the `gateway()` and `createGateway()` functions that route to OpenAI, Anthropic, and MiniMax through `ai-gateway.vercel.sh`. Authentication uses `AI_GATEWAY_API_KEY` env var or OIDC on Vercel. This eliminates the need for separate provider packages and the community MiniMax package. [CITED: ai-sdk.dev/providers/ai-sdk-providers/ai-gateway]

**Alternative approach: Separate provider packages (per original D-01)**

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai | 6.0.148 | Unified AI SDK core -- `generateText()`, `experimental_transcribe()` | [VERIFIED: npm registry] |
| @ai-sdk/openai | 3.0.51 | OpenAI provider; auto-reads `OPENAI_API_KEY` | First-party provider [VERIFIED: npm registry] |
| @ai-sdk/anthropic | 3.0.67 | Anthropic provider; auto-reads `ANTHROPIC_API_KEY` | First-party provider [VERIFIED: npm registry] |
| vercel-minimax-ai-provider | 0.0.2 | MiniMax community provider | Community; v0.0.2 is immature [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AI Gateway (single package) | Three separate provider packages | More packages, MiniMax community adapter (v0.0.2) is a risk |
| Separate provider packages | AI Gateway | Requires gateway API key or Vercel OIDC; adds external dependency on gateway endpoint |
| `openai.chat('gpt-4o')` | `openai.responses('gpt-4o')` | Responses API is the new v6 default but Chat Completions via `.chat()` is closer to current raw fetch behavior; use `.chat()` for safer migration |

**Installation (Gateway approach):**
```bash
npm install ai
```

**Installation (Separate packages approach):**
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic vercel-minimax-ai-provider
```

## Architecture Patterns

### Recommended Project Structure
```
api/
  ai.ts                          # Thin router (~50 lines) - middleware + dispatch
  _lib/
    ai/
      index.ts                   # Barrel export for all handlers
      generateIdeas.ts           # Handler: generate-ideas action
      generateInsights.ts        # Handler: generate-insights action
      generateRoadmap.ts         # Handler: generate-roadmap action
      analyzeFile.ts             # Handler: analyze-file action
      analyzeImage.ts            # Handler: analyze-image action
      transcribeAudio.ts         # Handler: transcribe-audio action
      modelRouter.ts             # Capability-based model selection
      providers.ts               # Provider instances (gateway or individual providers)
      utils/
        prompts.ts               # Shared persona builders, prompt templates
        parsing.ts               # JSON extraction, markdown code block stripping
        confidence.ts            # Confidence calculators, relevance assessors
```

### Pattern 1A: Provider Initialization (Gateway Approach -- RECOMMENDED)
**What:** Use the AI Gateway built into the `ai` package for all providers through a single endpoint.
**When to use:** When the project is deployed on Vercel (this project is).
**Example:**
```typescript
// api/_lib/ai/providers.ts
// Source: https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
import { createGateway } from 'ai';

// Gateway handles all providers through a single API key
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

// Model instances use 'provider/model' format
export function getModel(modelId: string) {
  // modelId format: 'openai/gpt-4o', 'anthropic/claude-sonnet-4.5', 'minimax/minimax-m2'
  return gateway(modelId);
}
```

### Pattern 1B: Provider Initialization (Separate Packages Approach)
**What:** Centralized provider factory that reads env vars once and exports configured instances.
**When to use:** If gateway approach is not viable (e.g., no gateway API key).
**Example:**
```typescript
// api/_lib/ai/providers.ts
// Source: https://ai-sdk.dev/providers/ai-sdk-providers/openai
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createMinimax } from 'vercel-minimax-ai-provider';

export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return createOpenAI({ apiKey });
}

export function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return createAnthropic({ apiKey });
}

export function getMinimax() {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return null;
  return createMinimax({ apiKey });
}
```

### Pattern 2: Model Router with Capability Routing
**What:** Pure function that maps task context to a provider/model string.
**When to use:** Every handler calls this before making an AI request.
**Example:**
```typescript
// api/_lib/ai/modelRouter.ts
export interface TaskRoutingContext {
  task: 'generate-ideas' | 'generate-insights' | 'generate-roadmap'
       | 'analyze-file' | 'analyze-image' | 'transcribe-audio';
  hasVision: boolean;
  hasAudio: boolean;
  userTier: 'free' | 'pro' | 'enterprise';
  complexity?: 'low' | 'medium' | 'high';
}

export interface ModelSelection {
  provider: 'openai' | 'anthropic' | 'minimax';
  modelId: string;              // Full ID e.g. 'openai/gpt-4o' (gateway) or 'gpt-4o' (direct)
  maxOutputTokens: number;
  temperature?: number;
}

export function selectModel(ctx: TaskRoutingContext): ModelSelection {
  // Vision tasks: only OpenAI or Anthropic (MiniMax has NO image support)
  if (ctx.hasVision) {
    return {
      provider: 'openai',
      modelId: 'gpt-4o',
      maxOutputTokens: 4096,
      temperature: 0.3,
    };
  }

  // Audio transcription: always OpenAI whisper
  if (ctx.hasAudio) {
    return {
      provider: 'openai',
      modelId: 'whisper-1',
      maxOutputTokens: 0,
    };
  }

  // Text tasks: route based on availability and tier
  return {
    provider: 'openai',
    modelId: 'gpt-4o',
    maxOutputTokens: 4096,
    temperature: 0.8,
  };
}
```

### Pattern 3: Handler Migration (generateText)
**What:** Replace raw fetch with AI SDK `generateText()`, preserving exact prompt and response parsing.
**When to use:** Every handler that currently calls `fetch('https://api.openai.com/v1/chat/completions')`.
**Example:**
```typescript
// Before (raw fetch):
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-4o', messages, temperature: 0.8, max_tokens: 2500 }),
});
const data = await response.json();
const content = data.choices[0]?.message?.content;

// After (AI SDK v6 with gateway):
import { generateText, gateway } from 'ai';

const { text, usage } = await generateText({
  model: gateway('openai/gpt-4o'),
  system: systemPrompt,
  prompt: userPrompt,
  temperature: 0.8,
  maxOutputTokens: 2500,
});
// `text` is the string content directly -- no choices[0].message.content drilling

// After (AI SDK v6 with separate provider):
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { text, usage } = await generateText({
  model: openai.chat('gpt-4o'),      // Use .chat() for Chat Completions API
  system: systemPrompt,
  prompt: userPrompt,
  temperature: 0.8,
  maxOutputTokens: 2500,
});
```

### Pattern 4: Vision with AI SDK
**What:** Pass image URLs via the messages array content parts.
**When to use:** `analyzeImage` handler.
**Example:**
```typescript
// Source: https://ai-sdk.dev/providers/ai-sdk-providers/openai
const { text } = await generateText({
  model: gateway('openai/gpt-4o'),   // or openai.chat('gpt-4o')
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: analysisPrompt },
      { type: 'image', image: imageUrl },  // AI SDK uses 'image' type, not 'image_url'
    ],
  }],
  maxOutputTokens: 1000,
  temperature: 0.3,
});
```

### Pattern 5: Audio Transcription with AI SDK
**What:** Use `experimental_transcribe` for Whisper transcription.
**When to use:** `transcribeAudio` handler.
**Example:**
```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/transcription
import { experimental_transcribe as transcribe } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const result = await transcribe({
  model: openai.transcription('whisper-1'),
  audio: audioBuffer,  // Uint8Array, ArrayBuffer, Buffer, or URL
  providerOptions: {
    openai: { language: 'en' },
  },
});
// result.text, result.segments, result.language, result.durationInSeconds
```

**Note on transcription with gateway:** `experimental_transcribe()` requires a transcription model instance (e.g., `openai.transcription('whisper-1')`). It is unclear whether the gateway supports transcription models. If not, the Whisper handler may need the `@ai-sdk/openai` package specifically for this one call, even if all other handlers use the gateway. [ASSUMED -- needs verification during implementation]

### Anti-Patterns to Avoid
- **Importing default `openai` from `@ai-sdk/openai` at module top level:** In serverless functions, env vars may not be set at import time. Use `createOpenAI()` inside the handler or a lazy factory. [ASSUMED]
- **Using `openai('gpt-4o')` instead of `openai.chat('gpt-4o')` (separate packages approach):** The default `openai()` call uses the Responses API in v6, not Chat Completions. For a safe migration from raw fetch, use `openai.chat()` explicitly. [CITED: ai-sdk.dev/docs/migration-guides/migration-guide-6-0]
- **Setting `temperature` on models that don't support it:** Some newer models may have fixed temperature. The AI SDK handles this, but be aware. [VERIFIED: existing code already handles GPT-5 temperature restrictions]
- **Changing response shapes:** Handlers must return the EXACT same JSON shape they return today. The `generateText()` return is different from the raw API response, so parsing logic changes but the final `res.json()` call must not.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider auth headers | Manual `Authorization: Bearer` header construction | AI SDK provider instances or gateway | SDK handles auth, retries, error formatting |
| Response parsing | Manual `data.choices[0]?.message?.content` drilling | AI SDK `generateText()` returns `{ text }` directly | Cleaner, type-safe, handles edge cases |
| Model parameter mapping | Manual `max_tokens` vs `max_completion_tokens` logic | AI SDK abstracts this per-model | Current code already has GPT-5 parameter branching; SDK eliminates it |
| Retry logic | Custom retry/backoff on API failures | AI SDK `maxRetries` parameter (default: 2) | Built-in exponential backoff |
| Multi-modal message formatting | Manual `image_url` / content array construction | AI SDK `{ type: 'image', image: url }` | Unified format across providers |
| Audio transcription multipart | Manual `FormData` construction | `experimental_transcribe()` | SDK handles multipart encoding |
| Multi-provider routing endpoint | Custom proxy with multiple base URLs | AI Gateway `gateway('provider/model')` | Single endpoint, built-in fallbacks |

**Key insight:** The entire value of this phase is replacing hand-rolled provider-specific code with the AI SDK abstraction. Every raw `fetch()` call represents duplicated auth, error handling, parameter mapping, and response parsing that the SDK eliminates.

## Common Pitfalls

### Pitfall 1: Responses API vs Chat Completions API (Separate Packages Only)
**What goes wrong:** AI SDK v6 changed `openai('model-id')` to use the Responses API by default, which has different behavior than Chat Completions.
**Why it happens:** Migration guide note: "The default azure() call now uses the Responses API instead of Chat Completions." Same applies to OpenAI.
**How to avoid:** Use `openai.chat('gpt-4o')` explicitly, not `openai('gpt-4o')`, to match current raw fetch behavior. This pitfall does not apply when using the gateway approach (gateway uses its own routing).
**Warning signs:** Unexpected response format, missing fields, or structured output differences.
[CITED: ai-sdk.dev/docs/migration-guides/migration-guide-6-0]

### Pitfall 2: JSON Response Parsing Regression
**What goes wrong:** Current handlers parse raw API response (`data.choices[0]?.message?.content`), strip markdown code blocks, then `JSON.parse()`. AI SDK returns `text` directly, but prompts still ask for JSON.
**Why it happens:** `generateText()` returns the text content directly, but the model may still wrap JSON in markdown code blocks.
**How to avoid:** Keep the existing JSON parsing/cleanup logic (strip ```json blocks, then JSON.parse). The parsing target changes from `data.choices[0].message.content` to `text`, but the cleanup logic stays.
**Warning signs:** `JSON.parse` failures in handler response processing.

### Pitfall 3: Token Tracking Regression
**What goes wrong:** Current code calls `trackTokenUsage(userId, data.usage)` with OpenAI's usage object. AI SDK returns `usage` in a different format.
**Why it happens:** AI SDK `generateText()` returns `usage: { promptTokens, completionTokens, totalTokens }` (camelCase), while OpenAI raw API returns `usage: { prompt_tokens, completion_tokens, total_tokens }` (snake_case).
**How to avoid:** Update `trackTokenUsage` calls to use AI SDK's camelCase usage format, or map the fields.
**Warning signs:** Token tracking silently fails or records zeros.

### Pitfall 4: Anthropic Model ID Format
**What goes wrong:** Current code uses `claude-3-haiku-20240307` and `claude-3-5-sonnet-20241022`. The gateway uses different ID formats.
**Why it happens:** Gateway model IDs use `anthropic/claude-sonnet-4.5` format (no dates), while the Anthropic SDK accepts the dated format.
**How to avoid:** If using the gateway, use gateway model IDs (e.g., `anthropic/claude-sonnet-4.5`, `anthropic/claude-3-haiku`). If using separate packages, the dated IDs still work. Centralize all model IDs in `modelRouter.ts` so there is only one place to update.
**Warning signs:** 404 or model-not-found errors from API.
[VERIFIED: ai-gateway.vercel.sh/v1/models returns `anthropic/claude-sonnet-4.5`, `anthropic/claude-3-haiku`]

### Pitfall 5: MiniMax Provider Maturity (Separate Packages Only)
**What goes wrong:** `vercel-minimax-ai-provider@0.0.2` is a community package at version 0.0.2. It may have bugs or missing features.
**Why it happens:** Community providers have less testing than first-party ones.
**How to avoid:** Use the AI Gateway instead (MiniMax is built in: `minimax/minimax-m2`, `minimax/minimax-m2.1`). If using separate packages, MiniMax should be lowest priority -- implement OpenAI + Anthropic first.
**Warning signs:** Import errors, unexpected response formats, missing API compatibility.
[VERIFIED: gateway has `minimax/minimax-m2`, `minimax/minimax-m2.1`, `minimax/minimax-m2.5`, `minimax/minimax-m2.7`]

### Pitfall 6: Whisper Transcription Handler Complexity
**What goes wrong:** The current `transcribeAudio` handler does more than just Whisper -- it also calls `generateTranscriptionSummary()` which makes a SECOND `fetch()` call to `gpt-4o-mini` for summarization. This second call also needs AI SDK migration.
**Why it happens:** The handler has a multi-step pipeline: transcribe -> summarize -> extract key points.
**How to avoid:** Identify ALL fetch calls within each handler, not just the primary one. The transcription handler has 2 fetch calls (Whisper API + gpt-4o-mini summary).
**Warning signs:** Partial migration where one fetch is converted but another is missed.

### Pitfall 7: Gateway Authentication Setup
**What goes wrong:** The AI Gateway requires either an `AI_GATEWAY_API_KEY` env var or Vercel OIDC tokens. Without either, requests fail.
**Why it happens:** New env var not provisioned, or local dev not using `vercel dev`.
**How to avoid:** Add `AI_GATEWAY_API_KEY` to Vercel env vars via dashboard or `vercel env add`. For local dev, run `vercel env pull` to get OIDC tokens (valid 12 hours), or set the API key in `.env.local`.
**Warning signs:** 401 Unauthorized from gateway endpoint.
[CITED: vercel.com/docs/ai-gateway]

## Code Examples

### Complete Handler Migration Example (generateIdeas -- Gateway Approach)

```typescript
// api/_lib/ai/generateIdeas.ts
import { generateText } from 'ai';
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../middleware/types';
import { InputValidator, commonRules } from '../utils/validation.js';
import { checkLimit, trackAIUsage } from '../services/subscriptionService.js';
import { trackTokenUsage } from '../utils/supabaseAdmin.js';
import { selectModel } from './modelRouter';
import { getModel } from './providers';
import { getProjectTypePersona } from './utils/prompts';
import { parseJsonResponse } from './utils/parsing';

export async function handleGenerateIdeas(req: AuthenticatedRequest, res: VercelResponse) {
  const validation = InputValidator.validate(req.body, [
    commonRules.title,
    commonRules.description,
    { ...commonRules.projectType, required: false },
    { ...commonRules.count, required: false },
    { ...commonRules.tolerance, required: false }
  ]);

  if (!validation.isValid) {
    return res.status(400).json({ error: 'Validation failed', details: validation.errors });
  }

  const { title, description, projectType = 'other', count = 8, tolerance = 50 } = validation.sanitizedData;

  try {
    const userId = req.user!.id;
    const limitCheck = await checkLimit(userId, 'ai_ideas');
    if (!limitCheck.canUse) {
      return res.status(403).json({
        error: 'AI_LIMIT_REACHED',
        message: `You've reached your monthly limit of ${limitCheck.limit} AI-generated ideas.`,
        current: limitCheck.current,
        limit: limitCheck.limit,
        percentageUsed: limitCheck.percentageUsed,
      });
    }

    const selection = selectModel({
      task: 'generate-ideas',
      hasVision: false,
      hasAudio: false,
      userTier: 'free', // TODO: read from user context
    });

    const personaContext = getProjectTypePersona(projectType, tolerance);
    const systemPrompt = `${personaContext.persona}\n...`; // Same prompt as today
    const userPrompt = `Project: ${title}\nDescription: ${description}\n...`;

    // Gateway model ID format: 'provider/model'
    const gatewayModelId = `${selection.provider}/${selection.modelId}`;
    const model = getModel(gatewayModelId);

    const { text, usage } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: selection.temperature,
      maxOutputTokens: selection.maxOutputTokens,
    });

    const ideas = parseJsonResponse(text); // Reusable JSON extraction

    // Track usage (map camelCase to snake_case for existing tracking)
    await trackAIUsage(userId, 'ai_ideas');
    if (usage) {
      await trackTokenUsage(userId, {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      });
    }

    return res.status(200).json({ ideas });
  } catch (error) {
    console.error('Error generating ideas:', error);
    return res.status(500).json({
      error: 'Failed to generate ideas',
      debug: process.env.NODE_ENV === 'development'
        ? (error instanceof Error ? error.message : String(error))
        : undefined,
    });
  }
}
```

### Thin Router Example

```typescript
// api/ai.ts (reduced to ~50 lines)
import type { VercelResponse } from '@vercel/node';
import {
  withUserRateLimit, withCSRF, withAuth, compose,
  type AuthenticatedRequest,
} from './_lib/middleware/index.js';
import { handleGenerateIdeas } from './_lib/ai/generateIdeas';
import { handleGenerateInsights } from './_lib/ai/generateInsights';
import { handleGenerateRoadmap } from './_lib/ai/generateRoadmap';
import { handleAnalyzeFile } from './_lib/ai/analyzeFile';
import { handleAnalyzeImage } from './_lib/ai/analyzeImage';
import { handleTranscribeAudio } from './_lib/ai/transcribeAudio';

async function aiRouter(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = (req.query.action as string) || '';

  switch (action) {
    case 'generate-ideas': return handleGenerateIdeas(req, res);
    case 'generate-insights': return handleGenerateInsights(req, res);
    case 'generate-roadmap':
    case 'generate-roadmap-v2': return handleGenerateRoadmap(req, res);
    case 'analyze-file': return handleAnalyzeFile(req, res);
    case 'analyze-image': return handleAnalyzeImage(req, res);
    case 'transcribe-audio': return handleTranscribeAudio(req, res);
    default:
      return res.status(404).json({
        error: 'Invalid action',
        validActions: ['generate-ideas', 'generate-insights', 'generate-roadmap',
                       'analyze-file', 'analyze-image', 'transcribe-audio'],
      });
  }
}

export default compose(
  withUserRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 20 }),
  withCSRF(),
  withAuth
)(aiRouter);
```

## Model ID Reference

### Confirmed Model IDs (Gateway Format)

All model IDs verified against the live AI Gateway endpoint at `ai-gateway.vercel.sh/v1/models`. [VERIFIED: 2026-04-06]

| Provider | Gateway Model ID | Capability | Use For |
|----------|-----------------|-----------|---------|
| OpenAI | `openai/gpt-4o` | Text + Vision | Ideas, insights, roadmap, image analysis, file analysis |
| OpenAI | `openai/gpt-4o-mini` | Text + Vision | Transcription summary (cheaper) |
| OpenAI | `openai/gpt-4.1` | Text + Vision | Newer option; evaluate as upgrade path |
| Anthropic | `anthropic/claude-sonnet-4.5` | Text + Vision | Fallback for text tasks; vision capable |
| Anthropic | `anthropic/claude-3-haiku` | Text | Cheap fallback for idea generation |
| Anthropic | `anthropic/claude-3.5-haiku` | Text | Newer cheap option |
| MiniMax | `minimax/minimax-m2` | Text only (NO images) | Text tasks only; cost optimization |
| MiniMax | `minimax/minimax-m2.1` | Text only | Newer version |
| MiniMax | `minimax/minimax-m2.5` | Text only | Latest stable |

### Confirmed Model IDs (Direct Provider Format)

For the separate packages approach, these model IDs are confirmed working in the existing codebase:

| Provider | Model ID | Notes |
|----------|----------|-------|
| OpenAI | `gpt-4o` | Currently used in production [VERIFIED: codebase line 188, 810, 2030] |
| OpenAI | `gpt-4o-mini` | Used for transcription summary [VERIFIED: codebase line 2432] |
| OpenAI | `whisper-1` | Used for audio transcription [VERIFIED: codebase line 2280] |
| Anthropic | `claude-3-5-sonnet-20241022` | Used for insights fallback [VERIFIED: codebase line 889] |
| Anthropic | `claude-3-haiku-20240307` | Used for idea generation fallback [VERIFIED: codebase line 385] |

### Model Capability Matrix

| Task | OpenAI | Anthropic | MiniMax |
|------|--------|-----------|---------|
| generate-ideas | gpt-4o | claude-3-haiku | minimax-m2 |
| generate-insights | gpt-4o | claude-sonnet-4.5 | minimax-m2 |
| generate-roadmap | gpt-4o | claude-sonnet-4.5 | minimax-m2 |
| analyze-file | gpt-4o | claude-sonnet-4.5 | NOT SUPPORTED |
| analyze-image | gpt-4o | claude-sonnet-4.5 | NOT SUPPORTED (no image input) |
| transcribe-audio | whisper-1 | NOT SUPPORTED | NOT SUPPORTED |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `generateObject()` + schema | `generateText()` with `Output.object()` | AI SDK v6 (Dec 2025) | generateObject deprecated in v6; not relevant since we use text+JSON parsing |
| `openai('model')` uses Chat Completions | `openai('model')` uses Responses API | AI SDK v6 | Must use `openai.chat('model')` for backward-compatible behavior (separate packages approach) |
| `max_tokens` parameter | `maxOutputTokens` parameter | AI SDK v6 | SDK normalizes this across providers |
| `CoreMessage` type | `ModelMessage` type | AI SDK v6 | Use new type names if constructing message arrays |
| Manual Whisper FormData | `experimental_transcribe()` | AI SDK ~5.x | SDK handles multipart encoding, returns structured result |
| Separate provider packages | Built-in `gateway()` provider | AI SDK v5.0.36+ | Single package covers all providers via Vercel AI Gateway |

**Deprecated/outdated:**
- `generateObject()` is deprecated in AI SDK v6; use `generateText()` with `Output.object()` [CITED: ai-sdk.dev/docs/migration-guides/migration-guide-6-0]
- `CoreMessage` type replaced by `ModelMessage` [CITED: ai-sdk.dev/docs/migration-guides/migration-guide-6-0]
- The existing `src/lib/ai/openaiModelRouter.ts` references fictional model IDs (`gpt-5`, `gpt-5-mini`) that are not used in production API calls [VERIFIED: codebase inspection]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Serverless env vars may not be set at import time, so use `createOpenAI()` or `createGateway()` lazily not at top-level | Anti-Patterns | Low -- could use top-level import if env is always set; lazy is safer |
| A2 | `openai.chat()` is the right sub-API for migration (vs `openai.responses()`) when using separate packages | Pitfall 1 | Medium -- if Responses API is required for some feature, we'd need to switch |
| A3 | `experimental_transcribe()` supports all features the current Whisper handler needs (language, verbose_json segments) | Pattern 5 | Medium -- if it lacks features, fall back to raw fetch for Whisper only |
| A4 | AI Gateway supports transcription model endpoints | Pattern 5 Note | Medium -- if not, need `@ai-sdk/openai` specifically for Whisper |
| A5 | MiniMax text quality is adequate for idea generation and insights | Model ID Reference | Low -- MiniMax is lowest priority provider, fallback always available |
| A6 | AI Gateway BYOK works with existing OPENAI_API_KEY and ANTHROPIC_API_KEY | Summary | Medium -- may need separate AI_GATEWAY_API_KEY setup in Vercel |

## Open Questions

1. **AI Gateway vs Separate Provider Packages**
   - What we know: Gateway is built into `ai` package, supports all three providers, zero markup pricing
   - What's unclear: Whether the team has gateway access enabled on their Vercel account, and whether BYOK is configured
   - Recommendation: Try gateway approach first (fewer packages, no community MiniMax risk). Fall back to separate packages if gateway auth is problematic.

2. **AI_GATEWAY_API_KEY provisioning**
   - What we know: Gateway needs either API key or Vercel OIDC; `vercel env pull` downloads OIDC tokens for local dev
   - What's unclear: Whether the team has provisioned gateway credentials
   - Recommendation: Run `vercel env pull` to check if OIDC is available. If not, create an AI Gateway API key in Vercel dashboard.

3. **Token usage tracking format**
   - What we know: AI SDK returns `{ promptTokens, completionTokens, totalTokens }` (camelCase); existing `trackTokenUsage()` may expect snake_case
   - What's unclear: Exact schema of `trackTokenUsage()` parameter
   - Recommendation: Map AI SDK usage to existing format in a small utility function

4. **Error response format for provider unavailability**
   - What we know: CONTEXT.md leaves this to Claude's discretion
   - What's unclear: Whether to fail-fast (return 503) or fallback (try next provider)
   - Recommendation: Implement fallback chain (OpenAI -> Anthropic -> error) for text tasks. For vision/audio tasks where only one provider works, fail-fast with clear error message.

5. **MINIMAX_API_KEY environment variable (separate packages approach only)**
   - What we know: The community MiniMax provider reads `MINIMAX_API_KEY` from env
   - What's unclear: Whether the project has a MiniMax API key. Not relevant if using gateway approach.
   - Recommendation: If using gateway, MiniMax routing uses the gateway API key. If using separate packages, add `MINIMAX_API_KEY` to env vars.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 22.19.0 | -- |
| npm | Package install | Yes | 10.x | -- |
| OPENAI_API_KEY | Direct OpenAI provider | Yes (env var) | -- | Anthropic fallback |
| ANTHROPIC_API_KEY | Direct Anthropic provider | Yes (env var) | -- | OpenAI fallback |
| AI_GATEWAY_API_KEY | AI Gateway | Unknown | -- | Use separate provider packages |
| Vercel OIDC | AI Gateway (deployed) | Yes (auto on Vercel) | -- | AI_GATEWAY_API_KEY |
| MINIMAX_API_KEY | Direct MiniMax provider | Unknown | -- | OpenAI/Anthropic fallback |
| ai-gateway.vercel.sh | AI Gateway endpoint | Yes (reachable) | -- | Separate provider packages |

**Missing dependencies with no fallback:**
- None -- at least one of OpenAI/Anthropic is required and both are available

**Missing dependencies with fallback:**
- AI_GATEWAY_API_KEY: If not provisioned, use separate provider packages
- MINIMAX_API_KEY: If not available, MiniMax routing falls back to OpenAI/Anthropic

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run api/` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | generateText replaces raw fetch | unit | `npx vitest run api/__tests__/ai-sdk-integration.test.ts -x` | No -- Wave 0 |
| AI-02 | Model router selects correct provider | unit | `npx vitest run api/__tests__/model-router.test.ts -x` | No -- Wave 0 |
| AI-03 | Vision tasks route only to vision models | unit | `npx vitest run api/__tests__/model-router.test.ts -x` | No -- Wave 0 |
| AI-04 | Handlers extracted and router dispatches correctly | unit | `npx vitest run api/__tests__/ai-router.test.ts -x` | No -- Wave 0 |
| AI-05 | Existing ideas test passes (regression) | unit | `npx vitest run api/__tests__/ai-generate-ideas.test.ts -x` | Yes (needs update for new imports) |

### Sampling Rate
- **Per task commit:** `npx vitest run api/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `api/__tests__/model-router.test.ts` -- covers AI-02, AI-03 (capability routing)
- [ ] `api/__tests__/ai-router.test.ts` -- covers AI-04 (thin router dispatching)
- [ ] `api/__tests__/ai-sdk-integration.test.ts` -- covers AI-01 (generateText usage)
- [ ] Update `api/__tests__/ai-generate-ideas.test.ts` -- update import paths for AI-05 regression
- [ ] Mock setup for `ai` package `generateText` function

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Middleware unchanged (D-03) |
| V3 Session Management | No | Middleware unchanged (D-03) |
| V4 Access Control | Yes | `checkLimit()` + `withAuth` preserved in every handler |
| V5 Input Validation | Yes | `InputValidator.validate()` preserved in extracted handlers |
| V6 Cryptography | No | No crypto changes |

### Known Threat Patterns for AI API Layer

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leakage in error responses | Information Disclosure | AI SDK providers handle auth internally; never log API keys |
| Prompt injection via user input | Tampering | Existing input validation preserved; not new to this phase |
| AI cost abuse | Denial of Service | `checkLimit()` + `withUserRateLimit` middleware preserved |
| Provider API key in client bundle | Information Disclosure | All provider instances server-side only (api/_lib/); Vite cannot bundle these |
| Gateway API key exposure | Information Disclosure | AI_GATEWAY_API_KEY is server-side env var only; OIDC preferred for zero-secret setup |

## Sources

### Primary (HIGH confidence)
- [npm registry] -- `ai@6.0.148`, `@ai-sdk/openai@3.0.51`, `@ai-sdk/anthropic@3.0.67`, `vercel-minimax-ai-provider@0.0.2` versions verified
- [ai-gateway.vercel.sh/v1/models] -- Live endpoint queried; confirmed OpenAI, Anthropic, MiniMax model IDs (2026-04-06)
- [ai-sdk.dev/docs/reference/ai-sdk-core/generate-text](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) -- generateText API signature and parameters
- [ai-sdk.dev/providers/ai-sdk-providers/openai](https://ai-sdk.dev/providers/ai-sdk-providers/openai) -- OpenAI provider configuration, .chat() vs default, vision, transcription
- [ai-sdk.dev/providers/ai-sdk-providers/anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) -- Anthropic provider configuration, model IDs, vision support
- [ai-sdk.dev/providers/ai-sdk-providers/ai-gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway) -- Built-in gateway provider, authentication, model ID format
- [ai-sdk.dev/providers/community-providers/minimax](https://ai-sdk.dev/providers/community-providers/minimax) -- MiniMax community provider (fallback if gateway not used)
- [ai-sdk.dev/docs/migration-guides/migration-guide-6-0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) -- v6 breaking changes
- [vercel.com/docs/ai-gateway](https://vercel.com/docs/ai-gateway) -- Gateway overview, pricing (zero markup), BYOK, authentication
- [Codebase inspection] -- `api/ai.ts` (2550 lines), all 6 handlers, 11 raw fetch calls, model IDs in production

### Secondary (MEDIUM confidence)
- [ai-sdk.dev/docs/ai-sdk-core/transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription) -- experimental_transcribe API for Whisper

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified on npm, gateway endpoint verified, official docs reviewed
- Architecture: HIGH -- decomposition plan follows CONTEXT.md decisions with verified SDK APIs; gateway discovery simplifies D-01
- Pitfalls: HIGH -- identified from migration guide, codebase inspection, gateway verification, and community provider analysis

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (AI SDK is fast-moving but core APIs are stable at v6)
