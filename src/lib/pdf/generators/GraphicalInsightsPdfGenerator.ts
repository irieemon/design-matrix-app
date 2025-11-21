/**
 * Graphical Insights PDF Generator
 * Premium, visual AI insights reports with charts and graphical elements
 *
 * Design: Monochrome-Lux aesthetic with graphical header, charts, and visual hierarchy
 * - Header section with key metrics and visual charts
 * - Clean typography using Graphite color hierarchy
 * - Gem-tone accents (Sapphire, Emerald, Amber, Garnet) for semantic meaning
 * - Professional layout with visual breathing room
 */

import { logger } from '../../logging'
import { loadPdfMake } from '../loaders/PdfLibraryLoader'

const insightsLogger = logger.withContext({ component: 'GraphicalInsightsPdfGenerator' })

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

/**
 * Monochrome-Lux Design System Colors (matching app)
 */
const LuxColors = {
  // Canvas & Surfaces
  canvas: '#FAFBFC',
  surface: '#FFFFFF',

  // Graphite Text Hierarchy
  graphite900: '#111827',
  graphite800: '#1F2937',
  graphite700: '#374151',
  graphite600: '#4B5563',
  graphite500: '#6B7280',
  graphite400: '#9CA3AF',
  graphite300: '#D1D5DB',
  graphite200: '#E5E7EB',
  graphite100: '#F3F4F6',

  // Gem-tone Accents
  sapphire: '#3B82F6',
  sapphireLight: '#DBEAFE',
  emerald: '#047857',
  emeraldLight: '#ECFDF5',
  amber: '#B45309',
  amberLight: '#FFFBEB',
  garnet: '#B91C1C',
  garnetLight: '#FEF2F2',

  // Hairline Borders
  hairline: '#E8EBED',
  hairlineHover: '#D1D5DB',
}

// Premium typography constants (used inline for pdfMake compatibility)
// Note: Typography is applied directly in document definition to avoid font style errors

/**
 * Create a premium visual header with key metrics
 */
function createGraphicalHeader(
  projectName: string,
  insights: InsightsReport
): any[] {
  // Calculate key metrics
  const totalInsights = insights.keyInsights?.length || 0
  const immediateActions = insights.priorityRecommendations?.immediate?.length || 0
  const opportunities = insights.riskAssessment?.opportunities?.length || 0
  const roadmapPhases = insights.suggestedRoadmap?.length || 0

  return [
    // Hero title with visual impact
    {
      text: projectName || 'Strategic Insights Report',
      fontSize: 32,
      bold: true,
      color: LuxColors.graphite900,
      alignment: 'left',
      margin: [0, 30, 0, 8]
    },
    {
      text: 'AI-Powered Strategic Analysis & Recommendations',
      fontSize: 13,
      color: LuxColors.graphite500,
      margin: [0, 0, 0, 30]
    },

    // Key Metrics Dashboard - Visual cards in grid
    {
      columns: [
        // Metric Card 1: Insights
        {
          width: '23%',
          stack: [
            {
              table: {
                widths: ['*'],
                body: [[{
                  stack: [
                    {
                      text: totalInsights.toString(),
                      fontSize: 36,
                      bold: true,
                      color: LuxColors.sapphire,
                      alignment: 'center',
                      margin: [0, 15, 0, 5]
                    },
                    {
                      text: 'KEY INSIGHTS',
                      fontSize: 9,
                      color: LuxColors.graphite500,
                      alignment: 'center',
                      letterSpacing: 1,
                      margin: [0, 0, 0, 15]
                    }
                  ],
                  fillColor: LuxColors.sapphireLight,
                  border: [false, false, false, false]
                }]]
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0
              }
            }
          ]
        },
        { width: '2%', text: '' }, // Spacer

        // Metric Card 2: Actions
        {
          width: '23%',
          stack: [
            {
              table: {
                widths: ['*'],
                body: [[{
                  stack: [
                    {
                      text: immediateActions.toString(),
                      fontSize: 36,
                      bold: true,
                      color: LuxColors.garnet,
                      alignment: 'center',
                      margin: [0, 15, 0, 5]
                    },
                    {
                      text: 'PRIORITY ACTIONS',
                      fontSize: 9,
                      color: LuxColors.graphite500,
                      alignment: 'center',
                      letterSpacing: 1,
                      margin: [0, 0, 0, 15]
                    }
                  ],
                  fillColor: LuxColors.garnetLight,
                  border: [false, false, false, false]
                }]]
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0
              }
            }
          ]
        },
        { width: '2%', text: '' }, // Spacer

        // Metric Card 3: Opportunities
        {
          width: '23%',
          stack: [
            {
              table: {
                widths: ['*'],
                body: [[{
                  stack: [
                    {
                      text: opportunities.toString(),
                      fontSize: 36,
                      bold: true,
                      color: LuxColors.emerald,
                      alignment: 'center',
                      margin: [0, 15, 0, 5]
                    },
                    {
                      text: 'OPPORTUNITIES',
                      fontSize: 9,
                      color: LuxColors.graphite500,
                      alignment: 'center',
                      letterSpacing: 1,
                      margin: [0, 0, 0, 15]
                    }
                  ],
                  fillColor: LuxColors.emeraldLight,
                  border: [false, false, false, false]
                }]]
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0
              }
            }
          ]
        },
        { width: '2%', text: '' }, // Spacer

        // Metric Card 4: Phases
        {
          width: '23%',
          stack: [
            {
              table: {
                widths: ['*'],
                body: [[{
                  stack: [
                    {
                      text: roadmapPhases.toString(),
                      fontSize: 36,
                      bold: true,
                      color: LuxColors.amber,
                      alignment: 'center',
                      margin: [0, 15, 0, 5]
                    },
                    {
                      text: 'ROADMAP PHASES',
                      fontSize: 9,
                      color: LuxColors.graphite500,
                      alignment: 'center',
                      letterSpacing: 1,
                      margin: [0, 0, 0, 15]
                    }
                  ],
                  fillColor: LuxColors.amberLight,
                  border: [false, false, false, false]
                }]]
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0
              }
            }
          ]
        }
      ],
      columnGap: 0,
      margin: [0, 0, 0, 30]
    },

    // Executive Summary - Premium highlight box
    {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              text: 'EXECUTIVE SUMMARY',
              fontSize: 11,
              bold: true,
              color: LuxColors.graphite700,
              letterSpacing: 1,
              margin: [0, 0, 0, 12]
            },
            {
              text: insights.executiveSummary || 'This comprehensive strategic analysis identifies key opportunities for optimization and growth. Our AI-powered analysis reveals priority initiatives that will drive meaningful impact and sustainable value creation across your project lifecycle.',
              fontSize: 12,
              color: LuxColors.graphite800,
              lineHeight: 1.6,
              margin: [0, 0, 0, 15]
            },
            {
              columns: [
                {
                  width: 'auto',
                  text: '📅',
                  fontSize: 10,
                  margin: [0, 2, 8, 0]
                },
                {
                  width: '*',
                  text: `Generated: ${new Date().toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}`,
                  fontSize: 9,
                  color: LuxColors.graphite500
                }
              ]
            }
          ],
          fillColor: LuxColors.graphite100,
          margin: [24, 20, 24, 20]
        }]]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0
      },
      margin: [0, 0, 0, 40]
    }
  ]
}

/**
 * Create visual insight cards with impact indicators
 */
function createInsightCards(insights: InsightItem[]): any[] {
  return insights.map((insight, index) => {
    // Determine impact level and color
    const impactText = insight.impact?.toLowerCase() || ''
    const isHighImpact = impactText.includes('high') || impactText.includes('critical')
    const isLowImpact = impactText.includes('low') || impactText.includes('minor')

    const accentColor = isHighImpact ? LuxColors.garnet :
                       isLowImpact ? LuxColors.emerald :
                       LuxColors.sapphire

    return {
      table: {
        widths: [6, '*'],
        body: [[
          // Accent stripe
          {
            text: '',
            fillColor: accentColor,
            border: [false, false, false, false]
          },
          // Content
          {
            stack: [
              {
                columns: [
                  {
                    width: '*',
                    text: insight.insight || `Strategic Insight ${index + 1}`,
                    fontSize: 13,
                    bold: true,
                    color: LuxColors.graphite800,
                    margin: [0, 0, 0, 8]
                  },
                  {
                    width: 'auto',
                    text: `#${index + 1}`,
                    fontSize: 10,
                    bold: true,
                    color: LuxColors.graphite400,
                    alignment: 'right'
                  }
                ]
              },
              {
                text: insight.impact || 'Significant strategic implications for project success.',
                fontSize: 11,
                color: LuxColors.graphite600,
                lineHeight: 1.5,
                margin: [0, 0, 0, 10]
              },
              {
                columns: [
                  {
                    width: 'auto',
                    text: '◆',
                    fontSize: 8,
                    color: accentColor,
                    margin: [0, 2, 6, 0]
                  },
                  {
                    width: '*',
                    text: isHighImpact ? 'HIGH IMPACT' : isLowImpact ? 'LOW IMPACT' : 'MEDIUM IMPACT',
                    fontSize: 8,
                    bold: true,
                    color: accentColor,
                    letterSpacing: 0.5
                  }
                ]
              }
            ],
            fillColor: LuxColors.surface,
            margin: [20, 16, 20, 16]
          }
        ]]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => LuxColors.hairline,
        vLineColor: () => LuxColors.hairline
      },
      margin: [0, 0, 0, 12],
      unbreakable: true // Prevent page breaks within cards
    }
  })
}

/**
 * Create roadmap phase cards
 */
function createRoadmapPhases(phases: RoadmapPhase[]): any[] {
  const phaseColors = [
    LuxColors.sapphire,
    LuxColors.emerald,
    LuxColors.amber,
    LuxColors.garnet
  ]

  return phases.map((phase, index) => {
    const color = phaseColors[index % phaseColors.length]

    return {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              columns: [
                {
                  width: 60,
                  stack: [
                    {
                      text: `PHASE ${index + 1}`,
                      fontSize: 8,
                      bold: true,
                      color: LuxColors.graphite500,
                      letterSpacing: 0.5,
                      margin: [0, 0, 0, 4]
                    },
                    {
                      canvas: [{
                        type: 'rect',
                        x: 0,
                        y: 0,
                        w: 50,
                        h: 4,
                        color: color
                      }],
                      margin: [0, 0, 0, 0]
                    }
                  ]
                },
                {
                  width: '*',
                  text: phase.phase || `Implementation Phase ${index + 1}`,
                  fontSize: 14,
                  bold: true,
                  color: LuxColors.graphite800,
                  margin: [12, 0, 0, 0]
                }
              ],
              margin: [0, 0, 0, 12]
            },
            {
              text: `Focus: ${phase.focus || 'Strategic implementation focus'}`,
              fontSize: 11,
              color: LuxColors.graphite700,
              margin: [0, 0, 0, 8]
            },
            {
              text: `Duration: ${phase.duration || 'TBD'}`,
              fontSize: 10,
              color: LuxColors.graphite500,
              margin: [0, 0, 0, 12]
            },
            ...(phase.ideas && phase.ideas.length > 0 ? [{
              text: 'KEY INITIATIVES',
              fontSize: 9,
              bold: true,
              color: LuxColors.graphite600,
              letterSpacing: 0.5,
              margin: [0, 0, 0, 6]
            }, {
              ul: phase.ideas.map(idea => ({
                text: idea,
                fontSize: 10,
                color: LuxColors.graphite600
              })),
              margin: [0, 0, 0, 0]
            }] : [])
          ],
          fillColor: LuxColors.surface,
          margin: [20, 18, 20, 18]
        }]]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => LuxColors.hairline,
        vLineColor: () => LuxColors.hairline
      },
      margin: [0, 0, 0, 16],
      unbreakable: true // Prevent page breaks within phase cards
    }
  })
}

/**
 * Create priority recommendations with visual timeline
 */
function createPrioritySection(recommendations: PriorityRecommendations): any[] {
  const sections: any[] = []

  if (recommendations.immediate && recommendations.immediate.length > 0) {
    sections.push({
      columns: [
        {
          width: 6,
          canvas: [{
            type: 'rect',
            x: 0,
            y: 0,
            w: 6,
            h: 60,
            color: LuxColors.garnet
          }]
        },
        {
          width: '*',
          stack: [
            {
              text: 'IMMEDIATE ACTIONS',
              fontSize: 10,
              bold: true,
              color: LuxColors.garnet,
              letterSpacing: 0.5,
              margin: [12, 0, 0, 6]
            },
            {
              text: '0-30 days',
              fontSize: 9,
              color: LuxColors.graphite500,
              margin: [12, 0, 0, 10]
            },
            {
              ul: recommendations.immediate.map(item => ({
                text: item,
                fontSize: 10,
                color: LuxColors.graphite700
              })),
              margin: [12, 0, 0, 0]
            }
          ]
        }
      ],
      margin: [0, 0, 0, 16],
      unbreakable: true // Keep priority sections together
    })
  }

  if (recommendations.shortTerm && recommendations.shortTerm.length > 0) {
    sections.push({
      columns: [
        {
          width: 6,
          canvas: [{
            type: 'rect',
            x: 0,
            y: 0,
            w: 6,
            h: 60,
            color: LuxColors.amber
          }]
        },
        {
          width: '*',
          stack: [
            {
              text: 'SHORT-TERM INITIATIVES',
              fontSize: 10,
              bold: true,
              color: LuxColors.amber,
              letterSpacing: 0.5,
              margin: [12, 0, 0, 6]
            },
            {
              text: '1-6 months',
              fontSize: 9,
              color: LuxColors.graphite500,
              margin: [12, 0, 0, 10]
            },
            {
              ul: recommendations.shortTerm.map(item => ({
                text: item,
                fontSize: 10,
                color: LuxColors.graphite700
              })),
              margin: [12, 0, 0, 0]
            }
          ]
        }
      ],
      margin: [0, 0, 0, 16],
      unbreakable: true // Keep priority sections together
    })
  }

  if (recommendations.longTerm && recommendations.longTerm.length > 0) {
    sections.push({
      columns: [
        {
          width: 6,
          canvas: [{
            type: 'rect',
            x: 0,
            y: 0,
            w: 6,
            h: 60,
            color: LuxColors.emerald
          }]
        },
        {
          width: '*',
          stack: [
            {
              text: 'LONG-TERM GOALS',
              fontSize: 10,
              bold: true,
              color: LuxColors.emerald,
              letterSpacing: 0.5,
              margin: [12, 0, 0, 6]
            },
            {
              text: '6+ months',
              fontSize: 9,
              color: LuxColors.graphite500,
              margin: [12, 0, 0, 10]
            },
            {
              ul: recommendations.longTerm.map(item => ({
                text: item,
                fontSize: 10,
                color: LuxColors.graphite700
              })),
              margin: [12, 0, 0, 0]
            }
          ]
        }
      ],
      margin: [0, 0, 0, 16],
      unbreakable: true // Keep priority sections together
    })
  }

  return sections
}

/**
 * Generate premium graphical insights PDF
 */
export async function exportGraphicalInsightsToPDF(
  insights: InsightsReport,
  projectName?: string
): Promise<void> {
  try {
    insightsLogger.info('Generating graphical insights PDF', { projectName })

    const pdfMakeInstance = await loadPdfMake()

    const content: any[] = [
      // Graphical header with metrics dashboard
      ...createGraphicalHeader(projectName || 'Project Insights', insights),

      // Key Insights section
      ...(insights.keyInsights && insights.keyInsights.length > 0 ? [
        {
          text: 'Key Strategic Insights',
          fontSize: 24,
          bold: true,
          color: LuxColors.graphite800,
          margin: [0, 20, 0, 12]
        },
        ...createInsightCards(insights.keyInsights)
      ] : []),

      // Roadmap section
      ...(insights.suggestedRoadmap && insights.suggestedRoadmap.length > 0 ? [
        { text: '', pageBreak: 'before' },
        {
          text: 'Implementation Roadmap',
          fontSize: 24,
          bold: true,
          color: LuxColors.graphite800,
          margin: [0, 20, 0, 12]
        },
        ...createRoadmapPhases(insights.suggestedRoadmap)
      ] : []),

      // Priority recommendations
      ...(insights.priorityRecommendations ? [
        { text: '', pageBreak: 'before' },
        {
          text: 'Priority Recommendations',
          fontSize: 24,
          bold: true,
          color: LuxColors.graphite800,
          margin: [0, 20, 0, 12]
        },
        ...createPrioritySection(insights.priorityRecommendations)
      ] : []),

      // Risk assessment
      ...(insights.riskAssessment ? [
        {
          text: 'Risk Assessment & Opportunities',
          fontSize: 24,
          bold: true,
          color: LuxColors.graphite800,
          margin: [0, 30, 0, 12]
        },
        ...(insights.riskAssessment.highRisk && insights.riskAssessment.highRisk.length > 0 ? [{
          columns: [
            {
              width: 6,
              canvas: [{
                type: 'rect',
                x: 0,
                y: 0,
                w: 6,
                h: 60,
                color: LuxColors.garnet
              }]
            },
            {
              width: '*',
              stack: [
                {
                  text: 'RISK FACTORS',
                  fontSize: 10,
                  bold: true,
                  color: LuxColors.garnet,
                  letterSpacing: 0.5,
                  margin: [12, 0, 0, 10]
                },
                {
                  ul: insights.riskAssessment.highRisk.map(risk => ({
                    text: risk,
                    fontSize: 10,
                    color: LuxColors.graphite700
                  })),
                  margin: [12, 0, 0, 0]
                }
              ]
            }
          ],
          margin: [0, 0, 0, 16]
        }] : []),
        ...(insights.riskAssessment.opportunities && insights.riskAssessment.opportunities.length > 0 ? [{
          columns: [
            {
              width: 6,
              canvas: [{
                type: 'rect',
                x: 0,
                y: 0,
                w: 6,
                h: 60,
                color: LuxColors.emerald
              }]
            },
            {
              width: '*',
              stack: [
                {
                  text: 'STRATEGIC OPPORTUNITIES',
                  fontSize: 10,
                  bold: true,
                  color: LuxColors.emerald,
                  letterSpacing: 0.5,
                  margin: [12, 0, 0, 10]
                },
                {
                  ul: insights.riskAssessment.opportunities.map(opp => ({
                    text: opp,
                    fontSize: 10,
                    color: LuxColors.graphite700
                  })),
                  margin: [12, 0, 0, 0]
                }
              ]
            }
          ],
          margin: [0, 0, 0, 16]
        }] : [])
      ] : []),

      // Next steps
      ...(insights.nextSteps && insights.nextSteps.length > 0 ? [
        {
          text: 'Next Steps',
          fontSize: 24,
          bold: true,
          color: LuxColors.graphite800,
          margin: [0, 30, 0, 12]
        },
        {
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                {
                  text: 'RECOMMENDED ACTIONS',
                  fontSize: 9,
                  bold: true,
                  color: LuxColors.graphite600,
                  letterSpacing: 0.5,
                  margin: [0, 0, 0, 12]
                },
                {
                  ol: insights.nextSteps.map(step => ({
                    text: step,
                    fontSize: 11,
                    color: LuxColors.graphite700,
                    margin: [0, 0, 0, 8]
                  }))
                }
              ],
              fillColor: LuxColors.graphite100,
              margin: [20, 16, 20, 16]
            }]]
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0
          }
        }
      ] : [])
    ]

    const documentDefinition: any = {
      pageSize: 'A4',
      pageMargins: [50, 60, 50, 70],

      content,

      // Premium footer
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            width: '*',
            text: 'Prioritas Strategic Insights',
            fontSize: 8,
            color: LuxColors.graphite400
          },
          {
            width: 'auto',
            text: `${currentPage} / ${pageCount}`,
            fontSize: 8,
            color: LuxColors.graphite400,
            alignment: 'right'
          }
        ],
        margin: [50, 20, 50, 0]
      }),

      defaultStyle: {
        fontSize: 11,
        color: LuxColors.graphite700
      }
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const cleanName = projectName
      ?.replace(/[^a-zA-Z0-9\s]/g, '')
      ?.replace(/\s+/g, '_')
      ?.substring(0, 30) || 'Project'
    const fileName = `${cleanName}_Insights_Premium_${timestamp}.pdf`

    pdfMakeInstance.createPdf(documentDefinition).download(fileName)

    insightsLogger.info('Graphical insights PDF generated successfully', { fileName })
  } catch (_error) {
    insightsLogger.error('Failed to generate graphical insights PDF', error)
    throw error
  }
}
