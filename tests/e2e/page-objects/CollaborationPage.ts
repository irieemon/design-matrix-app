import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import type { ProjectRole } from '../../../src/types';

/**
 * CollaborationPage - Page object for collaboration operations
 */
export class CollaborationPage extends BasePage {
  // Locators
  readonly inviteCollaboratorButton: Locator;
  readonly inviteModal: Locator;
  readonly emailInput: Locator;
  readonly roleSelect: Locator;
  readonly sendInviteButton: Locator;
  readonly collaboratorsList: Locator;
  readonly removeCollaboratorButton: Locator;
  readonly changeRoleButton: Locator;
  readonly confirmRemoveButton: Locator;
  readonly onlineIndicator: Locator;
  readonly activityLog: Locator;
  readonly transferOwnershipButton: Locator;

  constructor(page: Page) {
    super(page);

    this.inviteCollaboratorButton = page.getByRole('button', { name: /invite|add collaborator/i });
    this.inviteModal = page.getByRole('dialog').or(page.locator('[role="dialog"]'));
    this.emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    this.roleSelect = page.getByLabel(/role/i);
    this.sendInviteButton = page.getByRole('button', { name: /send|invite/i });
    this.collaboratorsList = page.locator('[data-testid="collaborators-list"]');
    this.removeCollaboratorButton = page.getByRole('button', { name: /remove/i });
    this.changeRoleButton = page.getByRole('button', { name: /change role/i });
    this.confirmRemoveButton = page.getByRole('button', { name: /confirm|yes|remove/i });
    this.onlineIndicator = page.locator('[data-testid="online-indicator"]');
    this.activityLog = page.locator('[data-testid="activity-log"]');
    this.transferOwnershipButton = page.getByRole('button', { name: /transfer ownership/i });
  }

  /**
   * Navigate to collaboration settings
   */
  async gotoCollaborationSettings(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}/settings/collaboration`);
    await this.waitForPageLoad();
  }

  /**
   * Invite a collaborator
   */
  async inviteCollaborator(email: string, role: ProjectRole = 'viewer'): Promise<void> {
    await this.inviteCollaboratorButton.click();
    await this.waitForVisible(this.inviteModal);

    await this.emailInput.fill(email);

    // Select role
    await this.roleSelect.click();
    await this.page.getByRole('option', { name: new RegExp(role, 'i') }).click();

    await this.sendInviteButton.click();
    await this.waitForHidden(this.inviteModal);
  }

  /**
   * Get collaborator row by email
   */
  getCollaboratorRow(email: string): Locator {
    return this.collaboratorsList
      .locator('[data-testid="collaborator-row"]')
      .filter({ hasText: email });
  }

  /**
   * Check if collaborator exists
   */
  async collaboratorExists(email: string): Promise<boolean> {
    try {
      await this.getCollaboratorRow(email).waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get collaborator role
   */
  async getCollaboratorRole(email: string): Promise<string | null> {
    const collaboratorRow = this.getCollaboratorRow(email);
    const roleElement = collaboratorRow.locator('[data-testid="collaborator-role"]');
    return await roleElement.textContent();
  }

  /**
   * Change collaborator role
   */
  async changeCollaboratorRole(email: string, newRole: ProjectRole): Promise<void> {
    const collaboratorRow = this.getCollaboratorRow(email);
    await collaboratorRow.hover();
    await collaboratorRow.locator(this.changeRoleButton).click();

    // Select new role
    await this.roleSelect.click();
    await this.page.getByRole('option', { name: new RegExp(newRole, 'i') }).click();

    await this.page.waitForTimeout(1000);
  }

  /**
   * Remove a collaborator
   */
  async removeCollaborator(email: string): Promise<void> {
    const collaboratorRow = this.getCollaboratorRow(email);
    await collaboratorRow.hover();
    await collaboratorRow.locator(this.removeCollaboratorButton).click();

    // Confirm removal
    await this.confirmRemoveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Check if user is online
   */
  async isUserOnline(email: string): Promise<boolean> {
    const collaboratorRow = this.getCollaboratorRow(email);
    const indicator = collaboratorRow.locator(this.onlineIndicator);

    try {
      await indicator.waitFor({ state: 'visible', timeout: 2000 });
      const classes = await indicator.getAttribute('class');
      return classes?.includes('online') ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Get collaborator count
   */
  async getCollaboratorCount(): Promise<number> {
    const collaborators = await this.collaboratorsList
      .locator('[data-testid="collaborator-row"]')
      .all();
    return collaborators.length;
  }

  /**
   * Accept collaboration invite
   */
  async acceptInvite(inviteToken: string): Promise<void> {
    await this.page.goto(`/invites/${inviteToken}`);
    await this.waitForPageLoad();

    const acceptButton = this.page.getByRole('button', { name: /accept/i });
    await acceptButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Verify activity log entry
   */
  async verifyActivityLogEntry(activityText: string): Promise<void> {
    const entry = this.activityLog
      .locator('[data-testid="activity-entry"]')
      .filter({ hasText: activityText });
    await expect(entry).toBeVisible();
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(count: number = 5): Promise<string[]> {
    const entries = await this.activityLog
      .locator('[data-testid="activity-entry"]')
      .all();

    const activities: string[] = [];
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      const text = await entries[i].textContent();
      if (text) {
        activities.push(text.trim());
      }
    }

    return activities;
  }

  /**
   * Transfer project ownership
   */
  async transferOwnership(newOwnerEmail: string): Promise<void> {
    await this.transferOwnershipButton.click();

    // Select new owner
    await this.page.getByRole('combobox', { name: /new owner/i }).click();
    await this.page.getByRole('option', { name: newOwnerEmail }).click();

    // Confirm transfer
    const confirmButton = this.page.getByRole('button', { name: /confirm|transfer/i });
    await confirmButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Mock real-time presence
   */
  async mockUserPresence(userId: string, isOnline: boolean): Promise<void> {
    await this.mockDatabaseOperation('user_presence', {
      userId,
      isOnline,
      lastSeen: new Date().toISOString()
    });
  }

  /**
   * Verify permission level
   */
  async verifyPermissionLevel(action: string, canPerform: boolean): Promise<void> {
    const actionButton = this.page.getByRole('button', { name: new RegExp(action, 'i') });

    if (canPerform) {
      await expect(actionButton).toBeEnabled();
    } else {
      await expect(actionButton).toBeDisabled();
    }
  }
}
