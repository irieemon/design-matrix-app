import React from 'react'
import { Calendar, Users } from 'lucide-react'
import { Milestone } from './types'

interface MilestoneTimelineProps {
  teamRecommendations?: string
  milestones: Milestone[]
}

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  teamRecommendations = 'Cross-functional team structure recommended for optimal collaboration.',
  milestones = []
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Execution Strategy</h2>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team Recommendations */}
          <div>
            <h3 className="font-medium text-slate-900 mb-3 flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Team Recommendations</span>
            </h3>
            <p
              className="text-slate-700 text-sm leading-relaxed"
              data-testid="team-recommendations"
            >
              {teamRecommendations}
            </p>
          </div>

          {/* Key Milestones */}
          <div>
            <h3 className="font-medium text-slate-900 mb-3 flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span data-testid="milestones-title">Key Milestones</span>
            </h3>
            <div className="space-y-3" data-testid="milestones-list">
              {milestones.length > 0 ? (
                milestones.map((milestone, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3"
                    data-testid={`milestone-${index}`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span
                        className="text-purple-600 text-xs font-bold"
                        data-testid={`milestone-number-${index}`}
                      >
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4
                          className="font-medium text-slate-900 text-sm"
                          data-testid={`milestone-title-${index}`}
                        >
                          {milestone.milestone}
                        </h4>
                        <span
                          className="text-purple-600 text-xs bg-purple-100 px-2 py-1 rounded"
                          data-testid={`milestone-timeline-${index}`}
                        >
                          {milestone.timeline}
                        </span>
                      </div>
                      <p
                        className="text-slate-600 text-xs mt-1"
                        data-testid={`milestone-description-${index}`}
                      >
                        {milestone.description}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className="text-slate-500 text-sm italic text-center py-4"
                  data-testid="no-milestones"
                >
                  No key milestones defined
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MilestoneTimeline