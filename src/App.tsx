import { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Target, Plus, Lightbulb } from 'lucide-react'
import { IdeaCard } from './types'
import DesignMatrix from './components/DesignMatrix'
import IdeaCardComponent from './components/IdeaCardComponent'
import AddIdeaModal from './components/AddIdeaModal'
import EditIdeaModal from './components/EditIdeaModal'
import WelcomeScreen from './components/WelcomeScreen'
import Sidebar from './components/Sidebar'
import DataManagement from './components/pages/DataManagement'
import ReportsAnalytics from './components/pages/ReportsAnalytics'
import UserSettings from './components/pages/UserSettings'
import { DatabaseService } from './lib/database'

function App() {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<IdeaCard | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<string>('matrix')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
    // Check if user exists in localStorage
    const savedUser = localStorage.getItem('prioritasUser')
    if (savedUser) {
      setCurrentUser(savedUser)
      loadIdeas()
      
      // Subscribe to real-time updates
      const unsubscribe = DatabaseService.subscribeToIdeas(setIdeas)
      return unsubscribe
    }
  }, [currentUser])

  const loadIdeas = async () => {
    const ideas = await DatabaseService.getAllIdeas()
    setIdeas(ideas)
  }

  const handleUserCreated = async (userName: string) => {
    setCurrentUser(userName)
    localStorage.setItem('prioritasUser', userName)
    loadIdeas()
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

    // New position after drag
    const newX = idea.x + delta.x
    const newY = idea.y + delta.y
    
    // Round to integers and add reasonable bounds (allow some overflow but not too much)
    const finalX = Math.max(-50, Math.min(800, Math.round(newX)))
    const finalY = Math.max(-50, Math.min(800, Math.round(newY)))

    // Immediately update local state for instant feedback
    setIdeas(prev => prev.map(i => 
      i.id === ideaId ? { ...i, x: finalX, y: finalY, updated_at: new Date().toISOString() } : i
    ))

    // Update position in database (in background)
    await DatabaseService.updateIdea(ideaId, {
      x: finalX,
      y: finalY
    })
  }

  const addIdea = async (newIdea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => {
    const ideaWithUser = {
      ...newIdea,
      created_by: currentUser || 'Anonymous'
    }
    const createdIdea = await DatabaseService.createIdea(ideaWithUser)
    if (createdIdea) {
      // Immediately add to local state for instant feedback
      setIdeas(prev => [...prev, createdIdea])
    }
    setShowAddModal(false)
  }

  const handleDataUpdated = () => {
    loadIdeas()
  }

  const handleUserUpdate = (newName: string) => {
    setCurrentUser(newName)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('prioritasUser')
    setCurrentPage('matrix')
  }

  const updateIdea = async (updatedIdea: IdeaCard) => {
    const result = await DatabaseService.updateIdea(updatedIdea.id, {
      content: updatedIdea.content,
      details: updatedIdea.details,
      x: updatedIdea.x,
      y: updatedIdea.y,
      priority: updatedIdea.priority
    })
    if (result) {
      // Immediately update local state for instant feedback
      setIdeas(prev => prev.map(i => 
        i.id === updatedIdea.id ? result : i
      ))
    }
    setEditingIdea(null)
  }

  const deleteIdea = async (ideaId: string) => {
    const success = await DatabaseService.deleteIdea(ideaId)
    if (success) {
      // Immediately remove from local state for instant feedback
      setIdeas(prev => prev.filter(i => i.id !== ideaId))
    }
    setEditingIdea(null)
  }

  const activeIdea = activeId ? ideas.find(i => i.id === activeId) : null

  const renderPageContent = () => {
    switch (currentPage) {
      case 'matrix':
      case 'home':
        return (
          <div className="bg-slate-50 min-h-screen">
            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
              {/* Add Idea Button */}
              <div className="flex justify-end mb-6">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">Create New Idea</span>
                </button>
              </div>
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

              {/* Modern Statistics */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total Ideas', value: ideas.length, color: 'slate', bgColor: 'bg-slate-50', textColor: 'text-slate-600', valueColor: 'text-slate-900', icon: Lightbulb },
                  { label: 'Quick Wins', value: ideas.filter(i => i.x <= 260 && i.y < 260).length, color: 'emerald', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', valueColor: 'text-emerald-900', icon: Target },
                  { label: 'Strategic', value: ideas.filter(i => i.x > 260 && i.y < 260).length, color: 'blue', bgColor: 'bg-blue-50', textColor: 'text-blue-600', valueColor: 'text-blue-900', icon: Target },
                  { label: 'Avoid', value: ideas.filter(i => i.x > 260 && i.y >= 260).length, color: 'red', bgColor: 'bg-red-50', textColor: 'text-red-600', valueColor: 'text-red-900', icon: Target }
                ].map((stat, index) => (
                  <div key={index} className={`${stat.bgColor} rounded-2xl p-6 border border-${stat.color}-200/60 shadow-sm hover:shadow-md transition-shadow`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 ${stat.bgColor === 'bg-slate-50' ? 'bg-slate-200' : `bg-${stat.color}-200`} rounded-xl`}>
                        <stat.icon className={`w-5 h-5 ${stat.valueColor}`} />
                      </div>
                      <div className={`text-3xl font-bold ${stat.valueColor}`}>
                        {stat.value}
                      </div>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${stat.textColor}`}>{stat.label}</p>
                      <p className={`text-xs ${stat.textColor} opacity-80 mt-1`}>
                        {stat.label === 'Total Ideas' && 'Ideas in matrix'}
                        {stat.label === 'Quick Wins' && 'High value, low effort'}
                        {stat.label === 'Strategic' && 'High value, high effort'}
                        {stat.label === 'Avoid' && 'Low value, high effort'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </main>
          </div>
        )
      case 'data':
        return (
          <div className="bg-slate-50 min-h-screen">
            <DataManagement 
              ideas={ideas}
              currentUser={currentUser || 'Anonymous'}
              onDataUpdated={handleDataUpdated}
            />
          </div>
        )
      case 'reports':
        return (
          <div className="bg-slate-50 min-h-screen">
            <ReportsAnalytics 
              ideas={ideas}
              currentUser={currentUser || 'Anonymous'}
            />
          </div>
        )
      case 'user':
        return (
          <div className="bg-slate-50 min-h-screen">
            <UserSettings 
              currentUser={currentUser || 'Anonymous'}
              onLogout={handleLogout}
              onUserUpdate={handleUserUpdate}
            />
          </div>
        )
      default:
        setCurrentPage('matrix')
        return null
    }
  }

  // Show welcome screen if no user is set
  if (!currentUser) {
    return <WelcomeScreen onUserCreated={handleUserCreated} />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar 
        currentPage={currentPage}
        currentUser={currentUser}
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
        onToggleCollapse={setSidebarCollapsed}
      />
      <div className={`${sidebarCollapsed ? 'pl-16' : 'pl-64'} transition-all duration-300`}>
        {renderPageContent()}
      </div>

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