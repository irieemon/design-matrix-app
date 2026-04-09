import React from 'react'
import { User as UserIcon } from 'lucide-react'
import type { Project, User } from '../../types'
import PrioritasLogo from '../PrioritasLogo'

interface MobileTopBarProps {
  currentUser: User
  currentProject: Project | null
  onOpenProjects: () => void
  onOpenUser: () => void
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  currentProject,
  onOpenProjects,
  onOpenUser,
}) => {
  return (
    <header
      className="fixed top-0 inset-x-0 z-40 bg-white border-b border-neutral-200"
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
    >
      <div className="h-14 px-4 flex items-center justify-between gap-3">
        <PrioritasLogo className="w-7 h-7 flex-shrink-0" />
        <button
          type="button"
          onClick={onOpenProjects}
          className="flex-1 min-w-0 text-left px-3 py-2 rounded-lg hover:bg-neutral-100 active:bg-neutral-200"
          aria-label="Switch project"
        >
          <div className="text-xs text-neutral-500 leading-none">Project</div>
          <div className="text-sm font-medium text-neutral-900 truncate">
            {currentProject?.name ?? 'No project selected'}
          </div>
        </button>
        <button
          type="button"
          onClick={onOpenUser}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          aria-label="Open account settings"
        >
          <UserIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}

export default MobileTopBar
