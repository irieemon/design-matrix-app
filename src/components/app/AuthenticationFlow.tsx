/**
 * AuthenticationFlow - Handles authentication states and screens
 *
 * Extracted from App.tsx to separate authentication concerns.
 * Manages loading screen, auth screen, and authenticated app states.
 */

import PrioritasLogo from '../PrioritasLogo'
import AuthScreen from '../auth/AuthScreen'
import { User } from '../../types'

interface AuthenticationFlowProps {
  isLoading: boolean
  currentUser: User | null
  onAuthSuccess: (user: User) => void
  children: React.ReactNode
}

export default function AuthenticationFlow({
  isLoading,
  currentUser,
  onAuthSuccess,
  children
}: AuthenticationFlowProps) {
  // Show loading screen while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white to-slate-100 rounded-2xl mb-4 shadow-lg">
            <PrioritasLogo className="text-blue-600 animate-pulse" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Prioritas</h1>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  // Show auth screen if no user is authenticated
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={onAuthSuccess} />
  }

  // User is authenticated, render the app
  return <>{children}</>
}