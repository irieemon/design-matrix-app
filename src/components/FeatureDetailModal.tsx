import React, { useState, useEffect } from 'react'
import { X, Calendar, Users, Flag, Zap, Target, CheckCircle, Clock, AlertTriangle, Edit, Save, Trash2, Plus, ChevronDown } from 'lucide-react'
import { Button } from './ui/Button'

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

  const getPriorityColor = (priority: string): React.CSSProperties => {
    switch (priority) {
      case 'high': return { backgroundColor: 'var(--garnet-100)', color: 'var(--garnet-800)', borderColor: 'var(--garnet-200)' }
      case 'medium': return { backgroundColor: 'var(--amber-100)', color: 'var(--amber-800)', borderColor: 'var(--amber-200)' }
      case 'low': return { backgroundColor: 'var(--sapphire-100)', color: 'var(--sapphire-800)', borderColor: 'var(--sapphire-200)' }
      default: return { backgroundColor: 'var(--graphite-100)', color: 'var(--graphite-800)', borderColor: 'var(--hairline-default)' }
    }
  }

  const getStatusColor = (status: string): React.CSSProperties => {
    switch (status) {
      case 'completed': return { backgroundColor: 'var(--emerald-100)', color: 'var(--emerald-800)', borderColor: 'var(--emerald-200)' }
      case 'in-progress': return { backgroundColor: 'var(--sapphire-100)', color: 'var(--sapphire-800)', borderColor: 'var(--sapphire-200)' }
      case 'planned': return { backgroundColor: 'var(--graphite-100)', color: 'var(--graphite-800)', borderColor: 'var(--hairline-default)' }
      default: return { backgroundColor: 'var(--graphite-100)', color: 'var(--graphite-800)', borderColor: 'var(--hairline-default)' }
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

  const getTeamColor = (team: string): React.CSSProperties => {
    switch (team) {
      case 'creative': return { backgroundColor: 'var(--pink-100)', color: 'var(--pink-800)', borderColor: 'var(--pink-200)' }
      case 'digital': return { backgroundColor: 'var(--sapphire-100)', color: 'var(--sapphire-800)', borderColor: 'var(--sapphire-200)' }
      case 'analytics': return { backgroundColor: 'var(--emerald-100)', color: 'var(--emerald-800)', borderColor: 'var(--emerald-200)' }
      case 'web': return { backgroundColor: 'var(--orange-100)', color: 'var(--orange-800)', borderColor: 'var(--orange-200)' }
      case 'mobile': return { backgroundColor: 'var(--sapphire-100)', color: 'var(--sapphire-800)', borderColor: 'var(--sapphire-200)' }
      case 'marketing': return { backgroundColor: 'var(--purple-100)', color: 'var(--purple-800)', borderColor: 'var(--purple-200)' }
      case 'platform': return { backgroundColor: 'var(--emerald-100)', color: 'var(--emerald-800)', borderColor: 'var(--emerald-200)' }
      default: return { backgroundColor: 'var(--graphite-100)', color: 'var(--graphite-800)', borderColor: 'var(--hairline-default)' }
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
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border" style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--hairline-default)' }}>
        {/* Header */}
        <div className="border-b p-6" style={{ backgroundColor: 'var(--canvas-secondary)', borderColor: 'var(--hairline-default)' }}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg shadow-sm" style={{ backgroundImage: 'linear-gradient(to bottom right, var(--graphite-700), var(--graphite-800))', color: 'var(--surface-primary)' }}>
                  {getTeamIcon(currentFeature.team)}
                </div>
                {editMode ? (
                  <input
                    type="text"
                    value={currentFeature.title}
                    onChange={(e) => updateFeature({ title: e.target.value })}
                    className="text-2xl font-bold bg-transparent border-0 border-b-2 focus:outline-none flex-1 pb-1 min-w-0"
                    style={{
                      borderColor: 'var(--hairline-default)',
                      color: 'var(--graphite-900)',
                    }}
                    placeholder="Feature title"
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--sapphire-500)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--hairline-default)';
                    }}
                  />
                ) : (
                  <h2 className="text-2xl font-bold leading-tight truncate" style={{ color: 'var(--graphite-900)' }}>{currentFeature.title}</h2>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {editMode ? (
                  <>
                    <div className="relative">
                      <select
                        value={currentFeature.priority}
                        onChange={(e) => updateFeature({ priority: e.target.value as 'high' | 'medium' | 'low' })}
                        className="appearance-none border rounded-lg px-3 py-2 pr-8 text-sm font-medium focus:outline-none cursor-pointer min-w-[140px]"
                        style={{
                          backgroundColor: 'var(--canvas-secondary)',
                          borderColor: 'var(--hairline-default)',
                          color: 'var(--graphite-700)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--sapphire-500)';
                          e.target.style.backgroundColor = 'var(--surface-primary)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--hairline-default)';
                          e.target.style.backgroundColor = 'var(--canvas-secondary)';
                        }}
                      >
                        <option value="high">High Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="low">Low Priority</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--graphite-400)' }} />
                    </div>
                    <div className="relative">
                      <select
                        value={currentFeature.status}
                        onChange={(e) => updateFeature({ status: e.target.value as 'planned' | 'in-progress' | 'completed' })}
                        className="appearance-none border rounded-lg px-3 py-2 pr-8 text-sm font-medium focus:outline-none cursor-pointer min-w-[120px]"
                        style={{
                          backgroundColor: 'var(--canvas-secondary)',
                          borderColor: 'var(--hairline-default)',
                          color: 'var(--graphite-700)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--sapphire-500)';
                          e.target.style.backgroundColor = 'var(--surface-primary)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--hairline-default)';
                          e.target.style.backgroundColor = 'var(--canvas-secondary)';
                        }}
                      >
                        <option value="planned">Planned</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--graphite-400)' }} />
                    </div>
                    <div className="relative">
                      <select
                        value={currentFeature.team}
                        onChange={(e) => updateFeature({ team: e.target.value })}
                        className="appearance-none border rounded-lg px-3 py-2 pr-8 text-sm font-medium focus:outline-none cursor-pointer min-w-[140px]"
                        style={{
                          backgroundColor: 'var(--canvas-secondary)',
                          borderColor: 'var(--hairline-default)',
                          color: 'var(--graphite-700)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--sapphire-500)';
                          e.target.style.backgroundColor = 'var(--surface-primary)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--hairline-default)';
                          e.target.style.backgroundColor = 'var(--canvas-secondary)';
                        }}
                      >
                        {availableTeams.map(team => (
                          <option key={team} value={team}>{getTeamDisplayName(team)}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--graphite-400)' }} />
                    </div>
                  </>
                ) : (
                  <>
                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={getPriorityColor(currentFeature.priority)}>
                      <Flag className="w-3 h-3 inline mr-1.5" />
                      {currentFeature.priority} priority
                    </span>
                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={getStatusColor(currentFeature.status)}>
                      <Clock className="w-3 h-3 inline mr-1.5" />
                      {currentFeature.status}
                    </span>
                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={getTeamColor(currentFeature.team)}>
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
                      <Button
                        onClick={handleSave}
                        variant="sapphire"
                        size="sm"
                        icon={<Save className="w-4 h-4" />}
                      >
                        Save
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="secondary"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => setEditMode(true)}
                      variant="primary"
                      size="sm"
                      icon={<Edit className="w-4 h-4" />}
                    >
                      Edit
                    </Button>
                  )}
                  {onDelete && feature && mode !== 'create' && (
                    <Button
                      onClick={handleDelete}
                      variant="danger"
                      size="sm"
                      icon={<Trash2 className="w-4 h-4" />}
                    >
                      Delete
                    </Button>
                  )}
                </>
              )}
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                icon={<X className="w-4 h-4" />}
                aria-label="Close modal"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--sapphire-50)', borderColor: 'var(--sapphire-200)' }}>
                <div className="flex items-center space-x-2 mb-3">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--sapphire-500)' }}>
                    <Calendar className="w-4 h-4" style={{ color: 'var(--surface-primary)' }} />
                  </div>
                  <h3 className="font-semibold" style={{ color: 'var(--sapphire-900)' }}>Timeline</h3>
                </div>
                {editMode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--sapphire-900)' }}>Start Month</label>
                      <div className="relative">
                        <select
                          value={currentFeature.startMonth}
                          onChange={(e) => updateFeature({ startMonth: parseInt(e.target.value) })}
                          className="appearance-none w-full px-3 py-2 border rounded-lg focus:outline-none text-sm pr-8"
                          style={{
                            borderColor: 'var(--sapphire-200)',
                            color: 'var(--sapphire-900)',
                            backgroundColor: 'var(--surface-primary)'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'var(--sapphire-500)';
                            e.target.style.boxShadow = '0 0 0 3px var(--sapphire-100)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'var(--sapphire-200)';
                            e.target.style.boxShadow = 'none';
                          }}
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
                        <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--sapphire-400)' }} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--sapphire-900)' }}>Duration</label>
                      <div className="relative">
                        <select
                          value={currentFeature.duration}
                          onChange={(e) => updateFeature({ duration: parseInt(e.target.value) })}
                          className="appearance-none w-full px-3 py-2 border rounded-lg focus:outline-none text-sm pr-8"
                          style={{
                            borderColor: 'var(--sapphire-200)',
                            color: 'var(--sapphire-900)',
                            backgroundColor: 'var(--surface-primary)'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'var(--sapphire-500)';
                            e.target.style.boxShadow = '0 0 0 3px var(--sapphire-100)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'var(--sapphire-200)';
                            e.target.style.boxShadow = 'none';
                          }}
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
                        <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--sapphire-400)' }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-medium" style={{ color: 'var(--sapphire-800)' }}>{timeline.start}</p>
                    <p className="text-sm" style={{ color: 'var(--sapphire-700)' }}>to {timeline.end}</p>
                    <p className="text-xs px-2 py-1 rounded inline-block mt-2" style={{ color: 'var(--sapphire-600)', backgroundColor: 'var(--sapphire-200)' }}>
                      {currentFeature.duration} month{currentFeature.duration !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--purple-50)', borderColor: 'var(--purple-200)' }}>
                <div className="flex items-center space-x-2 mb-3">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--purple-500)' }}>
                    <Users className="w-4 h-4" style={{ color: 'var(--surface-primary)' }} />
                  </div>
                  <h3 className="font-semibold" style={{ color: 'var(--purple-900)' }}>Team</h3>
                </div>
                <div className="space-y-1">
                  <p className="font-medium" style={{ color: 'var(--purple-800)' }}>{getTeamDisplayName(currentFeature.team)}</p>
                  <p className="text-xs px-2 py-1 rounded inline-block" style={{ color: 'var(--purple-600)', backgroundColor: 'var(--purple-200)' }}>Primary responsibility</p>
                </div>
              </div>

              {(currentFeature.complexity || editMode) && (
                <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--amber-50)', borderColor: 'var(--amber-200)' }}>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--amber-500)' }}>
                      <Zap className="w-4 h-4" style={{ color: 'var(--surface-primary)' }} />
                    </div>
                    <h3 className="font-semibold" style={{ color: 'var(--amber-900)' }}>Complexity</h3>
                  </div>
                  {editMode ? (
                    <div className="relative">
                      <select
                        value={currentFeature.complexity || 'medium'}
                        onChange={(e) => updateFeature({ complexity: e.target.value })}
                        className="appearance-none w-full px-3 py-2 border rounded-lg focus:outline-none text-sm"
                        style={{
                          borderColor: 'var(--amber-200)',
                          color: 'var(--amber-900)',
                          backgroundColor: 'var(--surface-primary)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--amber-500)';
                          e.target.style.boxShadow = '0 0 0 3px var(--amber-100)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--amber-200)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--amber-400)' }} />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium capitalize" style={{ color: 'var(--amber-800)' }}>{currentFeature.complexity}</p>
                      <p className="text-xs px-2 py-1 rounded inline-block" style={{ color: 'var(--amber-600)', backgroundColor: 'var(--amber-200)' }}>Estimated effort</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {(currentFeature.description || editMode) && (
              <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--canvas-secondary)', borderColor: 'var(--hairline-default)' }}>
                <h3 className="font-semibold mb-3 flex items-center space-x-2" style={{ color: 'var(--graphite-900)' }}>
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--graphite-500)' }}>
                    <Target className="w-4 h-4" style={{ color: 'var(--surface-primary)' }} />
                  </div>
                  <span>Description</span>
                </h3>
                {editMode ? (
                  <textarea
                    value={currentFeature.description || ''}
                    onChange={(e) => updateFeature({ description: e.target.value })}
                    className="w-full h-24 px-3 py-2 border rounded-lg resize-none focus:outline-none text-sm"
                    style={{
                      borderColor: 'var(--hairline-default)',
                      color: 'var(--graphite-700)',
                      backgroundColor: 'var(--surface-primary)'
                    }}
                    placeholder="Enter feature description..."
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--sapphire-500)';
                      e.target.style.boxShadow = '0 0 0 3px var(--sapphire-100)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--hairline-default)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                ) : (
                  <p className="leading-relaxed text-sm" style={{ color: 'var(--graphite-700)' }}>{currentFeature.description}</p>
                )}
              </div>
            )}

            {/* User Stories */}
            {((currentFeature.userStories && currentFeature.userStories.length > 0) || editMode) && (
              <div className="rounded-2xl p-6 border shadow-sm" style={{ backgroundImage: 'linear-gradient(to bottom right, var(--emerald-50), var(--emerald-100))', borderColor: 'var(--emerald-200)' }}>
                <h3 className="font-semibold mb-6 flex items-center space-x-3 text-lg" style={{ color: 'var(--emerald-900)' }}>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--emerald-500)' }}>
                    <Users className="w-5 h-5" style={{ color: 'var(--surface-primary)' }} />
                  </div>
                  <span>User Stories</span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'var(--emerald-200)', color: 'var(--emerald-800)' }}>
                    {currentFeature.userStories?.length || 0}
                  </span>
                </h3>
                <div className="space-y-4">
                  {currentFeature.userStories?.map((story, index) => (
                    <div key={index} className="flex items-start space-x-4 rounded-xl p-4 border" style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--emerald-200)' }}>
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundImage: 'linear-gradient(to right, var(--emerald-500), var(--emerald-600))' }}>
                        <span className="text-sm font-bold" style={{ color: 'var(--surface-primary)' }}>{index + 1}</span>
                      </div>
                      <p className="flex-1 leading-relaxed" style={{ color: 'var(--emerald-800)' }}>{story}</p>
                      {editMode && (
                        <Button
                          onClick={() => removeUserStory(index)}
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          className="flex-shrink-0"
                          style={{ color: 'var(--garnet-500)' }}
                          aria-label="Remove user story"
                        />
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex items-center space-x-3 rounded-xl p-4 border-2 border-dashed" style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--emerald-300)' }}>
                      <input
                        type="text"
                        value={newUserStory}
                        onChange={(e) => setNewUserStory(e.target.value)}
                        className="flex-1 px-4 py-2.5 border-2 rounded-xl focus:outline-none"
                        style={{
                          borderColor: 'var(--emerald-200)',
                          color: 'var(--emerald-900)'
                        }}
                        placeholder="Add a new user story..."
                        onKeyPress={(e) => e.key === 'Enter' && addUserStory()}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--emerald-500)';
                          e.target.style.boxShadow = '0 0 0 3px var(--emerald-100)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--emerald-200)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <Button
                        onClick={addUserStory}
                        variant="primary"
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Deliverables */}
            {((currentFeature.deliverables && currentFeature.deliverables.length > 0) || editMode) && (
              <div className="rounded-lg p-6 border" style={{ backgroundColor: 'var(--sapphire-50)', borderColor: 'var(--sapphire-200)' }}>
                <h3 className="font-semibold mb-4 flex items-center space-x-2" style={{ color: 'var(--sapphire-900)' }}>
                  <CheckCircle className="w-5 h-5" />
                  <span>Key Deliverables ({currentFeature.deliverables?.length || 0})</span>
                </h3>
                <div className="space-y-3">
                  {currentFeature.deliverables?.map((deliverable, index) => (
                    <div key={index} className="flex items-center space-x-2 rounded-lg p-3 border" style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--sapphire-300)' }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--sapphire-600)' }} />
                      <span className="text-sm flex-1" style={{ color: 'var(--sapphire-800)' }}>{deliverable}</span>
                      {editMode && (
                        <Button
                          onClick={() => removeDeliverable(index)}
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          className="flex-shrink-0"
                          style={{ color: 'var(--garnet-600)' }}
                          aria-label="Remove deliverable"
                        />
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newDeliverable}
                        onChange={(e) => setNewDeliverable(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none"
                        style={{
                          borderColor: 'var(--sapphire-300)',
                          color: 'var(--sapphire-900)',
                          backgroundColor: 'var(--surface-primary)'
                        }}
                        placeholder="Add a new deliverable..."
                        onKeyPress={(e) => e.key === 'Enter' && addDeliverable()}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--sapphire-500)';
                          e.target.style.boxShadow = '0 0 0 3px var(--sapphire-100)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--sapphire-300)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <Button
                        onClick={addDeliverable}
                        variant="primary"
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success Criteria */}
            {((currentFeature.successCriteria && currentFeature.successCriteria.length > 0) || editMode) && (
              <div className="rounded-lg p-6 border" style={{ backgroundColor: 'var(--emerald-50)', borderColor: 'var(--emerald-200)' }}>
                <h3 className="font-semibold mb-4 flex items-center space-x-2" style={{ color: 'var(--emerald-900)' }}>
                  <Target className="w-5 h-5" />
                  <span>Success Criteria ({currentFeature.successCriteria?.length || 0})</span>
                </h3>
                <div className="space-y-2">
                  {currentFeature.successCriteria?.map((criteria, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--emerald-600)' }} />
                      <span className="flex-1" style={{ color: 'var(--emerald-800)' }}>{criteria}</span>
                      {editMode && (
                        <Button
                          onClick={() => {
                            if (currentFeature.successCriteria) {
                              const updated = [...currentFeature.successCriteria]
                              updated.splice(index, 1)
                              updateFeature({ successCriteria: updated })
                            }
                          }}
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          className="flex-shrink-0"
                          style={{ color: 'var(--garnet-600)' }}
                          aria-label="Remove success criteria"
                        />
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none"
                        style={{
                          borderColor: 'var(--emerald-300)',
                          color: 'var(--emerald-900)',
                          backgroundColor: 'var(--surface-primary)'
                        }}
                        placeholder="Add success criteria..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            updateFeature({
                              successCriteria: [...(currentFeature.successCriteria || []), e.currentTarget.value.trim()]
                            })
                            e.currentTarget.value = ''
                          }
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--emerald-500)';
                          e.currentTarget.style.boxShadow = '0 0 0 3px var(--emerald-100)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--emerald-300)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      <Button
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement
                          if (input.value.trim()) {
                            updateFeature({
                              successCriteria: [...(currentFeature.successCriteria || []), input.value.trim()]
                            })
                            input.value = ''
                          }
                        }}
                        variant="primary"
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risks */}
            {((currentFeature.risks && currentFeature.risks.length > 0) || editMode) && (
              <div className="rounded-lg p-6 border" style={{ backgroundColor: 'var(--garnet-50)', borderColor: 'var(--garnet-200)' }}>
                <h3 className="font-semibold mb-4 flex items-center space-x-2" style={{ color: 'var(--garnet-900)' }}>
                  <AlertTriangle className="w-5 h-5" />
                  <span>Risk Factors ({currentFeature.risks?.length || 0})</span>
                </h3>
                <div className="space-y-2">
                  {currentFeature.risks?.map((risk, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: 'var(--garnet-600)' }} />
                      <span className="flex-1" style={{ color: 'var(--garnet-800)' }}>{risk}</span>
                      {editMode && (
                        <Button
                          onClick={() => {
                            if (currentFeature.risks) {
                              const updated = [...currentFeature.risks]
                              updated.splice(index, 1)
                              updateFeature({ risks: updated })
                            }
                          }}
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          className="flex-shrink-0"
                          style={{ color: 'var(--garnet-600)' }}
                          aria-label="Remove risk"
                        />
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none"
                        style={{
                          borderColor: 'var(--garnet-300)',
                          color: 'var(--garnet-900)',
                          backgroundColor: 'var(--surface-primary)'
                        }}
                        placeholder="Add risk factor..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            updateFeature({
                              risks: [...(currentFeature.risks || []), e.currentTarget.value.trim()]
                            })
                            e.currentTarget.value = ''
                          }
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--garnet-500)';
                          e.currentTarget.style.boxShadow = '0 0 0 3px var(--garnet-100)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--garnet-300)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      <Button
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement
                          if (input.value.trim()) {
                            updateFeature({
                              risks: [...(currentFeature.risks || []), input.value.trim()]
                            })
                            input.value = ''
                          }
                        }}
                        variant="danger"
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Related Ideas */}
            {((currentFeature.relatedIdeas && currentFeature.relatedIdeas.length > 0) || editMode) && (
              <div className="rounded-lg p-6 border" style={{ backgroundColor: 'var(--canvas-secondary)', borderColor: 'var(--hairline-default)' }}>
                <h3 className="font-semibold mb-4 flex items-center space-x-2" style={{ color: 'var(--graphite-900)' }}>
                  <Flag className="w-5 h-5" />
                  <span>Related Ideas ({currentFeature.relatedIdeas?.length || 0})</span>
                </h3>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {currentFeature.relatedIdeas?.map((idea, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm border"
                        style={{
                          backgroundColor: 'var(--graphite-100)',
                          color: 'var(--graphite-800)',
                          borderColor: 'var(--hairline-default)'
                        }}
                      >
                        {idea}
                        {editMode && (
                          <Button
                            onClick={() => {
                              if (currentFeature.relatedIdeas) {
                                const updated = [...currentFeature.relatedIdeas]
                                updated.splice(index, 1)
                                updateFeature({ relatedIdeas: updated })
                              }
                            }}
                            variant="ghost"
                            size="xs"
                            icon={<X className="w-3 h-3" />}
                            className="ml-2"
                            style={{ color: 'var(--graphite-600)' }}
                            aria-label="Remove related idea"
                          />
                        )}
                      </span>
                    ))}
                  </div>
                  {editMode && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none"
                        style={{
                          borderColor: 'var(--hairline-default)',
                          color: 'var(--graphite-900)',
                          backgroundColor: 'var(--surface-primary)'
                        }}
                        placeholder="Add related idea..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            updateFeature({
                              relatedIdeas: [...(currentFeature.relatedIdeas || []), e.currentTarget.value.trim()]
                            })
                            e.currentTarget.value = ''
                          }
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--sapphire-500)';
                          e.currentTarget.style.boxShadow = '0 0 0 3px var(--sapphire-100)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--hairline-default)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      <Button
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement
                          if (input.value.trim()) {
                            updateFeature({
                              relatedIdeas: [...(currentFeature.relatedIdeas || []), input.value.trim()]
                            })
                            input.value = ''
                          }
                        }}
                        variant="secondary"
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t" style={{ backgroundColor: 'var(--canvas-secondary)', borderColor: 'var(--hairline-default)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--graphite-600)' }}>
              <Clock className="w-4 h-4" />
              <span>ID: {currentFeature.id}</span>
            </div>
            <Button
              onClick={onClose}
              variant="secondary"
              size="sm"
            >
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-xl shadow-2xl max-w-md w-full" style={{ backgroundColor: 'var(--surface-primary)' }}>
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--garnet-100)' }}>
                  <Trash2 className="w-5 h-5" style={{ color: 'var(--garnet-600)' }} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--graphite-900)' }}>Delete Feature</h3>
                  <p className="text-sm" style={{ color: 'var(--graphite-600)' }}>This action cannot be undone</p>
                </div>
              </div>

              <p className="mb-6" style={{ color: 'var(--graphite-700)' }}>
                Are you sure you want to delete <strong>"{currentFeature.title}"</strong>?
                This will permanently remove the feature and all its associated data.
              </p>

              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="secondary"
                  size="md"
                  fullWidth
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelete}
                  variant="danger"
                  size="md"
                  fullWidth
                >
                  Delete Feature
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FeatureDetailModal