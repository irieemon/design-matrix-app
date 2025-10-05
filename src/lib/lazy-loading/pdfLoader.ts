/**
 * PDF Library Lazy Loader
 * Load heavy PDF libraries only when needed for massive bundle size reduction
 */

import { logger } from '../logging'

const pdfLoaderLogger = logger.withContext({ component: 'PDFLoader' })

interface PDFMakeModule {
  default: any
  vfs: { [file: string]: string }
}

interface HTML2CanvasModule {
  default: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>
}

// Cache loaded modules to prevent multiple loads
let pdfMakeCache: PDFMakeModule | null = null
let html2CanvasCache: HTML2CanvasModule | null = null

/**
 * Lazy load pdfmake library (1.2MB reduction from initial bundle)
 */
export const loadPDFMake = async (): Promise<PDFMakeModule> => {
  if (pdfMakeCache) {
    return pdfMakeCache
  }

  pdfLoaderLogger.debug('Loading PDF export library')
  const startTime = performance.now()

  try {
    // Dynamic import to split from main bundle
    const [pdfMake, vfsFonts] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts')
    ])

    // Initialize fonts
    pdfMake.default.vfs = vfsFonts.vfs

    pdfMakeCache = {
      default: pdfMake.default,
      vfs: vfsFonts.vfs
    }

    const loadTime = performance.now() - startTime
    pdfLoaderLogger.info('PDF library loaded successfully', {
      loadTime: `${loadTime.toFixed(2)}ms`,
      operation: 'loadPDFMake'
    })

    return pdfMakeCache
  } catch (error) {
    pdfLoaderLogger.error('Failed to load PDF library', error, {
      operation: 'loadPDFMake'
    })
    throw new Error('PDF export functionality is currently unavailable')
  }
}

/**
 * Lazy load html2canvas library (200KB reduction from initial bundle)
 */
export const loadHTML2Canvas = async (): Promise<HTML2CanvasModule> => {
  if (html2CanvasCache) {
    return html2CanvasCache
  }

  pdfLoaderLogger.debug('Loading screenshot library')
  const startTime = performance.now()

  try {
    const html2canvas = await import('html2canvas')

    html2CanvasCache = {
      default: html2canvas.default as any
    }

    const loadTime = performance.now() - startTime
    pdfLoaderLogger.info('Screenshot library loaded successfully', {
      loadTime: `${loadTime.toFixed(2)}ms`,
      operation: 'loadHTML2Canvas'
    })

    return html2CanvasCache as HTML2CanvasModule
  } catch (error) {
    pdfLoaderLogger.error('Failed to load screenshot library', error, {
      operation: 'loadHTML2Canvas'
    })
    throw new Error('Screenshot functionality is currently unavailable')
  }
}

/**
 * Load both PDF libraries in parallel when both are needed
 */
export const loadPDFLibraries = async (): Promise<{
  pdfMake: PDFMakeModule
  html2canvas: HTML2CanvasModule
}> => {
  pdfLoaderLogger.debug('Loading PDF export bundle')
  const startTime = performance.now()

  try {
    const [pdfMake, html2canvas] = await Promise.all([
      loadPDFMake(),
      loadHTML2Canvas()
    ])

    const loadTime = performance.now() - startTime
    pdfLoaderLogger.info('PDF bundle loaded successfully', {
      loadTime: `${loadTime.toFixed(2)}ms`,
      operation: 'loadPDFLibraries'
    })

    return { pdfMake, html2canvas }
  } catch (error) {
    pdfLoaderLogger.error('Failed to load PDF bundle', error, {
      operation: 'loadPDFLibraries'
    })
    throw error
  }
}

/**
 * Preload PDF libraries in the background for faster access
 * Call this when user shows intent to export (hover over export button)
 */
export const preloadPDFLibraries = (): void => {
  // Use requestIdleCallback if available for non-blocking preload
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      loadPDFLibraries().catch(() => {
        // Silently fail preload attempts
      })
    })
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      loadPDFLibraries().catch(() => {
        // Silently fail preload attempts
      })
    }, 1000)
  }
}

/**
 * Check if PDF libraries are already loaded
 */
export const isPDFLibrariesLoaded = (): boolean => {
  return !!(pdfMakeCache && html2CanvasCache)
}

/**
 * Clear library cache (useful for testing or memory management)
 */
export const clearPDFLibraryCache = (): void => {
  pdfMakeCache = null
  html2CanvasCache = null
  pdfLoaderLogger.debug('PDF library cache cleared', {
    operation: 'clearPDFLibraryCache'
  })
}
