import { useDraggable } from '@dnd-kit/core'
import { Edit3, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react'
import { IdeaCard, User as UserType } from '../types'

interface IdeaCardProps {
  idea: IdeaCard
  isDragging?: boolean
  currentUser?: UserType | null
  onEdit: () => void
  onDelete: () => void
  onToggleCollapse?: (ideaId: string) => void
}

const priorityColors = {
  low: 'bg-slate-50 border-slate-200 text-slate-800',
  moderate: 'bg-amber-50 border-amber-200 text-amber-800',
  high: 'bg-red-50 border-red-200 text-red-800',
  strategic: 'bg-blue-50 border-blue-200 text-blue-800',
  innovation: 'bg-purple-50 border-purple-200 text-purple-800'
}

const IdeaCardComponent: React.FC<IdeaCardProps> = ({ idea, isDragging, currentUser, onEdit, onDelete, onToggleCollapse }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging: isBeingDragged } = useDraggable({
    id: idea.id
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  const isLockedByOther = idea.editing_by && idea.editing_by !== currentUser?.id
  const isLockedBySelf = idea.editing_by === currentUser?.id

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLockedByOther) {
      onEdit()
    }
  }

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onToggleCollapse && !isLockedByOther) {
      onToggleCollapse(idea.id)
    }
  }

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
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onDelete()
        }}
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
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  if (!isLockedByOther) {
                    onEdit()
                  }
                }}
                className={`w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center transition-colors pointer-events-auto ${
                  isLockedByOther ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200 cursor-pointer'
                }`}
                disabled={isLockedByOther || false}
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
              {idea.created_by || 'Anonymous'}
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
          🔒 {idea.editing_by}
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
}

export default IdeaCardComponent