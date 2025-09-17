import { useState, useCallback } from 'react'
import { RoadmapFeature } from './useTimelineFeatures'

interface UseFeatureResizeParams {
  features: RoadmapFeature[]
  onFeaturesChange?: (features: RoadmapFeature[]) => void
  timelineDuration: number
  setFeatures: React.Dispatch<React.SetStateAction<RoadmapFeature[]>>
}

interface UseFeatureResizeReturn {
  // State
  isResizing: string | null

  // Handlers
  handleMouseDown: (e: React.MouseEvent, featureId: string, direction: 'left' | 'right') => void
}

export const useFeatureResize = ({
  features,
  onFeaturesChange,
  timelineDuration,
  setFeatures
}: UseFeatureResizeParams): UseFeatureResizeReturn => {
  const [isResizing, setIsResizing] = useState<string | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent, featureId: string, direction: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(featureId)

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new duration based on mouse position
      const feature = features.find(f => f.id === featureId)
      if (!feature) return

      const rect = (e.target as HTMLElement).closest('.timeline-container')?.getBoundingClientRect()
      if (!rect) return

      const monthWidth = rect.width / timelineDuration
      const relativeX = e.clientX - rect.left
      const newMonth = Math.floor(relativeX / monthWidth)

      if (direction === 'right') {
        // Resize from the right - adjust duration
        const newDuration = Math.max(1, newMonth - feature.startMonth + 1)
        const updatedFeatures = features.map(f =>
          f.id === featureId ? { ...f, duration: newDuration } : f
        )
        setFeatures(updatedFeatures)
        if (onFeaturesChange) {
          onFeaturesChange(updatedFeatures)
        }
      } else {
        // Resize from the left - adjust start month and duration
        const newStartMonth = Math.max(0, newMonth)
        const newDuration = feature.duration + (feature.startMonth - newStartMonth)
        const updatedFeatures = features.map(f =>
          f.id === featureId ? { ...f, startMonth: newStartMonth, duration: Math.max(1, newDuration) } : f
        )
        setFeatures(updatedFeatures)
        if (onFeaturesChange) {
          onFeaturesChange(updatedFeatures)
        }
      }
    }

    const handleMouseUp = () => {
      setIsResizing(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [features, onFeaturesChange, timelineDuration, setFeatures])

  return {
    // State
    isResizing,

    // Handlers
    handleMouseDown
  }
}

export type { UseFeatureResizeParams, UseFeatureResizeReturn }