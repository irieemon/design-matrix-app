/**
 * OptimizedIdeaCard - S-tier SaaS dashboard idea card with design system integration
 *
 * Key optimizations:
 * - S-tier design system token integration
 * - Clean typography hierarchy with proper font sizes and weights
 * - Strategic white space using 8px base unit system
 * - Professional card styling with proper elevation
 * - Accessibility with ARIA labels and semantic HTML
 * - Status system using semantic colors
 * - Interaction states with design system
 * - Minimal re-renders with React.memo
 * - Pure event handlers
 * - Optimized state calculations
 */

import React, { useMemo, useCallback, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Edit3, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react'

import type { IdeaCard, User as UserType } from '../../types'
import { useLogger } from '../../lib/logging'
import { getCardZIndex } from '../../lib/matrix/zIndex'
import { areIdeasEqual } from '../../lib/matrix/performance'
import { ConfirmModal } from '../shared/Modal'

interface OptimizedIdeaCardProps {
  idea: IdeaCard
  currentUser: UserType | null
  isDragOverlay?: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleCollapse: (ideaId: string, collapsed: boolean) => void
  isFromMobile?: boolean // Phase Three: Indicates idea was submitted from mobile device
  isNewIdea?: boolean // Phase Three: Triggers scale-in animation for newly created ideas
}

// S-tier priority configuration using design system tokens
const PRIORITY_CONFIG = {
  low: {
    container: 'idea-card--pending',
    borderColor: 'var(--status-pending)',
    statusColor: 'var(--status-pending)',
    statusBg: 'var(--status-pending-bg)',
    scale: 'scale-95',
    weight: 'weight--normal'
  },
  moderate: {
    container: 'idea-card--overdue',
    borderColor: 'var(--status-overdue)',
    statusColor: 'var(--status-overdue)',
    statusBg: 'var(--status-overdue-bg)',
    scale: 'scale-100',
    weight: 'weight--medium'
  },
  high: {
    container: 'idea-card--upcoming',
    borderColor: 'var(--status-upcoming)',
    statusColor: 'var(--status-upcoming)',
    statusBg: 'var(--status-upcoming-bg)',
    scale: 'scale-100',
    weight: 'weight--medium'
  },
  strategic: {
    container: 'idea-card--priority',
    borderColor: 'var(--status-priority)',
    statusColor: 'var(--status-priority)',
    statusBg: 'var(--status-priority-bg)',
    scale: 'scale-105',
    weight: 'weight--semibold'
  },
  innovation: {
    container: 'idea-card--priority',
    borderColor: 'var(--status-priority)',
    statusColor: 'var(--status-priority)',
    statusBg: 'var(--status-priority-bg)',
    scale: 'scale-110',
    weight: 'weight--bold'
  }
} as const

// Utility function to calculate quadrant based on matrix coordinates
function calculateQuadrant(x: number, y: number): 'quick-wins' | 'strategic' | 'reconsider' | 'avoid' {
  // COORDINATE SYSTEM ALIGNMENT:
  // - Stored coordinates: 0-520 range (center at 260)
  // - Rendering: Converted to percentages via ((coord + 40) / 600) * 100
  // - Center line: 50% of container (both visually and in percentage)
  // - Coordinate 260: (260 + 40) / 600 = 300/600 = 50% (exactly at center!)
  // Result: Using 260 as boundary aligns perfectly with 50% visual center
  const centerX = 260 // Maps to 50% visually after percentage conversion
  const centerY = 260

  if (x < centerX && y < centerY) return 'quick-wins'    // Top-left (low difficulty, high value)
  if (x >= centerX && y < centerY) return 'strategic'       // Top-right (high difficulty, high value)
  if (x < centerX && y >= centerY) return 'reconsider'      // Bottom-left (low difficulty, low value)
  return 'avoid'                                            // Bottom-right (high difficulty, low value)
}

// Quadrant color mapping
const QUADRANT_COLORS = {
  'quick-wins': '#10B981',  // Green
  'strategic': '#3B82F6',   // Blue
  'reconsider': '#F59E0B',  // Amber
  'avoid': '#EF4444'        // Red
} as const

// Utility function for user display name
function getUserDisplayName(userId: string | null | undefined, currentUser: UserType | null | undefined): string {
  if (!userId) return 'Anonymous'
  if (currentUser?.id === userId) return 'You'
  if (userId.length > 10 && (userId.includes('-') || userId.length === 32)) {
    return 'AI Assistant'
  }
  return userId
}

export const OptimizedIdeaCard: React.FC<OptimizedIdeaCardProps> = ({
  idea,
  currentUser,
  isDragOverlay = false,
  onEdit,
  onDelete,
  onToggleCollapse,
  isFromMobile = false,
  isNewIdea = false
}) => {
  const logger = useLogger('OptimizedIdeaCard')

  // Local hover state for z-index management
  const [isHovered, setIsHovered] = useState(false)

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calculate collapsed state early for use in memoized calculations
  const isCollapsed = idea.is_collapsed || false

  // Drag & drop setup
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: idea.id,
    disabled: isDragOverlay // Disable dragging for overlay cards
  })

  // Performance optimization: Debug logging removed for production performance

  // Memoized lock status calculation
  const lockStatus = useMemo(() => {
    const hasLock = idea.editing_by && idea.editing_by.trim() !== ''
    const isLockedByOther = hasLock && idea.editing_by !== currentUser?.id
    const isLockedBySelf = hasLock && idea.editing_by === currentUser?.id

    // Check if lock is still valid (5 minutes)
    if (hasLock && idea.editing_at) {
      const editingAt = new Date(idea.editing_at)
      const now = new Date()
      const timeDiff = now.getTime() - editingAt.getTime()
      const fiveMinutes = 5 * 60 * 1000

      if (timeDiff > fiveMinutes) {
        return { isLockedByOther: false, isLockedBySelf: false }
      }
    }

    return { isLockedByOther, isLockedBySelf }
  }, [idea.editing_by, idea.editing_at, currentUser?.id])

  // Memoized priority configuration
  const priorityConfig = useMemo(() =>
    PRIORITY_CONFIG[idea.priority] || PRIORITY_CONFIG.low,
    [idea.priority]
  )

  // Memoized quadrant and border color calculation
  const quadrantBorderColor = useMemo(() => {
    const quadrant = calculateQuadrant(idea.x, idea.y)
    return QUADRANT_COLORS[quadrant]
  }, [idea.x, idea.y])

  // Memoized z-index calculation
  const zIndex = useMemo(() => getCardZIndex({
    isDragging: isDragging || isDragOverlay,
    isHovered,
    isEditing: Boolean(lockStatus.isLockedBySelf)
  }), [isDragging, isDragOverlay, isHovered, lockStatus.isLockedBySelf])

  // Transform styles for dragging - FIXED: Only translation, no rotation or CSS classes
  const transformStyle = useMemo(() => {
    if (isDragOverlay) return undefined

    // Only use translation for smooth dragging without orientation changes
    const baseTransform = transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : ''

    return baseTransform ? { transform: baseTransform } : {}
  }, [transform, isDragOverlay])

  // S-tier card styles using design system tokens with optimized transitions
  const cardStyle = useMemo(() => ({
    // Transform will be set in the drag-specific section below to avoid conflicts
    background: 'var(--brand-surface)',
    boxShadow: isDragging || isDragOverlay
      ? 'var(--shadow-lg)'
      : 'var(--shadow-card)',
    // FLICKER FIX: Only animate specific properties, NOT width/height
    // This prevents screen-wide flicker when collapse changes card dimensions
    // and collision detection recalculates positions for all cards
    transition: isDragging ? 'none' : `transform var(--duration-200) var(--ease-out), box-shadow var(--duration-200) var(--ease-out), opacity var(--duration-200) var(--ease-out)`,
    borderRadius: 'var(--radius-card)',
    // REDESIGN: Colored borders based on quadrant (2.5px for visual emphasis)
    border: lockStatus.isLockedBySelf
      ? `2px solid var(--interactive-focus)`
      : `2.5px solid ${quadrantBorderColor}`,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex,
    opacity: 1,
    visibility: 'visible' as const,
    // Performance optimizations
    contain: 'layout style',
    willChange: isDragging ? 'transform' : 'auto',

    // PHASE 2 FIX: Robust inline styles during drag to override any CSS conflicts
    ...(isDragging || isDragOverlay ? {
      // Force scale to 1.0 during drag (Fix for Image #2: prevent excessive scaling)
      transform: transformStyle?.transform ? `${transformStyle.transform} scale(1.0)` : 'scale(1.0)',
      // REDESIGN: Reduced dimensions - 32% smaller for expanded, 38% smaller for collapsed
      ...(isCollapsed ? {
        width: '100px',     // Reduced from 160px (38% reduction)
        height: '50px',     // Reduced from 64px (22% reduction)
        maxWidth: '100px',
        maxHeight: '50px',
        minWidth: '100px',
        minHeight: '50px',
        // Enforce box-sizing to prevent dimension issues
        boxSizing: 'border-box' as const
      } : {
        width: '130px',     // Reduced from 192px (32% reduction)
        minHeight: '90px',  // Reduced from 120px (25% reduction)
        maxWidth: '130px',
        // Enforce box-sizing to prevent dimension issues
        boxSizing: 'border-box' as const
      }),
      // Background and opacity are handled by CSS for better performance
    } : {})
  }), [
    transformStyle,
    isDragging,
    isDragOverlay,
    lockStatus.isLockedBySelf,
    quadrantBorderColor,
    zIndex,
    isCollapsed
  ])


  // Event handlers with useCallback for stability
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!lockStatus.isLockedByOther && !isDragOverlay) {
      onEdit()
    }
  }, [lockStatus.isLockedByOther, isDragOverlay, onEdit])

  // Single click handler for click-to-expand functionality
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Only prevent default on actual links to avoid navigation
    if (e.target instanceof Element && e.target.closest('a')) {
      e.preventDefault()
    }

    // Don't interfere with button clicks (they have their own handlers)
    if (e.target instanceof Element && (
      e.target.closest('button') ||
      e.target.closest('[role="button"]')
    )) {
      return // Let button handlers manage their own events
    }

    // Click-to-expand functionality - only handle clicks on the main card area
    if (!lockStatus.isLockedByOther && !isDragOverlay) {
      logger.debug('Click-to-expand triggered', {
        ideaId: idea.id,
        currentState: idea.is_collapsed,
        newState: !idea.is_collapsed
      })
      onToggleCollapse(idea.id, !idea.is_collapsed)
    }
  }, [lockStatus.isLockedByOther, isDragOverlay, onToggleCollapse, idea.id, idea.is_collapsed, logger])

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!lockStatus.isLockedByOther && !isDragOverlay) {
      onEdit()
    }
  }, [lockStatus.isLockedByOther, isDragOverlay, onEdit])

  // Opens delete confirmation modal
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragOverlay) {
      setShowDeleteConfirm(true)
    }
  }, [isDragOverlay])

  // Confirms and executes deletion
  const handleConfirmDelete = useCallback(() => {
    setIsDeleting(true)
    onDelete()
    // Note: The modal will close when the component unmounts after deletion
    // or we close it after a brief delay for visual feedback
    setTimeout(() => {
      setShowDeleteConfirm(false)
      setIsDeleting(false)
    }, 300)
  }, [onDelete])

  // Cancels delete operation
  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false)
  }, [])

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!lockStatus.isLockedByOther && !isDragOverlay) {
      logger.debug('Toggle collapse clicked', {
        ideaId: idea.id,
        currentState: idea.is_collapsed,
        newState: !idea.is_collapsed
      })
      onToggleCollapse(idea.id, !idea.is_collapsed)
    } else {
      logger.debug('Toggle collapse blocked', {
        ideaId: idea.id,
        lockedByOther: lockStatus.isLockedByOther,
        isDragOverlay
      })
    }
  }, [lockStatus.isLockedByOther, isDragOverlay, onToggleCollapse, idea.id, idea.is_collapsed, logger])

  // Prevent child elements from interfering with drag
  const handleChildMouseDown = useCallback((e: React.MouseEvent) => {
    // Only prevent propagation for action buttons, not the entire card
    if ((e.target as Element).closest('button')) {
      e.stopPropagation()
    }
  }, [])

  // Apply drag props conditionally but more explicitly
  const dragProps = isDragOverlay ? {} : { ...listeners, ...attributes }

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      {...dragProps}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleChildMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={isDragOverlay ? -1 : 0}
      aria-label={`${idea.priority} priority idea: ${idea.content.substring(0, 50)}${idea.content.length > 50 ? '...' : ''}`}
      aria-describedby={`idea-${idea.id}-meta`}
      className={`
        relative select-none draggable
        ${priorityConfig.container}
        ${(isDragging || isDragOverlay) ? 'scale-100 is-dragging' : priorityConfig.scale}
        ${isCollapsed ? 'w-[100px] h-[50px] max-w-[100px] max-h-[50px]' : 'w-[130px] min-h-[90px]'}
        ${isCollapsed && (isDragging || isDragOverlay) ? '!w-[100px] !h-[50px] !max-w-[100px] !max-h-[50px]' : ''}
        ${lockStatus.isLockedByOther ? 'opacity-60 cursor-not-allowed grayscale' : ''}
        ${isNewIdea ? 'animate-scale-in' : ''}
      `}
    >
      {/* Phase Four: Blue pulse indicator for mobile-submitted ideas */}
      {isFromMobile && !isDragOverlay && (
        <div
          className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-blue-500 animate-pulse-subtle z-10"
          aria-label="Idea submitted from mobile device"
          title="Submitted from mobile"
        />
      )}

      {/* Delete Button - S-tier design with semantic colors */}
      {!isDragging && !isDragOverlay && (
        <button
          onClick={handleDeleteClick}
          aria-label="Delete idea"
          className={`
            absolute w-6 h-6
            rounded-full
            flex items-center justify-center
            z-20
            focus:opacity-100 focus:outline-none
            ${isCollapsed ? '-top-2 -left-2' : '-top-2 -right-2'}
          `}
          style={{
            background: 'var(--semantic-error)',
            color: 'white',
            transition: 'all var(--duration-200) var(--ease-out)',
            boxShadow: 'var(--shadow-sm)',
            // PHASE 2 FIX: Isolated hover state management
            opacity: isHovered && !isDragging && !isDragOverlay ? 1 : 0,
            // Ensure proper layering above expand/collapse buttons
            zIndex: 20
          }}
          onMouseEnter={(e) => {
            e.stopPropagation() // Prevent hover state bleeding
            e.currentTarget.style.background = '#DC2626'
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          }}
          onMouseLeave={(e) => {
            e.stopPropagation() // Prevent hover state bleeding
            e.currentTarget.style.background = 'var(--semantic-error)'
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--semantic-error)'
            e.currentTarget.style.outlineOffset = '1px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
        >
          <Trash2 size={12} strokeWidth={2} />
        </button>
      )}

      {/* Card Content */}
      {isCollapsed ? (
        // Collapsed View - REDESIGN: Compact minimal design
        <div className="p-2 relative" style={{ padding: '8px' }}>
          {!isDragOverlay && (
            <button
              onClick={handleToggleCollapse}
              aria-label="Expand idea card"
              className="
                absolute -top-1.5 -right-1.5
                w-5 h-5
                rounded-full
                flex items-center justify-center
                transition-all ease-out
                z-10
                focus:outline-none
                hover:scale-110
              "
            style={{
              background: 'var(--brand-surface)',
              border: '1px solid var(--neutral-200)',
              transition: 'all var(--duration-150) var(--ease-out)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--neutral-50)'
              e.currentTarget.style.borderColor = 'var(--neutral-300)'
              e.currentTarget.style.boxShadow = 'var(--shadow-card)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--brand-surface)'
              e.currentTarget.style.borderColor = 'var(--neutral-200)'
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--interactive-focus)'
              e.currentTarget.style.outlineOffset = '1px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
            >
              <ChevronDown
                size={10}
                strokeWidth={2}
                style={{ color: 'var(--brand-secondary)' }}
              />
            </button>
          )}

          <div className="text-center" style={{ textAlign: 'center' }}>
            <div
              className="w-2 h-2 rounded-full mx-auto mb-1.5"
              style={{
                width: '8px',
                height: '8px',
                background: quadrantBorderColor,
                borderRadius: 'var(--radius-full)',
                margin: '0 auto 6px'
              }}
              aria-hidden="true"
            />

            <h3
              className={`text--xs ${priorityConfig.weight} line-clamp-1`}
              style={{
                fontSize: '10px',
                lineHeight: '1.2',
                color: 'var(--brand-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {idea.content.length > 12 ? idea.content.substring(0, 12) + '...' : idea.content}
            </h3>
          </div>
        </div>
      ) : (
        // Expanded View - REDESIGN: Compact spacing and typography
        <div className="relative" style={{ padding: '10px' }}>
          {/* Header with Priority and Actions - REDESIGN: Reduced spacing */}
          <div
            className="flex items-center justify-between"
            style={{
              marginBottom: '8px'
            }}
          >
            <span
              className="badge capitalize"
              style={{
                fontSize: '10px',
                fontWeight: 'var(--font-weight-medium)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: priorityConfig.statusBg,
                color: priorityConfig.statusColor,
                flexShrink: 0 // Prevent badge from shrinking
              }}
            >
              {idea.priority}
            </span>
            {!isDragOverlay && (
              <div
                className="flex items-center"
                style={{
                  gap: '4px'
                }}
              >
                <button
                  onClick={handleToggleCollapse}
                  aria-label="Collapse idea card"
                  className="
                    flex items-center justify-center
                    transition-all ease-out
                    hover:scale-110 hover:bg-neutral-200
                  "
                  style={{
                    width: '24px',
                    height: '24px',
                    background: 'var(--neutral-100)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    padding: 0,
                    transition: 'all var(--duration-200) var(--ease-out)',
                    cursor: 'pointer'
                  }}
                >
                  <ChevronUp
                    size={14}
                    strokeWidth={2}
                    style={{ color: 'var(--brand-secondary)' }}
                  />
                </button>
                <button
                  onClick={handleEdit}
                  aria-label="Edit idea"
                  disabled={Boolean(lockStatus.isLockedByOther)}
                  className={`
                    flex items-center justify-center
                    transition-all ease-out
                    ${lockStatus.isLockedByOther ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-200'}
                  `}
                  style={{
                    width: '24px',
                    height: '24px',
                    background: 'var(--neutral-100)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    padding: 0,
                    transition: 'all var(--duration-200) var(--ease-out)',
                    cursor: lockStatus.isLockedByOther ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Edit3
                    size={14}
                    strokeWidth={2}
                    style={{ color: 'var(--brand-secondary)' }}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Content - REDESIGN: Reduced font sizes for better density */}
          <h3
            className={`${priorityConfig.weight} line-clamp-2`}
            style={{
              fontSize: '12px',
              fontWeight: 'var(--font-weight-medium)',
              lineHeight: '1.3',
              color: 'var(--brand-primary)',
              marginBottom: '6px'
            }}
          >
            {idea.content}
          </h3>

          {/* Details - REDESIGN: Smaller secondary information */}
          {idea.details && (
            <p
              className="line-clamp-2"
              style={{
                fontSize: '11px',
                lineHeight: '1.3',
                color: 'var(--brand-secondary)',
                marginBottom: '8px'
              }}
            >
              {idea.details}
            </p>
          )}

          {/* Footer - REDESIGN: Compact metadata */}
          <div
            id={`idea-${idea.id}-meta`}
            className="flex items-center justify-between"
            style={{
              fontSize: '10px',
              color: 'var(--neutral-500)'
            }}
          >
            <span className="flex items-center" style={{ gap: '4px' }}>
              <User size={10} strokeWidth={2} />
              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                {getUserDisplayName(idea.created_by, currentUser)}
              </span>
            </span>
            <time
              dateTime={idea.created_at}
              style={{ fontWeight: 'var(--font-weight-medium)' }}
            >
              {new Date(idea.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
            </time>
          </div>
        </div>
      )}

      {/* Lock Status Indicators - REDESIGN: Compact status badges */}
      {lockStatus.isLockedByOther && !isDragOverlay && (
        <div
          className="badge badge--error absolute z-10"
          style={{
            top: '8px',
            left: '8px',
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: 'var(--font-weight-medium)',
            background: 'var(--semantic-error-bg)',
            color: 'var(--semantic-error)',
            borderRadius: 'var(--radius-sm)',
            gap: '4px'
          }}
          role="status"
          aria-live="polite"
        >
          🔒 <span>Active</span>
        </div>
      )}
      {lockStatus.isLockedBySelf && !isDragOverlay && (
        <div
          className="badge badge--info absolute z-10"
          style={{
            top: '8px',
            left: '8px',
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: 'var(--font-weight-medium)',
            background: 'var(--semantic-info-bg)',
            color: 'var(--semantic-info)',
            borderRadius: 'var(--radius-sm)',
            gap: '4px'
          }}
          role="status"
          aria-live="polite"
        >
          ✏️ <span>Editing</span>
        </div>
      )}

      {/* Phase Three: Mobile Indicator - Blue pulse for mobile-submitted ideas */}
      {isFromMobile && !isDragOverlay && (
        <div
          className="absolute z-5"
          style={{
            bottom: isCollapsed ? '-4px' : '-4px',
            right: isCollapsed ? '-4px' : '-4px',
            width: '12px',
            height: '12px'
          }}
          role="status"
          aria-label="Submitted from mobile device"
        >
          {/* Pulse ring animation */}
          <div
            className="absolute inset-0 rounded-full animate-pulse-subtle"
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              animation: 'pulseSubtle 2s infinite'
            }}
          />
          {/* Solid blue dot */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              width: '12px',
              height: '12px',
              background: '#3B82F6',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Idea"
        message={`Are you sure you want to delete "${idea.content.length > 50 ? idea.content.substring(0, 50) + '...' : idea.content}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  )
}

// Performance-optimized memo with custom comparison
export default React.memo(OptimizedIdeaCard, (prevProps, nextProps) => {
  return (
    areIdeasEqual(prevProps.idea, nextProps.idea) &&
    prevProps.currentUser?.id === nextProps.currentUser?.id &&
    prevProps.isDragOverlay === nextProps.isDragOverlay &&
    prevProps.isFromMobile === nextProps.isFromMobile &&
    prevProps.isNewIdea === nextProps.isNewIdea
  )
})