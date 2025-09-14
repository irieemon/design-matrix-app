import React from 'react'
import { Calendar, Users, Flag, CheckCircle, Target, AlertTriangle } from 'lucide-react'

interface RoadmapFeature {
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

interface TrackExportViewProps {
  features: RoadmapFeature[]
  teamName: string
  title: string
  subtitle?: string
  startDate?: Date
  projectType?: string
}

const TrackExportView: React.FC<TrackExportViewProps> = ({
  features,
  teamName,
  title,
  subtitle,
  startDate = new Date(),
  projectType = 'software'
}) => {
  const teamFeatures = features.filter(f => f.team === teamName)
  const totalMonths = Math.max(...teamFeatures.map(f => f.startMonth + f.duration), 12)
  
  const months = Array.from({ length: totalMonths }, (_, i) => {
    const date = new Date(startDate)
    date.setMonth(date.getMonth() + i)
    return {
      index: i,
      name: date.toLocaleDateString('en-US', { month: 'short' }),
      year: date.getFullYear()
    }
  })

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

  const getComplexityColor = (complexity?: string) => {
    switch (complexity) {
      case 'high': return 'bg-red-50 text-red-700'
      case 'medium': return 'bg-yellow-50 text-yellow-700'
      case 'low': return 'bg-green-50 text-green-700'
      default: return 'bg-gray-50 text-gray-700'
    }
  }

  const getFeatureTimeline = (feature: RoadmapFeature) => {
    const start = new Date(startDate)
    start.setMonth(start.getMonth() + feature.startMonth)
    const end = new Date(start)
    end.setMonth(end.getMonth() + feature.duration)
    
    return {
      start: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      end: end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  return (
    <div className="bg-white p-8 font-sans" style={{ width: '1400px', minHeight: '1000px' }}>
      {/* Header */}
      <div className="text-center mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{title}</h1>
        <h2 className="text-2xl font-semibold text-blue-700 mb-2">{teamName} Team Track</h2>
        {subtitle && <p className="text-lg text-gray-600 mb-2">{subtitle}</p>}
        <div className="flex justify-center items-center space-x-6 text-sm text-gray-500">
          <span>Generated: {new Date().toLocaleDateString()}</span>
          <span>•</span>
          <span>{teamFeatures.length} Features</span>
          <span>•</span>
          <span>{totalMonths} Months</span>
        </div>
      </div>

      {/* Timeline View */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 flex items-center">
          <Calendar className="w-6 h-6 mr-2" />
          {teamName} Team Timeline
        </h2>
        
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          {/* Month Headers */}
          <div className="flex bg-gray-50 border-b border-gray-200">
            <div className="w-48 p-3 font-semibold text-gray-700 border-r border-gray-200">Feature</div>
            {months.map((month, index) => (
              <div 
                key={index}
                className="flex-1 p-2 text-center text-xs font-medium text-gray-600 border-r border-gray-200 last:border-r-0"
                style={{ minWidth: '60px' }}
              >
                <div>{month.name}</div>
                <div className="text-gray-400">{month.year}</div>
              </div>
            ))}
          </div>

          {/* Feature Rows */}
          {teamFeatures.map((feature) => (
            <div key={feature.id} className="flex border-b border-gray-100 last:border-b-0">
              <div className="w-48 p-3 border-r border-gray-200">
                <div className="font-medium text-sm mb-1">{feature.title}</div>
                <div className="flex space-x-1">
                  <span className={`px-2 py-1 rounded text-xs border ${getPriorityColor(feature.priority)}`}>
                    {feature.priority}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(feature.status)}`}>
                    {feature.status}
                  </span>
                </div>
              </div>
              <div className="flex-1 relative" style={{ height: '60px' }}>
                <div
                  className="absolute top-2 rounded-md shadow-sm flex items-center px-2 py-1 border-2 border-white"
                  style={{
                    left: `${(feature.startMonth / totalMonths) * 100}%`,
                    width: `${(feature.duration / totalMonths) * 100}%`,
                    backgroundColor: feature.priority === 'high' ? '#dc2626' : 
                                   feature.priority === 'medium' ? '#d97706' : '#2563eb',
                    color: 'white',
                    minHeight: '20px',
                    fontSize: '11px'
                  }}
                >
                  <span className="font-medium">{feature.duration}m</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Feature Cards */}
      <div>
        <h2 className="text-2xl font-semibold mb-6 flex items-center">
          <Target className="w-6 h-6 mr-2" />
          Feature Details
        </h2>
        
        <div className="grid grid-cols-1 gap-6">
          {teamFeatures.map((feature) => {
            const timeline = getFeatureTimeline(feature)
            
            return (
              <div key={feature.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm border ${getPriorityColor(feature.priority)}`}>
                        {feature.priority} priority
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(feature.status)}`}>
                        {feature.status}
                      </span>
                      {feature.complexity && (
                        <span className={`px-3 py-1 rounded-full text-sm ${getComplexityColor(feature.complexity)}`}>
                          {feature.complexity} complexity
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <div className="flex items-center mb-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>{timeline.start}</span>
                    </div>
                    <div className="text-gray-500">to {timeline.end}</div>
                    <div className="text-gray-500">{feature.duration} month{feature.duration !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                {feature.description && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                    <p className="text-gray-700 leading-relaxed">{feature.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* User Stories */}
                  {feature.userStories && feature.userStories.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        User Stories ({feature.userStories.length})
                      </h4>
                      <ul className="space-y-1">
                        {feature.userStories.slice(0, 5).map((story, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold mr-2 mt-0.5 flex-shrink-0">
                              {index + 1}
                            </span>
                            <span>{story}</span>
                          </li>
                        ))}
                        {feature.userStories.length > 5 && (
                          <li className="text-sm text-gray-500 italic">
                            ... and {feature.userStories.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Deliverables */}
                  {feature.deliverables && feature.deliverables.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Key Deliverables ({feature.deliverables.length})
                      </h4>
                      <ul className="space-y-1">
                        {feature.deliverables.slice(0, 5).map((deliverable, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-center">
                            <CheckCircle className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
                            <span>{deliverable}</span>
                          </li>
                        ))}
                        {feature.deliverables.length > 5 && (
                          <li className="text-sm text-gray-500 italic">
                            ... and {feature.deliverables.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Success Criteria */}
                  {feature.successCriteria && feature.successCriteria.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                        <Target className="w-4 h-4 mr-1" />
                        Success Criteria
                      </h4>
                      <ul className="space-y-1">
                        {feature.successCriteria.slice(0, 3).map((criteria, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <Target className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{criteria}</span>
                          </li>
                        ))}
                        {feature.successCriteria.length > 3 && (
                          <li className="text-sm text-gray-500 italic">
                            ... and {feature.successCriteria.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Risks */}
                  {feature.risks && feature.risks.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Risk Factors
                      </h4>
                      <ul className="space-y-1">
                        {feature.risks.slice(0, 3).map((risk, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <AlertTriangle className="w-4 h-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{risk}</span>
                          </li>
                        ))}
                        {feature.risks.length > 3 && (
                          <li className="text-sm text-gray-500 italic">
                            ... and {feature.risks.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Related Ideas */}
                {feature.relatedIdeas && feature.relatedIdeas.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <Flag className="w-4 h-4 mr-1" />
                      Related Ideas
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {feature.relatedIdeas.slice(0, 8).map((idea, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs border border-indigo-300"
                        >
                          {idea}
                        </span>
                      ))}
                      {feature.relatedIdeas.length > 8 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          +{feature.relatedIdeas.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>This {teamName} team track was generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p className="mt-1">Project Type: {projectType} • Export Format: Detailed Track View</p>
      </div>
    </div>
  )
}

export default TrackExportView