import React, { useState, useEffect } from 'react'
import { X, Calendar, Users, Flag, Zap, Target, CheckCircle, Clock, AlertTriangle, Edit, Save, Trash2, Plus, ChevronDown } from 'lucide-react'

interface FeatureDetail {
  id: string
  title: string
  description?: string
  startMonth: number
  duration: number
  team: string
  priority: 'high' | 'medium' | 'low'
  status: 'planned' | 'in-progress' | 'completed'
  userStories?: string[]
  deliverables?: string[]
  relatedIdeas?: string[]
  risks?: string[]
  successCriteria?: string[]
  complexity?: string
}

interface FeatureDetailModalProps {
  feature: FeatureDetail | null
  isOpen: boolean
  onClose: () => void
  onSave: (feature: FeatureDetail) => void
  onDelete?: (featureId: string) => void
  startDate?: Date
  mode?: 'view' | 'edit' | 'create'
  availableTeams?: string[]
  projectType?: string
}

const FeatureDetailModal: React.FC<FeatureDetailModalProps> = ({
  feature,
  isOpen,
  onClose,
  onSave,
  onDelete,
  startDate = new Date(),
  mode = 'view',
  availableTeams = [],
  projectType: _ = 'software'
}) => {
  const [editMode, setEditMode] = useState(mode === 'edit' || mode === 'create')
  const [editedFeature, setEditedFeature] = useState<FeatureDetail | null>(null)
  const [newUserStory, setNewUserStory] = useState('')
  const [newDeliverable, setNewDeliverable] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Initialize edited feature when feature or mode changes
  useEffect(() => {
    if (feature) {
      setEditedFeature({ ...feature })
    } else if (mode === 'create') {
      // Create new feature template
      setEditedFeature({
        id: `temp-${Date.now()}`,
        title: '',
        description: '',
        startMonth: 0,
        duration: 1,
        team: availableTeams[0] || 'PLATFORM',
        priority: 'medium',
        status: 'planned',
        userStories: [],
        deliverables: [],
        relatedIdeas: [],
        risks: [],
        successCriteria: [],
        complexity: 'medium'
      })
    }
    setEditMode(mode === 'edit' || mode === 'create')
  }, [feature, mode, availableTeams])

  if (!isOpen || (!feature && mode !== 'create')) return null

  const currentFeature = editedFeature || feature!

  // Calculate feature timeline
  const getFeatureTimeline = () => {
    const start = new Date(startDate)
    start.setMonth(start.getMonth() + currentFeature.startMonth)
    const end = new Date(start)
    end.setMonth(end.getMonth() + currentFeature.duration)
    
    return {
      start: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      end: end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  const timeline = getFeatureTimeline()

  const handleSave = () => {
    if (editedFeature && (editedFeature.title.trim() !== '')) {
      onSave(editedFeature)
      setEditMode(false)
      onClose()
    }
  }

  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (feature && onDelete) {
      onDelete(feature.id)
      onClose()
    }
    setShowDeleteConfirm(false)
  }

  const handleCancel = () => {
    if (mode === 'create') {
      onClose()
    } else {
      setEditedFeature(feature ? { ...feature } : null)
      setEditMode(false)
    }
  }

  const updateFeature = (updates: Partial<FeatureDetail>) => {
    if (editedFeature) {
      setEditedFeature({ ...editedFeature, ...updates })
    }
  }

  const addUserStory = () => {
    if (newUserStory.trim() && editedFeature) {
      updateFeature({
        userStories: [...(editedFeature.userStories || []), newUserStory.trim()]
      })
      setNewUserStory('')
    }
  }

  const removeUserStory = (index: number) => {
    if (editedFeature) {
      const updated = [...(editedFeature.userStories || [])]
      updated.splice(index, 1)
      updateFeature({ userStories: updated })
    }
  }

  const addDeliverable = () => {
    if (newDeliverable.trim() && editedFeature) {
      updateFeature({
        deliverables: [...(editedFeature.deliverables || []), newDeliverable.trim()]
      })
      setNewDeliverable('')
    }
  }

  const removeDeliverable = (index: number) => {
    if (editedFeature) {
      const updated = [...(editedFeature.deliverables || [])]
      updated.splice(index, 1)
      updateFeature({ deliverables: updated })
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'planned': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTeamDisplayName = (teamId: string) => {
    switch (teamId) {
      case 'creative': return 'Creative Team'
      case 'digital': return 'Digital Marketing'
      case 'analytics': return 'Analytics Team'
      case 'web': return 'Web Team'
      case 'mobile': return 'Mobile Team'
      case 'platform': return 'Platform Team'
      case 'testing': return 'QA & Testing'
      default: return teamId.charAt(0).toUpperCase() + teamId.slice(1) + ' Team'
    }
  }

  const getTeamColor = (team: string) => {
    switch (team) {
      case 'creative': return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'digital': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'analytics': return 'bg-green-100 text-green-800 border-green-200'
      case 'web': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'mobile': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'marketing': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'platform': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTeamIcon = (team: string) => {
    switch (team) {
      case 'creative': return '🎨'
      case 'digital': return '📈'
      case 'analytics': return '📊'
      case 'web': return '🖥️'
      case 'mobile': return '📱'
      case 'marketing': return '📈'
      case 'platform': return '⚙️'
      case 'testing': return '🧪'
      default: return '💼'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-100 border-b border-slate-200 p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-sm">
                  {getTeamIcon(currentFeature.team)}
                </div>
                {editMode ? (
                  <input
                    type="text"
                    value={currentFeature.title}
                    onChange={(e) => updateFeature({ title: e.target.value })}
                    className="text-2xl font-bold bg-transparent border-0 border-b-2 border-slate-300 focus:border-blue-500 focus:outline-none text-slate-900 placeholder-slate-400 flex-1 pb-1 min-w-0"
                    placeholder="Feature title"
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-slate-900 leading-tight truncate">{currentFeature.title}</h2>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {editMode ? (
                  <>
                    <div className="relative">
                      <select
                        value={currentFeature.priority}
                        onChange={(e) => updateFeature({ priority: e.target.value as 'high' | 'medium' | 'low' })}
                        className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:bg-white cursor-pointer min-w-[140px]"
                      >
                        <option value="high">High Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="low">Low Priority</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={currentFeature.status}
                        onChange={(e) => updateFeature({ status: e.target.value as 'planned' | 'in-progress' | 'completed' })}
                        className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:bg-white cursor-pointer min-w-[120px]"
                      >
                        <option value="planned">Planned</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={currentFeature.team}
                        onChange={(e) => updateFeature({ team: e.target.value })}
                        className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:bg-white cursor-pointer min-w-[140px]"
                      >
                        {availableTeams.map(team => (
                          <option key={team} value={team}>{getTeamDisplayName(team)}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </>
                ) : (
                  <>
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${getPriorityColor(currentFeature.priority)}`}>
                      <Flag className="w-3 h-3 inline mr-1.5" />
                      {currentFeature.priority} priority
                    </span>
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${getStatusColor(currentFeature.status)}`}>
                      <Clock className="w-3 h-3 inline mr-1.5" />
                      {currentFeature.status}
                    </span>
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${getTeamColor(currentFeature.team)}`}>
                      <Users className="w-3 h-3 inline mr-1.5" />
                      {getTeamDisplayName(currentFeature.team)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-start space-x-2 flex-shrink-0">
              {mode !== 'view' && (
                <>
                  {editMode ? (
                    <>
                      <button
                        onClick={handleSave}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-sm shadow-sm"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save</span>
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm shadow-sm"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                  )}
                  {onDelete && feature && mode !== 'create' && (
                    <button
                      onClick={handleDelete}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </>
              )}
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="p-1.5 bg-blue-500 rounded-lg">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-blue-900">Timeline</h3>
                </div>
                {editMode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-blue-900 text-xs font-medium mb-1">Start Month</label>
                      <div className="relative">
                        <select
                          value={currentFeature.startMonth}
                          onChange={(e) => updateFeature({ startMonth: parseInt(e.target.value) })}
                          className="appearance-none w-full px-3 py-2 border border-blue-200 rounded-lg text-blue-900 focus:border-blue-500 focus:outline-none text-sm bg-white pr-8"
                        >
                          {Array.from({ length: 24 }, (_, i) => {
                            const monthDate = new Date(startDate)
                            monthDate.setMonth(monthDate.getMonth() + i)
                            const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                            return (
                              <option key={i} value={i}>
                                {monthName}
                              </option>
                            )
                          })}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-blue-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-blue-900 text-xs font-medium mb-1">Duration</label>
                      <div className="relative">
                        <select
                          value={currentFeature.duration}
                          onChange={(e) => updateFeature({ duration: parseInt(e.target.value) })}
                          className="appearance-none w-full px-3 py-2 border border-blue-200 rounded-lg text-blue-900 focus:border-blue-500 focus:outline-none text-sm bg-white pr-8"
                        >
                          {Array.from({ length: 12 }, (_, i) => {
                            const months = i + 1
                            return (
                              <option key={months} value={months}>
                                {months} month{months !== 1 ? 's' : ''}
                              </option>
                            )
                          })}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-blue-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-blue-800 font-medium">{timeline.start}</p>
                    <p className="text-blue-700 text-sm">to {timeline.end}</p>
                    <p className="text-blue-600 text-xs bg-blue-200 px-2 py-1 rounded inline-block mt-2">
                      {currentFeature.duration} month{currentFeature.duration !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="p-1.5 bg-purple-500 rounded-lg">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-purple-900">Team</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-purple-800 font-medium">{getTeamDisplayName(currentFeature.team)}</p>
                  <p className="text-purple-600 text-xs bg-purple-200 px-2 py-1 rounded inline-block">Primary responsibility</p>
                </div>
              </div>

              {(currentFeature.complexity || editMode) && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-amber-500 rounded-lg">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-amber-900">Complexity</h3>
                  </div>
                  {editMode ? (
                    <div className="relative">
                      <select
                        value={currentFeature.complexity || 'medium'}
                        onChange={(e) => updateFeature({ complexity: e.target.value })}
                        className="appearance-none w-full px-3 py-2 border border-amber-200 rounded-lg text-amber-900 focus:border-amber-500 focus:outline-none bg-white text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-amber-400 pointer-events-none" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-amber-800 font-medium capitalize">{currentFeature.complexity}</p>
                      <p className="text-amber-600 text-xs bg-amber-200 px-2 py-1 rounded inline-block">Estimated effort</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {(currentFeature.description || editMode) && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                  <div className="p-1.5 bg-slate-500 rounded-lg">
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <span>Description</span>
                </h3>
                {editMode ? (
                  <textarea
                    value={currentFeature.description || ''}
                    onChange={(e) => updateFeature({ description: e.target.value })}
                    className="w-full h-24 px-3 py-2 border border-slate-200 rounded-lg text-slate-700 resize-none focus:border-blue-500 focus:outline-none bg-white text-sm"
                    placeholder="Enter feature description..."
                  />
                ) : (
                  <p className="text-slate-700 leading-relaxed text-sm">{currentFeature.description}</p>
                )}
              </div>
            )}

            {/* User Stories */}
            {((currentFeature.userStories && currentFeature.userStories.length > 0) || editMode) && (
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200 shadow-sm">
                <h3 className="font-semibold text-green-900 mb-6 flex items-center space-x-3 text-lg">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <span>User Stories</span>
                  <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-medium">
                    {currentFeature.userStories?.length || 0}
                  </span>
                </h3>
                <div className="space-y-4">
                  {currentFeature.userStories?.map((story, index) => (
                    <div key={index} className="flex items-start space-x-4 bg-white rounded-xl p-4 border border-green-200">
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-sm">
                        <span className="text-white text-sm font-bold">{index + 1}</span>
                      </div>
                      <p className="text-green-800 flex-1 leading-relaxed">{story}</p>
                      {editMode && (
                        <button
                          onClick={() => removeUserStory(index)}
                          className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex items-center space-x-3 bg-white rounded-xl p-4 border-2 border-dashed border-green-300">
                      <input
                        type="text"
                        value={newUserStory}
                        onChange={(e) => setNewUserStory(e.target.value)}
                        className="flex-1 px-4 py-2.5 border-2 border-green-200 rounded-xl text-green-900 focus:border-green-500 focus:outline-none"
                        placeholder="Add a new user story..."
                        onKeyPress={(e) => e.key === 'Enter' && addUserStory()}
                      />
                      <button
                        onClick={addUserStory}
                        className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 flex items-center space-x-2 font-medium shadow-sm transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Deliverables */}
            {((currentFeature.deliverables && currentFeature.deliverables.length > 0) || editMode) && (
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-4 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Key Deliverables ({currentFeature.deliverables?.length || 0})</span>
                </h3>
                <div className="space-y-3">
                  {currentFeature.deliverables?.map((deliverable, index) => (
                    <div key={index} className="flex items-center space-x-2 bg-white rounded-lg p-3 border border-blue-300">
                      <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-blue-800 text-sm flex-1">{deliverable}</span>
                      {editMode && (
                        <button
                          onClick={() => removeDeliverable(index)}
                          className="flex-shrink-0 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newDeliverable}
                        onChange={(e) => setNewDeliverable(e.target.value)}
                        className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-blue-900"
                        placeholder="Add a new deliverable..."
                        onKeyPress={(e) => e.key === 'Enter' && addDeliverable()}
                      />
                      <button
                        onClick={addDeliverable}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success Criteria */}
            {((currentFeature.successCriteria && currentFeature.successCriteria.length > 0) || editMode) && (
              <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
                <h3 className="font-semibold text-emerald-900 mb-4 flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Success Criteria ({currentFeature.successCriteria?.length || 0})</span>
                </h3>
                <div className="space-y-2">
                  {currentFeature.successCriteria?.map((criteria, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
                      <span className="text-emerald-800 flex-1">{criteria}</span>
                      {editMode && (
                        <button
                          onClick={() => {
                            if (currentFeature.successCriteria) {
                              const updated = [...currentFeature.successCriteria]
                              updated.splice(index, 1)
                              updateFeature({ successCriteria: updated })
                            }
                          }}
                          className="flex-shrink-0 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg text-emerald-900"
                        placeholder="Add success criteria..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            updateFeature({
                              successCriteria: [...(currentFeature.successCriteria || []), e.currentTarget.value.trim()]
                            })
                            e.currentTarget.value = ''
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement
                          if (input.value.trim()) {
                            updateFeature({
                              successCriteria: [...(currentFeature.successCriteria || []), input.value.trim()]
                            })
                            input.value = ''
                          }
                        }}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risks */}
            {((currentFeature.risks && currentFeature.risks.length > 0) || editMode) && (
              <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                <h3 className="font-semibold text-red-900 mb-4 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Risk Factors ({currentFeature.risks?.length || 0})</span>
                </h3>
                <div className="space-y-2">
                  {currentFeature.risks?.map((risk, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                      <span className="text-red-800 flex-1">{risk}</span>
                      {editMode && (
                        <button
                          onClick={() => {
                            if (currentFeature.risks) {
                              const updated = [...currentFeature.risks]
                              updated.splice(index, 1)
                              updateFeature({ risks: updated })
                            }
                          }}
                          className="flex-shrink-0 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-red-300 rounded-lg text-red-900"
                        placeholder="Add risk factor..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            updateFeature({
                              risks: [...(currentFeature.risks || []), e.currentTarget.value.trim()]
                            })
                            e.currentTarget.value = ''
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement
                          if (input.value.trim()) {
                            updateFeature({
                              risks: [...(currentFeature.risks || []), input.value.trim()]
                            })
                            input.value = ''
                          }
                        }}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Related Ideas */}
            {((currentFeature.relatedIdeas && currentFeature.relatedIdeas.length > 0) || editMode) && (
              <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
                <h3 className="font-semibold text-indigo-900 mb-4 flex items-center space-x-2">
                  <Flag className="w-5 h-5" />
                  <span>Related Ideas ({currentFeature.relatedIdeas?.length || 0})</span>
                </h3>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {currentFeature.relatedIdeas?.map((idea, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm border border-indigo-300"
                      >
                        {idea}
                        {editMode && (
                          <button
                            onClick={() => {
                              if (currentFeature.relatedIdeas) {
                                const updated = [...currentFeature.relatedIdeas]
                                updated.splice(index, 1)
                                updateFeature({ relatedIdeas: updated })
                              }
                            }}
                            className="ml-2 text-indigo-600 hover:text-indigo-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {editMode && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg text-indigo-900"
                        placeholder="Add related idea..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            updateFeature({
                              relatedIdeas: [...(currentFeature.relatedIdeas || []), e.currentTarget.value.trim()]
                            })
                            e.currentTarget.value = ''
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement
                          if (input.value.trim()) {
                            updateFeature({
                              relatedIdeas: [...(currentFeature.relatedIdeas || []), input.value.trim()]
                            })
                            input.value = ''
                          }
                        }}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <Clock className="w-4 h-4" />
              <span>ID: {currentFeature.id}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Feature</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete <strong>"{currentFeature.title}"</strong>? 
                This will permanently remove the feature and all its associated data.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Feature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FeatureDetailModal