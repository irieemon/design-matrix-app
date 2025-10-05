import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useFocusTrap,
  useKeyboardNavigation,
  useAriaLiveRegion,
  useSkipLinks,
  useReducedMotion,
  useAccessibleId,
  useHighContrast,
  ariaUtils,
} from '../useAccessibility'

describe('useAccessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('useFocusTrap', () => {
    it('should return a ref for container', () => {
      const { result } = renderHook(() => useFocusTrap(false))
      expect(result.current.current).toBe(null)
    })

    it('should focus first focusable element when active', async () => {
      const { result } = renderHook(() => useFocusTrap(true))

      const container = document.createElement('div')
      const button1 = document.createElement('button')
      button1.textContent = 'Button 1'
      const button2 = document.createElement('button')
      button2.textContent = 'Button 2'

      container.appendChild(button1)
      container.appendChild(button2)
      document.body.appendChild(container)

      // @ts-ignore - accessing internal ref
      result.current.current = container

      await waitFor(() => {
        expect(document.activeElement).toBe(button1)
      })
    })

    it('should trap Tab key within container', async () => {
      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      })

      const container = document.createElement('div')
      const button1 = document.createElement('button')
      const button2 = document.createElement('button')
      const button3 = document.createElement('button')

      container.appendChild(button1)
      container.appendChild(button2)
      container.appendChild(button3)
      document.body.appendChild(container)

      // @ts-ignore
      result.current.current = container

      rerender({ active: true })

      await waitFor(() => {
        expect(document.activeElement).toBe(button1)
      })

      // Simulate Tab key on last element
      button3.focus()
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      document.dispatchEvent(tabEvent)

      // Should prevent default and loop to first element
      expect(document.activeElement).toBe(button1)
    })

    it('should handle Shift+Tab correctly', async () => {
      const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
        initialProps: { active: false },
      })

      const container = document.createElement('div')
      const button1 = document.createElement('button')
      const button2 = document.createElement('button')

      container.appendChild(button1)
      container.appendChild(button2)
      document.body.appendChild(container)

      // @ts-ignore
      result.current.current = container

      rerender({ active: true })

      await waitFor(() => {
        expect(document.activeElement).toBe(button1)
      })

      // Simulate Shift+Tab on first element
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      })
      document.dispatchEvent(shiftTabEvent)

      // Should loop to last element
      expect(document.activeElement).toBe(button2)
    })

    it('should restore focus on cleanup', async () => {
      const previousElement = document.createElement('button')
      document.body.appendChild(previousElement)
      previousElement.focus()

      const { result, unmount } = renderHook(() => useFocusTrap(true))

      const container = document.createElement('div')
      const button = document.createElement('button')
      container.appendChild(button)
      document.body.appendChild(container)

      // @ts-ignore
      result.current.current = container

      await waitFor(() => {
        expect(document.activeElement).toBe(button)
      })

      unmount()

      expect(document.activeElement).toBe(previousElement)
    })

    it('should handle containers with no focusable elements', () => {
      const { result } = renderHook(() => useFocusTrap(true))

      const container = document.createElement('div')
      const div = document.createElement('div')
      container.appendChild(div)
      document.body.appendChild(container)

      // @ts-ignore
      result.current.current = container

      // Should not throw error
      expect(() => {
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
        document.dispatchEvent(tabEvent)
      }).not.toThrow()
    })

    it('should handle disabled elements correctly', async () => {
      const { result } = renderHook(() => useFocusTrap(true))

      const container = document.createElement('div')
      const button1 = document.createElement('button')
      const button2 = document.createElement('button')
      button2.disabled = true
      const button3 = document.createElement('button')

      container.appendChild(button1)
      container.appendChild(button2)
      container.appendChild(button3)
      document.body.appendChild(container)

      // @ts-ignore
      result.current.current = container

      await waitFor(() => {
        expect(document.activeElement).toBe(button1)
      })

      // Tab should skip disabled button
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      document.dispatchEvent(tabEvent)

      // Should move to button3, skipping disabled button2
      await waitFor(() => {
        expect(document.activeElement).toBe(button3)
      })
    })
  })

  describe('useKeyboardNavigation', () => {
    let items: HTMLElement[]

    beforeEach(() => {
      items = []
      for (let i = 0; i < 5; i++) {
        const div = document.createElement('div')
        div.tabIndex = 0
        document.body.appendChild(div)
        items.push(div)
      }
    })

    it('should initialize with currentIndex -1', () => {
      const { result } = renderHook(() => useKeyboardNavigation(items))
      expect(result.current.currentIndex).toBe(-1)
    })

    it('should handle ArrowDown in vertical mode', () => {
      const { result } = renderHook(() => useKeyboardNavigation(items, { direction: 'vertical' }))

      act(() => {
        result.current.setCurrentIndex(0)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(1)
    })

    it('should handle ArrowUp in vertical mode', () => {
      const { result } = renderHook(() => useKeyboardNavigation(items, { direction: 'vertical' }))

      act(() => {
        result.current.setCurrentIndex(2)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(1)
    })

    it('should loop at boundaries when loop is enabled', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation(items, { direction: 'vertical', loop: true })
      )

      act(() => {
        result.current.setCurrentIndex(4)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(0)
    })

    it('should not loop at boundaries when loop is disabled', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation(items, { direction: 'vertical', loop: false })
      )

      act(() => {
        result.current.setCurrentIndex(4)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(4)
    })

    it('should handle ArrowRight in horizontal mode', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation(items, { direction: 'horizontal' })
      )

      act(() => {
        result.current.setCurrentIndex(0)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(1)
    })

    it('should handle ArrowLeft in horizontal mode', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation(items, { direction: 'horizontal' })
      )

      act(() => {
        result.current.setCurrentIndex(2)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(1)
    })

    it('should handle Home key', () => {
      const { result } = renderHook(() => useKeyboardNavigation(items))

      act(() => {
        result.current.setCurrentIndex(3)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Home' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(0)
    })

    it('should handle End key', () => {
      const { result } = renderHook(() => useKeyboardNavigation(items))

      act(() => {
        result.current.setCurrentIndex(0)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'End' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(4)
    })

    it('should handle grid navigation with columns', () => {
      const { result } = renderHook(() =>
        useKeyboardNavigation(items, { direction: 'grid', gridColumns: 2 })
      )

      act(() => {
        result.current.setCurrentIndex(0)
      })

      // Move down one row (2 columns)
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(2)

      // Move right within row
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(3)
    })

    it('should handle empty items array', () => {
      const { result } = renderHook(() => useKeyboardNavigation([]))

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        result.current.handleKeyDown(event)
      })

      expect(result.current.currentIndex).toBe(-1)
    })

    it('should focus element on navigation', () => {
      const { result } = renderHook(() => useKeyboardNavigation(items))

      act(() => {
        result.current.setCurrentIndex(0)
      })

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        result.current.handleKeyDown(event)
      })

      expect(document.activeElement).toBe(items[1])
    })
  })

  describe('useAriaLiveRegion', () => {
    it('should create live region on mount', async () => {
      renderHook(() => useAriaLiveRegion())

      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]')
        expect(liveRegion).not.toBeNull()
      })
    })

    it('should create live region with correct attributes', async () => {
      renderHook(() => useAriaLiveRegion())

      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]')
        expect(liveRegion?.getAttribute('aria-live')).toBe('polite')
        expect(liveRegion?.getAttribute('aria-atomic')).toBe('true')
        expect(liveRegion?.className).toContain('sr-only')
      })
    })

    it('should announce messages', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useAriaLiveRegion())

      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]')
        expect(liveRegion).not.toBeNull()
      })

      act(() => {
        result.current.announce('Test message')
      })

      act(() => {
        vi.advanceTimersByTime(150)
      })

      const liveRegion = document.querySelector('[aria-live]')
      expect(liveRegion?.textContent).toBe('Test message')

      vi.useRealTimers()
    })

    it('should support assertive priority', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useAriaLiveRegion())

      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]')
        expect(liveRegion).not.toBeNull()
      })

      act(() => {
        result.current.announce('Urgent message', 'assertive')
      })

      act(() => {
        vi.advanceTimersByTime(150)
      })

      const liveRegion = document.querySelector('[aria-live]')
      expect(liveRegion?.getAttribute('aria-live')).toBe('assertive')

      vi.useRealTimers()
    })

    it('should clear region before announcing', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useAriaLiveRegion())

      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]')
        expect(liveRegion).not.toBeNull()
      })

      act(() => {
        result.current.announce('First message')
      })

      act(() => {
        vi.advanceTimersByTime(150)
      })

      act(() => {
        result.current.announce('Second message')
      })

      // Should clear first
      let liveRegion = document.querySelector('[aria-live]')
      expect(liveRegion?.textContent).toBe('')

      act(() => {
        vi.advanceTimersByTime(150)
      })

      liveRegion = document.querySelector('[aria-live]')
      expect(liveRegion?.textContent).toBe('Second message')

      vi.useRealTimers()
    })

    it('should clean up live region on unmount', async () => {
      const { unmount } = renderHook(() => useAriaLiveRegion())

      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live]')
        expect(liveRegion).not.toBeNull()
      })

      unmount()

      const liveRegion = document.querySelector('[aria-live]')
      expect(liveRegion).toBeNull()
    })
  })

  describe('useSkipLinks', () => {
    it('should create skip link on mount', () => {
      renderHook(() => useSkipLinks())

      const skipLink = document.querySelector('a[href="#main-content"]')
      expect(skipLink).not.toBeNull()
      expect(skipLink?.textContent).toBe('Skip to main content')
    })

    it('should position skip link off-screen by default', () => {
      renderHook(() => useSkipLinks())

      const skipLink = document.querySelector('a[href="#main-content"]') as HTMLElement
      expect(skipLink?.style.top).toBe('-40px')
    })

    it('should move skip link on-screen on focus', () => {
      renderHook(() => useSkipLinks())

      const skipLink = document.querySelector('a[href="#main-content"]') as HTMLElement
      skipLink.dispatchEvent(new Event('focus'))

      expect(skipLink.style.top).toBe('6px')
    })

    it('should move skip link off-screen on blur', () => {
      renderHook(() => useSkipLinks())

      const skipLink = document.querySelector('a[href="#main-content"]') as HTMLElement
      skipLink.dispatchEvent(new Event('focus'))
      skipLink.dispatchEvent(new Event('blur'))

      expect(skipLink.style.top).toBe('-40px')
    })

    it('should clean up skip link on unmount', () => {
      const { unmount } = renderHook(() => useSkipLinks())

      const skipLink = document.querySelector('a[href="#main-content"]')
      expect(skipLink).not.toBeNull()

      unmount()

      const skipLinkAfter = document.querySelector('a[href="#main-content"]')
      expect(skipLinkAfter).toBeNull()
    })
  })

  describe('useReducedMotion', () => {
    let matchMediaMock: any

    beforeEach(() => {
      matchMediaMock = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      window.matchMedia = vi.fn(() => matchMediaMock)
    })

    it('should detect prefers-reduced-motion', () => {
      matchMediaMock.matches = true

      const { result } = renderHook(() => useReducedMotion())

      expect(result.current).toBe(true)
    })

    it('should return false when reduced motion not preferred', () => {
      matchMediaMock.matches = false

      const { result } = renderHook(() => useReducedMotion())

      expect(result.current).toBe(false)
    })

    it('should update on media query change', () => {
      const { result, rerender } = renderHook(() => useReducedMotion())

      expect(result.current).toBe(false)

      // Simulate media query change
      act(() => {
        const changeHandler = matchMediaMock.addEventListener.mock.calls[0][1]
        changeHandler({ matches: true })
      })

      expect(result.current).toBe(true)
    })

    it('should clean up event listener on unmount', () => {
      const { unmount } = renderHook(() => useReducedMotion())

      unmount()

      expect(matchMediaMock.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
    })
  })

  describe('useAccessibleId', () => {
    it('should generate unique ID', () => {
      const { result } = renderHook(() => useAccessibleId())

      expect(result.current).toMatch(/^accessible-/)
      expect(result.current.length).toBeGreaterThan(10)
    })

    it('should use custom prefix', () => {
      const { result } = renderHook(() => useAccessibleId('custom'))

      expect(result.current).toMatch(/^custom-/)
    })

    it('should maintain same ID across re-renders', () => {
      const { result, rerender } = renderHook(() => useAccessibleId())

      const firstId = result.current
      rerender()
      const secondId = result.current

      expect(firstId).toBe(secondId)
    })

    it('should generate different IDs for different hooks', () => {
      const { result: result1 } = renderHook(() => useAccessibleId())
      const { result: result2 } = renderHook(() => useAccessibleId())

      expect(result1.current).not.toBe(result2.current)
    })
  })

  describe('useHighContrast', () => {
    let matchMediaMock: any

    beforeEach(() => {
      matchMediaMock = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      window.matchMedia = vi.fn(() => matchMediaMock)
    })

    it('should detect high contrast mode', () => {
      matchMediaMock.matches = true

      const { result } = renderHook(() => useHighContrast())

      expect(result.current).toBe(true)
    })

    it('should return false when high contrast not active', () => {
      matchMediaMock.matches = false

      const { result } = renderHook(() => useHighContrast())

      expect(result.current).toBe(false)
    })

    it('should update on contrast preference change', () => {
      const { result } = renderHook(() => useHighContrast())

      expect(result.current).toBe(false)

      act(() => {
        const changeHandler = matchMediaMock.addEventListener.mock.calls[0][1]
        changeHandler({ matches: true })
      })

      expect(result.current).toBe(true)
    })

    it('should clean up event listener on unmount', () => {
      const { unmount } = renderHook(() => useHighContrast())

      unmount()

      expect(matchMediaMock.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
    })
  })

  describe('ariaUtils.getInputAriaProps', () => {
    it('should generate basic input props', () => {
      const props = ariaUtils.getInputAriaProps('Username', false)

      expect(props['aria-label']).toBe('Username')
      expect(props['aria-required']).toBe(false)
    })

    it('should handle required inputs', () => {
      const props = ariaUtils.getInputAriaProps('Email', true)

      expect(props['aria-required']).toBe(true)
    })

    it('should handle error state', () => {
      const props = ariaUtils.getInputAriaProps('Password', false, 'Invalid password')

      expect(props['aria-invalid']).toBe(true)
      expect(props['aria-describedby']).toBe('password-error')
    })

    it('should handle description', () => {
      const props = ariaUtils.getInputAriaProps('Username', false, undefined, 'Enter your username')

      expect(props['aria-describedby']).toBe('username-description')
    })
  })

  describe('ariaUtils.getButtonAriaProps', () => {
    it('should generate basic button props', () => {
      const props = ariaUtils.getButtonAriaProps('Submit', undefined, undefined, false)

      expect(props['aria-label']).toBe('Submit')
      expect(props['aria-disabled']).toBe(false)
    })

    it('should handle disabled state', () => {
      const props = ariaUtils.getButtonAriaProps('Submit', undefined, undefined, true)

      expect(props['aria-disabled']).toBe(true)
    })

    it('should handle pressed state', () => {
      const props = ariaUtils.getButtonAriaProps('Toggle', true)

      expect(props['aria-pressed']).toBe(true)
    })

    it('should handle expanded state', () => {
      const props = ariaUtils.getButtonAriaProps('Menu', undefined, true)

      expect(props['aria-expanded']).toBe(true)
    })
  })

  describe('ariaUtils.getListAriaProps', () => {
    it('should generate basic list props', () => {
      const props = ariaUtils.getListAriaProps(5)

      expect(props.role).toBe('list')
      expect(props['aria-setsize']).toBe(5)
    })

    it('should handle multi-selectable lists', () => {
      const props = ariaUtils.getListAriaProps(10, 0, true)

      expect(props['aria-multiselectable']).toBe(true)
    })
  })

  describe('ariaUtils.getDraggableAriaProps', () => {
    it('should generate basic draggable props', () => {
      const props = ariaUtils.getDraggableAriaProps('Item 1')

      expect(props['aria-label']).toBe('Item 1')
      expect(props['aria-grabbed']).toBe(false)
      expect(props.role).toBe('button')
      expect(props.tabIndex).toBe(0)
    })

    it('should handle dragging state', () => {
      const props = ariaUtils.getDraggableAriaProps('Item 1', true)

      expect(props['aria-grabbed']).toBe(true)
    })

    it('should include position information', () => {
      const props = ariaUtils.getDraggableAriaProps('Item 1', false, { x: 100, y: 200 })

      expect(props['aria-describedby']).toBe('Position: 100, 200')
    })
  })
})