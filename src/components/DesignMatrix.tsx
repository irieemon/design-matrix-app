import { useDroppable } from '@dnd-kit/core'
import { IdeaCard } from '../types'
import IdeaCardComponent from './IdeaCardComponent'

interface DesignMatrixProps {
  ideas: IdeaCard[]
  activeId?: string | null
  currentUser?: string
  onEditIdea: (idea: IdeaCard) => void
  onDeleteIdea: (ideaId: string) => void
  onToggleCollapse: (ideaId: string) => void
}

const DesignMatrix: React.FC<DesignMatrixProps> = ({ ideas, activeId, currentUser, onEditIdea, onDeleteIdea, onToggleCollapse }) => {
  const { setNodeRef } = useDroppable({
    id: 'matrix'
  })

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
      {/* Matrix Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Interactive Priority Matrix</h2>
        <p className="text-slate-500">Double-click any card to edit • Drag to reposition ideas across quadrants</p>
      </div>

      {/* Matrix Container */}
      <div 
        ref={setNodeRef}
        className="matrix-container relative w-full h-[600px] bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200/60 matrix-grid-background overflow-hidden"
      >
        {/* Axis Labels */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-sm font-medium text-slate-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
          Implementation Difficulty →
        </div>
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 -rotate-90 text-sm font-medium text-slate-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
          ← Business Value
        </div>

        {/* Modern Quadrant Labels */}
        <div className="absolute top-6 left-6 bg-emerald-50 text-emerald-800 px-4 py-3 rounded-xl text-sm font-semibold border border-emerald-200/60 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            Quick Wins
          </div>
          <div className="text-xs text-emerald-600 font-normal">High Value • Low Effort</div>
        </div>
        
        <div className="absolute top-6 right-6 bg-blue-50 text-blue-800 px-4 py-3 rounded-xl text-sm font-semibold border border-blue-200/60 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            Strategic
          </div>
          <div className="text-xs text-blue-600 font-normal">High Value • High Effort</div>
        </div>
        
        <div className="absolute bottom-20 left-6 bg-amber-50 text-amber-800 px-4 py-3 rounded-xl text-sm font-semibold border border-amber-200/60 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            Reconsider
          </div>
          <div className="text-xs text-amber-600 font-normal">Low Value • Low Effort</div>
        </div>
        
        <div className="absolute bottom-20 right-6 bg-red-50 text-red-800 px-4 py-3 rounded-xl text-sm font-semibold border border-red-200/60 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            Avoid
          </div>
          <div className="text-xs text-red-600 font-normal">Low Value • High Effort</div>
        </div>

        {/* Modern Center Lines */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300/60 transform -translate-x-0.5"></div>
        <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-300/60 transform -translate-y-0.5"></div>


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
                currentUser={currentUser}
                onEdit={() => onEditIdea(idea)}
                onDelete={() => onDeleteIdea(idea.id)}
                onToggleCollapse={onToggleCollapse}
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
              <p className="text-gray-600">Click "Add Idea" to get started with your priority matrix</p>
            </div>
          </div>
        )}
      </div>

      {/* Modern Matrix Guide */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="text-center p-6 bg-emerald-50 rounded-2xl border border-emerald-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-3 h-3 bg-emerald-500 rounded-full mx-auto mb-3"></div>
          <h4 className="font-semibold text-emerald-800 mb-2">Quick Wins</h4>
          <p className="text-sm text-emerald-600">Do these first for immediate impact</p>
        </div>
        
        <div className="text-center p-6 bg-blue-50 rounded-2xl border border-blue-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mb-3"></div>
          <h4 className="font-semibold text-blue-800 mb-2">Strategic</h4>
          <p className="text-sm text-blue-600">Plan carefully for long-term value</p>
        </div>
        
        <div className="text-center p-6 bg-amber-50 rounded-2xl border border-amber-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-3 h-3 bg-amber-500 rounded-full mx-auto mb-3"></div>
          <h4 className="font-semibold text-amber-800 mb-2">Reconsider</h4>
          <p className="text-sm text-amber-600">Maybe later when priorities shift</p>
        </div>
        
        <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-3"></div>
          <h4 className="font-semibold text-red-800 mb-2">Avoid</h4>
          <p className="text-sm text-red-600">Skip these to focus resources</p>
        </div>
      </div>
    </div>
  )
}

export default DesignMatrix