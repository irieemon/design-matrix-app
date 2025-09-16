import { useState, useCallback, useRef, useEffect } from 'react'
import { IdeaCard, Project } from '../types'
import { logger } from '../utils/logger'

// AI Suggestion types
export interface AISuggestion {
  id: string
  type: 'completion' | 'enhancement' | 'related' | 'priority' | 'category'
  text: string
  confidence: number
  context: string
  reasoning?: string
  actionable: boolean
  metadata?: Record<string, any>
}

export interface AutoCompletionSuggestion {
  id: string
  text: string
  completion: string
  score: number
  category: string
}

interface UseAISuggestionsOptions {
  project?: Project | null
  existingIdeas?: IdeaCard[]
  debounceMs?: number
  maxSuggestions?: number
  enableAutoCompletion?: boolean
  enableSmartSuggestions?: boolean
}

export const useAISuggestions = (options: UseAISuggestionsOptions = {}) => {
  const {
    project,
    existingIdeas = [],
    debounceMs = 300,
    maxSuggestions = 5,
    enableAutoCompletion = true,
    enableSmartSuggestions = true
  } = options

  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [autoCompletions, setAutoCompletions] = useState<AutoCompletionSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentInput, setCurrentInput] = useState('')
  
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  const suggestionCache = useRef<Map<string, AISuggestion[]>>(new Map())
  const completionCache = useRef<Map<string, AutoCompletionSuggestion[]>>(new Map())

  // Common business/tech keywords and patterns
  const businessKeywords = [
    'user experience', 'customer journey', 'market research', 'competitive analysis',
    'revenue optimization', 'cost reduction', 'process automation', 'digital transformation',
    'data analytics', 'performance metrics', 'user engagement', 'conversion rate',
    'scalability', 'security', 'compliance', 'integration', 'mobile optimization',
    'accessibility', 'personalization', 'recommendation system', 'machine learning',
    'artificial intelligence', 'cloud migration', 'API development', 'database optimization'
  ]

  const commonPatterns = [
    { pattern: /improve\s+(\w+)/i, suggestions: ['user interface', 'performance', 'accessibility', 'security'] },
    { pattern: /implement\s+(\w+)/i, suggestions: ['authentication', 'caching', 'monitoring', 'testing'] },
    { pattern: /optimize\s+(\w+)/i, suggestions: ['database queries', 'load times', 'memory usage', 'bandwidth'] },
    { pattern: /add\s+(\w+)/i, suggestions: ['new features', 'validation', 'error handling', 'logging'] },
    { pattern: /create\s+(\w+)/i, suggestions: ['dashboard', 'report', 'workflow', 'component'] },
    { pattern: /integrate\s+(\w+)/i, suggestions: ['third-party API', 'payment gateway', 'analytics', 'CRM'] }
  ]

  // Analyze input and generate contextual suggestions
  const analyzeInput = useCallback((input: string): AISuggestion[] => {
    const suggestions: AISuggestion[] = []
    const inputLower = input.toLowerCase()
    
    // Pattern-based suggestions
    commonPatterns.forEach(({ pattern, suggestions: patternSuggestions }) => {
      const match = input.match(pattern)
      if (match) {
        patternSuggestions.forEach((suggestion, index) => {
          suggestions.push({
            id: `pattern_${Date.now()}_${index}`,
            type: 'completion',
            text: `${match[0]} ${suggestion}`,
            confidence: 0.8 - (index * 0.1),
            context: 'Pattern-based suggestion',
            reasoning: `Detected pattern "${pattern.source}" and suggesting common continuations`,
            actionable: true
          })
        })
      }
    })

    // Keyword enhancement suggestions
    businessKeywords.forEach((keyword, index) => {
      if (keyword.toLowerCase().includes(inputLower) || inputLower.includes(keyword.toLowerCase())) {
        const relevanceScore = inputLower.length / keyword.length
        if (relevanceScore > 0.3) {
          suggestions.push({
            id: `keyword_${Date.now()}_${index}`,
            type: 'enhancement',
            text: `Consider focusing on ${keyword}`,
            confidence: Math.min(0.9, relevanceScore),
            context: 'Business domain expertise',
            reasoning: `This relates to important business concept: ${keyword}`,
            actionable: true,
            metadata: { keyword }
          })
        }
      }
    })

    // Related ideas from existing project
    if (existingIdeas.length > 0) {
      const relatedIdeas = existingIdeas.filter(idea => {
        const ideaText = (idea.content || '').toLowerCase()
        return inputLower.split(' ').some(word => 
          word.length > 3 && ideaText.includes(word)
        )
      }).slice(0, 3)

      relatedIdeas.forEach((idea, index) => {
        suggestions.push({
          id: `related_${idea.id}_${Date.now()}`,
          type: 'related',
          text: `Similar to: "${idea.content}"`,
          confidence: 0.7 - (index * 0.1),
          context: 'Existing project ideas',
          reasoning: 'Found similar idea in your current project',
          actionable: true,
          metadata: { relatedIdeaId: idea.id, priority: idea.priority }
        })
      })
    }

    // Priority suggestions based on input sentiment
    const urgentWords = ['urgent', 'critical', 'asap', 'immediately', 'priority', 'important']
    const hasUrgency = urgentWords.some(word => inputLower.includes(word))
    
    if (hasUrgency) {
      suggestions.push({
        id: `priority_${Date.now()}`,
        type: 'priority',
        text: 'Consider setting this as high priority',
        confidence: 0.85,
        context: 'Urgency detection',
        reasoning: 'Detected urgency keywords in the input',
        actionable: true,
        metadata: { suggestedPriority: 5 }
      })
    }

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions)
  }, [existingIdeas, maxSuggestions])

  // Generate auto-completion suggestions
  const generateAutoCompletions = useCallback((input: string): AutoCompletionSuggestion[] => {
    if (input.length < 3) return []
    
    const completions: AutoCompletionSuggestion[] = []
    const inputLower = input.toLowerCase()
    const words = input.split(' ')
    const lastWord = words[words.length - 1]

    // Business keyword completions
    businessKeywords.forEach((keyword, index) => {
      if (keyword.toLowerCase().startsWith(lastWord.toLowerCase()) && keyword.length > lastWord.length) {
        const prefix = words.slice(0, -1).join(' ')
        const completion = prefix ? `${prefix} ${keyword}` : keyword
        
        completions.push({
          id: `completion_${index}`,
          text: input,
          completion,
          score: 0.9 - (index * 0.01),
          category: 'business'
        })
      }
    })

    // Common phrase completions
    const commonPhrases = [
      'user interface design',
      'database performance optimization',
      'mobile app development',
      'customer feedback integration',
      'payment processing system',
      'data visualization dashboard',
      'automated testing framework',
      'security vulnerability assessment',
      'third-party API integration',
      'real-time notification system'
    ]

    commonPhrases.forEach((phrase, index) => {
      if (phrase.toLowerCase().startsWith(inputLower) && phrase.length > input.length) {
        completions.push({
          id: `phrase_${index}`,
          text: input,
          completion: phrase,
          score: 0.8 - (index * 0.02),
          category: 'common'
        })
      }
    })

    // Project-specific completions based on existing ideas
    existingIdeas.forEach((idea, index) => {
      const ideaText = idea.content || ''
      if (ideaText.toLowerCase().includes(inputLower) && ideaText.length > input.length) {
        completions.push({
          id: `project_${idea.id}`,
          text: input,
          completion: ideaText,
          score: 0.7 - (index * 0.05),
          category: 'project'
        })
      }
    })

    return completions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
  }, [existingIdeas, maxSuggestions])

  // Debounced suggestion generation
  const getSuggestions = useCallback((input: string) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    debounceTimeout.current = setTimeout(() => {
      if (input.trim().length === 0) {
        setSuggestions([])
        setAutoCompletions([])
        return
      }

      setIsLoading(true)
      setCurrentInput(input)

      try {
        // Check cache first
        const cacheKey = input.toLowerCase().trim()
        
        if (enableSmartSuggestions) {
          const cachedSuggestions = suggestionCache.current.get(cacheKey)
          if (cachedSuggestions) {
            setSuggestions(cachedSuggestions)
          } else {
            const newSuggestions = analyzeInput(input)
            suggestionCache.current.set(cacheKey, newSuggestions)
            setSuggestions(newSuggestions)
          }
        }

        if (enableAutoCompletion) {
          const cachedCompletions = completionCache.current.get(cacheKey)
          if (cachedCompletions) {
            setAutoCompletions(cachedCompletions)
          } else {
            const newCompletions = generateAutoCompletions(input)
            completionCache.current.set(cacheKey, newCompletions)
            setAutoCompletions(newCompletions)
          }
        }

        logger.debug('🤖 Generated AI suggestions:', {
          input,
          suggestions: suggestions.length,
          completions: autoCompletions.length
        })
      } catch (error) {
        logger.error('Error generating AI suggestions:', error)
        setSuggestions([])
        setAutoCompletions([])
      } finally {
        setIsLoading(false)
      }
    }, debounceMs)
  }, [analyzeInput, generateAutoCompletions, debounceMs, enableSmartSuggestions, enableAutoCompletion, suggestions.length, autoCompletions.length])

  // Apply suggestion
  const applySuggestion = useCallback((suggestion: AISuggestion) => {
    logger.debug('✨ Applied AI suggestion:', suggestion)
    
    // Could trigger analytics or learning here
    return suggestion.text
  }, [])

  // Apply auto-completion
  const applyCompletion = useCallback((completion: AutoCompletionSuggestion) => {
    logger.debug('⚡ Applied auto-completion:', completion)
    
    return completion.completion
  }, [])

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setAutoCompletions([])
    setCurrentInput('')
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }
  }, [])

  // Get suggestion stats
  const getSuggestionStats = useCallback(() => {
    return {
      totalSuggestions: suggestions.length,
      totalCompletions: autoCompletions.length,
      highConfidenceSuggestions: suggestions.filter(s => s.confidence > 0.8).length,
      cacheSize: suggestionCache.current.size + completionCache.current.size,
      isLoading,
      currentInput
    }
  }, [suggestions, autoCompletions, isLoading, currentInput])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [])

  return {
    suggestions,
    autoCompletions,
    isLoading,
    getSuggestions,
    applySuggestion,
    applyCompletion,
    clearSuggestions,
    getSuggestionStats
  }
}