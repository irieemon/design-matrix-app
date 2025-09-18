import { useState, useEffect } from 'react'
import { Edit3, Trash2 } from 'lucide-react'
import { IdeaCard, User } from '../types'
import { IdeaRepository } from '../lib/repositories'
import { useToast } from '../contexts/ToastContext'
import { BaseModal } from './shared/Modal'

interface EditIdeaModalProps {
  idea: IdeaCard | null
  isOpen: boolean
  currentUser: User | null
  onClose: () => void
  onUpdate: (idea: IdeaCard) => void
  onDelete: (ideaId: string) => void
}

const EditIdeaModal: React.FC<EditIdeaModalProps> = ({ idea, isOpen, currentUser, onClose, onUpdate, onDelete }) => {
  const { showWarning } = useToast()
  const [content, setContent] = useState(idea?.content || '')
  const [details, setDetails] = useState(idea?.details || '')
  const [x] = useState(idea?.x || 260)
  const [y] = useState(idea?.y || 260)
  const [priority, setPriority] = useState<IdeaCard['priority']>(idea?.priority || 'moderate')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  // Update form state when idea changes
  useEffect(() => {
    if (idea) {
      setContent(idea.content || '')
      setDetails(idea.details || '')
      setPriority(idea.priority || 'moderate')
    }
  }, [idea])

  // Lock the idea when modal opens (only once)
  useEffect(() => {
    if (!idea || !isOpen) return

    let shouldUnlock = false

    const lockIdea = async () => {
      const locked = await IdeaRepository.lockIdeaForEditing(idea.id, currentUser?.id || '')
      setIsLocked(locked)
      shouldUnlock = locked // Set flag for cleanup
      
      if (!locked) {
        // Show a message that someone else is editing
        showWarning(`This idea is currently being edited by ${idea.editing_by || 'another user'}. Please try again later.`)
        onClose()
      }
    }
    
    lockIdea()

    // Cleanup: unlock when modal closes
    return () => {
      if (shouldUnlock) {
        IdeaRepository.unlockIdea(idea.id, currentUser?.id || '')
      }
    }
  }, [idea?.id, isOpen]) // Re-run if idea changes or modal opens

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    if (!idea) return

    // Update the idea with unlock data included
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
    
    // Note: Cleanup function will handle unlocking when modal closes
  }

  const handleCancel = async () => {
    // Explicitly unlock before closing
    if (isLocked && idea) {
      await IdeaRepository.unlockIdea(idea.id, currentUser?.id || '')
      setIsLocked(false)
    }
    onClose()
  }

  const handleDelete = () => {
    if (!idea) return
    onDelete(idea.id)
  }

  if (!idea) return null

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Edit Idea"
      size="xl"
    >
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Edit3 className="w-5 h-5 text-blue-600" />
          <p className="text-slate-600">Edit your idea details and priority</p>
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
                onClick={handleCancel}
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
    </BaseModal>
  )
}

export default EditIdeaModal