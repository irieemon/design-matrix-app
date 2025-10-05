import React from 'react'
import { X, Edit, Save, Trash2, ChevronDown, Flag, Clock, Users } from 'lucide-react'
import type { FeatureDetail } from '../../hooks/featureModal'

interface FeatureModalHeaderProps {
  currentFeature: FeatureDetail
  editMode: boolean
  mode: 'view' | 'edit' | 'create'
  availableTeams: string[]
  onClose: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  onEdit: () => void
  updateFeature: (updates: Partial<FeatureDetail>) => void
  showDelete?: boolean
}

const FeatureModalHeader: React.FC<FeatureModalHeaderProps> = ({
  currentFeature,
  editMode,
  mode,
  availableTeams,
  onClose,
  onSave,
  onCancel,
  onDelete,
  onEdit,
  updateFeature,
  showDelete = false
}) => {
  const getTeamDisplayName = (teamId: string) => {
    switch (teamId) {
      case 'creative': return 'Creative Team'
      case 'digital': return 'Digital Marketing'
      case 'analytics': return 'Analytics Team'
      case 'web': return 'Web Team'
      case 'mobile': return 'Mobile Team'
      case 'platform': return 'Platform Team'
      case 'testing': return 'QA & Testing'
      default: return teamId.charAt(0).toUpperCase() + teamId.slice(1) + ' Team'
    }
  }

  const getTeamIcon = (team: string) => {
    switch (team) {
      case 'creative': return '🎨'
      case 'digital': return '📈'
      case 'analytics': return '📊'
      case 'web': return '🖥️'
      case 'mobile': return '📱'
      case 'marketing': return '📈'
      case 'platform': return '⚙️'
      case 'testing': return '🧪'
      default: return '💼'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'planned': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTeamColor = (team: string) => {
    switch (team) {
      case 'creative': return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'digital': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'analytics': return 'bg-green-100 text-green-800 border-green-200'
      case 'web': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'mobile': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'marketing': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'platform': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="bg-gray-200 border-b border-neutral-200 p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-sm">
              {getTeamIcon(currentFeature.team)}
            </div>
            {editMode ? (
              <input
                type="text"
                value={currentFeature.title}
                onChange={(e) => updateFeature({ title: e.target.value })}
                className="text-2xl font-bold bg-transparent border-0 border-b-2 border-neutral-300 focus:border-blue-500 focus:outline-none text-neutral-900 placeholder-neutral-400 flex-1 pb-1 min-w-0"
                placeholder="Feature title"
              />
            ) : (
              <h2 className="text-2xl font-bold text-neutral-900 leading-tight truncate">{currentFeature.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {editMode ? (
              <>
                <div className="relative">
                  <select
                    value={currentFeature.priority}
                    onChange={(e) => updateFeature({ priority: e.target.value as 'high' | 'medium' | 'low' })}
                    className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-neutral-700 focus:border-blue-500 focus:outline-none focus:bg-white cursor-pointer min-w-[140px]"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={currentFeature.status}
                    onChange={(e) => updateFeature({ status: e.target.value as 'planned' | 'in-progress' | 'completed' })}
                    className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-neutral-700 focus:border-blue-500 focus:outline-none focus:bg-white cursor-pointer min-w-[120px]"
                  >
                    <option value="planned">Planned</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={currentFeature.team}
                    onChange={(e) => updateFeature({ team: e.target.value })}
                    className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-neutral-700 focus:border-blue-500 focus:outline-none focus:bg-white cursor-pointer min-w-[140px]"
                  >
                    {availableTeams.map(team => (
                      <option key={team} value={team}>{getTeamDisplayName(team)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                </div>
              </>
            ) : (
              <>
                <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${getPriorityColor(currentFeature.priority)}`}>
                  <Flag className="w-3 h-3 inline mr-1.5" />
                  {currentFeature.priority} priority
                </span>
                <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${getStatusColor(currentFeature.status)}`}>
                  <Clock className="w-3 h-3 inline mr-1.5" />
                  {currentFeature.status}
                </span>
                <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${getTeamColor(currentFeature.team)}`}>
                  <Users className="w-3 h-3 inline mr-1.5" />
                  {getTeamDisplayName(currentFeature.team)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-start space-x-2 flex-shrink-0">
          {mode !== 'view' && (
            <>
              {editMode ? (
                <>
                  <button
                    onClick={onSave}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-sm shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors font-medium text-sm"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={onEdit}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm shadow-sm"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              )}
              {showDelete && mode !== 'create' && (
                <button
                  onClick={onDelete}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors text-neutral-500 hover:text-neutral-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default FeatureModalHeader