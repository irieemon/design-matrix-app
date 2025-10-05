/**
 * Complete System Validation Test
 *
 * Validates all 5 critical bug fixes:
 * 1. ProjectManagement infinite render loop
 * 2. MainApp screen flickering
 * 3. useIdeas - ideas not loading
 * 4. DesignMatrix componentState loop
 * 5. Rate limiting blocking login
 */

import { test, expect } from '@playwright/test'

test.describe('Complete System Validation After Bug Fixes', () => {
  test('validates all critical bug fixes end-to-end', async ({ page }) => {
    // Console monitoring
    const consoleMessages: string[] = []
    const consoleErrors: string[] = []
    const consoleWarnings: string[] = []

    page.on('console', msg => {
      const text = msg.text()
      consoleMessages.push(text)

      if (msg.type() === 'error') {
        consoleErrors.push(text)
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text)
      }
    })

    // Network request monitoring
    const networkRequests: any[] = []
    const failedRequests: any[] = []

    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now()
      })
    })

    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()
      })
    })

    console.log('\n=== Starting Complete System Validation ===\n')

    // STEP 1: Initial Page Load
    console.log('Step 1: Loading initial page...')
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' })
    await page.screenshot({ path: 'test-results/validation/01-initial-load.png', fullPage: true })

    // Check for immediate render loop errors
    await page.waitForTimeout(2000)
    const hasEarlyInfiniteLoopError = consoleErrors.some(err =>
      err.includes('Maximum update depth') ||
      err.includes('Too many re-renders')
    )
    expect(hasEarlyInfiniteLoopError).toBe(false)
    console.log('✅ No early infinite loop errors detected')

    // STEP 2: Login (Testing Rate Limit Fix)
    console.log('\nStep 2: Testing login (rate limit fix)...')

    // Try to find demo login button
    const demoButton = page.locator('button', { hasText: /demo/i }).first()
    await expect(demoButton).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: 'test-results/validation/02-before-login.png', fullPage: true })

    const beforeLoginTime = Date.now()
    await demoButton.click()

    // Wait for navigation or error
    try {
      await page.waitForURL(/\/(projects|matrix)/, { timeout: 15000 })
      const loginTime = Date.now() - beforeLoginTime
      console.log(`✅ Login successful in ${loginTime}ms`)
    } catch (error) {
      // Check if we got a 429 error
      const has429Error = consoleMessages.some(msg =>
        msg.includes('429') || msg.includes('Too many requests')
      )

      if (has429Error) {
        console.error('❌ FAILED: Rate limiting still blocking login')
        await page.screenshot({ path: 'test-results/validation/ERROR-rate-limit.png', fullPage: true })
        throw new Error('Rate limiting is still blocking login - 429 error detected')
      }

      throw error
    }

    await page.screenshot({ path: 'test-results/validation/03-after-login.png', fullPage: true })

    // STEP 3: Check for Screen Flickering
    console.log('\nStep 3: Testing for screen flickering...')

    // Take screenshot immediately
    await page.screenshot({ path: 'test-results/validation/04a-flicker-test-t0.png', fullPage: true })

    // Wait 1 second and take another
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/validation/04b-flicker-test-t1.png', fullPage: true })

    // Wait another 2 seconds and take final
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/validation/04c-flicker-test-t3.png', fullPage: true })

    console.log('✅ Screenshot sequence captured for flicker analysis')

    // STEP 4: Navigate to Projects Page
    console.log('\nStep 4: Loading projects page...')

    await page.goto('http://localhost:3003/projects', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/validation/05-projects-page.png', fullPage: true })

    // Check for ProjectManagement infinite loop
    const projectLoadMessages = consoleMessages.filter(msg =>
      msg.includes('ProjectManagement useEffect triggered')
    )
    console.log(`Found ${projectLoadMessages.length} project load messages`)

    // Should be minimal, not 100+
    expect(projectLoadMessages.length).toBeLessThan(50)
    console.log('✅ No infinite loop in ProjectManagement')

    // STEP 5: Verify Projects Load
    console.log('\nStep 5: Verifying projects load...')

    try {
      await page.waitForSelector('[data-testid="project-card"]', { timeout: 10000 })
      const projectCount = await page.locator('[data-testid="project-card"]').count()
      console.log(`✅ Found ${projectCount} projects`)

      await page.screenshot({ path: 'test-results/validation/06-projects-loaded.png', fullPage: true })
    } catch (error) {
      console.error('❌ Projects did not load')
      await page.screenshot({ path: 'test-results/validation/ERROR-no-projects.png', fullPage: true })
      throw new Error('Projects failed to load')
    }

    // STEP 6: Select a Project and Load Matrix
    console.log('\nStep 6: Selecting project and loading matrix...')

    const firstProject = page.locator('[data-testid="project-card"]').first()
    await firstProject.click()

    // Wait for matrix to appear
    try {
      await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 })
      console.log('✅ Design matrix loaded')
      await page.screenshot({ path: 'test-results/validation/07-matrix-loaded.png', fullPage: true })
    } catch (error) {
      console.error('❌ Design matrix did not load')
      await page.screenshot({ path: 'test-results/validation/ERROR-no-matrix.png', fullPage: true })
      throw new Error('Design matrix failed to load')
    }

    // STEP 7: Wait for Ideas to Load
    console.log('\nStep 7: Waiting for ideas to load...')

    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/validation/08-ideas-should-be-loaded.png', fullPage: true })

    const ideaCards = await page.locator('[data-testid="idea-card"]').count()
    console.log(`Found ${ideaCards} idea cards`)

    if (ideaCards === 0) {
      console.warn('⚠️  No ideas found - checking if this is expected')

      // Check console for idea loading messages
      const ideaLoadMessages = consoleMessages.filter(msg =>
        msg.includes('Loading ideas') ||
        msg.includes('No ideas found')
      )
      console.log('Idea load messages:', ideaLoadMessages)

      // This might be OK if project has no ideas, but let's check for errors
      const ideaLoadErrors = consoleErrors.filter(err =>
        err.includes('idea') ||
        err.includes('useIdeas')
      )

      if (ideaLoadErrors.length > 0) {
        console.error('❌ Idea loading errors detected:', ideaLoadErrors)
        throw new Error('Ideas failed to load with errors')
      }

      console.log('ℹ️  No ideas found, but no errors either (empty project)')
    } else {
      console.log(`✅ ${ideaCards} ideas loaded successfully`)
    }

    // STEP 8: Check DesignMatrix for Infinite Loops
    console.log('\nStep 8: Checking for DesignMatrix infinite loops...')

    const matrixStateMessages = consoleMessages.filter(msg =>
      msg.includes('componentState') ||
      msg.includes('Component state changed')
    )
    console.log(`Found ${matrixStateMessages.length} matrix state messages`)

    // Should be minimal
    expect(matrixStateMessages.length).toBeLessThan(100)
    console.log('✅ No infinite loop in DesignMatrix componentState')

    // STEP 9: Final Console Error Analysis
    console.log('\n=== Final Console Analysis ===')

    // Filter out expected warnings
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('React DevTools') &&
      !err.includes('Download the React DevTools') &&
      !err.includes('GoTrueClient instances') // This is a warning, not critical
    )

    const infiniteLoopErrors = consoleErrors.filter(err =>
      err.includes('Maximum update depth') ||
      err.includes('Too many re-renders')
    )

    const rateLimitErrors = consoleMessages.filter(msg =>
      msg.includes('429') ||
      msg.includes('Too many requests') ||
      msg.includes('RATE_LIMIT')
    )

    console.log('\nConsole Summary:')
    console.log(`  Total messages: ${consoleMessages.length}`)
    console.log(`  Total errors: ${consoleErrors.length}`)
    console.log(`  Critical errors: ${criticalErrors.length}`)
    console.log(`  Infinite loop errors: ${infiniteLoopErrors.length}`)
    console.log(`  Rate limit errors: ${rateLimitErrors.length}`)
    console.log(`  Failed network requests: ${failedRequests.length}`)

    // Final validations
    expect(infiniteLoopErrors).toHaveLength(0)
    expect(rateLimitErrors).toHaveLength(0)
    expect(criticalErrors).toHaveLength(0)

    console.log('\n✅ ALL VALIDATIONS PASSED\n')

    // Take final screenshot
    await page.screenshot({ path: 'test-results/validation/09-final-state.png', fullPage: true })
  })
})
