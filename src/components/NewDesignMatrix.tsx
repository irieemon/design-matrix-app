/**
 * NewDesignMatrix - Complete architectural rebuild
 *
 * This component replaces the old DesignMatrix with a clean architecture:
 * - Single coordinate system (normalized 0-1)
 * - Systematic z-index management
 * - Performance optimizations
 * - No infinite re-render loops
 */

import React, { useState, useEffect } from 'react'
import type { IdeaCard, User, Project } from '../types'
import { MatrixContainer } from './matrix/MatrixContainer'
import { useOptimizedMatrix } from '../hooks/useOptimizedMatrix'
import { performanceMonitor } from '../lib/matrix/performance'

// Import the new CSS
import '../styles/matrix.css'

interface NewDesignMatrixProps {
  /** Current user for permission checks */
  currentUser: User | null
  /** Current project context */
  currentProject: Project | null
  /** Modal state management */
  setShowAddModal?: (show: boolean) => void
  setShowAIModal?: (show: boolean) => void
  setEditingIdea?: (idea: IdeaCard | null) => void
  /** Idea management callbacks */
  onEditIdea: (idea: IdeaCard) => void
  onDeleteIdea: (ideaId: string) => void
  onToggleCollapse: (ideaId: string, collapsed?: boolean) => void
}

export const NewDesignMatrix: React.FC<NewDesignMatrixProps> = ({
  currentUser,
  currentProject,
  setShowAddModal,
  setShowAIModal,
  setEditingIdea,
  onEditIdea,
  onDeleteIdea,
  onToggleCollapse
}) => {
  // Drag state for visual feedback
  const [activeId, setActiveId] = useState<string | null>(null)

  // Use the optimized matrix hook
  const {
    ideas,
    isLoading,
    error,
    loadIdeas,
    // addIdea, // Currently unused
    // updateIdea, // Currently unused
    deleteIdea,
    toggleCollapse,
    handleDragEnd,
    // refreshIdeas, // Currently unused
    clearError
  } = useOptimizedMatrix({
    currentUser,
    currentProject,
    setShowAddModal,
    setShowAIModal,
    setEditingIdea
  })

  // Performance monitoring
  const endMeasurement = React.useMemo(() =>
    performanceMonitor.startMeasurement('NewDesignMatrix-render'),
    []
  )

  React.useEffect(() => {
    endMeasurement()
  })

  // Load ideas when project changes
  useEffect(() => {
    if (currentProject?.id) {
      loadIdeas(currentProject.id)
    } else {
      // Clear ideas when no project selected
      loadIdeas()
    }
  }, [currentProject?.id, loadIdeas])

  // Enhanced drag end handler with visual feedback
  const handleMatrixDragEnd = React.useCallback(async (event: any) => {
    setActiveId(null) // Clear active state
    await handleDragEnd(event)
  }, [handleDragEnd])

  // Drag start handler for visual feedback - currently unused
  // const handleDragStart = React.useCallback((event: any) => {
  //   setActiveId(event.active.id as string)
  // }, [])

  // Error display component
  const ErrorBanner = error ? (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="text-red-500 text-sm font-medium">
            ⚠️ {error}
          </div>
        </div>
        <button
          onClick={clearError}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  ) : null

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your ideas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="new-design-matrix">
      {ErrorBanner}

      {/* Matrix Container with new architecture */}
      <MatrixContainer
        ideas={ideas}
        currentUser={currentUser}
        activeId={activeId}
        onEditIdea={onEditIdea}
        onDeleteIdea={async (ideaId: string) => {
          await deleteIdea(ideaId)
          onDeleteIdea(ideaId) // Call original callback
        }}
        onToggleCollapse={async (ideaId: string, collapsed?: boolean) => {
          await toggleCollapse(ideaId, collapsed)
          onToggleCollapse(ideaId, collapsed) // Call original callback
        }}
        onDragEnd={handleMatrixDragEnd}
        className="matrix-system"
      />

      {/* Matrix Guide - Improved design */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="text-center p-6 bg-emerald-50 rounded-2xl border border-emerald-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-3 h-3 bg-emerald-500 rounded-full mx-auto mb-3"></div>
          <h4 className="font-semibold text-emerald-800 mb-2">Quick Wins</h4>
          <p className="text-sm text-emerald-600">Do these first for immediate impact</p>
        </div>

        <div className="text-center p-6 bg-blue-50 rounded-2xl border border-blue-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mb-3"></div>
          <h4 className="font-semibold text-blue-800 mb-2">Strategic</h4>
          <p className="text-sm text-blue-600">Plan carefully for long-term value</p>
        </div>

        <div className="text-center p-6 bg-amber-50 rounded-2xl border border-amber-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-3 h-3 bg-amber-500 rounded-full mx-auto mb-3"></div>
          <h4 className="font-semibold text-amber-800 mb-2">Reconsider</h4>
          <p className="text-sm text-amber-600">Maybe later when priorities shift</p>
        </div>

        <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-3"></div>
          <h4 className="font-semibold text-red-800 mb-2">Avoid</h4>
          <p className="text-sm text-red-600">Skip these to focus resources</p>
        </div>
      </div>

      {/* Performance Debug (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
          <h5 className="font-semibold mb-2">Performance Stats:</h5>
          <pre>{JSON.stringify(performanceMonitor.getStats(), null, 2)}</pre>
          <button
            onClick={() => performanceMonitor.clear()}
            className="mt-2 text-blue-600 hover:text-blue-800"
          >
            Clear Stats
          </button>
        </div>
      )}
    </div>
  )
}

// Performance-optimized export
export default React.memo(NewDesignMatrix, (prevProps, nextProps) => {
  return (
    prevProps.currentUser?.id === nextProps.currentUser?.id &&
    prevProps.currentProject?.id === nextProps.currentProject?.id
  )
})