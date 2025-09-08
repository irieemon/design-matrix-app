import { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Target, Plus, Lightbulb, Sparkles, FolderOpen } from 'lucide-react'
import { IdeaCard, Project, User, AuthUser } from './types'
import DesignMatrix from './components/DesignMatrix'
import IdeaCardComponent from './components/IdeaCardComponent'
import AddIdeaModal from './components/AddIdeaModal'
import AIIdeaModal from './components/AIIdeaModal'
import EditIdeaModal from './components/EditIdeaModal'
import AuthScreen from './components/auth/AuthScreen'
import Sidebar from './components/Sidebar'
import ProjectHeader from './components/ProjectHeader'
import DataManagement from './components/pages/DataManagement'
import ReportsAnalytics from './components/pages/ReportsAnalytics'
import UserSettings from './components/pages/UserSettings'
import ProjectCollaboration from './components/pages/ProjectCollaboration'
import ProjectManagement from './components/ProjectManagement'
import ProjectRoadmap from './components/ProjectRoadmap'
import ProjectFiles from './components/ProjectFiles'
import { DatabaseService } from './lib/database'
import { supabase } from './lib/supabase'

function App() {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<IdeaCard | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [, setAuthUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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

  // Initialize Supabase auth and handle session changes
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing authentication...')
        
        // Add a small delay to let the auth state listener run first
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Check if user is already authenticated by the auth state listener
        // (No check needed here since authUser is set by the auth state listener)
        
        // Get current session with timeout and graceful fallback
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve({ data: { session: null }, error: null }), 3000)
        )
        
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any
        console.log('🔐 Session check result:', { session: session?.user?.email, error })
        
        if (error) {
          console.error('❌ Error getting session:', error)
        }

        // Double-check if user was authenticated while we were waiting
        // (Let auth state listener handle this)

        if (session?.user && mounted) {
          console.log('✅ User already signed in:', session.user.email)
          await handleAuthUser(session.user)
        } else {
          console.log('❌ No active session found')
          // Try legacy localStorage user for backwards compatibility
          const savedUser = localStorage.getItem('prioritasUser')
          if (savedUser && mounted) {
            console.log('🔄 Found legacy user, migrating:', savedUser)
            setCurrentUser({
              id: 'legacy-user',
              email: savedUser,
              full_name: savedUser,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            setIsLoading(false)
          } else {
            console.log('❌ No legacy user found - waiting for auth state')
            // Give auth state listener a chance to work before showing login
            setTimeout(() => {
              if (mounted) {
                console.log('🔓 Final check: showing login screen')
                setIsLoading(false)
              }
            }, 1000)
          }
        }
      } catch (error) {
        console.error('💥 Error initializing auth:', error)
        if (mounted) setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('🔐 Auth state changed:', event, session?.user?.email)
      
      if (event === 'SIGNED_IN' && session?.user) {
        await handleAuthUser(session.user)
        // Loading is now handled inside handleAuthUser after completion
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null)
        setCurrentUser(null)
        setCurrentProject(null)
        setIdeas([])
        localStorage.removeItem('prioritasUser') // Clean up legacy
        setIsLoading(false)
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No initial session found, stop loading and show login
        console.log('🔓 No initial session, showing login screen')
        setIsLoading(false)
      }
    })

    // Clean up stale locks every 30 seconds
    const lockCleanupInterval = setInterval(() => {
      DatabaseService.cleanupStaleLocks()
    }, 30000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearInterval(lockCleanupInterval)
    }
  }, [])

  // Check if user has projects and redirect to appropriate page
  const checkUserProjectsAndRedirect = async (userId: string) => {
    try {
      console.log('📋 Checking if user has existing projects...')
      
      // Add timeout to prevent hanging
      const projectCheckPromise = DatabaseService.getUserOwnedProjects(userId)
      const timeoutPromise = new Promise<Project[]>((resolve) => 
        setTimeout(() => {
          console.log('⏰ Project check timeout, defaulting to matrix page')
          resolve([])
        }, 3000)
      )
      
      const userProjects = await Promise.race([projectCheckPromise, timeoutPromise])
      
      console.log('📋 Found', userProjects.length, 'projects for user')
      
      if (userProjects.length > 0) {
        console.log('🎯 User has existing projects, redirecting to projects page')
        setCurrentPage('projects')
      } else {
        console.log('📝 No existing projects found, staying on matrix/create page')
        setCurrentPage('matrix')
      }
    } catch (error) {
      console.error('❌ Error checking user projects:', error)
      // If project check fails, default to matrix page
      setCurrentPage('matrix')
    }
  }

  // Handle authenticated user
  const handleAuthUser = async (authUser: any) => {
    try {
      console.log('🔐 handleAuthUser called with:', authUser.email, authUser.id)
      setAuthUser(authUser)
      
      // Create fallback user immediately to prevent hanging
      const fallbackUser = {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      console.log('🔧 Created fallback user:', { 
        id: fallbackUser.id, 
        email: fallbackUser.email,
        idType: typeof fallbackUser.id 
      })
      
      // Skip database profile lookup for now and use auth user directly
      console.log('👤 Using authenticated user data directly')
      setCurrentUser(fallbackUser)
      
      // Check if user has existing projects and redirect accordingly
      await checkUserProjectsAndRedirect(authUser.id)
      
    } catch (error) {
      console.error('💥 Error in handleAuthUser:', error)
      // Even if everything fails, set a basic user to prevent infinite loading
      setCurrentUser({
        id: authUser?.id || 'unknown',
        email: authUser?.email || 'unknown@example.com',
        full_name: authUser?.email || 'Unknown User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      // Try to check for projects even in error case
      if (authUser?.id) {
        await checkUserProjectsAndRedirect(authUser.id)
      } else {
        setCurrentPage('matrix')
      }
    } finally {
      console.log('🔓 Setting loading to false')
      setIsLoading(false)
    }
  }

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

  const handleAuthSuccess = async (authUser: any) => {
    console.log('🎉 Authentication successful:', authUser.email)
    // The handleAuthUser function will be called by the auth state listener
    // so we don't need to do anything else here
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
      created_by: currentUser?.id || null,
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

  const handleUserUpdate = (updatedUser: Partial<User>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updatedUser })
    }
  }

  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out...')
      await supabase.auth.signOut()
      // The auth state change listener will handle the rest
    } catch (error) {
      console.error('Error logging out:', error)
      // Fallback: clear state manually
      setCurrentUser(null)
      setAuthUser(null)
      setCurrentProject(null)
      setIdeas([])
      localStorage.removeItem('prioritasUser')
      setCurrentPage('matrix')
    }
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
              {currentUser && (
                <ProjectHeader 
                  currentUser={currentUser}
                  currentProject={currentProject}
                  onProjectChange={handleProjectSelect}
                  onIdeasCreated={(newIdeas) => setIdeas(prev => [...prev, ...newIdeas])}
                />
              )}
              
              {/* Conditional Content Based on Project Selection */}
              {!currentProject ? (
                <div className="text-center py-16">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
                    <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">No Project Selected</h3>
                    <p className="text-slate-600 mb-6">
                      Select an existing project or create a new one to start working. All tools (Design Matrix, Roadmap, etc.) are organized around your projects.
                    </p>
                    <button
                      onClick={() => setCurrentPage('projects')}
                      className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-colors shadow-sm"
                    >
                      <FolderOpen className="w-5 h-5" />
                      <span>Go to Projects</span>
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
                  currentUser={currentUser}
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
                        currentUser={currentUser}
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

              {/* Project Files Section */}
              {currentUser && (
                <div className="mt-10">
                  <ProjectFiles
                    currentUser={currentUser}
                    currentProject={currentProject}
                    isEmbedded={true}
                  />
                </div>
              )}
              </>
              )}
            </main>
          </div>
        )
      case 'data':
        if (!currentProject) {
          setCurrentPage('projects')
          return null
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <DataManagement 
              ideas={ideas}
              currentUser={currentUser?.email || currentUser?.full_name || 'Anonymous'}
              onDataUpdated={handleDataUpdated}
            />
          </div>
        )
      case 'reports':
        if (!currentProject) {
          setCurrentPage('projects')
          return null
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <ReportsAnalytics 
              ideas={ideas}
              currentUser={currentUser?.email || currentUser?.full_name || 'Anonymous'}
              currentProject={currentProject}
            />
          </div>
        )
      case 'projects':
        return (
          <div className="bg-slate-50 min-h-screen">
            {currentUser && (
              <ProjectManagement 
                currentUser={currentUser}
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
            )}
          </div>
        )
      case 'roadmap':
        if (!currentProject) {
          setCurrentPage('projects')
          return null
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectRoadmap 
              currentUser={currentUser?.email || currentUser?.full_name || 'Anonymous'}
              currentProject={currentProject}
              ideas={ideas}
            />
          </div>
        )
      case 'files':
        if (!currentProject || !currentUser) {
          setCurrentPage('projects')
          return null
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectFiles
              currentUser={currentUser}
              currentProject={currentProject}
            />
          </div>
        )
      case 'collaboration':
        if (!currentProject || !currentUser) {
          setCurrentPage('projects')
          return null
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectCollaboration
              currentUser={currentUser}
              currentProject={currentProject}
              onNavigateBack={() => setCurrentPage('matrix')}
            />
          </div>
        )
      case 'user':
        return (
          <div className="bg-slate-50 min-h-screen">
            <UserSettings 
              currentUser={currentUser}
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

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
            <Target className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Prioritas</h1>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  // Show auth screen if no user is authenticated
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar 
        currentPage={currentPage}
        currentUser={currentUser?.email || currentUser?.full_name || 'User'}
        currentProject={currentProject}
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
        onToggleCollapse={setSidebarCollapsed}
      />
      <div className={`${sidebarCollapsed ? 'pl-20' : 'pl-72'} transition-all duration-300`}>
        {renderPageContent()}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddIdeaModal 
          onClose={() => setShowAddModal(false)}
          onAdd={addIdea}
          currentUser={currentUser}
        />
      )}

      {showAIModal && (
        <AIIdeaModal 
          onClose={() => setShowAIModal(false)}
          onAdd={addIdea}
          currentProject={currentProject}
          currentUser={currentUser}
        />
      )}

      {editingIdea && (
        <EditIdeaModal 
          idea={editingIdea}
          currentUser={currentUser}
          onClose={() => setEditingIdea(null)}
          onUpdate={updateIdea}
          onDelete={deleteIdea}
        />
      )}
    </div>
  )
}

export default App