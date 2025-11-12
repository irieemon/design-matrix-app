/**
 * ViewControls - View preference controls for full-screen mode
 *
 * Provides toggle controls for grid and quadrant label visibility.
 * Integrated into the TopBar for easy access to view preferences.
 *
 * Features:
 * - Grid visibility toggle
 * - Quadrant labels toggle
 * - Visual active state indicators
 * - Keyboard shortcut hints
 */

import React from 'react'
import { Grid3x3, Tag } from 'lucide-react'

interface ViewControlsProps {
  /** Current grid visibility state */
  showGrid: boolean
  /** Current labels visibility state */
  showLabels: boolean
  /** Callback to toggle grid visibility */
  onToggleGrid: () => void
  /** Callback to toggle labels visibility */
  onToggleLabels: () => void
}

/**
 * ViewControls Component
 *
 * Provides toggle controls for view preferences in full-screen mode.
 * Located in the TopBar for easy access without cluttering the canvas.
 */
export const ViewControls: React.FC<ViewControlsProps> = ({
  showGrid,
  showLabels,
  onToggleGrid,
  onToggleLabels
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Grid Toggle */}
      <ControlButton
        icon={<Grid3x3 className="w-4 h-4" />}
        label="Grid"
        isActive={showGrid}
        onClick={onToggleGrid}
        shortcut="G"
      />

      {/* Labels Toggle */}
      <ControlButton
        icon={<Tag className="w-4 h-4" />}
        label="Labels"
        isActive={showLabels}
        onClick={onToggleLabels}
        shortcut="L"
      />
    </div>
  )
}

interface ControlButtonProps {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
  shortcut: string
}

const ControlButton: React.FC<ControlButtonProps> = ({
  icon,
  label,
  isActive,
  onClick,
  shortcut
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-white/50
        ${
          isActive
            ? 'bg-white/20 text-white'
            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
        }
      `}
      title={`${label} (${shortcut})`}
      aria-label={`Toggle ${label.toLowerCase()}`}
      aria-pressed={isActive}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      {isActive && (
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      )}
    </button>
  )
}

export default ViewControls
