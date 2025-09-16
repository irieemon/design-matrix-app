import React from 'react'
import { Calendar, Flag, CheckCircle, Users, Target, AlertTriangle } from 'lucide-react'

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

interface OverviewExportViewProps {
  features: RoadmapFeature[]
  title: string
  subtitle?: string
  startDate?: Date
  projectType?: string
}

const OverviewExportView: React.FC<OverviewExportViewProps> = ({
  features,
  title,
  subtitle,
  startDate = new Date(),
  projectType = 'software'
}) => {
  // Smart timeline duration calculation (same as calendar view)
  const calculateTimelineDuration = () => {
    if (features.length === 0) {
      return 6 // Default to 6 months when no features
    }
    
    // Find the latest end date among all features
    const latestEndMonth = Math.max(
      ...features.map(feature => feature.startMonth + feature.duration)
    )
    
    // Add 2 months buffer as requested
    const timelineLength = latestEndMonth + 2
    
    // Cap at 12 months maximum (1 year)
    return Math.min(timelineLength, 12)
  }
  
  const totalMonths = calculateTimelineDuration()
  const months = Array.from({ length: totalMonths }, (_, i) => {
    const date = new Date(startDate)
    date.setMonth(date.getMonth() + i)
    return {
      index: i,
      name: date.toLocaleDateString('en-US', { month: 'short' }),
      year: date.getFullYear()
    }
  })

  const teams = [...new Set(features.map(f => f.team))].sort()
  
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

  const getTeamColor = (team: string) => {
    const colors = {
      'web': 'bg-orange-100 border-orange-300',
      'mobile': 'bg-blue-100 border-blue-300',
      'marketing': 'bg-purple-100 border-purple-300',
      'platform': 'bg-green-100 border-green-300',
      'design': 'bg-pink-100 border-pink-300',
      'data': 'bg-indigo-100 border-indigo-300'
    }
    return colors[team.toLowerCase() as keyof typeof colors] || 'bg-gray-100 border-gray-300'
  }


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓'
      case 'in-progress': return '▶'
      case 'planned': return '○'
      default: return '○'
    }
  }

  return (
    <div className="bg-white font-sans">
      {/* PAGE 1: Timeline Overview */}
      <div id="overview-page-1" className="export-page" style={{ width: '1400px', minHeight: '1000px', padding: '40px', pageBreakAfter: 'always' }}>
        {/* Header */}
        <div className="text-center mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{title}</h1>
          {subtitle && <p className="text-xl text-gray-600 mb-2">{subtitle}</p>}
          <div className="flex justify-center items-center space-x-6 text-sm text-gray-500">
            <span>Generated: {new Date().toLocaleDateString()}</span>
            <span>•</span>
            <span>{features.length} Features</span>
            <span>•</span>
            <span>{teams.length} Teams</span>
            <span>•</span>
            <span>{totalMonths} Months</span>
          </div>
        </div>

        {/* Timeline View */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <Calendar className="w-6 h-6 mr-2" />
            Timeline Overview
          </h2>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Month Headers */}
            <div className="flex bg-gray-50 border-b border-gray-200">
              <div className="w-32 p-3 font-semibold text-gray-700 border-r border-gray-200">Team</div>
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

            {/* Team Rows */}
            {teams.map((team) => {
              const teamFeatures = features.filter(f => f.team === team)
              return (
                <div key={team} className="flex border-b border-gray-100 last:border-b-0">
                  <div className={`w-32 p-3 font-medium border-r border-gray-200 ${getTeamColor(team)}`}>
                    {team}
                  </div>
                  <div className="flex-1 relative" style={{ height: '60px' }}>
                    {teamFeatures.map((feature, featureIndex) => {
                      const leftPercent = (feature.startMonth / totalMonths) * 100
                      const widthPercent = (feature.duration / totalMonths) * 100
                      
                      return (
                        <div
                          key={feature.id}
                          style={{
                            position: 'absolute',
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            top: `${featureIndex * 18 + 4}px`,
                            minHeight: '16px',
                            fontSize: '10px',
                            backgroundColor: feature.priority === 'high' ? '#dc2626' : 
                                           feature.priority === 'medium' ? '#d97706' : '#2563eb',
                            color: 'white',
                            borderRadius: '6px',
                            border: '2px solid white',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px 8px'
                          }}
                        >
                          <span style={{ marginRight: '4px' }}>{getStatusIcon(feature.status)}</span>
                          <span style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            fontWeight: '500'
                          }}>{feature.title}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* PAGE 2: Executive Summary */}
      <div id="overview-page-2" className="export-page" style={{ width: '1400px', minHeight: '1000px', padding: '40px', pageBreakAfter: 'always' }}>
        {/* Page Header */}
        <div className="text-center mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-lg text-gray-600 mt-2">Executive Summary</p>
        </div>

        {/* Executive Summary */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6 flex items-center">
            <Flag className="w-6 h-6 mr-2" />
            Project Overview
          </h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="font-medium">Total Features:</span>
                  <span className="font-bold">{features.length}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="font-medium">Active Teams:</span>
                  <span className="font-bold">{teams.length}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="font-medium">Project Duration:</span>
                  <span className="font-bold">{totalMonths} months</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Avg Feature Duration:</span>
                  <span className="font-bold">{Math.round(features.reduce((sum, f) => sum + f.duration, 0) / features.length)} months</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
              <div className="space-y-3">
                {['completed', 'in-progress', 'planned'].map(status => {
                  const statusFeatures = features.filter(f => f.status === status)
                  const percentage = Math.round((statusFeatures.length / features.length) * 100)
                  return (
                    <div key={status} className="border-b border-gray-100 pb-2">
                      <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="font-medium capitalize">{status.replace('-', ' ')}:</span>
                        <span className="font-bold">{statusFeatures.length} ({percentage}%)</span>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        backgroundColor: '#e5e7eb', 
                        borderRadius: '4px', 
                        height: '6px' 
                      }}>
                        <div 
                          style={{ 
                            height: '6px', 
                            borderRadius: '4px',
                            width: `${percentage}%`,
                            backgroundColor: status === 'completed' ? '#10b981' :
                                           status === 'in-progress' ? '#3b82f6' : '#9ca3af'
                          }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Team Breakdown */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Team Distribution</h3>
          <div className="grid grid-cols-2 gap-4">
            {teams.map(team => {
              const teamFeatures = features.filter(f => f.team === team)
              const teamPercentage = Math.round((teamFeatures.length / features.length) * 100)
              return (
                <div key={team} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium capitalize">{team} Team</span>
                    <span className="text-sm font-bold">{teamFeatures.length} features ({teamPercentage}%)</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    Priority breakdown: {' '}
                    High: {teamFeatures.filter(f => f.priority === 'high').length}, {' '}
                    Medium: {teamFeatures.filter(f => f.priority === 'medium').length}, {' '}
                    Low: {teamFeatures.filter(f => f.priority === 'low').length}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* PAGE 3+: Detailed Features Section */}
      <div id="overview-page-3" className="export-page" style={{ width: '1400px', padding: '40px' }}>
        {/* Page Header */}
        <div className="text-center mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-lg text-gray-600 mt-2">Feature Details</p>
        </div>

        <h2 className="text-2xl font-semibold mb-6 flex items-center">
          <Target className="w-6 h-6 mr-2" />
          Detailed Feature Breakdown
        </h2>
        
        <div className="space-y-12">
          {features.map((feature, index) => {
            const timeline = getFeatureTimeline(feature)
            
            return (
              <div key={feature.id} className={index === 0 ? "feature-page-start" : "feature-page export-page"} style={index > 0 ? { width: '1400px', padding: '40px', pageBreakBefore: 'always' } : {}}>
                {index > 0 && (
                  <div className="text-center mb-8 border-b border-gray-200 pb-6">
                    <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                    <p className="text-lg text-gray-600 mt-2">Feature Details (continued)</p>
                  </div>
                )}
                
                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                      <div className="flex items-center space-x-3 mb-2">
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '16px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: feature.priority === 'high' ? '#fef2f2' : 
                                         feature.priority === 'medium' ? '#fffbeb' : '#eff6ff',
                          color: feature.priority === 'high' ? '#991b1b' : 
                                 feature.priority === 'medium' ? '#92400e' : '#1e40af',
                          border: feature.priority === 'high' ? '1px solid #fecaca' : 
                                  feature.priority === 'medium' ? '1px solid #fed7aa' : '1px solid #dbeafe'
                        }}>
                          {feature.priority} priority
                        </span>
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '16px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: feature.status === 'completed' ? '#f0fdf4' : 
                                         feature.status === 'in-progress' ? '#eff6ff' : '#f9fafb',
                          color: feature.status === 'completed' ? '#166534' : 
                                 feature.status === 'in-progress' ? '#1e40af' : '#374151',
                          border: feature.status === 'completed' ? '1px solid #bbf7d0' : 
                                  feature.status === 'in-progress' ? '1px solid #dbeafe' : '1px solid #e5e7eb'
                        }}>
                          {feature.status}
                        </span>
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '16px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db'
                        }}>
                          {feature.team} team
                        </span>
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
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                      <p className="text-gray-700 leading-relaxed">{feature.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* User Stories */}
                    {feature.userStories && feature.userStories.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          User Stories ({feature.userStories.length})
                        </h4>
                        <ul className="space-y-2">
                          {feature.userStories.map((story, index) => (
                            <li key={index} className="text-sm text-gray-700 flex items-start">
                              <span style={{ 
                                width: '20px', 
                                height: '20px', 
                                backgroundColor: '#dcfce7', 
                                color: '#166534', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '10px', 
                                fontWeight: 'bold', 
                                marginRight: '8px', 
                                marginTop: '2px', 
                                flexShrink: 0 
                              }}>
                                {index + 1}
                              </span>
                              <span>{story}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Deliverables */}
                    {feature.deliverables && feature.deliverables.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Key Deliverables ({feature.deliverables.length})
                        </h4>
                        <ul className="space-y-2">
                          {feature.deliverables.map((deliverable, index) => (
                            <li key={index} className="text-sm text-gray-700 flex items-center">
                              <CheckCircle className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
                              <span>{deliverable}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Success Criteria */}
                    {feature.successCriteria && feature.successCriteria.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                          <Target className="w-4 h-4 mr-1" />
                          Success Criteria
                        </h4>
                        <ul className="space-y-2">
                          {feature.successCriteria.map((criteria, index) => (
                            <li key={index} className="text-sm text-gray-700 flex items-start">
                              <Target className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                              <span>{criteria}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Risks */}
                    {feature.risks && feature.risks.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          Risk Factors
                        </h4>
                        <ul className="space-y-2">
                          {feature.risks.map((risk, index) => (
                            <li key={index} className="text-sm text-gray-700 flex items-start">
                              <AlertTriangle className="w-4 h-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Related Ideas */}
                  {feature.relatedIdeas && feature.relatedIdeas.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <Flag className="w-4 h-4 mr-1" />
                        Related Ideas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {feature.relatedIdeas.map((idea, index) => (
                          <span
                            key={index}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#eef2ff',
                              color: '#3730a3',
                              borderRadius: '16px',
                              fontSize: '12px',
                              border: '1px solid #c7d2fe'
                            }}
                          >
                            {idea}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>This comprehensive roadmap was generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p className="mt-1">Project Type: {projectType} • Export Format: Comprehensive Overview</p>
      </div>
    </div>
  )
}

export default OverviewExportView