import { useEffect, lazy, Suspense } from 'react'
import { User, Project } from '../../types'
import MatrixPage from '../pages/MatrixPage'
import DataManagement from '../pages/DataManagement'
import UserSettings from '../pages/UserSettings'
import ProjectCollaboration from '../pages/ProjectCollaboration'
import PricingPage from '../pages/PricingPage'
import SubscriptionSuccessPage from '../pages/SubscriptionSuccessPage'
import FAQPage from '../pages/FAQPage'
// PERFORMANCE OPTIMIZATION: Lazy load large components to reduce initial bundle size
// Components loaded on demand when user navigates to specific routes
const ReportsAnalytics = lazy(() => import('../pages/ReportsAnalytics'))
const ProjectManagement = lazy(() => import('../ProjectManagement'))
const ProjectRoadmap = lazy(() => import('../ProjectRoadmap'))
const ProjectFiles = lazy(() => import('../ProjectFiles'))
const ButtonTestPage = lazy(() => import('../pages/ButtonTestPage').then(m => ({ default: m.ButtonTestPage })))
const FormTestPage = lazy(() => import('../pages/FormTestPage').then(m => ({ default: m.FormTestPage })))
const SkeletonTestPage = lazy(() => import('../pages/SkeletonTestPage').then(m => ({ default: m.SkeletonTestPage })))
const MonochromaticDemo = lazy(() => import('../demo/MonochromaticDemo'))
// import PerformanceDashboard from '../dev/PerformanceDashboard'
import { useProjectFiles } from '../../hooks/useProjectFiles'
import { IdeaCard } from '../../types'
import { logger } from '../../utils/logger'

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
  handleDragEnd?: (event: any) => Promise<void>
  isRestoringProject?: boolean
}

// Loading fallback component for lazy-loaded routes
const PageLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
    <div className="text-center">
      <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4" style={{
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: 'var(--sapphire-500)',
        borderTopColor: 'transparent'
      }}></div>
      <p style={{ color: 'var(--graphite-600)' }}>Loading...</p>
    </div>
  </div>
)

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
  handleDragEnd,
  isRestoringProject = false
}) => {
  const { getCurrentProjectFiles, handleFilesUploaded, handleDeleteFile } = useProjectFiles(currentProject)

  // Handle redirects that require a project when no project is available
  useEffect(() => {
    // CRITICAL FIX: Check if there's a project ID in the URL before redirecting
    // This prevents race condition where we redirect before project restoration completes
    const urlParams = new URLSearchParams(window.location.search)
    const projectIdFromUrl = urlParams.get('project')

    if (!isRestoringProject && !currentProject && !projectIdFromUrl) {
      const pagesRequiringProject = ['data', 'reports', 'roadmap', 'files', 'collaboration']
      if (pagesRequiringProject.includes(currentPage)) {
        logger.debug('No project available and no project in URL - redirecting to projects page')
        onPageChange('projects')
      }
    }
  }, [currentPage, currentProject, isRestoringProject, onPageChange])

  // Handle invalid pages
  useEffect(() => {
    const validPages = ['matrix', 'home', 'data', 'reports', 'projects', 'roadmap', 'management', 'files', 'collaboration', 'settings', 'user', 'pricing', 'subscription-success', 'faq', 'button-test', 'form-test', 'skeleton-test', 'performance', 'mono-demo']
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
            handleDragEnd={handleDragEnd}
          />
        )
      
      case 'data':
        if (!currentProject) {
          return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
              <div className="text-center">
                <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4" style={{
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: 'var(--sapphire-500)',
                  borderTopColor: 'transparent'
                }}></div>
                <p style={{ color: 'var(--graphite-600)' }}>{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="min-h-screen" style={{ backgroundColor: 'var(--canvas-primary)' }}>
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
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
              <div className="text-center">
                <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4" style={{
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: 'var(--sapphire-500)',
                  borderTopColor: 'transparent'
                }}></div>
                <p style={{ color: 'var(--graphite-600)' }}>{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="min-h-screen" style={{ backgroundColor: 'var(--canvas-primary)' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <ReportsAnalytics
                ideas={ideas}
                currentUser={currentUser}
                currentProject={currentProject}
              />
            </Suspense>
          </div>
        )
      
      case 'projects':
        return (
          <div className="min-h-screen" style={{ backgroundColor: 'var(--canvas-primary)' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <ProjectManagement
                currentUser={currentUser}
                currentProject={currentProject}
                onProjectSelect={onProjectSelect}
                onProjectCreated={(project, projectIdeas) => {
                  // CRITICAL FIX: Set ideas BEFORE selecting project to avoid race condition
                  if (projectIdeas && setIdeas) {
                    logger.debug('🎯 AI Starter: Setting', projectIdeas.length, 'ideas in state')
                    setIdeas(projectIdeas)
                  }

                  // Then select project
                  logger.debug('🎯 AI Starter: Selecting project:', project.name)
                  onProjectSelect(project)

                  // Finally navigate
                  logger.debug('🎯 AI Starter: Navigating to matrix')
                  onPageChange('matrix')
                }}
                onNavigateToMatrix={() => onPageChange('matrix')}
              />
            </Suspense>
          </div>
        )
      
      case 'roadmap':
        if (!currentProject) {
          return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
              <div className="text-center">
                <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4" style={{
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: 'var(--sapphire-500)',
                  borderTopColor: 'transparent'
                }}></div>
                <p style={{ color: 'var(--graphite-600)' }}>{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="min-h-screen" style={{ backgroundColor: 'var(--canvas-primary)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <Suspense fallback={<PageLoadingFallback />}>
                <ProjectRoadmap
                  currentUser={currentUser?.email || currentUser?.full_name || 'Anonymous'}
                  currentProject={currentProject}
                  ideas={ideas}
                />
              </Suspense>
            </div>
          </div>
        )
      
      case 'files':
        if (!currentProject || !currentUser) {
          return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
              <div className="text-center">
                <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4" style={{
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: 'var(--sapphire-500)',
                  borderTopColor: 'transparent'
                }}></div>
                <p style={{ color: 'var(--graphite-600)' }}>{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="min-h-screen" style={{ backgroundColor: 'var(--canvas-primary)' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <ProjectFiles
                currentProject={currentProject}
                files={getCurrentProjectFiles()}
                onFilesUploaded={handleFilesUploaded}
                onDeleteFile={handleDeleteFile}
              />
            </Suspense>
          </div>
        )
      
      case 'collaboration':
        if (!currentProject || !currentUser) {
          return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
              <div className="text-center">
                <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4" style={{
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: 'var(--sapphire-500)',
                  borderTopColor: 'transparent'
                }}></div>
                <p style={{ color: 'var(--graphite-600)' }}>{isRestoringProject ? 'Loading project...' : 'Redirecting to projects...'}</p>
              </div>
            </div>
          )
        }
        return (
          <div className="min-h-screen" style={{ backgroundColor: 'var(--canvas-primary)' }}>
            <ProjectCollaboration
              currentUser={currentUser}
              currentProject={currentProject}
              onNavigateBack={() => onPageChange('matrix')}
            />
          </div>
        )
      
      case 'user':
        return (
          <div className="min-h-screen" style={{ backgroundColor: 'var(--canvas-primary)' }}>
            <UserSettings
              currentUser={currentUser}
              onLogout={onLogout}
              onUserUpdate={onUserUpdate}
            />
          </div>
        )

      case 'pricing':
        return <PricingPage />

      case 'subscription-success':
        return <SubscriptionSuccessPage />

      case 'faq':
        return <FAQPage />

      case 'button-test':
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <ButtonTestPage />
          </Suspense>
        )

      case 'form-test':
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <FormTestPage />
          </Suspense>
        )

      case 'skeleton-test':
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <SkeletonTestPage />
          </Suspense>
        )

      case 'mono-demo':
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <MonochromaticDemo />
          </Suspense>
        )

      // case 'performance':
      //   return <PerformanceDashboard />

      default:
        return null
    }
  }

  return <>{renderPageContent()}</>
}

export default PageRouter