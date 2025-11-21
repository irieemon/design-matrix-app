/**
 * Professional Insights PDF Generator
 * Generates AI insights reports in PDF format using pdfMake
 *
 * This module creates professional, publication-quality PDF reports from AI insights data
 * using the pdfMake library with advanced layout and typography features.
 */

import { logger } from '../../logging'
import { PdfColors } from '../config/PdfStyles'
import { loadPdfMake } from '../loaders/PdfLibraryLoader'

const insightsLogger = logger.withContext({ component: 'ProfessionalInsightsPdfGenerator' })

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
  color?: string
}

/**
 * Generate professional AI insights PDF report using pdfMake
 *
 * @param insights - The insights report data structure
 * @param projectName - Optional project name for branding
 * @param projectType - Optional project type descriptor
 */
export async function exportInsightsToPDFProfessional(
  insights: InsightsReport,
  projectName?: string,
  projectType?: string
): Promise<void> {
  try {
    insightsLogger.info('Generating professional insights PDF', { projectName, projectType })

    // Load pdfMake dynamically
    const pdfMakeInstance = await loadPdfMake()

    // Professional brand colors (2024 standards)
    const brandColors = {
      primary: PdfColors.brand.primary,
      secondary: PdfColors.modern.skyBlue,
      success: PdfColors.status.success,
      warning: PdfColors.status.warning,
      danger: PdfColors.status.danger,
      dark: PdfColors.gray.gray900,
      medium: PdfColors.gray.gray600,
      light: PdfColors.gray.gray100,
      white: PdfColors.base.white
    }

    // Professional typography hierarchy (sans-serif, 3 levels)
    const typography = {
      h1: { fontSize: 24, bold: true, color: brandColors.dark },
      h2: { fontSize: 18, bold: true, color: brandColors.primary },
      h3: { fontSize: 14, bold: true, color: brandColors.dark },
      body: { fontSize: 11, color: brandColors.dark },
      small: { fontSize: 9, color: brandColors.medium },
      caption: { fontSize: 8, color: brandColors.medium, italics: true }
    }

    // Helper function to create professional section headers
    const createSectionHeader = (title: string, subtitle?: string) => {
      const content: any[] = [
        {
          table: {
            widths: ['*'],
            body: [[{
              text: title,
              style: 'h2',
              fillColor: brandColors.primary,
              color: brandColors.white,
              margin: [15, 10, 15, 10]
            }]]
          },
          layout: 'noBorders',
          margin: [0, 20, 0, 10]
        }
      ]

      if (subtitle) {
        content.push({
          text: subtitle,
          style: 'caption',
          margin: [0, 0, 0, 15]
        })
      }

      return content
    }

    // Helper function to create executive summary panels
    const createExecutivePanel = (
      title: string,
      content: string,
      stats: StatItem[]
    ) => {
      const statsTable = stats.map(stat => [
        { text: `${stat.label}:`, style: 'small', color: brandColors.medium },
        { text: stat.value, style: 'body', bold: true, color: stat.color || brandColors.primary }
      ])

      return {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: title, style: 'h3', margin: [0, 0, 0, 10] },
              { text: content, style: 'body', margin: [0, 0, 0, 15] },
              {
                table: {
                  widths: ['auto', '*'],
                  body: statsTable
                },
                layout: 'noBorders'
              }
            ],
            margin: [20, 15, 20, 15]
          }]]
        },
        layout: {
          fillColor: brandColors.light,
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => brandColors.medium,
          vLineColor: () => brandColors.medium
        },
        margin: [0, 0, 0, 20]
      }
    }

    // Helper function to create insight cards with proper impact styling
    const createInsightCard = (insight: InsightItem, index: number) => {
      const impactColors = {
        high: brandColors.danger,
        medium: brandColors.warning,
        low: brandColors.success
      }

      const impactLevel = insight.impact?.toLowerCase().includes('high') ? 'high' :
                         insight.impact?.toLowerCase().includes('low') ? 'low' : 'medium'
      const impactColor = impactColors[impactLevel]

      return {
        table: {
          widths: ['auto', '*'],
          body: [[
            {
              text: index.toString(),
              style: 'h3',
              color: brandColors.white,
              fillColor: impactColor,
              alignment: 'center',
              margin: [8, 8, 8, 8]
            },
            {
              stack: [
                {
                  text: `${insight.insight || `Strategic Insight ${index}`}`,
                  style: 'h3',
                  margin: [0, 0, 0, 5]
                },
                {
                  text: `Impact Level: ${impactLevel.toUpperCase()}`,
                  style: 'small',
                  color: impactColor,
                  margin: [0, 0, 0, 8]
                },
                {
                  text: insight.impact || 'Significant strategic implications for project success.',
                  style: 'body'
                }
              ],
              margin: [15, 10, 10, 10]
            }
          ]]
        },
        layout: {
          fillColor: brandColors.white,
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => brandColors.medium,
          vLineColor: () => brandColors.medium
        },
        margin: [0, 0, 0, 15]
      }
    }

    // Build mock project object for compatibility
    const project: Project | null = projectName ? { name: projectName, description: projectType } : null
    const filesWithContent: FileWithContent[] = []

    // Build document definition with professional structure
    const documentDefinition: any = {
      pageSize: 'A4',
      pageMargins: [50, 60, 50, 80],

      // Define styles following 2024 typography standards
      styles: {
        h1: typography.h1,
        h2: typography.h2,
        h3: typography.h3,
        body: typography.body,
        small: typography.small,
        caption: typography.caption
      },

      // Document content with professional structure
      content: [
        // COVER PAGE - Executive Summary
        {
          text: project?.name || 'AI Strategic Insights Report',
          style: 'h1',
          alignment: 'center',
          margin: [0, 40, 0, 10]
        },
        {
          text: 'Comprehensive Strategic Analysis & Recommendations',
          style: 'body',
          alignment: 'center',
          color: brandColors.medium,
          margin: [0, 0, 0, 40]
        },

        // Executive Overview Panel
        createExecutivePanel(
          'Analysis Overview',
          `This comprehensive strategic analysis provides actionable insights and recommendations for ${project?.name || 'your project'}. The analysis incorporates data-driven methodologies and industry best practices.`,
          [
            { label: 'Analysis Type', value: 'Strategic Insights', color: brandColors.primary },
            { label: 'Documents Reviewed', value: filesWithContent.length.toString(), color: brandColors.secondary },
            { label: 'Generated', value: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), color: brandColors.success }
          ]
        ),

        // Project Description if available
        ...(project?.description ? [{
          text: 'Project Context',
          style: 'h3',
          margin: [0, 20, 0, 10]
        }, {
          text: project.description,
          style: 'body',
          margin: [0, 0, 0, 30]
        }] : []),

        // Page break for new section
        { text: '', pageBreak: 'before' },

        // EXECUTIVE SUMMARY SECTION
        ...createSectionHeader('Executive Summary', 'Strategic Overview & Key Findings'),

        createExecutivePanel(
          'Strategic Assessment',
          insights.executiveSummary || 'Strategic analysis reveals key opportunities for optimization and growth. This comprehensive review identifies priority initiatives that will drive meaningful impact and sustainable value creation.',
          [
            { label: 'Priority Initiatives', value: (insights.priorityRecommendations?.immediate?.length || 0).toString(), color: brandColors.danger },
            { label: 'Strategic Opportunities', value: (insights.riskAssessment?.opportunities?.length || 0).toString(), color: brandColors.success },
            { label: 'Implementation Phases', value: (insights.suggestedRoadmap?.length || 0).toString(), color: brandColors.secondary }
          ]
        ),

        // KEY STRATEGIC INSIGHTS SECTION
        ...(insights.keyInsights && insights.keyInsights.length > 0 ? [
          ...createSectionHeader('Strategic Insights', 'Critical Findings & Recommendations'),

          // Create insight cards with proper spacing
          ...insights.keyInsights.map((insight: InsightItem, index: number) =>
            createInsightCard(insight, index + 1)
          )
        ] : []),

        // IMPLEMENTATION ROADMAP SECTION
        ...(insights.suggestedRoadmap && insights.suggestedRoadmap.length > 0 ? [
          { text: '', pageBreak: 'before' },
          ...createSectionHeader('Implementation Roadmap', 'Strategic Phases & Milestones'),

          ...insights.suggestedRoadmap.map((phase: RoadmapPhase, index: number) =>
            createExecutivePanel(
              `Phase ${index + 1}: ${phase.phase || `Implementation Phase ${index + 1}`}`,
              `Focus Area: ${phase.focus || 'Strategic implementation focus to be defined'}\n\nKey Initiatives: ${phase.ideas?.join(', ') || 'Implementation activities and deliverables to be defined during planning phase'}`,
              [
                { label: 'Duration', value: phase.duration || 'TBD', color: brandColors.secondary },
                { label: 'Priority', value: 'High', color: brandColors.danger },
                { label: 'Status', value: 'Planning', color: brandColors.warning }
              ]
            )
          )
        ] : []),

        // PRIORITY RECOMMENDATIONS SECTION
        ...(insights.priorityRecommendations ? [
          { text: '', pageBreak: 'before' },
          ...createSectionHeader('Priority Recommendations', 'Immediate Actions & Strategic Initiatives'),

          // Immediate actions
          ...(insights.priorityRecommendations.immediate && insights.priorityRecommendations.immediate.length > 0 ? [
            createExecutivePanel(
              'Immediate Actions (0-30 days)',
              insights.priorityRecommendations.immediate.join('\n• '),
              [
                { label: 'Items', value: insights.priorityRecommendations.immediate.length.toString(), color: brandColors.danger },
                { label: 'Timeline', value: '0-30 days', color: brandColors.warning },
                { label: 'Priority', value: 'Critical', color: brandColors.danger }
              ]
            )
          ] : []),

          // Short term initiatives
          ...(insights.priorityRecommendations.shortTerm && insights.priorityRecommendations.shortTerm.length > 0 ? [
            createExecutivePanel(
              'Short-term Initiatives (1-6 months)',
              insights.priorityRecommendations.shortTerm.join('\n• '),
              [
                { label: 'Items', value: insights.priorityRecommendations.shortTerm.length.toString(), color: brandColors.warning },
                { label: 'Timeline', value: '1-6 months', color: brandColors.secondary },
                { label: 'Priority', value: 'High', color: brandColors.warning }
              ]
            )
          ] : []),

          // Long term goals
          ...(insights.priorityRecommendations.longTerm && insights.priorityRecommendations.longTerm.length > 0 ? [
            createExecutivePanel(
              'Long-term Goals (6+ months)',
              insights.priorityRecommendations.longTerm.join('\n• '),
              [
                { label: 'Items', value: insights.priorityRecommendations.longTerm.length.toString(), color: brandColors.success },
                { label: 'Timeline', value: '6+ months', color: brandColors.primary },
                { label: 'Priority', value: 'Strategic', color: brandColors.success }
              ]
            )
          ] : [])
        ] : []),

        // RISK ASSESSMENT & OPPORTUNITIES SECTION
        ...(insights.riskAssessment ? [
          ...createSectionHeader('Risk Assessment', 'Challenges & Opportunities Analysis'),

          ...(insights.riskAssessment.highRisk && insights.riskAssessment.highRisk.length > 0 ? [
            createExecutivePanel(
              'Risk Factors',
              insights.riskAssessment.highRisk.join('\n• '),
              [
                { label: 'Risk Items', value: insights.riskAssessment.highRisk.length.toString(), color: brandColors.danger },
                { label: 'Severity', value: 'High', color: brandColors.danger },
                { label: 'Mitigation', value: 'Required', color: brandColors.warning }
              ]
            )
          ] : []),

          ...(insights.riskAssessment.opportunities && insights.riskAssessment.opportunities.length > 0 ? [
            createExecutivePanel(
              'Strategic Opportunities',
              insights.riskAssessment.opportunities.join('\n• '),
              [
                { label: 'Opportunities', value: insights.riskAssessment.opportunities.length.toString(), color: brandColors.success },
                { label: 'Potential', value: 'High', color: brandColors.success },
                { label: 'Action', value: 'Recommended', color: brandColors.secondary }
              ]
            )
          ] : [])
        ] : []),

        // NEXT STEPS & CONCLUSION
        ...(insights.nextSteps && insights.nextSteps.length > 0 ? [
          ...createSectionHeader('Next Steps', 'Immediate Actions for Implementation'),

          createExecutivePanel(
            'Recommended Actions',
            insights.nextSteps.join('\n• '),
            [
              { label: 'Action Items', value: insights.nextSteps.length.toString(), color: brandColors.primary },
              { label: 'Priority', value: 'Immediate', color: brandColors.danger },
              { label: 'Owner', value: 'Project Team', color: brandColors.secondary }
            ]
          )
        ] : [])
      ],

      // Professional footer
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: 'Prioritas AI Strategic Insights Report', style: 'caption' },
          { text: `Page ${currentPage} of ${pageCount}`, style: 'caption', alignment: 'right' }
        ],
        margin: [50, 30, 50, 0]
      }),

      // Professional header
      header: {
        text: `Generated: ${new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`,
        style: 'caption',
        alignment: 'right',
        margin: [50, 30, 50, 0]
      }
    }

    // Generate and download the professional PDF
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
    const fileName = `${projectPrefix}Strategic_Insights_Professional_${timestamp}.pdf`

    pdfMakeInstance.createPdf(documentDefinition).download(fileName)

    insightsLogger.info('Professional insights PDF generated successfully', { fileName })
  } catch (_error) {
    insightsLogger.error('Failed to generate professional insights PDF', error)
    throw error
  }
}
