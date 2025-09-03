import { useDraggable } from '@dnd-kit/core'
import { Edit3, Trash2 } from 'lucide-react'
import { IdeaCard } from '../types'

interface IdeaCardProps {
  idea: IdeaCard
  isDragging?: boolean
  onEdit: () => void
  onDelete: () => void
}

const priorityColors = {
  low: 'bg-gray-100 border-gray-300 text-gray-800',
  moderate: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  high: 'bg-red-100 border-red-300 text-red-800',
  strategic: 'bg-blue-100 border-blue-300 text-blue-800',
  innovation: 'bg-purple-100 border-purple-300 text-purple-800'
}

const IdeaCardComponent: React.FC<IdeaCardProps> = ({ idea, isDragging, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging: isBeingDragged } = useDraggable({
    id: idea.id
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onEdit()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={handleDoubleClick}
      className={`
        relative w-48 min-h-[120px] bg-white border-2 rounded-lg shadow-sm
        transition-all duration-200 hover:shadow-md select-none
        ${isDragging || isBeingDragged ? 'shadow-lg scale-105 rotate-2 z-50 cursor-grabbing' : 'cursor-pointer hover:cursor-grab'}
        ${priorityColors[idea.priority]}
      `}
    >
      {/* Delete Button - appears on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onDelete()
        }}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center hover:bg-red-600 z-10"
        style={{ 
          opacity: isDragging || isBeingDragged ? 0 : undefined,
          zIndex: 10
        }}
      >
        <Trash2 className="w-3 h-3" />
      </button>

      {/* Card Content */}
      <div className="p-4 relative pointer-events-none">
        {/* Priority Badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/50 capitalize">
            {idea.priority}
          </span>
          <Edit3 className="w-4 h-4 opacity-50 transition-opacity duration-200" />
        </div>

        {/* Idea Content */}
        <p className="text-sm font-medium leading-relaxed mb-3">
          {idea.content}
        </p>

        {/* Metrics */}
        <div className="flex justify-between items-center text-xs text-gray-600">
          <span>X: {idea.x}</span>
          <span>Y: {idea.y}</span>
        </div>
      </div>

      {/* Pin Effect */}
      <div className="absolute top-3 right-3 w-3 h-3 bg-gray-400 rounded-full opacity-30"></div>
      
      {/* Double-click hint */}
      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        Double-click to edit
      </div>
    </div>
  )
}

export default IdeaCardComponent