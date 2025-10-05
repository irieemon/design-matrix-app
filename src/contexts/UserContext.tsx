/**
 * UserContext - Single source of truth for user authentication state
 *
 * Ensures all components access the same authenticated user data.
 * Eliminates prop drilling and synchronization issues.
 */

import { createContext, useContext, ReactNode } from 'react'
import { User, AuthUser } from '../types'

interface UserContextType {
  currentUser: User | null
  authUser: AuthUser | null
  isLoading: boolean
  handleAuthSuccess: (authUser: any) => Promise<void>
  handleLogout: () => Promise<void>
  setCurrentUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
  value: UserContextType
}

export function UserProvider({ children, value }: UserProviderProps) {
  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

/**
 * Centralized user data access
 * Always returns the authenticated user from the single source of truth
 */
export function useCurrentUser(): User | null {
  const { currentUser } = useUser()
  return currentUser
}

/**
 * Utility for getting user display information
 * Provides consistent user display logic across all components
 */
export function useUserDisplay(): { displayName: string; email: string; isLoading: boolean } {
  const { currentUser, isLoading } = useUser()

  return {
    displayName: currentUser?.full_name || currentUser?.email || 'Unknown User',
    email: currentUser?.email || '',
    isLoading
  }
}