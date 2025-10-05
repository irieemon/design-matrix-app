/**
 * NavItem Component - Lux Navigation Design System
 *
 * Navigation-specific button component matching Lux demo specifications.
 * Differs from action Button component with subtle tints instead of lifts.
 */

import React, { useRef, useEffect } from 'react'

interface NavItemProps {
  /** Navigation item is currently active/selected */
  active?: boolean
  /** Icon element to display */
  icon?: React.ReactNode
  /** Content/label for the nav item */
  children?: React.ReactNode
  /** Click handler */
  onClick?: () => void
  /** Additional CSS classes */
  className?: string
  /** Collapsed state (icon-only) */
  collapsed?: boolean
  /** Tooltip text for collapsed state */
  title?: string
  /** Disabled state */
  disabled?: boolean
  /** Callback when this item becomes active (for animated indicator) */
  onActivePositionChange?: (element: HTMLButtonElement) => void
}

/**
 * NavItem Component
 *
 * Lux Demo Specifications:
 * - Active: bg-gray-100 (#F3F4F6), text-gray-900 (#111827)
 * - Hover: bg-gray-50 (#F9FAFB), text-gray-900 (#111827)
 * - Default: transparent, text-gray-600 (#4B5563)
 * - Transition: colors only (200ms), no lift animation
 * - Icon size: 16px (w-4 h-4) in collapsed, 18px (w-[18px] h-[18px]) in expanded
 * - Animated indicator: Reports position when active for sliding bar animation
 */
export const NavItem: React.FC<NavItemProps> = ({
  active = false,
  icon,
  children,
  onClick,
  className = '',
  collapsed = false,
  title,
  disabled = false,
  onActivePositionChange
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Notify parent when this item becomes active (for animated indicator)
  useEffect(() => {
    if (active && buttonRef.current && onActivePositionChange) {
      onActivePositionChange(buttonRef.current)
    }
  }, [active, onActivePositionChange])

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      disabled={disabled}
      title={collapsed ? title : undefined}
      className={`
        w-full
        ${collapsed ? 'justify-center p-3' : 'px-4 py-3'}
        rounded-lg
        font-medium
        transition-colors duration-200
        ${className}
      `}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? '0' : '12px',
        position: 'relative',
        // Active state - subtle gray tint
        backgroundColor: active ? 'var(--graphite-100)' : 'transparent',
        color: active ? 'var(--graphite-900)' : 'var(--graphite-600)',
        // No box-shadow (navigation doesn't lift)
        boxShadow: 'none',
        // Cursor
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.backgroundColor = 'var(--graphite-50)'
          e.currentTarget.style.color = 'var(--graphite-900)'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--graphite-600)'
        }
      }}
    >
      {icon && (
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{
            // Icon sizing: 16px collapsed, 18px expanded (Lux spec)
            width: collapsed ? '16px' : '18px',
            height: collapsed ? '16px' : '18px'
          }}
        >
          {icon}
        </span>
      )}
      {!collapsed && children && (
        <span className="flex-1 text-left text-sm truncate">
          {children}
        </span>
      )}
    </button>
  )
}

export default NavItem
