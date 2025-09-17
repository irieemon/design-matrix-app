import { RoadmapFeature } from '../../../hooks/timeline/useTimelineFeatures'

interface FeatureStyles {
  bgColor: string
  textColor: string
  borderColor: string
}

export const getFeatureStyles = (priority: RoadmapFeature['priority'], status: RoadmapFeature['status']): FeatureStyles => {
  // Priority-based styling
  let bgColor: string
  let textColor: string
  let borderColor: string

  switch (priority) {
    case 'high':
      bgColor = 'bg-red-200'
      textColor = 'text-red-800'
      borderColor = 'border-red-400'
      break
    case 'medium':
      bgColor = 'bg-yellow-200'
      textColor = 'text-yellow-800'
      borderColor = 'border-yellow-400'
      break
    case 'low':
      bgColor = 'bg-blue-200'
      textColor = 'text-blue-800'
      borderColor = 'border-blue-400'
      break
    default:
      bgColor = 'bg-slate-200'
      textColor = 'text-slate-800'
      borderColor = 'border-slate-400'
  }

  // Status-based opacity adjustments
  if (status === 'completed') {
    bgColor = 'bg-slate-300'
    textColor = 'text-slate-600'
    borderColor = 'border-slate-400'
  } else if (status === 'in-progress') {
    bgColor = bgColor.replace('200', '300') // Slightly more saturated for in-progress
  }

  return { bgColor, textColor, borderColor }
}

export type { FeatureStyles }