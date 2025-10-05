import { useState, useEffect, useRef } from 'react'
import { FileText, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { logger } from '../utils/logger'
import type { PDFDocumentProxy } from 'pdfjs-dist'

interface PDFViewerProps {
  fileUrl: string
  fileName: string
  onDownload: () => void
}

const PDFViewer: React.FC<PDFViewerProps> = ({ fileUrl, fileName, onDownload }) => {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load PDF document
  useEffect(() => {
    const loadPDF = async () => {
      setLoading(true)
      setError(null)

      try {
        // Import using namespace to get all exports
        const PDFJS = await import('pdfjs-dist')

        // Configure worker
        if (PDFJS.GlobalWorkerOptions) {
          PDFJS.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`
        }

        // Load PDF document
        const loadingTask = PDFJS.getDocument({
          url: fileUrl,
          httpHeaders: {
            'Accept': 'application/pdf'
          }
        })

        const pdfDoc = await loadingTask.promise
        setPdf(pdfDoc)
        setNumPages(pdfDoc.numPages)
        logger.debug('PDF loaded successfully', { numPages: pdfDoc.numPages, fileName })
      } catch (err) {
        logger.error('PDF load error:', err)
        setError('Failed to load PDF document')
      } finally {
        setLoading(false)
      }
    }

    if (fileUrl) {
      loadPDF()
    }

    return () => {
      // Cleanup PDF document
      if (pdf) {
        pdf.destroy()
      }
    }
  }, [fileUrl, fileName])

  // Render current page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdf || !canvasRef.current) return

      try {
        const page = await pdf.getPage(pageNum)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        if (!context) return

        // Calculate viewport based on container width
        const containerWidth = containerRef.current?.clientWidth || 800
        const viewport = page.getViewport({ scale: 1.0 })
        const scaleFactor = (containerWidth - 40) / viewport.width
        const finalScale = scale * scaleFactor
        const scaledViewport = page.getViewport({ scale: finalScale })

        // Set canvas dimensions
        canvas.height = scaledViewport.height
        canvas.width = scaledViewport.width
        canvas.style.width = '100%'
        canvas.style.height = 'auto'

        // Render PDF page to canvas
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport
        }

        await page.render(renderContext).promise
        logger.debug('Page rendered', { pageNum, scale: finalScale })
      } catch (err) {
        logger.error('Page render error:', err)
        setError('Failed to render page')
      }
    }

    renderPage()
  }, [pdf, pageNum, scale])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && pageNum > 1) {
        setPageNum(p => p - 1)
      } else if (e.key === 'ArrowRight' && pageNum < numPages) {
        setPageNum(p => p + 1)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [pageNum, numPages])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 rounded-lg" style={{ backgroundColor: 'var(--canvas-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--sapphire-600)' }}></div>
          <p style={{ color: 'var(--graphite-700)' }}>Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 rounded-lg" style={{ backgroundColor: 'var(--canvas-secondary)' }}>
        <FileText className="w-16 h-16 mb-4" style={{ color: 'var(--garnet-400)' }} />
        <p className="mb-2" style={{ color: 'var(--garnet-600)' }}>{error}</p>
        <button
          onClick={onDownload}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors"
          style={{
            backgroundColor: 'var(--sapphire-600)',
            color: 'white'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sapphire-700)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--sapphire-600)'}
        >
          <Download className="w-4 h-4" />
          <span>Download PDF</span>
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--canvas-secondary)' }}>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 rounded-lg p-3 border" style={{
        backgroundColor: 'var(--surface-primary)',
        borderColor: 'var(--hairline-default)'
      }}>
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5" style={{ color: 'var(--graphite-600)' }} />
          <h4 className="text-sm font-medium" style={{ color: 'var(--graphite-900)' }}>PDF Preview</h4>
        </div>

        <div className="flex items-center space-x-4">
          {/* Zoom controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              className="p-2 rounded transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--canvas-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium min-w-[60px] text-center" style={{ color: 'var(--graphite-700)' }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(3.0, s + 0.25))}
              className="p-2 rounded transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--canvas-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Page navigation */}
          <div className="flex items-center space-x-2 border-l pl-4" style={{ borderColor: 'var(--hairline-default)' }}>
            <button
              onClick={() => setPageNum(p => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              className="p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--canvas-secondary)')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm min-w-[80px] text-center" style={{ color: 'var(--graphite-700)' }}>
              Page {pageNum} / {numPages}
            </span>
            <button
              onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
              disabled={pageNum >= numPages}
              className="p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--canvas-secondary)')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Download */}
          <button
            onClick={onDownload}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--sapphire-600)',
              color: 'white'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sapphire-700)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--sapphire-600)'}
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div
        ref={containerRef}
        className="rounded-lg border overflow-auto max-h-[600px] flex justify-center p-4"
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderColor: 'var(--hairline-default)'
        }}
      >
        <canvas
          ref={canvasRef}
          className="shadow-lg"
          role="img"
          aria-label={`PDF page ${pageNum} of ${numPages}`}
        />
      </div>

      {/* Mobile page controls */}
      <div className="flex sm:hidden items-center justify-center space-x-4 mt-4">
        <button
          onClick={() => setPageNum(p => Math.max(1, p - 1))}
          disabled={pageNum <= 1}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
          style={{
            backgroundColor: 'var(--surface-primary)',
            borderColor: 'var(--hairline-default)'
          }}
        >
          Previous
        </button>
        <span className="text-sm" style={{ color: 'var(--graphite-700)' }}>
          {pageNum} / {numPages}
        </span>
        <button
          onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
          disabled={pageNum >= numPages}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
          style={{
            backgroundColor: 'var(--surface-primary)',
            borderColor: 'var(--hairline-default)'
          }}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default PDFViewer
