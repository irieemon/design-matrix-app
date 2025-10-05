/**
 * Logging Context Provider
 * Provides logging context to React component tree
 */

import { createContext, ReactNode, useMemo } from 'react'
import type { LogContext } from '../types'

/**
 * Logging context value
 */
export const LoggingContext = createContext<LogContext | undefined>(undefined)

/**
 * Props for LoggingProvider
 */
export interface LoggingProviderProps {
  /** Child components */
  children: ReactNode
  /** Context to provide to all child loggers */
  value?: LogContext
}

/**
 * Logging Context Provider
 * Wraps component tree to provide logging context
 *
 * @example
 * ```tsx
 * function App() {
 *   const user = useUser()
 *   const project = useProject()
 *
 *   return (
 *     <LoggingProvider value={{ userId: user?.id, projectId: project?.id }}>
 *       <AppContent />
 *     </LoggingProvider>
 *   )
 * }
 * ```
 */
export function LoggingProvider({ children, value }: LoggingProviderProps) {
  const contextValue = useMemo(() => value, [value])

  return (
    <LoggingContext.Provider value={contextValue}>{children}</LoggingContext.Provider>
  )
}
