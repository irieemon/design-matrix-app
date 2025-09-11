import React, { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { User, Project, IdeaCard } from '../../types'
import Sidebar from '../Sidebar'
import IdeaCardComponent from '../IdeaCardComponent'
import AddIdeaModal from '../AddIdeaModal'
import AIIdeaModal from '../AIIdeaModal'
import EditIdeaModal from '../EditIdeaModal'
import { useIdeas } from '../../hooks/useIdeas'

interface AppLayoutProps {
  currentUser: User
  currentProject: Project | null
  currentPage: string
  onPageChange: (page: string) => void
  onLogout: () => Promise<void>
  onAdminAccess: () => void
  children: React.ReactNode
  // Modal state and functions to pass down
  activeId?: string | null
  editingIdea?: IdeaCard | null
  showAddModal?: boolean
  showAIModal?: boolean
  onSetActiveId?: (id: string | null) => void
  onSetEditingIdea?: (idea: IdeaCard | null) => void
  onSetShowAddModal?: (show: boolean) => void
  onSetShowAIModal?: (show: boolean) => void
}

const AppLayout: React.FC<AppLayoutProps> = ({
  currentUser,
  currentProject,
  currentPage,
  onPageChange,
  onLogout,
  onAdminAccess,
  children,
  activeId: externalActiveId,
  editingIdea: externalEditingIdea,
  showAddModal: externalShowAddModal,
  showAIModal: externalShowAIModal,
  onSetActiveId,
  onSetEditingIdea,
  onSetShowAddModal,
  onSetShowAIModal
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Use external state if provided, otherwise internal state
  const [internalActiveId, setInternalActiveId] = useState<string | null>(null)
  const [internalShowAddModal, setInternalShowAddModal] = useState(false)
  const [internalShowAIModal, setInternalShowAIModal] = useState(false)
  const [internalEditingIdea, setInternalEditingIdea] = useState<IdeaCard | null>(null)
  
  const activeId = externalActiveId !== undefined ? externalActiveId : internalActiveId
  const showAddModal = externalShowAddModal !== undefined ? externalShowAddModal : internalShowAddModal
  const showAIModal = externalShowAIModal !== undefined ? externalShowAIModal : internalShowAIModal
  const editingIdea = externalEditingIdea !== undefined ? externalEditingIdea : internalEditingIdea
  
  const setActiveId = onSetActiveId || setInternalActiveId
  const setShowAddModal = onSetShowAddModal || setInternalShowAddModal
  const setShowAIModal = onSetShowAIModal || setInternalShowAIModal
  const setEditingIdea = onSetEditingIdea || setInternalEditingIdea

  // Configure drag sensors with distance threshold
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  )

  const { ideas, handleDragEnd, addIdea, updateIdea, deleteIdea } = useIdeas({
    currentUser,
    currentProject,
    setShowAddModal,
    setShowAIModal,
    setEditingIdea
  })

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEndWrapper = async (event: any) => {
    setActiveId(null)
    await handleDragEnd(event)
  }

  const activeIdea = activeId ? ideas.find(i => i.id === activeId) : null

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar 
        currentPage={currentPage}
        currentUser={currentUser?.email || currentUser?.full_name || 'User'}
        currentUserObj={currentUser}
        currentProject={currentProject}
        onPageChange={onPageChange}
        onLogout={onLogout}
        onAdminAccess={onAdminAccess}
        onToggleCollapse={setSidebarCollapsed}
      />
      
      <div className={`${sidebarCollapsed ? 'pl-20' : 'pl-72'} transition-all duration-300`}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEndWrapper}>
          {React.cloneElement(children as React.ReactElement, {
            activeId,
            editingIdea,
            onSetEditingIdea: setEditingIdea,
            onSetShowAddModal: setShowAddModal,
            onSetShowAIModal: setShowAIModal
          })}
          
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

export default AppLayout