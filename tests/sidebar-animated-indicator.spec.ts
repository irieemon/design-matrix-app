import { test, expect } from '@playwright/test'

/**
 * Sidebar Animated Selection Indicator Tests
 *
 * Tests the sliding blue bar that animates when navigation items are selected,
 * matching the Lux animated demo specifications.
 */

async function loginWithDemo(page: any) {
  await page.goto('http://localhost:3006')
  await page.waitForLoadState('networkidle')

  const authScreen = await page.locator('[data-testid="auth-screen"]').count()
  if (authScreen > 0) {
    const demoButton = page.locator('button:has-text("Demo User")')
    await demoButton.waitFor({ state: 'visible', timeout: 5000 })
    await demoButton.click()
    await page.waitForTimeout(2000)
  }
}

test.describe('Sidebar Animated Selection Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithDemo(page)
  })

  test('should display selection indicator on active nav item', async ({ page }) => {
    // Wait for sidebar to be visible
    const sidebar = page.locator('.sidebar-clean')
    await sidebar.waitFor({ state: 'visible', timeout: 5000 })

    // Find the animated indicator
    const indicator = sidebar.locator('nav > div.absolute.left-0.w-1')
    await expect(indicator).toBeVisible()

    // Check indicator properties
    const indicatorStyles = await indicator.evaluate((el) => {
      const styles = getComputedStyle(el)
      return {
        width: styles.width,
        backgroundColor: styles.backgroundColor,
        borderRadius: styles.borderRadius,
        opacity: styles.opacity,
        position: styles.position
      }
    })

    // Validate Lux specifications
    expect(indicatorStyles.width).toBe('4px') // w-1 = 4px
    expect(indicatorStyles.backgroundColor).toBe('rgb(59, 130, 246)') // sapphire-500
    expect(parseFloat(indicatorStyles.opacity)).toBeGreaterThan(0) // Should be visible
    expect(indicatorStyles.position).toBe('absolute')
  })

  test('should animate indicator when switching navigation items', async ({ page }) => {
    const sidebar = page.locator('.sidebar-clean')
    await sidebar.waitFor({ state: 'visible', timeout: 5000 })

    const indicator = sidebar.locator('nav > div.absolute.left-0.w-1')

    // Get initial position (should be on Projects or Design Matrix)
    const initialPosition = await indicator.evaluate((el) => {
      return {
        top: parseFloat(getComputedStyle(el).top),
        height: parseFloat(getComputedStyle(el).height)
      }
    })

    console.log('Initial indicator position:', initialPosition)

    // Click on a different navigation item (Roadmap)
    const roadmapButton = sidebar.locator('button:has-text("Roadmap")')
    if (await roadmapButton.count() > 0) {
      await roadmapButton.click()
      await page.waitForTimeout(500) // Wait for animation

      // Get new position
      const newPosition = await indicator.evaluate((el) => {
        return {
          top: parseFloat(getComputedStyle(el).top),
          height: parseFloat(getComputedStyle(el).height),
          transition: getComputedStyle(el).transition
        }
      })

      console.log('New indicator position:', newPosition)

      // Indicator should have moved (different top position)
      expect(newPosition.top).not.toBe(initialPosition.top)

      // Should have transition animation
      expect(newPosition.transition).toContain('300ms')
      expect(newPosition.transition).toContain('cubic-bezier')
    }
  })

  test('should align indicator with active navigation item', async ({ page }) => {
    const sidebar = page.locator('.sidebar-clean')
    await sidebar.waitFor({ state: 'visible', timeout: 5000 })

    // Find first active nav item (should have graphite-100 background)
    const activeNavItem = sidebar.locator('nav button').filter({
      has: page.locator('*')
    }).first()

    // Get active item position
    const navItemBox = await activeNavItem.boundingBox()

    if (navItemBox) {
      const indicator = sidebar.locator('nav > div.absolute.left-0.w-1')
      const indicatorBox = await indicator.boundingBox()

      if (indicatorBox) {
        console.log('NavItem position:', { top: navItemBox.y, height: navItemBox.height })
        console.log('Indicator position:', { top: indicatorBox.y, height: indicatorBox.height })

        // Indicator should be roughly aligned with nav item (within 5px tolerance)
        expect(Math.abs(indicatorBox.y - navItemBox.y)).toBeLessThan(5)

        // Indicator height should match nav item height (within 5px tolerance)
        expect(Math.abs(indicatorBox.height - navItemBox.height)).toBeLessThan(5)
      }
    }
  })

  test('should maintain indicator visibility in collapsed state', async ({ page }) => {
    const sidebar = page.locator('.sidebar-clean')
    await sidebar.waitFor({ state: 'visible', timeout: 5000 })

    // Click collapse button (ChevronLeft icon)
    const collapseButton = sidebar.locator('button[aria-label="Collapse sidebar"]')
    if (await collapseButton.count() > 0) {
      await collapseButton.click()
      await page.waitForTimeout(500) // Wait for collapse animation

      // Indicator should still be visible
      const indicator = sidebar.locator('nav > div.absolute.left-0.w-1')
      await expect(indicator).toBeVisible()

      // Check margin adjustment for collapsed state
      const marginLeft = await indicator.evaluate((el) => {
        return getComputedStyle(el).marginLeft
      })

      console.log('Collapsed indicator margin:', marginLeft)
      // Should be 8px in collapsed state
      expect(marginLeft).toBe('8px')
    }
  })

  test('should have smooth cubic-bezier animation', async ({ page }) => {
    const sidebar = page.locator('.sidebar-clean')
    await sidebar.waitFor({ state: 'visible', timeout: 5000 })

    const indicator = sidebar.locator('nav > div.absolute.left-0.w-1')

    // Check transition properties
    const transition = await indicator.evaluate((el) => {
      return getComputedStyle(el).transition
    })

    console.log('Indicator transition:', transition)

    // Should have 300ms timing and cubic-bezier easing
    expect(transition).toContain('300ms')
    expect(transition).toContain('cubic-bezier(0.4, 0, 0.2, 1)')
  })

  test('should update indicator when navigating between multiple items', async ({ page }) => {
    const sidebar = page.locator('.sidebar-clean')
    await sidebar.waitFor({ state: 'visible', timeout: 5000 })

    const indicator = sidebar.locator('nav > div.absolute.left-0.w-1')

    // Navigate through multiple items
    const navItems = [
      'Projects',
      'Design Matrix',
      'File Management',
      'Roadmap'
    ]

    const positions: number[] = []

    for (const itemText of navItems) {
      const button = sidebar.locator(`button:has-text("${itemText}")`).first()
      if (await button.count() > 0) {
        await button.click()
        await page.waitForTimeout(400) // Wait for animation

        const position = await indicator.evaluate((el) => {
          return parseFloat(getComputedStyle(el).top)
        })

        positions.push(position)
        console.log(`${itemText} indicator position:`, position)
      }
    }

    // All positions should be different (indicator moved for each click)
    const uniquePositions = new Set(positions)
    expect(uniquePositions.size).toBe(positions.length)
  })
})
