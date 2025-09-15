import React from 'react'
import { Users, Monitor, Smartphone, TrendingUp, Settings, BarChart3 } from 'lucide-react'

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

interface TeamLane {
  id: string
  name: string
  icon: React.ComponentType<any>
  color: string
  bgColor: string
}

interface DetailedExportViewProps {
  features: RoadmapFeature[]
  title: string
  subtitle?: string
  startDate?: Date
  projectType?: string
}

const DetailedExportView: React.FC<DetailedExportViewProps> = ({
  features,
  title,
  subtitle,
  startDate = new Date(),
  projectType = 'software'
}) => {
  console.log('🏁 DetailedExportView component started with:', { featuresLength: features.length, title, projectType })
  // Generate contextual team lanes based on project type and features
  const getContextualTeamLanes = (): TeamLane[] => {
    const type = projectType.toLowerCase()
    const teamIds = new Set(features.map(f => f.team))
    
    if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
      const teams: TeamLane[] = []
      
      if (teamIds.has('platform')) {
        teams.push({ id: 'platform', name: 'PLATFORM TEAM', icon: Settings, color: 'text-green-600', bgColor: 'bg-green-50' })
      }
      if (teamIds.has('web')) {
        teams.push({ id: 'web', name: 'WEB TEAM', icon: Monitor, color: 'text-orange-600', bgColor: 'bg-orange-50' })
      }
      if (teamIds.has('mobile')) {
        teams.push({ id: 'mobile', name: 'MOBILE TEAM', icon: Smartphone, color: 'text-blue-600', bgColor: 'bg-blue-50' })
      }
      if (teamIds.has('testing')) {
        teams.push({ id: 'testing', name: 'QA & TESTING', icon: BarChart3, color: 'text-purple-600', bgColor: 'bg-purple-50' })
      }
      
      return teams.length > 0 ? teams : [{
        id: 'platform', name: 'PLATFORM TEAM', icon: Settings, color: 'text-green-600', bgColor: 'bg-green-50'
      }]
      
    } else if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
      const teams: TeamLane[] = []
      
      if (teamIds.has('creative')) {
        teams.push({ id: 'creative', name: 'CREATIVE TEAM', icon: Monitor, color: 'text-pink-600', bgColor: 'bg-pink-50' })
      }
      if (teamIds.has('digital')) {
        teams.push({ id: 'digital', name: 'DIGITAL MARKETING', icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50' })
      }
      if (teamIds.has('analytics')) {
        teams.push({ id: 'analytics', name: 'ANALYTICS TEAM', icon: BarChart3, color: 'text-green-600', bgColor: 'bg-green-50' })
      }
      if (teamIds.has('operations')) {
        teams.push({ id: 'operations', name: 'OPERATIONS TEAM', icon: Settings, color: 'text-orange-600', bgColor: 'bg-orange-50' })
      }
      
      return teams.length > 0 ? teams : [{
        id: 'creative', name: 'CREATIVE TEAM', icon: Monitor, color: 'text-pink-600', bgColor: 'bg-pink-50'
      }]
      
    } else {
      // Generic teams based on available team IDs
      const teams: TeamLane[] = []
      const teamMapping = {
        'planning': { name: 'PLANNING TEAM', icon: Settings, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        'execution': { name: 'EXECUTION TEAM', icon: Monitor, color: 'text-orange-600', bgColor: 'bg-orange-50' },
        'operations': { name: 'OPERATIONS TEAM', icon: Settings, color: 'text-orange-600', bgColor: 'bg-orange-50' }
      }
      
      teamIds.forEach(teamId => {
        const teamConfig = teamMapping[teamId as keyof typeof teamMapping]
        if (teamConfig) {
          teams.push({ id: teamId, ...teamConfig })
        }
      })
      
      return teams.length > 0 ? teams : [{
        id: 'planning', name: 'PLANNING TEAM', icon: Settings, color: 'text-blue-600', bgColor: 'bg-blue-50'
      }]
    }
  }

  const teamLanes = getContextualTeamLanes()

  // Debug logging
  console.log('🔧 DetailedExportView Debug:', {
    featuresCount: features.length,
    teamLanesCount: teamLanes.length,
    projectType,
    teamLanes: teamLanes.map(t => ({ id: t.id, name: t.name })),
    features: features.map(f => ({ 
      id: f.id, 
      title: f.title, 
      team: f.team, 
      startMonth: f.startMonth, 
      duration: f.duration,
      allFields: Object.keys(f) 
    })),
    firstFeatureAllFields: Object.keys(features[0] || {})
  })

  // Generate months starting from startDate
  const generateMonths = (count: number) => {
    const months = []
    const date = new Date(startDate)
    
    for (let i = 0; i < count; i++) {
      const monthDate = new Date(date.getFullYear(), date.getMonth() + i, 1)
      months.push({
        index: i,
        name: monthDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        fullName: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      })
    }
    
    return months
  }

  const months = generateMonths(12)

  // Get features for a specific team
  const getFeaturesForTeam = (teamId: string) => {
    return features.filter(feature => feature.team === teamId)
  }

  // Calculate non-overlapping row positions for features
  const calculateFeatureRows = (teamFeatures: RoadmapFeature[]) => {
    const rows: { [featureId: string]: number } = {}
    const occupiedRows: { row: number; endMonth: number }[] = []
    
    const sortedFeatures = [...teamFeatures].sort((a, b) => a.startMonth - b.startMonth)
    
    sortedFeatures.forEach(feature => {
      const featureStart = feature.startMonth
      const featureEnd = feature.startMonth + feature.duration - 1
      
      let targetRow = 0
      while (true) {
        const conflict = occupiedRows.find(occupied => 
          occupied.row === targetRow && occupied.endMonth >= featureStart
        )
        
        if (!conflict) break
        targetRow++
      }
      
      rows[feature.id] = targetRow
      occupiedRows.push({ row: targetRow, endMonth: featureEnd })
      occupiedRows.splice(0, occupiedRows.length, ...occupiedRows.filter(o => o.endMonth >= featureStart))
    })
    
    return rows
  }

  // Get color classes based on priority and status - with fallbacks for AI-generated features
  const getFeatureStyles = (priority: string, status: string) => {
    // Default to visible colors that will always work
    let bgColor = 'bg-blue-500'
    let textColor = 'text-white'
    let borderColor = 'border-blue-600'

    // Safe priority/status handling with fallbacks
    const safePriority = priority || 'medium'
    const safeStatus = status || 'planned'

    if (safeStatus === 'completed') {
      bgColor = 'bg-green-500'
      textColor = 'text-white'
      borderColor = 'border-green-600'
    } else if (safeStatus === 'in-progress') {
      switch (safePriority) {
        case 'high':
          bgColor = 'bg-red-500'
          textColor = 'text-white'
          borderColor = 'border-red-600'
          break
        case 'medium':
          bgColor = 'bg-orange-500'
          textColor = 'text-white'
          borderColor = 'border-orange-600'
          break
        case 'low':
          bgColor = 'bg-blue-500'
          textColor = 'text-white'
          borderColor = 'border-blue-600'
          break
        default:
          bgColor = 'bg-purple-500'
          textColor = 'text-white'
          borderColor = 'border-purple-600'
      }
    } else { // planned or unknown
      switch (safePriority) {
        case 'high':
          bgColor = 'bg-red-400'
          textColor = 'text-white'
          borderColor = 'border-red-500'
          break
        case 'medium':
          bgColor = 'bg-yellow-500'
          textColor = 'text-white'
          borderColor = 'border-yellow-600'
          break
        case 'low':
          bgColor = 'bg-blue-400'
          textColor = 'text-white'
          borderColor = 'border-blue-500'
          break
        default:
          bgColor = 'bg-gray-500'
          textColor = 'text-white'
          borderColor = 'border-gray-600'
      }
    }

    return { bgColor, textColor, borderColor }
  }

  return (
    <div className="bg-white font-sans" style={{ width: '1400px', minHeight: '1000px' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-8 py-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-wide mb-2">{title}</h1>
          {subtitle && <p className="text-slate-300 text-lg">{subtitle}</p>}
          <div className="mt-4 text-sm text-slate-300">
            <span>Generated: {new Date().toLocaleDateString()}</span>
            <span className="mx-2">•</span>
            <span>{features.length} Features</span>
            <span className="mx-2">•</span>
            <span>{teamLanes.length} Teams</span>
          </div>
        </div>
      </div>

      {/* Timeline Header */}
      <div className="bg-white border-b-2 border-gray-200">
        <div className="flex">
          <div className="w-48 flex items-center justify-center py-4 bg-gray-50 border-r-2 border-gray-200">
            <Users className="w-5 h-5 text-gray-600 mr-2" />
            <span className="font-semibold text-gray-800">TEAMS</span>
          </div>
          
          <div className="flex-1 flex">
            {months.slice(0, 12).map((month) => (
              <div 
                key={month.index}
                className="flex-1 py-4 text-center border-r border-gray-200 font-semibold bg-gray-50 text-gray-700"
              >
                {month.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Swim Lanes */}
      <div className="divide-y divide-gray-200">
        {teamLanes.map((team) => {
          const teamFeatures = getFeaturesForTeam(team.id)
          const featureRows = calculateFeatureRows(teamFeatures)
          const maxRows = Math.max(1, ...Object.values(featureRows), 0) + 1
          const laneHeight = Math.max(140, maxRows * 40 + 40)
          
          console.log(`🔍 Team ${team.id} (${team.name}):`, {
            teamFeatures: teamFeatures.map(f => ({ id: f.id, title: f.title, startMonth: f.startMonth, duration: f.duration })),
            featureRows,
            maxRows,
            laneHeight
          })
          
          return (
            <div key={team.id} className="flex" style={{ minHeight: `${laneHeight}px` }}>
              <div className={`w-48 ${team.bgColor} border-r-2 border-gray-200 flex items-center px-4`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 bg-white rounded-lg shadow-sm border ${team.color}`}>
                    <team.icon className={`w-6 h-6 ${team.color}`} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${team.color}`}>{team.name}</h3>
                    <div className="text-xs text-gray-600">{teamFeatures.length} features</div>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 relative py-4">
                {/* Month grid lines */}
                <div className="absolute inset-0 flex">
                  {months.slice(0, 12).map((month) => (
                    <div key={month.index} className="flex-1 border-r border-gray-100"></div>
                  ))}
                </div>
                
                {/* Features */}
                <div className="relative h-full px-2 pt-2">
                  {teamFeatures.map((feature) => {
                    const styles = getFeatureStyles(feature.priority || 'medium', feature.status || 'planned')
                    const monthWidth = 100 / 12
                    const left = feature.startMonth * monthWidth
                    const width = feature.duration * monthWidth
                    
                    console.log(`📍 Rendering feature ${feature.id} (${feature.title}):`, {
                      startMonth: feature.startMonth,
                      duration: feature.duration,
                      left: `${left}%`,
                      width: `${Math.min(width, 100 - left)}%`,
                      top: `${(featureRows[feature.id] || 0) * 36 + 16}px`,
                      priority: feature.priority,
                      status: feature.status,
                      styles
                    })
                    
                    return (
                      <div
                        key={feature.id}
                        className={`absolute h-8 rounded-lg border-2 ${styles.bgColor} ${styles.textColor} ${styles.borderColor} flex items-center shadow-sm`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.min(width, 100 - left)}%`,
                          top: `${(featureRows[feature.id] || 0) * 36 + 16}px`
                        }}
                      >
                        <div className="flex-1 px-3 py-1 truncate">
                          <span className="text-xs font-semibold">{feature.title}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <span className="font-medium text-gray-700">STATUS:</span>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-gray-200 rounded"></div>
              <span className="text-gray-600">Planned</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-400 rounded"></div>
              <span className="text-gray-600">In Progress</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-gray-400 rounded"></div>
              <span className="text-gray-600">Completed</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="font-medium text-gray-700">PRIORITY:</span>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-400 rounded"></div>
              <span className="text-gray-600">High</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-400 rounded"></div>
              <span className="text-gray-600">Medium</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-400 rounded"></div>
              <span className="text-gray-600">Low</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t border-gray-200 text-sm text-gray-500">
        <p>This roadmap was generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p className="mt-1">Project Type: {projectType} • Export Format: Detailed Timeline View</p>
      </div>
    </div>
  )
}

export default DetailedExportView