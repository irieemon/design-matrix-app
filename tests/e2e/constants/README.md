# E2E Test Selector Constants

## Overview

This directory contains centralized selector constants for all E2E tests in the design-matrix-app. Using these constants ensures:

- **Reliability**: All selectors use `data-testid` attributes
- **Maintainability**: Single source of truth for all test selectors
- **Discoverability**: TypeScript autocomplete helps find the right selector
- **Consistency**: Standardized naming conventions across all tests

## Quick Start

### Basic Import and Usage

```typescript
import { SELECTORS } from './constants/selectors';

// Use categorized selectors
await page.locator(SELECTORS.AUTH.EMAIL_INPUT).fill('test@example.com');
await page.locator(SELECTORS.AUTH.SUBMIT_BUTTON).click();
await expect(page.locator(SELECTORS.PAGES.MATRIX)).toBeVisible();
```

### Dynamic Selectors with Helpers

```typescript
import { selectorHelpers } from './constants/selectors';

// Work with dynamic IDs
const ideaId = 'abc-123';
await page.locator(selectorHelpers.ideaCard(ideaId)).click();
await page.locator(selectorHelpers.editButton(ideaId)).click();
```

## Selector Categories

### 1. Authentication (`SELECTORS.AUTH`)

All authentication and login-related selectors.

```typescript
// Example: Complete login flow
await page.locator(SELECTORS.AUTH.EMAIL_INPUT).fill('user@example.com');
await page.locator(SELECTORS.AUTH.PASSWORD_INPUT).fill('password');
await page.locator(SELECTORS.AUTH.SUBMIT_BUTTON).click();
await expect(page.locator(SELECTORS.AUTH.SUCCESS_MESSAGE)).toBeVisible();
```

**Available selectors:**
- `EMAIL_INPUT`, `PASSWORD_INPUT`, `CONFIRM_PASSWORD_INPUT`, `FULLNAME_INPUT`
- `SUBMIT_BUTTON`, `DEMO_BUTTON`, `MODE_SWITCHER`
- `ERROR_MESSAGE`, `SUCCESS_MESSAGE`

### 2. Modals (`SELECTORS.MODALS`)

All modal dialog selectors including add/edit/delete confirmations.

```typescript
// Example: Working with idea modals
await page.locator(SELECTORS.MATRIX.ADD_IDEA_BUTTON).click();
await expect(page.locator(SELECTORS.MODALS.ADD_IDEA)).toBeVisible();
await page.locator(SELECTORS.FORMS.IDEA_CONTENT_INPUT).fill('New idea');
await page.locator(SELECTORS.FORMS.IDEA_SAVE_BUTTON).click();
await expect(page.locator(SELECTORS.MODALS.ADD_IDEA)).not.toBeVisible();
```

**Available selectors:**
- `ADD_IDEA`, `EDIT_IDEA`, `AI_INSIGHTS`, `AI_STARTER`
- `EXPORT`, `FEATURE`, `DELETE_CONFIRM`
- `CLOSE`, `CONTENT`

### 3. Design Matrix (`SELECTORS.MATRIX`)

Design matrix and quadrant selectors.

```typescript
// Example: Verify quadrants exist
await expect(page.locator(SELECTORS.MATRIX.CONTAINER)).toBeVisible();
await expect(page.locator(SELECTORS.MATRIX.QUADRANT_QUICK_WINS)).toBeVisible();
await expect(page.locator(SELECTORS.MATRIX.QUADRANT_STRATEGIC)).toBeVisible();
```

**Available selectors:**
- `CONTAINER`
- `QUADRANT_QUICK_WINS`, `QUADRANT_STRATEGIC`, `QUADRANT_RECONSIDER`, `QUADRANT_AVOID`
- `ADD_IDEA_BUTTON`

### 4. Navigation (`SELECTORS.NAVIGATION`)

Sidebar and navigation elements.

```typescript
// Example: Navigate to different pages
await page.locator(SELECTORS.NAVIGATION.SIDEBAR).isVisible();
await page.locator(SELECTORS.NAVIGATION.MATRIX_NAV_PROJECTS).click();
await expect(page.locator(SELECTORS.PAGES.PROJECTS)).toBeVisible();
```

**Available selectors:**
- `SIDEBAR`, `SIDEBAR_TOGGLE`, `SIDEBAR_NAV`, `SIDEBAR_LOGOUT`, `SIDEBAR_ADMIN`
- `MATRIX_NAV_PROJECTS`, `PROJECTS_NAV_MATRIX`, `COLLAB_BACK`

### 5. Pages (`SELECTORS.PAGES`)

Page-level containers and content areas.

```typescript
// Example: Page navigation verification
await expect(page.locator(SELECTORS.PAGES.MATRIX)).toBeVisible();
await page.locator(SELECTORS.NAVIGATION.SIDEBAR_NAV).click();
await expect(page.locator(SELECTORS.PAGES.PROJECTS)).toBeVisible();
```

**Available selectors:**
- `MATRIX`, `PROJECTS`, `DATA`, `REPORTS`, `ROADMAP`, `COLLABORATION`, `USER`, `FILES`
- `BUTTON_TEST`, `FORM_TEST`, `SKELETON_TEST`

### 6. Forms (`SELECTORS.FORMS`)

Form inputs and controls.

```typescript
// Example: Fill out a form
await page.locator(SELECTORS.FORMS.NAME_INPUT).fill('John Doe');
await page.locator(SELECTORS.FORMS.EMAIL_INPUT).fill('john@example.com');
await page.locator(SELECTORS.FORMS.MESSAGE_TEXTAREA).fill('Test message');
await page.locator(SELECTORS.FORMS.SUBMIT_BUTTON).click();
```

**Available selectors:**
- Idea forms: `IDEA_CONTENT_INPUT`, `IDEA_SAVE_BUTTON`, `IDEA_CANCEL_BUTTON`, `IDEA_DELETE_BUTTON`
- Test forms: `NAME_INPUT`, `EMAIL_INPUT`, `MESSAGE_TEXTAREA`, `PRIORITY_SELECT`, `CATEGORY_SELECT`

### 7. Buttons (`SELECTORS.BUTTONS`)

Button-specific selectors for testing interactions.

```typescript
// Example: Test button accessibility
await page.locator(SELECTORS.BUTTONS.KEYBOARD_FOCUS).focus();
await page.keyboard.press('Enter');
await expect(page.locator(SELECTORS.BUTTONS.LOADING_ACCESSIBILITY)).toHaveAttribute('aria-busy', 'true');
```

### 8. UI Elements (`SELECTORS.UI`)

Common UI elements like logos, icons, and loading states.

```typescript
// Example: Verify UI elements
await expect(page.locator(SELECTORS.UI.LOGO)).toBeVisible();
await expect(page.locator(SELECTORS.UI.LOADING_SPINNER)).not.toBeVisible();
await page.locator(SELECTORS.UI.ICONS.HOME).click();
```

### 9. Skeletons (`SELECTORS.SKELETONS`)

Loading skeleton selectors.

```typescript
// Example: Verify loading states
await expect(page.locator(SELECTORS.SKELETONS.CARD)).toBeVisible();
await page.waitForLoadState('networkidle');
await expect(page.locator(SELECTORS.SKELETONS.CARD)).not.toBeVisible();
```

### 10. Projects (`SELECTORS.PROJECTS`)

Project management selectors.

```typescript
// Example: Create new project
await page.locator(SELECTORS.PROJECTS.CREATE_BUTTON).click();
await expect(page.locator(SELECTORS.PROJECTS.STARTUP_FLOW)).toBeVisible();
```

## Helper Functions

The `selectorHelpers` object provides dynamic selector generation:

### Dynamic ID Selectors

```typescript
import { selectorHelpers } from './constants/selectors';

// Idea cards
const ideaId = 'unique-idea-id';
await page.locator(selectorHelpers.ideaCard(ideaId)).click();

// Project cards
const projectId = 'project-123';
await page.locator(selectorHelpers.projectCard(projectId)).dblclick();

// Action buttons
await page.locator(selectorHelpers.editButton(ideaId)).click();
await page.locator(selectorHelpers.deleteButton(ideaId)).click();
```

### Milestone Selectors

```typescript
// Access specific milestone elements
await expect(
  page.locator(selectorHelpers.milestone(0))
).toBeVisible();

await expect(
  page.locator(selectorHelpers.milestoneTitle(0))
).toHaveText('Project Kickoff');
```

### Button Variants

```typescript
// Test button variants
for (const variant of ['primary', 'secondary', 'danger']) {
  await expect(
    page.locator(selectorHelpers.buttonVariant(variant))
  ).toBeVisible();
}
```

### Text-Based Selectors

```typescript
// Find elements by text content
await page.locator(selectorHelpers.byText('Submit')).click();
await page.locator(selectorHelpers.buttonWithText('Save Changes')).click();
```

### Role-Based Selectors

```typescript
// Use ARIA roles for accessibility testing
await page.locator(selectorHelpers.byRole('button', 'Close')).click();
await page.locator(selectorHelpers.byRole('dialog')).isVisible();
```

## Best Practices

### 1. Always Use Constants

✅ **Good:**
```typescript
await page.locator(SELECTORS.AUTH.EMAIL_INPUT).fill('test@example.com');
```

❌ **Bad:**
```typescript
await page.locator('[data-testid="auth-email-input"]').fill('test@example.com');
```

### 2. Use Helper Functions for Dynamic IDs

✅ **Good:**
```typescript
const ideaId = await createIdea('Test idea');
await page.locator(selectorHelpers.ideaCard(ideaId)).click();
```

❌ **Bad:**
```typescript
await page.locator(`[data-testid="idea-card-${ideaId}"]`).click();
```

### 3. Organize Imports

✅ **Good:**
```typescript
import { SELECTORS, selectorHelpers } from './constants/selectors';
```

❌ **Bad:**
```typescript
import { AUTH, MODALS, FORMS } from './constants/selectors';
// Too many individual imports
```

### 4. Combine with Page Object Model

```typescript
class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.locator(SELECTORS.AUTH.EMAIL_INPUT).fill(email);
    await this.page.locator(SELECTORS.AUTH.PASSWORD_INPUT).fill(password);
    await this.page.locator(SELECTORS.AUTH.SUBMIT_BUTTON).click();
  }

  async verifySuccess() {
    await expect(
      this.page.locator(SELECTORS.AUTH.SUCCESS_MESSAGE)
    ).toBeVisible();
  }
}
```

### 5. Create Reusable Test Utilities

```typescript
// test-utils.ts
export async function waitForModalToOpen(page: Page, modalSelector: string) {
  await expect(page.locator(modalSelector)).toBeVisible();
  await page.waitForLoadState('networkidle');
}

// In tests:
await waitForModalToOpen(page, SELECTORS.MODALS.ADD_IDEA);
```

## TypeScript Support

All selectors are fully typed for autocomplete and type safety:

```typescript
import type {
  AuthSelector,
  ModalSelector,
  MatrixSelector
} from './constants/selectors';

// Type-safe selector references
const authField: AuthSelector = 'EMAIL_INPUT'; // ✅ Valid
const authField2: AuthSelector = 'INVALID'; // ❌ Type error
```

## Adding New Selectors

When adding new `data-testid` attributes to components:

1. **Add the attribute to the component:**
   ```tsx
   <button data-testid="new-feature-button">New Feature</button>
   ```

2. **Add to the appropriate category in selectors.ts:**
   ```typescript
   export const BUTTONS = {
     // ... existing selectors
     NEW_FEATURE: '[data-testid="new-feature-button"]',
   } as const;
   ```

3. **Use in tests:**
   ```typescript
   await page.locator(SELECTORS.BUTTONS.NEW_FEATURE).click();
   ```

## Naming Conventions

### data-testid Format
- Use kebab-case: `data-testid="auth-email-input"`
- Be descriptive: Include context (auth, form, button, etc.)
- Be specific: `auth-email-input` not just `email`

### Constant Names
- Use SCREAMING_SNAKE_CASE: `EMAIL_INPUT`
- Group by feature: `AUTH.EMAIL_INPUT`
- Match the element type: `*_INPUT`, `*_BUTTON`, `*_MODAL`

### Helper Function Names
- Use camelCase: `ideaCard`, `projectCard`
- Return type: Always `string`
- Be descriptive: `milestoneTitle(index)` not `mt(i)`

## Testing Workflows

### Complete Authentication Flow
```typescript
import { test, expect } from '@playwright/test';
import { SELECTORS } from './constants/selectors';

test('user can log in successfully', async ({ page }) => {
  await page.goto('/');

  // Fill login form
  await page.locator(SELECTORS.AUTH.EMAIL_INPUT).fill('user@example.com');
  await page.locator(SELECTORS.AUTH.PASSWORD_INPUT).fill('password123');
  await page.locator(SELECTORS.AUTH.SUBMIT_BUTTON).click();

  // Verify success
  await expect(page.locator(SELECTORS.AUTH.SUCCESS_MESSAGE)).toBeVisible();
  await expect(page.locator(SELECTORS.PAGES.MATRIX)).toBeVisible();
});
```

### Idea Management Flow
```typescript
test('user can create and edit idea', async ({ page }) => {
  // Create idea
  await page.locator(SELECTORS.MATRIX.ADD_IDEA_BUTTON).click();
  await expect(page.locator(SELECTORS.MODALS.ADD_IDEA)).toBeVisible();

  await page.locator(SELECTORS.FORMS.IDEA_CONTENT_INPUT).fill('Test Idea');
  await page.locator(SELECTORS.FORMS.IDEA_SAVE_BUTTON).click();

  // Verify idea appears
  const ideaCard = page.locator(selectorHelpers.ideaCard('new-idea-id'));
  await expect(ideaCard).toBeVisible();

  // Edit idea
  await ideaCard.dblclick();
  await expect(page.locator(SELECTORS.MODALS.EDIT_IDEA)).toBeVisible();
});
```

### Navigation Flow
```typescript
test('user can navigate between pages', async ({ page }) => {
  // Start on matrix page
  await expect(page.locator(SELECTORS.PAGES.MATRIX)).toBeVisible();

  // Navigate to projects
  await page.locator(SELECTORS.NAVIGATION.MATRIX_NAV_PROJECTS).click();
  await expect(page.locator(SELECTORS.PAGES.PROJECTS)).toBeVisible();

  // Navigate back to matrix
  await page.locator(SELECTORS.NAVIGATION.PROJECTS_NAV_MATRIX).click();
  await expect(page.locator(SELECTORS.PAGES.MATRIX)).toBeVisible();
});
```

## Troubleshooting

### Selector Not Found

**Problem:** `Error: Selector not found`

**Solutions:**
1. Verify the `data-testid` exists in the component
2. Check if the element is rendered conditionally
3. Wait for the element to appear:
   ```typescript
   await page.waitForSelector(SELECTORS.MODALS.ADD_IDEA);
   ```

### Stale Element Reference

**Problem:** Element exists but interaction fails

**Solutions:**
1. Wait for element to be stable:
   ```typescript
   await page.locator(SELECTORS.AUTH.SUBMIT_BUTTON).waitFor({ state: 'visible' });
   ```
2. Use retry logic for flaky interactions

### Type Errors

**Problem:** TypeScript errors when using selectors

**Solutions:**
1. Ensure you're importing from the correct path
2. Use the `SELECTORS` object for organized access
3. Check selector category matches expected type

## Migration Guide

If you have existing tests using hardcoded selectors:

### Before:
```typescript
await page.locator('[data-testid="auth-email-input"]').fill('test@example.com');
await page.locator('[data-testid="auth-submit-button"]').click();
```

### After:
```typescript
import { SELECTORS } from './constants/selectors';

await page.locator(SELECTORS.AUTH.EMAIL_INPUT).fill('test@example.com');
await page.locator(SELECTORS.AUTH.SUBMIT_BUTTON).click();
```

### Benefits:
- ✅ Autocomplete support
- ✅ Type safety
- ✅ Easy refactoring
- ✅ Single source of truth
- ✅ Better maintainability

## Contributing

When adding new selectors:

1. Follow naming conventions
2. Add to appropriate category
3. Include JSDoc comments for complex helpers
4. Update this README with examples
5. Ensure TypeScript types are exported

---

**Need help?** Check the inline documentation in `selectors.ts` or review existing test files for usage examples.
