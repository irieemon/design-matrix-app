export interface IdeaCard {
  id: string
  content: string
  details: string  // additional details about the idea
  x: number  // pixel position (0-520 usable area)
  y: number  // pixel position (0-520 usable area)
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
  created_by: string  // user name who created the idea
  created_at: string
  updated_at: string
  editing_by?: string | null  // user currently editing this card
  editing_at?: string | null  // when editing started
  is_collapsed?: boolean  // whether card shows minimal info
  project_id?: string  // associated project ID
}

export interface User {
  id: string
  name: string
  created_at: string
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
  start_date?: string
  target_date?: string
  budget?: number
  team_size?: number
  priority_level: 'low' | 'medium' | 'high' | 'critical'
  tags?: string[]
  created_by: string
  created_at: string
  updated_at: string
  is_ai_generated?: boolean
  ai_analysis?: {
    industry: string
    scope: string
    timeline: string
    primaryGoals: string[]
  }
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