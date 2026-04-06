# Research Summary: Prioritas Multi-Modal AI & Real-Time Collaboration

**Domain:** Collaborative prioritization tool with multi-modal AI processing
**Researched:** 2026-04-06
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

The existing Prioritas codebase has solid scaffolding for multi-modal AI and collaboration -- the `MultiModalProcessor` class defines the right interfaces and the `OpenAIModelRouter` has working complexity analysis -- but all multi-modal implementations are placeholders. The path forward is clear: adopt the Vercel AI SDK v6 as the unified provider layer, implement vision analysis through GPT-5's native image understanding, use OpenAI Whisper for audio transcription, and extract video frames client-side with ffmpeg.wasm to avoid serverless timeout constraints.

The real-time collaboration layer is the lowest-risk addition because Supabase Realtime (Broadcast + Presence) is already integrated for brainstorm sessions. Extending it to support multi-user cursor tracking and live idea syncing requires configuration and UX work, not new infrastructure. The `perfect-cursors` library solves the cursor interpolation problem cleanly.

The highest-risk area is the AI SDK migration. The existing codebase makes direct OpenAI SDK calls throughout `api/ai.ts` and the AI services layer. Migrating to AI SDK must happen incrementally -- new features first, existing features last -- to avoid regression in working AI functionality. The MiniMax community provider adds a third AI vendor but has a critical limitation: no image input support, so it must be excluded from vision routing.

Cost control is a strategic concern. Multi-modal AI (especially vision) is significantly more expensive than text-only. The subscription enforcement layer (currently incomplete) must be wired up BEFORE shipping multi-modal features to production, or a single power user on the free tier could generate substantial API costs.

## Key Findings

**Stack:** AI SDK v6 (`ai` ^6.0.146) as unified provider layer with `@ai-sdk/openai`, `@ai-sdk/anthropic`, and `vercel-minimax-ai-provider`. ffmpeg.wasm for client-side video processing. Whisper via direct OpenAI SDK (not AI SDK).

**Architecture:** Client-side media processing (ffmpeg.wasm, MediaRecorder) feeding into serverless AI endpoints. Supabase Realtime for collaboration with debounced broadcasts. No new infrastructure services needed.

**Critical pitfall:** ffmpeg.wasm multi-threaded mode requires CORS headers that break Stripe and third-party scripts. MUST use single-threaded core only.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **AI SDK Foundation** - Integrate AI SDK, refactor model router, add multi-provider support
   - Addresses: Multi-provider routing, AI SDK infrastructure
   - Avoids: Migration regression (Pitfall 3) by doing foundation first
   - Rationale: Everything else depends on the AI calling layer being solid

2. **Image Analysis** - GPT-5 vision integration for image upload and analysis
   - Addresses: Image analysis (table stakes), OCR via vision
   - Avoids: Large payload issues (Pitfall 9) with client-side resize
   - Rationale: Simplest multi-modal capability, highest user-visible impact

3. **Audio & Voice-to-Idea** - Whisper transcription + mobile voice recording
   - Addresses: Audio transcription, voice-to-idea pipeline (key differentiator)
   - Avoids: Timeout issues (Pitfall 1), format incompatibility (Pitfall 5)
   - Rationale: Mobile differentiator; depends on AI SDK foundation

4. **Real-Time Collaboration** - Presence, broadcast, cursor tracking, live sync
   - Addresses: Multi-user presence, real-time idea sync, collaborative matrix
   - Avoids: Rate limit disconnects (Pitfall 2), stale presence (Pitfall 6)
   - Rationale: Can be built in parallel with AI features; extends existing realtime

5. **Video Analysis** - ffmpeg.wasm frame extraction + vision analysis
   - Addresses: Video frame analysis (differentiator)
   - Avoids: CORS/SharedArrayBuffer issues (Pitfall 4), serverless timeout
   - Rationale: Highest complexity, lowest priority for launch. Defer if timeline tight.

6. **Subscription Enforcement & Mobile Polish** - Usage quotas, cost controls, mobile UX
   - Addresses: Subscription gating, AI cost control, mobile brainstorm UX
   - Avoids: Cost explosion (Pitfall 7)
   - Rationale: MUST ship before public launch but can be hardened last

**Phase ordering rationale:**
- AI SDK foundation unblocks all AI features (image, audio, video)
- Image analysis before audio because it requires no client-side recording complexity
- Audio before video because voice-to-idea is the key mobile differentiator
- Collaboration can run in parallel with AI phases (different code paths)
- Video is highest complexity, lowest launch priority -- defer if needed
- Subscription enforcement gates everything but must be last to capture all feature quotas

**Research flags for phases:**
- Phase 1 (AI SDK): Needs careful migration testing. Verify AI SDK response format compatibility with existing frontend consumers.
- Phase 4 (Collaboration): May need deeper research on conflict resolution for simultaneous idea position updates (optimistic update vs. realtime race condition).
- Phase 5 (Video): ffmpeg.wasm single-thread performance should be benchmarked with real video files before committing.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (AI SDK) | HIGH | Versions verified on npm. AI SDK is well-documented, 20M+ monthly downloads. Official Vercel product. |
| Stack (ffmpeg.wasm) | MEDIUM | Library is stable but last release was Jan 2025. Single-thread mode untested for this specific use case. CORS pitfall is well-documented. |
| Stack (MiniMax) | MEDIUM | Community provider, not first-party. Verified on ai-sdk.dev but "latest" version pinning is fragile. |
| Features | HIGH | Table stakes are clear from competitive analysis. Differentiators map to existing codebase TODOs. |
| Architecture | HIGH | Follows existing patterns (serverless functions, Supabase Realtime). No new infrastructure. |
| Pitfalls | HIGH | Based on verified platform limits (Vercel timeouts, Supabase rate limits) and documented library constraints (SharedArrayBuffer, Whisper file limits). |

## Gaps to Address

- **AI SDK streaming format:** Need to verify that AI SDK's streaming response format is compatible with the existing frontend consumption pattern (the current code likely uses OpenAI's streaming format directly).
- **ffmpeg.wasm bundle size:** The WASM binary is large (~25MB). Need to verify it can be lazy-loaded and doesn't impact initial page load.
- **Supabase Realtime at scale:** Rate limits documented but need load testing with 10+ concurrent users to validate debounce strategy.
- **MiniMax M2.7 pricing:** Not verified. Need to confirm pricing is competitive enough to justify as a third provider.
- **iOS Safari MediaRecorder:** WebM recording may not be supported on all iOS versions. Need to test fallback to MP4.

## Files Created

| File | Purpose |
|------|---------|
| `.planning/research/SUMMARY.md` | This file -- executive summary with roadmap implications |
| `.planning/research/STACK.md` | Technology recommendations with versions and rationale |
| `.planning/research/FEATURES.md` | Feature landscape: table stakes, differentiators, anti-features |
| `.planning/research/ARCHITECTURE.md` | System structure, component boundaries, data flows |
| `.planning/research/PITFALLS.md` | Domain pitfalls with prevention strategies |

---

*Research summary: 2026-04-06*
