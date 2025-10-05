/**
 * NavigationContext - Manages page routing and navigation state
 *
 * Extracted from App.tsx to separate navigation concerns and eliminate prop drilling.
 * Handles page state, navigation changes, and browser history integration.
 */

import { createContext, useContext, useState, ReactNode } from 'react'
import { logger } from '../lib/logging'

interface NavigationContextType {
  currentPage: string
  setCurrentPage: (page: string) => void
  handlePageChange: (newPage: string) => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

interface NavigationProviderProps {
  children: ReactNode
  initialPage?: string
}

export function NavigationProvider({ children, initialPage = 'matrix' }: NavigationProviderProps) {
  const [currentPage, setCurrentPage] = useState<string>(initialPage)
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

  const value = {
    currentPage,
    setCurrentPage,
    handlePageChange
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