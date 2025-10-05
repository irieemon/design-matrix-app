/**
 * Centralized E2E Test Selectors
 *
 * All selectors use data-testid attributes for reliable, maintainable testing.
 * Organized by feature domain for easy navigation and discoverability.
 *
 * @example
 * ```typescript
 * import { SELECTORS } from './constants/selectors';
 *
 * await page.locator(SELECTORS.AUTH.EMAIL_INPUT).fill('test@example.com');
 * await page.locator(SELECTORS.BUTTONS.SUBMIT).click();
 * ```
 */

/**
 * Authentication & User Management Selectors
 */
export const AUTH = {
  /** Authentication screen container */
  SCREEN: '[data-testid="auth-screen"]',

  /** Input Fields */
  EMAIL_INPUT: '[data-testid="auth-email-input"]',
  PASSWORD_INPUT: '[data-testid="auth-password-input"]',
  CONFIRM_PASSWORD_INPUT: '[data-testid="auth-confirm-password-input"]',
  FULLNAME_INPUT: '[data-testid="auth-fullname-input"]',

  /** Action Buttons */
  SUBMIT_BUTTON: '[data-testid="auth-submit-button"]',
  DEMO_BUTTON: '[data-testid="auth-demo-button"]',
  MODE_SWITCHER: '[data-testid="auth-mode-switcher"]',
  SUCCESS_BUTTON: '[data-testid="auth-success-button"]',

  /** Messages */
  ERROR_MESSAGE: '[data-testid="auth-error-message"]',
  SUCCESS_MESSAGE: '[data-testid="auth-success-message"]',
} as const;

/**
 * Modal Dialog Selectors
 */
export const MODALS = {
  /** Idea Management Modals */
  ADD_IDEA: '[data-testid="add-idea-modal"]',
  EDIT_IDEA: '[data-testid="edit-idea-modal"]',

  /** AI & Insights Modals */
  AI_INSIGHTS: '[data-testid="ai-insights-modal"]',
  AI_STARTER: '[data-testid="ai-starter-modal"]',

  /** Export & Feature Modals */
  EXPORT: '[data-testid="export-modal"]',
  FEATURE: '[data-testid="feature-modal"]',
  DELETE_CONFIRM: '[data-testid="delete-confirm-modal"]',

  /** Generic Modal Actions */
  CLOSE: '[data-testid="modal-close"]',
  CONTENT: '[data-testid="modal-content"]',

  /** Legacy Modal References (for backward compatibility) */
  ADD_MODAL: '[data-testid="add-modal"]',
  ADD_MODAL_CLOSE: '[data-testid="add-modal-close"]',
  ADD_MODAL_SUBMIT: '[data-testid="add-modal-submit"]',
  EDIT_MODAL: '[data-testid="edit-modal"]',
  EDIT_MODAL_CLOSE: '[data-testid="edit-modal-close"]',
  EDIT_MODAL_UPDATE: '[data-testid="edit-modal-update"]',
  EDIT_MODAL_DELETE: '[data-testid="edit-modal-delete"]',
  AI_MODAL: '[data-testid="ai-modal"]',
  AI_MODAL_CLOSE: '[data-testid="ai-modal-close"]',
  AI_MODAL_SUBMIT: '[data-testid="ai-modal-submit"]',
} as const;

/**
 * Design Matrix Selectors
 */
export const MATRIX = {
  /** Matrix Container */
  CONTAINER: '[data-testid="design-matrix"]',

  /** Quadrants */
  QUADRANT_QUICK_WINS: '[data-testid="quadrant-quick-wins"]',
  QUADRANT_STRATEGIC: '[data-testid="quadrant-strategic"]',
  QUADRANT_RECONSIDER: '[data-testid="quadrant-reconsider"]',
  QUADRANT_AVOID: '[data-testid="quadrant-avoid"]',

  /** Actions */
  ADD_IDEA_BUTTON: '[data-testid="add-idea-button"]',
} as const;

/**
 * Navigation & Sidebar Selectors
 */
export const NAVIGATION = {
  /** Sidebar */
  SIDEBAR: '[data-testid="sidebar"]',
  SIDEBAR_TOGGLE: '[data-testid="sidebar-toggle"]',
  SIDEBAR_NAV: '[data-testid="sidebar-nav"]',
  SIDEBAR_LOGOUT: '[data-testid="sidebar-logout"]',
  SIDEBAR_ADMIN: '[data-testid="sidebar-admin"]',

  /** Page Navigation */
  MATRIX_NAV_PROJECTS: '[data-testid="matrix-nav-projects"]',
  MATRIX_ADD_MODAL: '[data-testid="matrix-add-modal"]',
  MATRIX_AI_MODAL: '[data-testid="matrix-ai-modal"]',
  PROJECTS_NAV_MATRIX: '[data-testid="projects-nav-matrix"]',
  COLLAB_BACK: '[data-testid="collab-back"]',
} as const;

/**
 * Page Selectors
 */
export const PAGES = {
  /** Main Pages */
  MATRIX: '[data-testid="matrix-page"]',
  PROJECTS: '[data-testid="projects-page"]',
  DATA: '[data-testid="data-page"]',
  REPORTS: '[data-testid="reports-page"]',
  ROADMAP: '[data-testid="roadmap-page"]',
  COLLABORATION: '[data-testid="collaboration-page"]',
  USER: '[data-testid="user-page"]',
  FILES: '[data-testid="files-page"]',

  /** Test Pages */
  BUTTON_TEST: '[data-testid="button-test-page"]',
  FORM_TEST: '[data-testid="form-test-page"]',
  SKELETON_TEST: '[data-testid="skeleton-test-page"]',

  /** Page Content */
  PAGE_CONTENT: '[data-testid="page-content"]',
  APP_CONTENT: '[data-testid="app-content"]',
} as const;

/**
 * Project Management Selectors
 */
export const PROJECTS = {
  /** Project Actions */
  CREATE_BUTTON: '[data-testid="create-project-button"]',
  LIST: '[data-testid="project-list"]',
  STARTUP_FLOW: '[data-testid="project-startup-flow"]',

  /** Project Navigation */
  SELECT: '[data-testid="projects-select"]',
  CREATE: '[data-testid="projects-create"]',
} as const;

/**
 * Form Input Selectors
 */
export const FORMS = {
  /** Idea Form Inputs */
  IDEA_CONTENT_INPUT: '[data-testid="idea-content-input"]',
  IDEA_CANCEL_BUTTON: '[data-testid="idea-cancel-button"]',
  IDEA_SAVE_BUTTON: '[data-testid="idea-save-button"]',
  IDEA_DELETE_BUTTON: '[data-testid="idea-delete-button"]',

  /** Test Form Inputs */
  NAME_INPUT: '[data-testid="form-name-input"]',
  EMAIL_INPUT: '[data-testid="form-email-input"]',
  MESSAGE_TEXTAREA: '[data-testid="form-message-textarea"]',
  PRIORITY_SELECT: '[data-testid="form-priority-select"]',
  CATEGORY_SELECT: '[data-testid="form-category-select"]',
  LOCATION_INPUT: '[data-testid="form-location-input"]',
  SUBMIT_BUTTON: '[data-testid="form-submit-button"]',

  /** Generic Form Elements */
  FORM_INPUT: '[data-testid="form-input"]',
  TEST_FORM: '[data-testid="test-form"]',
} as const;

/**
 * Button Selectors
 */
export const BUTTONS = {
  /** Interactive Test Buttons */
  INTERACTIVE_SUCCESS: '[data-testid="button-interactive-success"]',
  INTERACTIVE_ERROR: '[data-testid="button-interactive-error"]',
  IMPERATIVE_API: '[data-testid="button-imperative-api"]',

  /** Accessibility Test Buttons */
  KEYBOARD_FOCUS: '[data-testid="button-keyboard-focus"]',
  SCREEN_READER: '[data-testid="button-screen-reader"]',
  LOADING_ACCESSIBILITY: '[data-testid="button-loading-accessibility"]',

  /** Generic Buttons */
  CUSTOM: '[data-testid="custom-button"]',

  /** Delete Confirmation */
  CONFIRM_DELETE: '[data-testid="confirm-delete"]',
  CANCEL_DELETE: '[data-testid="cancel-delete"]',
} as const;

/**
 * User Interface Elements
 */
export const UI = {
  /** Logo */
  LOGO: '[data-testid="prioritas-logo"]',

  /** Loading States */
  LOADING_SPINNER: '[data-testid="loading-spinner"]',

  /** Icons */
  ICONS: {
    HOME: '[data-testid="icon-home"]',
    USER: '[data-testid="icon-user"]',
    DATABASE: '[data-testid="icon-database"]',
    BARCHART: '[data-testid="icon-barchart"]',
    FOLDER: '[data-testid="icon-folder"]',
    LOGOUT: '[data-testid="icon-logout"]',
    CHEVRON_LEFT: '[data-testid="icon-chevron-left"]',
    CHEVRON_RIGHT: '[data-testid="icon-chevron-right"]',
    CHEVRON_DOWN: '[data-testid="icon-chevron-down"]',
    MAP: '[data-testid="icon-map"]',
    USERS: '[data-testid="icon-users"]',
    SHIELD: '[data-testid="icon-shield"]',
    EDIT: '[data-testid="icon-edit"]',
    TRASH2: '[data-testid="icon-trash2"]',
    PLUS: '[data-testid="icon-plus"]',
    SAVE: '[data-testid="icon-save"]',
    X: '[data-testid="icon-x"]',
    CALENDAR: '[data-testid="icon-calendar"]',
    CLOCK: '[data-testid="icon-clock"]',
    FLAG: '[data-testid="icon-flag"]',
    TARGET: '[data-testid="icon-target"]',
    ZAP: '[data-testid="icon-zap"]',
    CHECK_CIRCLE: '[data-testid="icon-check-circle"]',
    ALERT_TRIANGLE: '[data-testid="icon-alert-triangle"]',
  },

  /** Chevrons */
  CHEVRON_UP: '[data-testid="chevron-up"]',
  CHEVRON_DOWN: '[data-testid="chevron-down"]',

  /** Check Icon */
  CHECK_ICON: '[data-testid="check-icon"]',
} as const;

/**
 * Skeleton Loading Selectors
 */
export const SKELETONS = {
  /** Controllable Skeletons */
  TEXT: '[data-testid="controllable-skeleton-text"]',
  CARD: '[data-testid="controllable-skeleton-card"]',
  MATRIX: '[data-testid="controllable-skeleton-matrix"]',
  TABLE: '[data-testid="controllable-skeleton-table"]',

  /** Static Skeletons */
  SKELETON_TEXT: '[data-testid="skeleton-text"]',
  SKELETON_CARD: '[data-testid="skeleton-card"]',
  SKELETON_MATRIX: '[data-testid="skeleton-matrix"]',
  SKELETON_TABLE: '[data-testid="skeleton-table"]',

  /** Dashboard */
  DASHBOARD: '[data-testid="dashboard-skeleton"]',
} as const;

/**
 * Roadmap & Timeline Selectors
 */
export const ROADMAP = {
  /** Milestones */
  TEAM_RECOMMENDATIONS: '[data-testid="team-recommendations"]',
  MILESTONES_TITLE: '[data-testid="milestones-title"]',
  MILESTONES_LIST: '[data-testid="milestones-list"]',
  NO_MILESTONES: '[data-testid="no-milestones"]',

  /** Epic Details */
  EPIC_DURATION: '[data-testid="epic-duration"]',
  EPIC_START_MONTH: '[data-testid="epic-start-month"]',
  EPIC_TEAM: '[data-testid="epic-team"]',
} as const;

/**
 * Files & Data Management Selectors
 */
export const FILES = {
  /** File Actions */
  UPLOAD: '[data-testid="files-upload"]',
  DELETE: '[data-testid="files-delete"]',

  /** Data Actions */
  DATA_REFRESH: '[data-testid="data-refresh"]',
} as const;

/**
 * User Management Selectors
 */
export const USER = {
  /** User Actions */
  LOGOUT: '[data-testid="user-logout"]',
  UPDATE: '[data-testid="user-update"]',
  DEMO_BUTTON: '[data-testid="demo-user-button"]',
} as const;

/**
 * Admin Portal Selectors
 */
export const ADMIN = {
  /** Admin App */
  APP: '[data-testid="admin-app"]',
} as const;

/**
 * Custom & Test-Specific Selectors
 */
export const CUSTOM = {
  /** Custom Content */
  CONTENT: '[data-testid="custom-content"]',
  DRAWER_CONTENT: '[data-testid="custom-drawer-content"]',
  ERROR: '[data-testid="custom-error"]',
  TEST_ID: '[data-testid="custom-test-id"]',

  /** Portal & Drawer */
  PORTAL_CONTENT: '[data-testid="portal-content"]',
  DRAWER_CONTENT_BASIC: '[data-testid="drawer-content"]',

  /** Nested Levels */
  LEVEL_1: '[data-testid="level-1"]',
  LEVEL_2: '[data-testid="level-2"]',
  LEVEL_3: '[data-testid="level-3"]',

  /** Icons */
  ICON_BEFORE: '[data-testid="icon-before"]',
  ICON_AFTER: '[data-testid="icon-after"]',
  BEFORE_ICON: '[data-testid="before-icon"]',
  AFTER_ICON: '[data-testid="after-icon"]',

  /** Misc */
  NORMAL_CONTENT: '[data-testid="normal-content"]',
  UPDATED_CONTENT: '[data-testid="updated-content"]',
  OUTSIDE: '[data-testid="outside"]',
  SIMPLE_CHILD: '[data-testid="simple-child"]',
  COMPLEX_APP: '[data-testid="complex-app"]',

  /** Children */
  CHILD_1: '[data-testid="child-1"]',
  CHILD_2: '[data-testid="child-2"]',
  CHILD_3: '[data-testid="child-3"]',
} as const;

/**
 * DND (Drag and Drop) Selectors
 */
export const DND = {
  CONTEXT: '[data-testid="dnd-context"]',
} as const;

/**
 * Combined selector object for convenience
 */
export const SELECTORS = {
  AUTH,
  MODALS,
  MATRIX,
  NAVIGATION,
  PAGES,
  PROJECTS,
  FORMS,
  BUTTONS,
  UI,
  SKELETONS,
  ROADMAP,
  FILES,
  USER,
  ADMIN,
  CUSTOM,
  DND,
} as const;

/**
 * Helper Functions for Dynamic Selectors
 */
export const selectorHelpers = {
  /**
   * Get selector for a specific idea card by ID
   * @param id - The idea card ID
   * @returns Selector string
   * @example selectorHelpers.ideaCard('abc-123')
   */
  ideaCard: (id: string): string => `[data-testid="idea-card-${id}"]`,

  /**
   * Get selector for a specific project card by ID
   * @param id - The project ID
   * @returns Selector string
   * @example selectorHelpers.projectCard('proj-456')
   */
  projectCard: (id: string): string => `[data-testid="project-card-${id}"]`,

  /**
   * Get selector for edit button by ID
   * @param id - The item ID
   * @returns Selector string
   * @example selectorHelpers.editButton('idea-789')
   */
  editButton: (id: string): string => `[data-testid="edit-${id}"]`,

  /**
   * Get selector for delete button by ID
   * @param id - The item ID
   * @returns Selector string
   * @example selectorHelpers.deleteButton('idea-789')
   */
  deleteButton: (id: string): string => `[data-testid="delete-${id}"]`,

  /**
   * Get selector for toggle button by ID
   * @param id - The item ID
   * @returns Selector string
   * @example selectorHelpers.toggleButton('idea-789')
   */
  toggleButton: (id: string): string => `[data-testid="toggle-${id}"]`,

  /**
   * Get selector for milestone by index
   * @param index - The milestone index
   * @returns Selector string
   * @example selectorHelpers.milestone(0)
   */
  milestone: (index: number): string => `[data-testid="milestone-${index}"]`,

  /**
   * Get selector for milestone number by index
   * @param index - The milestone index
   * @returns Selector string
   * @example selectorHelpers.milestoneNumber(0)
   */
  milestoneNumber: (index: number): string => `[data-testid="milestone-number-${index}"]`,

  /**
   * Get selector for milestone title by index
   * @param index - The milestone index
   * @returns Selector string
   * @example selectorHelpers.milestoneTitle(0)
   */
  milestoneTitle: (index: number): string => `[data-testid="milestone-title-${index}"]`,

  /**
   * Get selector for milestone timeline by index
   * @param index - The milestone index
   * @returns Selector string
   * @example selectorHelpers.milestoneTimeline(0)
   */
  milestoneTimeline: (index: number): string => `[data-testid="milestone-timeline-${index}"]`,

  /**
   * Get selector for milestone description by index
   * @param index - The milestone index
   * @returns Selector string
   * @example selectorHelpers.milestoneDescription(0)
   */
  milestoneDescription: (index: number): string => `[data-testid="milestone-description-${index}"]`,

  /**
   * Get selector for button variant test
   * @param variant - The button variant
   * @returns Selector string
   * @example selectorHelpers.buttonVariant('primary')
   */
  buttonVariant: (variant: string): string => `[data-testid="button-variant-${variant}"]`,

  /**
   * Get selector for button state test
   * @param state - The button state
   * @returns Selector string
   * @example selectorHelpers.buttonState('loading')
   */
  buttonState: (state: string): string => `[data-testid="button-state-${state}"]`,

  /**
   * Get selector for button size test
   * @param size - The button size
   * @returns Selector string
   * @example selectorHelpers.buttonSize('large')
   */
  buttonSize: (size: string): string => `[data-testid="button-size-${size}"]`,

  /**
   * Get selector by text content (Playwright-specific)
   * @param text - The text to search for
   * @returns Selector string
   * @example selectorHelpers.byText('Submit')
   */
  byText: (text: string): string => `text="${text}"`,

  /**
   * Get selector for button with specific text (Playwright-specific)
   * @param text - The button text
   * @returns Selector string
   * @example selectorHelpers.buttonWithText('Save Changes')
   */
  buttonWithText: (text: string): string => `button:has-text("${text}")`,

  /**
   * Get selector for element with role and name
   * @param role - ARIA role
   * @param name - Accessible name
   * @returns Selector string
   * @example selectorHelpers.byRole('button', 'Submit')
   */
  byRole: (role: string, name?: string): string =>
    name ? `[role="${role}"][aria-label="${name}"]` : `[role="${role}"]`,

  /**
   * Get selector for icon by test ID
   * @param iconName - Icon identifier
   * @returns Selector string
   * @example selectorHelpers.icon('home')
   */
  icon: (iconName: string): string => `[data-testid="icon-${iconName}"]`,

  /**
   * Get selector for numbered test elements
   * @param prefix - Element prefix
   * @param index - Element index
   * @returns Selector string
   * @example selectorHelpers.numbered('card', 1)
   */
  numbered: (prefix: string, index: number): string => `[data-testid="${prefix}${index}"]`,
} as const;

/**
 * Type-safe selector keys for autocomplete support
 */
export type SelectorCategory = keyof typeof SELECTORS;
export type AuthSelector = keyof typeof AUTH;
export type ModalSelector = keyof typeof MODALS;
export type MatrixSelector = keyof typeof MATRIX;
export type NavigationSelector = keyof typeof NAVIGATION;
export type PageSelector = keyof typeof PAGES;
export type ProjectSelector = keyof typeof PROJECTS;
export type FormSelector = keyof typeof FORMS;
export type ButtonSelector = keyof typeof BUTTONS;
export type UISelector = keyof typeof UI;
export type SkeletonSelector = keyof typeof SKELETONS;
export type RoadmapSelector = keyof typeof ROADMAP;
export type FileSelector = keyof typeof FILES;
export type UserSelector = keyof typeof USER;
export type AdminSelector = keyof typeof ADMIN;
export type CustomSelector = keyof typeof CUSTOM;
export type DNDSelector = keyof typeof DND;

/**
 * Usage Examples:
 *
 * @example Basic Usage
 * ```typescript
 * import { SELECTORS } from './constants/selectors';
 *
 * // Navigate and authenticate
 * await page.goto('/');
 * await page.locator(SELECTORS.AUTH.EMAIL_INPUT).fill('test@example.com');
 * await page.locator(SELECTORS.AUTH.PASSWORD_INPUT).fill('password123');
 * await page.locator(SELECTORS.AUTH.SUBMIT_BUTTON).click();
 * ```
 *
 * @example Dynamic Selectors
 * ```typescript
 * import { selectorHelpers } from './constants/selectors';
 *
 * // Work with specific idea cards
 * const ideaId = 'abc-123';
 * await page.locator(selectorHelpers.ideaCard(ideaId)).click();
 * await page.locator(selectorHelpers.editButton(ideaId)).click();
 * ```
 *
 * @example Organized Workflow
 * ```typescript
 * import { SELECTORS, selectorHelpers } from './constants/selectors';
 *
 * // Create a new project
 * await page.locator(SELECTORS.NAVIGATION.SIDEBAR).isVisible();
 * await page.locator(SELECTORS.PROJECTS.CREATE_BUTTON).click();
 * await page.locator(SELECTORS.FORMS.NAME_INPUT).fill('New Project');
 * await page.locator(SELECTORS.BUTTONS.CUSTOM).click();
 *
 * // Verify project card appears
 * const projectId = 'new-project-id';
 * await expect(page.locator(selectorHelpers.projectCard(projectId))).toBeVisible();
 * ```
 */

export default SELECTORS;
