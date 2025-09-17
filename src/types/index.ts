export interface IdeaCard {
  id: string
  content: string
  details: string  // additional details about the idea
  x: number  // pixel position (0-520 usable area)
  y: number  // pixel position (0-520 usable area)
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
  created_by: string | null  // user ID who created the idea (null for legacy)
  created_at: string
  updated_at: string
  editing_by?: string | null  // user ID currently editing this card
  editing_at?: string | null  // when editing started
  is_collapsed?: boolean  // whether card shows minimal info
  project_id?: string  // associated project ID
}

export type UserRole = 'user' | 'admin' | 'super_admin'

export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  company?: string
  job_title?: string
  timezone?: string
  role?: UserRole
  is_active?: boolean
  last_login?: string
  notification_preferences?: {
    email_notifications: boolean
    push_notifications: boolean
  }
  created_at: string
  updated_at: string
}

export interface UserMetadata {
  full_name?: string
  avatar_url?: string
  provider?: string
  sub?: string
  [key: string]: unknown
}

export interface AuthUser {
  id: string
  email: string
  email_confirmed_at?: string
  phone?: string
  last_sign_in_at?: string
  role?: string
  user_metadata?: UserMetadata
}

export interface TeamSettings {
  visibility: 'private' | 'internal' | 'public'
  allow_member_invites: boolean
  default_project_role: ProjectRole
  notification_preferences: {
    new_members: boolean
    project_updates: boolean
    weekly_digest: boolean
  }
}

export interface Team {
  id: string
  name: string
  description?: string
  avatar_url?: string
  owner_id: string
  settings?: TeamSettings
  created_at: string
  updated_at: string
}

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  invited_by?: string
  invited_at: string
  joined_at?: string
  user?: User
}

export type ProjectRole = 'owner' | 'editor' | 'commenter' | 'viewer'

export interface ProjectCollaborator {
  id: string
  project_id: string
  user_id: string
  role: ProjectRole
  invited_by?: string
  invited_at: string
  accepted_at?: string
  user?: User
}

export type InvitationType = 'team' | 'project'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export interface Invitation {
  id: string
  email: string
  type: InvitationType
  team_id?: string
  project_id?: string
  invited_by: string
  role: string
  status: InvitationStatus
  token: string
  expires_at: string
  created_at: string
  accepted_at?: string
  inviter?: User
  team?: Team
  project?: Project
}

export type ActivityType = 'project_created' | 'project_updated' | 'idea_created' | 'idea_updated' | 'idea_deleted' | 'user_joined' | 'user_invited' | 'comment_added'

export interface ActivityMetadata {
  project_name?: string
  idea_title?: string
  old_value?: string
  new_value?: string
  file_name?: string
  comment_content?: string
  invitation_role?: string
  [key: string]: unknown
}

export interface ActivityLog {
  id: string
  user_id?: string
  project_id?: string
  team_id?: string
  activity_type: ActivityType
  metadata?: ActivityMetadata
  created_at: string
  user?: User
}

export type ProjectType = 
  | 'software'
  | 'business_plan' 
  | 'product_development'
  | 'marketing'
  | 'operations'
  | 'research'
  | 'other'

export type ProjectStatus = 'active' | 'completed' | 'paused' | 'archived'

export interface ProjectSettings {
  auto_save_interval: number // minutes
  enable_real_time_collaboration: boolean
  default_idea_priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
  matrix_view: {
    show_grid: boolean
    snap_to_grid: boolean
    grid_size: number
  }
  notifications: {
    idea_updates: boolean
    new_collaborators: boolean
    roadmap_changes: boolean
  }
  archive_completed_after: number // days, 0 = never
}

export interface Project {
  id: string
  name: string
  description?: string
  project_type: ProjectType
  status: ProjectStatus
  visibility: 'private' | 'team' | 'public'
  start_date?: string
  target_date?: string
  budget?: number
  team_size?: number
  priority_level: 'low' | 'medium' | 'high' | 'critical'
  tags?: string[]
  owner_id: string
  team_id?: string
  settings?: ProjectSettings
  created_at: string
  updated_at: string
  is_ai_generated?: boolean
  ai_analysis?: {
    industry: string
    scope: string
    timeline: string
    primaryGoals: string[]
  }
  owner?: User
  team?: Team
  collaborators?: ProjectCollaborator[]
  user_role?: ProjectRole
}

export interface Position {
  x: number
  y: number
}

export interface DragData {
  id: string
  position: Position
}

export type QuadrantType = 'quick-wins' | 'strategic' | 'avoid' | 'reconsider'

// Roadmap and Analytics types
export interface Epic {
  title: string
  description: string
  userStories: string[]
  deliverables: string[]
  priority: string
  complexity: string
  relatedIdeas: string[]
}

export interface Phase {
  phase: string
  duration: string
  description: string
  epics: Epic[]
  risks: string[]
  successCriteria: string[]
}

export interface Milestone {
  milestone: string
  timeline: string
  description: string
}

export interface RoadmapData {
  roadmapAnalysis: {
    totalDuration: string
    phases: Phase[]
  }
  executionStrategy: {
    methodology: string
    sprintLength: string
    teamRecommendations: string
    keyMilestones: Milestone[]
  }
}

export interface ProjectRoadmap {
  id: string
  project_id: string
  version: number
  name: string
  roadmap_data: RoadmapData
  created_by: string
  created_at: string
  ideas_analyzed: number
}

export interface InsightsData {
  summary: {
    total_ideas: number
    avg_priority_score: number
    completion_rate: number
    time_spent: number // hours
  }
  distribution: {
    by_priority: Record<string, number>
    by_quadrant: Record<QuadrantType, number>
    by_status: Record<string, number>
  }
  trends: {
    ideas_over_time: Array<{ date: string; count: number }>
    priority_changes: Array<{ date: string; priority: string; count: number }>
  }
  recommendations: string[]
  risk_factors: string[]
  generated_at: string
}

export interface ProjectInsights {
  id: string
  project_id: string
  version: number
  name: string
  insights_data: InsightsData
  created_by: string
  created_at: string
  ideas_analyzed: number
}

export interface Quadrant {
  id: QuadrantType
  title: string
  description: string
  color: string
  emoji: string
  bgColor: string
}

export type FileType = 'pdf' | 'doc' | 'docx' | 'txt' | 'md' | 'image' | 'other'

export interface AIAnalysis {
  summary: string
  key_insights: string[]
  extracted_text?: string
  visual_description?: string
  audio_transcript?: string
  relevance_score: number
  content_type: 'text' | 'image' | 'audio' | 'video' | 'mixed'
  analysis_model: string
  analysis_version: string
  analyzed_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  name: string
  original_name: string
  file_type: FileType
  file_size: number
  mime_type: string
  storage_path: string
  content_preview?: string // For text content that can be extracted
  file_data?: string // Base64 encoded file data for download
  ai_analysis?: AIAnalysis // Cached AI analysis results
  analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed' | 'skipped'
  uploaded_by: string
  created_at: string
  updated_at: string
  uploader?: User
}

// Admin-specific types
export interface PlatformStats {
  total_users: number
  active_users_30d: number
  total_projects: number
  active_projects: number
  total_ideas: number
  total_files: number
  total_file_size: number
  new_users_7d: number
  new_projects_7d: number
}

export interface AdminUser extends User {
  project_count: number
  idea_count: number
  file_count: number
  total_file_size: number
}

export interface AdminProject extends Project {
  idea_count: number
  file_count: number
  total_file_size: number
  collaborator_count: number
  last_activity?: string
}

// =============================================================================
// API Response Types & Error Handling
// =============================================================================

export type DatabaseErrorCode = 
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED' 
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'STORAGE_FULL'
  | 'DUPLICATE_KEY'
  | 'FOREIGN_KEY_VIOLATION'
  | 'UNKNOWN_ERROR'

export interface DatabaseError {
  code: DatabaseErrorCode
  message: string
  details?: Record<string, unknown>
  timestamp: string
}

export interface ValidationError {
  field: string
  message: string
  value?: unknown
}

export interface ApiError {
  type: 'validation' | 'authentication' | 'authorization' | 'database' | 'network' | 'server'
  message: string
  errors?: ValidationError[]
  code?: string
  statusCode?: number
}

// Generic API Response wrapper
export interface ApiResponse<TData = unknown> {
  data?: TData
  error?: ApiError
  success: boolean
  timestamp: string
  meta?: {
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }
}

// Specific API response types
export type IdeaResponse = ApiResponse<IdeaCard>
export type IdeasResponse = ApiResponse<IdeaCard[]>
export type ProjectResponse = ApiResponse<Project>
export type ProjectsResponse = ApiResponse<Project[]>
export type UserResponse = ApiResponse<User>
export type FileUploadResponse = ApiResponse<ProjectFile>

// =============================================================================
// Utility Types
// =============================================================================

// Make all properties of T required and non-nullable
export type Required<T> = {
  [P in keyof T]-?: NonNullable<T[P]>
}

// Create a type with only specified keys from T
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P]
}

// Create a type with all keys from T except specified keys
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

// Make specified properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// For creating new entities (without generated fields)
export type CreateIdeaInput = Omit<IdeaCard, 'id' | 'created_at' | 'updated_at' | 'editing_by' | 'editing_at'>
export type CreateProjectInput = Omit<Project, 'id' | 'created_at' | 'updated_at' | 'owner' | 'team' | 'collaborators' | 'user_role'>
export type CreateUserInput = Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login'>

// For updating entities (all fields optional except id)
export type UpdateIdeaInput = PartialBy<IdeaCard, keyof Omit<IdeaCard, 'id'>>
export type UpdateProjectInput = PartialBy<Project, keyof Omit<Project, 'id'>>
export type UpdateUserInput = PartialBy<User, keyof Omit<User, 'id'>>

// =============================================================================
// Database Query Types
// =============================================================================

export interface QueryOptions {
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filters?: Record<string, unknown>
}

export interface IdeaQueryOptions extends QueryOptions {
  projectId?: string
  priority?: IdeaCard['priority']
  quadrant?: QuadrantType
  editedBy?: string
  createdAfter?: string
  createdBefore?: string
}

export interface ProjectQueryOptions extends QueryOptions {
  status?: ProjectStatus
  type?: ProjectType
  ownerId?: string
  teamId?: string
  visibility?: Project['visibility']
}

// =============================================================================
// Event Types for Real-time Updates
// =============================================================================

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: RealtimeEventType
  new?: T
  old?: T
  table: string
  schema: string
  commit_timestamp: string
}

export interface IdeaRealtimePayload extends RealtimePayload<IdeaCard> {}
export interface ProjectRealtimePayload extends RealtimePayload<Project> {}

// =============================================================================
// Form Types
// =============================================================================

export interface FormState<T> {
  values: T
  errors: Record<keyof T, string>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
}

export type IdeaFormState = FormState<CreateIdeaInput>
export type ProjectFormState = FormState<CreateProjectInput>
export type UserProfileFormState = FormState<UpdateUserInput>