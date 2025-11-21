/**
 * AuthenticationFlow - Enhanced authentication flow with skeleton loading and state transitions
 *
 * Extracted from App.tsx to separate authentication concerns.
 * Manages loading screen, auth screen, and authenticated app states with enhanced UI patterns.
 */

import { useState, useEffect } from 'react'
import PrioritasLogo from '../PrioritasLogo'
import AuthScreen from '../auth/AuthScreen'
import { SkeletonText, SkeletonCard } from '../ui'
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

  // PHASE 1 FIX: Detect if project is being restored from URL
  const projectIdFromUrl = (() => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('project')
  })()

  // EMERGENCY FIX: Simple troubleshooting without competing timeout systems
  useEffect(() => {
    if (isLoading) {
      // Simple troubleshooting hint after 5 seconds
      const timer = setTimeout(() => setShowTroubleshooting(true), 5000)
      return () => clearTimeout(timer)
    } else {
      // ✅ CRITICAL FIX: Use setTimeout(0) to prevent cascading renders
      setTimeout(() => {
        setShowTroubleshooting(false)
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

  // CRITICAL FIX: Simplified loading condition without competing paths
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md w-full mx-auto p-6">
          {/* Logo Section */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white to-slate-100 rounded-2xl mb-6 shadow-lg">
            <PrioritasLogo className="text-blue-600 animate-pulse" size={32} />
          </div>

          {/* App Name */}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Prioritas</h1>
          <p className="text-slate-600 mb-8">Smart Priority Matrix Platform</p>

          {/* EMERGENCY FIX: Timeout error state disabled - useAuth handles this */}
          {false && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Initialization Timeout</h3>
                <p className="text-sm text-red-700 mb-4">
                  Workspace initialization is taking longer than expected. This may be due to network issues or server problems.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={handleRefreshPage}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Refresh Page
                  </button>

                  <button
                    onClick={handleStartFresh}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Clear Data & Start Fresh
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Enhanced Loading Animation */}
              <div className="flex items-center justify-center mb-8">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>

              {/* Loading Status with Skeleton */}
              <div className="space-y-4">
                <div className="text-sm text-slate-500 mb-4">
                  {projectIdFromUrl ? 'Loading your project...' : 'Initializing your workspace...'}
                </div>

                {/* Skeleton preview of what's loading */}
                <div className="bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-white/60 shadow-sm">
                  <div className="space-y-3">
                    <SkeletonText width="60%" lines={1} className="mx-auto h-4" />
                    <SkeletonText width="40%" lines={1} className="mx-auto h-3" />

                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <SkeletonCard layout="basic" className="rounded-lg h-10" />
                      <SkeletonCard layout="basic" className="rounded-lg h-10" />
                      <SkeletonCard layout="basic" className="rounded-lg h-10" />
                    </div>
                  </div>
                </div>

                {/* Loading Steps */}
                <div className="text-xs text-slate-400 space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Connecting to services</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>{projectIdFromUrl ? 'Restoring project' : 'Loading workspace'}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                    <span>Preparing interface</span>
                  </div>
                </div>

                {/* Troubleshooting section after 10 seconds */}
                {showTroubleshooting && (
                  <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
                    <h3 className="font-medium text-yellow-800 mb-2">Taking longer than usual?</h3>
                    <div className="space-y-2 text-sm text-yellow-700">
                      <p>• Check your internet connection</p>
                      <p>• Try refreshing the page</p>
                      <p>• Clear browser cache if issues persist</p>
                    </div>

                    <button
                      onClick={handleRefreshPage}
                      className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm"
                    >
                      Refresh Now
                    </button>
                  </div>
                )}
              </div>

              {/* Additional context for longer loads */}
              <div className="mt-8 text-xs text-slate-400">
                Setting up your personalized priority matrix experience
              </div>
            </>
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