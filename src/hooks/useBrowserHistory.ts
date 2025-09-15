import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface UseBrowserHistoryProps {
  currentPage: string
  onPageChange: (page: string) => void
  currentProject?: { id: string; name: string } | null
  onProjectRestore?: (projectId: string) => void
}

interface UseBrowserHistoryReturn {
  isRestoringProject: boolean
}

export const useBrowserHistory = ({
  currentPage,
  onPageChange,
  currentProject,
  onProjectRestore
}: UseBrowserHistoryProps): UseBrowserHistoryReturn => {
  const navigate = useNavigate()
  const location = useLocation()
  const lastCurrentPageRef = useRef(currentPage)
  const lastLocationRef = useRef(location.pathname + location.search)
  const lastProjectIdRef = useRef(currentProject?.id)
  const [isRestoringProject, setIsRestoringProject] = useState(false)
  const hasInitializedRef = useRef(false)
  const hasCompletedInitialLoadRef = useRef(false)

  // Check if we need to restore a project on initial load
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search)
    const projectIdFromUrl = urlParams.get('project')
    
    // If there's a project in URL but no current project, we need to restore
    if (projectIdFromUrl && !currentProject && onProjectRestore) {
      console.log('Setting isRestoringProject = true for project:', projectIdFromUrl)
      setIsRestoringProject(true)
    } else {
      if (isRestoringProject) {
        console.log('Clearing isRestoringProject - project restored or no project needed')
        console.log('Marking initial load as complete - project restoration finished')
        hasCompletedInitialLoadRef.current = true
      }
      setIsRestoringProject(false)
    }
  }, [location.search, currentProject, onProjectRestore, isRestoringProject])

  // Map page names to URL paths
  const pageToPath: Record<string, string> = {
    'matrix': '/',
    'projects': '/projects',
    'roadmap': '/roadmap',
    'management': '/management', 
    'files': '/files',
    'data': '/data',
    'reports': '/reports',
    'settings': '/settings',
    'collaboration': '/collaboration'
  }

  // Map URL paths to page names
  const pathToPage: Record<string, string> = {
    '/': 'matrix',
    '/projects': 'projects',
    '/roadmap': 'roadmap',
    '/management': 'management',
    '/files': 'files', 
    '/data': 'data',
    '/reports': 'reports',
    '/settings': 'settings',
    '/collaboration': 'collaboration'
  }

  // Map page names to document titles
  const pageToTitle: Record<string, string> = {
    'matrix': 'Design Matrix',
    'projects': 'Projects',
    'roadmap': 'Project Roadmap',
    'management': 'Project Management',
    'files': 'Project Files',
    'data': 'Data Management',
    'reports': 'Reports & Analytics',
    'settings': 'User Settings',
    'collaboration': 'Project Collaboration'
  }

  // Update document title when page or project changes
  useEffect(() => {
    const pageTitle = pageToTitle[currentPage] || 'Prioritas'
    const baseTitle = 'Prioritas'
    
    if (currentProject) {
      document.title = `${pageTitle} - ${currentProject.name} | ${baseTitle}`
    } else {
      document.title = `${pageTitle} | ${baseTitle}`
    }
  }, [currentPage, currentProject, pageToTitle])

  // Sync URL when page changes (programmatic navigation)
  useEffect(() => {
    // Don't navigate until initial load is completely finished
    if (!hasCompletedInitialLoadRef.current) {
      console.log('Blocking programmatic navigation - initial load not complete')
      return
    }
    
    // Don't navigate if we're currently restoring a project - let the restoration complete first
    if (isRestoringProject) {
      console.log('Blocking programmatic navigation - project restoration in progress')
      return
    }
    
    const targetPath = pageToPath[currentPage] || '/'
    
    // Build URL with project context
    const urlParams = new URLSearchParams(location.search)
    const currentProjectParam = urlParams.get('project')
    
    let targetUrl = targetPath
    if (currentProject) {
      targetUrl += `?project=${encodeURIComponent(currentProject.id)}`
    }
    
    // Only navigate if the page actually changed or project context changed
    const needsNavigation = (
      lastCurrentPageRef.current !== currentPage || 
      (currentProject?.id !== currentProjectParam)
    ) && (location.pathname !== targetPath || location.search !== (currentProject ? `?project=${encodeURIComponent(currentProject.id)}` : ''))
    
    if (needsNavigation) {
      console.log('Page/project changed programmatically:', lastCurrentPageRef.current, '->', currentPage, 'with project:', currentProject?.id, 'navigating to:', targetUrl)
      navigate(targetUrl, { replace: false })
    }
    
    lastCurrentPageRef.current = currentPage
    lastProjectIdRef.current = currentProject?.id
  }, [currentPage, currentProject, navigate, location.pathname, location.search, pageToPath, isRestoringProject])

  // Sync page and project when URL changes (browser navigation or direct URL access)
  useEffect(() => {
    const currentPageFromUrl = pathToPage[location.pathname] || 'matrix'
    const urlParams = new URLSearchParams(location.search)
    const projectIdFromUrl = urlParams.get('project')
    const currentFullUrl = location.pathname + location.search
    
    // Check if this is the initial load or a genuine URL change
    const isInitialLoad = !hasInitializedRef.current
    const fullUrlChanged = lastLocationRef.current !== currentFullUrl
    
    if (isInitialLoad || fullUrlChanged) {
      console.log('URL changed via browser:', lastLocationRef.current, '->', currentFullUrl)
      
      // Update page if it changed
      if (currentPageFromUrl !== currentPage) {
        console.log('Changing page to:', currentPageFromUrl)
        onPageChange(currentPageFromUrl)
      }
      
      // Restore project if specified in URL and different from current
      if (projectIdFromUrl && projectIdFromUrl !== currentProject?.id && onProjectRestore) {
        console.log('Restoring project from URL:', projectIdFromUrl)
        console.log('Project ID length:', projectIdFromUrl.length)
        console.log('Full URL search params:', location.search)
        setIsRestoringProject(true)
        onProjectRestore(projectIdFromUrl)
      } else if (isInitialLoad) {
        // If initial load and no project restoration needed, mark initial load as complete
        console.log('Initial load complete - no project restoration needed')
        hasCompletedInitialLoadRef.current = true
      }
      
      hasInitializedRef.current = true
    }
    
    lastLocationRef.current = currentFullUrl
  }, [location.pathname, location.search, currentPage, currentProject?.id, onPageChange, onProjectRestore, pathToPage])

  return { isRestoringProject }
}