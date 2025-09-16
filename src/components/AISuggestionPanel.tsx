import React, { useState } from 'react'
import { Sparkles, Lightbulb, ArrowRight, Clock, TrendingUp, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { AISuggestion, AutoCompletionSuggestion } from '../hooks/useAISuggestions'

interface AISuggestionPanelProps {
  suggestions: AISuggestion[]
  autoCompletions: AutoCompletionSuggestion[]
  isLoading: boolean
  onApplySuggestion: (suggestion: AISuggestion) => void
  onApplyCompletion: (completion: AutoCompletionSuggestion) => void
  className?: string
}

const AISuggestionPanel: React.FC<AISuggestionPanelProps> = ({
  suggestions,
  autoCompletions,
  isLoading,
  onApplySuggestion,
  onApplyCompletion,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<'suggestions' | 'completions'>('suggestions')

  const getSuggestionIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'completion':
        return <ArrowRight className="w-4 h-4" />
      case 'enhancement':
        return <TrendingUp className="w-4 h-4" />
      case 'related':
        return <Lightbulb className="w-4 h-4" />
      case 'priority':
        return <Clock className="w-4 h-4" />
      case 'category':
        return <Zap className="w-4 h-4" />
      default:
        return <Sparkles className="w-4 h-4" />
    }
  }

  const getSuggestionColors = (type: AISuggestion['type']) => {
    const baseColors = {
      completion: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
      enhancement: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100',
      related: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100',
      priority: 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100',
      category: 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100'
    }
    
    return baseColors[type] || baseColors.completion
  }

  const getConfidenceBar = (confidence: number) => {
    const percentage = Math.round(confidence * 100)
    const color = confidence > 0.8 ? 'bg-green-400' : confidence > 0.6 ? 'bg-yellow-400' : 'bg-red-400'
    
    return (
      <div className="flex items-center space-x-2 text-xs">
        <span className="text-gray-500">Confidence:</span>
        <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-gray-600 font-medium">{percentage}%</span>
      </div>
    )
  }

  if (!suggestions.length && !autoCompletions.length && !isLoading) {
    return null
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Suggestions</h3>
            <p className="text-xs text-gray-500">
              {isLoading ? 'Generating suggestions...' : 
               `${suggestions.length + autoCompletions.length} intelligent suggestions`}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Tabs */}
          {suggestions.length > 0 && autoCompletions.length > 0 && (
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('suggestions')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'suggestions'
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Smart Suggestions ({suggestions.length})
              </button>
              <button
                onClick={() => setActiveTab('completions')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'completions'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Auto-Complete ({autoCompletions.length})
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-4">
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <div className="flex items-center space-x-2 text-gray-500">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Analyzing your input...</span>
                </div>
              </div>
            )}

            {/* Smart Suggestions */}
            {!isLoading && (activeTab === 'suggestions' || autoCompletions.length === 0) && suggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Smart Suggestions</h4>
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                      getSuggestionColors(suggestion.type)
                    }`}
                    onClick={() => onApplySuggestion(suggestion)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getSuggestionIcon(suggestion.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm mb-1">
                          {suggestion.text}
                        </p>
                        <p className="text-xs opacity-75 mb-2">
                          {suggestion.reasoning || suggestion.context}
                        </p>
                        {getConfidenceBar(suggestion.confidence)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-Completions */}
            {!isLoading && (activeTab === 'completions' || suggestions.length === 0) && autoCompletions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Auto-Complete</h4>
                {autoCompletions.map((completion) => (
                  <div
                    key={completion.id}
                    className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => onApplyCompletion(completion)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="text-gray-400">{completion.text}</span>
                          <span className="font-medium text-blue-600">
                            {completion.completion.slice(completion.text.length)}
                          </span>
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            completion.category === 'business' ? 'bg-purple-100 text-purple-700' :
                            completion.category === 'common' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {completion.category}
                          </span>
                          <span className="text-xs text-gray-500">
                            Score: {Math.round(completion.score * 100)}%
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && suggestions.length === 0 && autoCompletions.length === 0 && (
              <div className="text-center py-6">
                <Lightbulb className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Start typing to see AI suggestions</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default AISuggestionPanel