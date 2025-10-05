import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Project, ProjectType, ProjectStatus } from '../../../src/types';

/**
 * ProjectPage - Page object for project management operations
 */
export class ProjectPage extends BasePage {
  // Locators
  readonly createProjectButton: Locator;
  readonly projectModal: Locator;
  readonly projectNameInput: Locator;
  readonly projectDescriptionInput: Locator;
  readonly projectTypeSelect: Locator;
  readonly projectStatusSelect: Locator;
  readonly projectVisibilitySelect: Locator;
  readonly saveProjectButton: Locator;
  readonly cancelButton: Locator;
  readonly projectsList: Locator;
  readonly sidebarProjects: Locator;
  readonly searchInput: Locator;
  readonly deleteProjectButton: Locator;
  readonly confirmDeleteButton: Locator;
  readonly editProjectButton: Locator;
  readonly emptyStateMessage: Locator;

  constructor(page: Page) {
    super(page);

    // Initialize locators - Use data-testid with fallbacks
    this.createProjectButton = page.getByTestId('create-project-button').or(page.getByRole('button', { name: /new project|create project/i }));
    this.projectModal = page.getByRole('dialog').or(page.locator('[role="dialog"]'));
    this.projectNameInput = page.getByLabel(/project name/i).or(page.getByPlaceholder(/project name/i));
    this.projectDescriptionInput = page.getByLabel(/description/i).or(page.getByPlaceholder(/description/i));
    this.projectTypeSelect = page.getByLabel(/project type/i);
    this.projectStatusSelect = page.getByLabel(/status/i);
    this.projectVisibilitySelect = page.getByLabel(/visibility/i);
    this.saveProjectButton = page.getByRole('button', { name: /save|create/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    this.projectsList = page.getByTestId('project-list').or(page.locator('.projects-list'));
    this.sidebarProjects = page.locator('[data-testid="sidebar-projects"]').or(page.locator('.sidebar-projects'));
    this.searchInput = page.getByPlaceholder(/search projects/i);
    this.deleteProjectButton = page.getByRole('button', { name: /delete/i });
    this.confirmDeleteButton = page.getByRole('button', { name: /confirm|yes|delete/i });
    this.editProjectButton = page.getByRole('button', { name: /edit/i });
    this.emptyStateMessage = page.getByText(/no projects|get started|create your first/i);
  }

  /**
   * Navigate to projects page
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForPageLoad();
  }

  /**
   * Create a new project
   */
  async createProject(project: {
    name: string;
    description?: string;
    type: ProjectType;
    status?: ProjectStatus;
    visibility?: 'private' | 'team' | 'public';
  }): Promise<void> {
    // Click create project button
    await this.createProjectButton.click();

    // Wait for modal to open
    await this.waitForVisible(this.projectModal);

    // Fill in project details
    await this.projectNameInput.fill(project.name);

    if (project.description) {
      await this.projectDescriptionInput.fill(project.description);
    }

    // Select project type
    await this.projectTypeSelect.click();
    await this.page.getByRole('option', { name: new RegExp(project.type, 'i') }).click();

    // Select status if provided
    if (project.status) {
      await this.projectStatusSelect.click();
      await this.page.getByRole('option', { name: new RegExp(project.status, 'i') }).click();
    }

    // Select visibility if provided
    if (project.visibility) {
      await this.projectVisibilitySelect.click();
      await this.page.getByRole('option', { name: new RegExp(project.visibility, 'i') }).click();
    }

    // Save project
    await this.saveProjectButton.click();

    // Wait for modal to close
    await this.waitForHidden(this.projectModal);
  }

  /**
   * Get project card by name or ID
   */
  getProjectCard(projectName: string): Locator {
    // Try data-testid first, then fallback to text filter
    return this.page.locator(`[data-testid^="project-card-"]`).filter({ hasText: projectName });
  }

  /**
   * Check if project exists in list
   */
  async projectExists(projectName: string): Promise<boolean> {
    try {
      await this.getProjectCard(projectName).waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if project exists in sidebar
   */
  async projectExistsInSidebar(projectName: string): Promise<boolean> {
    try {
      await this.sidebarProjects
        .locator(`[data-testid="sidebar-project"]`)
        .filter({ hasText: projectName })
        .waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Switch to a project
   */
  async switchToProject(projectName: string): Promise<void> {
    const projectCard = this.sidebarProjects
      .locator(`[data-testid="sidebar-project"]`)
      .filter({ hasText: projectName });

    await projectCard.click();
    await this.page.waitForTimeout(1000); // Wait for project to load
  }

  /**
   * Edit project details
   */
  async editProject(
    projectName: string,
    updates: {
      name?: string;
      description?: string;
      status?: ProjectStatus;
    }
  ): Promise<void> {
    const projectCard = this.getProjectCard(projectName);
    await projectCard.hover();
    await projectCard.locator(this.editProjectButton).click();

    // Wait for modal
    await this.waitForVisible(this.projectModal);

    // Update fields
    if (updates.name) {
      await this.projectNameInput.clear();
      await this.projectNameInput.fill(updates.name);
    }

    if (updates.description) {
      await this.projectDescriptionInput.clear();
      await this.projectDescriptionInput.fill(updates.description);
    }

    if (updates.status) {
      await this.projectStatusSelect.click();
      await this.page.getByRole('option', { name: new RegExp(updates.status, 'i') }).click();
    }

    // Save changes
    await this.saveProjectButton.click();
    await this.waitForHidden(this.projectModal);
  }

  /**
   * Delete a project
   */
  async deleteProject(projectName: string): Promise<void> {
    const projectCard = this.getProjectCard(projectName);
    await projectCard.hover();
    await projectCard.locator(this.deleteProjectButton).click();

    // Confirm deletion
    await this.confirmDeleteButton.click();

    // Wait for project to be removed
    await this.page.waitForTimeout(1000);
  }

  /**
   * Search for projects
   */
  async searchProjects(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  /**
   * Get project count
   */
  async getProjectCount(): Promise<number> {
    const projects = await this.projectsList.locator('[data-testid="project-card"]').all();
    return projects.length;
  }

  /**
   * Check if empty state is visible
   */
  async isEmptyStateVisible(): Promise<boolean> {
    try {
      await this.emptyStateMessage.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all project names
   */
  async getAllProjectNames(): Promise<string[]> {
    const projectCards = await this.projectsList.locator('[data-testid="project-card"]').all();
    const names: string[] = [];

    for (const card of projectCards) {
      const name = await card.locator('[data-testid="project-name"]').textContent();
      if (name) {
        names.push(name.trim());
      }
    }

    return names;
  }

  /**
   * Verify project details
   */
  async verifyProjectDetails(projectName: string, expectedDetails: {
    description?: string;
    type?: string;
    status?: string;
  }): Promise<void> {
    const projectCard = this.getProjectCard(projectName);

    if (expectedDetails.description) {
      await expect(projectCard.getByText(expectedDetails.description)).toBeVisible();
    }

    if (expectedDetails.type) {
      await expect(projectCard.getByText(new RegExp(expectedDetails.type, 'i'))).toBeVisible();
    }

    if (expectedDetails.status) {
      await expect(projectCard.getByText(new RegExp(expectedDetails.status, 'i'))).toBeVisible();
    }
  }
}
