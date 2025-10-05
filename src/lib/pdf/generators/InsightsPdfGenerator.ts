/**
 * Simple Insights PDF Generator
 * Generates AI insights reports in PDF format using jsPDF
 *
 * This module creates modern, visually appealing PDF reports from AI insights data
 * using the jsPDF library with custom styling and layout components.
 */

import jsPDF from 'jspdf'
import { logger } from '../../logging'
import { PdfColors, PdfTypography } from '../config/PdfStyles'

const insightsLogger = logger.withContext({ component: 'InsightsPdfGenerator' })

// Type definitions for insights data structure
interface InsightItem {
  insight: string
  impact: string
}

interface RoadmapPhase {
  phase: string
  focus: string
  duration: string
  ideas?: string[]
}

interface PriorityRecommendations {
  immediate?: string[]
  shortTerm?: string[]
  longTerm?: string[]
}

interface RiskAssessment {
  highRisk?: string[]
  opportunities?: string[]
}

interface InsightsReport {
  executiveSummary?: string
  keyInsights?: InsightItem[]
  suggestedRoadmap?: RoadmapPhase[]
  priorityRecommendations?: PriorityRecommendations
  riskAssessment?: RiskAssessment
  nextSteps?: string[]
}

interface Project {
  name: string
  description?: string
}

interface FileWithContent {
  name: string
  content: string
}

interface StatItem {
  label: string
  value: string
  color?: readonly [number, number, number]
}

/**
 * Generate AI insights PDF report using jsPDF
 *
 * @param insights - The insights report data structure
 * @param projectName - Optional project name for branding
 * @param projectType - Optional project type descriptor
 */
export function exportInsightsToPDF(
  insights: InsightsReport,
  projectName?: string,
  projectType?: string
): void {
  try {
    insightsLogger.info('Generating insights PDF', { projectName, projectType })

    const doc = new jsPDF('portrait', 'mm', 'a4')
    let yPos = 25
    const pageH = doc.internal.pageSize.height
    const pageW = doc.internal.pageSize.width
    const marginL = 20
    const marginR = 20
    const contentW = pageW - marginL - marginR

    // Modern color palette from PdfColors
    const primary = PdfColors.brand.primaryRgb
    const accent = PdfColors.modern.skyBlueRgb
    const success = PdfColors.status.successRgb
    const warning = PdfColors.status.warningRgb
    const danger = PdfColors.status.dangerRgb
    const gray900 = PdfColors.gray.gray900Rgb
    const gray700 = PdfColors.gray.gray700Rgb
    const gray600 = PdfColors.gray.gray600Rgb
    const gray100 = PdfColors.gray.gray100Rgb
    const white = PdfColors.base.whiteRgb

    // Enhanced page break function with proper margins
    const pageBreak = (space: number) => {
      if (yPos + space > pageH - 40) {
        doc.addPage()
        yPos = 25
      }
    }

    // Modern gradient header with proper sizing
    const createGradientHeader = (title: string, subtitle?: string) => {
      pageBreak(40)

      // Simplified gradient background
      const gradientHeight = 18
      doc.setFillColor(primary[0], primary[1], primary[2])
      doc.rect(marginL - 3, yPos, contentW + 6, gradientHeight, 'F')

      // Main title with proper sizing
      doc.setTextColor(white[0], white[1], white[2])
      doc.setFontSize(PdfTypography.sizes.h2)
      doc.setFont('helvetica', 'bold')
      const availableWidth = contentW - 6
      const titleLines = doc.splitTextToSize(title, availableWidth)
      doc.text(titleLines, marginL + 3, yPos + 12)

      yPos += gradientHeight + 3

      // Subtitle with proper sizing
      if (subtitle) {
        doc.setTextColor(gray700[0], gray700[1], gray700[2])
        doc.setFontSize(PdfTypography.sizes.caption)
        doc.setFont('helvetica', 'normal')
        const subtitleLines = doc.splitTextToSize(subtitle, availableWidth)
        doc.text(subtitleLines, marginL, yPos + 4)
        yPos += subtitleLines.length * 3 + 5
      }

      yPos += 8
    }

    // Simplified insight card with better text sizing
    const createInsightCard = (
      _icon: string,
      title: string,
      content: string,
      impact: 'high' | 'medium' | 'low',
      index: number
    ) => {
      pageBreak(35)

      const cardHeight = 20
      const colors = {
        high: danger,
        medium: warning,
        low: success
      }
      const impactColor = colors[impact]

      // Main card background
      doc.setFillColor(gray100[0], gray100[1], gray100[2])
      doc.rect(marginL, yPos, contentW, cardHeight, 'F')

      // Left accent stripe
      doc.setFillColor(impactColor[0], impactColor[1], impactColor[2])
      doc.rect(marginL, yPos, 2, cardHeight, 'F')

      // Card border
      doc.setDrawColor(gray600[0], gray600[1], gray600[2])
      doc.setLineWidth(0.5)
      doc.rect(marginL, yPos, contentW, cardHeight, 'S')

      // Insight number badge (smaller)
      doc.setFillColor(impactColor[0], impactColor[1], impactColor[2])
      doc.circle(marginL + 8, yPos + 10, 4, 'F')
      doc.setTextColor(white[0], white[1], white[2])
      doc.setFontSize(PdfTypography.sizes.small)
      doc.setFont('helvetica', 'bold')
      doc.text(index.toString(), marginL + 6, yPos + 12)

      // Title and impact (smaller font)
      doc.setTextColor(gray900[0], gray900[1], gray900[2])
      doc.setFontSize(PdfTypography.sizes.caption)
      doc.setFont('helvetica', 'bold')
      const titleText = `${title} (${impact.toUpperCase()} IMPACT)`
      const availableTitleWidth = contentW - 18
      const titleLines = doc.splitTextToSize(titleText, availableTitleWidth)
      doc.text(titleLines[0], marginL + 15, yPos + 12) // Only first line in header

      yPos += cardHeight + 3

      // Content with better text management
      doc.setTextColor(gray700[0], gray700[1], gray700[2])
      doc.setFontSize(PdfTypography.sizes.small)
      doc.setFont('helvetica', 'normal')
      const availableContentWidth = contentW - 6
      const contentLines = doc.splitTextToSize(content, availableContentWidth)
      doc.text(contentLines.slice(0, 4), marginL + 3, yPos + 3) // Allow more lines but smaller font

      yPos += Math.min(contentLines.length, 4) * 3 + 8
    }

    // Simplified executive panel with fixed text positioning
    const createExecutivePanel = (
      title: string,
      content: string,
      stats: StatItem[]
    ) => {
      pageBreak(60)

      const panelHeight = 50

      // Panel background
      doc.setFillColor(gray100[0], gray100[1], gray100[2])
      doc.rect(marginL, yPos, contentW, panelHeight, 'F')

      // Panel border
      doc.setDrawColor(gray600[0], gray600[1], gray600[2])
      doc.setLineWidth(1)
      doc.rect(marginL, yPos, contentW, panelHeight, 'S')

      // Title bar
      doc.setFillColor(gray900[0], gray900[1], gray900[2])
      doc.rect(marginL, yPos, contentW, 10, 'F')
      doc.setTextColor(white[0], white[1], white[2])
      doc.setFontSize(PdfTypography.sizes.h3)
      doc.setFont('helvetica', 'bold')
      doc.text(title, marginL + 3, yPos + 7)

      yPos += 12

      // Content area with proper text wrapping
      doc.setTextColor(gray700[0], gray700[1], gray700[2])
      doc.setFontSize(PdfTypography.sizes.small)
      doc.setFont('helvetica', 'normal')
      const availableContentWidth = contentW - 6 // More margin for readability
      const contentLines = doc.splitTextToSize(content, availableContentWidth)
      doc.text(contentLines.slice(0, 3), marginL + 3, yPos + 4) // Limit to 3 lines, better spacing

      yPos += Math.min(contentLines.length, 3) * 3 + 8

      // Stats section - vertical layout to prevent overlap
      if (stats.length > 0) {
        stats.forEach((stat) => {
          // Each stat on its own line to prevent overlapping
          doc.setTextColor(gray600[0], gray600[1], gray600[2])
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.text(`${stat.label}: `, marginL + 3, yPos + 3)

          // Position value right after label with proper spacing
          const labelWidth = doc.getTextWidth(`${stat.label}: `)
          doc.setTextColor((stat.color || primary)[0], (stat.color || primary)[1], (stat.color || primary)[2])
          doc.setFontSize(PdfTypography.sizes.small)
          doc.setFont('helvetica', 'bold')
          doc.text(stat.value, marginL + 3 + labelWidth, yPos + 3)

          yPos += 4 // Move to next line
        })
        yPos += 5
      }

      yPos += 5
    }

    // Build mock project object for compatibility
    const project: Project | null = projectName ? { name: projectName, description: projectType } : null
    const filesWithContent: FileWithContent[] = []

    // MODERN COVER PAGE

    // Hero gradient header
    createGradientHeader(
      project?.name || 'AI Strategic Insights Report',
      'Comprehensive Analysis & Recommendations'
    )

    // Cover stats panel - reduced to prevent overlap
    const coverStats: StatItem[] = [
      { label: 'Analysis Type', value: 'Strategic Insights', color: primary },
      { label: 'Documents', value: filesWithContent.length.toString(), color: accent },
      { label: 'Date', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: success }
    ]

    createExecutivePanel(
      'Analysis Overview',
      `Strategic analysis providing actionable insights and recommendations for ${project?.name || 'your project'}.`,
      coverStats
    )

    // Project description if available
    if (project?.description) {
      pageBreak(60)
      doc.setTextColor(gray700[0], gray700[1], gray700[2])
      doc.setFontSize(PdfTypography.sizes.body)
      doc.setFont('helvetica', 'normal')
      const descLines = doc.splitTextToSize(`Project Context: ${project.description}`, contentW)
      doc.text(descLines, marginL, yPos)
      yPos += descLines.length * 14 + 40
    }

    // New page for content
    doc.addPage()
    yPos = 25

    // EXECUTIVE SUMMARY SECTION
    createGradientHeader('Executive Summary', 'Strategic Overview & Key Findings')

    const executiveSummary = insights.executiveSummary || 'Strategic analysis reveals key opportunities for optimization and growth. This comprehensive review identifies priority initiatives that will drive meaningful impact and sustainable value creation.'

    const summaryStats: StatItem[] = [
      { label: 'Priority Initiatives', value: (insights.priorityRecommendations?.immediate?.length || 0).toString(), color: danger },
      { label: 'Strategic Opportunities', value: (insights.riskAssessment?.opportunities?.length || 0).toString(), color: success },
      { label: 'Implementation Phases', value: (insights.suggestedRoadmap?.length || 0).toString(), color: accent }
    ]

    createExecutivePanel('Strategic Assessment', executiveSummary, summaryStats)

    // KEY STRATEGIC INSIGHTS
    if (insights.keyInsights && insights.keyInsights.length > 0) {
      createGradientHeader('Strategic Insights', 'Critical Findings & Recommendations')

      insights.keyInsights.forEach((item: InsightItem, index: number) => {
        // Determine impact level for color coding
        const impactLevel = item.impact?.toLowerCase().includes('high') ? 'high' :
                           item.impact?.toLowerCase().includes('low') ? 'low' : 'medium'

        createInsightCard(
          '💡',
          item.insight || `Strategic Insight ${index + 1}`,
          `${item.insight || 'Key finding identified through analysis.'} Impact: ${item.impact || 'Significant strategic implications for project success.'}`,
          impactLevel,
          index + 1
        )
      })
    }

    // IMPLEMENTATION ROADMAP
    if (insights.suggestedRoadmap && insights.suggestedRoadmap.length > 0) {
      createGradientHeader('Implementation Roadmap', 'Strategic Phases & Milestones')

      insights.suggestedRoadmap.forEach((phase: RoadmapPhase, index: number) => {
        const phaseContent = `Focus Area: ${phase.focus || 'Strategic implementation focus to be defined'}\n\nKey Initiatives: ${phase.ideas?.join(', ') || 'Implementation activities and deliverables to be defined during planning phase'}`

        createExecutivePanel(
          `Phase ${index + 1}: ${phase.phase || `Implementation Phase ${index + 1}`}`,
          phaseContent,
          [
            { label: 'Duration', value: phase.duration || 'TBD', color: accent },
            { label: 'Priority', value: 'High', color: danger },
            { label: 'Status', value: 'Planning', color: warning }
          ]
        )
      })
    }

    // PRIORITY RECOMMENDATIONS
    if (insights.priorityRecommendations) {
      createGradientHeader('Priority Recommendations', 'Immediate Actions & Strategic Initiatives')

      // Immediate actions
      if (insights.priorityRecommendations.immediate && insights.priorityRecommendations.immediate.length > 0) {
        createExecutivePanel(
          'Immediate Actions (0-30 days)',
          insights.priorityRecommendations.immediate.join('\n• '),
          [
            { label: 'Items', value: insights.priorityRecommendations.immediate.length.toString(), color: danger },
            { label: 'Timeline', value: '0-30 days', color: warning },
            { label: 'Priority', value: 'Critical', color: danger }
          ]
        )
      }

      // Short term initiatives
      if (insights.priorityRecommendations.shortTerm && insights.priorityRecommendations.shortTerm.length > 0) {
        createExecutivePanel(
          'Short-term Initiatives (1-6 months)',
          insights.priorityRecommendations.shortTerm.join('\n• '),
          [
            { label: 'Items', value: insights.priorityRecommendations.shortTerm.length.toString(), color: warning },
            { label: 'Timeline', value: '1-6 months', color: accent },
            { label: 'Priority', value: 'High', color: warning }
          ]
        )
      }

      // Long term goals
      if (insights.priorityRecommendations.longTerm && insights.priorityRecommendations.longTerm.length > 0) {
        createExecutivePanel(
          'Long-term Goals (6+ months)',
          insights.priorityRecommendations.longTerm.join('\n• '),
          [
            { label: 'Items', value: insights.priorityRecommendations.longTerm.length.toString(), color: success },
            { label: 'Timeline', value: '6+ months', color: primary },
            { label: 'Priority', value: 'Strategic', color: success }
          ]
        )
      }
    }

    // RISK ASSESSMENT & OPPORTUNITIES
    if (insights.riskAssessment) {
      createGradientHeader('Risk Assessment', 'Challenges & Opportunities Analysis')

      if (insights.riskAssessment.highRisk && insights.riskAssessment.highRisk.length > 0) {
        createExecutivePanel(
          'Risk Factors',
          insights.riskAssessment.highRisk.join('\n• '),
          [
            { label: 'Risk Items', value: insights.riskAssessment.highRisk.length.toString(), color: danger },
            { label: 'Severity', value: 'High', color: danger },
            { label: 'Mitigation', value: 'Required', color: warning }
          ]
        )
      }

      if (insights.riskAssessment.opportunities && insights.riskAssessment.opportunities.length > 0) {
        createExecutivePanel(
          'Strategic Opportunities',
          insights.riskAssessment.opportunities.join('\n• '),
          [
            { label: 'Opportunities', value: insights.riskAssessment.opportunities.length.toString(), color: success },
            { label: 'Potential', value: 'High', color: success },
            { label: 'Action', value: 'Recommended', color: accent }
          ]
        )
      }
    }

    // NEXT STEPS & CONCLUSION
    if (insights.nextSteps && insights.nextSteps.length > 0) {
      createGradientHeader('Next Steps', 'Immediate Actions for Implementation')

      createExecutivePanel(
        'Recommended Actions',
        insights.nextSteps.join('\n• '),
        [
          { label: 'Action Items', value: insights.nextSteps.length.toString(), color: primary },
          { label: 'Priority', value: 'Immediate', color: danger },
          { label: 'Owner', value: 'Project Team', color: accent }
        ]
      )
    }

    // SIMPLE FOOTER
    yPos = pageH - 20

    doc.setTextColor(gray600[0], gray600[1], gray600[2])
    doc.setFontSize(PdfTypography.sizes.small)
    doc.setFont('helvetica', 'normal')
    doc.text('Prioritas AI Strategic Insights Report', marginL, yPos)

    // Document info (right aligned)
    const docInfo = `Generated: ${new Date().toLocaleDateString()}`
    const infoWidth = doc.getTextWidth(docInfo)
    doc.text(docInfo, pageW - marginR - infoWidth, yPos)

    // Professional filename
    const timestamp = new Date().toISOString().split('T')[0]
    let cleanProjectName = ''
    if (projectName) {
      cleanProjectName = projectName
        .replace(/[\u201C\u201D]/g, '')
        .replace(/[\u2018\u2019]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30)
    }
    const projectPrefix = cleanProjectName ? `${cleanProjectName}_` : ''
    const fileName = `${projectPrefix}AI_Strategic_Insights_${timestamp}.pdf`

    doc.save(fileName)

    insightsLogger.info('Insights PDF generated successfully', { fileName })
  } catch (error) {
    insightsLogger.error('Failed to generate insights PDF', error)
    throw error
  }
}
