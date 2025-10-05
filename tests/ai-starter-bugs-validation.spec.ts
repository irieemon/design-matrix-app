import { test, expect, Page } from '@playwright/test'

/**
 * AI Starter Modal - Bug Validation Tests
 *
 * Tests for two critical bugs:
 * 1. Excessive console logging on every keystroke
 * 2. Ideas not populating on matrix after project creation
 */

test.describe('AI Starter Modal - Bug Fixes', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage

    // Navigate to the app
    await page.goto('http://localhost:3003')

    // Wait for authentication
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')

    // Wait for main app to load
    await page.waitForSelector('text=Projects', { timeout: 10000 })

    // Navigate to Projects page
    await page.click('text=Projects')
    await page.waitForSelector('[data-testid="create-project-button"]', { timeout: 5000 })
  })

  test('Bug #1: Should NOT log to console on every keystroke', async () => {
    // Set up console message listener
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.text().includes('AIStarterModal LOADED')) {
        consoleLogs.push(msg.text())
      }
    })

    // Open AI Starter modal
    await page.click('text=AI Starter')
    await page.waitForSelector('text=AI Project Starter', { timeout: 5000 })

    // Clear console logs (should have 1 from initial mount)
    consoleLogs.length = 0

    // Type in project name field
    const projectNameInput = await page.locator('#project-name')
    await projectNameInput.fill('Test Project Name')

    // Type in description field
    const descriptionInput = await page.locator('#project-description')
    await descriptionInput.fill('This is a test description for the project')

    // Wait a bit to ensure any console logs would have fired
    await page.waitForTimeout(500)

    // Verify NO console logs were emitted during typing
    expect(consoleLogs.length).toBe(0)

    console.log('✅ Bug #1 FIXED: No console logs during keystroke')
  })

  test('Bug #2: Ideas should populate on matrix after AI Starter project creation', async () => {
    // Open AI Starter modal
    await page.click('text=AI Starter')
    await page.waitForSelector('text=AI Project Starter', { timeout: 5000 })

    // Fill out project details
    await page.fill('#project-name', 'E-commerce Platform')
    await page.fill('#project-description', 'Building a modern e-commerce platform with payment integration, product catalog, and user reviews.')

    // Select project type
    await page.selectOption('#project-type', 'software')

    // Start AI analysis
    await page.click('text=Start AI Analysis')

    // Wait for AI analysis to complete (could take a while)
    await page.waitForSelector('text=Create Project', { timeout: 60000 })

    // Click Create Project button
    await page.click('button:has-text("Create Project")')

    // Wait for navigation to matrix page
    await page.waitForURL(/.*matrix.*/, { timeout: 10000 })
    await page.waitForTimeout(2000) // Give time for ideas to load

    // Verify we're on the matrix page
    const matrixContainer = await page.locator('.matrix-container')
    await expect(matrixContainer).toBeVisible({ timeout: 5000 })

    // Check that ideas are visible on the matrix
    const ideaCards = await page.locator('[data-testid^="idea-card-"]')
    const ideaCount = await ideaCards.count()

    // Verify at least some ideas are present
    expect(ideaCount).toBeGreaterThan(0)

    console.log(`✅ Bug #2 FIXED: ${ideaCount} ideas populated on matrix`)

    // Verify ideas have content
    for (let i = 0; i < Math.min(ideaCount, 3); i++) {
      const ideaCard = ideaCards.nth(i)
      const ideaText = await ideaCard.textContent()
      expect(ideaText).toBeTruthy()
      expect(ideaText!.length).toBeGreaterThan(0)
    }

    // Verify ideas are positioned on the matrix (have x, y coordinates)
    const firstIdea = ideaCards.first()
    const transform = await firstIdea.evaluate((el) => {
      return window.getComputedStyle(el).transform
    })

    // Transform should be a matrix (indicating positioned element)
    expect(transform).not.toBe('none')

    console.log('✅ Ideas are properly positioned on matrix')
  })

  test('Bug #2: Ideas should persist after page refresh', async () => {
    // Create project with AI Starter
    await page.click('text=AI Starter')
    await page.waitForSelector('text=AI Project Starter', { timeout: 5000 })

    await page.fill('#project-name', 'Mobile App Development')
    await page.fill('#project-description', 'Developing a cross-platform mobile app for fitness tracking with social features.')
    await page.selectOption('#project-type', 'software')

    await page.click('text=Start AI Analysis')
    await page.waitForSelector('text=Create Project', { timeout: 60000 })
    await page.click('button:has-text("Create Project")')

    // Wait for matrix to load with ideas
    await page.waitForURL(/.*matrix.*/, { timeout: 10000 })
    await page.waitForTimeout(2000)

    const ideaCards = await page.locator('[data-testid^="idea-card-"]')
    const initialIdeaCount = await ideaCards.count()

    expect(initialIdeaCount).toBeGreaterThan(0)

    // Refresh the page
    await page.reload()
    await page.waitForTimeout(3000) // Give time for reload and idea loading

    // Verify ideas still present after refresh
    const ideaCardsAfterRefresh = await page.locator('[data-testid^="idea-card-"]')
    const ideaCountAfterRefresh = await ideaCardsAfterRefresh.count()

    expect(ideaCountAfterRefresh).toBe(initialIdeaCount)

    console.log(`✅ Ideas persisted after refresh: ${ideaCountAfterRefresh} ideas`)
  })

  test('Performance: Modal should not re-render on every keystroke', async () => {
    // This test verifies the React.memo and useCallback optimizations

    // Open AI Starter modal
    await page.click('text=AI Starter')
    await page.waitForSelector('text=AI Project Starter', { timeout: 5000 })

    // Add performance marker
    await page.evaluate(() => {
      window.performance.mark('input-start')
    })

    // Type a long string rapidly
    const projectNameInput = await page.locator('#project-name')
    await projectNameInput.fill('This is a very long project name that should not cause excessive re-renders')

    // Add performance marker
    await page.evaluate(() => {
      window.performance.mark('input-end')
      window.performance.measure('input-duration', 'input-start', 'input-end')
    })

    // Get performance measure
    const duration = await page.evaluate(() => {
      const measures = window.performance.getEntriesByType('measure')
      const inputMeasure = measures.find(m => m.name === 'input-duration')
      return inputMeasure ? inputMeasure.duration : 0
    })

    // Verify typing performance is reasonable (< 500ms for the whole operation)
    expect(duration).toBeLessThan(500)

    console.log(`✅ Input performance: ${duration.toFixed(2)}ms`)
  })

  test('Integration: Complete AI Starter flow with all features', async () => {
    // Open AI Starter
    await page.click('text=AI Starter')
    await page.waitForSelector('text=AI Project Starter', { timeout: 5000 })

    // Fill comprehensive project details
    await page.fill('#project-name', 'SaaS Analytics Platform')
    await page.fill('#project-description', 'Enterprise analytics platform with real-time dashboards, custom reports, and AI-powered insights.')
    await page.selectOption('#project-type', 'software')
    await page.selectOption('#industry', 'Technology')

    // Adjust idea count slider
    const ideaCountSlider = await page.locator('#idea-count')
    await ideaCountSlider.fill('8')

    // Adjust tolerance slider
    const toleranceSlider = await page.locator('#idea-tolerance')
    await toleranceSlider.fill('60')

    // Start analysis
    await page.click('text=Start AI Analysis')

    // Wait for analysis (may include clarifying questions step)
    await page.waitForSelector('text=Create Project', { timeout: 60000 })

    // Create project
    await page.click('button:has-text("Create Project")')

    // Wait for navigation and idea loading
    await page.waitForURL(/.*matrix.*/, { timeout: 10000 })
    await page.waitForTimeout(3000)

    // Verify project appears in header
    const projectHeader = await page.locator('h1')
    const projectName = await projectHeader.textContent()
    expect(projectName).toContain('SaaS Analytics Platform')

    // Verify ideas are on matrix
    const ideaCards = await page.locator('[data-testid^="idea-card-"]')
    const ideaCount = await ideaCards.count()

    // Should have approximately 8 ideas (might be +/- a few)
    expect(ideaCount).toBeGreaterThanOrEqual(6)
    expect(ideaCount).toBeLessThanOrEqual(10)

    // Verify ideas are distributed across quadrants
    const quadrantCounts = {
      q1: 0, // High Value, Low Effort
      q2: 0, // High Value, High Effort
      q3: 0, // Low Value, Low Effort
      q4: 0  // Low Value, High Effort
    }

    for (let i = 0; i < ideaCount; i++) {
      const idea = ideaCards.nth(i)
      const bounds = await idea.boundingBox()

      if (bounds) {
        const container = await page.locator('.matrix-container').boundingBox()
        if (container) {
          const relativeX = bounds.x - container.x
          const relativeY = bounds.y - container.y
          const midX = container.width / 2
          const midY = container.height / 2

          if (relativeX > midX && relativeY < midY) quadrantCounts.q1++
          else if (relativeX < midX && relativeY < midY) quadrantCounts.q2++
          else if (relativeX > midX && relativeY > midY) quadrantCounts.q3++
          else quadrantCounts.q4++
        }
      }
    }

    // Verify ideas are distributed (not all in one quadrant)
    const quadrantsWithIdeas = Object.values(quadrantCounts).filter(count => count > 0).length
    expect(quadrantsWithIdeas).toBeGreaterThanOrEqual(2)

    console.log(`✅ Complete flow verified: ${ideaCount} ideas across ${quadrantsWithIdeas} quadrants`)
    console.log(`   Quadrant distribution:`, quadrantCounts)
  })
})
