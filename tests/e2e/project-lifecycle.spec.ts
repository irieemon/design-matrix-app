import { test, expect } from '@playwright/test';
import { ProjectPage } from './page-objects/ProjectPage';
import type { ProjectType } from '../../src/types';

test.describe('Project Lifecycle E2E Tests', () => {
  let projectPage: ProjectPage;
  const testUserId = 'test-user-lifecycle-001';
  const testUserEmail = 'lifecycle@test.com';

  test.beforeEach(async ({ page }) => {
    projectPage = new ProjectPage(page);

    // Setup authentication bypass
    await projectPage.goto();
    await projectPage.bypassAuth(testUserId, testUserEmail);
    await page.reload();
    await projectPage.waitForPageLoad();
  });

  test.afterEach(async ({ page }) => {
    await projectPage.clearAuth();
  });

  test.describe('Empty State → First Project', () => {
    test('should show empty state when no projects exist', async () => {
      const isEmpty = await projectPage.isEmptyStateVisible();
      expect(isEmpty).toBe(true);
    });

    test('should create first project and hide empty state', async ({ page }) => {
      await projectPage.createProject({
        name: 'My First Project',
        description: 'Getting started with project management',
        type: 'software',
        status: 'active',
        visibility: 'private'
      });

      // Verify project was created
      const exists = await projectPage.projectExists('My First Project');
      expect(exists).toBe(true);

      // Verify empty state is hidden
      const isEmpty = await projectPage.isEmptyStateVisible();
      expect(isEmpty).toBe(false);
    });
  });

  test.describe('Create Projects - All 7 Types', () => {
    const projectTypes: { type: ProjectType; name: string; description: string }[] = [
      {
        type: 'software',
        name: 'E-Commerce Platform',
        description: 'Build an online marketplace'
      },
      {
        type: 'business_plan',
        name: 'Startup Business Plan',
        description: 'Q3 2025 business strategy'
      },
      {
        type: 'product_development',
        name: 'Smart Home Device',
        description: 'IoT temperature controller'
      },
      {
        type: 'marketing',
        name: 'Social Media Campaign',
        description: 'Q4 marketing initiatives'
      },
      {
        type: 'operations',
        name: 'Supply Chain Optimization',
        description: 'Reduce operational costs by 20%'
      },
      {
        type: 'research',
        name: 'Market Research Study',
        description: 'Customer behavior analysis'
      },
      {
        type: 'other',
        name: 'Community Event Planning',
        description: 'Annual tech conference'
      }
    ];

    for (const project of projectTypes) {
      test(`should create ${project.type} project`, async () => {
        await projectPage.createProject({
          name: project.name,
          description: project.description,
          type: project.type,
          status: 'active'
        });

        // Verify project exists
        const exists = await projectPage.projectExists(project.name);
        expect(exists).toBe(true);

        // Verify project details
        await projectPage.verifyProjectDetails(project.name, {
          description: project.description,
          type: project.type
        });
      });
    }

    test('should create all 7 project types in sequence', async () => {
      for (const project of projectTypes) {
        await projectPage.createProject({
          name: project.name,
          description: project.description,
          type: project.type,
          status: 'active'
        });
      }

      // Verify all projects exist
      const projectCount = await projectPage.getProjectCount();
      expect(projectCount).toBe(7);

      // Verify all project names
      const projectNames = await projectPage.getAllProjectNames();
      expect(projectNames).toHaveLength(7);
    });
  });

  test.describe('Project Appears in Sidebar', () => {
    test('should display newly created project in sidebar', async () => {
      const projectName = 'Sidebar Test Project';

      await projectPage.createProject({
        name: projectName,
        description: 'Testing sidebar visibility',
        type: 'software'
      });

      // Verify project appears in sidebar
      const existsInSidebar = await projectPage.projectExistsInSidebar(projectName);
      expect(existsInSidebar).toBe(true);
    });

    test('should show multiple projects in sidebar', async () => {
      const projects = [
        { name: 'Project Alpha', type: 'software' as ProjectType },
        { name: 'Project Beta', type: 'marketing' as ProjectType },
        { name: 'Project Gamma', type: 'research' as ProjectType }
      ];

      for (const project of projects) {
        await projectPage.createProject({
          name: project.name,
          type: project.type
        });
      }

      // Verify all appear in sidebar
      for (const project of projects) {
        const existsInSidebar = await projectPage.projectExistsInSidebar(project.name);
        expect(existsInSidebar).toBe(true);
      }
    });
  });

  test.describe('Switch Between Projects', () => {
    test('should switch between projects', async ({ page }) => {
      // Create two projects
      await projectPage.createProject({
        name: 'Project One',
        type: 'software'
      });

      await projectPage.createProject({
        name: 'Project Two',
        type: 'marketing'
      });

      // Switch to Project One
      await projectPage.switchToProject('Project One');
      await page.waitForTimeout(500);

      // Verify active project
      const activeProject = page.locator('[data-testid="active-project"]');
      await expect(activeProject).toContainText('Project One');

      // Switch to Project Two
      await projectPage.switchToProject('Project Two');
      await page.waitForTimeout(500);

      // Verify active project changed
      await expect(activeProject).toContainText('Project Two');
    });

    test('should maintain project context after switch', async ({ page }) => {
      await projectPage.createProject({
        name: 'Context Project',
        description: 'Test context persistence',
        type: 'software'
      });

      await projectPage.switchToProject('Context Project');

      // Reload page
      await page.reload();
      await projectPage.waitForPageLoad();

      // Verify project context is maintained
      const activeProject = page.locator('[data-testid="active-project"]');
      await expect(activeProject).toContainText('Context Project');
    });
  });

  test.describe('Edit Project Details', () => {
    test('should edit project name', async () => {
      const originalName = 'Original Project Name';
      const updatedName = 'Updated Project Name';

      await projectPage.createProject({
        name: originalName,
        type: 'software'
      });

      await projectPage.editProject(originalName, {
        name: updatedName
      });

      // Verify name was updated
      const exists = await projectPage.projectExists(updatedName);
      expect(exists).toBe(true);

      // Verify old name doesn't exist
      const oldExists = await projectPage.projectExists(originalName);
      expect(oldExists).toBe(false);
    });

    test('should edit project description', async () => {
      const projectName = 'Description Test Project';
      const originalDesc = 'Original description';
      const updatedDesc = 'Updated description with more details';

      await projectPage.createProject({
        name: projectName,
        description: originalDesc,
        type: 'software'
      });

      await projectPage.editProject(projectName, {
        description: updatedDesc
      });

      // Verify description was updated
      await projectPage.verifyProjectDetails(projectName, {
        description: updatedDesc
      });
    });

    test('should edit project status', async () => {
      const projectName = 'Status Test Project';

      await projectPage.createProject({
        name: projectName,
        type: 'software',
        status: 'active'
      });

      await projectPage.editProject(projectName, {
        status: 'paused'
      });

      // Verify status was updated
      await projectPage.verifyProjectDetails(projectName, {
        status: 'paused'
      });
    });

    test('should edit multiple fields simultaneously', async () => {
      const projectName = 'Multi-Edit Project';

      await projectPage.createProject({
        name: projectName,
        description: 'Original',
        type: 'software',
        status: 'active'
      });

      await projectPage.editProject(projectName, {
        name: 'Renamed Multi-Edit Project',
        description: 'Updated description',
        status: 'completed'
      });

      // Verify all updates
      const exists = await projectPage.projectExists('Renamed Multi-Edit Project');
      expect(exists).toBe(true);
    });
  });

  test.describe('Project Search and Filtering', () => {
    test.beforeEach(async () => {
      // Create test projects
      const projects = [
        { name: 'Alpha Software Project', type: 'software' as ProjectType },
        { name: 'Beta Marketing Campaign', type: 'marketing' as ProjectType },
        { name: 'Gamma Research Study', type: 'research' as ProjectType },
        { name: 'Delta Software Application', type: 'software' as ProjectType }
      ];

      for (const project of projects) {
        await projectPage.createProject(project);
      }
    });

    test('should search projects by name', async () => {
      await projectPage.searchProjects('Software');

      // Should show 2 software projects
      const projectCount = await projectPage.getProjectCount();
      expect(projectCount).toBe(2);
    });

    test('should search projects by partial match', async () => {
      await projectPage.searchProjects('Beta');

      const exists = await projectPage.projectExists('Beta Marketing Campaign');
      expect(exists).toBe(true);

      const projectCount = await projectPage.getProjectCount();
      expect(projectCount).toBe(1);
    });

    test('should show no results for non-existent project', async () => {
      await projectPage.searchProjects('NonExistentProject');

      const projectCount = await projectPage.getProjectCount();
      expect(projectCount).toBe(0);
    });

    test('should clear search and show all projects', async () => {
      await projectPage.searchProjects('Software');
      await projectPage.searchProjects('');

      // Should show all 4 projects
      const projectCount = await projectPage.getProjectCount();
      expect(projectCount).toBe(4);
    });
  });

  test.describe('Project Deletion', () => {
    test('should delete a project with confirmation', async () => {
      const projectName = 'Project To Delete';

      await projectPage.createProject({
        name: projectName,
        type: 'software'
      });

      // Verify project exists
      let exists = await projectPage.projectExists(projectName);
      expect(exists).toBe(true);

      // Delete project
      await projectPage.deleteProject(projectName);

      // Verify project is deleted
      exists = await projectPage.projectExists(projectName);
      expect(exists).toBe(false);
    });

    test('should show empty state after deleting last project', async () => {
      await projectPage.createProject({
        name: 'Only Project',
        type: 'software'
      });

      await projectPage.deleteProject('Only Project');

      // Verify empty state appears
      const isEmpty = await projectPage.isEmptyStateVisible();
      expect(isEmpty).toBe(true);
    });

    test('should maintain other projects after deletion', async () => {
      await projectPage.createProject({
        name: 'Keep Project',
        type: 'software'
      });

      await projectPage.createProject({
        name: 'Delete Project',
        type: 'marketing'
      });

      await projectPage.deleteProject('Delete Project');

      // Verify kept project still exists
      const exists = await projectPage.projectExists('Keep Project');
      expect(exists).toBe(true);

      // Verify deleted project is gone
      const deletedExists = await projectPage.projectExists('Delete Project');
      expect(deletedExists).toBe(false);
    });
  });

  test.describe('Project Organization', () => {
    test('should handle multiple projects efficiently', async () => {
      const projectCount = 15;

      for (let i = 1; i <= projectCount; i++) {
        await projectPage.createProject({
          name: `Batch Project ${i}`,
          type: 'software'
        });
      }

      const actualCount = await projectPage.getProjectCount();
      expect(actualCount).toBe(projectCount);
    });

    test('should sort projects by last updated', async ({ page }) => {
      // Create projects with delays
      await projectPage.createProject({
        name: 'Old Project',
        type: 'software'
      });

      await page.waitForTimeout(1000);

      await projectPage.createProject({
        name: 'New Project',
        type: 'marketing'
      });

      // Get project names in order
      const projectNames = await projectPage.getAllProjectNames();

      // First project should be the newest
      expect(projectNames[0]).toBe('New Project');
    });
  });

  test.describe('Responsive Design', () => {
    test('should handle desktop viewport (1440x900)', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });

      await projectPage.createProject({
        name: 'Desktop Project',
        type: 'software'
      });

      const exists = await projectPage.projectExists('Desktop Project');
      expect(exists).toBe(true);
    });

    test('should handle tablet viewport (768x1024)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await projectPage.createProject({
        name: 'Tablet Project',
        type: 'marketing'
      });

      const exists = await projectPage.projectExists('Tablet Project');
      expect(exists).toBe(true);
    });

    test('should handle mobile viewport (375x667)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await projectPage.createProject({
        name: 'Mobile Project',
        type: 'research'
      });

      const exists = await projectPage.projectExists('Mobile Project');
      expect(exists).toBe(true);
    });
  });

  test.describe('Performance Benchmarks', () => {
    test('should create project within performance threshold', async ({ page }) => {
      const startTime = Date.now();

      await projectPage.createProject({
        name: 'Performance Test Project',
        type: 'software'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Project creation should complete within 3 seconds
      expect(duration).toBeLessThan(3000);
    });

    test('should load project list within performance threshold', async ({ page }) => {
      // Create multiple projects
      for (let i = 1; i <= 10; i++) {
        await projectPage.createProject({
          name: `Load Test Project ${i}`,
          type: 'software'
        });
      }

      const startTime = Date.now();
      await page.reload();
      await projectPage.waitForPageLoad();
      const endTime = Date.now();

      const loadTime = endTime - startTime;

      // Page load with 10 projects should complete within 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });
  });

  test.describe('Accessibility', () => {
    test('should navigate project creation with keyboard', async ({ page }) => {
      await projectPage.createProjectButton.focus();
      await page.keyboard.press('Enter');

      // Modal should open
      await projectPage.waitForVisible(projectPage.projectModal);

      // Fill form with keyboard
      await page.keyboard.type('Keyboard Project');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Created with keyboard navigation');

      // Project type select
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Save
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      await projectPage.waitForHidden(projectPage.projectModal);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await projectPage.createProjectButton.click();

      // Check modal has proper role
      const modal = await projectPage.projectModal.getAttribute('role');
      expect(modal).toBe('dialog');

      // Check inputs have labels
      const nameInput = await projectPage.projectNameInput.getAttribute('aria-label');
      expect(nameInput).toBeTruthy();
    });
  });
});
