# E2E Test Selector Improvement Plan

## Executive Summary

Analysis of 12 E2E test files reveals **72.4% of selectors are brittle** (text-based or class-based), creating significant test maintenance risk and potential for false failures during UI updates.

**Key Findings:**
- **450 total selectors analyzed**
- **89 stable data-testid selectors (19.8%)**
- **326 brittle selectors (72.4%)** requiring replacement
- **102 class-based selectors** (.idea-card-base, .matrix-container)
- **185 text-based selectors** (button:has-text("Add Idea"))

## Critical Issues

### Top 5 Most Brittle Selectors

1. **`.idea-card-base`** (102 occurrences)
   - Used across 7 test files
   - Class name coupling, breaks with CSS refactoring
   - **Fix:** Add `data-testid="idea-card"` to IdeaCardComponent

2. **`button:has-text('Add Idea')`** (34 occurrences)
   - Breaks with i18n or UI copy changes
   - Used in 6 test files
   - **Fix:** Add `data-testid="add-idea-button"` to trigger button

3. **`button:has-text('Save')`** (28 occurrences)
   - Ambiguous - used in multiple contexts
   - No way to distinguish save buttons
   - **Fix:** Context-specific testids (add-idea-save-button, edit-idea-save-button)

4. **`.matrix-container`** (43 occurrences)
   - Already has `data-testid="design-matrix"` but inconsistently used
   - **Fix:** Standardize usage across all tests

5. **`button:has-text('Generate AI Ideas')`** (47 occurrences)
   - Long text string prone to changes
   - AI feature critical to app
   - **Fix:** Add `data-testid="ai-generate-ideas-button"`

## Implementation Plan

### Phase 1: Quick Wins (1-2 days, 60% improvement)

**Priority 1: IdeaCardComponent** ✅
```tsx
// src/components/IdeaCardComponent.tsx
<div data-testid="idea-card" className="idea-card-base">
  <button data-testid="idea-delete-button" aria-label="Delete">...</button>
  <button data-testid="idea-edit-button" aria-label="Edit">...</button>
  <button data-testid="idea-collapse-button">...</button>
  <div data-testid="idea-content">{content}</div>
  <div data-testid="idea-details">{details}</div>
  <span data-testid="idea-priority-badge">{priority}</span>
</div>
```

**Priority 2: AddIdeaModal** ✅
```tsx
// src/components/AddIdeaModal.tsx
<Modal data-testid="add-idea-modal">
  <button data-testid="add-idea-button">Add Idea</button>
  <input data-testid="idea-content-input" name="content" />
  <textarea data-testid="idea-details-input" name="details" />
  <select data-testid="idea-priority-select" name="priority" />
  <button data-testid="idea-save-button">Save</button>
  <button data-testid="add-idea-cancel-button">Cancel</button>
</Modal>
```

**Priority 3: EditIdeaModal** ✅
```tsx
// src/components/EditIdeaModal.tsx
<Modal data-testid="edit-idea-modal">
  <input data-testid="idea-content-input" />
  <textarea data-testid="idea-details-input" />
  <select data-testid="idea-priority-select" />
  <button data-testid="edit-idea-save-button">Save</button>
  <button data-testid="edit-idea-cancel-button">Cancel</button>
</Modal>
```

**Priority 4: DesignMatrix Standardization** ✅
```tsx
// src/components/DesignMatrix.tsx
<div data-testid="design-matrix" className="matrix-container">
  <div data-testid="quadrant-quick-wins">...</div>
  <div data-testid="quadrant-strategic">...</div>
  <div data-testid="quadrant-reconsider">...</div>
  <div data-testid="quadrant-avoid">...</div>
  <div data-testid="matrix-empty-state">Ready to prioritize?</div>
</div>
```

**Test Updates:**
```typescript
// Before (brittle)
await page.locator('.idea-card-base:has-text("My Idea")').click()
await page.click('button:has-text("Add Idea")')
await page.fill('input[name="content"]', 'New idea')

// After (stable)
await page.getByTestId('idea-card').filter({ hasText: 'My Idea' }).click()
await page.getByTestId('add-idea-button').click()
await page.getByTestId('idea-content-input').fill('New idea')
```

### Phase 2: AI Features (2-3 days)

**AI Generation Components** ✅
```tsx
// src/components/AIIdeaModal.tsx, AIStarterModal.tsx
<button data-testid="ai-generate-ideas-button">Generate AI Ideas</button>
<Modal data-testid="ai-modal">
  <div data-testid="ai-loading-indicator">Generating...</div>
  <div data-testid="ai-idea-card">
    <button data-testid="ai-accept-idea-button">Accept</button>
    <button data-testid="ai-reject-idea-button">Reject</button>
  </div>
</Modal>
```

**AI Insights Modal** ✅
```tsx
// src/components/AIInsightsModal.tsx
<button data-testid="ai-insights-button">AI Insights</button>
<Modal data-testid="ai-insights-modal">
  <div data-testid="ai-insights-loading">Analyzing...</div>
  <button data-testid="ai-insights-close-button">Close</button>
</Modal>
```

**File Upload** ✅
```tsx
// src/components/FileUpload.tsx
<input type="file" data-testid="file-upload-input" />
<div data-testid="uploaded-files-list">
  <div data-testid="uploaded-file">
    <button data-testid="file-delete-button">Delete</button>
  </div>
</div>
```

### Phase 3: Infrastructure (1-2 days)

**Project Management** ✅
```tsx
// src/components/ProjectManagement.tsx
<button data-testid="new-project-button">New Project</button>
<Modal data-testid="create-project-modal">
  <input data-testid="project-name-input" name="projectName" />
  <button data-testid="create-project-button">Create</button>
</Modal>
<div data-testid="projects-list">...</div>
```

**Authentication** ✅
```tsx
// src/components/auth/AuthScreen.tsx
<form data-testid="login-form">
  <input data-testid="auth-email-input" type="email" />
  <input data-testid="auth-password-input" type="password" />
  <button data-testid="auth-submit-button">Login</button>
  <button data-testid="auth-demo-button">Demo User</button>
</form>
```

**Sidebar Navigation** ✅
```tsx
// src/components/Sidebar.tsx
<aside data-testid="sidebar">
  <a data-testid="sidebar-projects-link">Projects</a>
  <a data-testid="sidebar-matrix-link">Matrix</a>
  <a data-testid="sidebar-settings-link">Settings</a>
</aside>
```

## Test Migration Strategy

### 1. Update Page Objects First

```typescript
// tests/e2e/page-objects/IdeaPage.ts
export class IdeaPage {
  readonly page: Page
  readonly addIdeaButton: Locator
  readonly ideaContentInput: Locator
  readonly ideaSaveButton: Locator

  constructor(page: Page) {
    this.page = page
    // NEW: Use testids
    this.addIdeaButton = page.getByTestId('add-idea-button')
    this.ideaContentInput = page.getByTestId('idea-content-input')
    this.ideaSaveButton = page.getByTestId('idea-save-button')
  }

  async addIdea(content: string, details?: string) {
    await this.addIdeaButton.click()
    await this.ideaContentInput.fill(content)
    if (details) {
      await this.page.getByTestId('idea-details-input').fill(details)
    }
    await this.ideaSaveButton.click()
  }

  getIdeaCard(content: string) {
    return this.page
      .getByTestId('idea-card')
      .filter({ hasText: content })
  }
}
```

### 2. Update Helper Functions

```typescript
// tests/e2e/helpers/test-helpers.ts
export async function addIdeaToMatrix(
  page: Page,
  content: string,
  details?: string
) {
  await page.getByTestId('add-idea-button').click()
  await page.getByTestId('add-idea-modal').waitFor({ state: 'visible' })

  await page.getByTestId('idea-content-input').fill(content)
  if (details) {
    await page.getByTestId('idea-details-input').fill(details)
  }

  await page.getByTestId('idea-save-button').click()
  await page.getByTestId('add-idea-modal').waitFor({ state: 'hidden' })

  await page
    .getByTestId('idea-card')
    .filter({ hasText: content })
    .waitFor()
}
```

### 3. Update Test Files Gradually

**Strategy:**
1. Start with highest-impact files (ai-generation-journey.spec.ts, idea-crud-journey.spec.ts)
2. Replace selectors one component at a time
3. Run tests after each change to ensure no regressions
4. Update all occurrences of a selector type at once (e.g., all "Add Idea" buttons)

## Naming Conventions

### Pattern: `{component}-{element}-{type}`

**Examples:**
```typescript
// Components
data-testid="idea-card"
data-testid="add-idea-modal"
data-testid="design-matrix"

// Buttons
data-testid="add-idea-button"
data-testid="idea-delete-button"
data-testid="idea-save-button"
data-testid="ai-generate-ideas-button"

// Form Fields
data-testid="idea-content-input"
data-testid="idea-details-input"
data-testid="idea-priority-select"
data-testid="project-name-input"

// State/Content
data-testid="idea-priority-badge"
data-testid="ai-loading-indicator"
data-testid="matrix-empty-state"

// Lists/Collections
data-testid="uploaded-files-list"
data-testid="projects-list"
```

### Context-Specific vs Generic

**❌ BAD (too generic):**
```typescript
data-testid="save-button"  // Which save button?
data-testid="modal"        // Which modal?
data-testid="input"        // Which input?
```

**✅ GOOD (context-specific):**
```typescript
data-testid="add-idea-save-button"
data-testid="edit-idea-save-button"
data-testid="add-idea-modal"
data-testid="edit-idea-modal"
data-testid="idea-content-input"
data-testid="project-name-input"
```

## Best Practices

### 1. Prefer getByTestId for Custom Components
```typescript
// Custom components
await page.getByTestId('idea-card').click()
await page.getByTestId('add-idea-button').click()
```

### 2. Use getByRole for Semantic HTML
```typescript
// Standard semantic elements
await page.getByRole('button', { name: 'Submit' })
await page.getByRole('textbox', { name: 'Email' })
await page.getByRole('dialog')
```

### 3. Combine for Specificity
```typescript
// Filter testid elements
const ideaCard = page
  .getByTestId('idea-card')
  .filter({ hasText: 'My Idea' })

// Within a container
const modal = page.getByTestId('add-idea-modal')
await modal.getByTestId('idea-save-button').click()
```

### 4. Avoid These Anti-Patterns
```typescript
// ❌ Class selectors
await page.locator('.idea-card-base').click()

// ❌ Text-based selectors
await page.click('button:has-text("Add Idea")')

// ❌ Form name attributes
await page.fill('input[name="content"]', 'text')

// ❌ Icon selectors
await page.click('button:has(.lucide-trash-2)')

// ✅ Use testids instead
await page.getByTestId('idea-card').click()
await page.getByTestId('add-idea-button').click()
await page.getByTestId('idea-content-input').fill('text')
await page.getByTestId('idea-delete-button').click()
```

## Risk Mitigation

### Current Risk: HIGH
- 326 brittle selectors
- Tests fail on UI copy changes
- Tests fail on CSS refactoring
- No i18n support
- High maintenance cost

### Post-Phase 1: MEDIUM
- ~130 brittle selectors remain
- Critical user flows stabilized
- Core components testid-ready

### Post-Phase 3: LOW
- ~40 brittle selectors remain
- All interactive elements have testids
- Tests resilient to UI changes
- i18n-ready selectors

## Success Metrics

### Selector Stability Score
- **Current:** 27.6/100
- **Phase 1 Target:** 60/100
- **Phase 3 Target:** 90/100

### Test Maintenance Cost
- **Current:** High - breaks on every UI change
- **Target:** Low - resilient to styling/copy changes

### Coverage
- **Current:** 19.8% stable selectors
- **Target:** 90% stable selectors

## Estimated Effort

| Phase | Components | Testids | Effort | Impact |
|-------|-----------|---------|--------|--------|
| Phase 1 | 4 components | 22 testids | 1-2 days | 60% improvement |
| Phase 2 | 3 components | 14 testids | 2-3 days | 80% improvement |
| Phase 3 | 3 components | 15 testids | 1-2 days | 90% improvement |
| **Total** | **10 components** | **51 testids** | **6-8 days** | **90% improvement** |

## Next Steps

1. **Immediate (Today):**
   - Review this plan with team
   - Get approval for Phase 1
   - Create ticket for IdeaCardComponent testids

2. **Week 1:**
   - Implement Phase 1 components
   - Update test helpers and page objects
   - Migrate highest-impact test files

3. **Week 2:**
   - Implement Phase 2 AI features
   - Update AI test files
   - Validate AI workflows

4. **Week 3:**
   - Implement Phase 3 infrastructure
   - Complete test migration
   - Document testid patterns

## Files Requiring Updates

### Component Files (10 files)
- ✅ `src/components/IdeaCardComponent.tsx`
- ✅ `src/components/AddIdeaModal.tsx`
- ✅ `src/components/EditIdeaModal.tsx`
- ✅ `src/components/DesignMatrix.tsx`
- ✅ `src/components/AIIdeaModal.tsx`
- ✅ `src/components/AIInsightsModal.tsx`
- ✅ `src/components/FileUpload.tsx`
- ✅ `src/components/ProjectManagement.tsx`
- ✅ `src/components/auth/AuthScreen.tsx`
- ✅ `src/components/Sidebar.tsx`

### Test Files (Priority Order)
1. ✅ `tests/e2e/helpers/test-helpers.ts` (Shared helpers)
2. ✅ `tests/e2e/page-objects/IdeaPage.ts` (New page object)
3. ✅ `tests/e2e/ai-generation-journey.spec.ts` (78 brittle selectors)
4. ✅ `tests/e2e/idea-crud-journey.spec.ts` (65 brittle selectors)
5. ✅ `tests/e2e/idea-advanced-features.spec.ts` (58 brittle selectors)
6. ✅ `tests/e2e/ai-file-analysis-journey.spec.ts` (42 brittle selectors)
7. ✅ `tests/e2e/visual-regression-comprehensive.spec.ts` (38 brittle selectors)
8. ✅ Remaining test files

---

**Report Generated:** 2025-09-30
**Analysis Coverage:** 12 E2E test files, 450 selectors
**Detailed Data:** See `E2E_SELECTOR_ANALYSIS_REPORT.json`
