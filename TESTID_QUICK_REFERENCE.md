# Test ID Quick Reference

## 🎯 Current Status

- **Total Selectors:** 450
- **Stable (data-testid):** 89 (19.8%)
- **Brittle:** 326 (72.4%)
- **Improvement Target:** 90% stable

## 🚨 Top Priority Replacements

### IdeaCardComponent
```tsx
// ❌ REPLACE
.idea-card-base
button:has(.lucide-trash-2)
button.edit
.idea-card-badge

// ✅ WITH
data-testid="idea-card"
data-testid="idea-delete-button"
data-testid="idea-edit-button"
data-testid="idea-priority-badge"
```

### Modal Buttons
```tsx
// ❌ REPLACE
button:has-text("Add Idea")
button:has-text("Save")
button:has-text("Cancel")

// ✅ WITH
data-testid="add-idea-button"
data-testid="idea-save-button"
data-testid="add-idea-cancel-button"
```

### Form Inputs
```tsx
// ❌ REPLACE
input[name="content"]
textarea[name="details"]
select[name="priority"]

// ✅ WITH
data-testid="idea-content-input"
data-testid="idea-details-input"
data-testid="idea-priority-select"
```

## 📋 Complete TestID Reference

### IdeaCardComponent
| Element | TestID | Current Selector |
|---------|--------|------------------|
| Card container | `idea-card` | `.idea-card-base` |
| Delete button | `idea-delete-button` | `button:has(.lucide-trash-2)` |
| Edit button | `idea-edit-button` | `button.edit` |
| Collapse button | `idea-collapse-button` | `button:has(.lucide-chevron-up)` |
| Expand button | `idea-expand-button` | `button:has(.lucide-chevron-down)` |
| Content text | `idea-content` | Direct text |
| Details text | `idea-details` | Direct text |
| Priority badge | `idea-priority-badge` | `.idea-card-badge` |

### AddIdeaModal
| Element | TestID | Current Selector |
|---------|--------|------------------|
| Modal container | `add-idea-modal` | ✅ EXISTS |
| Trigger button | `add-idea-button` | `button:has-text("Add Idea")` |
| Content input | `idea-content-input` | `input[name="content"]` |
| Details textarea | `idea-details-input` | `textarea[name="details"]` |
| Priority select | `idea-priority-select` | `select[name="priority"]` |
| Save button | `idea-save-button` | `button:has-text("Save")` or `button:has-text("Add")` |
| Cancel button | `add-idea-cancel-button` | `button:has-text("Cancel")` |

### EditIdeaModal
| Element | TestID | Current Selector |
|---------|--------|------------------|
| Modal container | `edit-idea-modal` | ✅ EXISTS |
| Content input | `idea-content-input` | `input[name="content"]` |
| Details textarea | `idea-details-input` | `textarea[name="details"]` |
| Priority select | `idea-priority-select` | `select[name="priority"]` |
| Save button | `edit-idea-save-button` | `button:has-text("Save")` |
| Cancel button | `edit-idea-cancel-button` | `button:has-text("Cancel")` |

### DesignMatrix
| Element | TestID | Current Selector |
|---------|--------|------------------|
| Matrix container | `design-matrix` | `.matrix-container` |
| Quick Wins quadrant | `quadrant-quick-wins` | N/A |
| Strategic quadrant | `quadrant-strategic` | N/A |
| Reconsider quadrant | `quadrant-reconsider` | N/A |
| Avoid quadrant | `quadrant-avoid` | N/A |
| Empty state | `matrix-empty-state` | `text=Ready to prioritize?` |

### AI Features
| Element | TestID | Current Selector |
|---------|--------|------------------|
| Generate button | `ai-generate-ideas-button` | `button:has-text("Generate AI Ideas")` |
| AI modal | `ai-modal` | `[role="dialog"]` |
| AI idea card | `ai-idea-card` | `.idea-card` |
| Accept button | `ai-accept-idea-button` | `button:has-text("Accept")` |
| Reject button | `ai-reject-idea-button` | `button:has-text("Reject")` |
| Loading indicator | `ai-loading-indicator` | `text=/generating/i` |
| Insights button | `ai-insights-button` | `button:has-text("AI Insights")` |
| Insights modal | `ai-insights-modal` | `[role="dialog"]` |

### ProjectManagement
| Element | TestID | Current Selector |
|---------|--------|------------------|
| New Project button | `new-project-button` | `button:has-text("New Project")` |
| Create button | `create-project-button` | `button:has-text("Create")` |
| Project name input | `project-name-input` | `input[name="projectName"]` |
| Create modal | `create-project-modal` | ✅ EXISTS |
| Projects list | `projects-list` | N/A |

### Authentication
| Element | TestID | Current Selector |
|---------|--------|------------------|
| Demo button | `auth-demo-button` | `button:has-text("Demo User")` |
| Login form | `login-form` | `form` |
| Email input | `auth-email-input` | `input[type="email"]` |
| Password input | `auth-password-input` | `input[type="password"]` |
| Submit button | `auth-submit-button` | `button:has-text("Login")` |

### FileUpload
| Element | TestID | Current Selector |
|---------|--------|------------------|
| Upload input | `file-upload-input` | `input[type="file"]` |
| Files list | `uploaded-files-list` | `.file-list` |
| File item | `uploaded-file` | `.file-item` |
| Delete button | `file-delete-button` | `button:has-text("Delete")` |

### Sidebar
| Element | TestID | Current Selector |
|---------|--------|------------------|
| Sidebar container | `sidebar` | `nav, aside` |
| Projects link | `sidebar-projects-link` | `a:has-text("Projects")` |
| Matrix link | `sidebar-matrix-link` | `a:has-text("Matrix")` |
| Settings link | `sidebar-settings-link` | `a:has-text("Settings")` |

## 🔧 Migration Patterns

### Pattern 1: Simple Element
```typescript
// Before
await page.locator('.idea-card-base').click()

// After
await page.getByTestId('idea-card').click()
```

### Pattern 2: With Text Filter
```typescript
// Before
await page.locator('.idea-card-base:has-text("My Idea")').click()

// After
await page
  .getByTestId('idea-card')
  .filter({ hasText: 'My Idea' })
  .click()
```

### Pattern 3: Button with Text
```typescript
// Before
await page.click('button:has-text("Add Idea")')

// After
await page.getByTestId('add-idea-button').click()
```

### Pattern 4: Form Input
```typescript
// Before
await page.fill('input[name="content"]', 'New idea')

// After
await page.getByTestId('idea-content-input').fill('New idea')
```

### Pattern 5: Within Container
```typescript
// Before
const modal = page.locator('[role="dialog"]')
await modal.locator('button:has-text("Save")').click()

// After
const modal = page.getByTestId('add-idea-modal')
await modal.getByTestId('idea-save-button').click()
```

### Pattern 6: Icon Buttons
```typescript
// Before
await page.locator('button:has(.lucide-trash-2)').click()

// After
await page.getByTestId('idea-delete-button').click()
```

## 📝 Naming Convention

### Format: `{component}-{element}-{type}`

**Component Prefix:**
- `idea-*` - Idea-related elements
- `ai-*` - AI feature elements
- `auth-*` - Authentication elements
- `project-*` - Project management elements
- `matrix-*` - Matrix-specific elements
- `sidebar-*` - Sidebar navigation elements

**Element Types:**
- `*-button` - Clickable buttons
- `*-input` - Text/number inputs
- `*-select` - Dropdown selects
- `*-modal` - Modal dialogs
- `*-card` - Card components
- `*-badge` - Badge/label elements
- `*-link` - Navigation links

**Examples:**
```
✅ idea-delete-button
✅ ai-generate-ideas-button
✅ auth-email-input
✅ project-name-input
✅ matrix-empty-state
✅ sidebar-settings-link

❌ delete-button (too generic)
❌ button (way too generic)
❌ input1 (meaningless)
```

## 🚀 Quick Migration Checklist

### For Each Component:

1. **Add testids to component file**
   ```tsx
   <div data-testid="idea-card" className="idea-card-base">
   ```

2. **Update page objects**
   ```typescript
   this.ideaCard = page.getByTestId('idea-card')
   ```

3. **Update helper functions**
   ```typescript
   await page.getByTestId('add-idea-button').click()
   ```

4. **Update test files**
   ```typescript
   // Replace all brittle selectors
   ```

5. **Run tests**
   ```bash
   npm run test:e2e
   ```

## 📊 Progress Tracking

| Component | TestIDs Added | Tests Updated | Status |
|-----------|---------------|---------------|--------|
| IdeaCardComponent | 0/8 | 0/7 | ⏳ Not Started |
| AddIdeaModal | 3/7 | 0/8 | 🟡 Partial |
| EditIdeaModal | 1/6 | 0/5 | 🟡 Partial |
| DesignMatrix | 1/6 | 0/9 | 🟡 Partial |
| AI Features | 2/6 | 0/2 | 🟡 Partial |
| ProjectManagement | 1/5 | 0/6 | 🟡 Partial |
| AuthScreen | 1/6 | 0/4 | 🟡 Partial |
| FileUpload | 2/4 | 0/1 | 🟡 Partial |
| Sidebar | 1/4 | 0/3 | 🟡 Partial |

**Legend:** ✅ Complete | 🟡 Partial | ⏳ Not Started

## 🎯 Success Criteria

- [ ] All interactive elements have data-testid
- [ ] No class-based selectors in tests
- [ ] No text-based button selectors
- [ ] No form name attribute selectors
- [ ] Page objects use only testids/roles
- [ ] Test helpers use only testids/roles
- [ ] 90%+ stable selector coverage
- [ ] All tests passing with new selectors

---

**Quick Links:**
- [Full Analysis Report](E2E_SELECTOR_ANALYSIS_REPORT.json)
- [Implementation Plan](E2E_SELECTOR_IMPROVEMENT_PLAN.md)
