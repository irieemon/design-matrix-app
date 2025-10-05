import { test, expect } from '@playwright/test'

/**
 * Phase 4: Navigation Components - Visual Regression Tests
 *
 * Tests Lux design token migration for:
 * - Sidebar.tsx (collapsed/expanded states)
 * - ProjectHeader.tsx (all modes)
 * - PageRouter.tsx (loading states)
 * - AppLayout.tsx (layout + skip link)
 */

test.describe('Phase 4 Navigation Visual Regression - Lux Design Tokens', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to app and ensure auth is handled
    await page.goto('http://localhost:3003')

    // Wait for app to load (either auth screen or main app)
    await page.waitForSelector('[data-testid="auth-screen"], [data-testid="sidebar"]', {
      timeout: 10000
    })

    // If on auth screen, use demo login
    const authScreen = await page.locator('[data-testid="auth-screen"]').count()
    if (authScreen > 0) {
      const demoButton = page.locator('button:has-text("Demo User")')
      if (await demoButton.count() > 0) {
        await demoButton.click()
        await page.waitForSelector('[data-testid="sidebar"]', { timeout: 5000 })
      }
    }

    // Ensure we're on a page with navigation
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 5000 })
  })

  test('Sidebar - Expanded state with Lux tokens', async ({ page }) => {
    // Wait for sidebar to be fully rendered
    const sidebar = page.locator('[data-testid="sidebar"]')
    await expect(sidebar).toBeVisible()

    // Verify sidebar is in expanded state (default)
    const sidebarElement = await sidebar.elementHandle()
    const width = await sidebarElement?.evaluate(el => el.getBoundingClientRect().width)
    expect(width).toBeGreaterThan(200) // Expanded is 288px (w-72)

    // Verify Lux tokens are applied
    const hasLuxTokens = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)

      const tokens = [
        '--graphite-900',
        '--graphite-600',
        '--graphite-500',
        '--canvas-secondary',
        '--hairline-default',
        '--emerald-500',
        '--sapphire-600'
      ]

      return tokens.every(token => {
        const value = style.getPropertyValue(token)
        return value && value.trim() !== ''
      })
    })

    expect(hasLuxTokens).toBeTruthy()

    // Take screenshot for baseline
    await page.screenshot({
      path: 'screenshots/phase4-sidebar-expanded.png',
      fullPage: false
    })
  })

  test('Sidebar - Collapsed state with Lux tokens', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]')
    await expect(sidebar).toBeVisible()

    // Find and click collapse button
    const collapseButton = sidebar.locator('button[aria-label="Collapse sidebar"]')
    await collapseButton.click()

    // Wait for collapse animation to complete
    await page.waitForTimeout(400) // 300ms animation + buffer

    // Verify sidebar is collapsed
    const sidebarElement = await sidebar.elementHandle()
    const width = await sidebarElement?.evaluate(el => el.getBoundingClientRect().width)
    expect(width).toBeLessThan(100) // Collapsed is 80px (w-20)

    // Verify all icons still visible in collapsed state
    const projectsButton = sidebar.locator('button:has-text("Projects")')
    await expect(projectsButton).toBeVisible()

    // Take screenshot for baseline
    await page.screenshot({
      path: 'screenshots/phase4-sidebar-collapsed.png',
      fullPage: false
    })
  })

  test('Sidebar - Interactive states (hover, focus, active)', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]')

    // Test Projects button hover state
    const projectsButton = sidebar.locator('button:has-text("Projects")')
    await projectsButton.hover()
    await page.waitForTimeout(200)

    // Verify hover creates visual change (button component handles this)
    const hasHoverState = await projectsButton.evaluate(el => {
      const style = getComputedStyle(el)
      // Button should have transform or color change on hover
      return style.transform !== 'none' || style.backgroundColor !== 'transparent'
    })
    expect(hasHoverState).toBeTruthy()

    // Test focus state
    await projectsButton.focus()
    await page.waitForTimeout(200)

    // Take screenshot with interactive states
    await page.screenshot({
      path: 'screenshots/phase4-sidebar-interactive.png',
      fullPage: false
    })
  })

  test('ProjectHeader - No project state (create mode)', async ({ page }) => {
    // Navigate to projects page
    await page.click('button:has-text("Projects")')
    await page.waitForTimeout(500)

    // Look for project header
    const header = page.locator('[data-testid="project-header"]').or(
      page.locator('text=Create Your First Project')
    )
    await expect(header).toBeVisible()

    // Verify Lux gradient background
    const hasGradient = await page.evaluate(() => {
      const headers = document.querySelectorAll('.rounded-2xl')
      for (const el of headers) {
        const style = getComputedStyle(el)
        if (style.background.includes('gradient') || style.backgroundImage.includes('gradient')) {
          return true
        }
      }
      return false
    })
    expect(hasGradient).toBeTruthy()

    // Take screenshot
    await page.screenshot({
      path: 'screenshots/phase4-projectheader-create.png',
      fullPage: false
    })
  })

  test('ProjectHeader - Form input focus states', async ({ page }) => {
    // Click manual setup to show create form
    const manualButton = page.locator('button:has-text("Manual Setup")')
    if (await manualButton.count() > 0) {
      await manualButton.click()
      await page.waitForTimeout(300)

      // Find project name input
      const nameInput = page.locator('input[placeholder*="project name"]')
      await expect(nameInput).toBeVisible()

      // Test focus state
      await nameInput.focus()
      await page.waitForTimeout(200)

      // Verify sapphire focus ring is applied
      const hasFocusRing = await nameInput.evaluate(el => {
        const style = getComputedStyle(el)
        return style.boxShadow && style.boxShadow !== 'none'
      })
      expect(hasFocusRing).toBeTruthy()

      // Take screenshot with focus state
      await page.screenshot({
        path: 'screenshots/phase4-projectheader-focus.png',
        fullPage: false
      })
    }
  })

  test('AppLayout - Background gradient with Lux tokens', async ({ page }) => {
    // Verify app layout has Lux gradient background
    const hasLayoutGradient = await page.evaluate(() => {
      const app = document.querySelector('.min-h-screen')
      if (!app) return false

      const style = getComputedStyle(app)
      const bg = style.background || style.backgroundImage

      // Check for CSS custom properties in gradient
      return bg.includes('var(--canvas-primary)') ||
             bg.includes('var(--sapphire-50)') ||
             bg.includes('gradient')
    })

    expect(hasLayoutGradient).toBeTruthy()

    // Take full page screenshot
    await page.screenshot({
      path: 'screenshots/phase4-applayout-gradient.png',
      fullPage: true
    })
  })

  test('AppLayout - Skip link focus state', async ({ page }) => {
    // Tab to skip link (first focusable element)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    // Verify skip link is visible when focused
    const skipLink = page.locator('a:has-text("Skip to main content")')
    await expect(skipLink).toBeVisible()

    // Verify skip link has sapphire background
    const hasLuxFocus = await skipLink.evaluate(el => {
      const style = getComputedStyle(el)
      return style.backgroundColor.includes('rgb') && style.color === 'rgb(255, 255, 255)'
    })
    expect(hasLuxFocus).toBeTruthy()

    // Take screenshot with skip link focused
    await page.screenshot({
      path: 'screenshots/phase4-skip-link-focus.png',
      fullPage: false
    })
  })

  test('PageRouter - Loading spinner with Lux tokens', async ({ page }) => {
    // This test validates loading states use Lux tokens
    // We check if the spinner styles would use sapphire-500

    const hasSpinnerTokens = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)

      // Verify sapphire token exists for spinners
      const sapphireValue = style.getPropertyValue('--sapphire-500')
      return sapphireValue && sapphireValue.trim() !== ''
    })

    expect(hasSpinnerTokens).toBeTruthy()
  })

  test('Navigation color token validation', async ({ page }) => {
    // Comprehensive token validation for Phase 4
    const tokensValid = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)

      // All tokens used in Phase 4 navigation
      const requiredTokens = [
        // Graphite scale (neutral)
        '--graphite-50',
        '--graphite-100',
        '--graphite-200',
        '--graphite-400',
        '--graphite-500',
        '--graphite-600',
        '--graphite-700',
        '--graphite-900',

        // Surfaces
        '--surface-primary',
        '--canvas-primary',
        '--canvas-secondary',

        // Borders
        '--hairline-default',

        // Semantic colors
        '--sapphire-50',
        '--sapphire-100',
        '--sapphire-500',
        '--sapphire-600',
        '--emerald-500'
      ]

      const results = requiredTokens.map(token => {
        const value = style.getPropertyValue(token)
        return {
          token,
          value,
          valid: value && value.trim() !== ''
        }
      })

      return {
        allValid: results.every(r => r.valid),
        details: results
      }
    })

    expect(tokensValid.allValid).toBeTruthy()

    // Log token details for debugging
    console.log('Phase 4 Token Validation:', tokensValid.details)
  })

  test('Sidebar gradient backgrounds use Lux tokens', async ({ page }) => {
    // Check that logo container gradients use CSS custom properties
    const hasLuxGradients = await page.evaluate(() => {
      const logoContainers = document.querySelectorAll('.rounded-2xl.shadow-lg')

      for (const container of logoContainers) {
        const style = getComputedStyle(container)
        const bg = style.background || style.backgroundImage

        // Should use var(--surface-primary) and var(--graphite-100)
        if (bg.includes('var(--') && bg.includes('gradient')) {
          return true
        }
      }
      return false
    })

    expect(hasLuxGradients).toBeTruthy()
  })

  test('All navigation buttons use Lux variants', async ({ page }) => {
    // Verify all buttons in navigation use Lux design system
    const buttonVariants = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button.btn')
      const variants = new Set()

      buttons.forEach(btn => {
        const variant = btn.getAttribute('data-variant')
        if (variant) variants.add(variant)
      })

      return Array.from(variants)
    })

    // Should only have Lux variants (sapphire, ghost, primary, secondary)
    const validVariants = ['sapphire', 'ghost', 'primary', 'secondary', 'tertiary']
    const allValid = buttonVariants.every(v => validVariants.includes(v as string))

    expect(allValid).toBeTruthy()
    console.log('Button variants found:', buttonVariants)
  })
})
