import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type: Toast['type'], duration?: number) => void
  showSuccess: (message: string, duration?: number) => void
  showError: (message: string, duration?: number) => void
  showWarning: (message: string, duration?: number) => void
  showInfo: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: Toast['type'], duration: number = 5000) => {
    const id = Math.random().toString(36).substr(2, 9)
    const toast: Toast = { id, message, type, duration }
    
    setToasts(prev => [...prev, toast])
    
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }, [removeToast])

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration)
  }, [showToast])

  const showError = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration)
  }, [showToast])

  const showWarning = useCallback((message: string, duration?: number) => {
    showToast(message, 'warning', duration)
  }, [showToast])

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration)
  }, [showToast])

  const getToastIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return CheckCircle
      case 'error': return XCircle
      case 'warning': return AlertTriangle
      case 'info': return Info
    }
  }

  const getToastColor = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'bg-green-500 text-white'
      case 'error': return 'bg-red-500 text-white'
      case 'warning': return 'bg-yellow-500 text-white'
      case 'info': return 'bg-blue-500 text-white'
    }
  }

  // PERFORMANCE OPTIMIZATION: Memoize context value to prevent unnecessary re-renders
  // Functions are already memoized with useCallback, just memoize the object itself
  const contextValue = useMemo(() => ({
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }), [showToast, showSuccess, showError, showWarning, showInfo])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map((toast) => {
          const Icon = getToastIcon(toast.type)
          return (
            <div
              key={toast.id}
              className={`
                flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg max-w-md
                transform transition-all duration-300 ease-in-out
                ${getToastColor(toast.type)}
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 ml-2 hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}