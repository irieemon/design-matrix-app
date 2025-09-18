import React from 'react'
import { Lightbulb, Loader } from 'lucide-react'
import type { ProjectAnalysis } from '../../hooks/aiStarter'
import type { ProjectType } from '../../types'

interface ProjectReviewStepProps {
  analysis: ProjectAnalysis
  selectedProjectType: ProjectType | 'auto'
  selectedIndustry: string | 'auto'
  isLoading: boolean
  onBack: () => void
  onCreateProject: () => void
}

const ProjectReviewStep: React.FC<ProjectReviewStepProps> = ({
  analysis,
  selectedProjectType,
  selectedIndustry,
  isLoading,
  onBack,
  onCreateProject
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lightbulb className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Project Analysis Complete</h3>
        <p className="text-slate-600">Review the generated ideas and create your project</p>
      </div>

      <div className="space-y-6">
        {/* Project Analysis Summary */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h4 className="font-medium text-slate-900 mb-3">Project Analysis</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Industry:</span>
              <span className="ml-2 font-medium">{analysis.projectAnalysis.industry}</span>
              {selectedIndustry !== 'auto' && (
                <span className="ml-1 text-green-600 text-xs">✓ Manual</span>
              )}
            </div>
            <div>
              <span className="text-slate-500">Timeline:</span>
              <span className="ml-2 font-medium">{analysis.projectAnalysis.timeline}</span>
            </div>
          </div>

          {/* Show project type recommendation if auto was selected */}
          {selectedProjectType === 'auto' && analysis.projectAnalysis.recommendedProjectType && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-blue-700 text-sm font-medium">🤖 AI Recommended Project Type:</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                  {analysis.projectAnalysis.recommendedProjectType}
                </span>
              </div>
              {analysis.projectAnalysis.projectTypeReasoning && (
                <p className="text-blue-700 text-xs">{analysis.projectAnalysis.projectTypeReasoning}</p>
              )}
            </div>
          )}

          {/* Show manual project type selection */}
          {selectedProjectType !== 'auto' && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-green-700 text-sm font-medium">✓ Selected Project Type:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                  {selectedProjectType}
                </span>
              </div>
            </div>
          )}

          {/* Show manual industry selection */}
          {selectedIndustry !== 'auto' && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-green-700 text-sm font-medium">✓ Selected Industry:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                  {selectedIndustry}
                </span>
              </div>
            </div>
          )}

          <div className="mt-3">
            <span className="text-slate-500 text-sm">Primary Goals:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {analysis.projectAnalysis.primaryGoals.map((goal, i) => (
                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {goal}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Generated Ideas Preview */}
        <div>
          <h4 className="font-medium text-slate-900 mb-3">Generated Ideas ({analysis.generatedIdeas.length})</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {analysis.generatedIdeas.map((idea, index) => (
              <div key={index} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <h5 className="font-medium text-slate-900">{idea.content}</h5>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    idea.priority === 'high' ? 'bg-red-100 text-red-800' :
                    idea.priority === 'strategic' ? 'bg-blue-100 text-blue-800' :
                    idea.priority === 'moderate' ? 'bg-amber-100 text-amber-800' :
                    idea.priority === 'innovation' ? 'bg-purple-100 text-purple-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {idea.priority}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">{idea.details}</p>
                {idea.reasoning && (
                  <p className="text-xs text-slate-500 italic">Positioned: {idea.reasoning}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onCreateProject}
          disabled={isLoading || !analysis?.generatedIdeas.length}
          className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2"
        >
          {isLoading ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Lightbulb className="w-4 h-4" />
          )}
          <span>{isLoading ? 'Creating...' : `Create Project & ${analysis?.generatedIdeas.length || 0} Ideas`}</span>
        </button>
      </div>
    </div>
  )
}

export default ProjectReviewStep