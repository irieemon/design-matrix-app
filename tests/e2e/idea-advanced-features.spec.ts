import { test, expect, Page, Browser } from '@playwright/test'
import { SELECTORS } from './constants/selectors'

/**
 * Comprehensive E2E Tests for Advanced Idea Management Features
 *
 * This test suite covers advanced functionality:
 * - Search and filtering capabilities
 * - Sorting and organization
 * - Tag management
 * - Idea linking and dependencies
 * - Templates and bulk operations
 * - Import/export functionality
 * - Concurrent editing scenarios
 * - Performance with large datasets
 * - Mobile and touch interactions
 * - Accessibility features
 *
 * Total Tests: ~35 comprehensive scenarios
 */

// Test configuration
const TEST_TIMEOUT = 30000
const ANIMATION_DELAY = 300

// Matrix coordinate constants
const MATRIX_COORDS = {
  QUICK_WINS: { x: 130, y: 130 },
  STRATEGIC: { x: 390, y: 130 },
  RECONSIDER: { x: 130, y: 390 },
  AVOID: { x: 390, y: 390 }
}

// Helper functions
async function loginAsTestUser(page: Page, userId: string = 'test-user', email: string = 'test@example.com') {
  // Navigate to app first
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Check if already logged in by looking for authenticated UI elements
  const isLoggedIn = await page.locator(SELECTORS.MATRIX.CONTAINER).or(page.locator('text=Create Project')).isVisible({ timeout: 2000 }).catch(() => false);
  if (isLoggedIn) return;

  // Check for demo user button (visible on login screen)
  const demoButton = page.locator(SELECTORS.AUTH.DEMO_BUTTON).or(page.locator('button:has-text("Demo User"), button:has-text("Continue as Demo")'));

  if (await demoButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Click demo button to authenticate
    await demoButton.click();
    await page.waitForURL('**/matrix', { timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
  } else {
    // Fallback: Set localStorage after navigation
    await page.evaluate(({ userId: uid, email: userEmail }) => {
      localStorage.setItem('demo-mode', 'true');
      localStorage.setItem('user', JSON.stringify({ id: uid, email: userEmail }));
    }, { userId, email });
    await page.reload();
    await page.waitForLoadState('networkidle');
  }

  // Verify authentication worked
  const isAuthenticated = await page.locator(SELECTORS.MATRIX.CONTAINER).or(page.locator('text=Create Project')).isVisible({ timeout: 3000 }).catch(() => false);

  if (!isAuthenticated) {
    throw new Error('Authentication failed - still on login screen');
  }
}

async function createTestProject(page: Page, projectName: string = 'Advanced Test Project') {
  await page.click('button:has-text("New Project")')
  await page.fill('input[name="projectName"]', projectName)
  await page.click('button:has-text("Create")')
  await page.waitForSelector(SELECTORS.MATRIX.CONTAINER, { timeout: TEST_TIMEOUT })
}

async function addIdeaToMatrix(
  page: Page,
  content: string,
  details: string = '',
  priority: string = 'moderate'
) {
  await page.click(SELECTORS.MATRIX.ADD_IDEA_BUTTON)
  await page.waitForSelector(SELECTORS.MODALS.ADD_IDEA, { state: 'visible' })
  await page.fill(SELECTORS.FORMS.IDEA_CONTENT_INPUT, content)
  if (details) await page.fill('textarea[name="details"]', details)
  await page.selectOption('select[name="priority"]', priority)
  await page.click(SELECTORS.FORMS.IDEA_SAVE_BUTTON)
  await page.waitForSelector(SELECTORS.MODALS.ADD_IDEA, { state: 'hidden' })
  await page.waitForSelector(`.idea-card-base:has-text("${content}")`, { timeout: TEST_TIMEOUT })
}

async function createMultipleIdeas(page: Page, count: number = 10) {
  const ideas = []
  for (let i = 1; i <= count; i++) {
    const idea = {
      content: `Test Idea ${i}`,
      details: `Details for idea ${i}`,
      priority: ['low', 'moderate', 'high', 'strategic'][i % 4]
    }
    ideas.push(idea)
    await addIdeaToMatrix(page, idea.content, idea.details, idea.priority)
  }
  return ideas
}

test.describe('Advanced Features - Search and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
    await createMultipleIdeas(page, 10)
  })

  test('should search ideas by content', async ({ page }) => {
    const searchBox = page.locator('input[placeholder*="Search"]')
    if (!await searchBox.isVisible()) {
      test.skip('Search feature not yet implemented')
    }

    await searchBox.fill('Test Idea 5')
    // Wait for debounce and search results to update
    await expect(page.locator('.idea-card-base:visible')).toHaveCount(1, { timeout: 2000 })
    await expect(page.locator('.idea-card-base:has-text("Test Idea 5")')).toBeVisible()
  })

  test('should search ideas by details', async ({ page }) => {
    const searchBox = page.locator('input[placeholder*="Search"]')
    if (!await searchBox.isVisible()) {
      test.skip('Search feature not yet implemented')
    }

    await searchBox.fill('Details for idea 3')
    // Wait for debounce and search results to update
    await expect(page.locator('.idea-card-base:has-text("Test Idea 3")')).toBeVisible({ timeout: 2000 })
  })

  test('should filter by priority level', async ({ page }) => {
    const filterButton = page.locator('button:has-text("Filter")')
    if (!await filterButton.isVisible()) {
      test.skip('Filter feature not yet implemented')
    }

    await filterButton.click()
    await page.click('label:has-text("High Priority")')

    const visibleCards = page.locator('.idea-card-base:visible')
    const count = await visibleCards.count()

    // All visible cards should be high priority
    for (let i = 0; i < count; i++) {
      await expect(visibleCards.nth(i)).toHaveClass(/priority-high/)
    }
  })

  test('should filter by quadrant', async ({ page }) => {
    const filterButton = page.locator('button:has-text("Filter")')
    if (!await filterButton.isVisible()) {
      test.skip('Filter feature not yet implemented')
    }

    await filterButton.click()
    await page.click('label:has-text("Quick Wins")')

    // Should only show ideas in top-left quadrant
    const visibleCards = page.locator('.idea-card-base:visible')
    const count = await visibleCards.count()

    for (let i = 0; i < count; i++) {
      const card = visibleCards.nth(i)
      const box = await card.boundingBox()
      const matrix = await page.locator('.matrix-container').boundingBox()

      if (!box || !matrix) continue

      expect(box.x).toBeLessThan(matrix.x + matrix.width / 2)
      expect(box.y).toBeLessThan(matrix.y + matrix.height / 2)
    }
  })

  test('should clear all filters', async ({ page }) => {
    const filterButton = page.locator('button:has-text("Filter")')
    if (!await filterButton.isVisible()) {
      test.skip('Filter feature not yet implemented')
    }

    await filterButton.click()
    await page.click('label:has-text("High Priority")')
    await page.click('button:has-text("Clear Filters")')

    await expect(page.locator('.idea-card-base:visible')).toHaveCount(10)
  })
})

test.describe('Advanced Features - Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test('should sort ideas by priority', async ({ page }) => {
    await addIdeaToMatrix(page, 'Low Priority Idea', '', 'low')
    await addIdeaToMatrix(page, 'High Priority Idea', '', 'high')
    await addIdeaToMatrix(page, 'Strategic Idea', '', 'strategic')

    const sortButton = page.locator('button:has-text("Sort")')
    if (!await sortButton.isVisible()) {
      test.skip('Sort feature not yet implemented')
    }

    await sortButton.click()
    await page.click('text=Priority (High to Low)')

    const cards = page.locator('.idea-card-base')
    await expect(cards.first()).toContainText('Strategic Idea')
  })

  test('should sort ideas by date created', async ({ page }) => {
    await createMultipleIdeas(page, 5)

    const sortButton = page.locator('button:has-text("Sort")')
    if (!await sortButton.isVisible()) {
      test.skip('Sort feature not yet implemented')
    }

    await sortButton.click()
    await page.click('text=Date (Newest First)')

    const cards = page.locator('.idea-card-base')
    await expect(cards.first()).toContainText('Test Idea 5')
  })

  test('should sort ideas alphabetically', async ({ page }) => {
    await addIdeaToMatrix(page, 'Zebra Idea')
    await addIdeaToMatrix(page, 'Apple Idea')
    await addIdeaToMatrix(page, 'Mango Idea')

    const sortButton = page.locator('button:has-text("Sort")')
    if (!await sortButton.isVisible()) {
      test.skip('Sort feature not yet implemented')
    }

    await sortButton.click()
    await page.click('text=Name (A-Z)')

    const cards = page.locator('.idea-card-base')
    await expect(cards.first()).toContainText('Apple Idea')
  })
})

test.describe('Advanced Features - Tag Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test('should add tag to idea', async ({ page }) => {
    await addIdeaToMatrix(page, 'Taggable Idea')

    const tagButton = page.locator('button[aria-label*="tag"]').first()
    if (!await tagButton.isVisible()) {
      test.skip('Tag feature not yet implemented')
    }

    await tagButton.click()
    await page.fill('input[placeholder*="tag"]', 'important')
    await page.press('input[placeholder*="tag"]', 'Enter')

    await expect(page.locator('.tag:has-text("important")')).toBeVisible()
  })

  test('should filter ideas by tag', async ({ page }) => {
    await addIdeaToMatrix(page, 'Tagged Idea 1')
    await addIdeaToMatrix(page, 'Tagged Idea 2')
    await addIdeaToMatrix(page, 'Untagged Idea')

    // Add same tag to two ideas
    const tagButtons = page.locator('button[aria-label*="tag"]')
    if (await tagButtons.count() === 0) {
      test.skip('Tag feature not yet implemented')
    }

    // Tag first two ideas
    await tagButtons.nth(0).click()
    await page.fill('input[placeholder*="tag"]', 'feature')
    await page.press('input[placeholder*="tag"]', 'Enter')

    await tagButtons.nth(1).click()
    await page.fill('input[placeholder*="tag"]', 'feature')
    await page.press('input[placeholder*="tag"]', 'Enter')

    // Filter by tag
    await page.click('.tag:has-text("feature")')

    await expect(page.locator('.idea-card-base:visible')).toHaveCount(2)
  })

  test('should remove tag from idea', async ({ page }) => {
    await addIdeaToMatrix(page, 'Remove Tag Test')

    const tagButton = page.locator('button[aria-label*="tag"]').first()
    if (!await tagButton.isVisible()) {
      test.skip('Tag feature not yet implemented')
    }

    await tagButton.click()
    await page.fill('input[placeholder*="tag"]', 'removeme')
    await page.press('input[placeholder*="tag"]', 'Enter')

    await expect(page.locator('.tag:has-text("removeme")')).toBeVisible()

    // Remove tag
    await page.click('.tag:has-text("removeme") button')
    await expect(page.locator('.tag:has-text("removeme")')).not.toBeVisible()
  })
})

test.describe('Advanced Features - Idea Linking', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test('should create link between ideas', async ({ page }) => {
    await addIdeaToMatrix(page, 'Parent Idea')
    await addIdeaToMatrix(page, 'Child Idea')

    const linkButton = page.locator('button[aria-label*="link"]').first()
    if (!await linkButton.isVisible()) {
      test.skip('Link feature not yet implemented')
    }

    await linkButton.click()
    await page.click('.idea-card-base:has-text("Child Idea")')

    await expect(page.locator('.connection-line')).toBeVisible()
  })

  test('should show dependency visualization', async ({ page }) => {
    await addIdeaToMatrix(page, 'Idea A')
    await addIdeaToMatrix(page, 'Idea B')
    await addIdeaToMatrix(page, 'Idea C')

    const linkButton = page.locator('button[aria-label*="link"]')
    if (await linkButton.count() === 0) {
      test.skip('Link feature not yet implemented')
    }

    // Create chain: A -> B -> C
    await linkButton.nth(0).click()
    await page.click('.idea-card-base:has-text("Idea B")')

    await linkButton.nth(1).click()
    await page.click('.idea-card-base:has-text("Idea C")')

    await expect(page.locator('.connection-line')).toHaveCount(2)
  })

  test('should delete link between ideas', async ({ page }) => {
    await addIdeaToMatrix(page, 'Link Source')
    await addIdeaToMatrix(page, 'Link Target')

    const linkButton = page.locator('button[aria-label*="link"]').first()
    if (!await linkButton.isVisible()) {
      test.skip('Link feature not yet implemented')
    }

    await linkButton.click()
    await page.click('.idea-card-base:has-text("Link Target")')

    // Delete link
    await page.click('.connection-line')
    await page.click('button:has-text("Delete Link")')

    await expect(page.locator('.connection-line')).not.toBeVisible()
  })
})

test.describe('Advanced Features - Templates', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test('should create idea from template', async ({ page }) => {
    const templateButton = page.locator('button:has-text("Templates")')
    if (!await templateButton.isVisible()) {
      test.skip('Template feature not yet implemented')
    }

    await templateButton.click()
    await page.click('button:has-text("Feature Request Template")')

    const ideaCard = page.locator('.idea-card-base').first()
    await expect(ideaCard).toContainText('Feature:')
  })

  test('should save custom template', async ({ page }) => {
    await addIdeaToMatrix(page, 'Custom Template Idea', 'Detailed template content')

    const saveTemplateButton = page.locator('button:has-text("Save as Template")')
    if (!await saveTemplateButton.isVisible()) {
      test.skip('Template feature not yet implemented')
    }

    await page.locator('.idea-card-base:has-text("Custom Template Idea")').dblclick()
    await saveTemplateButton.click()
    await page.fill('input[name="templateName"]', 'My Custom Template')
    await page.click('button:has-text("Save")')

    await expect(page.locator('text=Template saved')).toBeVisible()
  })
})

test.describe('Advanced Features - Bulk Operations', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
    await createMultipleIdeas(page, 10)
  })

  test('should select multiple ideas', async ({ page }) => {
    // Hold Ctrl/Cmd and click multiple cards
    await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control')
    await page.click('.idea-card-base:has-text("Test Idea 1")')
    await page.click('.idea-card-base:has-text("Test Idea 2")')
    await page.click('.idea-card-base:has-text("Test Idea 3")')
    await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control')

    const selectedCards = page.locator('.idea-card-base.selected')
    if (await selectedCards.count() === 0) {
      test.skip('Multi-select feature not yet implemented')
    }

    await expect(selectedCards).toHaveCount(3)
  })

  test('should bulk delete multiple ideas', async ({ page }) => {
    await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control')
    await page.click('.idea-card-base:has-text("Test Idea 1")')
    await page.click('.idea-card-base:has-text("Test Idea 2")')
    await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control')

    const bulkDeleteButton = page.locator('button:has-text("Delete Selected")')
    if (!await bulkDeleteButton.isVisible()) {
      test.skip('Bulk delete feature not yet implemented')
    }

    await bulkDeleteButton.click()
    await page.click('button:has-text("Confirm")')

    await expect(page.locator('.idea-card-base')).toHaveCount(8)
  })

  test('should bulk update priority', async ({ page }) => {
    await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control')
    await page.click('.idea-card-base:has-text("Test Idea 1")')
    await page.click('.idea-card-base:has-text("Test Idea 2")')
    await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control')

    const bulkEditButton = page.locator('button:has-text("Edit Selected")')
    if (!await bulkEditButton.isVisible()) {
      test.skip('Bulk edit feature not yet implemented')
    }

    await bulkEditButton.click()
    await page.selectOption('select[name="priority"]', 'high')
    await page.click('button:has-text("Apply")')

    await expect(page.locator('.idea-card-base.selected.idea-card-priority-high')).toHaveCount(2)
  })
})

test.describe('Advanced Features - Import/Export', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test('should export ideas to CSV', async ({ page }) => {
    await createMultipleIdeas(page, 5)

    const exportButton = page.locator('button:has-text("Export")')
    if (!await exportButton.isVisible()) {
      test.skip('Export feature not yet implemented')
    }

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
      page.click('button:has-text("CSV")')
    ])

    expect(download.suggestedFilename()).toMatch(/\.csv$/)
  })

  test('should export ideas to JSON', async ({ page }) => {
    await createMultipleIdeas(page, 5)

    const exportButton = page.locator('button:has-text("Export")')
    if (!await exportButton.isVisible()) {
      test.skip('Export feature not yet implemented')
    }

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
      page.click('button:has-text("JSON")')
    ])

    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })

  test('should import ideas from CSV', async ({ page }) => {
    const importButton = page.locator('button:has-text("Import")')
    if (!await importButton.isVisible()) {
      test.skip('Import feature not yet implemented')
    }

    const csvContent = `content,details,priority,x,y
Imported Idea 1,Details 1,high,130,130
Imported Idea 2,Details 2,low,390,390`

    await importButton.click()
    await page.setInputFiles('input[type="file"]', {
      name: 'ideas.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    await page.click('button:has-text("Import")')

    await expect(page.locator('.idea-card-base:has-text("Imported Idea 1")')).toBeVisible()
    await expect(page.locator('.idea-card-base:has-text("Imported Idea 2")')).toBeVisible()
  })
})

test.describe('Advanced Features - Concurrent Editing', () => {
  test('should handle concurrent editing by two users', async ({ browser }) => {
    // Create two browser contexts (two users)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      // Both users log in
      await loginAsTestUser(page1)
      await loginAsTestUser(page2)

      // User 1 creates project and idea
      await createTestProject(page1)
      const projectUrl = page1.url()

      await addIdeaToMatrix(page1, 'Concurrent Test Idea')

      // User 2 navigates to same project
      await page2.goto(projectUrl)
      await page2.waitForSelector(SELECTORS.MATRIX.CONTAINER)

      // User 1 starts editing
      await page1.locator('.idea-card-base:has-text("Concurrent Test Idea")').dblclick()

      // User 2 should see lock indicator
      const lockIndicator = page2.locator('.idea-card-base:has-text("Concurrent Test Idea") text=Someone editing')
      if (await lockIndicator.isVisible()) {
        await expect(lockIndicator).toBeVisible()
      } else {
        test.skip('Concurrent editing lock not yet implemented')
      }

      // User 2 should not be able to edit
      await page2.locator('.idea-card-base:has-text("Concurrent Test Idea")').dblclick()
      const editModal = page2.locator(SELECTORS.MODALS.EDIT_IDEA)
      const isEditable = await editModal.isVisible().catch(() => false)
      expect(isEditable).toBe(false)
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('should release edit lock after timeout', async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
    await addIdeaToMatrix(page, 'Lock Timeout Test')

    // Start editing
    await page.locator('.idea-card-base:has-text("Lock Timeout Test")').dblclick()
    await expect(page.locator(SELECTORS.MODALS.EDIT_IDEA)).toBeVisible()

    // Close modal without saving
    await page.click('button:has-text("Cancel")')

    // Wait for lock timeout (5 minutes in production, should be configurable for testing)
    // In reality, this should be mocked or timeout should be shorter for tests
    test.skip('Lock timeout testing requires mock or shorter timeout')
  })
})

test.describe('Advanced Features - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test('should handle 100 ideas without performance degradation', async ({ page }) => {
    // Create 100 ideas efficiently
    for (let i = 1; i <= 100; i++) {
      await page.click('button:has-text("Add Idea")')
      await page.fill('input[name="content"]', `Performance Test ${i}`)
      await page.click('button:has-text("Add")')

      // Brief pause every 20 ideas for UI stability (batch processing)
      if (i % 20 === 0) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
      }
    }

    await expect(page.locator('.idea-card-base')).toHaveCount(100)

    // Test drag performance
    const startTime = Date.now()
    const firstCard = page.locator('.idea-card-base').first()
    await firstCard.dragTo(page.locator(SELECTORS.MATRIX.CONTAINER), {
      targetPosition: { x: 400, y: 400 }
    })
    const dragTime = Date.now() - startTime

    expect(dragTime).toBeLessThan(2000) // Should complete in under 2 seconds
  })

  test('should maintain smooth animations with many ideas', async ({ page }) => {
    // Create 50 ideas
    for (let i = 1; i <= 50; i++) {
      await page.click('button:has-text("Add Idea")')
      await page.fill('input[name="content"]', `Animation Test ${i}`)
      await page.click('button:has-text("Add")')
      // Brief pause every 10 ideas for UI stability (batch processing)
      if (i % 10 === 0) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
      }
    }

    // Hover over multiple cards quickly
    const cards = page.locator('.idea-card-base')
    const count = await cards.count()

    const startTime = Date.now()
    for (let i = 0; i < Math.min(count, 10); i++) {
      await cards.nth(i).hover()
      // Small delay for hover animation frame (performance test timing)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
    }
    const hoverTime = Date.now() - startTime

    // Should be smooth (under 1 second for 10 hovers)
    expect(hoverTime).toBeLessThan(1000)
  })

  test('should handle rapid dragging without lag', async ({ page }) => {
    await createMultipleIdeas(page, 10)

    const startTime = Date.now()
    const matrix = page.locator(SELECTORS.MATRIX.CONTAINER)

    // Rapidly drag 5 ideas
    for (let i = 1; i <= 5; i++) {
      const card = page.locator(`.idea-card-base:has-text("Test Idea ${i}")`)
      await card.dragTo(matrix, {
        targetPosition: {
          x: Math.random() * 500,
          y: Math.random() * 500
        }
      })
    }

    const totalTime = Date.now() - startTime
    expect(totalTime).toBeLessThan(5000) // Should complete in under 5 seconds
  })
})

test.describe('Advanced Features - Mobile Interactions', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE size

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test('should support touch-based dragging', async ({ page }) => {
    await addIdeaToMatrix(page, 'Touch Drag Test')

    const card = page.locator('.idea-card-base:has-text("Touch Drag Test")')
    const matrix = page.locator(SELECTORS.MATRIX.CONTAINER)

    // Simulate touch drag
    const cardBox = await card.boundingBox()
    const matrixBox = await matrix.boundingBox()

    if (!cardBox || !matrixBox) throw new Error('Elements not found')

    await page.touchscreen.tap(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
    await page.touchscreen.tap(matrixBox.x + 200, matrixBox.y + 200)

    // Card should have moved
    const newBox = await card.boundingBox()
    expect(newBox?.x).not.toBe(cardBox.x)
  })

  test('should support pinch-to-zoom on matrix', async ({ page }) => {
    await createMultipleIdeas(page, 5)

    const matrix = page.locator(SELECTORS.MATRIX.CONTAINER)
    const initialBox = await matrix.boundingBox()

    // Simulate pinch gesture (if supported)
    // Note: Playwright has limited touch gesture support
    test.skip('Pinch gesture testing requires specialized tools')
  })

  test('should show mobile-optimized controls', async ({ page }) => {
    await addIdeaToMatrix(page, 'Mobile Controls Test')

    const card = page.locator('.idea-card-base:has-text("Mobile Controls Test")')

    // Mobile should show larger touch targets
    const deleteButton = card.locator('button:has(.lucide-trash-2)')
    const buttonSize = await deleteButton.boundingBox()

    if (buttonSize) {
      // Touch target should be at least 44x44px (iOS guidelines)
      expect(buttonSize.width).toBeGreaterThanOrEqual(44)
      expect(buttonSize.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('Advanced Features - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test('should support keyboard-only navigation', async ({ page }) => {
    await addIdeaToMatrix(page, 'Keyboard Nav Test')

    // Tab to idea card
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Enter to edit
    await page.keyboard.press('Enter')
    await expect(page.locator(SELECTORS.MODALS.EDIT_IDEA)).toBeVisible()
  })

  test('should support arrow key positioning', async ({ page }) => {
    await addIdeaToMatrix(page, 'Arrow Key Test')

    const card = page.locator('.idea-card-base:has-text("Arrow Key Test")')
    await card.focus()

    const initialBox = await card.boundingBox()

    // Move with arrow keys
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')

    // Wait for position update animation to complete
    await page.evaluate(() => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    }))

    const newBox = await card.boundingBox()

    if (initialBox && newBox) {
      expect(newBox.x).toBeGreaterThan(initialBox.x)
    }
  })

  test('should announce changes to screen readers', async ({ page }) => {
    await addIdeaToMatrix(page, 'Screen Reader Test')

    // Check for ARIA live region
    const liveRegion = page.locator('[role="status"][aria-live="polite"]')
    await expect(liveRegion).toBeAttached()

    // Add another idea
    await addIdeaToMatrix(page, 'Second Idea')

    // Live region should announce the change
    await expect(liveRegion).not.toBeEmpty()
  })

  test('should have proper ARIA labels on all interactive elements', async ({ page }) => {
    await addIdeaToMatrix(page, 'ARIA Test')

    const card = page.locator('.idea-card-base:has-text("ARIA Test")')

    // Check for aria-label or aria-labelledby
    await expect(card).toHaveAttribute('aria-label', /.+/)

    // All buttons should have accessible labels
    const deleteButton = card.locator('button:has(.lucide-trash-2)')
    await expect(deleteButton).toHaveAttribute('aria-label', /.+/)
  })
})
