/**
 * AuthenticationFlow - Enhanced authentication flow with skeleton loading and state transitions
 *
 * Extracted from App.tsx to separate authentication concerns.
 * Manages loading screen, auth screen, and authenticated app states with enhanced UI patterns.
 */

import { useState, useEffect } from 'react'
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
  // EMERGENCY FIX: Simplified state - remove competing timeout systems
  const [showTroubleshooting, setShowTroubleshooting] = useState(false)
  const [forceShowAuth, setForceShowAuth] = useState(false)

  // PHASE 1 FIX: Detect if project is being restored from URL
  const projectIdFromUrl = (() => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('project')
  })()

  // EMERGENCY FIX: Simple troubleshooting without competing timeout systems
  // CRITICAL ADDITION: Absolute maximum loading time to prevent infinite hang
  useEffect(() => {
    if (isLoading) {
      // Simple troubleshooting hint after 5 seconds
      const troubleshootTimer = setTimeout(() => setShowTroubleshooting(true), 5000)

      // CRITICAL FIX: Force show auth screen after 8 seconds maximum
      // This is a UI-level safety net in case useAuth's timeout doesn't fire
      const forceAuthTimer = setTimeout(() => {
        console.warn('⚠️ AuthenticationFlow: Maximum loading time exceeded, forcing auth screen')
        setForceShowAuth(true)
      }, 8000)

      return () => {
        clearTimeout(troubleshootTimer)
        clearTimeout(forceAuthTimer)
      }
    } else {
      // ✅ CRITICAL FIX: Use setTimeout(0) to prevent cascading renders
      setTimeout(() => {
        setShowTroubleshooting(false)
        setForceShowAuth(false)
      }, 0)
    }
  }, [isLoading])

  // Handle recovery actions
  const handleStartFresh = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/?fresh=true'
    } catch (_e) {
      window.location.reload()
    }
  }

  const handleRefreshPage = () => {
    window.location.reload()
  }

  // CRITICAL FIX: Removed fast-path rendering to prevent flickering conflicts

  // CRITICAL FIX: If forceShowAuth is true, skip loading screen entirely
  // This is the UI safety net to prevent infinite loading
  if (forceShowAuth && !currentUser) {
    console.log('🔓 Forcing auth screen after loading timeout')
    return <AuthScreen onAuthSuccess={onAuthSuccess} />
  }

  // CRITICAL FIX: Simplified loading condition without competing paths
  // DESIGN SYSTEM: Minimal, confident loading screen matching AuthScreen aesthetic
  if (isLoading && !forceShowAuth) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: 'var(--canvas-primary)' }}
      >
        <div className="text-center max-w-md w-full">
          {/* Logo - Matches AuthScreen exactly */}
          <div className="inline-flex items-center justify-center w-16 h-16 card-clean-hover p-4 mb-4">
            <PrioritasLogo className="text-info-500" size={32} />
          </div>

          {/* Title - Matches AuthScreen typography */}
          <h1 className="text-3xl font-bold text-primary mb-2">Prioritas</h1>
          <p className="text-secondary mb-8">Smart Priority Matrix Platform</p>

          {/* Confident loading indicator - single elegant spinner */}
          <div className="flex items-center justify-center mb-6">
            <div
              className="w-6 h-6 rounded-full border-2 border-current border-t-transparent text-info-500"
              style={{
                animation: 'spin 0.8s cubic-bezier(0.4, 0.0, 0.2, 1) infinite'
              }}
            />
          </div>

          {/* Single status message - clean and minimal */}
          <p className="text-secondary text-sm">
            {projectIdFromUrl ? 'Loading your project...' : 'Loading...'}
          </p>

          {/* Troubleshooting - only shows after delay, kept minimal */}
          {showTroubleshooting && (
            <div className="mt-8">
              <p className="text-tertiary text-xs mb-3">Taking longer than expected?</p>
              <button
                onClick={handleRefreshPage}
                className="btn-primary text-sm px-4 py-2"
              >
                Refresh Page
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // CRITICAL FIX: Simplified rendering without conflicting transitions
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={onAuthSuccess} />
  }

  // Render authenticated app without animation conflicts
  return <>{children}</>
}