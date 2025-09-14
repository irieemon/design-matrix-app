import { useState, useEffect } from 'react'
import { Map, Calendar, Users, Clock, AlertTriangle, CheckCircle, Lightbulb, ArrowRight, Sparkles, Loader, History, ChevronDown, Download, BarChart3, Grid3X3 } from 'lucide-react'
import { Project, IdeaCard, ProjectRoadmap as ProjectRoadmapType } from '../types'
import { aiService } from '../lib/aiService'
import { DatabaseService } from '../lib/database'
import { exportRoadmapToPDF } from '../utils/pdfExportSimple'
import { logger } from '../utils/logger'
import TimelineRoadmap from './TimelineRoadmap'

interface ProjectRoadmapProps {
  currentUser: string
  currentProject: Project | null
  ideas: IdeaCard[]
}

interface Epic {
  title: string
  description: string
  userStories: string[]
  deliverables: string[]
  priority: string
  complexity: string
  relatedIdeas: string[]
  // Timeline-specific properties
  startMonth?: number
  duration?: number
  status?: 'planned' | 'in-progress' | 'completed'
  team?: string
}

interface Phase {
  phase: string
  duration: string
  description: string
  epics: Epic[]
  risks: string[]
  successCriteria: string[]
}

interface Milestone {
  milestone: string
  timeline: string
  description: string
}

interface RoadmapData {
  // New format
  roadmapAnalysis?: {
    totalDuration: string
    phases: Phase[]
  }
  executionStrategy?: {
    methodology: string
    sprintLength: string
    teamRecommendations: string
    keyMilestones: Milestone[]
  }
  // Legacy format fallbacks
  timeline?: string
  phases?: Phase[]
}

const ProjectRoadmap: React.FC<ProjectRoadmapProps> = ({ currentUser, currentProject, ideas }) => {
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set())
  const [roadmapHistory, setRoadmapHistory] = useState<ProjectRoadmapType[]>([])
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [viewMode, setViewMode] = useState<'detailed' | 'timeline'>('timeline')

  // Load existing roadmaps when component mounts or project changes
  useEffect(() => {
    if (currentProject?.id) {
      loadRoadmapHistory()
    }
  }, [currentProject?.id])

  const loadRoadmapHistory = async () => {
    if (!currentProject?.id) return
    
    try {
      const history = await DatabaseService.getProjectRoadmaps(currentProject.id)
      setRoadmapHistory(history)
      
      // Load the most recent roadmap if available
      if (history.length > 0 && !selectedRoadmapId) {
        setSelectedRoadmapId(history[0].id)
        setRoadmapData(history[0].roadmap_data)
      }
    } catch (error) {
      logger.error('Error loading roadmap history:', error)
    }
  }

  // const loadRoadmapVersion = async (roadmapId: string) => {
  //   try {
  //     const roadmap = await DatabaseService.getProjectRoadmap(roadmapId)
  //     if (roadmap) {
  //       setRoadmapData(roadmap.roadmap_data)
  //       setSelectedRoadmapId(roadmapId)
  //     }
  //   } catch (error) {
  //     logger.error('Error loading roadmap version:', error)
  //   }
  // }

  const generateRoadmap = async () => {
    if (!currentProject) {
      setError('Please select a project to generate a roadmap')
      return
    }

    if ((ideas || []).length === 0) {
      setError('No ideas found for this project. Add some ideas to the priority matrix first.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      logger.debug('🗺️ Generating roadmap for project:', currentProject.name)
      logger.debug('📋 Processing', (ideas || []).length, 'ideas')
      
      const data = await aiService.generateRoadmap(
        ideas,
        currentProject.name,
        currentProject.project_type
      )
      
      setRoadmapData(data)
      logger.debug('✅ Roadmap generated successfully')
      
      // Save the roadmap to database
      const savedRoadmapId = await DatabaseService.saveProjectRoadmap(
        currentProject.id,
        data,
        currentUser, // Assuming currentUser is the user ID
(ideas || []).length
      )
      
      if (savedRoadmapId) {
        logger.debug('✅ Roadmap saved to database')
        setSelectedRoadmapId(savedRoadmapId)
        // Reload history to show the new roadmap
        await loadRoadmapHistory()
      } else {
        logger.error('❌ Failed to save roadmap to database')
      }
    } catch (err) {
      logger.error('Error generating roadmap:', err)
      setError('Failed to generate roadmap. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportToPDF = () => {
    if (roadmapData && currentProject && roadmapData.roadmapAnalysis && roadmapData.executionStrategy) {
      exportRoadmapToPDF(roadmapData as ProjectRoadmapType['roadmap_data'], (ideas || []).length, currentProject)
    }
  }

  const togglePhaseExpansion = (phaseIndex: number) => {
    logger.debug('🔄 Toggling phase expansion for index:', phaseIndex)
    logger.debug('📋 Current expanded phases:', Array.from(expandedPhases))
    const newExpanded = new Set(expandedPhases)
    if (newExpanded.has(phaseIndex)) {
      newExpanded.delete(phaseIndex)
      logger.debug('➖ Collapsing phase', phaseIndex)
    } else {
      newExpanded.add(phaseIndex)
      logger.debug('➕ Expanding phase', phaseIndex)
    }
    setExpandedPhases(newExpanded)
    logger.debug('📋 New expanded phases:', Array.from(newExpanded))
  }

  const getPriorityColor = (priority: string) => {
    if (!priority) {
      return 'bg-slate-100 text-slate-800 border-slate-200'
    }
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  const getComplexityColor = (complexity: string) => {
    if (!complexity) {
      return 'bg-slate-100 text-slate-800 border-slate-200'
    }
    switch (complexity.toLowerCase()) {
      case 'high':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'low':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  // Convert roadmap data to timeline format
  const convertToTimelineFeatures = () => {
    logger.debug('🔄 Converting roadmap data to timeline features...')
    logger.debug('📋 Roadmap data structure:', { 
      hasRoadmapAnalysis: !!roadmapData?.roadmapAnalysis,
      hasPhases: !!roadmapData?.roadmapAnalysis?.phases,
      phasesCount: roadmapData?.roadmapAnalysis?.phases?.length || 0,
      projectType: currentProject?.project_type
    })
    
    if (!roadmapData?.roadmapAnalysis?.phases) {
      logger.warn('❌ No roadmap phases found')
      return []
    }

    const features: any[] = []
    let currentMonth = 0
    
    // Team mapping based on project type and epic characteristics
    const getTeamForEpic = (epic: Epic) => {
      const title = epic.title?.toLowerCase() || ''
      const description = epic.description?.toLowerCase() || ''
      const combined = `${title} ${description}`
      const projectType = currentProject?.project_type?.toLowerCase() || 'other'
      
      // Define team categories based on project type
      if (projectType.includes('software') || projectType.includes('app') || projectType.includes('platform') || projectType.includes('system')) {
        // Software development teams
        const platformKeywords = ['platform', 'infrastructure', 'backend', 'database', 'api', 'security', 'devops', 'server', 'architecture', 'deployment', 'authentication', 'authorization', 'data model', 'system design', 'scalability', 'performance', 'monitoring', 'logging']
        if (platformKeywords.some(keyword => combined.includes(keyword))) {
          return 'platform'
        }
        
        const mobileKeywords = ['mobile', 'app', 'ios', 'android', 'react native', 'flutter', 'native app']
        if (mobileKeywords.some(keyword => combined.includes(keyword))) {
          return 'mobile'
        }
        
        const testingKeywords = ['test', 'quality', 'qa', 'automation', 'testing', 'validation', 'verification']
        if (testingKeywords.some(keyword => combined.includes(keyword))) {
          return 'testing'
        }
        
        return 'web' // Default for software projects
        
      } else if (projectType.includes('marketing') || projectType.includes('campaign') || projectType.includes('brand')) {
        // Marketing campaign teams
        const creativeKeywords = ['creative', 'content', 'design', 'brand', 'visual', 'asset', 'copy', 'material', 'identity']
        if (creativeKeywords.some(keyword => combined.includes(keyword))) {
          return 'creative'
        }
        
        const digitalKeywords = ['digital', 'social', 'online', 'advertising', 'seo', 'sem', 'email', 'web', 'channel']
        if (digitalKeywords.some(keyword => combined.includes(keyword))) {
          return 'digital'
        }
        
        const analyticsKeywords = ['analytics', 'tracking', 'measurement', 'data', 'report', 'roi', 'performance', 'metrics']
        if (analyticsKeywords.some(keyword => combined.includes(keyword))) {
          return 'analytics'
        }
        
        return 'operations' // Default for marketing projects
        
      } else if (projectType.includes('event') || projectType.includes('conference') || projectType.includes('meeting')) {
        // Event management teams
        const planningKeywords = ['planning', 'logistics', 'venue', 'coordination', 'vendor', 'timeline', 'budget']
        if (planningKeywords.some(keyword => combined.includes(keyword))) {
          return 'planning'
        }
        
        const marketingKeywords = ['marketing', 'promotion', 'attendee', 'acquisition', 'communication', 'outreach']
        if (marketingKeywords.some(keyword => combined.includes(keyword))) {
          return 'marketing'
        }
        
        const operationsKeywords = ['operations', 'registration', 'on-site', 'technical', 'staff', 'setup']
        if (operationsKeywords.some(keyword => combined.includes(keyword))) {
          return 'operations'
        }
        
        return 'experience' // Default for event projects
        
      } else if (projectType.includes('research') || projectType.includes('study') || projectType.includes('analysis')) {
        // Research project teams
        const researchKeywords = ['research', 'data collection', 'survey', 'interview', 'methodology', 'literature']
        if (researchKeywords.some(keyword => combined.includes(keyword))) {
          return 'research'
        }
        
        const analysisKeywords = ['analysis', 'processing', 'statistical', 'pattern', 'insights', 'findings']
        if (analysisKeywords.some(keyword => combined.includes(keyword))) {
          return 'analysis'
        }
        
        const documentationKeywords = ['documentation', 'report', 'writing', 'visualization', 'presentation', 'publication']
        if (documentationKeywords.some(keyword => combined.includes(keyword))) {
          return 'documentation'
        }
        
        return 'stakeholder' // Default for research projects
        
      } else if (projectType.includes('business') || projectType.includes('strategy') || projectType.includes('consulting')) {
        // Business strategy teams
        const strategyKeywords = ['strategy', 'business', 'analysis', 'market', 'competitive', 'planning']
        if (strategyKeywords.some(keyword => combined.includes(keyword))) {
          return 'strategy'
        }
        
        const operationsKeywords = ['operations', 'process', 'optimization', 'workflow', 'resource', 'implementation']
        if (operationsKeywords.some(keyword => combined.includes(keyword))) {
          return 'operations'
        }
        
        const stakeholderKeywords = ['stakeholder', 'client', 'communication', 'change', 'training', 'engagement']
        if (stakeholderKeywords.some(keyword => combined.includes(keyword))) {
          return 'stakeholder'
        }
        
        return 'measurement' // Default for business projects
        
      } else {
        // Generic project teams
        const planningKeywords = ['planning', 'resource', 'timeline', 'risk', 'framework', 'strategy']
        if (planningKeywords.some(keyword => combined.includes(keyword))) {
          return 'planning'
        }
        
        const executionKeywords = ['execution', 'implementation', 'deliverable', 'creation', 'development', 'build']
        if (executionKeywords.some(keyword => combined.includes(keyword))) {
          return 'execution'
        }
        
        const coordinationKeywords = ['coordination', 'management', 'communication', 'stakeholder', 'vendor', 'team']
        if (coordinationKeywords.some(keyword => combined.includes(keyword))) {
          return 'coordination'
        }
        
        return 'evaluation' // Default for generic projects
      }
    }

    roadmapData.roadmapAnalysis.phases.forEach((phase, phaseIndex) => {
      // Parse duration (e.g., "2-3 weeks" -> 1 month, "1-2 months" -> 2 months)
      const durationText = phase.duration || '1 month'
      let phaseDuration = 1 // default to 1 month
      
      if (durationText.includes('week')) {
        const weeks = parseInt(durationText) || 2
        phaseDuration = Math.ceil(weeks / 4) // convert weeks to months
      } else if (durationText.includes('month')) {
        phaseDuration = parseInt(durationText) || 1
      }

      phase.epics?.forEach((epic, epicIndex) => {
        const priority = epic.priority?.toLowerCase() as 'high' | 'medium' | 'low' || 'medium'
        
        features.push({
          id: `${phaseIndex}-${epicIndex}`,
          title: epic.title || `Epic ${epicIndex + 1}`,
          description: epic.description,
          startMonth: epic.startMonth !== undefined ? epic.startMonth : currentMonth,
          duration: epic.duration !== undefined ? epic.duration : Math.max(1, Math.floor(phaseDuration / (phase.epics?.length || 1))),
          team: epic.team || getTeamForEpic(epic),
          priority,
          status: epic.status || (phaseIndex === 0 ? 'in-progress' : 'planned') as const,
          userStories: epic.userStories,
          deliverables: epic.deliverables,
          relatedIdeas: epic.relatedIdeas,
          risks: phase.risks, // Use phase risks for the feature
          successCriteria: phase.successCriteria, // Use phase success criteria
          complexity: epic.complexity
        })
      })

      currentMonth += phaseDuration
    })

    logger.debug('✅ Generated', features.length, 'timeline features')
    logger.debug('🎯 Feature teams:', features.map(f => ({ title: f.title, team: f.team })))
    
    return features
  }

  const timelineFeatures = convertToTimelineFeatures()

  // Handle feature changes and save them back to roadmap data
  const handleFeaturesChange = async (updatedFeatures: any[]) => {
    if (!roadmapData || !currentProject || !selectedRoadmapId) return
    
    try {
      // Convert features back to roadmap phases
      const updatedRoadmapData = { ...roadmapData }
      if (updatedRoadmapData.roadmapAnalysis?.phases) {
        // Update the roadmap data with the new feature information
        updatedRoadmapData.roadmapAnalysis.phases.forEach((phase, phaseIndex) => {
          phase.epics?.forEach((epic, epicIndex) => {
            const featureId = `${phaseIndex}-${epicIndex}`
            const updatedFeature = updatedFeatures.find(f => f.id === featureId)
            if (updatedFeature) {
              // Update the epic with all the feature data
              epic.title = updatedFeature.title
              epic.description = updatedFeature.description
              epic.startMonth = updatedFeature.startMonth
              epic.duration = updatedFeature.duration
              epic.status = updatedFeature.status
              epic.team = updatedFeature.team
              epic.priority = updatedFeature.priority
              epic.complexity = updatedFeature.complexity
              epic.userStories = updatedFeature.userStories || epic.userStories
              epic.deliverables = updatedFeature.deliverables || epic.deliverables
              epic.relatedIdeas = updatedFeature.relatedIdeas || epic.relatedIdeas
            }
          })
        })
      }
      
      // Save the updated roadmap data to the database
      await DatabaseService.updateProjectRoadmap(selectedRoadmapId, updatedRoadmapData)
      setRoadmapData(updatedRoadmapData)
      
      logger.debug('✅ Roadmap changes saved to database')
    } catch (error) {
      logger.error('❌ Failed to save roadmap changes:', error)
    }
  }

  if (!currentProject) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-16">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
            <Map className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Project Selected</h3>
            <p className="text-slate-600 mb-6">
              Select a project to generate an AI-powered roadmap with user stories and deliverables.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl shadow-sm border border-blue-200/60 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Map className="w-6 h-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Project Roadmap</h1>
            </div>
            <p className="text-slate-600 mb-2">
              AI-generated roadmap for <strong>{currentProject.name}</strong>
            </p>
            <p className="text-sm text-slate-500">
              Analyzing {(ideas || []).length} ideas • Created by {currentUser}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {roadmapData && (
              <button
                onClick={handleExportToPDF}
                className="flex items-center space-x-2 bg-slate-600 text-white px-4 py-3 rounded-xl hover:bg-slate-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                <span>Export PDF</span>
              </button>
            )}
            <button
              onClick={generateRoadmap}
              disabled={isLoading}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              <span>{isLoading ? 'Generating...' : 'Generate Roadmap'}</span>
            </button>
          </div>
        </div>
      </div>


      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-700 font-medium">Error generating roadmap</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Roadmap Content */}
      {roadmapData && (
        <div className="space-y-8">
          {/* Overview Cards - Show only in detailed view */}
          {viewMode === 'detailed' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h3 className="font-medium text-slate-900">Duration</h3>
                </div>
                <p className="text-2xl font-bold text-blue-600">{roadmapData.roadmapAnalysis?.totalDuration || roadmapData.timeline || '3-6 months'}</p>
                <p className="text-sm text-slate-600 mt-1">Total project timeline</p>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-3">
                  <Users className="w-5 h-5 text-green-600" />
                  <h3 className="font-medium text-slate-900">Methodology</h3>
                </div>
                <p className="text-2xl font-bold text-green-600">{roadmapData.executionStrategy?.methodology || 'Agile'}</p>
                <p className="text-sm text-slate-600 mt-1">{roadmapData.executionStrategy?.sprintLength || '2-week'} sprints</p>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-3">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                  <h3 className="font-medium text-slate-900">Phases</h3>
                </div>
                <p className="text-2xl font-bold text-purple-600">{roadmapData.roadmapAnalysis?.phases?.length || roadmapData.phases?.length || 0}</p>
                <p className="text-sm text-slate-600 mt-1">Development phases</p>
              </div>
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && timelineFeatures.length > 0 && (
            <TimelineRoadmap 
              features={timelineFeatures}
              title={currentProject?.name || 'PROJECT ROADMAP'}
              subtitle={`${timelineFeatures.length} Features • ${roadmapData.roadmapAnalysis?.totalDuration || '6 months'}`}
              onFeaturesChange={handleFeaturesChange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              projectType={currentProject?.project_type || 'software'}
            />
          )}

          {/* Detailed View */}
          {viewMode === 'detailed' && (
            <>
              {/* Timeline */}
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Development Timeline</span>
                </h2>
                <div className="flex items-center bg-white rounded-lg border border-slate-200 p-1">
                  <button
                    onClick={() => setViewMode('timeline')}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-600 hover:text-slate-900"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Timeline</span>
                  </button>
                  <button
                    onClick={() => setViewMode('detailed')}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-blue-600 text-white"
                  >
                    <Grid3X3 className="w-4 h-4" />
                    <span>Detailed</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {/* Phases */}
              <div className="space-y-6">
                {(roadmapData.roadmapAnalysis?.phases || roadmapData.phases || []).map((phase, phaseIndex) => (
                  <div key={phaseIndex} className="relative">
                    {/* Phase Timeline Line */}
                    {phaseIndex < (roadmapData.roadmapAnalysis?.phases || roadmapData.phases || []).length - 1 && (
                      <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-slate-200"></div>
                    )}
                    
                    {/* Phase Header */}
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {phaseIndex + 1}
                      </div>
                      
                      <div className="flex-1">
                        <div 
                          className="cursor-pointer hover:bg-slate-50 rounded-lg p-3 -m-3 transition-colors"
                          onClick={() => togglePhaseExpansion(phaseIndex)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-bold text-slate-900">{phase.phase}</h3>
                            <div className="flex items-center space-x-3">
                              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                {phase.duration}
                              </span>
                              <ArrowRight 
                                className={`w-5 h-5 text-slate-400 transition-transform ${
                                  expandedPhases.has(phaseIndex) ? 'rotate-90' : ''
                                }`}
                              />
                            </div>
                          </div>
                          <p className="text-slate-600 mb-2">{phase.description}</p>
                          <p className="text-xs text-slate-400 flex items-center space-x-1">
                            <span>Click to {expandedPhases.has(phaseIndex) ? 'collapse' : 'expand'} details</span>
                            <ArrowRight className={`w-3 h-3 transition-transform ${expandedPhases.has(phaseIndex) ? 'rotate-90' : ''}`} />
                          </p>
                        </div>
                        
                        {/* Expanded Phase Content */}
                        {expandedPhases.has(phaseIndex) && (
                          <div className="space-y-6 pl-4 border-l-2 border-slate-100">
                            {/* Epics */}
                            <div>
                              <h4 className="font-medium text-slate-900 mb-3 flex items-center space-x-2">
                                <Lightbulb className="w-4 h-4" />
                                <span>Epics ({phase.epics?.length || 0})</span>
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(phase.epics || []).map((epic, epicIndex) => (
                                  <div key={epicIndex} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                    <div className="flex items-start justify-between mb-3">
                                      <h5 className="font-medium text-slate-900">{epic.title}</h5>
                                      <div className="flex space-x-1">
                                        <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityColor(epic.priority || 'medium')}`}>
                                          {epic.priority || 'medium'}
                                        </span>
                                        <span className={`px-2 py-1 rounded-full text-xs border ${getComplexityColor(epic.complexity || 'medium')}`}>
                                          {epic.complexity || 'medium'}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <p className="text-sm text-slate-600 mb-3">{epic.description}</p>
                                    
                                    {/* User Stories */}
                                    <div className="mb-3">
                                      <p className="text-xs font-medium text-slate-700 mb-1">User Stories:</p>
                                      <ul className="text-xs text-slate-600 space-y-1">
                                        {(epic.userStories || []).map((story, storyIndex) => (
                                          <li key={storyIndex} className="flex items-start space-x-1">
                                            <span className="text-slate-400">•</span>
                                            <span>{story}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    
                                    {/* Deliverables */}
                                    <div className="mb-3">
                                      <p className="text-xs font-medium text-slate-700 mb-1">Deliverables:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {(epic.deliverables || []).map((deliverable, deliverableIndex) => (
                                          <span 
                                            key={deliverableIndex}
                                            className="bg-white text-slate-700 px-2 py-1 rounded text-xs border border-slate-200"
                                          >
                                            {deliverable}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* Related Ideas */}
                                    {(epic.relatedIdeas || []).length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-slate-700 mb-1">Related Ideas:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {(epic.relatedIdeas || []).map((idea, ideaIndex) => (
                                            <span 
                                              key={ideaIndex}
                                              className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs"
                                            >
                                              {idea}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Risks and Success Criteria */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                <h4 className="font-medium text-red-900 mb-2 flex items-center space-x-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  <span>Risks</span>
                                </h4>
                                <ul className="text-sm text-red-800 space-y-1">
                                  {(phase.risks || []).map((risk, riskIndex) => (
                                    <li key={riskIndex} className="flex items-start space-x-1">
                                      <span className="text-red-400">•</span>
                                      <span>{risk}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              
                              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                <h4 className="font-medium text-green-900 mb-2 flex items-center space-x-2">
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Success Criteria</span>
                                </h4>
                                <ul className="text-sm text-green-800 space-y-1">
                                  {(phase.successCriteria || []).map((criteria, criteriaIndex) => (
                                    <li key={criteriaIndex} className="flex items-start space-x-1">
                                      <span className="text-green-400">•</span>
                                      <span>{criteria}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Execution Strategy */}
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
                  <p className="text-slate-700 text-sm leading-relaxed">
                    {roadmapData.executionStrategy?.teamRecommendations || 'Cross-functional team structure recommended for optimal collaboration.'}
                  </p>
                </div>
                
                {/* Key Milestones */}
                <div>
                  <h3 className="font-medium text-slate-900 mb-3 flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Key Milestones</span>
                  </h3>
                  <div className="space-y-3">
                    {(roadmapData.executionStrategy?.keyMilestones || []).map((milestone, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 text-xs font-bold">{index + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-slate-900 text-sm">{milestone.milestone}</h4>
                            <span className="text-purple-600 text-xs bg-purple-100 px-2 py-1 rounded">
                              {milestone.timeline}
                            </span>
                          </div>
                          <p className="text-slate-600 text-xs mt-1">{milestone.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
              </>
            )}
        </div>
      )}

      {/* Roadmap History Section */}
      {roadmapHistory.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-50 rounded-xl">
                <History className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Roadmap History</h3>
                <p className="text-sm text-slate-600">{roadmapHistory.length} saved roadmap{roadmapHistory.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-2 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span className="text-sm">{showHistory ? 'Hide' : 'Show'} History</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {showHistory && (
            <div className="space-y-3">
              {(roadmapHistory || []).map((roadmap) => (
                <div 
                  key={roadmap.id} 
                  className={`bg-slate-50 rounded-xl p-4 border transition-colors cursor-pointer hover:bg-slate-100 ${
                    selectedRoadmapId === roadmap.id ? 'border-purple-200 bg-purple-50' : 'border-slate-200'
                  }`}
                  onClick={() => {
                    setSelectedRoadmapId(roadmap.id)
                    setRoadmapData(roadmap.roadmap_data)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{roadmap.name}</h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(roadmap.created_at).toLocaleDateString()}</span>
                        </span>
                        <span>{roadmap.ideas_analyzed} ideas analyzed</span>
                        <span>Version {roadmap.version}</span>
                      </div>
                    </div>
                    {selectedRoadmapId === roadmap.id && (
                      <div className="flex items-center space-x-1 text-purple-600 bg-purple-100 px-2 py-1 rounded text-sm">
                        <CheckCircle className="w-3 h-3" />
                        <span>Active</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectRoadmap