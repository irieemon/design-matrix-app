import React, { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type ArraySectionType = 'userStories' | 'deliverables' | 'successCriteria' | 'risks' | 'relatedIdeas'

interface FeatureArraySectionProps {
  title: string
  items: string[]
  editMode: boolean
  onAdd: (item: string) => void
  onRemove: (index: number) => void
  placeholder: string
  icon: LucideIcon
  type: ArraySectionType
  inputValue?: string
  onInputChange?: (value: string) => void
  bgColor?: string
  borderColor?: string
  textColor?: string
  buttonColor?: string
}

const FeatureArraySection: React.FC<FeatureArraySectionProps> = ({
  title,
  items,
  editMode,
  onAdd,
  onRemove,
  placeholder,
  icon: Icon,
  type,
  inputValue,
  onInputChange,
  bgColor = 'bg-slate-50',
  borderColor = 'border-slate-200',
  textColor = 'text-slate-800',
  buttonColor = 'bg-slate-600'
}) => {
  const [localInputValue, setLocalInputValue] = useState('')

  // Use either controlled input value or local state
  const currentInputValue = inputValue !== undefined ? inputValue : localInputValue
  const setCurrentInputValue = onInputChange || setLocalInputValue

  const handleAdd = () => {
    if (currentInputValue.trim()) {
      onAdd(currentInputValue.trim())
      setCurrentInputValue('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  // Don't render if no items and not in edit mode
  if (items.length === 0 && !editMode) {
    return null
  }

  const renderItems = () => {
    switch (type) {
      case 'userStories':
        return (
          <div className="space-y-4">
            {items.map((story, index) => (
              <div key={index} className="flex items-start space-x-4 bg-white rounded-xl p-4 border border-green-200">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-bold">{index + 1}</span>
                </div>
                <p className="text-green-800 flex-1 leading-relaxed">{story}</p>
                {editMode && (
                  <button
                    onClick={() => onRemove(index)}
                    className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )

      case 'deliverables':
      case 'successCriteria':
      case 'risks':
        return (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 bg-white rounded-lg p-3 border">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className={`${textColor} text-sm flex-1`}>{item}</span>
                {editMode && (
                  <button
                    onClick={() => onRemove(index)}
                    className="flex-shrink-0 text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )

      case 'relatedIdeas':
        return (
          <div className="flex flex-wrap gap-2">
            {items.map((idea, index) => (
              <span
                key={index}
                className={`inline-flex items-center px-3 py-1 ${bgColor} ${textColor} rounded-full text-sm border ${borderColor}`}
              >
                {idea}
                {editMode && (
                  <button
                    onClick={() => onRemove(index)}
                    className="ml-2 hover:text-opacity-80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={`${bgColor} rounded-lg p-6 border ${borderColor}`}>
      <h3 className={`font-semibold ${textColor} mb-4 flex items-center space-x-2`}>
        <Icon className="w-5 h-5" />
        <span>{title} ({items.length})</span>
      </h3>

      {renderItems()}

      {editMode && (
        <div className="flex items-center space-x-2 mt-4">
          <input
            type="text"
            value={currentInputValue}
            onChange={(e) => setCurrentInputValue(e.target.value)}
            className={`flex-1 px-3 py-2 border ${borderColor} rounded-lg ${textColor} focus:border-blue-500 focus:outline-none bg-white text-sm`}
            placeholder={placeholder}
            onKeyPress={handleKeyPress}
          />
          <button
            onClick={handleAdd}
            className={`px-3 py-2 ${buttonColor} text-white rounded-lg hover:opacity-90 flex items-center space-x-1 transition-colors`}
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default FeatureArraySection