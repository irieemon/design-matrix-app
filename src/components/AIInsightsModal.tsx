import { useState, useEffect } from 'react'
import { X, Sparkles, TrendingUp, Target, CheckCircle, AlertTriangle, Calendar, Users, Lightbulb, Download, Save, FileText } from 'lucide-react'
import { IdeaCard, Project, ProjectFile } from '../types'
import { aiService } from '../lib/aiService'
import { DatabaseService } from '../lib/database'
import { FileService } from '../lib/fileService'
import { exportInsightsToPDF } from '../utils/pdfExportSimple'
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
  
  const [isLoading, setIsLoading] = useState(true)
  const [insights, setInsights] = useState<InsightsReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isHistorical, setIsHistorical] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedInsightId, setSavedInsightId] = useState<string | null>(null)
  const [filesWithContent, setFilesWithContent] = useState<ProjectFile[]>([])

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
    setIsLoading(true)
    setError(null)
    setIsHistorical(false)
    
    try {
      logger.debug('🔍 Generating AI insights for', (ideas || []).length, 'ideas...')
      const report = await aiService.generateInsights(
        ideas, 
        currentProject?.name, 
        currentProject?.project_type, 
        currentProject?.id,
        currentProject
      )
      setInsights(report)
    } catch (err) {
      logger.error('Error generating insights:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate insights. Please try again.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
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

  const handleDownloadPDF = () => {
    if (insights) {
      exportInsightsToPDF(insights, (ideas || []).length, currentProject, filesWithContent)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        {/* Professional Document Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold">PRIORITAS</h1>
                <p className="text-blue-100 text-sm">Strategic Intelligence Platform</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-semibold">Strategic Insights Report</h2>
              <p className="text-blue-100 text-sm">{new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
            <button
              onClick={onClose}
              className="text-blue-100 hover:text-white transition-colors p-2 ml-4"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Project Title Section */}
        <div className="bg-gray-50 border-b-2 border-blue-600 p-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {currentProject?.name || 'Project Analysis'}
            </h1>
            <div className="w-32 h-1 bg-blue-600 mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Strategic Insights Report</p>
          </div>
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
        <div className="p-8">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-5 h-5 text-purple-600 animate-spin" />
                <span className="text-lg text-gray-600">Analyzing your ideas and generating strategic insights...</span>
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
            <div className="space-y-10">
              {/* Project Overview Section */}
              <div className="bg-white border-l-4 border-blue-600 shadow-sm">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">PROJECT OVERVIEW</h2>
                    <div className="w-16 h-0.5 bg-blue-600"></div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Project Name</h3>
                      <p className="text-lg font-medium text-gray-900">{currentProject?.name || 'Untitled Project'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Project Type</h3>
                      <p className="text-lg font-medium text-gray-900">{currentProject?.project_type || 'General'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Ideas Analyzed</h3>
                      <p className="text-lg font-medium text-gray-900">{(ideas || []).length} strategic initiatives</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Analysis Date</h3>
                      <p className="text-lg font-medium text-gray-900">{new Date().toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="bg-white border-l-4 border-green-600 shadow-sm">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                      <TrendingUp className="w-6 h-6 mr-3 text-green-600" />
                      EXECUTIVE SUMMARY
                    </h2>
                    <div className="w-16 h-0.5 bg-green-600"></div>
                  </div>
                  <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                    <p>{insights.executiveSummary}</p>
                  </div>
                </div>
              </div>

              {/* Key Insights */}
              <div className="bg-white border-l-4 border-amber-600 shadow-sm">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                      <Lightbulb className="w-6 h-6 mr-3 text-amber-600" />
                      KEY STRATEGIC INSIGHTS
                    </h2>
                    <div className="w-16 h-0.5 bg-amber-600"></div>
                  </div>
                  <div className="space-y-6">
                    {(insights.keyInsights || []).map((item, index) => (
                      <div key={index} className="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
                        <div className="flex items-start space-x-4">
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-amber-700 font-bold text-sm">{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.insight}</h3>
                            <p className="text-gray-700 leading-relaxed">{item.impact}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Priority Recommendations */}
              <div className="bg-white border-l-4 border-blue-600 shadow-sm">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                      <Target className="w-6 h-6 mr-3 text-blue-600" />
                      PRIORITY RECOMMENDATIONS
                    </h2>
                    <div className="w-16 h-0.5 bg-blue-600"></div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-red-50 rounded-lg border border-red-200">
                      <div className="p-5">
                        <div className="flex items-center mb-4">
                          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">!</span>
                          </div>
                          <h3 className="font-bold text-red-800">IMMEDIATE ACTIONS</h3>
                        </div>
                        <p className="text-xs text-red-600 font-medium mb-3 uppercase tracking-wide">30 Days</p>
                        <ul className="space-y-3">
                          {(insights.priorityRecommendations?.immediate || []).map((item, index) => (
                            <li key={index} className="text-sm text-red-700 flex items-start">
                              <div className="w-1.5 h-1.5 bg-red-600 rounded-full mr-3 mt-2 flex-shrink-0"></div>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-lg border border-amber-200">
                      <div className="p-5">
                        <div className="flex items-center mb-4">
                          <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">⏳</span>
                          </div>
                          <h3 className="font-bold text-amber-800">SHORT TERM</h3>
                        </div>
                        <p className="text-xs text-amber-600 font-medium mb-3 uppercase tracking-wide">3 Months</p>
                        <ul className="space-y-3">
                          {(insights.priorityRecommendations?.shortTerm || []).map((item, index) => (
                            <li key={index} className="text-sm text-amber-700 flex items-start">
                              <div className="w-1.5 h-1.5 bg-amber-600 rounded-full mr-3 mt-2 flex-shrink-0"></div>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg border border-blue-200">
                      <div className="p-5">
                        <div className="flex items-center mb-4">
                          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">🎯</span>
                          </div>
                          <h3 className="font-bold text-blue-800">LONG TERM</h3>
                        </div>
                        <p className="text-xs text-blue-600 font-medium mb-3 uppercase tracking-wide">6-12 Months</p>
                        <ul className="space-y-3">
                          {(insights.priorityRecommendations?.longTerm || []).map((item, index) => (
                            <li key={index} className="text-sm text-blue-700 flex items-start">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3 mt-2 flex-shrink-0"></div>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="bg-white border-l-4 border-purple-600 shadow-sm">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">RISK ASSESSMENT & OPPORTUNITIES</h2>
                    <div className="w-16 h-0.5 bg-purple-600"></div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <div className="flex items-center mb-4">
                        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center mr-3">
                          <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-red-800">HIGH RISK AREAS</h3>
                      </div>
                      <ul className="space-y-4">
                        {(insights.riskAssessment?.highRisk || []).map((risk, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                              <span className="text-red-700 font-bold text-xs">{index + 1}</span>
                            </div>
                            <span className="leading-relaxed">{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center mb-4">
                        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center mr-3">
                          <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-emerald-800">KEY OPPORTUNITIES</h3>
                      </div>
                      <ul className="space-y-4">
                        {(insights.riskAssessment?.opportunities || []).map((opportunity, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                              <span className="text-emerald-700 font-bold text-xs">{index + 1}</span>
                            </div>
                            <span className="leading-relaxed">{opportunity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Suggested Roadmap */}
              <div className="bg-white border-l-4 border-indigo-600 shadow-sm">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                      <Calendar className="w-6 h-6 mr-3 text-indigo-600" />
                      IMPLEMENTATION ROADMAP
                    </h2>
                    <div className="w-16 h-0.5 bg-indigo-600"></div>
                  </div>
                  <div className="space-y-6">
                    {(insights.suggestedRoadmap || []).map((phase, index) => (
                      <div key={index} className="relative">
                        {/* Timeline connector */}
                        {index < (insights.suggestedRoadmap || []).length - 1 && (
                          <div className="absolute left-6 top-16 w-0.5 h-8 bg-indigo-200"></div>
                        )}
                        <div className="flex items-start space-x-4">
                          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold">{index + 1}</span>
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-lg p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-lg font-bold text-gray-900">{phase.phase}</h3>
                                <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium px-3 py-1 rounded-full mt-1">{phase.duration}</span>
                              </div>
                            </div>
                            <p className="text-gray-700 mb-4 leading-relaxed">{phase.focus}</p>
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Related Initiatives</h4>
                              <div className="flex flex-wrap gap-2">
                                {(phase.ideas || []).map((idea, ideaIndex) => (
                                  <span key={ideaIndex} className="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-md text-sm">
                                    {idea}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resource Allocation */}
              <div className="bg-white border-l-4 border-green-600 shadow-sm">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                      <Users className="w-6 h-6 mr-3 text-green-600" />
                      RESOURCE ALLOCATION
                    </h2>
                    <div className="w-16 h-0.5 bg-green-600"></div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <div className="flex items-center mb-4">
                        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-white font-bold text-sm">Q</span>
                        </div>
                        <h3 className="text-lg font-bold text-emerald-800">QUICK WINS STRATEGY</h3>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-5 border border-emerald-200">
                        <p className="text-gray-700 leading-relaxed">{insights.resourceAllocation?.quickWins || 'No quick wins strategy defined'}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center mb-4">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-white font-bold text-sm">S</span>
                        </div>
                        <h3 className="text-lg font-bold text-blue-800">STRATEGIC INITIATIVES</h3>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                        <p className="text-gray-700 leading-relaxed">{insights.resourceAllocation?.strategic || 'No strategic recommendations defined'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Future Enhancements */}
              <div className="bg-white border-l-4 border-yellow-600 shadow-sm">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                      <Lightbulb className="w-6 h-6 mr-3 text-yellow-600" />
                      FUTURE ENHANCEMENT OPPORTUNITIES
                    </h2>
                    <div className="w-16 h-0.5 bg-yellow-600"></div>
                  </div>
                  <div className="space-y-6">
                    {(insights.futureEnhancements || []).map((enhancement, index) => (
                      <div key={index} className="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start space-x-4 flex-1">
                            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-yellow-700 font-bold text-sm">{index + 1}</span>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">{enhancement.title}</h3>
                              <p className="text-gray-700 leading-relaxed mb-3">{enhancement.description}</p>
                              {enhancement.relatedIdea && (
                                <div className="inline-flex items-center text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                                  Related to: {enhancement.relatedIdea}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-2 ml-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                              enhancement.impact === 'high' ? 'bg-red-100 text-red-800 border border-red-200' :
                              enhancement.impact === 'medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                              'bg-green-100 text-green-800 border border-green-200'
                            }`}>
                              {enhancement.impact} Impact
                            </span>
                            <span className="text-xs text-gray-600 font-medium bg-gray-100 px-3 py-1 rounded-full">{enhancement.timeframe}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-white border-l-4 border-gray-600 shadow-sm">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                      <CheckCircle className="w-6 h-6 mr-3 text-gray-600" />
                      IMMEDIATE NEXT STEPS
                    </h2>
                    <div className="w-16 h-0.5 bg-gray-600"></div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6">
                    <div className="space-y-4">
                      {(insights.nextSteps || []).map((step, index) => (
                        <div key={index} className="flex items-start space-x-4">
                          <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold">{index + 1}</span>
                          </div>
                          <div className="flex-1 bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                            <p className="text-gray-700 leading-relaxed">{step}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Professional Document Footer */}
        <div className="bg-gray-100 border-t-2 border-gray-300">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Report Summary</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• <span className="font-medium">{isHistorical ? 'Historical Analysis' : 'Real-time AI Analysis'}</span></p>
                  <p>• <span className="font-medium">{(ideas || []).length} strategic initiatives</span> evaluated</p>
                  {!isHistorical && filesWithContent.length > 0 && (
                    <p>• <span className="font-medium">{filesWithContent.length} supporting document{filesWithContent.length !== 1 ? 's' : ''}</span> analyzed</p>
                  )}
                  <p>• Generated on <span className="font-medium">{new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span></p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">P</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">PRIORITAS</p>
                    <p className="text-xs text-gray-500">Strategic Intelligence Platform</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-300 pt-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  This report contains confidential and proprietary information. Distribution is restricted.
                </p>
                <div className="flex space-x-3">
                  {insights && !isHistorical && !savedInsightId && (
                    <button
                      onClick={saveInsights}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Saving...' : 'Save Report'}</span>
                    </button>
                  )}
                  {insights && (
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export PDF</span>
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIInsightsModal