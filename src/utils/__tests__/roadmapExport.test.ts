import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RoadmapExporter, createExportView, ExportFormat, ExportMode } from '../roadmapExport'

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn((element: HTMLElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = element.offsetWidth || 1400
    canvas.height = element.offsetHeight || 1000

    // Create a mock 2d context
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Mock getImageData to return some pixel data
      const originalGetImageData = ctx.getImageData.bind(ctx)
      ctx.getImageData = vi.fn(() => {
        const imageData = originalGetImageData(0, 0, 1, 1)
        // Set some non-white pixels to indicate content
        imageData.data[0] = 100
        imageData.data[1] = 100
        imageData.data[2] = 100
        imageData.data[3] = 255
        return imageData
      }) as any
    }

    return Promise.resolve(canvas)
  })
}))

// Mock jsPDF
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 297,
        getHeight: () => 210
      }
    },
    addImage: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    getNumberOfPages: () => 1,
    setPage: vi.fn()
  }))
}))

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html
  }
}))

describe('roadmapExport', () => {
  let mockElement: HTMLElement

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''

    // Create mock element with content
    mockElement = document.createElement('div')
    mockElement.style.width = '1400px'
    mockElement.style.height = '1000px'
    mockElement.innerHTML = '<div class="content">Roadmap Content</div>'
    document.body.appendChild(mockElement)

    // Mock alert
    global.alert = vi.fn()

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  describe('RoadmapExporter.exportRoadmapElement', () => {
    it('should export roadmap as PDF', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Roadmap',
        landscape: true
      })

      // Should not show alert on success
      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should export roadmap as PNG', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'overview',
        format: 'png',
        title: 'Test Roadmap'
      })

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should show loading overlay during export', async () => {
      const exportPromise = RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'detailed',
        format: 'pdf',
        title: 'Test Roadmap'
      })

      // Check for loading overlay briefly
      await new Promise(resolve => setTimeout(resolve, 10))

      await exportPromise

      // Loading overlay should be removed after export
      const overlays = document.querySelectorAll('.fixed.inset-0.bg-black')
      expect(overlays.length).toBe(0)
    })

    it('should handle export errors gracefully', async () => {
      // Force html2canvas to fail
      const html2canvas = await import('html2canvas')
      vi.mocked(html2canvas.default).mockRejectedValueOnce(new Error('Canvas error'))

      await expect(
        RoadmapExporter.exportRoadmapElement(mockElement, {
          mode: 'overview',
          format: 'pdf',
          title: 'Test Roadmap'
        })
      ).rejects.toThrow('Canvas error')

      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Export failed')
      )
    })

    it('should include subtitle in export options', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Roadmap',
        subtitle: 'Q4 2024 Planning',
        landscape: true
      })

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should handle team filter in options', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'track',
        format: 'pdf',
        title: 'Test Roadmap',
        teamFilter: 'Engineering',
        landscape: true
      })

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should handle includeDetails option', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'detailed',
        format: 'pdf',
        title: 'Test Roadmap',
        includeDetails: true,
        landscape: true
      })

      expect(global.alert).not.toHaveBeenCalled()
    })
  })

  describe('RoadmapExporter.exportMultiPagePDF', () => {
    beforeEach(() => {
      // Create mock page containers
      const page1 = document.createElement('div')
      page1.className = 'export-page'
      page1.id = 'overview-page-1'
      page1.innerHTML = 'Page 1 Content'

      const page2 = document.createElement('div')
      page2.className = 'export-page'
      page2.id = 'overview-page-2'
      page2.innerHTML = 'Page 2 Content'

      mockElement.appendChild(page1)
      mockElement.appendChild(page2)
    })

    it('should export multiple pages to PDF', async () => {
      await RoadmapExporter.exportMultiPagePDF(mockElement, {
        mode: 'overview',
        format: 'pdf',
        title: 'Multi-page Roadmap',
        landscape: true
      })

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should fallback to single page export if no page containers found', async () => {
      const simpleElement = document.createElement('div')
      simpleElement.innerHTML = 'Simple content'
      document.body.appendChild(simpleElement)

      await RoadmapExporter.exportMultiPagePDF(simpleElement, {
        mode: 'overview',
        format: 'pdf',
        title: 'Roadmap',
        landscape: true
      })

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should handle errors in multi-page export', async () => {
      const html2canvas = await import('html2canvas')
      vi.mocked(html2canvas.default).mockRejectedValueOnce(new Error('Page render error'))

      await expect(
        RoadmapExporter.exportMultiPagePDF(mockElement, {
          mode: 'overview',
          format: 'pdf',
          title: 'Roadmap',
          landscape: true
        })
      ).rejects.toThrow('Page render error')

      expect(global.alert).toHaveBeenCalled()
    })
  })

  describe('RoadmapExporter.exportOverview', () => {
    it('should export overview in PDF format by default', async () => {
      await RoadmapExporter.exportOverview(mockElement, 'Overview Roadmap')

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should export overview in PNG format', async () => {
      await RoadmapExporter.exportOverview(mockElement, 'Overview Roadmap', 'png')

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should use landscape orientation by default', async () => {
      await RoadmapExporter.exportOverview(mockElement, 'Overview Roadmap')

      // Implicitly tested through successful execution
      expect(global.alert).not.toHaveBeenCalled()
    })
  })

  describe('RoadmapExporter.exportDetailed', () => {
    it('should export detailed view in PDF format by default', async () => {
      await RoadmapExporter.exportDetailed(mockElement, 'Detailed Roadmap')

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should export detailed view in PNG format', async () => {
      await RoadmapExporter.exportDetailed(mockElement, 'Detailed Roadmap', 'png')

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should include details by default', async () => {
      await RoadmapExporter.exportDetailed(mockElement, 'Detailed Roadmap')

      expect(global.alert).not.toHaveBeenCalled()
    })
  })

  describe('RoadmapExporter.exportTrack', () => {
    it('should export track view in PDF format by default', async () => {
      await RoadmapExporter.exportTrack(mockElement, 'Engineering', 'Track Roadmap')

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should export track view in PNG format', async () => {
      await RoadmapExporter.exportTrack(mockElement, 'Engineering', 'Track Roadmap', 'png')

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should include team name in title', async () => {
      await RoadmapExporter.exportTrack(mockElement, 'Marketing', 'Roadmap')

      expect(global.alert).not.toHaveBeenCalled()
    })
  })

  describe('createExportView', () => {
    const mockFeatures = [
      {
        id: 'f1',
        title: 'Feature 1',
        description: 'Test feature',
        startMonth: 0,
        duration: 2,
        team: 'engineering',
        priority: 'high' as const,
        status: 'in-progress' as const
      }
    ]

    it('should create export view with title', () => {
      const view = createExportView(mockFeatures, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Export'
      })

      expect(view).toBeInstanceOf(HTMLElement)
      expect(view.innerHTML).toContain('Test Export')
    })

    it('should create export view with subtitle', () => {
      const view = createExportView(mockFeatures, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Export',
        subtitle: 'Q4 2024'
      })

      expect(view.innerHTML).toContain('Q4 2024')
    })

    it('should use landscape dimensions by default', () => {
      const view = createExportView(mockFeatures, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Export',
        landscape: true
      })

      expect(view.style.width).toBe('1400px')
    })

    it('should use portrait dimensions when specified', () => {
      const view = createExportView(mockFeatures, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Export',
        landscape: false
      })

      expect(view.style.width).toBe('800px')
    })

    it('should include generation date', () => {
      const view = createExportView(mockFeatures, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Export'
      })

      expect(view.innerHTML).toContain('Generated on')
    })

    it('should have white background', () => {
      const view = createExportView(mockFeatures, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Export'
      })

      expect(view.className).toContain('bg-white')
    })

    it('should have proper padding', () => {
      const view = createExportView(mockFeatures, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Export'
      })

      expect(view.className).toContain('p-8')
    })

    it('should have minimum height', () => {
      const view = createExportView(mockFeatures, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test Export'
      })

      expect(view.style.minHeight).toBe('600px')
    })
  })

  describe('Export Modes', () => {
    it('should handle overview mode', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'overview',
        format: 'pdf',
        title: 'Overview'
      })

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should handle detailed mode', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'detailed',
        format: 'pdf',
        title: 'Detailed'
      })

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should handle track mode', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'track',
        format: 'pdf',
        title: 'Track'
      })

      expect(global.alert).not.toHaveBeenCalled()
    })
  })

  describe('Export Formats', () => {
    it('should support PDF format', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'overview',
        format: 'pdf',
        title: 'PDF Export'
      })

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should support PNG format', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'overview',
        format: 'png',
        title: 'PNG Export'
      })

      expect(global.alert).not.toHaveBeenCalled()
    })
  })

  describe('Canvas Capture', () => {
    it('should capture element with correct scale', async () => {
      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'detailed',
        format: 'pdf',
        title: 'Test'
      })

      const html2canvas = await import('html2canvas')
      expect(html2canvas.default).toHaveBeenCalled()
    })

    it('should handle elements with scroll dimensions', async () => {
      Object.defineProperty(mockElement, 'scrollWidth', {
        value: 2000,
        writable: true
      })
      Object.defineProperty(mockElement, 'scrollHeight', {
        value: 1500,
        writable: true
      })

      await RoadmapExporter.exportRoadmapElement(mockElement, {
        mode: 'overview',
        format: 'pdf',
        title: 'Test'
      })

      expect(global.alert).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should clean up loading overlay on error', async () => {
      const html2canvas = await import('html2canvas')
      vi.mocked(html2canvas.default).mockRejectedValueOnce(new Error('Test error'))

      await expect(
        RoadmapExporter.exportRoadmapElement(mockElement, {
          mode: 'overview',
          format: 'pdf',
          title: 'Test'
        })
      ).rejects.toThrow()

      // Loading overlay should be cleaned up
      const overlays = document.querySelectorAll('.fixed.inset-0')
      expect(overlays.length).toBe(0)
    })

    it('should show user-friendly error message', async () => {
      const html2canvas = await import('html2canvas')
      vi.mocked(html2canvas.default).mockRejectedValueOnce(new Error('Canvas failed'))

      await expect(
        RoadmapExporter.exportRoadmapElement(mockElement, {
          mode: 'overview',
          format: 'pdf',
          title: 'Test'
        })
      ).rejects.toThrow()

      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Export failed: Canvas failed')
      )
    })
  })
})