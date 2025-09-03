import { useDroppable } from '@dnd-kit/core'
import { IdeaCard } from '../types'
import IdeaCardComponent from './IdeaCardComponent'

interface DesignMatrixProps {
  ideas: IdeaCard[]
  activeId?: string | null
  onEditIdea: (idea: IdeaCard) => void
  onDeleteIdea: (ideaId: string) => void
}

const DesignMatrix: React.FC<DesignMatrixProps> = ({ ideas, activeId, onEditIdea, onDeleteIdea }) => {
  const { setNodeRef } = useDroppable({
    id: 'matrix'
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      {/* Matrix Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Interactive Matrix</h2>
        <p className="text-gray-600">Double-click any card to edit • Drag to reposition</p>
      </div>

      {/* Matrix Container */}
      <div 
        ref={setNodeRef}
        className="matrix-container relative w-full h-[600px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 matrix-grid-background overflow-hidden"
      >
        {/* Axis Labels */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded shadow-sm">
          Implementation Difficulty →
        </div>
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 -rotate-90 text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded shadow-sm">
          ← Business Value
        </div>

        {/* Quadrant Labels */}
        <div className="absolute top-4 left-4 bg-green-100 text-green-800 px-3 py-2 rounded-lg text-sm font-medium border border-green-200">
          🟢 Quick Wins
          <div className="text-xs text-green-600 mt-1">High Value • Low Effort</div>
        </div>
        
        <div className="absolute top-4 right-4 bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm font-medium border border-blue-200">
          🔵 Strategic
          <div className="text-xs text-blue-600 mt-1">High Value • High Effort</div>
        </div>
        
        <div className="absolute bottom-16 left-4 bg-red-100 text-red-800 px-3 py-2 rounded-lg text-sm font-medium border border-red-200">
          🔴 Avoid
          <div className="text-xs text-red-600 mt-1">Low Value • Low Effort</div>
        </div>
        
        <div className="absolute bottom-16 right-4 bg-orange-100 text-orange-800 px-3 py-2 rounded-lg text-sm font-medium border border-orange-200">
          🟠 Reconsider
          <div className="text-xs text-orange-600 mt-1">Low Value • High Effort</div>
        </div>

        {/* Center Lines */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-300 transform -translate-x-0.5"></div>
        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-300 transform -translate-y-0.5"></div>


        {/* Idea Cards */}
        {ideas.map((idea) => {
          // Use direct pixel positions with 40px padding offset
          const x = idea.x + 40  // Add padding offset
          const y = idea.y + 40  // Add padding offset
          
          return (
            <div
              key={idea.id}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
                opacity: activeId === idea.id ? 0.3 : 1,  // Fade original during drag
                visibility: activeId === idea.id ? 'hidden' : 'visible'  // Hide completely during drag
              }}
            >
              <IdeaCardComponent 
                idea={idea}
                onEdit={() => onEditIdea(idea)}
                onDelete={() => onDeleteIdea(idea.id)}
              />
            </div>
          )
        })}

        {/* Empty State */}
        {ideas.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-400 text-4xl mb-4">💡</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No ideas yet</h3>
              <p className="text-gray-600">Click "Add Idea" to get started with your design thinking matrix</p>
            </div>
          </div>
        )}
      </div>

      {/* Matrix Guide */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="text-2xl mb-2">🟢</div>
          <h4 className="font-medium text-green-800">Quick Wins</h4>
          <p className="text-sm text-green-600 mt-1">Do these first for immediate impact</p>
        </div>
        
        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-2xl mb-2">🔵</div>
          <h4 className="font-medium text-blue-800">Strategic</h4>
          <p className="text-sm text-blue-600 mt-1">Plan carefully for long-term value</p>
        </div>
        
        <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="text-2xl mb-2">🔴</div>
          <h4 className="font-medium text-red-800">Avoid</h4>
          <p className="text-sm text-red-600 mt-1">Skip these to focus resources</p>
        </div>
        
        <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="text-2xl mb-2">🟠</div>
          <h4 className="font-medium text-orange-800">Reconsider</h4>
          <p className="text-sm text-orange-600 mt-1">Maybe later when priorities shift</p>
        </div>
      </div>
    </div>
  )
}

export default DesignMatrix