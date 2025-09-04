import { useDraggable } from '@dnd-kit/core'
import { Edit3, Trash2, User } from 'lucide-react'
import { IdeaCard } from '../types'

interface IdeaCardProps {
  idea: IdeaCard
  isDragging?: boolean
  currentUser?: string
  onEdit: () => void
  onDelete: () => void
}

const priorityColors = {
  low: 'bg-slate-50 border-slate-200 text-slate-800',
  moderate: 'bg-amber-50 border-amber-200 text-amber-800',
  high: 'bg-red-50 border-red-200 text-red-800',
  strategic: 'bg-blue-50 border-blue-200 text-blue-800',
  innovation: 'bg-purple-50 border-purple-200 text-purple-800'
}

const IdeaCardComponent: React.FC<IdeaCardProps> = ({ idea, isDragging, currentUser, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging: isBeingDragged } = useDraggable({
    id: idea.id
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  const isLockedByOther = idea.editing_by && idea.editing_by !== currentUser
  const isLockedBySelf = idea.editing_by === currentUser

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLockedByOther) {
      onEdit()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={handleDoubleClick}
      className={`
        relative w-52 min-h-[130px] bg-white border rounded-xl shadow-sm
        transition-all duration-200 select-none
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

      {/* Modern Card Content */}
      <div className="p-5 relative pointer-events-none">
        {/* Priority Badge and Edit Icon */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm capitalize border border-white/20 shadow-sm">
            {idea.priority}
          </span>
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