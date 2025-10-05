/**
 * PDF Generation Module
 * Centralized PDF generation with modular architecture
 *
 * This module provides a clean, tree-shakeable API for PDF generation with:
 * - Multiple PDF generators (roadmap, insights, professional)
 * - Dynamic library loading with retry logic
 * - Reusable helper functions and components
 * - Centralized styling and configuration
 * - Full TypeScript support
 *
 * @example
 * ```typescript
 * // Basic usage - generate a roadmap PDF
 * import { exportRoadmapToPDF } from '@/lib/pdf'
 *
 * exportRoadmapToPDF(roadmapData, ideaCount, project)
 * ```
 *
 * @example
 * ```typescript
 * // Advanced usage - custom PDF with helpers
 * import { loadPdfMake, addText, addTable, PdfColors } from '@/lib/pdf'
 *
 * const pdfMake = await loadPdfMake()
 * // Use pdfMake with helper functions...
 * ```
 *
 * @module pdf
 */

// ============================================================================
// GENERATORS - Main PDF generation functions
// ============================================================================

/**
 * Generate comprehensive roadmap PDFs with timeline visualization
 */
export { exportRoadmapToPDF } from './generators/RoadmapPdfGenerator'

// ============================================================================
// LOADERS - PDF library loading utilities
// ============================================================================

/**
 * Load pdfMake library dynamically with retry logic
 * @function loadPdfMake
 * @returns Promise<pdfMake> - Loaded pdfMake library instance
 *
 * @example
 * ```typescript
 * const pdfMake = await loadPdfMake()
 * pdfMake.createPdf(docDefinition).download()
 * ```
 */
export { loadPdfMake } from './loaders/PdfLibraryLoader'

/**
 * Check if pdfMake library is loaded (synchronous)
 * @function isPdfMakeLoaded
 * @returns boolean - True if library is loaded and ready
 */
export { isPdfMakeLoaded } from './loaders/PdfLibraryLoader'

/**
 * Get current library loading state
 * @function getPdfLoadingState
 * @returns LoadingState - Current state (IDLE | LOADING | LOADED | FAILED)
 */
export { getPdfLoadingState } from './loaders/PdfLibraryLoader'

/**
 * Singleton loader instance for advanced usage
 */
export { pdfLibraryLoader } from './loaders/PdfLibraryLoader'

/**
 * Custom error types for PDF loading failures
 */
export { PdfLibraryLoadError, PdfFontsLoadError } from './loaders/PdfLibraryLoader'

/**
 * Loading state enumeration
 */
export { LoadingState } from './loaders/PdfLibraryLoader'

// ============================================================================
// HELPERS - Reusable PDF generation utilities
// ============================================================================

/**
 * Page management utilities
 */
export { addPageBreak } from './helpers/JsPdfHelpers'

/**
 * Text rendering utilities
 */
export { addText } from './helpers/JsPdfHelpers'

/**
 * Header components
 */
export {
  addMainHeader,
  addSectionHeader,
  createGradientHeader
} from './helpers/JsPdfHelpers'

/**
 * Visual elements
 */
export { addSectionDivider } from './helpers/JsPdfHelpers'

/**
 * Table components
 */
export { addTable } from './helpers/JsPdfHelpers'

/**
 * Advanced components (for insights and professional PDFs)
 */
export {
  createInsightCard,
  createExecutivePanel
} from './helpers/JsPdfHelpers'

// ============================================================================
// CONFIGURATION - Styling and layout constants
// ============================================================================

/**
 * Color palettes for PDF documents
 */
export { PdfColors } from './config/PdfStyles'

/**
 * Typography configuration (fonts, sizes, weights)
 */
export { PdfTypography } from './config/PdfStyles'

/**
 * Layout constants (margins, spacing, dimensions)
 */
export { PdfLayout } from './config/PdfStyles'

/**
 * Default PDF configurations
 */
export { PdfDefaults } from './config/PdfStyles'

/**
 * Combined configuration object
 */
export { PdfConfig } from './config/PdfStyles'

// ============================================================================
// TYPE EXPORTS - TypeScript types and interfaces
// ============================================================================

/**
 * Helper function option types
 */
export type {
  PageBreakConfig,
  TextOptions,
  HeaderOptions,
  TableConfig,
  GradientHeaderConfig,
  InsightCardConfig,
  ExecutivePanelConfig
} from './helpers/JsPdfHelpers'

/**
 * Configuration types
 */
export type { RGBColor } from './config/PdfStyles'

// ============================================================================
// SUB-MODULE EXPORTS - For advanced usage
// ============================================================================

/**
 * All generators as namespace
 * @namespace generators
 */
export * as generators from './generators'

/**
 * All loaders as namespace
 * @namespace loaders
 */
export * as loaders from './loaders'

/**
 * All helpers as namespace
 * @namespace helpers
 */
export * as helpers from './helpers'

/**
 * All config as namespace
 * @namespace config
 */
export * as config from './config'
