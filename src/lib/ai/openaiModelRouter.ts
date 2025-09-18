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
  | 'gpt-5'
  | 'gpt-5-mini'
  | 'gpt-5-nano'
  | 'gpt-5-chat-latest'
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-4.1-nano'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'o1-preview'
  | 'o1-mini'
  | 'o3-deep-research'
  | 'o4-mini-deep-research'
  | 'gpt-realtime'

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

    // Strategic insights require deep reasoning - use GPT-5 for best results
    if (type === 'strategic-insights') {
      const useGPT5 = complexity === 'high' || ideaCount > 15 || hasFiles || hasImages
      return {
        model: useGPT5 ? 'gpt-5' : 'gpt-5-mini',
        temperature: this.getTemperatureForTask(type, complexity),
        maxTokens: useGPT5 ? 8000 : 6000, // GPT-5 can handle more tokens
        reasoning: useGPT5
          ? 'Strategic insights with high complexity require GPT-5\'s advanced reasoning and built-in thinking.'
          : 'Standard strategic insights benefit from GPT-5 Mini\'s efficiency and capability.',
        cost: useGPT5 ? 'medium' : 'low'
      }
    }

    // Risk assessment needs conservative, thorough analysis - use GPT-5 for best results
    if (type === 'risk-assessment') {
      return {
        model: complexity === 'high' ? 'gpt-5' : 'gpt-5-mini',
        temperature: 0.3, // Lower temperature for conservative analysis
        maxTokens: complexity === 'high' ? 7000 : 5000, // GPT-5 enhanced token limits
        reasoning: complexity === 'high'
          ? 'Complex risk assessment requires GPT-5\'s advanced reasoning for comprehensive coverage.'
          : 'Standard risk assessment benefits from GPT-5 Mini\'s efficient analysis.',
        cost: complexity === 'high' ? 'medium' : 'low'
      }
    }

    // Roadmap planning benefits from structured thinking - use GPT-5 for best results
    if (type === 'roadmap-planning') {
      const useAdvancedModel = complexity === 'high' || ideaCount > 10 || hasFiles
      return {
        model: useAdvancedModel ? 'gpt-5' : 'gpt-5-mini',
        temperature: 0.6,
        maxTokens: useAdvancedModel ? 5000 : 3500, // GPT-5 enhanced limits
        reasoning: useAdvancedModel
          ? 'Complex roadmap planning benefits from GPT-5\'s advanced reasoning and built-in thinking.'
          : 'Simple roadmap planning handled efficiently by GPT-5 Mini.',
        cost: useAdvancedModel ? 'medium' : 'low'
      }
    }

    // Multimodal content (images/audio) - GPT-5 excels at multimodal analysis
    if (hasImages || hasAudio) {
      return {
        model: 'gpt-5',
        temperature: this.getTemperatureForTask(type, complexity),
        maxTokens: 6000, // GPT-5 enhanced multimodal capacity
        reasoning: 'Multimodal content analysis benefits from GPT-5\'s advanced image and audio understanding.',
        cost: 'medium'
      }
    }

    // Idea generation benefits from GPT-5's creative thinking
    if (type === 'idea-generation') {
      const useAdvancedModel = complexity === 'high' || ideaCount > 15 || userTier === 'enterprise'
      return {
        model: useAdvancedModel ? 'gpt-5' : 'gpt-5-mini',
        temperature: 1.0, // High creativity for idea generation
        maxTokens: useAdvancedModel ? 4000 : 2500, // GPT-5 enhanced creative output
        reasoning: useAdvancedModel
          ? 'Complex idea generation benefits from GPT-5\'s advanced creative reasoning.'
          : 'Standard idea generation handled efficiently by GPT-5 Mini.',
        cost: useAdvancedModel ? 'medium' : 'low'
      }
    }

    // Quick analysis and content enhancement - GPT-5 Mini is perfect
    if (type === 'quick-analysis' || type === 'content-enhancement') {
      return {
        model: 'gpt-5-mini',
        temperature: this.getTemperatureForTask(type, complexity),
        maxTokens: 2500, // GPT-5 Mini enhanced capacity
        reasoning: 'Quick analysis and content enhancement benefit from GPT-5 Mini\'s efficiency and capability.',
        cost: 'low'
      }
    }

    // Default fallback - use GPT-5 Mini for unknown tasks (since it's performing well)
    return {
      model: 'gpt-5-mini',
      temperature: 0.7,
      maxTokens: 3000, // GPT-5 Mini enhanced default
      reasoning: 'Default routing to GPT-5 Mini for optimal performance and cost-effectiveness.',
      cost: 'low'
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
      // GPT-5 Series (2025) - Half input cost of GPT-4o
      'gpt-5': { input: 1.25, output: 10.00 }, // per 1M tokens
      'gpt-5-mini': { input: 0.08, output: 0.30 }, // per 1M tokens
      'gpt-5-nano': { input: 0.04, output: 0.15 }, // per 1M tokens
      'gpt-5-chat-latest': { input: 1.25, output: 10.00 }, // per 1M tokens

      // GPT-4.1 Series (2025) - Improved GPT-4o
      'gpt-4.1': { input: 4.00, output: 12.00 }, // per 1M tokens
      'gpt-4.1-mini': { input: 0.12, output: 0.50 }, // per 1M tokens
      'gpt-4.1-nano': { input: 0.06, output: 0.25 }, // per 1M tokens

      // GPT-4 Series
      'gpt-4o': { input: 5.00, output: 15.00 }, // per 1M tokens
      'gpt-4o-mini': { input: 0.15, output: 0.60 }, // per 1M tokens
      'gpt-4-turbo': { input: 10.00, output: 30.00 }, // per 1M tokens
      'gpt-4': { input: 30.00, output: 60.00 }, // per 1M tokens
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 }, // per 1M tokens

      // O-Series Reasoning Models
      'o1-preview': { input: 15.00, output: 60.00 }, // per 1M tokens
      'o1-mini': { input: 3.00, output: 12.00 }, // per 1M tokens
      'o3-deep-research': { input: 20.00, output: 80.00 }, // per 1M tokens
      'o4-mini-deep-research': { input: 8.00, output: 32.00 }, // per 1M tokens

      // Specialized Models
      'gpt-realtime': { input: 6.00, output: 18.00 } // per 1M tokens
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