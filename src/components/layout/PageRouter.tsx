import { useEffect } from 'react'
import { User, Project } from '../../types'
import MatrixPage from '../pages/MatrixPage'
import DataManagement from '../pages/DataManagement'
import ReportsAnalytics from '../pages/ReportsAnalytics'
import UserSettings from '../pages/UserSettings'
import ProjectCollaboration from '../pages/ProjectCollaboration'
import ProjectManagement from '../ProjectManagement'
import ProjectRoadmap from '../ProjectRoadmap'
import ProjectFiles from '../ProjectFiles'
import { useProjectFiles } from '../../hooks/useProjectFiles'
import { IdeaCard } from '../../types'

interface PageRouterProps {
  currentPage: string
  currentUser: User
  currentProject: Project | null
  onProjectSelect: (project: Project | null) => void
  onPageChange: (page: string) => void
  onLogout: () => Promise<void>
  onUserUpdate: (user: Partial<User>) => void
  onDataUpdated: () => void
  onShowAddModal: () => void
  onShowAIModal: () => void
  // Ideas data passed down from App
  ideas?: IdeaCard[]
  setIdeas?: React.Dispatch<React.SetStateAction<IdeaCard[]>>
  // Additional props passed from AppLayout
  activeId?: string | null
  editingIdea?: IdeaCard | null
  onSetEditingIdea?: (idea: IdeaCard | null) => void
  onSetShowAddModal?: (show: boolean) => void
  onSetShowAIModal?: (show: boolean) => void
  deleteIdea?: (ideaId: string) => Promise<void>
  updateIdea?: (updatedIdea: IdeaCard) => Promise<void>
  toggleCollapse?: (ideaId: string, collapsed?: boolean) => Promise<void>
  isRestoringProject?: boolean
}

const PageRouter: React.FC<PageRouterProps> = ({
  currentPage,
  currentUser,
  currentProject,
  onProjectSelect,
  onPageChange,
  onLogout,
  onUserUpdate,
  onDataUpdated,
  onShowAddModal,
  onShowAIModal,
  ideas = [],
  setIdeas,
  activeId,
  editingIdea,
  onSetEditingIdea,
  onSetShowAddModal,
  onSetShowAIModal,
  deleteIdea,
  updateIdea: _updateIdea,
  toggleCollapse,
  isRestoringProject = false
}) => {
  const { getCurrentProjectFiles, handleFilesUploaded, handleDeleteFile } = useProjectFiles(currentProject)

  // Handle redirects that require a project when no project is available
  useEffect(() => {
    if (!isRestoringProject && !currentProject) {
      const pagesRequiringProject = ['data', 'reports', 'roadmap', 'files', 'collaboration']
      if (pagesRequiringProject.includes(currentPage)) {
        onPageChange('projects')
      }
    }
  }, [currentPage, currentProject, isRestoringProject, onPageChange])

  // Handle invalid pages
  useEffect(() => {
    const validPages = ['matrix', 'home', 'data', 'reports', 'projects', 'roadmap', 'files', 'collaboration', 'user']
    if (!validPages.includes(currentPage)) {
      onPageChange('matrix')
    }
  }, [currentPage, onPageChange])

  const renderPageContent = () => {
    
    switch (currentPage) {
      case 'matrix':
      case 'home':
        return (
          <MatrixPage
            currentUser={currentUser}
            currentProject={currentProject}
            onProjectChange={onProjectSelect}
            onNavigateToProjects={() => onPageChange('projects')}
            onShowAddModal={onShowAddModal}
            onShowAIModal={onShowAIModal}
            activeId={activeId}
            editingIdea={editingIdea}
            onSetEditingIdea={onSetEditingIdea}
            onSetShowAddModal={onSetShowAddModal}
            onSetShowAIModal={onSetShowAIModal}
            ideas={ideas}
            deleteIdea={deleteIdea}
            toggleCollapse={toggleCollapse}
          />
        )
      
      case 'data':
        if (!currentProject) {
          return (
            <div className="bg-slate-50 min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <DataManagement 
              ideas={ideas}
              currentUser={currentUser?.email || currentUser?.full_name || 'Anonymous'}
              onDataUpdated={onDataUpdated}
            />
          </div>
        )
      
      case 'reports':
        if (!currentProject) {
          return (
            <div className="bg-slate-50 min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <ReportsAnalytics 
              ideas={ideas}
              currentUser={currentUser}
              currentProject={currentProject}
            />
          </div>
        )
      
      case 'projects':
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectManagement 
              currentUser={currentUser}
              currentProject={currentProject}
              onProjectSelect={onProjectSelect}
              onProjectCreated={(project, projectIdeas) => {
                onProjectSelect(project)
                if (projectIdeas && setIdeas) {
                  setIdeas(projectIdeas)
                }
                onPageChange('matrix')
              }}
              onNavigateToMatrix={() => onPageChange('matrix')}
            />
          </div>
        )
      
      case 'roadmap':
        if (!currentProject) {
          return (
            <div className="bg-slate-50 min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <ProjectRoadmap
                currentUser={currentUser?.email || currentUser?.full_name || 'Anonymous'}
                currentProject={currentProject}
                ideas={ideas}
              />
            </div>
          </div>
        )
      
      case 'files':
        if (!currentProject || !currentUser) {
          return (
            <div className="bg-slate-50 min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectFiles
              currentProject={currentProject}
              files={getCurrentProjectFiles()}
              onFilesUploaded={handleFilesUploaded}
              onDeleteFile={handleDeleteFile}
            />
          </div>
        )
      
      case 'collaboration':
        if (!currentProject || !currentUser) {
          return (
            <div className="bg-slate-50 min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectCollaboration
              currentUser={currentUser}
              currentProject={currentProject}
              onNavigateBack={() => onPageChange('matrix')}
            />
          </div>
        )
      
      case 'user':
        return (
          <div className="bg-slate-50 min-h-screen">
            <UserSettings 
              currentUser={currentUser}
              onLogout={onLogout}
              onUserUpdate={onUserUpdate}
            />
          </div>
        )
      
      default:
        return null
    }
  }

  return <>{renderPageContent()}</>
}

export default PageRouter