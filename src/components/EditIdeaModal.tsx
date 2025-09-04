import { useState, useEffect } from 'react'
import { X, Edit3, Trash2 } from 'lucide-react'
import { IdeaCard } from '../types'
import { DatabaseService } from '../lib/database'

interface EditIdeaModalProps {
  idea: IdeaCard
  currentUser: string
  onClose: () => void
  onUpdate: (idea: IdeaCard) => void
  onDelete: (ideaId: string) => void
}

const EditIdeaModal: React.FC<EditIdeaModalProps> = ({ idea, currentUser, onClose, onUpdate, onDelete }) => {
  const [content, setContent] = useState(idea.content)
  const [details, setDetails] = useState(idea.details || '')
  const [x] = useState(idea.x)
  const [y] = useState(idea.y)
  const [priority, setPriority] = useState(idea.priority)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  // Lock the idea when modal opens
  useEffect(() => {
    const lockIdea = async () => {
      const locked = await DatabaseService.lockIdeaForEditing(idea.id, currentUser)
      setIsLocked(locked)
      if (!locked) {
        // Show a message that someone else is editing
        alert(`This idea is currently being edited by ${idea.editing_by}. Please try again later.`)
        onClose()
      }
    }
    
    lockIdea()

    // Cleanup: unlock when modal closes
    return () => {
      if (isLocked) {
        DatabaseService.unlockIdea(idea.id, currentUser)
      }
    }
  }, [idea.id, currentUser, onClose, isLocked])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    // Unlock before updating
    await DatabaseService.unlockIdea(idea.id, currentUser)
    
    onUpdate({
      ...idea,
      content: content.trim(),
      details: details.trim(),
      x,
      y,
      priority,
      editing_by: null,
      editing_at: null
    })
  }

  const handleDelete = () => {
    onDelete(idea.id)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Edit3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Edit Idea</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

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
              You can drag this idea on the matrix to change its value vs complexity positioning.
            </div>
          </div>

          {/* Delete Confirmation */}
          {showDeleteConfirm ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">Confirm Deletion</h4>
              <p className="text-sm text-red-600 mb-4">
                Are you sure you want to delete this idea? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">Delete Idea</span>
              </button>
            </div>
          )}

          {/* Actions */}
          {!showDeleteConfirm && (
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
                Save Changes
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default EditIdeaModal