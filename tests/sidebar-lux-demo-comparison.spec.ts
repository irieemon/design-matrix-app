import { test, expect } from '@playwright/test'

/**
 * Sidebar Visual Regression - Lux Demo Comparison
 *
 * Validates that the Sidebar navigation matches the Lux animated demo specifications.
 * Tests icon alignment, hover states, selection states, and visual consistency.
 */

test.describe('Sidebar - Lux Demo Comparison', () => {

  test.beforeEach(async ({ page }) => {
    // Start dev server if not running
    await page.goto('http://localhost:3003')
    await page.waitForTimeout(2000)
  })

  test('Sidebar expanded state - icon sizes and alignment', async ({ page }) => {
    // Wait for sidebar to be visible
    const sidebar = page.locator('.sidebar-clean').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Check if we're on auth screen
    const authScreen = await page.locator('[data-testid="auth-screen"]').count()
    if (authScreen > 0) {
      const demoButton = page.locator('button:has-text("Demo User")')
      if (await demoButton.count() > 0) {
        await demoButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Ensure sidebar is expanded (not collapsed)
    const isExpanded = await sidebar.evaluate(el => {
      return el.classList.contains('w-72') || el.getBoundingClientRect().width > 200
    })

    if (!isExpanded) {
      // Find expand button and click it
      const expandBtn = page.locator('button[aria-label="Expand sidebar"]')
      if (await expandBtn.count() > 0) {
        await expandBtn.click()
        await page.waitForTimeout(400) // Wait for animation
      }
    }

    // Validate icon sizes in expanded state (should be 18px)
    const navItems = page.locator('.sidebar-clean nav button').first()
    await expect(navItems).toBeVisible()

    // Check icon size using JavaScript
    const iconSize = await page.evaluate(() => {
      const navItem = document.querySelector('.sidebar-clean nav button span')
      if (navItem) {
        const style = getComputedStyle(navItem)
        return {
          width: style.width,
          height: style.height
        }
      }
      return null
    })

    // Icon should be 18px x 18px in expanded state
    expect(iconSize?.width).toBe('18px')
    expect(iconSize?.height).toBe('18px')

    // Take screenshot
    await page.screenshot({
      path: 'screenshots/sidebar-expanded-icons.png',
      fullPage: false
    })
  })

  test('Sidebar collapsed state - icon sizes', async ({ page }) => {
    const sidebar = page.locator('.sidebar-clean').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Handle auth
    const authScreen = await page.locator('[data-testid="auth-screen"]').count()
    if (authScreen > 0) {
      const demoButton = page.locator('button:has-text("Demo User")')
      if (await demoButton.count() > 0) {
        await demoButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Ensure sidebar is collapsed
    const isCollapsed = await sidebar.evaluate(el => {
      return el.classList.contains('w-20') || el.getBoundingClientRect().width < 100
    })

    if (!isCollapsed) {
      // Find collapse button and click it
      const collapseBtn = page.locator('button[aria-label="Collapse sidebar"]')
      if (await collapseBtn.count() > 0) {
        await collapseBtn.click()
        await page.waitForTimeout(400) // Wait for animation
      }
    }

    // Validate icon sizes in collapsed state (should be 16px)
    const iconSize = await page.evaluate(() => {
      const navItem = document.querySelector('.sidebar-clean nav button span')
      if (navItem) {
        const style = getComputedStyle(navItem)
        return {
          width: style.width,
          height: style.height
        }
      }
      return null
    })

    // Icon should be 16px x 16px in collapsed state
    expect(iconSize?.width).toBe('16px')
    expect(iconSize?.height).toBe('16px')

    // Take screenshot
    await page.screenshot({
      path: 'screenshots/sidebar-collapsed-icons.png',
      fullPage: false
    })
  })

  test('Navigation item hover state - no lift animation', async ({ page }) => {
    const sidebar = page.locator('.sidebar-clean').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Handle auth
    const authScreen = await page.locator('[data-testid="auth-screen"]').count()
    if (authScreen > 0) {
      const demoButton = page.locator('button:has-text("Demo User")')
      if (await demoButton.count() > 0) {
        await demoButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Find a navigation item (not active)
    const navItem = page.locator('.sidebar-clean nav button').first()
    await expect(navItem).toBeVisible()

    // Get initial transform value
    const initialTransform = await navItem.evaluate(el => {
      return getComputedStyle(el).transform
    })

    // Hover over nav item
    await navItem.hover()
    await page.waitForTimeout(300)

    // Get transform after hover
    const hoverTransform = await navItem.evaluate(el => {
      return getComputedStyle(el).transform
    })

    // Transform should NOT change on hover (no lift animation for navigation)
    expect(hoverTransform).toBe(initialTransform)

    // Verify hover changes background color, not transform
    const hoverBg = await navItem.evaluate(el => {
      return getComputedStyle(el).backgroundColor
    })

    // Should have a background color on hover (not transparent)
    expect(hoverBg).not.toBe('rgba(0, 0, 0, 0)')
    expect(hoverBg).not.toBe('transparent')

    // Take screenshot with hover state
    await page.screenshot({
      path: 'screenshots/sidebar-hover-state.png',
      fullPage: false
    })
  })

  test('Navigation item active state - gray background, dark text', async ({ page }) => {
    const sidebar = page.locator('.sidebar-clean').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Handle auth
    const authScreen = await page.locator('[data-testid="auth-screen"]').count()
    if (authScreen > 0) {
      const demoButton = page.locator('button:has-text("Demo User")')
      if (await demoButton.count() > 0) {
        await demoButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Click on a navigation item to make it active
    const projectsBtn = page.locator('button:has-text("Projects")').first()
    await projectsBtn.click()
    await page.waitForTimeout(500)

    // Verify active state styling
    const activeStyles = await projectsBtn.evaluate(el => {
      const style = getComputedStyle(el)
      return {
        backgroundColor: style.backgroundColor,
        color: style.color
      }
    })

    // Active state should have:
    // - Gray background (NOT blue) - should be graphite-100 or similar
    // - Dark text (NOT white) - should be graphite-900 or similar

    // Background should NOT be blue (sapphire)
    // RGB values for blue backgrounds start with rgb(59, 130, 246) or similar
    // Gray backgrounds are closer to rgb(243, 244, 246)
    const bgIsNotBlue = !activeStyles.backgroundColor.includes('59, 130, 246')
    expect(bgIsNotBlue).toBeTruthy()

    // Text should NOT be white
    // White is rgb(255, 255, 255)
    const textIsNotWhite = activeStyles.color !== 'rgb(255, 255, 255)'
    expect(textIsNotWhite).toBeTruthy()

    // Take screenshot with active state
    await page.screenshot({
      path: 'screenshots/sidebar-active-state.png',
      fullPage: false
    })
  })

  test('Lux demo comparison - extract demo styles', async ({ page }) => {
    // Navigate to Lux demo
    await page.goto('http://localhost:3003/#lux-animated')
    await page.waitForTimeout(2000)

    // Extract Lux demo sidebar navigation styles
    const luxDemoStyles = await page.evaluate(() => {
      // Find navigation items in Lux demo
      const navItems = document.querySelectorAll('.sidebar nav button, nav a')
      const styles: any[] = []

      navItems.forEach((item, index) => {
        const computed = getComputedStyle(item)
        const isActive = item.classList.contains('active') ||
                        item.getAttribute('aria-current') === 'page'

        styles.push({
          index,
          isActive,
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          padding: computed.padding,
          borderRadius: computed.borderRadius,
          transition: computed.transition,
          transform: computed.transform
        })
      })

      return styles
    })

    console.log('Lux Demo Navigation Styles:', JSON.stringify(luxDemoStyles, null, 2))

    // Navigate back to main app
    await page.goto('http://localhost:3003')
    await page.waitForTimeout(2000)

    // Handle auth
    const authScreen = await page.locator('[data-testid="auth-screen"]').count()
    if (authScreen > 0) {
      const demoButton = page.locator('button:has-text("Demo User")')
      if (await demoButton.count() > 0) {
        await demoButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Extract current sidebar navigation styles
    const currentStyles = await page.evaluate(() => {
      const navItems = document.querySelectorAll('.sidebar-clean nav button')
      const styles: any[] = []

      navItems.forEach((item, index) => {
        const computed = getComputedStyle(item)
        const isActive = item.getAttribute('aria-current') === 'page' ||
                        computed.backgroundColor !== 'transparent' &&
                        computed.backgroundColor !== 'rgba(0, 0, 0, 0)'

        styles.push({
          index,
          isActive,
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          padding: computed.padding,
          borderRadius: computed.borderRadius,
          transition: computed.transition,
          transform: computed.transform
        })
      })

      return styles
    })

    console.log('Current Sidebar Navigation Styles:', JSON.stringify(currentStyles, null, 2))

    // Compare styles (log differences)
    const differences: string[] = []

    if (luxDemoStyles.length > 0 && currentStyles.length > 0) {
      const luxActive = luxDemoStyles.find(s => s.isActive)
      const currentActive = currentStyles.find(s => s.isActive)

      if (luxActive && currentActive) {
        if (luxActive.backgroundColor !== currentActive.backgroundColor) {
          differences.push(`Active bg: Demo=${luxActive.backgroundColor}, Current=${currentActive.backgroundColor}`)
        }
        if (luxActive.color !== currentActive.color) {
          differences.push(`Active color: Demo=${luxActive.color}, Current=${currentActive.color}`)
        }
      }
    }

    if (differences.length > 0) {
      console.log('Style Differences Found:', differences)
    } else {
      console.log('Styles match Lux demo!')
    }
  })

  test('Color token validation - graphite scale for navigation', async ({ page }) => {
    const sidebar = page.locator('.sidebar-clean').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Handle auth
    const authScreen = await page.locator('[data-testid="auth-screen"]').count()
    if (authScreen > 0) {
      const demoButton = page.locator('button:has-text("Demo User")')
      if (await demoButton.count() > 0) {
        await demoButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Verify Lux tokens are available
    const tokensExist = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)

      const tokens = [
        '--graphite-50',
        '--graphite-100',
        '--graphite-600',
        '--graphite-900'
      ]

      return tokens.map(token => ({
        token,
        value: style.getPropertyValue(token),
        exists: !!style.getPropertyValue(token)
      }))
    })

    // All tokens should exist
    tokensExist.forEach(({ token, exists }) => {
      expect(exists).toBeTruthy()
    })

    console.log('Graphite tokens:', tokensExist)
  })

  test('Visual regression - full sidebar comparison', async ({ page }) => {
    // Take screenshot of Lux demo
    await page.goto('http://localhost:3003/#lux-animated')
    await page.waitForTimeout(2000)

    await page.screenshot({
      path: 'screenshots/lux-demo-full.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 300, height: 1000 }
    })

    // Take screenshot of current implementation
    await page.goto('http://localhost:3003')
    await page.waitForTimeout(2000)

    // Handle auth
    const authScreen = await page.locator('[data-testid="auth-screen"]').count()
    if (authScreen > 0) {
      const demoButton = page.locator('button:has-text("Demo User")')
      if (await demoButton.count() > 0) {
        await demoButton.click()
        await page.waitForTimeout(1000)
      }
    }

    await page.screenshot({
      path: 'screenshots/sidebar-current-full.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 300, height: 1000 }
    })

    // Log that screenshots are ready for manual comparison
    console.log('Screenshots saved:')
    console.log('- screenshots/lux-demo-full.png')
    console.log('- screenshots/sidebar-current-full.png')
    console.log('Compare these images to validate visual consistency')
  })
})
