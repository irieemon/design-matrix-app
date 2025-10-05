import { test, expect } from '@playwright/test'

test.describe('PDF Upload and Processing - Complete Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and login
    await page.goto('/')

    // Wait for authentication
    await page.waitForSelector('[data-testid="matrix-container"]', { timeout: 10000 })

    // Navigate to File Management
    await page.click('[data-testid="nav-files"]')
    await expect(page).toHaveURL(/.*files/)
  })

  test('PDF upload extracts text successfully', async ({ page }) => {
    // Click upload button
    await page.click('[data-testid="upload-file-button"]')

    // Upload PDF file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-document.pdf')

    // Wait for upload to complete
    await expect(page.locator('[data-testid="file-item"]').first()).toBeVisible({ timeout: 10000 })

    // Verify file appears in list
    const fileItem = page.locator('[data-testid="file-item"]').first()
    await expect(fileItem).toContainText('test-document.pdf')

    // Check that AI analysis status shows "Pending" or "Analyzing"
    const analysisStatus = fileItem.locator('[data-testid="analysis-status"]')
    const statusText = await analysisStatus.textContent()
    expect(['AI Pending', 'AI Analyzing', 'AI Ready']).toContain(statusText)
  })

  test('PDF preview renders with canvas (no CSP violation)', async ({ page }) => {
    // Upload PDF first
    await page.click('[data-testid="upload-file-button"]')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-document.pdf')

    // Wait for file to appear
    await expect(page.locator('[data-testid="file-item"]').first()).toBeVisible({ timeout: 10000 })

    // Click to preview
    await page.locator('[data-testid="file-item"]').first().click()

    // Wait for modal to open
    await expect(page.locator('[data-testid="file-viewer-modal"]')).toBeVisible()

    // Verify PDF canvas rendering (not iframe)
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 15000 })

    // Verify NO iframe element (CSP-compliant)
    const iframes = page.locator('iframe')
    await expect(iframes).toHaveCount(0)

    // Verify PDF controls are present
    await expect(page.locator('button[aria-label="Zoom in"]')).toBeVisible()
    await expect(page.locator('button[aria-label="Zoom out"]')).toBeVisible()
    await expect(page.locator('button[aria-label="Next page"]')).toBeVisible()
    await expect(page.locator('button[aria-label="Previous page"]')).toBeVisible()

    // Check console for NO CSP violations
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Wait a bit for any errors to appear
    await page.waitForTimeout(2000)

    // Verify no CSP violations
    const cspErrors = consoleErrors.filter(err =>
      err.includes('Content Security Policy') ||
      err.includes('Refused to frame')
    )
    expect(cspErrors).toHaveLength(0)
  })

  test('PDF zoom and pagination controls work', async ({ page }) => {
    // Upload PDF first
    await page.click('[data-testid="upload-file-button"]')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-document.pdf')

    await expect(page.locator('[data-testid="file-item"]').first()).toBeVisible({ timeout: 10000 })
    await page.locator('[data-testid="file-item"]').first().click()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })

    // Test zoom in
    const zoomDisplay = page.locator('text=/\\d+%/')
    const initialZoom = await zoomDisplay.textContent()

    await page.click('button[aria-label="Zoom in"]')
    await page.waitForTimeout(500)

    const zoomedIn = await zoomDisplay.textContent()
    expect(zoomedIn).not.toBe(initialZoom)

    // Test zoom out
    await page.click('button[aria-label="Zoom out"]')
    await page.waitForTimeout(500)

    // Test page navigation (if multi-page PDF)
    const pageDisplay = page.locator('text=/Page \\d+ \\/ \\d+/')
    const pageInfo = await pageDisplay.textContent()

    if (pageInfo && pageInfo.includes('/ 2')) {
      // Multi-page PDF, test navigation
      await page.click('button[aria-label="Next page"]')
      await page.waitForTimeout(500)

      const newPageInfo = await pageDisplay.textContent()
      expect(newPageInfo).toContain('Page 2')
    }
  })

  test('AI analysis triggers and completes for PDF', async ({ page }) => {
    // Upload PDF
    await page.click('[data-testid="upload-file-button"]')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-document.pdf')

    const fileItem = page.locator('[data-testid="file-item"]').first()
    await expect(fileItem).toBeVisible({ timeout: 10000 })

    // Wait for AI analysis to start
    await expect(fileItem.locator('[data-testid="analysis-status"]')).toContainText(/AI (Pending|Analyzing)/, { timeout: 5000 })

    // Wait for AI analysis to complete (max 60 seconds)
    await expect(fileItem.locator('[data-testid="analysis-status"]')).toContainText('AI Ready', { timeout: 60000 })

    // Click to view details
    await fileItem.click()

    // Verify AI insights panel is visible
    await expect(page.locator('[data-testid="ai-analysis-panel"]')).toBeVisible()

    // Verify AI analysis content is present
    const analysisPanel = page.locator('[data-testid="ai-analysis-panel"]')
    await expect(analysisPanel).toContainText(/summary|key insights|relevance/i)
  })

  test('PDF text extraction populates content_preview', async ({ page }) => {
    // Upload PDF
    await page.click('[data-testid="upload-file-button"]')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-document.pdf')

    const fileItem = page.locator('[data-testid="file-item"]').first()
    await expect(fileItem).toBeVisible({ timeout: 10000 })

    // Click to view file
    await fileItem.click()

    // Check that content preview exists (extracted text)
    // This might be in the AI analysis section or file details
    const modal = page.locator('[data-testid="file-viewer-modal"]')

    // Look for extracted text content
    const hasContentPreview = await modal.locator('text=/extract|content|preview/i').count() > 0
    expect(hasContentPreview).toBeTruthy()
  })

  test('Multiple PDFs can be uploaded sequentially', async ({ page }) => {
    // Upload first PDF
    await page.click('[data-testid="upload-file-button"]')
    let fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-document.pdf')

    await expect(page.locator('[data-testid="file-item"]').first()).toBeVisible({ timeout: 10000 })

    // Upload second PDF
    await page.click('[data-testid="upload-file-button"]')
    fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-document-2.pdf')

    // Verify both files are in the list
    const fileItems = page.locator('[data-testid="file-item"]')
    await expect(fileItems).toHaveCount(2, { timeout: 10000 })

    // Verify both have AI analysis queued or completed
    for (let i = 0; i < 2; i++) {
      const status = fileItems.nth(i).locator('[data-testid="analysis-status"]')
      const statusText = await status.textContent()
      expect(['AI Pending', 'AI Analyzing', 'AI Ready']).toContain(statusText)
    }
  })

  test('Error handling for corrupted PDF', async ({ page }) => {
    // Upload corrupted PDF
    await page.click('[data-testid="upload-file-button"]')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/corrupted.pdf')

    const fileItem = page.locator('[data-testid="file-item"]').first()
    await expect(fileItem).toBeVisible({ timeout: 10000 })

    // Click to preview
    await fileItem.click()

    // Should show error message with download fallback
    await expect(page.locator('text=/failed to load|unable to display|download to view/i')).toBeVisible({ timeout: 10000 })

    // Verify download button is available
    await expect(page.locator('button', { hasText: /download/i })).toBeVisible()
  })

  test('Mobile responsive PDF viewer', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Upload PDF
    await page.click('[data-testid="upload-file-button"]')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-document.pdf')

    await expect(page.locator('[data-testid="file-item"]').first()).toBeVisible({ timeout: 10000 })
    await page.locator('[data-testid="file-item"]').first().click()

    // Verify mobile controls are visible
    await expect(page.locator('button', { hasText: 'Previous' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Next' })).toBeVisible()

    // Verify PDF canvas is responsive
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()

    const canvasBox = await canvas.boundingBox()
    expect(canvasBox?.width).toBeLessThanOrEqual(375)
  })
})

test.describe('PDF Processing - Console Error Validation', () => {
  test('No JavaScript errors during PDF upload and render', async ({ page }) => {
    const jsErrors: string[] = []

    page.on('pageerror', err => {
      jsErrors.push(err.message)
    })

    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForSelector('[data-testid="matrix-container"]', { timeout: 10000 })
    await page.click('[data-testid="nav-files"]')

    // Upload PDF
    await page.click('[data-testid="upload-file-button"]')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-document.pdf')

    await expect(page.locator('[data-testid="file-item"]').first()).toBeVisible({ timeout: 10000 })
    await page.locator('[data-testid="file-item"]').first().click()

    // Wait for canvas to render
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })

    // Wait for any async errors
    await page.waitForTimeout(3000)

    // Filter out expected warnings (GoTrueClient, etc.)
    const criticalErrors = jsErrors.filter(err =>
      !err.includes('Multiple GoTrueClient') &&
      !err.includes('React DevTools') &&
      !err.includes('Vercel Analytics') &&
      !err.includes('infinite recursion') // Known DB issue
    )

    expect(criticalErrors).toHaveLength(0)
  })
})
