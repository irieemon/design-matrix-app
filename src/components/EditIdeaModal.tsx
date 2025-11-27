import React, { useState, useEffect, useCallback } from 'react'
import { Edit3, Trash2, AlertCircle } from 'lucide-react'
import { IdeaCard, User } from '../types'
import { IdeaRepository } from '../lib/repositories'
import { useToast } from '../contexts/ToastContext'
import { BaseModal } from './shared/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { logger } from '../utils/logger'

interface EditIdeaModalProps {
  idea: IdeaCard | null
  isOpen: boolean
  currentUser: User | null
  onClose: () => void
  onUpdate: (idea: IdeaCard) => void
  onDelete: (ideaId: string) => void
  /** Custom portal target for fullscreen mode */
  portalTarget?: HTMLElement
}

const EditIdeaModal: React.FC<EditIdeaModalProps> = ({ idea, isOpen, currentUser, onClose, onUpdate, onDelete, portalTarget }) => {
  const { showWarning, showError, showSuccess } = useToast()
  const [content, setContent] = useState(idea?.content || '')
  const [details, setDetails] = useState(idea?.details || '')
  const [x] = useState(idea?.x || 260)
  const [y] = useState(idea?.y || 260)
  const [priority, setPriority] = useState<IdeaCard['priority']>(idea?.priority || 'moderate')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Enhanced error handling function
  const handleError = useCallback((error: unknown, context: string) => {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    logger.error(`EditIdeaModal ${context}:`, error)
    setModalError(`${context}: ${errorMessage}`)
    showError(`Failed to ${context.toLowerCase()}: ${errorMessage}`)
  }, [showError])

  // Safe modal close function with cleanup
  const safeClose = useCallback(async () => {
    try {
      // Clear any errors
      setModalError(null)
      setShowDeleteConfirm(false)
      setIsSubmitting(false)

      // Unlock idea if needed
      if (isLocked && idea) {
        await IdeaRepository.unlockIdea(idea.id, currentUser?.id || '')
        setIsLocked(false)
      }

      // Call parent close handler
      onClose()
    } catch (err) {
      handleError(err, 'close modal')
      // Still try to close even if unlock fails
      onClose()
    }
  }, [isLocked, idea, currentUser, onClose, handleError])

  // Update form state when idea changes
  useEffect(() => {
    if (idea) {
      setContent(idea.content || '')
      setDetails(idea.details || '')
      setPriority(idea.priority || 'moderate')
    }
  }, [idea])

  // Lock the idea when modal opens (only once)
  useEffect(() => {
    if (!idea || !isOpen) return

    let shouldUnlock = false

    const lockIdea = async () => {
      const locked = await IdeaRepository.lockIdeaForEditing(idea.id, currentUser?.id || '')
      setIsLocked(locked)
      shouldUnlock = locked // Set flag for cleanup
      
      if (!locked) {
        // Show a message that someone else is editing
        showWarning(`This idea is currently being edited by ${idea.editing_by || 'another user'}. Please try again later.`)
        onClose()
      }
    }
    
    lockIdea()

    // Cleanup: unlock when modal closes
    return () => {
      if (shouldUnlock) {
        IdeaRepository.unlockIdea(idea.id, currentUser?.id || '')
      }
    }
  }, [idea?.id, isOpen]) // Re-run if idea changes or modal opens

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear any previous errors
    setModalError(null)

    try {
      // Validation checks
      if (!content.trim()) {
        setModalError('Idea title is required')
        return
      }

      if (!idea) {
        setModalError('No idea selected for editing')
        return
      }

      if (isSubmitting) {
        logger.warn('EditIdeaModal: Submit already in progress, ignoring duplicate')
        return
      }

      if (!currentUser) {
        setModalError('User authentication required')
        return
      }

      setIsSubmitting(true)

      // Prepare updated idea data
      const updatedIdea: IdeaCard = {
        ...idea,
        content: content.trim(),
        details: details.trim(),
        x,
        y,
        priority,
        editing_by: null,
        editing_at: null,
        updated_at: new Date().toISOString()
      }

      logger.info('EditIdeaModal: Submitting idea update', { ideaId: idea.id, priority })

      // Call parent update handler
      await onUpdate(updatedIdea)

      showSuccess('Idea updated successfully')

      // Close modal after successful update
      await safeClose()

    } catch (err) {
      handleError(err, 'update idea')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    try {
      await safeClose()
    } catch (err) {
      handleError(err, 'cancel edit')
    }
  }

  const handleDelete = async () => {
    if (!idea) {
      setModalError('No idea selected for deletion')
      return
    }

    try {
      setIsSubmitting(true)
      logger.info('EditIdeaModal: Deleting idea', { ideaId: idea.id })

      await onDelete(idea.id)
      showSuccess('Idea deleted successfully')

      // Close modal after successful deletion
      await safeClose()
    } catch (err) {
      handleError(err, 'delete idea')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!idea) return null

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Edit Idea"
      size="xl"
      portalTarget={portalTarget}
    >
      <div className="p-6" data-testid="edit-idea-modal">
        <div className="flex items-center space-x-3 mb-6">
          <Edit3 className="w-5 h-5" style={{ color: 'var(--sapphire-600)' }} />
          <p style={{ color: 'var(--graphite-600)' }}>Edit your idea details and priority</p>
        </div>

        {/* Error Display */}
        {modalError && (
          <div className="mb-6 rounded-lg p-4 border" style={{
            backgroundColor: 'var(--garnet-50)',
            borderColor: 'var(--garnet-200)'
          }}>
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--garnet-600)' }} />
              <div className="text-sm" style={{ color: 'var(--garnet-800)' }}>{modalError}</div>
            </div>
            <Button
              onClick={() => setModalError(null)}
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Loading State Indicator */}
        {isSubmitting && (
          <div className="mb-6 rounded-lg p-4 border" style={{
            backgroundColor: 'var(--sapphire-50)',
            borderColor: 'var(--sapphire-200)'
          }}>
            <div className="flex items-center space-x-2">
              <div className="animate-spin w-4 h-4 border-2 rounded-full" style={{
                borderColor: 'var(--sapphire-600)',
                borderTopColor: 'transparent'
              }}></div>
              <div className="text-sm" style={{ color: 'var(--sapphire-800)' }}>Processing your request...</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="edit-idea-form">

          {/* Idea Title */}
          <Input
            label="Idea Title"
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Brief title for your idea"
            required
            fullWidth
            variant="primary"
            size="md"
            data-testid="edit-idea-content-input"
          />

          {/* Idea Details */}
          <Textarea
            label="Details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            placeholder="Describe your idea in more detail..."
            fullWidth
            variant="primary"
            size="md"
            data-testid="edit-idea-details-input"
          />


          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--graphite-700)' }}>
              Priority Level
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as IdeaCard['priority'])}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--hairline-default)',
                color: 'var(--graphite-900)',
                backgroundColor: 'var(--surface-primary)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--sapphire-500)';
                e.target.style.boxShadow = '0 0 0 3px var(--sapphire-100)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--hairline-default)';
                e.target.style.boxShadow = 'none';
              }}
              data-testid="edit-idea-priority-input"
            >
              <option value="low">🟢 Low Priority</option>
              <option value="moderate">🟡 Moderate</option>
              <option value="high">🔴 High Priority</option>
              <option value="strategic">🔵 Strategic</option>
              <option value="innovation">🟣 Innovation</option>
            </select>
          </div>

          {/* Info */}
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--canvas-secondary)' }}>
            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--graphite-700)' }}>💡 Tip</h4>
            <div className="text-sm" style={{ color: 'var(--graphite-600)' }}>
              You can drag this idea on the matrix to change its value vs complexity positioning.
            </div>
          </div>

          {/* Delete Confirmation */}
          {showDeleteConfirm ? (
            <div className="rounded-lg p-4 border" style={{
              backgroundColor: 'var(--garnet-50)',
              borderColor: 'var(--garnet-200)'
            }}>
              <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--garnet-800)' }}>Confirm Deletion</h4>
              <p className="text-sm mb-4" style={{ color: 'var(--garnet-600)' }}>
                Are you sure you want to delete this idea? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <Button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="secondary"
                  className="flex-1"
                  data-testid="edit-idea-delete-cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleDelete}
                  variant="danger"
                  className="flex-1"
                  data-testid="edit-idea-delete-button"
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            /* Actions - Clean layout with delete on left, save/cancel on right */
            <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--hairline-default)' }}>
              {/* Delete Button - Solid red to match other delete buttons */}
              <Button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
              >
                Delete
              </Button>

              {/* Save/Cancel Buttons */}
              <div className="flex space-x-3">
                <Button
                  type="button"
                  onClick={handleCancel}
                  variant="secondary"
                  data-testid="edit-idea-cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!content.trim() || isSubmitting}
                  variant="sapphire"
                  data-testid="edit-idea-save-button"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </BaseModal>
  )
}

export default EditIdeaModal