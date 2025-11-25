import React, { useMemo, memo, useCallback } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Edit3, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react'
import type { IdeaCard, User as UserType } from '../types'
import { getAccessibleDragProps, keyboardUtils } from '../utils/accessibility'
import { useAriaLiveRegion } from '../hooks/useAccessibility'
import { Button } from './ui/Button'

// Utility function to get user display name with better type safety
const getUserDisplayName = (
  userId: string | null | undefined, 
  currentUser: UserType | null | undefined
): string => {
  if (!userId) return 'Anonymous'
  if (currentUser?.id === userId) return 'You'
  // If it's a UUID (longer than 10 characters and contains hyphens), it's likely AI-generated
  if (userId.length > 10 && (userId.includes('-') || userId.length === 32)) {
    return 'AI Assistant'
  }
  return userId // fallback to showing the userId if it's not a UUID
}

// More specific prop types with better event handlers
interface IdeaCardProps {
  /** The idea card data to display */
  idea: IdeaCard
  /** Whether this card is currently being dragged */
  isDragging?: boolean
  /** Current authenticated user for permission checks */
  currentUser: UserType | null
  /** Callback fired when user clicks edit button */
  onEdit: (ideaId: string) => void
  /** Callback fired when user clicks delete button */ 
  onDelete: (ideaId: string) => void
  /** Callback fired when user toggles card collapse state */
  onToggleCollapse?: (ideaId: string, collapsed: boolean) => void
  /** Optional CSS class name for styling */
  className?: string
  /** Whether the card should be disabled (non-interactive) */
  disabled?: boolean
  /** Test ID for testing purposes */
  'data-testid'?: string
}

const IdeaCardComponent: React.FC<IdeaCardProps> = memo(({
  idea,
  isDragging,
  currentUser,
  onEdit,
  onDelete,
  onToggleCollapse,
  className: _className,
  disabled = false,
  'data-testid': _testId
}) => {
  const { announce } = useAriaLiveRegion()

  const { attributes, listeners, setNodeRef, transform, isDragging: isBeingDragged } = useDraggable({
    id: idea.id
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  // Stable lock status computation to prevent flashing
  const lockStatus = useMemo(() => {
    const hasLock = idea.editing_by && idea.editing_by.trim() !== ''
    const isLockedByOther = hasLock && idea.editing_by !== currentUser?.id
    const isLockedBySelf = hasLock && idea.editing_by === currentUser?.id
    
    // Only consider lock valid if within last 5 minutes
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
  }, [idea.editing_by, currentUser?.id]) // Deliberately exclude editing_at to prevent flashing
  
  const { isLockedByOther, isLockedBySelf } = lockStatus
  
  // Removed debug logging to prevent console spam

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only prevent default on actual links to avoid navigation
    if (e.target instanceof Element && e.target.closest('a')) {
      e.preventDefault()
    }

    // Don't interfere with button double-clicks
    if (e.target instanceof Element && (
      e.target.closest('button') ||
      e.target.closest('.idea-card-actions') ||
      e.target.closest('[role="button"]')
    )) {
      return // Let button handlers manage their own events
    }

    // Stop propagation only for double-click to prevent triggering parent handlers
    e.stopPropagation()

    if (!isLockedByOther && !disabled) {
      onEdit(idea.id)
      announce(`Editing idea: ${idea.content}`)
    }
  }, [isLockedByOther, disabled, onEdit, idea.id, announce, idea.content])

  // Single click handler for expand/collapse functionality
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only prevent default on actual links to avoid navigation
    if (e.target instanceof Element && e.target.closest('a')) {
      e.preventDefault()
    }

    // Don't interfere with button clicks (they have their own handlers)
    if (e.target instanceof Element && (
      e.target.closest('button') ||
      e.target.closest('.idea-card-actions') ||
      e.target.closest('[role="button"]')
    )) {
      return // Let button handlers manage their own events
    }

    // Only handle clicks on the main card area, not buttons
    if (onToggleCollapse && !isLockedByOther && !disabled) {
      const newState = !idea.is_collapsed
      onToggleCollapse(idea.id, newState)
      announce(`${newState ? 'Collapsed' : 'Expanded'} idea: ${idea.content}`)
    }
  }, [onToggleCollapse, isLockedByOther, disabled, idea.id, idea.is_collapsed, announce, idea.content])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle Enter or Space to edit
    if (keyboardUtils.isActionKey(e)) {
      e.preventDefault()
      if (!isLockedByOther && !disabled) {
        onEdit(idea.id)
        announce(`Editing idea: ${idea.content}`)
      }
    }

    // Handle arrow keys for positioning (when focused)
    if (keyboardUtils.isNavigationKey(e) && !isDragging && !isBeingDragged) {
      e.preventDefault()
      const direction = keyboardUtils.getArrowDirection(e)
      if (direction) {
        // Announce keyboard movement
        announce(`Use arrow keys to move idea card. Current position: ${Math.round(idea.x)}, ${Math.round(idea.y)}`)
      }
    }

    // Handle Delete key
    if (e.key === 'Delete' && e.shiftKey && !disabled) {
      e.preventDefault()
      onDelete(idea.id)
      announce(`Deleted idea: ${idea.content}`)
    }
  }, [isLockedByOther, disabled, onEdit, idea.id, idea.content, idea.x, idea.y, announce, isDragging, isBeingDragged, onDelete])

  const handleToggleCollapse = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (onToggleCollapse && !isLockedByOther && !disabled) {
      const newState = !idea.is_collapsed
      onToggleCollapse(idea.id, newState)
      announce(`${newState ? 'Collapsed' : 'Expanded'} idea: ${idea.content}`)
    }
  }, [onToggleCollapse, isLockedByOther, disabled, idea.id, idea.is_collapsed, announce, idea.content])

  const handleDelete = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      onDelete(idea.id)
      announce(`Deleted idea: ${idea.content}`)
    }
  }, [disabled, onDelete, idea.id, announce, idea.content])

  const handleEdit = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLockedByOther && !disabled) {
      onEdit(idea.id)
      announce(`Editing idea: ${idea.content}`)
    }
  }, [isLockedByOther, disabled, onEdit, idea.id, announce, idea.content])

  const isCollapsed = idea.is_collapsed || false

  // Generate accessible props for the draggable card
  const accessibleProps = getAccessibleDragProps({
    id: idea.id,
    label: `${idea.content} - ${idea.priority} priority idea${isLockedByOther ? ' (locked by another user)' : ''}`,
    position: { x: idea.x, y: idea.y },
    isDragging: isDragging || isBeingDragged
  })

  // Combine refs
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node)
    // cardRef is now handled by the useRef hook automatically
  }, [setNodeRef])

  return (
    <div
      data-testid="idea-card"
      ref={combinedRef}
      style={style}
      {...listeners}
      {...attributes}
      {...accessibleProps}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      className={`
        idea-card-base gpu-accelerated
        ${isCollapsed ? 'is-collapsed' : ''}
        ${isDragging || isBeingDragged ? 'is-dragging' : ''}
        ${isLockedByOther ? 'is-disabled' : ''}
        idea-card-priority-${idea.priority}
      `}
      aria-describedby={`${idea.id}-instructions ${idea.id}-position`}
    >
      {/* Screen reader instructions */}
      <div id={`${idea.id}-instructions`} className="sr-only">
        Double-click or press Enter to edit. Use arrow keys to move. Press Shift+Delete to delete.
      </div>
      <div id={`${idea.id}-position`} className="sr-only">
        Position: {Math.round(idea.x)}, {Math.round(idea.y)} in priority matrix
      </div>

      {/* Modern Delete Button */}
      <Button
        data-testid="idea-delete-button"
        onClick={handleDelete}
        variant="ghost"
        size="xs"
        icon={<Trash2 className="w-3.5 h-3.5" aria-hidden="true" />}
        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-xl opacity-0 hover:opacity-100 transition-all duration-200 hover:bg-red-600 z-10 shadow-lg hover:scale-110"
        style={{
          opacity: isDragging || isBeingDragged ? 0 : undefined,
          zIndex: 10
        }}
        disabled={disabled}
        aria-label={`Delete idea: ${idea.content}`}
      />

      {/* Card Content - Conditional Rendering */}
      {isCollapsed ? (
        // Collapsed View - Minimal Information
        <div data-testid="idea-content" className="p-1 relative pointer-events-none">
          {/* Collapse Toggle Button */}
          <Button
            data-testid="idea-drag-handle"
            onClick={handleToggleCollapse}
            variant="ghost"
            size="xs"
            icon={<ChevronDown className="w-2 h-2" />}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-slate-600 text-white rounded-full hover:bg-slate-700 transition-colors pointer-events-auto z-10 shadow-sm"
            disabled={disabled}
            aria-label="Expand card"
          />

          {/* Minimal Content */}
          <div className="text-center">
            {/* Priority Dot */}
            <div className={`w-1 h-1 rounded-full mx-auto mb-1 ${
              idea.priority === 'low' ? 'bg-slate-500' :
              idea.priority === 'moderate' ? 'bg-amber-500' :
              idea.priority === 'high' ? 'bg-red-500' :
              idea.priority === 'strategic' ? 'bg-blue-500' :
              'bg-purple-500'
            }`}></div>

            {/* Abbreviated Title */}
            <h3 data-testid="idea-title" className="text-xs font-medium text-slate-900 line-clamp-1 leading-tight">
              {idea.content.length > 8 ? idea.content.substring(0, 6) + '...' : idea.content}
            </h3>
          </div>
        </div>
      ) : (
        // Expanded View - Full Information
        <div data-testid="idea-content" className="p-5 relative pointer-events-none">
          {/* Priority Badge */}
          <span className={`idea-card-badge priority-${idea.priority}`}>
            {idea.priority}
          </span>

          {/* Action Buttons */}
          <div className="idea-card-actions">
            <Button
              data-testid="idea-drag-handle"
              onClick={handleToggleCollapse}
              variant="ghost"
              size="xs"
              icon={<ChevronUp className="w-4 h-4" />}
              className="idea-card-action-btn"
              disabled={disabled}
              aria-label="Collapse card"
            />
            <Button
              data-testid="idea-edit-button"
              onClick={handleEdit}
              variant="ghost"
              size="xs"
              icon={<Edit3 className="w-4 h-4" />}
              className="idea-card-action-btn edit"
              disabled={isLockedByOther || disabled}
              aria-label={`Edit idea: ${idea.content}`}
            />
          </div>

          {/* Idea Content */}
          <h3 data-testid="idea-title" className="idea-card-title">
            {idea.content}
          </h3>

          {/* Idea Details */}
          {idea.details && (
            <p className="idea-card-description">
              {idea.details}
            </p>
          )}

          {/* Footer with creator and date */}
          <div className="idea-card-metadata">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {getUserDisplayName(idea.created_by, currentUser)}
            </span>
            <span>
              {new Date(idea.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
      
      {/* Editing indicator */}
      {isLockedByOther && (
        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-lg shadow-lg">
          🔒 Someone editing
        </div>
      )}
      {isLockedBySelf && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-lg shadow-lg">
          ✏️ You're editing
        </div>
      )}

      {/* Double-click hint */}
      {!isLockedByOther && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-slate-400 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none bg-white/80 px-2 py-1 rounded-lg">
          Double-click to edit
        </div>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders when only timestamps change
  const prevIdea = prevProps.idea
  const nextIdea = nextProps.idea
  
  // Log what changed for debugging
  const changedFields = []
  if (prevIdea.id !== nextIdea.id) changedFields.push('id')
  if (prevIdea.content !== nextIdea.content) changedFields.push('content')
  if (prevIdea.details !== nextIdea.details) changedFields.push('details')
  if (prevIdea.priority !== nextIdea.priority) changedFields.push('priority')
  if (prevIdea.x !== nextIdea.x) changedFields.push('x')
  if (prevIdea.y !== nextIdea.y) changedFields.push('y')
  if (prevIdea.is_collapsed !== nextIdea.is_collapsed) changedFields.push('is_collapsed')
  if (prevIdea.editing_by !== nextIdea.editing_by) changedFields.push('editing_by')
  if (prevIdea.editing_at !== nextIdea.editing_at) changedFields.push('editing_at')
  if (prevIdea.updated_at !== nextIdea.updated_at) changedFields.push('updated_at')
  if (prevProps.isDragging !== nextProps.isDragging) changedFields.push('isDragging')
  if (prevProps.currentUser?.id !== nextProps.currentUser?.id) changedFields.push('currentUser')
  
  // Check if any significant fields changed (exclude timestamps)
  const significantFieldsChanged = (
    prevIdea.id !== nextIdea.id ||
    prevIdea.content !== nextIdea.content ||
    prevIdea.details !== nextIdea.details ||
    prevIdea.priority !== nextIdea.priority ||
    prevIdea.x !== nextIdea.x ||
    prevIdea.y !== nextIdea.y ||
    prevIdea.is_collapsed !== nextIdea.is_collapsed ||
    prevIdea.editing_by !== nextIdea.editing_by || // This is important for lock status
    prevProps.isDragging !== nextProps.isDragging ||
    prevProps.currentUser?.id !== nextProps.currentUser?.id
  )
  
  // Return true if props are equal (skip re-render), false if different (re-render)
  return !significantFieldsChanged
})

export default IdeaCardComponent