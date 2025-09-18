import React from 'react'
import { Target } from 'lucide-react'
import type { FeatureDetail } from '../../hooks/featureModal'

interface FeatureDescriptionSectionProps {
  currentFeature: FeatureDetail
  editMode: boolean
  updateFeature: (updates: Partial<FeatureDetail>) => void
}

const FeatureDescriptionSection: React.FC<FeatureDescriptionSectionProps> = ({
  currentFeature,
  editMode,
  updateFeature
}) => {
  // Only render if there's a description or we're in edit mode
  if (!currentFeature.description && !editMode) {
    return null
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <h3 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
        <div className="p-1.5 bg-slate-500 rounded-lg">
          <Target className="w-4 h-4 text-white" />
        </div>
        <span>Description</span>
      </h3>
      {editMode ? (
        <textarea
          value={currentFeature.description || ''}
          onChange={(e) => updateFeature({ description: e.target.value })}
          className="w-full h-24 px-3 py-2 border border-slate-200 rounded-lg text-slate-700 resize-none focus:border-blue-500 focus:outline-none bg-white text-sm"
          placeholder="Enter feature description..."
        />
      ) : (
        <p className="text-slate-700 leading-relaxed text-sm">{currentFeature.description}</p>
      )}
    </div>
  )
}

export default FeatureDescriptionSection