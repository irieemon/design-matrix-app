import { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Target, Plus, Lightbulb, Sparkles, FolderOpen } from 'lucide-react'
import { IdeaCard, Project } from './types'
import DesignMatrix from './components/DesignMatrix'
import IdeaCardComponent from './components/IdeaCardComponent'
import AddIdeaModal from './components/AddIdeaModal'
import AIIdeaModal from './components/AIIdeaModal'
import EditIdeaModal from './components/EditIdeaModal'
import WelcomeScreen from './components/WelcomeScreen'
import Sidebar from './components/Sidebar'
import ProjectHeader from './components/ProjectHeader'
import DataManagement from './components/pages/DataManagement'
import ReportsAnalytics from './components/pages/ReportsAnalytics'
import UserSettings from './components/pages/UserSettings'
import ProjectManagement from './components/ProjectManagement'
import ProjectRoadmap from './components/ProjectRoadmap'
import { DatabaseService } from './lib/database'

function App() {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<IdeaCard | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<string>('matrix')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)

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
      // Don't load ideas until a project is selected - they'll be loaded by the currentProject effect
      
      // Clean up stale locks every 30 seconds
      const lockCleanupInterval = setInterval(() => {
        DatabaseService.cleanupStaleLocks()
      }, 30000)
      
      return () => {
        clearInterval(lockCleanupInterval)
      }
    }
  }, [currentUser])

  const loadIdeas = async (projectId?: string) => {
    if (projectId) {
      console.log('📂 Loading ideas for project:', projectId)
      const ideas = await DatabaseService.getProjectIdeas(projectId)
      console.log('📋 Raw ideas returned from database:', ideas)
      setIdeas(ideas)
      console.log('✅ Loaded', ideas.length, 'ideas for project', projectId)
      console.log('📋 Ideas details:', ideas.map(i => ({ id: i.id, content: i.content, project_id: i.project_id })))
    } else {
      // If no project is selected, show no ideas
      console.log('📂 No project selected, clearing ideas')
      setIdeas([])
    }
  }

  // Load ideas when current project changes
  useEffect(() => {
    console.log('🔄 Project changed effect triggered. Current project:', currentProject?.name, currentProject?.id)
    if (currentProject) {
      console.log('📂 Project selected, loading ideas for:', currentProject.name, currentProject.id)
      loadIdeas(currentProject.id)
    } else {
      // Clear ideas when no project is selected
      console.log('📂 No project selected, clearing ideas')
      loadIdeas()
    }
  }, [currentProject])

  // Set up project-specific real-time subscription
  useEffect(() => {
    if (!currentUser) return

    console.log('🔄 Setting up project-specific subscription for:', currentProject?.id || 'all projects')
    const unsubscribe = DatabaseService.subscribeToIdeas(setIdeas, currentProject?.id)
    
    return () => {
      console.log('🔄 Cleaning up subscription')
      unsubscribe()
    }
  }, [currentUser, currentProject?.id])

  const handleProjectSelect = (project: Project | null) => {
    if (project) {
      console.log('🎯 App: handleProjectSelect called with:', project.name, project.id)
      console.log('🎯 App: Previous currentProject:', currentProject?.name, currentProject?.id)
      setCurrentProject(project)
      console.log('🎯 App: setCurrentProject called with:', project.name, project.id)
      loadIdeas(project.id)
    } else {
      console.log('🎯 App: handleProjectSelect called with null, clearing project')
      setCurrentProject(null)
      loadIdeas()
    }
  }

  const handleUserCreated = async (userName: string) => {
    setCurrentUser(userName)
    localStorage.setItem('prioritasUser', userName)
    // Don't load ideas until a project is selected
    setIdeas([])
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
    // Matrix is full width (~1200px on most screens) and 600px height
    const finalX = Math.max(-100, Math.min(1400, Math.round(newX))) // Allow wider range for X
    const finalY = Math.max(-50, Math.min(650, Math.round(newY)))   // Match matrix height (600px + padding)

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
    console.log('📥 App: Received new idea:', newIdea)
    
    const ideaWithUser = {
      ...newIdea,
      created_by: currentUser || 'Anonymous',
      project_id: currentProject?.id
    }
    
    console.log('💾 App: Creating idea in database...', ideaWithUser)
    
    const createdIdea = await DatabaseService.createIdea(ideaWithUser)
    
    if (createdIdea) {
      console.log('✅ App: Idea created successfully, adding to state:', createdIdea)
      // Immediately add to local state for instant feedback
      setIdeas(prev => [...prev, createdIdea])
    } else {
      console.error('❌ App: Failed to create idea in database')
    }
    
    console.log('🔄 App: Closing modals...')
    setShowAddModal(false)
    setShowAIModal(false)
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

  const toggleCollapse = async (ideaId: string) => {
    const idea = ideas.find(i => i.id === ideaId)
    if (!idea) return

    const newCollapsedState = !idea.is_collapsed

    // Immediately update local state for instant feedback
    setIdeas(prev => prev.map(i => 
      i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i
    ))

    // Update in database
    await DatabaseService.updateIdea(ideaId, {
      is_collapsed: newCollapsedState
    })
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
              {/* Project Header */}
              <ProjectHeader 
                currentUser={currentUser || 'Anonymous'}
                currentProject={currentProject}
                onProjectChange={handleProjectSelect}
                onIdeasCreated={(newIdeas) => setIdeas(prev => [...prev, ...newIdeas])}
              />
              
              {/* Conditional Content Based on Project Selection */}
              {!currentProject ? (
                <div className="text-center py-16">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
                    <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Select a Project</h3>
                    <p className="text-slate-600 mb-6">
                      Choose a project from the header above or create a new one to start working with your priority matrix.
                    </p>
                    <button
                      onClick={() => setCurrentPage('projects')}
                      className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-colors shadow-sm"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Create New Project</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Add Idea Buttons */}
                  <div className="flex justify-end gap-3 mb-6">
                    <button
                      onClick={() => setShowAIModal(true)}
                      className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-2.5 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="font-medium">AI Idea</span>
                    </button>
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
                  currentUser={currentUser || undefined}
                  onEditIdea={setEditingIdea}
                  onDeleteIdea={deleteIdea}
                  onToggleCollapse={toggleCollapse}
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
                        currentUser={currentUser || undefined}
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
              </>
              )}
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
              currentProject={currentProject}
            />
          </div>
        )
      case 'projects':
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectManagement 
              currentUser={currentUser || 'Anonymous'}
              currentProject={currentProject}
              onProjectSelect={handleProjectSelect}
              onProjectCreated={(project, ideas) => {
                console.log('🎯 App: Project created:', project.name, project.id)
                setCurrentProject(project)
                if (ideas) {
                  setIdeas(prev => [...prev, ...ideas])
                }
                setCurrentPage('matrix')
              }}
              onNavigateToMatrix={() => setCurrentPage('matrix')}
            />
          </div>
        )
      case 'roadmap':
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectRoadmap 
              currentUser={currentUser || 'Anonymous'}
              currentProject={currentProject}
              ideas={ideas}
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

      {showAIModal && (
        <AIIdeaModal 
          onClose={() => setShowAIModal(false)}
          onAdd={addIdea}
          currentProject={currentProject}
        />
      )}

      {editingIdea && (
        <EditIdeaModal 
          idea={editingIdea}
          currentUser={currentUser || 'Anonymous'}
          onClose={() => setEditingIdea(null)}
          onUpdate={updateIdea}
          onDelete={deleteIdea}
        />
      )}
    </div>
  )
}

export default App