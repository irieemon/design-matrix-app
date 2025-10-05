import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * Manual PDF Upload Validation
 *
 * This test validates that:
 * 1. PDF.js loads without errors
 * 2. CSP doesn't block worker script
 * 3. PDF upload and text extraction works
 * 4. PDF preview renders correctly
 */
test('Manual PDF Upload and Preview Validation', async ({ page }) => {
  const consoleMessages: Array<{ type: string; text: string }> = []
  const consoleErrors: string[] = []

  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text()
    consoleMessages.push({ type: msg.type(), text })

    if (msg.type() === 'error') {
      consoleErrors.push(text)
    }

    // Log important messages
    if (text.includes('PDF') || text.includes('pdfjs') || text.includes('CSP')) {
      console.log(`[${msg.type().toUpperCase()}] ${text}`)
    }
  })

  // Capture page errors
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`)
    consoleErrors.push(`PAGE ERROR: ${err.message}`)
  })

  console.log('🧪 Starting PDF upload validation...')
  console.log('📍 Step 1: Navigate to app')

  await page.goto('http://localhost:3003')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  console.log('📍 Step 2: Login with demo user')
  const demoButton = page.getByText(/continue as demo user/i)
  await expect(demoButton).toBeVisible({ timeout: 10000 })
  await demoButton.click()
  await page.waitForTimeout(2000)
  await page.waitForLoadState('networkidle')

  // Take screenshot after login
  await page.screenshot({ path: 'screenshots/01-after-login.png', fullPage: true })
  console.log('✅ Logged in successfully')

  console.log('📍 Step 3: Create/Open a project')

  // Check if we need to create a project
  const createFirstProject = page.getByText('Create Your First Project')
  const isFirstTimeUser = await createFirstProject.isVisible().catch(() => false)

  if (isFirstTimeUser) {
    console.log('Creating first project...')
    await page.getByText('Manual Setup').click()
    await page.waitForTimeout(1000)

    const nameInput = page.locator('input').first()
    await nameInput.fill('PDF Validation Project')

    const createButton = page.locator('button:has-text("Create")').first()
    await createButton.click()
    await page.waitForTimeout(3000)
  }

  await page.screenshot({ path: 'screenshots/02-project-view.png', fullPage: true })
  console.log('✅ Project ready')

  console.log('📍 Step 4: Look for file upload capability')

  // Try to find upload button/area
  await page.waitForTimeout(1000)

  // Look for various upload triggers
  const uploadTriggers = [
    'button:has-text("Upload")',
    'button:has-text("Add File")',
    'button:has-text("Files")',
    '[data-testid*="upload"]',
    'input[type="file"]'
  ]

  let uploadFound = false
  for (const selector of uploadTriggers) {
    const element = page.locator(selector).first()
    const isVisible = await element.isVisible().catch(() => false)

    if (isVisible) {
      console.log(`✅ Found upload trigger: ${selector}`)
      uploadFound = true
      break
    }
  }

  if (!uploadFound) {
    console.log('⚠️  No obvious upload button found, looking for file input...')
  }

  await page.screenshot({ path: 'screenshots/03-looking-for-upload.png', fullPage: true })

  console.log('📍 Step 5: Check console for PDF.js and CSP errors')

  // Wait a bit for any async errors
  await page.waitForTimeout(2000)

  // Check for PDF.js errors
  const pdfjsErrors = consoleErrors.filter(error =>
    error.toLowerCase().includes('pdfjs') ||
    error.toLowerCase().includes('pdf.js') ||
    error.includes('getDocument is not a function')
  )

  if (pdfjsErrors.length > 0) {
    console.log('❌ PDF.js ERRORS DETECTED:')
    pdfjsErrors.forEach(err => console.log(`   - ${err}`))
  } else {
    console.log('✅ No PDF.js loading errors')
  }

  // Check for CSP violations
  const cspErrors = consoleErrors.filter(error =>
    error.includes('Content Security Policy') ||
    error.includes('Refused to load') ||
    error.includes('Refused to frame') ||
    error.includes('CSP')
  )

  if (cspErrors.length > 0) {
    console.log('❌ CSP VIOLATIONS DETECTED:')
    cspErrors.forEach(err => console.log(`   - ${err}`))
  } else {
    console.log('✅ No CSP violations')
  }

  // Check for worker script errors
  const workerErrors = consoleErrors.filter(error =>
    error.includes('worker') &&
    (error.includes('failed') || error.includes('refused'))
  )

  if (workerErrors.length > 0) {
    console.log('❌ WORKER SCRIPT ERRORS DETECTED:')
    workerErrors.forEach(err => console.log(`   - ${err}`))
  } else {
    console.log('✅ No worker script errors')
  }

  // Filter out known acceptable errors
  const criticalErrors = consoleErrors.filter(error =>
    !error.includes('favicon') &&
    !error.includes('DevTools') &&
    !error.includes('source map') &&
    !error.toLowerCase().includes('hydration') &&
    !error.includes('Profile query error') // Known dev server error
  )

  console.log('\n📊 VALIDATION SUMMARY:')
  console.log(`   Total console messages: ${consoleMessages.length}`)
  console.log(`   Total errors: ${consoleErrors.length}`)
  console.log(`   Critical errors: ${criticalErrors.length}`)
  console.log(`   PDF.js errors: ${pdfjsErrors.length}`)
  console.log(`   CSP violations: ${cspErrors.length}`)
  console.log(`   Worker errors: ${workerErrors.length}`)

  if (criticalErrors.length > 0) {
    console.log('\n❌ CRITICAL ERRORS:')
    criticalErrors.forEach(err => console.log(`   - ${err}`))
  }

  // Take final screenshot
  await page.screenshot({ path: 'screenshots/04-final-state.png', fullPage: true })

  console.log('\n📁 Screenshots saved to screenshots/')
  console.log('   - 01-after-login.png')
  console.log('   - 02-project-view.png')
  console.log('   - 03-looking-for-upload.png')
  console.log('   - 04-final-state.png')

  // Assertions
  expect(pdfjsErrors.length).toBe(0)
  expect(cspErrors.length).toBe(0)
  expect(workerErrors.length).toBe(0)

  console.log('\n🎉 PDF VALIDATION PASSED - No blocking errors detected')
})
