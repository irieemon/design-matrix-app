import { test, expect } from '@playwright/test'

/**
 * Test page refresh with project URL parameter restoration
 *
 * This test validates that when a user refreshes a project-specific page
 * with a ?project= parameter, the page loads correctly without redirecting
 * to the Projects page.
 */

const TEST_PROJECT_ID = 'deade958-e26c-4c4b-99d6-8476c326427b'
const BASE_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:5173'

test.describe('Page Refresh with Project Restoration', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/`)

    // Wait for auth screen
    await page.waitForSelector('[data-testid="auth-screen"], [data-testid="app-layout"]', {
      timeout: 10000
    })

    // If auth screen is visible, login
    const authScreen = await page.locator('[data-testid="auth-screen"]').isVisible()
    if (authScreen) {
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'testpassword123')
      await page.click('button[type="submit"]')

      // Wait for app to load
      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 })
    }
  })

  test('Files page loads correctly on refresh', async ({ page }) => {
    const filesUrl = `${BASE_URL}/files?project=${TEST_PROJECT_ID}`

    console.log('🔄 Navigating to Files page:', filesUrl)
    await page.goto(filesUrl)

    // Wait for loading to complete
    await page.waitForTimeout(3000)

    // Take screenshot of current state
    await page.screenshot({
      path: 'tests/visual/files-page-screenshots/after-navigation.png',
      fullPage: true
    })

    // Check URL hasn't changed
    const currentUrl = page.url()
    console.log('📍 Current URL:', currentUrl)
    expect(currentUrl).toContain('/files')
    expect(currentUrl).toContain(`project=${TEST_PROJECT_ID}`)

    // Check we're on Files page, not Projects page
    const isFilesPage = await page.locator('text=File Management').isVisible()
    const isProjectsPage = await page.locator('text=Projects').and(page.locator('[data-testid="project-list"]')).isVisible()

    console.log('📄 Is Files Page:', isFilesPage)
    console.log('📋 Is Projects Page:', isProjectsPage)

    expect(isFilesPage).toBe(true)
    expect(isProjectsPage).toBe(false)

    // Now refresh the page
    console.log('🔄 Refreshing page...')
    await page.reload()

    // Wait for page to load after refresh
    await page.waitForTimeout(5000)

    // Take screenshot after refresh
    await page.screenshot({
      path: 'tests/visual/files-page-screenshots/after-refresh.png',
      fullPage: true
    })

    // Check URL still correct after refresh
    const urlAfterRefresh = page.url()
    console.log('📍 URL after refresh:', urlAfterRefresh)
    expect(urlAfterRefresh).toContain('/files')
    expect(urlAfterRefresh).toContain(`project=${TEST_PROJECT_ID}`)

    // Check we're still on Files page, not redirected to Projects
    const isFilesPageAfterRefresh = await page.locator('text=File Management').isVisible()
    const isProjectsPageAfterRefresh = await page.locator('text=Projects').and(page.locator('[data-testid="project-list"]')).isVisible()

    console.log('📄 Is Files Page after refresh:', isFilesPageAfterRefresh)
    console.log('📋 Is Projects Page after refresh:', isProjectsPageAfterRefresh)

    // CRITICAL ASSERTIONS
    expect(isFilesPageAfterRefresh, 'Should stay on Files page after refresh').toBe(true)
    expect(isProjectsPageAfterRefresh, 'Should NOT redirect to Projects page').toBe(false)
  })

  test('Roadmap page loads correctly on refresh', async ({ page }) => {
    const roadmapUrl = `${BASE_URL}/roadmap?project=${TEST_PROJECT_ID}`

    console.log('🔄 Navigating to Roadmap page:', roadmapUrl)
    await page.goto(roadmapUrl)

    await page.waitForTimeout(3000)

    const currentUrl = page.url()
    expect(currentUrl).toContain('/roadmap')
    expect(currentUrl).toContain(`project=${TEST_PROJECT_ID}`)

    console.log('🔄 Refreshing Roadmap page...')
    await page.reload()

    await page.waitForTimeout(5000)

    const urlAfterRefresh = page.url()
    console.log('📍 URL after refresh:', urlAfterRefresh)

    expect(urlAfterRefresh).toContain('/roadmap')
    expect(urlAfterRefresh).toContain(`project=${TEST_PROJECT_ID}`)

    // Check not redirected to Projects
    const isProjectsPage = await page.locator('[data-testid="project-list"]').isVisible()
    expect(isProjectsPage, 'Should NOT redirect to Projects page').toBe(false)
  })

  test('Direct URL access to Files page works', async ({ page, context }) => {
    // Create a new page to simulate direct URL access (no navigation history)
    const newPage = await context.newPage()

    const filesUrl = `${BASE_URL}/files?project=${TEST_PROJECT_ID}`
    console.log('🔗 Direct access to:', filesUrl)

    await newPage.goto(filesUrl)

    // Wait for initial auth/loading
    await newPage.waitForTimeout(5000)

    await newPage.screenshot({
      path: 'tests/visual/files-page-screenshots/direct-access.png',
      fullPage: true
    })

    const currentUrl = newPage.url()
    console.log('📍 URL after direct access:', currentUrl)

    expect(currentUrl).toContain('/files')
    expect(currentUrl).toContain(`project=${TEST_PROJECT_ID}`)

    const isFilesPage = await newPage.locator('text=File Management').isVisible()
    const isProjectsPage = await newPage.locator('[data-testid="project-list"]').isVisible()

    console.log('📄 Is Files Page:', isFilesPage)
    console.log('📋 Is Projects Page:', isProjectsPage)

    expect(isFilesPage, 'Should show Files page on direct access').toBe(true)
    expect(isProjectsPage, 'Should NOT show Projects page on direct access').toBe(false)

    await newPage.close()
  })

  test('Console logs during refresh', async ({ page }) => {
    const logs: string[] = []

    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('Project') || text.includes('restoration') || text.includes('redirect') || text.includes('page')) {
        logs.push(text)
        console.log('🖥️ CONSOLE:', text)
      }
    })

    const filesUrl = `${BASE_URL}/files?project=${TEST_PROJECT_ID}`

    console.log('🔄 Navigating to Files page:', filesUrl)
    await page.goto(filesUrl)
    await page.waitForTimeout(3000)

    console.log('🔄 Refreshing page...')
    await page.reload()
    await page.waitForTimeout(5000)

    console.log('\n📋 All captured logs:')
    logs.forEach(log => console.log('  -', log))

    // Check final URL
    const finalUrl = page.url()
    console.log('\n📍 Final URL:', finalUrl)

    expect(finalUrl).toContain('/files')
    expect(finalUrl).toContain(`project=${TEST_PROJECT_ID}`)
  })
})
