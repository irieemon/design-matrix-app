/**
 * AuthenticationFlow - Enhanced authentication flow with skeleton loading and state transitions
 *
 * Extracted from App.tsx to separate authentication concerns.
 * Manages loading screen, auth screen, and authenticated app states with enhanced UI patterns.
 */

import React, { useState, useEffect } from 'react'
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
  // DESIGN SYSTEM: Updated to Monochrome-Lux design tokens
  if (isLoading && !forceShowAuth) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(to bottom right, var(--canvas-primary), var(--sapphire-50), var(--sapphire-100))'
        }}
      >
        <div className="text-center max-w-md w-full mx-auto p-6">
          {/* Logo Section - Monochrome-Lux styling */}
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{
              background: 'linear-gradient(to bottom right, var(--surface-primary), var(--graphite-100))',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <PrioritasLogo
              className="animate-pulse"
              size={32}
              style={{ color: 'var(--graphite-700)' }}
            />
          </div>

          {/* App Name - Graphite text hierarchy */}
          <h1
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--graphite-800)' }}
          >
            Prioritas
          </h1>
          <p
            className="mb-8"
            style={{ color: 'var(--graphite-500)' }}
          >
            Smart Priority Matrix Platform
          </p>

          {/* EMERGENCY FIX: Timeout error state disabled - useAuth handles this */}
          {false ? (
            <div className="space-y-6">
              <div
                className="rounded-xl p-6"
                style={{
                  backgroundColor: 'var(--garnet-50)',
                  border: '1px solid var(--garnet-700)',
                  borderOpacity: 0.2
                }}
              >
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{ color: 'var(--garnet-700)' }}
                >
                  Initialization Timeout
                </h3>
                <p
                  className="text-sm mb-4"
                  style={{ color: 'var(--garnet-700)', opacity: 0.8 }}
                >
                  Workspace initialization is taking longer than expected. This may be due to network issues or server problems.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={handleRefreshPage}
                    className="w-full px-4 py-3 text-white rounded-lg font-medium transition-all"
                    style={{
                      background: 'linear-gradient(to right, var(--graphite-700), var(--graphite-800))',
                      boxShadow: 'var(--shadow-button)'
                    }}
                  >
                    Refresh Page
                  </button>

                  <button
                    onClick={handleStartFresh}
                    className="w-full px-4 py-2 rounded-lg transition-all"
                    style={{
                      border: '1px solid var(--hairline-default)',
                      color: 'var(--graphite-600)',
                      backgroundColor: 'var(--surface-primary)'
                    }}
                  >
                    Clear Data & Start Fresh
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Enhanced Loading Animation - Graphite spinner */}
              <div className="flex items-center justify-center mb-8">
                <div
                  className="w-8 h-8 border-[3px] border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--graphite-700)', borderTopColor: 'transparent' }}
                ></div>
              </div>

              {/* Loading Status with Skeleton */}
              <div className="space-y-4">
                <div
                  className="text-sm mb-4"
                  style={{ color: 'var(--graphite-500)' }}
                >
                  {projectIdFromUrl ? 'Loading your project...' : 'Initializing your workspace...'}
                </div>

                {/* Skeleton preview - Surface card styling */}
                <div
                  className="backdrop-blur-sm rounded-xl p-6"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid var(--hairline-default)',
                    boxShadow: 'var(--shadow-card)'
                  }}
                >
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

                {/* Loading Steps - Gem-tone status indicators */}
                <div className="text-xs space-y-1" style={{ color: 'var(--graphite-400)' }}>
                  <div className="flex items-center justify-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--emerald-700)' }}
                    ></div>
                    <span>Connecting to services</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: 'var(--sapphire-500)' }}
                    ></div>
                    <span>{projectIdFromUrl ? 'Restoring project' : 'Loading workspace'}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--graphite-300)' }}
                    ></div>
                    <span>Preparing interface</span>
                  </div>
                </div>

                {/* Troubleshooting section - Amber warning styling */}
                {showTroubleshooting && (
                  <div
                    className="mt-6 rounded-lg p-4 text-left"
                    style={{
                      backgroundColor: 'var(--amber-50)',
                      border: '1px solid var(--amber-700)',
                      borderOpacity: 0.3
                    }}
                  >
                    <h3
                      className="font-medium mb-2"
                      style={{ color: 'var(--amber-700)' }}
                    >
                      Taking longer than usual?
                    </h3>
                    <div
                      className="space-y-2 text-sm"
                      style={{ color: 'var(--amber-700)', opacity: 0.85 }}
                    >
                      <p>• Check your internet connection</p>
                      <p>• Try refreshing the page</p>
                      <p>• Clear browser cache if issues persist</p>
                    </div>

                    <button
                      onClick={handleRefreshPage}
                      className="mt-3 px-4 py-2 text-white rounded-md text-sm transition-all"
                      style={{
                        background: 'linear-gradient(to right, var(--graphite-700), var(--graphite-800))',
                        boxShadow: 'var(--shadow-button)'
                      }}
                    >
                      Refresh Now
                    </button>
                  </div>
                )}
              </div>

              {/* Additional context - Tertiary text */}
              <div
                className="mt-8 text-xs"
                style={{ color: 'var(--graphite-400)' }}
              >
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