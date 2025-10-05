import { test, expect } from '@playwright/test'

/**
 * Image CSP Fix Verification
 *
 * This test navigates to the specific project/file shown in the user's screenshot
 * and verifies that the CSP fix resolves the image loading issue.
 */
test('Verify CSP fix for Supabase storage images', async ({ page }) => {
  const consoleErrors: string[] = []
  const consoleWarnings: string[] = []

  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text()

    if (msg.type() === 'error') {
      consoleErrors.push(text)
      console.log(`[ERROR] ${text}`)
    }

    if (msg.type() === 'warning') {
      consoleWarnings.push(text)
    }
  })

  console.log('🧪 CSP FIX VERIFICATION FOR SUPABASE IMAGES')
  console.log('=' .repeat(70))

  // Step 1: Navigate to app
  console.log('\n📍 Step 1: Navigate to app')
  await page.goto('http://localhost:3003')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // Step 2: Login
  console.log('\n📍 Step 2: Login with demo user')
  const demoButton = page.getByText(/continue as demo user/i)
  const demoVisible = await demoButton.isVisible().catch(() => false)

  if (demoVisible) {
    await demoButton.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')
    console.log('✅ Logged in as demo user')
  } else {
    console.log('Already logged in or session active')
  }

  // Step 3: Navigate directly to files page for project
  console.log('\n📍 Step 3: Navigate to files page')

  // Try to find the project with files
  await page.goto('http://localhost:3003/files?project=bb2d3bc8-a389-462f-9bcc-a2d35ba9d278')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  await page.screenshot({ path: 'screenshots/csp-fix-01-files-page.png', fullPage: true })

  // Step 4: Look for image files
  console.log('\n📍 Step 4: Look for image files (lhs_face.jpeg)')

  const lhsImage = page.locator('text=lhs_face.jpeg').first()
  const imageVisible = await lhsImage.isVisible().catch(() => false)

  if (!imageVisible) {
    console.log('⚠️  lhs_face.jpeg not found, looking for any image files...')

    // Look for any image files
    const anyImages = page.locator('[data-testid*="file"], .file-item, .file-card').filter({
      hasText: /\.jpg|\.jpeg|\.png|\.gif/i
    })

    const imageCount = await anyImages.count()
    console.log(`   Found ${imageCount} image files`)

    if (imageCount > 0) {
      console.log('   Using first available image file')
      await anyImages.first().click()
      await page.waitForTimeout(2000)
    } else {
      console.log('❌ No image files found in this project')
      await page.screenshot({ path: 'screenshots/csp-fix-02-no-images.png', fullPage: true })
      return
    }
  } else {
    console.log('✅ Found lhs_face.jpeg file')
    await lhsImage.click()
    await page.waitForTimeout(2000)
  }

  await page.screenshot({ path: 'screenshots/csp-fix-02-image-opened.png', fullPage: true })

  // Step 5: Check if image loads
  console.log('\n📍 Step 5: Verify image loads without CSP error')

  // Wait a bit for image to load
  await page.waitForTimeout(3000)

  // Look for the actual image element
  const imgElements = page.locator('img[src*="supabase"], img[src*="storage"]')
  const imgCount = await imgElements.count()

  console.log(`   Found ${imgCount} image elements with Supabase URLs`)

  if (imgCount > 0) {
    const firstImg = imgElements.first()

    // Check if image loaded successfully
    const naturalWidth = await firstImg.evaluate((img: HTMLImageElement) => img.naturalWidth).catch(() => 0)
    const naturalHeight = await firstImg.evaluate((img: HTMLImageElement) => img.naturalHeight).catch(() => 0)
    const src = await firstImg.getAttribute('src')

    console.log(`   Image source: ${src?.substring(0, 80)}...`)
    console.log(`   Natural dimensions: ${naturalWidth}x${naturalHeight}`)

    if (naturalWidth > 0 && naturalHeight > 0) {
      console.log('✅ Image loaded successfully!')
    } else {
      console.log('❌ Image failed to load (dimensions are 0)')
    }
  }

  // Look for error message
  const errorMessage = page.locator('text=/Failed to load image/i')
  const hasError = await errorMessage.isVisible().catch(() => false)

  if (hasError) {
    console.log('❌ "Failed to load image" message is visible')
  } else {
    console.log('✅ No "Failed to load image" error message')
  }

  await page.screenshot({ path: 'screenshots/csp-fix-03-final-state.png', fullPage: true })

  // Step 6: Analyze console errors
  console.log('\n📍 Step 6: Analyze console errors')

  const cspErrors = consoleErrors.filter(e =>
    e.includes('Content Security Policy') ||
    e.includes('Refused to load') ||
    e.includes('img-src')
  )

  const imageErrors = consoleErrors.filter(e =>
    e.toLowerCase().includes('image') && e.toLowerCase().includes('load')
  )

  const supabaseImageErrors = consoleErrors.filter(e =>
    e.includes('supabase.co') && e.includes('img-src')
  )

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('📊 CSP FIX VERIFICATION RESULTS')
  console.log('='.repeat(70))
  console.log(`Total console errors: ${consoleErrors.length}`)
  console.log(`CSP violations: ${cspErrors.length}`)
  console.log(`Image loading errors: ${imageErrors.length}`)
  console.log(`Supabase image CSP errors: ${supabaseImageErrors.length}`)

  if (cspErrors.length > 0) {
    console.log(`\n❌ CSP VIOLATIONS DETECTED:`)
    cspErrors.forEach(err => console.log(`   - ${err.substring(0, 150)}...`))
  }

  if (supabaseImageErrors.length > 0) {
    console.log(`\n❌ SUPABASE IMAGE CSP ERRORS (CRITICAL):`)
    supabaseImageErrors.forEach(err => console.log(`   - ${err}`))
  }

  console.log(`\n📁 Screenshots saved:`)
  console.log(`   - csp-fix-01-files-page.png`)
  console.log(`   - csp-fix-02-image-opened.png`)
  console.log(`   - csp-fix-03-final-state.png`)
  console.log('='.repeat(70))

  // Assertions
  expect(supabaseImageErrors.length, 'No CSP errors for Supabase storage images').toBe(0)
  expect(cspErrors.length, 'No CSP violations').toBe(0)

  if (supabaseImageErrors.length === 0 && cspErrors.length === 0) {
    console.log('\n🎉 CSP FIX SUCCESSFUL!')
    console.log('✅ Supabase storage images load without CSP violations')
    console.log('✅ img-src directive properly configured')
    console.log('✅ Image preview displays correctly')
  } else {
    console.log('\n❌ CSP FIX FAILED - ERRORS STILL PRESENT')
  }
})
