/**
 * Collaborative Brainstorming - Type Definitions
 * Phase One Implementation
 */

export interface BrainstormSession {
  id: string
  project_id: string
  facilitator_id: string

  // Session metadata
  name: string
  description?: string

  // Session state
  status: 'active' | 'paused' | 'completed' | 'archived'

  // Access control
  join_code: string
  access_token: string
  expires_at: string
  max_participants: number

  // Session configuration
  allow_anonymous: boolean
  require_approval: boolean
  enable_voting: boolean
  time_limit_minutes?: number

  // Timestamps
  created_at: string
  updated_at: string
  started_at?: string
  ended_at?: string
}

export interface SessionParticipant {
  id: string
  session_id: string

  // Participant identification
  user_id?: string
  participant_name: string
  device_fingerprint?: string

  // Participant metadata
  is_anonymous: boolean
  is_approved: boolean
  contribution_count: number

  // Connection tracking
  joined_at: string
  last_active_at: string
  disconnected_at?: string
}

export interface SessionActivityLog {
  id: string
  session_id: string
  participant_id?: string

  // Activity details
  activity_type:
    | 'idea_created'
    | 'idea_updated'
    | 'idea_deleted'
    | 'idea_moved'
    | 'participant_joined'
    | 'participant_left'
    | 'session_paused'
    | 'session_resumed'
    | 'session_started'
    | 'session_ended'

  // Data snapshot
  idea_id?: string
  snapshot_data?: Record<string, unknown>

  // Metadata
  created_at: string
  ip_address?: string
  user_agent?: string
}

// Request/Response types for API
export interface CreateSessionInput {
  projectId: string
  name?: string
  description?: string
  durationMinutes?: number
  maxParticipants?: number
  allowAnonymous?: boolean
  requireApproval?: boolean
  enableVoting?: boolean
}

export interface CreateSessionResponse {
  success: boolean
  session?: BrainstormSession & {
    qrCodeData: string // Full URL for QR code
  }
  error?: string
}

export interface ValidateTokenInput {
  accessToken: string
}

export interface ValidateTokenResponse {
  valid: boolean
  session?: BrainstormSession
  error?: string
}

export interface JoinSessionInput {
  sessionId: string
  participantName?: string
  deviceFingerprint?: string
  userId?: string
}

export interface JoinSessionResponse {
  success: boolean
  participant?: SessionParticipant
  error?: string
  retryAfter?: number // Phase Five: Rate limiting support (milliseconds until retry allowed)
}

export interface SubmitIdeaInput {
  sessionId: string
  participantId: string
  content: string
  details?: string
  priority?: 'low' | 'moderate' | 'high'
}

export interface SubmitIdeaResponse {
  success: boolean
  idea?: {
    id: string
    content: string
    created_at: string
  }
  error?: string
  code?: string
}

export interface EndSessionInput {
  sessionId: string
}

export interface EndSessionResponse {
  success: boolean
  session?: BrainstormSession
  error?: string
}

export interface ToggleSessionPauseInput {
  sessionId: string
}

export interface ToggleSessionPauseResponse {
  success: boolean
  session?: BrainstormSession
  error?: string
}

// Real-time event types
export interface BrainstormRealtimeConfig {
  sessionId: string
  onIdeaCreated: (idea: any) => void
  onIdeaUpdated: (idea: any) => void
  onIdeaDeleted: (ideaId: string) => void
  onParticipantJoined: (participant: SessionParticipant) => void
  onParticipantLeft: (participantId: string) => void
  /** Called when participant data is updated (e.g., contribution_count changes) */
  onParticipantUpdated?: (participant: SessionParticipant) => void
  onSessionStateChanged: (state: { status: string; timeRemaining: number }) => void
  /** Called when realtime connection fails after max reconnect attempts - enables polling fallback */
  onConnectionFailed?: () => void
}

export interface SessionState {
  status: 'active' | 'paused' | 'completed' | 'archived'
  timeRemaining: number // milliseconds
}

// Database query response types (for repositories)
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}
