/**
 * Critical Visual Issues Validation Test Suite
 *
 * This test suite validates that 4 critical visual issues in the Design Matrix application have been fixed:
 * 1. Background losing grid and turning grey on rollover
 * 2. Expanded card grows big when dragging
 * 3. Minimized card resizing vertically on drag
 * 4. Delete button showing up where minimize button is
 */

import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3007'

interface TestResult {
  issue: string
  description: string
  passed: boolean
  evidence: string[]
  details: string
}

let testResults: TestResult[] = []

test.describe('Critical Visual Issues Validation', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage

    // Navigate to the application
    await page.goto(BASE_URL)

    // Wait for the app to load
    await page.waitForLoadState('networkidle')

    // Handle any authentication if needed - try to bypass auth or auto-login
    try {
      // Check if we're on auth screen
      const authElement = await page.locator('[data-testid="auth-screen"], .auth-screen, [class*="auth"]').first()
      if (await authElement.isVisible({ timeout: 2000 })) {
        // Try to find and click skip/guest mode if available
        const skipButton = page.locator('button:has-text("Skip"), button:has-text("Guest"), button:has-text("Continue"), [data-testid="skip-auth"]')
        if (await skipButton.isVisible({ timeout: 1000 })) {
          await skipButton.click()
        } else {
          // Try to fill in test credentials quickly
          await page.fill('input[type="email"], input[name="email"]', 'test@example.com')
          await page.fill('input[type="password"], input[name="password"]', 'testpass123')
          await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")')
        }
      }
    } catch (error) {
      console.log('Auth handling attempt failed, continuing...')
    }

    // Wait for matrix/main content to load
    await page.waitForSelector('.matrix-container, .design-matrix, [data-testid="matrix"]', { timeout: 10000 })

    // Ensure we have some content to test with
    await page.waitForTimeout(2000) // Allow for any initial animations
  })

  test('Issue #1: Grid background preservation during hover operations', async () => {
    console.log('🔍 Testing Issue #1: Grid background preservation during hover')

    const testResult: TestResult = {
      issue: 'Issue #1',
      description: 'Grid background preservation during hover operations',
      passed: false,
      evidence: [],
      details: ''
    }

    try {
      // Find the matrix container
      const matrixContainer = page.locator('.matrix-container, .design-matrix, [data-testid="matrix"]').first()
      await expect(matrixContainer).toBeVisible()

      // Take baseline screenshot before hover
      const baselineScreenshot = `grid-baseline-${Date.now()}.png`
      await page.screenshot({
        path: baselineScreenshot,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })
      testResult.evidence.push(baselineScreenshot)

      // Get matrix background properties before hover
      const matrixGrid = page.locator('.matrix-grid-background, .matrix-container').first()
      const beforeBg = await matrixGrid.evaluate((el) => {
        const styles = window.getComputedStyle(el)
        return {
          backgroundColor: styles.backgroundColor,
          backgroundImage: styles.backgroundImage,
          backgroundSize: styles.backgroundSize
        }
      })

      // Hover over the matrix area
      await matrixContainer.hover()
      await page.waitForTimeout(500) // Allow hover effects to apply

      // Take screenshot during hover
      const hoverScreenshot = `grid-hover-${Date.now()}.png`
      await page.screenshot({
        path: hoverScreenshot,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })
      testResult.evidence.push(hoverScreenshot)

      // Get matrix background properties during hover
      const afterBg = await matrixGrid.evaluate((el) => {
        const styles = window.getComputedStyle(el)
        return {
          backgroundColor: styles.backgroundColor,
          backgroundImage: styles.backgroundImage,
          backgroundSize: styles.backgroundSize
        }
      })

      // Validation: Grid pattern should be preserved and background shouldn't turn grey
      const backgroundPreserved = afterBg.backgroundImage !== 'none' && afterBg.backgroundImage.includes('linear-gradient')
      const notGreyBackground = afterBg.backgroundColor !== 'rgb(128, 128, 128)' && !afterBg.backgroundColor.includes('gray')

      testResult.passed = backgroundPreserved && notGreyBackground
      testResult.details = `Background preserved: ${backgroundPreserved}, Not grey: ${notGreyBackground}. Before: ${JSON.stringify(beforeBg)}, After: ${JSON.stringify(afterBg)}`

      console.log(`✅ Issue #1 result: ${testResult.passed ? 'PASSED' : 'FAILED'} - ${testResult.details}`)

    } catch (error) {
      testResult.details = `Test error: ${error.message}`
      console.log(`❌ Issue #1 error: ${testResult.details}`)
    }

    testResults.push(testResult)
  })

  test('Issue #2: Card size maintenance during drag operations', async () => {
    console.log('🔍 Testing Issue #2: Card size maintenance during drag')

    const testResult: TestResult = {
      issue: 'Issue #2',
      description: 'Card size maintenance during drag operations',
      passed: false,
      evidence: [],
      details: ''
    }

    try {
      // Find an expanded card to test drag behavior
      const ideaCard = page.locator('.idea-card, [data-testid*="card"], .card').first()
      await expect(ideaCard).toBeVisible()

      // Expand the card if it's collapsed
      const isCollapsed = await ideaCard.evaluate((el) =>
        el.classList.contains('collapsed') || el.dataset.collapsed === 'true'
      )

      if (isCollapsed) {
        await ideaCard.click() // Expand the card
        await page.waitForTimeout(300)
      }

      // Get initial card dimensions
      const initialBounds = await ideaCard.boundingBox()
      const initialSize = {
        width: initialBounds?.width || 0,
        height: initialBounds?.height || 0
      }

      // Take screenshot before drag
      const beforeDragScreenshot = `card-drag-before-${Date.now()}.png`
      await page.screenshot({
        path: beforeDragScreenshot,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })
      testResult.evidence.push(beforeDragScreenshot)

      // Start drag operation
      await ideaCard.hover()
      await page.mouse.down()

      // Move slightly to trigger drag state
      await page.mouse.move(initialBounds?.x || 0 + 50, initialBounds?.y || 0 + 50)
      await page.waitForTimeout(200) // Allow drag state to activate

      // Take screenshot during drag
      const duringDragScreenshot = `card-drag-during-${Date.now()}.png`
      await page.screenshot({
        path: duringDragScreenshot,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })
      testResult.evidence.push(duringDragScreenshot)

      // Get card dimensions during drag
      const dragBounds = await ideaCard.boundingBox()
      const dragSize = {
        width: dragBounds?.width || 0,
        height: dragBounds?.height || 0
      }

      // End drag operation
      await page.mouse.up()
      await page.waitForTimeout(200)

      // Take screenshot after drag
      const afterDragScreenshot = `card-drag-after-${Date.now()}.png`
      await page.screenshot({
        path: afterDragScreenshot,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })
      testResult.evidence.push(afterDragScreenshot)

      // Validation: Card should maintain reasonable size during drag (not grow excessively)
      const sizeIncrease = (dragSize.width - initialSize.width) / initialSize.width
      const sizeReasonable = sizeIncrease < 0.2 // Less than 20% size increase during drag

      testResult.passed = sizeReasonable
      testResult.details = `Initial size: ${initialSize.width}x${initialSize.height}, Drag size: ${dragSize.width}x${dragSize.height}, Size increase: ${(sizeIncrease * 100).toFixed(1)}%`

      console.log(`✅ Issue #2 result: ${testResult.passed ? 'PASSED' : 'FAILED'} - ${testResult.details}`)

    } catch (error) {
      testResult.details = `Test error: ${error.message}`
      console.log(`❌ Issue #2 error: ${testResult.details}`)
    }

    testResults.push(testResult)
  })

  test('Issue #3: Collapsed card orientation during drag operations', async () => {
    console.log('🔍 Testing Issue #3: Collapsed card orientation during drag')

    const testResult: TestResult = {
      issue: 'Issue #3',
      description: 'Collapsed card orientation during drag operations',
      passed: false,
      evidence: [],
      details: ''
    }

    try {
      // Find a card to collapse and test
      const ideaCard = page.locator('.idea-card, [data-testid*="card"], .card').first()
      await expect(ideaCard).toBeVisible()

      // Ensure card is collapsed
      const isExpanded = await ideaCard.evaluate((el) =>
        !el.classList.contains('collapsed') && el.dataset.collapsed !== 'true'
      )

      if (isExpanded) {
        // Look for collapse button or click the card to collapse
        const collapseButton = page.locator('button:has-text("collapse"), [data-testid="collapse"], .collapse-btn').first()
        if (await collapseButton.isVisible({ timeout: 1000 })) {
          await collapseButton.click()
        } else {
          // Try double-click to collapse
          await ideaCard.dblclick()
        }
        await page.waitForTimeout(300)
      }

      // Get initial collapsed card dimensions
      const initialBounds = await ideaCard.boundingBox()
      const initialAspectRatio = (initialBounds?.width || 0) / (initialBounds?.height || 0)

      // Take screenshot before drag
      const beforeDragScreenshot = `collapsed-drag-before-${Date.now()}.png`
      await page.screenshot({
        path: beforeDragScreenshot,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })
      testResult.evidence.push(beforeDragScreenshot)

      // Start drag operation
      await ideaCard.hover()
      await page.mouse.down()

      // Move to trigger drag state
      await page.mouse.move(initialBounds?.x || 0 + 50, initialBounds?.y || 0 + 50)
      await page.waitForTimeout(200)

      // Take screenshot during drag
      const duringDragScreenshot = `collapsed-drag-during-${Date.now()}.png`
      await page.screenshot({
        path: duringDragScreenshot,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })
      testResult.evidence.push(duringDragScreenshot)

      // Get card dimensions during drag
      const dragBounds = await ideaCard.boundingBox()
      const dragAspectRatio = (dragBounds?.width || 0) / (dragBounds?.height || 0)

      // End drag operation
      await page.mouse.up()
      await page.waitForTimeout(200)

      // Take screenshot after drag
      const afterDragScreenshot = `collapsed-drag-after-${Date.now()}.png`
      await page.screenshot({
        path: afterDragScreenshot,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })
      testResult.evidence.push(afterDragScreenshot)

      // Validation: Collapsed card should maintain horizontal orientation (aspect ratio > 1)
      const maintainedOrientation = dragAspectRatio > 1 && Math.abs(dragAspectRatio - initialAspectRatio) < 0.5

      testResult.passed = maintainedOrientation
      testResult.details = `Initial aspect ratio: ${initialAspectRatio.toFixed(2)}, Drag aspect ratio: ${dragAspectRatio.toFixed(2)}, Maintained horizontal: ${maintainedOrientation}`

      console.log(`✅ Issue #3 result: ${testResult.passed ? 'PASSED' : 'FAILED'} - ${testResult.details}`)

    } catch (error) {
      testResult.details = `Test error: ${error.message}`
      console.log(`❌ Issue #3 error: ${testResult.details}`)
    }

    testResults.push(testResult)
  })

  test('Issue #4: Button positioning and hover state isolation', async () => {
    console.log('🔍 Testing Issue #4: Button positioning and hover state isolation')

    const testResult: TestResult = {
      issue: 'Issue #4',
      description: 'Button positioning and hover state isolation',
      passed: false,
      evidence: [],
      details: ''
    }

    try {
      // Find a card with buttons
      const ideaCard = page.locator('.idea-card, [data-testid*="card"], .card').first()
      await expect(ideaCard).toBeVisible()

      // Hover over the card to show buttons
      await ideaCard.hover()
      await page.waitForTimeout(300)

      // Take screenshot with buttons visible
      const buttonsVisibleScreenshot = `buttons-visible-${Date.now()}.png`
      await page.screenshot({
        path: buttonsVisibleScreenshot,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      })
      testResult.evidence.push(buttonsVisibleScreenshot)

      // Find button elements
      const deleteButton = page.locator('button:has-text("delete"), [data-testid*="delete"], .delete-btn, button:has([class*="trash"])').first()
      const minimizeButton = page.locator('button:has-text("minimize"), button:has-text("collapse"), [data-testid*="minimize"], [data-testid*="collapse"], .minimize-btn, .collapse-btn, button:has([class*="chevron"])').first()

      // Check if buttons are visible
      const deleteVisible = await deleteButton.isVisible({ timeout: 1000 })
      const minimizeVisible = await minimizeButton.isVisible({ timeout: 1000 })

      if (deleteVisible && minimizeVisible) {
        // Get button positions
        const deleteBounds = await deleteButton.boundingBox()
        const minimizeBounds = await minimizeButton.boundingBox()

        // Validation: Buttons should not overlap and should be in correct positions
        const buttonsNotOverlapping = Math.abs((deleteBounds?.x || 0) - (minimizeBounds?.x || 0)) > 10 ||
                                     Math.abs((deleteBounds?.y || 0) - (minimizeBounds?.y || 0)) > 10

        // Test button hover isolation
        await deleteButton.hover()
        await page.waitForTimeout(200)

        const deleteHoverScreenshot = `delete-hover-${Date.now()}.png`
        await page.screenshot({
          path: deleteHoverScreenshot,
          fullPage: false,
          clip: { x: 0, y: 0, width: 1200, height: 800 }
        })
        testResult.evidence.push(deleteHoverScreenshot)

        await minimizeButton.hover()
        await page.waitForTimeout(200)

        const minimizeHoverScreenshot = `minimize-hover-${Date.now()}.png`
        await page.screenshot({
          path: minimizeHoverScreenshot,
          fullPage: false,
          clip: { x: 0, y: 0, width: 1200, height: 800 }
        })
        testResult.evidence.push(minimizeHoverScreenshot)

        testResult.passed = buttonsNotOverlapping
        testResult.details = `Delete button: ${deleteBounds?.x},${deleteBounds?.y}, Minimize button: ${minimizeBounds?.x},${minimizeBounds?.y}, Not overlapping: ${buttonsNotOverlapping}`
      } else {
        testResult.details = `Buttons visibility - Delete: ${deleteVisible}, Minimize: ${minimizeVisible}`
        testResult.passed = false
      }

      console.log(`✅ Issue #4 result: ${testResult.passed ? 'PASSED' : 'FAILED'} - ${testResult.details}`)

    } catch (error) {
      testResult.details = `Test error: ${error.message}`
      console.log(`❌ Issue #4 error: ${testResult.details}`)
    }

    testResults.push(testResult)
  })

  test.afterAll(async () => {
    // Generate comprehensive validation report
    const reportContent = generateValidationReport(testResults)

    // Write report to file
    const fs = require('fs')
    const reportPath = 'visual-validation-results.json'
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      testResults,
      summary: {
        total: testResults.length,
        passed: testResults.filter(r => r.passed).length,
        failed: testResults.filter(r => !r.passed).length
      }
    }, null, 2))

    console.log('\n' + reportContent)
    console.log(`\n📋 Full report saved to: ${reportPath}`)
  })
})

function generateValidationReport(results: TestResult[]): string {
  const passed = results.filter(r => r.passed).length
  const total = results.length

  let report = `
🔍 CRITICAL VISUAL FIXES VALIDATION REPORT
=========================================

Summary: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)

`

  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED'
    report += `${index + 1}. ${result.issue}: ${result.description}
   Status: ${status}
   Details: ${result.details}
   Evidence: ${result.evidence.join(', ')}

`
  })

  report += `
🎯 OVERALL RESULT: ${passed === total ? 'ALL CRITICAL ISSUES FIXED' : 'SOME ISSUES REMAIN'}

Next Steps:
${passed === total ?
  '✅ All critical visual issues have been successfully resolved!' :
  `❌ ${total - passed} issue(s) still need attention. Review failed tests and evidence.`}
`

  return report
}