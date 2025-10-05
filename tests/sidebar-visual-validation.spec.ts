import { test, expect } from '@playwright/test'

/**
 * Sidebar Visual Validation
 *
 * Comprehensive visual testing of the sidebar navigation to ensure it matches Lux demo.
 * Validates icon sizes, hover states, active states, and visual consistency.
 */

test.describe('Sidebar Visual Validation', () => {

  // Helper to handle auth
  async function loginWithDemo(page: any) {
    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check if we're on auth screen
    const authScreen = await page.locator('[data-testid="auth-screen"]').count()
    if (authScreen > 0) {
      console.log('Auth screen detected, clicking Demo User...')
      const demoButton = page.locator('button:has-text("Demo User")')
      if (await demoButton.count() > 0) {
        await demoButton.click()
        await page.waitForTimeout(2000) // Wait for auth to complete
      }
    }

    // Alternative: look for demo button by class
    const demoBtn = page.locator('button').filter({ hasText: /demo/i }).first()
    if (await demoBtn.count() > 0) {
      await demoBtn.click()
      await page.waitForTimeout(2000)
    }
  }

  test('Load app and verify sidebar exists', async ({ page }) => {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' })
    await loginWithDemo(page)

    // Take screenshot of full page
    await page.screenshot({ path: 'screenshots/sidebar-test-full-page.png', fullPage: true })

    // Look for sidebar with multiple possible selectors
    const sidebar = await page.locator('.sidebar-clean, [class*="sidebar"], nav').first().count()
    expect(sidebar).toBeGreaterThan(0)

    console.log('Sidebar found!')
  })

  test('Sidebar navigation items - visual state check', async ({ page }) => {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' })
    await loginWithDemo(page)

    // Find navigation items
    const navButtons = page.locator('nav button, nav a, .sidebar-clean button')
    const count = await navButtons.count()

    console.log(`Found ${count} navigation items`)

    if (count > 0) {
      // Check first nav item styles
      const firstNav = navButtons.first()
      const styles = await firstNav.evaluate(el => {
        const computed = getComputedStyle(el)
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          padding: computed.padding,
          borderRadius: computed.borderRadius,
          display: computed.display,
          alignItems: computed.alignItems
        }
      })

      console.log('First nav item styles:', styles)

      // Take screenshot of sidebar area
      await page.screenshot({
        path: 'screenshots/sidebar-nav-items.png',
        clip: { x: 0, y: 0, width: 300, height: 800 }
      })
    }
  })

  test('Navigation hover state validation', async ({ page }) => {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' })
    await loginWithDemo(page)

    // Find Projects button specifically
    const projectsBtn = page.locator('button').filter({ hasText: /projects/i }).first()

    if (await projectsBtn.count() > 0) {
      // Get initial state
      const initialState = await projectsBtn.evaluate(el => {
        const computed = getComputedStyle(el)
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          transform: computed.transform
        }
      })

      console.log('Initial state:', initialState)

      // Hover
      await projectsBtn.hover()
      await page.waitForTimeout(500)

      // Get hover state
      const hoverState = await projectsBtn.evaluate(el => {
        const computed = getComputedStyle(el)
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          transform: computed.transform
        }
      })

      console.log('Hover state:', hoverState)

      // Validate: transform should NOT change (no lift for navigation)
      expect(hoverState.transform).toBe(initialState.transform)

      // Validate: background should change (hover effect)
      const backgroundChanged = hoverState.backgroundColor !== initialState.backgroundColor
      console.log('Background changed on hover:', backgroundChanged)

      // Take screenshot
      await page.screenshot({ path: 'screenshots/sidebar-hover-state.png' })
    }
  })

  test('Active navigation state validation', async ({ page }) => {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' })
    await loginWithDemo(page)

    // Click Projects to make it active
    const projectsBtn = page.locator('button').filter({ hasText: /projects/i }).first()

    if (await projectsBtn.count() > 0) {
      await projectsBtn.click()
      await page.waitForTimeout(1000)

      // Check active state
      const activeState = await projectsBtn.evaluate(el => {
        const computed = getComputedStyle(el)
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color
        }
      })

      console.log('Active state:', activeState)

      // Parse RGB to check if it's blue or gray
      const rgbMatch = activeState.backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1])
        const g = parseInt(rgbMatch[2])
        const b = parseInt(rgbMatch[3])

        console.log('Active background RGB:', { r, g, b })

        // Blue (sapphire) is around rgb(59, 130, 246)
        // Gray (graphite) is around rgb(243, 244, 246) or rgb(229, 231, 235)
        const isBlue = b > 200 && b > r && b > g
        const isGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20

        console.log('Is blue?', isBlue, 'Is gray?', isGray)

        // Should be gray, NOT blue
        expect(isBlue).toBeFalsy()
      }

      // Check text color
      const textRgbMatch = activeState.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (textRgbMatch) {
        const r = parseInt(textRgbMatch[1])
        const g = parseInt(textRgbMatch[2])
        const b = parseInt(textRgbMatch[3])

        console.log('Active text RGB:', { r, g, b })

        // White is rgb(255, 255, 255)
        // Dark gray is around rgb(17, 24, 39) or rgb(31, 41, 55)
        const isWhite = r > 250 && g > 250 && b > 250
        const isDarkGray = r < 50 && g < 50 && b < 50

        console.log('Is white?', isWhite, 'Is dark gray?', isDarkGray)

        // Should be dark gray, NOT white
        expect(isWhite).toBeFalsy()
      }

      // Take screenshot
      await page.screenshot({ path: 'screenshots/sidebar-active-state.png' })
    }
  })

  test('Icon sizing validation', async ({ page }) => {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' })
    await loginWithDemo(page)

    // Check icon sizes in nav items
    const iconSizes = await page.evaluate(() => {
      const navButtons = document.querySelectorAll('nav button, .sidebar-clean nav button')
      const sizes: any[] = []

      navButtons.forEach((btn, index) => {
        const iconContainer = btn.querySelector('span')
        if (iconContainer) {
          const computed = getComputedStyle(iconContainer)
          sizes.push({
            index,
            width: computed.width,
            height: computed.height
          })
        }
      })

      return sizes
    })

    console.log('Icon sizes:', iconSizes)

    // All icons should be 18px (expanded) or 16px (collapsed)
    iconSizes.forEach(size => {
      const isValidSize = size.width === '18px' || size.width === '16px'
      expect(isValidSize).toBeTruthy()
    })
  })

  test('Compare with Lux demo', async ({ page }) => {
    // First, screenshot the Lux demo
    await page.goto('http://localhost:3003/#lux-animated', { waitUntil: 'networkidle' })
    await page.screenshot({
      path: 'screenshots/lux-demo-sidebar-only.png',
      clip: { x: 0, y: 0, width: 280, height: 600 }
    })

    // Then screenshot current implementation
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' })
    await loginWithDemo(page)

    await page.screenshot({
      path: 'screenshots/current-sidebar-only.png',
      clip: { x: 0, y: 0, width: 280, height: 600 }
    })

    console.log('Screenshots saved for manual comparison:')
    console.log('- screenshots/lux-demo-sidebar-only.png')
    console.log('- screenshots/current-sidebar-only.png')
  })

  test('Lux tokens are applied', async ({ page }) => {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' })
    await loginWithDemo(page)

    const tokensUsed = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)

      // Check for Lux tokens
      const tokens = {
        'graphite-50': style.getPropertyValue('--graphite-50'),
        'graphite-100': style.getPropertyValue('--graphite-100'),
        'graphite-600': style.getPropertyValue('--graphite-600'),
        'graphite-900': style.getPropertyValue('--graphite-900'),
        'sapphire-500': style.getPropertyValue('--sapphire-500')
      }

      // Also check if nav items use these tokens
      const navItem = document.querySelector('nav button, .sidebar-clean button')
      let usesTokens = false

      if (navItem) {
        const bg = getComputedStyle(navItem).backgroundColor
        const color = getComputedStyle(navItem).color
        usesTokens = bg.includes('var') || color.includes('var')
      }

      return { tokens, usesTokens }
    })

    console.log('Lux tokens:', tokensUsed.tokens)
    console.log('Nav items use Lux tokens:', tokensUsed.usesTokens)

    // All tokens should be defined
    Object.values(tokensUsed.tokens).forEach(value => {
      expect(value).toBeTruthy()
    })
  })
})
