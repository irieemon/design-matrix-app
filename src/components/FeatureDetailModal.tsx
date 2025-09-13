import React from 'react'
import { X, Calendar, Users, Flag, Zap, Target, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

interface FeatureDetail {
  id: string
  title: string
  description?: string
  startMonth: number
  duration: number
  team: string
  priority: 'high' | 'medium' | 'low'
  status: 'planned' | 'in-progress' | 'completed'
  userStories?: string[]
  deliverables?: string[]
  relatedIdeas?: string[]
  risks?: string[]
  successCriteria?: string[]
  complexity?: string
}

interface FeatureDetailModalProps {
  feature: FeatureDetail | null
  isOpen: boolean
  onClose: () => void
  startDate?: Date
}

const FeatureDetailModal: React.FC<FeatureDetailModalProps> = ({
  feature,
  isOpen,
  onClose,
  startDate = new Date()
}) => {
  if (!isOpen || !feature) return null

  // Calculate feature timeline
  const getFeatureTimeline = () => {
    const start = new Date(startDate)
    start.setMonth(start.getMonth() + feature.startMonth)
    const end = new Date(start)
    end.setMonth(end.getMonth() + feature.duration)
    
    return {
      start: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      end: end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  const timeline = getFeatureTimeline()

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
      case 'web': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'mobile': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'marketing': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'platform': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTeamIcon = (team: string) => {
    switch (team) {
      case 'web': return '🖥️'
      case 'mobile': return '📱'
      case 'marketing': return '📈'
      case 'platform': return '⚙️'
      default: return '💼'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl">{getTeamIcon(feature.team)}</span>
                <h2 className="text-2xl font-bold">{feature.title}</h2>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-sm border ${getPriorityColor(feature.priority)}`}>
                  {feature.priority} priority
                </span>
                <span className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(feature.status)}`}>
                  {feature.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm border ${getTeamColor(feature.team)}`}>
                  {feature.team} team
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Timeline</h3>
                </div>
                <p className="text-blue-800 font-medium">{timeline.start}</p>
                <p className="text-blue-600 text-sm">to {timeline.end}</p>
                <p className="text-blue-600 text-sm mt-1">{feature.duration} month{feature.duration !== 1 ? 's' : ''}</p>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">Team</h3>
                </div>
                <p className="text-purple-800 font-medium capitalize">{feature.team} Team</p>
                <p className="text-purple-600 text-sm">Primary responsibility</p>
              </div>

              {feature.complexity && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-amber-900">Complexity</h3>
                  </div>
                  <p className="text-amber-800 font-medium capitalize">{feature.complexity}</p>
                  <p className="text-amber-600 text-sm">Estimated effort</p>
                </div>
              )}
            </div>

            {/* Description */}
            {feature.description && (
              <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Description</span>
                </h3>
                <p className="text-slate-700 leading-relaxed">{feature.description}</p>
              </div>
            )}

            {/* User Stories */}
            {feature.userStories && feature.userStories.length > 0 && (
              <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                <h3 className="font-semibold text-green-900 mb-4 flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>User Stories ({feature.userStories.length})</span>
                </h3>
                <div className="space-y-3">
                  {feature.userStories.map((story, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-green-200 rounded-full flex items-center justify-center">
                        <span className="text-green-800 text-xs font-bold">{index + 1}</span>
                      </div>
                      <p className="text-green-800">{story}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deliverables */}
            {feature.deliverables && feature.deliverables.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-4 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Key Deliverables ({feature.deliverables.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {feature.deliverables.map((deliverable, index) => (
                    <div key={index} className="flex items-center space-x-2 bg-white rounded-lg p-3 border border-blue-300">
                      <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-blue-800 text-sm">{deliverable}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success Criteria */}
            {feature.successCriteria && feature.successCriteria.length > 0 && (
              <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
                <h3 className="font-semibold text-emerald-900 mb-4 flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Success Criteria</span>
                </h3>
                <div className="space-y-2">
                  {feature.successCriteria.map((criteria, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
                      <span className="text-emerald-800">{criteria}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {feature.risks && feature.risks.length > 0 && (
              <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                <h3 className="font-semibold text-red-900 mb-4 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Risk Factors</span>
                </h3>
                <div className="space-y-2">
                  {feature.risks.map((risk, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                      <span className="text-red-800">{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Ideas */}
            {feature.relatedIdeas && feature.relatedIdeas.length > 0 && (
              <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
                <h3 className="font-semibold text-indigo-900 mb-4 flex items-center space-x-2">
                  <Flag className="w-5 h-5" />
                  <span>Related Ideas</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {feature.relatedIdeas.map((idea, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm border border-indigo-300"
                    >
                      {idea}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Feature ID: {feature.id}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeatureDetailModal