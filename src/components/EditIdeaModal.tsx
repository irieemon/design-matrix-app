import { useState } from 'react'
import { X, Edit3, Trash2 } from 'lucide-react'
import { IdeaCard } from '../types'

interface EditIdeaModalProps {
  idea: IdeaCard
  onClose: () => void
  onUpdate: (idea: IdeaCard) => void
  onDelete: (ideaId: string) => void
}

const EditIdeaModal: React.FC<EditIdeaModalProps> = ({ idea, onClose, onUpdate, onDelete }) => {
  const [content, setContent] = useState(idea.content)
  const [x, setX] = useState(idea.x)
  const [y, setY] = useState(idea.y)
  const [priority, setPriority] = useState(idea.priority)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    onUpdate({
      ...idea,
      content: content.trim(),
      x,
      y,
      priority
    })
  }

  const handleDelete = () => {
    onDelete(idea.id)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
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
          {/* Current Position Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-1">Current Position</h4>
            <p className="text-sm text-blue-600">
              X: {idea.x} • Y: {idea.y}
            </p>
          </div>

          {/* Idea Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Idea Description
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe your idea..."
              required
            />
          </div>

          {/* Position Sliders */}
          <div className="grid grid-cols-2 gap-4">
            {/* X Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                X Position
              </label>
              <input
                type="range"
                min="0"
                max="520"
                value={x}
                onChange={(e) => setX(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Left</span>
                <span className="font-medium">{x}</span>
                <span>Right</span>
              </div>
            </div>

            {/* Y Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Y Position
              </label>
              <input
                type="range"
                min="0"
                max="520"
                value={y}
                onChange={(e) => setY(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Top</span>
                <span className="font-medium">{y}</span>
                <span>Bottom</span>
              </div>
            </div>
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

          {/* Position Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">New Position</h4>
            <div className="text-sm text-gray-600">
              X: {x}, Y: {y}
              {x > 260 && y < 260 && " (Top Right)"}
              {x <= 260 && y < 260 && " (Top Left)"}  
              {x <= 260 && y >= 260 && " (Bottom Left)"}
              {x > 260 && y >= 260 && " (Bottom Right)"}
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