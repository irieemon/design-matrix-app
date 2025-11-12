/**
 * HelpButton - Help button and keyboard shortcuts modal
 *
 * Provides access to keyboard shortcuts help modal in full-screen mode.
 * Shows all available shortcuts with descriptions and visual grouping.
 *
 * Features:
 * - Help button with ? icon
 * - Keyboard shortcuts modal
 * - Shortcuts grouped by category
 * - Visual keyboard key representations
 * - ESC to close modal
 */

import React, { useState, useEffect } from 'react'
import { HelpCircle, X } from 'lucide-react'

interface HelpButtonProps {
  /** Whether full-screen mode is active */
  isFullScreen: boolean
}

/**
 * HelpButton Component
 *
 * Displays a help button that opens a modal with keyboard shortcuts.
 * Automatically opens on first full-screen entry (user onboarding).
 */
export const HelpButton: React.FC<HelpButtonProps> = ({ isFullScreen }) => {
  const [showHelp, setShowHelp] = useState(false)
  const [hasSeenHelp, setHasSeenHelp] = useState(() => {
    // Check if user has seen help before
    return localStorage.getItem('fullscreen-help-seen') === 'true'
  })

  // Show help on first full-screen entry
  useEffect(() => {
    if (isFullScreen && !hasSeenHelp) {
      const timer = setTimeout(() => {
        setShowHelp(true)
        setHasSeenHelp(true)
        localStorage.setItem('fullscreen-help-seen', 'true')
      }, 1000) // Delay to let user see the full-screen view first

      return () => clearTimeout(timer)
    }
  }, [isFullScreen, hasSeenHelp])

  // Handle ESC key to close modal
  useEffect(() => {
    if (!showHelp) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowHelp(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showHelp])

  return (
    <>
      {/* Help Button */}
      <button
        onClick={() => setShowHelp(true)}
        className="
          flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-white/5 text-white/60
          hover:bg-white/10 hover:text-white
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-white/50
        "
        title="Keyboard Shortcuts (?)"
        aria-label="Show keyboard shortcuts"
      >
        <HelpCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Help</span>
      </button>

      {/* Help Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
                <p className="text-sm text-white/60 mt-1">
                  Master full-screen mode with these shortcuts
                </p>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close help"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shortcuts Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-88px)]">
              <div className="space-y-6">
                {/* View Controls */}
                <ShortcutSection
                  title="View Controls"
                  shortcuts={[
                    { keys: ['F'], description: 'Toggle full-screen mode' },
                    { keys: ['ESC'], description: 'Exit full-screen mode' },
                    { keys: ['G'], description: 'Toggle grid visibility' },
                    { keys: ['L'], description: 'Toggle quadrant labels' },
                    { keys: ['H'], description: 'Toggle all chrome (hide/show)' }
                  ]}
                />

                {/* Zoom Controls */}
                <ShortcutSection
                  title="Zoom Controls"
                  shortcuts={[
                    { keys: ['+', '='], description: 'Zoom in' },
                    { keys: ['-', '_'], description: 'Zoom out' },
                    { keys: ['0'], description: 'Reset zoom to 100%' }
                  ]}
                />

                {/* Actions */}
                <ShortcutSection
                  title="Actions"
                  shortcuts={[
                    { keys: ['N'], description: 'New idea (Add modal)' },
                    { keys: ['A'], description: 'AI generate ideas' },
                    { keys: ['E'], description: 'Edit selected idea' },
                    { keys: ['Delete'], description: 'Delete selected idea' }
                  ]}
                />

                {/* Navigation */}
                <ShortcutSection
                  title="Navigation"
                  shortcuts={[
                    { keys: ['Arrow Keys'], description: 'Pan canvas' },
                    { keys: ['Shift', 'Arrow Keys'], description: 'Pan canvas (fast)' },
                    { keys: ['Space', 'Drag'], description: 'Pan canvas with mouse' }
                  ]}
                />

                {/* Selection */}
                <ShortcutSection
                  title="Selection"
                  shortcuts={[
                    { keys: ['Tab'], description: 'Select next idea' },
                    { keys: ['Shift', 'Tab'], description: 'Select previous idea' },
                    { keys: ['Enter'], description: 'Edit selected idea' }
                  ]}
                />

                {/* Help */}
                <ShortcutSection
                  title="Help"
                  shortcuts={[
                    { keys: ['?'], description: 'Show keyboard shortcuts (this modal)' }
                  ]}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-white/5">
              <p className="text-sm text-white/60 text-center">
                Press <Kbd>ESC</Kbd> to close this modal
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface ShortcutSectionProps {
  title: string
  shortcuts: Array<{
    keys: string[]
    description: string
  }>
}

const ShortcutSection: React.FC<ShortcutSectionProps> = ({ title, shortcuts }) => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="space-y-2">
        {shortcuts.map((shortcut, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="text-sm text-white/90">{shortcut.description}</span>
            <div className="flex items-center gap-1">
              {shortcut.keys.map((key, keyIndex) => (
                <React.Fragment key={keyIndex}>
                  {keyIndex > 0 && (
                    <span className="text-white/40 text-xs mx-1">+</span>
                  )}
                  <Kbd>{key}</Kbd>
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <kbd className="px-2 py-1 text-xs font-mono font-semibold text-white bg-white/10 border border-white/20 rounded shadow-sm">
      {children}
    </kbd>
  )
}

export default HelpButton
