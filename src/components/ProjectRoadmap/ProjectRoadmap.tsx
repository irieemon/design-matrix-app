import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { Grid3X3, Map } from 'lucide-react'
import { Project, IdeaCard, ProjectRoadmap as ProjectRoadmapType } from '../../types'
import { aiService } from '../../lib/aiService'
import { DatabaseService } from '../../lib/database'
import { useLogger } from '../../lib/logging'
import TimelineRoadmap from '../TimelineRoadmap'
import RoadmapHeader from './RoadmapHeader'
import PhaseList from './PhaseList'
import MilestoneTimeline from './MilestoneTimeline'
import { RoadmapData, RoadmapViewMode, RoadmapState } from './types'

// Lazy load the RoadmapExportModal to reduce bundle size
const RoadmapExportModal = lazy(() => import('../RoadmapExportModal'))

interface ProjectRoadmapProps {
  currentUser: string
  currentProject: Project | null
  ideas: IdeaCard[]
}

const ProjectRoadmap: React.FC<ProjectRoadmapProps> = ({ currentUser, currentProject, ideas }) => {
  const logger = useLogger('ProjectRoadmap')

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null)
  const [state, setState] = useState<RoadmapState>({
    isLoading: false,
    error: null,
    expandedPhases: new Set(),
    showHistory: false,
    selectedRoadmapId: null,
    showConfirmModal: false,
    isExportModalOpen: false
  })
  const [roadmapHistory, setRoadmapHistory] = useState<ProjectRoadmapType[]>([])
  const [viewMode, setViewMode] = useState<RoadmapViewMode['mode']>('timeline')

  // ✅ HOOKS FIX: Define helper function BEFORE hooks that use it
  const convertToTimelineFeatures = () => {
    if (!roadmapData?.roadmapAnalysis?.phases || !currentProject) {
      logger.debug('🚫 convertToTimelineFeatures: Missing roadmap data or project', {
        hasRoadmapData: !!roadmapData,
        hasAnalysis: !!roadmapData?.roadmapAnalysis,
        hasPhases: !!roadmapData?.roadmapAnalysis?.phases,
        phasesLength: roadmapData?.roadmapAnalysis?.phases?.length,
        hasCurrentProject: !!currentProject
      })
      return []
    }

    logger.debug('🎯 convertToTimelineFeatures: Starting conversion', {
      phasesCount: roadmapData.roadmapAnalysis.phases.length,
      projectType: currentProject.project_type
    })

    const features: any[] = []
    let currentMonth = 0

    const getTeamForEpic = (epic: any): string => {
      if (epic.team) return epic.team

      if (currentProject?.project_type) {
        const projectType = currentProject.project_type.toLowerCase()
        if (projectType.includes('web') || projectType.includes('frontend')) {
          return 'web'
        }
        if (projectType.includes('mobile') || projectType.includes('app')) {
          return 'mobile'
        }
        if (projectType.includes('backend') || projectType.includes('api')) {
          return 'backend'
        }
      }

      const combined = `${epic.title || ''} ${epic.description || ''}`.toLowerCase()

      const backendKeywords = ['backend', 'api', 'server', 'database', 'auth', 'integration', 'microservice']
      if (backendKeywords.some(keyword => combined.includes(keyword))) {
        return 'backend'
      }

      const frontendKeywords = ['frontend', 'ui', 'user interface', 'react', 'vue', 'angular', 'design', 'css', 'html', 'web']
      if (frontendKeywords.some(keyword => combined.includes(keyword))) {
        return 'web'
      }

      const mobileKeywords = ['mobile', 'app', 'ios', 'android', 'smartphone', 'tablet']
      if (mobileKeywords.some(keyword => combined.includes(keyword))) {
        return 'mobile'
      }

      const testingKeywords = ['test', 'testing', 'qa', 'quality', 'automation', 'validation']
      if (testingKeywords.some(keyword => combined.includes(keyword))) {
        return 'testing'
      }

      return 'platform'
    }

    roadmapData.roadmapAnalysis.phases.forEach((phase, phaseIndex) => {
      logger.debug(`🏗️ Processing phase ${phaseIndex}:`, {
        phase: phase.phase,
        epicsCount: phase.epics?.length || 0,
        duration: phase.duration
      })

      const durationText = phase.duration || '1 month'
      let phaseDuration = 1

      if (durationText.includes('week')) {
        const weeks = parseInt(durationText) || 2
        phaseDuration = Math.ceil(weeks / 4)
      } else if (durationText.includes('month')) {
        phaseDuration = parseInt(durationText) || 1
      }

      phase.epics?.forEach((epic, epicIndex) => {
        logger.debug(`  📦 Processing epic ${epicIndex}:`, {
          title: epic.title,
          startMonth: epic.startMonth,
          duration: epic.duration,
          team: epic.team
        })
        const priority = epic.priority?.toLowerCase() as 'high' | 'medium' | 'low' || 'medium'

        features.push({
          id: (epic as any).originalFeatureId || `${phaseIndex}-${epicIndex}`,
          title: epic.title || `Epic ${epicIndex + 1}`,
          description: epic.description,
          startMonth: epic.startMonth !== undefined ? epic.startMonth : currentMonth,
          duration: epic.duration !== undefined ? epic.duration : Math.max(1, Math.floor(phaseDuration / (phase.epics?.length || 1))),
          team: epic.team || getTeamForEpic(epic),
          priority,
          status: epic.status || (phaseIndex === 0 ? ('in-progress' as const) : ('planned' as const)),
          userStories: epic.userStories,
          deliverables: epic.deliverables,
          relatedIdeas: epic.relatedIdeas,
          risks: phase.risks,
          successCriteria: phase.successCriteria,
          complexity: epic.complexity,
          phaseIndex,
          epicIndex
        })
      })

      currentMonth += phaseDuration
    })

    logger.debug('✅ Generated timeline features', { featureCount: features.length })
    logger.debug('🎯 Feature teams:', { teams: features.map(f => ({ title: f.title, team: f.team })) })
    logger.debug('🏢 Unique teams found:', { uniqueTeams: [...new Set(features.map(f => f.team))] })

    return features
  }

  // ✅ HOOKS FIX: Move ALL hooks BEFORE early returns (Rules of Hooks requirement)
  // These hooks use roadmapData which may be null - they handle this safely
  const timelineFeatures = useMemo(() => {
    const features = convertToTimelineFeatures()
    logger.debug('Timeline features generated', {
      featureCount: features.length,
      features: features.map(f => ({ id: f.id, title: f.title, team: f.team }))
    })
    return features
  }, [roadmapData, currentProject?.project_type])

  const roadmapPhases = useMemo(() => {
    return roadmapData?.roadmapAnalysis?.phases || roadmapData?.phases || []
  }, [roadmapData])

  const keyMilestones = useMemo(() => {
    return roadmapData?.executionStrategy?.keyMilestones || []
  }, [roadmapData])

  // Debounced save to avoid excessive database calls during drag operations
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

      if (history.length > 0 && !roadmapData) {
        setState(prev => ({ ...prev, selectedRoadmapId: history[0].id }))
        setRoadmapData(history[0].roadmap_data)
        logger.debug('📋 Loaded most recent roadmap:', history[0].id)
      }
    } catch (_error) {
      logger.error('Error loading roadmap history:', error)
    }
  }

  // Early return AFTER all hooks - if no project selected
  if (!currentProject) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Project Selected</h3>
          <p className="text-yellow-700">Please select a project from the sidebar to view its roadmap.</p>
        </div>
      </div>
    )
  }

  // Early return AFTER all hooks - if no ideas
  if (!ideas || ideas.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">No Ideas Yet</h3>
          <p className="text-blue-700 mb-4">Add ideas to the priority matrix to generate a roadmap for {currentProject.name}.</p>
          <a
            href="#matrix"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Priority Matrix
          </a>
        </div>
      </div>
    )
  }

  const handleGenerateRoadmap = () => {
    if (!currentProject) {
      setState(prev => ({ ...prev, error: 'Please select a project to generate a roadmap' }))
      return
    }

    if ((ideas || []).length === 0) {
      setState(prev => ({ ...prev, error: 'No ideas found for this project. Add some ideas to the priority matrix first.' }))
      return
    }

    // Check if roadmap already exists
    if (roadmapData) {
      setState(prev => ({ ...prev, showConfirmModal: true }))
    } else {
      generateRoadmap()
    }
  }

  const generateRoadmap = async () => {
    if (!currentProject) {
      setState(prev => ({ ...prev, error: 'Please select a project to generate a roadmap' }))
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, showConfirmModal: false }))

    try {
      logger.debug('🗺️ Generating roadmap for project:', { projectName: currentProject.name })
      logger.debug('📋 Processing ideas', { ideaCount: (ideas || []).length })

      const data = await aiService.generateRoadmap(
        ideas,
        currentProject.name,
        currentProject.project_type
      )

      if (data) {
        logger.debug('🗺️ ProjectRoadmap: Setting roadmap data:', data)
        setRoadmapData(data)

        // Save to database
        try {
          const roadmapId = await DatabaseService.saveProjectRoadmap(
            currentProject.id,
            data,
            currentUser,
            ideas.length
          )

          if (roadmapId) {
            setState(prev => ({ ...prev, selectedRoadmapId: roadmapId }))
            await loadRoadmapHistory()
            logger.debug('✅ Roadmap saved and history updated:', { roadmapId })
          }
        } catch (_error) {
          logger.error('Error saving roadmap:', error)
          // Don't show error to user since roadmap generation succeeded
        }

        logger.debug('✅ Roadmap generated successfully')
      } else {
        setState(prev => ({ ...prev, error: 'Failed to generate roadmap. Please try again.' }))
        logger.error('❌ Roadmap generation failed - no data returned')
      }
    } catch (_error) {
      logger.error('Error generating roadmap:', error)
      setState(prev => ({ ...prev, error: 'Failed to generate roadmap. Please try again.' }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const togglePhaseExpansion = (phaseIndex: number) => {
    setState(prev => {
      const newExpanded = new Set(prev.expandedPhases)
      if (newExpanded.has(phaseIndex)) {
        newExpanded.delete(phaseIndex)
      } else {
        newExpanded.add(phaseIndex)
      }
      return { ...prev, expandedPhases: newExpanded }
    })
    logger.debug('📋 New expanded phases:', { expandedPhases: Array.from(state.expandedPhases) })
  }

  const handleFeaturesChange = async (updatedFeatures: any[]) => {
    if (!roadmapData || !currentProject?.id || !state.selectedRoadmapId) {
      logger.warn('Cannot save feature changes: missing roadmap data or project info')
      return
    }

    // Update the roadmap data with the new feature positions/durations
    const updatedRoadmapData = { ...roadmapData }

    // Map timeline features back to epic format
    if (updatedRoadmapData.roadmapAnalysis?.phases) {
      updatedRoadmapData.roadmapAnalysis.phases.forEach((phase, phaseIndex) => {
        if (phase.epics) {
          phase.epics.forEach((epic, epicIndex) => {
            // Find the updated feature using multiple mapping strategies
            const updatedFeature = updatedFeatures.find(f =>
              // Try exact ID match first
              f.id === (epic as any).originalFeatureId ||
              // Try position-based ID match
              f.id === `${phaseIndex}-${epicIndex}` ||
              // Try phase/epic index match
              (f.phaseIndex === phaseIndex && f.epicIndex === epicIndex) ||
              // Fallback to title match
              f.title === epic.title
            )

            if (updatedFeature) {
              epic.startMonth = updatedFeature.startMonth
              epic.duration = updatedFeature.duration
              epic.team = updatedFeature.team
              epic.status = updatedFeature.status
              logger.debug(`📝 Updated epic "${epic.title}": start=${updatedFeature.startMonth}, duration=${updatedFeature.duration}`)
            }
          })
        }
      })
    }

    // Update local state immediately for responsive UI
    setRoadmapData(updatedRoadmapData)

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce database save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        logger.debug('💾 Saving feature changes to database:', { featureCount: updatedFeatures.length })
        await DatabaseService.updateProjectRoadmap(
          state.selectedRoadmapId!,
          updatedRoadmapData
        )
        logger.debug('✅ Feature changes saved successfully')
      } catch (_error) {
        logger.error('❌ Error saving feature changes:', error)
        // Don't show error to user since they can still continue working
      }
    }, 1000)
  }

  const handleHistorySelect = (roadmap: ProjectRoadmapType) => {
    logger.debug('📋 Selecting roadmap from history:', {
      roadmapId: roadmap.id,
      createdAt: roadmap.created_at,
      hasRoadmapData: !!roadmap.roadmap_data,
      hasAnalysis: !!roadmap.roadmap_data?.roadmapAnalysis,
      hasPhases: !!roadmap.roadmap_data?.roadmapAnalysis?.phases,
      phasesCount: roadmap.roadmap_data?.roadmapAnalysis?.phases?.length
    })

    setState(prev => ({ ...prev, selectedRoadmapId: roadmap.id, showHistory: false }))
    setRoadmapData(roadmap.roadmap_data)
    logger.debug('📋 Roadmap data set from history selection')
  }

  if (state.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-800">{state.error}</p>
        <button
          onClick={() => setState(prev => ({ ...prev, error: null }))}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <RoadmapHeader
        currentProject={currentProject}
        roadmapData={roadmapData}
        isLoading={state.isLoading}
        roadmapHistory={roadmapHistory}
        selectedRoadmapId={state.selectedRoadmapId}
        onGenerateRoadmap={handleGenerateRoadmap}
        onHistorySelect={handleHistorySelect}
        onExportClick={() => setState(prev => ({ ...prev, isExportModalOpen: true }))}
      />

      {roadmapData && (
        <div>
          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <TimelineRoadmap
              features={timelineFeatures}
              title={currentProject?.name || 'PROJECT ROADMAP'}
              subtitle={`${timelineFeatures.length} Features • ${roadmapData.roadmapAnalysis?.totalDuration || '6 months'}`}
              onFeaturesChange={handleFeaturesChange}
              projectType={currentProject?.project_type || 'software'}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          )}

          {/* Detailed View */}
          {viewMode === 'detailed' && (
            <>
              {/* Detailed View Header */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden w-full">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold tracking-wide">{currentProject?.name || 'PROJECT ROADMAP'}</h2>
                      <p className="text-slate-300 text-sm mt-1">Detailed roadmap breakdown with phases and milestones</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      {/* View Mode Toggle */}
                      <div className="flex space-x-1 bg-slate-700/50 rounded-lg p-1 border border-slate-600">
                        <button
                          onClick={() => setViewMode('timeline')}
                          className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white"
                        >
                          <Grid3X3 className="w-4 h-4" />
                          <span>Timeline</span>
                        </button>
                        <button
                          onClick={() => setViewMode('detailed')}
                          className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-slate-600 text-white shadow-sm"
                        >
                          <Map className="w-4 h-4" />
                          <span>Detailed</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase Timeline */}
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
                      <span>Development Timeline</span>
                    </h2>
                  </div>
                </div>

                <div className="p-6">
                  <PhaseList
                    phases={roadmapPhases}
                    expandedPhases={state.expandedPhases}
                    onTogglePhaseExpansion={togglePhaseExpansion}
                  />
                </div>
              </div>

              {/* Execution Strategy */}
              <MilestoneTimeline
                teamRecommendations={roadmapData.executionStrategy?.teamRecommendations}
                milestones={keyMilestones}
              />
            </>
          )}
        </div>
      )}

      {/* Export Modal */}
      {state.isExportModalOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
              <span className="text-slate-700">Loading export tools...</span>
            </div>
          </div>
        }>
          <RoadmapExportModal
            isOpen={state.isExportModalOpen}
            onClose={() => setState(prev => ({ ...prev, isExportModalOpen: false }))}
            features={timelineFeatures}
            title={currentProject?.name || 'PROJECT ROADMAP'}
            subtitle={`${timelineFeatures.length} Features • ${roadmapData?.roadmapAnalysis?.totalDuration || '6 months'}`}
            startDate={new Date()}
            projectType={currentProject?.project_type || 'software'}
          />
        </Suspense>
      )}

      {/* Confirmation Modal */}
      {state.showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Regenerate Roadmap?</h3>
            <p className="text-slate-600 mb-4">
              This will create a new roadmap and save the current one to history. Continue?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={generateRoadmap}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Continue
              </button>
              <button
                onClick={() => setState(prev => ({ ...prev, showConfirmModal: false }))}
                className="flex-1 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectRoadmap