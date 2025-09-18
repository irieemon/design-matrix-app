import React from 'react'
import { Sparkles, Lightbulb, Loader } from 'lucide-react'
import type { ProjectType } from '../../types'

interface ProjectBasicsStepProps {
  projectName: string
  onProjectNameChange: (name: string) => void
  projectDescription: string
  onProjectDescriptionChange: (description: string) => void
  selectedProjectType: ProjectType | 'auto'
  onProjectTypeChange: (type: ProjectType | 'auto') => void
  selectedIndustry: string | 'auto'
  onIndustryChange: (industry: string | 'auto') => void
  ideaCount: number
  onIdeaCountChange: (count: number) => void
  ideaTolerance: number
  onIdeaToleranceChange: (tolerance: number) => void
  isLoading: boolean
  isFormValid: boolean
  onCancel: () => void
  onStartAnalysis: () => void
}

const ProjectBasicsStep: React.FC<ProjectBasicsStepProps> = ({
  projectName,
  onProjectNameChange,
  projectDescription,
  onProjectDescriptionChange,
  selectedProjectType,
  onProjectTypeChange,
  selectedIndustry,
  onIndustryChange,
  ideaCount,
  onIdeaCountChange,
  ideaTolerance,
  onIdeaToleranceChange,
  isLoading,
  isFormValid,
  onCancel,
  onStartAnalysis
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">AI Project Starter</h3>
        <p className="text-slate-600">Let AI help you set up your project and generate prioritized ideas</p>
      </div>

      <div>
        <label htmlFor="project-name" className="block text-sm font-medium text-slate-700 mb-2">
          Project Name
        </label>
        <input
          id="project-name"
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          placeholder="e.g., Mobile App Launch, Marketing Campaign, Process Improvement"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="project-description" className="block text-sm font-medium text-slate-700 mb-2">
          Project Description
        </label>
        <textarea
          id="project-description"
          value={projectDescription}
          onChange={(e) => onProjectDescriptionChange(e.target.value)}
          rows={4}
          placeholder="Describe your project goals, target audience, scope, timeline, or any other relevant details..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="project-type" className="block text-sm font-medium text-slate-700 mb-2">
            Project Type
          </label>
          <select
            id="project-type"
            value={selectedProjectType}
            onChange={(e) => onProjectTypeChange(e.target.value as ProjectType | 'auto')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="auto">🤖 Let AI recommend</option>
            <option value="software">💻 Software Development</option>
            <option value="product_development">🛠️ Product Development</option>
            <option value="business_plan">📊 Business Plan</option>
            <option value="marketing">📢 Marketing Campaign</option>
            <option value="operations">⚙️ Operations Improvement</option>
            <option value="research">🔬 Research & Development</option>
            <option value="other">❓ Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-slate-700 mb-2">
            Industry
          </label>
          <select
            id="industry"
            value={selectedIndustry}
            onChange={(e) => onIndustryChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="auto">🤖 Let AI recommend</option>
            <option value="Healthcare">🏥 Healthcare</option>
            <option value="Technology">💻 Technology</option>
            <option value="Finance">💰 Finance</option>
            <option value="Education">🎓 Education</option>
            <option value="Retail">🛍️ Retail & E-commerce</option>
            <option value="Real Estate">🏠 Real Estate</option>
            <option value="Food & Hospitality">🍽️ Food & Hospitality</option>
            <option value="Non-profit">❤️ Non-profit</option>
            <option value="Manufacturing">🏭 Manufacturing</option>
            <option value="Construction">🔨 Construction</option>
            <option value="Transportation">🚚 Transportation</option>
            <option value="Media & Entertainment">🎬 Media & Entertainment</option>
            <option value="Professional Services">💼 Professional Services</option>
            <option value="General">📋 General</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-slate-500 -mt-2">
        <p>This helps generate more relevant roadmaps, user stories, and industry-specific recommendations</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="idea-count" className="block text-sm font-medium text-slate-700 mb-2">
            Number of Ideas: {ideaCount}
          </label>
          <input
            id="idea-count"
            type="range"
            min="3"
            max="12"
            value={ideaCount}
            onChange={(e) => onIdeaCountChange(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>3</span>
            <span>12</span>
          </div>
        </div>

        <div>
          <label htmlFor="idea-tolerance" className="block text-sm font-medium text-slate-700 mb-2">
            Idea Tolerance: {ideaTolerance}%
          </label>
          <input
            id="idea-tolerance"
            type="range"
            min="0"
            max="100"
            value={ideaTolerance}
            onChange={(e) => onIdeaToleranceChange(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>Conservative</span>
            <span>Experimental</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Higher tolerance includes more experimental or challenging ideas
          </p>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Lightbulb className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-purple-900 mb-1">How it works</h4>
            <p className="text-sm text-purple-700">
              AI will analyze your project and generate {ideaCount} strategic ideas positioned on the priority matrix.
              If more context is needed, you'll be asked clarifying questions to ensure the best recommendations.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onStartAnalysis}
          disabled={!isFormValid || isLoading}
          className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2"
        >
          {isLoading ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{isLoading ? 'Analyzing...' : 'Start AI Analysis'}</span>
        </button>
      </div>
    </div>
  )
}

export default ProjectBasicsStep