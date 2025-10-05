/**
 * Insights Validation Utilities
 * Validates and normalizes AI-generated insights data
 */

import { IdeaCard } from '../../../types'

/**
 * Validate insights response structure
 * @param insights - Raw insights data
 * @returns Boolean indicating if structure is valid
 */
export function validateInsightsStructure(insights: any): boolean {
  if (!insights || typeof insights !== 'object') {
    return false
  }

  // Check for required top-level properties
  const hasValidStructure =
    'executiveSummary' in insights ||
    'keyInsights' in insights ||
    'suggestedRoadmap' in insights

  return hasValidStructure
}

/**
 * Validate roadmap response structure
 * @param roadmap - Raw roadmap data
 * @returns Boolean indicating if structure is valid
 */
export function validateRoadmapStructure(roadmap: any): boolean {
  if (!roadmap || typeof roadmap !== 'object') {
    return false
  }

  // Check for phases array
  if (!Array.isArray(roadmap.phases)) {
    return false
  }

  // Validate phase structure
  return roadmap.phases.every((phase: any) =>
    phase &&
    typeof phase === 'object' &&
    'phase' in phase &&
    'focus' in phase
  )
}

/**
 * Normalize insights response to consistent structure
 * @param insights - Raw insights data
 * @param ideas - Associated idea cards
 * @returns Normalized insights object
 */
export function normalizeInsights(insights: any, ideas: IdeaCard[]): any {
  return {
    executiveSummary: insights.executiveSummary || insights.summary ||
      `Analysis of ${ideas.length} ideas for strategic planning and prioritization.`,

    keyInsights: Array.isArray(insights.keyInsights) ? insights.keyInsights :
      Array.isArray(insights.insights) ? insights.insights : [],

    suggestedRoadmap: Array.isArray(insights.suggestedRoadmap) ? insights.suggestedRoadmap :
      Array.isArray(insights.roadmap) ? insights.roadmap : [],

    priorityRecommendations: insights.priorityRecommendations || insights.priorities || {
      immediate: [],
      shortTerm: [],
      longTerm: []
    },

    riskAssessment: insights.riskAssessment || insights.risks || {
      highRisk: [],
      opportunities: []
    },

    nextSteps: Array.isArray(insights.nextSteps) ? insights.nextSteps :
      Array.isArray(insights.actions) ? insights.actions : []
  }
}

/**
 * Normalize roadmap response to consistent structure
 * @param roadmap - Raw roadmap data
 * @param projectName - Project name for context
 * @returns Normalized roadmap object
 */
export function normalizeRoadmap(roadmap: any, projectName: string): any {
  return {
    title: roadmap.title || `${projectName} Implementation Roadmap`,
    overview: roadmap.overview || roadmap.summary ||
      `Strategic implementation roadmap for ${projectName}`,

    phases: Array.isArray(roadmap.phases) ? roadmap.phases :
      Array.isArray(roadmap.milestones) ? roadmap.milestones : [],

    timeline: roadmap.timeline || {
      startDate: new Date().toISOString(),
      estimatedDuration: '6-12 months'
    },

    team: roadmap.team || roadmap.resources || {
      size: 'TBD',
      roles: []
    },

    risks: roadmap.risks || roadmap.challenges || [],

    successMetrics: roadmap.successMetrics || roadmap.kpis || []
  }
}

/**
 * Extract key insights from text content
 * @param content - Text content to analyze
 * @param maxInsights - Maximum number of insights to extract
 * @returns Array of insight objects
 */
export function extractKeyInsights(content: string, maxInsights: number = 5): any[] {
  // Split content into sentences
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20)

  // Take the most substantial sentences as insights
  return sentences
    .slice(0, maxInsights)
    .map((insight, index) => ({
      insight: insight,
      impact: index < 2 ? 'High' : index < 4 ? 'Medium' : 'Low',
      category: 'Strategic',
      priority: index + 1
    }))
}

/**
 * Validate idea card structure
 * @param idea - Idea card to validate
 * @returns Boolean indicating if idea is valid
 */
export function validateIdeaCard(idea: any): idea is IdeaCard {
  return (
    idea &&
    typeof idea === 'object' &&
    typeof idea.content === 'string' &&
    typeof idea.x === 'number' &&
    typeof idea.y === 'number' &&
    typeof idea.quadrant === 'string'
  )
}

/**
 * Filter and validate array of idea cards
 * @param ideas - Array of ideas to validate
 * @returns Filtered array of valid idea cards
 */
export function validateIdeaCards(ideas: any[]): IdeaCard[] {
  if (!Array.isArray(ideas)) {
    return []
  }

  return ideas.filter(validateIdeaCard)
}
