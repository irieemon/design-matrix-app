# Prioritas

## What This Is

Prioritas is a collaborative prioritization tool that combines AI-powered multi-modal analysis with real-time brainstorming and a visual design matrix. Teams and individuals use it to brainstorm ideas, analyze them with AI across text, images, video, and audio, then prioritize them on an interactive matrix. Built with React, TypeScript, Supabase, and deployed on Vercel with a freemium billing model via Stripe.

## Core Value

Real-time collaborative brainstorming with AI-powered multi-modal analysis — teams can submit ideas from any device, analyze them with the right AI model for the task, and visually prioritize together on a shared matrix.

## Current State

**Shipped:** v1.0 — Launch Readiness (2026-04-09)
**Audit:** 36/43 v1 requirements complete + 2 partial = 88%, 5 deferred to v1.1
**Archive:** [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) | [.planning/v1.0-MILESTONE-AUDIT.md](v1.0-MILESTONE-AUDIT.md)

Prioritas is live with security hardening, AI SDK v6 + multi-provider routing, full multi-modal analysis (image/audio/voice/video), invitation-based collaboration, real Stripe billing enforcement, and mobile brainstorm polish. Real-time presence/voting/matrix-sync deferred to v1.1.

## Current Milestone: v1.1 — Advanced Collaboration & Quality

**Goal:** Finish the real-time collaboration experience deferred from v1.0 and close the quality-debt backlog. Stabilization only — no brand-new features.

**Target phases:**
- **05.4a** — Session-scope voting (dot-voting UI + realtime tallies + session presence)
- **05.4b** — Project-scope realtime matrix (presence, live cursors, drag lock, position sync)
- **05.5** — Quality debt closure (MOB-02 iOS verify, Playwright spec drift, invite E2E regression, pgTAP for Phase 05.3 migrations)

**Deferred to v1.2:**
- Production hardening: Resend domain verification, analyze-file CSRF race, AI Gateway project-wide migration

**Orchestration:** Eva + GSD hybrid (Eva routes pipeline agents, mirrors state into .planning/)

<details>
<summary>v1.0 requirements (archived)</summary>

### Validated

- ✓ Email/password authentication with session persistence — existing
- ✓ Supabase database with Row-Level Security — existing
- ✓ Design matrix with drag-and-drop idea positioning — existing
- ✓ Brainstorm session creation with join codes and QR codes — existing
- ✓ AI idea generation via OpenAI — existing
- ✓ AI insights and roadmap generation — existing
- ✓ PDF export for roadmaps and graphical insights — existing
- ✓ Stripe checkout session creation and webhook handling — existing
- ✓ Supabase Realtime with polling fallback for brainstorming — existing
- ✓ Admin analytics and audit logging — existing
- ✓ Error boundaries with retry logic — existing
- ✓ Structured logging (frontend + backend) — existing
- ✓ Content Security Policy headers — existing
- ✓ Optimistic updates for idea operations — existing
- ✓ Recharts-based reports and analytics page — existing

### Active

- [ ] Password reset flow (endpoint + UI)
- [ ] CSRF middleware applied to all state-changing API endpoints
- [ ] Rate limiting on admin, webhook, and auth endpoints
- [ ] Multi-modal AI: image analysis via GPT-4V
- [ ] Multi-modal AI: audio transcription via Whisper
- [ ] Multi-modal AI: video frame extraction and analysis
- [ ] Intelligent model router (OpenAI, Claude, MiniMax — right model per task)
- [ ] Stripe freemium feature gating enforced at API layer
- [ ] Payment failure handling and user notification
- [ ] Subscription limit enforcement (projects, AI usage, users)
- [ ] Real-time collaborative brainstorming (multi-user, synced state)
- [ ] Project collaboration: invite collaborators via email
- [ ] Collaborator permission levels (viewer, editor)
- [ ] Mobile brainstorm experience (enable and polish feature flag phases)
- [ ] Responsive UI across all pages (desktop + mobile)
- [ ] Admin dashboard with real stats (replace hardcoded zeros)
- [ ] Fix user tier hardcoding in AI insights service
- [ ] Fix refresh token cookie path issue
- [ ] Fix ideas.ts undefined error variable in catch block
- [ ] Remove or hide multi-modal placeholder returns (no fake data in production)

### Out of Scope

- Advanced admin panel (user creation/deletion, role assignment, bulk export) — only admin for now, basic visibility sufficient
- Offline support / service worker — adds significant complexity, not needed for initial web launch
- Search/filtering across projects — defer until user base grows and power users emerge
- 2FA / MFA — not required for v1, adds friction to onboarding
- Invoice / receipt system — Stripe handles this natively via customer portal
- OAuth login (Google, GitHub) — email/password sufficient for launch
- Dunning / payment retry automation — Stripe handles basic retry, custom logic deferred
- Video/audio file hosting — users upload for analysis only, no persistent media library

</details>

## Context

**Brownfield project** — substantial codebase (~100+ components, 20+ hooks, 10+ API routes) with working core features but gaps in security hardening, multi-modal AI integration, and collaboration completeness.

**Architecture**: React SPA (Vite) with Context providers, repository pattern for data access, Vercel serverless functions for API, Supabase for database + auth + realtime.

**Key existing patterns**: 
- Feature flags in `src/lib/config.ts` control mobile brainstorm phases (5 phases, currently disabled)
- Model router at `src/lib/ai/openaiModelRouter.ts` handles AI provider selection
- Multi-modal processor at `src/lib/multiModalProcessor.ts` has full interface but placeholder implementations
- Stripe integration has checkout + webhooks but no enforcement or failure handling
- CSRF middleware exists at `api/_lib/middleware/withCSRF.ts` but is never imported by any endpoint

**AI model strategy**: Use the right model for each task:
- GPT-4V for image/visual analysis
- Whisper for audio transcription
- OpenAI/Claude for text-based insights and idea generation
- MiniMax 2.7 as additional provider option
- Extend existing model router to support multi-provider routing

**Mobile context**: Mobile brainstorm is a key differentiator. Feature flags suggest phased rollout was planned. Phase 2 (realtime infra), Phase 3 (UI), Phase 4 (facilitator integration), Phase 5 (security/validation) need to be enabled and tested.

## Constraints

- **Timeline**: 2-4 weeks to public launch
- **Tech stack**: React + TypeScript + Vite + Supabase + Vercel (established, no migrations)
- **Billing**: Freemium model — free tier must be functional, paid tiers must gate features
- **Security**: Must fix CSRF, rate limiting, and password reset before any public access
- **AI costs**: Multi-modal analysis (vision, audio, video) is expensive — must enforce subscription limits
- **Mobile**: Brainstorming on phones is a key use case — not just responsive, genuinely usable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-model AI routing (OpenAI + Claude + MiniMax) | Different models excel at different tasks; user has subscriptions to multiple providers | — Pending |
| Cut advanced admin for v1 | Solo admin for launch; invest time in user-facing features instead | — Pending |
| Freemium billing model | Lower barrier to entry; validate product-market fit before requiring payment | — Pending |
| Desktop + mobile at launch | Mobile brainstorming is a core differentiator, not an afterthought | — Pending |
| Cut offline support | Web-first launch; offline adds architectural complexity disproportionate to value | — Pending |
| Feature flags for mobile phases | Existing pattern allows incremental enablement and testing | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after initialization*
