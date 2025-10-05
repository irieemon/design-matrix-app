import { test, expect, Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wbxbmblwjqfbsoxlvxug.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndieGJtYmx3anFmYnNveGx2eHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2OTc3MDAsImV4cCI6MjA1ODI3MzcwMH0.a3hJPWvGdjVjsKZV0kqTsrRGmNfZ_K_-B3uO5c_4FXg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test credentials
const TEST_EMAIL = 'sean@lakehouse.net';
const TEST_PASSWORD = 'Hammies1234';

// Test data
const PROJECT_NAME = `DB Test Project ${Date.now()}`;
const PROJECT_DESCRIPTION = 'Testing database persistence with Playwright';

interface TestResults {
  projectCreated: boolean;
  projectInDatabase: boolean;
  ideasInDatabase: boolean;
  projectId?: string;
  ideaCount?: number;
  userId?: string;
  errors: string[];
  screenshots: string[];
}

const results: TestResults = {
  projectCreated: false,
  projectInDatabase: false,
  ideasInDatabase: false,
  errors: [],
  screenshots: []
};

async function takeScreenshot(page: Page, name: string): Promise<string> {
  const timestamp = Date.now();
  const filename = `database-validation-${name}-${timestamp}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  results.screenshots.push(filename);
  console.log(`📸 Screenshot saved: ${filename}`);
  return filename;
}

async function signIn(page: Page): Promise<string | null> {
  console.log('🔐 Signing in as test user...');

  try {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' });
    await takeScreenshot(page, 'initial-load');

    // Wait for auth screen
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in credentials
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);

    await takeScreenshot(page, 'credentials-filled');

    // Click sign in (no navigation expected - it's a SPA)
    await page.click('button:has-text("Sign In")');
    console.log('🔄 Sign in clicked, waiting for app to load...');

    // Wait for auth state to process
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'after-signin-click');

    // Wait for the sign-in form to disappear OR app to load
    await page.waitForSelector('[data-testid="app-layout"], [data-testid="project-management"], button:has-text("Create New Project"), button:has-text("Get Started"), [data-testid="sidebar"]', { timeout: 30000 });

    // Give additional time for full app initialization
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'app-loaded');

    // Verify we're not still on login page
    const emailInputCount = await page.locator('input[type="email"]').count();
    if (emailInputCount > 0) {
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);
      throw new Error('Still on login page - authentication may have failed');
    }

    await takeScreenshot(page, 'signed-in');
    console.log('✅ Successfully signed in');

    // Sign in to Supabase to get user ID
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (error) {
      throw new Error(`Supabase auth error: ${error.message}`);
    }

    if (data.user) {
      console.log(`👤 User ID: ${data.user.id}`);
      return data.user.id;
    }

    return null;
  } catch (error) {
    const errorMsg = `Sign in failed: ${error}`;
    console.error('❌', errorMsg);
    results.errors.push(errorMsg);
    await takeScreenshot(page, 'signin-error');
    throw error;
  }
}

async function createProject(page: Page): Promise<void> {
  console.log('📝 Creating new project...');

  try {
    // Look for "Create New Project" button
    const createButton = await page.locator('button:has-text("Create New Project"), button:has-text("Get Started"), button:has-text("AI Starter")').first();

    await createButton.waitFor({ timeout: 10000 });
    await takeScreenshot(page, 'before-create-click');

    await createButton.click();
    console.log('🖱️ Clicked create project button');

    // Wait for modal
    await page.waitForSelector('[data-testid="project-modal"], [data-testid="add-project-modal"]', { timeout: 10000 });
    await takeScreenshot(page, 'modal-opened');

    // Fill in project details
    await page.fill('input[name="name"], input[placeholder*="name" i]', PROJECT_NAME);
    console.log(`📝 Entered project name: ${PROJECT_NAME}`);

    await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', PROJECT_DESCRIPTION);
    console.log(`📝 Entered project description: ${PROJECT_DESCRIPTION}`);

    // Enable AI features
    const aiCheckbox = await page.locator('input[type="checkbox"][name*="ai" i], label:has-text("AI") input[type="checkbox"]').first();
    if (await aiCheckbox.isVisible()) {
      await aiCheckbox.check();
      console.log('🤖 Enabled AI features');
    }

    await takeScreenshot(page, 'form-filled');

    // Click Create/Submit
    const submitButton = await page.locator('button:has-text("Create Project"), button:has-text("Create"), button[type="submit"]').first();
    await submitButton.click();
    console.log('🖱️ Clicked create/submit button');

    // Wait for project creation to complete
    // Look for either success indicators or error messages
    try {
      await Promise.race([
        page.waitForSelector('[data-testid="matrix-page"], [data-testid="design-matrix"]', { timeout: 20000 }),
        page.waitForSelector('text=/error/i, text=/failed/i', { timeout: 20000 })
      ]);

      await takeScreenshot(page, 'after-creation');

      // Check for error messages
      const errorElement = await page.locator('text=/error/i, text=/failed/i').first();
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        throw new Error(`Project creation failed: ${errorText}`);
      }

      results.projectCreated = true;
      console.log('✅ Project creation UI completed');

      // Wait a bit for database operations to complete
      await page.waitForTimeout(3000);

    } catch (error) {
      const errorMsg = `Project creation error: ${error}`;
      console.error('❌', errorMsg);
      results.errors.push(errorMsg);
      await takeScreenshot(page, 'creation-error');
      throw error;
    }

  } catch (error) {
    const errorMsg = `Create project failed: ${error}`;
    console.error('❌', errorMsg);
    results.errors.push(errorMsg);
    await takeScreenshot(page, 'create-project-error');
    throw error;
  }
}

async function verifyDatabasePersistence(userId: string): Promise<void> {
  console.log('🔍 Verifying database persistence...');

  try {
    // Query projects table
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', userId)
      .eq('name', PROJECT_NAME);

    if (projectError) {
      throw new Error(`Database query error: ${projectError.message}`);
    }

    if (!projects || projects.length === 0) {
      throw new Error('❌ Project NOT found in database!');
    }

    const project = projects[0];
    results.projectId = project.id;
    results.projectInDatabase = true;

    console.log('✅ Project found in database:');
    console.log(`   - ID: ${project.id}`);
    console.log(`   - Name: ${project.name}`);
    console.log(`   - Description: ${project.description}`);
    console.log(`   - Owner: ${project.owner_id}`);
    console.log(`   - Created: ${project.created_at}`);

    // Query ideas table
    const { data: ideas, error: ideasError } = await supabase
      .from('ideas')
      .select('*')
      .eq('project_id', project.id);

    if (ideasError) {
      throw new Error(`Ideas query error: ${ideasError.message}`);
    }

    results.ideaCount = ideas?.length || 0;
    results.ideasInDatabase = results.ideaCount > 0;

    console.log(`✅ Found ${results.ideaCount} ideas in database`);

    if (ideas && ideas.length > 0) {
      console.log('📋 Sample ideas:');
      ideas.slice(0, 3).forEach((idea, idx) => {
        console.log(`   ${idx + 1}. ${idea.title} (${idea.quadrant})`);
      });
    }

    results.userId = userId;

  } catch (error) {
    const errorMsg = `Database verification failed: ${error}`;
    console.error('❌', errorMsg);
    results.errors.push(errorMsg);
    throw error;
  }
}

async function cleanupTestData(): Promise<void> {
  console.log('🧹 Cleaning up test data...');

  if (results.projectId) {
    try {
      // Delete ideas first (foreign key constraint)
      const { error: ideasError } = await supabase
        .from('ideas')
        .delete()
        .eq('project_id', results.projectId);

      if (ideasError) {
        console.warn(`⚠️ Error deleting ideas: ${ideasError.message}`);
      } else {
        console.log('✅ Deleted test ideas');
      }

      // Delete project
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', results.projectId);

      if (projectError) {
        console.warn(`⚠️ Error deleting project: ${projectError.message}`);
      } else {
        console.log('✅ Deleted test project');
      }

    } catch (error) {
      console.warn(`⚠️ Cleanup error: ${error}`);
    }
  }
}

function printSummaryReport(): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DATABASE PERSISTENCE VALIDATION REPORT');
  console.log('='.repeat(80));
  console.log(`\n🎯 Test Project: ${PROJECT_NAME}`);
  console.log(`👤 User ID: ${results.userId || 'N/A'}`);
  console.log(`📁 Project ID: ${results.projectId || 'N/A'}`);
  console.log('\n📋 Results:');
  console.log(`   ✅ Project Created in UI: ${results.projectCreated ? 'YES' : 'NO'}`);
  console.log(`   ✅ Project in Database: ${results.projectInDatabase ? 'YES' : 'NO'}`);
  console.log(`   ✅ Ideas in Database: ${results.ideasInDatabase ? 'YES' : 'NO'}`);
  console.log(`   📊 Idea Count: ${results.ideaCount || 0}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach((error, idx) => {
      console.log(`   ${idx + 1}. ${error}`);
    });
  }

  console.log('\n📸 Screenshots:');
  results.screenshots.forEach((screenshot, idx) => {
    console.log(`   ${idx + 1}. ${screenshot}`);
  });

  const overallSuccess = results.projectCreated && results.projectInDatabase && results.ideasInDatabase && results.errors.length === 0;

  console.log('\n' + '='.repeat(80));
  console.log(`🎯 OVERALL RESULT: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);
  console.log('='.repeat(80) + '\n');
}

// Configure test to run with visible browser
test.use({
  headless: false,
  viewport: { width: 1920, height: 1080 },
  video: 'retain-on-failure'
});

test.describe('Database Persistence Validation', () => {
  test('should create project and persist to Supabase database', async ({ page }) => {
    let userId: string | null = null;

    try {
      // Step 1: Sign in
      userId = await signIn(page);
      expect(userId).toBeTruthy();

      // Step 2: Create project
      await createProject(page);
      expect(results.projectCreated).toBe(true);

      // Step 3: Verify database persistence
      if (userId) {
        await verifyDatabasePersistence(userId);
        expect(results.projectInDatabase).toBe(true);
        expect(results.ideasInDatabase).toBe(true);
        expect(results.ideaCount).toBeGreaterThan(0);
      }

      // Print summary
      printSummaryReport();

    } catch (error) {
      console.error('❌ Test failed:', error);
      await takeScreenshot(page, 'final-error');
      printSummaryReport();
      throw error;

    } finally {
      // Cleanup
      await cleanupTestData();
    }
  });
});
