# Technology Stack

**Project:** Prioritas - Multi-Modal AI & Real-Time Collaboration Milestone
**Researched:** 2026-04-06

## Recommended Stack

This document covers NEW additions to the existing stack (React 18, TypeScript 5.2, Vite 5, Supabase, Vercel). The existing stack is not re-evaluated here.

### Multi-Provider AI Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `ai` (AI SDK Core) | ^6.0.146 | Unified AI provider interface, text/image generation, streaming | Replaces hand-rolled model router. Single API for OpenAI, Anthropic, MiniMax. Built-in streaming, tool calling, structured output. 20M+ monthly downloads. Works in Vercel serverless functions natively. | HIGH |
| `@ai-sdk/openai` | ^3.0.50 | OpenAI provider (GPT-5, GPT-5-mini, Whisper, vision) | First-class AI SDK provider. Handles vision (image input), audio transcription via OpenAI API. Actively maintained (last publish: days ago). | HIGH |
| `@ai-sdk/anthropic` | ^3.0.66 | Anthropic provider (Claude 4, Claude 4 Sonnet) | First-class AI SDK provider. Already have `ANTHROPIC_API_KEY` in env. Includes memory tool, code execution support in SDK v6. | HIGH |
| `vercel-minimax-ai-provider` | latest | MiniMax provider (M2.7) for AI SDK | Community provider but officially listed on ai-sdk.dev. Supports both Anthropic-compatible and OpenAI-compatible API formats. Note: image input NOT supported on MiniMax -- use for text tasks only. | MEDIUM |

**Why AI SDK instead of keeping the hand-rolled router:**
- The existing `OpenAIModelRouter` is a static class that only routes to OpenAI models. It does not actually call any API -- it just selects model names and parameters.
- AI SDK provides the actual unified calling interface across providers, with streaming, retries, and structured output built in.
- The existing router's model selection logic (complexity scoring, task-type routing) can be preserved as a thin wrapper that maps `TaskContext` to AI SDK provider + model calls.
- AI SDK v6 has agents abstraction, MCP support, and DevTools -- all useful as the product matures.

### Multi-Modal Processing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| OpenAI Vision (via `@ai-sdk/openai`) | - | Image analysis | GPT-5 and GPT-4o both support vision natively. Pass images as base64 or URL in the message content array. No separate "GPT-4V" model needed -- all current OpenAI flagship models support image input. | HIGH |
| OpenAI Whisper API (via `openai` SDK) | - | Audio transcription | Whisper-1 model. 25MB file limit, supports mp3/mp4/mpeg/mpga/m4a/wav/webm. Call via `openai.audio.transcriptions.create()`. AI SDK does not wrap Whisper directly -- use the OpenAI Node SDK you already have installed. | HIGH |
| `@ffmpeg/ffmpeg` | ^0.12.15 | Browser-side video frame extraction | WebAssembly FFmpeg runs entirely in-browser. Extract key frames from uploaded video before sending to vision API. No server-side video processing needed (avoids Vercel function timeout issues). | MEDIUM |
| `@ffmpeg/core` | ^0.12.x | FFmpeg WASM core binary | Required companion to @ffmpeg/ffmpeg. Single-thread core is sufficient for frame extraction. | MEDIUM |

**Image analysis approach:**
- Use AI SDK `generateText` with image content parts. All modern OpenAI models (GPT-5, GPT-5-mini) accept images natively.
- Pass images as base64-encoded data URLs or Supabase Storage public URLs.
- For OCR needs, GPT-5 vision handles text extraction from images without a separate OCR service.

**Audio transcription approach:**
- Use OpenAI's `openai.audio.transcriptions.create()` directly (not through AI SDK, which doesn't wrap this endpoint).
- Critical constraint: Vercel serverless functions have a 60-second timeout on Pro plan. Whisper processes most files under 25MB well within this, but implement a 50-second client timeout with retry.
- File size limit: 25MB. For larger files, chunk on the client side before upload.
- Record audio in browser using `MediaRecorder` API (native, no library needed) with `audio/webm` format.

**Video frame extraction approach:**
- Extract frames CLIENT-SIDE using ffmpeg.wasm to avoid Vercel serverless timeout issues entirely.
- Extract 3-5 key frames at even intervals from the video.
- Send extracted frame images to GPT-5 vision for analysis.
- Audio track: extract and send separately to Whisper for transcription.
- This keeps video processing off the server entirely -- Vercel functions never touch the video file.

### Real-Time Collaboration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase Realtime Broadcast | (existing) | Ephemeral messages between clients | Already used for brainstorm sessions. Low-latency pub/sub. Use for cursor positions, typing indicators, idea card movements. | HIGH |
| Supabase Realtime Presence | (existing) | User online/offline state, active users | Already available via Supabase SDK. Track who's in a session, show avatars, handle disconnect gracefully. CRDT-backed in-memory key-value store. | HIGH |
| `perfect-cursors` | ^1.0.5 | Smooth cursor interpolation | Solves the "jumping cursor" problem when Supabase throttles updates to ~50-80ms intervals. Created by tldraw author. Tiny library, does one thing well. | MEDIUM |

**Collaboration architecture:**
- Supabase Broadcast for cursor positions, idea card drag events, and ephemeral state (debounce at 100ms).
- Supabase Presence for user roster (who's online, who's editing what).
- Supabase Postgres Changes for persistent state (new ideas, idea updates, position changes).
- Rate limits: Free plan = 20 msg/sec, Pro plan = 50 msg/sec. Debounce cursor updates to stay within limits.
- Pricing: $2.50 per million messages. Budget for this in subscription tier design.

### Mobile Optimization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Native `MediaRecorder` API | (browser) | Audio recording for voice brainstorm | No library needed. Supported in all modern mobile browsers. Record in webm/opus format, send to Whisper. | HIGH |
| Native `navigator.mediaDevices` | (browser) | Camera capture for image brainstorm | getUserMedia for photo capture on mobile. No library needed. | HIGH |
| `@dnd-kit` touch support | (existing) | Touch drag-and-drop on matrix | Already installed. Has built-in touch sensor support. Verify touch activation delay is appropriate for mobile. | HIGH |

**Why no additional mobile libraries:**
- The existing stack (React + Tailwind + dnd-kit) already supports mobile well.
- Browser native APIs (MediaRecorder, getUserMedia, Touch Events) handle media capture.
- The main mobile work is UI/UX polish (feature flag phases 3-5), not new dependencies.

## What NOT to Use

| Technology | Why Not | Use Instead |
|------------|---------|-------------|
| Tesseract.js (OCR) | GPT-5 vision does OCR better with context understanding. Tesseract is accuracy-limited and adds 10MB+ to bundle. | GPT-5 vision for text extraction from images |
| Google Cloud Vision API | Additional provider, additional API key, additional cost. OpenAI vision handles all use cases for this product. | OpenAI vision via AI SDK |
| Liveblocks / Yjs / Partykit | Adds a separate realtime infrastructure when Supabase Realtime already provides Broadcast + Presence + DB changes. Would require syncing two realtime systems. | Supabase Realtime (already integrated) |
| Server-side FFmpeg (Lambda/Cloud Run) | Vercel function timeout (60s) makes server-side video processing fragile. Requires additional infrastructure. | @ffmpeg/ffmpeg (browser-side WASM) |
| `openai` SDK for text generation | Locks you into OpenAI only. The existing codebase already imports it, but new multi-provider code should use AI SDK. | AI SDK with @ai-sdk/openai provider |
| OpenRouter | Adds another service and API key. AI SDK already provides multi-provider routing natively with direct provider packages. | AI SDK direct providers |
| Next.js | Project is Vite SPA. Migration would be a rewrite, not an enhancement. AI SDK works fine with Vite + Vercel serverless. | Keep Vite SPA |
| React 19 | Major migration risk for a brownfield project on a 2-4 week timeline. React 18 is fully supported. | Stay on React 18.2 |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| AI Provider Routing | AI SDK v6 | LangChain.js | LangChain is heavyweight, opinionated, adds significant bundle size. AI SDK is purpose-built for this exact use case and maintained by Vercel (deployment platform match). |
| Audio Transcription | OpenAI Whisper API | Deepgram, AssemblyAI | Additional provider accounts and API keys. Whisper is already accessible through existing OpenAI key. Quality is comparable for general transcription. |
| Video Processing | ffmpeg.wasm (client) | Shotstack API, AWS MediaConvert | External services add cost and complexity. Client-side extraction is free, fast for frame extraction, and avoids serverless timeout issues. |
| Cursor Smoothing | perfect-cursors | Custom spring animation | Solved problem. Library is 2KB. Writing custom interpolation is unnecessary work. |
| Multi-provider MiniMax | vercel-minimax-ai-provider | Direct REST API calls | AI SDK community provider gives consistent interface. If it breaks, falling back to REST is simple. |

## Installation

```bash
# AI SDK core + providers (NEW)
npm install ai @ai-sdk/openai @ai-sdk/anthropic vercel-minimax-ai-provider

# Video frame extraction (NEW)
npm install @ffmpeg/ffmpeg @ffmpeg/core

# Cursor smoothing for collaboration (NEW)
npm install perfect-cursors

# No new dev dependencies needed
```

**Environment variables to add:**

```bash
# Already present
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=

# New
MINIMAX_API_KEY=           # MiniMax M2.7 API key (backend only)
```

## Migration Path from Existing Code

### Model Router Migration

The existing `OpenAIModelRouter` class should be refactored into a thin adapter:

1. Keep the `TaskContext` interface and `analyzeComplexity` logic.
2. Replace `ModelSelection` return type with AI SDK provider + model selection.
3. Instead of returning model name strings, return actual AI SDK provider instances:
   - `openai('gpt-5')`, `anthropic('claude-sonnet-4-20250514')`, `minimax('MiniMax-M2')`.
4. Cost estimation logic stays (useful for subscription limit enforcement).

### Multi-Modal Processor Migration

The existing `MultiModalProcessor` class has the right interfaces but placeholder implementations:

1. Replace image processing TODOs with AI SDK `generateText` + image content parts.
2. Replace audio processing TODOs with direct `openai.audio.transcriptions.create()` calls.
3. Replace video processing TODOs with ffmpeg.wasm frame extraction + vision analysis.
4. The `MultiModalContext` and `ProcessedFileContent` interfaces are well-designed -- keep them.

## Version Verification

| Package | Version | Verified Via | Date |
|---------|---------|-------------|------|
| `ai` | ^6.0.146 | npm registry (WebSearch) | 2026-04-06 |
| `@ai-sdk/openai` | ^3.0.50 | npm registry (WebSearch) | 2026-04-06 |
| `@ai-sdk/anthropic` | ^3.0.66 | npm registry (WebSearch) | 2026-04-06 |
| `vercel-minimax-ai-provider` | latest | ai-sdk.dev community providers page | 2026-04-06 |
| `@ffmpeg/ffmpeg` | ^0.12.15 | npm registry (WebSearch) | 2026-04-06 |
| `perfect-cursors` | ^1.0.5 | npm registry (WebSearch) | 2026-04-06 |

## Sources

- [AI SDK Documentation](https://ai-sdk.dev/docs) - Official docs, verified redirect from sdk.vercel.ai
- [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6) - Feature overview, agents, multi-modal
- [AI SDK MiniMax Community Provider](https://ai-sdk.dev/providers/community-providers/minimax) - Installation, configuration
- [OpenAI Speech-to-Text Guide](https://platform.openai.com/docs/guides/speech-to-text) - Whisper API reference
- [OpenAI Images and Vision](https://platform.openai.com/docs/guides/images-vision) - Vision model capabilities
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime) - Broadcast, Presence, rate limits
- [Supabase Realtime Pricing](https://supabase.com/docs/guides/realtime/pricing) - Message-based pricing model
- [Supabase Presence](https://supabase.com/docs/guides/realtime/presence) - CRDT presence state
- [ffmpeg.wasm GitHub](https://github.com/ffmpegwasm/ffmpeg.wasm) - Browser-side video processing
- [perfect-cursors GitHub](https://github.com/steveruizok/perfect-cursors) - Cursor interpolation library
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) - Multi-provider routing at infrastructure level
- [@ai-sdk/openai npm](https://www.npmjs.com/package/@ai-sdk/openai) - Version verification
- [@ai-sdk/anthropic npm](https://www.npmjs.com/package/@ai-sdk/anthropic) - Version verification
- [@ffmpeg/ffmpeg npm](https://www.npmjs.com/package/@ffmpeg/ffmpeg) - Version verification

---

*Stack research: 2026-04-06*
