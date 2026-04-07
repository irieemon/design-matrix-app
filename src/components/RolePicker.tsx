/**
 * RolePicker — Viewer/Editor segmented control.
 *
 * Used by InviteCollaboratorModal (and any future role-assignment UI).
 * Pure presentational component, no side effects.
 */

import React from 'react'

export type CollaboratorRole = 'viewer' | 'editor'

interface RolePickerProps {
  value: CollaboratorRole
  onChange: (next: CollaboratorRole) => void
  disabled?: boolean
}

const OPTIONS: Array<{ value: CollaboratorRole; label: string; hint: string }> = [
  { value: 'viewer', label: 'Viewer', hint: 'Can view ideas and the matrix' },
  { value: 'editor', label: 'Editor', hint: 'Can create and move ideas' },
]

const RolePicker: React.FC<RolePickerProps> = ({ value, onChange, disabled }) => {
  return (
    <div
      role="group"
      aria-label="Collaborator role"
      className="inline-flex rounded-lg border border-hairline-default bg-canvas-primary p-1"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${
              selected
                ? 'bg-sapphire-500 text-white shadow-sm'
                : 'bg-transparent text-graphite-700 hover:bg-graphite-100'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default RolePicker
