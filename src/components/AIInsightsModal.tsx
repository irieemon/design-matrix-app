import { useState, useEffect } from 'react'
import { X, Sparkles, TrendingUp, Target, CheckCircle, AlertTriangle, Calendar, Users, Lightbulb, Download, Save } from 'lucide-react'
import { IdeaCard, Project } from '../types'
import { AIService } from '../lib/aiService'
import { exportInsightsToPDF } from '../utils/pdfExport'

interface AIInsightsModalProps {
  ideas: IdeaCard[]
  currentProject: Project | null
  onClose: () => void
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
  nextSteps: string[]
}

const AIInsightsModal: React.FC<AIInsightsModalProps> = ({ ideas, currentProject, selectedInsightId, onClose, onInsightSaved }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [insights, setInsights] = useState<InsightsReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isHistorical, setIsHistorical] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedInsightId, setSavedInsightId] = useState<string | null>(null)

  useEffect(() => {
    if (selectedInsightId) {
      // Load historical insight
      loadHistoricalInsight(selectedInsightId)
    } else {
      // Generate new insights
      generateInsights()
    }
  }, [ideas, selectedInsightId])

  const loadHistoricalInsight = async (insightId: string) => {
    setIsLoading(true)
    setError(null)
    setIsHistorical(true)
    
    try {
      console.log('📊 Loading historical insight:', insightId)
      const historicalInsight = await DatabaseService.getProjectInsight(insightId)
      
      if (historicalInsight) {
        setInsights(historicalInsight.insights_data)
        setSavedInsightId(insightId)
        console.log('✅ Loaded historical insight successfully')
      } else {
        throw new Error('Insight not found')
      }
    } catch (err) {
      console.error('Error loading historical insight:', err)
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
      console.log('🔍 Generating AI insights for', ideas.length, 'ideas...')
      const report = await AIService.generateInsights(ideas)
      setInsights(report)
    } catch (err) {
      console.error('Error generating insights:', err)
      setError('Failed to generate insights. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const saveInsights = async () => {
    if (!insights || !currentProject || savedInsightId) return
    
    setIsSaving(true)
    try {
      const insightName = `AI Insights - ${new Date().toLocaleDateString()}`
      const savedId = await DatabaseService.saveProjectInsights(
        currentProject.id,
        insights,
        currentProject.owner?.id || 'unknown',
        ideas.length
      )
      
      if (savedId) {
        setSavedInsightId(savedId)
        onInsightSaved?.(savedId)
        console.log('✅ Insights saved successfully:', savedId)
      }
    } catch (error) {
      console.error('Error saving insights:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownloadPDF = () => {
    if (insights) {
      exportInsightsToPDF(insights, ideas.length, currentProject)
    }
  }

  return (
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
                {isHistorical ? 'Previously generated analysis' : `Analysis of ${ideas.length} ideas in your priority matrix`}
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

        {/* Content */}
        <div className="p-6">
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
                  {insights.keyInsights.map((item, index) => (
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
                      {insights.priorityRecommendations.immediate.map((item, index) => (
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
                      {insights.priorityRecommendations.shortTerm.map((item, index) => (
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
                      {insights.priorityRecommendations.longTerm.map((item, index) => (
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
                    {insights.riskAssessment.highRisk.map((risk, index) => (
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
                    {insights.riskAssessment.opportunities.map((opportunity, index) => (
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
                  {insights.suggestedRoadmap.map((phase, index) => (
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
                        {phase.ideas.map((idea, ideaIndex) => (
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
                    <p className="text-sm text-emerald-700">{insights.resourceAllocation.quickWins}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">Strategic Initiatives</h4>
                    <p className="text-sm text-blue-700">{insights.resourceAllocation.strategic}</p>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Immediate Next Steps
                </h3>
                <div className="grid gap-3">
                  {insights.nextSteps.map((step, index) => (
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
              {isHistorical ? 'Historical insight' : 'Generated by AI'} • Analysis based on {isHistorical ? 'saved data' : ideas.length + ' ideas'}
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
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
    </div>
  )
}

export default AIInsightsModal