import { useState, useEffect, useTransition, startTransition } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, TrendingUp, Target, CheckCircle, AlertTriangle, Calendar, Users, Lightbulb, Download, Save, FileText } from 'lucide-react'
import { IdeaCard, Project, ProjectFile } from '../types'
import { aiService } from '../lib/aiService'
import { DatabaseService } from '../lib/database'
import { FileService } from '../lib/fileService'
import { exportInsightsToPDFProfessional } from '../utils/pdfExportSimple'
import { useAIWorker } from '../hooks/useAIWorker'
import { logger } from '../utils/logger'

interface AIInsightsModalProps {
  ideas: IdeaCard[]
  currentProject: Project | null
  selectedInsightId?: string
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
  riskAssessment: {
    highRisk: string[]
    opportunities: string[]
  }
  suggestedRoadmap: Array<{
    phase: string
    duration: string
    focus: string
    ideas: string[]
  }>
  resourceAllocation: {
    quickWins: string
    strategic: string
  }
  futureEnhancements: Array<{
    title: string
    description: string
    relatedIdea?: string
    impact: 'high' | 'medium' | 'low'
    timeframe: string
  }>
  nextSteps: string[]
}

const AIInsightsModal: React.FC<AIInsightsModalProps> = ({ ideas, currentProject, selectedInsightId, onClose, onInsightSaved }) => {
  
  // Premium AI experience state management
  const [isLoading, setIsLoading] = useState(true)
  const [insights, setInsights] = useState<InsightsReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isHistorical, setIsHistorical] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedInsightId, setSavedInsightId] = useState<string | null>(null)
  const [filesWithContent, setFilesWithContent] = useState<ProjectFile[]>([])
  
  // React 19 Concurrent Features for premium experience
  const [, startTransition] = useTransition()
  const [aiProgress, setAiProgress] = useState(0)
  const [aiStage, setAiStage] = useState<'analyzing' | 'synthesizing' | 'optimizing' | 'finalizing' | 'complete'>('analyzing')
  const [processingSteps, setProcessingSteps] = useState<string[]>([])
  const [estimatedTime, setEstimatedTime] = useState<number>(0)
  const [useWorker, setUseWorker] = useState(true)
  const [workerRequestId, setWorkerRequestId] = useState<string | null>(null)
  
  // Web Worker integration for premium performance
  const { generateInsights: generateInsightsWorker, isWorkerAvailable, cancelRequest } = useAIWorker()

  useEffect(() => {
    // Load project files first
    loadProjectFiles()
    
    if (selectedInsightId) {
      // Load historical insight
      loadHistoricalInsight(selectedInsightId)
    } else {
      // Generate new insights
      generateInsights()
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
      
      // Filter files that have content available for AI analysis
      const filesWithExtractedContent = files.filter(file => 
        file.content_preview && file.content_preview.trim()
      )
      setFilesWithContent(filesWithExtractedContent)
      
      logger.debug('📁 FINAL RESULT: Loaded project files:', files.length, 'total,', filesWithExtractedContent.length, 'with content')
      
      if (filesWithExtractedContent.length > 0) {
        logger.debug('✅ FILES WITH CONTENT FOUND - should show in UI!')
        filesWithExtractedContent.forEach((file: ProjectFile, index: number) => {
          logger.debug(`✅ File ${index + 1} with content: ${file.name}`)
          logger.debug(`📝 File ${index + 1} content preview: "${file.content_preview?.substring(0, 200)}..."`)
        })
        
        // Also log to console for easier debugging
        console.log('🎯 AI INSIGHTS: Files with content found:', filesWithExtractedContent.length)
        console.log('🎯 AI INSIGHTS: File names:', filesWithExtractedContent.map(f => f.name))
      } else {
        logger.warn('❌ NO FILES WITH CONTENT FOUND - file references will not show')
        console.warn('🎯 AI INSIGHTS: No files with content found for project:', currentProject?.id)
      }
    } catch (error) {
      logger.warn('Could not load project files from backend:', error)
    }
  }

  const loadHistoricalInsight = async (insightId: string) => {
    setIsLoading(true)
    setError(null)
    setIsHistorical(true)
    
    try {
      logger.debug('📊 Loading historical insight:', insightId)
      const historicalInsight = await DatabaseService.getProjectInsight(insightId)
      
      if (historicalInsight) {
        setInsights(historicalInsight.insights_data)
        setSavedInsightId(insightId)
        logger.debug('✅ Loaded historical insight successfully')
      } else {
        throw new Error('Insight not found')
      }
    } catch (err) {
      logger.error('Error loading historical insight:', err)
      setError('Failed to load historical insight. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const generateInsights = async () => {
    setError(null)
    setIsHistorical(false)
    
    // Start the premium AI processing experience
    startTransition(() => {
      setIsLoading(true)
      setAiProgress(0)
      setAiStage('analyzing')
      setProcessingSteps([])
      setEstimatedTime(15) // Start with 15 second estimate
    })
    
    try {
      logger.debug('🔍 Generating AI insights for', (ideas || []).length, 'ideas...')
      
      // Stage 1: Analysis (0-25%)
      startTransition(() => {
        setAiStage('analyzing')
        setAiProgress(5)
        setProcessingSteps(['🔍 Analyzing idea patterns and relationships'])
        setEstimatedTime(12)
      })
      
      // Simulate progressive analysis steps
      await new Promise(resolve => setTimeout(resolve, 800))
      startTransition(() => {
        setAiProgress(15)
        setProcessingSteps(prev => [...prev, '📊 Evaluating priority and impact scores'])
        setEstimatedTime(10)
      })
      
      await new Promise(resolve => setTimeout(resolve, 600))
      startTransition(() => {
        setAiProgress(25)
        setProcessingSteps(prev => [...prev, '🎯 Identifying strategic patterns'])
        setEstimatedTime(8)
      })
      
      // Stage 2: Synthesis (25-50%)
      startTransition(() => {
        setAiStage('synthesizing')
        setAiProgress(30)
        setProcessingSteps(prev => [...prev, '🧠 Synthesizing insights from analysis'])
        setEstimatedTime(7)
      })
      
      await new Promise(resolve => setTimeout(resolve, 700))
      startTransition(() => {
        setAiProgress(40)
        setProcessingSteps(prev => [...prev, '🔗 Connecting themes and opportunities'])
        setEstimatedTime(5)
      })
      
      await new Promise(resolve => setTimeout(resolve, 500))
      startTransition(() => {
        setAiProgress(50)
        setProcessingSteps(prev => [...prev, '📈 Generating strategic recommendations'])
        setEstimatedTime(4)
      })
      
      // Stage 3: Optimization (50-75%)
      startTransition(() => {
        setAiStage('optimizing')
        setAiProgress(55)
        setProcessingSteps(prev => [...prev, '⚡ Optimizing recommendation priorities'])
        setEstimatedTime(3)
      })
      
      // Call the actual AI service
      const report = await aiService.generateInsights(
        ideas, 
        currentProject?.name, 
        currentProject?.project_type, 
        currentProject?.id,
        currentProject
      )
      
      await new Promise(resolve => setTimeout(resolve, 400))
      startTransition(() => {
        setAiProgress(70)
        setProcessingSteps(prev => [...prev, '🎨 Formatting insights and roadmap'])
        setEstimatedTime(2)
      })
      
      // Stage 4: Finalizing (75-100%)
      startTransition(() => {
        setAiStage('finalizing')
        setAiProgress(80)
        setProcessingSteps(prev => [...prev, '✨ Finalizing report structure'])
        setEstimatedTime(1)
      })
      
      await new Promise(resolve => setTimeout(resolve, 300))
      startTransition(() => {
        setAiProgress(90)
        setProcessingSteps(prev => [...prev, '🎯 Applying final optimizations'])
        setEstimatedTime(0)
      })
      
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Complete the process
      startTransition(() => {
        setAiProgress(100)
        setAiStage('complete')
        setProcessingSteps(prev => [...prev, '✅ AI insights generated successfully!'])
        setInsights(report)
        setIsLoading(false)
      })
      
    } catch (err) {
      logger.error('Error generating insights:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate insights. Please try again.'
      
      startTransition(() => {
        setError(errorMessage)
        setIsLoading(false)
        setAiProgress(0)
        setProcessingSteps([])
      })
    }
  }

  const saveInsights = async () => {
    if (!insights || !currentProject || savedInsightId) return
    
    setIsSaving(true)
    try {
      const savedId = await DatabaseService.saveProjectInsights(
        currentProject.id,
        insights,
        currentProject.owner?.id || 'unknown',
        (ideas || []).length
      )
      
      if (savedId) {
        setSavedInsightId(savedId)
        onInsightSaved?.(savedId)
        logger.debug('✅ Insights saved successfully:', savedId)
      }
    } catch (error) {
      logger.error('Error saving insights:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (insights) {
      try {
        await exportInsightsToPDFProfessional(insights, (ideas || []).length, currentProject, filesWithContent)
      } catch (error) {
        console.error('PDF export failed:', error)
        alert('PDF export failed. Please try again.')
      }
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isHistorical ? 'Historical AI Insights' : 'AI Strategic Insights'}
              </h2>
              <p className="text-sm text-gray-600">
                {isHistorical ? 'Previously generated analysis' : `Analysis of ${(ideas || []).length} ideas in your priority matrix`}
                {!isHistorical && filesWithContent.length > 0 && (
                  <span className="block mt-1">
                    🔍 Informed by {filesWithContent.length} document{filesWithContent.length !== 1 ? 's' : ''}: {' '}
                    {filesWithContent.slice(0, 3).map(file => file.original_name).join(', ')}
                    {filesWithContent.length > 3 && ` and ${filesWithContent.length - 3} more`}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File References Section */}
        {!isHistorical && filesWithContent.length > 0 && (
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
          {isLoading && (
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">Error</span>
              </div>
              <p className="text-red-700 mt-1">{error}</p>
              <button 
                onClick={generateInsights}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {insights && (
            <div className="space-y-8">
              {/* Executive Summary */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-slate-600" />
                  Executive Summary
                </h3>
                <p className="text-slate-700 leading-relaxed">{insights.executiveSummary}</p>
              </div>

              {/* Key Insights */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2 text-amber-600" />
                  Key Insights
                </h3>
                <div className="grid gap-4">
                  {(insights.keyInsights || []).map((item, index) => (
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
                      {(insights.priorityRecommendations?.immediate || []).map((item, index) => (
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
                      {(insights.priorityRecommendations?.shortTerm || []).map((item, index) => (
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
                      {(insights.priorityRecommendations?.longTerm || []).map((item, index) => (
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
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <h4 className="font-semibold text-red-800 mb-3 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    High Risk Areas
                  </h4>
                  <ul className="space-y-2">
                    {(insights.riskAssessment?.highRisk || []).map((risk, index) => (
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
                    Key Opportunities
                  </h4>
                  <ul className="space-y-2">
                    {(insights.riskAssessment?.opportunities || []).map((opportunity, index) => (
                      <li key={index} className="text-sm text-emerald-700 flex items-start">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 mt-1.5 flex-shrink-0"></div>
                        {opportunity}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Suggested Roadmap */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                  Suggested Implementation Roadmap
                </h3>
                <div className="space-y-4">
                  {(insights.suggestedRoadmap || []).map((phase, index) => (
                    <div key={index} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{phase.phase}</h4>
                          <span className="text-sm text-purple-600 font-medium">{phase.duration}</span>
                        </div>
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-700 font-semibold text-sm">{index + 1}</span>
                        </div>
                      </div>
                      <p className="text-gray-700 mb-3">{phase.focus}</p>
                      <div className="flex flex-wrap gap-2">
                        {(phase.ideas || []).map((idea, ideaIndex) => (
                          <span key={ideaIndex} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                            {idea}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resource Allocation */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-green-600" />
                  Resource Allocation Recommendations
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                    <h4 className="font-semibold text-emerald-800 mb-2">Quick Wins Strategy</h4>
                    <p className="text-sm text-emerald-700">{insights.resourceAllocation?.quickWins || 'No quick wins strategy defined'}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">Strategic Initiatives</h4>
                    <p className="text-sm text-blue-700">{insights.resourceAllocation?.strategic || 'No strategic recommendations defined'}</p>
                  </div>
                </div>
              </div>

              {/* Future Enhancements */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2 text-yellow-600" />
                  Future Enhancement Opportunities
                </h3>
                <div className="grid gap-4">
                  {(insights.futureEnhancements || []).map((enhancement, index) => (
                    <div key={index} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{enhancement.title}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            enhancement.impact === 'high' ? 'bg-red-100 text-red-800' :
                            enhancement.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {enhancement.impact} impact
                          </span>
                          <span className="text-xs text-purple-600 font-medium">{enhancement.timeframe}</span>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{enhancement.description}</p>
                      {enhancement.relatedIdea && (
                        <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block">
                          Related to: {enhancement.relatedIdea}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Immediate Next Steps
                </h3>
                <div className="grid gap-3">
                  {(insights.nextSteps || []).map((step, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                        <span className="text-green-700 font-semibold text-xs">{index + 1}</span>
                      </div>
                      <span className="text-gray-700">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {isHistorical ? 'Historical insight' : 'Generated by AI'} • Analysis based on {isHistorical ? 'saved data' : (ideas || []).length + ' ideas'}
              {!isHistorical && filesWithContent.length > 0 && ` • ${filesWithContent.length} document${filesWithContent.length !== 1 ? 's' : ''} analyzed`}
            </p>
            <div className="flex space-x-3">
              {insights && !isHistorical && !savedInsightId && (
                <button
                  onClick={saveInsights}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Insights'}</span>
                </button>
              )}
              {insights && (
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
    </div>,
    document.body
  )
}

export default AIInsightsModal