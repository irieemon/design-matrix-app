/**
 * AuthContext - Centralized authentication state management
 *
 * Provides single source of truth for authentication state across the application.
 * Eliminates prop drilling and ensures consistent user data propagation.
 */

import { createContext, useContext, ReactNode } from 'react'
import { User, AuthUser } from '../types'

interface AuthContextType {
  currentUser: User | null
  authUser: AuthUser | null
  isLoading: boolean
  handleAuthSuccess: (authUser: any) => Promise<void>
  handleLogout: () => Promise<void>
  setCurrentUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
  value: AuthContextType
}

export function AuthProvider({ children, value }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

/**
 * Backwards compatibility hook that matches the original useAuth interface
 * Components can gradually migrate to useAuthContext for better separation
 */
export function useAuth() {
  return useAuthContext()
}