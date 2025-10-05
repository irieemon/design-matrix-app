import { test, expect, Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration - using correct values from .env
const supabaseUrl = 'https://vfovtgtjailvrphsgafv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmb3Z0Z3RqYWlsdnJwaHNnYWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5OTAzMjAsImV4cCI6MjA3MjU2NjMyMH0.e5zWrFaL-QqDEUhd_7Oxz8-oC4JPv8kd832TeyGP2xQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const filename = `demo-user-validation-${name}-${timestamp}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  results.screenshots.push(filename);
  console.log(`📸 Screenshot saved: ${filename}`);
  return filename;
}

async function useDemoUser(page: Page): Promise<void> {
  console.log('🎭 Using Demo User...');

  try {
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle' });
    await takeScreenshot(page, 'initial-load');

    // Click "Continue as Demo User" button
    const demoButton = await page.locator('button:has-text("Continue as Demo User"), button:has-text("Demo User")').first();
    await demoButton.waitFor({ timeout: 10000 });

    await takeScreenshot(page, 'before-demo-click');
    await demoButton.click();
    console.log('🖱️ Clicked Demo User button');

    // Wait for app to load - look for AI Starter or Manual Setup buttons
    await page.waitForSelector('button:has-text("AI Starter"), button:has-text("Manual Setup"), button:has-text("Create New Project")', { timeout: 30000 });

    // Give time for full initialization
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'demo-user-loaded');
    console.log('✅ Demo User mode activated');

  } catch (error) {
    const errorMsg = `Demo User failed: ${error}`;
    console.error('❌', errorMsg);
    results.errors.push(errorMsg);
    await takeScreenshot(page, 'demo-user-error');
    throw error;
  }
}

async function createProject(page: Page): Promise<void> {
  console.log('📝 Creating new project...');

  try {
    // Look for "AI Starter" button (creates project with AI-generated ideas)
    const createButton = await page.locator('button:has-text("AI Starter")').first();

    await createButton.waitFor({ timeout: 10000 });
    await takeScreenshot(page, 'before-create-click');

    await createButton.click();
    console.log('🖱️ Clicked AI Starter button');

    // Wait for AI Project Starter modal
    await page.waitForSelector('text="AI Project Starter"', { timeout: 10000 });
    await takeScreenshot(page, 'modal-opened');

    // Fill in project name (first input field in the modal)
    const projectNameInput = await page.locator('input[placeholder*="Mobile App" i], input[placeholder*="Marketing" i]').first();
    await projectNameInput.fill(PROJECT_NAME);
    console.log(`📝 Entered project name: ${PROJECT_NAME}`);

    // Fill in project description (textarea)
    const projectDescInput = await page.locator('textarea[placeholder*="Describe" i]').first();
    await projectDescInput.fill(PROJECT_DESCRIPTION);
    console.log(`📝 Entered project description: ${PROJECT_DESCRIPTION}`);

    await takeScreenshot(page, 'form-filled');

    // Click "Start AI Analysis" button
    const submitButton = await page.locator('button:has-text("Start AI Analysis")').first();
    await submitButton.click();
    console.log('🖱️ Clicked Start AI Analysis button');

    // Wait for AI analysis and database operations
    try {
      console.log('⏳ Waiting for AI analysis and database persistence...');

      // Give the AI analysis time to start and create the project in the database
      // The project should be created early in the process, even if AI analysis continues
      await page.waitForTimeout(10000); // 10 seconds should be enough for project creation

      await takeScreenshot(page, 'during-ai-analysis');

      // Check for error messages
      const errorElement = await page.locator('text=/error/i, text=/failed/i, text=/something went wrong/i').first();
      if (await errorElement.count() > 0 && await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        throw new Error(`Project creation failed: ${errorText}`);
      }

      results.projectCreated = true;
      console.log('✅ Project creation initiated (AI analysis may still be running)');

      // Wait a bit more for database operations to complete
      await page.waitForTimeout(5000);

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

async function verifyDatabasePersistence(): Promise<void> {
  console.log('🔍 Verifying database persistence...');

  try {
    // Query projects table for our test project by name
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('name', PROJECT_NAME)
      .order('created_at', { ascending: false })
      .limit(1);

    if (projectError) {
      throw new Error(`Database query error: ${projectError.message}`);
    }

    if (!projects || projects.length === 0) {
      throw new Error('❌ Project NOT found in database!');
    }

    const project = projects[0];
    results.projectId = project.id;
    results.userId = project.owner_id;
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
        console.log(`✅ Deleted ${results.ideaCount} test ideas`);
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
  console.log('📊 DATABASE PERSISTENCE VALIDATION REPORT (DEMO USER)');
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
  console.log(`🎯 OVERALL RESULT: ${overallSuccess ? '✅ SUCCESS - Database persistence is working!' : '❌ FAILURE - Database persistence is broken!'}`);
  console.log('='.repeat(80) + '\n');

  if (overallSuccess) {
    console.log('✅ VALIDATION PASSED:');
    console.log('   - Project was created in the UI');
    console.log('   - Project was successfully saved to Supabase database');
    console.log('   - AI-generated ideas were saved to Supabase database');
    console.log('   - Database persistence fix is confirmed working!');
  }
}

// Configure test to run with visible browser
test.use({
  headless: false,
  viewport: { width: 1920, height: 1080 },
  video: 'retain-on-failure'
});

test.describe('Database Persistence Validation - Demo User', () => {
  test('should create project with demo user and persist to Supabase database', async ({ page }) => {
    try {
      // Step 1: Use Demo User
      await useDemoUser(page);

      // Step 2: Create project
      await createProject(page);
      expect(results.projectCreated).toBe(true);

      // Step 3: Verify database persistence
      await verifyDatabasePersistence();
      expect(results.projectInDatabase).toBe(true);
      expect(results.ideasInDatabase).toBe(true);
      expect(results.ideaCount).toBeGreaterThan(0);

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
