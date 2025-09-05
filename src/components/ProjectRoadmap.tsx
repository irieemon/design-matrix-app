import { useState } from 'react'
import { Map, Calendar, Users, Clock, AlertTriangle, CheckCircle, Lightbulb, ArrowRight, Sparkles, Loader } from 'lucide-react'
import { Project, IdeaCard } from '../types'
import { AIService } from '../lib/aiService'

interface ProjectRoadmapProps {
  currentUser: string
  currentProject: Project | null
  ideas: IdeaCard[]
}

interface Epic {
  title: string
  description: string
  userStories: string[]
  deliverables: string[]
  priority: string
  complexity: string
  relatedIdeas: string[]
}

interface Phase {
  phase: string
  duration: string
  description: string
  epics: Epic[]
  risks: string[]
  successCriteria: string[]
}

interface Milestone {
  milestone: string
  timeline: string
  description: string
}

interface RoadmapData {
  roadmapAnalysis: {
    totalDuration: string
    phases: Phase[]
  }
  executionStrategy: {
    methodology: string
    sprintLength: string
    teamRecommendations: string
    keyMilestones: Milestone[]
  }
}

const ProjectRoadmap: React.FC<ProjectRoadmapProps> = ({ currentUser, currentProject, ideas }) => {
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set())

  const generateRoadmap = async () => {
    if (!currentProject) {
      setError('Please select a project to generate a roadmap')
      return
    }

    if (ideas.length === 0) {
      setError('No ideas found for this project. Add some ideas to the priority matrix first.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🗺️ Generating roadmap for project:', currentProject.name)
      console.log('📋 Processing', ideas.length, 'ideas')
      
      const data = await AIService.generateRoadmap(
        currentProject.name,
        currentProject.description || '',
        ideas
      )
      
      setRoadmapData(data)
      console.log('✅ Roadmap generated successfully')
    } catch (err) {
      console.error('Error generating roadmap:', err)
      setError('Failed to generate roadmap. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const togglePhaseExpansion = (phaseIndex: number) => {
    const newExpanded = new Set(expandedPhases)
    if (newExpanded.has(phaseIndex)) {
      newExpanded.delete(phaseIndex)
    } else {
      newExpanded.add(phaseIndex)
    }
    setExpandedPhases(newExpanded)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  const getComplexityColor = (complexity: string) => {
    switch (complexity.toLowerCase()) {
      case 'high':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'low':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  if (!currentProject) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-16">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
            <Map className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Project Selected</h3>
            <p className="text-slate-600 mb-6">
              Select a project to generate an AI-powered roadmap with user stories and deliverables.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl shadow-sm border border-blue-200/60 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Map className="w-6 h-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Project Roadmap</h1>
            </div>
            <p className="text-slate-600 mb-2">
              AI-generated roadmap for <strong>{currentProject.name}</strong>
            </p>
            <p className="text-sm text-slate-500">
              Analyzing {ideas.length} ideas • Created by {currentUser}
            </p>
          </div>
          <button
            onClick={generateRoadmap}
            disabled={isLoading}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            <span>{isLoading ? 'Generating...' : 'Generate Roadmap'}</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-700 font-medium">Error generating roadmap</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Roadmap Content */}
      {roadmapData && (
        <div className="space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium text-slate-900">Duration</h3>
              </div>
              <p className="text-2xl font-bold text-blue-600">{roadmapData.roadmapAnalysis.totalDuration}</p>
              <p className="text-sm text-slate-600 mt-1">Total project timeline</p>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-3">
                <Users className="w-5 h-5 text-green-600" />
                <h3 className="font-medium text-slate-900">Methodology</h3>
              </div>
              <p className="text-2xl font-bold text-green-600">{roadmapData.executionStrategy.methodology}</p>
              <p className="text-sm text-slate-600 mt-1">{roadmapData.executionStrategy.sprintLength} sprints</p>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-3">
                <CheckCircle className="w-5 h-5 text-purple-600" />
                <h3 className="font-medium text-slate-900">Phases</h3>
              </div>
              <p className="text-2xl font-bold text-purple-600">{roadmapData.roadmapAnalysis.phases.length}</p>
              <p className="text-sm text-slate-600 mt-1">Development phases</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Development Timeline</span>
              </h2>
            </div>
            
            <div className="p-6">
              {/* Phases */}
              <div className="space-y-6">
                {roadmapData.roadmapAnalysis.phases.map((phase, phaseIndex) => (
                  <div key={phaseIndex} className="relative">
                    {/* Phase Timeline Line */}
                    {phaseIndex < roadmapData.roadmapAnalysis.phases.length - 1 && (
                      <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-slate-200"></div>
                    )}
                    
                    {/* Phase Header */}
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {phaseIndex + 1}
                      </div>
                      
                      <div className="flex-1">
                        <div 
                          className="cursor-pointer"
                          onClick={() => togglePhaseExpansion(phaseIndex)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-bold text-slate-900">{phase.phase}</h3>
                            <div className="flex items-center space-x-3">
                              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                {phase.duration}
                              </span>
                              <ArrowRight 
                                className={`w-5 h-5 text-slate-400 transition-transform ${
                                  expandedPhases.has(phaseIndex) ? 'rotate-90' : ''
                                }`}
                              />
                            </div>
                          </div>
                          <p className="text-slate-600 mb-4">{phase.description}</p>
                        </div>
                        
                        {/* Expanded Phase Content */}
                        {expandedPhases.has(phaseIndex) && (
                          <div className="space-y-6 pl-4 border-l-2 border-slate-100">
                            {/* Epics */}
                            <div>
                              <h4 className="font-medium text-slate-900 mb-3 flex items-center space-x-2">
                                <Lightbulb className="w-4 h-4" />
                                <span>Epics ({phase.epics.length})</span>
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {phase.epics.map((epic, epicIndex) => (
                                  <div key={epicIndex} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                    <div className="flex items-start justify-between mb-3">
                                      <h5 className="font-medium text-slate-900">{epic.title}</h5>
                                      <div className="flex space-x-1">
                                        <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityColor(epic.priority)}`}>
                                          {epic.priority}
                                        </span>
                                        <span className={`px-2 py-1 rounded-full text-xs border ${getComplexityColor(epic.complexity)}`}>
                                          {epic.complexity}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <p className="text-sm text-slate-600 mb-3">{epic.description}</p>
                                    
                                    {/* User Stories */}
                                    <div className="mb-3">
                                      <p className="text-xs font-medium text-slate-700 mb-1">User Stories:</p>
                                      <ul className="text-xs text-slate-600 space-y-1">
                                        {epic.userStories.map((story, storyIndex) => (
                                          <li key={storyIndex} className="flex items-start space-x-1">
                                            <span className="text-slate-400">•</span>
                                            <span>{story}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    
                                    {/* Deliverables */}
                                    <div className="mb-3">
                                      <p className="text-xs font-medium text-slate-700 mb-1">Deliverables:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {epic.deliverables.map((deliverable, deliverableIndex) => (
                                          <span 
                                            key={deliverableIndex}
                                            className="bg-white text-slate-700 px-2 py-1 rounded text-xs border border-slate-200"
                                          >
                                            {deliverable}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* Related Ideas */}
                                    {epic.relatedIdeas.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-slate-700 mb-1">Related Ideas:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {epic.relatedIdeas.map((idea, ideaIndex) => (
                                            <span 
                                              key={ideaIndex}
                                              className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs"
                                            >
                                              {idea}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Risks and Success Criteria */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                <h4 className="font-medium text-red-900 mb-2 flex items-center space-x-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  <span>Risks</span>
                                </h4>
                                <ul className="text-sm text-red-800 space-y-1">
                                  {phase.risks.map((risk, riskIndex) => (
                                    <li key={riskIndex} className="flex items-start space-x-1">
                                      <span className="text-red-400">•</span>
                                      <span>{risk}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              
                              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                <h4 className="font-medium text-green-900 mb-2 flex items-center space-x-2">
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Success Criteria</span>
                                </h4>
                                <ul className="text-sm text-green-800 space-y-1">
                                  {phase.successCriteria.map((criteria, criteriaIndex) => (
                                    <li key={criteriaIndex} className="flex items-start space-x-1">
                                      <span className="text-green-400">•</span>
                                      <span>{criteria}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Execution Strategy */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Execution Strategy</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Team Recommendations */}
                <div>
                  <h3 className="font-medium text-slate-900 mb-3 flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>Team Recommendations</span>
                  </h3>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    {roadmapData.executionStrategy.teamRecommendations}
                  </p>
                </div>
                
                {/* Key Milestones */}
                <div>
                  <h3 className="font-medium text-slate-900 mb-3 flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Key Milestones</span>
                  </h3>
                  <div className="space-y-3">
                    {roadmapData.executionStrategy.keyMilestones.map((milestone, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 text-xs font-bold">{index + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-slate-900 text-sm">{milestone.milestone}</h4>
                            <span className="text-purple-600 text-xs bg-purple-100 px-2 py-1 rounded">
                              {milestone.timeline}
                            </span>
                          </div>
                          <p className="text-slate-600 text-xs mt-1">{milestone.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectRoadmap