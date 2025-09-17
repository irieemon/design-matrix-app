export interface Epic {
  title: string
  description: string
  userStories: string[]
  deliverables: string[]
  priority: string
  complexity: string
  relatedIdeas: string[]
  // Timeline-specific properties
  startMonth?: number
  duration?: number
  status?: 'planned' | 'in-progress' | 'completed'
  team?: string
}

export interface Phase {
  phase: string
  duration: string
  description: string
  epics: Epic[]
  risks: string[]
  successCriteria: string[]
}

export interface Milestone {
  milestone: string
  timeline: string
  description: string
}

export interface RoadmapData {
  // New format
  roadmapAnalysis?: {
    totalDuration: string
    phases: Phase[]
  }
  executionStrategy?: {
    methodology: string
    sprintLength: string
    teamRecommendations: string
    keyMilestones: Milestone[]
  }
  // Legacy format fallbacks
  timeline?: string
  phases?: Phase[]
}

export interface RoadmapViewMode {
  mode: 'detailed' | 'timeline'
}

export interface RoadmapState {
  isLoading: boolean
  error: string | null
  expandedPhases: Set<number>
  showHistory: boolean
  selectedRoadmapId: string | null
  showConfirmModal: boolean
  isExportModalOpen: boolean
}