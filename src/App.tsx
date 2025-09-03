import { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Target, Plus, Lightbulb } from 'lucide-react'
import { IdeaCard, Position } from './types'
import DesignMatrix from './components/DesignMatrix'
import IdeaCardComponent from './components/IdeaCardComponent'
import AddIdeaModal from './components/AddIdeaModal'
import EditIdeaModal from './components/EditIdeaModal'
import { DatabaseService } from './lib/database'

function App() {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<IdeaCard | null>(null)

  // Configure drag sensors with distance threshold
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  )

  // Load ideas from Supabase on mount
  useEffect(() => {
    loadIdeas()
    
    // Subscribe to real-time updates
    const unsubscribe = DatabaseService.subscribeToIdeas(setIdeas)
    
    return unsubscribe
  }, [])

  const loadIdeas = async () => {
    const ideas = await DatabaseService.getAllIdeas()
    setIdeas(ideas)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event
    setActiveId(null)

    if (!delta || (delta.x === 0 && delta.y === 0)) return

    const ideaId = active.id as string
    const idea = ideas.find(i => i.id === ideaId)
    if (!idea) return

    // Matrix usable area is 520x520 pixels
    const matrixUsableWidth = 520
    const matrixUsableHeight = 520
    
    // New position after drag
    const newX = idea.x + delta.x
    const newY = idea.y + delta.y
    
    // Clamp to usable area
    const clampedX = Math.max(0, Math.min(matrixUsableWidth, newX))
    const clampedY = Math.max(0, Math.min(matrixUsableHeight, newY))

    // Update position in database
    await DatabaseService.updateIdea(ideaId, {
      x: clampedX,
      y: clampedY
    })
  }

  const addIdea = async (newIdea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => {
    await DatabaseService.createIdea(newIdea)
    setShowAddModal(false)
  }

  const updateIdea = async (updatedIdea: IdeaCard) => {
    await DatabaseService.updateIdea(updatedIdea.id, {
      content: updatedIdea.content,
      x: updatedIdea.x,
      y: updatedIdea.y,
      priority: updatedIdea.priority
    })
    setEditingIdea(null)
  }

  const deleteIdea = async (ideaId: string) => {
    await DatabaseService.deleteIdea(ideaId)
    setEditingIdea(null)
  }

  const activeIdea = activeId ? ideas.find(i => i.id === activeId) : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Target className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Design Matrix</h1>
              <p className="text-sm text-gray-600">Prioritize ideas with value vs. complexity analysis</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Idea</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <DesignMatrix 
            ideas={ideas}
            activeId={activeId}
            onEditIdea={setEditingIdea}
            onDeleteIdea={deleteIdea}
          />
          
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'ease',
            }}
          >
            {activeIdea ? (
              <div style={{ transform: 'rotate(5deg)' }}>
                <IdeaCardComponent 
                  idea={activeIdea} 
                  isDragging
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Statistics */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Ideas', value: ideas.length, color: 'blue', icon: Lightbulb },
            { label: 'Top Right', value: ideas.filter(i => i.x > 260 && i.y < 260).length, color: 'green', icon: Target },
            { label: 'Top Left', value: ideas.filter(i => i.x <= 260 && i.y < 260).length, color: 'purple', icon: Target },
            { label: 'Bottom Right', value: ideas.filter(i => i.x > 260 && i.y >= 260).length, color: 'red', icon: Target }
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 text-${stat.color}-600`} />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddIdeaModal 
          onClose={() => setShowAddModal(false)}
          onAdd={addIdea}
        />
      )}

      {editingIdea && (
        <EditIdeaModal 
          idea={editingIdea}
          onClose={() => setEditingIdea(null)}
          onUpdate={updateIdea}
          onDelete={deleteIdea}
        />
      )}
    </div>
  )
}

export default App