import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export type ExportMode = 'overview' | 'detailed' | 'track'
export type ExportFormat = 'pdf' | 'png'

interface RoadmapFeature {
  id: string
  title: string
  description?: string
  startMonth: number
  duration: number
  team: string
  priority: 'high' | 'medium' | 'low'
  status: 'planned' | 'in-progress' | 'completed'
  userStories?: string[]
  deliverables?: string[]
  relatedIdeas?: string[]
  risks?: string[]
  successCriteria?: string[]
  complexity?: string
}

interface ExportOptions {
  mode: ExportMode
  format: ExportFormat
  title: string
  subtitle?: string
  teamFilter?: string
  includeDetails?: boolean
  landscape?: boolean
}

export class RoadmapExporter {
  private static async captureElement(element: HTMLElement, options: { 
    scale?: number
    useCORS?: boolean
    backgroundColor?: string
    width?: number
    height?: number
  } = {}): Promise<HTMLCanvasElement> {
    const defaultOptions = {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      allowTaint: true,
      foreignObjectRendering: true,
      ...options
    }

    return html2canvas(element, defaultOptions)
  }

  private static createPDF(canvas: HTMLCanvasElement, options: ExportOptions): jsPDF {
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: options.landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const canvasAspectRatio = canvas.height / canvas.width
    
    let imgWidth = pdfWidth
    let imgHeight = pdfWidth * canvasAspectRatio

    // If image is too tall, scale it down
    if (imgHeight > pdfHeight) {
      imgHeight = pdfHeight
      imgWidth = pdfHeight / canvasAspectRatio
    }

    // Center the image
    const x = (pdfWidth - imgWidth) / 2
    const y = (pdfHeight - imgHeight) / 2

    pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight)
    return pdf
  }

  private static downloadCanvas(canvas: HTMLCanvasElement, filename: string, format: ExportFormat) {
    if (format === 'png') {
      const link = document.createElement('a')
      link.download = `${filename}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }

  static async exportRoadmapElement(
    element: HTMLElement,
    options: ExportOptions
  ): Promise<void> {
    try {
      // Show loading state
      const loadingOverlay = document.createElement('div')
      loadingOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
      loadingOverlay.innerHTML = `
        <div class="bg-white rounded-lg p-6 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-700">Generating ${options.format.toUpperCase()}...</p>
        </div>
      `
      document.body.appendChild(loadingOverlay)

      // Wait a bit for the loading overlay to render
      await new Promise(resolve => setTimeout(resolve, 100))

      // Capture the element
      const canvas = await this.captureElement(element, {
        scale: options.mode === 'detailed' ? 3 : 2,
        width: element.scrollWidth,
        height: element.scrollHeight
      })

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `roadmap-${options.mode}-${timestamp}`

      if (options.format === 'pdf') {
        const pdf = this.createPDF(canvas, options)
        pdf.save(`${filename}.pdf`)
      } else {
        this.downloadCanvas(canvas, filename, options.format)
      }

      // Remove loading overlay
      document.body.removeChild(loadingOverlay)
    } catch (error) {
      console.error('Export failed:', error)
      
      // Remove loading overlay if it exists
      const overlay = document.querySelector('.fixed.inset-0.bg-black')
      if (overlay) {
        document.body.removeChild(overlay)
      }
      
      // Show error message
      alert('Export failed. Please try again.')
    }
  }

  static async exportOverview(
    roadmapElement: HTMLElement,
    title: string,
    format: ExportFormat = 'pdf'
  ): Promise<void> {
    return this.exportRoadmapElement(roadmapElement, {
      mode: 'overview',
      format,
      title,
      landscape: true,
      includeDetails: false
    })
  }

  static async exportDetailed(
    roadmapElement: HTMLElement,
    title: string,
    format: ExportFormat = 'pdf'
  ): Promise<void> {
    return this.exportRoadmapElement(roadmapElement, {
      mode: 'detailed',
      format,
      title,
      landscape: true,
      includeDetails: true
    })
  }

  static async exportTrack(
    trackElement: HTMLElement,
    teamName: string,
    title: string,
    format: ExportFormat = 'pdf'
  ): Promise<void> {
    return this.exportRoadmapElement(trackElement, {
      mode: 'track',
      format,
      title: `${title} - ${teamName} Track`,
      teamFilter: teamName,
      landscape: true,
      includeDetails: true
    })
  }
}

// Helper function to create export-optimized roadmap view
export const createExportView = (
  _: RoadmapFeature[],
  options: ExportOptions
): HTMLElement => {
  const container = document.createElement('div')
  container.className = 'bg-white p-8 font-sans'
  container.style.width = options.landscape ? '1400px' : '800px'
  container.style.minHeight = '600px'

  // Header
  const header = document.createElement('div')
  header.className = 'mb-8 text-center'
  header.innerHTML = `
    <h1 class="text-3xl font-bold text-gray-900 mb-2">${options.title}</h1>
    ${options.subtitle ? `<p class="text-lg text-gray-600">${options.subtitle}</p>` : ''}
    <p class="text-sm text-gray-500 mt-2">Generated on ${new Date().toLocaleDateString()}</p>
  `
  container.appendChild(header)

  return container
}