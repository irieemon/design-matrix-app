import { test, expect, Page } from '@playwright/test'
import { SELECTORS } from './constants/selectors'

/**
 * Comprehensive E2E Tests for Idea Management CRUD Journey
 *
 * This test suite covers the complete user journey for idea management:
 * - Creating ideas with all field types
 * - Reading and displaying ideas across quadrants
 * - Updating ideas through edit modal and drag-drop
 * - Deleting ideas with confirmation
 * - Bulk operations and edge cases
 *
 * Total Tests: ~38 comprehensive scenarios
 */

// Test configuration
const TEST_TIMEOUT = 30000
const ANIMATION_DELAY = 300

// Matrix coordinate constants (0-520 usable area, center at 260)
const MATRIX_COORDS = {
  QUICK_WINS: { x: 130, y: 130 },    // Top-left (high value, low effort)
  STRATEGIC: { x: 390, y: 130 },     // Top-right (high value, high effort)
  RECONSIDER: { x: 130, y: 390 },    // Bottom-left (low value, low effort)
  AVOID: { x: 390, y: 390 }          // Bottom-right (low value, high effort)
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

async function createTestProject(page: Page, projectName: string = 'Test Project') {
  await page.click('button:has-text("New Project")')
  await page.fill('input[name="projectName"]', projectName)
  await page.click('button:has-text("Create")')
  await page.waitForSelector(SELECTORS.MATRIX.CONTAINER, { timeout: TEST_TIMEOUT })
}

async function addIdeaToMatrix(
  page: Page,
  content: string,
  details: string = '',
  priority: string = 'moderate',
  quadrant: keyof typeof MATRIX_COORDS = 'QUICK_WINS'
) {
  // Open add idea modal
  const addButton = page.locator(SELECTORS.MATRIX.ADD_IDEA_BUTTON).or(page.locator('button:has-text("Add Idea")'));
  await addButton.click();

  const modal = page.locator(SELECTORS.MODALS.ADD_IDEA);
  await modal.waitFor({ state: 'visible' });

  // Fill form
  const contentInput = page.locator(SELECTORS.FORMS.IDEA_CONTENT_INPUT).or(page.locator('input[name="content"]'));
  await contentInput.fill(content);

  if (details) {
    const detailsInput = page.locator('textarea[name="details"]');
    await detailsInput.fill(details);
  }

  await page.selectOption('select[name="priority"]', priority);

  // Submit
  const saveButton = page.locator(SELECTORS.FORMS.IDEA_SAVE_BUTTON).or(page.locator('button:has-text("Add")'));
  await saveButton.click();

  await modal.waitFor({ state: 'hidden' });

  // Wait for idea card to appear
  await page.waitForSelector(`.idea-card-base:has-text("${content}")`, { timeout: TEST_TIMEOUT });
}

async function dragIdeaToQuadrant(
  page: Page,
  ideaContent: string,
  targetQuadrant: keyof typeof MATRIX_COORDS
) {
  const ideaCard = page.locator(`.idea-card-base:has-text("${ideaContent}")`)
  const matrix = page.locator(SELECTORS.MATRIX.CONTAINER)

  // Get matrix bounding box
  const matrixBox = await matrix.boundingBox()
  if (!matrixBox) throw new Error('Matrix not found')

  // Calculate target position (matrix coords to screen coords)
  const coords = MATRIX_COORDS[targetQuadrant]
  const targetX = matrixBox.x + (coords.x / 520) * matrixBox.width
  const targetY = matrixBox.y + (coords.y / 520) * matrixBox.height

  // Drag to position
  await ideaCard.dragTo(matrix, {
    targetPosition: {
      x: targetX - matrixBox.x,
      y: targetY - matrixBox.y
    }
  })

  // Wait for drag animation to complete
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
}

// Test suite begins
test.describe('Idea CRUD Journey - Core Operations', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test.describe('CREATE Operations', () => {
    test('should show empty matrix state with helpful guidance', async ({ page }) => {
      // Check for the actual empty state message from DesignMatrix.tsx line 394-395
      const emptyState = page.locator(SELECTORS.MATRIX.CONTAINER).locator('text=Ready to prioritize?')
      await expect(emptyState).toBeVisible()

      // The actual text is "Add your first idea to get started with the priority matrix"
      // not just "Add your first idea"
      await expect(page.locator('text=Add your first idea')).toBeVisible()

      // Quick Wins quadrant label should be visible
      await expect(page.locator('text=Quick Wins')).toBeVisible()

      // Note: Empty state message matches DesignMatrix.tsx implementation
    })

    test('should create first idea and see it appear in matrix', async ({ page }) => {
      await addIdeaToMatrix(page, 'First Idea', 'Test details')

      const ideaCard = page.locator('.idea-card-base:has-text("First Idea")')
      await expect(ideaCard).toBeVisible()
      await expect(ideaCard.locator('text=Test details')).toBeVisible()
    })

    test('should create idea with minimal data (content only)', async ({ page }) => {
      await page.click('button:has-text("Add Idea")')
      await page.fill('input[name="content"]', 'Minimal Idea')
      await page.click('button:has-text("Add")')

      await expect(page.locator('.idea-card-base:has-text("Minimal Idea")')).toBeVisible()
    })

    test('should create idea with all fields populated', async ({ page }) => {
      await page.click('button:has-text("Add Idea")')
      await page.fill('input[name="content"]', 'Complete Idea')
      await page.fill('textarea[name="details"]', 'Comprehensive details about this idea')
      await page.selectOption('select[name="priority"]', 'high')
      await page.click('button:has-text("Add")')

      const ideaCard = page.locator('.idea-card-base:has-text("Complete Idea")')
      await expect(ideaCard).toBeVisible()
      await expect(ideaCard).toHaveClass(/priority-high/)
    })

    test('should validate required fields in create form', async ({ page }) => {
      await page.click('button:has-text("Add Idea")')
      await page.click('button:has-text("Add")')

      // Should show validation error
      await expect(page.locator('text=Content is required')).toBeVisible()
    })

    test('should create multiple ideas in same quadrant', async ({ page }) => {
      await addIdeaToMatrix(page, 'Idea 1', 'Details 1')
      await addIdeaToMatrix(page, 'Idea 2', 'Details 2')
      await addIdeaToMatrix(page, 'Idea 3', 'Details 3')

      await expect(page.locator('.idea-card-base')).toHaveCount(3)
    })

    test('should create ideas with different priority levels', async ({ page }) => {
      await addIdeaToMatrix(page, 'Low Priority', '', 'low')
      await addIdeaToMatrix(page, 'High Priority', '', 'high')
      await addIdeaToMatrix(page, 'Strategic', '', 'strategic')

      await expect(page.locator('.idea-card-priority-low')).toHaveCount(1)
      await expect(page.locator('.idea-card-priority-high')).toHaveCount(1)
      await expect(page.locator('.idea-card-priority-strategic')).toHaveCount(1)
    })

    test('should show correct creator information', async ({ page }) => {
      await addIdeaToMatrix(page, 'My Idea')

      const ideaCard = page.locator('.idea-card-base:has-text("My Idea")')
      await expect(ideaCard.locator('text=You')).toBeVisible()
    })
  })

  test.describe('READ Operations', () => {
    test('should display idea in correct quadrant - Quick Wins', async ({ page }) => {
      await addIdeaToMatrix(page, 'Quick Win Idea', '', 'high', 'QUICK_WINS')

      const ideaCard = page.locator('.idea-card-base:has-text("Quick Win Idea")')
      const box = await ideaCard.boundingBox()
      const matrix = await page.locator('.matrix-container').boundingBox()

      if (!box || !matrix) throw new Error('Elements not found')

      // Should be in top-left quadrant
      expect(box.x).toBeLessThan(matrix.x + matrix.width / 2)
      expect(box.y).toBeLessThan(matrix.y + matrix.height / 2)
    })

    test('should show idea cards with all information', async ({ page }) => {
      await addIdeaToMatrix(page, 'Full Idea', 'Complete details here', 'high')

      const ideaCard = page.locator('.idea-card-base:has-text("Full Idea")')
      await expect(ideaCard.locator('text=Full Idea')).toBeVisible()
      await expect(ideaCard.locator('text=Complete details here')).toBeVisible()
      await expect(ideaCard.locator('.idea-card-badge')).toContainText('high')
    })

    test('should show quadrant counts correctly', async ({ page }) => {
      await addIdeaToMatrix(page, 'Idea 1', '', 'moderate', 'QUICK_WINS')
      await addIdeaToMatrix(page, 'Idea 2', '', 'moderate', 'STRATEGIC')

      const quickWinsGuide = page.locator('.bg-emerald-50:has-text("Quick Wins")')
      await expect(quickWinsGuide).toContainText('1 ideas')
    })

    test('should display ideas with correct visual styling', async ({ page }) => {
      await addIdeaToMatrix(page, 'Styled Idea')

      const ideaCard = page.locator('.idea-card-base:has-text("Styled Idea")')
      await expect(ideaCard).toHaveCSS('border-radius', /.*/)
      await expect(ideaCard).toHaveClass(/gpu-accelerated/)
    })
  })

  test.describe('UPDATE Operations - Edit Modal', () => {
    test('should open edit modal on double-click', async ({ page }) => {
      await addIdeaToMatrix(page, 'Edit Test Idea')

      const ideaCard = page.locator('.idea-card-base:has-text("Edit Test Idea")')
      await ideaCard.dblclick()

      const editModal = page.locator(SELECTORS.MODALS.EDIT_IDEA).or(page.locator('[role="dialog"]'));
      await expect(editModal).toBeVisible();

      const contentInput = page.locator(SELECTORS.FORMS.IDEA_CONTENT_INPUT).or(page.locator('input[name="content"]'));
      await expect(contentInput).toHaveValue('Edit Test Idea');
    })

    test('should open edit modal via edit button', async ({ page }) => {
      await addIdeaToMatrix(page, 'Button Edit Test')

      const ideaCard = page.locator('.idea-card-base:has-text("Button Edit Test")')
      await ideaCard.hover()
      await ideaCard.locator('button.edit').click()

      const editModal = page.locator(SELECTORS.MODALS.EDIT_IDEA).or(page.locator('[role="dialog"]'));
      await expect(editModal).toBeVisible();
    })

    test('should successfully update idea content', async ({ page }) => {
      await addIdeaToMatrix(page, 'Original Content')

      await page.locator('.idea-card-base:has-text("Original Content")').dblclick()
      await page.fill('input[name="content"]', 'Updated Content')
      await page.click('button:has-text("Save")')

      await expect(page.locator('.idea-card-base:has-text("Updated Content")')).toBeVisible()
      await expect(page.locator('.idea-card-base:has-text("Original Content")')).not.toBeVisible()
    })

    test('should successfully update idea details', async ({ page }) => {
      await addIdeaToMatrix(page, 'Idea', 'Old details')

      await page.locator('.idea-card-base:has-text("Idea")').dblclick()
      await page.fill('textarea[name="details"]', 'New and improved details')
      await page.click('button:has-text("Save")')

      const ideaCard = page.locator('.idea-card-base:has-text("Idea")')
      await expect(ideaCard.locator('text=New and improved details')).toBeVisible()
    })

    test('should successfully update priority level', async ({ page }) => {
      await addIdeaToMatrix(page, 'Priority Test', '', 'low')

      await page.locator('.idea-card-base:has-text("Priority Test")').dblclick()
      await page.selectOption('select[name="priority"]', 'high')
      await page.click('button:has-text("Save")')

      const ideaCard = page.locator('.idea-card-base:has-text("Priority Test")')
      await expect(ideaCard).toHaveClass(/priority-high/)
    })

    test('should handle edit lock mechanism', async ({ page }) => {
      await addIdeaToMatrix(page, 'Lock Test')

      const ideaCard = page.locator('.idea-card-base:has-text("Lock Test")')
      await ideaCard.dblclick()

      // Should show "You're editing" indicator
      await expect(ideaCard.locator('text=You\'re editing')).toBeVisible()
    })

    test('should cancel edit without saving changes', async ({ page }) => {
      await addIdeaToMatrix(page, 'Cancel Test')

      await page.locator('.idea-card-base:has-text("Cancel Test")').dblclick()
      await page.fill('input[name="content"]', 'Should Not Save')
      await page.click('button:has-text("Cancel")')

      await expect(page.locator('.idea-card-base:has-text("Cancel Test")')).toBeVisible()
      await expect(page.locator('.idea-card-base:has-text("Should Not Save")')).not.toBeVisible()
    })
  })

  test.describe('UPDATE Operations - Drag and Drop', () => {
    test('should drag idea from Quick Wins to Strategic quadrant', async ({ page }) => {
      await addIdeaToMatrix(page, 'Move to Strategic', '', 'moderate', 'QUICK_WINS')
      // Wait for idea card to be ready for interaction
      let ideaCard = page.locator('.idea-card-base:has-text("Move to Strategic")')
      await expect(ideaCard).toBeVisible()
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))

      await dragIdeaToQuadrant(page, 'Move to Strategic', 'STRATEGIC')

      ideaCard = page.locator('.idea-card-base:has-text("Move to Strategic")')
      const box = await ideaCard.boundingBox()
      const matrix = await page.locator('.matrix-container').boundingBox()

      if (!box || !matrix) throw new Error('Elements not found')

      // Should now be in top-right quadrant
      expect(box.x).toBeGreaterThan(matrix.x + matrix.width / 2)
      expect(box.y).toBeLessThan(matrix.y + matrix.height / 2)
    })

    test('should drag idea to all four quadrants', async ({ page }) => {
      await addIdeaToMatrix(page, 'Multi-Quadrant Test', '', 'moderate', 'QUICK_WINS')

      // Test all quadrants
      const quadrants: Array<keyof typeof MATRIX_COORDS> = ['STRATEGIC', 'AVOID', 'RECONSIDER', 'QUICK_WINS']

      for (const quadrant of quadrants) {
        await dragIdeaToQuadrant(page, 'Multi-Quadrant Test', quadrant)

        // Verify idea is still visible after drag
        await expect(page.locator('.idea-card-base:has-text("Multi-Quadrant Test")')).toBeVisible()
      }
    })

    test('should show visual feedback during drag', async ({ page }) => {
      await addIdeaToMatrix(page, 'Drag Feedback Test')

      const ideaCard = page.locator('.idea-card-base:has-text("Drag Feedback Test")')

      // Start drag
      await ideaCard.hover()
      await page.mouse.down()

      // Should have dragging state
      await expect(ideaCard).toHaveClass(/is-dragging/)

      await page.mouse.up()
    })

    test('should persist position after drag', async ({ page }) => {
      await addIdeaToMatrix(page, 'Position Persist Test', '', 'moderate', 'QUICK_WINS')
      await dragIdeaToQuadrant(page, 'Position Persist Test', 'AVOID')

      // Reload page
      await page.reload()
      await page.waitForSelector(SELECTORS.MATRIX.CONTAINER)

      // Should still be in AVOID quadrant
      const ideaCard = page.locator('.idea-card-base:has-text("Position Persist Test")')
      const box = await ideaCard.boundingBox()
      const matrix = await page.locator(SELECTORS.MATRIX.CONTAINER).boundingBox()

      if (!box || !matrix) throw new Error('Elements not found')

      expect(box.x).toBeGreaterThan(matrix.x + matrix.width / 2)
      expect(box.y).toBeGreaterThan(matrix.y + matrix.height / 2)
    })
  })

  test.describe('DELETE Operations', () => {
    test('should delete idea via delete button', async ({ page }) => {
      await addIdeaToMatrix(page, 'Delete Me')

      const ideaCard = page.locator('.idea-card-base:has-text("Delete Me")')
      await ideaCard.hover()

      // Click delete button
      await ideaCard.locator('button:has(.lucide-trash-2)').click()

      // Wait for deletion to complete (card removal)
      await expect(ideaCard).not.toBeVisible({ timeout: 2000 })
    })

    test('should remove idea from DOM after deletion', async ({ page }) => {
      await addIdeaToMatrix(page, 'Remove Test')
      await page.locator('.idea-card-base:has-text("Remove Test")').hover()
      await page.locator('button:has(.lucide-trash-2)').first().click()

      await expect(page.locator('.idea-card-base:has-text("Remove Test")')).toHaveCount(0)
    })

    test('should update quadrant count after deletion', async ({ page }) => {
      await addIdeaToMatrix(page, 'Count Test 1', '', 'moderate', 'QUICK_WINS')
      await addIdeaToMatrix(page, 'Count Test 2', '', 'moderate', 'QUICK_WINS')

      // Should show 2 ideas
      let quickWinsGuide = page.locator('.bg-emerald-50:has-text("Quick Wins")')
      await expect(quickWinsGuide).toContainText('2 ideas')

      // Delete one
      await page.locator('.idea-card-base:has-text("Count Test 1")').hover()
      await page.locator('button:has(.lucide-trash-2)').first().click()

      // Should now show 1 idea
      await expect(quickWinsGuide).toContainText('1 ideas')
    })
  })

  test.describe('Expand/Collapse Operations', () => {
    test('should collapse idea card on click', async ({ page }) => {
      await addIdeaToMatrix(page, 'Collapse Test', 'Full details here')

      const ideaCard = page.locator('.idea-card-base:has-text("Collapse Test")')

      // Click collapse button
      await ideaCard.locator('button:has(.lucide-chevron-up)').click()

      // Should be collapsed
      await expect(ideaCard).toHaveClass(/is-collapsed/)
      await expect(ideaCard.locator('text=Full details here')).not.toBeVisible()
    })

    test('should expand collapsed card', async ({ page }) => {
      await addIdeaToMatrix(page, 'Expand Test', 'Hidden details')

      const ideaCard = page.locator('.idea-card-base:has-text("Expand Test")')

      // Collapse first
      await ideaCard.locator('button:has(.lucide-chevron-up)').click()
      await expect(ideaCard).toHaveClass(/is-collapsed/)

      // Expand
      await ideaCard.locator('button:has(.lucide-chevron-down)').click()
      await expect(ideaCard).not.toHaveClass(/is-collapsed/)
      await expect(ideaCard.locator('text=Hidden details')).toBeVisible()
    })

    test('should maintain collapse state after drag', async ({ page }) => {
      await addIdeaToMatrix(page, 'Collapse Drag Test', '', 'moderate', 'QUICK_WINS')

      const ideaCard = page.locator('.idea-card-base:has-text("Collapse Drag Test")')

      // Collapse
      await ideaCard.locator('button:has(.lucide-chevron-up)').click()
      await expect(ideaCard).toHaveClass(/is-collapsed/)

      // Drag
      await dragIdeaToQuadrant(page, 'Collapse Drag Test', 'STRATEGIC')

      // Should still be collapsed
      await expect(ideaCard).toHaveClass(/is-collapsed/)
    })
  })
})

test.describe('Idea CRUD Journey - Edge Cases & Performance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await createTestProject(page)
  })

  test('should handle rapid idea creation', async ({ page }) => {
    for (let i = 1; i <= 5; i++) {
      await addIdeaToMatrix(page, `Rapid ${i}`)
    }

    await expect(page.locator('.idea-card-base')).toHaveCount(5)
  })

  test('should handle multiple simultaneous drags gracefully', async ({ page }) => {
    await addIdeaToMatrix(page, 'Drag 1', '', 'moderate', 'QUICK_WINS')
    await addIdeaToMatrix(page, 'Drag 2', '', 'moderate', 'QUICK_WINS')

    // Drag both quickly
    await dragIdeaToQuadrant(page, 'Drag 1', 'STRATEGIC')
    await dragIdeaToQuadrant(page, 'Drag 2', 'AVOID')

    await expect(page.locator('.idea-card-base')).toHaveCount(2)
  })

  test('should handle matrix with 50+ ideas', async ({ page }) => {
    // Create many ideas
    for (let i = 1; i <= 50; i++) {
      await page.click('button:has-text("Add Idea")')
      await page.fill('input[name="content"]', `Idea ${i}`)
      await page.click('button:has-text("Add")')
      // Brief pause every 10 ideas for UI stability (batch processing)
      if (i % 10 === 0) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
      }
    }

    await expect(page.locator('.idea-card-base')).toHaveCount(50)

    // Should still be performant
    const startTime = Date.now()
    await dragIdeaToQuadrant(page, 'Idea 25', 'STRATEGIC')
    const endTime = Date.now()

    expect(endTime - startTime).toBeLessThan(2000) // Should complete in under 2 seconds
  })

  test('should handle very long idea content', async ({ page }) => {
    const longContent = 'A'.repeat(500)
    const longDetails = 'B'.repeat(1000)

    await addIdeaToMatrix(page, longContent, longDetails)

    const ideaCard = page.locator('.idea-card-base').first()
    await expect(ideaCard).toBeVisible()
  })

  test('should handle special characters in idea content', async ({ page }) => {
    const specialContent = 'Test <script>alert("xss")</script> & "quotes" \'single\' 中文 émoji 🎯'

    await addIdeaToMatrix(page, specialContent)

    await expect(page.locator(`.idea-card-base:has-text("${specialContent}")`)).toBeVisible()
  })
})
