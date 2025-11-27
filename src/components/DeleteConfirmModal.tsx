import React from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X, Trash2 } from 'lucide-react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  isDangerous?: boolean
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Delete",
  isDangerous = true
}) => {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  // Use portal to render outside matrix DOM + inline styles to prevent CSS override
  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          position: 'relative',
          background: 'white',
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '28rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--hairline-default)' }}>
          <div className="flex items-center space-x-3">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: isDangerous ? 'var(--garnet-50)' : 'var(--graphite-100)' }}
            >
              {isDangerous ? (
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--garnet-600)' }} />
              ) : (
                <Trash2 className="w-5 h-5" style={{ color: 'var(--graphite-600)' }} />
              )}
            </div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--graphite-900)' }}>{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{
              color: 'var(--graphite-400)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--graphite-600)'
              e.currentTarget.style.backgroundColor = 'var(--graphite-100)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--graphite-400)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="leading-relaxed" style={{ color: 'var(--graphite-600)' }}>{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t rounded-b-2xl" style={{ borderColor: 'var(--hairline-default)', backgroundColor: 'var(--graphite-50)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg transition-colors font-medium"
            style={{
              color: 'var(--graphite-600)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--graphite-900)'
              e.currentTarget.style.backgroundColor = 'var(--graphite-200)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--graphite-600)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: isDangerous ? 'var(--garnet-600)' : 'var(--graphite-900)',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDangerous ? 'var(--garnet-700)' : 'var(--graphite-800)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDangerous ? 'var(--garnet-600)' : 'var(--graphite-900)'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )

  // Render via portal to document.body to escape any parent CSS overrides
  return createPortal(modalContent, document.body)
}

export default DeleteConfirmModal