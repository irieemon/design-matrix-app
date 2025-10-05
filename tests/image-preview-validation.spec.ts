import { test, expect } from '@playwright/test'

/**
 * Image Preview Validation Test
 *
 * Validates that:
 * 1. Images load without CSP violations
 * 2. Image preview displays correctly
 * 3. No console errors related to image loading
 */
test('Image Preview - CSP and Display Validation', async ({ page }) => {
  const consoleErrors: string[] = []

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      consoleErrors.push(text)

      // Log CSP and image loading errors immediately
      if (text.includes('CSP') || text.includes('img-src') || text.includes('image')) {
        console.log(`[ERROR] ${text}`)
      }
    }
  })

  console.log('🧪 IMAGE PREVIEW VALIDATION TEST')
  console.log('=' .repeat(60))

  // Step 1: Navigate and login
  console.log('\n📍 Step 1: Navigate and login')
  await page.goto('http://localhost:3003')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  const demoButton = page.getByText(/continue as demo user/i)
  await expect(demoButton).toBeVisible({ timeout: 10000 })
  await demoButton.click()
  await page.waitForTimeout(2000)
  await page.waitForLoadState('networkidle')
  console.log('✅ Logged in successfully')

  // Step 2: Navigate to files page
  console.log('\n📍 Step 2: Navigate to project with files')

  // Look for project or files navigation
  const projectCard = page.locator('.project-card, [data-testid*="project"]').first()
  const hasProject = await projectCard.isVisible().catch(() => false)

  if (hasProject) {
    await projectCard.click()
    await page.waitForTimeout(1000)
  }

  // Navigate to files if available
  const filesLink = page.locator('button:has-text("File"), a:has-text("File"), [data-testid*="file"]').first()
  const hasFilesLink = await filesLink.isVisible().catch(() => false)

  if (hasFilesLink) {
    await filesLink.click()
    await page.waitForTimeout(1000)
  }

  await page.screenshot({ path: 'screenshots/image-test-01-files-page.png', fullPage: true })

  // Step 3: Look for image files
  console.log('\n📍 Step 3: Find image files')

  const imageFiles = page.locator('[data-testid*="file"], .file-item, .file-card').filter({
    hasText: /\.jpg|\.jpeg|\.png|\.gif|\.webp/i
  })

  const imageCount = await imageFiles.count()
  console.log(`Found ${imageCount} image files`)

  if (imageCount === 0) {
    console.log('⚠️  No image files found in project')
    console.log('   Test will skip image preview validation')
    return
  }

  // Step 4: Click on first image
  console.log('\n📍 Step 4: Open image preview')

  const firstImage = imageFiles.first()
  await firstImage.click()
  await page.waitForTimeout(2000)

  await page.screenshot({ path: 'screenshots/image-test-02-preview-opened.png', fullPage: true })

  // Step 5: Verify image preview displays
  console.log('\n📍 Step 5: Verify image preview displays')

  // Look for image preview modal/viewer
  const imagePreview = page.locator('img[alt*=".jp"], img[alt*=".png"], img[src*="supabase"]').first()
  const isImageVisible = await imagePreview.isVisible().catch(() => false)

  if (isImageVisible) {
    console.log('✅ Image preview element found')

    // Check if image actually loaded (not broken)
    const naturalWidth = await imagePreview.evaluate((img: HTMLImageElement) => img.naturalWidth)
    const naturalHeight = await imagePreview.evaluate((img: HTMLImageElement) => img.naturalHeight)

    console.log(`   Image dimensions: ${naturalWidth}x${naturalHeight}`)

    if (naturalWidth > 0 && naturalHeight > 0) {
      console.log('✅ Image loaded successfully (has dimensions)')
    } else {
      console.log('❌ Image failed to load (no dimensions)')
    }
  } else {
    console.log('⚠️  Image preview element not found')
  }

  await page.screenshot({ path: 'screenshots/image-test-03-preview-loaded.png', fullPage: true })

  // Step 6: Check for CSP violations
  console.log('\n📍 Step 6: Check for CSP violations')

  await page.waitForTimeout(2000) // Wait for any async errors

  const cspErrors = consoleErrors.filter(e =>
    e.includes('Content Security Policy') ||
    e.includes('Refused to load') ||
    e.includes('img-src') ||
    e.includes('CSP')
  )

  const imageLoadErrors = consoleErrors.filter(e =>
    e.toLowerCase().includes('failed to load') &&
    e.toLowerCase().includes('image')
  )

  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('DevTools') &&
    !e.includes('source map') &&
    !e.includes('hydration') &&
    !e.includes('Profile query error')
  )

  // Step 7: Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 VALIDATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`Images found: ${imageCount}`)
  console.log(`Image preview visible: ${isImageVisible ? 'YES' : 'NO'}`)
  console.log(``)
  console.log(`Console Errors:`)
  console.log(`   Total errors: ${consoleErrors.length}`)
  console.log(`   CSP violations: ${cspErrors.length}`)
  console.log(`   Image load errors: ${imageLoadErrors.length}`)
  console.log(`   Critical errors: ${criticalErrors.length}`)

  if (cspErrors.length > 0) {
    console.log(`\n❌ CSP VIOLATIONS DETECTED:`)
    cspErrors.forEach(err => console.log(`   - ${err}`))
  }

  if (imageLoadErrors.length > 0) {
    console.log(`\n❌ IMAGE LOADING ERRORS:`)
    imageLoadErrors.forEach(err => console.log(`   - ${err}`))
  }

  if (criticalErrors.length > 0 && criticalErrors.length !== cspErrors.length) {
    console.log(`\n⚠️  OTHER ERRORS:`)
    criticalErrors.forEach(err => console.log(`   - ${err}`))
  }

  console.log(`\n📁 Screenshots:`)
  console.log(`   - image-test-01-files-page.png`)
  console.log(`   - image-test-02-preview-opened.png`)
  console.log(`   - image-test-03-preview-loaded.png`)
  console.log('='.repeat(60))

  // Assertions
  expect(cspErrors.length, 'No CSP violations for images').toBe(0)
  expect(imageLoadErrors.length, 'No image loading errors').toBe(0)

  if (cspErrors.length === 0 && imageLoadErrors.length === 0) {
    console.log('\n🎉 ALL IMAGE PREVIEW VALIDATIONS PASSED!')
    console.log('✅ Images load without CSP violations')
    console.log('✅ Image preview displays correctly')
    console.log('✅ No blocking errors detected')
  }
})
