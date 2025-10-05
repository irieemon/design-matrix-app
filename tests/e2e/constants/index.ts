/**
 * E2E Test Constants - Main Export
 *
 * Centralized exports for all E2E test constants, selectors, and helpers.
 *
 * @example
 * ```typescript
 * // Import everything
 * import { SELECTORS, selectorHelpers } from '@/tests/e2e/constants';
 *
 * // Or import specific categories
 * import { AUTH, MODALS, MATRIX } from '@/tests/e2e/constants';
 * ```
 */

export {
  // Main selector object
  SELECTORS,

  // Individual selector categories
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

  // Helper functions
  selectorHelpers,

  // TypeScript types
  type SelectorCategory,
  type AuthSelector,
  type ModalSelector,
  type MatrixSelector,
  type NavigationSelector,
  type PageSelector,
  type ProjectSelector,
  type FormSelector,
  type ButtonSelector,
  type UISelector,
  type SkeletonSelector,
  type RoadmapSelector,
  type FileSelector,
  type UserSelector,
  type AdminSelector,
  type CustomSelector,
  type DNDSelector,
} from './selectors';

/**
 * Re-export default for convenience
 */
export { default } from './selectors';
