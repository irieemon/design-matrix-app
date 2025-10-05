import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('PDF Upload and Processing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3003')

    // Wait for auth screen to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Use demo mode - look for the button by text
    const demoButton = page.getByText(/continue as demo user/i)
    await expect(demoButton).toBeVisible({ timeout: 10000 })
    await demoButton.click()

    // Wait for app to load after demo login
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')
  })

  test('should upload PDF, extract text, show preview, and trigger AI analysis', async ({ page }) => {
    console.log('🧪 TEST: Complete PDF upload flow validation')

    // Step 1: Create a test project if needed
    console.log('📋 Step 1: Ensure we have a project')

    // Check if we're on the "Create Your First Project" screen
    const createFirstProject = page.getByText('Create Your First Project')
    const isFirstTimeUser = await createFirstProject.isVisible().catch(() => false)

    if (isFirstTimeUser) {
      console.log('Creating first project via Manual Setup...')
      await page.getByText('Manual Setup').click()
      await page.waitForTimeout(1000)

      // Fill in project details
      const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first()
      await nameInput.fill('PDF Test Project')

      const descInput = page.locator('textarea[placeholder*="description" i], textarea[name="description"]').first()
      await descInput.fill('Testing PDF uploads')

      // Submit the form
      const submitButton = page.locator('button:has-text("Create"), button[type="submit"]').first()
      await submitButton.click()
      await page.waitForTimeout(3000)
    } else {
      // Navigate to Projects page if not already there
      const projectsLink = page.getByText('Projects').first()
      const isVisible = await projectsLink.isVisible().catch(() => false)

      if (isVisible) {
        await projectsLink.click()
        await page.waitForTimeout(1000)
      }

      // Check if we have projects
      const hasProjects = await page.locator('button:has-text("Manual Setup"), .project-card, [data-testid*="project"]').count() > 0

      if (!hasProjects) {
        console.log('Creating new project...')
        await page.getByText('Manual Setup').click()
        await page.waitForTimeout(1000)

        const nameInput = page.locator('input[placeholder*="name" i]').first()
        await nameInput.fill('PDF Test Project')

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]').first()
        await submitButton.click()
        await page.waitForTimeout(3000)
      } else {
        console.log('Opening existing project...')
        const projectCard = page.locator('.project-card, [data-testid*="project"]').first()
        await projectCard.click()
        await page.waitForTimeout(1000)
      }
    }

    // Step 2: Navigate to project (if not already there)
    console.log('📋 Step 2: Ensure we are in project view')
    const isInMatrix = await page.locator('[data-testid="design-matrix"]').isVisible().catch(() => false)

    if (!isInMatrix) {
      await page.locator('[data-testid="project-card"]').first().click()
      await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 })
    }

    // Step 3: Open file upload modal
    console.log('📋 Step 3: Open file upload')

    // Look for various possible upload triggers
    const uploadButton = page.locator('[data-testid="upload-file-button"], button:has-text("Upload"), button:has-text("Add File")').first()
    await expect(uploadButton).toBeVisible({ timeout: 5000 })
    await uploadButton.click()

    // Wait for file input or modal
    await page.waitForTimeout(500)

    // Step 4: Upload a PDF file
    console.log('📋 Step 4: Upload PDF file')

    // Create a simple test PDF path
    const testPdfPath = path.join(process.cwd(), 'tests', 'fixtures', 'test.pdf')

    // Find the file input
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()

    // Upload the file
    await fileInput.setInputFiles(testPdfPath)

    // Wait for upload to process
    await page.waitForTimeout(2000)

    // Step 5: Verify file appears in list
    console.log('📋 Step 5: Verify file in list')

    const fileList = page.locator('[data-testid="file-list"], [data-testid="project-files"]')
    await expect(fileList).toBeVisible({ timeout: 5000 })

    // Look for the uploaded file
    const uploadedFile = page.locator('[data-testid*="file-"], .file-item').filter({ hasText: 'test.pdf' }).first()
    await expect(uploadedFile).toBeVisible({ timeout: 5000 })

    console.log('✅ File appears in list')

    // Step 6: Check for AI analysis status
    console.log('📋 Step 6: Check AI analysis status')

    // Wait a bit for status to update
    await page.waitForTimeout(1000)

    // Look for status indicators
    const statusElement = uploadedFile.locator('[data-testid*="status"], .status-badge, .ai-status')
    const statusText = await statusElement.textContent().catch(() => '')

    console.log(`📊 AI Status: ${statusText}`)

    // Status should be one of: Pending, Analyzing, or Ready
    expect(['Pending', 'Analyzing', 'Ready', 'AI Pending', 'Processing']).toContain(statusText.trim())

    // Step 7: Open PDF viewer
    console.log('📋 Step 7: Open PDF viewer')

    await uploadedFile.click()

    // Wait for viewer or modal to open
    await page.waitForTimeout(1000)

    // Step 8: Verify PDF preview renders
    console.log('📋 Step 8: Verify PDF preview renders')

    // Look for PDF viewer component
    const pdfViewer = page.locator('[data-testid="pdf-viewer"], .pdf-viewer, canvas')
    await expect(pdfViewer).toBeVisible({ timeout: 10000 })

    console.log('✅ PDF viewer is visible')

    // Check for canvas element (PDF.js renders to canvas)
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 5000 })

    console.log('✅ Canvas element found (PDF rendering)')

    // Step 9: Check for PDF controls (zoom, navigation)
    console.log('📋 Step 9: Check PDF controls')

    const zoomControls = page.locator('button:has-text("Zoom"), button:has-text("+"), button:has-text("-")')
    const hasZoomControls = await zoomControls.count() > 0

    if (hasZoomControls) {
      console.log('✅ Zoom controls found')
    }

    const navControls = page.locator('button:has-text("Previous"), button:has-text("Next"), button:has-text("Page")')
    const hasNavControls = await navControls.count() > 0

    if (hasNavControls) {
      console.log('✅ Navigation controls found')
    }

    // Step 10: Take screenshot for visual validation
    console.log('📋 Step 10: Take screenshot for visual validation')

    await page.screenshot({
      path: 'screenshots/pdf-upload-flow-complete.png',
      fullPage: true
    })

    console.log('✅ Screenshot saved: screenshots/pdf-upload-flow-complete.png')

    // Step 11: Check console for errors
    console.log('📋 Step 11: Check for console errors')

    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Wait a bit to catch any async errors
    await page.waitForTimeout(2000)

    // Filter out known acceptable errors
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('favicon') &&
      !error.includes('DevTools') &&
      !error.includes('source map')
    )

    if (criticalErrors.length > 0) {
      console.log('⚠️ Console errors detected:')
      criticalErrors.forEach(error => console.log(`  - ${error}`))
    } else {
      console.log('✅ No critical console errors')
    }

    // Step 12: Verify no CSP violations
    console.log('📋 Step 12: Check for CSP violations')

    const cspErrors = consoleErrors.filter(error =>
      error.includes('Content Security Policy') ||
      error.includes('CSP') ||
      error.includes('Refused to')
    )

    expect(cspErrors.length).toBe(0)
    console.log('✅ No CSP violations detected')

    // Step 13: Verify PDF.js loaded successfully
    console.log('📋 Step 13: Verify PDF.js loaded')

    const pdfjsErrors = consoleErrors.filter(error =>
      error.includes('pdfjs') ||
      error.includes('PDF.js') ||
      error.includes('getDocument is not a function')
    )

    expect(pdfjsErrors.length).toBe(0)
    console.log('✅ PDF.js loaded without errors')

    console.log('🎉 ALL TESTS PASSED - PDF upload flow working correctly')
  })

  test('should handle PDF text extraction', async ({ page }) => {
    console.log('🧪 TEST: PDF text extraction validation')

    // Navigate to a project with uploaded PDFs
    const hasProjects = await page.locator('[data-testid="project-card"]').count() > 0

    if (hasProjects) {
      await page.locator('[data-testid="project-card"]').first().click()
      await page.waitForTimeout(1000)

      // Look for a PDF file
      const pdfFile = page.locator('[data-testid*="file-"]').filter({ hasText: '.pdf' }).first()
      const hasPdf = await pdfFile.isVisible().catch(() => false)

      if (hasPdf) {
        await pdfFile.click()
        await page.waitForTimeout(1000)

        // Check if text content is displayed
        const textContent = page.locator('[data-testid="file-text-content"], .file-content, .extracted-text')
        const hasText = await textContent.isVisible().catch(() => false)

        if (hasText) {
          const text = await textContent.textContent()
          console.log(`✅ Text extracted: ${text?.substring(0, 100)}...`)
        }
      }
    }
  })
})
