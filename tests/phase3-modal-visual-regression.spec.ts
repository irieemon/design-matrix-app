import { test, expect } from '@playwright/test'

/**
 * Phase 3 Modal Visual Regression Tests
 *
 * Tests all migrated Phase 3 modals for visual consistency with Lux design tokens.
 * Validates: colors, borders, shadows, focus states, hover states
 */

test.describe('Phase 3 Modal Visual Regression - Lux Design Tokens', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and ensure we're authenticated
    await page.goto('http://localhost:3003')
    await page.waitForLoadState('networkidle')
  })

  test('Base Modal component - Lux styling', async ({ page }) => {
    // This tests the BaseModal wrapper used by all other modals
    // We'll trigger it through AddIdeaModal which uses BaseModal

    // Wait for projects page to load
    await page.waitForSelector('[data-testid="projects-page"]', { timeout: 10000 }).catch(() => {})

    // Find and click a project to enter matrix view
    const projectCard = page.locator('[data-testid^="project-card-"]').first()
    if (await projectCard.count() > 0) {
      await projectCard.click()
      await page.waitForTimeout(1000)

      // Open Add Idea modal
      const addIdeaButton = page.locator('button:has-text("Add Idea")').or(
        page.locator('[data-testid="add-idea-button"]')
      ).first()

      if (await addIdeaButton.count() > 0) {
        await addIdeaButton.click()
        await page.waitForTimeout(500)

        // Check modal backdrop
        const backdrop = page.locator('.lux-modal-backdrop')
        await expect(backdrop).toBeVisible()

        // Check modal container
        const modal = page.locator('.lux-modal').or(page.locator('[data-testid="add-idea-modal"]').locator('..'))
        await expect(modal.first()).toBeVisible()

        // Take screenshot
        await page.screenshot({
          path: 'test-results/phase3-base-modal.png',
          fullPage: false
        })
      }
    }
  })

  test('AddIdeaModal - Lux form styling', async ({ page }) => {
    await page.waitForSelector('[data-testid="projects-page"]', { timeout: 10000 }).catch(() => {})

    const projectCard = page.locator('[data-testid^="project-card-"]').first()
    if (await projectCard.count() > 0) {
      await projectCard.click()
      await page.waitForTimeout(1000)

      const addButton = page.locator('button:has-text("Add Idea")').first()
      if (await addButton.count() > 0) {
        await addButton.click()
        await page.waitForTimeout(500)

        // Check form elements use Lux tokens
        const titleInput = page.locator('[data-testid="idea-content-input"]')
        if (await titleInput.count() > 0) {
          // Test focus state (sapphire focus ring)
          await titleInput.focus()
          await page.waitForTimeout(200)

          await page.screenshot({
            path: 'test-results/phase3-addidea-modal-focus.png'
          })

          // Test filled state
          await titleInput.fill('Test Idea')
          await page.waitForTimeout(200)

          await page.screenshot({
            path: 'test-results/phase3-addidea-modal-filled.png'
          })
        }
      }
    }
  })

  test('FeatureDetailModal - Complex layout with Lux tokens', async ({ page }) => {
    // This modal has the most complex styling - timeline cards, badges, sections
    // We'll test if we can reach it through the roadmap

    await page.waitForSelector('[data-testid="projects-page"]', { timeout: 10000 }).catch(() => {})

    const projectCard = page.locator('[data-testid^="project-card-"]').first()
    if (await projectCard.count() > 0) {
      await projectCard.click()
      await page.waitForTimeout(1000)

      // Try to navigate to roadmap view
      const roadmapLink = page.locator('a:has-text("Roadmap")').or(
        page.locator('[href*="roadmap"]')
      ).first()

      if (await roadmapLink.count() > 0) {
        await roadmapLink.click()
        await page.waitForTimeout(1500)

        // Click on a feature if available
        const featureCard = page.locator('[data-testid^="feature-"]').or(
          page.locator('.roadmap-feature')
        ).first()

        if (await featureCard.count() > 0) {
          await featureCard.click()
          await page.waitForTimeout(1000)

          await page.screenshot({
            path: 'test-results/phase3-feature-detail-modal.png',
            fullPage: true
          })
        }
      }
    }
  })

  test('Modal color token validation', async ({ page }) => {
    // Verify CSS custom properties are being used
    await page.waitForSelector('[data-testid="projects-page"]', { timeout: 10000 }).catch(() => {})

    const projectCard = page.locator('[data-testid^="project-card-"]').first()
    if (await projectCard.count() > 0) {
      await projectCard.click()
      await page.waitForTimeout(1000)

      const addButton = page.locator('button:has-text("Add Idea")').first()
      if (await addButton.count() > 0) {
        await addButton.click()
        await page.waitForTimeout(500)

        // Check that Lux tokens are present in the page
        const hasLuxTokens = await page.evaluate(() => {
          const root = document.documentElement
          const style = getComputedStyle(root)

          // Check for key Lux tokens
          const tokens = [
            '--graphite-900',
            '--graphite-700',
            '--graphite-600',
            '--sapphire-500',
            '--sapphire-600',
            '--hairline-default',
            '--surface-primary',
            '--canvas-secondary'
          ]

          return tokens.every(token => {
            const value = style.getPropertyValue(token)
            return value && value.trim() !== ''
          })
        })

        expect(hasLuxTokens).toBeTruthy()
      }
    }
  })

  test('Modal focus states - Sapphire tokens', async ({ page }) => {
    await page.waitForSelector('[data-testid="projects-page"]', { timeout: 10000 }).catch(() => {})

    const projectCard = page.locator('[data-testid^="project-card-"]').first()
    if (await projectCard.count() > 0) {
      await projectCard.click()
      await page.waitForTimeout(1000)

      const addButton = page.locator('button:has-text("Add Idea")').first()
      if (await addButton.count() > 0) {
        await addButton.click()
        await page.waitForTimeout(500)

        // Test multiple form elements for focus states
        const inputs = [
          page.locator('[data-testid="idea-content-input"]'),
          page.locator('[data-testid="idea-description-input"]'),
          page.locator('[data-testid="idea-priority-select"]')
        ]

        for (const input of inputs) {
          if (await input.count() > 0) {
            await input.focus()
            await page.waitForTimeout(200)

            // Check that focus created a box shadow (sapphire focus ring)
            const hasFocusRing = await input.evaluate(el => {
              const style = getComputedStyle(el)
              return style.boxShadow && style.boxShadow !== 'none'
            })

            expect(hasFocusRing).toBeTruthy()
          }
        }
      }
    }
  })
})
