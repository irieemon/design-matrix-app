import { useState, useEffect, useTransition } from 'react'
import { Sparkles, TrendingUp, Target, CheckCircle, AlertTriangle, Download, Save, FileText, Lightbulb } from 'lucide-react'
import { IdeaCard, Project, ProjectFile } from '../types'
import { aiInsightsService } from '../lib/ai/aiInsightsService'
import { OpenAIModel } from '../lib/ai/openaiModelRouter'
import { FileService } from '../lib/fileService'
import { exportGraphicalInsightsToPDF } from '../utils/pdfExportSimple'
import { useAIWorker } from '../hooks/useAIWorker'
import { useAsyncOperation } from '../hooks/shared/useAsyncOperation'
import { BaseModal } from './shared/Modal'
import { ProjectRepository } from '../lib/repositories'
import { useLogger } from '../lib/logging'
import { Button } from './ui/Button'

interface AIInsightsModalProps {
  isOpen: boolean
  ideas: IdeaCard[]
  currentProject: Project | null
  selectedInsightId?: string
  preferredModel?: OpenAIModel
  onClose: () => void
  onInsightSaved?: (insightId: string) => void
}

interface InsightsReport {
  executiveSummary: string
  keyInsights: Array<{
    insight: string
    impact: string
  }>
  priorityRecommendations: {
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
  }
  riskAssessment?: {
    risks: string[]
    mitigations: string[]
  }
}

const AIInsightsModal: React.FC<AIInsightsModalProps> = ({ isOpen, ideas, currentProject, selectedInsightId, preferredModel, onClose, onInsightSaved }) => {
  const logger = useLogger('AIInsightsModal')

  // Modern state management with shared hooks
  const [savedInsightId, setSavedInsightId] = useState<string | null>(null)
  const [filesWithContent, setFilesWithContent] = useState<ProjectFile[]>([])

  // React 19 Concurrent Features for premium experience
  const [, startTransition] = useTransition()
  const [aiProgress, setAiProgress] = useState(0)
  const [aiStage, setAiStage] = useState<'analyzing' | 'synthesizing' | 'optimizing' | 'finalizing' | 'complete'>('analyzing')
  const [processingSteps, setProcessingSteps] = useState<string[]>([])
  const [estimatedTime, setEstimatedTime] = useState<number>(0)

  // Insights generation with unified async operation management
  const insightsOperation = useAsyncOperation(
    async () => {
      logger.debug('Generating AI insights', { ideaCount: (ideas || []).length })

      // Enhanced progress tracking
      startTransition(() => {
        setAiStage('analyzing')
        setAiProgress(5)
        setProcessingSteps(['🔍 Analyzing idea patterns and relationships'])
        setEstimatedTime(12)
      })

      // Simulate progressive analysis steps
      await new Promise(resolve => setTimeout(resolve, 800))
      startTransition(() => {
        setAiProgress(25)
        setProcessingSteps(prev => [...prev, '🧠 Synthesizing insights from analysis'])
        setEstimatedTime(8)
      })

      await new Promise(resolve => setTimeout(resolve, 600))
      startTransition(() => {
        setAiStage('synthesizing')
        setAiProgress(50)
        setProcessingSteps(prev => [...prev, '⚡ Optimizing recommendation priorities'])
        setEstimatedTime(4)
      })

      // Call the new modular AI insights service
      const report = await aiInsightsService.generateInsights(
        ideas,
        currentProject?.name,
        currentProject?.project_type,
        currentProject?.id,
        currentProject,
        preferredModel
      )

      startTransition(() => {
        setAiProgress(100)
        setAiStage('complete')
        setProcessingSteps(prev => [...prev, '✅ Insights generation complete'])
        setEstimatedTime(0)
      })

      return report
    },
    {
      onError: (error) => {
        logger.error('Insights generation failed:', error)
        startTransition(() => {
          setAiProgress(0)
          setAiStage('analyzing')
          setProcessingSteps([])
        })
      },
      resetOnExecute: true
    }
  )

  // Historical insights loading
  const historicalOperation = useAsyncOperation(
    async (insightId: string) => {
      logger.debug('📊 Loading historical insight:', { insightId })
      const historicalInsight = await ProjectRepository.getProjectInsight(insightId)

      if (!historicalInsight) {
        throw new Error('Insight not found')
      }

      return historicalInsight.insights_data
    },
    {
      onSuccess: () => {
        if (selectedInsightId) {
          setSavedInsightId(selectedInsightId)
        }
      },
      onError: (error) => logger.error('Error loading historical insight:', error)
    }
  )

  // Insights saving operation
  const saveOperation = useAsyncOperation(
    async (insights: InsightsReport) => {
      if (!currentProject) {
        throw new Error('No project selected')
      }

      // saveProjectInsights now throws errors instead of returning null
      const savedId = await ProjectRepository.saveProjectInsights(
        currentProject.id,
        insights,
        currentProject.owner_id || 'unknown',
        (ideas || []).length
      )

      return savedId
    },
    {
      onSuccess: (savedId) => {
        logger.debug('✅ Insights saved successfully:', savedId)
        setSavedInsightId(savedId)
        if (onInsightSaved) {
          onInsightSaved(savedId)
        }
      },
      onError: (error) => {
        logger.error('❌ Failed to save insights:', error)
        // Error will be displayed to user via useAsyncOperation error state
      }
    }
  )

  // Web Worker integration for premium performance
  // Note: useAIWorker called for side effects only (worker initialization)
  useAIWorker()

  // ✅ CRITICAL FIX: Move function declaration BEFORE useEffect that calls it
  // This prevents "Cannot access variable before it is declared" error
  const loadProjectFiles = async () => {
    if (!currentProject?.id) {
      logger.debug('📁 No current project ID, skipping file load')
      return
    }

    try {
      logger.debug('📁 Loading project files from backend for project:', { projectId: currentProject.id })
      const files = await FileService.getProjectFiles(currentProject.id)
      logger.debug('📁 Files loaded from backend:', { fileCount: files.length })

      // Log each file to see what we have
      files.forEach((file: ProjectFile, index: number) => {
        logger.debug(`📄 File ${index + 1}: ${file.name} (${file.file_type}) - content_preview: ${file.content_preview ? 'YES' : 'NO'}`)
        if (file.content_preview) {
          logger.debug(`📝 Content preview length: ${file.content_preview.length} characters`)
        }
      })

      // Include ALL uploaded files for AI analysis display
      // Multi-modal processing handles images, audio, video even without content_preview
      const allUploadedFiles = files.filter(file =>
        file.name && file.file_type // Just need basic file info
      )
      setFilesWithContent(allUploadedFiles)

      logger.debug('📁 FINAL RESULT: Loaded project files:', { totalFiles: files.length, filesForAnalysis: allUploadedFiles.length })

      if (allUploadedFiles.length > 0) {
        logger.debug('✅ ALL FILES FOUND FOR AI ANALYSIS - should show in UI!')
        allUploadedFiles.forEach((file: ProjectFile, index: number) => {
          logger.debug(`✅ File ${index + 1}: ${file.name} (${file.file_type})`)
          if (file.content_preview) {
            logger.debug(`📝 File ${index + 1} has content preview: ${file.content_preview.length} chars`)
          } else if (file.file_type?.startsWith('image/')) {
            logger.debug(`🖼️ File ${index + 1} is image - will be analyzed with GPT-4V`)
          } else if (file.file_type?.startsWith('audio/') || file.file_type?.startsWith('video/')) {
            logger.debug(`🎵 File ${index + 1} is audio/video - will be transcribed with Whisper`)
          }
        })

        // Also log for debugging
        logger.debug('Files prepared for analysis', {
          fileCount: allUploadedFiles.length,
          fileNames: allUploadedFiles.map(f => f.name),
          fileTypes: allUploadedFiles.map(f => f.file_type)
        })
      } else {
        logger.warn('No files found for project', {
          projectId: currentProject?.id,
          projectName: currentProject?.name
        })
      }
    } catch (_error) {
      logger.warn('Could not load project files from backend:', { error })
    }
  }

  useEffect(() => {
    // Only run when modal is opened and we have ideas or are loading historical insight
    if (!isOpen) {
      logger.debug('🎭 AIInsightsModal: Modal not open, skipping effect')
      return
    }

    logger.debug('🎭 AIInsightsModal: Effect triggered', {
      isOpen,
      selectedInsightId,
      ideasLength: ideas.length,
      insightsLoading: insightsOperation.state.loading,
      insightsData: !!insightsOperation.state.data,
      historicalLoading: historicalOperation.state.loading,
      historicalData: !!historicalOperation.state.data
    })

    // ✅ CRITICAL FIX: Use setTimeout(0) to prevent cascading renders
    // Load project files first
    setTimeout(() => {
      loadProjectFiles()
    }, 0)

    if (selectedInsightId) {
      // Load historical insight - only if not already loading/loaded
      if (!historicalOperation.state.loading && !historicalOperation.state.data) {
        logger.debug('🎭 AIInsightsModal: Loading historical insight:', { selectedInsightId })
        historicalOperation.execute(selectedInsightId)
      } else {
        logger.debug('🎭 AIInsightsModal: Historical insight already loading/loaded, skipping')
      }
    } else {
      // Generate new insights - only if we have ideas and not already loading/loaded
      if (ideas.length > 0 && !insightsOperation.state.loading && !insightsOperation.state.data) {
        logger.debug('🎭 AIInsightsModal: Generating new insights for ideas', { ideaCount: ideas.length })
        insightsOperation.execute()
      } else {
        logger.debug('🎭 AIInsightsModal: New insights already loading/loaded or no ideas, skipping')
      }
    }
  }, [isOpen, selectedInsightId, ideas.length])

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      logger.debug('🎭 AIInsightsModal: Modal closed, resetting all states')
      // Reset async operations
      insightsOperation.reset()
      historicalOperation.reset()
      saveOperation.reset()

      // ✅ CRITICAL FIX: Use setTimeout(0) to prevent cascading renders
      setTimeout(() => {
        // Reset progress tracking
        setAiProgress(0)
        setAiStage('analyzing')
        setProcessingSteps([])
        setEstimatedTime(0)
        setSavedInsightId(null)
      }, 0)
    }
  }, [isOpen])


  const handleDownloadPDF = async () => {
    const insights = insightsOperation.state.data || historicalOperation.state.data
    if (insights) {
      try {
        await exportGraphicalInsightsToPDF(insights, currentProject?.name)
      } catch (_error) {
        logger.error('PDF export failed', error, {
          ideaCount: (ideas || []).length,
          fileCount: filesWithContent.length,
          projectId: currentProject?.id
        })
        alert('PDF export failed. Please try again.')
      }
    }
  }

  // Create custom title component with icon and subtitle
  const modalTitle = (
    <div className="flex items-center space-x-3">
      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--sapphire-100)' }}>
        <Sparkles className="w-5 h-5" style={{ color: 'var(--sapphire-600)' }} />
      </div>
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--graphite-900)' }}>
          {historicalOperation.state.data ? 'Historical AI Insights' : 'AI Strategic Insights'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--graphite-600)' }}>
          {historicalOperation.state.data ? 'Previously generated analysis' : `Analysis of ${(ideas || []).length} ideas in your priority matrix`}
          {!historicalOperation.state.data && filesWithContent.length > 0 && (
            <span className="block mt-1">
              🔍 Informed by {filesWithContent.length} document{filesWithContent.length !== 1 ? 's' : ''}: {' '}
              {filesWithContent.slice(0, 3).map(file => file.original_name).join(', ')}
              {filesWithContent.length > 3 && ` and ${filesWithContent.length - 3} more`}
            </span>
          )}
        </p>
      </div>
    </div>
  )

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      showCloseButton={false}
    >
      <div style={{ backgroundColor: 'var(--surface-primary)' }}>
        {/* Custom header with icon and subtitle */}
        <div className="p-6 border-b" style={{
          borderColor: 'var(--hairline-default)',
          backgroundColor: 'var(--canvas-secondary)'
        }}>
          <div className="flex items-center justify-between">
            {modalTitle}
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
            >
              ✕
            </Button>
          </div>
        </div>

        {/* File References Section */}
        {!historicalOperation.state.data && filesWithContent.length > 0 && (
          <div className="px-6 py-4 border-b" style={{
            backgroundColor: 'var(--sapphire-50)',
            borderColor: 'var(--sapphire-100)'
          }}>
            <div className="flex items-start space-x-3">
              <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--sapphire-600)' }} />
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--sapphire-900)' }}>Document Analysis Sources</h3>
                <div className="flex flex-wrap gap-2">
                  {filesWithContent.map((file, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 text-xs rounded-full border"
                      style={{
                        backgroundColor: 'var(--surface-primary)',
                        color: 'var(--sapphire-800)',
                        borderColor: 'var(--sapphire-200)'
                      }}
                    >
                      <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--sapphire-400)' }}></span>
                      {file.original_name}
                      <span className="ml-1" style={{ color: 'var(--sapphire-600)' }}>({file.file_type})</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--sapphire-700)' }}>
                  These documents were analyzed to provide contextual insights and recommendations for your project.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {(insightsOperation.state.loading || historicalOperation.state.loading) && (
            <div className="py-8">
              {/* Premium AI Processing Interface */}
              <div className="max-w-2xl mx-auto">
                {/* Main Progress Bar */}
                <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'var(--canvas-secondary)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Sparkles className="w-6 h-6 animate-spin" style={{ color: 'var(--sapphire-600)' }} />
                        <div className="absolute inset-0 rounded-full animate-pulse" style={{
                          backgroundColor: 'var(--sapphire-600)',
                          opacity: 0.2
                        }}></div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold capitalize" style={{ color: 'var(--graphite-900)' }}>
                          {aiStage === 'analyzing' && '🔍 Analyzing Ideas'}
                          {aiStage === 'synthesizing' && '🧠 Synthesizing Insights'}
                          {aiStage === 'optimizing' && '⚡ Optimizing Recommendations'}
                          {aiStage === 'finalizing' && '✨ Finalizing Report'}
                          {aiStage === 'complete' && '✅ Complete!'}
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--graphite-600)' }}>
                          {estimatedTime > 0 ? `~${estimatedTime} seconds remaining` : 'Almost done...'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: 'var(--sapphire-600)' }}>{Math.round(aiProgress)}%</div>
                    </div>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: 'var(--graphite-200)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out relative"
                      style={{
                        width: `${aiProgress}%`,
                        backgroundColor: 'var(--sapphire-600)'
                      }}
                    >
                      <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
                    </div>
                  </div>
                </div>
                
                {/* Processing Steps */}
                <div className="rounded-xl border p-4" style={{
                  backgroundColor: 'var(--surface-primary)',
                  borderColor: 'var(--hairline-default)'
                }}>
                  <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--graphite-700)' }}>AI Processing Steps</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {processingSteps.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 text-sm transition-all duration-300"
                        style={{
                          color: index === processingSteps.length - 1 ? 'var(--sapphire-600)' : 'var(--graphite-500)',
                          fontWeight: index === processingSteps.length - 1 ? 500 : 400
                        }}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${index === processingSteps.length - 1 ? 'animate-pulse' : ''}`}
                          style={{
                            backgroundColor: index === processingSteps.length - 1
                              ? 'var(--sapphire-500)'
                              : 'var(--graphite-300)'
                          }}
                        ></div>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Stage Indicators */}
                <div className="flex justify-center space-x-4 mt-6">
                  {['analyzing', 'synthesizing', 'optimizing', 'finalizing'].map((stage, index) => {
                    const isActive = aiStage === stage
                    const isComplete = ['analyzing', 'synthesizing', 'optimizing', 'finalizing'].indexOf(aiStage) > index

                    return (
                      <div
                        key={stage}
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${
                          isActive ? 'scale-125 animate-pulse' : ''
                        }`}
                        style={{
                          backgroundColor: isActive
                            ? 'var(--sapphire-500)'
                            : isComplete
                            ? 'var(--emerald-500)'
                            : 'var(--graphite-300)'
                        }}
                      ></div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {(insightsOperation.state.error || historicalOperation.state.error) && (
            <div className="rounded-xl p-4 mb-6 border" style={{
              backgroundColor: 'var(--garnet-50)',
              borderColor: 'var(--garnet-200)'
            }}>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--garnet-600)' }} />
                <span className="font-medium" style={{ color: 'var(--garnet-800)' }}>Error</span>
              </div>
              <p className="mt-1" style={{ color: 'var(--garnet-700)' }}>{insightsOperation.state.error || historicalOperation.state.error}</p>
              <Button
                onClick={() => insightsOperation.execute()}
                variant="danger"
                className="mt-3"
              >
                Try Again
              </Button>
            </div>
          )}

          {(insightsOperation.state.data || historicalOperation.state.data) && (
            <div className="space-y-8">
              {/* Get the insights from either operation */}
              {(() => {
                const insights = insightsOperation.state.data || historicalOperation.state.data

                return (
                  <>
                    {/* Executive Summary */}
                    <div className="rounded-2xl p-6 border" style={{
                      backgroundColor: 'var(--canvas-secondary)',
                      borderColor: 'var(--hairline-default)'
                    }}>
                      <h3 className="text-lg font-semibold mb-3 flex items-center" style={{ color: 'var(--graphite-900)' }}>
                        <TrendingUp className="w-5 h-5 mr-2" style={{ color: 'var(--graphite-600)' }} />
                        Executive Summary
                      </h3>
                      <p className="leading-relaxed" style={{ color: 'var(--graphite-700)' }}>{insights?.executiveSummary}</p>
                    </div>

                    {/* Key Insights */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--graphite-900)' }}>
                        <Lightbulb className="w-5 h-5 mr-2" style={{ color: 'var(--amber-600)' }} />
                        Key Insights
                      </h3>
                      <div className="grid gap-4">
                        {(insights?.keyInsights || []).map((item: any, index: number) => (
                          <div key={index} className="lux-card">
                            <h4 className="font-semibold mb-2" style={{ color: 'var(--graphite-900)' }}>{item.insight}</h4>
                            <p className="text-sm" style={{ color: 'var(--graphite-600)' }}>{item.impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Priority Recommendations */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--graphite-900)' }}>
                        <Target className="w-5 h-5 mr-2" style={{ color: 'var(--sapphire-600)' }} />
                        Priority Recommendations
                      </h3>
                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="rounded-xl p-4 border" style={{
                          backgroundColor: 'var(--garnet-50)',
                          borderColor: 'var(--garnet-200)'
                        }}>
                          <h4 className="font-semibold mb-3" style={{ color: 'var(--garnet-800)' }}>🚨 Immediate (30 days)</h4>
                          <ul className="space-y-2">
                            {(insights?.priorityRecommendations?.immediate || []).map((item: string, index: number) => (
                              <li key={index} className="text-sm flex items-start" style={{ color: 'var(--garnet-700)' }}>
                                <CheckCircle className="w-3 h-3 mr-2 mt-0.5 flex-shrink-0" style={{ color: 'var(--garnet-600)' }} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-xl p-4 border" style={{
                          backgroundColor: 'var(--amber-50)',
                          borderColor: 'var(--amber-200)'
                        }}>
                          <h4 className="font-semibold mb-3" style={{ color: 'var(--amber-800)' }}>⏳ Short Term (3 months)</h4>
                          <ul className="space-y-2">
                            {(insights?.priorityRecommendations?.shortTerm || []).map((item: string, index: number) => (
                              <li key={index} className="text-sm flex items-start" style={{ color: 'var(--amber-700)' }}>
                                <CheckCircle className="w-3 h-3 mr-2 mt-0.5 flex-shrink-0" style={{ color: 'var(--amber-600)' }} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-xl p-4 border" style={{
                          backgroundColor: 'var(--sapphire-50)',
                          borderColor: 'var(--sapphire-200)'
                        }}>
                          <h4 className="font-semibold mb-3" style={{ color: 'var(--sapphire-800)' }}>🎯 Long Term (6-12 months)</h4>
                          <ul className="space-y-2">
                            {(insights?.priorityRecommendations?.longTerm || []).map((item: string, index: number) => (
                              <li key={index} className="text-sm flex items-start" style={{ color: 'var(--sapphire-700)' }}>
                                <CheckCircle className="w-3 h-3 mr-2 mt-0.5 flex-shrink-0" style={{ color: 'var(--sapphire-600)' }} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Risk Assessment */}
                    {insights?.riskAssessment && (
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="rounded-xl p-4 border" style={{
                          backgroundColor: 'var(--garnet-50)',
                          borderColor: 'var(--garnet-200)'
                        }}>
                          <h4 className="font-semibold mb-3 flex items-center" style={{ color: 'var(--garnet-800)' }}>
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Risk Areas
                          </h4>
                          <ul className="space-y-2">
                            {(insights.riskAssessment?.risks || []).map((risk: string, index: number) => (
                              <li key={index} className="text-sm flex items-start" style={{ color: 'var(--garnet-700)' }}>
                                <div className="w-2 h-2 rounded-full mr-2 mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--garnet-400)' }}></div>
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-xl p-4 border" style={{
                          backgroundColor: 'var(--emerald-50)',
                          borderColor: 'var(--emerald-200)'
                        }}>
                          <h4 className="font-semibold mb-3 flex items-center" style={{ color: 'var(--emerald-800)' }}>
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Risk Mitigations
                          </h4>
                          <ul className="space-y-2">
                            {(insights.riskAssessment?.mitigations || []).map((mitigation: string, index: number) => (
                              <li key={index} className="text-sm flex items-start" style={{ color: 'var(--emerald-700)' }}>
                                <div className="w-2 h-2 rounded-full mr-2 mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--emerald-400)' }}></div>
                                {mitigation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}




                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6" style={{
          borderColor: 'var(--hairline-default)',
          backgroundColor: 'var(--canvas-secondary)'
        }}>
          <div className="flex justify-between items-center">
            <p className="text-sm" style={{ color: 'var(--graphite-500)' }}>
              {historicalOperation.state.data ? 'Historical insight' : 'Generated by AI'} • Analysis based on {historicalOperation.state.data ? 'saved data' : (ideas || []).length + ' ideas'}
              {!historicalOperation.state.data && filesWithContent.length > 0 && ` • ${filesWithContent.length} document${filesWithContent.length !== 1 ? 's' : ''} analyzed`}
            </p>
            <div className="flex space-x-3">
              {(insightsOperation.state.data || historicalOperation.state.data) && !historicalOperation.state.data && !savedInsightId && (
                <Button
                  onClick={() => saveOperation.execute(insightsOperation.state.data!)}
                  disabled={saveOperation.state.loading}
                  variant="success"
                  icon={<Save className="w-4 h-4" />}
                >
                  {saveOperation.state.loading ? 'Saving...' : 'Save Insights'}
                </Button>
              )}
              {(insightsOperation.state.data || historicalOperation.state.data) && (
                <Button
                  onClick={handleDownloadPDF}
                  variant="sapphire"
                  icon={<Download className="w-4 h-4" />}
                >
                  Download PDF
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="primary"
              >
                Close Report
              </Button>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

export default AIInsightsModal