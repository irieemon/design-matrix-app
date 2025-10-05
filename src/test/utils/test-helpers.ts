/**
 * Comprehensive Test Helpers
 *
 * Common utilities and helper functions for writing clean, maintainable tests.
 * Includes rendering utilities, async helpers, and domain-specific test utilities.
 */

import { render, RenderOptions, RenderResult, waitFor } from '@testing-library/react'
import { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import type { IdeaCard, Project, User } from '../../types'

// =============================================================================
// RENDERING UTILITIES
// =============================================================================

/**
 * Custom render function with all providers
 * Wraps component with necessary context providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  // TODO: Add context providers wrapper when needed
  // const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  //   return (
  //     <AppProviders>
  //       {children}
  //     </AppProviders>
  //   )
  // }

  return render(ui, { ...options })
}

/**
 * Setup user event with default configuration
 */
export function setupUser() {
  return userEvent.setup({
    delay: null, // No delay in tests for speed
  })
}

// =============================================================================
// ASYNC UTILITIES
// =============================================================================

/**
 * Wait for a condition to be true
 * More flexible than waitFor with custom polling
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number
    interval?: number
    errorMessage?: string
  } = {}
): Promise<void> {
  const { timeout = 3000, interval = 50, errorMessage = 'Condition not met' } = options

  const start = Date.now()

  while (Date.now() - start < timeout) {
    const result = await condition()
    if (result) return

    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(errorMessage)
}

/**
 * Wait for async state update
 * Useful for testing optimistic updates
 */
export async function waitForStateUpdate(
  getState: () => any,
  expectedValue: any,
  options?: { timeout?: number }
): Promise<void> {
  await waitFor(
    () => {
      expect(getState()).toEqual(expectedValue)
    },
    { timeout: options?.timeout ?? 3000 }
  )
}

/**
 * Flush all pending promises
 * Useful for testing promise chains
 */
export async function flushPromises(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve))
}

/**
 * Wait for next frame
 * Useful for testing animations and transitions
 */
export async function waitForNextFrame(): Promise<void> {
  await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
}

// =============================================================================
// MOCK UTILITIES
// =============================================================================

/**
 * Create a spy function that resolves with a value
 */
export function createResolvingSpy<T>(value: T): jest.Mock<Promise<T>> {
  return vi.fn().mockResolvedValue(value) as any
}

/**
 * Create a spy function that rejects with an error
 */
export function createRejectingSpy(error: Error): jest.Mock<Promise<never>> {
  return vi.fn().mockRejectedValue(error) as any
}

/**
 * Create a delayed promise for testing loading states
 */
export function createDelayedPromise<T>(value: T, delay: number): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), delay)
  })
}

/**
 * Mock console methods and restore after test
 */
export function mockConsole(methods: Array<keyof Console> = ['error', 'warn']) {
  const originalMethods: Partial<Record<keyof Console, any>> = {}

  methods.forEach(method => {
    originalMethods[method] = console[method]
    console[method] = vi.fn()
  })

  return {
    restore: () => {
      methods.forEach(method => {
        console[method] = originalMethods[method]!
      })
    },
    getMock: (method: keyof Console) => console[method] as jest.Mock,
  }
}

// =============================================================================
// DOMAIN-SPECIFIC FACTORIES
// =============================================================================

/**
 * Create a test user
 */
export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    email: `test-${Math.random().toString(36).substr(2, 5)}@example.com`,
    name: 'Test User',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create a test project
 */
export function createTestProject(overrides?: Partial<Project>): Project {
  return {
    id: `project-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Project',
    owner_id: `user-${Math.random().toString(36).substr(2, 9)}`,
    description: 'A test project',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create a test idea card
 */
export function createTestIdea(overrides?: Partial<IdeaCard>): IdeaCard {
  return {
    id: `idea-${Math.random().toString(36).substr(2, 9)}`,
    content: 'Test Idea',
    details: 'Test idea details',
    x: 260,
    y: 260,
    priority: 'moderate',
    created_by: null,
    project_id: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create multiple test ideas in different quadrants
 */
export function createQuadrantIdeas(): {
  quickWins: IdeaCard
  strategic: IdeaCard
  reconsider: IdeaCard
  avoid: IdeaCard
} {
  return {
    quickWins: createTestIdea({ content: 'Quick Win', x: 130, y: 130 }),
    strategic: createTestIdea({ content: 'Strategic', x: 390, y: 130 }),
    reconsider: createTestIdea({ content: 'Reconsider', x: 130, y: 390 }),
    avoid: createTestIdea({ content: 'Avoid', x: 390, y: 390 }),
  }
}

// =============================================================================
// COORDINATE SYSTEM UTILITIES
// =============================================================================

/**
 * Convert coordinate to percentage (for testing responsive rendering)
 */
export function coordToPercent(coord: number, padding: number = 40): number {
  return ((coord + padding) / 600) * 100
}

/**
 * Convert pixel delta to coordinate delta (for testing drag)
 */
export function pixelToCoordDelta(pixelDelta: number, containerWidth: number): number {
  return pixelDelta * (600 / containerWidth)
}

/**
 * Get quadrant for coordinates
 */
export function getQuadrant(
  x: number,
  y: number
): 'quick-wins' | 'strategic' | 'reconsider' | 'avoid' {
  const centerX = 260
  const centerY = 260

  if (x < centerX && y < centerY) return 'quick-wins'
  if (x >= centerX && y < centerY) return 'strategic'
  if (x < centerX && y >= centerY) return 'reconsider'
  return 'avoid'
}

/**
 * Get expected color for quadrant
 */
export function getQuadrantColor(quadrant: string): string {
  const colors = {
    'quick-wins': 'rgb(34, 197, 94)',   // green-500
    strategic: 'rgb(59, 130, 246)',     // blue-500
    reconsider: 'rgb(251, 191, 36)',    // amber-500
    avoid: 'rgb(239, 68, 68)',          // red-500
  }
  return colors[quadrant as keyof typeof colors] || ''
}

// =============================================================================
// TESTING UTILITIES
// =============================================================================

/**
 * Suppress console errors/warnings during test
 */
export function suppressConsole(fn: () => void | Promise<void>): void | Promise<void> {
  const originalError = console.error
  const originalWarn = console.warn

  console.error = vi.fn()
  console.warn = vi.fn()

  const result = fn()

  if (result instanceof Promise) {
    return result.finally(() => {
      console.error = originalError
      console.warn = originalWarn
    })
  } else {
    console.error = originalError
    console.warn = originalWarn
  }
}

/**
 * Get data attribute value from element
 */
export function getDataAttr(element: HTMLElement, attr: string): string | null {
  return element.getAttribute(`data-${attr}`)
}

/**
 * Assert element has specific class
 */
export function expectToHaveClass(element: HTMLElement, className: string): void {
  expect(element.classList.contains(className)).toBe(true)
}

/**
 * Assert element has specific styles
 */
export function expectToHaveStyles(element: HTMLElement, styles: Record<string, string>): void {
  const computedStyles = window.getComputedStyle(element)
  Object.entries(styles).forEach(([property, value]) => {
    expect(computedStyles.getPropertyValue(property)).toBe(value)
  })
}

// =============================================================================
// PERFORMANCE TESTING UTILITIES
// =============================================================================

/**
 * Measure execution time of a function
 */
export async function measureExecutionTime(fn: () => void | Promise<void>): Promise<number> {
  const start = performance.now()
  await fn()
  return performance.now() - start
}

/**
 * Assert function completes within time limit
 */
export async function expectToCompleteWithin(
  fn: () => void | Promise<void>,
  maxMs: number
): Promise<void> {
  const time = await measureExecutionTime(fn)
  expect(time).toBeLessThan(maxMs)
}

// =============================================================================
// ACCESSIBILITY TESTING UTILITIES
// =============================================================================

/**
 * Get accessible name of element
 */
export function getAccessibleName(element: HTMLElement): string {
  return element.getAttribute('aria-label') || element.textContent || ''
}

/**
 * Check if element is keyboard accessible
 */
export function isKeyboardAccessible(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute('tabindex')
  return tabIndex !== null && tabIndex !== '-1'
}

/**
 * Get role of element
 */
export function getRole(element: HTMLElement): string | null {
  return element.getAttribute('role')
}

// =============================================================================
// DRAG AND DROP TESTING UTILITIES
// =============================================================================

/**
 * Simulate drag and drop
 */
export function simulateDragDrop(
  element: HTMLElement,
  deltaX: number,
  deltaY: number
): void {
  const rect = element.getBoundingClientRect()
  const startX = rect.left + rect.width / 2
  const startY = rect.top + rect.height / 2

  element.dispatchEvent(new MouseEvent('mousedown', {
    clientX: startX,
    clientY: startY,
    bubbles: true,
  }))

  element.dispatchEvent(new MouseEvent('mousemove', {
    clientX: startX + deltaX,
    clientY: startY + deltaY,
    bubbles: true,
  }))

  element.dispatchEvent(new MouseEvent('mouseup', {
    clientX: startX + deltaX,
    clientY: startY + deltaY,
    bubbles: true,
  }))
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from '@testing-library/react'
export { userEvent }