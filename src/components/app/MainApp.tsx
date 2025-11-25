/**
 * MainApp - Core application shell with clean separation of concerns
 *
 * Extracted from App.tsx to provide a focused app component without business logic.
 * Uses context providers to eliminate prop drilling and manage state cleanly.
 */

import React, { useMemo, useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import AdminPortal from '../admin/AdminPortal'
import AppLayout from '../layout/AppLayout'
import PageRouter from '../layout/PageRouter'
// import PerformanceOverlay from '../dev/PerformanceOverlay'
// import TestDataInjector from '../test/TestDataInjector'
import { User } from '../../types'
import { useNavigation } from '../../contexts/NavigationContext'
import { useProject } from '../../contexts/ProjectContext'
import { useModal } from '../../contexts/ModalContext'
import { useUser } from '../../contexts/UserContext'
import { useIdeas } from '../../hooks/useIdeas'
import { useBrowserHistory } from '../../hooks/useBrowserHistory'
import { logger } from '../../utils/logger'

interface MainAppProps {
  currentUser: User
  onLogout: () => Promise<void>
  setCurrentUser: (user: User) => void
}

export default function MainApp({
  currentUser: propCurrentUser,
  onLogout
}: MainAppProps) {
  // Use centralized user context as the primary source of user data
  const { currentUser, setCurrentUser } = useUser()

  // Ensure we have a user (fallback to prop if context is not ready)
  // Use useMemo to prevent creating new user reference on every render
  const effectiveUser = useMemo(
    () => currentUser || propCurrentUser,
    [currentUser?.id, propCurrentUser?.id]
  )
  // Context hooks
  const { currentPage, handlePageChange, setInitialRoute } = useNavigation()
  const { currentProject, handleProjectSelect, handleProjectRestore, projects, projectsLoaded } = useProject()
  const {
    showAdminPortal,
    closeAdminPortal,
    openAdminPortal,
    activeId,
    editingIdea,
    showAddModal,
    showAIModal,
    setActiveId,
    setEditingIdea,
    setShowAddModal,
    setShowAIModal,
    openAddModal,
    openAIModal
  } = useModal()

  // Ideas management with context integration using centralized user
  const {
    ideas,
    setIdeas,
    loadIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    toggleCollapse,
    handleDragEnd
  } = useIdeas({
    currentUser: effectiveUser,
    currentProject,
    setShowAddModal,
    setShowAIModal,
    setEditingIdea
  })

  // Debug: Log loadIdeas availability from useIdeas hook
  React.useEffect(() => {
    console.log('🔧 MainApp: useIdeas hook returned loadIdeas:', {
      hasLoadIdeas: !!loadIdeas,
      loadIdeasType: typeof loadIdeas
    })
  }, [loadIdeas])

  // Browser history integration
  const { isRestoringProject } = useBrowserHistory({
    currentPage,
    onPageChange: handlePageChange,
    currentProject,
    onProjectRestore: handleProjectRestore
  })

  // Intelligent initial route determination
  // Routes users with projects to /projects, users without to /matrix
  useEffect(() => {
    logger.debug('🎯 MainApp useEffect triggered', {
      hasEffectiveUser: !!effectiveUser,
      projectsLoaded,
      currentPage,
      projectsLength: projects?.length
    })

    // Only run when we have user data and projects have loaded
    if (!effectiveUser || !projectsLoaded || currentPage !== null) {
      logger.debug('🎯 MainApp: Skipping route determination', {
        reason: !effectiveUser ? 'no user' : !projectsLoaded ? 'projects not loaded' : 'page already set'
      })
      return
    }

    logger.debug('🎯 MainApp: Determining initial route', {
      userId: effectiveUser.id,
      projectsLoaded,
      projectCount: projects?.length,
      currentPage
    })

    // Check if user navigated to specific URL
    const urlParams = new URLSearchParams(window.location.search)
    const hasProjectInUrl = urlParams.has('project')
    const hasSpecificPath = window.location.pathname !== '/'

    const userHasProjects = (projects?.length ?? 0) > 0

    logger.debug('🎯 MainApp: Route decision factors', {
      userHasProjects,
      hasProjectInUrl,
      hasSpecificPath,
      pathname: window.location.pathname
    })

    setInitialRoute(userHasProjects, hasProjectInUrl || hasSpecificPath)
  }, [effectiveUser?.id, projectsLoaded, projects, currentPage, setInitialRoute])

  const handleDataUpdated = () => {
    // Data updated handled by real-time subscriptions in hooks
  }

  const handleUserUpdate = (updatedUser: Partial<User>) => {
    if (effectiveUser) {
      setCurrentUser({ ...effectiveUser, ...updatedUser })
    }
  }

  // Show admin portal if requested
  if (showAdminPortal) {
    return (
      <AdminPortal
        currentUser={effectiveUser}
        onBackToApp={async () => { closeAdminPortal() }}
        onLogout={onLogout}
      />
    )
  }

  // Show loading screen while determining initial route
  if (currentPage === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4" style={{
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: 'var(--sapphire-500)',
            borderTopColor: 'transparent'
          }}></div>
          <p style={{ color: 'var(--graphite-600)' }}>Loading your workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <AppLayout
        currentUser={effectiveUser}
        currentProject={currentProject}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onLogout={onLogout}
        onAdminAccess={async () => { openAdminPortal() }}
        activeId={activeId}
        editingIdea={editingIdea}
        showAddModal={showAddModal}
        showAIModal={showAIModal}
        onSetActiveId={setActiveId}
        onSetEditingIdea={setEditingIdea}
        onSetShowAddModal={setShowAddModal}
        onSetShowAIModal={setShowAIModal}
        ideas={ideas}
        setIdeas={setIdeas}
        addIdea={addIdea}
        updateIdea={updateIdea}
        deleteIdea={deleteIdea}
        toggleCollapse={toggleCollapse}
        handleDragEnd={handleDragEnd}
        loadIdeas={loadIdeas}
      >
        <PageRouter
          currentPage={currentPage}
          currentUser={effectiveUser}
          currentProject={currentProject}
          onProjectSelect={handleProjectSelect}
          onPageChange={handlePageChange}
          onLogout={onLogout}
          onUserUpdate={handleUserUpdate}
          onDataUpdated={handleDataUpdated}
          onShowAddModal={openAddModal}
          onShowAIModal={openAIModal}
          ideas={ideas}
          setIdeas={setIdeas}
          isRestoringProject={isRestoringProject}
          loadIdeas={loadIdeas}
        />
      </AppLayout>
      <Analytics />
      {/* <TestDataInjector /> */}
      {/* <PerformanceOverlay position="bottom-right" /> */}
    </>
  )
}