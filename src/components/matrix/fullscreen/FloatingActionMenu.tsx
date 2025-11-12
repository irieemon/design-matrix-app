/**
 * FloatingActionMenu - Side-docked action menu for full-screen mode
 *
 * Provides quick access to essential actions without cluttering the canvas.
 * Always visible (does not auto-hide) to maintain consistent access to actions.
 *
 * Features:
 * - Side-docked positioning (left edge)
 * - Expandable/collapsible menu
 * - Keyboard shortcuts integration
 * - Icon-based buttons with tooltips
 * - Smooth expand/collapse animations
 */

import React, { useState } from 'react'
import { Plus, Sparkles, ZoomIn, ZoomOut, RotateCcw, Grid3x3, Tag } from 'lucide-react'

interface FloatingActionMenuProps {
  /** Callback to add new idea */
  onAddIdea: () => void
  /** Callback to generate AI ideas */
  onAIGenerate: () => void
  /** Callback to zoom in */
  onZoomIn: () => void
  /** Callback to zoom out */
  onZoomOut: () => void
  /** Callback to reset zoom */
  onResetZoom: () => void
  /** Callback to toggle grid visibility */
  onToggleGrid: () => void
  /** Callback to toggle quadrant labels */
  onToggleLabels: () => void
  /** Current grid visibility state */
  showGrid: boolean
  /** Current labels visibility state */
  showLabels: boolean
  /** Current zoom level (0.5 - 2.0) */
  zoomLevel: number
}

/**
 * FloatingActionMenu Component
 *
 * Side-docked menu providing quick access to essential full-screen actions.
 * Remains visible at all times for consistent user access.
 */
export const FloatingActionMenu: React.FC<FloatingActionMenuProps> = ({
  onAddIdea,
  onAIGenerate,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleGrid,
  onToggleLabels,
  showGrid,
  showLabels,
  zoomLevel
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className={`
        fixed left-4 top-1/2 -translate-y-1/2 z-[102]
        transition-all duration-200 ease-in-out
      `}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div
        className={`
          bg-black/80 backdrop-blur-md
          border border-white/10
          rounded-2xl
          shadow-2xl
          transition-all duration-200
          ${isExpanded ? 'w-56' : 'w-16'}
        `}
      >
        {/* Actions Section */}
        <div className="p-3 space-y-2">
          {/* Add Idea */}
          <ActionButton
            icon={<Plus className="w-5 h-5" />}
            label="Add Idea"
            shortcut="N"
            onClick={onAddIdea}
            isExpanded={isExpanded}
            variant="primary"
          />

          {/* AI Generate */}
          <ActionButton
            icon={<Sparkles className="w-5 h-5" />}
            label="AI Generate"
            shortcut="A"
            onClick={onAIGenerate}
            isExpanded={isExpanded}
            variant="sapphire"
          />

          {/* Divider */}
          <div className="h-px bg-white/10 my-2" />

          {/* Zoom In */}
          <ActionButton
            icon={<ZoomIn className="w-5 h-5" />}
            label="Zoom In"
            shortcut="+"
            onClick={onZoomIn}
            isExpanded={isExpanded}
          />

          {/* Zoom Out */}
          <ActionButton
            icon={<ZoomOut className="w-5 h-5" />}
            label="Zoom Out"
            shortcut="-"
            onClick={onZoomOut}
            isExpanded={isExpanded}
          />

          {/* Reset Zoom */}
          <ActionButton
            icon={<RotateCcw className="w-5 h-5" />}
            label="Reset Zoom"
            shortcut="0"
            onClick={onResetZoom}
            isExpanded={isExpanded}
            badge={zoomLevel !== 1 ? `${Math.round(zoomLevel * 100)}%` : undefined}
          />

          {/* Divider */}
          <div className="h-px bg-white/10 my-2" />

          {/* Toggle Grid */}
          <ActionButton
            icon={<Grid3x3 className="w-5 h-5" />}
            label="Toggle Grid"
            shortcut="G"
            onClick={onToggleGrid}
            isExpanded={isExpanded}
            isActive={showGrid}
          />

          {/* Toggle Labels */}
          <ActionButton
            icon={<Tag className="w-5 h-5" />}
            label="Toggle Labels"
            shortcut="L"
            onClick={onToggleLabels}
            isExpanded={isExpanded}
            isActive={showLabels}
          />
        </div>
      </div>

      {/* Hover hint when collapsed */}
      {!isExpanded && (
        <div className="absolute left-20 top-1/2 -translate-y-1/2 pointer-events-none">
          <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
            Hover to expand
          </div>
        </div>
      )}
    </div>
  )
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  shortcut: string
  onClick: () => void
  isExpanded: boolean
  variant?: 'default' | 'primary' | 'sapphire'
  isActive?: boolean
  badge?: string
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  shortcut,
  onClick,
  isExpanded,
  variant = 'default',
  isActive = false,
  badge
}) => {
  const baseClasses = `
    flex items-center gap-3 w-full
    px-3 py-2 rounded-xl
    transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-white/50
  `

  const variantClasses = {
    default: isActive
      ? 'bg-white/20 text-white hover:bg-white/30'
      : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white',
    primary: 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30',
    sapphire: 'bg-sapphire-500/20 text-sapphire-400 hover:bg-sapphire-500/30'
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
      title={`${label} (${shortcut})`}
      aria-label={label}
    >
      {/* Icon */}
      <div className="flex-shrink-0 relative">
        {icon}
        {badge && (
          <span className="absolute -top-1 -right-1 text-[8px] font-semibold bg-white/20 px-1 rounded">
            {badge}
          </span>
        )}
      </div>

      {/* Label and Shortcut (only when expanded) */}
      {isExpanded && (
        <>
          <span className="flex-1 text-left text-sm font-medium">
            {label}
          </span>
          <kbd className="text-xs px-1.5 py-0.5 bg-white/10 rounded font-mono">
            {shortcut}
          </kbd>
        </>
      )}
    </button>
  )
}

export default FloatingActionMenu
