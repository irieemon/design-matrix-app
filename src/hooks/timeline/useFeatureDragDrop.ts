import { useState, useCallback } from 'react'
import { RoadmapFeature } from './useTimelineFeatures'

interface UseFeatureDragDropParams {
  features: RoadmapFeature[]
  onFeaturesChange?: (features: RoadmapFeature[]) => void
  setFeatures: React.Dispatch<React.SetStateAction<RoadmapFeature[]>>
}

interface UseFeatureDragDropReturn {
  // State
  draggedFeature: RoadmapFeature | null

  // Handlers
  handleDragStart: (e: React.DragEvent, feature: RoadmapFeature) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent, targetTeamId: string, targetMonth: number) => void
  createDropHandler: (teamId: string, timelineDuration: number) => (e: React.DragEvent) => void
}

export const useFeatureDragDrop = ({
  features,
  onFeaturesChange,
  setFeatures
}: UseFeatureDragDropParams): UseFeatureDragDropReturn => {
  const [draggedFeature, setDraggedFeature] = useState<RoadmapFeature | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, feature: RoadmapFeature) => {
    setDraggedFeature(feature)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetTeamId: string, targetMonth: number) => {
    e.preventDefault()
    if (!draggedFeature) return

    const updatedFeatures = features.map(feature =>
      feature.id === draggedFeature.id
        ? { ...feature, team: targetTeamId, startMonth: targetMonth }
        : feature
    )

    setFeatures(updatedFeatures)
    if (onFeaturesChange) {
      onFeaturesChange(updatedFeatures)
    }
    setDraggedFeature(null)
  }, [draggedFeature, features, onFeaturesChange, setFeatures])

  const createDropHandler = useCallback((teamId: string, timelineDuration: number) => {
    return (e: React.DragEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const relativeX = e.clientX - rect.left
      const monthWidth = rect.width / timelineDuration
      const targetMonth = Math.floor(relativeX / monthWidth)
      handleDrop(e, teamId, targetMonth)
    }
  }, [handleDrop])

  return {
    // State
    draggedFeature,

    // Handlers
    handleDragStart,
    handleDragOver,
    handleDrop,
    createDropHandler
  }
}

export type { UseFeatureDragDropParams, UseFeatureDragDropReturn }