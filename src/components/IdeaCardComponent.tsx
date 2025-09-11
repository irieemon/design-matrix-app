import { useDraggable } from '@dnd-kit/core'
import { Edit3, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react'
import type { IdeaCard, User as UserType } from '../types'
import { useMemo, memo, useCallback } from 'react'
import { logger } from '../utils/logger'

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

const priorityColors = {
  low: 'bg-slate-50 border-slate-200 text-slate-800',
  moderate: 'bg-amber-50 border-amber-200 text-amber-800',
  high: 'bg-red-50 border-red-200 text-red-800',
  strategic: 'bg-blue-50 border-blue-200 text-blue-800',
  innovation: 'bg-purple-50 border-purple-200 text-purple-800'
}

const IdeaCardComponent: React.FC<IdeaCardProps> = memo(({ 
  idea, 
  isDragging, 
  currentUser, 
  onEdit, 
  onDelete, 
  onToggleCollapse,
  className = '',
  disabled = false,
  'data-testid': testId
}) => {
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
    e.preventDefault()
    e.stopPropagation()
    if (!isLockedByOther && !disabled) {
      onEdit(idea.id)
    }
  }, [isLockedByOther, disabled, onEdit, idea.id])

  const handleToggleCollapse = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (onToggleCollapse && !isLockedByOther && !disabled) {
      onToggleCollapse(idea.id, !idea.is_collapsed)
    }
  }, [onToggleCollapse, isLockedByOther, disabled, idea.id, idea.is_collapsed])

  const handleDelete = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      onDelete(idea.id)
    }
  }, [disabled, onDelete, idea.id])

  const handleEdit = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLockedByOther && !disabled) {
      onEdit(idea.id)
    }
  }, [isLockedByOther, disabled, onEdit, idea.id])

  const isCollapsed = idea.is_collapsed || false

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={handleDoubleClick}
      className={`
        relative bg-white border rounded-xl shadow-sm transition-all duration-200 select-none
        ${isCollapsed ? 'w-32 min-h-[60px]' : 'w-52 min-h-[130px]'}
        ${isDragging || isBeingDragged ? 'shadow-xl scale-105 rotate-2 z-50 cursor-grabbing' : 
          isLockedByOther ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:cursor-grab hover:scale-[1.02] hover:shadow-md'}
        ${isLockedBySelf ? 'ring-2 ring-blue-400 ring-opacity-60' : ''}
        ${priorityColors[idea.priority]}
      `}
    >
      {/* Modern Delete Button */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-xl opacity-0 hover:opacity-100 transition-all duration-200 flex items-center justify-center hover:bg-red-600 z-10 shadow-lg hover:scale-110"
        style={{ 
          opacity: isDragging || isBeingDragged ? 0 : undefined,
          zIndex: 10
        }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Card Content - Conditional Rendering */}
      {isCollapsed ? (
        // Collapsed View - Minimal Information
        <div className="p-3 relative pointer-events-none">
          {/* Collapse Toggle Button */}
          <button
            onClick={handleToggleCollapse}
            className="absolute -top-1 -right-1 w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors pointer-events-auto z-10 shadow-lg"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Minimal Content */}
          <div className="text-center">
            {/* Priority Dot */}
            <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${
              idea.priority === 'low' ? 'bg-slate-500' :
              idea.priority === 'moderate' ? 'bg-amber-500' :
              idea.priority === 'high' ? 'bg-red-500' :
              idea.priority === 'strategic' ? 'bg-blue-500' :
              'bg-purple-500'
            }`}></div>
            
            {/* Abbreviated Title */}
            <h3 className="text-xs font-medium text-slate-900 line-clamp-2 leading-tight">
              {idea.content.length > 20 ? idea.content.substring(0, 17) + '...' : idea.content}
            </h3>
          </div>
        </div>
      ) : (
        // Expanded View - Full Information
        <div className="p-5 relative pointer-events-none">
          {/* Priority Badge, Edit Icon, and Collapse Toggle */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm capitalize border border-white/20 shadow-sm">
              {idea.priority}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleCollapse}
                className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-200 cursor-pointer pointer-events-auto"
              >
                <ChevronUp className="w-4 h-4 text-slate-600" />
              </button>
              <button
                onClick={handleEdit}
                className={`w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center transition-colors pointer-events-auto ${
                  isLockedByOther ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200 cursor-pointer'
                }`}
                disabled={isLockedByOther || disabled}
              >
                <Edit3 className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Idea Content */}
          <h3 className="text-sm font-semibold leading-relaxed mb-2 text-slate-900">
            {idea.content}
          </h3>

          {/* Idea Details */}
          {idea.details && (
            <p className="text-xs leading-relaxed text-slate-600 mb-3 line-clamp-3">
              {idea.details}
            </p>
          )}

          {/* Footer with creator and date */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3" />
              {getUserDisplayName(idea.created_by, currentUser)}
            </span>
            <span className="text-slate-400">
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
  
  const shouldSkipRender = !significantFieldsChanged
  
  logger.debug(`🎭 IdeaCard memo check for ${nextIdea.id}:`, {
    changedFields,
    shouldSkipRender,
    editing_by: nextIdea.editing_by,
    editing_at: nextIdea.editing_at
  })
  
  // Return true if props are equal (skip re-render), false if different (re-render)
  return shouldSkipRender
})

export default IdeaCardComponent