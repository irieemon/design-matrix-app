import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { Project, IdeaCard, ProjectRoadmap as ProjectRoadmapType } from '../../types'
import { aiService } from '../../lib/aiService'
import { DatabaseService } from '../../lib/database'
import { logger } from '../../utils/logger'
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
      if (history.length > 0 && !state.selectedRoadmapId) {
        setState(prev => ({ ...prev, selectedRoadmapId: history[0].id }))
        setRoadmapData(history[0].roadmap_data)
      }
    } catch (error) {
      logger.error('Error loading roadmap history:', error)
    }
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
      logger.debug('🗺️ Generating roadmap for project:', currentProject.name)
      logger.debug('📋 Processing', (ideas || []).length, 'ideas')

      const data = await aiService.generateRoadmap(
        ideas,
        currentProject.name,
        currentProject.project_type
      )

      if (data) {
        console.log('🗺️ ProjectRoadmap: Setting roadmap data:', data)
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
          }
        } catch (error) {
          logger.error('Error saving roadmap:', error)
          // Don't show error to user since roadmap generation succeeded
        }

        logger.debug('✅ Roadmap generated successfully')
      } else {
        setState(prev => ({ ...prev, error: 'Failed to generate roadmap. Please try again.' }))
      }
    } catch (error) {
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
    logger.debug('📋 New expanded phases:', Array.from(state.expandedPhases))
  }

  // Generate timeline features for timeline view
  const convertToTimelineFeatures = () => {
    if (!roadmapData?.roadmapAnalysis?.phases || !currentProject) {
      return []
    }

    const features: any[] = []
    let currentMonth = 1

    const getTeamForEpic = (epic: any) => {
      const projectType = currentProject.project_type?.toLowerCase() || 'software'
      const combined = `${epic.title} ${epic.description} ${(epic.userStories || []).join(' ')} ${(epic.deliverables || []).join(' ')}`.toLowerCase()

      if (projectType.includes('software') || projectType.includes('web') || projectType.includes('app')) {
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

      return 'platform'
    }

    roadmapData.roadmapAnalysis.phases.forEach((phase, phaseIndex) => {
      const durationText = phase.duration || '1 month'
      let phaseDuration = 1

      if (durationText.includes('week')) {
        const weeks = parseInt(durationText) || 2
        phaseDuration = Math.ceil(weeks / 4)
      } else if (durationText.includes('month')) {
        phaseDuration = parseInt(durationText) || 1
      }

      phase.epics?.forEach((epic, epicIndex) => {
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
          complexity: epic.complexity
        })
      })

      currentMonth += phaseDuration
    })

    logger.debug('✅ Generated', features.length, 'timeline features')
    logger.debug('🎯 Feature teams:', features.map(f => ({ title: f.title, team: f.team })))

    return features
  }

  const timelineFeatures = useMemo(() => {
    const features = convertToTimelineFeatures()
    console.log('🎯 ProjectRoadmap: Timeline features generated:', features.length, features)
    return features
  }, [roadmapData, currentProject?.project_type])

  const roadmapPhases = useMemo(() => {
    return roadmapData?.roadmapAnalysis?.phases || roadmapData?.phases || []
  }, [roadmapData])

  const keyMilestones = useMemo(() => {
    return roadmapData?.executionStrategy?.keyMilestones || []
  }, [roadmapData])

  const handleFeaturesChange = async (updatedFeatures: any[]) => {
    // Implementation for handling feature changes
    // This would need to be implemented based on the original component's logic
    logger.debug('Features changed:', updatedFeatures)
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
    <div className="space-y-8">
      <RoadmapHeader
        currentProject={currentProject}
        roadmapData={roadmapData}
        isLoading={state.isLoading}
        viewMode={viewMode}
        showHistory={state.showHistory}
        roadmapHistory={roadmapHistory}
        onGenerateRoadmap={handleGenerateRoadmap}
        onToggleViewMode={setViewMode}
        onToggleHistory={() => setState(prev => ({ ...prev, showHistory: !prev.showHistory }))}
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
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              projectType={currentProject?.project_type || 'software'}
            />
          )}

          {/* Detailed View */}
          {viewMode === 'detailed' && (
            <>
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