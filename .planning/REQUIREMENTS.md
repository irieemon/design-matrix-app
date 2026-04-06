# Requirements: Prioritas

**Defined:** 2026-04-06
**Core Value:** Real-time collaborative brainstorming with AI-powered multi-modal analysis

## v1 Requirements

Requirements for public launch. Each maps to roadmap phases.

### Security Hardening

- [ ] **SEC-01**: User can reset password via email link (endpoint + UI form)
- [ ] **SEC-02**: CSRF middleware applied to all state-changing API endpoints (POST/PUT/DELETE/PATCH)
- [ ] **SEC-03**: Rate limiting enforced on auth endpoints (login, signup, password reset)
- [ ] **SEC-04**: Rate limiting enforced on AI endpoints (generation, insights, multi-modal)
- [ ] **SEC-05**: Rate limiting enforced on admin and webhook endpoints
- [ ] **SEC-06**: Subscription service fails closed on errors (not open with `canUse: true`)
- [ ] **SEC-07**: Fix ideas.ts undefined error variable in catch block (line 117)
- [ ] **SEC-08**: Fix refresh token cookie path to work on all /api/* paths
- [ ] **SEC-09**: Fix hardcoded userTier ('pro') in AI insights service — read from user context
- [ ] **SEC-10**: Remove multi-modal placeholder returns — no fake data in production

### AI Foundation

- [ ] **AI-01**: AI SDK v6 integrated as unified provider layer
- [ ] **AI-02**: Multi-provider model router supporting OpenAI, Anthropic Claude, and MiniMax
- [ ] **AI-03**: Capability-based routing (vision tasks only to vision-capable models, text to any)
- [ ] **AI-04**: Refactor monolithic api/ai.ts (2500+ lines) into modular handlers under api/_lib/ai/
- [ ] **AI-05**: Existing AI features (idea generation, insights, roadmap) work through new AI SDK layer without regression

### Multi-Modal AI

- [ ] **MM-01**: User can upload image and receive AI-powered visual analysis
- [ ] **MM-02**: User can upload image and receive OCR text extraction via GPT vision
- [ ] **MM-03**: User can upload audio file and receive Whisper transcription
- [ ] **MM-04**: User can record voice on mobile and convert to idea card via Whisper
- [ ] **MM-05**: User can upload video and receive frame-by-frame analysis via client-side extraction (ffmpeg.wasm single-thread) + vision API
- [ ] **MM-06**: Multi-modal processing shows progress feedback during analysis (not blocking UI)
- [ ] **MM-07**: File uploads go direct to Supabase Storage (not through serverless function body — 4.5MB limit)
- [ ] **MM-08**: Client-side image resize before upload to control API costs

### Real-Time Collaboration

- [ ] **COLLAB-01**: User sees real-time presence indicators (who's online) in brainstorm sessions
- [ ] **COLLAB-02**: Ideas created by any participant appear for all users in real-time without refresh
- [ ] **COLLAB-03**: User can invite collaborators to a project via email
- [ ] **COLLAB-04**: Invited collaborator can join project with appropriate permissions (viewer/editor)
- [ ] **COLLAB-05**: User can vote on ideas (dot-voting or thumbs-up) during brainstorm
- [ ] **COLLAB-06**: Vote tallies update in real-time for all participants
- [ ] **COLLAB-07**: Idea position changes on matrix broadcast to all connected users

### Billing & Subscription

- [ ] **BILL-01**: Subscription limits enforced at API layer (projects, AI usage, team members)
- [ ] **BILL-02**: User notified in-app when payment fails
- [ ] **BILL-03**: Subscription service fails closed on errors (deny access, not grant unlimited)
- [ ] **BILL-04**: User can view AI usage and subscription limits in-app dashboard
- [ ] **BILL-05**: Free tier has defined limits (N projects, N AI generations/month)
- [ ] **BILL-06**: Paid tier limits are higher/unlimited with clear upgrade prompts when limits hit

### Mobile Experience

- [ ] **MOB-01**: Mobile brainstorm feature flag phases enabled and tested (phases 2-5)
- [ ] **MOB-02**: Voice-to-idea: user records audio on mobile, gets transcribed idea card
- [ ] **MOB-03**: All pages responsive and usable on mobile viewports
- [ ] **MOB-04**: Mobile brainstorm submit form optimized for touch interaction
- [ ] **MOB-05**: Brainstorm join via QR code works reliably on mobile browsers

### Admin (Minimal)

- [ ] **ADMIN-01**: Admin dashboard shows real user stats (replace hardcoded zeros)
- [ ] **ADMIN-02**: Admin can view project and idea counts per user from database

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Collaboration

- **COLLAB-V2-01**: Cursor tracking showing other users' mouse positions on matrix
- **COLLAB-V2-02**: Conflict resolution for simultaneous idea position updates (CRDT or lock-based)
- **COLLAB-V2-03**: Activity feed showing who did what in a project
- **COLLAB-V2-04**: Commenting on individual ideas

### Advanced Admin

- **ADMIN-V2-01**: Admin can suspend/ban users
- **ADMIN-V2-02**: Admin can change user roles
- **ADMIN-V2-03**: Admin can view and manage subscriptions
- **ADMIN-V2-04**: System-wide feature flag management from admin panel

### Enhanced AI

- **AI-V2-01**: AI-powered prioritization suggestions based on matrix data
- **AI-V2-02**: Cross-modal synthesis (combine insights from image + audio + text)
- **AI-V2-03**: Structured frameworks (RICE, MoSCoW) for AI recommendations
- **AI-V2-04**: Session analytics and brainstorm quality scoring

### Platform

- **PLAT-V2-01**: Offline support with service worker and IndexedDB
- **PLAT-V2-02**: Full-text search across projects and ideas
- **PLAT-V2-03**: OAuth login (Google, GitHub)
- **PLAT-V2-04**: 2FA / MFA support
- **PLAT-V2-05**: Data export (JSON) for project backup

## Out of Scope

| Feature | Reason |
|---------|--------|
| General whiteboard / canvas drawing | Not our lane — Miro has 100M+ users. Our advantage is structured AI-powered prioritization. |
| Real-time chat / messaging | Adds complexity without strengthening core prioritization workflow |
| Video/audio file hosting | Users upload for analysis only — no persistent media library |
| Invoice / receipt system | Stripe Customer Portal handles this natively |
| Dunning / payment retry automation | Stripe handles basic retry. Custom logic deferred. |
| OAuth login | Email/password sufficient for launch. Reduces auth complexity. |
| Advanced RBAC (admin, owner, editor, viewer granularity) | Viewer/editor permissions sufficient for v1 collaboration |
| ffmpeg.wasm multi-threaded mode | Breaks CORS headers, conflicts with Stripe and third-party scripts |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Pending | Pending |
| SEC-02 | Pending | Pending |
| SEC-03 | Pending | Pending |
| SEC-04 | Pending | Pending |
| SEC-05 | Pending | Pending |
| SEC-06 | Pending | Pending |
| SEC-07 | Pending | Pending |
| SEC-08 | Pending | Pending |
| SEC-09 | Pending | Pending |
| SEC-10 | Pending | Pending |
| AI-01 | Pending | Pending |
| AI-02 | Pending | Pending |
| AI-03 | Pending | Pending |
| AI-04 | Pending | Pending |
| AI-05 | Pending | Pending |
| MM-01 | Pending | Pending |
| MM-02 | Pending | Pending |
| MM-03 | Pending | Pending |
| MM-04 | Pending | Pending |
| MM-05 | Pending | Pending |
| MM-06 | Pending | Pending |
| MM-07 | Pending | Pending |
| MM-08 | Pending | Pending |
| COLLAB-01 | Pending | Pending |
| COLLAB-02 | Pending | Pending |
| COLLAB-03 | Pending | Pending |
| COLLAB-04 | Pending | Pending |
| COLLAB-05 | Pending | Pending |
| COLLAB-06 | Pending | Pending |
| COLLAB-07 | Pending | Pending |
| BILL-01 | Pending | Pending |
| BILL-02 | Pending | Pending |
| BILL-03 | Pending | Pending |
| BILL-04 | Pending | Pending |
| BILL-05 | Pending | Pending |
| BILL-06 | Pending | Pending |
| MOB-01 | Pending | Pending |
| MOB-02 | Pending | Pending |
| MOB-03 | Pending | Pending |
| MOB-04 | Pending | Pending |
| MOB-05 | Pending | Pending |
| ADMIN-01 | Pending | Pending |
| ADMIN-02 | Pending | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 0
- Unmapped: 42 ⚠️

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
