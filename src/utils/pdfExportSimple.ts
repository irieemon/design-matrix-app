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
    pageBreak(40)
    addText('TABLE OF CONTENTS', 16, 'bold', [102, 16, 242])
    yPos += 5
    addText('1. Executive Summary', 11)
    addText('2. Technical Requirements & Architecture', 11)
    addText('3. Implementation Phases (Detailed)', 11)
    addText('4. Resource Requirements & Team Structure', 11)
    addText('5. Risk Management & Mitigation', 11)
    addText('6. Quality Assurance & Testing Strategy', 11)
    addText('7. Deployment & Operations Plan', 11)
    addText('8. Success Metrics & KPIs', 11)
    yPos += 15

    // 1. EXECUTIVE SUMMARY
    pageBreak(50)
    addText('1. EXECUTIVE SUMMARY', 16, 'bold', [220, 53, 69])
    yPos += 5

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
    addText(`• ${phases.length} Development Phases`, 10)
    addText(`• ${totalEpics} Major Epics/Features`, 10)
    addText(`• ${totalDeliverables} Specific Deliverables`, 10)
    yPos += 10

    // 2. TECHNICAL REQUIREMENTS
    pageBreak(40)
    addText('2. TECHNICAL REQUIREMENTS & ARCHITECTURE', 16, 'bold', [220, 53, 69])
    yPos += 5

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
    yPos += 15

    // 3. DETAILED IMPLEMENTATION PHASES
    pageBreak(50)
    addText('3. IMPLEMENTATION PHASES (DETAILED)', 16, 'bold', [220, 53, 69])
    yPos += 10

    phases.forEach((phase, phaseIndex) => {
      if (!phase) return
      
      pageBreak(60)
      
      // Phase Header with detailed info
      addText(`PHASE ${phaseIndex + 1}: ${phase.phase?.toUpperCase() || 'UNNAMED PHASE'}`, 14, 'bold', [102, 16, 242])
      addText(`Duration: ${phase.duration || 'TBD'} | Priority: HIGH`, 11, 'bold')
      yPos += 5
      
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
    pageBreak(50)
    addText('4. RESOURCE REQUIREMENTS & TEAM STRUCTURE', 16, 'bold', [220, 53, 69])
    yPos += 5

    addText('Recommended Team Composition:', 12, 'bold')
    addText('• Product Owner: 1 (full-time)', 10)
    addText('• Technical Lead/Architect: 1 (full-time)', 10)
    addText('• Senior Frontend Developer: 1-2 (full-time)', 10)
    addText('• Backend Developer: 1-2 (full-time)', 10)
    addText('• UI/UX Designer: 1 (as needed)', 10)
    addText('• QA Engineer: 1 (full-time)', 10)
    addText('• DevOps Engineer: 1 (part-time/consultancy)', 10)
    yPos += 8

    addText('Infrastructure & Tools Required:', 12, 'bold')
    addText('• Development environments (local + staging)', 10)
    addText('• Version control system (GitHub/GitLab)', 10)
    addText('• CI/CD pipeline setup', 10)
    addText('• Project management tools (Jira/Linear)', 10)
    addText('• Communication tools (Slack/Teams)', 10)
    addText('• Code review and quality gates', 10)
    yPos += 10

    // 5. KEY MILESTONES
    pageBreak(40)
    addText('5. KEY MILESTONES & DELIVERABLES', 16, 'bold', [220, 53, 69])
    yPos += 5

    const milestones = roadmapData.executionStrategy?.keyMilestones || []
    if (milestones.length > 0) {
      milestones.forEach((milestone, msIndex) => {
        if (!milestone) return
        pageBreak(15)
        addText(`Milestone ${msIndex + 1}: ${milestone.milestone || 'TBD'}`, 12, 'bold', [13, 110, 253])
        addText(`Timeline: ${milestone.timeline || 'TBD'}`, 10, 'bold')
        addText(milestone.description || 'Description to be defined', 10)
        yPos += 5
      })
    } else {
      addText('Key Milestones (Template):', 12, 'bold')
      phases.forEach((phase, pIndex) => {
        addText(`Phase ${pIndex + 1} Completion: ${phase.phase} (${phase.duration})`, 10)
      })
    }
    yPos += 10

    // 6. TESTING & QUALITY ASSURANCE
    pageBreak(40)
    addText('6. QUALITY ASSURANCE & TESTING STRATEGY', 16, 'bold', [220, 53, 69])
    yPos += 5

    addText('Testing Approach:', 12, 'bold')
    addText('• Unit Testing: Jest/Vitest for component testing', 10)
    addText('• Integration Testing: API and database integration', 10)
    addText('• End-to-End Testing: Cypress/Playwright for user flows', 10)
    addText('• Performance Testing: Load testing for scalability', 10)
    addText('• Security Testing: Vulnerability scanning', 10)
    addText('• User Acceptance Testing: Stakeholder validation', 10)
    yPos += 8

    addText('Quality Gates:', 12, 'bold')
    addText('• Code review approval required for all changes', 10)
    addText('• Minimum 80% test coverage requirement', 10)
    addText('• Performance benchmarks must be met', 10)
    addText('• Security scan clearance required', 10)
    yPos += 10

    // 7. DEPLOYMENT PLAN
    pageBreak(30)
    addText('7. DEPLOYMENT & OPERATIONS PLAN', 16, 'bold', [220, 53, 69])
    yPos += 5

    addText('Deployment Strategy:', 12, 'bold')
    addText('• Blue-Green deployment for zero-downtime updates', 10)
    addText('• Automated deployment pipeline with rollback capability', 10)
    addText('• Environment progression: Dev → Staging → Production', 10)
    addText('• Database migration strategy with backup procedures', 10)
    yPos += 8

    addText('Monitoring & Maintenance:', 12, 'bold')
    addText('• Application performance monitoring (APM)', 10)
    addText('• Error tracking and logging system', 10)
    addText('• Automated backup and disaster recovery', 10)
    addText('• Regular security updates and patches', 10)
    yPos += 10

    // 8. SUCCESS METRICS & KPIS
    pageBreak(40)
    addText('8. SUCCESS METRICS & KPIS', 16, 'bold', [220, 53, 69])
    yPos += 5
    
    addText('Key Performance Indicators:', 12, 'bold')
    addText('• Project Delivery Metrics:', 11, 'bold')
    addText('  - On-time delivery percentage (Target: 95%)', 10)
    addText('  - Budget adherence (Target: within 10% of budget)', 10)
    addText('  - Scope change requests (Target: < 15% change)', 10)
    yPos += 5
    
    addText('• Quality Metrics:', 11, 'bold')
    addText('  - Code coverage percentage (Target: 80%+)', 10)
    addText('  - Bug resolution time (Target: < 2 days for critical)', 10)
    addText('  - Performance benchmarks (Load time < 2 seconds)', 10)
    yPos += 5
    
    addText('• User Adoption Metrics:', 11, 'bold')
    addText('  - User satisfaction score (Target: 4.5/5)', 10)
    addText('  - Feature adoption rate (Target: 70% within 30 days)', 10)
    addText('  - System uptime (Target: 99.9%)', 10)
    yPos += 10

    // IMMEDIATE NEXT STEPS
    pageBreak(50)
    addText('IMMEDIATE NEXT STEPS FOR IMPLEMENTATION', 16, 'bold', [102, 16, 242])
    yPos += 5

    addText('Week 1: Project Foundation', 14, 'bold', [25, 135, 84])
    addText('• Assemble development team and assign roles', 10)
    addText('• Set up development environments and tools', 10)
    addText('• Create project repositories and initial structure', 10)
    addText('• Finalize technical architecture decisions', 10)
    addText('• Establish communication channels and workflows', 10)
    yPos += 8

    addText('Week 2: Requirements & Planning', 14, 'bold', [25, 135, 84])
    addText('• Review and validate all user stories with stakeholders', 10)
    addText('• Create detailed wireframes and user interface mockups', 10)
    addText('• Define comprehensive API specifications', 10)
    addText('• Establish coding standards, guidelines, and best practices', 10)
    addText('• Set up CI/CD pipeline and deployment processes', 10)
    yPos += 8

    addText('Week 3+: Sprint Execution', 14, 'bold', [25, 135, 84])
    addText('• Break down epics into specific development tasks', 10)
    addText('• Estimate effort using story points or time estimates', 10)
    addText('• Begin first development sprint with highest priority items', 10)
    addText('• Establish daily standup and weekly review cadence', 10)
    addText('• Implement continuous testing and quality assurance', 10)

    // FINAL FOOTER SECTION
    pageBreak(30)
    addText('PROJECT READINESS CHECKLIST', 14, 'bold', [220, 53, 69])
    yPos += 5
    
    addText('□ Development team assembled and onboarded', 11)
    addText('□ Project requirements documented and approved', 11)
    addText('□ Technical architecture finalized', 11)
    addText('□ Development environment configured', 11)
    addText('□ Version control and CI/CD established', 11)
    addText('□ Quality standards and processes defined', 11)
    addText('□ Communication channels established', 11)
    addText('□ First sprint planned and ready to begin', 11)
    yPos += 10
    
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