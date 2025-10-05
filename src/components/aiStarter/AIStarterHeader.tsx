import React from 'react'
import { X } from 'lucide-react'

interface AIStarterHeaderProps {
  onClose: () => void
}

const AIStarterHeader: React.FC<AIStarterHeaderProps> = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between p-6 border-b" style={{
      borderColor: 'var(--hairline-default)',
      backgroundColor: 'var(--canvas-secondary)'
    }}>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--graphite-900)' }}>AI Project Starter</h2>
      <button
        onClick={onClose}
        className="transition-colors"
        style={{ color: 'var(--graphite-400)' }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--graphite-600)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--graphite-400)'}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

export default AIStarterHeader