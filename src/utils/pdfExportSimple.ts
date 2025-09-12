import jsPDF from 'jspdf'
import { Project, RoadmapData } from '../types'

export const exportRoadmapToPDF = (roadmapData: RoadmapData, ideaCount: number, project: Project | null = null) => {
  try {
    const doc = new jsPDF()
    let yPos = 20
    const pageH = doc.internal.pageSize.height
    const pageW = doc.internal.pageSize.width
    const marginL = 20
    const marginR = 20
    const contentW = pageW - marginL - marginR

    // Simple page break function
    const pageBreak = (space: number) => {
      if (yPos + space > pageH - 20) {
        doc.addPage()
        yPos = 20
      }
    }

    // Helper function for wrapped text with proper spacing
    const addText = (text: string, fontSize: number = 10, fontStyle: string = 'normal', color: number[] = [0, 0, 0]) => {
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', fontStyle)
      doc.setTextColor(color[0], color[1], color[2])
      const lines = doc.splitTextToSize(text, contentW)
      doc.text(lines, marginL, yPos)
      yPos += lines.length * (fontSize * 0.4) + 4
      return lines.length
    }

    // Helper function for section dividers
    const addSectionDivider = () => {
      pageBreak(15)
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(marginL, yPos, pageW - marginR, yPos)
      yPos += 10
    }

    // Helper function for decorative headers with background
    const addDecorativeHeader = (text: string, fontSize: number = 16, bgColor: number[] = [102, 16, 242]) => {
      pageBreak(25)
      // Background rectangle
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2])
      doc.rect(marginL - 5, yPos - 8, contentW + 10, fontSize + 6, 'F')
      // White text on colored background
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', 'bold')
      doc.text(text, marginL, yPos + fontSize/2)
      doc.setTextColor(0, 0, 0)
      yPos += fontSize + 10
    }

    // Helper function for creating simple tables
    const addTable = (headers: string[], rows: string[][], cellWidth: number = 50) => {
      pageBreak(20 + rows.length * 8)
      
      // Draw header row
      doc.setFillColor(240, 240, 240)
      doc.rect(marginL, yPos, headers.length * cellWidth, 8, 'F')
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.3)
      doc.rect(marginL, yPos, headers.length * cellWidth, 8, 'S')
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      headers.forEach((header, i) => {
        doc.text(header, marginL + 2 + (i * cellWidth), yPos + 6)
      })
      yPos += 8
      
      // Draw data rows
      doc.setFont('helvetica', 'normal')
      rows.forEach(row => {
        doc.rect(marginL, yPos, headers.length * cellWidth, 8, 'S')
        row.forEach((cell, i) => {
          const cellText = doc.splitTextToSize(cell, cellWidth - 4)
          doc.text(cellText[0] || '', marginL + 2 + (i * cellWidth), yPos + 6)
        })
        yPos += 8
      })
      yPos += 5
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
    addDecorativeHeader('TABLE OF CONTENTS', 16, [102, 16, 242])
    addText('1. Executive Summary', 11)
    addText('2. Technical Requirements & Architecture', 11)
    addText('3. Implementation Phases (Detailed)', 11)
    addText('4. Resource Requirements & Team Structure', 11)
    addText('5. Quality Assurance & Testing Strategy', 11)
    addText('6. Deployment & Operations Plan', 11)
    addText('7. Success Metrics & KPIs', 11)
    addSectionDivider()

    // 1. EXECUTIVE SUMMARY
    addDecorativeHeader('1. EXECUTIVE SUMMARY', 16, [220, 53, 69])

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
    addTable(summaryHeaders, summaryRows, 60)
    addSectionDivider()

    // 2. TECHNICAL REQUIREMENTS
    addDecorativeHeader('2. TECHNICAL REQUIREMENTS & ARCHITECTURE', 16, [220, 53, 69])

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
    addDecorativeHeader('3. IMPLEMENTATION PHASES (DETAILED)', 16, [220, 53, 69])

    phases.forEach((phase, phaseIndex) => {
      if (!phase) return
      
      const phaseName = getPhaseDisplayName(phase, phaseIndex)
      
      pageBreak(60)
      
      // Phase Header with colored background
      addDecorativeHeader(`PHASE ${phaseIndex + 1}: ${phaseName.toUpperCase()}`, 14, [102, 16, 242])
      
      // Phase info table
      const phaseHeaders = ['Attribute', 'Details']
      const phaseRows = [
        ['Duration', phase.duration || 'To be determined'],
        ['Priority', 'HIGH'],
        ['Status', 'Planning Phase'],
        ['Dependencies', phaseIndex === 0 ? 'None - Foundation Phase' : `Phase ${phaseIndex} Completion`]
      ]
      addTable(phaseHeaders, phaseRows, 90)
      
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
    addDecorativeHeader('4. RESOURCE REQUIREMENTS & TEAM STRUCTURE', 16, [220, 53, 69])

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
    addTable(teamHeaders, teamRows, 55)

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
    addDecorativeHeader('5. KEY MILESTONES & DELIVERABLES', 16, [220, 53, 69])

    const milestones = roadmapData.executionStrategy?.keyMilestones || []
    if (milestones.length > 0) {
      // Create milestones table
      const milestoneHeaders = ['Milestone', 'Timeline', 'Description']
      const milestoneRows = milestones.map((milestone, msIndex) => [
        `M${msIndex + 1}: ${milestone?.milestone || 'TBD'}`,
        milestone?.timeline || 'TBD',
        (milestone?.description || 'Description to be defined').substring(0, 50) + '...'
      ])
      addTable(milestoneHeaders, milestoneRows, 60)
    } else {
      addText('Key Milestones (Generated from Phases):', 12, 'bold')
      // Create phase-based milestones table
      const phaseHeaders = ['Phase', 'Milestone', 'Duration']
      const phaseRows = phases.map((phase, pIndex) => [
        `Phase ${pIndex + 1}`,
        `${getPhaseDisplayName(phase, pIndex)} Complete`,
        phase.duration || 'TBD'
      ])
      addTable(phaseHeaders, phaseRows, 60)
    }

    // 6. TESTING & QUALITY ASSURANCE
    addSectionDivider()
    addDecorativeHeader('6. QUALITY ASSURANCE & TESTING STRATEGY', 16, [220, 53, 69])

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
    addTable(testingHeaders, testingRows, 45)

    addText('Quality Gates Checklist:', 12, 'bold')
    addText('✓ Code review approval required for all changes', 10)
    addText('✓ Minimum 80% test coverage requirement', 10)
    addText('✓ Performance benchmarks must be met', 10)
    addText('✓ Security scan clearance required', 10)

    // 7. DEPLOYMENT PLAN
    addSectionDivider()
    addDecorativeHeader('7. DEPLOYMENT & OPERATIONS PLAN', 16, [220, 53, 69])

    addText('Deployment Strategy Overview:', 12, 'bold')
    
    // Deployment environments table
    const deployHeaders = ['Environment', 'Purpose', 'Deployment Method', 'Approval Required']
    const deployRows = [
      ['Development', 'Feature development', 'Auto on push', 'Code review'],
      ['Staging', 'Integration testing', 'Manual trigger', 'QA approval'],
      ['Production', 'Live system', 'Blue-Green deploy', 'Product owner']
    ]
    addTable(deployHeaders, deployRows, 45)

    addText('Operations & Monitoring:', 12, 'bold')
    addText('• Application performance monitoring (APM)', 10)
    addText('• Error tracking and logging system', 10)
    addText('• Automated backup and disaster recovery', 10)
    addText('• Regular security updates and patches', 10)
    addSectionDivider()

    // 8. SUCCESS METRICS & KPIS
    addDecorativeHeader('8. SUCCESS METRICS & KPIS', 16, [220, 53, 69])
    
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
    addTable(kpiHeaders, kpiRows, 45)

    // IMMEDIATE NEXT STEPS
    addSectionDivider()
    addDecorativeHeader('IMMEDIATE NEXT STEPS FOR IMPLEMENTATION', 16, [102, 16, 242])

    // Implementation timeline table
    const timelineHeaders = ['Phase', 'Duration', 'Key Activities', 'Deliverables']
    const timelineRows = [
      ['Project Setup', 'Week 1', 'Team assembly, environment setup', 'Dev environment, team structure'],
      ['Planning', 'Week 2', 'Requirements review, design', 'Wireframes, API specs'],
      ['Development', 'Week 3+', 'Sprint execution, testing', 'Working software, documentation']
    ]
    addTable(timelineHeaders, timelineRows, 45)

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
    addDecorativeHeader('PROJECT READINESS CHECKLIST', 14, [220, 53, 69])
    
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
    addTable(checklistHeaders, checklistRows, 60)
    
    addText('For questions or clarification on this roadmap, contact the project team.', 10, 'italic', [128, 128, 128])
    addText('This document should be reviewed and updated regularly as the project progresses.', 10, 'italic', [128, 128, 128])

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

export const exportInsightsToPDF = (insights: any, ideaCount: number, project: Project | null = null) => {
  try {
    const doc = new jsPDF()
    let yPos = 20
    const pageH = doc.internal.pageSize.height
    const marginL = 20

    // Simple page break function
    const pageBreak = (space: number) => {
      if (yPos + space > pageH - 20) {
        doc.addPage()
        yPos = 20
      }
    }

    // Header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    const reportTitle = project ? `${project.name} - Strategic Insights Report` : 'AI Strategic Insights Report'
    doc.text(reportTitle, marginL, yPos)
    yPos = yPos + 8

    if (project && project.description) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(64, 64, 64)
      const descLines = doc.splitTextToSize(project.description, 170)
      doc.text(descLines, marginL, yPos)
      yPos = yPos + (descLines.length * 4) + 6
      doc.setTextColor(0, 0, 0)
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Analysis of ${ideaCount} ideas • Generated on ${new Date().toLocaleDateString()}`, marginL, yPos)
    yPos = yPos + 20

    // Executive Summary
    pageBreak(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Executive Summary', marginL, yPos)
    yPos = yPos + 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const summaryText = insights.executiveSummary || 'No summary available'
    const summaryLines = doc.splitTextToSize(summaryText, 170)
    doc.text(summaryLines, marginL, yPos)
    yPos = yPos + (summaryLines.length * 4) + 15

    // Key Insights
    pageBreak(40)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Key Insights', marginL, yPos)
    yPos = yPos + 10

    const keyInsights = insights.keyInsights || []
    for (let i = 0; i < keyInsights.length; i++) {
      const item = keyInsights[i]
      if (!item) continue
      
      pageBreak(25)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      const insightText = `${i + 1}. ${item.insight || 'No insight provided'}`
      const insightLines = doc.splitTextToSize(insightText, 170)
      doc.text(insightLines, marginL, yPos)
      yPos = yPos + (insightLines.length * 4) + 4
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const impactText = `Impact: ${item.impact || 'No impact provided'}`
      const impactLines = doc.splitTextToSize(impactText, 165)
      doc.text(impactLines, marginL + 5, yPos)
      yPos = yPos + (impactLines.length * 3) + 8
    }

    yPos = yPos + 10

    // Priority Recommendations
    pageBreak(50)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Priority Recommendations', marginL, yPos)
    yPos = yPos + 15

    // Immediate (30 days)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 53, 69)
    doc.text('Immediate Actions (30 days)', marginL, yPos)
    doc.setTextColor(0, 0, 0)
    yPos = yPos + 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const immediate = insights.priorityRecommendations?.immediate || []
    for (let i = 0; i < immediate.length; i++) {
      pageBreak(15)
      const itemLines = doc.splitTextToSize(`• ${immediate[i]}`, 165)
      doc.text(itemLines, marginL + 5, yPos)
      yPos = yPos + (itemLines.length * 3) + 3
    }
    yPos = yPos + 8

    // Short Term (3 months)
    pageBreak(20)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 193, 7)
    doc.text('Short Term Actions (3 months)', marginL, yPos)
    doc.setTextColor(0, 0, 0)
    yPos = yPos + 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const shortTerm = insights.priorityRecommendations?.shortTerm || []
    for (let i = 0; i < shortTerm.length; i++) {
      pageBreak(15)
      const itemLines = doc.splitTextToSize(`• ${shortTerm[i]}`, 165)
      doc.text(itemLines, marginL + 5, yPos)
      yPos = yPos + (itemLines.length * 3) + 3
    }
    yPos = yPos + 8

    // Long Term (6-12 months)
    pageBreak(20)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(13, 110, 253)
    doc.text('Long Term Strategic Initiatives (6-12 months)', marginL, yPos)
    doc.setTextColor(0, 0, 0)
    yPos = yPos + 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const longTerm = insights.priorityRecommendations?.longTerm || []
    for (let i = 0; i < longTerm.length; i++) {
      pageBreak(15)
      const itemLines = doc.splitTextToSize(`• ${longTerm[i]}`, 165)
      doc.text(itemLines, marginL + 5, yPos)
      yPos = yPos + (itemLines.length * 3) + 3
    }
    yPos = yPos + 15

    // Next Steps
    pageBreak(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Immediate Next Steps', marginL, yPos)
    yPos = yPos + 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const nextSteps = insights.nextSteps || []
    for (let i = 0; i < nextSteps.length; i++) {
      pageBreak(15)
      const stepText = `${i + 1}. ${nextSteps[i]}`
      const stepLines = doc.splitTextToSize(stepText, 165)
      doc.text(stepLines, marginL + 5, yPos)
      yPos = yPos + (stepLines.length * 3) + 5
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(`Generated by Prioritas AI • Page ${i} of ${totalPages}`, marginL, pageH - 10)
      doc.text(new Date().toLocaleDateString(), 180, pageH - 10)
    }

    // Save the PDF
    const projectPrefix = project ? `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''
    const fileName = `${projectPrefix}AI_Insights_Report_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)

  } catch (error) {
    console.error('PDF export failed:', error)
    alert('PDF export failed. Please try again.')
  }
}