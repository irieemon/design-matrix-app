import { useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import PrioritasLogo from './components/PrioritasLogo'
import { Project, User, IdeaCard } from './types'
import AdminPortal from './components/admin/AdminPortal'
import AuthScreen from './components/auth/AuthScreen'
import AppLayout from './components/layout/AppLayout'
import PageRouter from './components/layout/PageRouter'
import { useAuth } from './hooks/useAuth'
import { useIdeas } from './hooks/useIdeas'
import { useBrowserHistory } from './hooks/useBrowserHistory'
import { logger } from './utils/logger'
import { DatabaseService } from './lib/database'

function App() {
  const [currentPage, setCurrentPage] = useState<string>('matrix')
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [showAdminPortal, setShowAdminPortal] = useState(false)
  
  // Debug wrapper for page changes
  const handlePageChange = (newPage: string) => {
    console.log('🔄 App: Page change requested:', currentPage, '->', newPage)
    console.trace('Page change call stack')
    setCurrentPage(newPage)
  }
  
  // Modal and drag state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingIdea, setEditingIdea] = useState<IdeaCard | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)




  const { currentUser, isLoading, handleAuthSuccess, handleLogout, setCurrentUser } = useAuth({
    setCurrentProject,
    setCurrentPage: handlePageChange
  })

  // Centralized ideas management
  const { ideas, setIdeas, addIdea, updateIdea, deleteIdea, toggleCollapse: _toggleCollapse, handleDragEnd } = useIdeas({
    currentUser,
    currentProject,
    setShowAddModal,
    setShowAIModal,
    setEditingIdea
  })

  // Debug logging for App level ideas
  console.log('🚀 App: Ideas received from useIdeas hook:', ideas?.length || 0)
  console.log('🚀 App: Ideas details:', ideas)

  // Project restoration from URL
  const handleProjectRestore = async (projectId: string) => {
    try {
      logger.debug('🔄 App: Restoring project from URL:', projectId)
      const project = await DatabaseService.getProjectById(projectId)
      if (project) {
        logger.debug('✅ App: Project restored successfully:', project.name)
        console.log('🎯 App: Setting currentProject to:', project)
        setCurrentProject(project)
      } else {
        logger.warn('⚠️ App: Project not found or no access:', projectId)
        console.log('❌ App: Project restoration failed for:', projectId)
        // Don't clear current project if restoration fails - user might not have access
      }
    } catch (error) {
      logger.error('❌ App: Error restoring project:', error)
      console.log('💥 App: Project restoration error:', error)
    }
  }

  // Browser history integration with improved safeguards
  const { isRestoringProject } = useBrowserHistory({
    currentPage,
    onPageChange: handlePageChange,
    currentProject,
    onProjectRestore: handleProjectRestore
  })
  



  const handleProjectSelect = (project: Project | null) => {
    if (project) {
      logger.debug('🎯 App: handleProjectSelect called with:', project.name, project.id)
      setCurrentProject(project)
    } else {
      logger.debug('🎯 App: handleProjectSelect called with null, clearing project')
      setCurrentProject(null)
    }
  }

  const handleDataUpdated = () => {
    // Data updated handled by real-time subscriptions in hooks
  }

  const handleUserUpdate = (updatedUser: Partial<User>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updatedUser })
    }
  }

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white to-slate-100 rounded-2xl mb-4 shadow-lg">
            <PrioritasLogo className="text-blue-600 animate-pulse" size={32} />
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

  // Show admin portal if requested
  if (showAdminPortal) {
    return (
      <AdminPortal
        currentUser={currentUser}
        onBackToApp={() => setShowAdminPortal(false)}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <>
      <AppLayout
        currentUser={currentUser}
        currentProject={currentProject}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onLogout={handleLogout}
        onAdminAccess={() => setShowAdminPortal(true)}
        activeId={activeId}
        editingIdea={editingIdea}
        showAddModal={showAddModal}
        showAIModal={showAIModal}
        onSetActiveId={setActiveId}
        onSetEditingIdea={setEditingIdea}
        onSetShowAddModal={setShowAddModal}
        onSetShowAIModal={setShowAIModal}
        ideas={ideas}
        addIdea={addIdea}
        updateIdea={updateIdea}
        deleteIdea={deleteIdea}
        toggleCollapse={_toggleCollapse}
        handleDragEnd={handleDragEnd}
      >
        <PageRouter
          currentPage={currentPage}
          currentUser={currentUser}
          currentProject={currentProject}
          onProjectSelect={handleProjectSelect}
          onPageChange={handlePageChange}
          onLogout={handleLogout}
          onUserUpdate={handleUserUpdate}
          onDataUpdated={handleDataUpdated}
          onShowAddModal={() => setShowAddModal(true)}
          onShowAIModal={() => setShowAIModal(true)}
          ideas={ideas}
          setIdeas={setIdeas}
          isRestoringProject={isRestoringProject}
        />
      </AppLayout>
      <Analytics />
    </>
  )
}

export default App