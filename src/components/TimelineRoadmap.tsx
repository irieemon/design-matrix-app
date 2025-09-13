import React, { useState, useMemo } from 'react'
import { Users, Monitor, Smartphone, TrendingUp, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import FeatureDetailModal from './FeatureDetailModal'

interface RoadmapFeature {
  id: string
  title: string
  description?: string
  startMonth: number // 0-based month index
  duration: number // in months
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

interface TimelineRoadmapProps {
  features: RoadmapFeature[]
  startDate?: Date
  title?: string
  subtitle?: string
}

const TimelineRoadmap: React.FC<TimelineRoadmapProps> = ({
  features,
  startDate = new Date(),
  title = "PRODUCT ROADMAP",
  subtitle = "ENVISION 6.0"
}) => {
  const [currentQuarter, setCurrentQuarter] = useState(0)
  const [selectedFeature, setSelectedFeature] = useState<RoadmapFeature | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleFeatureClick = (feature: RoadmapFeature) => {
    setSelectedFeature(feature)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedFeature(null)
  }
  
  // Define team lanes
  const teamLanes: TeamLane[] = [
    {
      id: 'web',
      name: 'WEB TEAM',
      icon: Monitor,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      id: 'mobile',
      name: 'MOBILE TEAM',
      icon: Smartphone,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'marketing',
      name: 'MARKETING TEAM',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'platform',
      name: 'PLATFORM TEAM',
      icon: Settings,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    }
  ]

  // Generate months starting from startDate
  const generateMonths = (count: number) => {
    const months = []
    const date = new Date(startDate)
    
    for (let i = 0; i < count; i++) {
      const monthDate = new Date(date.getFullYear(), date.getMonth() + i, 1)
      months.push({
        index: i,
        name: monthDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        fullName: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        isCurrentMonth: i === new Date().getMonth() - startDate.getMonth()
      })
    }
    
    return months
  }

  const months = generateMonths(12)
  
  // Group months into quarters
  const quarters = useMemo(() => {
    const quarterGroups = []
    for (let i = 0; i < months.length; i += 3) {
      quarterGroups.push({
        index: i / 3,
        name: `Q${Math.floor(i / 3) + 1}`,
        months: months.slice(i, i + 3)
      })
    }
    return quarterGroups
  }, [months])

  // Get features for a specific team
  const getFeaturesForTeam = (teamId: string) => {
    return features.filter(feature => feature.team === teamId)
  }

  // Get color classes based on priority and status
  const getFeatureStyles = (priority: string, status: string) => {
    let bgColor = 'bg-gray-200'
    let textColor = 'text-gray-700'
    let borderColor = 'border-gray-300'

    if (status === 'completed') {
      bgColor = 'bg-gray-400'
      textColor = 'text-white'
      borderColor = 'border-gray-500'
    } else if (status === 'in-progress') {
      switch (priority) {
        case 'high':
          bgColor = 'bg-red-500'
          textColor = 'text-white'
          borderColor = 'border-red-600'
          break
        case 'medium':
          bgColor = 'bg-yellow-400'
          textColor = 'text-gray-900'
          borderColor = 'border-yellow-500'
          break
        case 'low':
          bgColor = 'bg-blue-400'
          textColor = 'text-white'
          borderColor = 'border-blue-500'
          break
      }
    } else { // planned
      switch (priority) {
        case 'high':
          bgColor = 'bg-red-200'
          textColor = 'text-red-800'
          borderColor = 'border-red-300'
          break
        case 'medium':
          bgColor = 'bg-yellow-200'
          textColor = 'text-yellow-800'
          borderColor = 'border-yellow-300'
          break
        case 'low':
          bgColor = 'bg-blue-200'
          textColor = 'text-blue-800'
          borderColor = 'border-blue-300'
          break
      }
    }

    return { bgColor, textColor, borderColor }
  }

  // Calculate feature position and width
  const getFeaturePosition = (feature: RoadmapFeature) => {
    const monthWidth = 100 / 6 // 6 months visible at once
    const left = (feature.startMonth % 6) * monthWidth
    const width = feature.duration * monthWidth
    
    return {
      left: `${left}%`,
      width: `${Math.min(width, 100 - left)}%`
    }
  }

  // Get visible months for current quarter view
  const getVisibleMonths = () => {
    const start = currentQuarter * 6
    return months.slice(start, start + 6)
  }

  const visibleMonths = getVisibleMonths()

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-wide">{title}</h2>
            <p className="text-slate-300 text-sm">{subtitle}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-slate-700 rounded-full"></div>
                <span className="text-xs text-slate-300">Q1</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                <span className="text-xs text-slate-300">Q2</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Navigation */}
      <div className="bg-slate-50 border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setCurrentQuarter(Math.max(0, currentQuarter - 1))}
            disabled={currentQuarter === 0}
            className="flex items-center space-x-2 px-3 py-1 rounded-md bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">Previous</span>
          </button>
          
          <div className="flex items-center space-x-4">
            {quarters.map((quarter) => (
              <button
                key={quarter.index}
                onClick={() => setCurrentQuarter(quarter.index)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  currentQuarter === quarter.index 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                {quarter.name}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setCurrentQuarter(Math.min(quarters.length - 1, currentQuarter + 1))}
            disabled={currentQuarter >= quarters.length - 1}
            className="flex items-center space-x-2 px-3 py-1 rounded-md bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-sm">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline Header */}
      <div className="bg-white border-b-2 border-gray-200">
        <div className="flex">
          {/* Team column header */}
          <div className="w-48 flex items-center justify-center py-4 bg-gray-50 border-r-2 border-gray-200">
            <Users className="w-5 h-5 text-gray-600 mr-2" />
            <span className="font-semibold text-gray-800">TEAMS</span>
          </div>
          
          {/* Month headers */}
          <div className="flex-1 flex">
            {visibleMonths.map((month) => (
              <div 
                key={month.index}
                className={`flex-1 py-4 text-center border-r border-gray-200 font-semibold ${
                  month.isCurrentMonth 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-50 text-gray-700'
                }`}
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
          
          return (
            <div key={team.id} className="flex min-h-[120px]">
              {/* Team Label */}
              <div className={`w-48 ${team.bgColor} border-r-2 border-gray-200 flex items-center px-4`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 bg-white rounded-lg shadow-sm border ${team.color}`}>
                    <team.icon className={`w-6 h-6 ${team.color}`} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${team.color}`}>{team.name}</h3>
                  </div>
                </div>
              </div>
              
              {/* Feature Timeline */}
              <div className="flex-1 relative py-4">
                {/* Month grid lines */}
                <div className="absolute inset-0 flex">
                  {visibleMonths.map((month) => (
                    <div key={month.index} className="flex-1 border-r border-gray-100"></div>
                  ))}
                </div>
                
                {/* Features */}
                <div className="relative h-full px-2">
                  {teamFeatures
                    .filter(feature => {
                      const featureStart = feature.startMonth
                      const featureEnd = feature.startMonth + feature.duration - 1
                      const viewStart = currentQuarter * 6
                      const viewEnd = viewStart + 5
                      return featureEnd >= viewStart && featureStart <= viewEnd
                    })
                    .map((feature, index) => {
                      const styles = getFeatureStyles(feature.priority, feature.status)
                      const adjustedStartMonth = Math.max(0, feature.startMonth - currentQuarter * 6)
                      const position = getFeaturePosition({
                        ...feature,
                        startMonth: adjustedStartMonth
                      })
                      
                      return (
                        <div
                          key={feature.id}
                          className={`absolute h-8 rounded-lg border-2 ${styles.bgColor} ${styles.textColor} ${styles.borderColor} flex items-center px-3 shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-105 hover:z-10`}
                          style={{
                            ...position,
                            top: `${index * 36 + 10}px`
                          }}
                          title={`Click to view details: ${feature.title}`}
                          onClick={() => handleFeatureClick(feature)}
                        >
                          <span className="text-xs font-semibold truncate">{feature.title}</span>
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

      {/* Feature Detail Modal */}
      <FeatureDetailModal 
        feature={selectedFeature}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        startDate={startDate}
      />
    </div>
  )
}

export default TimelineRoadmap