import React, { useState, lazy, Suspense, useMemo } from 'react'
import { useAsyncOperation } from '../hooks/shared/useAsyncOperation'
import { Users, Monitor, Smartphone, TrendingUp, Settings, BarChart3, Plus, Database, Loader, Grid3X3, Map } from 'lucide-react'
import FeatureDetailModal from './FeatureDetailModal'
import { sampleMarketingRoadmap, sampleSoftwareRoadmap, sampleEventRoadmap } from '../utils/sampleRoadmapData'
import { useLogger } from '../lib/logging'
import { Button } from './ui/Button'

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
  projectType?: string
  viewMode?: 'timeline' | 'detailed'
  onViewModeChange?: (mode: 'timeline' | 'detailed') => void
}

const TimelineRoadmap: React.FC<TimelineRoadmapProps> = ({
  features: initialFeatures,
  startDate = new Date(),
  title = "PRODUCT ROADMAP",
  subtitle = "ENVISION 6.0",
  onFeaturesChange,
  projectType = 'software',
  viewMode = 'timeline',
  onViewModeChange
}) => {
  // Create scoped logger for this component
  const logger = useLogger('TimelineRoadmap')

  // Modal state management with useAsyncOperation
  const modalOperation = useAsyncOperation(
    async (feature?: RoadmapFeature | null) => {
      return { selectedFeature: feature || null, isOpen: !!feature }
    }
  )

  // Features management with useAsyncOperation
  const featuresOperation = useAsyncOperation(
    async (newFeatures: RoadmapFeature[]) => {
      if (onFeaturesChange) {
        onFeaturesChange(newFeatures)
      }
      return newFeatures
    }
  )

  // Initialize features on mount
  React.useEffect(() => {
    if (initialFeatures.length > 0 && !featuresOperation.state.data) {
      featuresOperation.execute(initialFeatures)
    }
  }, [])

  // Simple UI interaction states remain as useState
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [draggedFeature, setDraggedFeature] = useState<RoadmapFeature | null>(null)
  const [isResizing, setIsResizing] = useState<string | null>(null)

  // Update features when props change - but preserve user modifications
  React.useEffect(() => {
    // Only update features if:
    // 1. It's the initial load (features array is empty)
    // 2. The number of features has changed (features added/removed)
    // 3. User is not currently interacting (not resizing or dragging)
    const currentFeatures = featuresOperation.state.data || []
    const shouldUpdate = !isResizing && !draggedFeature && (
      currentFeatures.length === 0 ||
      currentFeatures.length !== initialFeatures.length ||
      !currentFeatures.every(f => initialFeatures.some(inf => inf.id === f.id))
    )

    if (shouldUpdate) {
      featuresOperation.execute(initialFeatures)
    }
  }, [initialFeatures, isResizing, draggedFeature, featuresOperation.state.data?.length])

  const handleFeatureClick = (feature: RoadmapFeature) => {
    modalOperation.execute(feature)
  }

  const handleCloseModal = () => {
    modalOperation.execute(null)
  }

  const handleSaveFeature = (updatedFeature: RoadmapFeature) => {
    const currentFeatures = featuresOperation.state.data || []
    let updatedFeatures: RoadmapFeature[]

    // Check if this is a new feature (temp id) or existing
    if (updatedFeature.id.startsWith('temp-')) {
      // Create new feature with real ID
      const newFeature = {
        ...updatedFeature,
        id: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      updatedFeatures = [...currentFeatures, newFeature]
    } else {
      // Update existing feature
      updatedFeatures = currentFeatures.map((f: RoadmapFeature) =>
        f.id === updatedFeature.id ? updatedFeature : f
      )
    }

    featuresOperation.execute(updatedFeatures)
  }

  const handleDeleteFeature = (featureId: string) => {
    const currentFeatures = featuresOperation.state.data || []
    const updatedFeatures = currentFeatures.filter((f: RoadmapFeature) => f.id !== featureId)
    featuresOperation.execute(updatedFeatures)
  }

  const handleCreateFeature = () => {
    modalOperation.execute(null) // Create mode with no selected feature
  }

  const handleLoadSampleData = () => {
    let sampleData: RoadmapFeature[]

    logger.debug('Loading sample data', { projectType })

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

    logger.debug('Sample data selected', {
      projectType,
      featureCount: sampleData.length,
      sampleType: projectType
    })

    featuresOperation.execute(sampleData)

    logger.info('Sample data loaded successfully', {
      featureCount: sampleData.length,
      projectType
    })
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

    const currentFeatures = featuresOperation.state.data || []
    const updatedFeatures = currentFeatures.map((feature: RoadmapFeature) =>
      feature.id === draggedFeature.id
        ? { ...feature, team: targetTeamId, startMonth: targetMonth }
        : feature
    )

    featuresOperation.execute(updatedFeatures)
    setDraggedFeature(null)
  }

  // Resizing handlers
  const handleMouseDown = (e: React.MouseEvent, featureId: string, direction: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(featureId)
    
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new duration based on mouse position
      const currentFeatures = featuresOperation.state.data || []
      const feature = currentFeatures.find(f => f.id === featureId)
      if (!feature) return

      const rect = (e.target as HTMLElement).closest('.timeline-container')?.getBoundingClientRect()
      if (!rect) return

      const monthWidth = rect.width / timelineDuration
      const relativeX = e.clientX - rect.left
      const newMonth = Math.floor(relativeX / monthWidth)
      
      if (direction === 'right') {
        const newDuration = Math.max(1, newMonth - feature.startMonth + 1)
        const updatedFeatures = currentFeatures.map((f: RoadmapFeature) =>
          f.id === featureId ? { ...f, duration: newDuration } : f
        )
        featuresOperation.execute(updatedFeatures)
      } else {
        const newStartMonth = Math.max(0, newMonth)
        const newDuration = feature.duration + (feature.startMonth - newStartMonth)
        const updatedFeatures = currentFeatures.map((f: RoadmapFeature) =>
          f.id === featureId ? { ...f, startMonth: newStartMonth, duration: Math.max(1, newDuration) } : f
        )
        featuresOperation.execute(updatedFeatures)
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
    const currentFeatures = featuresOperation.state.data || []
    const teamIds = new Set<string>(currentFeatures.map((f: RoadmapFeature) => f.team))
    
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
      
      teamIds.forEach((teamId: string) => {
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

  // Memoize teamLanes to prevent infinite render loops
  const teamLanes = useMemo(() => {
    return getContextualTeamLanes()
  }, [projectType, featuresOperation.state.data])

  // Memoize availableTeams for FeatureDetailModal to prevent infinite render loops
  const availableTeams = useMemo(() => {
    return teamLanes.map(team => team.id)
  }, [teamLanes])

  // Debug: Log all features and their teams
  React.useEffect(() => {
    const currentFeatures = featuresOperation.state.data || []
    logger.debug('Features and teams state', {
      featureCount: currentFeatures.length,
      features: currentFeatures.map((f: RoadmapFeature) => ({ id: f.id, title: f.title, team: f.team })),
      teamCount: teamLanes.length,
      teams: teamLanes.map(t => ({ id: t.id, name: t.name }))
    })
  }, [featuresOperation.state.data, teamLanes])
  

  // Calculate smart timeline duration based on features
  const calculateTimelineDuration = () => {
    const currentFeatures = featuresOperation.state.data || []
    if (currentFeatures.length === 0) {
      return 6 // Default to 6 months when no features
    }

    // Find the latest end date among all features
    const latestEndMonth = Math.max(
      ...currentFeatures.map((feature: RoadmapFeature) => feature.startMonth + feature.duration)
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
    const currentFeatures = featuresOperation.state.data || []
    return currentFeatures.filter((feature: RoadmapFeature) => feature.team === teamId)
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden w-full" data-roadmap-export>
      {/* Timeline Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-wide">{title}</h2>
            <p className="text-slate-300 text-sm mt-1">{subtitle}</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* View Mode Toggle */}
            {onViewModeChange && (
              <div className="flex space-x-1 bg-slate-700/50 rounded-lg p-1 border border-slate-600">
                <Button
                  onClick={() => onViewModeChange('timeline')}
                  variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Grid3X3 className="w-4 h-4" />
                  <span>Timeline</span>
                </Button>
                <Button
                  onClick={() => onViewModeChange('detailed')}
                  variant={viewMode === 'detailed' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Map className="w-4 h-4" />
                  <span>Detailed</span>
                </Button>
              </div>
            )}

            <Button
              onClick={handleCreateFeature}
              variant="primary"
              size="md"
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Feature</span>
            </Button>
            {(featuresOperation.state.data?.length === 0) && (
              <Button
                onClick={handleLoadSampleData}
                variant="primary"
                size="md"
                className="flex items-center space-x-2"
              >
                <Database className="w-4 h-4" />
                <span>Load Sample Data</span>
              </Button>
            )}
          </div>
        </div>
      </div>


      {/* Timeline Grid Header */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="flex">
          {/* Team column header */}
          <div className="w-48 flex items-center justify-center py-4 bg-slate-100 border-r border-slate-200">
            <Users className="w-5 h-5 text-slate-600 mr-2" />
            <span className="font-semibold text-slate-800 text-sm tracking-wide">TEAMS</span>
          </div>

          {/* Month headers */}
          <div className="flex-1 flex">
            {visibleMonths.map((month) => (
              <div
                key={month.index}
                className={`flex-1 py-4 text-center border-r border-slate-200 font-semibold text-sm ${
                  month.isCurrentMonth
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-50 text-slate-700'
                }`}
              >
                {month.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Swim Lanes */}
      <div className="divide-y divide-slate-200 min-h-0">
        {teamLanes.map((team) => {
          const teamFeatures = getFeaturesForTeam(team.id)
          const featureRows = calculateFeatureRows(teamFeatures)
          const maxRows = Math.max(1, ...Object.values(featureRows), 0) + 1
          const laneHeight = Math.max(140, maxRows * 40 + 40) // 40px per row + padding
          
          return (
            <div key={team.id} className="flex overflow-hidden" style={{ minHeight: `${laneHeight}px` }}>
              {/* Team Label */}
              <div className={`w-48 ${team.bgColor} border-r border-slate-200 flex items-center px-4 flex-shrink-0`}>
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
                    <div key={month.index} className="flex-1 border-r border-slate-100"></div>
                  ))}
                </div>
                
                {/* Features */}
                <div className="relative h-full px-2 pt-2">
                  {(() => {
                    const featureRows = calculateFeatureRows(teamFeatures)
                    return teamFeatures.map((feature: RoadmapFeature) => {
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
      <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-6">
            <span className="font-semibold text-slate-700 tracking-wide">STATUS:</span>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-slate-200 rounded"></div>
              <span className="text-slate-600">Planned</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-400 rounded"></div>
              <span className="text-slate-600">In Progress</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-slate-400 rounded"></div>
              <span className="text-slate-600">Completed</span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <span className="font-semibold text-slate-700 tracking-wide">PRIORITY:</span>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-400 rounded"></div>
              <span className="text-slate-600">High</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-400 rounded"></div>
              <span className="text-slate-600">Medium</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-400 rounded"></div>
              <span className="text-slate-600">Low</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Detail Modal */}
      <FeatureDetailModal
        feature={(modalOperation.state.data as any)?.selectedFeature || null}
        isOpen={(modalOperation.state.data as any)?.isOpen || false}
        onClose={handleCloseModal}
        onSave={handleSaveFeature}
        onDelete={handleDeleteFeature}
        startDate={startDate}
        mode={(modalOperation.state.data as any)?.selectedFeature ? 'edit' : 'create'}
        availableTeams={availableTeams}
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
            features={featuresOperation.state.data || []}
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