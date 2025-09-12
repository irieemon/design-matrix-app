// @ts-nocheck
import jsPDF from 'jspdf'
import { Project, RoadmapData } from '../types'

interface InsightsReport {
  executiveSummary: string
  keyInsights: Array<{
    insight: string
    impact: string
  }>
  priorityRecommendations: {
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
  }
  riskAssessment: {
    highRisk: string[]
    opportunities: string[]
  }
  suggestedRoadmap: Array<{
    phase: string
    duration: string
    focus: string
    ideas: string[]
  }>
  resourceAllocation: {
    quickWins: string
    strategic: string
  }
  nextSteps: string[]
}

export const exportInsightsToPDF = (insights: InsightsReport, ideaCount: number, project: Project | null = null) => {
  const doc = new jsPDF()
  let yPosition = 20
  const pageHeight = doc.internal.pageSize.height
  const pageWidth = doc.internal.pageSize.width
  const marginLeft = 20
  const marginRight = 20
  const contentWidth = pageWidth - marginLeft - marginRight

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredSpace: number = 15) => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage()
      yPosition = 20
    }
  }

  // Helper function to add wrapped text
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, x, y)
    return lines.length * (fontSize * 0.6) // Return height used
  }

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  const reportTitle = project ? `${project.name} - Strategic Insights Report` : 'AI Strategic Insights Report'
  doc.text(reportTitle, marginLeft, yPosition)
  yPosition += 8

  if (project && project.description) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(64, 64, 64) // Gray color
    const descHeight = addWrappedText(project.description, marginLeft, yPosition, contentWidth, 12)
    yPosition += descHeight + 6
    doc.setTextColor(0, 0, 0) // Reset to black
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Analysis of ${ideaCount} ideas • Generated on ${new Date().toLocaleDateString()}`, marginLeft, yPosition)
  yPosition += 20

  // Executive Summary
  checkPageBreak(30)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Executive Summary', marginLeft, yPosition)
  yPosition += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const summaryHeight = addWrappedText(insights.executiveSummary, marginLeft, yPosition, contentWidth)
  yPosition += summaryHeight + 15

  // Key Insights
  checkPageBreak(40)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Key Insights', marginLeft, yPosition)
  yPosition += 10

  (insights.keyInsights || []).forEach((item, index) => {
    checkPageBreak(25)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    const insightHeight = addWrappedText(`${index + 1}. ${item.insight}`, marginLeft, yPosition, contentWidth, 11)
    yPosition += insightHeight + 4
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const impactHeight = addWrappedText(`Impact: ${item.impact}`, marginLeft + 5, yPosition, contentWidth - 5)
    yPosition += impactHeight + 8
  })

  yPosition += 10

  // Priority Recommendations
  checkPageBreak(50)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Priority Recommendations', marginLeft, yPosition)
  yPosition += 15

  // Immediate (30 days)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(220, 53, 69) // Red color
  doc.text('Immediate Actions (30 days)', marginLeft, yPosition)
  doc.setTextColor(0, 0, 0) // Reset to black
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  (insights.priorityRecommendations.immediate || []).forEach((item) => {
    checkPageBreak(15)
    const itemHeight = addWrappedText(`• ${item}`, marginLeft + 5, yPosition, contentWidth - 5)
    yPosition += itemHeight + 3
  })
  yPosition += 8

  // Short Term (3 months)
  checkPageBreak(20)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 193, 7) // Amber color
  doc.text('Short Term Actions (3 months)', marginLeft, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  (insights.priorityRecommendations.shortTerm || []).forEach((item) => {
    checkPageBreak(15)
    const itemHeight = addWrappedText(`• ${item}`, marginLeft + 5, yPosition, contentWidth - 5)
    yPosition += itemHeight + 3
  })
  yPosition += 8

  // Long Term (6-12 months)
  checkPageBreak(20)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 110, 253) // Blue color
  doc.text('Long Term Strategic Initiatives (6-12 months)', marginLeft, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  (insights.priorityRecommendations.longTerm || []).forEach((item) => {
    checkPageBreak(15)
    const itemHeight = addWrappedText(`• ${item}`, marginLeft + 5, yPosition, contentWidth - 5)
    yPosition += itemHeight + 3
  })
  yPosition += 15

  // Risk Assessment
  checkPageBreak(50)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Risk Assessment', marginLeft, yPosition)
  yPosition += 15

  // High Risk Areas
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(220, 53, 69) // Red
  doc.text('High Risk Areas', marginLeft, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  (insights.riskAssessment.highRisk || []).forEach((risk) => {
    checkPageBreak(15)
    const riskHeight = addWrappedText(`• ${risk}`, marginLeft + 5, yPosition, contentWidth - 5)
    yPosition += riskHeight + 3
  })
  yPosition += 10

  // Key Opportunities
  checkPageBreak(20)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(25, 135, 84) // Green
  doc.text('Key Opportunities', marginLeft, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  (insights.riskAssessment.opportunities || []).forEach((opportunity) => {
    checkPageBreak(15)
    const oppHeight = addWrappedText(`• ${opportunity}`, marginLeft + 5, yPosition, contentWidth - 5)
    yPosition += oppHeight + 3
  })
  yPosition += 15

  // Implementation Roadmap
  checkPageBreak(50)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Implementation Roadmap', marginLeft, yPosition)
  yPosition += 15

  (insights.suggestedRoadmap || []).forEach((phase) => {
    checkPageBreak(30)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(102, 16, 242) // Purple
    doc.text(`${phase.phase} (${phase.duration})`, marginLeft, yPosition)
    doc.setTextColor(0, 0, 0)
    yPosition += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const focusHeight = addWrappedText(phase.focus, marginLeft + 5, yPosition, contentWidth - 5)
    yPosition += focusHeight + 8

    if ((phase.ideas || []).length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.text('Key Ideas:', marginLeft + 5, yPosition)
      yPosition += 6
      
      doc.setFont('helvetica', 'normal')
      (phase.ideas || []).forEach((idea: string) => {
        checkPageBreak(10)
        doc.text(`• ${idea}`, marginLeft + 10, yPosition)
        yPosition += 5
      })
    }
    yPosition += 10
  })

  // Resource Allocation
  checkPageBreak(30)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Resource Allocation', marginLeft, yPosition)
  yPosition += 15

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(25, 135, 84) // Green
  doc.text('Quick Wins Strategy', marginLeft, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const quickWinsHeight = addWrappedText(insights.resourceAllocation.quickWins, marginLeft + 5, yPosition, contentWidth - 5)
  yPosition += quickWinsHeight + 12

  checkPageBreak(20)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 110, 253) // Blue
  doc.text('Strategic Initiatives', marginLeft, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const strategicHeight = addWrappedText(insights.resourceAllocation.strategic, marginLeft + 5, yPosition, contentWidth - 5)
  yPosition += strategicHeight + 15

  // Next Steps
  checkPageBreak(30)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Immediate Next Steps', marginLeft, yPosition)
  yPosition += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  (insights.nextSteps || []).forEach((step, index) => {
    checkPageBreak(15)
    const stepHeight = addWrappedText(`${index + 1}. ${step}`, marginLeft + 5, yPosition, contentWidth - 5)
    yPosition += stepHeight + 5
  })

  // Footer on last page
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128) // Gray
    doc.text(`Generated by Prioritas AI • Page ${i} of ${totalPages}`, marginLeft, pageHeight - 10)
    doc.text(new Date().toLocaleDateString(), pageWidth - marginRight - 30, pageHeight - 10)
  }

  // Save the PDF
  const projectPrefix = project ? `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''
  const fileName = `${projectPrefix}AI_Insights_Report_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

export const exportRoadmapToPDF = (roadmapData: RoadmapData, ideaCount: number, project: Project | null = null) => {
  console.log('🔍 exportRoadmapToPDF called with:', {
    roadmapData: roadmapData,
    roadmapDataType: typeof roadmapData,
    ideaCount: ideaCount,
    ideaCountType: typeof ideaCount,
    project: project
  })
  
  const doc = new jsPDF()
  let yPosition = 20
  const pageHeight = doc.internal.pageSize.height
  const pageWidth = doc.internal.pageSize.width
  const marginLeft = 20
  const marginRight = 20
  const contentWidth = pageWidth - marginLeft - marginRight

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredSpace = 15) => {
    console.log('🔍 checkPageBreak called with:', requiredSpace, 'type:', typeof requiredSpace)
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage()
      yPosition = 20
    }
  }

  // Helper function to add wrapped text
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, x, y)
    return lines.length * (fontSize * 0.6) // Return height used
  }

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  const reportTitle = project ? `${project.name} - Project Roadmap` : 'AI Project Roadmap'
  doc.text(reportTitle, marginLeft, yPosition)
  yPosition += 8

  if (project && project.description) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(64, 64, 64) // Gray color
    const descHeight = addWrappedText(project.description, marginLeft, yPosition, contentWidth, 12)
    yPosition += descHeight + 6
    doc.setTextColor(0, 0, 0) // Reset to black
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Analysis of ${ideaCount} ideas • Generated on ${new Date().toLocaleDateString()}`, marginLeft, yPosition)
  yPosition += 8

  doc.setFontSize(10)
  doc.setTextColor(64, 64, 64)
  doc.text(`Total Duration: ${roadmapData.roadmapAnalysis?.totalDuration || 'N/A'}`, marginLeft, yPosition)
  yPosition += 20

  // Project Phases
  console.log('🔍 About to call checkPageBreak(40)')
  checkPageBreak(40)
  console.log('🔍 checkPageBreak(40) completed successfully')
  console.log('🔍 About to call doc.setFontSize(16)', { doc: typeof doc, setFontSize: typeof doc.setFontSize })
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Implementation Roadmap', marginLeft, yPosition)
  yPosition += 15

  (roadmapData.roadmapAnalysis?.phases || []).forEach((phase: any, _index: number) => {
    checkPageBreak(60)
    
    // Phase Header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(102, 16, 242) // Purple
    doc.text(`${phase?.phase || 'Unknown Phase'} (${phase?.duration || 'Unknown Duration'})`, marginLeft, yPosition)
    doc.setTextColor(0, 0, 0)
    yPosition += 10

    // Phase Description
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const descHeight = addWrappedText(phase?.description || 'No description available', marginLeft + 5, yPosition, contentWidth - 5, 11)
    yPosition += descHeight + 10

    // Phase Epics
    if (phase?.epics && (phase.epics || []).length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Key Epics:', marginLeft + 5, yPosition)
      yPosition += 8

      (phase.epics || []).forEach((epic: any, epicIndex: number) => {
        checkPageBreak(25)
        
        // Epic Title
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(13, 110, 253) // Blue
        const epicTitle = `${epicIndex + 1}. ${epic?.title || 'Untitled Epic'} (${epic?.priority || 'unknown'} priority)`
        const epicTitleHeight = addWrappedText(epicTitle, marginLeft + 10, yPosition, contentWidth - 15, 11)
        yPosition += epicTitleHeight + 4
        doc.setTextColor(0, 0, 0)

        // Epic Description
        if (epic?.description) {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          const epicDescHeight = addWrappedText(epic?.description || '', marginLeft + 15, yPosition, contentWidth - 20)
          yPosition += epicDescHeight + 6
        }

        // User Stories
        if (epic?.userStories && (epic.userStories || []).length > 0) {
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.text('User Stories:', marginLeft + 15, yPosition)
          yPosition += 5
          
          doc.setFont('helvetica', 'normal')
          (epic.userStories || []).forEach((story: string) => {
            checkPageBreak(10)
            const storyHeight = addWrappedText(`• ${story}`, marginLeft + 20, yPosition, contentWidth - 25, 9)
            yPosition += storyHeight + 2
          })
          yPosition += 3
        }

        // Deliverables
        if (epic?.deliverables && (epic.deliverables || []).length > 0) {
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.text('Deliverables:', marginLeft + 15, yPosition)
          yPosition += 5
          
          doc.setFont('helvetica', 'normal')
          (epic.deliverables || []).forEach((deliverable: string) => {
            checkPageBreak(10)
            const deliverableHeight = addWrappedText(`• ${deliverable}`, marginLeft + 20, yPosition, contentWidth - 25, 9)
            yPosition += deliverableHeight + 2
          })
          yPosition += 5
        }
      })
    }

    // Risks
    if (phase?.risks && (phase.risks || []).length > 0) {
      checkPageBreak(20)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(220, 53, 69) // Red
      doc.text('Risks:', marginLeft + 5, yPosition)
      doc.setTextColor(0, 0, 0)
      yPosition += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      (phase.risks || []).forEach((risk: string) => {
        checkPageBreak(10)
        const riskHeight = addWrappedText(`• ${risk}`, marginLeft + 10, yPosition, contentWidth - 15)
        yPosition += riskHeight + 3
      })
      yPosition += 5
    }

    // Success Criteria
    if (phase?.successCriteria && (phase.successCriteria || []).length > 0) {
      checkPageBreak(20)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(25, 135, 84) // Green
      doc.text('Success Criteria:', marginLeft + 5, yPosition)
      doc.setTextColor(0, 0, 0)
      yPosition += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      (phase.successCriteria || []).forEach((criteria: string) => {
        checkPageBreak(10)
        const criteriaHeight = addWrappedText(`• ${criteria}`, marginLeft + 10, yPosition, contentWidth - 15)
        yPosition += criteriaHeight + 3
      })
      yPosition += 10
    }

    yPosition += 15 // Space between phases
  })

  // Execution Strategy
  checkPageBreak(50)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Execution Strategy', marginLeft, yPosition)
  yPosition += 15

  // Methodology
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(102, 16, 242) // Purple
  doc.text(`Methodology: ${roadmapData.executionStrategy?.methodology || 'N/A'}`, marginLeft, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 10

  // Sprint Length
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Sprint Length: ${roadmapData.executionStrategy?.sprintLength || 'N/A'}`, marginLeft, yPosition)
  yPosition += 15

  // Team Recommendations
  checkPageBreak(20)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Team Recommendations', marginLeft, yPosition)
  yPosition += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const teamRecHeight = addWrappedText(roadmapData.executionStrategy?.teamRecommendations || 'No team recommendations available', marginLeft + 5, yPosition, contentWidth - 5)
  yPosition += teamRecHeight + 15

  // Key Milestones
  checkPageBreak(30)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Key Milestones', marginLeft, yPosition)
  yPosition += 10

  (roadmapData.executionStrategy?.keyMilestones || []).forEach((milestone: any, index: number) => {
    checkPageBreak(15)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(13, 110, 253) // Blue
    doc.text(`${index + 1}. ${milestone?.milestone || 'Untitled Milestone'} (${milestone?.timeline || 'Unknown Timeline'})`, marginLeft + 5, yPosition)
    doc.setTextColor(0, 0, 0)
    yPosition += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const milestoneHeight = addWrappedText(milestone?.description || 'No description available', marginLeft + 10, yPosition, contentWidth - 15)
    yPosition += milestoneHeight + 8
  })

  // Footer on all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128) // Gray
    doc.text(`Generated by Prioritas AI • Page ${i} of ${totalPages}`, marginLeft, pageHeight - 10)
    doc.text(new Date().toLocaleDateString(), pageWidth - marginRight - 30, pageHeight - 10)
  }

  // Save the PDF
  const projectPrefix = project ? `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_` : ''
  const fileName = `${projectPrefix}Project_Roadmap_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}