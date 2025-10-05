/**
 * Custom Test Matchers
 *
 * Domain-specific test matchers for more expressive and maintainable tests.
 * Extends Vitest/Jest with Prioritas-specific assertions.
 */

import { expect } from 'vitest'
import type { IdeaCard } from '../../types'

// =============================================================================
// TYPE EXTENSIONS
// =============================================================================

interface CustomMatchers<R = unknown> {
  toBeInQuadrant(quadrant: 'quick-wins' | 'strategic' | 'reconsider' | 'avoid'): R
  toHaveValidCoordinates(): R
  toBeWithinBounds(minX: number, maxX: number, minY: number, maxY: number): R
  toHaveQuadrantColor(expectedColor: string): R
  toBeCenterAligned(): R
  toBeValidIdea(): R
  toHaveCoordinateDelta(expectedDelta: { x: number; y: number }, tolerance?: number): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

// =============================================================================
// QUADRANT MATCHERS
// =============================================================================

/**
 * Check if idea is in specified quadrant
 */
expect.extend({
  toBeInQuadrant(idea: IdeaCard, expectedQuadrant: string) {
    const centerX = 260
    const centerY = 260

    let actualQuadrant: string
    if (idea.x < centerX && idea.y < centerY) {
      actualQuadrant = 'quick-wins'
    } else if (idea.x >= centerX && idea.y < centerY) {
      actualQuadrant = 'strategic'
    } else if (idea.x < centerX && idea.y >= centerY) {
      actualQuadrant = 'reconsider'
    } else {
      actualQuadrant = 'avoid'
    }

    const pass = actualQuadrant === expectedQuadrant

    return {
      pass,
      message: () =>
        pass
          ? `Expected idea NOT to be in ${expectedQuadrant} quadrant`
          : `Expected idea to be in ${expectedQuadrant} quadrant, but it was in ${actualQuadrant}. Coordinates: (${idea.x}, ${idea.y})`,
    }
  },
})

/**
 * Check if coordinates are valid (0-520 range with allowed overflow)
 */
expect.extend({
  toHaveValidCoordinates(idea: IdeaCard) {
    const minCoord = -20
    const maxCoord = 540

    const xValid = idea.x >= minCoord && idea.x <= maxCoord
    const yValid = idea.y >= minCoord && idea.y <= maxCoord

    const pass = xValid && yValid

    return {
      pass,
      message: () =>
        pass
          ? `Expected idea NOT to have valid coordinates`
          : `Expected idea coordinates to be within bounds (-20 to 540), but got (${idea.x}, ${idea.y})`,
    }
  },
})

/**
 * Check if coordinates are within specific bounds
 */
expect.extend({
  toBeWithinBounds(
    idea: IdeaCard,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ) {
    const xValid = idea.x >= minX && idea.x <= maxX
    const yValid = idea.y >= minY && idea.y <= maxY

    const pass = xValid && yValid

    return {
      pass,
      message: () =>
        pass
          ? `Expected idea NOT to be within bounds`
          : `Expected idea to be within bounds (${minX}-${maxX}, ${minY}-${maxY}), but got (${idea.x}, ${idea.y})`,
    }
  },
})

// =============================================================================
// VISUAL MATCHERS
// =============================================================================

/**
 * Check if element has expected quadrant color
 */
expect.extend({
  toHaveQuadrantColor(element: HTMLElement, expectedColor: string) {
    const borderColor = window.getComputedStyle(element).borderColor

    // Convert RGB to standard format for comparison
    const normalizeColor = (color: string) => {
      return color.replace(/\s/g, '').toLowerCase()
    }

    const normalizedBorder = normalizeColor(borderColor)
    const normalizedExpected = normalizeColor(expectedColor)

    const pass = normalizedBorder === normalizedExpected

    return {
      pass,
      message: () =>
        pass
          ? `Expected element NOT to have border color ${expectedColor}`
          : `Expected element to have border color ${expectedColor}, but got ${borderColor}`,
    }
  },
})

/**
 * Check if element is center-aligned
 */
expect.extend({
  toBeCenterAligned(element: HTMLElement) {
    const style = window.getComputedStyle(element)
    const transform = style.transform

    // Check if transform contains translate(-50%, -50%)
    const hasCenterTransform = transform.includes('translate(-50%, -50%)') ||
                               (style.left === '50%' && style.top === '50%')

    return {
      pass: hasCenterTransform,
      message: () =>
        hasCenterTransform
          ? `Expected element NOT to be center-aligned`
          : `Expected element to be center-aligned with transform: translate(-50%, -50%)`,
    }
  },
})

// =============================================================================
// DATA VALIDATION MATCHERS
// =============================================================================

/**
 * Check if idea has all required fields
 */
expect.extend({
  toBeValidIdea(idea: any) {
    const requiredFields = ['id', 'content', 'x', 'y', 'created_at']
    const missingFields = requiredFields.filter(field => !(field in idea))

    const pass = missingFields.length === 0

    return {
      pass,
      message: () =>
        pass
          ? `Expected idea NOT to be valid`
          : `Expected idea to have all required fields, but missing: ${missingFields.join(', ')}`,
    }
  },
})

// =============================================================================
// COORDINATE MATH MATCHERS
// =============================================================================

/**
 * Check if coordinate delta matches expected (with tolerance)
 */
expect.extend({
  toHaveCoordinateDelta(
    actual: { x: number; y: number },
    expected: { x: number; y: number },
    tolerance: number = 1
  ) {
    const xDiff = Math.abs(actual.x - expected.x)
    const yDiff = Math.abs(actual.y - expected.y)

    const xPass = xDiff <= tolerance
    const yPass = yDiff <= tolerance
    const pass = xPass && yPass

    return {
      pass,
      message: () =>
        pass
          ? `Expected coordinate delta NOT to match (${expected.x}, ${expected.y})`
          : `Expected coordinate delta (${expected.x}, ${expected.y}) ± ${tolerance}, but got (${actual.x}, ${actual.y}). Difference: (${xDiff.toFixed(2)}, ${yDiff.toFixed(2)})`,
    }
  },
})

// =============================================================================
// ACCESSIBILITY MATCHERS
// =============================================================================

/**
 * Check if element is keyboard accessible
 */
expect.extend({
  toBeKeyboardAccessible(element: HTMLElement) {
    const tabIndex = element.getAttribute('tabindex')
    const isButton = element.tagName === 'BUTTON'
    const isLink = element.tagName === 'A'
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)

    const isAccessible =
      isButton ||
      isLink ||
      isInput ||
      (tabIndex !== null && tabIndex !== '-1')

    return {
      pass: isAccessible,
      message: () =>
        isAccessible
          ? `Expected element NOT to be keyboard accessible`
          : `Expected element to be keyboard accessible (button, link, input, or tabindex >= 0)`,
    }
  },
})

/**
 * Check if element has accessible name
 */
expect.extend({
  toHaveAccessibleName(element: HTMLElement, expectedName?: string) {
    const ariaLabel = element.getAttribute('aria-label')
    const ariaLabelledBy = element.getAttribute('aria-labelledby')
    const textContent = element.textContent?.trim()
    const title = element.getAttribute('title')

    const accessibleName = ariaLabel ||
                          (ariaLabelledBy && document.getElementById(ariaLabelledBy)?.textContent) ||
                          textContent ||
                          title ||
                          ''

    const hasName = accessibleName.length > 0
    const matchesExpected = expectedName ? accessibleName === expectedName : true

    const pass = hasName && matchesExpected

    return {
      pass,
      message: () => {
        if (!hasName) {
          return `Expected element to have an accessible name`
        }
        if (!matchesExpected) {
          return `Expected element to have accessible name "${expectedName}", but got "${accessibleName}"`
        }
        return `Expected element NOT to have accessible name`
      },
    }
  },
})

// =============================================================================
// PERFORMANCE MATCHERS
// =============================================================================

/**
 * Check if function executes within time limit
 */
expect.extend({
  async toCompleteWithin(fn: () => Promise<void> | void, maxMs: number) {
    const start = performance.now()
    await fn()
    const duration = performance.now() - start

    const pass = duration <= maxMs

    return {
      pass,
      message: () =>
        pass
          ? `Expected function NOT to complete within ${maxMs}ms`
          : `Expected function to complete within ${maxMs}ms, but took ${duration.toFixed(2)}ms`,
    }
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export {}  // Make this a module