/**
 * OpenAI Model Router
 *
 * Intelligently routes AI requests to the optimal OpenAI model based on:
 * - Task complexity and type
 * - Cost optimization
 * - Performance requirements
 */

export type AITaskType =
  | 'strategic-insights'    // Complex reasoning, multi-faceted analysis
  | 'idea-generation'       // Creative, rapid ideation
  | 'risk-assessment'       // Conservative, thorough analysis
  | 'quick-analysis'        // Fast, simple processing
  | 'roadmap-planning'      // Structured, sequential thinking
  | 'content-enhancement'   // Text improvement, refinement

export type OpenAIModel =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'o1-preview'
  | 'o1-mini'

export interface ModelSelection {
  model: OpenAIModel
  temperature: number
  maxTokens: number
  reasoning: string
  cost: 'low' | 'medium' | 'high'
}

export interface TaskContext {
  type: AITaskType
  complexity: 'low' | 'medium' | 'high'
  ideaCount?: number
  hasFiles?: boolean
  hasImages?: boolean
  hasAudio?: boolean
  userTier?: 'free' | 'pro' | 'enterprise'
}

/**
 * Smart OpenAI Model Router
 * Routes requests to optimal model based on task requirements
 */
export class OpenAIModelRouter {

  /**
   * Select the optimal model and parameters for a given task
   */
  static selectModel(context: TaskContext): ModelSelection {
    const { type, complexity, ideaCount = 0, hasFiles = false, hasImages = false, hasAudio = false, userTier = 'pro' } = context

    // Strategic insights require deep reasoning - always use gpt-4o with high token limit
    if (type === 'strategic-insights') {
      return {
        model: 'gpt-4o',
        temperature: this.getTemperatureForTask(type, complexity),
        maxTokens: complexity === 'high' ? 6000 : 4000,
        reasoning: 'Strategic insights require advanced reasoning and multi-faceted analysis. GPT-4o excels at complex strategic thinking.',
        cost: 'high'
      }
    }

    // Risk assessment needs conservative, thorough analysis - use gpt-4o with enhanced token limit
    if (type === 'risk-assessment') {
      return {
        model: 'gpt-4o',
        temperature: 0.3, // Lower temperature for conservative analysis
        maxTokens: complexity === 'high' ? 5000 : 4000, // Increased for comprehensive risk analysis
        reasoning: 'Risk assessment requires careful, conservative analysis with comprehensive coverage. GPT-4o with enhanced token limit provides thorough risk evaluation.',
        cost: 'high'
      }
    }

    // Roadmap planning benefits from structured thinking - use gpt-4o for complex projects
    if (type === 'roadmap-planning') {
      const useAdvancedModel = complexity === 'high' || ideaCount > 10 || hasFiles
      return {
        model: useAdvancedModel ? 'gpt-4o' : 'gpt-4o-mini',
        temperature: 0.6,
        maxTokens: useAdvancedModel ? 3500 : 2500,
        reasoning: useAdvancedModel
          ? 'Complex roadmap planning with multiple ideas or files requires advanced reasoning.'
          : 'Simple roadmap planning can be handled efficiently by gpt-4o-mini.',
        cost: useAdvancedModel ? 'high' : 'medium'
      }
    }

    // Multimodal content (images/audio) requires gpt-4o
    if (hasImages || hasAudio) {
      return {
        model: 'gpt-4o',
        temperature: this.getTemperatureForTask(type, complexity),
        maxTokens: 4000,
        reasoning: 'Multimodal content analysis (images, audio) requires GPT-4o capabilities.',
        cost: 'high'
      }
    }

    // Idea generation can often use gpt-4o-mini for cost efficiency
    if (type === 'idea-generation') {
      const useAdvancedModel = complexity === 'high' || ideaCount > 15 || userTier === 'enterprise'
      return {
        model: useAdvancedModel ? 'gpt-4o' : 'gpt-4o-mini',
        temperature: 1.0, // High creativity for idea generation
        maxTokens: useAdvancedModel ? 3000 : 2000,
        reasoning: useAdvancedModel
          ? 'Complex idea generation or enterprise users benefit from GPT-4o creativity.'
          : 'Standard idea generation is cost-effectively handled by gpt-4o-mini.',
        cost: useAdvancedModel ? 'high' : 'low'
      }
    }

    // Quick analysis and content enhancement can use gpt-4o-mini
    if (type === 'quick-analysis' || type === 'content-enhancement') {
      return {
        model: 'gpt-4o-mini',
        temperature: this.getTemperatureForTask(type, complexity),
        maxTokens: 2000,
        reasoning: 'Quick analysis and content enhancement are efficiently handled by gpt-4o-mini.',
        cost: 'low'
      }
    }

    // Default fallback - use gpt-4o-mini for unknown tasks
    return {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 2500,
      reasoning: 'Default routing to cost-effective gpt-4o-mini for standard tasks.',
      cost: 'medium'
    }
  }

  /**
   * Get optimal temperature based on task type and complexity
   */
  private static getTemperatureForTask(type: AITaskType, complexity: 'low' | 'medium' | 'high'): number {
    const baseTemperatures: Record<AITaskType, number> = {
      'strategic-insights': 0.7,     // Balanced creativity and accuracy
      'idea-generation': 1.0,        // High creativity
      'risk-assessment': 0.3,        // Conservative, focused
      'quick-analysis': 0.6,         // Moderate, efficient
      'roadmap-planning': 0.6,       // Structured, moderate creativity
      'content-enhancement': 0.5     // Focused improvement
    }

    const base = baseTemperatures[type] || 0.7

    // Adjust based on complexity
    switch (complexity) {
      case 'low': return Math.max(0.1, base - 0.2)
      case 'high': return Math.min(1.2, base + 0.2)
      default: return base
    }
  }

  /**
   * Determine task complexity based on context
   */
  static analyzeComplexity(context: {
    ideaCount: number
    hasFiles: boolean
    hasImages: boolean
    hasAudio: boolean
    projectType?: string
    documentCount?: number
  }): 'low' | 'medium' | 'high' {
    const { ideaCount, hasFiles, hasImages, hasAudio, documentCount = 0 } = context

    let complexityScore = 0

    // Idea count scoring
    if (ideaCount <= 5) complexityScore += 1
    else if (ideaCount <= 15) complexityScore += 2
    else complexityScore += 3

    // File complexity scoring
    if (hasFiles) complexityScore += 1
    if (hasImages) complexityScore += 1
    if (hasAudio) complexityScore += 2
    if (documentCount > 3) complexityScore += 1

    // Determine complexity level
    if (complexityScore <= 2) return 'low'
    if (complexityScore <= 4) return 'medium'
    return 'high'
  }

  /**
   * Get cost estimate for a model selection
   */
  static getCostEstimate(selection: ModelSelection, tokensEstimate: number = 2000): string {
    const costs: Record<OpenAIModel, { input: number; output: number }> = {
      'gpt-4o': { input: 5.00, output: 15.00 }, // per 1M tokens
      'gpt-4o-mini': { input: 0.15, output: 0.60 }, // per 1M tokens
      'gpt-4-turbo': { input: 10.00, output: 30.00 }, // per 1M tokens
      'gpt-4': { input: 30.00, output: 60.00 }, // per 1M tokens
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 }, // per 1M tokens
      'o1-preview': { input: 15.00, output: 60.00 }, // per 1M tokens
      'o1-mini': { input: 3.00, output: 12.00 } // per 1M tokens
    }

    const modelCost = costs[selection.model]
    const inputCost = (tokensEstimate * 0.7) / 1000000 * modelCost.input
    const outputCost = (tokensEstimate * 0.3) / 1000000 * modelCost.output
    const totalCost = inputCost + outputCost

    return `$${totalCost.toFixed(4)}`
  }

  /**
   * Log model selection decision for debugging
   */
  static logSelection(context: TaskContext, selection: ModelSelection): void {
    console.log('🤖 OpenAI Model Router Decision:', {
      task: context.type,
      complexity: context.complexity,
      selectedModel: selection.model,
      temperature: selection.temperature,
      maxTokens: selection.maxTokens,
      reasoning: selection.reasoning,
      costTier: selection.cost,
      contextFactors: {
        ideaCount: context.ideaCount,
        hasFiles: context.hasFiles,
        hasImages: context.hasImages,
        hasAudio: context.hasAudio,
        userTier: context.userTier
      }
    })
  }
}