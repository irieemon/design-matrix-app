import React from 'react'
import { X } from 'lucide-react'

interface AIStarterHeaderProps {
  onClose: () => void
}

const AIStarterHeader: React.FC<AIStarterHeaderProps> = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between p-6 border-b border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">AI Project Starter</h2>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

export default AIStarterHeader