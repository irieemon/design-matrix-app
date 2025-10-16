import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { sanitizeProjectId } from '../utils/uuid'
import { useLogger } from '../lib/logging'

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
  const logger = useLogger('useBrowserHistory')
  const lastCurrentPageRef = useRef(currentPage)
  const lastLocationRef = useRef(location.pathname + location.search)
  const lastProjectIdRef = useRef(currentProject?.id)
  const [isRestoringProject, setIsRestoringProject] = useState(false)
  const hasInitializedRef = useRef(false)
  const hasCompletedInitialLoadRef = useRef(false)
  const restorationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const failedRestorationAttemptsRef = useRef(new Set<string>())
  // CRITICAL FIX: Track attempted restorations to prevent infinite loop from duplicate useEffects
  const attemptedRestorationRef = useRef(new Set<string>())

  // CRITICAL FIX: Enhanced project restoration with deadlock prevention and auth coordination
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search)
    const rawProjectId = urlParams.get('project')
    // Convert legacy project IDs to proper UUID format
    const projectIdFromUrl = rawProjectId ? sanitizeProjectId(rawProjectId) : null

    // Clear any existing timeout when dependencies change
    if (restorationTimeoutRef.current) {
      clearTimeout(restorationTimeoutRef.current)
      restorationTimeoutRef.current = null
    }

    // DEADLOCK FIX: Remove auth waiting logic that causes circular dependency
    const shouldWaitForAuth = () => {
      // If URL has fresh=true, this is a fresh start, don't wait
      if (urlParams.has('fresh')) {
        return false
      }

      // CRITICAL: Never block on initial load - this causes deadlock with auth
      // Let project restoration proceed independently
      return false
    }

    // If there's a project in URL but no current project, we need to restore
    if (projectIdFromUrl && !currentProject && onProjectRestore && !isRestoringProject) {
      // CRITICAL FIX: Check if we've already attempted to restore this project in this session
      if (attemptedRestorationRef.current.has(projectIdFromUrl)) {
        logger.debug('Skipping restoration - already attempted for project', { projectId: projectIdFromUrl })
        return
      }

      // Check if we've already failed to restore this project
      if (failedRestorationAttemptsRef.current.has(projectIdFromUrl)) {
        logger.warn('Skipping restoration - already failed for project', { projectId: projectIdFromUrl })
        logger.debug('Permanently abandoning restoration for project', { projectId: projectIdFromUrl })
        hasCompletedInitialLoadRef.current = true
        return
      }

      // DEADLOCK FIX: Skip auth wait check - proceed with restoration immediately
      if (shouldWaitForAuth()) {
        logger.debug('Skipping auth wait check - proceeding with immediate restoration')
        // Continue with restoration instead of waiting
      }

      logger.info('Starting project restoration', { projectId: projectIdFromUrl })
      // CRITICAL FIX: Mark this project as attempted BEFORE calling restore to prevent duplicate calls
      attemptedRestorationRef.current.add(projectIdFromUrl)
      setIsRestoringProject(true)

      // PHASE 1 FIX: Increased restoration timeout to match auth timeout (8s)
      // Allows sufficient time for database query, network latency, and RLS overhead
      restorationTimeoutRef.current = setTimeout(() => {
        logger.warn('Project restoration timeout exceeded', { projectId: projectIdFromUrl, timeout: '8s' })
        failedRestorationAttemptsRef.current.add(projectIdFromUrl)
        setIsRestoringProject(false)
        hasCompletedInitialLoadRef.current = true
        restorationTimeoutRef.current = null
      }, 8000)

      // Trigger the restoration
      onProjectRestore(projectIdFromUrl)

    } else {
      // Clear restoration state when:
      // 1. No project in URL
      // 2. Project successfully restored (currentProject exists)
      // 3. No restoration function available
      if (isRestoringProject) {
        logger.info('Clearing restoration state - project restored or no restoration needed')
        logger.debug('Current restoration state', {
          projectInUrl: !!projectIdFromUrl,
          currentProject: !!currentProject
        })
        hasCompletedInitialLoadRef.current = true

        // Clear timeout on successful completion
        if (restorationTimeoutRef.current) {
          clearTimeout(restorationTimeoutRef.current)
          restorationTimeoutRef.current = null
        }
      }
      setIsRestoringProject(false)
    }
  }, [location.search, currentProject, onProjectRestore])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (restorationTimeoutRef.current) {
        clearTimeout(restorationTimeoutRef.current)
      }
    }
  }, [])

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
    // OPTIMIZED: Remove blocking logic that prevents navigation during auth
    // Allow navigation to proceed normally without waiting
    logger.debug('Allowing programmatic navigation - no blocking')

    const targetPath = pageToPath[currentPage] || '/'

    // Build URL with project context
    const urlParams = new URLSearchParams(location.search)
    const rawCurrentProjectParam = urlParams.get('project')
    const currentProjectParam = rawCurrentProjectParam ? sanitizeProjectId(rawCurrentProjectParam) : null

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
      logger.debug('Page/project changed programmatically', {
        from: lastCurrentPageRef.current,
        to: currentPage,
        projectId: currentProject?.id,
        targetUrl
      })
      navigate(targetUrl, { replace: false })
    }

    lastCurrentPageRef.current = currentPage
    lastProjectIdRef.current = currentProject?.id
  }, [currentPage, currentProject, navigate, pageToPath, isRestoringProject])
  // NOTE: location.pathname and location.search intentionally excluded from deps
  // They're used for comparison only, not as triggers (would cause infinite loop)

  // Sync page and project when URL changes (browser navigation or direct URL access)
  useEffect(() => {
    const currentPageFromUrl = pathToPage[location.pathname] || 'matrix'
    const urlParams = new URLSearchParams(location.search)
    const rawProjectId = urlParams.get('project')
    // Convert legacy project IDs to proper UUID format
    const projectIdFromUrl = rawProjectId ? sanitizeProjectId(rawProjectId) : null
    const currentFullUrl = location.pathname + location.search
    
    // Check if this is the initial load or a genuine URL change
    const isInitialLoad = !hasInitializedRef.current
    const fullUrlChanged = lastLocationRef.current !== currentFullUrl

    if (isInitialLoad || fullUrlChanged) {
      logger.debug('URL changed via browser', {
        from: lastLocationRef.current,
        to: currentFullUrl
      })

      // Update page if it changed
      if (currentPageFromUrl !== currentPage) {
        logger.debug('Changing page', { to: currentPageFromUrl })
        onPageChange(currentPageFromUrl)
      }

      // Restore project if specified in URL and different from current
      if (projectIdFromUrl && projectIdFromUrl !== currentProject?.id && onProjectRestore) {
        // CRITICAL FIX: Prevent duplicate restoration - first useEffect already handles this
        if (attemptedRestorationRef.current.has(projectIdFromUrl)) {
          logger.debug('Skipping duplicate restoration from second useEffect', { projectId: projectIdFromUrl })
        } else {
          logger.info('Restoring project from URL (second useEffect)', {
            projectId: projectIdFromUrl,
            projectIdLength: projectIdFromUrl.length,
            searchParams: location.search
          })
          attemptedRestorationRef.current.add(projectIdFromUrl)
          setIsRestoringProject(true)
          onProjectRestore(projectIdFromUrl)
        }
      } else if (isInitialLoad) {
        // If initial load and no project restoration needed, mark initial load as complete
        logger.debug('Initial load complete - no project restoration needed')
        hasCompletedInitialLoadRef.current = true
      }

      hasInitializedRef.current = true
    }

    lastLocationRef.current = currentFullUrl
  }, [location.pathname, location.search, currentPage, currentProject?.id, onPageChange, onProjectRestore, pathToPage])

  return { isRestoringProject }
}