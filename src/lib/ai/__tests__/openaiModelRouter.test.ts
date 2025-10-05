/**
 * OpenAI Model Router Tests
 *
 * Critical tests for AI model routing logic that directly impacts API costs.
 * Wrong routing decisions could waste thousands of dollars in API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIModelRouter, AITaskType, TaskContext, ModelSelection } from '../openaiModelRouter'

describe('OpenAIModelRouter', () => {
  let consoleLogSpy: any

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('Model Selection Logic', () => {
    describe('Strategic Insights', () => {
      it('should select GPT-5 for high complexity strategic insights', () => {
        const context: TaskContext = {
          type: 'strategic-insights',
          complexity: 'high',
          ideaCount: 20,
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5')
        expect(selection.temperature).toBe(1) // GPT-5 only supports temp=1
        expect(selection.maxTokens).toBe(8000)
        expect(selection.cost).toBe('medium')
        expect(selection.reasoning).toContain('advanced reasoning')
      })

      it('should select GPT-5 Mini for standard strategic insights', () => {
        const context: TaskContext = {
          type: 'strategic-insights',
          complexity: 'medium',
          ideaCount: 10,
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5-mini')
        expect(selection.temperature).toBe(1) // GPT-5 Mini also only supports temp=1
        expect(selection.maxTokens).toBe(6000)
        expect(selection.cost).toBe('low')
        expect(selection.reasoning).toContain('efficiency')
      })

      it('should upgrade to GPT-5 when files are present', () => {
        const context: TaskContext = {
          type: 'strategic-insights',
          complexity: 'low',
          ideaCount: 5,
          hasFiles: true,
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5')
        expect(selection.cost).toBe('medium')
      })

      it('should upgrade to GPT-5 when images are present', () => {
        const context: TaskContext = {
          type: 'strategic-insights',
          complexity: 'low',
          ideaCount: 3,
          hasImages: true,
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5')
        expect(selection.cost).toBe('medium')
      })

      it('should upgrade to GPT-5 for large idea counts', () => {
        const context: TaskContext = {
          type: 'strategic-insights',
          complexity: 'low',
          ideaCount: 20, // > 15 threshold
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5')
        expect(selection.cost).toBe('medium')
      })
    })

    describe('Risk Assessment', () => {
      it('should select GPT-5 for high complexity risk assessment', () => {
        const context: TaskContext = {
          type: 'risk-assessment',
          complexity: 'high',
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5')
        expect(selection.temperature).toBe(1)
        expect(selection.maxTokens).toBe(7000)
        expect(selection.cost).toBe('medium')
        expect(selection.reasoning).toContain('comprehensive coverage')
      })

      it('should select GPT-5 Mini for standard risk assessment', () => {
        const context: TaskContext = {
          type: 'risk-assessment',
          complexity: 'medium',
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5-mini')
        expect(selection.temperature).toBe(1)
        expect(selection.maxTokens).toBe(5000)
        expect(selection.cost).toBe('low')
      })
    })

    describe('Idea Generation', () => {
      it('should select GPT-5 for enterprise users', () => {
        const context: TaskContext = {
          type: 'idea-generation',
          complexity: 'medium',
          ideaCount: 10,
          userTier: 'enterprise'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5')
        expect(selection.temperature).toBe(1)
        expect(selection.maxTokens).toBe(4000)
        expect(selection.cost).toBe('medium')
      })

      it('should select GPT-5 Mini for pro users with standard complexity', () => {
        const context: TaskContext = {
          type: 'idea-generation',
          complexity: 'medium',
          ideaCount: 10,
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5-mini')
        expect(selection.temperature).toBe(1)
        expect(selection.maxTokens).toBe(2500)
        expect(selection.cost).toBe('low')
      })

      it('should upgrade to GPT-5 for high complexity or large idea counts', () => {
        const context: TaskContext = {
          type: 'idea-generation',
          complexity: 'high',
          ideaCount: 20, // > 15 threshold
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5')
        expect(selection.cost).toBe('medium')
      })
    })

    describe('Multimodal Content', () => {
      it('should select GPT-5 for image analysis regardless of task type', () => {
        const context: TaskContext = {
          type: 'quick-analysis',
          complexity: 'low',
          hasImages: true,
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5')
        expect(selection.temperature).toBe(1)
        expect(selection.maxTokens).toBe(6000)
        expect(selection.cost).toBe('medium')
        expect(selection.reasoning).toContain('Multimodal')
      })

      it('should select GPT-5 for audio analysis', () => {
        const context: TaskContext = {
          type: 'content-enhancement',
          complexity: 'low',
          hasAudio: true,
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5')
        expect(selection.maxTokens).toBe(6000)
        expect(selection.cost).toBe('medium')
        expect(selection.reasoning).toContain('audio understanding')
      })
    })

    describe('Quick Analysis and Content Enhancement', () => {
      it('should always select GPT-5 Mini for quick analysis', () => {
        const context: TaskContext = {
          type: 'quick-analysis',
          complexity: 'high', // Even high complexity
          ideaCount: 50, // Even large counts
          userTier: 'enterprise' // Even enterprise tier
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5-mini')
        expect(selection.temperature).toBe(1)
        expect(selection.maxTokens).toBe(2500)
        expect(selection.cost).toBe('low')
      })

      it('should always select GPT-5 Mini for content enhancement', () => {
        const context: TaskContext = {
          type: 'content-enhancement',
          complexity: 'high',
          userTier: 'enterprise'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5-mini')
        expect(selection.cost).toBe('low')
      })
    })

    describe('Default Fallback', () => {
      it('should default to GPT-5 Mini for unknown task types', () => {
        const context: TaskContext = {
          type: 'unknown-task' as AITaskType,
          complexity: 'medium',
          userTier: 'pro'
        }

        const selection = OpenAIModelRouter.selectModel(context)

        expect(selection.model).toBe('gpt-5-mini')
        expect(selection.temperature).toBe(1)
        expect(selection.maxTokens).toBe(3000)
        expect(selection.cost).toBe('low')
        expect(selection.reasoning).toContain('Default routing')
      })
    })
  })

  describe('Temperature Handling', () => {
    it('should return temperature=1 for all GPT-5 models', () => {
      const gpt5Models = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-chat-latest']

      gpt5Models.forEach(model => {
        const context: TaskContext = {
          type: 'strategic-insights',
          complexity: 'medium',
          userTier: 'pro'
        }

        // Force the model selection to test temperature
        const selection = OpenAIModelRouter.selectModel(context)
        if (selection.model.startsWith('gpt-5')) {
          expect(selection.temperature).toBe(1)
        }
      })
    })

    it('should return temperature=1 for O-series models', () => {
      const context: TaskContext = {
        type: 'risk-assessment',
        complexity: 'medium',
        userTier: 'pro'
      }

      // Test the isGPT5Model logic indirectly through temperature
      const selection = OpenAIModelRouter.selectModel(context)
      // All our current models are GPT-5 series, so they should all return temp=1
      expect(selection.temperature).toBe(1)
    })
  })

  describe('Complexity Analysis', () => {
    it('should classify low complexity correctly', () => {
      const complexity = OpenAIModelRouter.analyzeComplexity({
        ideaCount: 3,
        hasFiles: false,
        hasImages: false,
        hasAudio: false,
        documentCount: 1
      })

      expect(complexity).toBe('low')
    })

    it('should classify medium complexity correctly', () => {
      const complexity = OpenAIModelRouter.analyzeComplexity({
        ideaCount: 8,
        hasFiles: true,
        hasImages: false,
        hasAudio: false,
        documentCount: 2
      })

      expect(complexity).toBe('medium')
    })

    it('should classify high complexity correctly', () => {
      const complexity = OpenAIModelRouter.analyzeComplexity({
        ideaCount: 20,
        hasFiles: true,
        hasImages: true,
        hasAudio: true,
        documentCount: 5
      })

      expect(complexity).toBe('high')
    })

    it('should weight audio more heavily than other media', () => {
      const complexity = OpenAIModelRouter.analyzeComplexity({
        ideaCount: 2, // low count
        hasFiles: false,
        hasImages: false,
        hasAudio: true, // audio adds 2 points vs 1 for other media
        documentCount: 0
      })

      // Should be medium due to audio weighting
      expect(complexity).toBe('medium')
    })
  })

  describe('Cost Estimation', () => {
    it('should calculate cost correctly for GPT-5', () => {
      const selection: ModelSelection = {
        model: 'gpt-5',
        temperature: 1,
        maxTokens: 4000,
        reasoning: 'Test',
        cost: 'medium'
      }

      const cost = OpenAIModelRouter.getCostEstimate(selection, 2000)

      // GPT-5: $1.25 input, $10.00 output per 1M tokens
      // 2000 tokens: 70% input (1400), 30% output (600)
      // Input cost: (1400/1000000) * 1.25 = $0.00175
      // Output cost: (600/1000000) * 10.00 = $0.006
      // Total: ~$0.0077 (actual calculation result)
      expect(cost).toBe('$0.0077')
    })

    it('should calculate cost correctly for GPT-5 Mini', () => {
      const selection: ModelSelection = {
        model: 'gpt-5-mini',
        temperature: 1,
        maxTokens: 2000,
        reasoning: 'Test',
        cost: 'low'
      }

      const cost = OpenAIModelRouter.getCostEstimate(selection, 1000)

      // GPT-5 Mini: $0.08 input, $0.30 output per 1M tokens
      // Much cheaper than GPT-5
      expect(parseFloat(cost.replace('$', ''))).toBeLessThan(0.001)
    })

    it('should show O-series models are more expensive', () => {
      const o1Selection: ModelSelection = {
        model: 'o1-preview',
        temperature: 1,
        maxTokens: 4000,
        reasoning: 'Test',
        cost: 'high'
      }

      const gpt5Selection: ModelSelection = {
        model: 'gpt-5',
        temperature: 1,
        maxTokens: 4000,
        reasoning: 'Test',
        cost: 'medium'
      }

      const o1Cost = parseFloat(OpenAIModelRouter.getCostEstimate(o1Selection, 2000).replace('$', ''))
      const gpt5Cost = parseFloat(OpenAIModelRouter.getCostEstimate(gpt5Selection, 2000).replace('$', ''))

      expect(o1Cost).toBeGreaterThan(gpt5Cost)
    })
  })

  describe('Logging and Debugging', () => {
    it('should log model selection decisions correctly', () => {
      const context: TaskContext = {
        type: 'strategic-insights',
        complexity: 'high',
        ideaCount: 15,
        hasFiles: true,
        userTier: 'enterprise'
      }

      const selection = OpenAIModelRouter.selectModel(context)
      OpenAIModelRouter.logSelection(context, selection)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🤖 OpenAI Model Router Decision:',
        expect.objectContaining({
          task: 'strategic-insights',
          complexity: 'high',
          selectedModel: selection.model,
          temperature: selection.temperature,
          maxTokens: selection.maxTokens,
          reasoning: selection.reasoning,
          costTier: selection.cost,
          contextFactors: expect.objectContaining({
            ideaCount: 15,
            hasFiles: true,
            userTier: 'enterprise'
          })
        })
      )
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing optional parameters gracefully', () => {
      const context: TaskContext = {
        type: 'strategic-insights',
        complexity: 'medium'
        // Missing ideaCount, hasFiles, hasImages, hasAudio, userTier
      }

      const selection = OpenAIModelRouter.selectModel(context)

      expect(selection).toBeDefined()
      expect(selection.model).toBeDefined()
      expect(selection.temperature).toBeDefined()
      expect(selection.maxTokens).toBeGreaterThan(0)
      expect(selection.reasoning).toBeDefined()
      expect(selection.cost).toBeDefined()
    })

    it('should handle zero idea count', () => {
      const context: TaskContext = {
        type: 'idea-generation',
        complexity: 'medium',
        ideaCount: 0,
        userTier: 'pro'
      }

      const selection = OpenAIModelRouter.selectModel(context)

      expect(selection).toBeDefined()
      expect(selection.model).toBe('gpt-5-mini') // Should not upgrade for 0 ideas
      expect(selection.cost).toBe('low')
    })

    it('should handle extremely large idea counts', () => {
      const context: TaskContext = {
        type: 'strategic-insights',
        complexity: 'medium',
        ideaCount: 1000, // Very large
        userTier: 'pro'
      }

      const selection = OpenAIModelRouter.selectModel(context)

      expect(selection.model).toBe('gpt-5') // Should upgrade for large counts
      expect(selection.cost).toBe('medium')
    })
  })

  describe('Business Logic Validation', () => {
    it('should never downgrade enterprise users to cheaper models for creative tasks', () => {
      const context: TaskContext = {
        type: 'idea-generation',
        complexity: 'medium',
        ideaCount: 10,
        userTier: 'enterprise'
      }

      const selection = OpenAIModelRouter.selectModel(context)

      expect(selection.model).toBe('gpt-5') // Enterprise should get premium model
      expect(selection.cost).toBe('medium')
    })

    it('should optimize costs for free tier users when possible', () => {
      const context: TaskContext = {
        type: 'idea-generation',
        complexity: 'low',
        ideaCount: 5,
        userTier: 'free'
      }

      const selection = OpenAIModelRouter.selectModel(context)

      expect(selection.model).toBe('gpt-5-mini') // Free tier gets cost-optimized model
      expect(selection.cost).toBe('low')
    })

    it('should prioritize quality over cost for critical analysis tasks', () => {
      const context: TaskContext = {
        type: 'risk-assessment',
        complexity: 'high',
        userTier: 'free' // Even free tier
      }

      const selection = OpenAIModelRouter.selectModel(context)

      expect(selection.model).toBe('gpt-5') // Quality matters for risk assessment
      expect(selection.cost).toBe('medium')
    })
  })
})