import jsPDF from 'jspdf'
import { Project, RoadmapData } from '../types'

export const exportRoadmapToPDF = (roadmapData: RoadmapData, ideaCount: number, project: Project | null = null) => {
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
    const title = project ? `${project.name} - Project Roadmap` : 'AI Project Roadmap'
    doc.text(title, marginL, yPos)
    yPos = yPos + 8

    if (project && project.description) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(64, 64, 64)
      doc.text(project.description, marginL, yPos)
      yPos = yPos + 6
      doc.setTextColor(0, 0, 0)
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Analysis of ${ideaCount} ideas • Generated on ${new Date().toLocaleDateString()}`, marginL, yPos)
    yPos = yPos + 8

    doc.setFontSize(10)
    doc.setTextColor(64, 64, 64)
    doc.text(`Total Duration: ${roadmapData.roadmapAnalysis?.totalDuration || 'N/A'}`, marginL, yPos)
    yPos = yPos + 20

    // Project Phases
    pageBreak(40)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('Implementation Roadmap', marginL, yPos)
    yPos = yPos + 15

    // Process phases
    const phases = roadmapData.roadmapAnalysis?.phases || []
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i]
      if (!phase) continue
      
      pageBreak(60)
      
      // Phase Header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(102, 16, 242)
      doc.text(`${phase.phase || 'Unknown Phase'} (${phase.duration || 'Unknown Duration'})`, marginL, yPos)
      doc.setTextColor(0, 0, 0)
      yPos = yPos + 10

      // Phase Description
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const description = phase.description || 'No description available'
      const descLines = doc.splitTextToSize(description, 170)
      doc.text(descLines, marginL + 5, yPos)
      yPos = yPos + (descLines.length * 4) + 8

      // Phase Epics
      if (phase.epics && phase.epics.length > 0) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Key Epics:', marginL + 5, yPos)
        yPos = yPos + 8

        for (let j = 0; j < phase.epics.length; j++) {
          const epic = phase.epics[j]
          if (!epic) continue
          
          pageBreak(25)
          
          // Epic Title
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(13, 110, 253)
          const epicTitle = `${j + 1}. ${epic.title || 'Untitled Epic'} (${epic.priority || 'unknown'} priority)`
          doc.text(epicTitle, marginL + 10, yPos)
          doc.setTextColor(0, 0, 0)
          yPos = yPos + 6

          // Epic Description
          if (epic.description) {
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            const epicDescLines = doc.splitTextToSize(epic.description, 160)
            doc.text(epicDescLines, marginL + 15, yPos)
            yPos = yPos + (epicDescLines.length * 3) + 4
          }

          // User Stories
          if (epic.userStories && epic.userStories.length > 0) {
            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            doc.text('User Stories:', marginL + 15, yPos)
            yPos = yPos + 4
            
            doc.setFont('helvetica', 'normal')
            for (let k = 0; k < epic.userStories.length && k < 3; k++) {
              pageBreak(8)
              doc.text(`• ${epic.userStories[k]}`, marginL + 20, yPos)
              yPos = yPos + 4
            }
            yPos = yPos + 3
          }

          // Deliverables
          if (epic.deliverables && epic.deliverables.length > 0) {
            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            doc.text('Deliverables:', marginL + 15, yPos)
            yPos = yPos + 4
            
            doc.setFont('helvetica', 'normal')
            for (let k = 0; k < epic.deliverables.length && k < 3; k++) {
              pageBreak(8)
              doc.text(`• ${epic.deliverables[k]}`, marginL + 20, yPos)
              yPos = yPos + 4
            }
            yPos = yPos + 5
          }
        }
      }

      // Risks
      if (phase.risks && phase.risks.length > 0) {
        pageBreak(20)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(220, 53, 69)
        doc.text('Risks:', marginL + 5, yPos)
        doc.setTextColor(0, 0, 0)
        yPos = yPos + 8

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        for (let j = 0; j < phase.risks.length && j < 3; j++) {
          pageBreak(8)
          doc.text(`• ${phase.risks[j]}`, marginL + 10, yPos)
          yPos = yPos + 5
        }
        yPos = yPos + 5
      }

      // Success Criteria
      if (phase.successCriteria && phase.successCriteria.length > 0) {
        pageBreak(20)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(25, 135, 84)
        doc.text('Success Criteria:', marginL + 5, yPos)
        doc.setTextColor(0, 0, 0)
        yPos = yPos + 8

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        for (let j = 0; j < phase.successCriteria.length && j < 3; j++) {
          pageBreak(8)
          doc.text(`• ${phase.successCriteria[j]}`, marginL + 10, yPos)
          yPos = yPos + 5
        }
      }

      // Add spacing between phases
      yPos = yPos + 15
    }

    // Execution Strategy
    pageBreak(50)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Execution Strategy', marginL, yPos)
    yPos = yPos + 15

    // Methodology
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(102, 16, 242)
    doc.text(`Methodology: ${roadmapData.executionStrategy?.methodology || 'N/A'}`, marginL, yPos)
    doc.setTextColor(0, 0, 0)
    yPos = yPos + 10

    // Sprint Length
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Sprint Length: ${roadmapData.executionStrategy?.sprintLength || 'N/A'}`, marginL, yPos)
    yPos = yPos + 15

    // Team Recommendations
    pageBreak(20)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Team Recommendations', marginL, yPos)
    yPos = yPos + 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const teamRec = roadmapData.executionStrategy?.teamRecommendations || 'No team recommendations available'
    const teamRecLines = doc.splitTextToSize(teamRec, 170)
    doc.text(teamRecLines, marginL + 5, yPos)
    yPos = yPos + (teamRecLines.length * 4) + 15

    // Key Milestones
    pageBreak(30)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Key Milestones', marginL, yPos)
    yPos = yPos + 10

    const milestones = roadmapData.executionStrategy?.keyMilestones || []
    for (let i = 0; i < milestones.length; i++) {
      const milestone = milestones[i]
      if (!milestone) continue
      
      pageBreak(15)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(13, 110, 253)
      doc.text(`${i + 1}. ${milestone.milestone || 'Untitled Milestone'} (${milestone.timeline || 'Unknown Timeline'})`, marginL + 5, yPos)
      doc.setTextColor(0, 0, 0)
      yPos = yPos + 6

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const milestoneDesc = milestone.description || 'No description available'
      const milestoneLines = doc.splitTextToSize(milestoneDesc, 160)
      doc.text(milestoneLines, marginL + 10, yPos)
      yPos = yPos + (milestoneLines.length * 3) + 8
    }

    // Footer
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
    const fileName = `${projectPrefix}Project_Roadmap_${new Date().toISOString().split('T')[0]}.pdf`
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