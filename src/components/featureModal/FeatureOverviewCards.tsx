import React from 'react'
import { Calendar, Users, Zap, ChevronDown } from 'lucide-react'
import type { FeatureDetail, TimelineInfo } from '../../hooks/featureModal'

interface FeatureOverviewCardsProps {
  currentFeature: FeatureDetail
  timeline: TimelineInfo | null
  editMode: boolean
  startDate: Date
  updateFeature: (updates: Partial<FeatureDetail>) => void
}

const FeatureOverviewCards: React.FC<FeatureOverviewCardsProps> = ({
  currentFeature,
  timeline,
  editMode,
  startDate,
  updateFeature
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Timeline Card */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="flex items-center space-x-2 mb-3">
          <div className="p-1.5 bg-blue-500 rounded-lg">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-semibold text-blue-900">Timeline</h3>
        </div>
        {editMode ? (
          <div className="space-y-3">
            <div>
              <label className="block text-blue-900 text-xs font-medium mb-1">Start Month</label>
              <div className="relative">
                <select
                  value={currentFeature.startMonth}
                  onChange={(e) => updateFeature({ startMonth: parseInt(e.target.value) })}
                  className="appearance-none w-full px-3 py-2 border border-blue-200 rounded-lg text-blue-900 focus:border-blue-500 focus:outline-none text-sm bg-white pr-8"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const monthDate = new Date(startDate)
                    monthDate.setMonth(monthDate.getMonth() + i)
                    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    return (
                      <option key={i} value={i}>
                        {monthName}
                      </option>
                    )
                  })}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-blue-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-blue-900 text-xs font-medium mb-1">Duration</label>
              <div className="relative">
                <select
                  value={currentFeature.duration}
                  onChange={(e) => updateFeature({ duration: parseInt(e.target.value) })}
                  className="appearance-none w-full px-3 py-2 border border-blue-200 rounded-lg text-blue-900 focus:border-blue-500 focus:outline-none text-sm bg-white pr-8"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const months = i + 1
                    return (
                      <option key={months} value={months}>
                        {months} month{months !== 1 ? 's' : ''}
                      </option>
                    )
                  })}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-blue-400 pointer-events-none" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {timeline && (
              <>
                <p className="text-blue-800 font-medium">{timeline.start}</p>
                <p className="text-blue-700 text-sm">to {timeline.end}</p>
              </>
            )}
            <p className="text-blue-600 text-xs bg-blue-200 px-2 py-1 rounded inline-block mt-2">
              {currentFeature.duration} month{currentFeature.duration !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Team Card */}
      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
        <div className="flex items-center space-x-2 mb-3">
          <div className="p-1.5 bg-purple-500 rounded-lg">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-semibold text-purple-900">Team</h3>
        </div>
        <div className="space-y-1">
          <p className="text-purple-800 font-medium">{getTeamDisplayName(currentFeature.team)}</p>
          <p className="text-purple-600 text-xs bg-purple-200 px-2 py-1 rounded inline-block">Primary responsibility</p>
        </div>
      </div>

      {/* Complexity Card */}
      {(currentFeature.complexity || editMode) && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-1.5 bg-amber-500 rounded-lg">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-amber-900">Complexity</h3>
          </div>
          {editMode ? (
            <div className="relative">
              <select
                value={currentFeature.complexity || 'medium'}
                onChange={(e) => updateFeature({ complexity: e.target.value })}
                className="appearance-none w-full px-3 py-2 border border-amber-200 rounded-lg text-amber-900 focus:border-amber-500 focus:outline-none bg-white text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-amber-400 pointer-events-none" />
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-amber-800 font-medium capitalize">{currentFeature.complexity}</p>
              <p className="text-amber-600 text-xs bg-amber-200 px-2 py-1 rounded inline-block">Estimated effort</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FeatureOverviewCards