import React, { useState, lazy, Suspense } from 'react'
import type { IdeaCard, Project, User } from '../../types'
import MobileTopBar from './MobileTopBar'
import MobileBottomNav from './MobileBottomNav'
import QuickCaptureSheet from './QuickCaptureSheet'

const EditIdeaModal = lazy(() => import('../EditIdeaModal'))

interface MobileShellProps {
  currentUser: User
  currentProject: Project | null
  currentPage: string
  onPageChange: (page: string) => void
  children: React.ReactNode
  ideas?: IdeaCard[]
  addIdea?: (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateIdea?: (idea: IdeaCard) => Promise<void>
  deleteIdea?: (ideaId: string) => Promise<void>
  editingIdea?: IdeaCard | null
  onSetEditingIdea?: (idea: IdeaCard | null) => void
}

export const MobileShell: React.FC<MobileShellProps> = ({
  currentUser,
  currentProject,
  currentPage,
  onPageChange,
  children,
  addIdea,
  updateIdea,
  deleteIdea,
  editingIdea,
  onSetEditingIdea,
}) => {
  const [captureOpen, setCaptureOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas-primary overflow-x-hidden">
      <MobileTopBar
        currentUser={currentUser}
        currentProject={currentProject}
        onOpenProjects={() => onPageChange('projects')}
        onOpenUser={() => onPageChange('user')}
      />

      <main
        id="main-content"
        className="w-full"
        style={{ paddingTop: '3.5rem', paddingBottom: '5rem', minHeight: '100vh' }}
      >
        {children}
      </main>

      <MobileBottomNav
        currentPage={currentPage}
        onPageChange={onPageChange}
        onCapture={() => setCaptureOpen(true)}
      />

      <QuickCaptureSheet
        isOpen={captureOpen}
        onClose={() => setCaptureOpen(false)}
        currentUser={currentUser}
        currentProject={currentProject}
        addIdea={addIdea}
      />

      {updateIdea && deleteIdea && editingIdea && onSetEditingIdea && (
        <Suspense fallback={null}>
          <EditIdeaModal
            idea={editingIdea}
            isOpen={!!editingIdea}
            currentUser={currentUser}
            onClose={() => onSetEditingIdea(null)}
            onUpdate={updateIdea}
            onDelete={deleteIdea}
          />
        </Suspense>
      )}
    </div>
  )
}

export default MobileShell
