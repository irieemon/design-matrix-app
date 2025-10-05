/**
 * Enhanced Skeleton Component Types
 * S-tier SaaS dashboard skeleton loading system with comprehensive animation and accessibility
 */

import { ComponentVariant, ComponentSize } from './componentState'

export type SkeletonType = 'text' | 'card' | 'matrix' | 'table' | 'avatar' | 'image' | 'button' | 'input'

export type SkeletonAnimation = 'pulse' | 'wave' | 'shimmer' | 'none'

export type SkeletonShape = 'rectangle' | 'rounded' | 'circle' | 'pill'

export interface SkeletonDimensions {
  width?: string | number
  height?: string | number
  minWidth?: string | number
  minHeight?: string | number
  maxWidth?: string | number
  maxHeight?: string | number
}

export interface SkeletonTextProps {
  lines?: number
  lineHeight?: string | number
  lastLineWidth?: string | number
  fontSize?: ComponentSize
  animated?: boolean
  animation?: SkeletonAnimation
  className?: string
}

export interface SkeletonCardProps {
  showHeader?: boolean
  showImage?: boolean
  showContent?: boolean
  showActions?: boolean
  headerLines?: number
  contentLines?: number
  imageAspectRatio?: string
  animated?: boolean
  animation?: SkeletonAnimation
  variant?: ComponentVariant
  className?: string
}

export interface SkeletonMatrixProps {
  rows?: number
  cols?: number
  cellAspectRatio?: string
  showHeaders?: boolean
  showFilters?: boolean
  gap?: ComponentSize
  animated?: boolean
  animation?: SkeletonAnimation
  className?: string
}

export interface SkeletonTableProps {
  rows?: number
  cols?: number
  showHeader?: boolean
  showRowActions?: boolean
  showPagination?: boolean
  headerHeight?: string | number
  rowHeight?: string | number
  animated?: boolean
  animation?: SkeletonAnimation
  className?: string
}

export interface SkeletonBaseProps {
  type?: SkeletonType
  shape?: SkeletonShape
  dimensions?: SkeletonDimensions
  animation?: SkeletonAnimation
  animated?: boolean
  speed?: 'slow' | 'normal' | 'fast'
  contrast?: 'low' | 'medium' | 'high'
  children?: React.ReactNode
  className?: string
  'aria-label'?: string
  'data-testid'?: string
}

export interface SkeletonProviderProps {
  children: React.ReactNode
  defaultAnimation?: SkeletonAnimation
  defaultSpeed?: 'slow' | 'normal' | 'fast'
  defaultContrast?: 'low' | 'medium' | 'high'
  respectReducedMotion?: boolean
}

export interface SkeletonContextValue {
  defaultAnimation: SkeletonAnimation
  defaultSpeed: 'slow' | 'normal' | 'fast'
  defaultContrast: 'low' | 'medium' | 'high'
  respectReducedMotion: boolean

  // Configuration utilities
  getAnimationConfig: (animation: SkeletonAnimation, speed: 'slow' | 'normal' | 'fast') => {
    duration: number
    easing: string
  }

  // Accessibility utilities
  announceLoading: (message?: string) => void
  announceComplete: (message?: string) => void

  // Performance utilities
  createIntersectionObserver: (callback: IntersectionObserverCallback) => IntersectionObserver | null
  enableGPUAcceleration: (element: HTMLElement) => void
  createStaggeredAnimation: (elements: HTMLElement[], animation: SkeletonAnimation, staggerDelay?: number) => void

  // Responsive utilities
  getResponsiveClasses: (breakpoint: string) => string

  // Configuration objects
  accessibilityConfig: SkeletonAccessibilityConfig
  performanceConfig: SkeletonPerformanceConfig
}

// Matrix-specific skeleton types for design matrix integration
export interface MatrixSkeletonCell {
  id: string
  row: number
  col: number
  showContent: boolean
  contentType: 'text' | 'image' | 'mixed'
}

export interface MatrixSkeletonGrid {
  cells: MatrixSkeletonCell[]
  dimensions: {
    rows: number
    cols: number
    cellWidth: string
    cellHeight: string
  }
  animation: SkeletonAnimation
  staggerDelay: number
}

// Table-specific skeleton types for data tables
export interface TableSkeletonColumn {
  key: string
  width?: string | number
  type: 'text' | 'number' | 'date' | 'action' | 'status'
  alignment?: 'left' | 'center' | 'right'
}

export interface TableSkeletonConfig {
  columns: TableSkeletonColumn[]
  rowCount: number
  showHeader: boolean
  showRowSelection: boolean
  showRowActions: boolean
  showPagination: boolean
  stickyHeader: boolean
}

// Animation configuration types
export interface SkeletonAnimationConfig {
  duration: number
  easing: string
  delay: number
  iteration: 'infinite' | number
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
}

export interface SkeletonAnimationPresets {
  pulse: SkeletonAnimationConfig
  wave: SkeletonAnimationConfig
  shimmer: SkeletonAnimationConfig
  none: SkeletonAnimationConfig
}

// Accessibility and performance types
export interface SkeletonAccessibilityConfig {
  announceLoading: boolean
  loadingMessage: string
  completedMessage: string
  respectPreferReducedMotion: boolean
  focusManagement: boolean
}

export interface SkeletonPerformanceConfig {
  lazyLoad: boolean
  intersectionThreshold: number
  rootMargin: string
  enableGPUAcceleration: boolean
  optimizeAnimations: boolean
}

// Responsive skeleton configuration
export interface SkeletonBreakpointConfig {
  mobile: Partial<SkeletonBaseProps>
  tablet: Partial<SkeletonBaseProps>
  desktop: Partial<SkeletonBaseProps>
  xl: Partial<SkeletonBaseProps>
}

export interface ResponsiveSkeletonProps extends SkeletonBaseProps {
  responsive?: SkeletonBreakpointConfig
}