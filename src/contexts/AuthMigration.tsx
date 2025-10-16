/**
 * AuthMigration - Feature-flag-based authentication migration layer
 *
 * Provides backward-compatible authentication switching between:
 * - Old: Supabase localStorage authentication (useAuth hook)
 * - New: httpOnly cookie authentication (SecureAuthProvider)
 *
 * Feature Flag: VITE_FEATURE_HTTPONLY_AUTH
 * - 'true': Use new httpOnly cookie authentication
 * - 'false' or undefined: Use old localStorage authentication
 *
 * Design:
 * - Zero breaking changes to existing components
 * - Maintains UserContext interface for backward compatibility
 * - All useUser() hooks continue to work with both systems
 * - Easy rollback via environment variable
 */

import { ReactNode } from 'react'
import { SecureAuthProvider, useSecureAuthContext } from './SecureAuthContext'
import { UserProvider } from './UserContext'
import { useAuth } from '../hooks/useAuth'
import type { User, AuthUser } from '../types'
import { logger } from '../lib/logging'

interface AuthMigrationProviderProps {
  children: ReactNode
}

/**
 * AuthMigrationProvider
 *
 * Top-level authentication provider that switches between old and new auth
 * based on feature flag. Wraps children with appropriate auth system.
 */
export function AuthMigrationProvider({ children }: AuthMigrationProviderProps) {
  const envValue = import.meta.env.VITE_FEATURE_HTTPONLY_AUTH
  const useNewAuth = envValue === 'true'

  logger.debug('Auth system selection:', {
    useNewAuth,
    system: useNewAuth ? 'httpOnly cookies' : 'localStorage'
  })

  if (useNewAuth) {
    // New auth system: httpOnly cookies
    return (
      <SecureAuthProvider>
        <NewAuthAdapter>
          {children}
        </NewAuthAdapter>
      </SecureAuthProvider>
    )
  }

  // Old auth system: localStorage (current behavior)
  return <OldAuthAdapter>{children}</OldAuthAdapter>
}

/**
 * NewAuthAdapter
 *
 * Adapts new SecureAuth interface to old UserContext interface
 * for backward compatibility with existing components.
 *
 * Interface Mapping:
 * - secureAuth.user → currentUser
 * - secureAuth.user → authUser (simplified)
 * - secureAuth.isLoading → isLoading
 * - secureAuth.logout → handleLogout
 * - handleAuthSuccess → no-op (cookies handle automatically)
 * - setCurrentUser → no-op (not needed with cookies)
 * - setIsLoading → no-op (not needed with cookies)
 */
function NewAuthAdapter({ children }: { children: ReactNode }) {
  const secureAuth = useSecureAuthContext()

  // Adapt new interface to old interface
  const adaptedValue = {
    // Direct mappings
    currentUser: secureAuth.user,
    isLoading: secureAuth.isLoading,
    handleLogout: secureAuth.logout,

    // Simplified authUser (old interface expected this)
    authUser: secureAuth.user ? {
      id: secureAuth.user.id,
      email: secureAuth.user.email,
      user_metadata: {
        full_name: secureAuth.user.full_name,
        avatar_url: secureAuth.user.avatar_url,
      }
    } as AuthUser : null,

    // Backward compatibility: no-ops for methods not needed with httpOnly cookies
    handleAuthSuccess: async (_authUser: any) => {
      // New auth doesn't need this - user is already authenticated via cookies
      // This was called after old-style Supabase auth, but cookies handle it automatically
      logger.debug('handleAuthSuccess called (no-op with httpOnly cookies)')
    },

    setCurrentUser: (_user: User | null) => {
      // New auth doesn't need manual user state management
      logger.debug('setCurrentUser called (no-op with httpOnly cookies)')
    },

    setIsLoading: (_loading: boolean) => {
      // New auth manages its own loading state
      logger.debug('setIsLoading called (no-op with httpOnly cookies)')
    },
  }

  return <UserProvider value={adaptedValue}>{children}</UserProvider>
}

/**
 * OldAuthAdapter
 *
 * Uses old authentication system (current behavior).
 * Calls useAuth hook and passes value to UserProvider.
 */
function OldAuthAdapter({ children }: { children: ReactNode }) {
  const authState = useAuth()

  logger.debug('Auth state loaded:', {
    hasCurrentUser: !!authState.currentUser,
    isLoading: authState.isLoading
  })

  return <UserProvider value={authState}>{children}</UserProvider>
}
