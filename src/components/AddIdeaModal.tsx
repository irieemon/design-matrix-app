import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { IdeaCard, User } from '../types'
import { BaseModal } from './shared'
import Button from './ui/Button'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'

interface AddIdeaModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => void
  currentUser?: User | null
  /** Custom portal target for fullscreen mode */
  portalTarget?: HTMLElement
}

const AddIdeaModal: React.FC<AddIdeaModalProps> = ({ isOpen, onClose, onAdd, currentUser, portalTarget }) => {
  const [content, setContent] = useState('')
  const [details, setDetails] = useState('')
  const [x, setX] = useState(260) // Center of 520px usable area
  const [y, setY] = useState(260) // Center of 520px usable area
  const [priority, setPriority] = useState<IdeaCard['priority']>('moderate')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    onAdd({
      content: content.trim(),
      details: details.trim(),
      x,
      y,
      priority,
      created_by: currentUser?.id || 'Anonymous',
      is_collapsed: true, // Default to minimized view
      editing_by: null, // Not being edited initially
      editing_at: null // Not being edited initially
    })

    // Reset form
    setContent('')
    setDetails('')
    setX(260)
    setY(260)
    setPriority('moderate')
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Idea"
      size="xl"
      portalTarget={portalTarget}
    >
      <div data-testid="add-idea-modal">
        <div className="flex items-center space-x-3 mb-6">
          <Plus className="w-5 h-5" style={{ color: 'var(--sapphire-600)' }} />
          <p style={{ color: 'var(--graphite-600)' }}>Create a new idea for your priority matrix</p>
        </div>

        <form onSubmit={handleSubmit} data-testid="add-idea-form" className="space-y-6">
          {/* Idea Title */}
          <Input
            id="idea-title"
            label="Idea Title"
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            data-testid="idea-content-input"
            placeholder="Brief title for your idea"
            required
            fullWidth
            variant="primary"
            size="md"
          />

          {/* Idea Details */}
          <Textarea
            id="idea-details"
            label="Details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            data-testid="idea-description-input"
            rows={4}
            placeholder="Describe your idea in more detail..."
            fullWidth
            variant="primary"
            size="md"
          />


          {/* Priority */}
          <div>
            <label htmlFor="idea-priority" className="block text-sm font-medium mb-2" style={{ color: 'var(--graphite-700)' }}>
              Priority Level
            </label>
            <select
              id="idea-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as IdeaCard['priority'])}
              data-testid="idea-priority-select"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--hairline-default)',
                color: 'var(--graphite-900)',
                backgroundColor: 'var(--surface-primary)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--sapphire-500)';
                e.target.style.boxShadow = '0 0 0 3px var(--sapphire-100)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--hairline-default)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="low">🟢 Low Priority</option>
              <option value="moderate">🟡 Moderate</option>
              <option value="high">🔴 High Priority</option>
              <option value="strategic">🔵 Strategic</option>
              <option value="innovation">🟣 Innovation</option>
            </select>
          </div>

          {/* Info */}
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--canvas-secondary)' }}>
            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--graphite-700)' }}>💡 Tip</h4>
            <div className="text-sm" style={{ color: 'var(--graphite-600)' }}>
              After creating your idea, you can drag it to any position on the matrix to set its value vs complexity positioning.
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              data-testid="idea-cancel-button"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!content.trim()}
              variant="sapphire"
              data-testid="idea-save-button"
              className="flex-1"
            >
              Add Idea
            </Button>
          </div>
        </form>
      </div>
    </BaseModal>
  )
}

export default AddIdeaModal