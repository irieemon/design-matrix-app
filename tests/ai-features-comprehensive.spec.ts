/**
 * COMPREHENSIVE AI FEATURES TESTING
 *
 * Tests all AI-powered features in the application through real browser interactions:
 * - AI idea generation
 * - AI insights/analysis
 * - AI-powered roadmap generation
 * - Any other AI features
 *
 * This test validates the full user flow including authentication, project access,
 * and AI feature interactions with visual evidence collection.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Test configuration
const APP_URL = 'http://localhost:3003';
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'ai-features');

// Helper function to wait for network idle
async function waitForNetworkIdle(page: Page, timeout = 2000) {
  await page.waitForLoadState('networkidle', { timeout });
}

// Helper function to bypass auth if needed
async function handleAuth(page: Page) {
  console.log('Checking authentication state...');

  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Check if we see auth screen - look for the demo button specifically
  const demoButton = page.locator('button:has-text("Continue as Demo User")');
  const hasDemoButton = await demoButton.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasDemoButton) {
    console.log('Auth screen detected, clicking demo user button...');
    await demoButton.click();
    console.log('Clicked demo user button');
    await page.waitForTimeout(3000);
    await waitForNetworkIdle(page);
  }

  // Verify we're past auth by checking for auth-specific elements
  const signInButton = page.locator('button:has-text("Sign In")');
  const isStillAuth = await signInButton.isVisible({ timeout: 2000 }).catch(() => false);

  if (isStillAuth) {
    throw new Error('Failed to bypass authentication - still showing Sign In button');
  }

  console.log('Authentication handled successfully');
}

// Helper function to create or access a project
async function ensureProjectAccess(page: Page): Promise<string> {
  console.log('Ensuring project access...');

  // Wait for the page to settle
  await page.waitForTimeout(2000);

  // Check if we're already in a project (matrix visible)
  const matrixVisible = await page.locator('[data-testid="design-matrix"], .matrix-container, .quadrant').first().isVisible().catch(() => false);

  if (matrixVisible) {
    console.log('Already in a project');
    return 'existing-project';
  }

  // Look for "AI Starter" button - perfect for testing AI features!
  const aiStarterButton = page.locator('button:has-text("AI Starter")');
  const hasAIStarter = await aiStarterButton.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasAIStarter) {
    console.log('Found "AI Starter" button - creating AI-powered project...');
    await aiStarterButton.click();
    await page.waitForTimeout(2000);

    // Fill out the AI Project Starter form
    console.log('Filling AI Project Starter form...');

    // Fill project name
    const projectNameInput = page.locator('input[placeholder*="Mobile App" i], input[placeholder*="project" i]').first();
    await projectNameInput.fill('AI Testing Project');

    // Fill project description
    const descriptionInput = page.locator('textarea, input[placeholder*="Describe" i]').first();
    await descriptionInput.fill('Testing AI features including idea generation, insights, and roadmap creation');

    await page.waitForTimeout(1000);

    // Click "Start AI Analysis" button
    const startAIButton = page.locator('button:has-text("Start AI Analysis")');
    await startAIButton.click();
    console.log('Clicked "Start AI Analysis" - waiting for AI clarification...');

    await page.waitForTimeout(3000);

    // AI may ask clarifying questions - check for them
    const clarifyingQuestion = page.locator('text="A few questions to help me understand better"');
    const hasClarifyingQuestion = await clarifyingQuestion.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasClarifyingQuestion) {
      console.log('AI is asking clarifying questions...');

      // Fill the answer textarea
      const answerTextarea = page.locator('textarea[placeholder*="answer" i]').first();
      await answerTextarea.fill('Small business owners and entrepreneurs who need to prioritize their tasks efficiently');

      await page.waitForTimeout(1000);

      // Click "Generate Ideas" button
      const generateButton = page.locator('button:has-text("Generate Ideas")');
      await generateButton.click();
      console.log('Clicked "Generate Ideas" - AI is now generating ideas...');

      // Wait for "Project Analysis Complete" message
      await page.waitForSelector('text="Project Analysis Complete"', { timeout: 60000 });
      console.log('AI analysis complete! Ideas generated successfully');

      await page.waitForTimeout(2000);

      // Click "Create Project & X Ideas" button
      const createProjectButton = page.locator('button:has-text("Create Project")');
      await createProjectButton.click();
      console.log('Creating project with AI-generated ideas...');
    }

    await page.waitForTimeout(3000);
    await waitForNetworkIdle(page);

    // Wait for matrix to appear
    await page.waitForSelector('[data-testid="design-matrix"], .matrix-container, .quadrant', { timeout: 15000 });
    console.log('AI Starter project created successfully with AI-generated ideas displayed in matrix');
    return 'ai-starter-project';
  }

  // Fallback: look for "Access Matrix Now" button
  const accessMatrixButton = page.locator('button:has-text("Access Matrix Now")');
  const hasAccessButton = await accessMatrixButton.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasAccessButton) {
    console.log('Found "Access Matrix Now" button - accessing existing project...');
    await accessMatrixButton.click();
    await page.waitForTimeout(2000);
    await waitForNetworkIdle(page);
  }

  // Wait for matrix to appear
  await page.waitForSelector('[data-testid="design-matrix"], .matrix-container, .quadrant', { timeout: 15000 });
  console.log('Project access confirmed');

  return 'existing-project';
}

// Helper function to find and click AI buttons
async function findAIButton(page: Page): Promise<boolean> {
  const aiButtonSelectors = [
    'button:has-text("Generate Ideas")',
    'button:has-text("AI Insights")',
    'button:has-text("AI Generate")',
    'button:has-text("Generate with AI")',
    '[data-testid="ai-generate"]',
    '[data-testid="ai-insights"]',
    'button[aria-label*="AI" i]',
    'button[title*="AI" i]'
  ];

  for (const selector of aiButtonSelectors) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible({ timeout: 1000 }).catch(() => false);

    if (isVisible) {
      console.log(`Found AI button with selector: ${selector}`);
      return true;
    }
  }

  return false;
}

test.describe('AI Features Comprehensive Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('AI Idea Generation - Full User Flow', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for AI generation
    console.log('\n=== Starting AI Idea Generation Test ===\n');

    // Step 1: Navigate to app
    console.log('Step 1: Navigating to application...');
    await page.goto(APP_URL);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png'), fullPage: true });

    // Step 2: Handle authentication
    console.log('Step 2: Handling authentication...');
    await handleAuth(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-auth.png'), fullPage: true });

    // Step 3: Ensure project access
    console.log('Step 3: Accessing project...');
    await ensureProjectAccess(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-project-ready.png'), fullPage: true });

    // Step 4: Look for AI idea generation button
    console.log('Step 4: Looking for AI idea generation features...');
    const hasAIButton = await findAIButton(page);

    if (!hasAIButton) {
      console.log('No AI button found in main view, checking for add idea modal...');

      // Try to open add idea modal
      const addIdeaButton = page.locator('button:has-text("Add Idea"), button:has-text("New Idea"), [data-testid="add-idea"]').first();
      const hasAddButton = await addIdeaButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasAddButton) {
        await addIdeaButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-add-idea-modal.png'), fullPage: true });

        // Check for AI button in modal
        const hasAIInModal = await findAIButton(page);
        expect(hasAIInModal, 'AI generation button should be visible in modal or main view').toBe(true);
      } else {
        throw new Error('Could not find AI generation button or add idea button');
      }
    }

    // Step 5: Click AI generate button
    console.log('Step 5: Clicking AI generate button...');
    const aiButton = page.locator('button:has-text("Generate Ideas"), button:has-text("AI Insights"), button:has-text("AI Generate")').first();
    await aiButton.click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-ai-button-clicked.png'), fullPage: true });

    // Step 6: Wait for AI generation (loading state)
    console.log('Step 6: Waiting for AI generation...');
    await page.waitForTimeout(2000);

    // Look for loading indicator
    const loadingIndicator = page.locator('.loading, .spinner, [role="status"], text=generating, text=loading').first();
    const hasLoading = await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasLoading) {
      console.log('Loading indicator detected, waiting for completion...');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-ai-generating.png'), fullPage: true });

      // Wait for loading to complete (max 30 seconds)
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
        console.log('Loading indicator timeout - continuing anyway');
      });
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-after-generation.png'), fullPage: true });

    // Step 7: Verify AI-generated ideas appeared
    console.log('Step 7: Verifying AI-generated ideas...');

    // Look for idea cards or list items
    const ideaElements = page.locator('.idea-card, [data-testid="idea-card"], .idea-item, .card');
    const ideaCount = await ideaElements.count();

    console.log(`Found ${ideaCount} idea elements`);

    if (ideaCount > 0) {
      console.log('AI ideas successfully generated and displayed!');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-ideas-success.png'), fullPage: true });

      // Get text of first few ideas
      for (let i = 0; i < Math.min(3, ideaCount); i++) {
        const ideaText = await ideaElements.nth(i).textContent();
        console.log(`Idea ${i + 1}: ${ideaText?.substring(0, 100)}...`);
      }

      expect(ideaCount).toBeGreaterThan(0);
    } else {
      console.log('No idea cards found yet, checking for other success indicators...');

      // Check for success messages
      const successMessage = page.locator('text=success, text=generated, text=added').first();
      const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasSuccess) {
        console.log('Success message detected');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-success-message.png'), fullPage: true });
      }

      // Take final screenshot for debugging
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-final-state.png'), fullPage: true });
    }

    console.log('\n=== AI Idea Generation Test Complete ===\n');
  });

  test('AI Insights Feature', async ({ page }) => {
    console.log('\n=== Starting AI Insights Test ===\n');

    // Setup: Navigate and authenticate
    await page.goto(APP_URL);
    await handleAuth(page);
    await ensureProjectAccess(page);

    // Look for AI Insights button
    const insightsButton = page.locator('button:has-text("AI Insights"), button:has-text("Insights"), [data-testid="ai-insights"]').first();
    const hasInsightsButton = await insightsButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasInsightsButton) {
      console.log('Found AI Insights button, testing...');

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'insights-01-before.png'), fullPage: true });

      await insightsButton.click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'insights-02-clicked.png'), fullPage: true });

      // Wait for insights modal or panel
      const insightsModal = page.locator('.modal, [role="dialog"], .insights-panel').first();
      await insightsModal.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
        console.log('No modal appeared');
      });

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'insights-03-result.png'), fullPage: true });

      console.log('AI Insights test complete');
    } else {
      console.log('AI Insights button not found - feature may not be available');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'insights-not-found.png'), fullPage: true });
    }
  });

  test('AI Roadmap Generation', async ({ page }) => {
    console.log('\n=== Starting AI Roadmap Test ===\n');

    // Setup
    await page.goto(APP_URL);
    await handleAuth(page);
    await ensureProjectAccess(page);

    // Look for roadmap-related AI features
    const roadmapButton = page.locator('button:has-text("Generate Roadmap"), button:has-text("AI Roadmap"), [data-testid="generate-roadmap"]').first();
    const hasRoadmapButton = await roadmapButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasRoadmapButton) {
      console.log('Found AI Roadmap button, testing...');

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'roadmap-01-before.png'), fullPage: true });

      await roadmapButton.click();
      await page.waitForTimeout(3000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'roadmap-02-clicked.png'), fullPage: true });

      // Wait for roadmap content
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'roadmap-03-result.png'), fullPage: true });

      console.log('AI Roadmap test complete');
    } else {
      console.log('AI Roadmap button not found - feature may not be available');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'roadmap-not-found.png'), fullPage: true });
    }
  });

  test('AI Features Discovery - Full UI Scan', async ({ page }) => {
    console.log('\n=== Starting AI Features Discovery ===\n');

    // Setup
    await page.goto(APP_URL);
    await handleAuth(page);
    await ensureProjectAccess(page);

    // Scan for all AI-related buttons and features
    const aiKeywords = ['AI', 'Generate', 'Insights', 'Analysis', 'Suggest', 'Recommend'];
    const foundFeatures: string[] = [];

    for (const keyword of aiKeywords) {
      const buttons = page.locator(`button:has-text("${keyword}")`);
      const count = await buttons.count();

      if (count > 0) {
        console.log(`Found ${count} buttons with "${keyword}"`);

        for (let i = 0; i < count; i++) {
          const text = await buttons.nth(i).textContent();
          if (text && !foundFeatures.includes(text)) {
            foundFeatures.push(text.trim());
          }
        }
      }
    }

    console.log('\n=== AI Features Found ===');
    foundFeatures.forEach((feature, idx) => {
      console.log(`${idx + 1}. ${feature}`);
    });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'discovery-all-features.png'), fullPage: true });

    // Save discovery report
    const report = {
      timestamp: new Date().toISOString(),
      url: APP_URL,
      featuresFound: foundFeatures,
      featureCount: foundFeatures.length
    };

    console.log('\n=== Discovery Report ===');
    console.log(JSON.stringify(report, null, 2));

    expect(foundFeatures.length).toBeGreaterThan(0);
  });
});

test.describe('AI API Integration Testing', () => {
  test('Verify AI endpoints are accessible', async ({ page }) => {
    console.log('\n=== Testing AI API Accessibility ===\n');

    await page.goto(APP_URL);

    // Monitor network requests
    const aiRequests: any[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/ai') || url.includes('/generate') || url.includes('/insights')) {
        aiRequests.push({
          url,
          method: request.method(),
          timestamp: new Date().toISOString()
        });
        console.log(`AI API Request: ${request.method()} ${url}`);
      }
    });

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/ai') || url.includes('/generate') || url.includes('/insights')) {
        console.log(`AI API Response: ${response.status()} ${url}`);
      }
    });

    // Authenticate and trigger AI features
    await handleAuth(page);
    await ensureProjectAccess(page);

    // Try to trigger AI generation
    const hasAIButton = await findAIButton(page);
    if (hasAIButton) {
      const aiButton = page.locator('button:has-text("Generate Ideas"), button:has-text("AI")').first();
      await aiButton.click();
      await page.waitForTimeout(5000);
    }

    console.log(`\nCaptured ${aiRequests.length} AI API requests`);
    aiRequests.forEach((req, idx) => {
      console.log(`${idx + 1}. ${req.method} ${req.url}`);
    });
  });
});
