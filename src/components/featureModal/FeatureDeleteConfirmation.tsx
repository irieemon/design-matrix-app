import React from 'react'
import { Trash2 } from 'lucide-react'
import type { FeatureDetail } from '../../hooks/featureModal'

interface FeatureDeleteConfirmationProps {
  isOpen: boolean
  feature: FeatureDetail
  onConfirm: () => void
  onCancel: () => void
}

const FeatureDeleteConfirmation: React.FC<FeatureDeleteConfirmationProps> = ({
  isOpen,
  feature,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Feature</h3>
              <p className="text-sm text-gray-600">This action cannot be undone</p>
            </div>
          </div>

          <p className="text-gray-700 mb-6">
            Are you sure you want to delete <strong>"{feature.title}"</strong>?
            This will permanently remove the feature and all its associated data.
          </p>

          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Feature
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeatureDeleteConfirmation