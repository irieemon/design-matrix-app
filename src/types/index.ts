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
}

export interface User {
  id: string
  name: string
  created_at: string
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