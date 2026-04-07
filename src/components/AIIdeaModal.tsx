import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Sparkles,
  Wand2,
  Target,
  RefreshCw,
  ImagePlus,
  Eye,
  AlertCircle,
} from 'lucide-react'
import { IdeaCard, Project, User } from '../types'
import { aiService } from '../lib/aiService'
import { logger } from '../utils/logger'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { FileService } from '../lib/fileService'
import { supabase } from '../lib/supabase'
import { useCsrfToken } from '../hooks/useCsrfToken'
import { resizeImageToFile } from '../lib/imageResize'

interface AIIdeaModalProps {
  onClose: () => void
  onAdd: (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => void
  currentProject?: Project | null
  currentUser?: User | null
  /** Custom portal target for fullscreen mode */
  portalTarget?: HTMLElement
}

type Tab = 'generate' | 'image'
type ImageStage = 'idle' | 'resizing' | 'uploading' | 'analyzing' | 'done' | 'error'

interface NormalizedAnalysis {
  subject: string
  description: string
  textContent: string
  insights: string[]
  relevanceScore: number
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_PRE_RESIZE_BYTES = 20 * 1024 * 1024

function normalizeAnalysisResult(raw: any): NormalizedAnalysis {
  return {
    subject: raw?.subject || (raw?.description?.split('\n')[0]) || 'Image Analysis',
    description: raw?.description || raw?.projectRelevance || '',
    textContent: raw?.textContent || raw?.extractedText || '',
    insights: Array.isArray(raw?.insights) ? raw.insights : [],
    relevanceScore:
      typeof raw?.relevanceScore === 'number'
        ? raw.relevanceScore
        : raw?.relevance === 'high'
        ? 85
        : raw?.relevance === 'medium'
        ? 55
        : 25,
  }
}

function mapRelevanceToPriority(score: number): IdeaCard['priority'] {
  if (score >= 70) return 'strategic'
  if (score >= 40) return 'moderate'
  return 'low'
}

const AIIdeaModal: React.FC<AIIdeaModalProps> = ({ onClose, onAdd, currentProject, currentUser, portalTarget }) => {
  const [title, setTitle] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedIdea, setGeneratedIdea] = useState<{
    content: string
    details: string
    priority: IdeaCard['priority']
  } | null>(null)

  // Image tab state
  const [activeTab, setActiveTab] = useState<Tab>('generate')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageStage, setImageStage] = useState<ImageStage>('idle')
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [imageError, setImageError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<NormalizedAnalysis | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { getCsrfHeaders, hasToken } = useCsrfToken()

  const generateIdea = async () => {
    if (!title.trim()) return

    setIsGenerating(true)

    try {
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
      details: generatedIdea.details || '',
      x: Math.round(260 + Math.random() * 100 - 50),
      y: Math.round(260 + Math.random() * 100 - 50),
      priority: generatedIdea.priority,
      created_by: currentUser?.id || 'Anonymous',
      is_collapsed: true,
      editing_by: null,
      editing_at: null
    }

    logger.debug('📤 AIIdeaModal: Submitting idea to parent:', newIdea)

    onAdd(newIdea)

    logger.debug('🔄 AIIdeaModal: Closing modal...')
    onClose()
  }

  const regenerateIdea = async () => {
    if (!title.trim()) return
    setGeneratedIdea(null)
    await generateIdea()
  }

  // ─────────────────────────── Image tab handlers ───────────────────────────

  const handleFileSelected = (file: File) => {
    setImageError(null)
    setAnalysis(null)
    setImageStage('idle')

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('This file type is not supported. Please upload a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_PRE_RESIZE_BYTES) {
      setImageError('This image is too large (max 20MB). Please choose a smaller file.')
      return
    }

    setSelectedFile(file)
    try {
      setImagePreviewUrl(URL.createObjectURL(file))
    } catch {
      setImagePreviewUrl(null)
    }
  }

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      try { URL.revokeObjectURL(imagePreviewUrl) } catch { /* noop */ }
    }
    setSelectedFile(null)
    setImagePreviewUrl(null)
    setAnalysis(null)
    setImageStage('idle')
    setImageError(null)
    setUploadProgress(0)
  }

  const handleAnalyzeImage = async () => {
    if (!selectedFile || !currentProject?.id) return
    setImageError(null)
    setImageStage('resizing')
    try {
      const resized = await resizeImageToFile(selectedFile, { maxEdgePx: 2048, quality: 0.85 })

      setImageStage('uploading')
      setUploadProgress(10)
      const uploadResult = await FileService.uploadFile(
        resized,
        currentProject.id,
        'Image uploaded for AI analysis',
        currentUser?.id
      )
      if (!uploadResult.success || !uploadResult.file) {
        throw new Error(uploadResult.error || 'Image upload failed. Check your connection and try again.')
      }
      setUploadProgress(70)

      const { data: signedData, error: signedError } = await supabase.storage
        .from('project-files')
        .createSignedUrl(uploadResult.file.storage_path, 3600)
      if (signedError || !signedData?.signedUrl) {
        throw new Error('Could not generate image URL for analysis')
      }
      setUploadProgress(100)

      setImageStage('analyzing')
      const accessToken = localStorage.getItem('sb-access-token') || ''
      const response = await fetch('/api/ai?action=analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          imageUrl: signedData.signedUrl,
          projectContext: {
            projectName: currentProject?.name,
            projectDescription: currentProject?.description,
            projectType: currentProject?.project_type,
          },
          analysisType: 'general',
        }),
      })
      if (!response.ok) {
        throw new Error('AI analysis could not be completed. Try uploading a different image or try again later.')
      }
      const json = await response.json()
      const normalized = normalizeAnalysisResult(json.analysis || json)
      setAnalysis(normalized)
      setImageStage('done')
    } catch (err) {
      setImageStage('error')
      setImageError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  const handleCreateIdeaFromAnalysis = () => {
    if (!analysis) return
    const details = [
      analysis.description,
      analysis.textContent ? `Extracted text: ${analysis.textContent}` : null,
      analysis.insights.length ? `Insights: ${analysis.insights.join(' • ')}` : null,
    ].filter(Boolean).join('\n\n')

    onAdd({
      content: analysis.subject,
      details,
      x: Math.round(260 + Math.random() * 100 - 50),
      y: Math.round(260 + Math.random() * 100 - 50),
      priority: mapRelevanceToPriority(analysis.relevanceScore),
      created_by: currentUser?.id || 'Anonymous',
      is_collapsed: true,
      editing_by: null,
      editing_at: null,
    })
    onClose()
  }

  const onDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const onDropZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }
  const onDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelected(file)
  }

  const relevanceBadgeClass = (score: number) => {
    if (score >= 70) return 'lux-badge-primary'
    if (score >= 40) return 'lux-badge-warning'
    return 'lux-badge-secondary'
  }

  const relevanceLabel = (score: number) => {
    if (score >= 70) return 'High relevance'
    if (score >= 40) return 'Medium relevance'
    return 'Low relevance'
  }

  const isImageBusy =
    imageStage === 'resizing' || imageStage === 'uploading' || imageStage === 'analyzing'

  const modalContent = (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ pointerEvents: 'none' }}>
      <div className="lux-modal-backdrop" onClick={onClose} style={{ pointerEvents: 'auto' }} />
      <div className="lux-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ pointerEvents: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-hairline-default bg-canvas-secondary">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-graphite-700">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-graphite-900">AI Idea Assistant</h2>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            icon={<X className="w-5 h-5" />}
            aria-label="Close modal"
          />
        </div>

        {/* Tabs */}
        <div role="tablist" className="flex items-center border-b border-hairline-default px-6 bg-canvas-secondary">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'generate'}
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'generate'
                ? 'border-sapphire-500 text-graphite-900'
                : 'border-transparent text-graphite-500 hover:text-graphite-700'
            }`}
          >
            AI Generate
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'image'}
            onClick={() => setActiveTab('image')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'image'
                ? 'border-sapphire-500 text-graphite-900'
                : 'border-transparent text-graphite-500 hover:text-graphite-700'
            }`}
          >
            Image
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {activeTab === 'generate' && (
            <>
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
                <div className="border rounded-lg p-4 border-hairline-default bg-canvas-secondary">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center text-graphite-900">
                      <Target className="w-5 h-5 mr-2 text-sapphire-600" />
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
                      <p className="text-sm font-medium text-graphite-700">Title:</p>
                      <p className="text-graphite-900">{generatedIdea.content}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-graphite-700">Details:</p>
                      <p className="text-sm leading-relaxed text-graphite-700">{generatedIdea.details}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-graphite-700">Suggested Priority:</p>
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
              <div className="rounded-lg p-4 border bg-sapphire-50 border-sapphire-200">
                <h4 className="text-sm font-medium mb-2 flex items-center text-sapphire-800">
                  <Sparkles className="w-4 h-4 mr-1" />
                  How it works
                </h4>
                <div className="text-sm space-y-1 text-sapphire-700">
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
                  Close
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
            </>
          )}

          {activeTab === 'image' && (
            <>
              {/* Drop zone */}
              {!selectedFile && (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload an image for AI analysis"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onDragOver={onDropZoneDragOver}
                  onDragEnter={onDropZoneDragOver}
                  onDragLeave={onDropZoneDragLeave}
                  onDrop={onDropZoneDrop}
                  className={`min-h-[160px] flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-sapphire-500 bg-sapphire-50'
                      : 'border-hairline-default bg-canvas-secondary hover:border-sapphire-300'
                  }`}
                >
                  <ImagePlus className="w-8 h-8 text-graphite-500 mb-2" />
                  <h3 className="text-base font-semibold text-graphite-900">Upload an image</h3>
                  <p className="text-sm text-graphite-700 mt-1">
                    Drag and drop an image here, or click to browse. Supports JPEG, PNG, WebP, and GIF.
                  </p>
                  <p className="text-xs text-graphite-500 mt-2">
                    Images larger than 2048px will be automatically resized.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFileSelected(f)
                      // Reset so same file can be re-selected
                      if (e.target) e.target.value = ''
                    }}
                  />
                </div>
              )}

              {/* Hidden file input for the case where preview is shown — keep input mounted so tests/users can re-pick */}
              {selectedFile && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileSelected(f)
                    if (e.target) e.target.value = ''
                  }}
                />
              )}

              {/* Preview */}
              {selectedFile && !analysis && (
                <div className="flex items-start space-x-4 border border-hairline-default rounded-lg p-4 bg-canvas-secondary">
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt="Selected image preview"
                      className="w-[120px] h-[120px] object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-[120px] h-[120px] rounded-md bg-graphite-100 flex items-center justify-center">
                      <ImagePlus className="w-6 h-6 text-graphite-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-graphite-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-graphite-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <div className="flex items-center space-x-2 mt-3">
                      <Button
                        onClick={handleAnalyzeImage}
                        disabled={!hasToken || isImageBusy}
                        variant="sapphire"
                        size="sm"
                        icon={isImageBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                      >
                        Analyze Image
                      </Button>
                      <Button
                        onClick={handleRemoveImage}
                        variant="ghost"
                        size="sm"
                        icon={<X className="w-4 h-4" />}
                        aria-label="Remove image"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress */}
              {isImageBusy && (
                <div
                  aria-live="polite"
                  className="border border-hairline-default rounded-lg p-4 bg-canvas-secondary"
                >
                  <div className="flex items-center space-x-3">
                    <RefreshCw className="w-4 h-4 animate-spin text-sapphire-600" />
                    <p className="text-sm text-graphite-900">
                      {imageStage === 'resizing' && 'Resizing image...'}
                      {imageStage === 'uploading' && 'Uploading...'}
                      {imageStage === 'analyzing' && 'Analyzing image with AI...'}
                    </p>
                  </div>
                  {imageStage === 'uploading' && (
                    <div className="mt-3 w-full bg-graphite-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 bg-sapphire-500 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {imageError && (
                <div
                  aria-live="assertive"
                  className="bg-error-50 border border-error-200 rounded-md p-4"
                >
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-error-700">{imageError}</p>
                      {selectedFile && (
                        <Button
                          onClick={handleAnalyzeImage}
                          variant="secondary"
                          size="sm"
                          className="mt-3"
                        >
                          Try Again
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis Result */}
              {analysis && (
                <div className="border border-hairline-default rounded-lg p-4 bg-canvas-secondary">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center text-graphite-900">
                      <Eye className="w-5 h-5 mr-2 text-sapphire-600" />
                      Image Analysis
                    </h3>
                    <Button
                      onClick={handleAnalyzeImage}
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCw className="w-3 h-3" />}
                    >
                      Re-analyze Image
                    </Button>
                  </div>

                  <div className="flex items-start space-x-4">
                    {imagePreviewUrl && (
                      <img
                        src={imagePreviewUrl}
                        alt="Analyzed image"
                        className="w-[80px] h-[80px] object-cover rounded-md flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-graphite-500 uppercase tracking-wide">Subject</p>
                        <p className="text-graphite-900 font-medium">{analysis.subject}</p>
                      </div>

                      {analysis.description && (
                        <div>
                          <p className="text-xs font-medium text-graphite-500 uppercase tracking-wide">Description</p>
                          <p className="text-sm text-graphite-700">{analysis.description}</p>
                        </div>
                      )}

                      {analysis.textContent && (
                        <div>
                          <p className="text-xs font-medium text-graphite-500 uppercase tracking-wide">Extracted Text:</p>
                          <p className="text-sm text-graphite-700 whitespace-pre-wrap">{analysis.textContent}</p>
                        </div>
                      )}

                      {analysis.insights.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-graphite-500 uppercase tracking-wide">Insights</p>
                          <ul className="list-disc list-inside text-sm text-graphite-700 space-y-1 mt-1">
                            {analysis.insights.map((insight, i) => (
                              <li key={i}>{insight}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${relevanceBadgeClass(
                            analysis.relevanceScore
                          )}`}
                        >
                          {relevanceLabel(analysis.relevanceScore)} ({analysis.relevanceScore})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3">
                <Button
                  onClick={onClose}
                  variant="secondary"
                  fullWidth
                >
                  Close
                </Button>
                <Button
                  onClick={handleCreateIdeaFromAnalysis}
                  disabled={!analysis}
                  variant="sapphire"
                  fullWidth
                >
                  Create Idea from Analysis
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  // Render modal content to portal target (defaults to document.body)
  return createPortal(modalContent, portalTarget || document.body)
}

export default AIIdeaModal
