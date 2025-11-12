import React, { useState, lazy, Suspense } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { User, Project, IdeaCard } from '../../types'
import Sidebar from '../Sidebar'
import { OptimizedIdeaCard } from '../matrix/OptimizedIdeaCard'
// PERFORMANCE OPTIMIZATION: Lazy load modals - only loaded when opened
const AddIdeaModal = lazy(() => import('../AddIdeaModal'))
const AIIdeaModal = lazy(() => import('../AIIdeaModal'))
const EditIdeaModal = lazy(() => import('../EditIdeaModal'))
import { useSkipLinks } from '../../hooks/useAccessibility'
import { getAccessibleLandmarkProps } from '../../utils/accessibility'

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
  // Ideas data and functions from parent
  ideas?: IdeaCard[]
  addIdea?: (newIdea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateIdea?: (updatedIdea: IdeaCard) => Promise<void>
  deleteIdea?: (ideaId: string) => Promise<void>
  toggleCollapse?: (ideaId: string, collapsed?: boolean) => Promise<void>
  handleDragEnd?: (event: any) => Promise<void>
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
  onSetShowAIModal,
  ideas = [],
  addIdea,
  updateIdea,
  deleteIdea,
  toggleCollapse,
  handleDragEnd
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Initialize skip links for accessibility
  useSkipLinks()

  // Use external state if provided, otherwise internal state
  const [internalActiveId, setInternalActiveId] = useState<string | null>(null)
  const [internalShowAddModal, setInternalShowAddModal] = useState(false)
  const [internalShowAIModal, setInternalShowAIModal] = useState(false)
  const [internalEditingIdea, setInternalEditingIdea] = useState<IdeaCard | null>(null)

  // Determine which state to use (external or internal)
  const activeId = externalActiveId !== undefined ? externalActiveId : internalActiveId
  const showAddModal = externalShowAddModal !== undefined ? externalShowAddModal : internalShowAddModal
  const showAIModal = externalShowAIModal !== undefined ? externalShowAIModal : internalShowAIModal
  const editingIdea = externalEditingIdea !== undefined ? externalEditingIdea : internalEditingIdea

  // Determine which setters to use
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


  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEndWrapper = async (event: any) => {
    setActiveId(null)
    if (handleDragEnd) {
      await handleDragEnd(event)
    }
  }

  const activeIdea = activeId ? (ideas || []).find(i => i.id === activeId) : null

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(to bottom right, var(--canvas-primary), var(--sapphire-50), var(--sapphire-100))'
      }}
    >
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-4 focus:py-2 focus:rounded focus:text-sm focus:font-medium focus:no-underline"
        style={{
          backgroundColor: 'var(--sapphire-600)',
          color: '#ffffff'
        }}
        >
        Skip to main content
      </a>

      {/* Navigation landmark */}
      <Sidebar
        currentPage={currentPage}
        currentProject={currentProject}
        onPageChange={onPageChange}
        onLogout={onLogout}
        onAdminAccess={onAdminAccess}
        onToggleCollapse={setSidebarCollapsed}
      />

      {/* Main content area */}
      <main
        id="main-content"
        className={`min-h-screen ${sidebarCollapsed ? 'pl-20' : 'pl-72'} transition-all duration-300`}
        {...getAccessibleLandmarkProps('main', `${currentProject?.name || 'Application'} - ${currentPage}`)}
      >
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEndWrapper}>
          {React.cloneElement(children as React.ReactElement, {
            activeId,
            editingIdea,
            onSetEditingIdea: setEditingIdea,
            onSetShowAddModal: setShowAddModal,
            onSetShowAIModal: setShowAIModal,
            ideas,
            deleteIdea,
            updateIdea,
            toggleCollapse,
            handleDragEnd
          })}

          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'ease',
            }}
          >
            {activeIdea ? (
              <div
                role="img"
                aria-label={`Dragging ${activeIdea.content}`}
                style={{
                  // REDESIGN FIX: Updated dimensions to match card redesign (32-38% reduction)
                  width: activeIdea.is_collapsed ? '100px' : '130px',
                  height: activeIdea.is_collapsed ? '50px' : 'auto',
                  minHeight: activeIdea.is_collapsed ? '50px' : '90px',
                  // Ensure horizontal display
                  display: 'block',
                  // Use Lux surface token for background
                  background: 'var(--surface-primary)',
                  // CRITICAL FIX: Include border in dimensions to prevent white overflow
                  boxSizing: 'border-box',
                  // Clip any rendering beyond bounds
                  overflow: 'hidden',
                }}
              >
                <OptimizedIdeaCard
                  idea={activeIdea}
                  isDragOverlay
                  currentUser={currentUser}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onToggleCollapse={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Modals - wrapped in Suspense for lazy loading */}
      {addIdea && showAddModal && (
        <Suspense fallback={null}>
          <AddIdeaModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={addIdea}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {showAIModal && addIdea && (
        <Suspense fallback={null}>
          <AIIdeaModal
            onClose={() => setShowAIModal(false)}
            onAdd={addIdea}
            currentProject={currentProject}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {updateIdea && deleteIdea && editingIdea && (
        <Suspense fallback={null}>
          <EditIdeaModal
            idea={editingIdea}
            isOpen={!!editingIdea}
            currentUser={currentUser}
            onClose={() => setEditingIdea(null)}
            onUpdate={updateIdea}
            onDelete={deleteIdea}
          />
        </Suspense>
      )}
    </div>
  )
}

export default AppLayout