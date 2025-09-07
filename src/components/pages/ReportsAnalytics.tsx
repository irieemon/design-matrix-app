import { useState, useEffect } from 'react'
import { BarChart3, PieChart, TrendingUp, Users, Target, Lightbulb, Calendar, Download, Sparkles, History, Clock } from 'lucide-react'
import { IdeaCard, Project, ProjectInsights as ProjectInsightsType } from '../../types'
import { exportToCSV } from '../../utils/csvUtils'
import { DatabaseService } from '../../lib/database'
import AIInsightsModal from '../AIInsightsModal'

interface ReportsAnalyticsProps {
  ideas: IdeaCard[]
  currentUser: string
  currentProject: Project | null
}

const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({ ideas, currentUser, currentProject }) => {
  const [showAIInsights, setShowAIInsights] = useState(false)
  const [insightsHistory, setInsightsHistory] = useState<ProjectInsightsType[]>([])
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  
  // Load insights history when component mounts or project changes
  useEffect(() => {
    if (currentProject?.id) {
      loadInsightsHistory()
    }
  }, [currentProject?.id])

  const loadInsightsHistory = async () => {
    if (!currentProject?.id) return
    
    setIsLoadingHistory(true)
    try {
      const history = await DatabaseService.getProjectInsights(currentProject.id)
      setInsightsHistory(history)
      console.log('📊 Loaded insights history:', history.length, 'versions')
    } catch (error) {
      console.error('Error loading insights history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleExportReport = () => {
    exportToCSV(ideas)
  }

  const handleInsightSaved = (insightId: string) => {
    console.log('📊 Insight saved, reloading history...')
    loadInsightsHistory()
  }

  const handleViewHistoricalInsight = (insightId: string) => {
    setSelectedInsightId(insightId)
    setShowAIInsights(true)
  }

  const priorityData = ideas.reduce((acc, idea) => {
    acc[idea.priority] = (acc[idea.priority] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const quadrantData = {
    quickWins: ideas.filter(i => i.x <= 260 && i.y < 260).length,
    strategic: ideas.filter(i => i.x > 260 && i.y < 260).length,
    reconsider: ideas.filter(i => i.x <= 260 && i.y >= 260).length,
    avoid: ideas.filter(i => i.x > 260 && i.y >= 260).length
  }

  const contributorData = ideas.reduce((acc, idea) => {
    const contributor = idea.created_by || 'Unknown'
    acc[contributor] = (acc[contributor] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topContributors = Object.entries(contributorData)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)

  const recentActivity = ideas
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
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Reports & Analytics</h1>
        <p className="text-slate-600">Insights and trends from your Prioritas data</p>
      </div>

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
              {ideas.filter(i => i.priority === 'high' || i.priority === 'strategic').length}
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
                  {contributor === currentUser && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">You</span>
                  )}
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
                    by {idea.created_by} • {new Date(idea.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Insights History Section */}
      {insightsHistory.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-50 rounded-xl">
                <History className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">AI Insights History</h3>
                <p className="text-sm text-slate-600">{insightsHistory.length} saved insight{insightsHistory.length !== 1 ? 's' : ''}</p>
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

      {/* Export Actions */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Export Reports</h3>
            <p className="text-sm text-slate-600">Download detailed analytics and reports</p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={() => {
                setSelectedInsightId(null) // Create new insight
                setShowAIInsights(true)
              }}
              disabled={ideas.length === 0}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">Generate AI Insights</span>
            </button>
            <button 
              onClick={handleExportReport}
              disabled={ideas.length === 0}
              className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span className="font-medium">Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Insights Modal */}
      {showAIInsights && (
        <AIInsightsModal 
          ideas={ideas}
          currentProject={currentProject}
          selectedInsightId={selectedInsightId}
          onClose={() => {
            setShowAIInsights(false)
            setSelectedInsightId(null)
          }}
          onInsightSaved={handleInsightSaved}
        />
      )}
    </div>
  )
}

export default ReportsAnalytics