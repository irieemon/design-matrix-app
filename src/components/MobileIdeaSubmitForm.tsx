/**
 * Mobile Idea Submit Form
 * Phase Three Implementation
 *
 * Touch-optimized form for mobile participants to submit ideas
 * Features: Character limits, priority selector, validation, success feedback, recent ideas list
 */

import { useState, useRef, useEffect } from 'react'
import type { BrainstormSession, SessionParticipant } from '../types/BrainstormSession'
import { BrainstormSessionService } from '../lib/services/BrainstormSessionService'
import LoadingSpinner from './ui/LoadingSpinner'

interface MobileIdeaSubmitFormProps {
  session: BrainstormSession
  participant: SessionParticipant
}

interface SubmittedIdea {
  id: string
  content: string
  created_at: string
}

type Priority = 'low' | 'moderate' | 'high'

export default function MobileIdeaSubmitForm({
  session,
  participant
}: MobileIdeaSubmitFormProps) {
  const [content, setContent] = useState('')
  const [details, setDetails] = useState('')
  const [priority, setPriority] = useState<Priority>('moderate')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [recentIdeas, setRecentIdeas] = useState<SubmittedIdea[]>([])

  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Auto-focus content textarea on mount
    contentRef.current?.focus()
  }, [])

  const contentLength = content.length
  const detailsLength = details.length
  const isContentTooShort = contentLength > 0 && contentLength < 10
  const isContentTooLong = contentLength > 200
  const isDetailsTooLong = detailsLength > 500
  const canSubmit =
    content.trim().length >= 10 &&
    contentLength <= 200 &&
    detailsLength <= 500 &&
    !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canSubmit) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await BrainstormSessionService.submitIdea({
        sessionId: session.id,
        participantId: participant.id,
        content: content.trim(),
        details: details.trim() || undefined,
        priority
      })

      if (!result.success) {
        // Check for rate limiting
        if (result.code === 'RATE_LIMITED') {
          setErrorMessage('Please wait a moment before submitting another idea.')
        } else {
          setErrorMessage(result.error || 'Failed to submit idea')
        }
        setIsSubmitting(false)
        return
      }

      // Success! Add to recent ideas and reset form
      if (result.idea) {
        setRecentIdeas((prev) => [result.idea!, ...prev].slice(0, 5)) // Keep last 5
      }

      setContent('')
      setDetails('')
      setPriority('moderate')
      setShowSuccess(true)
      setIsSubmitting(false)

      // Hide success toast after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000)

      // Re-focus content textarea
      contentRef.current?.focus()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
      setIsSubmitting(false)
    }
  }

  const getSessionStatusColor = () => {
    switch (session.status) {
      case 'active':
        return 'text-green-600'
      case 'paused':
        return 'text-amber-600'
      case 'completed':
        return 'text-neutral-500'
      default:
        return 'text-neutral-600'
    }
  }

  const getSessionStatusLabel = () => {
    switch (session.status) {
      case 'active':
        return 'Active'
      case 'paused':
        return 'Paused'
      case 'completed':
        return 'Completed'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-neutral-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-neutral-800 mb-1">{session.name}</h1>
          <div className="flex items-center justify-between text-sm">
            <p className="text-neutral-600">
              Welcome, <span className="font-medium">{participant.participant_name}</span>
            </p>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${getSessionStatusColor()}`}>
                {getSessionStatusLabel()}
              </span>
              <span className="text-neutral-400">•</span>
              <span className="text-neutral-600">{participant.contribution_count} ideas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-[slideDown_0.3s_ease-out]">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-medium">Idea submitted successfully!</span>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Content Textarea */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-neutral-700 mb-2">
              Idea <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={contentRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your idea (10-200 characters)"
              className={`w-full px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2 transition-colors ${
                isContentTooShort
                  ? 'border-amber-300 focus:ring-amber-500'
                  : isContentTooLong
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-neutral-300 focus:ring-blue-500'
              }`}
              rows={3}
              maxLength={200}
              disabled={isSubmitting || session.status !== 'active'}
            />
            <div className="flex justify-between items-center mt-1">
              <div>
                {isContentTooShort && (
                  <p className="text-sm text-amber-600">Minimum 10 characters required</p>
                )}
                {isContentTooLong && (
                  <p className="text-sm text-red-600">Maximum 200 characters exceeded</p>
                )}
              </div>
              <p
                className={`text-sm ${
                  isContentTooLong ? 'text-red-600 font-medium' : 'text-neutral-500'
                }`}
              >
                {contentLength}/200
              </p>
            </div>
          </div>

          {/* Details Textarea (Optional) */}
          <div>
            <label htmlFor="details" className="block text-sm font-medium text-neutral-700 mb-2">
              Additional Details <span className="text-neutral-400">(optional)</span>
            </label>
            <textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add more context or details (up to 500 characters)"
              className={`w-full px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2 transition-colors ${
                isDetailsTooLong
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-neutral-300 focus:ring-blue-500'
              }`}
              rows={4}
              maxLength={500}
              disabled={isSubmitting || session.status !== 'active'}
            />
            <div className="flex justify-end mt-1">
              <p
                className={`text-sm ${
                  isDetailsTooLong ? 'text-red-600 font-medium' : 'text-neutral-500'
                }`}
              >
                {detailsLength}/500
              </p>
            </div>
          </div>

          {/* Priority Selector */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Priority</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPriority('low')}
                disabled={isSubmitting || session.status !== 'active'}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  priority === 'low'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Low
              </button>
              <button
                type="button"
                onClick={() => setPriority('moderate')}
                disabled={isSubmitting || session.status !== 'active'}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  priority === 'moderate'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Moderate
              </button>
              <button
                type="button"
                onClick={() => setPriority('high')}
                disabled={isSubmitting || session.status !== 'active'}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  priority === 'high'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                High
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full px-6 py-4 rounded-lg font-semibold text-white transition-all ${
              canSubmit
                ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                : 'bg-neutral-300 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" variant="primary" aria-label="Submitting" />
                Submitting...
              </span>
            ) : (
              'Submit Idea'
            )}
          </button>

          {session.status !== 'active' && (
            <p className="text-center text-sm text-amber-600">
              Session is currently {session.status}. Idea submission is disabled.
            </p>
          )}
        </form>

        {/* Recent Ideas */}
        {recentIdeas.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-neutral-800 mb-4">
              Your Recent Ideas ({recentIdeas.length})
            </h2>
            <div className="space-y-3">
              {recentIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="bg-neutral-50 rounded-lg p-4 border border-neutral-200"
                >
                  <p className="text-neutral-800">{idea.content}</p>
                  <p className="text-xs text-neutral-500 mt-2">
                    {new Date(idea.created_at).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pb-6 px-4 text-center text-sm text-neutral-500">
        <p>Session will sync ideas in real-time with the facilitator's screen</p>
      </div>
    </div>
  )
}
