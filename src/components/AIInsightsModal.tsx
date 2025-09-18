import { useState, useEffect, useTransition } from 'react'
import { Sparkles, TrendingUp, Target, CheckCircle, AlertTriangle, Download, Save, FileText, Lightbulb } from 'lucide-react'
import { IdeaCard, Project, ProjectFile } from '../types'
import { aiInsightsService } from '../lib/ai/aiInsightsService'
import { OpenAIModel } from '../lib/ai/openaiModelRouter'
import { FileService } from '../lib/fileService'
import { exportInsightsToPDFProfessional } from '../utils/pdfExportSimple'
import { useAIWorker } from '../hooks/useAIWorker'
import { useAsyncOperation } from '../hooks/shared/useAsyncOperation'
import { BaseModal } from './shared/Modal'
import { ProjectRepository } from '../lib/repositories'
import { logger } from '../utils/logger'

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
      logger.debug('🔍 Generating AI insights for', (ideas || []).length, 'ideas...')

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
      logger.debug('📊 Loading historical insight:', insightId)
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

      const savedId = await ProjectRepository.saveProjectInsights(
        currentProject.id,
        insights,
        currentProject.owner_id || 'unknown',
        (ideas || []).length
      )

      if (!savedId) {
        throw new Error('Failed to save insights')
      }

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
      onError: (error) => logger.error('Failed to save insights:', error)
    }
  )

  // Web Worker integration for premium performance
  const { } = useAIWorker()

  useEffect(() => {
    // Load project files first
    loadProjectFiles()

    if (selectedInsightId) {
      // Load historical insight
      historicalOperation.execute(selectedInsightId)
    } else {
      // Generate new insights
      insightsOperation.execute()
    }
  }, [ideas, selectedInsightId])

  const loadProjectFiles = async () => {
    if (!currentProject?.id) {
      logger.debug('📁 No current project ID, skipping file load')
      return
    }
    
    try {
      logger.debug('📁 Loading project files from backend for project:', currentProject.id)
      const files = await FileService.getProjectFiles(currentProject.id)
      logger.debug('📁 Files loaded from backend:', files.length, 'total')
      
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
      
      logger.debug('📁 FINAL RESULT: Loaded project files:', files.length, 'total,', allUploadedFiles.length, 'for AI analysis')
      
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
        
        // Also log to console for easier debugging
        console.log('🎯 AI INSIGHTS: All files for analysis:', allUploadedFiles.length)
        console.log('🎯 AI INSIGHTS: File names:', allUploadedFiles.map(f => f.name))
        console.log('🎯 AI INSIGHTS: File types:', allUploadedFiles.map(f => f.file_type))
      } else {
        logger.warn('❌ NO FILES FOUND - file references will not show')
        console.warn('🎯 AI INSIGHTS: No files found for project:', currentProject?.id)
      }
    } catch (error) {
      logger.warn('Could not load project files from backend:', error)
    }
  }


  const handleDownloadPDF = async () => {
    const insights = insightsOperation.state.data || historicalOperation.state.data
    if (insights) {
      try {
        await exportInsightsToPDFProfessional(insights, (ideas || []).length, currentProject, filesWithContent)
      } catch (error) {
        console.error('PDF export failed:', error)
        alert('PDF export failed. Please try again.')
      }
    }
  }

  // Create custom title component with icon and subtitle
  const modalTitle = (
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {historicalOperation.state.data ? 'Historical AI Insights' : 'AI Strategic Insights'}
        </h2>
        <p className="text-sm text-gray-600">
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
      <div className="bg-white">
        {/* Custom header with icon and subtitle */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            {modalTitle}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* File References Section */}
        {!historicalOperation.state.data && filesWithContent.length > 0 && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <div className="flex items-start space-x-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Document Analysis Sources</h3>
                <div className="flex flex-wrap gap-2">
                  {filesWithContent.map((file, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-white text-blue-800 text-xs rounded-full border border-blue-200"
                    >
                      <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                      {file.original_name}
                      <span className="ml-1 text-blue-600">({file.file_type})</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-blue-700 mt-2">
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
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Sparkles className="w-6 h-6 text-purple-600 animate-spin" />
                        <div className="absolute inset-0 bg-purple-600 opacity-20 rounded-full animate-pulse"></div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 capitalize">
                          {aiStage === 'analyzing' && '🔍 Analyzing Ideas'}
                          {aiStage === 'synthesizing' && '🧠 Synthesizing Insights'}
                          {aiStage === 'optimizing' && '⚡ Optimizing Recommendations'}
                          {aiStage === 'finalizing' && '✨ Finalizing Report'}
                          {aiStage === 'complete' && '✅ Complete!'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {estimatedTime > 0 ? `~${estimatedTime} seconds remaining` : 'Almost done...'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">{Math.round(aiProgress)}%</div>
                    </div>
                  </div>
                  
                  {/* Animated Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500 ease-out relative"
                      style={{ width: `${aiProgress}%` }}
                    >
                      <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
                    </div>
                  </div>
                </div>
                
                {/* Processing Steps */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">AI Processing Steps</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {processingSteps.map((step, index) => (
                      <div 
                        key={index}
                        className={`flex items-center space-x-2 text-sm transition-all duration-300 ${
                          index === processingSteps.length - 1 
                            ? 'text-purple-600 font-medium' 
                            : 'text-gray-500'
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          index === processingSteps.length - 1
                            ? 'bg-purple-500 animate-pulse'
                            : 'bg-gray-300'
                        }`}></div>
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
                          isActive 
                            ? 'bg-purple-500 scale-125 animate-pulse' 
                            : isComplete 
                            ? 'bg-green-500' 
                            : 'bg-gray-300'
                        }`}
                      ></div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {(insightsOperation.state.error || historicalOperation.state.error) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">Error</span>
              </div>
              <p className="text-red-700 mt-1">{insightsOperation.state.error || historicalOperation.state.error}</p>
              <button
                onClick={() => insightsOperation.execute()}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
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
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-slate-600" />
                        Executive Summary
                      </h3>
                      <p className="text-slate-700 leading-relaxed">{insights?.executiveSummary}</p>
                    </div>

                    {/* Key Insights */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Lightbulb className="w-5 h-5 mr-2 text-amber-600" />
                        Key Insights
                      </h3>
                      <div className="grid gap-4">
                        {(insights?.keyInsights || []).map((item: any, index: number) => (
                          <div key={index} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-2">{item.insight}</h4>
                            <p className="text-gray-600 text-sm">{item.impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Priority Recommendations */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Target className="w-5 h-5 mr-2 text-blue-600" />
                        Priority Recommendations
                      </h3>
                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                          <h4 className="font-semibold text-red-800 mb-3">🚨 Immediate (30 days)</h4>
                          <ul className="space-y-2">
                            {(insights?.priorityRecommendations?.immediate || []).map((item: string, index: number) => (
                              <li key={index} className="text-sm text-red-700 flex items-start">
                                <CheckCircle className="w-3 h-3 mr-2 mt-0.5 text-red-600 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                          <h4 className="font-semibold text-amber-800 mb-3">⏳ Short Term (3 months)</h4>
                          <ul className="space-y-2">
                            {(insights?.priorityRecommendations?.shortTerm || []).map((item: string, index: number) => (
                              <li key={index} className="text-sm text-amber-700 flex items-start">
                                <CheckCircle className="w-3 h-3 mr-2 mt-0.5 text-amber-600 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                          <h4 className="font-semibold text-blue-800 mb-3">🎯 Long Term (6-12 months)</h4>
                          <ul className="space-y-2">
                            {(insights?.priorityRecommendations?.longTerm || []).map((item: string, index: number) => (
                              <li key={index} className="text-sm text-blue-700 flex items-start">
                                <CheckCircle className="w-3 h-3 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
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
                        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                          <h4 className="font-semibold text-red-800 mb-3 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Risk Areas
                          </h4>
                          <ul className="space-y-2">
                            {(insights.riskAssessment?.risks || []).map((risk: string, index: number) => (
                              <li key={index} className="text-sm text-red-700 flex items-start">
                                <div className="w-2 h-2 bg-red-400 rounded-full mr-2 mt-1.5 flex-shrink-0"></div>
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                          <h4 className="font-semibold text-emerald-800 mb-3 flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Risk Mitigations
                          </h4>
                          <ul className="space-y-2">
                            {(insights.riskAssessment?.mitigations || []).map((mitigation: string, index: number) => (
                              <li key={index} className="text-sm text-emerald-700 flex items-start">
                                <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 mt-1.5 flex-shrink-0"></div>
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
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {historicalOperation.state.data ? 'Historical insight' : 'Generated by AI'} • Analysis based on {historicalOperation.state.data ? 'saved data' : (ideas || []).length + ' ideas'}
              {!historicalOperation.state.data && filesWithContent.length > 0 && ` • ${filesWithContent.length} document${filesWithContent.length !== 1 ? 's' : ''} analyzed`}
            </p>
            <div className="flex space-x-3">
              {(insightsOperation.state.data || historicalOperation.state.data) && !historicalOperation.state.data && !savedInsightId && (
                <button
                  onClick={() => saveOperation.execute(insightsOperation.state.data!)}
                  disabled={saveOperation.state.loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveOperation.state.loading ? 'Saving...' : 'Save Insights'}</span>
                </button>
              )}
              {(insightsOperation.state.data || historicalOperation.state.data) && (
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

export default AIInsightsModal