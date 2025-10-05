/**
 * Comprehensive Test Helper Utilities for E2E Testing
 *
 * This module provides reusable helper functions for:
 * - Authentication and user management
 * - Project and idea creation
 * - Matrix interactions and drag-drop operations
 * - Visual verification and assertions
 * - Performance monitoring
 * - Accessibility testing
 */

import { Page, Locator, expect } from '@playwright/test'
import { SELECTORS } from '../constants/selectors'

// Type definitions
export interface MatrixCoordinates {
  x: number
  y: number
}

export interface QuadrantInfo {
  name: string
  coords: MatrixCoordinates
  color: string
  description: string
}

export interface IdeaData {
  content: string
  details?: string
  priority?: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
  quadrant?: keyof typeof MATRIX_QUADRANTS
}

export interface DragOptions {
  smooth?: boolean
  steps?: number
  delay?: number
}

// Constants
export const TEST_TIMEOUT = 30000
export const ANIMATION_DELAY = 300
export const SHORT_DELAY = 100
export const NETWORK_IDLE_TIMEOUT = 5000

export const MATRIX_QUADRANTS = {
  QUICK_WINS: {
    name: 'Quick Wins',
    coords: { x: 130, y: 130 },
    color: 'emerald',
    description: 'High Value • Low Effort'
  },
  STRATEGIC: {
    name: 'Strategic',
    coords: { x: 390, y: 130 },
    color: 'blue',
    description: 'High Value • High Effort'
  },
  RECONSIDER: {
    name: 'Reconsider',
    coords: { x: 130, y: 390 },
    color: 'amber',
    description: 'Low Value • Low Effort'
  },
  AVOID: {
    name: 'Avoid',
    coords: { x: 390, y: 390 },
    color: 'red',
    description: 'Low Value • High Effort'
  }
} as const

export const TEST_USERS = {
  STANDARD: {
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Test User'
  },
  ADMIN: {
    email: 'admin@example.com',
    password: 'adminpassword123',
    name: 'Admin User'
  },
  DEMO: {
    email: 'demo@example.com',
    password: 'demo',
    name: 'Demo User'
  }
}

/**
 * Authentication Helpers
 */
export class AuthHelper {
  constructor(private page: Page) {}

  async loginAsTestUser(userId: string = 'test-user', email: string = 'test@example.com') {
    // Navigate to app first
    await this.page.goto('/')
    // Wait for DOM to be ready - sufficient for auth check without waiting for all network requests
    await this.page.waitForLoadState('domcontentloaded', { timeout: NETWORK_IDLE_TIMEOUT })

    // Check if already logged in by looking for authenticated UI elements
    // Look for user indicator or Projects page, NOT the matrix (which requires a project)
    const isLoggedIn = await this.page.locator('[data-testid="user-menu"], text=Projects, text=No Project Selected').isVisible({ timeout: 2000 }).catch(() => false)
    if (isLoggedIn) return

    // Check for demo user button (visible on login screen)
    const demoButton = this.page.locator(SELECTORS.AUTH.DEMO_BUTTON)
      .or(this.page.locator('button:has-text("Demo User"), button:has-text("Continue as Demo")'))

    if (await demoButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click demo button to authenticate
      await demoButton.click()
      // Wait for React state update to propagate (demo button doesn't navigate)
      await this.page.waitForTimeout(500)
      // DOM ready is sufficient for React state updates - no network requests needed
      await this.page.waitForLoadState('domcontentloaded')
    } else {
      // Fallback: Set localStorage after navigation
      await this.page.evaluate(({ userId: uid, email: userEmail }) => {
        localStorage.setItem('demo-mode', 'true')
        localStorage.setItem('user', JSON.stringify({ id: uid, email: userEmail }))
      }, { userId, email })
      await this.page.reload()
      // After localStorage update, only need DOM ready to check authenticated UI
      await this.page.waitForLoadState('domcontentloaded')
    }

    // Verify authentication worked - check for authenticated UI indicators
    // After auth, user lands on Projects page with specific buttons/text
    // Try multiple indicators - at least ONE should be visible if authenticated
    const authChecks = [
      this.page.locator('button:has-text("AI Starter")').isVisible({ timeout: 8000 }).catch(() => false),
      this.page.locator('button:has-text("Manual Setup")').isVisible({ timeout: 8000 }).catch(() => false),
      this.page.locator('button:has-text("Access Matrix")').isVisible({ timeout: 8000 }).catch(() => false),
      this.page.locator('text=demo@example.com').isVisible({ timeout: 8000 }).catch(() => false),
    ]

    const authResults = await Promise.all(authChecks)
    const isAuthenticated = authResults.some(result => result === true)

    if (!isAuthenticated) {
      throw new Error('Authentication failed - no authenticated UI found (no AI Starter, Manual Setup, or Access Matrix buttons visible)')
    }

    // Create a default project to access the matrix (tests expect matrix to be visible)
    await this.ensureProjectExists()
  }

  /**
   * Ensures a project exists and matrix is accessible after authentication
   * Most tests expect to work with the matrix, so create a default project if needed
   */
  async ensureProjectExists() {
    // Check if matrix is already visible (project already exists/selected)
    const matrixExists = await this.page.locator(SELECTORS.MATRIX.CONTAINER).isVisible({ timeout: 2000 }).catch(() => false)
    if (matrixExists) return

    // Try clicking "Access Matrix Now" button if visible (direct access without creating project)
    const accessMatrixBtn = this.page.locator('button:has-text("Access Matrix")')
    if (await accessMatrixBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Force click in case of overlays on mobile viewports
      await accessMatrixBtn.click({ force: true }).catch(() => {})
      await this.page.waitForTimeout(1000)

      // Check if matrix appeared
      const matrixNowVisible = await this.page.locator(SELECTORS.MATRIX.CONTAINER).isVisible({ timeout: 3000 }).catch(() => false)
      if (matrixNowVisible) return
    }

    // Otherwise, use Manual Setup to create a project
    const manualSetupBtn = this.page.locator('button:has-text("Manual Setup")')
    if (await manualSetupBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await manualSetupBtn.click()
      await this.page.waitForTimeout(500) // Wait for modal

      // Fill in project details if modal appears
      const projectNameInput = this.page.locator('input[name="name"], input[name="projectName"], input[placeholder*="name" i]').first()
      if (await projectNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await projectNameInput.fill('Test Project')

        // Click create/save button in modal
        const saveBtn = this.page.locator('button:has-text("Create"), button:has-text("Save"), button[type="submit"]').first()
        await saveBtn.click()

        // Wait for matrix to appear
        await this.page.waitForSelector(SELECTORS.MATRIX.CONTAINER, {
          state: 'visible',
          timeout: 8000
        })
      }
    }
  }

  async clearAuth() {
    await this.page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]')
    await this.page.click('button:has-text("Logout")')
    // DOM ready is sufficient for logout navigation - no need to wait for all network requests
    await this.page.waitForLoadState('domcontentloaded')
  }

  async isLoggedIn(): Promise<boolean> {
    return this.page.locator('[data-testid="user-menu"]').isVisible().catch(() => false)
  }
}

/**
 * LocalStorage Helper - ensures proper timing for localStorage operations
 * IMPORTANT: Always navigate first, then set localStorage, then reload
 */
export async function setLocalStorageAndReload(page: Page, key: string, value: any) {
  // Assumes page already navigated - sets localStorage and reloads
  await page.evaluate(({ k, v }) => {
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
  }, { k: key, v: value })
  await page.reload()
  // DOM ready is sufficient after localStorage changes - no network dependency
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Project Management Helpers
 */
export class ProjectHelper {
  constructor(private page: Page) {}

  async createProject(projectName: string = 'Test Project', description?: string) {
    await this.page.click(SELECTORS.PROJECTS.CREATE_BUTTON)
    await this.page.waitForSelector('[data-testid="create-project-modal"]', { state: 'visible' })

    await this.page.fill('input[name="projectName"]', projectName)
    if (description) {
      await this.page.fill('textarea[name="description"]', description)
    }

    await this.page.click('button:has-text("Create")')
    await this.page.waitForSelector(SELECTORS.MATRIX.CONTAINER, { timeout: TEST_TIMEOUT })
  }

  async openProject(projectName: string) {
    await this.page.click(`[data-testid="project-card"]:has-text("${projectName}")`)
    await this.page.waitForSelector(SELECTORS.MATRIX.CONTAINER, { timeout: TEST_TIMEOUT })
  }

  async deleteProject(projectName: string) {
    const projectCard = this.page.locator(`[data-testid="project-card"]:has-text("${projectName}")`)
    await projectCard.hover()
    await projectCard.locator('button[aria-label*="Delete"]').click()
    await this.page.click('button:has-text("Confirm")')
  }

  async getProjectUrl(): Promise<string> {
    return this.page.url()
  }
}

/**
 * Idea Management Helpers
 */
export class IdeaHelper {
  constructor(private page: Page) {}

  async addIdea(idea: IdeaData) {
    await this.page.click(SELECTORS.MATRIX.ADD_IDEA_BUTTON)
    await this.page.waitForSelector(SELECTORS.MODALS.ADD_IDEA, { state: 'visible' })

    await this.page.fill(SELECTORS.FORMS.IDEA_CONTENT_INPUT, idea.content)

    if (idea.details) {
      await this.page.fill('textarea[name="details"]', idea.details)
    }

    if (idea.priority) {
      await this.page.selectOption('select[name="priority"]', idea.priority)
    }

    await this.page.click(SELECTORS.FORMS.IDEA_SAVE_BUTTON)
    await this.page.waitForSelector(SELECTORS.MODALS.ADD_IDEA, { state: 'hidden' })
    await this.page.waitForSelector(`.idea-card-base:has-text("${idea.content}")`, { timeout: TEST_TIMEOUT })
  }

  async addMultipleIdeas(count: number, prefix: string = 'Test Idea') {
    const ideas: IdeaData[] = []
    const priorities: Array<IdeaData['priority']> = ['low', 'moderate', 'high', 'strategic']

    for (let i = 1; i <= count; i++) {
      const idea: IdeaData = {
        content: `${prefix} ${i}`,
        details: `Details for ${prefix.toLowerCase()} ${i}`,
        priority: priorities[i % 4]
      }
      ideas.push(idea)
      await this.addIdea(idea)
    }

    return ideas
  }

  async editIdea(ideaContent: string, updates: Partial<IdeaData>) {
    const card = this.page.locator(`.idea-card-base:has-text("${ideaContent}")`)
    await card.dblclick()
    await this.page.waitForSelector(SELECTORS.MODALS.EDIT_IDEA, { state: 'visible' })

    if (updates.content) {
      await this.page.fill(SELECTORS.FORMS.IDEA_CONTENT_INPUT, updates.content)
    }

    if (updates.details !== undefined) {
      await this.page.fill('textarea[name="details"]', updates.details)
    }

    if (updates.priority) {
      await this.page.selectOption('select[name="priority"]', updates.priority)
    }

    await this.page.click(SELECTORS.FORMS.IDEA_SAVE_BUTTON)
    await this.page.waitForSelector(SELECTORS.MODALS.EDIT_IDEA, { state: 'hidden' })
  }

  async deleteIdea(ideaContent: string) {
    const card = this.page.locator(`.idea-card-base:has-text("${ideaContent}")`)
    await card.hover()
    await card.locator('button:has(.lucide-trash-2)').click()
    await this.page.waitForTimeout(SHORT_DELAY)
  }

  async getIdeaCard(ideaContent: string): Promise<Locator> {
    return this.page.locator(`.idea-card-base:has-text("${ideaContent}")`)
  }

  async getIdeaCount(): Promise<number> {
    return this.page.locator('.idea-card-base').count()
  }

  async collapseIdea(ideaContent: string) {
    const card = await this.getIdeaCard(ideaContent)
    await card.locator('button:has(.lucide-chevron-up)').click()
    await this.page.waitForTimeout(ANIMATION_DELAY)
  }

  async expandIdea(ideaContent: string) {
    const card = await this.getIdeaCard(ideaContent)
    await card.locator('button:has(.lucide-chevron-down)').click()
    await this.page.waitForTimeout(ANIMATION_DELAY)
  }
}

/**
 * Matrix Interaction Helpers
 */
export class MatrixHelper {
  constructor(private page: Page) {}

  async getMatrixElement(): Promise<Locator> {
    return this.page.locator(SELECTORS.MATRIX.CONTAINER)
  }

  async getMatrixBounds() {
    const matrix = await this.getMatrixElement()
    const box = await matrix.boundingBox()
    if (!box) throw new Error('Matrix element not found')
    return box
  }

  async dragIdeaToQuadrant(
    ideaContent: string,
    quadrant: keyof typeof MATRIX_QUADRANTS,
    options: DragOptions = {}
  ) {
    const card = this.page.locator(`.idea-card-base:has-text("${ideaContent}")`)
    const matrix = await this.getMatrixElement()
    const matrixBox = await this.getMatrixBounds()

    const quadrantInfo = MATRIX_QUADRANTS[quadrant]
    const targetX = matrixBox.x + (quadrantInfo.coords.x / 520) * matrixBox.width
    const targetY = matrixBox.y + (quadrantInfo.coords.y / 520) * matrixBox.height

    await card.dragTo(matrix, {
      targetPosition: {
        x: targetX - matrixBox.x,
        y: targetY - matrixBox.y
      },
      ...options
    })

    await this.page.waitForTimeout(options.delay || ANIMATION_DELAY)
  }

  async dragIdeaToCoordinates(ideaContent: string, x: number, y: number, options: DragOptions = {}) {
    const card = this.page.locator(`.idea-card-base:has-text("${ideaContent}")`)
    const matrix = await this.getMatrixElement()
    const matrixBox = await this.getMatrixBounds()

    const targetX = matrixBox.x + (x / 520) * matrixBox.width
    const targetY = matrixBox.y + (y / 520) * matrixBox.height

    await card.dragTo(matrix, {
      targetPosition: {
        x: targetX - matrixBox.x,
        y: targetY - matrixBox.y
      },
      ...options
    })

    await this.page.waitForTimeout(options.delay || ANIMATION_DELAY)
  }

  async verifyIdeaInQuadrant(ideaContent: string, quadrant: keyof typeof MATRIX_QUADRANTS) {
    const card = this.page.locator(`.idea-card-base:has-text("${ideaContent}")`)
    const cardBox = await card.boundingBox()
    const matrixBox = await this.getMatrixBounds()

    if (!cardBox || !matrixBox) throw new Error('Elements not found')

    const centerX = matrixBox.x + matrixBox.width / 2
    const centerY = matrixBox.y + matrixBox.height / 2

    switch (quadrant) {
      case 'QUICK_WINS':
        expect(cardBox.x).toBeLessThan(centerX)
        expect(cardBox.y).toBeLessThan(centerY)
        break
      case 'STRATEGIC':
        expect(cardBox.x).toBeGreaterThan(centerX)
        expect(cardBox.y).toBeLessThan(centerY)
        break
      case 'RECONSIDER':
        expect(cardBox.x).toBeLessThan(centerX)
        expect(cardBox.y).toBeGreaterThan(centerY)
        break
      case 'AVOID':
        expect(cardBox.x).toBeGreaterThan(centerX)
        expect(cardBox.y).toBeGreaterThan(centerY)
        break
    }
  }

  async getQuadrantIdeaCount(quadrant: keyof typeof MATRIX_QUADRANTS): Promise<number> {
    const guide = this.page.locator(`.bg-${MATRIX_QUADRANTS[quadrant].color}-50:has-text("${MATRIX_QUADRANTS[quadrant].name}")`)
    const text = await guide.textContent()
    const match = text?.match(/(\d+)\s+ideas?/)
    return match ? parseInt(match[1], 10) : 0
  }

  async hoverQuadrantLabel(quadrant: keyof typeof MATRIX_QUADRANTS) {
    const label = this.page.locator(`.bg-${MATRIX_QUADRANTS[quadrant].color}-50:has-text("${MATRIX_QUADRANTS[quadrant].name}")`)
    await label.hover()
    await this.page.waitForTimeout(SHORT_DELAY)
  }
}

/**
 * Visual Testing Helpers
 */
export class VisualHelper {
  constructor(private page: Page) {}

  async captureMatrixScreenshot(name: string) {
    const matrix = this.page.locator(SELECTORS.MATRIX.CONTAINER)
    return matrix.screenshot({ path: `test-results/screenshots/${name}.png` })
  }

  async captureFullPageScreenshot(name: string) {
    return this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true })
  }

  async verifyNoVisualRegression(name: string) {
    const matrix = this.page.locator(SELECTORS.MATRIX.CONTAINER)
    await expect(matrix).toHaveScreenshot(`${name}.png`)
  }

  async verifyElementHasClass(selector: string, className: string) {
    const element = this.page.locator(selector)
    await expect(element).toHaveClass(new RegExp(className))
  }

  async verifyElementHasCSS(selector: string, property: string, value: string | RegExp) {
    const element = this.page.locator(selector)
    await expect(element).toHaveCSS(property, value)
  }

  async measureAnimationDuration(selector: string, trigger: () => Promise<void>): Promise<number> {
    const element = this.page.locator(selector)

    const startTime = Date.now()
    await trigger()

    // Wait for animation to complete (check for stable state)
    await element.evaluate((el) => {
      return Promise.all(el.getAnimations().map(animation => animation.finished))
    })

    return Date.now() - startTime
  }
}

/**
 * Performance Testing Helpers
 */
export class PerformanceHelper {
  constructor(private page: Page) {}

  async measureOperationTime(operation: () => Promise<void>): Promise<number> {
    const startTime = Date.now()
    await operation()
    return Date.now() - startTime
  }

  async measurePageLoadTime(): Promise<number> {
    const metrics = await this.page.evaluate(() => {
      const timing = performance.timing
      return {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
        responseTime: timing.responseEnd - timing.requestStart
      }
    })
    return metrics.loadTime
  }

  async measureDragPerformance(ideaContent: string, targetQuadrant: keyof typeof MATRIX_QUADRANTS): Promise<number> {
    const matrixHelper = new MatrixHelper(this.page)

    const startTime = Date.now()
    await matrixHelper.dragIdeaToQuadrant(ideaContent, targetQuadrant)
    return Date.now() - startTime
  }

  async getMemoryUsage() {
    return this.page.evaluate(() => {
      const mem = (performance as any).memory
      return mem ? {
        usedJSHeapSize: mem.usedJSHeapSize,
        totalJSHeapSize: mem.totalJSHeapSize,
        jsHeapSizeLimit: mem.jsHeapSizeLimit
      } : null
    })
  }

  async measureFPS(duration: number = 1000): Promise<number> {
    return this.page.evaluate((dur) => {
      return new Promise<number>((resolve) => {
        let frameCount = 0
        const startTime = performance.now()

        function countFrame() {
          frameCount++
          if (performance.now() - startTime < dur) {
            requestAnimationFrame(countFrame)
          } else {
            const fps = (frameCount / dur) * 1000
            resolve(fps)
          }
        }

        requestAnimationFrame(countFrame)
      })
    }, duration)
  }
}

/**
 * Accessibility Testing Helpers
 */
export class AccessibilityHelper {
  constructor(private page: Page) {}

  async verifyKeyboardNavigation() {
    // Tab through interactive elements
    await this.page.keyboard.press('Tab')
    const focused = await this.page.evaluate(() => document.activeElement?.tagName)
    expect(focused).toBeTruthy()
  }

  async verifyAriaLabels(selector: string) {
    const element = this.page.locator(selector)
    const ariaLabel = await element.getAttribute('aria-label')
    const ariaLabelledBy = await element.getAttribute('aria-labelledby')

    expect(ariaLabel || ariaLabelledBy).toBeTruthy()
  }

  async verifyFocusVisible(selector: string) {
    const element = this.page.locator(selector)
    await element.focus()

    const outlineStyle = await element.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.outline !== 'none' || styles.boxShadow !== 'none'
    })

    expect(outlineStyle).toBeTruthy()
  }

  async verifyScreenReaderAnnouncement() {
    const liveRegion = this.page.locator('[role="status"][aria-live="polite"]')
    await expect(liveRegion).toBeAttached()
  }

  async simulateKeyboardDrag(ideaContent: string, direction: 'up' | 'down' | 'left' | 'right', steps: number = 5) {
    const card = this.page.locator(`.idea-card-base:has-text("${ideaContent}")`)
    await card.focus()

    const key = `Arrow${direction.charAt(0).toUpperCase() + direction.slice(1)}`

    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press(key)
      await this.page.waitForTimeout(SHORT_DELAY)
    }
  }

  async verifyColorContrast(selector: string): Promise<boolean> {
    const element = this.page.locator(selector)

    return element.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      const bgColor = styles.backgroundColor
      const textColor = styles.color

      // Parse RGB values
      const parseRGB = (color: string) => {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0]
      }

      const bg = parseRGB(bgColor)
      const fg = parseRGB(textColor)

      // Calculate relative luminance
      const luminance = (rgb: number[]) => {
        const [r, g, b] = rgb.map((val) => {
          const sRGB = val / 255
          return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }

      const l1 = luminance(fg)
      const l2 = luminance(bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

      // WCAG AA requires 4.5:1 for normal text
      return ratio >= 4.5
    })
  }
}

/**
 * Utility Functions
 */
export async function waitForNetworkIdle(page: Page, timeout: number = NETWORK_IDLE_TIMEOUT) {
  // Note: This function kept for backward compatibility, but prefer domcontentloaded for most cases
  // Only use networkidle when you actually need all network requests completed
  await page.waitForLoadState('networkidle', { timeout })
}

export async function waitForAnimation(page: Page, delay: number = ANIMATION_DELAY) {
  await page.waitForTimeout(delay)
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastError || new Error('Operation failed after retries')
}

export function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * All-in-one test context helper
 */
export class TestContext {
  auth: AuthHelper
  project: ProjectHelper
  idea: IdeaHelper
  matrix: MatrixHelper
  visual: VisualHelper
  performance: PerformanceHelper
  accessibility: AccessibilityHelper

  constructor(page: Page) {
    this.auth = new AuthHelper(page)
    this.project = new ProjectHelper(page)
    this.idea = new IdeaHelper(page)
    this.matrix = new MatrixHelper(page)
    this.visual = new VisualHelper(page)
    this.performance = new PerformanceHelper(page)
    this.accessibility = new AccessibilityHelper(page)
  }

  /**
   * Complete setup: login + create project
   */
  async setupTest(projectName?: string) {
    await this.auth.loginAsTestUser()
    await this.project.createProject(projectName)
  }

  /**
   * Complete teardown: cleanup and logout
   */
  async teardownTest() {
    await this.auth.logout()
  }
}
