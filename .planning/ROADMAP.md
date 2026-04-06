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
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD
- [ ] 01-03: TBD

### Phase 2: AI SDK Foundation
**Goal**: All AI features run through AI SDK v6 with multi-provider routing and no regressions in existing functionality
**Depends on**: Phase 1
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05
**Success Criteria** (what must be TRUE):
  1. Existing AI features (idea generation, insights, roadmap) produce identical results through the new AI SDK layer
  2. Model router selects the appropriate provider (OpenAI, Anthropic, MiniMax) based on task capability requirements
  3. Vision-capable tasks route only to vision-capable models; text tasks can route to any provider
  4. The monolithic api/ai.ts is replaced by modular handlers under api/_lib/ai/ with no functional regression
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

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
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Real-Time Collaboration
**Goal**: Multiple users can brainstorm together with live presence, synchronized ideas, voting, and shared matrix updates
**Depends on**: Phase 1
**Requirements**: COLLAB-01, COLLAB-02, COLLAB-03, COLLAB-04, COLLAB-05, COLLAB-06, COLLAB-07
**Success Criteria** (what must be TRUE):
  1. Users in a brainstorm session see who else is online via presence indicators
  2. Ideas created by any participant appear for all connected users in real-time without page refresh
  3. A project owner can invite a collaborator via email who then joins with the correct permission level (viewer/editor)
  4. Users can vote on ideas during brainstorm and all participants see updated tallies in real-time
  5. When one user drags an idea on the matrix, the position change appears for all connected users
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Billing & Subscription Enforcement
**Goal**: Subscription limits are enforced at the API layer with clear user-facing usage visibility and upgrade prompts
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06
**Success Criteria** (what must be TRUE):
  1. Free tier users hit defined limits (projects, AI generations/month) and see upgrade prompts instead of unbounded access
  2. Paid tier users have higher or unlimited limits that are correctly enforced at the API layer
  3. User receives an in-app notification when their payment fails
  4. User can view their current AI usage and subscription limits on an in-app dashboard
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

### Phase 7: Mobile Polish & Video Analysis
**Goal**: The mobile brainstorm experience is fully enabled and polished, and users can analyze video content
**Depends on**: Phase 4, Phase 6
**Requirements**: MOB-01, MOB-03, MOB-04, MOB-05, MM-05
**Success Criteria** (what must be TRUE):
  1. All mobile brainstorm feature flag phases (2-5) are enabled and working on mobile browsers
  2. All pages are responsive and usable on mobile viewports with touch-optimized interactions
  3. Brainstorm join via QR code works reliably on mobile browsers (iOS Safari + Android Chrome)
  4. User can upload a video and receive frame-by-frame analysis via client-side extraction and vision API
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

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
