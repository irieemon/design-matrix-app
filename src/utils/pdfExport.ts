import jsPDF from 'jspdf'

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

export const exportInsightsToPDF = (insights: InsightsReport, ideaCount: number) => {
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
  doc.text('AI Strategic Insights Report', marginLeft, yPosition)
  yPosition += 10

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

  insights.keyInsights.forEach((item, index) => {
    checkPageBreak(20)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`${index + 1}. ${item.insight}`, marginLeft, yPosition)
    yPosition += 6
    
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
  insights.priorityRecommendations.immediate.forEach((item) => {
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
  insights.priorityRecommendations.shortTerm.forEach((item) => {
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
  insights.priorityRecommendations.longTerm.forEach((item) => {
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
  insights.riskAssessment.highRisk.forEach((risk) => {
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
  insights.riskAssessment.opportunities.forEach((opportunity) => {
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

  insights.suggestedRoadmap.forEach((phase, index) => {
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

    if (phase.ideas.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.text('Key Ideas:', marginLeft + 5, yPosition)
      yPosition += 6
      
      doc.setFont('helvetica', 'normal')
      phase.ideas.forEach((idea) => {
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
  insights.nextSteps.forEach((step, index) => {
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
  const fileName = `AI_Insights_Report_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}