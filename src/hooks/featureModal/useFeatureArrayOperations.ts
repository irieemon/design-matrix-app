import { useState, useCallback } from 'react'
import type { FeatureDetail } from './useFeatureModalState'

interface UseFeatureArrayOperationsParams {
  updateFeature: (updates: Partial<FeatureDetail>) => void
  editedFeature: FeatureDetail | null
}

interface UseFeatureArrayOperationsReturn {
  // User Stories
  newUserStory: string
  setNewUserStory: React.Dispatch<React.SetStateAction<string>>
  addUserStory: () => void
  removeUserStory: (index: number) => void

  // Deliverables
  newDeliverable: string
  setNewDeliverable: React.Dispatch<React.SetStateAction<string>>
  addDeliverable: () => void
  removeDeliverable: (index: number) => void

  // Generic array operations
  addSuccessCriteria: (criteria: string) => void
  removeSuccessCriteria: (index: number) => void
  addRisk: (risk: string) => void
  removeRisk: (index: number) => void
  addRelatedIdea: (idea: string) => void
  removeRelatedIdea: (index: number) => void
}

export const useFeatureArrayOperations = ({
  updateFeature,
  editedFeature
}: UseFeatureArrayOperationsParams): UseFeatureArrayOperationsReturn => {

  // Local state for input fields
  const [newUserStory, setNewUserStory] = useState('')
  const [newDeliverable, setNewDeliverable] = useState('')

  // User Stories operations
  const addUserStory = useCallback(() => {
    if (newUserStory.trim() && editedFeature) {
      updateFeature({
        userStories: [...(editedFeature.userStories || []), newUserStory.trim()]
      })
      setNewUserStory('')
    }
  }, [newUserStory, editedFeature, updateFeature])

  const removeUserStory = useCallback((index: number) => {
    if (editedFeature && editedFeature.userStories) {
      const updated = [...editedFeature.userStories]
      updated.splice(index, 1)
      updateFeature({ userStories: updated })
    }
  }, [editedFeature, updateFeature])

  // Deliverables operations
  const addDeliverable = useCallback(() => {
    if (newDeliverable.trim() && editedFeature) {
      updateFeature({
        deliverables: [...(editedFeature.deliverables || []), newDeliverable.trim()]
      })
      setNewDeliverable('')
    }
  }, [newDeliverable, editedFeature, updateFeature])

  const removeDeliverable = useCallback((index: number) => {
    if (editedFeature && editedFeature.deliverables) {
      const updated = [...editedFeature.deliverables]
      updated.splice(index, 1)
      updateFeature({ deliverables: updated })
    }
  }, [editedFeature, updateFeature])

  // Success Criteria operations
  const addSuccessCriteria = useCallback((criteria: string) => {
    if (criteria.trim() && editedFeature) {
      updateFeature({
        successCriteria: [...(editedFeature.successCriteria || []), criteria.trim()]
      })
    }
  }, [editedFeature, updateFeature])

  const removeSuccessCriteria = useCallback((index: number) => {
    if (editedFeature && editedFeature.successCriteria) {
      const updated = [...editedFeature.successCriteria]
      updated.splice(index, 1)
      updateFeature({ successCriteria: updated })
    }
  }, [editedFeature, updateFeature])

  // Risk operations
  const addRisk = useCallback((risk: string) => {
    if (risk.trim() && editedFeature) {
      updateFeature({
        risks: [...(editedFeature.risks || []), risk.trim()]
      })
    }
  }, [editedFeature, updateFeature])

  const removeRisk = useCallback((index: number) => {
    if (editedFeature && editedFeature.risks) {
      const updated = [...editedFeature.risks]
      updated.splice(index, 1)
      updateFeature({ risks: updated })
    }
  }, [editedFeature, updateFeature])

  // Related Ideas operations
  const addRelatedIdea = useCallback((idea: string) => {
    if (idea.trim() && editedFeature) {
      updateFeature({
        relatedIdeas: [...(editedFeature.relatedIdeas || []), idea.trim()]
      })
    }
  }, [editedFeature, updateFeature])

  const removeRelatedIdea = useCallback((index: number) => {
    if (editedFeature && editedFeature.relatedIdeas) {
      const updated = [...editedFeature.relatedIdeas]
      updated.splice(index, 1)
      updateFeature({ relatedIdeas: updated })
    }
  }, [editedFeature, updateFeature])

  return {
    // User Stories
    newUserStory,
    setNewUserStory,
    addUserStory,
    removeUserStory,

    // Deliverables
    newDeliverable,
    setNewDeliverable,
    addDeliverable,
    removeDeliverable,

    // Generic array operations
    addSuccessCriteria,
    removeSuccessCriteria,
    addRisk,
    removeRisk,
    addRelatedIdea,
    removeRelatedIdea
  }
}

export type { UseFeatureArrayOperationsParams, UseFeatureArrayOperationsReturn }