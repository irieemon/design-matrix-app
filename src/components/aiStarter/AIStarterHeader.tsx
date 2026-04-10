import React from 'react'
import { X } from 'lucide-react'

interface AIStarterHeaderProps {
  onClose: () => void
}

const AIStarterHeader: React.FC<AIStarterHeaderProps> = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between p-6 border-b border-hairline-default bg-canvas-secondary">
      <h2 className="text-lg font-semibold text-graphite-900">AI Project Starter</h2>
      <button
        onClick={onClose}
        className="transition-colors text-graphite-400 hover:text-graphite-600"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

export default AIStarterHeader