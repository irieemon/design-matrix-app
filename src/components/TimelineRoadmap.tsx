import React, { useState, lazy, Suspense } from 'react'
import { Users, Monitor, Smartphone, TrendingUp, Settings, BarChart3, Grid3X3, Plus, Download, Database, Loader } from 'lucide-react'
import FeatureDetailModal from './FeatureDetailModal'
import { sampleMarketingRoadmap, sampleSoftwareRoadmap, sampleEventRoadmap } from '../utils/sampleRoadmapData'

// Lazy load the RoadmapExportModal to reduce bundle size
const RoadmapExportModal = lazy(() => import('./RoadmapExportModal'))

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
  onFeaturesChange?: (features: RoadmapFeature[]) => void
  viewMode?: 'timeline' | 'detailed'
  onViewModeChange?: (mode: 'timeline' | 'detailed') => void
  projectType?: string
}

const TimelineRoadmap: React.FC<TimelineRoadmapProps> = ({
  features: initialFeatures,
  startDate = new Date(),
  title = "PRODUCT ROADMAP",
  subtitle = "ENVISION 6.0",
  onFeaturesChange,
  viewMode = 'timeline',
  onViewModeChange,
  projectType = 'software'
}) => {
  const [selectedFeature, setSelectedFeature] = useState<RoadmapFeature | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [features, setFeatures] = useState<RoadmapFeature[]>(initialFeatures)
  const [draggedFeature, setDraggedFeature] = useState<RoadmapFeature | null>(null)
  const [isResizing, setIsResizing] = useState<string | null>(null)

  // Update features when props change - but preserve user modifications
  React.useEffect(() => {
    // Only update if we don't have any features yet or if the number of features changed significantly
    if (features.length === 0 || Math.abs(features.length - initialFeatures.length) > 2) {
      setFeatures(initialFeatures)
    }
  }, [initialFeatures.length]) // Only depend on length, not the full array

  const handleFeatureClick = (feature: RoadmapFeature) => {
    setSelectedFeature(feature)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedFeature(null)
  }

  const handleSaveFeature = (updatedFeature: RoadmapFeature) => {
    let updatedFeatures: RoadmapFeature[]
    
    // Check if this is a new feature (temp id) or existing
    if (updatedFeature.id.startsWith('temp-')) {
      // Create new feature with real ID
      const newFeature = {
        ...updatedFeature,
        id: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      updatedFeatures = [...features, newFeature]
    } else {
      // Update existing feature
      updatedFeatures = features.map(f => 
        f.id === updatedFeature.id ? updatedFeature : f
      )
    }
    
    setFeatures(updatedFeatures)
    
    if (onFeaturesChange) {
      onFeaturesChange(updatedFeatures)
    }
  }

  const handleDeleteFeature = (featureId: string) => {
    const updatedFeatures = features.filter(f => f.id !== featureId)
    setFeatures(updatedFeatures)
    if (onFeaturesChange) {
      onFeaturesChange(updatedFeatures)
    }
  }

  const handleCreateFeature = () => {
    setSelectedFeature(null) // Create mode with no selected feature
    setIsModalOpen(true)
  }

  const handleLoadSampleData = () => {
    let sampleData: RoadmapFeature[]
    
    console.log('Loading sample data for project type:', projectType)
    
    // Choose sample data based on project type
    switch (projectType) {
      case 'marketing':
        sampleData = sampleMarketingRoadmap
        break
      case 'software':
        sampleData = sampleSoftwareRoadmap
        break
      case 'event':
        sampleData = sampleEventRoadmap
        break
      default:
        sampleData = sampleMarketingRoadmap // Default to marketing for current case
    }
    
    console.log('Sample data to load:', sampleData)
    
    setFeatures(sampleData)
    if (onFeaturesChange) {
      onFeaturesChange(sampleData)
    }
    
    console.log('Sample data loaded, features count:', sampleData.length)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, feature: RoadmapFeature) => {
    setDraggedFeature(feature)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetTeamId: string, targetMonth: number) => {
    e.preventDefault()
    if (!draggedFeature) return

    const updatedFeatures = features.map(feature => 
      feature.id === draggedFeature.id 
        ? { ...feature, team: targetTeamId, startMonth: targetMonth }
        : feature
    )
    
    setFeatures(updatedFeatures)
    onFeaturesChange?.(updatedFeatures)
    setDraggedFeature(null)
  }

  // Resizing handlers
  const handleMouseDown = (e: React.MouseEvent, featureId: string, direction: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(featureId)
    
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new duration based on mouse position
      const feature = features.find(f => f.id === featureId)
      if (!feature) return

      const rect = (e.target as HTMLElement).closest('.timeline-container')?.getBoundingClientRect()
      if (!rect) return

      const monthWidth = rect.width / timelineDuration
      const relativeX = e.clientX - rect.left
      const newMonth = Math.floor(relativeX / monthWidth)
      
      if (direction === 'right') {
        const newDuration = Math.max(1, newMonth - feature.startMonth + 1)
        const updatedFeatures = features.map(f => 
          f.id === featureId ? { ...f, duration: newDuration } : f
        )
        setFeatures(updatedFeatures)
        onFeaturesChange?.(updatedFeatures)
      } else {
        const newStartMonth = Math.max(0, newMonth)
        const newDuration = feature.duration + (feature.startMonth - newStartMonth)
        const updatedFeatures = features.map(f => 
          f.id === featureId ? { ...f, startMonth: newStartMonth, duration: Math.max(1, newDuration) } : f
        )
        setFeatures(updatedFeatures)
        onFeaturesChange?.(updatedFeatures)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
  
  // Generate contextual team lanes based on project type and features
  const getContextualTeamLanes = (): TeamLane[] => {
    const type = projectType.toLowerCase()
    const teamIds = new Set(features.map(f => f.team))
    
    if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
      // Software development teams
      const teams: TeamLane[] = []
      
      if (teamIds.has('platform')) {
        teams.push({
          id: 'platform',
          name: 'PLATFORM TEAM',
          icon: Settings,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        })
      }
      
      if (teamIds.has('web')) {
        teams.push({
          id: 'web',
          name: 'WEB TEAM',
          icon: Monitor,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        })
      }
      
      if (teamIds.has('mobile')) {
        teams.push({
          id: 'mobile',
          name: 'MOBILE TEAM',
          icon: Smartphone,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        })
      }
      
      if (teamIds.has('testing')) {
        teams.push({
          id: 'testing',
          name: 'QA & TESTING',
          icon: BarChart3,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50'
        })
      }
      
      return teams.length > 0 ? teams : [{
        id: 'platform',
        name: 'PLATFORM TEAM',
        icon: Settings,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      }]
      
    } else if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
      // Marketing campaign teams
      const teams: TeamLane[] = []
      
      if (teamIds.has('creative')) {
        teams.push({
          id: 'creative',
          name: 'CREATIVE TEAM',
          icon: Monitor,
          color: 'text-pink-600',
          bgColor: 'bg-pink-50'
        })
      }
      
      if (teamIds.has('digital')) {
        teams.push({
          id: 'digital',
          name: 'DIGITAL MARKETING',
          icon: TrendingUp,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        })
      }
      
      if (teamIds.has('analytics')) {
        teams.push({
          id: 'analytics',
          name: 'ANALYTICS TEAM',
          icon: BarChart3,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        })
      }
      
      if (teamIds.has('operations')) {
        teams.push({
          id: 'operations',
          name: 'OPERATIONS TEAM',
          icon: Settings,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        })
      }
      
      return teams.length > 0 ? teams : [{
        id: 'creative',
        name: 'CREATIVE TEAM',
        icon: Monitor,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50'
      }]
      
    } else if (type.includes('event') || type.includes('conference') || type.includes('meeting')) {
      // Event management teams
      const teams: TeamLane[] = []
      
      if (teamIds.has('planning')) {
        teams.push({
          id: 'planning',
          name: 'PLANNING TEAM',
          icon: Settings,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        })
      }
      
      if (teamIds.has('marketing')) {
        teams.push({
          id: 'marketing',
          name: 'MARKETING TEAM',
          icon: TrendingUp,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50'
        })
      }
      
      if (teamIds.has('operations')) {
        teams.push({
          id: 'operations',
          name: 'OPERATIONS TEAM',
          icon: Monitor,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        })
      }
      
      if (teamIds.has('experience')) {
        teams.push({
          id: 'experience',
          name: 'EXPERIENCE TEAM',
          icon: Users,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        })
      }
      
      return teams.length > 0 ? teams : [{
        id: 'planning',
        name: 'PLANNING TEAM',
        icon: Settings,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      }]
      
    } else {
      // Generic teams based on what's available
      const teams: TeamLane[] = []
      
      // Map common team IDs to display names
      const teamMapping = {
        'planning': { name: 'PLANNING TEAM', icon: Settings, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        'execution': { name: 'EXECUTION TEAM', icon: Monitor, color: 'text-orange-600', bgColor: 'bg-orange-50' },
        'coordination': { name: 'COORDINATION TEAM', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50' },
        'evaluation': { name: 'EVALUATION TEAM', icon: BarChart3, color: 'text-green-600', bgColor: 'bg-green-50' },
        'research': { name: 'RESEARCH TEAM', icon: Monitor, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        'analysis': { name: 'ANALYSIS TEAM', icon: BarChart3, color: 'text-green-600', bgColor: 'bg-green-50' },
        'documentation': { name: 'DOCUMENTATION TEAM', icon: Settings, color: 'text-orange-600', bgColor: 'bg-orange-50' },
        'stakeholder': { name: 'STAKEHOLDER TEAM', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50' },
        'strategy': { name: 'STRATEGY TEAM', icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        'measurement': { name: 'MEASUREMENT TEAM', icon: BarChart3, color: 'text-green-600', bgColor: 'bg-green-50' }
      }
      
      teamIds.forEach(teamId => {
        const teamConfig = teamMapping[teamId as keyof typeof teamMapping]
        if (teamConfig) {
          teams.push({
            id: teamId,
            ...teamConfig
          })
        }
      })
      
      return teams.length > 0 ? teams : [{
        id: 'planning',
        name: 'PLANNING TEAM',
        icon: Settings,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      }]
    }
  }

  const teamLanes = getContextualTeamLanes()
  
  // Debug: Log all features and their teams
  React.useEffect(() => {
    console.log('🎯 All features:', features.map(f => ({ id: f.id, title: f.title, team: f.team })))
    console.log('🏢 Available teams:', teamLanes.map(t => ({ id: t.id, name: t.name })))
  }, [features, teamLanes])
  

  // Calculate smart timeline duration based on features
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

  const timelineDuration = calculateTimelineDuration()
  const months = generateMonths(timelineDuration)
  

  // Get features for a specific team
  const getFeaturesForTeam = (teamId: string) => {
    return features.filter(feature => feature.team === teamId)
  }

  // Calculate non-overlapping row positions for features
  const calculateFeatureRows = (teamFeatures: RoadmapFeature[]) => {
    const rows: { [featureId: string]: number } = {}
    const occupiedRows: { row: number; endMonth: number }[] = []
    
    // Sort features by start month for better positioning
    const sortedFeatures = [...teamFeatures].sort((a, b) => a.startMonth - b.startMonth)
    
    sortedFeatures.forEach(feature => {
      const featureStart = feature.startMonth
      const featureEnd = feature.startMonth + feature.duration - 1
      
      // Find the first available row that doesn't conflict
      let targetRow = 0
      while (true) {
        const conflict = occupiedRows.find(occupied => 
          occupied.row === targetRow && 
          occupied.endMonth >= featureStart
        )
        
        if (!conflict) {
          break
        }
        targetRow++
      }
      
      // Assign the feature to this row
      rows[feature.id] = targetRow
      
      // Mark this row as occupied until the feature ends
      occupiedRows.push({ row: targetRow, endMonth: featureEnd })
      
      // Clean up expired occupations to allow reuse
      occupiedRows.splice(0, occupiedRows.length, ...occupiedRows.filter(o => o.endMonth >= featureStart))
    })
    
    return rows
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
    const monthWidth = 100 / timelineDuration // Use dynamic timeline duration
    const left = feature.startMonth * monthWidth
    const width = feature.duration * monthWidth
    
    return {
      left: `${left}%`,
      width: `${Math.min(width, 100 - left)}%`
    }
  }

  // Get all visible months
  const visibleMonths = months

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden w-full" data-roadmap-export>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-wide">{title}</h2>
            <p className="text-slate-300 text-sm">{subtitle}</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleCreateFeature}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Feature</span>
            </button>
            {features.length === 0 && (
              <button
                onClick={handleLoadSampleData}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors"
              >
                <Database className="w-4 h-4" />
                <span>Load Sample Data</span>
              </button>
            )}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            {onViewModeChange && (
              <div className="flex items-center bg-slate-700/50 rounded-lg border border-slate-600 p-1">
                <button
                  onClick={() => onViewModeChange('timeline')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'timeline'
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Timeline</span>
                </button>
                <button
                  onClick={() => onViewModeChange('detailed')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'detailed'
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                  <span>Detailed</span>
                </button>
              </div>
            )}
          </div>
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
      <div className="divide-y divide-gray-200 min-h-0">
        {teamLanes.map((team) => {
          const teamFeatures = getFeaturesForTeam(team.id)
          const featureRows = calculateFeatureRows(teamFeatures)
          const maxRows = Math.max(1, ...Object.values(featureRows), 0) + 1
          const laneHeight = Math.max(140, maxRows * 40 + 40) // 40px per row + padding
          
          return (
            <div key={team.id} className="flex overflow-hidden" style={{ minHeight: `${laneHeight}px` }}>
              {/* Team Label */}
              <div className={`w-48 ${team.bgColor} border-r-2 border-gray-200 flex items-center px-4 flex-shrink-0`}>
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
              <div 
                className="flex-1 relative py-4 timeline-container overflow-hidden" 
                data-timeline-content
                onDragOver={handleDragOver}
                onDrop={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const relativeX = e.clientX - rect.left
                  const monthWidth = rect.width / timelineDuration
                  const targetMonth = Math.floor(relativeX / monthWidth)
                  handleDrop(e, team.id, targetMonth)
                }}
              >
                {/* Month grid lines */}
                <div className="absolute inset-0 flex">
                  {visibleMonths.map((month) => (
                    <div key={month.index} className="flex-1 border-r border-gray-100"></div>
                  ))}
                </div>
                
                {/* Features */}
                <div className="relative h-full px-2 pt-2">
                  {(() => {
                    const featureRows = calculateFeatureRows(teamFeatures)
                    return teamFeatures.map((feature) => {
                      const styles = getFeatureStyles(feature.priority, feature.status)
                      const position = getFeaturePosition(feature)
                      
                      return (
                        <div
                          key={feature.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, feature)}
                          className={`group absolute h-8 rounded-lg border-2 ${styles.bgColor} ${styles.textColor} ${styles.borderColor} flex items-center shadow-sm hover:shadow-md transition-all cursor-move hover:scale-105 hover:z-10 ${draggedFeature?.id === feature.id ? 'opacity-50' : ''} ${isResizing === feature.id ? 'ring-2 ring-blue-400 scale-105' : ''}`}
                          style={{
                            ...position,
                            top: `${(featureRows[feature.id] || 0) * 36 + 16}px`
                          }}
                          title={`Drag to move, resize handles on hover: ${feature.title}`}
                        >
                          {/* Left resize handle */}
                          <div
                            className="absolute left-0 top-0 w-2 h-full bg-transparent hover:bg-blue-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseDown={(e) => handleMouseDown(e, feature.id, 'left')}
                            title="Drag to resize start date"
                          />
                          
                          {/* Task content */}
                          <div 
                            className="flex-1 px-3 py-1 truncate"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleFeatureClick(feature)
                            }}
                          >
                            <span className="text-xs font-semibold">
                              {feature.title}
                            </span>
                          </div>
                          
                          {/* Right resize handle */}
                          <div
                            className="absolute right-0 top-0 w-2 h-full bg-transparent hover:bg-blue-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseDown={(e) => handleMouseDown(e, feature.id, 'right')}
                            title="Drag to resize duration"
                          />
                        </div>
                      )
                    })
                  })()}
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
        onSave={handleSaveFeature}
        onDelete={handleDeleteFeature}
        startDate={startDate}
        mode={selectedFeature ? 'edit' : 'create'}
        availableTeams={teamLanes.map(team => team.id)}
        projectType={projectType}
      />

      {/* Export Modal - Lazy loaded only when needed */}
      {isExportModalOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
              <Loader className="w-5 h-5 animate-spin text-purple-600" />
              <span className="text-slate-700">Loading export tools...</span>
            </div>
          </div>
        }>
          <RoadmapExportModal 
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            features={features}
            title={title}
            subtitle={subtitle}
            startDate={startDate}
            projectType={projectType}
          />
        </Suspense>
      )}
    </div>
  )
}

export default TimelineRoadmap