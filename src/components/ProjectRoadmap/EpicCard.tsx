import React from 'react'
import { Users, Clock, Lightbulb } from 'lucide-react'
import { Epic } from './types'

interface EpicCardProps {
  epic: Epic
  epicIndex: number
}

const EpicCard: React.FC<EpicCardProps> = ({ epic, epicIndex }) => {
  const getPriorityColor = (priority: string) => {
    if (!priority) {
      return 'bg-slate-100 text-slate-800 border-slate-200'
    }
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  const getComplexityColor = (complexity: string) => {
    if (!complexity) {
      return 'bg-slate-100 text-slate-800 border-slate-200'
    }
    switch (complexity.toLowerCase()) {
      case 'high':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'low':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  return (
    <div
      key={epicIndex}
      className="bg-slate-50 rounded-lg p-4 border border-slate-200"
      data-testid={`epic-card-${epicIndex}`}
    >
      {/* Epic Header */}
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-medium text-slate-900 flex items-center space-x-2">
          <Lightbulb className="w-4 h-4 text-amber-600" />
          <span>{epic.title}</span>
        </h4>
        <div className="flex space-x-2">
          <span
            className={`px-2 py-1 text-xs rounded border ${getPriorityColor(epic.priority)}`}
            data-testid={`priority-${epic.priority?.toLowerCase() || 'unknown'}`}
          >
            {epic.priority || 'Unknown'}
          </span>
          <span
            className={`px-2 py-1 text-xs rounded border ${getComplexityColor(epic.complexity)}`}
            data-testid={`complexity-${epic.complexity?.toLowerCase() || 'unknown'}`}
          >
            {epic.complexity || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Epic Description */}
      <p className="text-sm text-slate-700 mb-3">{epic.description}</p>

      {/* Epic Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User Stories */}
        {(epic.userStories || []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-700 mb-1 flex items-center space-x-1">
              <Users className="w-3 h-3" />
              <span>User Stories:</span>
            </p>
            <ul className="text-xs text-slate-600 space-y-1">
              {(epic.userStories || []).map((story, storyIndex) => (
                <li
                  key={storyIndex}
                  className="flex items-start space-x-1"
                  data-testid={`user-story-${storyIndex}`}
                >
                  <span className="text-slate-400 flex-shrink-0">•</span>
                  <span>{story}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Deliverables */}
        {(epic.deliverables || []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-700 mb-1 flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Deliverables:</span>
            </p>
            <ul className="text-xs text-slate-600 space-y-1">
              {(epic.deliverables || []).map((deliverable, deliverableIndex) => (
                <li
                  key={deliverableIndex}
                  className="flex items-start space-x-1"
                  data-testid={`deliverable-${deliverableIndex}`}
                >
                  <span className="text-slate-400 flex-shrink-0">•</span>
                  <span>{deliverable}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Related Ideas */}
      {(epic.relatedIdeas || []).length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-700 mb-1">Related Ideas:</p>
          <div className="flex flex-wrap gap-1">
            {(epic.relatedIdeas || []).map((idea, ideaIndex) => (
              <span
                key={ideaIndex}
                className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs"
                data-testid={`related-idea-${ideaIndex}`}
              >
                {idea}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Info (if available) */}
      {(epic.startMonth !== undefined || epic.duration !== undefined || epic.team) && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            {epic.startMonth !== undefined && (
              <span data-testid="epic-start-month">
                Start: Month {epic.startMonth}
              </span>
            )}
            {epic.duration !== undefined && (
              <span data-testid="epic-duration">
                Duration: {epic.duration} months
              </span>
            )}
            {epic.team && (
              <span data-testid="epic-team">
                Team: {epic.team}
              </span>
            )}
            {epic.status && (
              <span
                className={`px-2 py-1 rounded ${
                  epic.status === 'completed' ? 'bg-green-100 text-green-700' :
                  epic.status === 'in-progress' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}
                data-testid={`epic-status-${epic.status}`}
              >
                {epic.status.charAt(0).toUpperCase() + epic.status.slice(1)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default EpicCard