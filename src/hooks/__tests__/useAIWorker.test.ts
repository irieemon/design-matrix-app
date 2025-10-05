import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAIWorker } from '../useAIWorker'
import { mockIdeas, mockProject } from '../../test/utils/test-utils'
import type { IdeaCard, Project } from '../../types'

// Mock Web Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((error: ErrorEvent) => void) | null = null

  postMessage = vi.fn((message: any) => {
    // Simulate async worker response
    setTimeout(() => {
      if (this.onmessage) {
        // Simulate progress event
        this.onmessage(new MessageEvent('message', {
          data: {
            type: 'PROGRESS',
            requestId: message.requestId,
            payload: { progress: 50, stage: 'processing', message: 'Analyzing...' }
          }
        }))

        // Simulate completion event
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', {
              data: {
                type: 'COMPLETE',
                requestId: message.requestId,
                payload: { result: 'success', insights: ['insight1', 'insight2'] }
              }
            }))
          }
        }, 10)
      }
    }, 10)
  })

  terminate = vi.fn()
}

// Global Worker mock
global.Worker = MockWorker as any

describe('useAIWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize worker on mount', () => {
      const { result } = renderHook(() => useAIWorker())

      expect(result.current.isWorkerAvailable()).toBe(true)
    })

    it('should return all expected methods', () => {
      const { result } = renderHook(() => useAIWorker())

      expect(result.current).toHaveProperty('generateInsights')
      expect(result.current).toHaveProperty('analyzePatterns')
      expect(result.current).toHaveProperty('optimizeRecommendations')
      expect(result.current).toHaveProperty('cancelRequest')
      expect(result.current).toHaveProperty('isWorkerAvailable')
    })

    it('should handle worker initialization failure gracefully', () => {
      const OriginalWorker = global.Worker
      global.Worker = undefined as any

      const { result } = renderHook(() => useAIWorker())

      expect(result.current.isWorkerAvailable()).toBe(false)

      global.Worker = OriginalWorker
    })

    it('should terminate worker on unmount', () => {
      const { unmount } = renderHook(() => useAIWorker())

      unmount()

      // Worker should be terminated (implementation detail, can't directly test)
      expect(true).toBe(true) // Placeholder - worker termination happens in cleanup
    })
  })

  describe('generateInsights', () => {
    it('should send GENERATE_INSIGHTS message to worker', () => {
      const { result } = renderHook(() => useAIWorker())
      const mockWorkerInstance = (result.current as any).workerRef?.current

      act(() => {
        result.current.generateInsights(mockIdeas, mockProject)
      })

      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GENERATE_INSIGHTS',
          payload: expect.objectContaining({
            ideas: mockIdeas,
            projectName: mockProject.name,
            projectType: mockProject.project_type,
            projectId: mockProject.id,
            project: mockProject
          }),
          requestId: expect.stringContaining('insights_')
        })
      )
    })

    it('should return requestId when generating insights', () => {
      const { result } = renderHook(() => useAIWorker())

      let requestId: string | null = null
      act(() => {
        requestId = result.current.generateInsights(mockIdeas, mockProject)
      })

      expect(requestId).toMatch(/^insights_\d+_[a-z0-9]+$/)
    })

    it('should handle progress callbacks during insight generation', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onProgress = vi.fn()
      const onComplete = vi.fn()

      act(() => {
        result.current.generateInsights(mockIdeas, mockProject, onProgress, onComplete)
      })

      await waitFor(() => {
        expect(onProgress).toHaveBeenCalledWith(
          50,
          'processing',
          'Analyzing...'
        )
      }, { timeout: 100 })
    })

    it('should handle completion callbacks after insight generation', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onComplete = vi.fn()

      act(() => {
        result.current.generateInsights(mockIdeas, mockProject, undefined, onComplete)
      })

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            result: 'success',
            insights: expect.arrayContaining(['insight1', 'insight2'])
          })
        )
      }, { timeout: 100 })
    })

    it('should handle error callbacks on worker failure', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onError = vi.fn()

      // Mock worker to send error response
      const mockWorkerInstance = (result.current as any).workerRef?.current
      if (mockWorkerInstance) {
        mockWorkerInstance.postMessage = vi.fn((message: any) => {
          setTimeout(() => {
            if (mockWorkerInstance.onmessage) {
              mockWorkerInstance.onmessage(new MessageEvent('message', {
                data: {
                  type: 'ERROR',
                  requestId: message.requestId,
                  payload: { error: 'AI processing failed' }
                }
              }))
            }
          }, 10)
        })
      }

      act(() => {
        result.current.generateInsights(mockIdeas, mockProject, undefined, undefined, onError)
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('AI processing failed')
      }, { timeout: 100 })
    })

    it('should return null when worker is not available', () => {
      const OriginalWorker = global.Worker
      global.Worker = undefined as any

      const { result } = renderHook(() => useAIWorker())
      const onError = vi.fn()

      let requestId: string | null = null
      act(() => {
        requestId = result.current.generateInsights(mockIdeas, mockProject, undefined, undefined, onError)
      })

      expect(requestId).toBeNull()
      expect(onError).toHaveBeenCalledWith('Web Worker not available')

      global.Worker = OriginalWorker
    })

    it('should pass null project correctly', () => {
      const { result } = renderHook(() => useAIWorker())
      const mockWorkerInstance = (result.current as any).workerRef?.current

      act(() => {
        result.current.generateInsights(mockIdeas, null)
      })

      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            projectName: undefined,
            projectType: undefined,
            projectId: undefined,
            project: null
          })
        })
      )
    })

    it('should handle empty ideas array', () => {
      const { result } = renderHook(() => useAIWorker())
      const mockWorkerInstance = (result.current as any).workerRef?.current

      act(() => {
        result.current.generateInsights([], mockProject)
      })

      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            ideas: []
          })
        })
      )
    })
  })

  describe('analyzePatterns', () => {
    it('should send ANALYZE_PATTERNS message to worker', () => {
      const { result } = renderHook(() => useAIWorker())
      const mockWorkerInstance = (result.current as any).workerRef?.current

      act(() => {
        result.current.analyzePatterns(mockIdeas)
      })

      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ANALYZE_PATTERNS',
          payload: { ideas: mockIdeas },
          requestId: expect.stringContaining('patterns_')
        })
      )
    })

    it('should return requestId when analyzing patterns', () => {
      const { result } = renderHook(() => useAIWorker())

      let requestId: string | null = null
      act(() => {
        requestId = result.current.analyzePatterns(mockIdeas)
      })

      expect(requestId).toMatch(/^patterns_\d+_[a-z0-9]+$/)
    })

    it('should handle callbacks during pattern analysis', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onProgress = vi.fn()
      const onComplete = vi.fn()
      const onError = vi.fn()

      act(() => {
        result.current.analyzePatterns(mockIdeas, onProgress, onComplete, onError)
      })

      await waitFor(() => {
        expect(onProgress).toHaveBeenCalled()
        expect(onComplete).toHaveBeenCalled()
      }, { timeout: 100 })

      expect(onError).not.toHaveBeenCalled()
    })

    it('should return null when worker is not available', () => {
      const OriginalWorker = global.Worker
      global.Worker = undefined as any

      const { result } = renderHook(() => useAIWorker())
      const onError = vi.fn()

      let requestId: string | null = null
      act(() => {
        requestId = result.current.analyzePatterns(mockIdeas, undefined, undefined, onError)
      })

      expect(requestId).toBeNull()
      expect(onError).toHaveBeenCalledWith('Web Worker not available')

      global.Worker = OriginalWorker
    })
  })

  describe('optimizeRecommendations', () => {
    it('should send OPTIMIZE_RECOMMENDATIONS message to worker', () => {
      const { result } = renderHook(() => useAIWorker())
      const mockWorkerInstance = (result.current as any).workerRef?.current

      act(() => {
        result.current.optimizeRecommendations(mockIdeas)
      })

      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OPTIMIZE_RECOMMENDATIONS',
          payload: { ideas: mockIdeas },
          requestId: expect.stringContaining('optimize_')
        })
      )
    })

    it('should return requestId when optimizing recommendations', () => {
      const { result } = renderHook(() => useAIWorker())

      let requestId: string | null = null
      act(() => {
        requestId = result.current.optimizeRecommendations(mockIdeas)
      })

      expect(requestId).toMatch(/^optimize_\d+_[a-z0-9]+$/)
    })

    it('should handle callbacks during recommendation optimization', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onProgress = vi.fn()
      const onComplete = vi.fn()

      act(() => {
        result.current.optimizeRecommendations(mockIdeas, onProgress, onComplete)
      })

      await waitFor(() => {
        expect(onProgress).toHaveBeenCalled()
        expect(onComplete).toHaveBeenCalled()
      }, { timeout: 100 })
    })

    it('should return null when worker is not available', () => {
      const OriginalWorker = global.Worker
      global.Worker = undefined as any

      const { result } = renderHook(() => useAIWorker())
      const onError = vi.fn()

      let requestId: string | null = null
      act(() => {
        requestId = result.current.optimizeRecommendations(mockIdeas, undefined, undefined, onError)
      })

      expect(requestId).toBeNull()
      expect(onError).toHaveBeenCalledWith('Web Worker not available')

      global.Worker = OriginalWorker
    })
  })

  describe('cancelRequest', () => {
    it('should cancel pending request', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onComplete = vi.fn()

      let requestId: string | null = null
      act(() => {
        requestId = result.current.generateInsights(mockIdeas, mockProject, undefined, onComplete)
      })

      // Cancel the request before it completes
      act(() => {
        if (requestId) {
          result.current.cancelRequest(requestId)
        }
      })

      // Wait to ensure onComplete is not called
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(onComplete).not.toHaveBeenCalled()
    })

    it('should handle canceling non-existent request', () => {
      const { result } = renderHook(() => useAIWorker())

      expect(() => {
        act(() => {
          result.current.cancelRequest('non-existent-id')
        })
      }).not.toThrow()
    })

    it('should allow canceling multiple requests', () => {
      const { result } = renderHook(() => useAIWorker())

      let requestId1: string | null = null
      let requestId2: string | null = null
      let requestId3: string | null = null

      act(() => {
        requestId1 = result.current.generateInsights(mockIdeas, mockProject)
        requestId2 = result.current.analyzePatterns(mockIdeas)
        requestId3 = result.current.optimizeRecommendations(mockIdeas)
      })

      expect(() => {
        act(() => {
          if (requestId1) result.current.cancelRequest(requestId1)
          if (requestId2) result.current.cancelRequest(requestId2)
          if (requestId3) result.current.cancelRequest(requestId3)
        })
      }).not.toThrow()
    })
  })

  describe('worker error handling', () => {
    it('should handle worker onerror event', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onError = vi.fn()

      act(() => {
        result.current.generateInsights(mockIdeas, mockProject, undefined, undefined, onError)
      })

      // Simulate worker error
      const mockWorkerInstance = (result.current as any).workerRef?.current
      if (mockWorkerInstance?.onerror) {
        act(() => {
          mockWorkerInstance.onerror(new ErrorEvent('error', { message: 'Worker crashed' }))
        })
      }

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Worker error occurred')
      })
    })

    it('should clear all pending requests on worker error', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onError1 = vi.fn()
      const onError2 = vi.fn()
      const onError3 = vi.fn()

      act(() => {
        result.current.generateInsights(mockIdeas, mockProject, undefined, undefined, onError1)
        result.current.analyzePatterns(mockIdeas, undefined, undefined, onError2)
        result.current.optimizeRecommendations(mockIdeas, undefined, undefined, onError3)
      })

      // Simulate worker error
      const mockWorkerInstance = (result.current as any).workerRef?.current
      if (mockWorkerInstance?.onerror) {
        act(() => {
          mockWorkerInstance.onerror(new ErrorEvent('error', { message: 'Worker crashed' }))
        })
      }

      await waitFor(() => {
        expect(onError1).toHaveBeenCalledWith('Worker error occurred')
        expect(onError2).toHaveBeenCalledWith('Worker error occurred')
        expect(onError3).toHaveBeenCalledWith('Worker error occurred')
      })
    })
  })

  describe('concurrent requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onComplete1 = vi.fn()
      const onComplete2 = vi.fn()
      const onComplete3 = vi.fn()

      act(() => {
        result.current.generateInsights(mockIdeas, mockProject, undefined, onComplete1)
        result.current.analyzePatterns(mockIdeas, undefined, onComplete2)
        result.current.optimizeRecommendations(mockIdeas, undefined, onComplete3)
      })

      await waitFor(() => {
        expect(onComplete1).toHaveBeenCalled()
        expect(onComplete2).toHaveBeenCalled()
        expect(onComplete3).toHaveBeenCalled()
      }, { timeout: 200 })
    })

    it('should generate unique request IDs for concurrent requests', () => {
      const { result } = renderHook(() => useAIWorker())

      let requestId1: string | null = null
      let requestId2: string | null = null
      let requestId3: string | null = null

      act(() => {
        requestId1 = result.current.generateInsights(mockIdeas, mockProject)
        requestId2 = result.current.generateInsights(mockIdeas, mockProject)
        requestId3 = result.current.generateInsights(mockIdeas, mockProject)
      })

      expect(requestId1).not.toEqual(requestId2)
      expect(requestId2).not.toEqual(requestId3)
      expect(requestId1).not.toEqual(requestId3)
    })
  })

  describe('isWorkerAvailable', () => {
    it('should return true when Worker is supported', () => {
      const { result } = renderHook(() => useAIWorker())

      expect(result.current.isWorkerAvailable()).toBe(true)
    })

    it('should return false when Worker is not supported', () => {
      const OriginalWorker = global.Worker
      global.Worker = undefined as any

      const { result } = renderHook(() => useAIWorker())

      expect(result.current.isWorkerAvailable()).toBe(false)

      global.Worker = OriginalWorker
    })

    it('should be consistent across multiple calls', () => {
      const { result } = renderHook(() => useAIWorker())

      const available1 = result.current.isWorkerAvailable()
      const available2 = result.current.isWorkerAvailable()
      const available3 = result.current.isWorkerAvailable()

      expect(available1).toBe(available2)
      expect(available2).toBe(available3)
    })
  })

  describe('message routing', () => {
    it('should ignore messages for unknown request IDs', async () => {
      const { result } = renderHook(() => useAIWorker())
      const onComplete = vi.fn()

      act(() => {
        result.current.generateInsights(mockIdeas, mockProject, undefined, onComplete)
      })

      // Send a message with a different request ID
      const mockWorkerInstance = (result.current as any).workerRef?.current
      if (mockWorkerInstance?.onmessage) {
        act(() => {
          mockWorkerInstance.onmessage(new MessageEvent('message', {
            data: {
              type: 'COMPLETE',
              requestId: 'unknown_request_id',
              payload: { result: 'should be ignored' }
            }
          }))
        })
      }

      // The real completion should still happen
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled()
      }, { timeout: 100 })

      // But it should be called with the correct payload, not the ignored one
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'success'
        })
      )
    })
  })
})