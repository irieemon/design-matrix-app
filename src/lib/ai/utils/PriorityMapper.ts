/**
 * Priority Mapping Utilities
 * Maps impact and effort levels to priority classifications
 */

export type PriorityLevel = 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'

/**
 * Map impact and effort to priority level
 * @param impact - Impact level (Low/Medium/High/Very High)
 * @param effort - Effort level (Low/Medium/High/Very High)
 * @returns Priority level
 */
export function mapPriorityLevel(impact: string, effort: string): PriorityLevel {
  const impactLevel = impact.toLowerCase()
  const effortLevel = effort.toLowerCase()

  // Strategic: Very High impact, any effort
  if (impactLevel === 'very high' || impactLevel === 'critical') {
    return 'strategic'
  }

  // Innovation: High impact, High effort
  if (impactLevel === 'high' && (effortLevel === 'high' || effortLevel === 'very high')) {
    return 'innovation'
  }

  // High: High impact, Low-Medium effort
  if (impactLevel === 'high' && (effortLevel === 'low' || effortLevel === 'medium')) {
    return 'high'
  }

  // Moderate: Medium impact
  if (impactLevel === 'medium' || impactLevel === 'moderate') {
    return 'moderate'
  }

  // Low: Low impact
  return 'low'
}

/**
 * Get priority color based on priority level
 * @param priority - Priority level
 * @returns Hex color code
 */
export function getPriorityColor(priority: PriorityLevel): string {
  const colorMap: Record<PriorityLevel, string> = {
    strategic: '#dc3545',   // Red - Critical
    innovation: '#6610f2',  // Purple - Innovation
    high: '#fd7e14',        // Orange - High
    moderate: '#ffc107',    // Yellow - Moderate
    low: '#6c757d'          // Gray - Low
  }

  return colorMap[priority] || colorMap.low
}

/**
 * Get priority label with emoji
 * @param priority - Priority level
 * @returns Priority label with emoji
 */
export function getPriorityLabel(priority: PriorityLevel): string {
  const labelMap: Record<PriorityLevel, string> = {
    strategic: '🎯 Strategic',
    innovation: '💡 Innovation',
    high: '⚡ High Priority',
    moderate: '📊 Moderate',
    low: '📝 Low Priority'
  }

  return labelMap[priority] || labelMap.low
}
