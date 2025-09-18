/**
 * MainApp - Core application shell with clean separation of concerns
 *
 * Extracted from App.tsx to provide a focused app component without business logic.
 * Uses context providers to eliminate prop drilling and manage state cleanly.
 */

import { Analytics } from '@vercel/analytics/react'
import AdminPortal from '../admin/AdminPortal'
import AppLayout from '../layout/AppLayout'
import PageRouter from '../layout/PageRouter'
import { User } from '../../types'
import { useNavigation } from '../../contexts/NavigationContext'
import { useProject } from '../../contexts/ProjectContext'
import { useModal } from '../../contexts/ModalContext'
import { useAuth } from '../../hooks/useAuth'
import { useIdeas } from '../../hooks/useIdeas'
import { useBrowserHistory } from '../../hooks/useBrowserHistory'

interface MainAppProps {
  currentUser: User
  onLogout: () => void
  setCurrentUser: (user: User) => void
}

export default function MainApp({
  currentUser,
  onLogout,
  setCurrentUser
}: MainAppProps) {
  // Context hooks
  const { currentPage, handlePageChange } = useNavigation()
  const { currentProject, handleProjectSelect, handleProjectRestore } = useProject()
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

  // Ideas management with context integration
  const {
    ideas,
    setIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    toggleCollapse,
    handleDragEnd
  } = useIdeas({
    currentUser,
    currentProject,
    setShowAddModal,
    setShowAIModal,
    setEditingIdea
  })

  // Browser history integration
  const { isRestoringProject } = useBrowserHistory({
    currentPage,
    onPageChange: handlePageChange,
    currentProject,
    onProjectRestore: handleProjectRestore
  })

  const handleDataUpdated = () => {
    // Data updated handled by real-time subscriptions in hooks
  }

  const handleUserUpdate = (updatedUser: Partial<User>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updatedUser })
    }
  }

  // Show admin portal if requested
  if (showAdminPortal) {
    return (
      <AdminPortal
        currentUser={currentUser}
        onBackToApp={closeAdminPortal}
        onLogout={onLogout}
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
        onLogout={onLogout}
        onAdminAccess={openAdminPortal}
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
        toggleCollapse={toggleCollapse}
        handleDragEnd={handleDragEnd}
      >
        <PageRouter
          currentPage={currentPage}
          currentUser={currentUser}
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
        />
      </AppLayout>
      <Analytics />
    </>
  )
}