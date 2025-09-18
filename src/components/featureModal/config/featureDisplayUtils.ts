// Feature Display Utilities - Team names, colors, and formatting helpers

import type { FeaturePriority, FeatureStatus, FeatureComplexity } from './featureModalConstants'

// Team configuration and utilities
export const TEAM_CONFIG = {
  creative: {
    name: 'Creative Team',
    icon: '🎨',
    color: 'bg-pink-100 text-pink-800 border-pink-200'
  },
  digital: {
    name: 'Digital Marketing',
    icon: '📈',
    color: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  analytics: {
    name: 'Analytics Team',
    icon: '📊',
    color: 'bg-green-100 text-green-800 border-green-200'
  },
  web: {
    name: 'Web Team',
    icon: '🖥️',
    color: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  mobile: {
    name: 'Mobile Team',
    icon: '📱',
    color: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  marketing: {
    name: 'Marketing Team',
    icon: '📈',
    color: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  platform: {
    name: 'Platform Team',
    icon: '⚙️',
    color: 'bg-green-100 text-green-800 border-green-200'
  },
  testing: {
    name: 'QA & Testing',
    icon: '🧪',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  }
} as const

export type TeamId = keyof typeof TEAM_CONFIG

// Priority configuration
export const PRIORITY_CONFIG: Record<FeaturePriority, {
  name: string
  color: string
  weight: number
}> = {
  high: {
    name: 'High Priority',
    color: 'bg-red-100 text-red-800 border-red-200',
    weight: 3
  },
  medium: {
    name: 'Medium Priority',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    weight: 2
  },
  low: {
    name: 'Low Priority',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    weight: 1
  }
}

// Status configuration
export const STATUS_CONFIG: Record<FeatureStatus, {
  name: string
  color: string
  order: number
}> = {
  planned: {
    name: 'Planned',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    order: 1
  },
  'in-progress': {
    name: 'In Progress',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    order: 2
  },
  completed: {
    name: 'Completed',
    color: 'bg-green-100 text-green-800 border-green-200',
    order: 3
  }
}

// Complexity configuration
export const COMPLEXITY_CONFIG: Record<FeatureComplexity, {
  name: string
  color: string
  estimatedEffort: string
}> = {
  low: {
    name: 'Low',
    color: 'bg-green-100 text-green-800 border-green-200',
    estimatedEffort: '1-2 weeks'
  },
  medium: {
    name: 'Medium',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    estimatedEffort: '3-6 weeks'
  },
  high: {
    name: 'High',
    color: 'bg-red-100 text-red-800 border-red-200',
    estimatedEffort: '2-3 months'
  }
}

// Utility functions
export const getTeamDisplayName = (teamId: string): string => {
  if (teamId in TEAM_CONFIG) {
    return TEAM_CONFIG[teamId as TeamId].name
  }
  return teamId.charAt(0).toUpperCase() + teamId.slice(1) + ' Team'
}

export const getTeamIcon = (teamId: string): string => {
  if (teamId in TEAM_CONFIG) {
    return TEAM_CONFIG[teamId as TeamId].icon
  }
  return '💼'
}

export const getTeamColor = (teamId: string): string => {
  if (teamId in TEAM_CONFIG) {
    return TEAM_CONFIG[teamId as TeamId].color
  }
  return 'bg-gray-100 text-gray-800 border-gray-200'
}

export const getPriorityColor = (priority: FeaturePriority): string => {
  return PRIORITY_CONFIG[priority]?.color || 'bg-gray-100 text-gray-800 border-gray-200'
}

export const getPriorityName = (priority: FeaturePriority): string => {
  return PRIORITY_CONFIG[priority]?.name || priority
}

export const getStatusColor = (status: FeatureStatus): string => {
  return STATUS_CONFIG[status]?.color || 'bg-gray-100 text-gray-800 border-gray-200'
}

export const getStatusName = (status: FeatureStatus): string => {
  return STATUS_CONFIG[status]?.name || status
}

export const getComplexityColor = (complexity: FeatureComplexity): string => {
  return COMPLEXITY_CONFIG[complexity]?.color || 'bg-gray-100 text-gray-800 border-gray-200'
}

export const getComplexityName = (complexity: FeatureComplexity): string => {
  return COMPLEXITY_CONFIG[complexity]?.name || complexity
}

export const getComplexityEffort = (complexity: FeatureComplexity): string => {
  return COMPLEXITY_CONFIG[complexity]?.estimatedEffort || 'Unknown'
}

// Formatting utilities
export const formatDuration = (duration: number): string => {
  return `${duration} month${duration !== 1 ? 's' : ''}`
}

export const formatFeatureId = (id: string): string => {
  return `ID: ${id}`
}

export const formatArrayCount = (count: number, singular: string, plural?: string): string => {
  const pluralForm = plural || `${singular}s`
  return `${count} ${count === 1 ? singular : pluralForm}`
}

// Validation utilities
export const isValidTeam = (teamId: string): boolean => {
  return teamId in TEAM_CONFIG || teamId.length > 0
}

export const isValidPriority = (priority: string): priority is FeaturePriority => {
  return priority in PRIORITY_CONFIG
}

export const isValidStatus = (status: string): status is FeatureStatus => {
  return status in STATUS_CONFIG
}

export const isValidComplexity = (complexity: string): complexity is FeatureComplexity => {
  return complexity in COMPLEXITY_CONFIG
}

// Sorting utilities
export const sortByPriority = (a: { priority: FeaturePriority }, b: { priority: FeaturePriority }): number => {
  return PRIORITY_CONFIG[b.priority].weight - PRIORITY_CONFIG[a.priority].weight
}

export const sortByStatus = (a: { status: FeatureStatus }, b: { status: FeatureStatus }): number => {
  return STATUS_CONFIG[a.status].order - STATUS_CONFIG[b.status].order
}

// Export team IDs for use in dropdowns
export const AVAILABLE_TEAMS = Object.keys(TEAM_CONFIG) as TeamId[]
export const AVAILABLE_PRIORITIES: FeaturePriority[] = ['high', 'medium', 'low']
export const AVAILABLE_STATUSES: FeatureStatus[] = ['planned', 'in-progress', 'completed']
export const AVAILABLE_COMPLEXITIES: FeatureComplexity[] = ['low', 'medium', 'high']