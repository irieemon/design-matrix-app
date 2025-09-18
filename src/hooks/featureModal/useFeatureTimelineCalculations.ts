import { useMemo } from 'react'
import type { FeatureDetail } from './useFeatureModalState'

interface UseFeatureTimelineCalculationsParams {
  currentFeature: FeatureDetail | null
  startDate: Date
}

interface TimelineInfo {
  start: string
  end: string
}

interface UseFeatureTimelineCalculationsReturn {
  timeline: TimelineInfo | null
  getFeatureTimeline: () => TimelineInfo | null
}

export const useFeatureTimelineCalculations = ({
  currentFeature,
  startDate
}: UseFeatureTimelineCalculationsParams): UseFeatureTimelineCalculationsReturn => {

  const getFeatureTimeline = () => {
    if (!currentFeature) return null

    const start = new Date(startDate)
    start.setMonth(start.getMonth() + currentFeature.startMonth)
    const end = new Date(start)
    end.setMonth(end.getMonth() + currentFeature.duration)

    return {
      start: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      end: end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  // Memoize the timeline calculation to avoid recalculation on every render
  const timeline = useMemo(() => {
    return getFeatureTimeline()
  }, [currentFeature?.startMonth, currentFeature?.duration, startDate])

  return {
    timeline,
    getFeatureTimeline
  }
}

export type { UseFeatureTimelineCalculationsParams, UseFeatureTimelineCalculationsReturn, TimelineInfo }