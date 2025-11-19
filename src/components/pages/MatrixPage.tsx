import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Sparkles, FolderOpen, Target, Lightbulb, Maximize2 } from 'lucide-react'
import { User, Project, IdeaCard } from '../../types'
import DesignMatrix from '../DesignMatrix'
import ProjectHeader from '../ProjectHeader'
import ProjectFiles from '../ProjectFiles'
import MatrixFullScreenView from '../matrix/MatrixFullScreenView'
import { useProjectFiles } from '../../hooks/useProjectFiles'
import { logger } from '../../utils/logger'
import { generateDemoUUID } from '../../utils/uuid'
import { Button } from '../ui/Button'

interface MatrixPageProps {
  currentUser: User
  currentProject: Project | null
  onProjectChange: (project: Project | null) => void
  onNavigateToProjects: () => void
  onShowAddModal: () => void
  onShowAIModal: () => void
  // Props passed from AppLayout
  activeId?: string | null
  editingIdea?: IdeaCard | null
  onSetEditingIdea?: (idea: IdeaCard | null) => void
  onSetShowAddModal?: (show: boolean) => void
  onSetShowAIModal?: (show: boolean) => void
  // Ideas data and handlers passed down from AppLayout
  ideas?: IdeaCard[]
  deleteIdea?: (ideaId: string) => Promise<void>
  toggleCollapse?: (ideaId: string, collapsed?: boolean) => Promise<void>
  handleDragEnd?: (event: any) => Promise<void>
  // Modal state for fullscreen rendering
  showAddModal?: boolean
  showAIModal?: boolean
  addIdea?: (idea: Partial<IdeaCard>) => Promise<void>
  updateIdea?: (ideaId: string, updates: Partial<IdeaCard>) => Promise<void>
}

const MatrixPage: React.FC<MatrixPageProps> = ({
  currentUser,
  currentProject,
  onProjectChange,
  onNavigateToProjects,
  onShowAddModal,
  onShowAIModal,
  activeId,
  editingIdea: _editingIdea,
  onSetEditingIdea,
  onSetShowAddModal: _onSetShowAddModal,
  onSetShowAIModal: _onSetShowAIModal,
  ideas = [],
  deleteIdea,
  toggleCollapse,
  handleDragEnd,
  showAddModal,
  showAIModal,
  addIdea,
  updateIdea
}) => {
  // Full-screen state
  const [isFullScreen, setIsFullScreen] = useState(false)

  // Memoize onExit callback to prevent useEffect cleanup in MatrixFullScreenView
  const handleExitFullScreen = useCallback(() => {
    setIsFullScreen(false)
  }, [])

  const { getCurrentProjectFiles, handleFilesUploaded, handleDeleteFile } = useProjectFiles(currentProject)
  
  // Performance-optimized logging - only log significant changes
  React.useEffect(() => {
    const ideaCount = ideas?.length || 0
    const projectName = currentProject?.name || 'none'

    // Only log when there's a meaningful change (new project or significant idea count change)
    if (currentProject?.id) {
      logger.performance(`MatrixPage: ${ideaCount} ideas loaded for project: ${projectName}`)
    }
  }, [currentProject?.id]) // Only trigger on project changes, not idea count changes

  return (
    <>
      {/* Full-Screen View - Rendered via Portal to document.body */}
      {isFullScreen && createPortal(
        <MatrixFullScreenView
          isActive={isFullScreen}
          onExit={handleExitFullScreen}
          currentUser={currentUser}
          currentProject={currentProject}
          ideas={ideas}
          activeId={activeId}
          onEditIdea={onSetEditingIdea || (() => {})}
          onDeleteIdea={deleteIdea || (async () => {})}
          onToggleCollapse={toggleCollapse || (async () => {})}
          onDragEnd={handleDragEnd || (async () => {})}
          onShowAddModal={() => {
            onShowAddModal()
            _onSetShowAddModal?.(true)
          }}
          onShowAIModal={() => {
            onShowAIModal()
            _onSetShowAIModal?.(true)
          }}
          onCloseAddModal={() => _onSetShowAddModal?.(false)}
          onCloseAIModal={() => _onSetShowAIModal?.(false)}
          showAddModal={showAddModal}
          showAIModal={showAIModal}
          editingIdea={_editingIdea}
          onAddIdea={addIdea}
          onUpdateIdea={updateIdea}
        />,
        document.body
      )}

      {/* Normal View */}
      <div className={`bg-slate-50 min-h-screen ${isFullScreen ? 'hidden' : ''}`}>
        {/* Main Content */}
        <main className="mx-auto px-6 py-8">
          {/* Project Header */}
          <ProjectHeader
            currentUser={currentUser}
            currentProject={currentProject}
            onProjectChange={onProjectChange}
          />
        
        {/* Conditional Content Based on Project Selection */}
        {!currentProject ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
              <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Project Selected</h3>
              <p className="text-slate-600 mb-6">
                Select an existing project or create a new one to start working. All tools (Design Matrix, Roadmap, etc.) are organized around your projects.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={onNavigateToProjects}
                  variant="primary"
                  size="lg"
                  icon={<FolderOpen className="w-5 h-5" />}
                >
                  Go to Projects
                </Button>
                <Button
                  onClick={() => {
                    // Create temporary demo project for immediate matrix access
                    const demoProject = {
                      id: generateDemoUUID('matrix'),
                      name: 'Demo Matrix Access',
                      description: 'Temporary project for testing matrix functionality',
                      project_type: 'other' as const,
                      status: 'active' as const,
                      priority_level: 'medium' as const,
                      visibility: 'private' as const,
                      owner_id: currentUser.id,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    }
                    onProjectChange(demoProject)
                    logger.debug('🎯 Demo project created for immediate matrix access')
                  }}
                  variant="success"
                  size="lg"
                  icon={<Target className="w-5 h-5" />}
                >
                  Access Matrix Now
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Add Idea Buttons */}
            <div className="flex justify-end gap-3 mb-6">
              <Button
                onClick={() => setIsFullScreen(true)}
                variant="secondary"
                size="md"
                icon={<Maximize2 className="w-4 h-4" />}
                aria-label="Enter full-screen mode"
              >
                Full Screen
              </Button>
              <Button
                onClick={() => {
                  onShowAIModal()
                  _onSetShowAIModal?.(true)
                }}
                variant="sapphire"
                size="md"
                icon={<Sparkles className="w-4 h-4" />}
              >
                AI Idea
              </Button>
              <Button
                onClick={() => {
                  onShowAddModal()
                  _onSetShowAddModal?.(true)
                }}
                data-testid="add-idea-button"
                variant="primary"
                size="md"
                icon={<Plus className="w-4 h-4" />}
              >
                Create New Idea
              </Button>
            </div>

            <DesignMatrix 
              ideas={ideas}
              activeId={activeId || null}
              currentUser={currentUser}
              onEditIdea={onSetEditingIdea || (() => {})}
              onDeleteIdea={deleteIdea || (async () => {})}
              onToggleCollapse={toggleCollapse || (async () => {})}
            />

            {/* Modern Statistics */}
            <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Ideas', value: (ideas || []).length, color: 'slate', bgColor: 'bg-slate-50', textColor: 'text-slate-600', valueColor: 'text-slate-900', icon: Lightbulb },
                { label: 'Quick Wins', value: (ideas || []).filter(i => i.x <= 260 && i.y < 260).length, color: 'emerald', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', valueColor: 'text-emerald-900', icon: Target },
                { label: 'Strategic', value: (ideas || []).filter(i => i.x > 260 && i.y < 260).length, color: 'blue', bgColor: 'bg-blue-50', textColor: 'text-blue-600', valueColor: 'text-blue-900', icon: Target },
                { label: 'Avoid', value: (ideas || []).filter(i => i.x > 260 && i.y >= 260).length, color: 'red', bgColor: 'bg-red-50', textColor: 'text-red-600', valueColor: 'text-red-900', icon: Target }
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
            <div className="mt-10">
              <ProjectFiles
                currentProject={currentProject}
                files={getCurrentProjectFiles()}
                onFilesUploaded={handleFilesUploaded}
                onDeleteFile={handleDeleteFile}
                isEmbedded={true}
              />
            </div>
          </>
        )}
        </main>
      </div>
    </>
  )
}

export default MatrixPage