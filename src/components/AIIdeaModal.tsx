import { useState } from 'react'
import { X, Sparkles, Wand2, Lightbulb, Target, RefreshCw } from 'lucide-react'
import { IdeaCard, Project, User } from '../types'
import { aiService } from '../lib/aiService'
import { logger } from '../utils/logger'

interface AIIdeaModalProps {
  onClose: () => void
  onAdd: (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => void
  currentProject?: Project | null
  currentUser?: User | null
}

const AIIdeaModal: React.FC<AIIdeaModalProps> = ({ onClose, onAdd, currentProject, currentUser }) => {
  const [title, setTitle] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedIdea, setGeneratedIdea] = useState<{
    content: string
    details: string
    priority: IdeaCard['priority']
  } | null>(null)

  const generateIdea = async () => {
    if (!title.trim()) return
    
    setIsGenerating(true)
    
    try {
      // Use the AI service to generate ideas with project context
      logger.debug('🎯 AIIdeaModal: Calling AI service with project context...')
      const projectContext = currentProject ? {
        name: currentProject.name,
        description: currentProject.description || '',
        type: currentProject.project_type
      } : undefined
      
      const aiResponse = await aiService.generateIdea(title.trim(), projectContext)
      logger.debug('✅ AIIdeaModal: AI response received:', aiResponse)
      setGeneratedIdea(aiResponse)
    } catch (error) {
      logger.error('❌ AIIdeaModal: Error generating AI idea:', error)
      // Fallback to mock if AI service fails
      const fallbackIdea = generateFallbackIdea(title.trim())
      setGeneratedIdea(fallbackIdea)
    }
    
    setIsGenerating(false)
  }

  const generateFallbackIdea = (title: string): {
    content: string
    details: string
    priority: IdeaCard['priority']
  } => {
    return {
      content: title.trim(),
      details: `AI service temporarily unavailable. ${title} represents an interesting opportunity that should be explored further with detailed analysis and stakeholder input.`,
      priority: 'moderate' as const
    }
  }

  const handleSubmit = () => {
    if (!generatedIdea) {
      logger.warn('⚠️ AIIdeaModal: No generated idea to submit')
      return
    }
    
    const newIdea = {
      content: generatedIdea.content,
      details: generatedIdea.details || '', // Ensure details has a default value
      x: Math.round(260 + Math.random() * 100 - 50), // Random position near center (rounded to integer)
      y: Math.round(260 + Math.random() * 100 - 50), // Random position near center (rounded to integer)
      priority: generatedIdea.priority,
      created_by: currentUser?.id || 'Anonymous',
      is_collapsed: true, // Default to minimized view
      editing_by: null, // Not being edited initially
      editing_at: null // Not being edited initially
    }
    
    logger.debug('📤 AIIdeaModal: Submitting idea to parent:', newIdea)
    
    onAdd(newIdea)
    
    logger.debug('🔄 AIIdeaModal: Closing modal...')
    // Close the modal after adding
    onClose()
  }

  const regenerateIdea = async () => {
    if (!title.trim()) return
    setGeneratedIdea(null)
    await generateIdea()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">AI Idea Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lightbulb className="w-4 h-4 inline mr-1" />
              Brief Idea Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Enter a brief title for your idea..."
              onKeyPress={(e) => e.key === 'Enter' && !isGenerating && generateIdea()}
            />
          </div>

          {/* Generate Button */}
          <div className="text-center">
            <button
              onClick={generateIdea}
              disabled={!title.trim() || isGenerating}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Ideas...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Generate AI Ideas</span>
                </>
              )}
            </button>
          </div>

          {/* Generated Idea Preview */}
          {generatedIdea && (
            <div className="border border-purple-200 rounded-lg p-4 bg-gradient-to-br from-purple-50 to-blue-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-purple-600" />
                  Generated Idea
                </h3>
                <button
                  onClick={regenerateIdea}
                  disabled={isGenerating}
                  className="flex items-center space-x-1 text-purple-600 hover:text-purple-700 text-sm"
                >
                  <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>Regenerate</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Title:</p>
                  <p className="text-gray-900">{generatedIdea.content}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700">Details:</p>
                  <p className="text-gray-700 text-sm leading-relaxed">{generatedIdea.details}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Suggested Priority:</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                    generatedIdea.priority === 'strategic' ? 'bg-blue-100 text-blue-800' :
                    generatedIdea.priority === 'moderate' ? 'bg-amber-100 text-amber-800' :
                    generatedIdea.priority === 'innovation' ? 'bg-purple-100 text-purple-800' :
                    generatedIdea.priority === 'high' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {generatedIdea.priority}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
            <h4 className="text-sm font-medium text-purple-800 mb-2 flex items-center">
              <Sparkles className="w-4 h-4 mr-1" />
              How it works
            </h4>
            <div className="text-sm text-purple-700 space-y-1">
              <p>• Enter a brief title describing your idea</p>
              <p>• AI will generate detailed descriptions and context</p>
              <p>• Review and refine the generated content</p>
              <p>• Add to your matrix with suggested priority level</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!generatedIdea}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-md hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Add AI Idea to Matrix
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIIdeaModal