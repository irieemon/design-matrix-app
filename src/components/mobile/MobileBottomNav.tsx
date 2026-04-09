import React from 'react'
import { Grid3x3, FolderOpen, Plus, User as UserIcon } from 'lucide-react'

interface MobileBottomNavProps {
  currentPage: string
  onPageChange: (page: string) => void
  onCapture: () => void
}

interface NavTab {
  key: string
  label: string
  page?: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: NavTab[] = [
  { key: 'matrix', label: 'Matrix', page: 'matrix', icon: Grid3x3 },
  { key: 'projects', label: 'Projects', page: 'projects', icon: FolderOpen },
  { key: 'capture', label: 'Capture', icon: Plus },
  { key: 'user', label: 'More', page: 'user', icon: UserIcon },
]

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentPage,
  onPageChange,
  onCapture,
}) => {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isCapture = tab.key === 'capture'
          const isActive =
            !isCapture &&
            (currentPage === tab.page ||
              (tab.page === 'matrix' && currentPage === 'home'))

          const handleClick = () => {
            if (isCapture) onCapture()
            else if (tab.page) onPageChange(tab.page)
          }

          if (isCapture) {
            return (
              <li key={tab.key} className="flex-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleClick}
                  aria-label="Capture new idea"
                  className="min-w-14 min-h-14 w-14 h-14 -mt-5 rounded-full bg-sapphire-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition"
                  style={{ backgroundColor: 'var(--sapphire-600, #2563eb)' }}
                >
                  <Icon className="w-6 h-6" />
                </button>
              </li>
            )
          }

          return (
            <li key={tab.key} className="flex-1">
              <button
                type="button"
                onClick={handleClick}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full min-h-14 flex flex-col items-center justify-center gap-0.5 text-xs ${
                  isActive ? 'text-sapphire-600' : 'text-neutral-500'
                }`}
                style={isActive ? { color: 'var(--sapphire-600, #2563eb)' } : undefined}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default MobileBottomNav
