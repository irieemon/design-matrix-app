import jsPDF from 'jspdf'
import { Project, RoadmapData } from '../types'

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

      // Calculate timeline dimensions
      const timelineStartX = marginL + 120 // Space for team labels
      const timelineWidth = contentW - 140
      const maxMonths = Math.max(...timelineFeatures.map(f => f.startMonth + f.duration), 6)
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
    const doc = new jsPDF()
    let yPos = 50
    const pageH = doc.internal.pageSize.height
    const pageW = doc.internal.pageSize.width
    const marginL = 40
    const marginR = 40
    const contentW = pageW - marginL - marginR
    
    // Sophisticated, subtle color palette
    const charcoal = [45, 45, 48]         // #2d2d30 - Primary text
    const slate = [71, 85, 105]           // #475569 - Secondary text
    const steel = [100, 116, 139]         // #64748b - Accent text
    const ash = [148, 163, 184]           // #94a3b8 - Light accent
    const pearl = [241, 245, 249]         // #f1f5f9 - Background
    const cream = [255, 255, 255]         // #ffffff - Paper white
    const prioritasBlue = [30, 155, 218]  // #1e9bda - Brand blue from logo

    // Sophisticated page management
    const pageBreak = (space: number) => {
      if (yPos + space > pageH - 90) {
        addFooter(doc.getNumberOfPages())
        doc.addPage()
        addHeader()
        yPos = 85
      }
    }

    // Create Prioritas target logo using vector drawing
    const drawPrioritasLogo = (x: number, y: number, size: number = 24) => {
      const center = { x: x + size/2, y: y + size/2 }
      const radius = size * 0.4
      
      // Outer circle (target ring)
      doc.setDrawColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
      doc.setFillColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
      doc.setLineWidth(2)
      doc.circle(center.x, center.y, radius, 'S')
      
      // Inner circle
      doc.circle(center.x, center.y, radius * 0.6, 'S')
      
      // Arrow pointing up (priority indicator) - simplified
      doc.setFillColor(cream[0], cream[1], cream[2])
      const arrowSize = size * 0.25
      
      // Draw triangle arrow
      doc.triangle(center.x, center.y - arrowSize*0.5, 
                   center.x - arrowSize*0.3, center.y + arrowSize*0.2,
                   center.x + arrowSize*0.3, center.y + arrowSize*0.2, 'F')
    }

    // Elegant, professional header
    const addHeader = () => {
      // Subtle header line
      doc.setDrawColor(ash[0], ash[1], ash[2])
      doc.setLineWidth(0.5)
      doc.line(marginL, 50, pageW - marginR, 50)
      
      // Prioritas logo
      drawPrioritasLogo(marginL, 20)
      
      // Brand text with sophisticated typography
      doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
      doc.setFontSize(18)
      doc.setFont('helvetica', 'normal')
      doc.text('PRIORITAS', marginL + 35, 35)
      
      doc.setFontSize(9)
      doc.setTextColor(steel[0], steel[1], steel[2])
      doc.text('Strategic Intelligence Platform', marginL + 35, 43)
      
      // Elegant document type indicator
      doc.setTextColor(slate[0], slate[1], slate[2])
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const docTypeText = 'Strategic Insights Report'
      const textWidth = doc.getTextWidth(docTypeText)
      doc.text(docTypeText, pageW - marginR - textWidth, 35)
      
      doc.setFontSize(8)
      doc.setTextColor(steel[0], steel[1], steel[2])
      const dateText = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      const dateWidth = doc.getTextWidth(dateText)
      doc.text(dateText, pageW - marginR - dateWidth, 43)
    }

    // Professional footer matching template style
    const addFooter = (pageNum: number) => {
      // Blue footer bar like in template
      doc.setFillColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
      doc.rect(marginL, pageH - 40, contentW, 20, 'F')
      
      // White text in footer
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Generated by Prioritas', marginL + 10, pageH - 28)
      
      // Date and time
      const dateTimeText = new Date().toLocaleDateString('en-US') + ' • ' + new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})
      doc.text(dateTimeText, marginL + 10, pageH - 23)
      
      // Page number on right
      const pageText = `${pageNum}`
      const pageTextWidth = doc.getTextWidth(pageText)
      doc.text(pageText, pageW - marginR - pageTextWidth - 10, pageH - 28)
      
      // Confidentiality notice on right
      doc.setFontSize(7)
      const confText = 'CONFIDENTIAL'
      const confWidth = doc.getTextWidth(confText)
      doc.text(confText, pageW - marginR - confWidth - 10, pageH - 23)
    }

    // Sophisticated text rendering with proper character encoding
    const addText = (text: string, fontSize: number = 11, fontStyle: string = 'normal', color: number[] = charcoal, lineSpacing: number = 1.4) => {
      if (!text || text.trim().length === 0) return 0
      
      // Clean text for proper PDF encoding
      const cleanText = text
        .replace(/[\u201C\u201D]/g, '"')  // Replace smart quotes
        .replace(/[\u2018\u2019]/g, "'")  // Replace smart apostrophes  
        .replace(/\u2013/g, '-')         // Replace en dash
        .replace(/\u2014/g, '--')        // Replace em dash
        .replace(/\u2026/g, '...')       // Replace ellipsis
        .replace(/[\u0080-\uFFFF]/g, (match) => {
          // Replace other unicode characters with ASCII equivalents
          const code = match.charCodeAt(0)
          if (code > 127) return '?'
          return match
        })
      
      pageBreak(fontSize * lineSpacing + 10)
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', fontStyle)
      doc.setTextColor(color[0], color[1], color[2])
      
      const lines = doc.splitTextToSize(cleanText, contentW)
      doc.text(lines, marginL, yPos)
      yPos += lines.length * (fontSize * lineSpacing) + 6
      return lines.length
    }

    // Professional section headers matching template style
    const addSectionHeader = (text: string, fontSize: number = 16, accentColor: number[] = prioritasBlue) => {
      pageBreak(70)
      
      // Blue header box like in template
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
      doc.rect(marginL, yPos, contentW, 30, 'F')
      
      // White text in header
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', 'bold')
      doc.text(text, marginL + 15, yPos + 20)
      
      // Reset text color for content
      doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
      yPos += 40
    }

    // Refined bullet points with proper spacing
    const addBulletPoint = (text: string, indent: number = 0, bulletColor: number[] = steel) => {
      if (!text || text.trim().length === 0) return
      
      pageBreak(25)
      
      // Clean text
      const cleanText = text
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '--')
        .replace(/\u2026/g, '...')
      
      // Sophisticated bullet - small filled circle
      doc.setFillColor(bulletColor[0], bulletColor[1], bulletColor[2])
      doc.circle(marginL + indent + 6, yPos + 2, 1.5, 'F')
      
      // Text with proper character handling
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
      const lines = doc.splitTextToSize(cleanText, contentW - indent - 20)
      doc.text(lines, marginL + indent + 15, yPos + 5)
      yPos += lines.length * 15 + 8
    }

    // Professional information boxes matching template style
    const addInfoBox = (title: string, content: string, headerColor: number[] = prioritasBlue) => {
      if (!content || content.trim().length === 0) return
      
      pageBreak(100)
      
      // Clean content
      const cleanContent = content
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '--')
        .replace(/\u2026/g, '...')
      
      const lines = doc.splitTextToSize(cleanContent, contentW - 30)
      const contentHeight = Math.max(50, lines.length * 14 + 20)
      const headerHeight = 25
      const totalHeight = headerHeight + contentHeight
      
      // Blue header box
      doc.setFillColor(headerColor[0], headerColor[1], headerColor[2])
      doc.rect(marginL, yPos, contentW, headerHeight, 'F')
      
      // White content box
      doc.setFillColor(255, 255, 255)
      doc.rect(marginL, yPos + headerHeight, contentW, contentHeight, 'F')
      
      // Box border
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(1)
      doc.rect(marginL, yPos, contentW, totalHeight, 'S')
      
      // Title in white text
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(title, marginL + 15, yPos + 17)
      
      // Content in black text
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
      doc.text(lines, marginL + 15, yPos + headerHeight + 15)
      
      yPos += totalHeight + 20
    }

    // Subtle priority indicators with refined styling
    const addPriorityBadge = (text: string, priority: 'immediate' | 'short' | 'long') => {
      const colors = {
        immediate: [185, 28, 28],   // Subtle red
        short: [217, 119, 6],       // Subtle amber  
        long: [30, 64, 175]         // Subtle blue
      }
      
      const badgeColor = colors[priority]
      
      // Subtle background
      doc.setFillColor(pearl[0], pearl[1], pearl[2])
      doc.roundedRect(marginL, yPos, 120, 20, 2, 2, 'F')
      
      // Colored accent bar
      doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2])
      doc.rect(marginL, yPos, 4, 20, 'F')
      
      // Badge text with refined typography
      doc.setTextColor(badgeColor[0], badgeColor[1], badgeColor[2])
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(text, marginL + 12, yPos + 13)
      
      yPos += 28
    }

    // Initialize first page
    addHeader()

    // PROFESSIONAL DOCUMENT TITLE PAGE - Matching Strategic Plan Template
    yPos = 110
    
    // Large blue header bar similar to template
    doc.setFillColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
    doc.rect(marginL - 10, yPos, contentW + 20, 50, 'F')
    
    // White title text in header
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    const mainTitle = project ? project.name.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'") : 'Strategic Analysis'
    doc.text(mainTitle, marginL + 10, yPos + 25)
    
    // Date in header
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const dateText = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const dateWidth = doc.getTextWidth(dateText)
    doc.text(dateText, pageW - marginR - dateWidth - 10, yPos + 15)
    
    // Report type in header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    const reportTypeWidth = doc.getTextWidth('Strategic Insights Report')
    doc.text('Strategic Insights Report', pageW - marginR - reportTypeWidth - 10, yPos + 35)
    
    yPos += 70
    
    // Center aligned project title
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
    const titleText = mainTitle
    const titleWidth = doc.getTextWidth(titleText)
    doc.text(titleText, (pageW - titleWidth) / 2, yPos)
    yPos += 15
    
    // Blue underline
    doc.setDrawColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
    doc.setLineWidth(2)
    doc.line((pageW - 100) / 2, yPos, (pageW + 100) / 2, yPos)
    yPos += 8
    
    // Centered subtitle
    doc.setFontSize(16)
    doc.setTextColor(slate[0], slate[1], slate[2])
    doc.setFont('helvetica', 'normal')
    const subtitleText = 'Strategic Insights Report'
    const subtitleWidth = doc.getTextWidth(subtitleText)
    doc.text(subtitleText, (pageW - subtitleWidth) / 2, yPos)
    yPos += 40

    // PROFESSIONAL PROJECT OVERVIEW SECTION - Matching Template Style
    
    // Blue section header box
    doc.setFillColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
    doc.rect(marginL, yPos, contentW, 30, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Project Overview', marginL + 15, yPos + 20)
    yPos += 40
    
    // White content box with border
    const overviewHeight = 120
    doc.setFillColor(255, 255, 255)
    doc.rect(marginL, yPos, contentW, overviewHeight, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(1)
    doc.rect(marginL, yPos, contentW, overviewHeight, 'S')
    
    // Content inside the box
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
    
    // Project description
    if (project && project.description) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const descLines = doc.splitTextToSize(project.description, contentW - 30)
      doc.text(descLines, marginL + 15, yPos + 20)
    }
    
    // Analysis details
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Analysis Scope:', marginL + 15, yPos + 70)
    
    doc.setFont('helvetica', 'normal')
    const analysisText = `• ${ideaCount} strategic initiatives evaluated`
    doc.text(analysisText, marginL + 15, yPos + 85)
    
    if (filesWithContent.length > 0) {
      const documentsText = `• ${filesWithContent.length} supporting documents analyzed`
      doc.text(documentsText, marginL + 15, yPos + 100)
    }
    
    yPos += overviewHeight + 20
    
    // ANALYSIS SCOPE SECTION - Matching Template
    
    // Blue section header box
    doc.setFillColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
    doc.rect(marginL, yPos, contentW, 30, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Analysis Scope', marginL + 15, yPos + 20)
    yPos += 40
    
    // White content box with border
    const scopeHeight = filesWithContent.length > 0 ? 100 : 60
    doc.setFillColor(255, 255, 255)
    doc.rect(marginL, yPos, contentW, scopeHeight, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(1)
    doc.rect(marginL, yPos, contentW, scopeHeight, 'S')
    
    // Content inside the box
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    
    const scopeText = `Comprehensive analysis of ${ideaCount} strategic initiatives${filesWithContent.length > 0 ? ` informed by ${filesWithContent.length} supporting documents` : ''}.`
    const scopeLines = doc.splitTextToSize(scopeText, contentW - 30)
    doc.text(scopeLines, marginL + 15, yPos + 20)
    
    // Document sources if available
    if (filesWithContent && filesWithContent.length > 0) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Document Sources:', marginL + 15, yPos + 50)
      
      doc.setFont('helvetica', 'normal')
      filesWithContent.slice(0, 3).forEach((file, index) => {
        const fileName = file.original_name || file.name
        doc.text(`• ${fileName} (${file.file_type})`, marginL + 15, yPos + 65 + (index * 12))
      })
      
      if (filesWithContent.length > 3) {
        doc.text(`• ...and ${filesWithContent.length - 3} more documents`, marginL + 15, yPos + 65 + (3 * 12))
      }
    }
    
    yPos += scopeHeight + 20

    // EXECUTIVE SUMMARY - Elegant presentation
    addSectionHeader('Executive Summary', 16, prioritasBlue)
    
    const summaryText = insights.executiveSummary || 'No executive summary available'
    addText(summaryText, 11, 'normal', charcoal, 1.5)
    yPos += 12

    // KEY INSIGHTS - Sophisticated presentation
    addSectionHeader('Key Strategic Insights', 16, prioritasBlue)
    
    const keyInsights = insights.keyInsights || []
    keyInsights.forEach((item: any, i: number) => {
      if (!item) return
      
      pageBreak(75)
      
      // More subtle insight presentation
      const insightHeight = 65
      
      // Very subtle background
      doc.setFillColor(pearl[0], pearl[1], pearl[2])
      doc.roundedRect(marginL, yPos, contentW, insightHeight, 1, 1, 'F')
      
      // Minimal accent line - much thinner
      doc.setFillColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
      doc.rect(marginL, yPos, 1.5, insightHeight, 'F')
      
      // Smaller, more refined number badge
      doc.setFillColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
      doc.circle(marginL + 15, yPos + 20, 6, 'F')
      doc.setTextColor(cream[0], cream[1], cream[2])
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}`, marginL + 13, yPos + 23)
      
      // Clean insight text
      const cleanInsight = (item.insight || 'No insight provided')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '--')
      
      // Insight title with better spacing
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
      const titleLines = doc.splitTextToSize(cleanInsight, contentW - 40)
      doc.text(titleLines, marginL + 25, yPos + 18)
      
      // Impact description with refined positioning
      const cleanImpact = (item.impact || 'No impact provided')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '--')
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(slate[0], slate[1], slate[2])
      const impactLines = doc.splitTextToSize(cleanImpact, contentW - 30)
      doc.text(impactLines, marginL + 10, yPos + 35)
      
      yPos += insightHeight + 10
    })

    // PRIORITY RECOMMENDATIONS - Refined structure
    addSectionHeader('Priority Recommendations', 16, prioritasBlue)

    // Immediate Actions with subtle styling
    addPriorityBadge('Immediate Actions (30 days)', 'immediate')
    const immediate = insights.priorityRecommendations?.immediate || []
    immediate.forEach((item: string) => {
      addBulletPoint(item, 8, [185, 28, 28])
    })
    yPos += 10

    yPos += 12
    
    // Short Term Actions with refined presentation
    addPriorityBadge('Short Term Actions (3 months)', 'short')
    const shortTerm = insights.priorityRecommendations?.shortTerm || []
    shortTerm.forEach((item: string) => {
      addBulletPoint(item, 8, [217, 119, 6])
    })
    yPos += 12

    // Long Term Strategic Initiatives
    addPriorityBadge('Long Term Initiatives (6-12 months)', 'long')
    const longTerm = insights.priorityRecommendations?.longTerm || []
    longTerm.forEach((item: string) => {
      addBulletPoint(item, 8, [30, 64, 175])
    })
    yPos += 20

    // RISK ASSESSMENT & OPPORTUNITIES - Sophisticated analysis
    if (insights.riskAssessment) {
      addSectionHeader('Risk Assessment & Strategic Opportunities', 16, prioritasBlue)
      
      if (insights.riskAssessment.highRisk && insights.riskAssessment.highRisk.length > 0) {
        // Risk areas with subtle warning styling
        doc.setFillColor(pearl[0], pearl[1], pearl[2])
        doc.roundedRect(marginL, yPos, contentW, 25, 2, 2, 'F')
        doc.setFillColor(185, 28, 28)
        doc.rect(marginL, yPos, 1.5, 25, 'F')
        
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(185, 28, 28)
        doc.text('Risk Considerations', marginL + 15, yPos + 16)
        yPos += 35
        
        insights.riskAssessment.highRisk.forEach((risk: string) => {
          addBulletPoint(risk, 8, [185, 28, 28])
        })
        yPos += 12
      }
      
      if (insights.riskAssessment.opportunities && insights.riskAssessment.opportunities.length > 0) {
        // Opportunities with elegant positive styling
        doc.setFillColor(pearl[0], pearl[1], pearl[2])
        doc.roundedRect(marginL, yPos, contentW, 25, 2, 2, 'F')
        doc.setFillColor(22, 163, 74)
        doc.rect(marginL, yPos, 1.5, 25, 'F')
        
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(22, 163, 74)
        doc.text('Strategic Opportunities', marginL + 15, yPos + 16)
        yPos += 35
        
        insights.riskAssessment.opportunities.forEach((opp: string) => {
          addBulletPoint(opp, 8, [22, 163, 74])
        })
        yPos += 15
      }
    }

    // IMPLEMENTATION ROADMAP - Elegant timeline presentation
    if (insights.suggestedRoadmap && insights.suggestedRoadmap.length > 0) {
      addSectionHeader('Implementation Roadmap', 16, prioritasBlue)
      
      insights.suggestedRoadmap.forEach((phase: any, index: number) => {
        pageBreak(60)
        
        // Sophisticated phase presentation
        doc.setFillColor(pearl[0], pearl[1], pearl[2])
        doc.roundedRect(marginL, yPos, contentW, 45, 2, 2, 'F')
        
        // Phase number with elegant circle
        doc.setFillColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
        doc.circle(marginL + 20, yPos + 22, 12, 'F')
        doc.setTextColor(cream[0], cream[1], cream[2])
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`${index + 1}`, marginL + 17, yPos + 26)
        
        // Clean phase title
        const cleanPhase = (phase.phase || '')
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2018\u2019]/g, "'")
          
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
        doc.text(cleanPhase, marginL + 40, yPos + 20)
        
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(steel[0], steel[1], steel[2])
        doc.text(`Duration: ${phase.duration}`, marginL + 40, yPos + 33)
        yPos += 55
        
        // Phase description with refined text handling
        addText(phase.focus, 11, 'normal', slate)
        
        if (phase.ideas && phase.ideas.length > 0) {
          addText('Key Initiatives:', 11, 'bold', charcoal)
          phase.ideas.forEach((idea: string) => {
            addBulletPoint(idea, 12, steel)
          })
        }
        yPos += 12
      })
    }

    // NEXT STEPS - Clean, actionable presentation
    if (insights.nextSteps && insights.nextSteps.length > 0) {
      addSectionHeader('Immediate Next Steps', 16, prioritasBlue)
      
      insights.nextSteps.forEach((step: string, index: number) => {
        pageBreak(30)
        
        // Clean step text first
        const cleanStep = step
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/\u2013/g, '-')
          .replace(/\u2014/g, '--')
        
        // Elegant step container
        doc.setFillColor(pearl[0], pearl[1], pearl[2])
        doc.roundedRect(marginL, yPos, contentW, 25, 2, 2, 'F')
        
        // Refined step number
        doc.setFillColor(prioritasBlue[0], prioritasBlue[1], prioritasBlue[2])
        doc.circle(marginL + 15, yPos + 12, 8, 'F')
        doc.setTextColor(cream[0], cream[1], cream[2])
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(`${index + 1}`, marginL + 12, yPos + 15)
        
        // Step text with sophisticated typography
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(charcoal[0], charcoal[1], charcoal[2])
        const stepLines = doc.splitTextToSize(cleanStep, contentW - 50)
        doc.text(stepLines, marginL + 30, yPos + 15)
        yPos += Math.max(25, stepLines.length * 12) + 8
      })
    }

    // Add footer to final page
    addFooter(doc.getNumberOfPages())

    // Add footer to all pages
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      addFooter(i)
    }

    // Professional filename with proper character handling
    const timestamp = new Date().toISOString().split('T')[0]
    let cleanProjectName = ''
    if (project && project.name) {
      cleanProjectName = project.name
        .replace(/[\u201C\u201D]/g, '')
        .replace(/[\u2018\u2019]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30) // Limit length
    }
    const projectPrefix = cleanProjectName ? `${cleanProjectName}_` : ''
    const fileName = `${projectPrefix}Prioritas_Strategic_Insights_${timestamp}.pdf`
    doc.save(fileName)

  } catch (error) {
    console.error('PDF export failed:', error)
    alert('PDF export failed. Please try again.')
  }
}