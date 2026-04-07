import React, { useState, useRef, useEffect } from 'react'
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
  Mic,
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
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import {
  validateAudioFile,
  normalizeTranscriptionResult,
  ACCEPTED_AUDIO_MIME_TYPES,
  type NormalizedTranscription,
  type TranscribeAudioResponse,
} from '../lib/audioTranscription'

interface AIIdeaModalProps {
  onClose: () => void
  onAdd: (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => void
  currentProject?: Project | null
  currentUser?: User | null
  /** Custom portal target for fullscreen mode */
  portalTarget?: HTMLElement
}

type Tab = 'generate' | 'image' | 'audio'
type ImageStage = 'idle' | 'resizing' | 'uploading' | 'analyzing' | 'done' | 'error'

type AudioStage =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: number }
  | { kind: 'uploading' }
  | { kind: 'transcribing' }
  | { kind: 'reviewing'; result: NormalizedTranscription; sourceUrl: string }
  | { kind: 'error'; message: string }

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
function stepStateForUpload(s: AudioStage): 'pending' | 'active' | 'done' {
  if (s.kind === 'uploading') return 'active'
  if (s.kind === 'transcribing' || s.kind === 'reviewing') return 'done'
  return 'pending'
}
function stepStateForTranscribing(s: AudioStage): 'pending' | 'active' | 'done' {
  if (s.kind === 'transcribing') return 'active'
  if (s.kind === 'reviewing') return 'done'
  return 'pending'
}
function stepStateForDone(s: AudioStage): 'pending' | 'active' | 'done' {
  return s.kind === 'reviewing' ? 'active' : 'pending'
}

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
  const { getCsrfHeaders, hasToken, csrfToken } = useCsrfToken()

  // Audio tab state
  const [audioStage, setAudioStage] = useState<AudioStage>({ kind: 'idle' })
  const [audioTitle, setAudioTitle] = useState('')
  const audioRecorder = useAudioRecorder()

  const uploadAndTranscribeAudio = async (file: File) => {
    const validation = validateAudioFile(file)
    if (!validation.ok) {
      setAudioStage({ kind: 'error', message: validation.error })
      return
    }
    if (!currentProject?.id) {
      setAudioStage({ kind: 'error', message: 'No project selected' })
      return
    }
    try {
      setAudioStage({ kind: 'uploading' })
      const uploaded = await FileService.uploadFile(
        file,
        currentProject.id,
        'Audio uploaded for transcription',
        currentUser?.id
      )
      if (!uploaded?.success || !uploaded.file) {
        throw new Error(uploaded?.error || 'Audio upload failed')
      }
      const audioUrl =
        (uploaded.file as any).publicUrl ||
        (uploaded.file as any).public_url ||
        (uploaded.file as any).storage_path
      setAudioStage({ kind: 'transcribing' })
      const accessToken = localStorage.getItem('sb-access-token') || ''
      const res = await fetch('/api/ai?action=transcribe-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          ...getCsrfHeaders(),
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          audioUrl,
          projectContext: {
            projectName: currentProject?.name,
            projectDescription: currentProject?.description,
            projectType: currentProject?.project_type,
          },
          language: 'en',
        }),
      })
      if (!res.ok) throw new Error(`Transcription failed: ${res.status}`)
      const json: TranscribeAudioResponse = await res.json()
      const normalized = normalizeTranscriptionResult(json)
      setAudioTitle(normalized.subject)
      setAudioStage({ kind: 'reviewing', result: normalized, sourceUrl: audioUrl })
    } catch (err) {
      logger.error('Audio transcription failed', err)
      setAudioStage({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Transcription failed',
      })
    }
  }

  const handleRecordToggle = async () => {
    if (audioRecorder.isRecording) {
      try {
        const blob = await audioRecorder.stop()
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type })
        await uploadAndTranscribeAudio(file)
      } catch (err) {
        logger.error('Recording stop failed', err)
      }
    } else {
      setAudioStage({ kind: 'recording', startedAt: Date.now() })
      await audioRecorder.start()
    }
  }

  const handleAudioFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadAndTranscribeAudio(file)
    if (e.target) e.target.value = ''
  }

  const handleCreateAudioIdea = () => {
    if (audioStage.kind !== 'reviewing') return
    const r = audioStage.result
    const details = [
      r.description,
      r.textContent ? `Transcript: ${r.textContent}` : null,
      r.insights.length ? `Key points: ${r.insights.join(' • ')}` : null,
    ]
      .filter(Boolean)
      .join('\n\n')
    onAdd({
      content: audioTitle || r.subject || 'Audio Idea',
      details,
      x: Math.round(260 + Math.random() * 100 - 50),
      y: Math.round(260 + Math.random() * 100 - 50),
      priority: 'moderate',
      created_by: currentUser?.id || 'Anonymous',
      is_collapsed: true,
      editing_by: null,
      editing_at: null,
    })
    setAudioStage({ kind: 'idle' })
    setAudioTitle('')
    onClose()
  }

  // Cleanup mic on close
  const handleCloseWithCleanup = () => {
    if (audioRecorder.isRecording) {
      void audioRecorder.stop().catch(() => {})
    }
    onClose()
  }

  useEffect(() => {
    return () => {
      if (audioRecorder.isRecording) {
        void audioRecorder.stop().catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      <div className="lux-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col" style={{ pointerEvents: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-hairline-default bg-canvas-secondary">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-graphite-700">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-graphite-900">AI Idea Assistant</h2>
          </div>
          <Button
            onClick={handleCloseWithCleanup}
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
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audio'}
            onClick={() => setActiveTab('audio')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'audio'
                ? 'border-sapphire-500 text-graphite-900'
                : 'border-transparent text-graphite-500 hover:text-graphite-700'
            }`}
          >
            Audio
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
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

          {activeTab === 'audio' && (
            <div className="audio-tab space-y-4">
              <ol
                className="audio-steps flex items-center space-x-3 text-xs"
                aria-label="Audio progress"
              >
                {(audioStage.kind === 'recording' || audioRecorder.isRecording) && (
                  <li data-state="active" className="data-[state=active]:text-graphite-900 data-[state=active]:font-semibold data-[state=done]:text-emerald-600 text-graphite-400">Recording</li>
                )}
                <li
                  data-state={stepStateForUpload(audioStage)}
                  className="data-[state=active]:text-graphite-900 data-[state=active]:font-semibold data-[state=done]:text-emerald-600 text-graphite-400"
                >
                  Uploading
                </li>
                <li
                  data-state={stepStateForTranscribing(audioStage)}
                  className="data-[state=active]:text-graphite-900 data-[state=active]:font-semibold data-[state=done]:text-emerald-600 text-graphite-400"
                >
                  Transcribing
                </li>
                <li
                  data-state={stepStateForDone(audioStage)}
                  className="data-[state=active]:text-graphite-900 data-[state=active]:font-semibold data-[state=done]:text-emerald-600 text-graphite-400"
                >
                  Done
                </li>
              </ol>

              {(audioStage.kind === 'idle' ||
                audioStage.kind === 'recording' ||
                audioStage.kind === 'error') && (
                <div className="audio-tab-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                  <section className="audio-record border border-hairline-default rounded-lg p-4 bg-canvas-secondary">
                    <h3 className="text-sm font-semibold text-graphite-900 mb-2">Record</h3>
                    <Button
                      onClick={handleRecordToggle}
                      variant="sapphire"
                      size="sm"
                      icon={<Mic className="w-4 h-4" />}
                      aria-pressed={audioRecorder.isRecording}
                    >
                      {audioRecorder.isRecording ? 'Stop' : 'Record'}
                    </Button>
                    {audioRecorder.isRecording && (
                      <div className="rec-status mt-2 flex items-center space-x-2" aria-live="polite">
                        <span className="rec-pulse text-error-600 font-semibold">● REC</span>
                        <span className="rec-timer text-graphite-700">
                          {formatElapsed(audioRecorder.elapsedMs)}
                        </span>
                      </div>
                    )}
                    {audioRecorder.error && (
                      <p className="error-msg mt-2 text-sm text-error-700">{audioRecorder.error}</p>
                    )}
                  </section>

                  <section className="audio-upload border border-hairline-default rounded-lg p-4 bg-canvas-secondary">
                    <h3 className="text-sm font-semibold text-graphite-900 mb-2">Upload</h3>
                    <input
                      type="file"
                      accept={ACCEPTED_AUDIO_MIME_TYPES.join(',')}
                      onChange={handleAudioFilePick}
                      aria-label="Upload audio file"
                    />
                    <p className="hint text-xs text-graphite-500 mt-2">
                      Max 25MB. mp3, wav, webm, m4a, ogg.
                    </p>
                  </section>
                </div>
              )}

              {audioStage.kind === 'error' && (
                <p className="error-msg text-sm text-error-700" role="alert">
                  {audioStage.message}
                </p>
              )}

              {audioStage.kind === 'uploading' && (
                <p className="text-sm text-graphite-700" aria-live="polite">Uploading audio…</p>
              )}
              {audioStage.kind === 'transcribing' && (
                <p className="text-sm text-graphite-700" aria-live="polite">Transcribing audio…</p>
              )}

              {audioStage.kind === 'reviewing' && (
                <div className="audio-review border border-hairline-default rounded-lg p-4 bg-canvas-secondary space-y-3">
                  <label className="block text-sm">
                    <span className="text-graphite-700 font-medium">Title</span>
                    <input
                      type="text"
                      value={audioTitle}
                      onChange={(e) => setAudioTitle(e.target.value)}
                      className="mt-1 block w-full border border-hairline-default rounded px-2 py-1"
                    />
                  </label>
                  <section>
                    <h4 className="text-xs font-medium text-graphite-500 uppercase">Summary</h4>
                    <p className="text-sm text-graphite-700">{audioStage.result.description}</p>
                  </section>
                  {audioStage.result.insights.length > 0 && (
                    <section>
                      <h4 className="text-xs font-medium text-graphite-500 uppercase">Key Points</h4>
                      <ul className="list-disc list-inside text-sm text-graphite-700">
                        {audioStage.result.insights.map((kp, i) => (
                          <li key={i}>{kp}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  <section>
                    <h4 className="text-xs font-medium text-graphite-500 uppercase">Full Transcript</h4>
                    <p className="transcript text-sm text-graphite-700 whitespace-pre-wrap">
                      {audioStage.result.textContent}
                    </p>
                  </section>
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => setAudioStage({ kind: 'idle' })}
                      variant="secondary"
                      fullWidth
                    >
                      Discard
                    </Button>
                    <Button onClick={handleCreateAudioIdea} variant="sapphire" fullWidth>
                      Create Idea
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // Render modal content to portal target (defaults to document.body)
  return createPortal(modalContent, portalTarget || document.body)
}

export default AIIdeaModal
