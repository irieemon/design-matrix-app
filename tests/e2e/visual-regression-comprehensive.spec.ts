import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive Visual Regression Test Suite
 *
 * Coverage:
 * - All major pages and views
 * - All modals and overlays
 * - All component states
 * - Responsive breakpoints
 * - Theme variations
 * - Interactive states
 * - Error and loading states
 * - Empty states
 */

// Test helper functions
async function loginAsTestUser(page: Page, userId: string = 'test-user', email: string = 'test@example.com') {
  // Navigate to app first
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Check if already logged in by looking for authenticated UI elements - Use data-testid
  const isLoggedIn = await page.getByTestId('design-matrix').or(page.locator('.matrix-container, text=Create Project')).isVisible({ timeout: 2000 }).catch(() => false);
  if (isLoggedIn) return;

  // Check for demo user button (visible on login screen) - Use data-testid
  const demoButton = page.getByTestId('auth-demo-button').or(page.locator('button:has-text("Demo User"), button:has-text("Continue as Demo")'));

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

  // Verify authentication worked - Use data-testid
  const isAuthenticated = await page.getByTestId('design-matrix').or(page.locator('.matrix-container, text=Create Project')).isVisible({ timeout: 3000 }).catch(() => false);

  if (!isAuthenticated) {
    throw new Error('Authentication failed - still on login screen');
  }
}

async function createTestIdea(page: Page, content: string, quadrant: 'quick-win' | 'strategic' | 'reconsider' | 'avoid') {
  const positions = {
    'quick-win': { x: 0.2, y: 0.8 },
    'strategic': { x: 0.8, y: 0.8 },
    'reconsider': { x: 0.2, y: 0.2 },
    'avoid': { x: 0.8, y: 0.2 }
  };

  return {
    id: `test-${Date.now()}-${Math.random()}`,
    content,
    matrix_position: positions[quadrant],
    created_at: new Date().toISOString(),
    user_id: 'test-user'
  };
}

test.describe('Visual Regression - Pages', () => {

  test('Page: Login Screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure we're on login screen
    const loginForm = page.locator('form, [data-testid="login-form"], button:has-text("Login")');
    await expect(loginForm.first()).toBeVisible({ timeout: 5000 });

    await expect(page).toHaveScreenshot('page-login.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Page: Dashboard Empty State', async ({ page }) => {
    await loginAsTestUser(page);

    // Clear all ideas
    await page.evaluate(() => {
      localStorage.removeItem('ideas');
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('page-dashboard-empty.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Page: Dashboard With Ideas', async ({ page }) => {
    await loginAsTestUser(page);

    // Add test ideas - already on authenticated page
    await page.evaluate(() => {
      const testIdeas = [
        {
          id: 'test-1',
          content: 'Quick Win: Optimize homepage load time',
          matrix_position: { x: 0.2, y: 0.8 },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        },
        {
          id: 'test-2',
          content: 'Strategic: Implement AI features',
          matrix_position: { x: 0.8, y: 0.8 },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        },
        {
          id: 'test-3',
          content: 'Reconsider: Legacy system migration',
          matrix_position: { x: 0.2, y: 0.2 },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        },
        {
          id: 'test-4',
          content: 'Avoid: Unnecessary infrastructure',
          matrix_position: { x: 0.8, y: 0.2 },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('page-dashboard-with-ideas.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Page: Matrix View Full', async ({ page }) => {
    await loginAsTestUser(page);

    // Navigate to matrix view
    const matrixLink = page.locator('a:has-text("Matrix"), [data-testid="matrix-link"]');
    if (await matrixLink.isVisible()) {
      await matrixLink.click();
      await page.waitForLoadState('networkidle');
    }

    await expect(page).toHaveScreenshot('page-matrix-full.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Page: User Settings', async ({ page }) => {
    await loginAsTestUser(page);

    // Navigate to settings
    const settingsLink = page.locator('a:has-text("Settings"), [data-testid="settings-link"], button:has-text("Settings")');
    if (await settingsLink.first().isVisible()) {
      await settingsLink.first().click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('page-settings.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('Page: Project Management', async ({ page }) => {
    await loginAsTestUser(page);

    // Navigate to projects
    const projectsLink = page.locator('a:has-text("Projects"), [data-testid="projects-link"]');
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('page-projects.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });
});

test.describe('Visual Regression - Modals', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('Modal: Add Idea', async ({ page }) => {
    const addButton = page.getByTestId('add-idea-button').or(page.locator('button:has-text("Add Idea")'));
    await addButton.first().click();

    const modal = page.getByTestId('add-idea-modal').or(page.locator('[role="dialog"]'));
    await expect(modal).toBeVisible();

    await expect(page).toHaveScreenshot('modal-add-idea.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Modal: Add Idea - Filled Form', async ({ page }) => {
    const addButton = page.getByTestId('add-idea-button').or(page.locator('button:has-text("Add Idea")'));
    await addButton.first().click();

    const modal = page.getByTestId('add-idea-modal').or(page.locator('[role="dialog"]'));
    await expect(modal).toBeVisible();

    // Fill form - Use data-testid
    const contentInput = page.getByTestId('idea-content-input').or(page.locator('input[name="content"], textarea[name="content"]'));
    await contentInput.fill('Test idea content with detailed description');

    await expect(page).toHaveScreenshot('modal-add-idea-filled.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Modal: Edit Idea', async ({ page }) => {
    // Add a test idea first - already on authenticated page
    await page.evaluate(() => {
      const testIdea = [{
        id: 'edit-test',
        content: 'Idea to edit',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click idea to edit
    const ideaCard = page.locator('text=Idea to edit').first();
    await ideaCard.click();

    const modal = page.getByTestId('edit-idea-modal').or(page.locator('[role="dialog"]'));
    if (await modal.isVisible()) {
      await expect(page).toHaveScreenshot('modal-edit-idea.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('Modal: AI Insights', async ({ page }) => {
    const aiButton = page.locator('button:has-text("AI"), [data-testid="ai-insights-button"]');
    if (await aiButton.first().isVisible()) {
      await aiButton.first().click();

      const modal = page.locator('[role="dialog"], [data-testid="ai-insights-modal"]');
      await expect(modal).toBeVisible();

      await expect(page).toHaveScreenshot('modal-ai-insights.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('Modal: Feature Detail', async ({ page }) => {
    // Add idea with details
    await page.evaluate(() => {
      const testIdea = [{
        id: 'detail-test',
        content: 'Idea with full details',
        description: 'Detailed description of the feature',
        tags: ['feature', 'important'],
        matrix_position: { x: 0.7, y: 0.7 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const ideaCard = page.locator('text=Idea with full details').first();
    await ideaCard.click();

    const detailModal = page.locator('[data-testid="feature-detail-modal"], [role="dialog"]');
    if (await detailModal.isVisible()) {
      await expect(page).toHaveScreenshot('modal-feature-detail.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('Modal: Confirm Delete', async ({ page }) => {
    // Add test idea
    await page.evaluate(() => {
      const testIdea = [{
        id: 'delete-test',
        content: 'Idea to delete',
        matrix_position: { x: 0.3, y: 0.3 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Try to delete
    const ideaCard = page.locator('text=Idea to delete').first();
    await ideaCard.hover();

    const deleteButton = page.locator('button[aria-label*="Delete"], button:has-text("Delete")');
    if (await deleteButton.first().isVisible()) {
      await deleteButton.first().click();

      const confirmModal = page.locator('[role="dialog"]:has-text("Delete"), [role="alertdialog"]');
      if (await confirmModal.isVisible()) {
        await expect(page).toHaveScreenshot('modal-confirm-delete.png', {
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
  });
});

test.describe('Visual Regression - Components', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('Component: Idea Card - Default State', async ({ page }) => {
    await page.evaluate(() => {
      const testIdea = [{
        id: 'card-test',
        content: 'Test Idea Card',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const ideaCard = page.locator('text=Test Idea Card').first();
    await expect(ideaCard).toBeVisible();

    await expect(ideaCard).toHaveScreenshot('component-idea-card-default.png');
  });

  test('Component: Idea Card - Hover State', async ({ page }) => {
    await page.evaluate(() => {
      const testIdea = [{
        id: 'hover-test',
        content: 'Hover Test Card',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const ideaCard = page.locator('text=Hover Test Card').first();
    await ideaCard.hover();
    await page.waitForTimeout(300);

    await expect(ideaCard).toHaveScreenshot('component-idea-card-hover.png');
  });

  test('Component: Idea Card - Dragging State', async ({ page }) => {
    await page.evaluate(() => {
      const testIdea = [{
        id: 'drag-test',
        content: 'Drag Test Card',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const ideaCard = page.locator('text=Drag Test Card').first();
    await ideaCard.hover();
    await page.mouse.down();
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('component-idea-card-dragging.png', {
      fullPage: true,
      animations: 'disabled'
    });

    await page.mouse.up();
  });

  test('Component: Sidebar - Collapsed', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"], nav, aside').first();

    const toggleButton = page.locator('button[aria-label*="menu"], button[aria-label*="sidebar"]').first();
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await page.waitForTimeout(300);
    }

    await expect(sidebar).toHaveScreenshot('component-sidebar-collapsed.png');
  });

  test('Component: Sidebar - Expanded', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"], nav, aside').first();

    const toggleButton = page.locator('button[aria-label*="menu"], button[aria-label*="sidebar"]').first();
    if (await toggleButton.isVisible()) {
      // Ensure expanded
      await toggleButton.click();
      await page.waitForTimeout(300);
      await toggleButton.click();
      await page.waitForTimeout(300);
    }

    await expect(sidebar).toHaveScreenshot('component-sidebar-expanded.png');
  });

  test('Component: Quadrant Labels', async ({ page }) => {
    const matrix = page.getByTestId('design-matrix').or(page.locator('.matrix-container')).first();

    await expect(matrix).toHaveScreenshot('component-quadrant-labels.png');
  });

  test('Component: Button - Primary', async ({ page }) => {
    const primaryButton = page.locator('button:has-text("Add Idea")').first();
    await expect(primaryButton).toBeVisible();

    await expect(primaryButton).toHaveScreenshot('component-button-primary.png');
  });

  test('Component: Button - Secondary', async ({ page }) => {
    const secondaryButton = page.locator('button:has-text("Cancel")').first();
    if (await secondaryButton.isVisible()) {
      await expect(secondaryButton).toHaveScreenshot('component-button-secondary.png');
    }
  });

  test('Component: Form Input', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Idea")').first();
    await addButton.click();

    const input = page.locator('input, textarea').first();
    await expect(input).toBeVisible();

    await expect(input).toHaveScreenshot('component-form-input.png');
  });

  test('Component: Loading Spinner', async ({ page }) => {
    // Trigger loading state if possible
    const spinner = page.locator('[data-testid="loading"], .spinner, [role="status"]');
    if (await spinner.first().isVisible()) {
      await expect(spinner.first()).toHaveScreenshot('component-loading-spinner.png');
    }
  });
});

test.describe('Visual Regression - Responsive Breakpoints', () => {

  const breakpoints = [
    { name: 'Mobile Small', width: 320, height: 568 },
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Mobile Large', width: 414, height: 896 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Desktop Large', width: 1920, height: 1080 },
    { name: 'Desktop Wide', width: 2560, height: 1440 }
  ];

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);

    // Add test ideas
    await page.evaluate(() => {
      const testIdeas = [
        {
          id: 'resp-1',
          content: 'Quick Win Test',
          matrix_position: { x: 0.2, y: 0.8 },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        },
        {
          id: 'resp-2',
          content: 'Strategic Test',
          matrix_position: { x: 0.8, y: 0.8 },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  for (const breakpoint of breakpoints) {
    test(`Responsive: ${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`responsive-${breakpoint.name.toLowerCase().replace(/\s+/g, '-')}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    });
  }
});

test.describe('Visual Regression - Quadrants with Ideas', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('Quadrant: Quick Wins - Multiple Ideas', async ({ page }) => {
    await page.evaluate(() => {
      const ideas = Array.from({ length: 5 }, (_, i) => ({
        id: `qw-${i}`,
        content: `Quick Win ${i + 1}`,
        matrix_position: { x: 0.15 + (i * 0.05), y: 0.75 + (i * 0.03) },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(ideas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('quadrant-quick-wins.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Quadrant: Strategic - Multiple Ideas', async ({ page }) => {
    await page.evaluate(() => {
      const ideas = Array.from({ length: 5 }, (_, i) => ({
        id: `st-${i}`,
        content: `Strategic ${i + 1}`,
        matrix_position: { x: 0.75 + (i * 0.03), y: 0.75 + (i * 0.03) },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(ideas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('quadrant-strategic.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Quadrant: Reconsider - Multiple Ideas', async ({ page }) => {
    await page.evaluate(() => {
      const ideas = Array.from({ length: 5 }, (_, i) => ({
        id: `rc-${i}`,
        content: `Reconsider ${i + 1}`,
        matrix_position: { x: 0.15 + (i * 0.05), y: 0.15 + (i * 0.03) },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(ideas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('quadrant-reconsider.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Quadrant: Avoid - Multiple Ideas', async ({ page }) => {
    await page.evaluate(() => {
      const ideas = Array.from({ length: 5 }, (_, i) => ({
        id: `av-${i}`,
        content: `Avoid ${i + 1}`,
        matrix_position: { x: 0.75 + (i * 0.03), y: 0.15 + (i * 0.03) },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(ideas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('quadrant-avoid.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('All Quadrants: Balanced Distribution', async ({ page }) => {
    await page.evaluate(() => {
      const ideas = [
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `qw-${i}`,
          content: `Quick Win ${i + 1}`,
          matrix_position: { x: 0.2 + (i * 0.05), y: 0.8 - (i * 0.03) },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `st-${i}`,
          content: `Strategic ${i + 1}`,
          matrix_position: { x: 0.7 + (i * 0.05), y: 0.8 - (i * 0.03) },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `rc-${i}`,
          content: `Reconsider ${i + 1}`,
          matrix_position: { x: 0.2 + (i * 0.05), y: 0.3 + (i * 0.03) },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `av-${i}`,
          content: `Avoid ${i + 1}`,
          matrix_position: { x: 0.7 + (i * 0.05), y: 0.3 + (i * 0.03) },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        }))
      ];
      localStorage.setItem('ideas', JSON.stringify(ideas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('quadrants-all-balanced.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});

test.describe('Visual Regression - States', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('State: Error - Invalid Data', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ideas', 'invalid-json-data');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('state-error-invalid-data.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('State: Loading - Initial Load', async ({ page }) => {
    // Intercept and delay requests to capture loading state
    await page.route('**/api/**', route => {
      setTimeout(() => route.continue(), 2000);
    });

    const loadPromise = page.goto('/');

    // Try to capture loading state
    await page.waitForTimeout(500);

    const hasLoadingState = await page.locator('[data-testid="loading"], .spinner, [role="status"]').isVisible().catch(() => false);

    if (hasLoadingState) {
      await expect(page).toHaveScreenshot('state-loading-initial.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }

    await loadPromise;
  });

  test('State: Empty - No Ideas', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('ideas');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('state-empty-no-ideas.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('State: Empty - No Projects', async ({ page }) => {
    const projectsLink = page.locator('a:has-text("Projects"), [data-testid="projects-link"]');
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('state-empty-no-projects.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('State: Success - Idea Added', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Idea")').first();
    await addButton.click();

    await page.fill('input, textarea', 'New successful idea');

    const submitButton = page.locator('button[type="submit"], button:has-text("Add"), button:has-text("Save")').first();
    await submitButton.click();

    await page.waitForTimeout(500);

    const successMessage = page.locator('[role="status"], .success, text=/successfully/i');
    if (await successMessage.isVisible()) {
      await expect(page).toHaveScreenshot('state-success-idea-added.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });
});
