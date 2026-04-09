/**
 * Canonical quadrant calculation for the prioritization matrix.
 *
 * Coordinate system: stored 0–520 range, center at 260 (maps to 50% visually
 * after the ((coord + 40) / 600) * 100 percentage conversion used at render time).
 */

export type Quadrant = 'quick-wins' | 'strategic' | 'reconsider' | 'avoid'

const CENTER = 260

export function calculateQuadrant(x: number, y: number): Quadrant {
  if (x < CENTER && y < CENTER) return 'quick-wins'
  if (x >= CENTER && y < CENTER) return 'strategic'
  if (x < CENTER && y >= CENTER) return 'reconsider'
  return 'avoid'
}

export const QUADRANT_COLORS: Record<Quadrant, string> = {
  'quick-wins': '#10B981',
  'strategic': '#3B82F6',
  'reconsider': '#F59E0B',
  'avoid': '#EF4444',
}

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  'quick-wins': 'Quick Wins',
  'strategic': 'Strategic',
  'reconsider': 'Reconsider',
  'avoid': 'Avoid',
}
