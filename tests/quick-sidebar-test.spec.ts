import { test } from '@playwright/test'

test('quick sidebar icon check', async ({ page }) => {
  await page.goto('http://localhost:3003/#lux-animated')
  await page.waitForLoadState('networkidle')

  // Click collapse
  await page.locator('button:has(svg.lucide-chevron-left)').click()
  await page.waitForTimeout(400)

  // Check icon positions
  const icons = await page.locator('.sidebar-icon:visible').all()
  console.log(`Found ${icons.length} icons`)

  for (let i = 0; i < icons.length; i++) {
    const box = await icons[i].boundingBox()
    if (box) {
      console.log(`Icon ${i + 1}: x=${box.x.toFixed(2)}, width=${box.width}`)
    }
  }

  // Screenshot
  await page.screenshot({ path: 'sidebar-test.png', clip: { x: 0, y: 0, width: 150, height: 600 } })
})
