import { test } from '@playwright/test'

test('debug sidebar rendering', async ({ page }) => {
  await page.goto('http://localhost:3003/#lux-animated')
  await page.waitForLoadState('networkidle')

  console.log('=== EXPANDED STATE ===')
  const sidebar = page.locator('aside.sidebar-container')
  let width = await sidebar.evaluate(el => el.getBoundingClientRect().width)
  console.log(`Sidebar width: ${width}px`)

  const nav = page.locator('nav')
  const navPadding = await nav.evaluate(el => {
    const styles = window.getComputedStyle(el)
    return {
      paddingLeft: styles.paddingLeft,
      paddingRight: styles.paddingRight,
      overflow: styles.overflow,
      overflowX: styles.overflowX
    }
  })
  console.log('Nav styles:', navPadding)

  // Click collapse
  console.log('\n=== CLICKING COLLAPSE ===')
  await page.locator('button:has(svg.lucide-chevron-left)').click()
  await page.waitForTimeout(400)

  console.log('\n=== COLLAPSED STATE ===')
  width = await sidebar.evaluate(el => el.getBoundingClientRect().width)
  console.log(`Sidebar width: ${width}px`)

  const navCollapsed = await nav.evaluate(el => {
    const styles = window.getComputedStyle(el)
    return {
      paddingLeft: styles.paddingLeft,
      paddingRight: styles.paddingRight,
      overflow: styles.overflow,
      overflowX: styles.overflowX
    }
  })
  console.log('Nav styles:', navCollapsed)

  // Check section containers
  const sections = await page.locator('.collapsible-section').all()
  console.log(`\nFound ${sections.length} collapsible sections`)

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const styles = await section.evaluate(el => {
      const computed = window.getComputedStyle(el)
      return {
        maxHeight: computed.maxHeight,
        opacity: computed.opacity,
        overflow: computed.overflow,
        display: computed.display
      }
    })
    console.log(`Section ${i + 1}:`, styles)
  }

  // Check nav buttons
  const buttons = await page.locator('.nav-item').all()
  console.log(`\nFound ${buttons.length} nav buttons`)

  for (let i = 0; i < Math.min(3, buttons.length); i++) {
    const button = buttons[i]
    const buttonInfo = await button.evaluate(el => {
      const computed = window.getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return {
        padding: computed.padding,
        paddingLeft: computed.paddingLeft,
        paddingRight: computed.paddingRight,
        justifyContent: computed.justifyContent,
        display: computed.display,
        width: rect.width,
        x: rect.x
      }
    })
    console.log(`Button ${i + 1}:`, buttonInfo)

    // Check icon inside button
    const icon = button.locator('.sidebar-icon')
    const iconInfo = await icon.evaluate(el => {
      const rect = el.getBoundingClientRect()
      const computed = window.getComputedStyle(el)
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        opacity: computed.opacity,
        display: computed.display,
        visibility: computed.visibility
      }
    })
    console.log(`  Icon ${i + 1}:`, iconInfo)
  }

  // Take screenshot
  await page.screenshot({
    path: 'sidebar-debug.png',
    clip: { x: 0, y: 0, width: 200, height: 800 }
  })
})
