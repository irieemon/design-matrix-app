export interface IdeaCard {
  id: string
  content: string
  x: number  // pixel position (0-520 usable area)
  y: number  // pixel position (0-520 usable area)
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
  created_at: string
  updated_at: string
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