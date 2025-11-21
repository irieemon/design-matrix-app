import { useState, useEffect } from 'react'

interface FeatureDetail {
  id: string
  title: string
  description?: string
  startMonth: number
  duration: number
  team: string
  priority: 'high' | 'medium' | 'low'
  status: 'planned' | 'in-progress' | 'completed'
  userStories?: string[]
  deliverables?: string[]
  relatedIdeas?: string[]
  risks?: string[]
  successCriteria?: string[]
  complexity?: string
}

interface UseFeatureModalStateParams {
  feature: FeatureDetail | null
  mode: 'view' | 'edit' | 'create'
  availableTeams: string[]
}

interface UseFeatureModalStateReturn {
  // Current feature state
  editedFeature: FeatureDetail | null
  currentFeature: FeatureDetail | null

  // Modal state
  editMode: boolean
  showDeleteConfirm: boolean

  // State setters
  setEditedFeature: React.Dispatch<React.SetStateAction<FeatureDetail | null>>
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>
  setShowDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>

  // Update helper
  updateFeature: (updates: Partial<FeatureDetail>) => void
}

export const useFeatureModalState = ({
  feature,
  mode,
  availableTeams
}: UseFeatureModalStateParams): UseFeatureModalStateReturn => {
  const [editMode, setEditMode] = useState(mode === 'edit' || mode === 'create')
  const [editedFeature, setEditedFeature] = useState<FeatureDetail | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Initialize edited feature when feature or mode changes
  useEffect(() => {
    // ✅ CRITICAL FIX: Use setTimeout(0) to prevent cascading renders
    setTimeout(() => {
      if (feature) {
        setEditedFeature({ ...feature })
      } else if (mode === 'create') {
        // Create new feature template
        setEditedFeature({
          id: `temp-${Date.now()}`,
          title: '',
          description: '',
          startMonth: 0,
          duration: 1,
          team: availableTeams[0] || 'PLATFORM',
          priority: 'medium',
          status: 'planned',
          userStories: [],
          deliverables: [],
          relatedIdeas: [],
          risks: [],
          successCriteria: [],
          complexity: 'medium'
        })
      }
      setEditMode(mode === 'edit' || mode === 'create')
    }, 0)
  }, [feature, mode, availableTeams])

  // Helper to update feature properties
  const updateFeature = (updates: Partial<FeatureDetail>) => {
    if (editedFeature) {
      setEditedFeature({ ...editedFeature, ...updates })
    }
  }

  const currentFeature = editedFeature || feature

  return {
    // Current feature state
    editedFeature,
    currentFeature,

    // Modal state
    editMode,
    showDeleteConfirm,

    // State setters
    setEditedFeature,
    setEditMode,
    setShowDeleteConfirm,

    // Update helper
    updateFeature
  }
}

export type { UseFeatureModalStateParams, UseFeatureModalStateReturn, FeatureDetail }