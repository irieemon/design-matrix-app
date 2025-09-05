import { useState } from 'react'
import { X, ArrowRight, ArrowLeft, Calendar, Users, DollarSign, Tag, Sparkles, Lightbulb, CheckCircle } from 'lucide-react'
import { Project, ProjectType, IdeaCard } from '../types'
import { DatabaseService } from '../lib/database'
import { AIService } from '../lib/aiService'

interface ProjectStartupFlowProps {
  currentUser: string
  onClose: () => void
  onProjectCreated: (project: Project, ideas?: IdeaCard[]) => void
}

const PROJECT_TYPES = [
  {
    id: 'software' as ProjectType,
    name: 'Software Development',
    description: 'Web apps, mobile apps, APIs, and software platforms',
    icon: '💻',
    color: 'bg-blue-50 border-blue-200 text-blue-900'
  },
  {
    id: 'product_development' as ProjectType,
    name: 'Product Development',
    description: 'Physical products, prototypes, and product launches',
    icon: '🚀',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-900'
  },
  {
    id: 'business_plan' as ProjectType,
    name: 'Business Planning',
    description: 'Business strategy, market analysis, and planning',
    icon: '📊',
    color: 'bg-purple-50 border-purple-200 text-purple-900'
  },
  {
    id: 'marketing' as ProjectType,
    name: 'Marketing Campaign',
    description: 'Marketing initiatives, campaigns, and brand development',
    icon: '📢',
    color: 'bg-orange-50 border-orange-200 text-orange-900'
  },
  {
    id: 'operations' as ProjectType,
    name: 'Operations',
    description: 'Process improvement, workflows, and operational excellence',
    icon: '⚙️',
    color: 'bg-slate-50 border-slate-200 text-slate-900'
  },
  {
    id: 'research' as ProjectType,
    name: 'Research & Development',
    description: 'Market research, R&D projects, and innovation initiatives',
    icon: '🔬',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-900'
  },
  {
    id: 'other' as ProjectType,
    name: 'Other',
    description: 'Custom project type not listed above',
    icon: '✨',
    color: 'bg-gray-50 border-gray-200 text-gray-900'
  }
]

const ProjectStartupFlow: React.FC<ProjectStartupFlowProps> = ({ currentUser, onClose, onProjectCreated }) => {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    project_type: '' as ProjectType,
    description: '',
    start_date: '',
    target_date: '',
    budget: '',
    team_size: '',
    priority_level: 'medium' as Project['priority_level'],
    tags: [] as string[],
    enableAI: false
  })
  const [tagInput, setTagInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleCreateProject = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Prepare project data
      const projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'> = {
        name: formData.name,
        project_type: formData.project_type,
        description: formData.description || undefined,
        status: 'active',
        start_date: formData.start_date || undefined,
        target_date: formData.target_date || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        team_size: formData.team_size ? parseInt(formData.team_size) : undefined,
        priority_level: formData.priority_level,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        created_by: currentUser,
        is_ai_generated: formData.enableAI,
        ai_analysis: aiAnalysis?.projectAnalysis || undefined
      }

      // Create the project
      console.log('🏗️ Creating project...')
      const project = await DatabaseService.createProject(projectData)
      
      if (!project) {
        throw new Error('Failed to create project')
      }

      let createdIdeas: IdeaCard[] = []

      // Generate AI ideas if enabled
      if (formData.enableAI && aiAnalysis?.generatedIdeas) {
        console.log('🤖 Creating AI-generated ideas...')
        for (const ideaData of aiAnalysis.generatedIdeas) {
          const newIdea = await DatabaseService.createIdea({
            content: ideaData.content,
            details: ideaData.details,
            x: Math.round(ideaData.x),
            y: Math.round(ideaData.y),
            priority: ideaData.priority,
            created_by: currentUser,
            is_collapsed: false,
            editing_by: null,
            editing_at: null,
            project_id: project.id
          })

          if (newIdea) {
            createdIdeas.push(newIdea)
          }
        }
      }

      console.log('✅ Project created successfully!', { project, ideasCount: createdIdeas.length })
      onProjectCreated(project, createdIdeas)
      onClose()

    } catch (err) {
      console.error('Error creating project:', err)
      setError('Failed to create project. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAIToggle = async (enabled: boolean) => {
    setFormData(prev => ({ ...prev, enableAI: enabled }))
    
    if (enabled && formData.name && formData.description) {
      setIsLoading(true)
      try {
        console.log('🧠 Running AI analysis...')
        const analysis = await AIService.analyzeProjectAndGenerateIdeas(
          formData.name,
          formData.description
        )
        setAiAnalysis(analysis)
        console.log('✅ AI analysis complete:', analysis)
      } catch (err) {
        console.error('AI analysis failed:', err)
        setError('AI analysis failed. Project will be created without AI insights.')
      } finally {
        setIsLoading(false)
      }
    } else {
      setAiAnalysis(null)
    }
  }

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.name.trim() && formData.project_type && formData.description.trim()
      case 2:
        return true // Optional fields
      case 3:
        return true // Review step
      default:
        return false
    }
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lightbulb className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Project Basics</h3>
        <p className="text-slate-600">Let's start with the essential information about your project</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Project Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="e.g., Mobile App Launch, Q4 Marketing Campaign"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Project Type *
        </label>
        <div className="grid grid-cols-2 gap-3">
          {PROJECT_TYPES.map((type) => (
            <div
              key={type.id}
              onClick={() => handleInputChange('project_type', type.id)}
              className={`cursor-pointer border-2 rounded-lg p-3 transition-all ${
                formData.project_type === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-lg">{type.icon}</span>
                <span className="font-medium text-slate-900 text-sm">{type.name}</span>
              </div>
              <p className="text-xs text-slate-600">{type.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Project Description *
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          rows={4}
          placeholder="Describe your project goals, scope, target audience, and key objectives..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Project Details</h3>
        <p className="text-slate-600">Add timeline, budget, and other important details (optional)</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Start Date
          </label>
          <input
            type="date"
            value={formData.start_date}
            onChange={(e) => handleInputChange('start_date', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Target Date
          </label>
          <input
            type="date"
            value={formData.target_date}
            onChange={(e) => handleInputChange('target_date', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Budget
          </label>
          <input
            type="number"
            value={formData.budget}
            onChange={(e) => handleInputChange('budget', e.target.value)}
            placeholder="50000"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <Users className="w-4 h-4 inline mr-1" />
            Team Size
          </label>
          <input
            type="number"
            value={formData.team_size}
            onChange={(e) => handleInputChange('team_size', e.target.value)}
            placeholder="5"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Priority Level
        </label>
        <select
          value={formData.priority_level}
          onChange={(e) => handleInputChange('priority_level', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="low">🟢 Low Priority</option>
          <option value="medium">🟡 Medium Priority</option>
          <option value="high">🔴 High Priority</option>
          <option value="critical">⚠️ Critical Priority</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          <Tag className="w-4 h-4 inline mr-1" />
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add a tag..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={addTag}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Review & AI Enhancement</h3>
        <p className="text-slate-600">Review your project and optionally enable AI-powered insights</p>
      </div>

      {/* Project Summary */}
      <div className="bg-slate-50 rounded-lg p-4">
        <h4 className="font-medium text-slate-900 mb-3">Project Summary</h4>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Name:</span> {formData.name}</div>
          <div><span className="font-medium">Type:</span> {PROJECT_TYPES.find(t => t.id === formData.project_type)?.name}</div>
          <div><span className="font-medium">Description:</span> {formData.description}</div>
          {formData.start_date && <div><span className="font-medium">Start:</span> {formData.start_date}</div>}
          {formData.target_date && <div><span className="font-medium">Target:</span> {formData.target_date}</div>}
          {formData.budget && <div><span className="font-medium">Budget:</span> ${parseFloat(formData.budget).toLocaleString()}</div>}
        </div>
      </div>

      {/* AI Enhancement Toggle */}
      <div className="border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-slate-900">AI-Powered Project Startup</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enableAI}
              onChange={(e) => handleAIToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
        <p className="text-sm text-slate-600 mb-3">
          Let AI analyze your project and generate 5-8 strategic ideas positioned on the priority matrix
        </p>
        
        {formData.enableAI && aiAnalysis && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-900">AI Analysis Complete</p>
                <p className="text-sm text-purple-700">
                  Generated {aiAnalysis.generatedIdeas?.length || 0} strategic ideas for your {aiAnalysis.projectAnalysis?.industry} project
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create New Project</h2>
            <p className="text-sm text-gray-500">Step {step} of 3</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 text-sm underline mt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={step === 1 ? onClose : handleBack}
            className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{step === 1 ? 'Cancel' : 'Back'}</span>
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreateProject}
              disabled={isLoading}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>{isLoading ? 'Creating...' : 'Create Project'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectStartupFlow