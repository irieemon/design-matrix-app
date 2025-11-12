/**
 * NavigationContext - Manages page routing and navigation state
 *
 * Extracted from App.tsx to separate navigation concerns and eliminate prop drilling.
 * Handles page state, navigation changes, and browser history integration.
 */

import { createContext, useContext, useState, ReactNode } from 'react'
import { logger } from '../lib/logging'

interface NavigationContextType {
  currentPage: string | null // null = initial route not yet determined
  setCurrentPage: (page: string) => void
  handlePageChange: (newPage: string) => void
  setInitialRoute: (userHasProjects: boolean, urlHasPath: boolean) => void
  hasSetInitialRoute: boolean
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

interface NavigationProviderProps {
  children: ReactNode
  initialPage?: string
}

export function NavigationProvider({ children, initialPage = 'matrix' }: NavigationProviderProps) {
  const [currentPage, setCurrentPage] = useState<string | null>(null) // null until route determined
  const [hasSetInitialRoute, setHasSetInitialRoute] = useState(false)
  const navLogger = logger.withContext({ component: 'NavigationContext' })

  // Debug wrapper for page changes
  const handlePageChange = (newPage: string) => {
    navLogger.debug('Page change requested', {
      from: currentPage,
      to: newPage,
      timestamp: Date.now()
    })
    setCurrentPage(newPage)
  }

  /**
   * Set the initial route based on user's project state
   * Only runs once per session to determine landing page
   */
  const setInitialRoute = (userHasProjects: boolean, urlHasPath: boolean) => {
    if (hasSetInitialRoute) {
      navLogger.debug('Initial route already set, skipping')
      return
    }

    navLogger.debug('🎯 setInitialRoute called', {
      userHasProjects,
      urlHasPath,
      currentPage,
      timestamp: Date.now()
    })

    if (urlHasPath) {
      // User navigated to specific URL, respect it
      navLogger.debug('URL has specific path, using that as initial route')
      if (currentPage === null) {
        // If we haven't set a page yet, use the initial default
        // The URL sync logic in useBrowserHistory will update it correctly
        setCurrentPage(initialPage)
      }
      setHasSetInitialRoute(true)
      return
    }

    // Determine route based on whether user has projects
    const route = userHasProjects ? 'projects' : 'matrix'
    navLogger.debug('✅ Setting initial route based on project count', {
      userHasProjects,
      route,
      reason: userHasProjects ? 'user_has_projects' : 'no_projects_show_create',
      timestamp: Date.now()
    })
    setCurrentPage(route)
    setHasSetInitialRoute(true)
  }

  const value = {
    currentPage,
    setCurrentPage,
    handlePageChange,
    setInitialRoute,
    hasSetInitialRoute
  }

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}