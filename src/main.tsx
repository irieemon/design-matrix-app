import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'

// Build version marker for cache invalidation
const BUILD_VERSION = '2025-11-21T20:22:00Z'
if (import.meta.env.DEV) {
  console.log('🚀 Prioritas Build:', BUILD_VERSION)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)