import React from 'react'
import { Plus, Sparkles, FolderOpen, Target, Lightbulb } from 'lucide-react'
import { User, Project, IdeaCard } from '../../types'
import DesignMatrix from '../DesignMatrix'
import ProjectHeader from '../ProjectHeader'
import ProjectFiles from '../ProjectFiles'
import { useProjectFiles } from '../../hooks/useProjectFiles'

interface MatrixPageProps {
  currentUser: User
  currentProject: Project | null
  onProjectChange: (project: Project | null) => void
  onNavigateToProjects: () => void
  onIdeasCreated: (ideas: IdeaCard[]) => void
  onShowAddModal: () => void
  onShowAIModal: () => void
  // Props passed from AppLayout
  activeId?: string | null
  editingIdea?: IdeaCard | null
  onSetEditingIdea?: (idea: IdeaCard | null) => void
  onSetShowAddModal?: (show: boolean) => void
  onSetShowAIModal?: (show: boolean) => void
  // Ideas data passed down from AppLayout
  ideas?: IdeaCard[]
  deleteIdea?: (ideaId: string) => Promise<void>
  toggleCollapse?: (ideaId: string, collapsed?: boolean) => Promise<void>
}

const MatrixPage: React.FC<MatrixPageProps> = ({
  currentUser,
  currentProject,
  onProjectChange,
  onNavigateToProjects,
  onIdeasCreated,
  onShowAddModal,
  onShowAIModal,
  activeId,
  editingIdea: _editingIdea,
  onSetEditingIdea,
  onSetShowAddModal: _onSetShowAddModal,
  onSetShowAIModal: _onSetShowAIModal,
  ideas = [],
  deleteIdea,
  toggleCollapse
}) => {

  const { getCurrentProjectFiles, handleFilesUploaded, handleDeleteFile } = useProjectFiles(currentProject)

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Project Header */}
        <ProjectHeader 
          currentUser={currentUser}
          currentProject={currentProject}
          onProjectChange={onProjectChange}
          onIdeasCreated={onIdeasCreated}
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
              <button
                onClick={onNavigateToProjects}
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
                onClick={() => {
                  onShowAIModal()
                  _onSetShowAIModal?.(true)
                }}
                className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-2.5 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">AI Idea</span>
              </button>
              <button
                onClick={() => {
                  onShowAddModal()
                  _onSetShowAddModal?.(true)
                }}
                className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="font-medium">Create New Idea</span>
              </button>
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
            <div className="mt-10">
              <ProjectFiles
                currentUser={currentUser}
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
  )
}

export default MatrixPage