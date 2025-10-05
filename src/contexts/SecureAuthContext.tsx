/**
 * SecureAuthContext
 *
 * React context for cookie-based authentication
 * Provides authentication state and methods to entire app
 */

import React, { createContext, useContext, ReactNode } from 'react'
import { useSecureAuth, type UseSecureAuthReturn } from '../hooks/useSecureAuth'
import { useCsrfToken, type UseCsrfTokenReturn } from '../hooks/useCsrfToken'
import { apiClient } from '../lib/apiClient'

/**
 * Combined auth context type
 */
export interface SecureAuthContextType extends UseSecureAuthReturn {
  /** CSRF token management */
  csrf: UseCsrfTokenReturn
}

/**
 * Create context
 */
const SecureAuthContext = createContext<SecureAuthContextType | null>(null)

/**
 * Provider props
 */
interface SecureAuthProviderProps {
  children: ReactNode
}

/**
 * SecureAuth Provider
 *
 * Wraps app with cookie-based authentication context
 *
 * @example
 * <SecureAuthProvider>
 *   <App />
 * </SecureAuthProvider>
 */
export function SecureAuthProvider({ children }: SecureAuthProviderProps) {
  const auth = useSecureAuth()
  const csrf = useCsrfToken()

  // Configure API client with CSRF token
  React.useEffect(() => {
    apiClient.configure({
      csrfToken: csrf.csrfToken,
    })
  }, [csrf.csrfToken])

  const contextValue: SecureAuthContextType = {
    ...auth,
    csrf,
  }

  return (
    <SecureAuthContext.Provider value={contextValue}>
      {children}
    </SecureAuthContext.Provider>
  )
}

/**
 * Hook to use secure auth context
 *
 * @throws Error if used outside SecureAuthProvider
 *
 * @example
 * const { user, isAuthenticated, login, logout } = useSecureAuthContext()
 */
export function useSecureAuthContext(): SecureAuthContextType {
  const context = useContext(SecureAuthContext)

  if (!context) {
    throw new Error(
      'useSecureAuthContext must be used within SecureAuthProvider'
    )
  }

  return context
}

/**
 * HOC to wrap components with SecureAuthProvider
 *
 * @example
 * export default withSecureAuth(MyComponent)
 */
export function withSecureAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <SecureAuthProvider>
      <Component {...props} />
    </SecureAuthProvider>
  )

  WrappedComponent.displayName = `withSecureAuth(${
    Component.displayName || Component.name || 'Component'
  })`

  return WrappedComponent
}
