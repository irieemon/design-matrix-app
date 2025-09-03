import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { IdeaCard } from '../types'

interface AddIdeaModalProps {
  onClose: () => void
  onAdd: (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => void
}

const AddIdeaModal: React.FC<AddIdeaModalProps> = ({ onClose, onAdd }) => {
  const [content, setContent] = useState('')
  const [x, setX] = useState(260) // Center of 520px usable area
  const [y, setY] = useState(260) // Center of 520px usable area
  const [priority, setPriority] = useState<IdeaCard['priority']>('moderate')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    onAdd({
      content: content.trim(),
      x,
      y,
      priority
    })

    // Reset form
    setContent('')
    setX(260)
    setY(260)
    setPriority('moderate')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Plus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Add New Idea</h2>
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
          {/* Idea Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe your idea
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="What's your innovative idea?"
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
            <h4 className="text-sm font-medium text-gray-700 mb-2">Position</h4>
            <div className="text-sm text-gray-600">
              X: {x}, Y: {y}
              {x > 260 && y < 260 && " (Top Right)"}
              {x <= 260 && y < 260 && " (Top Left)"}  
              {x <= 260 && y >= 260 && " (Bottom Left)"}
              {x > 260 && y >= 260 && " (Bottom Right)"}
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
      </div>
    </div>
  )
}

export default AddIdeaModal