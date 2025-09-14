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
  toggleCollapse
}) => {
  const { getCurrentProjectFiles, handleFilesUploaded, handleDeleteFile } = useProjectFiles(currentProject)

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
            onIdeasCreated={(newIdeas) => setIdeas && setIdeas(prev => [...prev, ...newIdeas])}
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
          onPageChange('projects')
          return null
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
          onPageChange('projects')
          return null
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
          onPageChange('projects')
          return null
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectRoadmap 
              currentUser={currentUser?.email || currentUser?.full_name || 'Anonymous'}
              currentProject={currentProject}
              ideas={ideas}
            />
          </div>
        )
      
      case 'files':
        if (!currentProject || !currentUser) {
          onPageChange('projects')
          return null
        }
        return (
          <div className="bg-slate-50 min-h-screen">
            <ProjectFiles
              currentUser={currentUser}
              currentProject={currentProject}
              files={getCurrentProjectFiles()}
              onFilesUploaded={handleFilesUploaded}
              onDeleteFile={handleDeleteFile}
            />
          </div>
        )
      
      case 'collaboration':
        if (!currentProject || !currentUser) {
          onPageChange('projects')
          return null
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
        onPageChange('matrix')
        return null
    }
  }

  return <>{renderPageContent()}</>
}

export default PageRouter