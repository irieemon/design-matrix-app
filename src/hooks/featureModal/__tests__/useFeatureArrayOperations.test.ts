import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeatureArrayOperations } from '../useFeatureArrayOperations'
import type { FeatureDetail } from '../useFeatureModalState'

describe('useFeatureArrayOperations', () => {
  const mockFeature: FeatureDetail = {
    id: 'test-feature-1',
    title: 'Test Feature',
    description: 'Test description',
    startMonth: 0,
    duration: 3,
    team: 'PLATFORM',
    priority: 'high',
    status: 'planned',
    userStories: ['Existing Story 1', 'Existing Story 2'],
    deliverables: ['Existing Deliverable 1'],
    relatedIdeas: ['Related Idea 1'],
    risks: ['Risk 1', 'Risk 2'],
    successCriteria: ['Criteria 1']
  }

  let mockUpdateFeature: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockUpdateFeature = vi.fn()
  })

  describe('User Stories operations', () => {
    test('adds user story with valid input', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.setNewUserStory('New User Story')
      })

      expect(result.current.newUserStory).toBe('New User Story')

      act(() => {
        result.current.addUserStory()
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        userStories: ['Existing Story 1', 'Existing Story 2', 'New User Story']
      })
      expect(result.current.newUserStory).toBe('')
    })

    test('trims whitespace when adding user story', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.setNewUserStory('   Trimmed Story   ')
      })

      act(() => {
        result.current.addUserStory()
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        userStories: ['Existing Story 1', 'Existing Story 2', 'Trimmed Story']
      })
    })

    test('does not add empty user story', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.setNewUserStory('')
      })

      act(() => {
        result.current.addUserStory()
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })

    test('does not add whitespace-only user story', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.setNewUserStory('   ')
      })

      act(() => {
        result.current.addUserStory()
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })

    test('does not add user story when editedFeature is null', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: null
        })
      )

      act(() => {
        result.current.setNewUserStory('New Story')
      })

      act(() => {
        result.current.addUserStory()
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })

    test('adds to empty user stories array', () => {
      const featureWithoutStories = { ...mockFeature, userStories: [] }

      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: featureWithoutStories
        })
      )

      act(() => {
        result.current.setNewUserStory('First Story')
      })

      act(() => {
        result.current.addUserStory()
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        userStories: ['First Story']
      })
    })

    test('removes user story at valid index', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.removeUserStory(0)
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        userStories: ['Existing Story 2']
      })
    })

    test('removes last user story', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.removeUserStory(1)
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        userStories: ['Existing Story 1']
      })
    })

    test('does not remove when editedFeature is null', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: null
        })
      )

      act(() => {
        result.current.removeUserStory(0)
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })

    test('does not remove when userStories is undefined', () => {
      const featureWithoutStories = { ...mockFeature, userStories: undefined }

      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: featureWithoutStories
        })
      )

      act(() => {
        result.current.removeUserStory(0)
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })
  })

  describe('Deliverables operations', () => {
    test('adds deliverable with valid input', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.setNewDeliverable('New Deliverable')
      })

      expect(result.current.newDeliverable).toBe('New Deliverable')

      act(() => {
        result.current.addDeliverable()
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        deliverables: ['Existing Deliverable 1', 'New Deliverable']
      })
      expect(result.current.newDeliverable).toBe('')
    })

    test('trims whitespace when adding deliverable', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.setNewDeliverable('   Trimmed Deliverable   ')
      })

      act(() => {
        result.current.addDeliverable()
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        deliverables: ['Existing Deliverable 1', 'Trimmed Deliverable']
      })
    })

    test('does not add empty deliverable', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.setNewDeliverable('')
      })

      act(() => {
        result.current.addDeliverable()
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })

    test('removes deliverable at valid index', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.removeDeliverable(0)
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        deliverables: []
      })
    })

    test('adds to empty deliverables array', () => {
      const featureWithoutDeliverables = { ...mockFeature, deliverables: [] }

      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: featureWithoutDeliverables
        })
      )

      act(() => {
        result.current.setNewDeliverable('First Deliverable')
      })

      act(() => {
        result.current.addDeliverable()
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        deliverables: ['First Deliverable']
      })
    })
  })

  describe('Success Criteria operations', () => {
    test('adds success criteria with valid input', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addSuccessCriteria('New Criteria')
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        successCriteria: ['Criteria 1', 'New Criteria']
      })
    })

    test('trims whitespace when adding success criteria', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addSuccessCriteria('   Trimmed Criteria   ')
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        successCriteria: ['Criteria 1', 'Trimmed Criteria']
      })
    })

    test('does not add empty success criteria', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addSuccessCriteria('')
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })

    test('does not add whitespace-only success criteria', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addSuccessCriteria('   ')
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })

    test('removes success criteria at valid index', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.removeSuccessCriteria(0)
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        successCriteria: []
      })
    })

    test('adds to empty success criteria array', () => {
      const featureWithoutCriteria = { ...mockFeature, successCriteria: [] }

      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: featureWithoutCriteria
        })
      )

      act(() => {
        result.current.addSuccessCriteria('First Criteria')
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        successCriteria: ['First Criteria']
      })
    })
  })

  describe('Risk operations', () => {
    test('adds risk with valid input', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addRisk('New Risk')
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        risks: ['Risk 1', 'Risk 2', 'New Risk']
      })
    })

    test('trims whitespace when adding risk', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addRisk('   Trimmed Risk   ')
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        risks: ['Risk 1', 'Risk 2', 'Trimmed Risk']
      })
    })

    test('does not add empty risk', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addRisk('')
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })

    test('removes risk at valid index', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.removeRisk(1)
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        risks: ['Risk 1']
      })
    })

    test('adds to empty risks array', () => {
      const featureWithoutRisks = { ...mockFeature, risks: [] }

      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: featureWithoutRisks
        })
      )

      act(() => {
        result.current.addRisk('First Risk')
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        risks: ['First Risk']
      })
    })
  })

  describe('Related Ideas operations', () => {
    test('adds related idea with valid input', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addRelatedIdea('New Related Idea')
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        relatedIdeas: ['Related Idea 1', 'New Related Idea']
      })
    })

    test('trims whitespace when adding related idea', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addRelatedIdea('   Trimmed Idea   ')
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        relatedIdeas: ['Related Idea 1', 'Trimmed Idea']
      })
    })

    test('does not add empty related idea', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.addRelatedIdea('')
      })

      expect(mockUpdateFeature).not.toHaveBeenCalled()
    })

    test('removes related idea at valid index', () => {
      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: mockFeature
        })
      )

      act(() => {
        result.current.removeRelatedIdea(0)
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        relatedIdeas: []
      })
    })

    test('adds to empty related ideas array', () => {
      const featureWithoutIdeas = { ...mockFeature, relatedIdeas: [] }

      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: featureWithoutIdeas
        })
      )

      act(() => {
        result.current.addRelatedIdea('First Idea')
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        relatedIdeas: ['First Idea']
      })
    })
  })

  describe('Edge cases and error handling', () => {
    test('handles undefined arrays gracefully', () => {
      const featureWithUndefinedArrays = {
        ...mockFeature,
        userStories: undefined,
        deliverables: undefined,
        successCriteria: undefined,
        risks: undefined,
        relatedIdeas: undefined
      }

      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: featureWithUndefinedArrays
        })
      )

      act(() => {
        result.current.setNewUserStory('Story')
        result.current.addUserStory()
      })

      expect(mockUpdateFeature).toHaveBeenCalledWith({
        userStories: ['Story']
      })
    })

    test('does not mutate original arrays', () => {
      const originalUserStories = ['Story 1', 'Story 2']
      const featureWithOriginalArray = {
        ...mockFeature,
        userStories: originalUserStories
      }

      const { result } = renderHook(() =>
        useFeatureArrayOperations({
          updateFeature: mockUpdateFeature,
          editedFeature: featureWithOriginalArray
        })
      )

      act(() => {
        result.current.removeUserStory(0)
      })

      // Original array should remain unchanged
      expect(originalUserStories).toEqual(['Story 1', 'Story 2'])
      expect(mockUpdateFeature).toHaveBeenCalledWith({
        userStories: ['Story 2']
      })
    })
  })
})