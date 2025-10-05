/**
 * App - Clean application entry point with focused components
 *
 * Refactored from 178-line god component to focused architecture.
 * Uses context providers to eliminate prop drilling and separate concerns.
 */

import { useEffect, useState } from 'react'
import { AppProviders } from './contexts/AppProviders'
import AppWithAuth from './components/app/AppWithAuth'
import MonochromaticDemo from './components/demo/MonochromaticDemo'
import MonochromeLuxDemo from './components/demo/MonochromeLuxDemo'
import MonochromeLuxAnimated from './components/demo/MonochromeLuxAnimated'

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
  if (currentHash === '#mono-demo') {
    return <MonochromaticDemo />
  }

  // Monochrome-Lux demo (refined version)
  if (currentHash === '#lux-demo') {
    return <MonochromeLuxDemo />
  }

  // Monochrome-Lux with micro-animations (fully animated)
  if (currentHash === '#lux-animated') {
    return <MonochromeLuxAnimated />
  }

  return (
    <AppProviders>
      <AppWithAuth />
    </AppProviders>
  )
}

export default App