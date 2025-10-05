import { test, expect } from '@playwright/test'

test('chevron button should not jump on hover', async ({ page }) => {
  await page.goto('http://localhost:3003/#lux-animated')
  await page.waitForLoadState('networkidle')

  // Collapse sidebar
  const collapseButton = page.locator('button:has(svg.lucide-chevron-left)')
  await collapseButton.click()
  await page.waitForTimeout(400)

  // Get chevron button in collapsed state
  const chevronButton = page.locator('button:has(svg.lucide-chevron-right)')

  // Get initial position
  const initialBox = await chevronButton.boundingBox()
  console.log('Initial position:', initialBox)

  // Hover over button
  await chevronButton.hover()
  await page.waitForTimeout(200) // Wait for any hover effects

  // Get position after hover
  const hoveredBox = await chevronButton.boundingBox()
  console.log('Hovered position:', hoveredBox)

  // Verify position hasn't changed significantly (allow 1px tolerance for sub-pixel rendering)
  if (initialBox && hoveredBox) {
    expect(Math.abs(hoveredBox.x - initialBox.x)).toBeLessThan(2)
    expect(Math.abs(hoveredBox.y - initialBox.y)).toBeLessThan(2)
    console.log('✅ Button position stable on hover')
  }

  // Take screenshot
  await page.screenshot({
    path: 'chevron-hover-test.png',
    clip: { x: 0, y: 0, width: 150, height: 200 }
  })
})
