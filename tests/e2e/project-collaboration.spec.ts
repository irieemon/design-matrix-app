import { test, expect } from '@playwright/test';
import { ProjectPage } from './page-objects/ProjectPage';
import { CollaborationPage } from './page-objects/CollaborationPage';
import type { ProjectRole } from '../../src/types';

test.describe('Project Collaboration E2E Tests', () => {
  let projectPage: ProjectPage;
  let collaborationPage: CollaborationPage;

  const ownerUserId = 'test-owner-001';
  const ownerEmail = 'owner@test.com';
  const testProjectName = 'Collaboration Test Project';

  test.beforeEach(async ({ page }) => {
    projectPage = new ProjectPage(page);
    collaborationPage = new CollaborationPage(page);

    // Setup as project owner
    await projectPage.goto();
    await projectPage.bypassAuth(ownerUserId, ownerEmail);
    await page.reload();
    await projectPage.waitForPageLoad();

    // Create test project
    await projectPage.createProject({
      name: testProjectName,
      description: 'Testing collaboration features',
      type: 'software',
      visibility: 'team'
    });
  });

  test.afterEach(async ({ page }) => {
    await projectPage.clearAuth();
  });

  test.describe('Invite Collaborator', () => {
    test('should invite collaborator via email with viewer role', async ({ page }) => {
      const collaboratorEmail = 'viewer@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');

      // Verify collaborator was added
      const exists = await collaborationPage.collaboratorExists(collaboratorEmail);
      expect(exists).toBe(true);

      // Verify role
      const role = await collaborationPage.getCollaboratorRole(collaboratorEmail);
      expect(role).toContain('viewer');
    });

    test('should invite collaborator with editor role', async () => {
      const collaboratorEmail = 'editor@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'editor');

      const exists = await collaborationPage.collaboratorExists(collaboratorEmail);
      expect(exists).toBe(true);

      const role = await collaborationPage.getCollaboratorRole(collaboratorEmail);
      expect(role).toContain('editor');
    });

    test('should invite collaborator with commenter role', async () => {
      const collaboratorEmail = 'commenter@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'commenter');

      const exists = await collaborationPage.collaboratorExists(collaboratorEmail);
      expect(exists).toBe(true);
    });

    test('should invite collaborator with admin role', async () => {
      const collaboratorEmail = 'admin@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'owner');

      const exists = await collaborationPage.collaboratorExists(collaboratorEmail);
      expect(exists).toBe(true);
    });

    test('should prevent duplicate invitations', async ({ page }) => {
      const collaboratorEmail = 'duplicate@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');

      // Try to invite again
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'editor');

      // Should show error message
      const errorMessage = page.getByText(/already a collaborator|already invited/i);
      await expect(errorMessage).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await collaborationPage.gotoCollaborationSettings(testProjectName);

      // Try to invite with invalid email
      await collaborationPage.inviteCollaboratorButton.click();
      await collaborationPage.emailInput.fill('invalid-email');
      await collaborationPage.sendInviteButton.click();

      // Should show validation error
      const errorMessage = page.getByText(/invalid email|enter a valid email/i);
      await expect(errorMessage).toBeVisible();
    });
  });

  test.describe('Accept Collaboration Invite', () => {
    test('should accept invitation and gain project access', async ({ page, context }) => {
      const collaboratorEmail = 'acceptor@test.com';
      const collaboratorId = 'test-collaborator-001';

      // Owner invites collaborator
      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'editor');

      // Simulate collaborator accepting invite in new context
      const collaboratorPage = await context.newPage();
      const collabPageObject = new CollaborationPage(collaboratorPage);

      await collaboratorPage.goto('/');
      await collabPageObject.bypassAuth(collaboratorId, collaboratorEmail);
      await collaboratorPage.reload();

      // Accept invitation
      const inviteToken = 'mock-invite-token-123';
      await collabPageObject.acceptInvite(inviteToken);

      // Verify collaborator can access project
      const projectPageObject = new ProjectPage(collaboratorPage);
      const canAccess = await projectPageObject.projectExists(testProjectName);
      expect(canAccess).toBe(true);

      await collaboratorPage.close();
    });

    test('should update invitation status after acceptance', async ({ page }) => {
      const collaboratorEmail = 'status-update@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');

      // Mock invitation acceptance
      await collaborationPage.mockDatabaseOperation('accept_invite', {
        email: collaboratorEmail,
        status: 'accepted'
      });

      await page.reload();

      // Verify status changed
      const collaboratorRow = collaborationPage.getCollaboratorRow(collaboratorEmail);
      await expect(collaboratorRow.getByText(/active|accepted/i)).toBeVisible();
    });
  });

  test.describe('Collaborator Permissions', () => {
    test('viewer can view but not edit project', async ({ page, context }) => {
      const viewerEmail = 'viewer-permissions@test.com';
      const viewerId = 'test-viewer-001';

      // Invite viewer
      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(viewerEmail, 'viewer');

      // Switch to viewer context
      const viewerPage = await context.newPage();
      const viewerCollab = new CollaborationPage(viewerPage);
      await viewerPage.goto('/');
      await viewerCollab.bypassAuth(viewerId, viewerEmail);
      await viewerPage.reload();

      // Navigate to project
      const viewerProjectPage = new ProjectPage(viewerPage);
      await viewerProjectPage.switchToProject(testProjectName);

      // Verify viewer cannot edit
      await viewerCollab.verifyPermissionLevel('edit', false);
      await viewerCollab.verifyPermissionLevel('delete', false);

      await viewerPage.close();
    });

    test('editor can edit but not delete project', async ({ page, context }) => {
      const editorEmail = 'editor-permissions@test.com';
      const editorId = 'test-editor-001';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(editorEmail, 'editor');

      const editorPage = await context.newPage();
      const editorCollab = new CollaborationPage(editorPage);
      await editorPage.goto('/');
      await editorCollab.bypassAuth(editorId, editorEmail);
      await editorPage.reload();

      const editorProjectPage = new ProjectPage(editorPage);
      await editorProjectPage.switchToProject(testProjectName);

      // Verify editor can edit
      await editorCollab.verifyPermissionLevel('edit', true);

      // Verify editor cannot delete
      await editorCollab.verifyPermissionLevel('delete', false);

      await editorPage.close();
    });

    test('owner can perform all actions', async ({ page }) => {
      await collaborationPage.gotoCollaborationSettings(testProjectName);

      // Verify owner permissions
      await collaborationPage.verifyPermissionLevel('edit', true);
      await collaborationPage.verifyPermissionLevel('delete', true);
      await collaborationPage.verifyPermissionLevel('invite', true);
      await collaborationPage.verifyPermissionLevel('transfer ownership', true);
    });

    test('commenter can add comments but not edit content', async ({ page, context }) => {
      const commenterEmail = 'commenter-permissions@test.com';
      const commenterId = 'test-commenter-001';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(commenterEmail, 'commenter');

      const commenterPage = await context.newPage();
      const commenterCollab = new CollaborationPage(commenterPage);
      await commenterPage.goto('/');
      await commenterCollab.bypassAuth(commenterId, commenterEmail);
      await commenterPage.reload();

      // Verify commenter can comment
      await commenterCollab.verifyPermissionLevel('comment', true);

      // Verify commenter cannot edit
      await commenterCollab.verifyPermissionLevel('edit', false);

      await commenterPage.close();
    });
  });

  test.describe('Real-time Collaboration', () => {
    test('should show other users online', async ({ page, context }) => {
      const collaborator1Email = 'online1@test.com';
      const collaborator1Id = 'test-online-001';
      const collaborator2Email = 'online2@test.com';
      const collaborator2Id = 'test-online-002';

      // Invite collaborators
      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaborator1Email, 'editor');
      await collaborationPage.inviteCollaborator(collaborator2Email, 'editor');

      // Mock user presence
      await collaborationPage.mockUserPresence(collaborator1Id, true);
      await collaborationPage.mockUserPresence(collaborator2Id, true);

      await page.reload();

      // Verify online indicators
      const isOnline1 = await collaborationPage.isUserOnline(collaborator1Email);
      const isOnline2 = await collaborationPage.isUserOnline(collaborator2Email);

      expect(isOnline1).toBe(true);
      expect(isOnline2).toBe(true);
    });

    test('should update presence when user goes offline', async ({ page }) => {
      const collaboratorEmail = 'offline-test@test.com';
      const collaboratorId = 'test-offline-001';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'editor');

      // Set user online
      await collaborationPage.mockUserPresence(collaboratorId, true);
      await page.reload();

      let isOnline = await collaborationPage.isUserOnline(collaboratorEmail);
      expect(isOnline).toBe(true);

      // Set user offline
      await collaborationPage.mockUserPresence(collaboratorId, false);
      await page.reload();

      isOnline = await collaborationPage.isUserOnline(collaboratorEmail);
      expect(isOnline).toBe(false);
    });

    test('should show real-time updates for collaborator changes', async ({ page }) => {
      const collaboratorEmail = 'realtime@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');

      // Simulate real-time role change
      await collaborationPage.mockDatabaseOperation('update_collaborator_role', {
        email: collaboratorEmail,
        newRole: 'editor'
      });

      await page.waitForTimeout(1000);

      // Verify UI updated
      const role = await collaborationPage.getCollaboratorRole(collaboratorEmail);
      expect(role).toContain('editor');
    });
  });

  test.describe('Collaborator Management', () => {
    test('should remove collaborator', async ({ page }) => {
      const collaboratorEmail = 'remove-test@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');

      // Verify collaborator exists
      let exists = await collaborationPage.collaboratorExists(collaboratorEmail);
      expect(exists).toBe(true);

      // Remove collaborator
      await collaborationPage.removeCollaborator(collaboratorEmail);

      // Verify collaborator removed
      exists = await collaborationPage.collaboratorExists(collaboratorEmail);
      expect(exists).toBe(false);
    });

    test('should change collaborator role', async ({ page }) => {
      const collaboratorEmail = 'role-change@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');

      // Verify initial role
      let role = await collaborationPage.getCollaboratorRole(collaboratorEmail);
      expect(role).toContain('viewer');

      // Change role to editor
      await collaborationPage.changeCollaboratorRole(collaboratorEmail, 'editor');

      // Verify role changed
      role = await collaborationPage.getCollaboratorRole(collaboratorEmail);
      expect(role).toContain('editor');
    });

    test('should display collaborator count', async ({ page }) => {
      await collaborationPage.gotoCollaborationSettings(testProjectName);

      // Add multiple collaborators
      const collaborators = [
        'collab1@test.com',
        'collab2@test.com',
        'collab3@test.com'
      ];

      for (const email of collaborators) {
        await collaborationPage.inviteCollaborator(email, 'viewer');
      }

      // Verify count
      const count = await collaborationPage.getCollaboratorCount();
      expect(count).toBe(3);
    });

    test('should maintain collaborator list after page reload', async ({ page }) => {
      const collaboratorEmail = 'persist@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'editor');

      // Reload page
      await page.reload();
      await collaborationPage.waitForPageLoad();

      // Verify collaborator still exists
      const exists = await collaborationPage.collaboratorExists(collaboratorEmail);
      expect(exists).toBe(true);
    });
  });

  test.describe('Owner Transfer', () => {
    test('should transfer project ownership', async ({ page }) => {
      const newOwnerEmail = 'new-owner@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(newOwnerEmail, 'editor');

      // Transfer ownership
      await collaborationPage.transferOwnership(newOwnerEmail);

      // Verify ownership transferred
      const role = await collaborationPage.getCollaboratorRole(newOwnerEmail);
      expect(role).toContain('owner');
    });

    test('should demote previous owner to editor after transfer', async ({ page }) => {
      const newOwnerEmail = 'successor@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(newOwnerEmail, 'editor');

      await collaborationPage.transferOwnership(newOwnerEmail);

      // Verify previous owner is now editor
      const role = await collaborationPage.getCollaboratorRole(ownerEmail);
      expect(role).toContain('editor');
    });

    test('should restrict ownership transfer to existing collaborators', async ({ page }) => {
      await collaborationPage.gotoCollaborationSettings(testProjectName);

      // Try to transfer to non-collaborator
      await collaborationPage.transferOwnershipButton.click();

      const combobox = page.getByRole('combobox', { name: /new owner/i });
      await combobox.click();

      // Should only show existing collaborators
      const options = await page.getByRole('option').all();
      expect(options.length).toBeGreaterThan(0);

      // Non-existent user should not appear
      const nonExistentOption = page.getByRole('option', { name: 'nonexistent@test.com' });
      await expect(nonExistentOption).not.toBeVisible();
    });
  });

  test.describe('Activity History and Audit Log', () => {
    test('should log collaborator invitation', async ({ page }) => {
      const collaboratorEmail = 'activity-log@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');

      // Verify activity log entry
      await collaborationPage.verifyActivityLogEntry(
        `invited ${collaboratorEmail} as viewer`
      );
    });

    test('should log collaborator removal', async ({ page }) => {
      const collaboratorEmail = 'removal-log@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');
      await collaborationPage.removeCollaborator(collaboratorEmail);

      // Verify activity log entry
      await collaborationPage.verifyActivityLogEntry(
        `removed ${collaboratorEmail}`
      );
    });

    test('should log role changes', async ({ page }) => {
      const collaboratorEmail = 'role-log@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');
      await collaborationPage.changeCollaboratorRole(collaboratorEmail, 'editor');

      // Verify activity log entry
      await collaborationPage.verifyActivityLogEntry(
        `changed ${collaboratorEmail} role from viewer to editor`
      );
    });

    test('should display recent activities', async ({ page }) => {
      await collaborationPage.gotoCollaborationSettings(testProjectName);

      // Perform multiple actions
      await collaborationPage.inviteCollaborator('user1@test.com', 'viewer');
      await collaborationPage.inviteCollaborator('user2@test.com', 'editor');
      await collaborationPage.changeCollaboratorRole('user1@test.com', 'editor');

      // Get recent activities
      const activities = await collaborationPage.getRecentActivities(5);
      expect(activities.length).toBeGreaterThanOrEqual(3);
    });

    test('should show timestamps for activities', async ({ page }) => {
      const collaboratorEmail = 'timestamp@test.com';

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator(collaboratorEmail, 'viewer');

      // Verify timestamp exists
      const activityEntry = collaborationPage.activityLog
        .locator('[data-testid="activity-entry"]')
        .filter({ hasText: collaboratorEmail });

      const timestamp = activityEntry.locator('[data-testid="activity-timestamp"]');
      await expect(timestamp).toBeVisible();
    });
  });

  test.describe('Performance and Scalability', () => {
    test('should handle multiple collaborators efficiently', async ({ page }) => {
      const collaboratorCount = 20;

      await collaborationPage.gotoCollaborationSettings(testProjectName);

      const startTime = Date.now();

      for (let i = 1; i <= collaboratorCount; i++) {
        await collaborationPage.inviteCollaborator(`collab${i}@test.com`, 'viewer');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (10 seconds for 20 invitations)
      expect(duration).toBeLessThan(10000);

      // Verify all collaborators added
      const count = await collaborationPage.getCollaboratorCount();
      expect(count).toBe(collaboratorCount);
    });

    test('should load collaborator list quickly', async ({ page }) => {
      await collaborationPage.gotoCollaborationSettings(testProjectName);

      // Add collaborators
      for (let i = 1; i <= 10; i++) {
        await collaborationPage.inviteCollaborator(`load-test${i}@test.com`, 'viewer');
      }

      const startTime = Date.now();
      await page.reload();
      await collaborationPage.waitForPageLoad();
      const endTime = Date.now();

      const loadTime = endTime - startTime;

      // Page load should be fast
      expect(loadTime).toBeLessThan(2000);
    });
  });

  test.describe('Accessibility', () => {
    test('should navigate collaboration UI with keyboard', async ({ page }) => {
      await collaborationPage.gotoCollaborationSettings(testProjectName);

      await collaborationPage.inviteCollaboratorButton.focus();
      await page.keyboard.press('Enter');

      // Modal should open
      await collaborationPage.waitForVisible(collaborationPage.inviteModal);

      // Fill form with keyboard
      await page.keyboard.type('keyboard@test.com');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Open role select
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter'); // Select role

      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Send invite

      await collaborationPage.waitForHidden(collaborationPage.inviteModal);
    });

    test('should have proper ARIA labels for collaboration elements', async ({ page }) => {
      await collaborationPage.gotoCollaborationSettings(testProjectName);

      // Check ARIA labels
      const inviteButton = await collaborationPage.inviteCollaboratorButton.getAttribute('aria-label');
      expect(inviteButton).toBeTruthy();

      await collaborationPage.inviteCollaboratorButton.click();

      const modal = await collaborationPage.inviteModal.getAttribute('role');
      expect(modal).toBe('dialog');
    });
  });

  test.describe('Responsive Design', () => {
    test('should handle collaboration on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator('mobile@test.com', 'viewer');

      const exists = await collaborationPage.collaboratorExists('mobile@test.com');
      expect(exists).toBe(true);
    });

    test('should handle collaboration on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await collaborationPage.gotoCollaborationSettings(testProjectName);
      await collaborationPage.inviteCollaborator('tablet@test.com', 'editor');

      const exists = await collaborationPage.collaboratorExists('tablet@test.com');
      expect(exists).toBe(true);
    });
  });
});
