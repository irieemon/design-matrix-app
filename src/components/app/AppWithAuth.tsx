/**
 * AppWithAuth - Authentication-aware application wrapper
 *
 * Uses centralized user context to ensure consistent user state across all components.
 * Replaces direct useAuth usage with centralized UserContext.
 */

import AuthenticationFlow from './AuthenticationFlow'
import MainApp from './MainApp'
import { useUser } from '../../contexts/UserContext'

export default function AppWithAuth() {
  // Use centralized user context for consistent state
  const { currentUser, isLoading, handleAuthSuccess, handleLogout, setCurrentUser } = useUser()

  return (
    <AuthenticationFlow
      isLoading={isLoading}
      currentUser={currentUser}
      onAuthSuccess={handleAuthSuccess}
    >
      <MainApp
        currentUser={currentUser!}
        onLogout={handleLogout}
        setCurrentUser={setCurrentUser}
      />
    </AuthenticationFlow>
  )
}