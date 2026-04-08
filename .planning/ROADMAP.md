# Roadmap: Prioritas

## Overview

Prioritas goes from a working-but-incomplete brownfield app to a launch-ready collaborative prioritization tool across seven phases. Security and production bugs are fixed first to establish a safe baseline. Then the AI calling layer is rebuilt on AI SDK v6 to unblock all multi-modal features. Image analysis ships first (simplest, highest impact), followed by audio and voice-to-idea (mobile differentiator). Real-time collaboration extends the existing Supabase Realtime infrastructure. Billing enforcement captures all feature quotas before launch. Finally, mobile polish and video analysis complete the full multi-modal vision.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Security Hardening & Production Fixes** - Fix security gaps, bugs, and admin placeholders before exposing new endpoints
- [ ] **Phase 2: AI SDK Foundation** - Rebuild AI calling layer on AI SDK v6 with multi-provider routing
- [ ] **Phase 3: Image Analysis** - Enable image upload with AI-powered visual analysis and OCR
- [ ] **Phase 4: Audio & Voice-to-Idea** - Enable audio transcription and mobile voice-to-idea pipeline
- [ ] **Phase 5: Real-Time Collaboration** - Multi-user presence, live idea sync, voting, and project invitations
- [ ] **Phase 6: Billing & Subscription Enforcement** - Enforce usage limits, payment failure handling, and usage dashboards
- [ ] **Phase 7: Mobile Polish & Video Analysis** - Complete mobile experience and ship video frame analysis

## Phase Details

### Phase 1: Security Hardening & Production Fixes
**Goal**: The application is safe for public access with no security gaps, no fake data, and no production bugs
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, SEC-09, SEC-10, ADMIN-01, ADMIN-02
**Success Criteria** (what must be TRUE):
  1. User can reset a forgotten password via email link and log in with the new password
  2. All state-changing API endpoints reject requests without valid CSRF tokens
  3. Auth, AI, admin, and webhook endpoints return 429 when rate limits are exceeded
  4. No API endpoint returns placeholder or fake data (multi-modal stubs removed, admin shows real stats)
  5. Subscription service denies access on errors instead of granting unlimited access
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Apply CSRF and rate limiting middleware to all API endpoints
- [x] 01-02-PLAN.md -- Fix five production bugs (crash, cookie path, fail-open, hardcoded tier, placeholders)
- [ ] 01-03-PLAN.md -- Complete password reset flow and build admin dashboard with real stats

### Phase 2: AI SDK Foundation
**Goal**: All AI features run through AI SDK v6 with multi-provider routing and no regressions in existing functionality
**Depends on**: Phase 1
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05
**Success Criteria** (what must be TRUE):
  1. Existing AI features (idea generation, insights, roadmap) produce identical results through the new AI SDK layer
  2. Model router selects the appropriate provider (OpenAI, Anthropic, MiniMax) based on task capability requirements
  3. Vision-capable tasks route only to vision-capable models; text tasks can route to any provider
  4. The monolithic api/ai.ts is replaced by modular handlers under api/_lib/ai/ with no functional regression
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Install AI SDK, create provider factory, model router, shared utilities, and Wave 0 test stubs
- [x] 02-02-PLAN.md -- Extract and migrate three core text handlers (ideas, insights, roadmap) to AI SDK generateText
- [x] 02-03-PLAN.md -- Extract multi-modal handlers (file, image, audio), replace monolith with thin router

### Phase 3: Image Analysis
**Goal**: Users can upload images and receive AI-powered visual analysis and text extraction
**Depends on**: Phase 2
**Requirements**: MM-01, MM-02, MM-07, MM-08
**Success Criteria** (what must be TRUE):
  1. User can upload an image and receive a structured visual analysis within the brainstorm or idea workflow
  2. User can upload an image containing text and receive extracted OCR content as usable idea content
  3. Image uploads go directly to Supabase Storage (not through serverless function body) to avoid the 4.5MB limit
  4. Images are resized client-side before upload to control API costs
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Audio & Voice-to-Idea
**Goal**: Users can upload audio files or record voice on mobile and get transcribed idea cards
**Depends on**: Phase 2
**Requirements**: MM-03, MM-04, MM-06, MOB-02
**Success Criteria** (what must be TRUE):
  1. User can upload an audio file and receive an accurate Whisper transcription
  2. User can tap a record button on mobile, speak an idea, and see it appear as a transcribed idea card
  3. Multi-modal processing shows progress feedback during analysis without blocking the UI
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md — useAudioRecorder hook + audioTranscription lib + MediaRecorder mock fixture
- [ ] 04-02-PLAN.md — Add Audio tab to AIIdeaModal (record + upload + review-then-create)

### Phase 5: Real-Time Collaboration
**Goal**: Multiple users can brainstorm together with live presence, synchronized ideas, voting, and shared matrix updates
**Depends on**: Phase 1
**Requirements**: COLLAB-01, COLLAB-02, COLLAB-03, COLLAB-04, COLLAB-05, COLLAB-06, COLLAB-07
**Success Criteria** (what must be TRUE):
  1. Users in a brainstorm session see who else is online via presence indicators — ⚠️ not delivered (Plan 04 deferred)
  2. Ideas created by any participant appear for all connected users in real-time without page refresh — ✅ (existing BrainstormRealtimeManager, Plan 01)
  3. A project owner can invite a collaborator via email who then joins with the correct permission level (viewer/editor) — ✅ (Plan 02, verified E2E after 05.1/05.2/05.3)
  4. Users can vote on ideas during brainstorm and all participants see updated tallies in real-time — ⚠️ not delivered (Plan 03 partial — schema only, hook/UI deferred)
  5. When one user drags an idea on the matrix, the position change appears for all connected users — ⚠️ not delivered (Plan 04 deferred)
**Plans**: 2/4 plans complete, 2 partial/deferred → rolled into Phase 05.4
**UI hint**: yes
**Status**: 🟡 Partial (2026-04-08) — invitation flow shipped and verified, voting/matrix realtime deferred to Phase 05.4

Plans:
- [x] 05-01-schema-and-fixtures-PLAN.md — DB schema (idea_votes, project_collaborators, project_invitations) + RLS + repositories + Wave 0 test fixtures
- [x] 05-02-invitations-backend-PLAN.md — /api/invitations create/lookup/accept + wire InviteCollaboratorModal + InvitationAcceptPage (verified E2E via Phase 05.1/05.2/05.3)
- [~] 05-03-scoped-realtime-and-voting-PLAN.md — voteRepository + test file shipped; useDotVoting hook, DotVoteControls UI, ScopedRealtimeManager refactor DEFERRED to 05.4
- [ ] 05-04-project-realtime-matrix-PLAN.md — ProjectRealtimeManager, live cursors, drag lock, matrix sync DEFERRED to 05.4

### Phase 05.1: Legacy CollaborationService migration to Phase-5 schema (INSERTED)

**Goal:** Delete all `legacy*` methods from `CollaborationService` and the corresponding `DatabaseService` compatibility wrappers, migrate every UI/hook/test caller in the repo to the Phase-5 entry points (new `CollaborationService` methods, repositories, or `/api/invitations/*`), and rewrite the `CollaborationService` test suite against the Phase-5 schema. Exit state: zero `legacy*` references in `src/` (excluding unrelated `ProjectService` namespace), typecheck clean, tests green.
**Requirements**: Structural cleanup — no new REQ IDs. See `.planning/phases/05.1-.../05.1-CONTEXT.md` D-01..D-10 for locked decisions.
**Depends on:** Phase 5
**Plans:** 3/3 plans complete
**Status:** ✅ Complete (2026-04-08) — verified via human-verify checkpoint after Phase 05.3 hardening closed the E2E flow

Plans:
- [x] 05.1-01 Migrate UI + hook callers to Phase-5 entry points
- [x] 05.1-02 Delete legacy* methods + prune database.ts wrappers
- [x] 05.1-03 Rewrite test suite + DoD verification + E2E checkpoint

### Phase 05.2: Transactional email via Resend for invitations (INSERTED)

**Goal:** Wire Resend into `POST /api/invitations/create` so collaborator invitations arrive in the invitee's inbox instead of requiring the owner to copy `inviteUrl` from the API response body. Dev and prod use the same send path; email failures are logged but never block invitation creation (best-effort after the DB insert succeeds).
**Requirements**: Satisfies the user-facing delivery portion of Phase 5's COLLAB-04 (project invitations). See `05.2-CONTEXT.md` D-01..D-15 for locked decisions.
**Depends on:** Phase 5, Phase 05.1, Phase 05.3
**Plans:** 2/2 plans complete
**Status:** ✅ Complete (2026-04-08) — verified: real email delivered from `noreply@prioritas.ai`, click-through lands invitee directly in the shared project

Plans:
- [x] 05.2-01 Install resend SDK, document env vars, pure `inviteEmailTemplate` module
- [x] 05.2-02 `sendInviteEmail` best-effort wrapper + wire into `create.ts` handler with mocked tests

### Phase 05.3: Phase 5 hardening — bugs surfaced by 05.1 caller migration (INSERTED, RETRO)

**Goal:** Record and verify 12 latent Phase 5 bugs that became reachable once Phase 05.1 deleted the legacy compatibility shim. Fixes were applied during 05.1's human-verify checkpoint and are committed in the same series; this retroactive phase exists so the Phase 5 narrative is honest — the schema and plumbing landed in Phase 5, but the user-visible "owner invites → collaborator sees project" flow only actually worked after this hardening pass.
**Requirements**: COLLAB-01..COLLAB-07 (Phase 5) — same set, this phase makes them actually pass end-to-end
**Depends on:** Phase 5, Phase 05.1
**Plans:** retroactive — see `05.3-SUMMARY.md` for the 12-bug inventory, root causes, and fixes
**Status:** ✅ Complete (2026-04-08) — verified end-to-end via owner → invite → accept → collaborator-sees-project

### Phase 05.4: Finish dot voting, scoped realtime, and project matrix sync (INSERTED, DEFERRED FROM PHASE 5)
**Goal**: Deliver the realtime + voting user experience that was deferred from Phase 5 plans 03 and 04. Implement `useDotVoting` hook and `DotVoteControls` UI against the existing `voteRepository` + test file. Refactor `BrainstormRealtimeManager` into a scope-parameterized `ScopedRealtimeManager` (or build a parallel `ProjectRealtimeManager`). Wire live cursors, soft drag lock, and matrix position sync so two browser sessions on the same project matrix stay in sync.
**Depends on:** Phase 5, Phase 6
**Requirements**: COLLAB-01 (presence on matrix), COLLAB-02 (live ideas on matrix), COLLAB-06 (vote tallies), COLLAB-07 (matrix position sync)
**Success Criteria** (what must be TRUE):
  1. Two browser sessions on the same brainstorm can see each other vote in real-time
  2. Two browser sessions on the same project matrix see each other's cursors (Figma-style, throttled)
  3. When user A drags a card, user B sees it visually locked until drop
  4. When user A drops a card in a new position, user B sees the card move to the new position in real-time
  5. Presence avatars appear for users currently viewing the same project matrix
**Plans**: TBD (run /gsd-plan-phase 05.4)
**UI hint**: yes
**Status**: ⚪ Not started

### Phase 6: Billing & Subscription Enforcement
**Goal**: Subscription limits are enforced at the API layer with clear user-facing usage visibility and upgrade prompts
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06
**Success Criteria** (what must be TRUE):
  1. Free tier users hit defined limits (projects, AI generations/month) and see upgrade prompts instead of unbounded access ✅
  2. Paid tier users have higher or unlimited limits that are correctly enforced at the API layer ✅
  3. User receives an in-app notification when their payment fails ✅
  4. User can view their current AI usage and subscription limits on an in-app dashboard ✅
**Plans**: 4/4 plans complete
**UI hint**: yes
**Status**: ✅ Complete (2026-04-08) — verified end-to-end: real Stripe checkout against Prioritas test account, real subscription (`sub_1TK0a3HOzca6IMLj1XMktDoZ`) active, DB `subscriptions` row populated with Stripe IDs/periods, signed-payload POST to webhook returns 200 and upserts correctly, Settings page shows Team tier badge with correct limits.

Plans:
- [x] 06-01-schema-migration-PLAN.md — billing schema (subscriptions, usage_tracking, user_notifications, stripe_webhook_events) + increment_ai_usage RPC
- [x] 06-02-quota-middleware-PLAN.md — withQuotaCheck middleware + fail-closed fix + real getTeamMemberCount + incrementAiUsage
- [x] 06-03-wire-endpoints-and-webhook-PLAN.md — wrap projects/ai/invitations endpoints + webhook idempotency + payment_failed notification
- [x] 06-04-frontend-dashboard-and-prompts-PLAN.md — Settings SubscriptionPanel + inline UpgradePrompt + PaymentFailedBanner + PricingPage checkout wiring

**Phase 6 hotfixes applied during UAT** (all committed in the same series; documented here so the history is honest):
- vite.config.ts raw-body forwarding so webhook signature verification works in dev
- webhook handler unhandled `customer.subscription.created` routed to the same upsert path as `updated`
- handlePaymentSucceeded tolerates 404 from `stripe trigger` fixture events
- SubscriptionPanel/UserSettings fetch calls attach `Authorization: Bearer` via getAuthHeadersSync (localStorage token) — credentials:'include' alone wasn't enough
- InvitationAcceptPage-style fix: preserve query params on URL sync when on target path (Stripe `?session_id=...` was being stripped)
- SubscriptionSuccessPage: wait for currentUser hydration before rendering error state
- stripe.ts checkout/portal handlers thread service-role admin client to subscriptionService (anon client failed RLS)
- webhook.ts handlers (checkout/sub updated/deleted/payment succeeded/failed) all thread the admin client to updateSubscription (same RLS issue)
- supabase/migrations/20260408170000 ALTER TABLE to add `past_due_since` column — Phase 06-01 CREATE TABLE IF NOT EXISTS was a no-op on a pre-existing `subscriptions` table, so the D-17 grace anchor column never landed

### Phase 7: Mobile Polish & Video Analysis
**Goal**: The mobile brainstorm experience is fully enabled and polished, and users can analyze video content
**Depends on**: Phase 4, Phase 6
**Requirements**: MOB-01, MOB-03, MOB-04, MOB-05, MM-05
**Success Criteria** (what must be TRUE):
  1. All mobile brainstorm feature flag phases (2-5) are enabled and working on mobile browsers
  2. All pages are responsive and usable on mobile viewports with touch-optimized interactions
  3. Brainstorm join via QR code works reliably on mobile browsers (iOS Safari + Android Chrome)
  4. User can upload a video and receive frame-by-frame analysis via client-side extraction and vision API
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 07-01-PLAN.md — Enable mobile brainstorm flags, add useBreakpoint hook, produce MOBILE-AUDIT.md
- [ ] 07-02-PLAN.md — Critical-path mobile responsive/touch polish + BottomSheet + DesktopOnlyHint + Playwright mobile suite
- [ ] 07-03-PLAN.md — Video analysis end-to-end: client frame extraction, analyzeVideo handler, AIStarterModal upload UI

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
Note: Phase 3 and 4 both depend on Phase 2. Phase 5 depends only on Phase 1 and can execute in parallel with Phases 3-4 if needed.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening & Production Fixes | 0/3 | Not started | - |
| 2. AI SDK Foundation | 0/3 | Not started | - |
| 3. Image Analysis | 0/2 | Not started | - |
| 4. Audio & Voice-to-Idea | 0/2 | Not started | - |
| 5. Real-Time Collaboration | 0/3 | Not started | - |
| 6. Billing & Subscription Enforcement | 0/3 | Not started | - |
| 7. Mobile Polish & Video Analysis | 0/3 | Not started | - |
