import React, { useState } from 'react'
import type { IdeaCard, Project, User } from '../../types'
import BottomSheet from '../shared/BottomSheet'

type Priority = IdeaCard['priority']

interface QuickCaptureSheetProps {
  isOpen: boolean
  onClose: () => void
  currentUser: User
  currentProject: Project | null
  addIdea?: (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'strategic', label: 'Strategic' },
]

const MAX_LEN = 500

export const QuickCaptureSheet: React.FC<QuickCaptureSheetProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentProject,
  addIdea,
}) => {
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<Priority>('moderate')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setContent('')
    setPriority('moderate')
    setError(null)
    setIsSubmitting(false)
  }

  const handleClose = () => {
    if (isSubmitting) return
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      setError('Idea is required')
      return
    }
    if (!currentProject) {
      setError('Select a project first')
      return
    }
    if (!addIdea) return

    setIsSubmitting(true)
    setError(null)
    try {
      await addIdea({
        content: trimmed,
        details: '',
        x: 260,
        y: 260,
        priority,
        created_by: currentUser.id,
        is_collapsed: true,
        editing_by: null,
        editing_at: null,
      } as Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save idea')
      setIsSubmitting(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Capture idea">
      <div className="space-y-4">
        <div>
          <label htmlFor="quick-capture-text" className="sr-only">
            Idea
          </label>
          <textarea
            id="quick-capture-text"
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
            placeholder="What's the idea?"
            rows={4}
            className="w-full rounded-lg border border-neutral-300 p-3 text-base focus:outline-none focus:ring-2 focus:ring-sapphire-500"
            autoFocus
          />
          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
            <span>{content.length}/{MAX_LEN}</span>
            {!currentProject && <span className="text-amber-600">No project selected</span>}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-neutral-700 mb-2">Priority</div>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITIES.map((p) => {
              const active = priority === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  aria-pressed={active}
                  className={`min-h-11 rounded-full text-sm font-medium border transition ${
                    active
                      ? 'bg-sapphire-600 text-white border-sapphire-600'
                      : 'bg-white text-neutral-700 border-neutral-300'
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: 'var(--sapphire-600, #2563eb)',
                          borderColor: 'var(--sapphire-600, #2563eb)',
                        }
                      : undefined
                  }
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div role="alert" className="text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 min-h-11 rounded-lg border border-neutral-300 text-neutral-700 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim() || !currentProject}
            className="flex-[2] min-h-11 rounded-lg bg-sapphire-600 text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--sapphire-600, #2563eb)' }}
          >
            {isSubmitting ? 'Saving…' : 'Save idea'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

export default QuickCaptureSheet
