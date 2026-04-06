# Architecture Patterns

**Domain:** Multi-modal AI collaborative prioritization tool
**Researched:** 2026-04-06
**Confidence:** MEDIUM-HIGH (verified against existing codebase, official docs, current ecosystem)

## Current Architecture Baseline

Before recommending changes, here is what exists and what it implies for the build.

**Existing layers (working):**
- React SPA (Vite) with Context providers + repository pattern
- Vercel serverless functions at `api/*.ts` (auth, ai, stripe, admin)
- Supabase PostgreSQL + Auth + Realtime + Storage
- `OpenAIModelRouter` in `src/lib/ai/` -- routes by task type/complexity, OpenAI-only
- `MultiModalProcessor` in `src/lib/` -- full interface, placeholder implementations (TODO comments everywhere)
- `AiServiceFacade` in `src/lib/ai/` -- unified frontend facade calling `/api/ai?action=*`
- `BrainstormRealtimeManager` -- Supabase Realtime channels with presence, reconnection, event batching
- `FileService` -- Supabase Storage upload/download with signed URLs, triggers background AI analysis
- Feature flags in `src/lib/config.ts` for mobile brainstorm phases 2-5 (all currently disabled)

**Existing API actions (in `api/ai.ts`):**
- `generate-ideas`, `generate-insights`, `generate-roadmap` -- working, using raw `fetch` to OpenAI
- `analyze-file` -- working, dispatches to GPT-4o for text analysis
- `analyze-image` -- working, sends image URL to GPT-4o vision endpoint
- `transcribe-audio` -- working, downloads audio and sends to Whisper API

**Key constraint:** The API layer already works. The multi-modal handlers exist but use raw `fetch` calls and are OpenAI-only. The frontend `MultiModalProcessor` is all placeholders.

## Recommended Architecture

### High-Level Component Diagram

```
+-------------------+     +---------------------+     +---------------------+
|   React SPA       |     |  Vercel Serverless   |     |  Vercel AI Gateway  |
|   (Vite)          |     |  Functions           |     |  (unified routing)  |
|                   |     |                      |     |                     |
| [AiServiceFacade] |---->| [/api/ai]            |---->| OpenAI (GPT-5.4,   |
| [MultiModal       |     |   - AIProviderRouter |     |   Whisper)          |
|  Processor]       |     |   - FileAnalyzer     |     | Anthropic (Claude   |
| [FileUploader]    |     |   - AudioTranscriber |     |   Opus 4.6)         |
|                   |     |   - ImageAnalyzer    |     | MiniMax 2.7         |
| [BrainstormRT     |     | [/api/ideas]         |     +---------------------+
|  Manager]         |<--->| [/api/stripe]        |
| [CollabPresence]  |     |                      |     +-------------------+
|                   |     |                      |     |   Supabase        |
+-------------------+     +---------------------+     |   - PostgreSQL    |
        |                         |                    |   - Auth          |
        |                         |                    |   - Realtime      |
        +-------------------------+------------------->|   - Storage       |
                                                       +-------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Location |
|-----------|---------------|-------------------|----------|
| **AiServiceFacade** (existing) | Unified frontend AI interface; caching, auth headers | `/api/ai` via HTTP POST | `src/lib/ai/AiServiceFacade.ts` |
| **AIProviderRouter** (new) | Server-side multi-provider model selection via AI Gateway | Vercel AI Gateway (routes to OpenAI, Anthropic, MiniMax) | `api/_lib/ai/providerRouter.ts` |
| **MultiModalProcessor** (rewrite) | Server-side orchestrator for file analysis pipelines | AIProviderRouter, Supabase Storage | `api/_lib/ai/multiModalProcessor.ts` |
| **FileUploader** (existing+enhance) | Client-side upload to Supabase Storage; triggers server-side analysis | Supabase Storage, `/api/ai?action=analyze-file` | `src/lib/fileService.ts` |
| **BrainstormRealtimeManager** (existing) | WebSocket coordination, presence, reconnection | Supabase Realtime channels | `src/lib/realtime/BrainstormRealtimeManager.ts` |
| **CollabPresenceLayer** (new) | Multi-user presence for project-level collaboration (beyond brainstorm) | Supabase Realtime Presence | `src/lib/realtime/CollabPresenceManager.ts` |
| **SubscriptionGate** (existing+enhance) | Enforce AI usage limits per tier | Supabase `subscriptions` table | `api/_lib/services/subscriptionService.ts` |

### Data Flow

#### Multi-Modal File Analysis Pipeline

This is the most architecturally significant new flow. Files must bypass Vercel's 4.5MB body limit.

```
1. User selects file (image/audio/video) in browser
2. FileUploader uploads directly to Supabase Storage (bypasses Vercel 4.5MB limit)
3. FileUploader inserts metadata row in `project_files` table (status: 'pending')
4. FileUploader calls POST /api/ai?action=analyze-file with { fileId, projectId }
5. Server handler:
   a. Fetches file metadata from `project_files`
   b. Generates signed URL from Supabase Storage
   c. Routes to correct analysis pipeline based on mime_type:
      - image/* -> AIProviderRouter.analyzeImage(signedUrl) -> GPT-5.4 vision
      - audio/* -> AIProviderRouter.transcribeAudio(signedUrl) -> Whisper API
      - video/* -> AIProviderRouter.analyzeVideo(signedUrl) -> frame extraction + Whisper
      - text/*  -> AIProviderRouter.analyzeDocument(content) -> openai/gpt-5.4-mini
   d. Stores analysis result in `project_files.ai_analysis` column
   e. Updates `project_files.analysis_status` to 'completed'
6. Frontend polls or receives realtime update showing analysis complete
7. MultiModalProcessor.createAIPromptContext() aggregates all file analyses for AI prompts
```

**Critical design decision:** Files upload directly to Supabase Storage from the client. The serverless function only receives the file ID and fetches via signed URL. This is already the existing pattern in `FileService` and it correctly avoids the Vercel 4.5MB payload limit.

#### Multi-Provider AI Routing

```
1. Frontend calls AiServiceFacade.generateInsights(ideas, projectName, ...)
2. AiServiceFacade POSTs to /api/ai?action=generate-insights
3. Server handler:
   a. Validates auth + subscription limits
   b. Gathers multi-modal context from project_files
   c. Calls AIProviderRouter.selectProvider(taskContext)
   d. AIProviderRouter evaluates:
      - Task type (insights, ideas, roadmap, image-analysis, transcription)
      - Complexity score (idea count, file count, media types)
      - User tier (free -> gpt-5.4-mini only, pro -> gpt-5.4/Claude, enterprise -> all)
      - Provider fallback (AI Gateway handles failover automatically)
   e. Executes request via AI SDK generateText with plain string model ID
   f. Tracks token usage via result.usage + trackTokenUsage()
4. Response returned to frontend
```

#### Real-Time Collaboration Flow

```
1. User opens project -> CollabPresenceManager joins presence channel
2. Other users see presence indicators (avatar, cursor, "editing idea X")
3. During brainstorm session:
   a. BrainstormRealtimeManager handles idea submissions (existing)
   b. Presence channel tracks typing indicators (existing in Phase 2)
   c. Postgres changes channel broadcasts idea CRUD to all participants
4. Outside brainstorm (project collaboration):
   a. Idea lock service prevents concurrent edits (existing in ideaLockService)
   b. Matrix position changes broadcast via realtime
   c. Cursor presence optional (defer to post-launch)
```

## Patterns to Follow

### Pattern 1: AI Gateway with Plain String Model IDs (Replace Raw Fetch)

**What:** Centralize all AI provider calls through the Vercel AI Gateway using plain string model identifiers (`"openai/gpt-5.4"`, `"anthropic/claude-sonnet-4.6"`). The AI Gateway is the default provider when you pass a string to AI SDK functions.

**Why:** The current `api/ai.ts` has 2500+ lines with raw `fetch` calls to OpenAI scattered throughout each handler. The existing `OpenAIModelRouter` in `src/lib/ai/` is client-side and OpenAI-only. The AI Gateway provides unified routing, automatic failover, cost tracking, and observability out of the box.

**Approach:** Use the Vercel AI SDK (`ai` package) with plain string model identifiers. On Vercel, these automatically route through AI Gateway with failover, budgets, and monitoring. No need for separate provider SDKs (`@ai-sdk/openai`, `@ai-sdk/anthropic`) -- the gateway handles provider routing.

```typescript
// api/_lib/ai/providerRouter.ts
import { generateText } from 'ai'

export class AIProviderRouter {
  static async generate(taskContext: TaskContext, prompt: string) {
    const selection = this.selectModel(taskContext)
    
    const result = await generateText({
      model: selection.modelId,  // plain string routes through AI Gateway
      prompt,
      maxTokens: selection.maxTokens,
    })
    
    return {
      text: result.text,
      usage: result.usage,
      provider: selection.provider,
    }
  }

  private static selectModel(context: TaskContext): ModelSelection {
    // Tier gating
    if (context.userTier === 'free') {
      return { modelId: 'openai/gpt-5.4-mini', provider: 'openai', maxTokens: 2000 }
    }
    // Task-based routing -- vision tasks need GPT-5.4
    if (context.hasImages) {
      return { modelId: 'openai/gpt-5.4', provider: 'openai', maxTokens: 6000 }
    }
    // Complex reasoning benefits from Claude
    if (context.type === 'strategic-insights' && context.complexity === 'high') {
      return { modelId: 'anthropic/claude-sonnet-4.6', provider: 'anthropic', maxTokens: 8000 }
    }
    // Default -- cost-effective
    return { modelId: 'openai/gpt-5.4-mini', provider: 'openai', maxTokens: 3000 }
  }
}
```

**Key benefit:** AI Gateway provides automatic failover. If OpenAI is down, you can configure fallback to Anthropic at the gateway level without code changes. Cost tracking and usage monitoring come free through the Vercel dashboard.

**Confidence:** HIGH -- verified against official Vercel AI Gateway docs (March 2026). Model slug format `provider/model-name` with dots for version numbers confirmed (e.g., `openai/gpt-5.4`, `anthropic/claude-opus-4.6`).

### Pattern 2: Upload-Then-Analyze (Existing, Preserve It)

**What:** Client uploads file directly to Supabase Storage, then triggers server-side analysis by passing only the file ID.

**Why:** Vercel serverless functions have a 4.5MB request body limit. Audio/video files routinely exceed this. The existing pattern in `FileService.uploadFile()` already does this correctly -- upload to storage, insert metadata, then call `/api/ai?action=analyze-file` with just the ID.

**Do not change this pattern.** The current `handleAnalyzeFile` in `api/ai.ts` correctly fetches the file via signed URL server-side. Extend it, don't replace it.

### Pattern 3: Feature Flag Gated Rollout (Existing, Extend It)

**What:** Use `FEATURE_FLAGS` in `src/lib/config.ts` to gate new capabilities.

**Why:** Mobile brainstorm phases 2-5 already use this pattern. Multi-modal AI and collaboration features should follow the same approach for safe incremental rollout.

**Extend with:**
```typescript
MULTI_MODAL_AI: import.meta.env.VITE_MULTI_MODAL_AI === 'true',
MULTI_PROVIDER_ROUTING: import.meta.env.VITE_MULTI_PROVIDER_ROUTING === 'true',
PROJECT_COLLABORATION: import.meta.env.VITE_PROJECT_COLLABORATION === 'true',
```

### Pattern 4: Supabase Realtime Channel Strategy

**What:** Separate channels for separate concerns. Do not multiplex unrelated data on one channel.

**Why:** The existing `BrainstormRealtimeManager` already follows this -- it creates separate channels for ideas, participants, and session state. Extend this pattern for project-level collaboration.

**Channel structure:**
```
brainstorm:{sessionId}:ideas       -- idea CRUD (existing)
brainstorm:{sessionId}:participants -- join/leave (existing)  
brainstorm:{sessionId}:presence    -- typing, cursors (existing)
project:{projectId}:changes        -- idea updates outside brainstorm (new)
project:{projectId}:presence       -- who's viewing/editing (new)
project:{projectId}:files          -- file analysis status updates (new)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Moving MultiModalProcessor to the Client

**What:** Running image/audio/video analysis logic in the browser.

**Why bad:** API keys exposed to frontend. Whisper API requires file upload (not URL). GPT vision requires API key auth. The browser cannot safely hold provider keys.

**Instead:** Keep all AI provider calls server-side in Vercel functions. The frontend only sends file IDs and receives analysis results.

### Anti-Pattern 2: Passing Large Files Through Vercel Functions

**What:** Sending audio/video file bytes in the POST body to `/api/ai`.

**Why bad:** Vercel serverless functions have a 4.5MB request body limit. A 30-second audio file is ~500KB-5MB. Video files easily exceed this.

**Instead:** Upload to Supabase Storage first, then pass the file ID. The serverless function generates a signed URL and fetches directly. This is already the pattern -- do not regress.

### Anti-Pattern 3: Single Monolithic AI Handler

**What:** The current `api/ai.ts` is 2500+ lines handling all AI actions in one file.

**Why bad:** Hard to test, hard to maintain, hard to add providers. Adding Claude and MiniMax support will make it worse.

**Instead:** Extract each action into its own module under `api/_lib/ai/` and have `api/ai.ts` be a thin dispatcher. The existing action-routing switch statement makes this straightforward.

### Anti-Pattern 4: Polling for File Analysis Status

**What:** `setInterval` polling to check if file analysis is complete.

**Why bad:** Wastes client resources, adds latency (up to poll interval), scales poorly with many files.

**Instead:** Use Supabase Realtime postgres_changes on `project_files` table filtered by `project_id`. When `analysis_status` changes to 'completed', the client gets an instant push notification.

### Anti-Pattern 5: Creating Multiple Supabase Clients

**What:** Instantiating new `createClient()` in each serverless function handler.

**Why bad:** Already documented in the codebase as a known issue ("multiple GoTrueClient warnings"). Each creates a new connection.

**Instead:** Use a shared singleton pattern in `api/_lib/utils/supabaseAdmin.ts` (already exists). Ensure all new handlers import from there.

### Anti-Pattern 6: Using Provider-Specific SDKs Directly

**What:** Importing `@ai-sdk/openai` and `@ai-sdk/anthropic` and calling `openai('gpt-5.4')` or `anthropic('claude-sonnet-4.6')` directly in each handler.

**Why bad:** Bypasses AI Gateway's automatic failover, cost tracking, and observability. Requires managing multiple provider SDK versions and API keys per provider.

**Instead:** Use plain string model identifiers with AI SDK (`model: 'openai/gpt-5.4'`). On Vercel, this routes through AI Gateway automatically. Only use `@ai-sdk/gateway` if you need a custom gateway configuration.

## Component Build Order

This is the recommended build sequence based on dependency analysis. Each layer depends on layers above it being complete.

### Layer 1: Server-Side AI Provider Router (Foundation)

**Build:** `api/_lib/ai/providerRouter.ts`

**Why first:** Every multi-modal and multi-provider feature depends on this. The existing raw `fetch` pattern in `api/ai.ts` works but won't scale to multiple providers. Build the router, then migrate existing handlers to use it.

**Dependencies:** `ai` package (Vercel AI SDK)
**Enables:** All subsequent AI features

### Layer 2: Multi-Modal Analysis Handlers (Server-Side)

**Build:** Refactor `handleAnalyzeImage`, `handleTranscribeAudio`, `handleAnalyzeFile` to use AIProviderRouter

**Why second:** These handlers already exist and work. Refactoring them to use the provider router is low-risk and validates the router design.

**Dependencies:** Layer 1 (AIProviderRouter)
**Enables:** Frontend multi-modal UI

### Layer 3: Frontend MultiModalProcessor (Replace Placeholders)

**Build:** Replace placeholder implementations in `src/lib/multiModalProcessor.ts`

**Why third:** The interface is already defined. The server-side handlers from Layer 2 are ready. Now connect the frontend processor to call the real endpoints instead of returning placeholder strings.

**Dependencies:** Layer 2 (working server handlers)
**Enables:** AI insights with multi-modal context

### Layer 4: Real-Time Collaboration Infrastructure

**Build:** `CollabPresenceManager`, project-level realtime channels, file analysis status subscriptions

**Why fourth:** The brainstorm realtime infrastructure (BrainstormRealtimeManager) is already built and tested. Extending it to project-level collaboration follows the same patterns. This is independent of multi-modal AI and can potentially be parallelized with Layers 2-3.

**Dependencies:** Existing Supabase Realtime patterns
**Enables:** Multi-user editing, presence indicators

### Layer 5: Mobile Brainstorm Feature Flag Activation

**Build:** Enable and test phases 2-5 of mobile brainstorm

**Why fifth:** The code for all 5 phases already exists behind feature flags. This is primarily testing and bug-fixing work, not new development. It should come after collaboration infrastructure is solid.

**Dependencies:** Layer 4 (realtime collaboration working)
**Enables:** Mobile brainstorm as a complete feature

### Layer 6: Subscription Enforcement + Cost Controls

**Build:** Enforce AI usage limits per tier, add provider cost tracking via AI Gateway dashboard

**Why last in this sequence:** Enforcement depends on knowing which providers are being used and what they cost. The provider router (Layer 1) must be stable. AI Gateway provides built-in cost tracking and budget controls, reducing custom code needed.

**Dependencies:** Layer 1 (provider router), AI Gateway dashboard configuration, existing subscription service
**Enables:** Safe public launch with freemium gating

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| AI API calls | Direct calls via AI Gateway | Rate limiting per user, AI Gateway budgets | Job queue (Vercel KV or external), priority by tier |
| File storage | Supabase Storage (S3) | Same, add CDN for signed URLs | Same, add lifecycle rules for old files |
| Realtime connections | Single Supabase node | Connection pooling, channel cleanup | Read replicas, dedicated realtime cluster |
| Serverless cold starts | Negligible | Pre-warm critical functions | Edge functions for latency-sensitive routes |
| AI cost management | AI Gateway per-request tracking | AI Gateway budgets per team/project | Tiered queuing, cost caps, provider arbitrage via gateway |

## Technology Additions Required

| Technology | Purpose | Why This One |
|------------|---------|-------------|
| `ai` (Vercel AI SDK) | Multi-provider abstraction | Unified API for generateText, streamText, transcribe; plain string model IDs route through AI Gateway on Vercel |
| `@ai-sdk/gateway` (optional) | Custom gateway configuration | Only needed if custom base URL or API key management required; plain strings work by default |
| MiniMax SDK (TBD) | MiniMax 2.7 provider | Check if AI Gateway supports MiniMax natively; if not, use custom provider adapter or raw fetch wrapper |

**Not needed:** `@ai-sdk/openai`, `@ai-sdk/anthropic` as separate dependencies. AI Gateway handles provider routing when you use plain string model IDs like `'openai/gpt-5.4'` or `'anthropic/claude-sonnet-4.6'`.

**Not recommended:** OpenRouter as a proxy. AI Gateway already provides the same multi-provider routing without additional cost markup or latency.

## Sources

- [Vercel AI Gateway - Models & Providers](https://vercel.com/docs/ai-gateway/models-and-providers) -- plain string model IDs, gateway routing, failover, cost tracking
- [Vercel AI SDK Documentation](https://ai-sdk.dev/docs/introduction) -- generateText, streamText, transcribe, provider architecture
- [Vercel AI Gateway Overview](https://vercel.com/docs/ai-gateway) -- unified API, budget controls, monitoring
- [Supabase Realtime Architecture](https://supabase.com/docs/guides/realtime/architecture) -- channel patterns, presence, postgres changes
- [Vercel Serverless Function Body Size Limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) -- 4.5MB limit, direct upload workaround
- [OpenAI Whisper API](https://developers.openai.com/api/docs/guides/speech-to-text) -- 25MB file limit, supported formats
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations) -- payload limits, execution time
- [Supabase MVP Architecture Patterns 2026](https://www.valtorian.com/blog/supabase-mvp-architecture) -- postgres-first, RLS-first patterns

---

*Architecture analysis: 2026-04-06*
