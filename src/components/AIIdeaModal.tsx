import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, Wand2, Target, RefreshCw } from 'lucide-react'
import { IdeaCard, Project, User } from '../types'
import { aiService } from '../lib/aiService'
import { logger } from '../utils/logger'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

interface AIIdeaModalProps {
  onClose: () => void
  onAdd: (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => void
  currentProject?: Project | null
  currentUser?: User | null
  /** Custom portal target for fullscreen mode */
  portalTarget?: HTMLElement
}

const AIIdeaModal: React.FC<AIIdeaModalProps> = ({ onClose, onAdd, currentProject, currentUser, portalTarget }) => {
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
    } catch (_error) {
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

  const modalContent = (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ pointerEvents: 'none' }}>
      <div className="lux-modal-backdrop" onClick={onClose} style={{ pointerEvents: 'auto' }} />
      <div className="lux-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ pointerEvents: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--hairline-default)', backgroundColor: 'var(--canvas-secondary)' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--graphite-700)' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--graphite-900)' }}>AI Idea Assistant</h2>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            icon={<X className="w-5 h-5" />}
            aria-label="Close modal"
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title Input */}
          <Input
            label="Brief Idea Title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a brief title for your idea..."
            onKeyPress={(e) => e.key === 'Enter' && !isGenerating && generateIdea()}
            fullWidth
            variant="primary"
            size="md"
          />

          {/* Generate Button */}
          <div className="text-center">
            <Button
              onClick={generateIdea}
              disabled={!title.trim() || isGenerating}
              variant="sapphire"
              size="lg"
              icon={isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            >
              {isGenerating ? 'Generating Ideas...' : 'Generate AI Ideas'}
            </Button>
          </div>

          {/* Generated Idea Preview */}
          {generatedIdea && (
            <div className="border rounded-lg p-4" style={{
              borderColor: 'var(--hairline-default)',
              backgroundColor: 'var(--canvas-secondary)'
            }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center" style={{ color: 'var(--graphite-900)' }}>
                  <Target className="w-5 h-5 mr-2" style={{ color: 'var(--sapphire-600)' }} />
                  Generated Idea
                </h3>
                <Button
                  onClick={regenerateIdea}
                  disabled={isGenerating}
                  variant="ghost"
                  size="sm"
                  icon={<RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />}
                >
                  Regenerate
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--graphite-700)' }}>Title:</p>
                  <p style={{ color: 'var(--graphite-900)' }}>{generatedIdea.content}</p>
                </div>

                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--graphite-700)' }}>Details:</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--graphite-700)' }}>{generatedIdea.details}</p>
                </div>

                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--graphite-700)' }}>Suggested Priority:</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                    generatedIdea.priority === 'strategic' ? 'lux-badge-primary' :
                    generatedIdea.priority === 'moderate' ? 'lux-badge-warning' :
                    generatedIdea.priority === 'innovation' ? 'lux-badge-primary' :
                    generatedIdea.priority === 'high' ? 'lux-badge-error' :
                    'lux-badge-secondary'
                  }`}>
                    {generatedIdea.priority}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="rounded-lg p-4 border" style={{
            backgroundColor: 'var(--sapphire-50)',
            borderColor: 'var(--sapphire-200)'
          }}>
            <h4 className="text-sm font-medium mb-2 flex items-center" style={{ color: 'var(--sapphire-800)' }}>
              <Sparkles className="w-4 h-4 mr-1" />
              How it works
            </h4>
            <div className="text-sm space-y-1" style={{ color: 'var(--sapphire-700)' }}>
              <p>• Enter a brief title describing your idea</p>
              <p>• AI will generate detailed descriptions and context</p>
              <p>• Review and refine the generated content</p>
              <p>• Add to your matrix with suggested priority level</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <Button
              onClick={onClose}
              variant="secondary"
              fullWidth
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!generatedIdea}
              variant="sapphire"
              fullWidth
            >
              Add AI Idea to Matrix
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  // Render modal content to portal target (defaults to document.body)
  // CRITICAL: For fullscreen mode, portal target must be the fullscreen container
  return createPortal(modalContent, portalTarget || document.body)
}

export default AIIdeaModal