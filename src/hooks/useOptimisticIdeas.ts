/**
 * useOptimisticIdeas Hook
 * Phase Two Implementation
 *
 * Optimistic UI updates for idea submission with:
 * - Deduplication logic
 * - Rollback on server rejection
 * - Event batching for performance
 * - Automatic conflict resolution
 */

import { useState, useCallback, useRef } from 'react'
import type { IdeaCard } from './useBrainstormRealtime'

export interface OptimisticIdea extends IdeaCard {
  isOptimistic?: boolean
  optimisticId?: string
  submittedAt?: number
}

export interface SubmitIdeaOptions {
  content: string
  details?: string
  priority?: 'low' | 'moderate' | 'high'
  x_position?: number
  y_position?: number
}

export interface UseOptimisticIdeasOptions {
  sessionId: string
  participantId: string
  onSubmit: (idea: SubmitIdeaOptions) => Promise<{ success: boolean; idea?: IdeaCard; error?: string }>
  deduplicationWindow?: number // milliseconds
  maxRetries?: number
}

export function useOptimisticIdeas(options: UseOptimisticIdeasOptions) {
  const [optimisticIdeas, setOptimisticIdeas] = useState<Map<string, OptimisticIdea>>(new Map())
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())
  const deduplicationCache = useRef<Map<string, number>>(new Map())
  const retryCount = useRef<Map<string, number>>(new Map())

  const { sessionId, participantId, onSubmit, deduplicationWindow = 5000, maxRetries = 3 } = options

  /**
   * Generate content hash for deduplication
   */
  const generateContentHash = (content: string): string => {
    // Simple hash function for deduplication
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return `hash_${Math.abs(hash).toString(36)}`
  }

  /**
   * Check if idea is duplicate based on content
   */
  const isDuplicate = (content: string): boolean => {
    const hash = generateContentHash(content)
    const lastSubmission = deduplicationCache.current.get(hash)

    if (lastSubmission) {
      const timeSinceLastSubmission = Date.now() - lastSubmission
      if (timeSinceLastSubmission < deduplicationWindow) {
        return true
      }
    }

    return false
  }

  /**
   * Submit idea with optimistic update
   */
  const submitIdea = useCallback(
    async (ideaOptions: SubmitIdeaOptions): Promise<{ success: boolean; error?: string }> => {
      // Check for duplicate submission
      if (isDuplicate(ideaOptions.content)) {
        console.warn('Duplicate idea submission detected, skipping')
        return { success: false, error: 'Duplicate submission detected' }
      }

      // Generate optimistic ID
      const optimisticId = `optimistic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create optimistic idea
      const optimisticIdea: OptimisticIdea = {
        id: optimisticId,
        content: ideaOptions.content,
        details: ideaOptions.details,
        priority: ideaOptions.priority || 'moderate',
        x_position: ideaOptions.x_position ?? 75,
        y_position: ideaOptions.y_position ?? 75,
        created_at: new Date().toISOString(),
        session_id: sessionId,
        participant_id: participantId,
        isOptimistic: true,
        optimisticId,
        submittedAt: Date.now()
      }

      // Add to optimistic state
      setOptimisticIdeas((prev) => {
        const updated = new Map(prev)
        updated.set(optimisticId, optimisticIdea)
        return updated
      })

      // Record content hash for deduplication
      const contentHash = generateContentHash(ideaOptions.content)
      deduplicationCache.current.set(contentHash, Date.now())

      try {
        // Submit to server
        const result = await onSubmit(ideaOptions)

        if (result.success && result.idea) {
          // Server accepted - remove optimistic state, real idea will come via realtime
          setOptimisticIdeas((prev) => {
            const updated = new Map(prev)
            updated.delete(optimisticId)
            return updated
          })

          // Track submitted ID to prevent realtime duplicate
          setSubmittedIds((prev) => new Set(prev).add(result.idea!.id))

          // Clean up after deduplication window
          setTimeout(() => {
            setSubmittedIds((prev) => {
              const updated = new Set(prev)
              updated.delete(result.idea!.id)
              return updated
            })
          }, deduplicationWindow)

          return { success: true }
        } else {
          // Server rejected - rollback optimistic update
          const attempts = retryCount.current.get(optimisticId) || 0

          if (attempts < maxRetries && result.error?.includes('rate limit')) {
            // Rate limit error - retry after delay
            retryCount.current.set(optimisticId, attempts + 1)

            setTimeout(() => {
              submitIdea(ideaOptions)
            }, 2000 * (attempts + 1)) // Exponential backoff

            return { success: false, error: 'Rate limited, retrying...' }
          } else {
            // Permanent failure - remove optimistic state
            setOptimisticIdeas((prev) => {
              const updated = new Map(prev)
              updated.delete(optimisticId)
              return updated
            })

            retryCount.current.delete(optimisticId)

            return { success: false, error: result.error || 'Submission failed' }
          }
        }
      } catch (error) {
        // Network error - keep optimistic state and retry
        const attempts = retryCount.current.get(optimisticId) || 0

        if (attempts < maxRetries) {
          retryCount.current.set(optimisticId, attempts + 1)

          setTimeout(() => {
            submitIdea(ideaOptions)
          }, 2000 * (attempts + 1))

          return { success: false, error: 'Network error, retrying...' }
        } else {
          // Max retries exceeded - rollback
          setOptimisticIdeas((prev) => {
            const updated = new Map(prev)
            updated.delete(optimisticId)
            return updated
          })

          retryCount.current.delete(optimisticId)

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error'
          }
        }
      }
    },
    [sessionId, participantId, onSubmit, deduplicationWindow, maxRetries]
  )

  /**
   * Merge optimistic ideas with real ideas from realtime
   * Filters out duplicates and confirmed ideas
   */
  const mergeIdeas = useCallback(
    (realtimeIdeas: IdeaCard[]): IdeaCard[] => {
      const merged: IdeaCard[] = [...realtimeIdeas]

      // Add optimistic ideas that aren't duplicated in realtime
      optimisticIdeas.forEach((optimisticIdea) => {
        const isDuplicate = realtimeIdeas.some(
          (idea) =>
            idea.id === optimisticIdea.id ||
            (idea.content === optimisticIdea.content &&
              idea.participant_id === optimisticIdea.participant_id &&
              Math.abs(
                new Date(idea.created_at).getTime() - new Date(optimisticIdea.created_at).getTime()
              ) < 5000) // Within 5 seconds
        )

        if (!isDuplicate) {
          merged.push(optimisticIdea)
        } else {
          // Remove confirmed optimistic idea
          setOptimisticIdeas((prev) => {
            const updated = new Map(prev)
            updated.delete(optimisticIdea.optimisticId!)
            return updated
          })
        }
      })

      return merged
    },
    [optimisticIdeas]
  )

  /**
   * Clean up stale optimistic ideas (older than 30 seconds)
   */
  const cleanupStaleIdeas = useCallback(() => {
    const now = Date.now()
    const staleThreshold = 30000 // 30 seconds

    setOptimisticIdeas((prev) => {
      const updated = new Map(prev)
      let hasStale = false

      updated.forEach((idea, id) => {
        if (idea.submittedAt && now - idea.submittedAt > staleThreshold) {
          updated.delete(id)
          hasStale = true
        }
      })

      return hasStale ? updated : prev
    })
  }, [])

  /**
   * Get pending optimistic ideas count
   */
  const getPendingCount = (): number => {
    return optimisticIdeas.size
  }

  /**
   * Clear all optimistic ideas (useful for debugging or reset)
   */
  const clearOptimistic = useCallback(() => {
    setOptimisticIdeas(new Map())
    retryCount.current.clear()
  }, [])

  return {
    submitIdea,
    mergeIdeas,
    cleanupStaleIdeas,
    getPendingCount,
    clearOptimistic,
    optimisticIdeas: Array.from(optimisticIdeas.values())
  }
}
