/**
 * Roadmap PDF Generator
 * Generates comprehensive project roadmap PDFs with timeline visualization
 *
 * This module provides functionality to export roadmap data into professionally
 * formatted PDF documents with:
 * - Executive summary and project overview
 * - Detailed implementation phases with epics and deliverables
 * - Resource requirements and team structure
 * - Quality assurance and testing strategy
 * - Visual timeline roadmap with team-based features
 *
 * @module RoadmapPdfGenerator
 */

import jsPDF from 'jspdf'
import { Project, RoadmapData } from '../../../types'
import { PdfColors, PdfLayout, PdfDefaults, PdfTypography } from '../config/PdfStyles'
import {
  addPageBreak,
  addText,
  addMainHeader,
  addSectionHeader,
  addTable,
  addSectionDivider,
  PageBreakConfig,
  TextOptions,
  HeaderOptions
} from '../helpers/JsPdfHelpers'
import { logger } from '../../logging'

const roadmapLogger = logger.withContext({ component: 'RoadmapPdfGenerator' })

/**
 * Team assignment for timeline visualization
 */
type TeamId = 'web' | 'mobile' | 'marketing' | 'platform'

/**
 * Feature priority level
 */
type PriorityLevel = 'high' | 'medium' | 'low'

/**
 * Feature status
 */
type FeatureStatus = 'in-progress' | 'planned'

/**
 * Timeline feature representation
 */
interface TimelineFeature {
  id: string
  title: string
  description: string
  startMonth: number
  duration: number
  team: TeamId
  priority: PriorityLevel
  status: FeatureStatus
}

/**
 * Team configuration for timeline visualization
 */
interface TeamConfig {
  id: TeamId
  name: string
  color: readonly [number, number, number]
}

/**
 * Export roadmap data to a comprehensive PDF document
 *
 * @param roadmapData - The roadmap data to export
 * @param ideaCount - Number of ideas analyzed
 * @param project - Optional project information
 * @throws {Error} If PDF generation fails
 */
export function exportRoadmapToPDF(
  roadmapData: RoadmapData,
  ideaCount: number,
  project: Project | null = null
): void {
  try {
    roadmapLogger.info('Generating roadmap PDF', {
      phaseCount: roadmapData.roadmapAnalysis?.phases?.length,
      ideaCount,
      projectName: project?.name
    })

    // Initialize PDF document in landscape orientation
    const doc = new jsPDF(
      PdfDefaults.page.orientationLandscape,
      PdfDefaults.units.points,
      PdfDefaults.page.size
    )

    let yPos: number = PdfLayout.margins.landscape.top
    const pageH = doc.internal.pageSize.height
    const pageW = doc.internal.pageSize.width
    const marginL = PdfLayout.margins.landscape.left
    const marginR = PdfLayout.margins.landscape.right
    const contentW = pageW - marginL - marginR

    // Page break configuration
    const pageBreakConfig: PageBreakConfig = {
      pageHeight: pageH as number,
      bottomMargin: PdfLayout.margins.landscape.bottom as number,
      resetYPosition: PdfLayout.margins.landscape.top as number
    }

    // Common text options
    const commonTextOpts: TextOptions = {
      marginLeft: marginL,
      contentWidth: contentW
    }

    // Common header options
    const commonHeaderOpts: HeaderOptions = {
      marginLeft: marginL,
      contentWidth: contentW
    }

    // DOCUMENT HEADER
    doc.setFontSize(PdfTypography.sizes.h1)
    doc.setFont(PdfTypography.fonts.primary, PdfTypography.weights.bold)
    const title = project ? `${project.name} - Complete Project Roadmap` : 'Complete Project Roadmap'
    doc.text(title, marginL, yPos)
    yPos += 10

    // Subtitle
    doc.setFontSize(PdfTypography.sizes.h2Small)
    doc.setFont(PdfTypography.fonts.primary, PdfTypography.weights.italic)
    doc.setTextColor(...PdfColors.base.darkGray)
    doc.text('Technical & Business Implementation Guide', marginL, yPos)
    doc.setTextColor(...PdfColors.base.blackRgb)
    yPos += 15

    // Project description
    if (project?.description) {
      const result = addText(doc, `Project Description: ${project.description}`, yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodyMedium
      })
      yPos = result.newYPos + 5
    }

    // Project Overview
    const overviewResult1 = addText(doc, `Comprehensive Analysis: ${ideaCount} ideas analyzed`, yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = overviewResult1.newYPos

    const currentDate = new Date()
    const overviewResult2 = addText(
      doc,
      `Generated: ${currentDate.toLocaleDateString()} at ${currentDate.toLocaleTimeString()}`,
      yPos,
      { ...commonTextOpts, fontSize: PdfTypography.sizes.bodySmall }
    )
    yPos = overviewResult2.newYPos

    const overviewResult3 = addText(
      doc,
      `Total Duration: ${roadmapData.roadmapAnalysis?.totalDuration || 'To be determined'}`,
      yPos,
      { ...commonTextOpts, fontSize: PdfTypography.sizes.bodyMedium, fontStyle: PdfTypography.weights.bold }
    )
    yPos = overviewResult3.newYPos

    const overviewResult4 = addText(
      doc,
      `Methodology: ${roadmapData.executionStrategy?.methodology || 'Agile Development'}`,
      yPos,
      { ...commonTextOpts, fontSize: PdfTypography.sizes.bodyMedium, fontStyle: PdfTypography.weights.bold }
    )
    yPos = overviewResult4.newYPos

    const overviewResult5 = addText(
      doc,
      `Sprint Length: ${roadmapData.executionStrategy?.sprintLength || '2 weeks'}`,
      yPos,
      { ...commonTextOpts, fontSize: PdfTypography.sizes.bodyMedium, fontStyle: PdfTypography.weights.bold }
    )
    yPos = overviewResult5.newYPos + 10

    // TABLE OF CONTENTS
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addMainHeader(doc, 'TABLE OF CONTENTS', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.main] as [number, number, number]
    })

    const tocItems = [
      '1. Executive Summary',
      '2. Technical Requirements & Architecture',
      '3. Implementation Phases (Detailed)',
      '4. Resource Requirements & Team Structure',
      '5. Quality Assurance & Testing Strategy',
      '6. Deployment & Operations Plan',
      '7. Success Metrics & KPIs'
    ]

    tocItems.forEach(item => {
      const result = addText(doc, item, yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodyMedium
      })
      yPos = result.newYPos
    })

    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      lineWidth: PdfLayout.dimensions.dividerWidth,
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })

    // 1. EXECUTIVE SUMMARY
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addSectionHeader(doc, '1. EXECUTIVE SUMMARY', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.section] as [number, number, number]
    })

    const teamRec = roadmapData.executionStrategy?.teamRecommendations ||
      'Team structure to be determined based on project requirements'

    const overviewHeader = addText(doc, 'Project Overview:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = overviewHeader.newYPos

    const teamRecResult = addText(doc, teamRec, yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.bodySmall
    })
    yPos = teamRecResult.newYPos + 8

    // Calculate deliverables summary
    const phases = roadmapData.roadmapAnalysis?.phases || []
    let totalEpics = 0
    let totalDeliverables = 0
    phases.forEach(phase => {
      if (phase.epics) {
        totalEpics += phase.epics.length
        phase.epics.forEach(epic => {
          if (epic.deliverables) totalDeliverables += epic.deliverables.length
        })
      }
    })

    const deliverablesHeader = addText(doc, 'Key Deliverables:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = deliverablesHeader.newYPos

    // Create summary table for key deliverables
    yPos = addPageBreak(doc, yPos, 100, pageBreakConfig)
    const summaryResult = addTable(doc, yPos, {
      headers: ['Metric', 'Count', 'Description'],
      rows: [
        ['Development Phases', phases.length.toString(), 'Major implementation stages'],
        ['Epic Features', totalEpics.toString(), 'Key functional areas'],
        ['Deliverables', totalDeliverables.toString(), 'Specific outputs and artifacts']
      ],
      cellWidths: [180, 100, 300],
      marginLeft: marginL,
      totalWidth: contentW - 40
    })
    yPos = summaryResult.newYPos

    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })

    // 2. TECHNICAL REQUIREMENTS
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addSectionHeader(doc, '2. TECHNICAL REQUIREMENTS & ARCHITECTURE', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.section] as [number, number, number]
    })

    const techStackHeader = addText(doc, 'Development Stack & Technologies:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = techStackHeader.newYPos

    const techStackItems = [
      '• Frontend: React.js, TypeScript, Tailwind CSS',
      '• Backend: Node.js/Express or similar',
      '• Database: PostgreSQL/MongoDB',
      '• Authentication: JWT/OAuth',
      '• Deployment: Docker containers, Cloud hosting',
      '• Version Control: Git with feature branch workflow'
    ]

    techStackItems.forEach(item => {
      const result = addText(doc, item, yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodySmall
      })
      yPos = result.newYPos
    })
    yPos += 8

    const archHeader = addText(doc, 'Architecture Considerations:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = archHeader.newYPos

    const archItems = [
      '• Microservices vs Monolithic architecture decision needed',
      '• API design following RESTful principles',
      '• Database normalization and indexing strategy',
      '• Caching layer for performance optimization',
      '• Security implementation (HTTPS, data encryption)'
    ]

    archItems.forEach(item => {
      const result = addText(doc, item, yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodySmall
      })
      yPos = result.newYPos
    })

    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })

    // 3. DETAILED IMPLEMENTATION PHASES
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addSectionHeader(doc, '3. IMPLEMENTATION PHASES (DETAILED)', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.section] as [number, number, number]
    })

    phases.forEach((phase, phaseIndex) => {
      if (!phase) return

      const phaseName = getPhaseDisplayName(phase, phaseIndex)

      yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)

      // Phase Header
      yPos = addMainHeader(doc, `PHASE ${phaseIndex + 1}: ${phaseName.toUpperCase()}`, yPos, {
        ...commonHeaderOpts,
        fontSize: PdfTypography.sizes.h2Small,
        backgroundColor: [...PdfColors.headers.main] as [number, number, number]
      })

      // Phase info table
      yPos = addPageBreak(doc, yPos, 80, pageBreakConfig)
      const phaseInfoResult = addTable(doc, yPos, {
        headers: ['Attribute', 'Details'],
        rows: [
          ['Duration', phase.duration || 'To be determined'],
          ['Priority', 'HIGH'],
          ['Status', 'Planning Phase'],
          ['Dependencies', phaseIndex === 0 ? 'None - Foundation Phase' : `Phase ${phaseIndex} Completion`]
        ],
        cellWidths: [120, 460],
        marginLeft: marginL,
        totalWidth: contentW - 40
      })
      yPos = phaseInfoResult.newYPos

      // Phase Description
      const descHeader = addText(doc, 'Business Objective:', yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodyMedium,
        fontStyle: PdfTypography.weights.bold
      })
      yPos = descHeader.newYPos

      const descResult = addText(
        doc,
        phase.description || 'Objective to be defined in project kickoff',
        yPos,
        { ...commonTextOpts, fontSize: PdfTypography.sizes.bodySmall }
      )
      yPos = descResult.newYPos + 8

      // Technical Requirements for Phase
      const techReqHeader = addText(doc, 'Technical Requirements:', yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodyMedium,
        fontStyle: PdfTypography.weights.bold
      })
      yPos = techReqHeader.newYPos

      if (phase.epics && phase.epics.length > 0) {
        phase.epics.forEach((epic, epicIndex) => {
          if (!epic) return

          yPos = addPageBreak(doc, yPos, 35, pageBreakConfig)

          // Epic Header
          const epicTitle = addText(
            doc,
            `Epic ${epicIndex + 1}: ${epic.title || 'Untitled Epic'}`,
            yPos,
            {
              ...commonTextOpts,
              fontSize: PdfTypography.sizes.body,
              fontStyle: PdfTypography.weights.bold,
              color: [...PdfColors.headers.epic] as [number, number, number]
            }
          )
          yPos = epicTitle.newYPos

          const epicMeta = addText(
            doc,
            `Priority: ${epic.priority || 'Medium'} | Complexity: ${epic.complexity || 'Medium'}`,
            yPos,
            {
              ...commonTextOpts,
              fontSize: PdfTypography.sizes.bodySmall,
              fontStyle: PdfTypography.weights.italic
            }
          )
          yPos = epicMeta.newYPos + 3

          // Epic Description
          if (epic.description) {
            const epicDescHeader = addText(doc, 'Description:', yPos, {
              ...commonTextOpts,
              fontSize: PdfTypography.sizes.bodySmall,
              fontStyle: PdfTypography.weights.bold
            })
            yPos = epicDescHeader.newYPos

            const epicDescResult = addText(doc, epic.description, yPos, {
              ...commonTextOpts,
              fontSize: PdfTypography.sizes.bodySmall
            })
            yPos = epicDescResult.newYPos
          }

          // User Stories
          if (epic.userStories && epic.userStories.length > 0) {
            yPos = addPageBreak(doc, yPos, 15, pageBreakConfig)
            const storiesHeader = addText(
              doc,
              'User Stories (Business Requirements):',
              yPos,
              {
                ...commonTextOpts,
                fontSize: PdfTypography.sizes.bodySmall,
                fontStyle: PdfTypography.weights.bold,
                color: [...PdfColors.headers.userStory] as [number, number, number]
              }
            )
            yPos = storiesHeader.newYPos

            epic.userStories.forEach((story, storyIndex) => {
              const storyResult = addText(doc, `${storyIndex + 1}. ${story}`, yPos, {
                ...commonTextOpts,
                fontSize: PdfTypography.sizes.bodyTiny
              })
              yPos = storyResult.newYPos
            })
            yPos += 3
          }

          // Technical Deliverables
          if (epic.deliverables && epic.deliverables.length > 0) {
            yPos = addPageBreak(doc, yPos, 15, pageBreakConfig)
            const delHeader = addText(doc, 'Technical Deliverables:', yPos, {
              ...commonTextOpts,
              fontSize: PdfTypography.sizes.bodySmall,
              fontStyle: PdfTypography.weights.bold,
              color: [...PdfColors.headers.deliverable] as [number, number, number]
            })
            yPos = delHeader.newYPos

            epic.deliverables.forEach((deliverable, delIndex) => {
              const delResult = addText(doc, `${delIndex + 1}. ${deliverable}`, yPos, {
                ...commonTextOpts,
                fontSize: PdfTypography.sizes.bodyTiny
              })
              yPos = delResult.newYPos
            })
            yPos += 3
          }

          // Related Ideas
          if (epic.relatedIdeas && epic.relatedIdeas.length > 0) {
            yPos = addPageBreak(doc, yPos, 10, pageBreakConfig)
            const relHeader = addText(doc, 'Related Requirements:', yPos, {
              ...commonTextOpts,
              fontSize: PdfTypography.sizes.bodySmall,
              fontStyle: PdfTypography.weights.bold
            })
            yPos = relHeader.newYPos

            epic.relatedIdeas.forEach((idea) => {
              const ideaResult = addText(doc, `• ${idea}`, yPos, {
                ...commonTextOpts,
                fontSize: PdfTypography.sizes.bodyTiny
              })
              yPos = ideaResult.newYPos
            })
            yPos += 3
          }

          yPos += 8
        })
      } else {
        const placeholderItems = [
          '• Technical specifications to be defined during planning phase',
          '• Architecture decisions pending stakeholder review',
          '• Integration requirements need assessment'
        ]
        placeholderItems.forEach(item => {
          const result = addText(doc, item, yPos, {
            ...commonTextOpts,
            fontSize: PdfTypography.sizes.bodySmall
          })
          yPos = result.newYPos
        })
        yPos += 8
      }

      // Risk Assessment for Phase
      if (phase.risks && phase.risks.length > 0) {
        yPos = addPageBreak(doc, yPos, 20, pageBreakConfig)
        const riskHeader = addText(doc, 'Risk Assessment & Mitigation:', yPos, {
          ...commonTextOpts,
          fontSize: PdfTypography.sizes.bodyMedium,
          fontStyle: PdfTypography.weights.bold,
          color: [...PdfColors.headers.risk] as [number, number, number]
        })
        yPos = riskHeader.newYPos

        phase.risks.forEach((risk, riskIndex) => {
          const riskResult = addText(doc, `Risk ${riskIndex + 1}: ${risk}`, yPos, {
            ...commonTextOpts,
            fontSize: PdfTypography.sizes.bodySmall
          })
          yPos = riskResult.newYPos
        })
        yPos += 5
      }

      // Success Criteria
      if (phase.successCriteria && phase.successCriteria.length > 0) {
        yPos = addPageBreak(doc, yPos, 20, pageBreakConfig)
        const successHeader = addText(doc, 'Success Criteria & Acceptance:', yPos, {
          ...commonTextOpts,
          fontSize: PdfTypography.sizes.bodyMedium,
          fontStyle: PdfTypography.weights.bold,
          color: [...PdfColors.headers.userStory] as [number, number, number]
        })
        yPos = successHeader.newYPos

        phase.successCriteria.forEach((criteria) => {
          const criteriaResult = addText(doc, `✓ ${criteria}`, yPos, {
            ...commonTextOpts,
            fontSize: PdfTypography.sizes.bodySmall
          })
          yPos = criteriaResult.newYPos
        })
      }

      // Phase Dependencies
      const depsHeader = addText(doc, 'Dependencies & Prerequisites:', yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodyMedium,
        fontStyle: PdfTypography.weights.bold
      })
      yPos = depsHeader.newYPos

      const depsItems = phaseIndex === 0
        ? [
            '• Project setup and environment configuration',
            '• Team onboarding and access provisioning',
            '• Requirements finalization and sign-off'
          ]
        : [
            `• Successful completion of Phase ${phaseIndex}`,
            '• Code review and quality gate approval',
            '• Stakeholder acceptance of previous deliverables'
          ]

      depsItems.forEach(item => {
        const result = addText(doc, item, yPos, {
          ...commonTextOpts,
          fontSize: PdfTypography.sizes.bodySmall
        })
        yPos = result.newYPos
      })

      yPos += 15
    })

    // 4. RESOURCE REQUIREMENTS
    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addSectionHeader(doc, '4. RESOURCE REQUIREMENTS & TEAM STRUCTURE', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.section] as [number, number, number]
    })

    const teamCompHeader = addText(doc, 'Recommended Team Composition:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = teamCompHeader.newYPos

    // Team composition table
    yPos = addPageBreak(doc, yPos, 150, pageBreakConfig)
    const teamResult = addTable(doc, yPos, {
      headers: ['Role', 'Allocation', 'Key Responsibilities'],
      rows: [
        ['Product Owner', '1 (full-time)', 'Requirements, stakeholder communication'],
        ['Technical Lead', '1 (full-time)', 'Architecture, technical decisions'],
        ['Frontend Developer', '1-2 (full-time)', 'UI/UX implementation, React development'],
        ['Backend Developer', '1-2 (full-time)', 'API development, database design'],
        ['UI/UX Designer', '1 (as needed)', 'Design systems, user experience'],
        ['QA Engineer', '1 (full-time)', 'Testing strategy, quality assurance'],
        ['DevOps Engineer', '1 (part-time)', 'CI/CD, deployment, infrastructure']
      ],
      cellWidths: [140, 120, 320],
      marginLeft: marginL,
      totalWidth: contentW - 40
    })
    yPos = teamResult.newYPos

    const infraHeader = addText(doc, 'Infrastructure & Tools Required:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = infraHeader.newYPos

    const infraItems = [
      '• Development environments (local + staging)',
      '• Version control system (GitHub/GitLab)',
      '• CI/CD pipeline setup',
      '• Project management tools (Jira/Linear)',
      '• Communication tools (Slack/Teams)',
      '• Code review and quality gates'
    ]

    infraItems.forEach(item => {
      const result = addText(doc, item, yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodySmall
      })
      yPos = result.newYPos
    })
    yPos += 10

    // 5. KEY MILESTONES
    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addSectionHeader(doc, '5. KEY MILESTONES & DELIVERABLES', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.section] as [number, number, number]
    })

    const milestones = roadmapData.executionStrategy?.keyMilestones || []
    if (milestones.length > 0) {
      yPos = addPageBreak(doc, yPos, 100, pageBreakConfig)
      const milestoneRows = milestones.map((milestone, msIndex) => {
        const desc = milestone?.description || 'Description to be defined'
        const truncatedDesc = desc.length > 50 ? desc.substring(0, 50) + '...' : desc
        return [
          `M${msIndex + 1}: ${milestone?.milestone || 'TBD'}`,
          milestone?.timeline || 'TBD',
          truncatedDesc
        ]
      })
      const milestoneResult = addTable(doc, yPos, {
        headers: ['Milestone', 'Timeline', 'Description'],
        rows: milestoneRows,
        cellWidths: [160, 120, 300],
        marginLeft: marginL,
        totalWidth: contentW - 40
      })
      yPos = milestoneResult.newYPos
    } else {
      const milestonesHeader = addText(doc, 'Key Milestones (Generated from Phases):', yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.body,
        fontStyle: PdfTypography.weights.bold
      })
      yPos = milestonesHeader.newYPos

      yPos = addPageBreak(doc, yPos, 80, pageBreakConfig)
      const phaseRows = phases.map((phase, pIndex) => [
        `Phase ${pIndex + 1}`,
        `${getPhaseDisplayName(phase, pIndex)} Complete`,
        phase.duration || 'TBD'
      ])
      const phaseResult = addTable(doc, yPos, {
        headers: ['Phase', 'Milestone', 'Duration'],
        rows: phaseRows,
        cellWidths: [80, 380, 120],
        marginLeft: marginL,
        totalWidth: contentW - 40
      })
      yPos = phaseResult.newYPos
    }

    // 6. TESTING & QUALITY ASSURANCE
    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addSectionHeader(doc, '6. QUALITY ASSURANCE & TESTING STRATEGY', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.section] as [number, number, number]
    })

    const testFrameworkHeader = addText(doc, 'Testing Framework Overview:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = testFrameworkHeader.newYPos

    yPos = addPageBreak(doc, yPos, 150, pageBreakConfig)
    const testingResult = addTable(doc, yPos, {
      headers: ['Testing Type', 'Tools/Framework', 'Coverage Target', 'Responsibility'],
      rows: [
        ['Unit Testing', 'Jest/Vitest', '80%+', 'Developers'],
        ['Integration Testing', 'Custom/Supertest', '70%+', 'Developers/QA'],
        ['E2E Testing', 'Cypress/Playwright', 'Critical paths', 'QA Team'],
        ['Performance Testing', 'JMeter/K6', 'Load benchmarks', 'DevOps/QA'],
        ['Security Testing', 'OWASP/Snyk', '100% scan', 'Security Team'],
        ['UAT', 'Manual/TestRail', 'User scenarios', 'Product/Users']
      ],
      cellWidths: [120, 120, 120, 120],
      marginLeft: marginL,
      totalWidth: contentW - 40
    })
    yPos = testingResult.newYPos

    const qualityGatesHeader = addText(doc, 'Quality Gates Checklist:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = qualityGatesHeader.newYPos

    const qualityItems = [
      '✓ Code review approval required for all changes',
      '✓ Minimum 80% test coverage requirement',
      '✓ Performance benchmarks must be met',
      '✓ Security scan clearance required'
    ]

    qualityItems.forEach(item => {
      const result = addText(doc, item, yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodySmall
      })
      yPos = result.newYPos
    })

    // 7. DEPLOYMENT PLAN
    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addSectionHeader(doc, '7. DEPLOYMENT & OPERATIONS PLAN', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.section] as [number, number, number]
    })

    const deployStratHeader = addText(doc, 'Deployment Strategy Overview:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = deployStratHeader.newYPos

    yPos = addPageBreak(doc, yPos, 100, pageBreakConfig)
    const deployResult = addTable(doc, yPos, {
      headers: ['Environment', 'Purpose', 'Deployment Method', 'Approval Required'],
      rows: [
        ['Development', 'Feature development', 'Auto on push', 'Code review'],
        ['Staging', 'Integration testing', 'Manual trigger', 'QA approval'],
        ['Production', 'Live system', 'Blue-Green deploy', 'Product owner']
      ],
      cellWidths: [120, 140, 140, 180],
      marginLeft: marginL,
      totalWidth: contentW - 40
    })
    yPos = deployResult.newYPos

    const opsHeader = addText(doc, 'Operations & Monitoring:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = opsHeader.newYPos

    const opsItems = [
      '• Application performance monitoring (APM)',
      '• Error tracking and logging system',
      '• Automated backup and disaster recovery',
      '• Regular security updates and patches'
    ]

    opsItems.forEach(item => {
      const result = addText(doc, item, yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodySmall
      })
      yPos = result.newYPos
    })

    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })

    // 8. SUCCESS METRICS & KPIS
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addSectionHeader(doc, '8. SUCCESS METRICS & KPIS', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.section] as [number, number, number]
    })

    const kpiHeader = addText(doc, 'Key Performance Indicators Dashboard:', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.body,
      fontStyle: PdfTypography.weights.bold
    })
    yPos = kpiHeader.newYPos

    yPos = addPageBreak(doc, yPos, 150, pageBreakConfig)
    const kpiResult = addTable(doc, yPos, {
      headers: ['Category', 'Metric', 'Target', 'Measurement'],
      rows: [
        ['Delivery', 'On-time delivery', '95%+', 'Sprint completion rate'],
        ['Budget', 'Budget adherence', '±10%', 'Actual vs planned costs'],
        ['Quality', 'Code coverage', '80%+', 'Automated testing reports'],
        ['Performance', 'Load time', '<2 seconds', 'APM monitoring'],
        ['User Adoption', 'Satisfaction score', '4.5/5', 'User surveys'],
        ['Reliability', 'System uptime', '99.9%+', 'Infrastructure monitoring']
      ],
      cellWidths: [100, 140, 100, 240],
      marginLeft: marginL,
      totalWidth: contentW - 40
    })
    yPos = kpiResult.newYPos

    // IMMEDIATE NEXT STEPS
    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addMainHeader(doc, 'IMMEDIATE NEXT STEPS FOR IMPLEMENTATION', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.main] as [number, number, number]
    })

    yPos = addPageBreak(doc, yPos, 100, pageBreakConfig)
    const timelineResult = addTable(doc, yPos, {
      headers: ['Phase', 'Duration', 'Key Activities', 'Deliverables'],
      rows: [
        ['Project Setup', 'Week 1', 'Team assembly, environment setup', 'Dev environment, team structure'],
        ['Planning', 'Week 2', 'Requirements review, design', 'Wireframes, API specs'],
        ['Development', 'Week 3+', 'Sprint execution, testing', 'Working software, documentation']
      ],
      cellWidths: [120, 80, 200, 180],
      marginLeft: marginL,
      totalWidth: contentW - 40
    })
    yPos = timelineResult.newYPos

    const week1Header = addText(doc, 'Week 1: Project Foundation', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.h2Small,
      fontStyle: PdfTypography.weights.bold,
      color: [...PdfColors.headers.userStory] as [number, number, number]
    })
    yPos = week1Header.newYPos

    const week1Items = [
      '✓ Assemble development team and assign roles',
      '✓ Set up development environments and tools',
      '✓ Create project repositories and initial structure',
      '✓ Finalize technical architecture decisions',
      '✓ Establish communication channels and workflows'
    ]

    week1Items.forEach(item => {
      const result = addText(doc, item, yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodySmall
      })
      yPos = result.newYPos
    })

    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })

    const week2Header = addText(doc, 'Week 2: Requirements & Planning', yPos, {
      ...commonTextOpts,
      fontSize: PdfTypography.sizes.h2Small,
      fontStyle: PdfTypography.weights.bold,
      color: [...PdfColors.headers.userStory] as [number, number, number]
    })
    yPos = week2Header.newYPos

    const week2Items = [
      '✓ Review and validate all user stories with stakeholders',
      '✓ Create detailed wireframes and user interface mockups',
      '✓ Define comprehensive API specifications',
      '✓ Establish coding standards, guidelines, and best practices',
      '✓ Set up CI/CD pipeline and deployment processes'
    ]

    week2Items.forEach(item => {
      const result = addText(doc, item, yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodySmall
      })
      yPos = result.newYPos
    })

    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })

    // FINAL READINESS CHECKLIST
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addSectionHeader(doc, 'PROJECT READINESS CHECKLIST', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Small,
      backgroundColor: [...PdfColors.headers.section] as [number, number, number]
    })

    yPos = addPageBreak(doc, yPos, 150, pageBreakConfig)
    const checklistResult = addTable(doc, yPos, {
      headers: ['Category', 'Requirement', 'Status'],
      rows: [
        ['Team', 'Development team assembled', '☐ Pending'],
        ['Requirements', 'Project requirements documented', '☐ Pending'],
        ['Architecture', 'Technical architecture finalized', '☐ Pending'],
        ['Environment', 'Development environment configured', '☐ Pending'],
        ['Process', 'Version control and CI/CD established', '☐ Pending'],
        ['Standards', 'Quality standards defined', '☐ Pending'],
        ['Communication', 'Team channels established', '☐ Pending'],
        ['Planning', 'First sprint planned', '☐ Pending']
      ],
      cellWidths: [120, 360, 100],
      marginLeft: marginL,
      totalWidth: contentW - 40
    })
    yPos = checklistResult.newYPos

    const contactResult = addText(
      doc,
      'For questions or clarification on this roadmap, contact the project team.',
      yPos,
      {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodySmall,
        fontStyle: PdfTypography.weights.italic,
        color: [...PdfColors.base.mediumGray] as [number, number, number]
      }
    )
    yPos = contactResult.newYPos

    addText(
      doc,
      'This document should be reviewed and updated regularly as the project progresses.',
      yPos,
      {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.bodySmall,
        fontStyle: PdfTypography.weights.italic,
        color: [...PdfColors.base.mediumGray] as [number, number, number]
      }
    )

    // ADD TIMELINE VIEW
    yPos = addSectionDivider(doc, yPos, {
      color: [...PdfColors.brand.primaryRgb] as [number, number, number],
      marginLeft: marginL,
      marginRight: marginR,
      pageWidth: pageW
    })
    yPos = addPageBreak(doc, yPos, PdfLayout.spacing.pageBreakThreshold, pageBreakConfig)
    yPos = addMainHeader(doc, 'VISUAL TIMELINE ROADMAP', yPos, {
      ...commonHeaderOpts,
      fontSize: PdfTypography.sizes.h2Medium,
      backgroundColor: [...PdfColors.headers.main] as [number, number, number]
    })

    // Create and render timeline
    const timelineFeatures = createTimelineFeatures(roadmapData)

    if (timelineFeatures.length > 0) {
      yPos = addPageBreak(doc, yPos, pageH, pageBreakConfig)

      const timelineHeaderResult = addText(doc, 'Team-Based Timeline View', yPos, {
        ...commonTextOpts,
        fontSize: PdfTypography.sizes.h2Small,
        fontStyle: PdfTypography.weights.bold
      })
      yPos = timelineHeaderResult.newYPos

      const timelineSubResult = addText(
        doc,
        'Features organized by team with monthly timeline progression',
        yPos,
        { ...commonTextOpts, fontSize: PdfTypography.sizes.bodySmall }
      )
      yPos = timelineSubResult.newYPos + 20

      // Render timeline visualization
      yPos = renderTimeline(doc, yPos, timelineFeatures, marginL, contentW)
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(PdfTypography.sizes.caption)
      doc.setTextColor(...PdfColors.base.mediumGray)
      doc.text(
        `Generated by Prioritas AI • Comprehensive Project Roadmap`,
        marginL,
        pageH - PdfDefaults.footer.marginBottom
      )
      doc.text(
        `Page ${i} of ${totalPages} • ${new Date().toLocaleDateString()}`,
        marginL,
        pageH - PdfDefaults.footer.marginBottomAlt
      )
      doc.text(
        'CONFIDENTIAL - For Internal Use Only',
        pageW - marginR - PdfDefaults.footer.confidentialOffset,
        pageH - PdfDefaults.footer.marginBottomAlt
      )
    }

    // Save the PDF
    const fileName = generateFileName(project)
    doc.save(fileName)

    roadmapLogger.info('Roadmap PDF generated successfully', {
      fileName,
      totalPages,
      phaseCount: phases.length
    })
  } catch (error) {
    roadmapLogger.error('Failed to generate roadmap PDF', error, {
      ideaCount,
      projectName: project?.name
    })
    throw new Error('PDF export failed. Please try again.')
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get display-friendly phase name
 */
function getPhaseDisplayName(phase: any, index: number): string {
  if (phase.phase && phase.phase !== 'Unknown Phase') {
    return phase.phase
  }

  const phaseNames = [
    'Foundation & Core Setup',
    'Feature Development',
    'Enhancement & Optimization',
    'Testing & Deployment',
    'Launch & Maintenance'
  ]

  return phaseNames[index] || `Implementation Phase ${index + 1}`
}

/**
 * Create timeline features from roadmap data
 */
function createTimelineFeatures(roadmapData: RoadmapData): TimelineFeature[] {
  if (!roadmapData?.roadmapAnalysis?.phases) return []

  const features: TimelineFeature[] = []
  let currentMonth = 0

  roadmapData.roadmapAnalysis.phases.forEach((phase, phaseIndex) => {
    const durationText = phase.duration || '1 month'
    const phaseDuration = calculatePhaseDuration(durationText)

    phase.epics?.forEach((epic, epicIndex) => {
      const priority = (epic.priority?.toLowerCase() || 'medium') as PriorityLevel

      features.push({
        id: `${phaseIndex}-${epicIndex}`,
        title: epic.title || `Epic ${epicIndex + 1}`,
        description: epic.description,
        startMonth: currentMonth,
        duration: Math.max(1, Math.floor(phaseDuration / (phase.epics?.length || 1))),
        team: getTeamForEpic(epic),
        priority,
        status: phaseIndex === 0 ? 'in-progress' : 'planned'
      })
    })

    currentMonth += phaseDuration
  })

  return features
}

/**
 * Calculate phase duration in months
 */
function calculatePhaseDuration(durationText: string): number {
  if (durationText.includes('week')) {
    const weeks = parseInt(durationText) || 2
    return Math.ceil(weeks / 4)
  } else if (durationText.includes('month')) {
    return parseInt(durationText) || 1
  }
  return 1
}

/**
 * Determine team assignment based on epic content
 */
function getTeamForEpic(epic: any): TeamId {
  const title = epic.title?.toLowerCase() || ''
  const description = epic.description?.toLowerCase() || ''

  if (title.includes('mobile') || title.includes('app') || description.includes('mobile')) {
    return 'mobile'
  } else if (title.includes('market') || title.includes('analytics') ||
             title.includes('campaign') || description.includes('marketing')) {
    return 'marketing'
  } else if (title.includes('platform') || title.includes('infrastructure') ||
             title.includes('security') || description.includes('backend')) {
    return 'platform'
  } else {
    return 'web'
  }
}

/**
 * Calculate timeline duration with buffer
 */
function calculateTimelineDuration(features: TimelineFeature[]): number {
  if (features.length === 0) {
    return PdfDefaults.timeline.defaultMonths
  }

  const latestEndMonth = Math.max(
    ...features.map(feature => feature.startMonth + feature.duration)
  )

  const timelineLength = latestEndMonth + PdfDefaults.timeline.bufferMonths

  return Math.min(timelineLength, PdfDefaults.timeline.maxMonths)
}

/**
 * Render timeline visualization
 */
function renderTimeline(
  doc: jsPDF,
  yPos: number,
  features: TimelineFeature[],
  marginL: number,
  contentW: number
): number {
  // Define teams and colors
  const teams: TeamConfig[] = [
    { id: 'web', name: 'Web Team', color: PdfColors.teams.web },
    { id: 'mobile', name: 'Mobile Team', color: PdfColors.teams.mobile },
    { id: 'marketing', name: 'Marketing Team', color: PdfColors.teams.marketing },
    { id: 'platform', name: 'Platform Team', color: PdfColors.teams.platform }
  ]

  // Calculate timeline dimensions
  const timelineStartX = marginL + 120
  const timelineWidth = contentW - 140
  const maxMonths = calculateTimelineDuration(features)
  const monthWidth = timelineWidth / maxMonths
  const teamHeight = PdfLayout.dimensions.teamHeight
  const featureHeight = PdfLayout.dimensions.featureHeight

  // Draw month headers
  yPos += PdfLayout.dimensions.monthHeaderOffset
  doc.setFontSize(PdfTypography.sizes.bodySmall)
  doc.setFont(PdfTypography.fonts.primary, PdfTypography.weights.bold)

  for (let month = 0; month < maxMonths; month++) {
    const x = timelineStartX + (month * monthWidth)
    const monthName = new Date(2024, month).toLocaleDateString('en-US', { month: 'short' })
    doc.text(monthName, x + monthWidth / 2 - 10, yPos)
  }
  yPos += 20

  // Draw timeline for each team
  teams.forEach((team, teamIndex) => {
    const teamFeatures = features.filter(f => f.team === team.id)
    const teamY = yPos + (teamIndex * (teamHeight + 20))

    // Team label
    doc.setFillColor(team.color[0], team.color[1], team.color[2])
    doc.rect(marginL, teamY, 110, teamHeight, 'F')
    doc.setTextColor(...PdfColors.base.whiteRgb)
    doc.setFontSize(PdfTypography.sizes.body)
    doc.setFont(PdfTypography.fonts.primary, PdfTypography.weights.bold)
    doc.text(team.name, marginL + 10, teamY + 25)
    doc.setTextColor(...PdfColors.base.blackRgb)

    // Team timeline background
    doc.setFillColor(...PdfColors.backgrounds.lighter)
    doc.rect(timelineStartX, teamY, timelineWidth, teamHeight, 'F')

    // Month grid lines
    doc.setDrawColor(...PdfColors.gray.grid)
    doc.setLineWidth(PdfLayout.dimensions.borderWidth)
    for (let month = 1; month < maxMonths; month++) {
      const x = timelineStartX + (month * monthWidth)
      doc.line(x, teamY, x, teamY + teamHeight)
    }

    // Draw features
    teamFeatures.forEach((feature, featureIndex) => {
      const featureX = timelineStartX + (feature.startMonth * monthWidth)
      const featureWidth = feature.duration * monthWidth - 4
      const featureY = teamY + 8 + (featureIndex * (featureHeight + 2))

      // Feature background color based on priority
      const featureColor = PdfColors.priority[feature.priority] || PdfColors.priority.default

      // Draw feature block
      doc.setFillColor(featureColor[0], featureColor[1], featureColor[2])
      doc.rect(featureX + 2, featureY, Math.max(featureWidth, 20), featureHeight, 'F')

      // Feature text
      doc.setTextColor(...PdfColors.base.whiteRgb)
      doc.setFontSize(PdfTypography.sizes.caption)
      doc.setFont(PdfTypography.fonts.primary, PdfTypography.weights.bold)
      const truncatedTitle = feature.title.length > PdfDefaults.truncation.titleMaxLength
        ? feature.title.substring(0, PdfDefaults.truncation.titleTruncated) + '...'
        : feature.title
      doc.text(truncatedTitle, featureX + 5, featureY + 11)
      doc.setTextColor(...PdfColors.base.blackRgb)
    })
  })

  // Timeline legend
  yPos = yPos + (teams.length * (teamHeight + 20)) + 30

  const legendHeader = addText(doc, 'Timeline Legend:', yPos, {
    fontSize: PdfTypography.sizes.body,
    fontStyle: PdfTypography.weights.bold,
    marginLeft: marginL,
    contentWidth: contentW
  })
  yPos = legendHeader.newYPos + 10

  // Priority legend
  const priorityItems: Array<{ label: string; color: readonly [number, number, number] }> = [
    { label: 'High Priority', color: PdfColors.priority.high },
    { label: 'Medium Priority', color: PdfColors.priority.medium },
    { label: 'Low Priority', color: PdfColors.priority.low }
  ]

  priorityItems.forEach((item, index) => {
    const legendX = marginL + (index * 150)
    doc.setFillColor(item.color[0], item.color[1], item.color[2])
    doc.rect(legendX, yPos, 20, 10, 'F')
    doc.setFontSize(PdfTypography.sizes.bodyTiny)
    doc.text(item.label, legendX + 25, yPos + 8)
  })

  yPos += 20

  const legendItems = [
    '• Each block represents a feature or epic from the roadmap analysis',
    '• Block width indicates duration in months',
    '• Team assignment is based on feature content and keywords'
  ]

  legendItems.forEach(item => {
    const result = addText(doc, item, yPos, {
      fontSize: PdfTypography.sizes.bodyTiny,
      marginLeft: marginL,
      contentWidth: contentW
    })
    yPos = result.newYPos
  })

  return yPos
}

/**
 * Generate filename for roadmap PDF
 */
function generateFileName(project: Project | null): string {
  const date = new Date().toISOString().split('T')[0]

  if (project) {
    const cleanName = project.name
      .replace(/[^a-zA-Z0-9]/g, PdfDefaults.fileNaming.separator)
      .substring(0, PdfDefaults.truncation.projectNameMaxLength)
    return `${cleanName}${PdfDefaults.fileNaming.separator}Complete_Project_Roadmap_${date}.pdf`
  }

  return `Complete_Project_Roadmap_${date}.pdf`
}
