import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'

// Build version marker for cache invalidation - UPDATE THIS ON EVERY DEPLOY
const BUILD_VERSION = '2025-11-25T23:35:00Z'
// Always log build version (not just DEV) to help with debugging cache issues
console.log('🚀 Prioritas Build:', BUILD_VERSION)
console.log('🔧 BUILD INCLUDES: CRITICAL FIX - return baseData when no pending optimistic updates')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)