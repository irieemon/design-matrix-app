/**
 * Quadrant Mapping Utilities
 * Maps impact/effort coordinates to Design Matrix quadrants
 */

/**
 * Get quadrant name from position coordinates
 * @param x - Horizontal position (-100 to 100)
 * @param y - Vertical position (-100 to 100)
 * @returns Quadrant name
 */
export function getQuadrantFromPosition(x: number, y: number): string {
  if (x >= 0 && y >= 0) return 'Quick Wins'
  if (x < 0 && y >= 0) return 'Big Bets'
  if (x >= 0 && y < 0) return 'Fill-ins'
  return 'Money Pit'
}

/**
 * Get position coordinates from quadrant name
 * @param quadrant - Quadrant name
 * @returns Position coordinates { x, y }
 */
export function getPositionFromQuadrant(quadrant: string): { x: number; y: number } {
  const quadrantPositions: Record<string, { x: number; y: number }> = {
    'Quick Wins': { x: 50, y: 50 },
    'Big Bets': { x: -50, y: 50 },
    'Fill-ins': { x: 50, y: -50 },
    'Money Pit': { x: -50, y: -50 }
  }

  return quadrantPositions[quadrant] || { x: 0, y: 0 }
}

/**
 * Map effort and impact to quadrant
 * @param effort - Effort level (Low/Medium/High)
 * @param impact - Impact level (Low/Medium/High)
 * @returns Quadrant name
 */
export function mapToQuadrant(effort: string, impact: string): string {
  const effortLevel = effort.toLowerCase()
  const impactLevel = impact.toLowerCase()

  // Quick Wins: Low effort, High impact
  if ((effortLevel === 'low' || effortLevel === 'medium') &&
      (impactLevel === 'high' || impactLevel === 'very high')) {
    return 'Quick Wins'
  }

  // Big Bets: High effort, High impact
  if ((effortLevel === 'high' || effortLevel === 'very high') &&
      (impactLevel === 'high' || impactLevel === 'very high')) {
    return 'Big Bets'
  }

  // Fill-ins: Low effort, Low impact
  if ((effortLevel === 'low' || effortLevel === 'medium') &&
      (impactLevel === 'low' || impactLevel === 'medium')) {
    return 'Fill-ins'
  }

  // Money Pit: High effort, Low impact
  return 'Money Pit'
}
