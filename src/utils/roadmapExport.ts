import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import DOMPurify from 'dompurify'
import { logger } from '../lib/logging'

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
  private static exportLogger = logger.withContext({ component: 'RoadmapExporter' })

  /**
   * Optimize canvas data for PDF export with intelligent quality adjustment
   * @param canvas - The canvas element to optimize
   * @param quality - JPEG quality (0.0 to 1.0), default 0.85
   * @returns Optimized image data URL
   */
  private static optimizeCanvasForPDF(canvas: HTMLCanvasElement, quality: number = 0.85): string {
    // Try JPEG with specified quality first (much smaller than PNG)
    const jpegData = canvas.toDataURL('image/jpeg', quality)

    // If JPEG is still huge (>5MB), reduce quality further
    if (jpegData.length > 5_000_000) {
      this.exportLogger.warn('Large image detected, reducing quality', {
        originalSize: Math.round(jpegData.length / 1024 / 1024 * 100) / 100,
        threshold: '5MB'
      })
      return canvas.toDataURL('image/jpeg', 0.70) // Lower quality for very large images
    }

    return jpegData
  }

  /**
   * Estimate PDF size based on canvas dimensions
   * @param canvas - The canvas to estimate size for
   * @returns Estimated size in MB
   */
  private static estimatePDFSize(canvas: HTMLCanvasElement): number {
    const pixels = canvas.width * canvas.height
    // Rough estimate: JPEG @ 85% quality ≈ 3 bytes per pixel
    const estimatedMB = (pixels * 3) / (1024 * 1024)
    return Math.round(estimatedMB * 100) / 100
  }

  /**
   * Calculate optimal scale factor based on element size
   * @param element - The element to calculate scale for
   * @returns Optimal scale factor
   */
  private static calculateOptimalScale(element: HTMLElement): number {
    const pixelCount = element.offsetWidth * element.offsetHeight

    // Large elements (>1M pixels) use lower scale to prevent massive file sizes
    if (pixelCount > 1_000_000) {
      return 1.0 // 1x scale for very large elements
    }

    // Medium elements use moderate scale
    if (pixelCount > 500_000) {
      return 1.2 // 1.2x scale for medium elements
    }

    // Small elements can use higher scale for quality
    return 1.5 // 1.5x scale for smaller elements
  }

  private static async captureElement(element: HTMLElement, options: {
    scale?: number
    useCORS?: boolean
    backgroundColor?: string
    width?: number
    height?: number
  } = {}): Promise<HTMLCanvasElement> {
    this.exportLogger.debug('Capturing element with computed styles')

    // Get computed styles to ensure visibility
    const computedStyle = window.getComputedStyle(element)
    this.exportLogger.debug('Element computed styles', {
      visibility: computedStyle.visibility,
      display: computedStyle.display,
      opacity: computedStyle.opacity
    })

    // Calculate optimal scale if not provided
    const optimalScale = options.scale || this.calculateOptimalScale(element)

    const defaultOptions = {
      scale: optimalScale,
      useCORS: true,
      backgroundColor: '#ffffff',
      allowTaint: true,
      foreignObjectRendering: false,
      logging: true,
      removeContainer: false,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: element.offsetWidth,
      height: element.offsetHeight,
      ignoreElements: (element: Element) => {
        // Ignore certain problematic elements
        return element.classList.contains('fixed') ||
               element.classList.contains('absolute') ||
               element.tagName === 'IFRAME'
      },
      ...options
    }

    this.exportLogger.debug('html2canvas configuration', {
      scale: defaultOptions.scale,
      width: defaultOptions.width,
      height: defaultOptions.height,
      estimatedPixels: (defaultOptions.width * defaultOptions.scale) * (defaultOptions.height * defaultOptions.scale)
    })

    // Wait a bit for any lazy-loaded content
    await new Promise(resolve => setTimeout(resolve, 300))

    return html2canvas(element, defaultOptions)
  }

  private static createPDF(canvas: HTMLCanvasElement, options: ExportOptions): jsPDF {
    this.exportLogger.debug('Creating PDF from canvas', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    })

    // Check if canvas has content by creating a temporary test
    const context = canvas.getContext('2d')
    const imageData = context?.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData?.data

    // Check if canvas is blank (all pixels are transparent or white)
    let hasContent = false
    if (data) {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]

        // If we find any non-white, non-transparent pixel
        if (a > 0 && (r !== 255 || g !== 255 || b !== 255)) {
          hasContent = true
          break
        }
      }
    }

    this.exportLogger.debug('Canvas content validation', { hasContent })

    // Use optimized JPEG instead of PNG
    const imgData = this.optimizeCanvasForPDF(canvas, 0.85)
    const estimatedSize = this.estimatePDFSize(canvas)

    this.exportLogger.debug('Image data generated', {
      dataLength: imgData.length,
      dataSizeMB: Math.round(imgData.length / 1024 / 1024 * 100) / 100,
      estimatedPDFSizeMB: estimatedSize
    })

    // Warn if estimated size is large
    if (estimatedSize > 10) {
      this.exportLogger.warn('Large PDF expected', {
        estimatedSizeMB: estimatedSize,
        recommendation: 'Consider reducing content or using lower resolution'
      })
    }

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

    this.exportLogger.debug('Adding image to PDF', { x, y, imgWidth, imgHeight })
    // Use JPEG format in addImage for consistency
    pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight)
    return pdf
  }

  private static downloadCanvas(canvas: HTMLCanvasElement, filename: string, format: ExportFormat) {
    if (format === 'png') {
      const link = document.createElement('a')
      link.download = `${filename}.png`
      // PNG export can remain high quality since it's typically for single images
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }

  static async exportMultiPagePDF(
    element: HTMLElement,
    options: ExportOptions
  ): Promise<void> {
    try {
      this.exportLogger.info('Starting multi-page PDF export', {
        exportMode: options.mode,
        format: options.format,
        landscape: options.landscape,
        title: options.title
      })

      // Show loading state
      const loadingOverlay = document.createElement('div')
      loadingOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
      const loadingContent = DOMPurify.sanitize(`
        <div class="bg-white rounded-lg p-6 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-700">Generating Multi-Page PDF...</p>
        </div>
      `)
      loadingOverlay.innerHTML = loadingContent
      document.body.appendChild(loadingOverlay)

      // Wait for loading overlay to render
      await new Promise(resolve => setTimeout(resolve, 300))

      // Find page sections in the element
      const pageContainers = element.querySelectorAll('.export-page, #overview-page-1, #overview-page-2, #overview-page-3')
      this.exportLogger.debug('Found page containers', { pageCount: pageContainers.length })

      if (pageContainers.length === 0) {
        // Fallback to single page export
        return this.exportRoadmapElement(element, options)
      }

      // Create PDF document
      const pdf = new jsPDF({
        orientation: options.landscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      let totalEstimatedSize = 0

      // Process each page container
      for (let i = 0; i < pageContainers.length; i++) {
        const pageContainer = pageContainers[i] as HTMLElement
        this.exportLogger.debug('Processing page', {
          currentPage: i + 1,
          totalPages: pageContainers.length,
          progress: `${Math.round(((i + 1) / pageContainers.length) * 100)}%`
        })

        // Capture this page section with optimized scale (1.5x instead of 2x)
        const canvas = await this.captureElement(pageContainer, {
          scale: 1.5, // Reduced from 2.0 - saves 44% pixels
          width: 1400,
          height: 1000,
          backgroundColor: '#ffffff'
        })

        const pageSize = this.estimatePDFSize(canvas)
        totalEstimatedSize += pageSize

        this.exportLogger.debug('Page canvas captured', {
          pageIndex: i + 1,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          estimatedPageSizeMB: pageSize
        })

        // Use optimized JPEG instead of PNG
        const imgData = this.optimizeCanvasForPDF(canvas, 0.85)
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

        // Add page if not the first one
        if (i > 0) {
          pdf.addPage()
        }

        // Add image to PDF with JPEG format
        this.exportLogger.debug('Adding page to PDF', {
          pageIndex: i + 1,
          x,
          y,
          imgWidth,
          imgHeight
        })
        pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight)
      }

      // Log final size estimation
      this.exportLogger.info('Multi-page PDF size estimation', {
        totalPages: pageContainers.length,
        estimatedTotalSizeMB: Math.round(totalEstimatedSize * 100) / 100
      })

      // Warn if final PDF will be very large
      if (totalEstimatedSize > 20) {
        this.exportLogger.warn('Large multi-page PDF generated', {
          estimatedSizeMB: Math.round(totalEstimatedSize * 100) / 100,
          recommendation: 'Consider exporting fewer pages or reducing resolution'
        })
      }

      // Save the PDF
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `roadmap-${options.mode}-${timestamp}.pdf`
      pdf.save(filename)

      this.exportLogger.info('Multi-page PDF export completed successfully', {
        pageCount: pageContainers.length,
        filename,
        estimatedSizeMB: Math.round(totalEstimatedSize * 100) / 100
      })

      // Remove loading overlay
      document.body.removeChild(loadingOverlay)
    } catch (_error) {
      this.exportLogger.error('Multi-page PDF export failed', error, {
        exportMode: options.mode,
        format: options.format,
        pageCount: element.querySelectorAll('.export-page, #overview-page-1, #overview-page-2, #overview-page-3').length
      })

      // Remove loading overlay if it exists
      const overlay = document.querySelector('.fixed.inset-0.bg-black')
      if (overlay) {
        document.body.removeChild(overlay)
      }

      // Show error message
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
      throw error
    }
  }

  static async exportRoadmapElement(
    element: HTMLElement,
    options: ExportOptions
  ): Promise<void> {
    try {
      this.exportLogger.info('Starting export', {
        exportMode: options.mode,
        format: options.format,
        landscape: options.landscape,
        title: options.title
      })

      // Check if this is a multi-page overview export
      if (options.mode === 'overview' && options.format === 'pdf') {
        return this.exportMultiPagePDF(element, options)
      }

      this.exportLogger.debug('Element dimensions', {
        width: element.offsetWidth,
        height: element.offsetHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight
      })

      // Show loading state
      const loadingOverlay = document.createElement('div')
      loadingOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
      const loadingContent = DOMPurify.sanitize(`
        <div class="bg-white rounded-lg p-6 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-700">Generating ${DOMPurify.sanitize(options.format.toUpperCase())}...</p>
        </div>
      `)
      loadingOverlay.innerHTML = loadingContent
      document.body.appendChild(loadingOverlay)

      // Wait a bit for the loading overlay to render
      await new Promise(resolve => setTimeout(resolve, 200))

      this.exportLogger.debug('Capturing element')

      // Capture the element with optimized scale (1.5x instead of 2x)
      const canvas = await this.captureElement(element, {
        scale: 1.5, // Reduced from 2.0 for both modes - saves 44% pixels
        width: Math.max(element.offsetWidth, element.scrollWidth, 1400),
        height: Math.max(element.offsetHeight, element.scrollHeight, 1000)
      })

      const estimatedSize = this.estimatePDFSize(canvas)

      this.exportLogger.debug('Canvas created', {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        estimatedSizeMB: estimatedSize
      })

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `roadmap-${options.mode}-${timestamp}`


      if (options.format === 'pdf') {
        this.exportLogger.debug('Creating PDF', {
          filename: `${filename}.pdf`,
          estimatedSizeMB: estimatedSize
        })
        const pdf = this.createPDF(canvas, options)
        pdf.save(`${filename}.pdf`)
      } else {
        this.exportLogger.debug('Creating PNG', { filename: `${filename}.png` })
        this.downloadCanvas(canvas, filename, options.format)
      }

      this.exportLogger.info('Export completed successfully', {
        exportMode: options.mode,
        format: options.format,
        filename: `${filename}.${options.format}`,
        estimatedSizeMB: options.format === 'pdf' ? estimatedSize : undefined
      })

      // Remove loading overlay
      document.body.removeChild(loadingOverlay)
    } catch (_error) {
      this.exportLogger.error('Export failed', error, {
        exportMode: options.mode,
        format: options.format,
        operation: 'export'
      })

      // Remove loading overlay if it exists
      const overlay = document.querySelector('.fixed.inset-0.bg-black')
      if (overlay) {
        document.body.removeChild(overlay)
      }

      // Show error message
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
      throw error
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
  const headerContent = DOMPurify.sanitize(`
    <h1 class="text-3xl font-bold text-gray-900 mb-2">${DOMPurify.sanitize(options.title)}</h1>
    ${options.subtitle ? `<p class="text-lg text-gray-600">${DOMPurify.sanitize(options.subtitle)}</p>` : ''}
    <p class="text-sm text-gray-500 mt-2">Generated on ${DOMPurify.sanitize(new Date().toLocaleDateString())}</p>
  `)
  header.innerHTML = headerContent
  container.appendChild(header)

  return container
}
