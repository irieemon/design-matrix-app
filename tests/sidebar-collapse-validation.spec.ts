import { test, expect } from '@playwright/test'

test.describe('Sidebar Collapse - Icon Visibility Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3003/#lux-animated')
    await page.waitForLoadState('networkidle')
  })

  test('icons should be visible when sidebar is collapsed', async ({ page }) => {
    // Wait for sidebar to be fully rendered
    await page.waitForSelector('aside.sidebar-container', { state: 'visible' })

    // Verify sidebar is initially expanded (224px)
    const sidebarExpanded = page.locator('aside.sidebar-container')
    const expandedWidth = await sidebarExpanded.evaluate(el => el.getBoundingClientRect().width)
    expect(expandedWidth).toBeCloseTo(224, 5)

    // Count visible navigation icons in expanded state
    const expandedIcons = await page.locator('.sidebar-icon').count()
    console.log(`Expanded state: ${expandedIcons} icons found`)
    expect(expandedIcons).toBeGreaterThan(0)

    // Take screenshot of expanded state
    await page.screenshot({
      path: 'screenshots/sidebar-expanded.png',
      fullPage: false
    })

    // Click collapse button
    const collapseButton = page.locator('button:has(svg.lucide-chevron-left)')
    await collapseButton.click()

    // Wait for transition to complete (280ms + buffer)
    await page.waitForTimeout(400)

    // Verify sidebar is collapsed (80px)
    const collapsedWidth = await sidebarExpanded.evaluate(el => el.getBoundingClientRect().width)
    console.log(`Collapsed width: ${collapsedWidth}px`)
    expect(collapsedWidth).toBeCloseTo(80, 5)

    // CRITICAL: Verify collapsible sections have maxHeight: none
    const workspaceSection = page.locator('.collapsible-section').first()
    const maxHeight = await workspaceSection.evaluate(el =>
      window.getComputedStyle(el).maxHeight
    )
    console.log(`Workspace section maxHeight: ${maxHeight}`)
    expect(maxHeight).toBe('none')

    // CRITICAL: Verify icons are still visible
    const collapsedIcons = page.locator('.sidebar-icon:visible')
    const collapsedIconCount = await collapsedIcons.count()
    console.log(`Collapsed state: ${collapsedIconCount} visible icons`)
    expect(collapsedIconCount).toBeGreaterThan(0)
    expect(collapsedIconCount).toBe(expandedIcons) // Same number of icons

    // Verify specific icons are visible by checking their bounding boxes
    const iconElements = await collapsedIcons.all()
    for (let i = 0; i < iconElements.length; i++) {
      const icon = iconElements[i]
      const box = await icon.boundingBox()

      if (box) {
        console.log(`Icon ${i + 1}: x=${box.x.toFixed(1)}, y=${box.y.toFixed(1)}, width=${box.width}, height=${box.height}`)

        // Icon should be within sidebar bounds (0-80px)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(90) // Small buffer for positioning

        // Icon should have visible dimensions
        expect(box.width).toBeGreaterThan(0)
        expect(box.height).toBeGreaterThan(0)
      } else {
        console.error(`Icon ${i + 1}: NO BOUNDING BOX - ICON IS CLIPPED OR HIDDEN`)
        throw new Error(`Icon ${i + 1} has no bounding box - it may be clipped or hidden`)
      }
    }

    // Take screenshot of collapsed state for visual verification
    await page.screenshot({
      path: 'screenshots/sidebar-collapsed-validated.png',
      fullPage: false
    })

    // Verify labels are hidden
    const labels = page.locator('.sidebar-label:visible')
    const visibleLabels = await labels.count()
    expect(visibleLabels).toBe(0) // Labels should be hidden

    // Verify section headers are hidden
    const headers = page.locator('.section-header:visible')
    const visibleHeaders = await headers.count()
    expect(visibleHeaders).toBe(0) // Headers should be hidden
  })

  test('tooltip should appear on icon hover in collapsed state', async ({ page }) => {
    // Collapse sidebar
    const collapseButton = page.locator('button:has(svg.lucide-chevron-left)')
    await collapseButton.click()
    await page.waitForTimeout(400)

    // Find a navigation item with tooltip
    const navItem = page.locator('.nav-item-collapsed').first()

    // Hover over the icon
    await navItem.hover()
    await page.waitForTimeout(200) // Wait for tooltip animation

    // Check if tooltip pseudo-element is rendered (via screenshot)
    await page.screenshot({
      path: 'screenshots/sidebar-collapsed-tooltip.png',
      fullPage: false
    })

    // Note: Testing ::after pseudo-elements requires visual verification
    console.log('Tooltip visual test captured')
  })

  test('sidebar should expand back to full width', async ({ page }) => {
    // Collapse sidebar
    const collapseButton = page.locator('button:has(svg.lucide-chevron-left)')
    await collapseButton.click()
    await page.waitForTimeout(400)

    // Verify collapsed
    const sidebar = page.locator('aside.sidebar-container')
    let width = await sidebar.evaluate(el => el.getBoundingClientRect().width)
    expect(width).toBeCloseTo(80, 5)

    // Click expand button
    const expandButton = page.locator('button:has(svg.lucide-chevron-right)')
    await expandButton.click()
    await page.waitForTimeout(400)

    // Verify expanded
    width = await sidebar.evaluate(el => el.getBoundingClientRect().width)
    expect(width).toBeCloseTo(224, 5)

    // Verify labels are visible again
    const labels = page.locator('.sidebar-label:visible')
    const visibleLabels = await labels.count()
    expect(visibleLabels).toBeGreaterThan(0)

    await page.screenshot({
      path: 'screenshots/sidebar-re-expanded.png',
      fullPage: false
    })
  })

  test('rapid toggle should not break icon visibility', async ({ page }) => {
    const collapseButton = page.locator('button:has(svg.lucide-chevron-left), button:has(svg.lucide-chevron-right)')

    // Rapidly toggle 5 times
    for (let i = 0; i < 5; i++) {
      await collapseButton.click()
      await page.waitForTimeout(100) // Faster than transition
    }

    // Wait for final transition
    await page.waitForTimeout(400)

    // Icons should still be visible regardless of final state
    const icons = page.locator('.sidebar-icon:visible')
    const count = await icons.count()
    expect(count).toBeGreaterThan(0)

    console.log(`After rapid toggle: ${count} icons visible`)
  })
})
