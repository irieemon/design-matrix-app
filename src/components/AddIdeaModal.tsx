import { useState } from 'react'
import { Plus } from 'lucide-react'
import { IdeaCard, User } from '../types'
import { BaseModal } from './shared'

interface AddIdeaModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => void
  currentUser?: User | null
}

const AddIdeaModal: React.FC<AddIdeaModalProps> = ({ isOpen, onClose, onAdd, currentUser }) => {
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
    >

      <div className="flex items-center space-x-3 mb-6">
        <Plus className="w-5 h-5 text-blue-600" />
        <p className="text-slate-600">Create a new idea for your priority matrix</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Idea Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Idea Title
            </label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief title for your idea"
              required
            />
          </div>

          {/* Idea Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe your idea in more detail..."
            />
          </div>


          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority Level
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as IdeaCard['priority'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">🟢 Low Priority</option>
              <option value="moderate">🟡 Moderate</option>
              <option value="high">🔴 High Priority</option>
              <option value="strategic">🔵 Strategic</option>
              <option value="innovation">🟣 Innovation</option>
            </select>
          </div>

          {/* Info */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2">💡 Tip</h4>
            <div className="text-sm text-slate-600">
              After creating your idea, you can drag it to any position on the matrix to set its value vs complexity positioning.
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Add Idea
            </button>
          </div>
      </form>
    </BaseModal>
  )
}

export default AddIdeaModal