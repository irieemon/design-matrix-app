/**
 * App - Clean application entry point with focused components
 *
 * Refactored from 178-line god component to focused architecture.
 * Uses context providers to eliminate prop drilling and separate concerns.
 *
 * PERFORMANCE OPTIMIZATION: Demo routes are lazy loaded to reduce initial bundle size
 * Expected impact: 20-30% reduction in initial bundle (demos rarely accessed)
 */

import { useEffect, useState, lazy, Suspense } from 'react'
import { AppProviders } from './contexts/AppProviders'
import AppWithAuth from './components/app/AppWithAuth'

// Lazy load demo components - only loaded when accessed via hash routes
const MonochromaticDemo = lazy(() => import('./components/demo/MonochromaticDemo'))
const MonochromeLuxDemo = lazy(() => import('./components/demo/MonochromeLuxDemo'))
const MonochromeLuxAnimated = lazy(() => import('./components/demo/MonochromeLuxAnimated'))

// Lazy load brainstorm mobile join page (Phase One)
const MobileJoinPage = lazy(() => import('./pages/MobileJoinPage'))

function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // If demo hash is present, show demo without auth/layout
  // Wrapped in Suspense for lazy loading with fallback
  if (currentHash === '#mono-demo') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading demo...</div>}>
        <MonochromaticDemo />
      </Suspense>
    )
  }

  // Monochrome-Lux demo (refined version)
  if (currentHash === '#lux-demo') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading demo...</div>}>
        <MonochromeLuxDemo />
      </Suspense>
    )
  }

  // Monochrome-Lux with micro-animations (fully animated)
  if (currentHash === '#lux-animated') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading demo...</div>}>
        <MonochromeLuxAnimated />
      </Suspense>
    )
  }

  // Mobile brainstorm join page (Phase One)
  // Pattern: #join/uuid-access-token
  if (currentHash.startsWith('#join/')) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Joining session...</div>}>
        <MobileJoinPage />
      </Suspense>
    )
  }

  return (
    <AppProviders>
      <AppWithAuth />
    </AppProviders>
  )
}

export default App