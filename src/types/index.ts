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

export interface AuthUser {
  id: string
  email: string
  email_confirmed_at?: string
  phone?: string
  last_sign_in_at?: string
  role?: string
  user_metadata?: any
}

export interface Team {
  id: string
  name: string
  description?: string
  avatar_url?: string
  owner_id: string
  settings?: any
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

export interface ActivityLog {
  id: string
  user_id?: string
  project_id?: string
  team_id?: string
  activity_type: ActivityType
  metadata?: any
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
  settings?: any
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

export interface ProjectInsights {
  id: string
  project_id: string
  version: number
  name: string
  insights_data: any // Will store the analytics/insights JSON
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