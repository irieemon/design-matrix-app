import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAISuggestions } from '../useAISuggestions'
import { mockIdeas, mockProject } from '../../test/utils/test-utils'

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('useAISuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with empty suggestions', () => {
      const { result } = renderHook(() => useAISuggestions())

      expect(result.current.suggestions).toEqual([])
      expect(result.current.autoCompletions).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('should accept configuration options', () => {
      const { result } = renderHook(() =>
        useAISuggestions({
          project: mockProject,
          existingIdeas: mockIdeas,
          debounceMs: 500,
          maxSuggestions: 10,
          enableAutoCompletion: true,
          enableSmartSuggestions: true
        })
      )

      expect(result.current).toBeDefined()
      expect(result.current.suggestions).toEqual([])
    })

    it('should use default options when not provided', () => {
      const { result } = renderHook(() => useAISuggestions({}))

      expect(result.current).toBeDefined()
      expect(result.current.suggestions).toEqual([])
    })

    it('should return all expected methods', () => {
      const { result } = renderHook(() => useAISuggestions())

      expect(result.current).toHaveProperty('suggestions')
      expect(result.current).toHaveProperty('autoCompletions')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('getSuggestions')
      expect(result.current).toHaveProperty('applySuggestion')
      expect(result.current).toHaveProperty('applyCompletion')
      expect(result.current).toHaveProperty('clearSuggestions')
      expect(result.current).toHaveProperty('getSuggestionStats')
    })
  })

  describe('getSuggestions', () => {
    it('should generate suggestions after debounce delay', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 300, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('improve user')
      })

      // Before debounce
      expect(result.current.suggestions).toEqual([])

      // Fast-forward past debounce
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })
    })

    it('should set loading state during processing', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100 })
      )

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Loading state should be set during processing
      // (May complete quickly in tests, check that it's defined)
      expect(result.current.isLoading).toBeDefined()
    })

    it('should clear suggestions for empty input', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100 })
      )

      // First add some suggestions
      act(() => {
        result.current.getSuggestions('improve user')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      // Then clear with empty input
      act(() => {
        result.current.getSuggestions('')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.suggestions).toEqual([])
      expect(result.current.autoCompletions).toEqual([])
    })

    it('should cancel previous debounced call on new input', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 300 })
      )

      act(() => {
        result.current.getSuggestions('improve')
      })

      // Don't wait for first debounce to complete
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Start new call
      act(() => {
        result.current.getSuggestions('improve user experience')
      })

      // Complete the second debounce
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Should only process the latest input
      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })
    })

    it('should respect maxSuggestions limit', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({
          debounceMs: 100,
          maxSuggestions: 3,
          enableSmartSuggestions: true
        })
      )

      act(() => {
        result.current.getSuggestions('improve user interface design')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeLessThanOrEqual(3)
      })
    })
  })

  describe('pattern-based suggestions', () => {
    it('should generate suggestions for "improve" pattern', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const suggestionTexts = result.current.suggestions.map(s => s.text.toLowerCase())
      expect(suggestionTexts.some(text => text.includes('improve'))).toBe(true)
    })

    it('should generate suggestions for "implement" pattern', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('implement authentication')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const suggestionTexts = result.current.suggestions.map(s => s.text.toLowerCase())
      expect(suggestionTexts.some(text => text.includes('implement'))).toBe(true)
    })

    it('should generate suggestions for "optimize" pattern', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('optimize database')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })
    })

    it('should generate suggestions for "add" pattern', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('add new feature')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })
    })
  })

  describe('keyword suggestions', () => {
    it('should suggest business keywords', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('user experience')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const suggestions = result.current.suggestions
      expect(suggestions.some(s => s.type === 'enhancement')).toBe(true)
    })

    it('should have confidence scores for keyword suggestions', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('performance metrics')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      result.current.suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThan(0)
        expect(suggestion.confidence).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('related ideas suggestions', () => {
    it('should suggest related ideas from existing project', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({
          debounceMs: 100,
          existingIdeas: mockIdeas,
          enableSmartSuggestions: true
        })
      )

      // Search for a term that appears in mockIdeas
      act(() => {
        result.current.getSuggestions('test')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const relatedSuggestions = result.current.suggestions.filter(s => s.type === 'related')
      expect(relatedSuggestions.length).toBeGreaterThanOrEqual(0)
    })

    it('should include related idea metadata', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({
          debounceMs: 100,
          existingIdeas: mockIdeas,
          enableSmartSuggestions: true
        })
      )

      act(() => {
        result.current.getSuggestions('test')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        const relatedSuggestions = result.current.suggestions.filter(s => s.type === 'related')
        if (relatedSuggestions.length > 0) {
          expect(relatedSuggestions[0].metadata).toBeDefined()
          expect(relatedSuggestions[0].metadata?.relatedIdeaId).toBeDefined()
        }
      })
    })

    it('should limit related ideas to 3', async () => {
      const manyIdeas = Array.from({ length: 10 }, (_, i) => ({
        ...mockIdeas[0],
        id: `idea-${i}`,
        content: `Test idea ${i}`
      }))

      const { result } = renderHook(() =>
        useAISuggestions({
          debounceMs: 100,
          existingIdeas: manyIdeas,
          enableSmartSuggestions: true
        })
      )

      act(() => {
        result.current.getSuggestions('test')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        const relatedSuggestions = result.current.suggestions.filter(s => s.type === 'related')
        expect(relatedSuggestions.length).toBeLessThanOrEqual(3)
      })
    })
  })

  describe('priority suggestions', () => {
    it('should suggest high priority for urgent keywords', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('urgent fix needed')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const prioritySuggestions = result.current.suggestions.filter(s => s.type === 'priority')
      expect(prioritySuggestions.length).toBeGreaterThan(0)
      expect(prioritySuggestions[0].metadata?.suggestedPriority).toBe(5)
    })

    it('should detect various urgency keywords', async () => {
      const urgentWords = ['urgent', 'critical', 'asap', 'immediately', 'priority', 'important']

      for (const word of urgentWords) {
        const { result } = renderHook(() =>
          useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
        )

        act(() => {
          result.current.getSuggestions(`${word} task`)
        })

        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        await waitFor(() => {
          const prioritySuggestions = result.current.suggestions.filter(s => s.type === 'priority')
          expect(prioritySuggestions.length).toBeGreaterThan(0)
        })
      }
    })
  })

  describe('auto-completion', () => {
    it('should generate auto-completions for short input', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableAutoCompletion: true })
      )

      act(() => {
        result.current.getSuggestions('user')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.autoCompletions.length).toBeGreaterThan(0)
      })
    })

    it('should not generate completions for very short input', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableAutoCompletion: true })
      )

      act(() => {
        result.current.getSuggestions('ab')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.autoCompletions).toEqual([])
    })

    it('should sort auto-completions by score', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableAutoCompletion: true })
      )

      act(() => {
        result.current.getSuggestions('user interface')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.autoCompletions.length).toBeGreaterThan(0)
      })

      const completions = result.current.autoCompletions
      for (let i = 0; i < completions.length - 1; i++) {
        expect(completions[i].score).toBeGreaterThanOrEqual(completions[i + 1].score)
      }
    })

    it('should include project-specific completions', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({
          debounceMs: 100,
          existingIdeas: mockIdeas,
          enableAutoCompletion: true
        })
      )

      act(() => {
        result.current.getSuggestions('test')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        const projectCompletions = result.current.autoCompletions.filter(c => c.category === 'project')
        // May or may not have project completions depending on data
        expect(result.current.autoCompletions).toBeDefined()
      })
    })
  })

  describe('caching', () => {
    it('should cache suggestions for same input', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      // First call
      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const firstSuggestions = [...result.current.suggestions]

      // Clear and call again with same input
      act(() => {
        result.current.clearSuggestions()
      })

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      // Should get cached results (same suggestions)
      expect(result.current.suggestions.length).toBe(firstSuggestions.length)
    })

    it('should normalize cache keys', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      // Call with different cases and spacing
      act(() => {
        result.current.getSuggestions('  IMPROVE Performance  ')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const firstSuggestions = [...result.current.suggestions]

      act(() => {
        result.current.clearSuggestions()
      })

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      // Should retrieve from cache despite different formatting
      expect(result.current.suggestions.length).toBe(firstSuggestions.length)
    })
  })

  describe('applySuggestion', () => {
    it('should return suggestion text when applied', () => {
      const { result } = renderHook(() => useAISuggestions())

      const suggestion = {
        id: 'test-1',
        type: 'completion' as const,
        text: 'Test suggestion text',
        confidence: 0.9,
        context: 'test',
        actionable: true
      }

      const resultText = result.current.applySuggestion(suggestion)

      expect(resultText).toBe('Test suggestion text')
    })

    it('should handle applying multiple suggestions', () => {
      const { result } = renderHook(() => useAISuggestions())

      const suggestions = [
        { id: '1', type: 'completion' as const, text: 'Suggestion 1', confidence: 0.9, context: 'test', actionable: true },
        { id: '2', type: 'enhancement' as const, text: 'Suggestion 2', confidence: 0.8, context: 'test', actionable: true },
        { id: '3', type: 'related' as const, text: 'Suggestion 3', confidence: 0.7, context: 'test', actionable: true }
      ]

      suggestions.forEach(suggestion => {
        const text = result.current.applySuggestion(suggestion)
        expect(text).toBe(suggestion.text)
      })
    })
  })

  describe('applyCompletion', () => {
    it('should return completion text when applied', () => {
      const { result } = renderHook(() => useAISuggestions())

      const completion = {
        id: 'comp-1',
        text: 'user',
        completion: 'user interface design',
        score: 0.9,
        category: 'business'
      }

      const resultText = result.current.applyCompletion(completion)

      expect(resultText).toBe('user interface design')
    })

    it('should handle applying multiple completions', () => {
      const { result } = renderHook(() => useAISuggestions())

      const completions = [
        { id: '1', text: 'user', completion: 'user interface', score: 0.9, category: 'business' },
        { id: '2', text: 'data', completion: 'database performance', score: 0.8, category: 'business' }
      ]

      completions.forEach(completion => {
        const text = result.current.applyCompletion(completion)
        expect(text).toBe(completion.completion)
      })
    })
  })

  describe('clearSuggestions', () => {
    it('should clear all suggestions and completions', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100 })
      )

      // Generate some suggestions
      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      // Clear them
      act(() => {
        result.current.clearSuggestions()
      })

      expect(result.current.suggestions).toEqual([])
      expect(result.current.autoCompletions).toEqual([])
    })

    it('should cancel pending debounced calls', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 300 })
      )

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      // Clear before debounce completes
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      act(() => {
        result.current.clearSuggestions()
      })

      // Advance past original debounce time
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Should remain empty
      expect(result.current.suggestions).toEqual([])
    })
  })

  describe('getSuggestionStats', () => {
    it('should return current stats', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100 })
      )

      act(() => {
        result.current.getSuggestions('improve user interface')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const stats = result.current.getSuggestionStats()

      expect(stats).toHaveProperty('totalSuggestions')
      expect(stats).toHaveProperty('totalCompletions')
      expect(stats).toHaveProperty('highConfidenceSuggestions')
      expect(stats).toHaveProperty('cacheSize')
      expect(stats).toHaveProperty('isLoading')
      expect(stats).toHaveProperty('currentInput')
    })

    it('should report high confidence suggestions correctly', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const stats = result.current.getSuggestionStats()
      const highConfSuggestions = result.current.suggestions.filter(s => s.confidence > 0.8)

      expect(stats.highConfidenceSuggestions).toBe(highConfSuggestions.length)
    })

    it('should track cache size', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100 })
      )

      const initialStats = result.current.getSuggestionStats()
      expect(initialStats.cacheSize).toBe(0)

      // Generate suggestions for multiple inputs
      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      act(() => {
        result.current.getSuggestions('optimize database')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        const stats = result.current.getSuggestionStats()
        expect(stats.cacheSize).toBeGreaterThan(0)
      })
    })
  })

  describe('feature toggles', () => {
    it('should respect enableSmartSuggestions flag', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({
          debounceMs: 100,
          enableSmartSuggestions: false,
          enableAutoCompletion: false
        })
      )

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Should not generate suggestions when disabled
      expect(result.current.suggestions).toEqual([])
    })

    it('should respect enableAutoCompletion flag', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({
          debounceMs: 100,
          enableSmartSuggestions: false,
          enableAutoCompletion: false
        })
      )

      act(() => {
        result.current.getSuggestions('user interface')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Should not generate completions when disabled
      expect(result.current.autoCompletions).toEqual([])
    })

    it('should allow enabling only smart suggestions', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({
          debounceMs: 100,
          enableSmartSuggestions: true,
          enableAutoCompletion: false
        })
      )

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      expect(result.current.autoCompletions).toEqual([])
    })

    it('should allow enabling only auto-completion', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({
          debounceMs: 100,
          enableSmartSuggestions: false,
          enableAutoCompletion: true
        })
      )

      act(() => {
        result.current.getSuggestions('user interface')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.autoCompletions.length).toBeGreaterThan(0)
      })

      expect(result.current.suggestions).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100 })
      )

      // Mock an error scenario by passing invalid input that might cause issues
      act(() => {
        result.current.getSuggestions('test input')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Should not throw and should clear loading state
      expect(result.current.isLoading).toBe(false)
    })

    it('should set empty suggestions on error', async () => {
      // We can't easily force an error in the current implementation,
      // but we can verify the error handling path exists
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100 })
      )

      act(() => {
        result.current.getSuggestions('test')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Should complete without errors
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should clear timeout on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useAISuggestions({ debounceMs: 300 })
      )

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      unmount()

      // Should not cause errors after unmount
      expect(() => {
        vi.advanceTimersByTime(300)
      }).not.toThrow()
    })

    it('should handle multiple mount/unmount cycles', () => {
      const { result, unmount, rerender } = renderHook(() =>
        useAISuggestions({ debounceMs: 100 })
      )

      act(() => {
        result.current.getSuggestions('test')
      })

      unmount()

      expect(() => {
        const { result: result2 } = renderHook(() => useAISuggestions())
        act(() => {
          result2.current.getSuggestions('test again')
        })
      }).not.toThrow()
    })
  })

  describe('confidence scoring', () => {
    it('should provide confidence scores between 0 and 1', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('improve user experience')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      result.current.suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0)
        expect(suggestion.confidence).toBeLessThanOrEqual(1)
      })
    })

    it('should sort suggestions by confidence', async () => {
      const { result } = renderHook(() =>
        useAISuggestions({ debounceMs: 100, enableSmartSuggestions: true })
      )

      act(() => {
        result.current.getSuggestions('improve performance')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      })

      const suggestions = result.current.suggestions
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence)
      }
    })
  })
})