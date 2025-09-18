// Feature Modal Hooks - Business Logic Extraction
export { useFeatureModalState } from './useFeatureModalState'
export { useFeatureFormHandlers } from './useFeatureFormHandlers'
export { useFeatureArrayOperations } from './useFeatureArrayOperations'
export { useFeatureTimelineCalculations } from './useFeatureTimelineCalculations'
export { useFeatureValidation } from './useFeatureValidation'

// Type exports
export type {
  FeatureDetail,
  UseFeatureModalStateParams,
  UseFeatureModalStateReturn
} from './useFeatureModalState'

export type {
  UseFeatureFormHandlersParams,
  UseFeatureFormHandlersReturn
} from './useFeatureFormHandlers'

export type {
  UseFeatureArrayOperationsParams,
  UseFeatureArrayOperationsReturn
} from './useFeatureArrayOperations'

export type {
  UseFeatureTimelineCalculationsParams,
  UseFeatureTimelineCalculationsReturn,
  TimelineInfo
} from './useFeatureTimelineCalculations'

export type {
  UseFeatureValidationParams,
  UseFeatureValidationReturn,
  ValidationError
} from './useFeatureValidation'