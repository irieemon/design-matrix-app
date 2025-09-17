import { useState, useEffect, useCallback } from 'react'

interface RoadmapFeature {
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
  phaseIndex?: number
  epicIndex?: number
}

interface UseTimelineFeaturesParams {
  initialFeatures: RoadmapFeature[]
  onFeaturesChange?: (features: RoadmapFeature[]) => void
  projectType?: string
  draggedFeature?: RoadmapFeature | null
  isResizing?: string | null
}

interface UseTimelineFeaturesReturn {
  // State
  features: RoadmapFeature[]
  selectedFeature: RoadmapFeature | null
  isModalOpen: boolean
  isExportModalOpen: boolean

  // Feature management
  handleFeatureClick: (feature: RoadmapFeature) => void
  handleCloseModal: () => void
  handleSaveFeature: (updatedFeature: RoadmapFeature) => void
  handleDeleteFeature: (featureId: string) => void
  handleCreateFeature: () => void
  handleLoadSampleData: () => void

  // Export modal
  setIsExportModalOpen: (isOpen: boolean) => void

  // Internal setters for other hooks
  setFeatures: React.Dispatch<React.SetStateAction<RoadmapFeature[]>>
}

export const useTimelineFeatures = ({
  initialFeatures,
  onFeaturesChange,
  projectType = 'software',
  draggedFeature,
  isResizing
}: UseTimelineFeaturesParams): UseTimelineFeaturesReturn => {
  const [selectedFeature, setSelectedFeature] = useState<RoadmapFeature | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [features, setFeatures] = useState<RoadmapFeature[]>(initialFeatures)

  // Update features when props change - but preserve user modifications
  useEffect(() => {
    // Only update features if:
    // 1. It's the initial load (features array is empty)
    // 2. The length or IDs have changed (features added/removed externally)
    // 3. User is not currently interacting (not resizing or dragging)
    const shouldUpdate = !isResizing && !draggedFeature && (
      features.length === 0 ||
      (features.length !== initialFeatures.length) ||
      (initialFeatures.length > 0 && !features.every(f => initialFeatures.some(inf => inf.id === f.id)))
    )

    if (shouldUpdate) {
      setFeatures(initialFeatures)
    }
  }, [initialFeatures, isResizing, draggedFeature]) // Removed features.length to prevent loops

  const handleFeatureClick = useCallback((feature: RoadmapFeature) => {
    setSelectedFeature(feature)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedFeature(null)
  }, [])

  const handleSaveFeature = useCallback((updatedFeature: RoadmapFeature) => {
    let updatedFeatures: RoadmapFeature[]

    // Check if this is a new feature (temp id) or existing
    if (updatedFeature.id.startsWith('temp-')) {
      // Create new feature with real ID
      const newFeature = {
        ...updatedFeature,
        id: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      updatedFeatures = [...features, newFeature]
    } else {
      // Update existing feature
      updatedFeatures = features.map(f =>
        f.id === updatedFeature.id ? updatedFeature : f
      )
    }

    setFeatures(updatedFeatures)

    if (onFeaturesChange) {
      onFeaturesChange(updatedFeatures)
    }
  }, [features, onFeaturesChange])

  const handleDeleteFeature = useCallback((featureId: string) => {
    const updatedFeatures = features.filter(f => f.id !== featureId)
    setFeatures(updatedFeatures)
    if (onFeaturesChange) {
      onFeaturesChange(updatedFeatures)
    }
  }, [features, onFeaturesChange])

  const handleCreateFeature = useCallback(() => {
    setSelectedFeature(null) // Create mode with no selected feature
    setIsModalOpen(true)
  }, [])

  const handleLoadSampleData = useCallback(() => {
    // Import sample data dynamically to avoid circular dependencies
    import('../../utils/sampleRoadmapData').then(({ sampleMarketingRoadmap, sampleSoftwareRoadmap, sampleEventRoadmap }) => {
      let sampleData: RoadmapFeature[]

      // Choose sample data based on project type
      switch (projectType) {
        case 'marketing':
          sampleData = sampleMarketingRoadmap
          break
        case 'software':
          sampleData = sampleSoftwareRoadmap
          break
        case 'event':
          sampleData = sampleEventRoadmap
          break
        default:
          sampleData = sampleMarketingRoadmap // Default to marketing for current case
      }

      setFeatures(sampleData)

      if (onFeaturesChange) {
        onFeaturesChange(sampleData)
      }
    })
  }, [projectType, onFeaturesChange])

  return {
    // State
    features,
    selectedFeature,
    isModalOpen,
    isExportModalOpen,

    // Feature management
    handleFeatureClick,
    handleCloseModal,
    handleSaveFeature,
    handleDeleteFeature,
    handleCreateFeature,
    handleLoadSampleData,

    // Export modal
    setIsExportModalOpen,

    // Internal setters
    setFeatures
  }
}

export type { RoadmapFeature, UseTimelineFeaturesParams, UseTimelineFeaturesReturn }