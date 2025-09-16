import jsPDF from 'jspdf'
import { Project, RoadmapData } from '../types'

// Dynamic import for pdfMake to avoid issues
let pdfMake: any = null
let isPdfMakeLoaded = false

const loadPdfMake = async () => {
  if (isPdfMakeLoaded) return pdfMake
  
  try {
    const pdfMakeModule = await import('pdfmake/build/pdfmake')
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts')
    
    pdfMake = pdfMakeModule.default || pdfMakeModule
    const pdfFonts = pdfFontsModule.default || pdfFontsModule
    
    // Configure fonts with proper type handling
    const fonts = pdfFonts as any
    if (fonts && fonts.pdfMake && fonts.pdfMake.vfs) {
      pdfMake.vfs = fonts.pdfMake.vfs
    } else if (fonts && fonts.vfs) {
      pdfMake.vfs = fonts.vfs
    } else {
      // Fallback - try direct assignment
      pdfMake.vfs = fonts
    }
    
    isPdfMakeLoaded = true
    return pdfMake
  } catch (error) {
    console.error('Failed to load pdfMake:', error)
    throw new Error('Failed to load PDF generation library')
  }
}

export const exportRoadmapToPDF = (roadmapData: RoadmapData, ideaCount: number, project: Project | null = null) => {
  try {
    // Create PDF in landscape orientation
    const doc = new jsPDF('landscape', 'pt', 'a4')
    let yPos = 50
    const pageH = doc.internal.pageSize.height
    const pageW = doc.internal.pageSize.width
    const marginL = 40
    const marginR = 40
    const contentW = pageW - marginL - marginR

    // Simple page break function
    const pageBreak = (space: number) => {
      if (yPos + space > pageH - 60) {
        doc.addPage()
        yPos = 50
      }
    }

    // Helper function for wrapped text with proper spacing
    const addText = (text: string, fontSize: number = 12, fontStyle: string = 'normal', color: number[] = [0, 0, 0], lineSpacing: number = 1.4) => {
      pageBreak(fontSize * lineSpacing + 10)
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', fontStyle)
      doc.setTextColor(color[0], color[1], color[2])
      const lines = doc.splitTextToSize(text, contentW - 20)
      doc.text(lines, marginL, yPos)
      yPos += lines.length * (fontSize * lineSpacing) + 8
      return lines.length
    }

    // Helper function for main headers
    const addMainHeader = (text: string, fontSize: number = 18) => {
      pageBreak(60)
      // Background rectangle
      doc.setFillColor(102, 16, 242)
      doc.rect(marginL - 10, yPos - 15, contentW + 20, fontSize + 25, 'F')
      // White text on colored background
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', 'bold')
      doc.text(text, marginL, yPos + fontSize/2)
      doc.setTextColor(0, 0, 0)
      yPos += fontSize + 25
    }

    // Helper function for section headers
    const addSectionHeader = (text: string, fontSize: number = 14, bgColor: number[] = [220, 53, 69]) => {
      pageBreak(40)
      // Background rectangle
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2])
      doc.rect(marginL - 5, yPos - 8, contentW + 10, fontSize + 16, 'F')
      // White text on colored background
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', 'bold')
      doc.text(text, marginL, yPos + fontSize/2)
      doc.setTextColor(0, 0, 0)
      yPos += fontSize + 20
    }


    // Helper function for section dividers
    const addSectionDivider = () => {
      pageBreak(30)
      yPos += 10
      doc.setDrawColor(102, 16, 242)
      doc.setLineWidth(2)
      doc.line(marginL, yPos, pageW - marginR, yPos)
      yPos += 20
    }

    // Helper function for creating beautiful tables
    const addTable = (headers: string[], rows: string[][], cellWidths?: number[]) => {
      const totalWidth = contentW - 40
      const numCols = headers.length
      const defaultCellWidth = totalWidth / numCols
      const widths = cellWidths || new Array(numCols).fill(defaultCellWidth)
      const rowHeight = 25
      
      pageBreak(40 + rows.length * rowHeight)
      
      // Draw header row with gradient
      doc.setFillColor(102, 16, 242)
      doc.rect(marginL, yPos, totalWidth, rowHeight, 'F')
      doc.setDrawColor(102, 16, 242)
      doc.setLineWidth(1)
      doc.rect(marginL, yPos, totalWidth, rowHeight, 'S')
      
      // Header text
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      let currentX = marginL
      headers.forEach((header, i) => {
        const cellWidth = widths[i]
        const textLines = doc.splitTextToSize(header, cellWidth - 10)
        doc.text(textLines, currentX + 5, yPos + 16)
        currentX += cellWidth
      })
      yPos += rowHeight
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
        doc.rect(marginL, yPos, totalWidth, rowHeight, 'F')
        
        // Row border
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.5)
        doc.rect(marginL, yPos, totalWidth, rowHeight, 'S')
        
        // Cell content
        currentX = marginL
        row.forEach((cell, cellIndex) => {
          const cellWidth = widths[cellIndex]
          const textLines = doc.splitTextToSize(cell || '', cellWidth - 10)
          doc.text(textLines.slice(0, 2), currentX + 5, yPos + 14) // Max 2 lines per cell
          currentX += cellWidth
        })
        yPos += rowHeight
      })
      yPos += 15
    }

    // Phase name mapping for better readability
    const getPhaseDisplayName = (phase: any, index: number): string => {
      if (phase.phase && phase.phase !== 'Unknown Phase') {
        return phase.phase
      }
      
      // Generate meaningful phase names based on index and content
      const phaseNames = [
        'Foundation & Core Setup',
        'Feature Development',
        'Enhancement & Optimization',
        'Testing & Deployment',
        'Launch & Maintenance'
      ]
      
      return phaseNames[index] || `Implementation Phase ${index + 1}`
    }

    // DOCUMENT HEADER
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    const title = project ? `${project.name} - Complete Project Roadmap` : 'Complete Project Roadmap'
    doc.text(title, marginL, yPos)
    yPos += 10

    // Subtitle
    doc.setFontSize(14)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(64, 64, 64)
    doc.text('Technical & Business Implementation Guide', marginL, yPos)
    doc.setTextColor(0, 0, 0)
    yPos += 15

    if (project && project.description) {
      addText(`Project Description: ${project.description}`, 11)
      yPos += 5
    }

    // Project Overview
    addText(`Comprehensive Analysis: ${ideaCount} ideas analyzed`, 12, 'bold')
    addText(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 10)
    addText(`Total Duration: ${roadmapData.roadmapAnalysis?.totalDuration || 'To be determined'}`, 11, 'bold')
    addText(`Methodology: ${roadmapData.executionStrategy?.methodology || 'Agile Development'}`, 11, 'bold')
    addText(`Sprint Length: ${roadmapData.executionStrategy?.sprintLength || '2 weeks'}`, 11, 'bold')
    yPos += 10

    // TABLE OF CONTENTS
    addMainHeader('TABLE OF CONTENTS', 16)
    addText('1. Executive Summary', 11)
    addText('2. Technical Requirements & Architecture', 11)
    addText('3. Implementation Phases (Detailed)', 11)
    addText('4. Resource Requirements & Team Structure', 11)
    addText('5. Quality Assurance & Testing Strategy', 11)
    addText('6. Deployment & Operations Plan', 11)
    addText('7. Success Metrics & KPIs', 11)
    addSectionDivider()

    // 1. EXECUTIVE SUMMARY
    addSectionHeader('1. EXECUTIVE SUMMARY', 16)

    const teamRec = roadmapData.executionStrategy?.teamRecommendations || 'Team structure to be determined based on project requirements'
    addText('Project Overview:', 12, 'bold')
    addText(teamRec, 10)
    yPos += 8

    addText('Key Deliverables:', 12, 'bold')
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
    // Create summary table for key deliverables
    const summaryHeaders = ['Metric', 'Count', 'Description']
    const summaryRows = [
      ['Development Phases', phases.length.toString(), 'Major implementation stages'],
      ['Epic Features', totalEpics.toString(), 'Key functional areas'],
      ['Deliverables', totalDeliverables.toString(), 'Specific outputs and artifacts']
    ]
    addTable(summaryHeaders, summaryRows, [180, 100, 300])
    addSectionDivider()

    // 2. TECHNICAL REQUIREMENTS
    addSectionHeader('2. TECHNICAL REQUIREMENTS & ARCHITECTURE', 16)

    addText('Development Stack & Technologies:', 12, 'bold')
    addText('• Frontend: React.js, TypeScript, Tailwind CSS', 10)
    addText('• Backend: Node.js/Express or similar', 10)
    addText('• Database: PostgreSQL/MongoDB', 10)
    addText('• Authentication: JWT/OAuth', 10)
    addText('• Deployment: Docker containers, Cloud hosting', 10)
    addText('• Version Control: Git with feature branch workflow', 10)
    yPos += 8

    addText('Architecture Considerations:', 12, 'bold')
    addText('• Microservices vs Monolithic architecture decision needed', 10)
    addText('• API design following RESTful principles', 10)
    addText('• Database normalization and indexing strategy', 10)
    addText('• Caching layer for performance optimization', 10)
    addText('• Security implementation (HTTPS, data encryption)', 10)
    addSectionDivider()

    // 3. DETAILED IMPLEMENTATION PHASES
    addSectionHeader('3. IMPLEMENTATION PHASES (DETAILED)', 16)

    phases.forEach((phase, phaseIndex) => {
      if (!phase) return
      
      const phaseName = getPhaseDisplayName(phase, phaseIndex)
      
      pageBreak(60)
      
      // Phase Header with colored background
      addMainHeader(`PHASE ${phaseIndex + 1}: ${phaseName.toUpperCase()}`, 14)
      
      // Phase info table
      const phaseHeaders = ['Attribute', 'Details']
      const phaseRows = [
        ['Duration', phase.duration || 'To be determined'],
        ['Priority', 'HIGH'],
        ['Status', 'Planning Phase'],
        ['Dependencies', phaseIndex === 0 ? 'None - Foundation Phase' : `Phase ${phaseIndex} Completion`]
      ]
      addTable(phaseHeaders, phaseRows, [120, 460])
      
      // Phase Description
      addText('Business Objective:', 11, 'bold')
      addText(phase.description || 'Objective to be defined in project kickoff', 10)
      yPos += 8

      // Technical Requirements for Phase
      addText('Technical Requirements:', 11, 'bold')
      if (phase.epics && phase.epics.length > 0) {
        phase.epics.forEach((epic, epicIndex) => {
          if (!epic) return
          
          pageBreak(35)
          
          // Epic Header
          addText(`Epic ${epicIndex + 1}: ${epic.title || 'Untitled Epic'}`, 12, 'bold', [13, 110, 253])
          addText(`Priority: ${epic.priority || 'Medium'} | Complexity: ${epic.complexity || 'Medium'}`, 10, 'italic')
          yPos += 3
          
          // Epic Description
          if (epic.description) {
            addText('Description:', 10, 'bold')
            addText(epic.description, 10)
          }
          
          // User Stories (Business Requirements)
          if (epic.userStories && epic.userStories.length > 0) {
            pageBreak(15)
            addText('User Stories (Business Requirements):', 10, 'bold', [25, 135, 84])
            epic.userStories.forEach((story, storyIndex) => {
              addText(`${storyIndex + 1}. ${story}`, 9)
            })
            yPos += 3
          }
          
          // Technical Deliverables
          if (epic.deliverables && epic.deliverables.length > 0) {
            pageBreak(15)
            addText('Technical Deliverables:', 10, 'bold', [255, 193, 7])
            epic.deliverables.forEach((deliverable, delIndex) => {
              addText(`${delIndex + 1}. ${deliverable}`, 9)
            })
            yPos += 3
          }
          
          // Related Ideas/Requirements
          if (epic.relatedIdeas && epic.relatedIdeas.length > 0) {
            pageBreak(10)
            addText('Related Requirements:', 10, 'bold')
            epic.relatedIdeas.forEach((idea) => {
              addText(`• ${idea}`, 9)
            })
            yPos += 3
          }
          
          yPos += 8
        })
      } else {
        addText('• Technical specifications to be defined during planning phase', 10)
        addText('• Architecture decisions pending stakeholder review', 10)
        addText('• Integration requirements need assessment', 10)
        yPos += 8
      }

      // Risk Assessment for Phase
      if (phase.risks && phase.risks.length > 0) {
        pageBreak(20)
        addText('Risk Assessment & Mitigation:', 11, 'bold', [220, 53, 69])
        phase.risks.forEach((risk, riskIndex) => {
          addText(`Risk ${riskIndex + 1}: ${risk}`, 10)
        })
        yPos += 5
      }

      // Success Criteria & Acceptance
      if (phase.successCriteria && phase.successCriteria.length > 0) {
        pageBreak(20)
        addText('Success Criteria & Acceptance:', 11, 'bold', [25, 135, 84])
        phase.successCriteria.forEach((criteria) => {
          addText(`✓ ${criteria}`, 10)
        })
      }

      // Phase Dependencies
      addText('Dependencies & Prerequisites:', 11, 'bold')
      if (phaseIndex === 0) {
        addText('• Project setup and environment configuration', 10)
        addText('• Team onboarding and access provisioning', 10)
        addText('• Requirements finalization and sign-off', 10)
      } else {
        addText(`• Successful completion of Phase ${phaseIndex}`, 10)
        addText('• Code review and quality gate approval', 10)
        addText('• Stakeholder acceptance of previous deliverables', 10)
      }
      
      yPos += 15
    })

    // 4. RESOURCE REQUIREMENTS
    addSectionDivider()
    addSectionHeader('4. RESOURCE REQUIREMENTS & TEAM STRUCTURE', 16)

    addText('Recommended Team Composition:', 12, 'bold')
    
    // Team composition table
    const teamHeaders = ['Role', 'Allocation', 'Key Responsibilities']
    const teamRows = [
      ['Product Owner', '1 (full-time)', 'Requirements, stakeholder communication'],
      ['Technical Lead', '1 (full-time)', 'Architecture, technical decisions'],
      ['Frontend Developer', '1-2 (full-time)', 'UI/UX implementation, React development'],
      ['Backend Developer', '1-2 (full-time)', 'API development, database design'],
      ['UI/UX Designer', '1 (as needed)', 'Design systems, user experience'],
      ['QA Engineer', '1 (full-time)', 'Testing strategy, quality assurance'],
      ['DevOps Engineer', '1 (part-time)', 'CI/CD, deployment, infrastructure']
    ]
    addTable(teamHeaders, teamRows, [140, 120, 320])

    addText('Infrastructure & Tools Required:', 12, 'bold')
    addText('• Development environments (local + staging)', 10)
    addText('• Version control system (GitHub/GitLab)', 10)
    addText('• CI/CD pipeline setup', 10)
    addText('• Project management tools (Jira/Linear)', 10)
    addText('• Communication tools (Slack/Teams)', 10)
    addText('• Code review and quality gates', 10)
    yPos += 10

    // 5. KEY MILESTONES
    addSectionDivider()
    addSectionHeader('5. KEY MILESTONES & DELIVERABLES', 16)

    const milestones = roadmapData.executionStrategy?.keyMilestones || []
    if (milestones.length > 0) {
      // Create milestones table
      const milestoneHeaders = ['Milestone', 'Timeline', 'Description']
      const milestoneRows = milestones.map((milestone, msIndex) => [
        `M${msIndex + 1}: ${milestone?.milestone || 'TBD'}`,
        milestone?.timeline || 'TBD',
        (milestone?.description || 'Description to be defined').substring(0, 50) + '...'
      ])
      addTable(milestoneHeaders, milestoneRows, [160, 120, 300])
    } else {
      addText('Key Milestones (Generated from Phases):', 12, 'bold')
      // Create phase-based milestones table
      const phaseHeaders = ['Phase', 'Milestone', 'Duration']
      const phaseRows = phases.map((phase, pIndex) => [
        `Phase ${pIndex + 1}`,
        `${getPhaseDisplayName(phase, pIndex)} Complete`,
        phase.duration || 'TBD'
      ])
      addTable(phaseHeaders, phaseRows, [80, 380, 120])
    }

    // 6. TESTING & QUALITY ASSURANCE
    addSectionDivider()
    addSectionHeader('6. QUALITY ASSURANCE & TESTING STRATEGY', 16)

    addText('Testing Framework Overview:', 12, 'bold')
    
    // Testing strategy table
    const testingHeaders = ['Testing Type', 'Tools/Framework', 'Coverage Target', 'Responsibility']
    const testingRows = [
      ['Unit Testing', 'Jest/Vitest', '80%+', 'Developers'],
      ['Integration Testing', 'Custom/Supertest', '70%+', 'Developers/QA'],
      ['E2E Testing', 'Cypress/Playwright', 'Critical paths', 'QA Team'],
      ['Performance Testing', 'JMeter/K6', 'Load benchmarks', 'DevOps/QA'],
      ['Security Testing', 'OWASP/Snyk', '100% scan', 'Security Team'],
      ['UAT', 'Manual/TestRail', 'User scenarios', 'Product/Users']
    ]
    addTable(testingHeaders, testingRows, [120, 120, 120, 120])

    addText('Quality Gates Checklist:', 12, 'bold')
    addText('✓ Code review approval required for all changes', 10)
    addText('✓ Minimum 80% test coverage requirement', 10)
    addText('✓ Performance benchmarks must be met', 10)
    addText('✓ Security scan clearance required', 10)

    // 7. DEPLOYMENT PLAN
    addSectionDivider()
    addSectionHeader('7. DEPLOYMENT & OPERATIONS PLAN', 16)

    addText('Deployment Strategy Overview:', 12, 'bold')
    
    // Deployment environments table
    const deployHeaders = ['Environment', 'Purpose', 'Deployment Method', 'Approval Required']
    const deployRows = [
      ['Development', 'Feature development', 'Auto on push', 'Code review'],
      ['Staging', 'Integration testing', 'Manual trigger', 'QA approval'],
      ['Production', 'Live system', 'Blue-Green deploy', 'Product owner']
    ]
    addTable(deployHeaders, deployRows, [120, 140, 140, 180])

    addText('Operations & Monitoring:', 12, 'bold')
    addText('• Application performance monitoring (APM)', 10)
    addText('• Error tracking and logging system', 10)
    addText('• Automated backup and disaster recovery', 10)
    addText('• Regular security updates and patches', 10)
    addSectionDivider()

    // 8. SUCCESS METRICS & KPIS
    addSectionHeader('8. SUCCESS METRICS & KPIS', 16)
    
    addText('Key Performance Indicators Dashboard:', 12, 'bold')
    
    // KPIs table
    const kpiHeaders = ['Category', 'Metric', 'Target', 'Measurement']
    const kpiRows = [
      ['Delivery', 'On-time delivery', '95%+', 'Sprint completion rate'],
      ['Budget', 'Budget adherence', '±10%', 'Actual vs planned costs'],
      ['Quality', 'Code coverage', '80%+', 'Automated testing reports'],
      ['Performance', 'Load time', '<2 seconds', 'APM monitoring'],
      ['User Adoption', 'Satisfaction score', '4.5/5', 'User surveys'],
      ['Reliability', 'System uptime', '99.9%+', 'Infrastructure monitoring']
    ]
    addTable(kpiHeaders, kpiRows, [100, 140, 100, 240])

    // IMMEDIATE NEXT STEPS
    addSectionDivider()
    addMainHeader('IMMEDIATE NEXT STEPS FOR IMPLEMENTATION', 16)

    // Implementation timeline table
    const timelineHeaders = ['Phase', 'Duration', 'Key Activities', 'Deliverables']
    const timelineRows = [
      ['Project Setup', 'Week 1', 'Team assembly, environment setup', 'Dev environment, team structure'],
      ['Planning', 'Week 2', 'Requirements review, design', 'Wireframes, API specs'],
      ['Development', 'Week 3+', 'Sprint execution, testing', 'Working software, documentation']
    ]
    addTable(timelineHeaders, timelineRows, [120, 80, 200, 180])

    addText('Week 1: Project Foundation', 14, 'bold', [25, 135, 84])
    addText('✓ Assemble development team and assign roles', 10)
    addText('✓ Set up development environments and tools', 10)
    addText('✓ Create project repositories and initial structure', 10)
    addText('✓ Finalize technical architecture decisions', 10)
    addText('✓ Establish communication channels and workflows', 10)
    addSectionDivider()

    addText('Week 2: Requirements & Planning', 14, 'bold', [25, 135, 84])
    addText('✓ Review and validate all user stories with stakeholders', 10)
    addText('✓ Create detailed wireframes and user interface mockups', 10)
    addText('✓ Define comprehensive API specifications', 10)
    addText('✓ Establish coding standards, guidelines, and best practices', 10)
    addText('✓ Set up CI/CD pipeline and deployment processes', 10)
    addSectionDivider()

    // FINAL READINESS CHECKLIST
    addSectionHeader('PROJECT READINESS CHECKLIST', 14)
    
    // Readiness checklist table
    const checklistHeaders = ['Category', 'Requirement', 'Status']
    const checklistRows = [
      ['Team', 'Development team assembled', '☐ Pending'],
      ['Requirements', 'Project requirements documented', '☐ Pending'],
      ['Architecture', 'Technical architecture finalized', '☐ Pending'],
      ['Environment', 'Development environment configured', '☐ Pending'],
      ['Process', 'Version control and CI/CD established', '☐ Pending'],
      ['Standards', 'Quality standards defined', '☐ Pending'],
      ['Communication', 'Team channels established', '☐ Pending'],
      ['Planning', 'First sprint planned', '☐ Pending']
    ]
    addTable(checklistHeaders, checklistRows, [120, 360, 100])
    
    addText('For questions or clarification on this roadmap, contact the project team.', 10, 'italic', [128, 128, 128])
    addText('This document should be reviewed and updated regularly as the project progresses.', 10, 'italic', [128, 128, 128])

    // ADD TIMELINE VIEW
    addSectionDivider()
    addMainHeader('VISUAL TIMELINE ROADMAP', 16)
    
    // Create timeline features data
    const createTimelineFeatures = () => {
      if (!roadmapData?.roadmapAnalysis?.phases) return []

      const features: any[] = []
      let currentMonth = 0
      
      const getTeamForEpic = (epic: any) => {
        const title = epic.title?.toLowerCase() || ''
        const description = epic.description?.toLowerCase() || ''
        
        if (title.includes('mobile') || title.includes('app') || description.includes('mobile')) {
          return 'mobile'
        } else if (title.includes('market') || title.includes('analytics') || title.includes('campaign') || description.includes('marketing')) {
          return 'marketing'
        } else if (title.includes('platform') || title.includes('infrastructure') || title.includes('security') || description.includes('backend')) {
          return 'platform'
        } else {
          return 'web'
        }
      }

      roadmapData.roadmapAnalysis.phases.forEach((phase, phaseIndex) => {
        const durationText = phase.duration || '1 month'
        let phaseDuration = 1
        
        if (durationText.includes('week')) {
          const weeks = parseInt(durationText) || 2
          phaseDuration = Math.ceil(weeks / 4)
        } else if (durationText.includes('month')) {
          phaseDuration = parseInt(durationText) || 1
        }

        phase.epics?.forEach((epic, epicIndex) => {
          const priority = epic.priority?.toLowerCase() || 'medium'
          
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

    const timelineFeatures = createTimelineFeatures()
    
    if (timelineFeatures.length > 0) {
      // Add new page for timeline
      pageBreak(pageH)
      
      // Timeline header
      addText('Team-Based Timeline View', 14, 'bold')
      addText('Features organized by team with monthly timeline progression', 10)
      yPos += 20

      // Define teams and colors
      const teams = [
        { id: 'web', name: 'Web Team', color: [255, 165, 0] },      // Orange
        { id: 'mobile', name: 'Mobile Team', color: [59, 130, 246] }, // Blue  
        { id: 'marketing', name: 'Marketing Team', color: [147, 51, 234] }, // Purple
        { id: 'platform', name: 'Platform Team', color: [34, 197, 94] }  // Green
      ]

      // Smart timeline duration calculation (same as calendar view)
      const calculateTimelineDuration = () => {
        if (timelineFeatures.length === 0) {
          return 6 // Default to 6 months when no features
        }
        
        // Find the latest end date among all features
        const latestEndMonth = Math.max(
          ...timelineFeatures.map(feature => feature.startMonth + feature.duration)
        )
        
        // Add 2 months buffer as requested
        const timelineLength = latestEndMonth + 2
        
        // Cap at 12 months maximum (1 year)
        return Math.min(timelineLength, 12)
      }

      // Calculate timeline dimensions
      const timelineStartX = marginL + 120 // Space for team labels
      const timelineWidth = contentW - 140
      const maxMonths = calculateTimelineDuration()
      const monthWidth = timelineWidth / maxMonths
      const teamHeight = 50
      const featureHeight = 16

      // Draw month headers
      yPos += 10
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      for (let month = 0; month < maxMonths; month++) {
        const x = timelineStartX + (month * monthWidth)
        const monthName = new Date(2024, month).toLocaleDateString('en-US', { month: 'short' })
        doc.text(monthName, x + monthWidth/2 - 10, yPos)
      }
      yPos += 20

      // Draw timeline for each team
      teams.forEach((team, teamIndex) => {
        const teamFeatures = timelineFeatures.filter(f => f.team === team.id)
        const teamY = yPos + (teamIndex * (teamHeight + 20))
        
        // Team label
        doc.setFillColor(team.color[0], team.color[1], team.color[2])
        doc.rect(marginL, teamY, 110, teamHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(team.name, marginL + 10, teamY + 25)
        doc.setTextColor(0, 0, 0)

        // Team timeline background
        doc.setFillColor(240, 240, 240)
        doc.rect(timelineStartX, teamY, timelineWidth, teamHeight, 'F')
        
        // Month grid lines
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.5)
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
          let featureColor = [200, 200, 200] // default gray
          if (feature.priority === 'high') featureColor = [239, 68, 68] // red
          else if (feature.priority === 'medium') featureColor = [245, 158, 11] // yellow
          else if (feature.priority === 'low') featureColor = [59, 130, 246] // blue

          // Draw feature block
          doc.setFillColor(featureColor[0], featureColor[1], featureColor[2])
          doc.rect(featureX + 2, featureY, Math.max(featureWidth, 20), featureHeight, 'F')
          
          // Feature text
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          const truncatedTitle = feature.title.length > 25 ? feature.title.substring(0, 22) + '...' : feature.title
          doc.text(truncatedTitle, featureX + 5, featureY + 11)
          doc.setTextColor(0, 0, 0)
        })
      })

      // Timeline legend
      yPos = yPos + (teams.length * (teamHeight + 20)) + 30
      addText('Timeline Legend:', 12, 'bold')
      yPos += 10
      
      // Priority legend
      const priorityItems = [
        { label: 'High Priority', color: [239, 68, 68] },
        { label: 'Medium Priority', color: [245, 158, 11] },
        { label: 'Low Priority', color: [59, 130, 246] }
      ]
      
      priorityItems.forEach((item, index) => {
        const legendX = marginL + (index * 150)
        doc.setFillColor(item.color[0], item.color[1], item.color[2])
        doc.rect(legendX, yPos, 20, 10, 'F')
        doc.setFontSize(9)
        doc.text(item.label, legendX + 25, yPos + 8)
      })
      
      yPos += 20
      addText('• Each block represents a feature or epic from the roadmap analysis', 9)
      addText('• Block width indicates duration in months', 9)
      addText('• Team assignment is based on feature content and keywords', 9)
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(`Generated by Prioritas AI • Comprehensive Project Roadmap`, marginL, pageH - 15)
      doc.text(`Page ${i} of ${totalPages} • ${new Date().toLocaleDateString()}`, marginL, pageH - 10)
      doc.text('CONFIDENTIAL - For Internal Use Only', pageW - marginR - 80, pageH - 10)
    }

    // Save the PDF
    const projectPrefix = project ? `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''
    const fileName = `${projectPrefix}Complete_Project_Roadmap_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
    
  } catch (error) {
    console.error('PDF export failed:', error)
    alert('PDF export failed. Please try again.')
  }
}

export const exportInsightsToPDF = (insights: any, ideaCount: number, project: Project | null = null, filesWithContent: any[] = []) => {
  try {
    const doc = new jsPDF('portrait', 'mm', 'a4')  // Switch to mm for better control
    let yPos = 25
    const pageH = doc.internal.pageSize.height
    const pageW = doc.internal.pageSize.width
    const marginL = 20
    const marginR = 20
    const contentW = pageW - marginL - marginR
    
    // Modern color palette inspired by premium business reports
    const primary = [79, 70, 229]         // #4f46e5 - Modern indigo
    const accent = [14, 165, 233]         // #0ea5e9 - Sky blue
    const success = [34, 197, 94]         // #22c55e - Emerald
    const warning = [251, 146, 60]        // #fb923c - Orange
    const danger = [239, 68, 68]          // #ef4444 - Red
    const gray900 = [17, 24, 39]          // #111827 - Very dark gray
    const gray700 = [55, 65, 81]          // #374151 - Dark gray
    const gray600 = [75, 85, 99]          // #4b5563 - Medium gray
    const gray100 = [243, 244, 246]       // #f3f4f6 - Light gray
    const white = [255, 255, 255]         // White

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
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      const availableWidth = contentW - 6
      const titleLines = doc.splitTextToSize(title, availableWidth)
      doc.text(titleLines, marginL + 3, yPos + 12)
      
      yPos += gradientHeight + 3
      
      // Subtitle with proper sizing
      if (subtitle) {
        doc.setTextColor(gray700[0], gray700[1], gray700[2])
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        const subtitleLines = doc.splitTextToSize(subtitle, availableWidth)
        doc.text(subtitleLines, marginL, yPos + 4)
        yPos += subtitleLines.length * 3 + 5
      }
      
      yPos += 8
    }

    // Simplified insight card with better text sizing
    const createInsightCard = (_icon: string, title: string, content: string, impact: 'high' | 'medium' | 'low', index: number) => {
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
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(index.toString(), marginL + 6, yPos + 12)
      
      // Title and impact (smaller font)
      doc.setTextColor(gray900[0], gray900[1], gray900[2])
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      const titleText = `${title} (${impact.toUpperCase()} IMPACT)`
      const availableTitleWidth = contentW - 18
      const titleLines = doc.splitTextToSize(titleText, availableTitleWidth)
      doc.text(titleLines[0], marginL + 15, yPos + 12) // Only first line in header
      
      yPos += cardHeight + 3
      
      // Content with better text management
      doc.setTextColor(gray700[0], gray700[1], gray700[2])
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const availableContentWidth = contentW - 6
      const contentLines = doc.splitTextToSize(content, availableContentWidth)
      doc.text(contentLines.slice(0, 4), marginL + 3, yPos + 3) // Allow more lines but smaller font
      
      yPos += Math.min(contentLines.length, 4) * 3 + 8
    }

    // Simplified executive panel with fixed text positioning
    const createExecutivePanel = (title: string, content: string, stats: Array<{label: string, value: string, color?: number[]}>) => {
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
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(title, marginL + 3, yPos + 7)
      
      yPos += 12
      
      // Content area with proper text wrapping
      doc.setTextColor(gray700[0], gray700[1], gray700[2])
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const availableContentWidth = contentW - 6 // More margin for readability
      const contentLines = doc.splitTextToSize(content, availableContentWidth)
      doc.text(contentLines.slice(0, 3), marginL + 3, yPos + 4) // Limit to 3 lines, better spacing
      
      yPos += Math.min(contentLines.length, 3) * 3 + 8
      
      // Stats section - vertical layout to prevent overlap
      if (stats.length > 0) {
        stats.forEach((stat, _index) => {
          // Each stat on its own line to prevent overlapping
          doc.setTextColor(gray600[0], gray600[1], gray600[2])
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.text(`${stat.label}: `, marginL + 3, yPos + 3)
          
          // Position value right after label with proper spacing
          const labelWidth = doc.getTextWidth(`${stat.label}: `)
          doc.setTextColor((stat.color || primary)[0], (stat.color || primary)[1], (stat.color || primary)[2])
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.text(stat.value, marginL + 3 + labelWidth, yPos + 3)
          
          yPos += 4 // Move to next line
        })
        yPos += 5
      }
      
      yPos += 5
    }

    // MODERN COVER PAGE
    
    // Hero gradient header
    createGradientHeader(
      project?.name || 'AI Strategic Insights Report',
      'Comprehensive Analysis & Recommendations'
    )
    
    // Cover stats panel - reduced to prevent overlap
    const coverStats = [
      { label: 'Ideas', value: ideaCount.toString(), color: primary },
      { label: 'Documents', value: filesWithContent.length.toString(), color: accent },
      { label: 'Date', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: success }
    ]
    
    createExecutivePanel(
      'Analysis Overview', 
      `Strategic analysis of ${ideaCount} initiatives providing actionable insights and recommendations for ${project?.name || 'your project'}.`,
      coverStats
    )
    
    // Project description if available
    if (project?.description) {
      pageBreak(60)
      doc.setTextColor(gray700[0], gray700[1], gray700[2])
      doc.setFontSize(12)
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
    
    const summaryStats = [
      { label: 'Priority Initiatives', value: (insights.priorityRecommendations?.immediate?.length || 0).toString(), color: danger },
      { label: 'Strategic Opportunities', value: (insights.riskAssessment?.opportunities?.length || 0).toString(), color: success },
      { label: 'Implementation Phases', value: (insights.suggestedRoadmap?.length || 0).toString(), color: accent }
    ]
    
    createExecutivePanel('Strategic Assessment', executiveSummary, summaryStats)

    // KEY STRATEGIC INSIGHTS
    if (insights.keyInsights && insights.keyInsights.length > 0) {
      createGradientHeader('Strategic Insights', 'Critical Findings & Recommendations')
      
      insights.keyInsights.forEach((item: any, index: number) => {
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
      
      insights.suggestedRoadmap.forEach((phase: any, index: number) => {
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
      if (insights.priorityRecommendations.immediate?.length > 0) {
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
      if (insights.priorityRecommendations.shortTerm?.length > 0) {
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
      if (insights.priorityRecommendations.longTerm?.length > 0) {
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
      
      if (insights.riskAssessment.highRisk?.length > 0) {
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
      
      if (insights.riskAssessment.opportunities?.length > 0) {
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
    if (insights.nextSteps?.length > 0) {
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
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Prioritas AI Strategic Insights Report', marginL, yPos)
    
    // Document info (right aligned)
    const docInfo = `Generated: ${new Date().toLocaleDateString()}`
    const infoWidth = doc.getTextWidth(docInfo)
    doc.text(docInfo, pageW - marginR - infoWidth, yPos)
    
    // Professional filename
    const timestamp = new Date().toISOString().split('T')[0]
    let cleanProjectName = ''
    if (project && project.name) {
      cleanProjectName = project.name
        .replace(/[\u201C\u201D]/g, '')
        .replace(/[\u2018\u2019]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30)
    }
    const projectPrefix = cleanProjectName ? `${cleanProjectName}_` : ''
    const fileName = `${projectPrefix}AI_Strategic_Insights_${timestamp}.pdf`
    doc.save(fileName)

  } catch (error) {
    console.error('PDF export failed:', error)
    alert('PDF export failed. Please try again.')
  }
}

// NEW PROFESSIONAL PDF EXPORT USING PDFMAKE (2024 STANDARDS)
export const exportInsightsToPDFProfessional = async (insights: any, ideaCount: number, project: Project | null = null, filesWithContent: any[] = []) => {
  try {
    // Load pdfMake dynamically
    const pdfMakeInstance = await loadPdfMake()
    // Professional brand colors (2024 standards)
    const brandColors = {
      primary: '#4f46e5',      // Modern indigo
      secondary: '#0ea5e9',    // Sky blue  
      success: '#22c55e',      // Emerald
      warning: '#f59e0b',      // Amber
      danger: '#ef4444',       // Red
      dark: '#111827',         // Very dark gray
      medium: '#6b7280',       // Medium gray
      light: '#f9fafb',        // Very light gray
      white: '#ffffff'
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
    const createExecutivePanel = (title: string, content: string, stats: Array<{label: string, value: string, color?: string}>) => {
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
    const createInsightCard = (insight: any, index: number) => {
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
          `This comprehensive strategic analysis examines ${ideaCount} strategic initiatives to provide actionable insights and recommendations for ${project?.name || 'your project'}. The analysis incorporates data-driven methodologies and industry best practices.`,
          [
            { label: 'Ideas Analyzed', value: ideaCount.toString(), color: brandColors.primary },
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
          ...insights.keyInsights.map((insight: any, index: number) => 
            createInsightCard(insight, index + 1)
          )
        ] : []),

        // IMPLEMENTATION ROADMAP SECTION
        ...(insights.suggestedRoadmap && insights.suggestedRoadmap.length > 0 ? [
          { text: '', pageBreak: 'before' },
          ...createSectionHeader('Implementation Roadmap', 'Strategic Phases & Milestones'),
          
          ...insights.suggestedRoadmap.map((phase: any, index: number) => 
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
          ...(insights.priorityRecommendations.immediate?.length > 0 ? [
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
          ...(insights.priorityRecommendations.shortTerm?.length > 0 ? [
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
          ...(insights.priorityRecommendations.longTerm?.length > 0 ? [
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
          
          ...(insights.riskAssessment.highRisk?.length > 0 ? [
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
          
          ...(insights.riskAssessment.opportunities?.length > 0 ? [
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
        ...(insights.nextSteps?.length > 0 ? [
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
    if (project && project.name) {
      cleanProjectName = project.name
        .replace(/[\u201C\u201D]/g, '')
        .replace(/[\u2018\u2019]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30)
    }
    const projectPrefix = cleanProjectName ? `${cleanProjectName}_` : ''
    const fileName = `${projectPrefix}Strategic_Insights_Professional_${timestamp}.pdf`
    
    pdfMakeInstance.createPdf(documentDefinition).download(fileName)

  } catch (error) {
    console.error('Professional PDF export failed:', error)
    alert('Professional PDF export failed. Please try again.')
  }
}