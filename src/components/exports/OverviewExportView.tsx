import React from 'react'
import { Calendar, Flag, CheckCircle } from 'lucide-react'

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
  const totalMonths = Math.max(...features.map(f => f.startMonth + f.duration), 12)
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
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
    <div className="bg-white p-8 font-sans" style={{ width: '1400px', minHeight: '900px' }}>
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
                        className="absolute top-1 rounded-md border-2 border-white shadow-sm flex items-center px-2 py-1"
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          backgroundColor: feature.priority === 'high' ? '#dc2626' : 
                                         feature.priority === 'medium' ? '#d97706' : '#2563eb',
                          color: 'white',
                          top: `${featureIndex * 18 + 4}px`,
                          minHeight: '16px',
                          fontSize: '10px'
                        }}
                      >
                        <span className="mr-1">{getStatusIcon(feature.status)}</span>
                        <span className="truncate font-medium">{feature.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Features Summary */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <Flag className="w-6 h-6 mr-2" />
            Features by Priority
          </h2>
          <div className="space-y-2">
            {['high', 'medium', 'low'].map(priority => {
              const priorityFeatures = features.filter(f => f.priority === priority)
              return (
                <div key={priority} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full mr-3 ${getPriorityColor(priority)}`}></div>
                    <span className="font-medium capitalize">{priority} Priority</span>
                  </div>
                  <span className="text-gray-600 font-medium">{priorityFeatures.length}</span>
                </div>
              )
            })}
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-3">Team Distribution</h3>
          <div className="space-y-2">
            {teams.map(team => {
              const teamFeatures = features.filter(f => f.team === team)
              return (
                <div key={team} className={`p-3 border rounded-lg ${getTeamColor(team)}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{team}</span>
                    <span className="text-gray-700">{teamFeatures.length} features</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <CheckCircle className="w-6 h-6 mr-2" />
            Progress Overview
          </h2>
          <div className="space-y-2">
            {['completed', 'in-progress', 'planned'].map(status => {
              const statusFeatures = features.filter(f => f.status === status)
              const percentage = Math.round((statusFeatures.length / features.length) * 100)
              return (
                <div key={status} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium capitalize">{status.replace('-', ' ')}</span>
                    <span className="text-gray-600">{statusFeatures.length} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        status === 'completed' ? 'bg-green-500' :
                        status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-3">Key Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">{totalMonths}</div>
              <div className="text-sm text-blue-600">Total Months</div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">{features.length}</div>
              <div className="text-sm text-green-600">Total Features</div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-700">{teams.length}</div>
              <div className="text-sm text-purple-600">Active Teams</div>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-700">
                {Math.round(features.reduce((sum, f) => sum + f.duration, 0) / features.length)}
              </div>
              <div className="text-sm text-orange-600">Avg Duration</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>This roadmap overview was generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p className="mt-1">Project Type: {projectType} • Export Format: Landscape Overview</p>
      </div>
    </div>
  )
}

export default OverviewExportView