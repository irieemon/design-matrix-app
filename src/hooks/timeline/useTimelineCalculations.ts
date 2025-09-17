import { useMemo } from 'react'
import { RoadmapFeature } from './useTimelineFeatures'

interface Month {
  index: number
  name: string
  fullName: string
  isCurrentMonth: boolean
}

interface FeaturePosition {
  left: string
  width: string
}

interface UseTimelineCalculationsParams {
  features: RoadmapFeature[]
  startDate: Date
}

interface UseTimelineCalculationsReturn {
  timelineDuration: number
  months: Month[]
  calculateFeatureRows: (teamFeatures: RoadmapFeature[]) => { [featureId: string]: number }
  getFeaturePosition: (feature: RoadmapFeature) => FeaturePosition
  getFeaturesForTeam: (teamId: string) => RoadmapFeature[]
}

export const useTimelineCalculations = ({
  features,
  startDate
}: UseTimelineCalculationsParams): UseTimelineCalculationsReturn => {
  const timelineDuration = useMemo(() => {
    if (features.length === 0) {
      return 6 // Default to 6 months when no features
    }

    // Find the latest end date among all features
    const latestEndMonth = Math.max(
      ...features.map(feature => feature.startMonth + feature.duration)
    )

    // Add 2 months buffer as requested
    const timelineLength = latestEndMonth + 2

    // Cap at 12 months maximum (1 year)
    return Math.min(timelineLength, 12)
  }, [features])

  const months = useMemo(() => {
    const monthsArray = []
    const currentDate = new Date()

    for (let i = 0; i < timelineDuration; i++) {
      const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1)

      // Check if this month matches the current month and year
      const isCurrentMonth = monthDate.getMonth() === currentDate.getMonth() &&
                           monthDate.getFullYear() === currentDate.getFullYear()

      monthsArray.push({
        index: i,
        name: monthDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        fullName: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        isCurrentMonth
      })
    }

    return monthsArray
  }, [startDate, timelineDuration])

  const calculateFeatureRows = useMemo(() => {
    return (teamFeatures: RoadmapFeature[]) => {
      const rows: { [featureId: string]: number } = {}
      const occupiedRows: { row: number; endMonth: number }[] = []

      // Sort features by start month for better positioning
      const sortedFeatures = [...teamFeatures].sort((a, b) => a.startMonth - b.startMonth)

      sortedFeatures.forEach(feature => {
        const featureStart = feature.startMonth
        const featureEnd = feature.startMonth + feature.duration - 1

        // Find the first available row that doesn't conflict
        let assignedRow = 0
        let foundValidRow = false

        while (!foundValidRow) {
          // Check if this row is available for the feature's duration
          const conflictingFeature = occupiedRows.find(
            occupied => occupied.row === assignedRow && occupied.endMonth >= featureStart
          )

          if (!conflictingFeature) {
            // This row is available
            foundValidRow = true
            rows[feature.id] = assignedRow
            occupiedRows.push({ row: assignedRow, endMonth: featureEnd })
          } else {
            // Try the next row
            assignedRow++
          }
        }
      })

      return rows
    }
  }, [])

  const getFeaturePosition = useMemo(() => {
    return (feature: RoadmapFeature): FeaturePosition => {
      const monthWidth = 100 / timelineDuration // Use dynamic timeline duration
      const left = feature.startMonth * monthWidth
      const width = feature.duration * monthWidth

      return {
        left: `${left}%`,
        width: `${Math.min(width, 100 - left)}%`
      }
    }
  }, [timelineDuration])

  const getFeaturesForTeam = useMemo(() => {
    return (teamId: string) => {
      return features.filter(feature => feature.team === teamId)
    }
  }, [features])

  return {
    timelineDuration,
    months,
    calculateFeatureRows,
    getFeaturePosition,
    getFeaturesForTeam
  }
}

export type { Month, FeaturePosition, UseTimelineCalculationsParams, UseTimelineCalculationsReturn }