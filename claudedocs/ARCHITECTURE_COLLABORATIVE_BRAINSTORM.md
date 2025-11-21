# Collaborative Brainstorming - System Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COLLABORATIVE BRAINSTORM SYSTEM                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐                    ┌──────────────────────────┐
│   DESKTOP (Facilitator)  │                    │   MOBILE (Participants)  │
│    MatrixFullScreenView  │                    │      MobileJoinPage      │
└────────────┬─────────────┘                    └────────────┬─────────────┘
             │                                                │
             │ 1. Create Session                             │
             ├────────────────────────────────────────────────┤
             │                                                │
             │ 2. Display QR Code                            │
             │    (access_token embedded)                    │
             │                                                │
             │                                    3. Scan QR  │
             │                                    /join/:token│
             │                                                │
             │                              4. Validate Token │
             │◄───────────────────────────────────────────────┤
             │                                                │
             │                              5. Auto-join as   │
             │                              Participant       │
             │                                                │
             ├────────────────────────────────────────────────┤
             │           6. REAL-TIME SYNC (WebSockets)       │
             │                                                │
             │  ┌──────────────────────────────────────────┐ │
             │  │      Supabase Realtime Channel          │ │
             │  │   channel(`brainstorm:${sessionId}`)    │ │
             │  │                                          │ │
             │  │  Events:                                 │ │
             │  │  • idea_created                          │ │
             │  │  • idea_updated                          │ │
             │  │  • idea_deleted                          │ │
             │  │  • participant_joined                    │ │
             │  │  • participant_left                      │ │
             │  │  • session_state_changed                 │ │
             │  └──────────────────────────────────────────┘ │
             │                                                │
             │  7. Mobile submits idea                       │
             │◄───────────────────────────────────────────────┤
             │                                                │
             │  8. Idea appears instantly on desktop         │
             │     (< 2 second latency)                      │
             │                                                │
             │  9. Participant counter updates               │
             │     (real-time)                               │
             │                                                │
             └────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW DIAGRAM                               │
└─────────────────────────────────────────────────────────────────────────────┘

DESKTOP FLOW (Session Creation):
───────────────────────────────
1. User enters full-screen mode
   ↓
2. Click "Enable Mobile Join"
   ↓
3. BrainstormSessionService.createSession()
   ↓
4. Generate secure tokens:
   • access_token: UUID v4 (cryptographic)
   • join_code: ABCD-1234 (human-readable)
   ↓
5. Insert into brainstorm_sessions table
   ↓
6. Generate QR code:
   qrCodeData = https://app.com/join/${access_token}
   ↓
7. Display QR on screen
   ↓
8. Subscribe to real-time channel


MOBILE FLOW (Participant Join):
────────────────────────────────
1. Scan QR code
   ↓
2. Browser redirects to /join/:accessToken
   ↓
3. MobileJoinPage validates token:
   • Check session status = 'active'
   • Check expires_at > now()
   • Check max_participants not exceeded
   ↓
4. Auto-create participant record:
   • Generate participant_name or prompt
   • Create device_fingerprint
   • Insert into session_participants
   ↓
5. Subscribe to real-time channel
   ↓
6. Display MobileIdeaSubmitForm


MOBILE FLOW (Idea Submission):
───────────────────────────────
1. User types idea + details
   ↓
2. Client-side validation:
   • Content 3-200 chars
   • Rate limit check (1 per 10s)
   ↓
3. Optimistic UI update:
   • Add idea to recent list
   • Show success toast
   ↓
4. POST /api/brainstorm/submit-idea
   ↓
5. Server-side checks:
   • Rate limiting (6 per minute)
   • Session validation
   • Participant authorization
   • Content moderation
   ↓
6. Insert into ideas table:
   • project_id
   • session_id
   • participant_id
   • submitted_via: 'mobile'
   ↓
7. Postgres CDC triggers real-time event
   ↓
8. All subscribed clients receive event


DESKTOP FLOW (Receive Idea):
─────────────────────────────
1. Real-time event received:
   event: 'INSERT', table: 'ideas'
   ↓
2. BrainstormRealtimeManager.onIdeaCreated()
   ↓
3. Deduplication check:
   • Ensure idea not already in state
   ↓
4. Add to ideas array with animation flag
   ↓
5. Render with animation:
   • Scale from 0.3 to 1.0
   • Fade in
   • Blue pulse effect (mobile indicator)
   ↓
6. Show toast notification:
   "💡 New idea from Participant 1234"
   ↓
7. Update participant counter
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPONENT HIERARCHY                                  │
└─────────────────────────────────────────────────────────────────────────────┘

DESKTOP (Full-Screen Mode):
───────────────────────────

MatrixFullScreenView
├─ TopBar
│  ├─ ProjectContext (left)
│  ├─ ViewControls (center)
│  ├─ SessionControls (right)
│  │  ├─ EnableMobileJoinButton
│  │  └─ ParticipantCounter
│  └─ ExitButton (always visible)
│
├─ SessionQRCodeOverlay (conditional)
│  ├─ QRCode (qrcode.react)
│  ├─ JoinCode display
│  ├─ SessionTimer
│  └─ SessionControls
│     ├─ PauseButton
│     ├─ ResumeButton
│     └─ EndSessionButton
│
├─ MatrixCanvas (existing)
│  └─ DesignMatrix (existing)
│     └─ IdeaCard[] (enhanced with mobile indicator)
│
├─ ParticipantList (sidebar)
│  └─ ParticipantItem[]
│     ├─ participant_name
│     ├─ contribution_count
│     └─ last_active (time ago)
│
└─ FloatingActionMenu (existing)


MOBILE (Join Page):
───────────────────

MobileJoinPage
├─ TokenValidation (initial)
│  ├─ LoadingSpinner
│  ├─ ErrorState
│  └─ SuccessState
│
└─ MobileIdeaSubmitForm (after join)
   ├─ Header
   │  ├─ session.name
   │  └─ contribution_count
   │
   ├─ IdeaForm
   │  ├─ ContentTextarea (200 char limit)
   │  ├─ DetailsTextarea (500 char limit)
   │  ├─ PrioritySelector
   │  │  ├─ LowButton
   │  │  ├─ ModerateButton
   │  │  └─ HighButton
   │  └─ SubmitButton
   │
   ├─ SuccessToast (conditional)
   │
   ├─ RecentIdeas (list)
   │  └─ IdeaCard[]
   │     ├─ content
   │     ├─ details
   │     ├─ priority
   │     └─ created_at
   │
   └─ Footer
      └─ session_status
```

---

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA (ERD)                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐
│      projects                     │
├──────────────────────────────────┤
│ id (PK)                          │
│ name                             │
│ owner_id (FK → auth.users)       │
│ created_at                       │
└──────┬───────────────────────────┘
       │
       │ 1:N
       │
       ├──────────────────────────────────────────┐
       │                                          │
       ▼                                          ▼
┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│   brainstorm_sessions            │    │      ideas                       │
├──────────────────────────────────┤    ├──────────────────────────────────┤
│ id (PK)                          │    │ id (PK)                          │
│ project_id (FK → projects)       │◄───┤ project_id (FK → projects)       │
│ facilitator_id (FK → auth.users) │    │ session_id (FK → sessions) ◄─┐  │
│ name                             │    │ participant_id (FK → parts)  │  │
│ status (active/paused/etc)       │    │ content                      │  │
│ join_code (UNIQUE)               │    │ details                      │  │
│ access_token (UNIQUE)            │    │ priority                     │  │
│ expires_at                       │    │ x, y                         │  │
│ max_participants                 │    │ submitted_via (desktop/mob)  │  │
│ allow_anonymous                  │    │ created_at                   │  │
│ enable_voting                    │    │ updated_at                   │  │
│ created_at                       │    └──────────────────────────────────┘
│ started_at                       │
│ ended_at                         │
└──────┬───────────────────────────┘
       │
       │ 1:N
       │
       ▼
┌──────────────────────────────────┐
│   session_participants           │
├──────────────────────────────────┤
│ id (PK)                          │──┐
│ session_id (FK → sessions)       │  │
│ user_id (FK → auth.users) NULL   │  │
│ participant_name                 │  │
│ device_fingerprint               │  │
│ is_anonymous                     │  │
│ is_approved                      │  │
│ contribution_count               │  │
│ joined_at                        │  │
│ last_active_at                   │  │
│ disconnected_at                  │  │
└──────────────────────────────────┘  │
                                      │
       ┌──────────────────────────────┘
       │
       │ 1:N
       │
       ▼
┌──────────────────────────────────┐
│   session_activity_log           │
├──────────────────────────────────┤
│ id (PK)                          │
│ session_id (FK → sessions)       │
│ participant_id (FK → parts)      │
│ activity_type (enum)             │
│ idea_id (FK → ideas) NULL        │
│ snapshot_data (JSONB)            │
│ created_at                       │
│ ip_address                       │
│ user_agent                       │
└──────────────────────────────────┘


STRETCH: Voting System
───────────────────────
┌──────────────────────────────────┐
│      idea_votes                  │
├──────────────────────────────────┤
│ id (PK)                          │
│ idea_id (FK → ideas)             │
│ participant_id (FK → parts)      │
│ vote_value (-1, 0, 1)            │
│ created_at                       │
│ UNIQUE(idea_id, participant_id)  │
└──────────────────────────────────┘
```

---

## Real-Time Sync Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SUPABASE REALTIME ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

Supabase Postgres Database
         │
         │ Postgres CDC (Change Data Capture)
         │ Logical Replication
         ▼
   Realtime Server
   (Phoenix Framework)
         │
         │ WebSocket Connections
         │
    ┌────┴────┬─────────┬─────────┬─────────┐
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
Desktop   Mobile1   Mobile2   Mobile3   ...MobileN
Client    Client    Client    Client    Client


CHANNEL STRUCTURE:
──────────────────

Channel Name: `brainstorm:${sessionId}`

Events Published:
1. postgres_changes:
   • event: INSERT, table: ideas
     → onIdeaCreated(payload.new)

   • event: UPDATE, table: ideas
     → onIdeaUpdated(payload.new)

   • event: DELETE, table: ideas
     → onIdeaDeleted(payload.old.id)

   • event: INSERT, table: session_participants
     → onParticipantJoined(payload.new)

   • event: UPDATE, table: session_participants
     → filter: disconnected_at IS NOT NULL
     → onParticipantLeft(payload.new.id)

   • event: UPDATE, table: brainstorm_sessions
     → onSessionStateChanged(payload.new.status)

2. broadcast (optional):
   • event: cursor_move
     → Participant cursor positions
   • event: typing_indicator
     → Show who's typing


SUBSCRIPTION LIFECYCLE:
───────────────────────

1. Client connects:
   channel = supabase.channel('brainstorm:session-123')

2. Register event handlers:
   channel.on('postgres_changes', { ... }, callback)

3. Subscribe:
   channel.subscribe(status => {
     if (status === 'SUBSCRIBED') {
       console.log('Connected')
     }
   })

4. Client disconnects:
   supabase.removeChannel(channel)


PERFORMANCE OPTIMIZATIONS:
──────────────────────────

1. Throttling:
   • Limit updates to 10/second per client
   • Batch rapid-fire updates (< 200ms apart)

2. Deduplication:
   • Track idea IDs already in state
   • Skip redundant updates

3. Optimistic UI:
   • Show ideas immediately on submit
   • Confirm with real-time event
   • Rollback if server rejects

4. Connection Pooling:
   • Reuse channel for multiple event types
   • Single WebSocket per session
   • Automatic reconnection on disconnect
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

LAYER 1: Session Token Security
────────────────────────────────

Access Token:
  • Format: UUID v4 (cryptographically random)
  • Length: 36 characters
  • Entropy: 122 bits
  • Generation: crypto.randomUUID()
  • Storage: brainstorm_sessions.access_token (UNIQUE)
  • Transmission: HTTPS only (embedded in QR)
  • Expiration: Enforced at database + application level

Join Code:
  • Format: ABCD-1234 (4 letters + 4 digits)
  • Purpose: Manual entry fallback
  • Entropy: ~31 bits (26^4 * 10^4 ≈ 4.5B combinations)
  • Collision Avoidance: UNIQUE constraint + retry logic


LAYER 2: Row-Level Security (RLS)
──────────────────────────────────

brainstorm_sessions:
  • Facilitators can CRUD their own sessions
  • Anyone with valid access_token can SELECT active sessions

session_participants:
  • Facilitators can view all participants in their sessions
  • Participants can view themselves
  • Participants can INSERT (join) active sessions

ideas:
  • Existing RLS + session participant authorization
  • Participants can INSERT ideas for their sessions
  • Ideas visible based on project permissions


LAYER 3: Rate Limiting
───────────────────────

Client-Side (JavaScript):
  • Max 1 idea per 10 seconds
  • Implemented in ParticipantRateLimiter class
  • Countdown timer shown to user

Server-Side (API):
  • Max 6 ideas per minute per participant
  • 429 status code on limit exceed
  • Retry-After header with wait time
  • In-memory store with participant_id key


LAYER 4: Content Moderation
────────────────────────────

Validation Rules:
  • Content: 3-200 characters
  • Details: 0-500 characters (optional)
  • Priority: Must be in ['low', 'moderate', 'high']

Spam Detection:
  • Reject repeated characters (>10 in a row)
  • Reject excessive caps (>80% uppercase)
  • Reject profanity (basic word list)

Sanitization:
  • Strip HTML tags
  • Remove <script> elements
  • Trim whitespace
  • Truncate to max length


LAYER 5: Session Isolation
───────────────────────────

Database Filters:
  • All queries filtered by session_id
  • Participants can't access other sessions
  • Ideas scoped to session + project

Real-Time Channels:
  • Separate channel per session
  • Channel name: `brainstorm:${sessionId}`
  • Prevents cross-session data leaks


LAYER 6: Audit Logging
───────────────────────

session_activity_log:
  • Records all participant actions
  • Stores IP address + user agent
  • Snapshot of data before changes
  • Enables undo/rollback functionality
  • Forensic analysis for abuse
```

---

## API Endpoints

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API ROUTES                                        │
└─────────────────────────────────────────────────────────────────────────────┘

POST /api/brainstorm/create-session
────────────────────────────────────
Request:
  {
    "projectId": "uuid",
    "name": "Brainstorm Session",
    "durationMinutes": 60,
    "maxParticipants": 50,
    "allowAnonymous": true
  }

Response:
  {
    "success": true,
    "session": {
      "id": "uuid",
      "accessToken": "uuid",
      "joinCode": "ABCD-1234",
      "qrCodeData": "https://app.com/join/uuid",
      "expiresAt": "2025-01-20T12:00:00Z"
    }
  }

Auth: Requires authenticated user (facilitator)
Rate Limit: 10 per hour per user


GET /api/brainstorm/validate-token?token=:accessToken
──────────────────────────────────────────────────────
Response:
  {
    "valid": true,
    "session": {
      "id": "uuid",
      "name": "Brainstorm Session",
      "status": "active",
      "expiresAt": "2025-01-20T12:00:00Z"
    }
  }

Auth: None (public validation)
Rate Limit: 60 per minute per IP


POST /api/brainstorm/submit-idea
─────────────────────────────────
Request:
  {
    "sessionId": "uuid",
    "participantId": "uuid",
    "content": "Idea text",
    "details": "Optional details",
    "priority": "moderate"
  }

Response:
  {
    "success": true,
    "idea": {
      "id": "uuid",
      "content": "Idea text",
      "createdAt": "2025-01-20T11:00:00Z"
    }
  }

Auth: Requires valid participant_id for session
Rate Limit: 6 per minute per participant


POST /api/brainstorm/end-session
─────────────────────────────────
Request:
  {
    "sessionId": "uuid"
  }

Response:
  {
    "success": true
  }

Auth: Requires facilitator ownership
Rate Limit: 60 per hour per user


POST /api/brainstorm/ai-summarize (STRETCH)
────────────────────────────────────────────
Request:
  {
    "sessionId": "uuid"
  }

Response:
  {
    "summary": "Markdown-formatted summary...",
    "keyThemes": [...],
    "topIdeas": [...],
    "actionItems": [...]
  }

Auth: Requires facilitator ownership
Rate Limit: 10 per day per session
Cost: ~$0.05 per summary (GPT-4)
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT DIAGRAM                                    │
└─────────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────────┐
                        │   Vercel CDN    │
                        │  (Static Assets)│
                        └────────┬────────┘
                                 │
                                 │ HTTPS
                                 ▼
                        ┌─────────────────┐
                        │  Vercel Edge    │
                        │   Functions     │
                        │                 │
                        │ • SSR (Vite)    │
                        │ • API Routes    │
                        └────────┬────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
                 ▼               ▼               ▼
        ┌────────────┐  ┌────────────┐  ┌────────────┐
        │  Supabase  │  │   OpenAI   │  │   Stripe   │
        │  Database  │  │    API     │  │    API     │
        │            │  │ (Summarize)│  │ (Payments) │
        │ • Postgres │  └────────────┘  └────────────┘
        │ • Realtime │
        │ • Auth     │
        │ • Storage  │
        └────────────┘


ENVIRONMENT VARIABLES:
──────────────────────

Production (Vercel):
  • VITE_SUPABASE_URL
  • VITE_SUPABASE_ANON_KEY
  • SUPABASE_SERVICE_ROLE_KEY (secret)
  • OPENAI_API_KEY (secret, optional)
  • NODE_ENV=production

Development (Local):
  • Same as production
  • NODE_ENV=development
  • BYPASS_RATE_LIMIT=false


SCALING CONSIDERATIONS:
───────────────────────

1. Database:
   • Supabase auto-scales to handle 1000s of concurrent connections
   • Connection pooling via PgBouncer
   • Indexes on session_id, participant_id for fast queries

2. Real-time:
   • Supabase Realtime handles 10,000+ concurrent WebSocket connections
   • Automatic load balancing across Phoenix nodes
   • Reconnection logic on client disconnect

3. API Functions:
   • Vercel Serverless Functions auto-scale
   • Cold start: ~100ms
   • Concurrent execution limit: 1000 (Pro plan)

4. CDN:
   • Static assets cached at edge
   • QR code images generated on-demand
   • Cache-Control headers for optimization


MONITORING:
───────────

1. Application Metrics:
   • Vercel Analytics for page views, latency
   • Error tracking via console logs

2. Database Metrics:
   • Supabase Dashboard for query performance
   • Connection pool utilization
   • Real-time subscription count

3. API Metrics:
   • Function invocation count
   • Error rates
   • Average execution time

4. Custom Metrics:
   • Session creation count (daily)
   • Participant join success rate
   • Idea submission latency (p50, p95, p99)
   • Real-time sync latency
```

---

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TESTING PYRAMID                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   E2E Tests │  (10%)
                              │  Playwright │
                              │             │
                              │ • Full flow │
                              │ • 5 tests   │
                              └─────────────┘
                                    │
                         ┌──────────┴──────────┐
                         │ Integration Tests   │  (20%)
                         │   Vitest + MSW      │
                         │                     │
                         │ • Real-time sync    │
                         │ • API endpoints     │
                         │ • 15 tests          │
                         └─────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │       Unit Tests              │  (70%)
                    │         Vitest                │
                    │                               │
                    │ • Services, hooks, utils      │
                    │ • Pure functions              │
                    │ • 50+ tests                   │
                    └───────────────────────────────┘


TEST COVERAGE TARGETS:
──────────────────────

Service Layer: 90%+
  • BrainstormSessionService
  • ContentModerationService
  • RateLimitService

Hook Layer: 80%+
  • useBrainstormRealtime
  • useOptimisticIdeas
  • useSessionManagement

Component Layer: 70%+
  • SessionQRCode
  • MobileIdeaSubmitForm
  • ParticipantList

E2E Critical Paths: 100%
  • Session creation → QR display
  • Mobile join → idea submit
  • Desktop receives idea in < 2s
```

This architecture diagram complements the detailed design documents and provides visual clarity on system interactions, data flows, and deployment infrastructure.