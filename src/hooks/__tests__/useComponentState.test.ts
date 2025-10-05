import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useComponentState,
  useSimpleState,
  useFormComponentState,
} from '../useComponentState'

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useComponentState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useComponentState())

      expect(result.current.state).toBe('idle')
      expect(result.current.variant).toBe('primary')
      expect(result.current.size).toBe('medium')
      expect(result.current.isTransitioning).toBe(false)
    })

    it('should initialize with custom config', () => {
      const { result } = renderHook(() =>
        useComponentState({
          initialConfig: {
            state: 'loading',
            variant: 'secondary',
            size: 'large',
          },
        })
      )

      expect(result.current.state).toBe('loading')
      expect(result.current.variant).toBe('secondary')
      expect(result.current.size).toBe('large')
    })

    it('should provide correct computed properties', () => {
      const { result } = renderHook(() => useComponentState())

      expect(result.current.hasError).toBe(false)
      expect(result.current.isDisabled).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isSuccess).toBe(false)
    })

    it('should generate CSS classes', () => {
      const { result } = renderHook(() => useComponentState())

      expect(result.current.stateClasses).toBeDefined()
      expect(result.current.variantClasses).toBeDefined()
      expect(result.current.sizeClasses).toBeDefined()
      expect(result.current.className).toBeDefined()
    })
  })

  describe('state transitions', () => {
    it('should transition to loading state', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setState('loading')
      })

      expect(result.current.state).toBe('loading')
      expect(result.current.isLoading).toBe(true)
    })

    it('should transition to success state', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setState('success')
      })

      expect(result.current.state).toBe('success')
      expect(result.current.isSuccess).toBe(true)
    })

    it('should transition to error state', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setState('error')
      })

      expect(result.current.state).toBe('error')
      expect(result.current.hasError).toBe(true)
    })

    it('should transition to disabled state', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setState('disabled')
      })

      expect(result.current.state).toBe('disabled')
      expect(result.current.isDisabled).toBe(true)
    })

    it('should not transition to invalid states', () => {
      const { result } = renderHook(() => useComponentState())
      const { logger } = require('../../utils/logger')

      act(() => {
        // @ts-ignore - testing invalid state
        result.current.setState('invalid-state')
      })

      expect(result.current.state).toBe('idle')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should ignore duplicate state transitions', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setState('loading')
      })

      const firstState = result.current.state

      act(() => {
        result.current.setState('loading')
      })

      expect(result.current.state).toBe(firstState)
    })
  })

  describe('variant changes', () => {
    it('should change variant', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setVariant('secondary')
      })

      expect(result.current.variant).toBe('secondary')
    })

    it('should not accept invalid variants', () => {
      const { result } = renderHook(() => useComponentState())
      const { logger } = require('../../utils/logger')

      act(() => {
        // @ts-ignore
        result.current.setVariant('invalid')
      })

      expect(result.current.variant).toBe('primary')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should support all valid variants', () => {
      const { result } = renderHook(() => useComponentState())

      const variants = ['primary', 'secondary', 'tertiary', 'danger', 'success', 'warning']

      variants.forEach((variant) => {
        act(() => {
          result.current.setVariant(variant as any)
        })

        expect(result.current.variant).toBe(variant)
      })
    })
  })

  describe('size changes', () => {
    it('should change size', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setSize('large')
      })

      expect(result.current.size).toBe('large')
    })

    it('should not accept invalid sizes', () => {
      const { result } = renderHook(() => useComponentState())
      const { logger } = require('../../utils/logger')

      act(() => {
        // @ts-ignore
        result.current.setSize('invalid')
      })

      expect(result.current.size).toBe('medium')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should support all valid sizes', () => {
      const { result } = renderHook(() => useComponentState())

      const sizes = ['small', 'medium', 'large']

      sizes.forEach((size) => {
        act(() => {
          result.current.setSize(size as any)
        })

        expect(result.current.size).toBe(size)
      })
    })
  })

  describe('config updates', () => {
    it('should update entire configuration', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.updateConfig({
          state: 'loading',
          variant: 'secondary',
          size: 'large',
        })
      })

      expect(result.current.state).toBe('loading')
      expect(result.current.variant).toBe('secondary')
      expect(result.current.size).toBe('large')
    })

    it('should merge partial config updates', () => {
      const { result } = renderHook(() =>
        useComponentState({
          initialConfig: { state: 'idle', variant: 'primary', size: 'medium' },
        })
      )

      act(() => {
        result.current.updateConfig({ state: 'loading' })
      })

      expect(result.current.state).toBe('loading')
      expect(result.current.variant).toBe('primary')
      expect(result.current.size).toBe('medium')
    })

    it('should reject invalid config updates', () => {
      const { result } = renderHook(() => useComponentState())
      const { logger } = require('../../utils/logger')

      act(() => {
        // @ts-ignore
        result.current.updateConfig({ state: 'invalid' })
      })

      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('reset functionality', () => {
    it('should reset to default state', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setState('loading')
        result.current.setVariant('secondary')
        result.current.setSize('large')
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.state).toBe('idle')
      expect(result.current.variant).toBe('primary')
      expect(result.current.size).toBe('medium')
      expect(result.current.isTransitioning).toBe(false)
    })

    it('should reset to initial config', () => {
      const { result } = renderHook(() =>
        useComponentState({
          initialConfig: { state: 'loading', variant: 'secondary', size: 'large' },
        })
      )

      act(() => {
        result.current.setState('success')
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.state).toBe('loading')
      expect(result.current.variant).toBe('secondary')
      expect(result.current.size).toBe('large')
    })
  })

  describe('convenience methods', () => {
    it('should set error with message', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setError('Error message')
      })

      expect(result.current.state).toBe('error')
      expect(result.current.hasError).toBe(true)
    })

    it('should set success with message', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setSuccess('Success message')
      })

      expect(result.current.state).toBe('success')
      expect(result.current.isSuccess).toBe(true)
    })

    it('should set loading with text', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setLoading('Loading...')
      })

      expect(result.current.state).toBe('loading')
      expect(result.current.isLoading).toBe(true)
    })

    it('should clear error', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setError('Error')
      })

      act(() => {
        result.current.clearError()
      })

      expect(result.current.state).toBe('idle')
      expect(result.current.hasError).toBe(false)
    })

    it('should not clear non-error states', () => {
      const { result } = renderHook(() => useComponentState())

      act(() => {
        result.current.setState('loading')
      })

      act(() => {
        result.current.clearError()
      })

      expect(result.current.state).toBe('loading')
    })
  })

  describe('executeAction', () => {
    it('should handle successful actions', async () => {
      const { result } = renderHook(() => useComponentState())

      const action = vi.fn(async () => 'result')

      let actionResult: any
      await act(async () => {
        actionResult = await result.current.executeAction(action)
      })

      expect(actionResult).toBe('result')
      expect(action).toHaveBeenCalled()
    })

    it('should set loading state during action', async () => {
      const { result } = renderHook(() => useComponentState())

      const action = vi.fn(async () => {
        expect(result.current.isLoading).toBe(true)
        return 'result'
      })

      await act(async () => {
        await result.current.executeAction(action)
      })
    })

    it('should set success state after action', async () => {
      const { result } = renderHook(() => useComponentState())

      const action = vi.fn(async () => 'result')

      await act(async () => {
        await result.current.executeAction(action)
      })

      expect(result.current.isSuccess).toBe(true)
    })

    it('should auto-return to idle after success', async () => {
      const { result } = renderHook(() => useComponentState())

      const action = vi.fn(async () => 'result')

      await act(async () => {
        await result.current.executeAction(action)
      })

      expect(result.current.state).toBe('success')

      act(() => {
        vi.advanceTimersByTime(2500)
      })

      await waitFor(() => {
        expect(result.current.state).toBe('idle')
      })
    })

    it('should handle action errors', async () => {
      const { result } = renderHook(() => useComponentState())

      const action = vi.fn(async () => {
        throw new Error('Action failed')
      })

      await act(async () => {
        try {
          await result.current.executeAction(action)
        } catch (error) {
          // Expected error
        }
      })

      expect(result.current.hasError).toBe(true)
    })

    it('should rethrow action errors', async () => {
      const { result } = renderHook(() => useComponentState())

      const action = vi.fn(async () => {
        throw new Error('Action failed')
      })

      await act(async () => {
        await expect(result.current.executeAction(action)).rejects.toThrow('Action failed')
      })
    })
  })

  describe('auto error recovery', () => {
    it('should auto-recover from errors', async () => {
      const { result } = renderHook(() =>
        useComponentState({
          autoErrorRecovery: true,
          errorRecoveryTimeout: 1000,
        })
      )

      act(() => {
        result.current.setError('Error')
      })

      expect(result.current.hasError).toBe(true)

      act(() => {
        vi.advanceTimersByTime(1500)
      })

      await waitFor(() => {
        expect(result.current.state).toBe('idle')
      })
    })

    it('should not auto-recover when disabled', async () => {
      const { result } = renderHook(() =>
        useComponentState({
          autoErrorRecovery: false,
        })
      )

      act(() => {
        result.current.setError('Error')
      })

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(result.current.hasError).toBe(true)
    })

    it('should respect custom recovery timeout', async () => {
      const { result } = renderHook(() =>
        useComponentState({
          autoErrorRecovery: true,
          errorRecoveryTimeout: 500,
        })
      )

      act(() => {
        result.current.setError('Error')
      })

      act(() => {
        vi.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(result.current.state).toBe('idle')
      })
    })
  })

  describe('state persistence', () => {
    it('should persist state when enabled', async () => {
      const { result } = renderHook(() =>
        useComponentState({
          persistState: true,
        })
      )

      act(() => {
        result.current.setState('loading')
      })

      // Check localStorage
      const stored = localStorageMock.getItem('componentState:useComponentState')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.state).toBe('loading')
    })

    it('should not persist state when disabled', () => {
      const { result } = renderHook(() =>
        useComponentState({
          persistState: false,
        })
      )

      act(() => {
        result.current.setState('loading')
      })

      const stored = localStorageMock.getItem('componentState:useComponentState')
      expect(stored).toBeNull()
    })
  })

  describe('custom transitions', () => {
    it('should handle custom transitions', async () => {
      const onComplete = vi.fn()

      const { result } = renderHook(() =>
        useComponentState({
          customTransitions: {
            loading: {
              duration: 300,
              onComplete,
            },
          },
        })
      )

      act(() => {
        result.current.setState('loading')
      })

      expect(result.current.isTransitioning).toBe(true)

      act(() => {
        vi.advanceTimersByTime(350)
      })

      await waitFor(() => {
        expect(result.current.isTransitioning).toBe(false)
        expect(onComplete).toHaveBeenCalled()
      })
    })
  })

  describe('useSimpleState', () => {
    it('should provide simplified interface', () => {
      const { result } = renderHook(() => useSimpleState())

      expect(result.current.state).toBeDefined()
      expect(result.current.setState).toBeDefined()
      expect(result.current.isLoading).toBeDefined()
      expect(result.current.hasError).toBeDefined()
      expect(result.current.isSuccess).toBeDefined()
      expect(result.current.clearError).toBeDefined()
    })

    it('should accept initial state', () => {
      const { result } = renderHook(() => useSimpleState('loading'))

      expect(result.current.state).toBe('loading')
      expect(result.current.isLoading).toBe(true)
    })

    it('should update state correctly', () => {
      const { result } = renderHook(() => useSimpleState())

      act(() => {
        result.current.setState('success')
      })

      expect(result.current.state).toBe('success')
      expect(result.current.isSuccess).toBe(true)
    })
  })

  describe('useFormComponentState', () => {
    it('should provide form-specific helpers', () => {
      const { result } = renderHook(() => useFormComponentState())

      expect(result.current.setValidationError).toBeDefined()
      expect(result.current.setValidationSuccess).toBeDefined()
      expect(result.current.validateAndExecute).toBeDefined()
    })

    it('should enable auto error recovery', () => {
      const { result } = renderHook(() => useFormComponentState())

      act(() => {
        result.current.setValidationError('Validation error')
      })

      expect(result.current.hasError).toBe(true)

      act(() => {
        vi.advanceTimersByTime(6000)
      })

      expect(result.current.state).toBe('idle')
    })

    it('should validate before executing', async () => {
      const { result } = renderHook(() => useFormComponentState())

      const validator = vi.fn(() => true)
      const action = vi.fn(async () => 'result')

      let actionResult: any
      await act(async () => {
        actionResult = await result.current.validateAndExecute(validator, action)
      })

      expect(validator).toHaveBeenCalled()
      expect(action).toHaveBeenCalled()
      expect(actionResult).toBe('result')
    })

    it('should not execute if validation fails', async () => {
      const { result } = renderHook(() => useFormComponentState())

      const validator = vi.fn(() => false)
      const action = vi.fn(async () => 'result')

      let actionResult: any
      await act(async () => {
        actionResult = await result.current.validateAndExecute(validator, action)
      })

      expect(validator).toHaveBeenCalled()
      expect(action).not.toHaveBeenCalled()
      expect(actionResult).toBeNull()
      expect(result.current.hasError).toBe(true)
    })

    it('should show validation error message', async () => {
      const { result } = renderHook(() => useFormComponentState())

      const validator = vi.fn(() => 'Custom error message')
      const action = vi.fn(async () => 'result')

      await act(async () => {
        await result.current.validateAndExecute(validator, action)
      })

      expect(result.current.hasError).toBe(true)
    })
  })
})