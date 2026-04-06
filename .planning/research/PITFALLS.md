# Domain Pitfalls

**Domain:** Multi-modal AI processing + real-time collaboration
**Researched:** 2026-04-06

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Vercel Serverless Timeout on Media Processing
**What goes wrong:** Video/audio files sent to Vercel serverless functions exceed the 60-second timeout (Pro) or 10-second timeout (Hobby). Function dies mid-processing.
**Why it happens:** Developers assume server-side processing is always correct. Video transcoding and long audio transcription are slow.
**Consequences:** Intermittent failures that work in dev (no timeout) but fail in production. Users see cryptic errors.
**Prevention:** Process video entirely client-side with ffmpeg.wasm. For audio, enforce 25MB limit (Whisper processes this in ~10-20 seconds). Add a 50-second server timeout safety check that returns a partial result or retry suggestion.
**Detection:** Monitor function duration in Vercel Analytics. Alert on any function approaching 50 seconds.

### Pitfall 2: Supabase Realtime Rate Limit Disconnects
**What goes wrong:** Broadcasting cursor positions too frequently (e.g., every mousemove at 60fps) exceeds Supabase rate limits. Clients get silently disconnected.
**Why it happens:** Cursor tracking feels natural at 60fps but Supabase limits are 20 msg/sec (free) or 50 msg/sec (pro).
**Consequences:** Random disconnects during collaboration sessions. supabase-js auto-reconnects but users see "who's online" flicker. Presence state may be lost.
**Prevention:** Debounce ALL broadcast messages to 100ms minimum (10 msg/sec max). Use `requestAnimationFrame` for cursor rendering but throttle the actual broadcast. Test with multiple concurrent users to validate.
**Detection:** Log Supabase channel errors. Monitor for `CHANNEL_ERROR` and `TIMED_OUT` events in the realtime subscription callbacks.

### Pitfall 3: AI SDK Migration Breaks Existing AI Features
**What goes wrong:** Replacing the existing OpenAI direct calls with AI SDK changes response formats, error handling, or streaming behavior. Existing AI insights, idea generation, and roadmap features break silently.
**Why it happens:** AI SDK wraps provider responses in its own format. Error shapes differ. Streaming protocol may differ from what the frontend expects.
**Consequences:** Regression in working features. Users lose AI idea generation or insights during the migration.
**Prevention:** Migrate incrementally. Start with NEW endpoints (transcription, vision analysis) using AI SDK. Only migrate existing endpoints after new ones are stable. Write integration tests that verify response shapes match what the frontend consumes.
**Detection:** E2E tests for all AI-powered features: idea generation, insights, roadmap generation. Run before and after migration.

### Pitfall 4: ffmpeg.wasm CORS and SharedArrayBuffer Issues
**What goes wrong:** ffmpeg.wasm multi-threaded mode requires `SharedArrayBuffer`, which requires specific CORS headers (`Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`). These headers break third-party scripts (Stripe, Vercel Analytics, EmailJS).
**Why it happens:** Browser security policy. SharedArrayBuffer was restricted after Spectre vulnerability.
**Consequences:** Either ffmpeg.wasm multi-threaded mode doesn't work, or Stripe checkout breaks, or Vercel Analytics stops reporting.
**Prevention:** Use the SINGLE-THREAD core (`@ffmpeg/core`, NOT `@ffmpeg/core-mt`). Single-thread mode does NOT require SharedArrayBuffer. Frame extraction from a 30-second video takes ~5-10 seconds single-threaded, which is acceptable. Avoid the multi-threaded core entirely.
**Detection:** Test video frame extraction in production (not just localhost) before shipping. Verify Stripe checkout still works after adding ffmpeg.wasm.

## Moderate Pitfalls

### Pitfall 5: Audio Recording Format Incompatibility
**What goes wrong:** `MediaRecorder` produces different formats across browsers/devices. Safari may produce `audio/mp4`, Chrome produces `audio/webm`. Whisper supports both but the MIME type must be correctly detected.
**Prevention:** Always specify `mimeType: 'audio/webm;codecs=opus'` in MediaRecorder options. Fall back to `audio/mp4` if webm is not supported (`MediaRecorder.isTypeSupported()`). Pass the correct file extension to Whisper API (it infers format from extension).

### Pitfall 6: Presence State Grows Without Cleanup
**What goes wrong:** Presence payloads accumulate stale entries when clients disconnect without proper cleanup (e.g., browser crash, network loss).
**Why it happens:** Presence relies on heartbeats. If a client dies without unsubscribing, Supabase takes ~30 seconds to detect the disconnect and remove the presence entry.
**Prevention:** Set reasonable heartbeat interval. Add a client-side "last seen" timestamp and filter out stale entries older than 60 seconds on the display layer. Accept that presence is eventually consistent, not immediately consistent.

### Pitfall 7: AI Cost Explosion from Uncapped Vision Requests
**What goes wrong:** Image analysis via GPT-5 vision is significantly more expensive than text-only requests. A user uploading 50 images without limits racks up substantial API costs.
**Prevention:** Enforce per-request and per-session limits at the API layer BEFORE calling any AI provider. Free tier: 5 image analyses per project. Pro: 50. Enterprise: 200. Check quota in subscription service before processing.

### Pitfall 8: Multiple Supabase Client Instances
**What goes wrong:** The existing codebase warns about "multiple GoTrueClient" instances. Adding new realtime subscriptions in new components may create additional Supabase client instances.
**Prevention:** Use the SINGLE shared Supabase client from `src/lib/supabase.ts`. Never call `createClient()` in component files. The collaboration layer should receive the client via context or props, not create its own.

## Minor Pitfalls

### Pitfall 9: Large Base64 Image Payloads
**What goes wrong:** Encoding images as base64 for the vision API increases payload size by ~33%. Combined with Vercel's request body limits, large images may fail.
**Prevention:** Resize images client-side before analysis (max 2048px on longest edge -- GPT-5 vision downscales anyway). For images in Supabase Storage, pass the public URL instead of base64 when possible.

### Pitfall 10: Optimistic Updates Conflict with Realtime
**What goes wrong:** The existing optimistic update pattern for ideas creates a race condition with realtime updates. User creates idea optimistically, then receives the same idea via realtime subscription, causing a duplicate.
**Prevention:** Deduplicate incoming realtime events against pending optimistic updates using idea ID. The optimistic update should set a "pending" flag that the realtime handler checks before inserting.

### Pitfall 11: MiniMax Provider Limitations
**What goes wrong:** MiniMax provider does NOT support image input. Routing an image analysis task to MiniMax silently fails or returns an error.
**Prevention:** The model router MUST check for image/audio content in the task context and NEVER route to MiniMax for multi-modal tasks. MiniMax is text-only. Add a capability check: `if (hasImages || hasAudio) -> exclude MiniMax from candidates`.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| AI SDK integration | Pitfall 3 (migration regression) | Migrate new features first, existing features last. Full E2E test suite. |
| Image analysis | Pitfall 9 (large payloads) | Client-side resize. Use URLs not base64 where possible. |
| Audio transcription | Pitfall 1 (timeout), Pitfall 5 (format compat) | Enforce 25MB limit. Detect MIME type. Test on Safari. |
| Video processing | Pitfall 4 (CORS/SharedArrayBuffer) | Use single-thread ffmpeg core ONLY. Test in production. |
| Real-time collaboration | Pitfall 2 (rate limits), Pitfall 6 (stale presence) | Debounce 100ms. Filter stale entries. Load test. |
| Subscription enforcement | Pitfall 7 (cost explosion) | Quota checks BEFORE AI calls. Per-feature limits. |
| Mobile brainstorm | Pitfall 5 (audio format) | Test on iOS Safari, Android Chrome. MediaRecorder polyfill if needed. |
| Multi-provider routing | Pitfall 11 (MiniMax limitations) | Capability-based routing, not just cost-based. |

## Sources

- [Vercel Function Limits](https://vercel.com/docs/functions/limitations) - Timeout constraints
- [Supabase Realtime Rate Limits](https://supabase.com/docs/guides/realtime/limits) - Connection and message limits
- [ffmpeg.wasm SharedArrayBuffer requirements](https://ffmpegwasm.netlify.app/docs/overview/) - CORS header requirements
- [OpenAI Whisper file limits](https://platform.openai.com/docs/guides/speech-to-text) - 25MB, supported formats
- [Supabase Presence docs](https://supabase.com/docs/guides/realtime/presence) - Heartbeat and cleanup behavior
- [AI SDK MiniMax provider](https://ai-sdk.dev/providers/community-providers/minimax) - Supported capabilities (no image input)
- [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) - Browser compatibility
- Existing codebase warnings (CLAUDE.md: "multiple GoTrueClient warnings")

---

*Pitfall research: 2026-04-06*
