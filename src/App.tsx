/**
 * App - Clean application entry point with focused components
 *
 * Refactored from 178-line god component to focused architecture.
 * Uses context providers to eliminate prop drilling and separate concerns.
 */

import { AppProviders } from './contexts/AppProviders'
import AuthenticationFlow from './components/app/AuthenticationFlow'
import MainApp from './components/app/MainApp'
import { useAuth } from './hooks/useAuth'

function App() {
  const { currentUser, isLoading, handleAuthSuccess, handleLogout, setCurrentUser } = useAuth()

  return (
    <AppProviders>
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
    </AppProviders>
  )
}

export default App