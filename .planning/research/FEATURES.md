# Feature Landscape

**Domain:** Collaborative prioritization tool with multi-modal AI
**Researched:** 2026-04-06

## Table Stakes

Features users expect once multi-modal AI and collaboration are advertised. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Image upload + AI analysis | Core multi-modal promise. Users upload screenshots, mockups, diagrams and get AI insights. | Medium | GPT-5 vision via AI SDK. Supabase Storage already handles uploads. |
| Audio recording + transcription | Voice brainstorming is the key mobile differentiator. Must work on phone. | Medium | Browser MediaRecorder + Whisper API. 25MB limit = ~25 min of webm audio. |
| Multi-user presence indicators | "Who's in this session?" is expected in any collaborative tool. | Low | Supabase Presence. Show avatars, online dots. |
| Real-time idea sync | When one user adds an idea, all participants see it immediately. | Low | Already partially built with Supabase Realtime + polling fallback. Needs hardening. |
| Mobile-friendly brainstorm UI | If mobile brainstorm is a feature, it must actually work on phones. | Medium | Feature flag phases 3-5 in existing code. Touch targets, viewport handling. |
| Subscription-gated AI usage | Free tier must have limits. Paid users expect clear quotas. | Medium | Existing subscription service needs enforcement at API layer. |
| Model selection transparency | Users should know which AI model analyzed their content (builds trust). | Low | Display model name in AI response cards. |

## Differentiators

Features that set Prioritas apart from generic brainstorm/prioritization tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Voice-to-idea on mobile | Speak an idea, AI transcribes and adds to matrix. Zero typing. | Medium | MediaRecorder -> Whisper -> idea creation pipeline. Killer mobile UX. |
| Video frame analysis | Upload a product demo video, AI extracts and analyzes key frames. | High | ffmpeg.wasm frame extraction + GPT-5 vision. Impressive but complex. |
| Multi-provider model routing | Right model for each task. Claude for nuanced analysis, GPT-5 for vision, MiniMax for cost-effective text. | Medium | AI SDK makes this architecturally clean. Existing complexity scoring logic applies. |
| Live collaborative matrix | Multiple users drag ideas simultaneously with real-time cursor tracking. | High | Supabase Broadcast + Presence + conflict resolution for position updates. |
| AI model cost optimization | Automatically route to cheaper models for simple tasks, expensive for complex. | Low | Existing complexity analyzer + AI SDK provider switching. |
| Facilitator mode | One user drives the session, controls pacing, locks/unlocks matrix areas. | Medium | Permissions layer on top of realtime. Feature flag phase 4. |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Persistent media library | Users upload for analysis only, not storage. Hosting video/audio long-term is expensive. | Temporary upload -> process -> delete after session. Keep analysis results only. |
| Real-time co-editing of idea text | Complex CRDT/OT problem. Overkill for idea cards with short text. | Lock-on-edit: when one user edits an idea, others see "being edited" indicator. |
| Custom AI model fine-tuning | Way beyond scope. Requires ML ops infrastructure. | Use prompt engineering with the existing models. |
| Offline mode | Architectural complexity is disproportionate to value for a collaborative tool (collaboration requires connectivity). | Show clear "reconnecting..." state. Queue actions during brief disconnects. |
| AI-generated images | Image generation is a different product. Prioritas analyzes, it does not create. | Only support image analysis (vision), not generation. |
| Video call / screen sharing | Turns product into a meeting tool. Different market entirely. | Link to external meeting tools. Focus on async + quick-sync collaboration. |

## Feature Dependencies

```
Audio Recording (MediaRecorder) -> Audio Transcription (Whisper) -> Voice-to-Idea Pipeline
Image Upload (Supabase Storage) -> Image Analysis (GPT-5 Vision) -> AI Insights Enhancement
Video Upload -> Frame Extraction (ffmpeg.wasm) -> Frame Analysis (GPT-5 Vision)
                                                -> Audio Extraction -> Transcription (Whisper)
AI SDK Integration -> Multi-Provider Routing -> Model Cost Optimization
Supabase Presence -> User Roster -> Facilitator Mode
Supabase Broadcast -> Cursor Sync -> Live Collaborative Matrix
Subscription Enforcement -> AI Usage Gating -> All AI features
```

## MVP Recommendation

**Prioritize (must ship):**
1. AI SDK integration replacing hand-rolled router (unblocks everything)
2. Image analysis via GPT-5 vision (simplest multi-modal win)
3. Audio transcription via Whisper (mobile differentiator)
4. Voice-to-idea pipeline (connects audio to core product)
5. Multi-user presence indicators (low effort, high collaboration feel)
6. Real-time idea sync hardening (already partially built)
7. Subscription-gated AI usage (required before public launch)

**Defer (nice to have):**
- Video frame analysis: High complexity, impressive but not essential for launch
- Live collaborative cursor tracking: Polished UX but presence indicators cover 80% of the value
- Facilitator mode: Important for team adoption but can ship post-launch

## Sources

- Existing codebase analysis (PROJECT.md, multiModalProcessor.ts, openaiModelRouter.ts)
- [OpenAI Vision capabilities](https://platform.openai.com/docs/guides/images-vision)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [Supabase Realtime features](https://supabase.com/docs/guides/realtime)

---

*Feature research: 2026-04-06*
