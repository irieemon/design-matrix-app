/**
 * jsPDF Helper Utilities
 * Reusable functions for PDF generation with jsPDF library
 *
 * These functions provide a clean, functional API for common PDF operations
 * like text rendering, headers, tables, and page breaks. All functions are
 * pure and accept the jsPDF instance as their first parameter.
 *
 * @module JsPdfHelpers
 */

import jsPDF from 'jspdf'

/**
 * Page break configuration and state
 */
export interface PageBreakConfig {
  pageHeight: number
  bottomMargin: number
  resetYPosition: number
}

/**
 * Text rendering options
 */
export interface TextOptions {
  fontSize?: number
  fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic'
  color?: [number, number, number]
  lineSpacing?: number
  marginLeft?: number
  contentWidth?: number
}

/**
 * Header rendering options
 */
export interface HeaderOptions {
  fontSize?: number
  backgroundColor?: [number, number, number]
  textColor?: [number, number, number]
  marginLeft?: number
  contentWidth?: number
}

/**
 * Table configuration
 */
export interface TableConfig {
  headers: string[]
  rows: string[][]
  cellWidths?: number[]
  marginLeft?: number
  totalWidth?: number
}

/**
 * Gradient header configuration
 */
export interface GradientHeaderConfig {
  title: string
  subtitle?: string
  primaryColor?: [number, number, number]
  whiteColor?: [number, number, number]
  marginLeft?: number
  contentWidth?: number
}

/**
 * Insight card configuration
 */
export interface InsightCardConfig {
  title: string
  content: string
  impact: 'high' | 'medium' | 'low'
  index: number
  marginLeft?: number
  contentWidth?: number
}

/**
 * Executive panel configuration
 */
export interface ExecutivePanelConfig {
  title: string
  content: string
  stats: Array<{
    label: string
    value: string
    color?: [number, number, number]
  }>
  marginLeft?: number
  contentWidth?: number
}

// ============================================================================
// PAGE MANAGEMENT
// ============================================================================

/**
 * Check if a page break is needed and add a new page if necessary
 *
 * @example
 * ```typescript
 * yPos = addPageBreak(doc, yPos, 60, { pageHeight: 842, bottomMargin: 60, resetYPosition: 50 })
 * ```
 *
 * @param doc - jsPDF instance
 * @param yPos - Current Y position on the page
 * @param space - Space needed for the next element
 * @param config - Page break configuration
 * @returns New Y position (reset if page was added, unchanged otherwise)
 */
export function addPageBreak(
  doc: jsPDF,
  yPos: number,
  space: number,
  config: PageBreakConfig
): number {
  if (yPos + space > config.pageHeight - config.bottomMargin) {
    doc.addPage()
    return config.resetYPosition
  }
  return yPos
}

// ============================================================================
// TEXT RENDERING
// ============================================================================

/**
 * Add text with automatic wrapping and styling
 *
 * @example
 * ```typescript
 * const result = addText(doc, 'Long text here...', yPos, {
 *   fontSize: 12,
 *   fontStyle: 'bold',
 *   color: [0, 0, 0],
 *   marginLeft: 40,
 *   contentWidth: 500
 * })
 * yPos = result.newYPos
 * ```
 *
 * @param doc - jsPDF instance
 * @param text - Text content to render
 * @param yPos - Current Y position
 * @param options - Text rendering options
 * @returns Object with newYPos and lineCount
 */
export function addText(
  doc: jsPDF,
  text: string,
  yPos: number,
  options: TextOptions = {}
): { newYPos: number; lineCount: number } {
  const {
    fontSize = 12,
    fontStyle = 'normal',
    color = [0, 0, 0],
    lineSpacing = 1.4,
    marginLeft = 40,
    contentWidth = 500
  } = options

  doc.setFontSize(fontSize)
  doc.setFont('helvetica', fontStyle)
  doc.setTextColor(color[0], color[1], color[2])

  const lines = doc.splitTextToSize(text, contentWidth - 20)
  doc.text(lines, marginLeft, yPos)

  const lineCount = lines.length
  const newYPos = yPos + lineCount * (fontSize * lineSpacing) + 8

  return { newYPos, lineCount }
}

// ============================================================================
// HEADERS
// ============================================================================

/**
 * Add a main header with colored background
 *
 * @example
 * ```typescript
 * yPos = addMainHeader(doc, 'Executive Summary', yPos, {
 *   fontSize: 18,
 *   backgroundColor: [102, 16, 242],
 *   marginLeft: 40,
 *   contentWidth: 720
 * })
 * ```
 *
 * @param doc - jsPDF instance
 * @param text - Header text
 * @param yPos - Current Y position
 * @param options - Header rendering options
 * @returns New Y position after header
 */
export function addMainHeader(
  doc: jsPDF,
  text: string,
  yPos: number,
  options: HeaderOptions = {}
): number {
  const {
    fontSize = 18,
    backgroundColor = [102, 16, 242],
    textColor = [255, 255, 255],
    marginLeft = 40,
    contentWidth = 720
  } = options

  // Background rectangle
  doc.setFillColor(backgroundColor[0], backgroundColor[1], backgroundColor[2])
  doc.rect(marginLeft - 10, yPos - 15, contentWidth + 20, fontSize + 25, 'F')

  // White text on colored background
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.setFontSize(fontSize)
  doc.setFont('helvetica', 'bold')
  doc.text(text, marginLeft, yPos + fontSize / 2)

  // Reset text color to black
  doc.setTextColor(0, 0, 0)

  return yPos + fontSize + 25
}

/**
 * Add a section header with colored background
 *
 * @example
 * ```typescript
 * yPos = addSectionHeader(doc, 'Technical Requirements', yPos, {
 *   fontSize: 14,
 *   backgroundColor: [220, 53, 69],
 *   marginLeft: 40,
 *   contentWidth: 720
 * })
 * ```
 *
 * @param doc - jsPDF instance
 * @param text - Section header text
 * @param yPos - Current Y position
 * @param options - Header rendering options
 * @returns New Y position after header
 */
export function addSectionHeader(
  doc: jsPDF,
  text: string,
  yPos: number,
  options: HeaderOptions = {}
): number {
  const {
    fontSize = 14,
    backgroundColor = [220, 53, 69],
    textColor = [255, 255, 255],
    marginLeft = 40,
    contentWidth = 720
  } = options

  // Background rectangle
  doc.setFillColor(backgroundColor[0], backgroundColor[1], backgroundColor[2])
  doc.rect(marginLeft - 5, yPos - 8, contentWidth + 10, fontSize + 16, 'F')

  // White text on colored background
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.setFontSize(fontSize)
  doc.setFont('helvetica', 'bold')
  doc.text(text, marginLeft, yPos + fontSize / 2)

  // Reset text color to black
  doc.setTextColor(0, 0, 0)

  return yPos + fontSize + 20
}

// ============================================================================
// VISUAL ELEMENTS
// ============================================================================

/**
 * Add a visual section divider line
 *
 * @example
 * ```typescript
 * yPos = addSectionDivider(doc, yPos, {
 *   color: [102, 16, 242],
 *   lineWidth: 2,
 *   marginLeft: 40,
 *   marginRight: 40,
 *   pageWidth: 842
 * })
 * ```
 *
 * @param doc - jsPDF instance
 * @param yPos - Current Y position
 * @param options - Divider options
 * @returns New Y position after divider
 */
export function addSectionDivider(
  doc: jsPDF,
  yPos: number,
  options: {
    color?: [number, number, number]
    lineWidth?: number
    marginLeft?: number
    marginRight?: number
    pageWidth?: number
  } = {}
): number {
  const {
    color = [102, 16, 242],
    lineWidth = 2,
    marginLeft = 40,
    marginRight = 40,
    pageWidth = 842
  } = options

  const newYPos = yPos + 10
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(lineWidth)
  doc.line(marginLeft, newYPos, pageWidth - marginRight, newYPos)

  return newYPos + 20
}

// ============================================================================
// TABLES
// ============================================================================

/**
 * Add a formatted table with headers and alternating row colors
 *
 * @example
 * ```typescript
 * const result = addTable(doc, yPos, {
 *   headers: ['Name', 'Value', 'Status'],
 *   rows: [
 *     ['Item 1', '100', 'Active'],
 *     ['Item 2', '200', 'Pending']
 *   ],
 *   cellWidths: [200, 150, 150],
 *   marginLeft: 40,
 *   totalWidth: 500
 * })
 * yPos = result.newYPos
 * ```
 *
 * @param doc - jsPDF instance
 * @param yPos - Current Y position
 * @param config - Table configuration
 * @returns Object with newYPos
 */
export function addTable(
  doc: jsPDF,
  yPos: number,
  config: TableConfig
): { newYPos: number } {
  const {
    headers,
    rows,
    cellWidths,
    marginLeft = 40,
    totalWidth = 680
  } = config

  const numCols = headers.length
  const defaultCellWidth = totalWidth / numCols
  const widths = cellWidths || new Array(numCols).fill(defaultCellWidth)
  const rowHeight = 25

  // Draw header row with gradient
  doc.setFillColor(102, 16, 242)
  doc.rect(marginLeft, yPos, totalWidth, rowHeight, 'F')
  doc.setDrawColor(102, 16, 242)
  doc.setLineWidth(1)
  doc.rect(marginLeft, yPos, totalWidth, rowHeight, 'S')

  // Header text
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  let currentX = marginLeft
  headers.forEach((header, i) => {
    const cellWidth = widths[i]
    const textLines = doc.splitTextToSize(header, cellWidth - 10)
    doc.text(textLines, currentX + 5, yPos + 16)
    currentX += cellWidth
  })

  let newYPos = yPos + rowHeight
  doc.setTextColor(0, 0, 0)

  // Draw data rows with alternating colors
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  rows.forEach((row, rowIndex) => {
    // Alternating row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 249, 250)
    } else {
      doc.setFillColor(255, 255, 255)
    }
    doc.rect(marginLeft, newYPos, totalWidth, rowHeight, 'F')

    // Row border
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.rect(marginLeft, newYPos, totalWidth, rowHeight, 'S')

    // Cell content
    currentX = marginLeft
    row.forEach((cell, cellIndex) => {
      const cellWidth = widths[cellIndex]
      const textLines = doc.splitTextToSize(cell || '', cellWidth - 10)
      doc.text(textLines.slice(0, 2), currentX + 5, newYPos + 14) // Max 2 lines per cell
      currentX += cellWidth
    })
    newYPos += rowHeight
  })

  return { newYPos: newYPos + 15 }
}

// ============================================================================
// ADVANCED COMPONENTS (for Insights PDF)
// ============================================================================

/**
 * Create a modern gradient header with optional subtitle (mm units)
 *
 * @example
 * ```typescript
 * const result = createGradientHeader(doc, yPos, {
 *   title: 'Strategic Analysis',
 *   subtitle: 'Q4 2024 Report',
 *   primaryColor: [79, 70, 229],
 *   marginLeft: 20,
 *   contentWidth: 170
 * })
 * yPos = result.newYPos
 * ```
 *
 * @param doc - jsPDF instance (in mm units)
 * @param yPos - Current Y position in mm
 * @param config - Gradient header configuration
 * @returns Object with newYPos
 */
export function createGradientHeader(
  doc: jsPDF,
  yPos: number,
  config: GradientHeaderConfig
): { newYPos: number } {
  const {
    title,
    subtitle,
    primaryColor = [79, 70, 229],
    whiteColor = [255, 255, 255],
    marginLeft = 20,
    contentWidth = 170
  } = config

  const gradientHeight = 18
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(marginLeft - 3, yPos, contentWidth + 6, gradientHeight, 'F')

  // Main title
  doc.setTextColor(whiteColor[0], whiteColor[1], whiteColor[2])
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  const availableWidth = contentWidth - 6
  const titleLines = doc.splitTextToSize(title, availableWidth)
  doc.text(titleLines, marginLeft + 3, yPos + 12)

  let newYPos = yPos + gradientHeight + 3

  // Subtitle
  if (subtitle) {
    doc.setTextColor(75, 85, 99) // gray700
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const subtitleLines = doc.splitTextToSize(subtitle, availableWidth)
    doc.text(subtitleLines, marginLeft, newYPos + 4)
    newYPos += subtitleLines.length * 3 + 5
  }

  newYPos += 8
  doc.setTextColor(0, 0, 0) // Reset to black

  return { newYPos }
}

/**
 * Create an insight card with impact-based color coding (mm units)
 *
 * @example
 * ```typescript
 * const result = createInsightCard(doc, yPos, {
 *   title: 'Market Opportunity',
 *   content: 'Significant growth potential in emerging markets...',
 *   impact: 'high',
 *   index: 1,
 *   marginLeft: 20,
 *   contentWidth: 170
 * })
 * yPos = result.newYPos
 * ```
 *
 * @param doc - jsPDF instance (in mm units)
 * @param yPos - Current Y position in mm
 * @param config - Insight card configuration
 * @returns Object with newYPos
 */
export function createInsightCard(
  doc: jsPDF,
  yPos: number,
  config: InsightCardConfig
): { newYPos: number } {
  const {
    title,
    content,
    impact,
    index,
    marginLeft = 20,
    contentWidth = 170
  } = config

  const cardHeight = 20
  const gray100 = [243, 244, 246]
  const gray600 = [75, 85, 99]
  const gray700 = [55, 65, 81]
  const gray900 = [17, 24, 39]
  const white = [255, 255, 255]

  const impactColors = {
    high: [239, 68, 68],    // danger
    medium: [251, 146, 60], // warning
    low: [34, 197, 94]      // success
  }
  const impactColor = impactColors[impact]

  // Main card background
  doc.setFillColor(gray100[0], gray100[1], gray100[2])
  doc.rect(marginLeft, yPos, contentWidth, cardHeight, 'F')

  // Left accent stripe
  doc.setFillColor(impactColor[0], impactColor[1], impactColor[2])
  doc.rect(marginLeft, yPos, 2, cardHeight, 'F')

  // Card border
  doc.setDrawColor(gray600[0], gray600[1], gray600[2])
  doc.setLineWidth(0.5)
  doc.rect(marginLeft, yPos, contentWidth, cardHeight, 'S')

  // Insight number badge
  doc.setFillColor(impactColor[0], impactColor[1], impactColor[2])
  doc.circle(marginLeft + 8, yPos + 10, 4, 'F')
  doc.setTextColor(white[0], white[1], white[2])
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(index.toString(), marginLeft + 6, yPos + 12)

  // Title and impact
  doc.setTextColor(gray900[0], gray900[1], gray900[2])
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const titleText = `${title} (${impact.toUpperCase()} IMPACT)`
  const availableTitleWidth = contentWidth - 18
  const titleLines = doc.splitTextToSize(titleText, availableTitleWidth)
  doc.text(titleLines[0], marginLeft + 15, yPos + 12)

  let newYPos = yPos + cardHeight + 3

  // Content
  doc.setTextColor(gray700[0], gray700[1], gray700[2])
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const availableContentWidth = contentWidth - 6
  const contentLines = doc.splitTextToSize(content, availableContentWidth)
  doc.text(contentLines.slice(0, 4), marginLeft + 3, newYPos + 3)

  newYPos += Math.min(contentLines.length, 4) * 3 + 8
  doc.setTextColor(0, 0, 0) // Reset to black

  return { newYPos }
}

/**
 * Create an executive panel with title, content, and statistics (mm units)
 *
 * @example
 * ```typescript
 * const result = createExecutivePanel(doc, yPos, {
 *   title: 'Financial Overview',
 *   content: 'Revenue projections show strong growth trajectory...',
 *   stats: [
 *     { label: 'Revenue', value: '$2.4M', color: [34, 197, 94] },
 *     { label: 'Growth', value: '+45%', color: [79, 70, 229] }
 *   ],
 *   marginLeft: 20,
 *   contentWidth: 170
 * })
 * yPos = result.newYPos
 * ```
 *
 * @param doc - jsPDF instance (in mm units)
 * @param yPos - Current Y position in mm
 * @param config - Executive panel configuration
 * @returns Object with newYPos
 */
export function createExecutivePanel(
  doc: jsPDF,
  yPos: number,
  config: ExecutivePanelConfig
): { newYPos: number } {
  const {
    title,
    content,
    stats,
    marginLeft = 20,
    contentWidth = 170
  } = config

  const panelHeight = 50
  const gray100 = [243, 244, 246]
  const gray600 = [75, 85, 99]
  const gray700 = [55, 65, 81]
  const gray900 = [17, 24, 39]
  const white = [255, 255, 255]
  const primary = [79, 70, 229]

  // Panel background
  doc.setFillColor(gray100[0], gray100[1], gray100[2])
  doc.rect(marginLeft, yPos, contentWidth, panelHeight, 'F')

  // Panel border
  doc.setDrawColor(gray600[0], gray600[1], gray600[2])
  doc.setLineWidth(1)
  doc.rect(marginLeft, yPos, contentWidth, panelHeight, 'S')

  // Title bar
  doc.setFillColor(gray900[0], gray900[1], gray900[2])
  doc.rect(marginLeft, yPos, contentWidth, 10, 'F')
  doc.setTextColor(white[0], white[1], white[2])
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(title, marginLeft + 3, yPos + 7)

  let newYPos = yPos + 12

  // Content area
  doc.setTextColor(gray700[0], gray700[1], gray700[2])
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const availableContentWidth = contentWidth - 6
  const contentLines = doc.splitTextToSize(content, availableContentWidth)
  doc.text(contentLines.slice(0, 3), marginLeft + 3, newYPos + 4)

  newYPos += Math.min(contentLines.length, 3) * 3 + 8

  // Stats section - vertical layout
  if (stats.length > 0) {
    stats.forEach((stat) => {
      doc.setTextColor(gray600[0], gray600[1], gray600[2])
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(`${stat.label}: `, marginLeft + 3, newYPos + 3)

      const labelWidth = doc.getTextWidth(`${stat.label}: `)
      const statColor = stat.color || primary
      doc.setTextColor(statColor[0], statColor[1], statColor[2])
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(stat.value, marginLeft + 3 + labelWidth, newYPos + 3)

      newYPos += 4
    })
    newYPos += 5
  }

  newYPos += 5
  doc.setTextColor(0, 0, 0) // Reset to black

  return { newYPos }
}
