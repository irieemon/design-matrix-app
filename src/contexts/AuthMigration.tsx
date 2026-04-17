/**
 * AuthMigration - Authentication provider layer
 *
 * Wraps children with the localStorage-backed Supabase auth system via
 * `useAuth`. Previously this layer switched between old and new auth
 * implementations based on VITE_FEATURE_HTTPONLY_AUTH; ADR-0017 Wave A
 * eliminates the split and consolidates on a single code path.
 */

import { ReactNode } from 'react'
import { UserProvider } from './UserContext'
import { useAuth } from '../hooks/useAuth'
import { logger } from '../lib/logging'

interface AuthMigrationProviderProps {
  children: ReactNode
}

/**
 * AuthMigrationProvider
 *
 * Top-level authentication provider. Calls useAuth and wires the returned
 * state into UserProvider for all downstream useUser() consumers.
 */
export function AuthMigrationProvider({ children }: AuthMigrationProviderProps) {
  const authState = useAuth()

  logger.debug('Auth state loaded:', {
    hasCurrentUser: !!authState.currentUser,
    isLoading: authState.isLoading
  })

  return <UserProvider value={authState}>{children}</UserProvider>
}
