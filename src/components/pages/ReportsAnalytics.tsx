import { useState, useEffect } from 'react'
import { BarChart3, PieChart, TrendingUp, Users, Target, Lightbulb, Calendar, Sparkles, History, Clock, AlertTriangle, Cpu, ChevronDown } from 'lucide-react'
import { IdeaCard, Project, ProjectInsights as ProjectInsightsType, User } from '../../types'
import { DatabaseService } from '../../lib/database'
import AIInsightsModal from '../AIInsightsModal'
import { OpenAIModel } from '../../lib/ai/openaiModelRouter'
import { logger } from '../../utils/logger'

interface ReportsAnalyticsProps {
  ideas: IdeaCard[]
  currentUser: User
  currentProject: Project | null
}

const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({ ideas, currentUser, currentProject }) => {
  const [showAIInsights, setShowAIInsights] = useState(false)
  const [insightsHistory, setInsightsHistory] = useState<ProjectInsightsType[]>([])
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [selectedModel, setSelectedModel] = useState<OpenAIModel>('gpt-5')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  // const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Available OpenAI models with display info - GPT-5 Era
  const availableModels: Array<{
    value: OpenAIModel;
    label: string;
    description: string;
    cost: 'low' | 'medium' | 'high'
  }> = [
    // GPT-5 Series - The new standard
    { value: 'gpt-5', label: 'GPT-5', description: 'Latest smartest model with built-in thinking', cost: 'medium' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini', description: 'Fast, cost-effective GPT-5', cost: 'low' },
    { value: 'gpt-5-nano', label: 'GPT-5 Nano', description: 'Ultra-efficient for simple tasks', cost: 'low' },
    { value: 'gpt-5-chat-latest', label: 'GPT-5 Chat', description: 'Conversational GPT-5 model', cost: 'medium' },

    // O-Series - Deep reasoning specialists
    { value: 'o1-preview', label: 'O1 Preview', description: 'Advanced reasoning & logic', cost: 'high' },
    { value: 'o1-mini', label: 'O1 Mini', description: 'Efficient reasoning model', cost: 'medium' },
    { value: 'o3-deep-research', label: 'O3 Deep Research', description: 'Multi-step research & analysis', cost: 'high' },
    { value: 'o4-mini-deep-research', label: 'O4 Mini Research', description: 'Efficient research specialist', cost: 'high' },

    // Specialized Models
    { value: 'gpt-realtime', label: 'GPT Realtime', description: 'Advanced speech-to-speech AI', cost: 'high' }
  ]

  // Function to convert user ID to display name
  const getUserDisplayName = (userId: string | null): string => {
    if (!userId) return 'Unknown'
    
    // If it's the current user, show the current user's name or "You"
    if (userId === currentUser.id) {
      return currentUser.full_name || currentUser.email || 'You'
    }
    
    // If it looks like a UUID, try to generate a readable name
    if (userId.length === 36 && userId.includes('-')) {
      // For UUIDs, create a short identifier based on the first part
      const shortId = userId.split('-')[0].substring(0, 8)
      return `User-${shortId}`
    }
    
    // If it looks like an email, extract the name part
    if (userId.includes('@')) {
      const emailName = userId.split('@')[0]
      return emailName.charAt(0).toUpperCase() + emailName.slice(1).replace(/[._-]/g, ' ')
    }
    
    // If it's already a display name or other format, return as is
    return userId
  }
  
  // Load insights history when component mounts or project changes
  useEffect(() => {
    if (currentProject?.id) {
      loadInsightsHistory()
    }
  }, [currentProject?.id])

  const loadInsightsHistory = async () => {
    if (!currentProject?.id) return
    
    // setIsLoadingHistory(true)
    try {
      const history = await DatabaseService.getProjectInsights(currentProject.id)
      setInsightsHistory(history)
      logger.debug('📊 Loaded insights history:', history.length, 'versions')
    } catch (error) {
      logger.error('Error loading insights history:', error)
    } finally {
      // setIsLoadingHistory(false)
    }
  }


  const handleInsightSaved = (_insightId: string) => {
    logger.debug('📊 Insight saved, reloading history...')
    loadInsightsHistory()
  }

  const handleGenerateNewInsight = () => {
    if (insightsHistory.length > 0) {
      setShowWarning(true)
    } else {
      setSelectedInsightId(null)
      setShowAIInsights(true)
    }
  }

  const confirmGenerateNew = () => {
    setShowWarning(false)
    setSelectedInsightId(null)
    setShowAIInsights(true)
  }

  const handleViewHistoricalInsight = (insightId: string) => {
    setSelectedInsightId(insightId)
    setShowAIInsights(true)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.model-dropdown')) {
        setShowModelDropdown(false)
      }
    }

    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelDropdown])

  const priorityData = (ideas || []).reduce((acc, idea) => {
    acc[idea.priority] = (acc[idea.priority] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const quadrantData = {
    quickWins: (ideas || []).filter(i => i.x <= 260 && i.y < 260).length,
    strategic: (ideas || []).filter(i => i.x > 260 && i.y < 260).length,
    reconsider: (ideas || []).filter(i => i.x <= 260 && i.y >= 260).length,
    avoid: (ideas || []).filter(i => i.x > 260 && i.y >= 260).length
  }

  const contributorData = (ideas || []).reduce((acc, idea) => {
    const contributor = getUserDisplayName(idea.created_by)
    acc[contributor] = (acc[contributor] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topContributors = Object.entries(contributorData)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)

  const recentActivity = (ideas || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  const priorityColors = {
    low: 'bg-slate-100 text-slate-800',
    moderate: 'bg-amber-100 text-amber-800', 
    high: 'bg-red-100 text-red-800',
    strategic: 'bg-blue-100 text-blue-800',
    innovation: 'bg-purple-100 text-purple-800'
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Page Header with Prominent AI Insights Button */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Insights</h1>
            <p className="text-slate-600">AI-powered insights and analytics from your Prioritas data</p>
          </div>
          
          {/* AI Controls Section */}
          <div className="flex flex-col space-y-4">
            {/* Model Selection Dropdown */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <Cpu className="w-4 h-4" />
                <span className="font-medium">AI Model:</span>
              </div>
              <div className="relative model-dropdown">
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="flex items-center space-x-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors min-w-[180px]"
                >
                  <span>{availableModels.find(m => m.value === selectedModel)?.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showModelDropdown && (
                  <div className="absolute top-full mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                    <div className="p-2 space-y-1">
                      {availableModels.map((model) => (
                        <button
                          key={model.value}
                          onClick={() => {
                            setSelectedModel(model.value)
                            setShowModelDropdown(false)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 transition-colors ${
                            selectedModel === model.value ? 'bg-purple-50 text-purple-700' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{model.label}</div>
                              <div className="text-xs text-slate-500">{model.description}</div>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                              model.cost === 'low' ? 'bg-green-100 text-green-700' :
                              model.cost === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {model.cost}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Prominent AI Insights Button */}
            <button
              onClick={handleGenerateNewInsight}
              disabled={ideas.length === 0}
              className="flex items-center space-x-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 group"
            >
              <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">Generate AI Insights</div>
                <div className="text-sm text-purple-100 font-medium">Strategic analysis & recommendations</div>
              </div>
            </button>
          </div>
        </div>
        
        {ideas.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-amber-800 text-sm">
              <strong>Add some ideas to your matrix first</strong> to generate AI insights and strategic recommendations.
            </p>
          </div>
        )}
      </div>

      {/* AI Insights History Section - Moved Higher for Prominence */}
      {insightsHistory.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-50 rounded-xl">
                <History className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">AI Insights History</h3>
                <p className="text-sm text-slate-600">{insightsHistory.length} saved insight{insightsHistory.length !== 1 ? 's' : ''} - Access your previous reports here</p>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-slate-500 hover:text-slate-700 transition-colors"
            >
              {showHistory ? 'Hide' : 'Show'} History
            </button>
          </div>

          {showHistory && (
            <div className="space-y-3">
              {insightsHistory.map((insight) => (
                <div key={insight.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{insight.name}</h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(insight.created_at).toLocaleDateString()}</span>
                        </span>
                        <span>{insight.ideas_analyzed} ideas analyzed</span>
                        <span>Version {insight.version}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewHistoricalInsight(insight.id)}
                      className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Lightbulb className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-slate-900">{ideas.length}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Total Ideas</h3>
          <p className="text-xs text-slate-500">All ideas in matrix</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Target className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-2xl font-bold text-slate-900">{quadrantData.quickWins}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Quick Wins</h3>
          <p className="text-xs text-slate-500">High value, low effort</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-slate-900">{Object.keys(contributorData).length}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Contributors</h3>
          <p className="text-xs text-slate-500">Unique team members</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {(ideas || []).filter(i => i.priority === 'high' || i.priority === 'strategic').length}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">High Priority</h3>
          <p className="text-xs text-slate-500">Strategic & high priority</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quadrant Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Matrix Distribution</h3>
            <PieChart className="w-5 h-5 text-slate-500" />
          </div>
          
          <div className="space-y-4">
            {Object.entries(quadrantData).map(([key, value]) => {
              const total = Object.values(quadrantData).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? (value / total * 100) : 0
              const labels = {
                quickWins: 'Quick Wins',
                strategic: 'Strategic',
                reconsider: 'Reconsider',
                avoid: 'Avoid'
              }
              const colors = {
                quickWins: 'bg-emerald-500',
                strategic: 'bg-blue-500', 
                reconsider: 'bg-amber-500',
                avoid: 'bg-red-500'
              }
              
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${colors[key as keyof typeof colors]}`}></div>
                    <span className="text-sm font-medium text-slate-700">{labels[key as keyof typeof labels]}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-slate-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${colors[key as keyof typeof colors]}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 w-8">{value}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Priority Breakdown</h3>
            <BarChart3 className="w-5 h-5 text-slate-500" />
          </div>
          
          <div className="space-y-4">
            {Object.entries(priorityData).map(([priority, count]) => {
              const total = Object.values(priorityData).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? (count / total * 100) : 0
              
              return (
                <div key={priority} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${priorityColors[priority as keyof typeof priorityColors]}`}>
                      {priority}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-slate-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-slate-600"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 w-8">{count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Contributors and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Contributors */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Top Contributors</h3>
            <Users className="w-5 h-5 text-slate-500" />
          </div>
          
          <div className="space-y-4">
            {topContributors.length > 0 ? topContributors.map(([contributor, count]) => (
              <div key={contributor} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {contributor.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{contributor}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{count} ideas</span>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No contributors yet</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
            <Calendar className="w-5 h-5 text-slate-500" />
          </div>
          
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {recentActivity.length > 0 ? recentActivity.map((idea) => (
              <div key={idea.id} className="flex items-start space-x-3 pb-3 border-b border-slate-100 last:border-b-0 last:pb-0">
                <div className={`w-2 h-2 rounded-full mt-2 ${priorityColors[idea.priority]?.includes('slate') ? 'bg-slate-400' : 
                  priorityColors[idea.priority]?.includes('amber') ? 'bg-amber-400' :
                  priorityColors[idea.priority]?.includes('red') ? 'bg-red-400' :
                  priorityColors[idea.priority]?.includes('blue') ? 'bg-blue-400' : 'bg-purple-400'}`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{idea.content}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    by {getUserDisplayName(idea.created_by)} • {new Date(idea.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Warning Dialog */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Generate New AI Report?</h3>
                <p className="text-sm text-slate-600">You have {insightsHistory.length} existing report{insightsHistory.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <p className="text-slate-700 mb-6">
              This will create a new AI insights report. You can always access your previous reports in the <strong>AI Insights History</strong> section above.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmGenerateNew}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Generate New
              </button>
            </div>
          </div>
        </div>
      )}


      {/* AI Insights Modal */}
      <AIInsightsModal
        isOpen={showAIInsights}
        ideas={ideas}
        currentProject={currentProject}
        selectedInsightId={selectedInsightId || undefined}
        preferredModel={selectedModel}
        onClose={() => {
          setShowAIInsights(false)
          setSelectedInsightId(null)
        }}
        onInsightSaved={handleInsightSaved}
      />
    </div>
  )
}

export default ReportsAnalytics