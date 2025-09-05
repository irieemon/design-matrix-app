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

export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  company?: string
  job_title?: string
  timezone?: string
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

export interface Quadrant {
  id: QuadrantType
  title: string
  description: string
  color: string
  emoji: string
  bgColor: string
}