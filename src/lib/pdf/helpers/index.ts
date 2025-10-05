/**
 * PDF Helpers Module
 * Exports reusable helper functions for PDF generation
 *
 * @module pdf/helpers
 */

// Re-export all helper functions
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
} from './JsPdfHelpers'

// Re-export types
export type {
  PageBreakConfig,
  TextOptions,
  HeaderOptions,
  TableConfig,
  GradientHeaderConfig,
  InsightCardConfig,
  ExecutivePanelConfig
} from './JsPdfHelpers'
