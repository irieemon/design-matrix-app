/**
 * PDF Export Module (Legacy Facade)
 *
 * This file has been refactored into a modular structure under src/lib/pdf/
 * It now serves as a backward-compatibility facade, re-exporting from the new modules.
 *
 * @deprecated Import from '@/lib/pdf' instead for better tree-shaking
 *
 * **New Module Structure:**
 * - Config: src/lib/pdf/config/PdfStyles.ts
 * - Loaders: src/lib/pdf/loaders/PdfLibraryLoader.ts
 * - Helpers: src/lib/pdf/helpers/JsPdfHelpers.ts
 * - Generators:
 *   - src/lib/pdf/generators/RoadmapPdfGenerator.ts
 *   - src/lib/pdf/generators/InsightsPdfGenerator.ts
 *   - src/lib/pdf/generators/ProfessionalInsightsPdfGenerator.ts
 *
 * **Migration Guide:**
 * ```typescript
 * // Old:
 * import { exportRoadmapToPDF } from '../utils/pdfExportSimple'
 *
 * // New (recommended):
 * import { exportRoadmapToPDF } from '@/lib/pdf'
 * ```
 *
 * **Refactoring Details:**
 * - Original file: 1566 lines
 * - New structure: 6 focused modules
 * - Extracted: Configuration (355 lines), Loaders (340 lines), Helpers (850 lines), Generators (3 modules)
 * - Benefits: Better organization, testability, tree-shaking, maintainability
 *
 * @module utils/pdfExportSimple
 * @see {@link module:lib/pdf} For the new modular structure
 */

// Re-export roadmap PDF generation
export { exportRoadmapToPDF } from '../lib/pdf/generators/RoadmapPdfGenerator'

// Re-export insights PDF generation (jsPDF version)
export { exportInsightsToPDF } from '../lib/pdf/generators/InsightsPdfGenerator'

// Re-export professional insights PDF generation (pdfMake version)
export { exportInsightsToPDFProfessional } from '../lib/pdf/generators/ProfessionalInsightsPdfGenerator'

// Re-export graphical insights PDF generation (premium visual version)
export { exportGraphicalInsightsToPDF } from '../lib/pdf/generators/GraphicalInsightsPdfGenerator'

// Re-export PDF library loader utilities (for advanced usage)
export {
  loadPdfMake,
  isPdfMakeLoaded,
  pdfLibraryLoader
} from '../lib/pdf/loaders/PdfLibraryLoader'

// For consumers who need access to configuration
export {
  PdfColors,
  PdfTypography,
  PdfLayout,
  PdfDefaults,
  PdfConfig
} from '../lib/pdf/config/PdfStyles'

// For consumers who need access to helpers (for custom PDF generation)
export {
  addPageBreak,
  addText,
  addMainHeader,
  addSectionHeader,
  addSectionDivider,
  addTable,
  createGradientHeader,
  createInsightCard,
  createExecutivePanel
} from '../lib/pdf/helpers/JsPdfHelpers'

/**
 * @deprecated This file is now a facade. Import from '@/lib/pdf' instead.
 *
 * The PDF generation functionality has been refactored into a modular structure
 * for better maintainability, testability, and tree-shaking.
 *
 * All exports remain available from this file for backward compatibility,
 * but new code should import directly from '@/lib/pdf' or specific submodules.
 */
