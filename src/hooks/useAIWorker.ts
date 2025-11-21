import { useCallback, useRef, useEffect } from 'react'
import { IdeaCard, Project } from '../types'
import { useLogger } from '../lib/logging'

// Types for worker communication
interface AIWorkerMessage {
  type: 'GENERATE_INSIGHTS' | 'ANALYZE_PATTERNS' | 'OPTIMIZE_RECOMMENDATIONS'
  payload: {
    ideas: IdeaCard[]
    projectName?: string
    projectType?: string
    projectId?: string
    project?: Project | null
  }
  requestId: string
}

interface AIWorkerResponse {
  type: 'PROGRESS' | 'COMPLETE' | 'ERROR'
  requestId: string
  payload: any
}

interface ProgressCallback {
  (progress: number, stage: string, message: string): void
}

interface CompleteCallback {
  (result: any): void
}

interface ErrorCallback {
  (error: string): void
}

export const useAIWorker = () => {
  const logger = useLogger('useAIWorker')
  const workerRef = useRef<Worker | null>(null)
  const pendingRequests = useRef(new Map<string, {
    onProgress?: ProgressCallback
    onComplete?: CompleteCallback
    onError?: ErrorCallback
  }>())

  // Initialize worker
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      try {
        // Create worker from our aiWorker.ts file
        workerRef.current = new Worker(
          new URL('../workers/aiWorker.ts', import.meta.url),
          { type: 'module' }
        )

        // Set up message handler
        workerRef.current.onmessage = (event: MessageEvent<AIWorkerResponse>) => {
          const { type, requestId, payload } = event.data
          const request = pendingRequests.current.get(requestId)

          if (!request) return

          switch (type) {
            case 'PROGRESS':
              request.onProgress?.(payload.progress, payload.stage, payload.message)
              break
            case 'COMPLETE':
              request.onComplete?.(payload)
              pendingRequests.current.delete(requestId)
              break
            case 'ERROR':
              request.onError?.(payload.error)
              pendingRequests.current.delete(requestId)
              break
          }
        }

        workerRef.current.onerror = (error) => {
          logger.error('AI Worker error', error)
          // Notify all pending requests of the error
          pendingRequests.current.forEach(request => {
            request.onError?.('Worker error occurred')
          })
          pendingRequests.current.clear()
        }
      } catch (_error) {
        logger.warn('Web Workers not supported, falling back to main thread', { error })
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      pendingRequests.current.clear()
    }
  }, [])

  // Generate insights using Web Worker
  const generateInsights = useCallback((
    ideas: IdeaCard[],
    project: Project | null,
    onProgress?: ProgressCallback,
    onComplete?: CompleteCallback,
    onError?: ErrorCallback
  ) => {
    if (!workerRef.current) {
      onError?.('Web Worker not available')
      return null
    }

    const requestId = `insights_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Store callbacks for this request
    pendingRequests.current.set(requestId, {
      onProgress,
      onComplete,
      onError
    })

    // Send message to worker
    const message: AIWorkerMessage = {
      type: 'GENERATE_INSIGHTS',
      payload: {
        ideas,
        projectName: project?.name,
        projectType: project?.project_type,
        projectId: project?.id,
        project
      },
      requestId
    }

    workerRef.current.postMessage(message)
    return requestId
  }, [])

  // Analyze patterns using Web Worker
  const analyzePatterns = useCallback((
    ideas: IdeaCard[],
    onProgress?: ProgressCallback,
    onComplete?: CompleteCallback,
    onError?: ErrorCallback
  ) => {
    if (!workerRef.current) {
      onError?.('Web Worker not available')
      return null
    }

    const requestId = `patterns_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    pendingRequests.current.set(requestId, {
      onProgress,
      onComplete,
      onError
    })

    const message: AIWorkerMessage = {
      type: 'ANALYZE_PATTERNS',
      payload: { ideas },
      requestId
    }

    workerRef.current.postMessage(message)
    return requestId
  }, [])

  // Optimize recommendations using Web Worker
  const optimizeRecommendations = useCallback((
    ideas: IdeaCard[],
    onProgress?: ProgressCallback,
    onComplete?: CompleteCallback,
    onError?: ErrorCallback
  ) => {
    if (!workerRef.current) {
      onError?.('Web Worker not available')
      return null
    }

    const requestId = `optimize_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    pendingRequests.current.set(requestId, {
      onProgress,
      onComplete,
      onError
    })

    const message: AIWorkerMessage = {
      type: 'OPTIMIZE_RECOMMENDATIONS',
      payload: { ideas },
      requestId
    }

    workerRef.current.postMessage(message)
    return requestId
  }, [])

  // Cancel a specific request
  const cancelRequest = useCallback((requestId: string) => {
    pendingRequests.current.delete(requestId)
  }, [])

  // Check if worker is available
  const isWorkerAvailable = useCallback(() => {
    return workerRef.current !== null && typeof Worker !== 'undefined'
  }, [])

  return {
    generateInsights,
    analyzePatterns,
    optimizeRecommendations,
    cancelRequest,
    isWorkerAvailable
  }
}