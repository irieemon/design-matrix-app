import { useState } from 'react'
import PrioritasLogo from './components/PrioritasLogo'
import { Project, User, IdeaCard } from './types'
import AdminPortal from './components/admin/AdminPortal'
import AuthScreen from './components/auth/AuthScreen'
import AppLayout from './components/layout/AppLayout'
import PageRouter from './components/layout/PageRouter'
import { useAuth } from './hooks/useAuth'
import { useIdeas } from './hooks/useIdeas'
import { logger } from './utils/logger'

function App() {
  const [currentPage, setCurrentPage] = useState<string>('matrix')
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [showAdminPortal, setShowAdminPortal] = useState(false)
  
  // Modal and drag state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingIdea, setEditingIdea] = useState<IdeaCard | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)




  const { currentUser, isLoading, handleAuthSuccess, handleLogout, setCurrentUser } = useAuth({
    setCurrentProject,
    setCurrentPage
  })

  // Centralized ideas management
  const { ideas, setIdeas, addIdea, updateIdea, deleteIdea, toggleCollapse: _toggleCollapse, handleDragEnd } = useIdeas({
    currentUser,
    currentProject,
    setShowAddModal,
    setShowAIModal,
    setEditingIdea
  })
  
  console.log('🔍 App render - ideas from useIdeas:', ideas, 'type:', typeof ideas, 'isArray:', Array.isArray(ideas), 'length:', ideas?.length)



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
    <AppLayout
      currentUser={currentUser}
      currentProject={currentProject}
      currentPage={currentPage}
      onPageChange={setCurrentPage}
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
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
        onUserUpdate={handleUserUpdate}
        onDataUpdated={handleDataUpdated}
        onShowAddModal={() => setShowAddModal(true)}
        onShowAIModal={() => setShowAIModal(true)}
        ideas={ideas}
        setIdeas={setIdeas}
      />
    </AppLayout>
  )
}

export default App