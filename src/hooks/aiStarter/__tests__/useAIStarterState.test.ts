import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAIStarterState } from '../useAIStarterState'

describe('useAIStarterState', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAIStarterState())

    expect(result.current.step).toBe('initial')
    expect(result.current.projectName).toBe('')
    expect(result.current.projectDescription).toBe('')
    expect(result.current.selectedProjectType).toBe('auto')
    expect(result.current.selectedIndustry).toBe('auto')
    expect(result.current.analysis).toBe(null)
    expect(result.current.questionAnswers).toEqual({})
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.ideaCount).toBe(8)
    expect(result.current.ideaTolerance).toBe(50)
    expect(result.current.isFormValid).toBe(false)
  })

  it('should update step correctly', () => {
    const { result } = renderHook(() => useAIStarterState())

    act(() => {
      result.current.setStep('questions')
    })

    expect(result.current.step).toBe('questions')
  })

  it('should update project name', () => {
    const { result } = renderHook(() => useAIStarterState())

    act(() => {
      result.current.setProjectName('Test Project')
    })

    expect(result.current.projectName).toBe('Test Project')
  })

  it('should update project description', () => {
    const { result } = renderHook(() => useAIStarterState())

    act(() => {
      result.current.setProjectDescription('Test description')
    })

    expect(result.current.projectDescription).toBe('Test description')
  })

  it('should update project type', () => {
    const { result } = renderHook(() => useAIStarterState())

    act(() => {
      result.current.setSelectedProjectType('software')
    })

    expect(result.current.selectedProjectType).toBe('software')
  })

  it('should update industry', () => {
    const { result } = renderHook(() => useAIStarterState())

    act(() => {
      result.current.setSelectedIndustry('Technology')
    })

    expect(result.current.selectedIndustry).toBe('Technology')
  })

  it('should calculate form validity correctly', () => {
    const { result } = renderHook(() => useAIStarterState())

    // Initially invalid
    expect(result.current.isFormValid).toBe(false)

    // Still invalid with only name
    act(() => {
      result.current.setProjectName('Test Project')
    })
    expect(result.current.isFormValid).toBe(false)

    // Valid with both name and description
    act(() => {
      result.current.setProjectDescription('Test description')
    })
    expect(result.current.isFormValid).toBe(true)

    // Invalid when loading
    act(() => {
      result.current.setIsLoading(true)
    })
    expect(result.current.isFormValid).toBe(false)
  })

  it('should handle question answers', () => {
    const { result } = renderHook(() => useAIStarterState())

    const answers = { 0: 'Answer 1', 1: 'Answer 2' }

    act(() => {
      result.current.setQuestionAnswers(answers)
    })

    expect(result.current.questionAnswers).toEqual(answers)
  })

  it('should handle analysis data', () => {
    const { result } = renderHook(() => useAIStarterState())

    const analysis = {
      needsClarification: true,
      clarifyingQuestions: [{ question: 'Test?', context: 'Context' }],
      projectAnalysis: {
        industry: 'Technology',
        scope: 'Standard',
        timeline: 'Medium-term',
        primaryGoals: ['Development']
      },
      generatedIdeas: [
        {
          content: 'Test idea',
          details: 'Test details',
          x: 100,
          y: 200,
          priority: 'high' as const
        }
      ]
    }

    act(() => {
      result.current.setAnalysis(analysis)
    })

    expect(result.current.analysis).toEqual(analysis)
  })

  it('should update idea count', () => {
    const { result } = renderHook(() => useAIStarterState())

    act(() => {
      result.current.setIdeaCount(10)
    })

    expect(result.current.ideaCount).toBe(10)
  })

  it('should update idea tolerance', () => {
    const { result } = renderHook(() => useAIStarterState())

    act(() => {
      result.current.setIdeaTolerance(75)
    })

    expect(result.current.ideaTolerance).toBe(75)
  })

  it('should handle error state', () => {
    const { result } = renderHook(() => useAIStarterState())

    act(() => {
      result.current.setError('Test error')
    })

    expect(result.current.error).toBe('Test error')

    act(() => {
      result.current.setError(null)
    })

    expect(result.current.error).toBe(null)
  })

  it('should reset all state', () => {
    const { result } = renderHook(() => useAIStarterState())

    // Set some values
    act(() => {
      result.current.setStep('review')
      result.current.setProjectName('Test Project')
      result.current.setProjectDescription('Test description')
      result.current.setSelectedProjectType('software')
      result.current.setSelectedIndustry('Technology')
      result.current.setIdeaCount(10)
      result.current.setIdeaTolerance(75)
      result.current.setIsLoading(true)
      result.current.setError('Test error')
    })

    // Reset
    act(() => {
      result.current.resetState()
    })

    // Verify all values are back to defaults
    expect(result.current.step).toBe('initial')
    expect(result.current.projectName).toBe('')
    expect(result.current.projectDescription).toBe('')
    expect(result.current.selectedProjectType).toBe('auto')
    expect(result.current.selectedIndustry).toBe('auto')
    expect(result.current.analysis).toBe(null)
    expect(result.current.questionAnswers).toEqual({})
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.ideaCount).toBe(8)
    expect(result.current.ideaTolerance).toBe(50)
    expect(result.current.isFormValid).toBe(false)
  })
})