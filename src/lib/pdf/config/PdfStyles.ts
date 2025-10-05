/**
 * PDF Styling Configuration
 * Centralized styles, colors, and layout constants for PDF generation
 *
 * This module provides all styling constants used across PDF exports including:
 * - Brand colors and color palettes
 * - Typography definitions
 * - Layout constants (margins, spacing, dimensions)
 * - Default PDF configurations
 */

/**
 * RGB Color Type
 * Represents an RGB color as a readonly tuple of three numbers
 */
type RGBColor = readonly [number, number, number];

/**
 * Brand Colors
 * Modern, professional color palette for PDF documents (2024 standards)
 */
export const PdfColors = {
  /**
   * Brand primary colors
   */
  brand: {
    primary: '#6610f2',
    primaryRgb: [102, 16, 242] as RGBColor,
    secondary: '#0ea5e9',
    secondaryRgb: [14, 165, 233] as RGBColor,
  },

  /**
   * Modern professional palette
   */
  modern: {
    indigo: '#4f46e5',
    indigoRgb: [79, 70, 229] as RGBColor,
    skyBlue: '#0ea5e9',
    skyBlueRgb: [14, 165, 233] as RGBColor,
    emerald: '#22c55e',
    emeraldRgb: [34, 197, 94] as RGBColor,
    amber: '#f59e0b',
    amberRgb: [251, 146, 60] as RGBColor,
    red: '#ef4444',
    redRgb: [239, 68, 68] as RGBColor,
  },

  /**
   * Status and semantic colors
   */
  status: {
    success: '#22c55e',
    successRgb: [34, 197, 94] as RGBColor,
    warning: '#fb923c',
    warningRgb: [251, 146, 60] as RGBColor,
    danger: '#ef4444',
    dangerRgb: [239, 68, 68] as RGBColor,
    info: '#0ea5e9',
    infoRgb: [14, 165, 233] as RGBColor,
  },

  /**
   * Section header colors
   */
  headers: {
    main: [102, 16, 242] as RGBColor,
    section: [220, 53, 69] as RGBColor,
    epic: [13, 110, 253] as RGBColor,
    userStory: [25, 135, 84] as RGBColor,
    deliverable: [255, 193, 7] as RGBColor,
    risk: [220, 53, 69] as RGBColor,
  },

  /**
   * Grayscale palette
   */
  gray: {
    gray900: '#111827',
    gray900Rgb: [17, 24, 39] as RGBColor,
    gray700: '#374151',
    gray700Rgb: [55, 65, 81] as RGBColor,
    gray600: '#4b5563',
    gray600Rgb: [75, 85, 99] as RGBColor,
    gray100: '#f3f4f6',
    gray100Rgb: [243, 244, 246] as RGBColor,
    medium: '#6b7280',
    mediumRgb: [107, 114, 128] as RGBColor,
    border: [200, 200, 200] as RGBColor,
    grid: [200, 200, 200] as RGBColor,
  },

  /**
   * Base colors
   */
  base: {
    white: '#ffffff',
    whiteRgb: [255, 255, 255] as RGBColor,
    black: '#000000',
    blackRgb: [0, 0, 0] as RGBColor,
    darkGray: [64, 64, 64] as RGBColor,
    mediumGray: [128, 128, 128] as RGBColor,
  },

  /**
   * Background colors
   */
  backgrounds: {
    light: '#f9fafb',
    lightRgb: [248, 249, 250] as RGBColor,
    lighter: [240, 240, 240] as RGBColor,
    alternate: [248, 249, 250] as RGBColor,
  },

  /**
   * Team colors for timeline/roadmap visualization
   */
  teams: {
    web: [255, 165, 0] as RGBColor,      // Orange
    mobile: [59, 130, 246] as RGBColor,  // Blue
    marketing: [147, 51, 234] as RGBColor, // Purple
    platform: [34, 197, 94] as RGBColor,  // Green
  },

  /**
   * Priority colors for features
   */
  priority: {
    high: [239, 68, 68] as RGBColor,     // Red
    medium: [245, 158, 11] as RGBColor,  // Yellow/Orange
    low: [59, 130, 246] as RGBColor,     // Blue
    default: [200, 200, 200] as RGBColor, // Gray
  },
} as const;

/**
 * Typography Configuration
 * Font families, sizes, weights, and line heights
 */
export const PdfTypography = {
  /**
   * Font families
   */
  fonts: {
    primary: 'helvetica',
    fallback: 'sans-serif',
  },

  /**
   * Font sizes (in points)
   */
  sizes: {
    // Document title and major headings
    h1: 22,
    h1Large: 24,

    // Main section headers
    h2: 18,
    h2Medium: 16,
    h2Small: 14,

    // Subsection headers
    h3: 14,
    h3Small: 12,

    // Body text
    body: 12,
    bodyMedium: 11,
    bodySmall: 10,
    bodyTiny: 9,
    bodyMicro: 8,

    // Small text and captions
    small: 9,
    caption: 8,
    micro: 7,
  },

  /**
   * Font weights/styles
   */
  weights: {
    normal: 'normal' as const,
    bold: 'bold' as const,
    italic: 'italic' as const,
  },

  /**
   * Line height multipliers
   */
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },

  /**
   * Typography hierarchy for pdfMake
   */
  hierarchy: {
    h1: { fontSize: 24, bold: true },
    h2: { fontSize: 18, bold: true },
    h3: { fontSize: 14, bold: true },
    body: { fontSize: 11 },
    small: { fontSize: 9 },
    caption: { fontSize: 8, italics: true },
  },
} as const;

/**
 * Layout Configuration
 * Margins, spacing, dimensions, and page settings
 */
export const PdfLayout = {
  /**
   * Page margins (in points for landscape, mm for portrait)
   */
  margins: {
    landscape: {
      left: 40,
      right: 40,
      top: 50,
      bottom: 60,
    },
    portrait: {
      left: 20,
      right: 20,
      top: 25,
      bottom: 40,
    },
    portraitMm: {
      left: 50,
      right: 50,
      top: 60,
      bottom: 80,
    },
  },

  /**
   * Spacing values (in points or mm depending on document)
   */
  spacing: {
    // Vertical spacing
    section: 20,
    subsection: 15,
    paragraph: 10,
    line: 8,
    small: 5,
    tiny: 3,

    // Component spacing
    headerPadding: 15,
    cardPadding: 20,
    tablePadding: 10,

    // Page break thresholds
    pageBreakThreshold: 60,
    minSpace: 30,
  },

  /**
   * Component dimensions
   */
  dimensions: {
    // Header heights
    mainHeaderHeight: 25,
    sectionHeaderHeight: 20,
    gradientHeaderHeight: 18,

    // Card and panel dimensions
    cardHeight: 20,
    panelHeight: 50,
    titleBarHeight: 10,

    // Table dimensions
    tableRowHeight: 25,

    // Timeline dimensions
    teamHeight: 50,
    featureHeight: 16,
    monthHeaderOffset: 10,

    // Borders and strokes
    borderWidth: 0.5,
    thickBorderWidth: 1,
    dividerWidth: 2,
    accentStripeWidth: 2,

    // Badge dimensions
    badgeRadius: 4,
  },

  /**
   * Column widths for common table layouts
   */
  tableWidths: {
    // Two column layouts
    twoColumn: {
      label: 120,
      content: 460,
    },

    // Three column layouts
    threeColumn: {
      narrow: [80, 380, 120],
      equal: [180, 100, 300],
    },

    // Four column layouts
    fourColumn: {
      equal: [120, 120, 120, 120],
      mixed: [140, 120, 320],
      timeline: [120, 80, 200, 180],
    },

    // Milestone/phase tables
    milestone: [160, 120, 300],
    phase: [120, 360, 100],
  },
} as const;

/**
 * PDF Default Configurations
 * Page sizes, orientations, and default settings
 */
export const PdfDefaults = {
  /**
   * Page configurations
   */
  page: {
    size: 'a4' as const,
    orientationLandscape: 'landscape' as const,
    orientationPortrait: 'portrait' as const,
  },

  /**
   * Units of measurement
   */
  units: {
    points: 'pt' as const,
    millimeters: 'mm' as const,
  },

  /**
   * Timeline configuration
   */
  timeline: {
    defaultMonths: 6,
    maxMonths: 12,
    bufferMonths: 2,
  },

  /**
   * Table layout settings
   */
  table: {
    maxLinesPerCell: 2,
    maxContentLines: 4,
    alternateRowColor: true,
  },

  /**
   * Text truncation settings
   */
  truncation: {
    titleMaxLength: 25,
    titleTruncated: 22,
    projectNameMaxLength: 30,
    descriptionMaxLength: 50,
  },

  /**
   * Footer configuration
   */
  footer: {
    marginBottom: 15,
    marginBottomAlt: 10,
    confidentialOffset: 80,
  },

  /**
   * File naming
   */
  fileNaming: {
    dateFormat: 'YYYY-MM-DD',
    separator: '_',
  },
} as const;

/**
 * Export all configurations as a single object for convenience
 */
export const PdfConfig = {
  colors: PdfColors,
  typography: PdfTypography,
  layout: PdfLayout,
  defaults: PdfDefaults,
} as const;

/**
 * Type exports for TypeScript consumers
 */
export type { RGBColor };
