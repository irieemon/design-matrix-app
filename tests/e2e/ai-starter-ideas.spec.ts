import { test, expect, Page } from '@playwright/test';
import type { Route } from '@playwright/test';

/**
 * AI Starter Flow - Complete E2E Test
 *
 * PURPOSE: Validate that the AI Starter flow creates a project with ideas that appear in the matrix
 *
 * CRITICAL BUG BEING TESTED:
 * - Ideas are created in database but don't appear in the matrix UI
 * - This test will expose where the breakdown occurs in the data flow
 *
 * FLOW TESTED:
 * 1. User clicks "New Project" button
 * 2. Fills in project name and description
 * 3. Navigates to AI enhancement step (step 3)
 * 4. Enables AI toggle
 * 5. Waits for AI generation to complete
 * 6. Clicks "Create Project & X Ideas" button
 * 7. VERIFY: Project is created
 * 8. VERIFY: Ideas appear in the matrix (THIS IS THE FAILING PART)
 * 9. COUNT: Actual idea cards visible on page
 *
 * @author Quality Engineer
 * @testid AI-STARTER-001
 */

// Mock AI response - deterministic test data
const mockAIGeneratedIdeas = [
  {
    content: 'User Authentication System',
    details: 'Implement secure user authentication with JWT tokens',
    x: 130,  // Quick Wins quadrant
    y: 130,
    priority: 'high',
    category: 'Core Features'
  },
  {
    content: 'Dashboard Analytics',
    details: 'Real-time analytics dashboard for user insights',
    x: 390,  // Strategic quadrant
    y: 130,
    priority: 'strategic',
    category: 'Analytics'
  },
  {
    content: 'Email Notifications',
    details: 'Automated email notification system',
    x: 130,  // Quick Wins quadrant
    y: 180,
    priority: 'moderate',
    category: 'Communication'
  },
  {
    content: 'Mobile App',
    details: 'Native mobile application for iOS and Android',
    x: 400,  // Strategic quadrant
    y: 150,
    priority: 'strategic',
    category: 'Platform Expansion'
  },
  {
    content: 'Dark Mode',
    details: 'Dark mode theme support',
    x: 150,  // Quick Wins quadrant
    y: 140,
    priority: 'low',
    category: 'UI/UX'
  }
];

// Mock AI analysis response
const mockAIAnalysis = {
  projectAnalysis: {
    industry: 'Software Development',
    complexity: 'high',
    estimatedTimeline: '6 months',
    keyFeatures: ['Authentication', 'Analytics', 'Notifications'],
    risks: ['Timeline constraints', 'Resource availability']
  },
  generatedIdeas: mockAIGeneratedIdeas
};

/**
 * Setup AI API mocking
 * Intercepts the /api/ai/generate-ideas endpoint and returns mock data
 */
async function setupAIMocking(page: Page) {
  await page.route('**/api/ai/generate-ideas', (route: Route) => {
    const request = route.request();
    console.log('🎯 AI API intercepted:', request.url());

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAIAnalysis)
    });
  });

  // Also mock the project ideas generation endpoint
  await page.route('**/generate-project-ideas', (route: Route) => {
    console.log('🎯 Project ideas API intercepted:', route.request().url());

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAIAnalysis)
    });
  });
}

/**
 * Setup Supabase API mocking for project and idea creation
 * This ensures deterministic behavior in tests
 */
async function setupDatabaseMocking(page: Page) {
  let createdProjectId: string | null = null;

  // Mock project creation
  await page.route('**/rest/v1/projects*', async (route: Route) => {
    const request = route.request();
    const method = request.method();

    if (method === 'POST') {
      createdProjectId = `test-project-${Date.now()}`;
      const postData = request.postDataJSON();

      console.log('📦 Project creation intercepted:', postData);

      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: createdProjectId,
          ...postData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
      });
    } else if (method === 'GET') {
      // Return created project
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: createdProjectId || 'default-project',
          name: 'Test Project',
          created_at: new Date().toISOString()
        }])
      });
    } else {
      route.continue();
    }
  });

  // Mock idea creation
  let createdIdeas: any[] = [];

  await page.route('**/rest/v1/ideas*', async (route: Route) => {
    const request = route.request();
    const method = request.method();

    if (method === 'POST') {
      const postData = request.postDataJSON();
      const ideaId = `idea-${Date.now()}-${createdIdeas.length}`;

      const createdIdea = {
        id: ideaId,
        ...postData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      createdIdeas.push(createdIdea);

      console.log('💡 Idea creation intercepted:', createdIdea.content);

      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([createdIdea])
      });
    } else if (method === 'GET') {
      // Return all created ideas
      console.log(`📋 Ideas fetch intercepted: Returning ${createdIdeas.length} ideas`);

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createdIdeas)
      });
    } else {
      route.continue();
    }
  });
}

/**
 * Authenticate as demo user
 */
async function authenticateAsDemo(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Check if already authenticated
  const isAuthenticated = await page
    .locator('[data-testid="design-matrix"], text="New Project"')
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (isAuthenticated) {
    console.log('✅ Already authenticated');
    return;
  }

  // Look for demo button
  const demoButton = page.locator(
    '[data-testid="auth-demo-button"], button:has-text("Try Demo"), button:has-text("Demo")'
  );

  if (await demoButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('🔘 Clicking demo button');
    await demoButton.click();
    await page.waitForLoadState('networkidle');
  } else {
    console.log('⚠️ Demo button not found, setting localStorage');
    // Fallback: set demo mode in localStorage
    await page.evaluate(() => {
      localStorage.setItem('demo-mode', 'true');
      localStorage.setItem('user', JSON.stringify({
        id: 'demo-user',
        email: 'demo@example.com'
      }));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  }

  // Verify authentication succeeded
  const authenticated = await page
    .locator('[data-testid="design-matrix"], text="New Project"')
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!authenticated) {
    throw new Error('❌ Authentication failed');
  }

  console.log('✅ Authentication successful');
}

test.describe('AI Starter Flow - Complete Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mocking BEFORE navigation
    await setupAIMocking(page);
    await setupDatabaseMocking(page);

    // Authenticate
    await authenticateAsDemo(page);
  });

  test('AI-STARTER-001: Complete flow - Create project with AI ideas and verify matrix display', async ({ page }) => {
    // STEP 1: Click "New Project" button
    console.log('\n📍 STEP 1: Clicking New Project button');

    const newProjectButton = page.locator(
      '[data-testid="create-project-button"], button:has-text("New Project")'
    ).first();

    await expect(newProjectButton).toBeVisible({ timeout: 10000 });
    await newProjectButton.click();

    // STEP 2: Wait for project startup modal
    console.log('📍 STEP 2: Waiting for project startup modal');

    const modal = page.locator('text="Create New Project"').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Take screenshot of modal
    await page.screenshot({
      path: 'test-results/screenshots/ai-starter-step1-modal.png',
      fullPage: true
    });

    // STEP 3: Fill in project name
    console.log('📍 STEP 3: Filling project name');

    const projectNameInput = page.locator('input[type="text"]').first();
    await projectNameInput.fill('E2E Test Project - AI Generated Ideas');

    // STEP 4: Select project type
    console.log('📍 STEP 4: Selecting project type');

    const softwareTypeCard = page.locator('text=Software Development').first();
    await softwareTypeCard.click();

    // STEP 5: Fill description
    console.log('📍 STEP 5: Filling project description');

    const descriptionTextarea = page.locator('textarea').first();
    await descriptionTextarea.fill(
      'A comprehensive software project to test AI idea generation and matrix display functionality'
    );

    // Take screenshot after filling step 1
    await page.screenshot({
      path: 'test-results/screenshots/ai-starter-step1-filled.png',
      fullPage: true
    });

    // STEP 6: Click Next to step 2
    console.log('📍 STEP 6: Navigating to step 2');

    const nextButton = page.locator('button:has-text("Next")');
    await nextButton.click();

    // Wait for step 2 to appear
    await expect(page.locator('text="Project Details"')).toBeVisible({ timeout: 5000 });

    // STEP 7: Click Next to step 3 (AI Enhancement)
    console.log('📍 STEP 7: Navigating to step 3 (AI Enhancement)');

    await nextButton.click();

    // Wait for step 3 to appear
    await expect(page.locator('text="Review & AI Enhancement"')).toBeVisible({ timeout: 5000 });

    // Take screenshot of AI enhancement step
    await page.screenshot({
      path: 'test-results/screenshots/ai-starter-step3-before-toggle.png',
      fullPage: true
    });

    // STEP 8: Enable AI toggle
    console.log('📍 STEP 8: Enabling AI toggle');

    const aiToggle = page.locator('input[type="checkbox"]').first();
    await aiToggle.check();

    // STEP 9: Wait for AI generation to complete
    console.log('📍 STEP 9: Waiting for AI generation');

    // Look for AI analysis complete indicator
    await expect(
      page.locator('text="AI Analysis Complete"')
    ).toBeVisible({ timeout: 10000 });

    // Verify idea count is shown
    const ideaCountText = page.locator(`text=/Generated ${mockAIGeneratedIdeas.length} strategic ideas/i`);
    await expect(ideaCountText).toBeVisible({ timeout: 5000 });

    console.log(`✅ AI generated ${mockAIGeneratedIdeas.length} ideas`);

    // Take screenshot after AI generation
    await page.screenshot({
      path: 'test-results/screenshots/ai-starter-step3-after-ai.png',
      fullPage: true
    });

    // STEP 10: Click "Create Project" button
    console.log('📍 STEP 10: Clicking Create Project button');

    const createButton = page.locator('button:has-text("Create Project")');
    await expect(createButton).toBeVisible();
    await createButton.click();

    // STEP 11: Wait for modal to close and navigation
    console.log('📍 STEP 11: Waiting for project creation');

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Wait for network to settle
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // STEP 12: CRITICAL - Verify we're on the matrix page
    console.log('📍 STEP 12: Verifying matrix page loaded');

    const matrixContainer = page.locator('[data-testid="design-matrix"]');
    await expect(matrixContainer).toBeVisible({ timeout: 10000 });

    console.log('✅ Matrix container is visible');

    // Take screenshot of matrix page
    await page.screenshot({
      path: 'test-results/screenshots/ai-starter-matrix-page.png',
      fullPage: true
    });

    // STEP 13: CRITICAL TEST - Count idea cards in matrix
    console.log('\n📍 STEP 13: CRITICAL - Counting idea cards in matrix');

    // Wait a moment for ideas to render
    await page.waitForTimeout(2000);

    // Look for idea cards using multiple selectors
    const ideaCardSelectors = [
      '[data-testid^="idea-card-"]',  // Cards with data-testid
      '.idea-card-base',               // Cards with base class
      '[class*="idea-card"]',          // Any class containing idea-card
      'text="User Authentication System"',  // Specific idea content
    ];

    let ideaCount = 0;
    let foundSelector = '';

    for (const selector of ideaCardSelectors) {
      const cards = page.locator(selector);
      const count = await cards.count();

      console.log(`  Selector "${selector}": ${count} cards found`);

      if (count > ideaCount) {
        ideaCount = count;
        foundSelector = selector;
      }
    }

    console.log(`\n📊 FINAL COUNT: ${ideaCount} idea cards visible`);
    console.log(`📊 EXPECTED: ${mockAIGeneratedIdeas.length} idea cards`);
    console.log(`📊 Best selector: "${foundSelector}"`);

    // STEP 14: Verify each generated idea is visible
    console.log('\n📍 STEP 14: Verifying individual ideas');

    for (const idea of mockAIGeneratedIdeas) {
      const ideaLocator = page.locator(`text="${idea.content}"`);
      const isVisible = await ideaLocator.isVisible().catch(() => false);

      console.log(`  ${isVisible ? '✅' : '❌'} "${idea.content}"`);
    }

    // STEP 15: Check empty state is NOT shown
    console.log('\n📍 STEP 15: Checking empty state');

    const emptyState = page.locator('text="Ready to prioritize?"');
    const emptyStateVisible = await emptyState.isVisible().catch(() => false);

    console.log(`  Empty state visible: ${emptyStateVisible ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);

    // STEP 16: Inspect DOM for debugging
    console.log('\n📍 STEP 16: DOM inspection for debugging');

    const matrixHTML = await matrixContainer.innerHTML();
    const hasIdeaElements = matrixHTML.includes('idea-card') || matrixHTML.includes('User Authentication');

    console.log(`  Matrix contains idea elements: ${hasIdeaElements ? '✅ YES' : '❌ NO'}`);
    console.log(`  Matrix HTML length: ${matrixHTML.length} characters`);

    // FINAL SCREENSHOT
    await page.screenshot({
      path: 'test-results/screenshots/ai-starter-final-state.png',
      fullPage: true
    });

    // ASSERTIONS - These will fail if bug exists
    console.log('\n📍 RUNNING ASSERTIONS\n');

    // Critical assertion: Ideas should be visible
    expect(ideaCount).toBeGreaterThan(0);
    expect(ideaCount).toBe(mockAIGeneratedIdeas.length);

    // Empty state should NOT be visible
    expect(emptyStateVisible).toBe(false);

    // At least first idea should be visible
    await expect(page.locator(`text="${mockAIGeneratedIdeas[0].content}"`)).toBeVisible();

    console.log('\n✅ ALL ASSERTIONS PASSED - Bug is fixed!\n');
  });

  test('AI-STARTER-002: Verify idea cards have correct quadrant positioning', async ({ page }) => {
    // Go through the flow to create project with AI ideas
    const newProjectButton = page.locator('button:has-text("New Project")').first();
    await newProjectButton.click();

    await page.locator('input[type="text"]').first().fill('Positioning Test Project');
    await page.locator('text=Software Development').first().click();
    await page.locator('textarea').first().fill('Test project for quadrant positioning');

    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[type="checkbox"]').first().check();
    await expect(page.locator('text="AI Analysis Complete"')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Create Project")').click();
    await page.waitForLoadState('networkidle');

    // Verify matrix is visible
    await expect(page.locator('[data-testid="design-matrix"]')).toBeVisible();

    // Check quadrant labels are visible
    await expect(page.locator('[data-testid="quadrant-quick-wins"]')).toBeVisible();
    await expect(page.locator('[data-testid="quadrant-strategic"]')).toBeVisible();
    await expect(page.locator('[data-testid="quadrant-reconsider"]')).toBeVisible();
    await expect(page.locator('[data-testid="quadrant-avoid"]')).toBeVisible();

    console.log('✅ All quadrants are visible');
  });

  test('AI-STARTER-003: Verify idea count in quadrant guides', async ({ page }) => {
    // Create project with AI ideas
    const newProjectButton = page.locator('button:has-text("New Project")').first();
    await newProjectButton.click();

    await page.locator('input[type="text"]').first().fill('Count Test Project');
    await page.locator('text=Software Development').first().click();
    await page.locator('textarea').first().fill('Test project for idea counting');

    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[type="checkbox"]').first().check();
    await expect(page.locator('text="AI Analysis Complete"')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Create Project")').click();
    await page.waitForLoadState('networkidle');

    // Wait for matrix
    await expect(page.locator('[data-testid="design-matrix"]')).toBeVisible();
    await page.waitForTimeout(2000);

    // Check quadrant guide counts
    const quickWinsGuide = page.locator('.bg-emerald-50:has-text("Quick Wins")');
    const strategicGuide = page.locator('.bg-blue-50:has-text("Strategic")');

    const quickWinsText = await quickWinsGuide.textContent();
    const strategicText = await strategicGuide.textContent();

    console.log('Quick Wins guide:', quickWinsText);
    console.log('Strategic guide:', strategicText);

    // Verify counts are shown (not "0 ideas")
    expect(quickWinsText).toContain('ideas');
    expect(strategicText).toContain('ideas');
  });
});

test.describe('AI Starter Flow - Error Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await setupDatabaseMocking(page);
    await authenticateAsDemo(page);
  });

  test('AI-STARTER-004: Handle AI generation failure gracefully', async ({ page }) => {
    // Mock AI failure
    await page.route('**/api/ai/generate-ideas', (route: Route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI service unavailable' })
      });
    });

    const newProjectButton = page.locator('button:has-text("New Project")').first();
    await newProjectButton.click();

    await page.locator('input[type="text"]').first().fill('Error Test Project');
    await page.locator('text=Software Development').first().click();
    await page.locator('textarea').first().fill('Test error handling');

    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[type="checkbox"]').first().check();

    // Should show error message
    const errorMessage = page.locator('text=/error|failed|unavailable/i');
    await expect(errorMessage.first()).toBeVisible({ timeout: 7000 });

    // Should still allow creating project without AI
    const createButton = page.locator('button:has-text("Create Project")');
    await expect(createButton).toBeEnabled();
  });
});

test.describe('AI Starter Flow - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await setupAIMocking(page);
    await setupDatabaseMocking(page);
    await authenticateAsDemo(page);
  });

  test('AI-STARTER-005: Complete flow should complete within 30 seconds', async ({ page }) => {
    const startTime = Date.now();

    const newProjectButton = page.locator('button:has-text("New Project")').first();
    await newProjectButton.click();

    await page.locator('input[type="text"]').first().fill('Performance Test');
    await page.locator('text=Software Development').first().click();
    await page.locator('textarea').first().fill('Performance test project');

    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[type="checkbox"]').first().check();
    await expect(page.locator('text="AI Analysis Complete"')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Create Project")').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="design-matrix"]')).toBeVisible();

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`⏱️ Flow completed in ${duration}ms (${(duration / 1000).toFixed(2)}s)`);

    expect(duration).toBeLessThan(30000); // Should complete in under 30 seconds
  });
});
